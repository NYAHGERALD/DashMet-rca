'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import api from '@/lib/api';
import EvidenceUpload, { StagedFile, uploadStagedEvidence } from '@/components/incidents/EvidenceUpload';
import AIAnalysisModal from '@/components/AIAnalysisModal';
import IncidentSubmissionModal from '@/components/IncidentSubmissionModal';
import { usePrivileges, INCIDENTS_PRIVILEGES } from '@/lib/usePrivileges';
import AccessDeniedModal, { useAccessDeniedModal, handlePrivilegeError } from '@/components/modals/AccessDeniedModal';
import { useToast } from '@/components/ui/Toast';
import {
  ensureRcaWorkspaceForIncident,
  normalizeRcaMethod,
} from '@/lib/incidentWorkspace';

interface Category {
  id: string;
  name: string;
  type: string;
  parentId: string | null;
  allowCustomTitle: boolean;
  children?: Category[];
}

interface DropdownOption {
  id: string;
  value: string;
  label: string;
  type?: string;
}

interface Facility {
  id: string;
  name: string;
}

interface Area {
  id: string;
  name: string;
  departmentId?: string;
  department?: {
    id: string;
    name: string;
    facility?: {
      id: string;
      name: string;
    };
  };
}

interface Department {
  id: string;
  name: string;
  description?: string;
  facilityId: string;
  Facility?: {
    id: string;
    name: string;
  };
}

interface Line {
  id: string;
  name: string;
  lineNumber: string;
  areaId: string;
}

interface Shift {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
}

interface TeamParticipant {
  userId: string;
  role: string;
  canEdit: boolean;
  canChat: boolean;
}

const INCIDENT_TYPE_OPTIONS = [
  {
    value: 'FOOD_SAFETY',
    label: 'Food Safety',
    description: 'Contamination, allergens, packaging issues',
  },
  {
    value: 'MACHINE_EQUIPMENT',
    label: 'Machine & Equipment',
    description: 'Mechanical, electrical, control failures',
  },
  {
    value: 'WORKPLACE_SAFETY',
    label: 'Workplace Safety',
    description: 'Injuries, hazards, PPE, compliance',
  },
  {
    value: 'OPERATIONS',
    label: 'Operations',
    description: 'OEE, waste, efficiency issues',
  },
] as const;

// AI Enhancement Button Component
const AIEnhanceButton = ({
  onClick,
  isLoading,
  show
}: {
  onClick: () => void;
  isLoading: boolean;
  show: boolean;
}) => {
  if (!show) return null;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isLoading}
      className="inline-flex items-center gap-1.5 rounded-full bg-primary-600 px-3 py-1 text-xs font-medium text-white shadow-sm transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {isLoading ? (
        <>
          <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Improving...
        </>
      ) : (
        <>
          Improve Text
        </>
      )}
    </button>
  );
};

interface IncidentFormModalProps {
  editIncidentId?: string | null;
  section?: string | null;
  onClose?: () => void;
  embedded?: boolean;
  initialVisibility?: 'PRIVATE' | 'TEAM' | 'PUBLIC';
}

export default function IncidentFormModal(props: IncidentFormModalProps = {}) {
  return <NewIncidentPageContent {...props} />;
}

function NewIncidentPageContent({
  editIncidentId: editIncidentIdOverride,
  section,
  onClose,
  embedded = false,
  initialVisibility = 'PRIVATE',
}: IncidentFormModalProps) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const routeEditIncidentId = searchParams.get('edit');
  const editIncidentId = editIncidentIdOverride !== undefined ? editIncidentIdOverride : routeEditIncidentId;
  const sectionParam = section !== undefined ? section : searchParams.get('section');

  // Privilege-based access control - include version for real-time updates
  const { hasPrivilege, loading: privilegesLoading, version: privilegeVersion } = usePrivileges();
  const canCreateIncident = hasPrivilege(INCIDENTS_PRIVILEGES.CREATE);
  const canEditIncident = hasPrivilege(INCIDENTS_PRIVILEGES.EDIT);
  const { modal: accessDeniedModal, showAccessDenied } = useAccessDeniedModal();

  // Inline check for access denied - prevents flash of content
  const shouldShowAccessDenied = !privilegesLoading && (
    (!editIncidentId && !canCreateIncident) || (editIncidentId && !canEditIncident)
  );

  // Edit mode state
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingIncidentNumber, setEditingIncidentNumber] = useState<string | null>(null);
  const [editingIncidentStatus, setEditingIncidentStatus] = useState<string | null>(null);

  // Helper to get current datetime in local timezone for datetime-local input
  const getLocalDateTimeString = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  // Form state
  const [formData, setFormData] = useState({
    type: '' as 'FOOD_SAFETY' | 'MACHINE_EQUIPMENT' | 'WORKPLACE_SAFETY' | 'OPERATIONS' | '',
    mainCategoryId: '', // Parent category
    categoryId: '', // Subcategory (what gets saved to incident)
    customTitle: '',
    description: '',
    aiSummary: '',
    facilityId: '',
    departmentId: '',
    areaId: '',
    lineId: '',
    shiftId: '',
    productName: '',
    lotNumber: '',
    machineId: '',
    occurredAt: getLocalDateTimeString(),
    severity: '' as '' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
    visibility: initialVisibility,
    // Workplace Safety specific fields
    injuryType: '' as 'FIRST_AID' | 'RECORDABLE' | 'NEAR_MISS' | 'LOST_TIME' | '',
    bodyPartsAffected: [] as string[],
    bodyPartsAffectedNA: false,
    otherBodyPartDetail: '',
    taskBeingPerformed: '',
    isRoutineTask: null as boolean | null,
    exposureDuration: '',
    taskFrequency: '',
    weightOrForce: '',
    environmentalConditions: [] as string[],
    environmentalConditionsNA: false,
    ppeRequired: null as boolean | null,
    ppeWorn: null as boolean | null,
    machineSafeguardsInPlace: '' as 'YES' | 'NO' | 'NA' | '',
    lotoRequired: '' as 'YES' | 'NO' | 'NA' | '',
    sopAvailable: null as boolean | null,
    sopFollowed: null as boolean | null,
    firstAidProvided: null as boolean | null,
    medicalTreatmentRequired: null as boolean | null,
    supervisorNotified: null as boolean | null,
    areaSecured: '' as 'YES' | 'NO' | 'NA' | '',
    directCause: '',
    contributingFactors: { people: [] as string[], process: [] as string[], equipment: [] as string[], environment: [] as string[] },
    unsafeActOrCondition: '' as 'UNSAFE_ACT' | 'UNSAFE_CONDITION' | 'BOTH' | '',
    previousSimilarIncidents: null as boolean | null,
    // Regulatory & Workers' Compensation fields
    priorSurgeryPerformed: null as boolean | null,
    priorSurgeryDescription: '',
    treatingDoctors: '',
    employedElsewhere: null as boolean | null,
    additionalEmployers: '',
    additionalEmployerHours: '',
    additionalEmployerStartDate: '',
    workedForOtherLast6Months: null as boolean | null,
    otherEmployerNames: '',
    injuryDevelopedOverTime: null as boolean | null,
    injuryDevelopmentType: '', // Database-driven dropdown replacement
    taskRoutineType: '', // Database-driven dropdown for Normal vs Non-Routine Task
    dateOfInjury: '',
    timeOfInjury: '',
    injuryLocation: '',
    injuryCausedByWork: '' as 'YES' | 'NO' | 'UNCERTAIN' | 'NA' | '',
    injuryWitnessed: null as boolean | null,
    witnessNames: '',
    dateInjuryKnownWorkRelated: '',
    allBodyPartsInjured: '',
    notifiedIndividuals: '',
    injuryDescriptionDetailed: '',
    contributingActsConditions: '',
    reportedToMedicalDept: null as boolean | null,
    medicalProvidersInvolved: '',
    injuryTypeDescription: '',
    previousSimilarConditionReported: null as boolean | null,
    previousSimilarConditionDetails: '',
    // Employee Information fields (from paper form)
    employeeLastSSN4: '',
    employeeHomeAddress: '',
    employeeEmail: '',
    employeePhone: '',
    employeeLanguage: '',
    needsInterpreter: null as boolean | null,
    employeeGender: '',
    interpreterAssisting: null as boolean | null,
    // Job/Compliance fields (from paper form)
    ownedJobTitle: '',
    jobAssignmentAtInjury: '',
    departmentWhereInjury: '',
    oshaCaseNumber: '',
    isLostTime: null as boolean | null,
    wasViolationOfSafetyRules: null as boolean | null,
    wasProperProcedureFollowed: null as boolean | null,
    wasEmployeeInstructedInSOP: null as boolean | null,
    // Incident Investigation fields (Leader/Supervisor Assessment)
    isOshaRecordable: null as boolean | null,
    caseClassification: '',
    employeeName: '',
    employeeIdNumber: '',
    positionAtTimeOfIncident: '',
    specificInjuryLocation: '',
    incidentDate: '',
    incidentTime: '',
    dateIncidentReported: '',
    wasClockedIn: null as boolean | null,
    injuryDevelopmentPattern: '',
    injuryWorkRelation: '',
    incidentDescriptionDetailed: '',
    investigationBodyParts: [] as string[],
    investigationInjuryType: '',
    injuryMechanism: '',
    wasPerformingOtherDuties: null as boolean | null,
    otherDutiesExplanation: '',
    wasInjuryWitnessed: null as boolean | null,
    witnessNamesList: '',
    wereCoworkersPresent: null as boolean | null,
    wasIncidentSiteViewed: null as boolean | null,
    siteViewDate: '',
    siteViewTime: '',
    didSiteRevealCause: null as boolean | null,
    siteRevealExplanation: '',
    wasInjuryConsistentWithSite: null as boolean | null,
    inconsistencyExplanation: '',
    interviewedNames: '',
    wereInterviewsDocumented: null as boolean | null,
    hadPhysicalRestrictions: null as boolean | null,
    knownRestrictions: '',
    didLeaveWork: null as boolean | null,
    dateTimeLeftWork: '',
    didReturnToWork: null as boolean | null,
    dateTimeReturnedToWork: '',
    isAreaUnderSurveillance: null as boolean | null,
    wasSurveillanceAvailable: null as boolean | null,
    werePhotosVideosTaken: null as boolean | null,
    leaderActsConditionsOpinion: '',
    preventionRecommendations: '',
    supervisorActions: '',
    // Contributing factors and corrective action checkbox fields
    contributingFactorTypes: [] as string[],
    correctiveActionTypes: [] as string[],
    incidentPattern: '',
  });

  // Data state
  const [categories, setCategories] = useState<Category[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);

  // Dropdown options state (loaded from database)
  const [dropdownOptions, setDropdownOptions] = useState<Record<string, { id: string; value: string; label: string }[]>>({});

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState(1);
  const [formPage, setFormPage] = useState<1 | 2 | 3>(1);
  const [incidentId, setIncidentId] = useState<string | null>(null);
  const formSurfaceRef = useRef<HTMLDivElement | null>(null);
  const modalBodyRef = useRef<HTMLDivElement | null>(null);
  const modalDragStateRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startLeft: number;
    startTop: number;
  } | null>(null);
  const [isIncidentModalMaximized, setIsIncidentModalMaximized] = useState(false);
  const [isIncidentModalDragging, setIsIncidentModalDragging] = useState(false);
  const [modalPosition, setModalPosition] = useState({ left: 12, top: 12 });

  // Team collaboration state (used when visibility === 'TEAM')
  const [teamParticipants] = useState<TeamParticipant[]>([]);

  // AI Summary state
  const [generatingAI, setGeneratingAI] = useState(false);
  const [aiSuggestedSeverity, setAiSuggestedSeverity] = useState<string | null>(null);

  // Enhanced AI Analysis state (with attachment analysis)
  const [aiAnalysisResults, setAiAnalysisResults] = useState<{
    evidenceSummary: string | null;
    keyFindings: string[];
    investigationGuidance: string[];
    recommendedRCAMethodology: {
      primary: 'FIVE_WHYS' | 'FISHBONE';
      reason: string;
      confidence: number;
      alternativeMethod?: 'FIVE_WHYS' | 'FISHBONE';
      alternativeReason?: string;
    } | null;
    attachmentAnalysis: {
      totalAttachments: number;
      analysisConfidence: number;
      riskAssessment: { level: string; factors: string[] };
      individualAnalyses: Array<{
        filename: string;
        type: string;
        status: string;
        summary: string;
        relevance: string;
      }>;
    } | null;
  } | null>(null);
  const [analyzingAttachments, setAnalyzingAttachments] = useState(false);

  // AI Analysis Modal state
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiModalStage, setAiModalStage] = useState<'preparing' | 'uploading' | 'analyzing' | 'generating' | 'finalizing' | 'complete'>('preparing');
  const [currentAnalyzingAttachment, setCurrentAnalyzingAttachment] = useState(0);

  // AI Text Enhancement state
  const [enhancingField, setEnhancingField] = useState<string | null>(null);

  // Staged evidence files (uploaded on Submit)
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([]);
  const [uploadProgress, setUploadProgress] = useState<{ uploaded: number; total: number } | null>(null);

  // Workplace Safety tab state (for separate sections)
  const [workplaceSafetyTab, setWorkplaceSafetyTab] = useState<'incident-report' | 'investigation'>('incident-report');

  // Incident Report tab - internal pagination (6 steps)
  const [incidentReportStep, setIncidentReportStep] = useState(1);
  const INCIDENT_REPORT_STEPS = [
    { id: 1, name: 'Incident Context', icon: '📋' },
    { id: 2, name: 'Exposure & Risk', icon: '⚠️' },
    { id: 3, name: 'Contributing Factors', icon: '🔍' },
    { id: 4, name: 'Regulatory Info', icon: '📑' },
    { id: 5, name: 'Employment Details', icon: '👔' },
  ];

  // Investigation tab - internal pagination (5 steps)
  const [investigationStep, setInvestigationStep] = useState(1);
  const INVESTIGATION_STEPS = [
    { id: 1, name: 'Classification', icon: '📊' },
    { id: 2, name: 'Employee Info', icon: '👤' },
    { id: 3, name: 'Investigation Details', icon: '🔎' },
    { id: 4, name: 'Recommendations', icon: '✅' },
  ];

  const [investigationSubmitted, setInvestigationSubmitted] = useState(false);
  const [investigationSubmitting, setInvestigationSubmitting] = useState(false);

  // Incident Report submission state (for Workplace Safety)
  const [incidentReportSubmitted, setIncidentReportSubmitted] = useState(false);
  const [submissionModalOpen, setSubmissionModalOpen] = useState(false);
  const [submittedIncidentData, setSubmittedIncidentData] = useState<{
    id: string;
    incidentNumber: string;
    title: string;
    type: string;
    category?: string;
    severity: string;
    status: string;
    date: string;
    time: string;
    facility?: string;
    area?: string;
    line?: string;
    shift?: string;
    description: string;
    aiSummary?: string;
    attachmentCount: number;
    visibility?: string;
    recommendedRCAMethodology?: {
      primary: string;
      reason: string;
      confidence: number;
      alternativeMethod?: string;
      alternativeReason?: string;
    } | null;
  } | null>(null);
  const [incidentReportSubmitting, setIncidentReportSubmitting] = useState(false);

  // Save Progress state
  const [saveProgressLoading, setSaveProgressLoading] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [draftSaveLoading, setDraftSaveLoading] = useState(false);
  const [draftSaveStatus, setDraftSaveStatus] = useState<'saved' | 'not_saved' | null>(null);
  const [isAutoSaveEnabled, setIsAutoSaveEnabled] = useState(() => {
    // Initialize from localStorage, default to true
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('incidents-autosave-enabled');
      return saved !== null ? saved === 'true' : true;
    }
    return true;
  });
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isSubmittedEditMode = Boolean(isEditMode && editingIncidentStatus && editingIncidentStatus !== 'DRAFT');
  const formatStatusLabel = (status?: string | null) => status ? status.replace(/_/g, ' ') : 'DRAFT';

  const handleCloseIncidentForm = useCallback(() => {
    if (onClose) {
      onClose();
      return;
    }

    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
      return;
    }

    router.push('/dashboard');
  }, [onClose, router]);

  // AI Form Validation state
  interface FormValidationIssue {
    fieldName: string;
    fieldLabel: string;
    issueType: 'missing' | 'inappropriate_na' | 'incomplete' | 'inconsistent' | 'contextual_mismatch' | 'illogical_combination';
    message: string;
    recommendation: string;
    suggestedValue?: string;
    severity: 'critical' | 'warning' | 'info';
  }
  interface ContextualInsights {
    incidentTypeAlignment: string;
    dataConsistencyScore: number;
    suggestedImprovements: string[];
  }
  interface FormValidationResult {
    isComplete: boolean;
    overallScore: number;
    issues: FormValidationIssue[];
    recommendations: string[];
    summary: string;
    contextualInsights?: ContextualInsights;
  }
  const [incidentReportValidation, setIncidentReportValidation] = useState<FormValidationResult | null>(null);
  const [investigationValidation, setInvestigationValidation] = useState<FormValidationResult | null>(null);
  const [validatingIncidentReport, setValidatingIncidentReport] = useState(false);
  const [validatingInvestigation, setValidatingInvestigation] = useState(false);

  // Helper function to format time to 12-hour format
  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  // Helper function to format phone numbers for USA, Canada, and Mexico
  const formatPhoneNumber = (value: string): string => {
    // Remove all non-digit characters except +
    const cleaned = value.replace(/[^\d+]/g, '');

    // Check if it starts with country code
    if (cleaned.startsWith('+52') || cleaned.startsWith('52')) {
      // Mexico format: +52 (XX) XXXX-XXXX or +52 XXX XXX XXXX
      const digits = cleaned.replace(/^\+?52/, '');
      if (digits.length === 0) return '+52 ';
      if (digits.length <= 2) return `+52 (${digits}`;
      if (digits.length <= 6) return `+52 (${digits.slice(0, 2)}) ${digits.slice(2)}`;
      if (digits.length <= 10) return `+52 (${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
      return `+52 (${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6, 10)}`;
    } else if (cleaned.startsWith('+1') || cleaned.startsWith('1')) {
      // USA/Canada with country code: +1 (XXX) XXX-XXXX
      const digits = cleaned.replace(/^\+?1/, '');
      if (digits.length === 0) return '+1 ';
      if (digits.length <= 3) return `+1 (${digits}`;
      if (digits.length <= 6) return `+1 (${digits.slice(0, 3)}) ${digits.slice(3)}`;
      if (digits.length <= 10) return `+1 (${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
      return `+1 (${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
    } else if (cleaned.startsWith('+')) {
      // Other international - just return cleaned
      return cleaned;
    } else {
      // Default USA/Canada format without country code: (XXX) XXX-XXXX
      const digits = cleaned.replace(/\D/g, '');
      if (digits.length === 0) return '';
      if (digits.length <= 3) return `(${digits}`;
      if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
      if (digits.length <= 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
      // If more than 10 digits, treat as having country code
      if (digits.length === 11 && digits.startsWith('1')) {
        return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7, 11)}`;
      }
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
    }
  };

  // Handle phone input change with formatting
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setFormData({ ...formData, employeePhone: formatted });
  };

  // Load initial data
  useEffect(() => {
    loadFacilities();
    loadDropdownOptions();
  }, []);

  // Load existing incident if in edit mode
  useEffect(() => {
    if (editIncidentId) {
      loadExistingIncident(editIncidentId);
    }
  }, [editIncidentId]);

  // Persist auto-save preference to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('incidents-autosave-enabled', String(isAutoSaveEnabled));
    }
  }, [isAutoSaveEnabled]);

  // Load categories when type changes or user loads
  useEffect(() => {
    if (formData.type && user?.organizationId) {
      loadCategories(formData.type);
    }
  }, [formData.type, user?.organizationId]);

  // Load departments when facility changes
  useEffect(() => {
    if (formData.facilityId) {
      // Reset downstream selections and data
      setAreas([]);
      setLines([]);
      setShifts([]);
      loadDepartments(formData.facilityId);
    } else {
      setDepartments([]);
      setAreas([]);
      setLines([]);
      setShifts([]);
    }
  }, [formData.facilityId]);

  // Load areas when department changes
  useEffect(() => {
    if (formData.departmentId) {
      // Reset downstream selections and data
      setLines([]);
      setShifts([]);
      loadAreas(formData.departmentId);
    } else {
      setAreas([]);
      setLines([]);
      setShifts([]);
    }
  }, [formData.departmentId]);

  // Load lines when area changes
  useEffect(() => {
    if (formData.areaId) {
      loadLines(formData.areaId);
    }
  }, [formData.areaId]);

  // Load shifts when line changes
  useEffect(() => {
    if (formData.lineId) {
      loadShifts(formData.lineId);
    } else {
      setShifts([]);
      setFormData(prev => ({ ...prev, shiftId: '' }));
    }
  }, [formData.lineId]);

  // Auto-populate Investigation tab fields from Incident Report tab fields (Workplace Safety only)
  // This ensures matching fields are synced from Incident Report to Investigation
  useEffect(() => {
    if (formData.type !== 'WORKPLACE_SAFETY') return;

    // Helper to check if a field is set to N/A
    const checkFieldNA = (value: string | null | undefined): boolean => value === 'N/A';

    // Only auto-populate if we're NOT in edit mode loading existing data
    // and only when the source field has been updated
    setFormData(prev => {
      const updates: Partial<typeof prev> = {};

      // Map Incident Report fields → Investigation fields
      // Only update Investigation field if it's empty and the source field has a value

      // Date/Time fields
      if (prev.dateOfInjury && !prev.incidentDate) {
        updates.incidentDate = prev.dateOfInjury;
      }
      if (prev.timeOfInjury && !prev.incidentTime) {
        updates.incidentTime = prev.timeOfInjury;
      }

      // Location field
      if (prev.injuryLocation && !prev.specificInjuryLocation && !checkFieldNA(prev.specificInjuryLocation)) {
        updates.specificInjuryLocation = prev.injuryLocation;
      }

      // Injury development pattern
      if (prev.injuryDevelopmentType && !prev.injuryDevelopmentPattern) {
        updates.injuryDevelopmentPattern = prev.injuryDevelopmentType;
      }

      // Injury caused by work → work relation
      if (prev.injuryCausedByWork && !prev.injuryWorkRelation) {
        // Map the values appropriately based on database values
        const workRelationMap: Record<string, string> = {
          'YES': 'CAUSED_BY_WORK',
          'NO': 'NOT_WORK_RELATED',
          'UNCERTAIN': 'UNDER_INVESTIGATION',
          'NA': 'N/A'
        };
        if (workRelationMap[prev.injuryCausedByWork]) {
          updates.injuryWorkRelation = workRelationMap[prev.injuryCausedByWork];
        }
      }

      // Injury witnessed
      if (prev.injuryWitnessed !== null && prev.wasInjuryWitnessed === null) {
        updates.wasInjuryWitnessed = prev.injuryWitnessed;
      }

      // Witness names
      if (prev.witnessNames && !prev.witnessNamesList && !checkFieldNA(prev.witnessNames)) {
        updates.witnessNamesList = prev.witnessNames;
      }

      // Body parts affected
      if (prev.bodyPartsAffected.length > 0 && prev.investigationBodyParts.length === 0 && !prev.bodyPartsAffectedNA) {
        updates.investigationBodyParts = [...prev.bodyPartsAffected];
      }

      // Injury type
      if (prev.injuryType && !prev.investigationInjuryType) {
        updates.investigationInjuryType = prev.injuryType;
      }

      // Injury description (Incident Report) → Incident description (Investigation)
      if (prev.injuryDescriptionDetailed && !prev.incidentDescriptionDetailed && !checkFieldNA(prev.injuryDescriptionDetailed)) {
        updates.incidentDescriptionDetailed = prev.injuryDescriptionDetailed;
      }

      // Only return updated state if there are changes
      if (Object.keys(updates).length > 0) {
        return { ...prev, ...updates };
      }
      return prev;
    });
  }, [
    formData.type,
    formData.dateOfInjury,
    formData.timeOfInjury,
    formData.injuryLocation,
    formData.injuryDevelopmentType,
    formData.injuryCausedByWork,
    formData.injuryWitnessed,
    formData.witnessNames,
    formData.bodyPartsAffected,
    formData.injuryType,
    formData.injuryDescriptionDetailed
  ]);

  const loadFacilities = async () => {
    try {
      const response = await api.get('/facilities');
      // Backend returns data.Facility (PascalCase) - handle both formats
      const facilitiesData = response.data.data?.Facility || response.data.data?.facilities || [];
      setFacilities(Array.isArray(facilitiesData) ? facilitiesData : []);
    } catch (err) {
      console.error('Failed to load facilities:', err);
    }
  };

  const loadDropdownOptions = async () => {
    try {
      const response = await api.get('/dropdown-options');
      // Transform the grouped options to a simpler format
      const options: Record<string, { id: string; value: string; label: string }[]> = {};
      const data = response.data.data;
      for (const [type, items] of Object.entries(data)) {
        options[type] = (items as any[]).map(item => ({
          id: item.id,
          value: item.value,
          label: item.label,
        }));
      }
      setDropdownOptions(options);
    } catch (err) {
      console.error('Failed to load dropdown options:', err);
      // Set empty options if API fails - no fallback data
      setDropdownOptions({});
    }
  };

  const loadCategories = async (type: string) => {
    try {
      console.log('Loading categories for type:', type, 'orgId:', user?.organizationId);
      const response = await api.get(`/categories?type=${type}&organizationId=${user?.organizationId}`);
      console.log('Categories response:', response.data);
      setCategories(response.data.data || []);
    } catch (err) {
      console.error('Failed to load categories:', err);
      setCategories([]);
    }
  };

  const loadDepartments = async (facilityId: string) => {
    try {
      const response = await api.get(`/facilities/departments?facilityId=${facilityId}`);
      const departmentsData = response.data.data?.departments || [];
      setDepartments(Array.isArray(departmentsData) ? departmentsData : []);
    } catch (err) {
      console.error('Failed to load departments:', err);
      setDepartments([]);
    }
  };

  const loadAreas = async (departmentId: string) => {
    try {
      const response = await api.get(`/facilities/areas?departmentId=${departmentId}`);
      const areasData = response.data.data?.areas || [];
      setAreas(Array.isArray(areasData) ? areasData : []);
    } catch (err) {
      console.error('Failed to load areas:', err);
      setAreas([]);
    }
  };

  const loadLines = async (areaId: string) => {
    try {
      const response = await api.get(`/facilities/lines?areaId=${areaId}`);
      const linesData = response.data.data?.lines || [];
      setLines(Array.isArray(linesData) ? linesData : []);
    } catch (err) {
      console.error('Failed to load lines:', err);
      setLines([]);
    }
  };

  const loadShifts = async (lineId: string) => {
    try {
      const response = await api.get(`/facilities/shifts?lineId=${lineId}`);
      const shiftsData = response.data.data?.shifts || [];
      setShifts(Array.isArray(shiftsData) ? shiftsData : []);
    } catch (err) {
      console.error('Failed to load shifts:', err);
      setShifts([]);
    }
  };

  // Load existing incident for edit mode
  const loadExistingIncident = async (id: string) => {
    try {
      setLoading(true);
      const response = await api.get(`/incidents/${id}`);
      const incident = response.data.data;

      const isWorkplaceSafety = incident.type === 'WORKPLACE_SAFETY';

      setIsEditMode(true);
      setEditingIncidentNumber(incident.incidentNumber);
      setEditingIncidentStatus(incident.status || 'DRAFT');
      setIncidentId(incident.id);

      // For Workplace Safety with submitted Incident Report, mark it as submitted
      if (isWorkplaceSafety && incident.status !== 'DRAFT') {
        setIncidentReportSubmitted(true);
        // If section=investigation, switch to investigation tab
        if (sectionParam === 'investigation') {
          setWorkplaceSafetyTab('investigation');
        }
      }

      // Mark investigation as submitted if already done
      if (incident.investigationSubmittedAt) {
        setInvestigationSubmitted(true);
      }

      // Find parent category
      const parentCategoryId = incident.category?.parentId || '';

      // Helper to parse date for datetime-local input (uses local timezone)
      const formatDateTimeLocal = (dateStr: string | null | undefined): string => {
        if (!dateStr) return '';
        try {
          const date = new Date(dateStr);
          // Use local time components instead of UTC
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          const hours = String(date.getHours()).padStart(2, '0');
          const minutes = String(date.getMinutes()).padStart(2, '0');
          return `${year}-${month}-${day}T${hours}:${minutes}`;
        } catch {
          return '';
        }
      };

      // Helper to parse date for date input (uses local timezone)
      const formatDateLocal = (dateStr: string | null | undefined): string => {
        if (!dateStr) return '';
        try {
          const date = new Date(dateStr);
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        } catch {
          return '';
        }
      };

      // Set form data from incident - COMPLETE field mapping
      setFormData(prev => ({
        ...prev,
        // Basic fields
        type: incident.type || '',
        mainCategoryId: parentCategoryId,
        categoryId: incident.categoryId || '',
        customTitle: incident.customTitle || '',
        description: incident.description || '',
        aiSummary: incident.aiSummary || '',
        facilityId: incident.facilityId || '',
        areaId: incident.areaId || '',
        lineId: incident.lineId || '',
        shiftId: incident.shiftId || '',
        productName: incident.productName || '',
        lotNumber: incident.lotNumber || '',
        machineId: incident.machineId || '',
        occurredAt: formatDateTimeLocal(incident.occurredAt),
        severity: incident.severity || '',

        // Workplace Safety - Core fields
        injuryType: incident.injuryType || '',
        bodyPartsAffected: incident.bodyPartsAffected || [],
        bodyPartsAffectedNA: incident.bodyPartsAffectedNA || false,
        otherBodyPartDetail: incident.otherBodyPartDetail || '',
        taskBeingPerformed: incident.taskBeingPerformed || '',
        isRoutineTask: incident.isRoutineTask,
        exposureDuration: incident.exposureDuration || '',
        taskFrequency: incident.taskFrequency || '',
        weightOrForce: incident.weightOrForce || '',
        environmentalConditions: incident.environmentalConditions || [],
        environmentalConditionsNA: incident.environmentalConditionsNA || false,
        ppeRequired: incident.ppeRequired,
        ppeWorn: incident.ppeWorn,
        machineSafeguardsInPlace: incident.machineSafeguardsInPlace || '',
        lotoRequired: incident.lotoRequired || '',
        sopAvailable: incident.sopAvailable,
        sopFollowed: incident.sopFollowed,
        firstAidProvided: incident.firstAidProvided,
        medicalTreatmentRequired: incident.medicalTreatmentRequired,
        supervisorNotified: incident.supervisorNotified,
        areaSecured: incident.areaSecured || '',
        directCause: incident.directCause || '',
        contributingFactors: incident.contributingFactors || { people: [], process: [], equipment: [], environment: [] },
        unsafeActOrCondition: incident.unsafeActOrCondition || '',
        previousSimilarIncidents: incident.previousSimilarIncidents,

        // Regulatory & Workers' Compensation fields
        priorSurgeryPerformed: incident.priorSurgeryPerformed,
        priorSurgeryDescription: incident.priorSurgeryDescription || '',
        treatingDoctors: incident.treatingDoctors || '',
        employedElsewhere: incident.employedElsewhere,
        additionalEmployers: incident.additionalEmployers || '',
        additionalEmployerHours: incident.additionalEmployerHours || '',
        additionalEmployerStartDate: formatDateLocal(incident.additionalEmployerStartDate),
        workedForOtherLast6Months: incident.workedForOtherLast6Months,
        otherEmployerNames: incident.otherEmployerNames || '',
        injuryDevelopedOverTime: incident.injuryDevelopedOverTime,
        injuryDevelopmentType: incident.injuryDevelopmentType || '',
        taskRoutineType: incident.taskRoutineType || '',
        dateOfInjury: formatDateLocal(incident.dateOfInjury),
        timeOfInjury: incident.timeOfInjury || '',
        injuryLocation: incident.injuryLocation || '',
        injuryCausedByWork: incident.injuryCausedByWork || '',
        injuryWitnessed: incident.injuryWitnessed,
        witnessNames: incident.witnessNames || '',
        dateInjuryKnownWorkRelated: formatDateLocal(incident.dateInjuryKnownWorkRelated),
        allBodyPartsInjured: incident.allBodyPartsInjured || '',
        notifiedIndividuals: incident.notifiedIndividuals || '',
        injuryDescriptionDetailed: incident.injuryDescriptionDetailed || '',
        contributingActsConditions: incident.contributingActsConditions || '',
        reportedToMedicalDept: incident.reportedToMedicalDept,
        medicalProvidersInvolved: incident.medicalProvidersInvolved || '',
        injuryTypeDescription: incident.injuryTypeDescription || '',
        previousSimilarConditionReported: incident.previousSimilarConditionReported,
        previousSimilarConditionDetails: incident.previousSimilarConditionDetails || '',

        // Employee Information fields
        employeeLastSSN4: incident.employeeLastSSN4 || '',
        employeeHomeAddress: incident.employeeHomeAddress || '',
        employeeEmail: incident.employeeEmail || '',
        employeePhone: incident.employeePhone || '',
        employeeLanguage: incident.employeeLanguage || '',
        needsInterpreter: incident.needsInterpreter,
        employeeGender: incident.employeeGender || '',
        interpreterAssisting: incident.interpreterAssisting,

        // Job/Compliance fields
        ownedJobTitle: incident.ownedJobTitle || '',
        jobAssignmentAtInjury: incident.jobAssignmentAtInjury || '',
        departmentWhereInjury: incident.departmentWhereInjury || '',
        oshaCaseNumber: incident.oshaCaseNumber || '',
        isLostTime: incident.isLostTime,
        wasViolationOfSafetyRules: incident.wasViolationOfSafetyRules,
        wasProperProcedureFollowed: incident.wasProperProcedureFollowed,
        wasEmployeeInstructedInSOP: incident.wasEmployeeInstructedInSOP,

        // Investigation fields (Leader/Supervisor Assessment)
        isOshaRecordable: incident.isOshaRecordable,
        caseClassification: incident.caseClassification || '',
        employeeName: incident.employeeName || '',
        employeeIdNumber: incident.employeeIdNumber || '',
        positionAtTimeOfIncident: incident.positionAtTimeOfIncident || '',
        specificInjuryLocation: incident.specificInjuryLocation || '',
        incidentDate: formatDateLocal(incident.incidentDate),
        incidentTime: incident.incidentTime || '',
        dateIncidentReported: formatDateLocal(incident.dateIncidentReported),
        wasClockedIn: incident.wasClockedIn,
        injuryDevelopmentPattern: incident.injuryDevelopmentPattern || '',
        injuryWorkRelation: incident.injuryWorkRelation || '',
        incidentDescriptionDetailed: incident.incidentDescriptionDetailed || '',
        investigationBodyParts: incident.investigationBodyParts || [],
        investigationInjuryType: incident.investigationInjuryType || '',
        injuryMechanism: incident.injuryMechanism || '',
        wasPerformingOtherDuties: incident.wasPerformingOtherDuties,
        otherDutiesExplanation: incident.otherDutiesExplanation || '',
        wasInjuryWitnessed: incident.wasInjuryWitnessed,
        witnessNamesList: incident.witnessNamesList || '',
        wereCoworkersPresent: incident.wereCoworkersPresent,
        wasIncidentSiteViewed: incident.wasIncidentSiteViewed,
        siteViewDate: formatDateLocal(incident.siteViewDate),
        siteViewTime: incident.siteViewTime || '',
        didSiteRevealCause: incident.didSiteRevealCause,
        siteRevealExplanation: incident.siteRevealExplanation || '',
        wasInjuryConsistentWithSite: incident.wasInjuryConsistentWithSite,
        inconsistencyExplanation: incident.inconsistencyExplanation || '',
        interviewedNames: incident.interviewedNames || '',
        wereInterviewsDocumented: incident.wereInterviewsDocumented,
        hadPhysicalRestrictions: incident.hadPhysicalRestrictions,
        knownRestrictions: incident.knownRestrictions || '',
        didLeaveWork: incident.didLeaveWork,
        dateTimeLeftWork: formatDateTimeLocal(incident.dateTimeLeftWork),
        didReturnToWork: incident.didReturnToWork,
        dateTimeReturnedToWork: formatDateTimeLocal(incident.dateTimeReturnedToWork),
        isAreaUnderSurveillance: incident.isAreaUnderSurveillance,
        wasSurveillanceAvailable: incident.wasSurveillanceAvailable,
        werePhotosVideosTaken: incident.werePhotosVideosTaken,
        leaderActsConditionsOpinion: incident.leaderActsConditionsOpinion || '',
        preventionRecommendations: incident.preventionRecommendations || '',
        supervisorActions: incident.supervisorActions || '',

        // Contributing factors and corrective action checkbox fields
        contributingFactorTypes: incident.contributingFactorTypes || [],
        correctiveActionTypes: incident.correctiveActionTypes || [],
        incidentPattern: incident.incidentPattern || '',
      }));

      // Load related data
      if (incident.type) {
        await loadCategories(incident.type);
      }

      // Load facility-related data if facilityId is present
      if (incident.facilityId) {
        await loadAreas(incident.facilityId);
      }
      if (incident.areaId) {
        await loadLines(incident.areaId);
      }
      if (incident.lineId) {
        await loadShifts(incident.lineId);
      }

    } catch (err: any) {
      console.error('Failed to load incident:', err);
      setError(err.response?.data?.error || 'Failed to load incident for editing');
    } finally {
      setLoading(false);
    }
  };

  // Generate AI Summary (with optional attachment analysis)
  const generateAISummary = async () => {
    if (!formData.description || formData.description.trim().length < 10) {
      setError('Please enter a description of at least 10 characters before generating the summary.');
      return;
    }

    setGeneratingAI(true);
    setError('');
    setAiSuggestedSeverity(null);
    setAiAnalysisResults(null);

    // Open modal and start with preparing stage
    setAiModalOpen(true);
    setAiModalStage('preparing');
    setCurrentAnalyzingAttachment(0);

    try {
      // Check if we have uploaded/staged files that can be analyzed
      // For staged files, we need their preview URLs (for images) or temporary URLs
      const hasAnalyzableAttachments = stagedFiles.length > 0 && stagedFiles.some(f =>
        f.type === 'PHOTO' || f.type === 'DOCUMENT' || f.type === 'VOICE_RECORDING'
      );

      // Build attachments array for AI analysis (if files are available)
      let attachments: Array<{
        filename: string;
        type: string;
        mimeType: string;
        fileUrl: string;
        transcription?: string;
      }> = [];

      if (hasAnalyzableAttachments) {
        setAnalyzingAttachments(true);

        // Progress to uploading stage
        await new Promise(resolve => setTimeout(resolve, 500));
        setAiModalStage('uploading');

        // Helper function to convert File to base64 data URL
        const fileToBase64 = (file: File): Promise<string> => {
          return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
        };

        // Convert staged files to analyzable format with base64 data URLs
        // blob: URLs don't work for backend - must use data: URLs
        const attachmentPromises = stagedFiles
          .filter(f => f.type === 'PHOTO' || f.type === 'DOCUMENT' || f.transcription)
          .map(async (f) => {
            let fileUrl = '';

            // Convert images to base64 data URLs (required for GPT-4 Vision)
            if (f.type === 'PHOTO' && f.file) {
              try {
                fileUrl = await fileToBase64(f.file);
              } catch (err) {
                console.error('Failed to convert image to base64:', err);
              }
            }

            // For PDFs/documents, convert to base64 for backend processing
            if (f.type === 'DOCUMENT' && f.file) {
              try {
                fileUrl = await fileToBase64(f.file);
              } catch (err) {
                console.error('Failed to convert document to base64:', err);
              }
            }

            return {
              filename: f.customName || f.file.name,
              type: f.type,
              mimeType: f.file.type,
              fileUrl,
              transcription: f.transcription,
            };
          });

        attachments = (await Promise.all(attachmentPromises))
          .filter(a => a.fileUrl || a.transcription); // Only include files with content
      }

      // Build the request payload - include workplace safety fields when applicable
      const requestPayload: any = {
        type: formData.type,
        categoryId: formData.categoryId,
        customTitle: formData.customTitle,
        description: formData.description,
        facilityId: formData.facilityId,
        departmentId: formData.departmentId,
        areaId: formData.areaId,
        lineId: formData.lineId,
        shiftId: formData.shiftId,
        productName: formData.productName,
        lotNumber: formData.lotNumber,
        machineId: formData.machineId,
        occurredAt: formData.occurredAt,
        severity: formData.severity,
      };

      // Add workplace safety specific fields for richer AI context
      if (formData.type === 'WORKPLACE_SAFETY') {
        requestPayload.injuryType = formData.injuryType || undefined;
        requestPayload.bodyPartsAffected = formData.bodyPartsAffected?.length > 0 ? formData.bodyPartsAffected : undefined;
        requestPayload.otherBodyPartDetail = formData.bodyPartsAffected?.includes('OTHER') && formData.otherBodyPartDetail ? formData.otherBodyPartDetail : undefined;
        requestPayload.taskBeingPerformed = formData.taskBeingPerformed || undefined;
        requestPayload.isRoutineTask = formData.isRoutineTask;
        requestPayload.exposureDuration = formData.exposureDuration || undefined;
        requestPayload.taskFrequency = formData.taskFrequency || undefined;
        requestPayload.weightOrForce = formData.weightOrForce || undefined;
        requestPayload.environmentalConditions = formData.environmentalConditions?.length > 0 ? formData.environmentalConditions : undefined;
        requestPayload.ppeRequired = formData.ppeRequired;
        requestPayload.ppeWorn = formData.ppeWorn;
        requestPayload.machineSafeguardsInPlace = formData.machineSafeguardsInPlace || undefined;
        requestPayload.lotoRequired = formData.lotoRequired || undefined;
        requestPayload.sopAvailable = formData.sopAvailable;
        requestPayload.sopFollowed = formData.sopFollowed;
        requestPayload.firstAidProvided = formData.firstAidProvided;
        requestPayload.medicalTreatmentRequired = formData.medicalTreatmentRequired;
        requestPayload.supervisorNotified = formData.supervisorNotified;
        requestPayload.areaSecured = formData.areaSecured;
        requestPayload.directCause = formData.directCause || undefined;
        requestPayload.contributingFactors = formData.contributingFactors;
        requestPayload.unsafeActOrCondition = formData.unsafeActOrCondition || undefined;
        requestPayload.previousSimilarIncidents = formData.previousSimilarIncidents;
      }

      let response;

      // Use enhanced endpoint with attachment analysis if we have analyzable attachments
      if (attachments.length > 0) {
        requestPayload.attachments = attachments;
        console.log('📤 Sending request with attachments:', attachments.length);

        // Progress to analyzing stage
        setAiModalStage('analyzing');

        // Simulate attachment progress (the actual analysis happens server-side)
        const analyzeInterval = setInterval(() => {
          setCurrentAnalyzingAttachment(prev => {
            if (prev < attachments.length) return prev + 1;
            return prev;
          });
        }, 2000);

        // Use longer timeout for attachment analysis (2 minutes per image + 1 minute buffer)
        const timeoutMs = Math.max(180000, attachments.length * 60000 + 60000);

        try {
          // Progress to generating stage before API call
          setAiModalStage('generating');
          response = await api.post('/incidents/generate-summary-with-attachments', requestPayload, { timeout: timeoutMs });
          clearInterval(analyzeInterval);
        } catch (err) {
          clearInterval(analyzeInterval);
          throw err;
        }

        console.log('📥 Received response:', response.data);
      } else {
        // Progress to generating stage for non-attachment analysis
        setAiModalStage('generating');

        // Fall back to regular summary generation
        const evidenceInfo = stagedFiles.map(f => ({
          filename: f.customName || f.file.name,
          type: f.file.type.startsWith('image/') ? 'photo' : f.file.type.startsWith('video/') ? 'video' : 'document',
        }));
        requestPayload.evidenceFiles = evidenceInfo.length > 0 ? evidenceInfo : undefined;
        response = await api.post('/incidents/generate-summary', requestPayload);
      }

      // Progress to finalizing stage
      setAiModalStage('finalizing');

      const {
        aiSummary,
        suggestedSeverity,
        aiError,
        evidenceSummary,
        keyFindings,
        investigationGuidance,
        recommendedRCAMethodology,
        attachmentAnalysis
      } = response.data.data;

      console.log('📊 Extracted data:', { aiSummary: aiSummary?.substring(0, 100), suggestedSeverity, aiError, evidenceSummary, keyFindingsCount: keyFindings?.length, recommendedRCAMethodology, attachmentAnalysis });

      if (aiError) {
        // AI service is unavailable - show the error message from backend
        setFormData(prev => ({ ...prev, aiSummary }));
        setError('AI Summary service is currently unavailable. Please contact your system administrator.');
      } else {
        console.log('✅ Setting aiSummary and analysis results...');
        setFormData(prev => ({ ...prev, aiSummary }));
        if (suggestedSeverity) {
          setAiSuggestedSeverity(suggestedSeverity);
        }

        // Store enhanced analysis results if available
        if (evidenceSummary || attachmentAnalysis || recommendedRCAMethodology) {
          console.log('📈 Setting aiAnalysisResults:', { evidenceSummary, keyFindings, investigationGuidance, recommendedRCAMethodology, attachmentAnalysis });
          setAiAnalysisResults({
            evidenceSummary: evidenceSummary || null,
            keyFindings: keyFindings || [],
            investigationGuidance: investigationGuidance || [],
            recommendedRCAMethodology: recommendedRCAMethodology || null,
            attachmentAnalysis: attachmentAnalysis || null,
          });
        }

        // Show complete stage briefly
        setAiModalStage('complete');
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    } catch (err: any) {
      console.error('❌ Error in generateAISummary:', err);
      setError(err.response?.data?.error || 'Failed to generate the summary. Please check with your system administrator.');
      setFormData(prev => ({ ...prev, aiSummary: '' }));
    } finally {
      setGeneratingAI(false);
      setAnalyzingAttachments(false);
      setAiModalOpen(false);
      setAiModalStage('preparing');
      setCurrentAnalyzingAttachment(0);
    }
  };

  // AI Text Enhancement function
  const enhanceText = async (fieldName: string, fieldContext?: string) => {
    const text = (formData as any)[fieldName];

    if (!text || text.trim().length < 5) {
      setError('Please enter at least 5 characters before using AI enhancement');
      return;
    }

    if (!formData.type) {
      setError('Please select an incident type first');
      return;
    }

    setEnhancingField(fieldName);
    setError('');

    try {
      const response = await api.post('/incidents/enhance-text', {
        text,
        incidentType: formData.type,
        fieldContext: fieldContext || fieldName,
      });

      const { enhancedText, wasEnhanced } = response.data.data;

      if (wasEnhanced && enhancedText) {
        setFormData(prev => ({ ...prev, [fieldName]: enhancedText }));
      }
    } catch (err: any) {
      console.error('AI Enhancement error:', err);
      const errorMessage = err.response?.data?.error || err.message || 'Unknown error';

      if (err.response?.status === 401) {
        setError('Please log in again to use AI enhancement.');
      } else if (errorMessage.includes('No OpenAI API key') || errorMessage.includes('AI enhancement unavailable')) {
        setError('AI enhancement is temporarily unavailable. Please try again later.');
      } else {
        setError(`AI enhancement failed: ${errorMessage}`);
      }
    } finally {
      setEnhancingField(null);
    }
  };

  // Save Progress function - saves current form data without submitting
  const handleSaveProgress = useCallback(async (showMessage: boolean = true) => {
    // Validate minimum required fields for saving
    if (!formData.type || !formData.categoryId || !formData.description || !formData.facilityId) {
      setDraftSaveStatus('not_saved');
      if (showMessage) {
        showToast('Please fill in the required fields (Type, Category, Description, Facility) before saving.', 'error', 5000);
      }
      return false;
    }

    setSaveProgressLoading(true);

    try {
      const payload = {
        ...formData,
        status: isSubmittedEditMode ? editingIncidentStatus : 'DRAFT',
        aiAnalysisData: aiAnalysisResults ? {
          evidenceSummary: aiAnalysisResults.evidenceSummary,
          keyFindings: aiAnalysisResults.keyFindings,
          investigationGuidance: aiAnalysisResults.investigationGuidance,
          recommendedRCAMethodology: aiAnalysisResults.recommendedRCAMethodology,
          attachmentAnalysis: aiAnalysisResults.attachmentAnalysis,
          generatedAt: new Date().toISOString(),
        } : null,
      };

      if (incidentId) {
        // Update existing draft
        await api.patch(`/incidents/${incidentId}`, payload);
      } else {
        // Create new draft incident
        const response = await api.post('/incidents', payload);
        const newIncidentId = response.data.data.id;
        setIncidentId(newIncidentId);
        setIsEditMode(true);
        setEditingIncidentNumber(response.data.data.incidentNumber);
        if (!embedded) {
          // Update standalone page URL to include edit parameter so refresh loads the draft.
          window.history.replaceState(null, '', `/incidents/new?edit=${newIncidentId}`);
        }
      }

      setLastSavedAt(new Date());
      setHasUnsavedChanges(false);
      setDraftSaveStatus('saved');

      if (showMessage) {
        showToast('Draft Save', 'success');
      }

      return true;
    } catch (err: any) {
      console.error('Save Progress error:', err);
      const errorMessage = err.response?.data?.error || 'Failed to save progress';
      setDraftSaveStatus('not_saved');

      if (showMessage) {
        showToast(errorMessage || 'Draft not Save', 'error', 5000);
      }

      return false;
    } finally {
      setSaveProgressLoading(false);
    }
  }, [formData, incidentId, isSubmittedEditMode, editingIncidentStatus, aiAnalysisResults, embedded, showToast]);

  const handleSaveDraftFromFooter = async () => {
    setDraftSaveLoading(true);
    const saved = await handleSaveProgress(true);
    setDraftSaveStatus(saved ? 'saved' : 'not_saved');
    setDraftSaveLoading(false);
  };

  const handleSaveExistingIncidentDetails = async () => {
    if (!incidentId) {
      return;
    }

    const visibilityError = validateVisibilityRules();
    if (visibilityError) {
      setError(visibilityError);
      return;
    }

    setLoading(true);
    setError('');

    try {
      await api.patch(`/incidents/${incidentId}`, {
        ...formData,
        status: editingIncidentStatus || undefined,
        aiAnalysisData: aiAnalysisResults ? {
          evidenceSummary: aiAnalysisResults.evidenceSummary,
          keyFindings: aiAnalysisResults.keyFindings,
          investigationGuidance: aiAnalysisResults.investigationGuidance,
          recommendedRCAMethodology: aiAnalysisResults.recommendedRCAMethodology,
          attachmentAnalysis: aiAnalysisResults.attachmentAnalysis,
          generatedAt: new Date().toISOString(),
        } : undefined,
      });

      setLastSavedAt(new Date());
      setHasUnsavedChanges(false);
      showToast('Incident details saved.', 'success');
    } catch (err: any) {
      if (!handlePrivilegeError(err, showAccessDenied, setError, 'Edit Incident')) {
        const errorMessage = err.response?.data?.error || 'Failed to save incident details';
        setError(errorMessage);
        showToast(errorMessage, 'error', 5000);
      }
    } finally {
      setLoading(false);
    }
  };

  // Auto-save effect - triggers auto-save 3 seconds after last change
  useEffect(() => {
    if (!isAutoSaveEnabled || !hasUnsavedChanges) return;

    // Clear any existing timeout
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    // Only auto-save if minimum fields are filled
    if (formData.type && formData.categoryId && formData.description && formData.facilityId) {
      setIsAutoSaving(true);
      autoSaveTimeoutRef.current = setTimeout(async () => {
        await handleSaveProgress(false); // Silent auto-save
        setIsAutoSaving(false);
      }, 3000); // 3 seconds debounce (reduced from 5)
    }

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
        setIsAutoSaving(false);
      }
    };
  }, [hasUnsavedChanges, isAutoSaveEnabled, formData, handleSaveProgress]);

  // Track form changes for auto-save
  const prevFormDataRef = useRef<string>('');
  useEffect(() => {
    // Don't mark changes during initial load, edit mode loading, or active save
    if (loading || saveProgressLoading || !formData.type) return;

    // Compare JSON strings to detect actual content changes
    const currentFormJson = JSON.stringify(formData);
    if (prevFormDataRef.current && prevFormDataRef.current !== currentFormJson) {
      setHasUnsavedChanges(true);
    }
    prevFormDataRef.current = currentFormJson;
  }, [formData, loading, saveProgressLoading]);

  // Clear unsaved changes flag when incident is loaded in edit mode
  useEffect(() => {
    if (editIncidentId && incidentId) {
      setHasUnsavedChanges(false);
    }
  }, [editIncidentId, incidentId]);

  const handleSubmit = async (isDraft: boolean) => {
    setLoading(true);
    setError('');
    setUploadProgress(null);

    try {
      // Debug log to verify aiAnalysisResults is available
      console.log('📤 Submitting with aiAnalysisResults:', aiAnalysisResults);

      const payload = {
        ...formData,
        status: isSubmittedEditMode ? editingIncidentStatus : (isDraft ? 'DRAFT' : 'SUBMITTED'),
        // Include AI analysis data for RCA process
        aiAnalysisData: aiAnalysisResults ? {
          evidenceSummary: aiAnalysisResults.evidenceSummary,
          keyFindings: aiAnalysisResults.keyFindings,
          investigationGuidance: aiAnalysisResults.investigationGuidance,
          recommendedRCAMethodology: aiAnalysisResults.recommendedRCAMethodology,
          attachmentAnalysis: aiAnalysisResults.attachmentAnalysis,
          generatedAt: new Date().toISOString(),
        } : null,
      };

      console.log('📤 Payload aiAnalysisData:', payload.aiAnalysisData);

      let finalIncidentId = incidentId;

      if (incidentId) {
        // Update existing draft
        await api.patch(`/incidents/${incidentId}`, payload);

        if (!isDraft) {
          // Upload staged evidence files before final submission
          if (stagedFiles.length > 0) {
            setUploadProgress({ uploaded: 0, total: stagedFiles.length });
            await uploadStagedEvidence(
              stagedFiles,
              incidentId,
              (uploaded, total) => setUploadProgress({ uploaded, total })
            );
          }

          await api.post(`/incidents/${incidentId}/submit`);
          // For non-Workplace Safety incidents, redirect to dashboard
          // For Workplace Safety, stay on page to allow Investigation submission
          if (formData.type !== 'WORKPLACE_SAFETY') {
            router.push('/dashboard');
          } else {
            setLoading(false);
          }
        } else {
          // Just update the draft, stay on page
          setLoading(false);
        }
      } else {
        // Create new incident
        const response = await api.post('/incidents', payload);
        finalIncidentId = response.data.data.id;
        setIncidentId(finalIncidentId);

        if (isDraft) {
          // Stay on page to allow evidence staging
          setIsEditMode(true);
          setEditingIncidentNumber(response.data.data.incidentNumber);
          if (!embedded) {
            // Update standalone page URL to include edit parameter so refresh loads the draft.
            window.history.replaceState(null, '', `/incidents/new?edit=${finalIncidentId}`);
          }
          setLoading(false);
        } else {
          // Final submission - upload any staged files first
          if (stagedFiles.length > 0 && finalIncidentId) {
            setUploadProgress({ uploaded: 0, total: stagedFiles.length });
            await uploadStagedEvidence(
              stagedFiles,
              finalIncidentId,
              (uploaded, total) => setUploadProgress({ uploaded, total })
            );
          }
          // For non-Workplace Safety incidents, redirect to dashboard
          // For Workplace Safety, stay on page to allow Investigation submission
          if (formData.type !== 'WORKPLACE_SAFETY') {
            router.push('/dashboard');
          } else {
            setLoading(false);
          }
        }
      }
    } catch (err: any) {
      // Check if this is a privilege error (403)
      if (!handlePrivilegeError(err, showAccessDenied, setError, 'Create Incident')) {
        // Not a privilege error - already handled by setError fallback
      }
      setLoading(false);
      setUploadProgress(null);
    }
  };

  // Handle submitting the Investigation tab separately
  const handleSubmitInvestigation = async () => {
    if (!incidentReportSubmitted || !incidentId) {
      setError('Please submit the Incident Report first before submitting the Investigation.');
      return;
    }

    setInvestigationSubmitting(true);
    setError('');

    try {
      // Prepare investigation-specific payload
      const investigationPayload = {
        // Incident Investigation fields (Leader/Supervisor Assessment)
        isOshaRecordable: formData.isOshaRecordable,
        caseClassification: formData.caseClassification,
        employeeName: formData.employeeName,
        employeeIdNumber: formData.employeeIdNumber,
        positionAtTimeOfIncident: formData.positionAtTimeOfIncident,
        specificInjuryLocation: formData.specificInjuryLocation,
        incidentDate: formData.incidentDate,
        incidentTime: formData.incidentTime,
        dateIncidentReported: formData.dateIncidentReported,
        wasClockedIn: formData.wasClockedIn,
        injuryDevelopmentPattern: formData.injuryDevelopmentPattern,
        injuryWorkRelation: formData.injuryWorkRelation,
        incidentDescriptionDetailed: formData.incidentDescriptionDetailed,
        investigationBodyParts: formData.investigationBodyParts,
        investigationInjuryType: formData.investigationInjuryType,
        wasPerformingOtherDuties: formData.wasPerformingOtherDuties,
        otherDutiesExplanation: formData.otherDutiesExplanation,
        wasInjuryWitnessed: formData.wasInjuryWitnessed,
        witnessNamesList: formData.witnessNamesList,
        wereCoworkersPresent: formData.wereCoworkersPresent,
        wasIncidentSiteViewed: formData.wasIncidentSiteViewed,
        siteViewDate: formData.siteViewDate,
        siteViewTime: formData.siteViewTime,
        didSiteRevealCause: formData.didSiteRevealCause,
        siteRevealExplanation: formData.siteRevealExplanation,
        wasInjuryConsistentWithSite: formData.wasInjuryConsistentWithSite,
        inconsistencyExplanation: formData.inconsistencyExplanation,
        interviewedNames: formData.interviewedNames,
        wereInterviewsDocumented: formData.wereInterviewsDocumented,
        hadPhysicalRestrictions: formData.hadPhysicalRestrictions,
        knownRestrictions: formData.knownRestrictions,
        didLeaveWork: formData.didLeaveWork,
        dateTimeLeftWork: formData.dateTimeLeftWork,
        didReturnToWork: formData.didReturnToWork,
        dateTimeReturnedToWork: formData.dateTimeReturnedToWork,
        isAreaUnderSurveillance: formData.isAreaUnderSurveillance,
        wasSurveillanceAvailable: formData.wasSurveillanceAvailable,
        werePhotosVideosTaken: formData.werePhotosVideosTaken,
        leaderActsConditionsOpinion: formData.leaderActsConditionsOpinion,
        preventionRecommendations: formData.preventionRecommendations,
        supervisorActions: formData.supervisorActions,
        investigationSubmittedAt: new Date().toISOString(),
      };

      // Update the incident with investigation data
      await api.patch(`/incidents/${incidentId}/investigation`, investigationPayload);

      setInvestigationSubmitted(true);
      setInvestigationSubmitting(false);
    } catch (err: any) {
      const errorMsg = err.response?.data?.error;
      setError(typeof errorMsg === 'string' ? errorMsg : errorMsg?.message || 'Failed to submit investigation');
      setInvestigationSubmitting(false);
    }
  };

  // Handle submitting the Incident Report tab for Workplace Safety
  const validateVisibilityRules = (): string | null => {
    if (formData.visibility === 'TEAM' && teamParticipants.length === 0) {
      return 'Team visibility requires at least one team participant.';
    }

    return null;
  };

  const handleSubmitIncidentReport = async () => {
    // Validate visibility rules before submission
    const visibilityError = validateVisibilityRules();
    if (visibilityError) {
      setError(visibilityError);
      return;
    }

    setIncidentReportSubmitting(true);
    setError('');
    setUploadProgress(null);

    try {
      // Debug log to verify aiAnalysisResults is available
      console.log('📤 Submitting Incident Report with aiAnalysisResults:', aiAnalysisResults);

      const payload = {
        ...formData,
        status: 'SUBMITTED',
        // Include AI analysis data for RCA process
        aiAnalysisData: aiAnalysisResults ? {
          evidenceSummary: aiAnalysisResults.evidenceSummary,
          keyFindings: aiAnalysisResults.keyFindings,
          investigationGuidance: aiAnalysisResults.investigationGuidance,
          recommendedRCAMethodology: aiAnalysisResults.recommendedRCAMethodology,
          attachmentAnalysis: aiAnalysisResults.attachmentAnalysis,
          generatedAt: new Date().toISOString(),
        } : null,
        // Include team participants for team incidents
        participants: formData.visibility === 'TEAM' ? teamParticipants.map(p => ({
          userId: p.userId,
          role: p.role,
          canEdit: p.canEdit,
          canChat: p.canChat,
        })) : undefined,
      };

      console.log('📤 Payload aiAnalysisData:', payload.aiAnalysisData);

      let finalIncidentId = incidentId;
      let createdIncident: any = null;

      if (incidentId) {
        // Update existing draft
        const updateResponse = await api.patch(`/incidents/${incidentId}`, payload);
        createdIncident = updateResponse.data.data;

        // Upload staged evidence files before final submission
        if (stagedFiles.length > 0) {
          setUploadProgress({ uploaded: 0, total: stagedFiles.length });
          await uploadStagedEvidence(
            stagedFiles,
            incidentId,
            (uploaded, total) => setUploadProgress({ uploaded, total })
          );
        }

        await api.post(`/incidents/${incidentId}/submit`);
      } else {
        // Create new incident
        const response = await api.post('/incidents', payload);
        createdIncident = response.data.data;
        finalIncidentId = createdIncident.id;
        setIncidentId(finalIncidentId);

        // Upload any staged files
        if (stagedFiles.length > 0 && finalIncidentId) {
          setUploadProgress({ uploaded: 0, total: stagedFiles.length });
          await uploadStagedEvidence(
            stagedFiles,
            finalIncidentId,
            (uploaded, total) => setUploadProgress({ uploaded, total })
          );
        }
      }

      // Get the full incident details including related data names
      const selectedFacility = facilities.find(f => f.id === formData.facilityId);
      const selectedArea = areas.find(a => a.id === formData.areaId);
      const selectedLine = lines.find(l => l.id === formData.lineId);
      const selectedShift = shifts.find(s => s.id === formData.shiftId);
      const selectedCategory = categories.find(c => c.id === formData.categoryId);

      // Extract date and time from occurredAt
      const occurredDate = formData.occurredAt ? new Date(formData.occurredAt) : new Date();
      const dateString = occurredDate.toISOString().split('T')[0];
      const timeString = occurredDate.toTimeString().substring(0, 5);

      // Build submitted incident data for the modal
      setSubmittedIncidentData({
        id: finalIncidentId || createdIncident?.id,
        incidentNumber: createdIncident?.incidentNumber || 'Pending',
        title: formData.customTitle || selectedCategory?.name || 'Incident',
        type: formData.type,
        category: selectedCategory?.name || createdIncident?.Category?.name,
        severity: formData.severity,
        status: 'SUBMITTED',
        date: dateString,
        time: timeString,
        facility: selectedFacility?.name || createdIncident?.Facility?.name,
        area: selectedArea?.name,
        line: selectedLine?.name,
        shift: selectedShift?.name,
        description: formData.description,
        aiSummary: formData.aiSummary,
        attachmentCount: stagedFiles.length,
        visibility: formData.visibility,
        recommendedRCAMethodology: aiAnalysisResults?.recommendedRCAMethodology || null,
      });

      setIncidentReportSubmitted(true);
      setSubmissionModalOpen(true);
      setIncidentReportSubmitting(false);
      setUploadProgress(null);
    } catch (err: any) {
      // Check if this is a privilege error (403)
      handlePrivilegeError(err, showAccessDenied, setError, 'Submit Incident Report');
      setIncidentReportSubmitting(false);
      setUploadProgress(null);
    }
  };

  // AI Form Validation for Incident Report
  const handleValidateIncidentReport = async () => {
    setValidatingIncidentReport(true);
    setIncidentReportValidation(null);

    try {
      const selectedCategory = categories.find(c => c.id === formData.categoryId);
      const response = await api.post('/incidents/validate-safety-form', {
        formTab: 'incident-report',
        incidentCategory: selectedCategory?.name || 'Unknown',
        incidentDescription: formData.description,
        formData: {
          injuryType: formData.injuryType,
          taskBeingPerformed: formData.taskBeingPerformed,
          bodyPartsAffected: formData.bodyPartsAffected,
          bodyPartsAffectedNA: formData.bodyPartsAffectedNA,
          taskRoutineType: formData.taskRoutineType,
          exposureDuration: formData.exposureDuration,
          taskFrequency: formData.taskFrequency,
          weightOrForce: formData.weightOrForce,
          environmentalConditions: formData.environmentalConditions,
          environmentalConditionsNA: formData.environmentalConditionsNA,
          ppeRequired: formData.ppeRequired,
          ppeWorn: formData.ppeWorn,
          machineSafeguardsInPlace: formData.machineSafeguardsInPlace,
          lotoRequired: formData.lotoRequired,
          sopAvailable: formData.sopAvailable,
          sopFollowed: formData.sopFollowed,
          firstAidProvided: formData.firstAidProvided,
          medicalTreatmentRequired: formData.medicalTreatmentRequired,
          supervisorNotified: formData.supervisorNotified,
          areaSecured: formData.areaSecured,
          directCause: formData.directCause,
          unsafeActOrCondition: formData.unsafeActOrCondition,
          previousSimilarIncidents: formData.previousSimilarIncidents,
          injuryDevelopmentType: formData.injuryDevelopmentType,
          dateOfInjury: formData.dateOfInjury,
          timeOfInjury: formData.timeOfInjury,
          injuryLocation: formData.injuryLocation,
          injuryCausedByWork: formData.injuryCausedByWork,
          injuryWitnessed: formData.injuryWitnessed,
        },
      });

      setIncidentReportValidation(response.data.data);
    } catch (err: any) {
      console.error('Validation failed:', err);
      setIncidentReportValidation({
        isComplete: true,
        overallScore: 0,
        issues: [],
        recommendations: [],
        summary: 'AI validation unavailable. Please review your entries manually.',
      });
    } finally {
      setValidatingIncidentReport(false);
    }
  };

  // AI Form Validation for Investigation
  const handleValidateInvestigation = async () => {
    setValidatingInvestigation(true);
    setInvestigationValidation(null);

    try {
      const selectedCategory = categories.find(c => c.id === formData.categoryId);
      const response = await api.post('/incidents/validate-safety-form', {
        formTab: 'investigation',
        incidentCategory: selectedCategory?.name || 'Unknown',
        incidentDescription: formData.description,
        formData: {
          isOshaRecordable: formData.isOshaRecordable,
          caseClassification: formData.caseClassification,
          employeeName: formData.employeeName,
          employeeIdNumber: formData.employeeIdNumber,
          positionAtTimeOfIncident: formData.positionAtTimeOfIncident,
          specificInjuryLocation: formData.specificInjuryLocation,
          incidentDate: formData.incidentDate,
          incidentTime: formData.incidentTime,
          wasClockedIn: formData.wasClockedIn,
          injuryDevelopmentPattern: formData.injuryDevelopmentPattern,
          injuryWorkRelation: formData.injuryWorkRelation,
          incidentDescriptionDetailed: formData.incidentDescriptionDetailed,
          investigationBodyParts: formData.investigationBodyParts,
          investigationInjuryType: formData.investigationInjuryType,
          injuryMechanism: formData.injuryMechanism,
          wasPerformingOtherDuties: formData.wasPerformingOtherDuties,
          wasInjuryWitnessed: formData.wasInjuryWitnessed,
          wereCoworkersPresent: formData.wereCoworkersPresent,
          wasIncidentSiteViewed: formData.wasIncidentSiteViewed,
          didSiteRevealCause: formData.didSiteRevealCause,
          wasInjuryConsistentWithSite: formData.wasInjuryConsistentWithSite,
        },
      });

      setInvestigationValidation(response.data.data);
    } catch (err: any) {
      console.error('Validation failed:', err);
      setInvestigationValidation({
        isComplete: true,
        overallScore: 0,
        issues: [],
        recommendations: [],
        summary: 'AI validation unavailable. Please review your entries manually.',
      });
    } finally {
      setValidatingInvestigation(false);
    }
  };

  // Helper component for required field hint
  const RequiredFieldHint = ({ allowsNA = true }: { allowsNA?: boolean }) => (
    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 italic">
      {allowsNA
        ? '* Required. Check the N/A box if not applicable to this incident.'
        : '* Required field.'
      }
    </p>
  );

  // N/A Checkbox component for input fields
  const NACheckbox = ({
    fieldName,
    checked,
    onChange
  }: {
    fieldName: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
  }) => (
    <label className="inline-flex items-center gap-1.5 ml-2 cursor-pointer select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
      />
      <span className="text-xs font-medium text-gray-500 dark:text-gray-400">N/A</span>
    </label>
  );

  // Helper to check if a field value is N/A
  const isFieldNA = (value: string | null | undefined): boolean => {
    return value === 'N/A';
  };

  // Helper to toggle N/A for a field
  const toggleFieldNA = (fieldName: keyof typeof formData, currentValue: string) => {
    if (currentValue === 'N/A') {
      setFormData({ ...formData, [fieldName]: '' });
    } else {
      setFormData({ ...formData, [fieldName]: 'N/A' });
    }
  };

  // AI Validation Results Component
  const ValidationResultsPanel = ({
    validation,
    isValidating,
    onValidate,
    tabName
  }: {
    validation: FormValidationResult | null;
    isValidating: boolean;
    onValidate: () => void;
    tabName: string;
  }) => (
    <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-md font-semibold text-blue-800 dark:text-blue-300 flex items-center gap-2">
          Form Check
        </h4>
        <button
          type="button"
          onClick={onValidate}
          disabled={isValidating}
          className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${
            isValidating
              ? 'bg-gray-200 dark:bg-gray-700 text-gray-500 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          {isValidating ? (
            <>
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Validating...
            </>
          ) : (
            <>
              Validate {tabName}
            </>
          )}
        </button>
      </div>

      <p className="text-sm text-blue-700 dark:text-blue-400 mb-3">
        Run a quick check before submission. It looks for missing details, N/A use, and simple suggestions.
      </p>

      {validation && (
        <div className="space-y-4">
          {/* Score & Summary */}
          <div className={`p-3 rounded-lg ${
            validation.overallScore >= 80
              ? 'bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700'
              : validation.overallScore >= 50
              ? 'bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-700'
              : 'bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-gray-800 dark:text-gray-200">
                Completeness Score: {validation.overallScore}%
              </span>
              <span className={`px-2 py-1 rounded text-xs font-medium ${
                validation.isComplete
                  ? 'bg-green-200 text-green-800 dark:bg-green-800 dark:text-green-200'
                  : 'bg-red-200 text-red-800 dark:bg-red-800 dark:text-red-200'
              }`}>
                {validation.isComplete ? '✓ Complete' : '✗ Incomplete'}
              </span>
            </div>
            <p className="text-sm text-gray-700 dark:text-gray-300">{validation.summary}</p>
          </div>

          {/* Issues */}
          {validation.issues.length > 0 && (
            <div className="space-y-2">
              <h5 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Issues Found:</h5>
              {validation.issues.map((issue, idx) => (
                <div key={idx} className={`p-3 rounded-lg text-sm ${
                  issue.severity === 'critical'
                    ? 'bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500'
                    : issue.severity === 'warning'
                    ? 'bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-500'
                    : 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500'
                }`}>
                  <div className="flex items-start gap-2">
                    <div className="flex-1">
                      <p className="font-medium text-gray-800 dark:text-gray-200">
                        {issue.fieldLabel}
                        <span className="ml-2 text-xs font-normal px-2 py-0.5 rounded bg-gray-200 dark:bg-gray-700">
                          {issue.issueType.replace(/_/g, ' ')}
                        </span>
                      </p>
                      <p className="text-gray-600 dark:text-gray-400 mt-1">{issue.message}</p>
                      <p className="text-blue-600 dark:text-blue-400 mt-1">
                        <strong>Recommendation:</strong> {issue.recommendation}
                      </p>
                      {issue.suggestedValue && (
                        <p className="text-green-600 dark:text-green-400 mt-1 bg-green-50 dark:bg-green-900/30 px-2 py-1 rounded">
                          <strong>Suggested Value:</strong> {issue.suggestedValue}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Contextual Insights */}
          {validation.contextualInsights && (
            <div className="space-y-2">
              <h5 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                Context Review
              </h5>
              <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-200 dark:border-indigo-700">
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <p className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">Incident Type Alignment</p>
                    <p className="text-sm text-gray-700 dark:text-gray-300">{validation.contextualInsights.incidentTypeAlignment}</p>
                  </div>
                  <div>
                    <p className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">Data Consistency Score</p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            validation.contextualInsights.dataConsistencyScore >= 80
                              ? 'bg-green-500'
                              : validation.contextualInsights.dataConsistencyScore >= 50
                              ? 'bg-yellow-500'
                              : 'bg-red-500'
                          }`}
                          style={{ width: `${validation.contextualInsights.dataConsistencyScore}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {validation.contextualInsights.dataConsistencyScore}%
                      </span>
                    </div>
                  </div>
                </div>
                {validation.contextualInsights.suggestedImprovements && validation.contextualInsights.suggestedImprovements.length > 0 && (
                  <div>
                    <p className="text-xs text-indigo-600 dark:text-indigo-400 font-medium mb-1">Priority Improvements</p>
                    <ul className="list-disc list-inside space-y-1 text-sm text-gray-600 dark:text-gray-400">
                      {validation.contextualInsights.suggestedImprovements.map((improvement, idx) => (
                        <li key={idx}>{improvement}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Recommendations */}
          {validation.recommendations.length > 0 && (
            <div className="space-y-2">
              <h5 className="text-sm font-semibold text-gray-700 dark:text-gray-300">General Recommendations:</h5>
              <ul className="list-disc list-inside space-y-1 text-sm text-gray-600 dark:text-gray-400">
                {validation.recommendations.map((rec, idx) => (
                  <li key={idx}>{rec}</li>
                ))}
              </ul>
            </div>
          )}

          {validation.issues.length === 0 && validation.recommendations.length === 0 && (
            <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg text-sm text-green-700 dark:text-green-400 flex items-center gap-2">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              All fields look good! No issues detected.
            </div>
          )}
        </div>
      )}
    </div>
  );

  // Helper function to add N/A option to dropdown arrays (for non-Yes/No dropdowns)
  const addNAOption = (options: DropdownOption[] | undefined, includeNA: boolean = true): DropdownOption[] => {
    const baseOptions = options || [];
    if (!includeNA) return baseOptions;
    // Check if N/A option already exists
    const hasNA = baseOptions.some(opt => opt.value?.toUpperCase() === 'N/A' || opt.value?.toUpperCase() === 'NA');
    if (hasNA) return baseOptions;
    return [{ id: 'na-option', value: 'N/A', label: 'N/A (Not Applicable)', type: '' as any }, ...baseOptions];
  };

  // Get parent categories (no parentId) - Main Categories
  const parentCategories = categories.filter(c => !c.parentId);

  // Get subcategories for selected main category
  // Filter out "Other" subcategories that don't have allowCustomTitle enabled
  const subcategories = categories.filter(c => {
    if (c.parentId !== formData.mainCategoryId) return false;
    // If it's named "Other" but allowCustomTitle is false, don't show it
    if (c.name === 'Other' && !c.allowCustomTitle) return false;
    return true;
  });

  // Check if selected subcategory allows custom title (for "Other")
  const selectedSubcategory = categories.find(c => c.id === formData.categoryId);
  const showCustomTitle = selectedSubcategory?.allowCustomTitle || false;

  // Areas are already filtered by facilityId from the API
  // Lines are already filtered by areaId from the API
  const filteredAreas = areas;
  const filteredLines = lines;
  const selectedIncidentType = INCIDENT_TYPE_OPTIONS.find(option => option.value === formData.type);
  const isIncidentTypePageComplete = Boolean(formData.type);
  const isDetailsPageComplete = Boolean(
    formData.type &&
    formData.categoryId &&
    formData.description.trim() &&
    formData.facilityId &&
    formData.occurredAt &&
    formData.severity &&
    (!showCustomTitle || formData.customTitle.trim())
  );

  useEffect(() => {
    if (formPage !== 1 && !isIncidentTypePageComplete) {
      setFormPage(1);
    } else if (formPage === 3 && !isDetailsPageComplete) {
      setFormPage(2);
    }
  }, [formPage, isIncidentTypePageComplete, isDetailsPageComplete]);

  useEffect(() => {
    modalBodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [formPage]);

  const clampModalPosition = useCallback((position: { left: number; top: number }) => {
    const modal = formSurfaceRef.current;
    const container = modal?.parentElement;

    if (!modal || !container) {
      return position;
    }

    const maxLeft = Math.max(8, container.clientWidth - modal.offsetWidth - 8);
    const maxTop = Math.max(8, container.clientHeight - modal.offsetHeight - 8);

    return {
      left: Math.min(Math.max(8, position.left), maxLeft),
      top: Math.min(Math.max(8, position.top), maxTop),
    };
  }, []);

  useEffect(() => {
    if (isIncidentModalMaximized || typeof window === 'undefined') {
      return;
    }

    let animationFrameId: number | null = null;
    const syncModalPosition = () => {
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
      }

      animationFrameId = requestAnimationFrame(() => {
        setModalPosition((currentPosition) => {
          const nextPosition = clampModalPosition(currentPosition);
          return nextPosition.left === currentPosition.left && nextPosition.top === currentPosition.top
            ? currentPosition
            : nextPosition;
        });
        animationFrameId = null;
      });
    };

    const resizeObserver = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(syncModalPosition)
      : null;

    const modal = formSurfaceRef.current;
    const container = modal?.parentElement;

    if (modal) resizeObserver?.observe(modal);
    if (container) resizeObserver?.observe(container);

    syncModalPosition();
    window.addEventListener('resize', syncModalPosition);
    window.addEventListener('orientationchange', syncModalPosition);
    window.addEventListener('transitionend', syncModalPosition, true);
    window.visualViewport?.addEventListener('resize', syncModalPosition);

    return () => {
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
      }

      resizeObserver?.disconnect();
      window.removeEventListener('resize', syncModalPosition);
      window.removeEventListener('orientationchange', syncModalPosition);
      window.removeEventListener('transitionend', syncModalPosition, true);
      window.visualViewport?.removeEventListener('resize', syncModalPosition);
    };
  }, [clampModalPosition, isIncidentModalMaximized]);

  const handleIncidentModalPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (isIncidentModalMaximized || event.button !== 0) {
      return;
    }

    const target = event.target as HTMLElement;
    if (target.closest('button, a, input, select, textarea, [data-no-drag="true"]')) {
      return;
    }

    const startingPosition = clampModalPosition(modalPosition);
    modalDragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startLeft: startingPosition.left,
      startTop: startingPosition.top,
    };

    setModalPosition(startingPosition);
    setIsIncidentModalDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  const handleIncidentModalPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const dragState = modalDragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId || isIncidentModalMaximized) {
      return;
    }

    setModalPosition(clampModalPosition({
      left: dragState.startLeft + event.clientX - dragState.startX,
      top: dragState.startTop + event.clientY - dragState.startY,
    }));
  };

  const handleIncidentModalPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const dragState = modalDragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    modalDragStateRef.current = null;
    setIsIncidentModalDragging(false);

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const toggleIncidentModalMaximized = () => {
    modalDragStateRef.current = null;
    setIsIncidentModalDragging(false);
    setIsIncidentModalMaximized((currentValue) => !currentValue);
  };

  const handleIncidentModalBack = () => {
    if (formPage === 3) {
      setFormPage(2);
      return;
    }

    if (formPage === 2) {
      setFormPage(1);
      return;
    }

    handleCloseIncidentForm();
  };

  const handleIncidentModalNext = () => {
    if (formPage === 1 && isIncidentTypePageComplete) {
      setFormPage(2);
      return;
    }

    if (formPage === 2 && isDetailsPageComplete) {
      setFormPage(3);
    }
  };

  const canMoveToNextIncidentFormPage =
    formPage === 1 ? isIncidentTypePageComplete :
    formPage === 2 ? isDetailsPageComplete :
    true;

  const incidentModalStyle: React.CSSProperties = isIncidentModalMaximized
    ? {
        inset: 8,
        width: 'auto',
        height: 'calc(100% - 16px)',
      }
    : {
        left: modalPosition.left,
        top: modalPosition.top,
        width: 'min(1120px, calc(100% - 24px))',
        height: 'min(720px, calc(100% - 24px))',
      };

  // Show access denied modal if user lacks privilege (using inline check to prevent flash)
  // This redirects to dashboard when coming from Quick Navigation
  if (shouldShowAccessDenied) {
    const accessDeniedContent = (
      <>
        <AccessDeniedModal
          isOpen={shouldShowAccessDenied}
          onClose={handleCloseIncidentForm}
          featureName={editIncidentId ? 'Edit Incident Report' : 'Create Incident Report'}
          requiredPrivilege={editIncidentId ? INCIDENTS_PRIVILEGES.EDIT : INCIDENTS_PRIVILEGES.CREATE}
        />
        <div className={embedded ? 'absolute inset-0 bg-transparent' : 'min-h-screen bg-gray-50 dark:bg-gray-900'} />
      </>
    );

    return embedded ? accessDeniedContent : (
      <ProtectedRoute requireAuth={true}>
        {accessDeniedContent}
      </ProtectedRoute>
    );
  }

  const draftSaveInProgress = draftSaveLoading || saveProgressLoading;
  const isStepThreeDraftSaved =
    draftSaveStatus === 'saved' ||
    (draftSaveStatus !== 'not_saved' && Boolean(incidentId || lastSavedAt) && !hasUnsavedChanges);
  const stepThreeDraftStatusText = draftSaveInProgress
    ? 'Saving to Draft.......'
    : isStepThreeDraftSaved
      ? 'Draft Save'
      : 'Draft not Save';

  const formContent = (
    <>
      {/* Access Denied Modal for API privilege errors */}
      {accessDeniedModal}

      {/* AI Analysis Modal */}
      <AIAnalysisModal
        isOpen={aiModalOpen}
        stage={aiModalStage}
        attachmentCount={stagedFiles.filter(f => f.file.type.startsWith('image/') || f.file.type.startsWith('video/')).length}
        currentAttachment={currentAnalyzingAttachment}
      />

      {/* Incident Submission Success Modal */}
      <IncidentSubmissionModal
        isOpen={submissionModalOpen}
        incidentData={submittedIncidentData}
        onViewIncident={async () => {
          const submittedIncidentId = submittedIncidentData?.id;
          const preferredMethod = normalizeRcaMethod(
            submittedIncidentData?.recommendedRCAMethodology?.primary
          );

          if (!submittedIncidentId) {
            router.push('/incidents?filter=my');
            setSubmissionModalOpen(false);
            setSubmittedIncidentData(null);
            onClose?.();
            return;
          }

          try {
            const rcaAnalysis = await ensureRcaWorkspaceForIncident(
              submittedIncidentId,
              [],
              preferredMethod
            );
            router.push(`/rca/${rcaAnalysis.id}`);
            setSubmissionModalOpen(false);
            setSubmittedIncidentData(null);
            onClose?.();
          } catch (err) {
            console.error('Failed to open RCA workspace after incident submission:', err);
            router.push('/incidents?filter=my');
            setSubmissionModalOpen(false);
            setSubmittedIncidentData(null);
            onClose?.();
          }
        }}
        onGoToDashboard={() => {
          router.push('/dashboard');
          setSubmissionModalOpen(false);
          setSubmittedIncidentData(null);
          onClose?.();
        }}
      />

      {!submissionModalOpen && (
        <>
          <style>{`
            .incident-form-surface {
              font-size: 12px;
            }
            .incident-modal-header {
              touch-action: none;
            }
            .incident-form-surface h1 {
              letter-spacing: 0;
            }
            .incident-form-surface h2 {
              font-size: 0.76rem !important;
              line-height: 1.05rem !important;
              letter-spacing: 0.04em;
              text-transform: uppercase;
              margin-bottom: 0.55rem !important;
            }
            .incident-form-surface h3,
            .incident-form-surface h4,
            .incident-form-surface h5 {
              letter-spacing: 0;
            }
            .incident-form-surface label {
              font-size: 0.7rem !important;
              line-height: 0.95rem !important;
              margin-bottom: 0.28rem !important;
            }
            .incident-form-surface input,
            .incident-form-surface select,
            .incident-form-surface textarea {
              min-height: 2.05rem;
              border-radius: 0.5rem !important;
              font-size: 0.8rem !important;
              line-height: 1.1rem !important;
              padding: 0.42rem 0.65rem !important;
              box-shadow: 0 1px 1px rgba(15, 23, 42, 0.03);
            }
            .incident-form-surface textarea {
              min-height: 4.75rem;
            }
            .incident-form-surface button {
              border-radius: 0.5rem !important;
            }
            .incident-section {
              border: 1px solid rgba(203, 213, 225, 0.85);
              border-radius: 0.65rem;
              background: rgba(248, 250, 252, 0.72);
              padding: 0.75rem;
            }
            .dark .incident-section {
              border-color: rgba(51, 65, 85, 0.9);
              background: rgba(15, 23, 42, 0.38);
            }
            @media (min-width: 640px) {
              .incident-section {
                padding: 0.85rem;
              }
            }
          `}</style>

          <div className={embedded
            ? 'absolute inset-0 overflow-hidden bg-transparent p-2 pointer-events-none sm:p-3'
            : 'relative min-h-[calc(100vh-4rem)] overflow-hidden bg-transparent p-2 sm:p-3'
          }>
            <div
              ref={formSurfaceRef}
              style={incidentModalStyle}
              className={`incident-form-surface pointer-events-auto absolute z-30 flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl shadow-slate-900/15 dark:border-slate-700 dark:bg-slate-800 dark:shadow-black/30 ${
                isIncidentModalDragging ? 'select-none' : ''
              }`}
              role="dialog"
              aria-modal="true"
              aria-label={isEditMode ? 'Edit incident details' : 'Create incident'}
            >
            <div
              className={`incident-modal-header border-b border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900 ${
                isIncidentModalMaximized
                  ? 'cursor-default'
                  : isIncidentModalDragging
                    ? 'cursor-grabbing'
                    : 'cursor-grab'
              }`}
              onPointerDown={handleIncidentModalPointerDown}
              onPointerMove={handleIncidentModalPointerMove}
              onPointerUp={handleIncidentModalPointerUp}
              onPointerCancel={handleIncidentModalPointerUp}
            >
              <div className="mb-1.5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <h1 className="min-w-0 truncate text-sm font-semibold text-gray-900 dark:text-white sm:text-base">
                  {isEditMode
                    ? `${isSubmittedEditMode ? 'Edit Incident' : 'Edit Draft'}: ${editingIncidentNumber}`
                    : 'Create New Incident'}
                </h1>
                <div className="flex items-center gap-2 self-start sm:self-center">
                  {isEditMode && (
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                      {formatStatusLabel(editingIncidentStatus)}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={toggleIncidentModalMaximized}
                    aria-label={isIncidentModalMaximized ? 'Restore incident form modal' : 'Maximize incident form modal'}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:border-slate-700 dark:bg-slate-800 dark:text-gray-300 dark:hover:bg-slate-700 dark:hover:text-white"
                  >
                    {isIncidentModalMaximized ? (
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 3v5H3M21 8h-5V3M16 21v-5h5M3 16h5v5" />
                      </svg>
                    ) : (
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 9V4h5M20 9V4h-5M15 20h5v-5M9 20H4v-5" />
                      </svg>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={handleCloseIncidentForm}
                    aria-label="Close incident form"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:border-slate-700 dark:bg-slate-800 dark:text-gray-300 dark:hover:bg-slate-700 dark:hover:text-white"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              <p className="mb-2 text-xs text-gray-600 dark:text-gray-400">
                {isEditMode
                  ? isSubmittedEditMode
                    ? 'Update the current incident details without changing the incident status.'
                    : 'Continue editing your draft incident report'
                  : 'Report a food safety, machine equipment, workplace safety, or operations incident'}
              </p>

              <div className="grid grid-cols-3 gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1 dark:border-slate-700 dark:bg-slate-800/90">
                <button
                  type="button"
                  onClick={() => setFormPage(1)}
                  aria-current={formPage === 1 ? 'step' : undefined}
                  className={`px-2 py-1.5 text-[11px] font-medium transition-colors ${
                    formPage === 1
                      ? 'bg-white text-primary-700 shadow-sm dark:bg-slate-900 dark:text-primary-300'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  1. Incident Type
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (isIncidentTypePageComplete) {
                      setFormPage(2);
                    }
                  }}
                  disabled={!isIncidentTypePageComplete}
                  aria-current={formPage === 2 ? 'step' : undefined}
                  className={`px-2 py-1.5 text-[11px] font-medium transition-colors ${
                    formPage === 2
                      ? 'bg-white text-primary-700 shadow-sm dark:bg-slate-900 dark:text-primary-300'
                      : isIncidentTypePageComplete
                        ? 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                        : 'cursor-not-allowed text-slate-400 dark:text-slate-600'
                  }`}
                >
                  2. Details
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (isDetailsPageComplete) {
                      setFormPage(3);
                    }
                  }}
                  disabled={!isDetailsPageComplete}
                  aria-current={formPage === 3 ? 'step' : undefined}
                  className={`px-2 py-1.5 text-[11px] font-medium transition-colors ${
                    formPage === 3
                      ? 'bg-white text-primary-700 shadow-sm dark:bg-slate-900 dark:text-primary-300'
                      : isDetailsPageComplete
                        ? 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                        : 'cursor-not-allowed text-slate-400 dark:text-slate-600'
                  }`}
                >
                  3. Evidence & Submit
                </button>
              </div>
            </div>

            <div ref={modalBodyRef} className="incident-modal-body flex-1 overflow-y-auto p-3 sm:p-4">
            {error && (
              <div className="mb-3 rounded-lg border border-danger-200 bg-danger-50 p-3 dark:border-danger-800 dark:bg-danger-900/20">
                <p className="text-xs text-danger-800 dark:text-danger-200">{error}</p>
              </div>
            )}

            {/* Step 1: Incident Type */}
            <div className={formPage === 1 ? 'incident-section mb-4' : 'hidden'}>
              <h2 className="font-semibold text-gray-900 dark:text-white">
                1. Incident Type *
              </h2>
              <div className="max-w-xl">
                <select
                  value={formData.type}
                  onChange={(event) => setFormData({
                    ...formData,
                    type: event.target.value as typeof formData.type,
                    categoryId: '',
                    mainCategoryId: '',
                  })}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  required
                >
                  <option value="">Select incident type</option>
                  {INCIDENT_TYPE_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {selectedIncidentType && (
                  <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                    {selectedIncidentType.description}
                  </p>
                )}
              </div>
            </div>

            {formData.type && (
              <>
                {/* Step 2: Category Selection */}
                <div className={formPage === 2 ? 'incident-section mb-4' : 'hidden'}>
                      <h2 className="font-semibold text-gray-900 dark:text-white">
                        1. Category *
                  </h2>

                  {/* Main Category Dropdown */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Main Category *
                    </label>
                    <select
                      value={formData.mainCategoryId}
                      onChange={(e) => {
                        setFormData({
                          ...formData,
                          mainCategoryId: e.target.value,
                          categoryId: '', // Reset subcategory when main changes
                          customTitle: '' // Reset custom title
                        });
                      }}
                      required
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="">Select main category</option>
                      {parentCategories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Subcategory Dropdown - Shows when main category is selected */}
                  {formData.mainCategoryId && subcategories.length > 0 && (
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Subcategory *
                      </label>
                      <select
                        value={formData.categoryId}
                        onChange={(e) => {
                          setFormData({
                            ...formData,
                            categoryId: e.target.value,
                            customTitle: '' // Reset custom title when subcategory changes
                          });
                        }}
                        required
                        className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                      >
                        <option value="">Select subcategory</option>
                        {subcategories.map((subcat) => (
                          <option key={subcat.id} value={subcat.id}>
                            {subcat.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Custom Title Field - Shows when "Other" subcategory is selected */}
                  {showCustomTitle && (
                    <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Issue Detail * (Please specify)
                      </label>
                      <input
                        type="text"
                        value={formData.customTitle}
                        onChange={(e) => setFormData({ ...formData, customTitle: e.target.value })}
                        required={showCustomTitle}
                        placeholder="e.g., Unknown foreign material"
                        className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                  )}
                </div>

                {/* Step 3: Incident Details */}
                <div className={formPage === 2 ? 'incident-section mb-4' : 'hidden'}>
                  <h2 className="font-semibold text-gray-900 dark:text-white">
                    2. Incident Details
                  </h2>

                  <div className="space-y-3">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                          Description *
                        </label>
                        {formData.type && formData.description.trim().length >= 5 && (
                          <button
                            type="button"
                            onClick={() => enhanceText('description', 'Incident Description')}
                            disabled={enhancingField === 'description'}
                            className="inline-flex items-center gap-1.5 rounded-full bg-primary-600 px-3 py-1 text-xs font-medium text-white shadow-sm transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {enhancingField === 'description' ? (
                              <>
                                <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                                Improving...
                              </>
                            ) : (
                              <>
                                Improve Text
                              </>
                            )}
                          </button>
                        )}
                      </div>
                      <textarea
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        required
                        rows={3}
                        placeholder="Describe what happened... (AI enhancement available after typing 5+ characters)"
                        className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                      />
                      {formData.type && formData.description.trim().length > 0 && formData.description.trim().length < 5 && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Type at least 5 characters to enable AI enhancement
                        </p>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      <div>
                        <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
                          Facility *
                        </label>
                        <select
                          value={formData.facilityId}
                          onChange={(e) => setFormData({ ...formData, facilityId: e.target.value, departmentId: '', areaId: '', lineId: '', shiftId: '' })}
                          required
                          className="w-full px-3 sm:px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 text-sm sm:text-base"
                        >
                          <option value="">Select facility</option>
                          {facilities.map((f) => (
                            <option key={f.id} value={f.id}>{f.name}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
                          Department
                        </label>
                        <select
                          value={formData.departmentId}
                          onChange={(e) => setFormData({ ...formData, departmentId: e.target.value, areaId: '', lineId: '', shiftId: '' })}
                          disabled={!formData.facilityId}
                          className="w-full px-3 sm:px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 disabled:opacity-50 text-sm sm:text-base"
                        >
                          <option value="">Select department</option>
                          {departments.map((d) => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      <div>
                        <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
                          Area
                        </label>
                        <select
                          value={formData.areaId}
                          onChange={(e) => setFormData({ ...formData, areaId: e.target.value, lineId: '', shiftId: '' })}
                          disabled={!formData.departmentId}
                          className="w-full px-3 sm:px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 disabled:opacity-50 text-sm sm:text-base"
                        >
                          <option value="">Select area</option>
                          {filteredAreas.map((a) => (
                            <option key={a.id} value={a.id}>{a.name}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
                          Production Line
                        </label>
                        <select
                          value={formData.lineId}
                          onChange={(e) => setFormData({ ...formData, lineId: e.target.value, shiftId: '' })}
                          disabled={!formData.areaId}
                          className="w-full px-3 sm:px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 disabled:opacity-50 text-sm sm:text-base"
                        >
                          <option value="">Select line</option>
                          {filteredLines.map((l) => (
                            <option key={l.id} value={l.id}>{l.lineNumber} - {l.name}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
                          Shift
                        </label>
                        <select
                          value={formData.shiftId}
                          onChange={(e) => setFormData({ ...formData, shiftId: e.target.value })}
                          disabled={!formData.lineId}
                          className="w-full px-3 sm:px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 disabled:opacity-50 text-sm sm:text-base"
                        >
                          <option value="">Select shift</option>
                          {shifts.map((s) => (
                            <option key={s.id} value={s.id}>{s.name} ({formatTime(s.startTime)} - {formatTime(s.endTime)})</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Product fields - Only for Food Safety incidents */}
                    {formData.type === 'FOOD_SAFETY' && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                        <div>
                          <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
                            Product Name
                          </label>
                          <input
                            type="text"
                            value={formData.productName}
                            onChange={(e) => setFormData({ ...formData, productName: e.target.value })}
                            placeholder="e.g., Chocolate Chip Cookies"
                            className="w-full px-3 sm:px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 text-sm sm:text-base"
                          />
                        </div>

                        <div>
                          <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
                            Lot Number
                          </label>
                          <input
                            type="text"
                            value={formData.lotNumber}
                            onChange={(e) => setFormData({ ...formData, lotNumber: e.target.value })}
                            placeholder="e.g., LOT-2025-001"
                            className="w-full px-3 sm:px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 text-sm sm:text-base"
                          />
                        </div>
                      </div>
                    )}

                    {/* Machine ID - Only for Machine & Equipment incidents */}
                    {formData.type === 'MACHINE_EQUIPMENT' && (
                      <div>
                        <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
                          Machine ID
                        </label>
                        <input
                          type="text"
                          value={formData.machineId}
                          onChange={(e) => setFormData({ ...formData, machineId: e.target.value })}
                          placeholder="e.g., PKG-001, OVEN-02"
                          className="w-full px-3 sm:px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 text-sm sm:text-base"
                        />
                      </div>
                    )}

                    {/* Workplace Safety Specific Fields */}
                    {formData.type === 'WORKPLACE_SAFETY' && (
                      <div className="space-y-4 sm:space-y-6 p-3 sm:p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-lg">
                        <h3 className="text-sm sm:text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                          🦺 Safety-Specific Information
                        </h3>

                        {/* Save Progress Bar */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 p-2 sm:p-3 bg-white dark:bg-slate-800 rounded-lg border border-amber-200 dark:border-amber-700 shadow-sm">
                          <div className="flex items-center gap-2 sm:gap-3">
                            <button
                              type="button"
                              onClick={() => handleSaveProgress(true)}
                              disabled={saveProgressLoading || !formData.type || !formData.categoryId || !formData.description || !formData.facilityId}
                              className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium flex items-center gap-1.5 sm:gap-2 transition-all touch-manipulation ${
                                saveProgressLoading
                                  ? 'bg-blue-300 dark:bg-blue-700 text-white cursor-wait'
                                  : !formData.type || !formData.categoryId || !formData.description || !formData.facilityId
                                    ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 cursor-not-allowed'
                                    : 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm hover:shadow-md'
                              }`}
                            >
                              {saveProgressLoading ? (
                                <>
                                  <svg className="animate-spin h-3 w-3 sm:h-4 sm:w-4" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                  </svg>
                                  <span className="hidden sm:inline">Saving...</span>
                                </>
                              ) : (
                                <>
                                  <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                                  </svg>
                                  💾 <span className="hidden sm:inline">Save Progress</span><span className="sm:hidden">Save</span>
                                </>
                              )}
                            </button>

                            {/* Auto-save toggle - prominent switch style */}
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setIsAutoSaveEnabled(!isAutoSaveEnabled)}
                                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                                  isAutoSaveEnabled ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
                                }`}
                                role="switch"
                                aria-checked={isAutoSaveEnabled}
                              >
                                <span
                                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                    isAutoSaveEnabled ? 'translate-x-5' : 'translate-x-0'
                                  }`}
                                />
                              </button>
                              <span className={`text-xs sm:text-sm font-medium ${
                                isAutoSaveEnabled
                                  ? 'text-green-600 dark:text-green-400'
                                  : 'text-gray-500 dark:text-gray-400'
                              }`}>
                                {isAutoSaveEnabled ? (
                                  <span className="flex items-center gap-1">
                                    {isAutoSaving ? (
                                      <>
                                        <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                        </svg>
                                        <span className="hidden sm:inline">Auto-saving...</span>
                                        <span className="sm:hidden">Saving</span>
                                      </>
                                    ) : (
                                      <>
                                        <span className="hidden sm:inline">Auto Save ON</span>
                                        <span className="sm:hidden">Auto ON</span>
                                      </>
                                    )}
                                  </span>
                                ) : (
                                  <>
                                    <span className="hidden sm:inline">Auto Save OFF</span>
                                    <span className="sm:hidden">Auto OFF</span>
                                  </>
                                )}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            {/* Last saved timestamp */}
                            {lastSavedAt && (
                              <span className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
                                <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                                Last saved: {lastSavedAt.toLocaleTimeString()}
                              </span>
                            )}

                            {/* Unsaved changes indicator */}
                            {hasUnsavedChanges && !saveProgressLoading && (
                              <span className="text-sm text-amber-600 dark:text-amber-400 flex items-center gap-1">
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                                Unsaved changes
                              </span>
                            )}

                            {/* Draft status */}
                            {incidentId && !incidentReportSubmitted && (
                              <span className="text-sm text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30 px-2 py-1 rounded">
                                Draft
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Tab Navigation */}
                        <div className="flex overflow-x-auto border-b border-amber-300 dark:border-amber-700">
                          <button
                            type="button"
                            onClick={() => setWorkplaceSafetyTab('incident-report')}
                            className={`px-3 sm:px-6 py-2 sm:py-3 text-xs sm:text-sm font-medium transition-colors relative whitespace-nowrap touch-manipulation ${
                              workplaceSafetyTab === 'incident-report'
                                ? 'text-amber-700 dark:text-amber-400 border-b-2 border-amber-600 dark:border-amber-400 -mb-px bg-white/50 dark:bg-slate-800/50'
                                : 'text-gray-500 dark:text-gray-400 hover:text-amber-600 dark:hover:text-amber-300'
                            }`}
                          >
                            📝 <span className="hidden sm:inline">Incident Report</span><span className="sm:hidden">Report</span>
                            {incidentReportSubmitted && (
                              <span className="ml-1 sm:ml-2 inline-flex items-center px-1.5 sm:px-2 py-0.5 rounded text-[10px] sm:text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
                                ✓ <span className="hidden sm:inline">Submitted</span>
                              </span>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => setWorkplaceSafetyTab('investigation')}
                            className={`px-3 sm:px-6 py-2 sm:py-3 text-xs sm:text-sm font-medium transition-colors relative whitespace-nowrap touch-manipulation ${
                              workplaceSafetyTab === 'investigation'
                                ? 'text-amber-700 dark:text-amber-400 border-b-2 border-amber-600 dark:border-amber-400 -mb-px bg-white/50 dark:bg-slate-800/50'
                                : 'text-gray-500 dark:text-gray-400 hover:text-amber-600 dark:hover:text-amber-300'
                            }`}
                          >
                            🔍 <span className="hidden sm:inline">Incident Investigation (Leader/Supervisor)</span><span className="sm:hidden">Investigation</span>
                            {investigationSubmitted && (
                              <span className="ml-1 sm:ml-2 inline-flex items-center px-1.5 sm:px-2 py-0.5 rounded text-[10px] sm:text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
                                ✓ <span className="hidden sm:inline">Submitted</span>
                              </span>
                            )}
                          </button>
                        </div>

                        {/* ===== TAB 1: INCIDENT REPORT with internal pagination ===== */}
                        {workplaceSafetyTab === 'incident-report' && (
                          <>
                        {/* Progress Bar for Incident Report */}
                        <div className="space-y-2 sm:space-y-3 mt-3 sm:mt-4">
                          <div className="flex items-center justify-between text-xs sm:text-sm">
                            <span className="font-medium text-amber-700 dark:text-amber-400">
                              Step {incidentReportStep} of {INCIDENT_REPORT_STEPS.length}: <span className="hidden sm:inline">{INCIDENT_REPORT_STEPS[incidentReportStep - 1]?.name}</span>
                            </span>
                            <span className="text-gray-500 dark:text-gray-400">
                              {Math.round((incidentReportStep / INCIDENT_REPORT_STEPS.length) * 100)}% Complete
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-1.5 sm:h-2">
                            <div
                              className="bg-gradient-to-r from-amber-500 to-orange-500 h-1.5 sm:h-2 rounded-full transition-all duration-500"
                              style={{ width: `${(incidentReportStep / INCIDENT_REPORT_STEPS.length) * 100}%` }}
                            />
                          </div>
                          {/* Step Indicators */}
                          <div className="flex justify-between overflow-x-auto gap-1 sm:gap-0 pb-1 sm:pb-0">
                            {INCIDENT_REPORT_STEPS.map((stepItem) => (
                              <button
                                key={stepItem.id}
                                type="button"
                                onClick={() => setIncidentReportStep(stepItem.id)}
                                className={`flex items-center gap-0.5 sm:gap-1 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-[10px] sm:text-xs transition-all whitespace-nowrap touch-manipulation ${
                                  incidentReportStep === stepItem.id
                                    ? 'bg-amber-600 text-white'
                                    : incidentReportStep > stepItem.id
                                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                    : 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-400'
                                }`}
                              >
                                <span>{stepItem.icon}</span>
                                <span className="hidden sm:inline">{stepItem.name}</span>
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Step 1: Incident Context */}
                        {incidentReportStep === 1 && (
                        <div className="space-y-3 sm:space-y-4">
                          {/* Data Entry Requirements Notice */}
                          <div className="p-2 sm:p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg">
                            <p className="text-xs sm:text-sm text-blue-700 dark:text-blue-300 flex items-start gap-1.5 sm:gap-2">
                              <span className="text-base sm:text-lg">ℹ️</span>
                              <span><strong>Data Entry Requirements:</strong> All fields must be completed. For text fields that are not applicable, check the <strong>N/A checkbox</strong> beside the field label to mark it as not applicable. For dropdowns, select the <strong>&quot;N/A&quot;</strong> option. AI validation is available at the final step to review your entries.</span>
                            </p>
                          </div>

                          <h4 className="text-sm sm:text-md font-medium text-gray-800 dark:text-gray-200 border-b border-amber-300 dark:border-amber-700 pb-2">
                            📋 Incident Context
                          </h4>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                            <div>
                              <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
                                Injury Type *
                              </label>
                              <select
                                value={formData.injuryType}
                                onChange={(e) => setFormData({ ...formData, injuryType: e.target.value as any })}
                                required
                                className="w-full px-3 sm:px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 text-sm"
                              >
                                <option value="">Select injury type</option>
                                {addNAOption(dropdownOptions.INJURY_TYPE).map(option => (
                                  <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <div className="flex items-center mb-1.5 sm:mb-2">
                                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">
                                  Task Being Performed
                                </label>
                                <NACheckbox
                                  fieldName="taskBeingPerformed"
                                  checked={isFieldNA(formData.taskBeingPerformed)}
                                  onChange={(checked) => toggleFieldNA('taskBeingPerformed', formData.taskBeingPerformed)}
                                />
                              </div>
                              <input
                                type="text"
                                value={formData.taskBeingPerformed}
                                onChange={(e) => setFormData({ ...formData, taskBeingPerformed: e.target.value })}
                                placeholder="e.g., Loading pallets, Operating forklift"
                                disabled={isFieldNA(formData.taskBeingPerformed)}
                                className={`w-full px-3 sm:px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 text-sm ${isFieldNA(formData.taskBeingPerformed) ? 'opacity-60 cursor-not-allowed bg-gray-100 dark:bg-slate-600' : ''}`}
                              />
                            </div>
                          </div>

                          <div>
                            <div className="flex items-center gap-2 sm:gap-3 mb-1.5 sm:mb-2">
                              <label className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">
                                Body Part(s) Affected
                              </label>
                              <label className="flex items-center gap-1 sm:gap-1.5 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={formData.bodyPartsAffectedNA}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setFormData({ ...formData, bodyPartsAffectedNA: true, bodyPartsAffected: [], otherBodyPartDetail: '' });
                                    } else {
                                      setFormData({ ...formData, bodyPartsAffectedNA: false });
                                    }
                                  }}
                                  className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                                />
                                <span className="text-[10px] sm:text-xs font-medium text-gray-500 dark:text-gray-400">N/A</span>
                              </label>
                            </div>
                            <div className={`grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-2 ${formData.bodyPartsAffectedNA ? 'opacity-50' : ''}`}>
                              {(dropdownOptions.BODY_PART || []).map((option) => (
                                <label key={option.id} className={`flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm ${formData.bodyPartsAffectedNA ? 'cursor-not-allowed' : ''}`}>
                                  <input
                                    type="checkbox"
                                    checked={formData.bodyPartsAffected.includes(option.value)}
                                    disabled={formData.bodyPartsAffectedNA}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setFormData({ ...formData, bodyPartsAffected: [...formData.bodyPartsAffected, option.value] });
                                      } else {
                                        // Clear the other detail field if OTHER is unchecked
                                        const updates: any = { bodyPartsAffected: formData.bodyPartsAffected.filter(p => p !== option.value) };
                                        if (option.value === 'OTHER') {
                                          updates.otherBodyPartDetail = '';
                                        }
                                        setFormData({ ...formData, ...updates });
                                      }
                                    }}
                                    className={`rounded border-gray-300 text-primary-600 focus:ring-primary-500 ${formData.bodyPartsAffectedNA ? 'cursor-not-allowed' : ''}`}
                                  />
                                  <span className="text-gray-700 dark:text-gray-300">{option.label}</span>
                                </label>
                              ))}
                            </div>
                            {/* Show "Other body part" detail field when OTHER is selected */}
                            {formData.bodyPartsAffected.includes('OTHER') && !formData.bodyPartsAffectedNA && (
                              <div className="mt-3">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                  Please specify the other body part(s) affected
                                </label>
                                <input
                                  type="text"
                                  value={formData.otherBodyPartDetail}
                                  onChange={(e) => setFormData({ ...formData, otherBodyPartDetail: e.target.value })}
                                  placeholder="e.g., Groin, Internal organs, Multiple areas"
                                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                                />
                              </div>
                            )}
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Normal vs Non-Routine Task
                              </label>
                              <select
                                value={formData.taskRoutineType}
                                onChange={(e) => setFormData({ ...formData, taskRoutineType: e.target.value })}
                                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                              >
                                <option value="">Select</option>
                                {addNAOption(dropdownOptions.TASK_ROUTINE_TYPE).map((option: DropdownOption) => (
                                  <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                              </select>
                            </div>
                          </div>

                          {/* Step 1 Navigation */}
                          <div className="flex justify-end pt-4 border-t border-amber-200 dark:border-amber-800">
                            <button
                              type="button"
                              onClick={() => setIncidentReportStep(2)}
                              className="px-6 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-all flex items-center gap-2 shadow-md hover:shadow-lg"
                            >
                              Next: Exposure & Risk
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </button>
                          </div>
                        </div>
                        )}

                        {/* Step 2: Exposure & Risk Factors */}
                        {incidentReportStep === 2 && (
                        <div className="space-y-3 sm:space-y-4">
                          <h4 className="text-sm sm:text-md font-medium text-gray-800 dark:text-gray-200 border-b border-amber-300 dark:border-amber-700 pb-2">
                            ⚠️ Exposure & Risk Factors
                          </h4>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                            <div>
                              <div className="flex items-center mb-1.5 sm:mb-2">
                                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">
                                  Duration of Exposure
                                </label>
                                <NACheckbox
                                  fieldName="exposureDuration"
                                  checked={isFieldNA(formData.exposureDuration)}
                                  onChange={(checked) => toggleFieldNA('exposureDuration', formData.exposureDuration)}
                                />
                              </div>
                              <input
                                type="text"
                                value={formData.exposureDuration}
                                onChange={(e) => setFormData({ ...formData, exposureDuration: e.target.value })}
                                placeholder="e.g., 2 hours, 30 minutes"
                                disabled={isFieldNA(formData.exposureDuration)}
                                className={`w-full px-3 sm:px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 text-sm ${isFieldNA(formData.exposureDuration) ? 'opacity-60 cursor-not-allowed bg-gray-100 dark:bg-slate-600' : ''}`}
                              />
                            </div>

                            <div>
                              <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
                                Frequency of Task
                              </label>
                              <select
                                value={formData.taskFrequency}
                                onChange={(e) => setFormData({ ...formData, taskFrequency: e.target.value })}
                                className="w-full px-3 sm:px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 text-sm"
                              >
                                <option value="">Select frequency</option>
                                {addNAOption(dropdownOptions.TASK_FREQUENCY).map((option) => (
                                  <option key={option.id || option.value} value={option.value}>{option.label}</option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <div className="flex items-center mb-1.5 sm:mb-2">
                                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">
                                  Weight / Force <span className="hidden sm:inline">(if applicable)</span>
                                </label>
                                <NACheckbox
                                  fieldName="weightOrForce"
                                  checked={isFieldNA(formData.weightOrForce)}
                                  onChange={(checked) => toggleFieldNA('weightOrForce', formData.weightOrForce)}
                                />
                              </div>
                              <input
                                type="text"
                                value={formData.weightOrForce}
                                onChange={(e) => setFormData({ ...formData, weightOrForce: e.target.value })}
                                placeholder="e.g., 50 lbs"
                                disabled={isFieldNA(formData.weightOrForce)}
                                className={`w-full px-3 sm:px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 text-sm ${isFieldNA(formData.weightOrForce) ? 'opacity-60 cursor-not-allowed bg-gray-100 dark:bg-slate-600' : ''}`}
                              />
                            </div>
                          </div>

                          <div>
                            <div className="flex items-center gap-2 sm:gap-3 mb-1.5 sm:mb-2">
                              <label className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">
                                Environmental Conditions
                              </label>
                              <label className="flex items-center gap-1 sm:gap-1.5 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={formData.environmentalConditionsNA}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setFormData({ ...formData, environmentalConditionsNA: true, environmentalConditions: [] });
                                    } else {
                                      setFormData({ ...formData, environmentalConditionsNA: false });
                                    }
                                  }}
                                  className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                                />
                                <span className="text-[10px] sm:text-xs font-medium text-gray-500 dark:text-gray-400">N/A</span>
                              </label>
                            </div>
                            <div className={`grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-2 ${formData.environmentalConditionsNA ? 'opacity-50' : ''}`}>
                              {(dropdownOptions.ENVIRONMENTAL_CONDITION || []).map((option) => (
                                <label key={option.id} className={`flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm ${formData.environmentalConditionsNA ? 'cursor-not-allowed' : ''}`}>
                                  <input
                                    type="checkbox"
                                    checked={formData.environmentalConditions.includes(option.value)}
                                    disabled={formData.environmentalConditionsNA}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setFormData({ ...formData, environmentalConditions: [...formData.environmentalConditions, option.value] });
                                      } else {
                                        setFormData({ ...formData, environmentalConditions: formData.environmentalConditions.filter(c => c !== option.value) });
                                      }
                                    }}
                                    className={`rounded border-gray-300 text-primary-600 focus:ring-primary-500 ${formData.environmentalConditionsNA ? 'cursor-not-allowed' : ''}`}
                                  />
                                  <span className="text-gray-700 dark:text-gray-300">{option.label}</span>
                                </label>
                              ))}
                            </div>
                          </div>

                          {/* Step 2 Navigation */}
                          <div className="flex justify-between pt-3 sm:pt-4 border-t border-amber-200 dark:border-amber-800">
                            <button
                              type="button"
                              onClick={() => setIncidentReportStep(1)}
                              className="px-3 sm:px-6 py-2 bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-slate-600 transition-all flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm touch-manipulation"
                            >
                              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                              </svg>
                              <span className="hidden sm:inline">Back: Incident Context</span><span className="sm:hidden">Back</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setIncidentReportStep(3)}
                              className="px-3 sm:px-6 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-all flex items-center gap-1.5 sm:gap-2 shadow-md hover:shadow-lg text-xs sm:text-sm touch-manipulation"
                            >
                              <span className="hidden sm:inline">Next: Contributing Factors</span><span className="sm:hidden">Next</span>
                              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </button>
                          </div>
                        </div>
                        )}

                        {/* Step 3: Contributing Factors (Controls & Compliance) */}
                        {incidentReportStep === 3 && (
                        <>
                        <div className="space-y-3 sm:space-y-4">
                          <h4 className="text-sm sm:text-md font-medium text-gray-800 dark:text-gray-200 border-b border-amber-300 dark:border-amber-700 pb-2">
                            🔍 Controls & Compliance
                          </h4>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                            <div>
                              <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
                                PPE Required?
                              </label>
                              <select
                                value={formData.ppeRequired === null ? '' : formData.ppeRequired ? 'true' : 'false'}
                                onChange={(e) => {
                                  const newValue = e.target.value === '' ? null : e.target.value === 'true';
                                  // If PPE is not required, clear PPE Worn value
                                  if (newValue === false) {
                                    setFormData({ ...formData, ppeRequired: newValue, ppeWorn: null });
                                  } else {
                                    setFormData({ ...formData, ppeRequired: newValue });
                                  }
                                }}
                                className="w-full px-3 sm:px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 text-sm"
                              >
                                <option value="">Select</option>
                                <option value="true">Yes</option>
                                <option value="false">No</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
                                PPE Worn?
                              </label>
                              <select
                                value={formData.ppeWorn === null ? '' : formData.ppeWorn ? 'true' : 'false'}
                                onChange={(e) => setFormData({ ...formData, ppeWorn: e.target.value === '' ? null : e.target.value === 'true' })}
                                disabled={formData.ppeRequired === false}
                                className={`w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 ${formData.ppeRequired === false ? 'opacity-50 cursor-not-allowed' : ''}`}
                              >
                                <option value="">Select</option>
                                <option value="true">Yes</option>
                                <option value="false">No</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
                                Machine Safeguards in Place?
                              </label>
                              <select
                                value={formData.machineSafeguardsInPlace}
                                onChange={(e) => setFormData({ ...formData, machineSafeguardsInPlace: e.target.value as any })}
                                className="w-full px-3 sm:px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 text-sm"
                              >
                                <option value="">Select</option>
                                <option value="YES">Yes</option>
                                <option value="NO">No</option>
                                <option value="NA">N/A</option>
                              </select>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                            <div>
                              <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
                                LOTO Required?
                              </label>
                              <select
                                value={formData.lotoRequired}
                                onChange={(e) => setFormData({ ...formData, lotoRequired: e.target.value as any })}
                                className="w-full px-3 sm:px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 text-sm"
                              >
                                <option value="">Select</option>
                                <option value="YES">Yes</option>
                                <option value="NO">No</option>
                                <option value="NA">N/A</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
                                SOP Available?
                              </label>
                              <select
                                value={formData.sopAvailable === null ? '' : formData.sopAvailable ? 'true' : 'false'}
                                onChange={(e) => {
                                  const newValue = e.target.value === '' ? null : e.target.value === 'true';
                                  // If SOP is not available, clear SOP Followed value
                                  if (newValue === false) {
                                    setFormData({ ...formData, sopAvailable: newValue, sopFollowed: null });
                                  } else {
                                    setFormData({ ...formData, sopAvailable: newValue });
                                  }
                                }}
                                className="w-full px-3 sm:px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 text-sm"
                              >
                                <option value="">Select</option>
                                <option value="true">Yes</option>
                                <option value="false">No</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
                                SOP Followed?
                              </label>
                              <select
                                value={formData.sopFollowed === null ? '' : formData.sopFollowed ? 'true' : 'false'}
                                onChange={(e) => setFormData({ ...formData, sopFollowed: e.target.value === '' ? null : e.target.value === 'true' })}
                                disabled={formData.sopAvailable === false}
                                className={`w-full px-3 sm:px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 text-sm ${formData.sopAvailable === false ? 'opacity-50 cursor-not-allowed' : ''}`}
                              >
                                <option value="">Select</option>
                                <option value="true">Yes</option>
                                <option value="false">No</option>
                              </select>
                            </div>
                          </div>
                        </div>

                        {/* Immediate Actions Section */}
                        <div className="space-y-3 sm:space-y-4">
                          <h4 className="text-sm sm:text-md font-medium text-gray-800 dark:text-gray-200 border-b border-amber-300 dark:border-amber-700 pb-2">
                            Immediate Actions
                          </h4>

                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                            <div>
                              <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
                                First Aid Provided?
                              </label>
                              <select
                                value={formData.firstAidProvided === null ? '' : formData.firstAidProvided ? 'true' : 'false'}
                                onChange={(e) => setFormData({ ...formData, firstAidProvided: e.target.value === '' ? null : e.target.value === 'true' })}
                                className="w-full px-3 sm:px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 text-sm"
                              >
                                <option value="">Select</option>
                                <option value="true">Yes</option>
                                <option value="false">No</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
                                Medical Treatment Required?
                              </label>
                              <select
                                value={formData.medicalTreatmentRequired === null ? '' : formData.medicalTreatmentRequired ? 'true' : 'false'}
                                onChange={(e) => setFormData({ ...formData, medicalTreatmentRequired: e.target.value === '' ? null : e.target.value === 'true' })}
                                className="w-full px-3 sm:px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 text-sm"
                              >
                                <option value="">Select</option>
                                <option value="true">Yes</option>
                                <option value="false">No</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
                                Supervisor Notified?
                              </label>
                              <select
                                value={formData.supervisorNotified === null ? '' : formData.supervisorNotified ? 'true' : 'false'}
                                onChange={(e) => setFormData({ ...formData, supervisorNotified: e.target.value === '' ? null : e.target.value === 'true' })}
                                className="w-full px-3 sm:px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 text-sm"
                              >
                                <option value="">Select</option>
                                <option value="true">Yes</option>
                                <option value="false">No</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
                                Area Secured?
                              </label>
                              <select
                                value={formData.areaSecured}
                                onChange={(e) => setFormData({ ...formData, areaSecured: e.target.value as any })}
                                className="w-full px-3 sm:px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 text-sm"
                              >
                                <option value="">Select</option>
                                <option value="YES">Yes</option>
                                <option value="NO">No</option>
                                <option value="NA">N/A</option>
                              </select>
                            </div>
                          </div>
                        </div>

                        {/* RCA Enablement Section */}
                        <div className="space-y-3 sm:space-y-4">
                          <h4 className="text-sm sm:text-md font-medium text-gray-800 dark:text-gray-200 border-b border-amber-300 dark:border-amber-700 pb-2">
                            RCA Enablement
                          </h4>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                            <div>
                              <div className="flex items-center mb-1.5 sm:mb-2">
                                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">
                                  Direct Cause
                                </label>
                                <NACheckbox
                                  fieldName="directCause"
                                  checked={isFieldNA(formData.directCause)}
                                  onChange={(checked) => toggleFieldNA('directCause', formData.directCause)}
                                />
                              </div>
                              <input
                                type="text"
                                value={formData.directCause}
                                onChange={(e) => setFormData({ ...formData, directCause: e.target.value })}
                                placeholder="What directly caused the incident?"
                                disabled={isFieldNA(formData.directCause)}
                                className={`w-full px-3 sm:px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 text-sm ${isFieldNA(formData.directCause) ? 'opacity-60 cursor-not-allowed bg-gray-100 dark:bg-slate-600' : ''}`}
                              />
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Unsafe Act vs Unsafe Condition
                              </label>
                              <select
                                value={formData.unsafeActOrCondition}
                                onChange={(e) => setFormData({ ...formData, unsafeActOrCondition: e.target.value as any })}
                                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                              >
                                <option value="">Select</option>
                                {addNAOption(dropdownOptions.UNSAFE_ACT_CONDITION).map((option) => (
                                  <option key={option.id || option.value} value={option.value}>{option.label}</option>
                                ))}
                              </select>
                            </div>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              Previous Similar Incidents?
                            </label>
                            <select
                              value={formData.previousSimilarIncidents === null ? '' : formData.previousSimilarIncidents ? 'true' : 'false'}
                              onChange={(e) => setFormData({ ...formData, previousSimilarIncidents: e.target.value === '' ? null : e.target.value === 'true' })}
                              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                            >
                              <option value="">Select</option>
                              <option value="true">Yes</option>
                              <option value="false">No</option>
                            </select>
                          </div>

                          {/* Step 3 Navigation */}
                          <div className="flex justify-between pt-4 border-t border-amber-200 dark:border-amber-800">
                            <button
                              type="button"
                              onClick={() => setIncidentReportStep(2)}
                              className="px-6 py-2 bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-slate-600 transition-all flex items-center gap-2"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                              </svg>
                              Back: Exposure & Risk
                            </button>
                            <button
                              type="button"
                              onClick={() => setIncidentReportStep(4)}
                              className="px-6 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-all flex items-center gap-2 shadow-md hover:shadow-lg"
                            >
                              Next: Regulatory Info
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </button>
                          </div>
                        </div>
                        </>
                        )}

                        {/* Incident Report Step 4: Regulatory Information */}
                        {incidentReportStep === 4 && (
                        <>
                        <div className="space-y-3 sm:space-y-4 mt-2">
                          <h4 className="text-sm sm:text-md font-medium text-gray-800 dark:text-gray-200 border-b border-amber-300 dark:border-amber-700 pb-2 flex items-center gap-2">
                            <span>📑</span> <span className="hidden sm:inline">Regulatory & Workers' Compensation Information</span><span className="sm:hidden">Regulatory & Workers' Comp</span>
                          </h4>
                          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 italic">
                            The following fields are required for OSHA compliance and workers' compensation reporting.
                          </p>

                          {/* Injury Date & Time Details */}
                          <div className="space-y-3 sm:space-y-4 p-3 sm:p-4 bg-white/50 dark:bg-slate-800/50 rounded-lg border border-amber-100 dark:border-amber-900">
                            <h5 className="text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300">Injury Date & Time</h5>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                              <div>
                                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
                                  Did the injury develop over time or occur on a specific date?
                                </label>
                                <select
                                  value={formData.injuryDevelopmentType}
                                  onChange={(e) => setFormData({ ...formData, injuryDevelopmentType: e.target.value })}
                                  className="w-full px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                                >
                                  <option value="">Select</option>
                                  {(dropdownOptions.INJURY_DEVELOPMENT || []).map((option) => (
                                    <option key={option.id} value={option.value}>{option.label}</option>
                                  ))}
                                </select>
                              </div>

                              <div>
                                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
                                  Date of Injury
                                </label>
                                <input
                                  type="date"
                                  value={formData.dateOfInjury}
                                  onChange={(e) => setFormData({ ...formData, dateOfInjury: e.target.value })}
                                  className="w-full px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                              <div>
                                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
                                  Time of Injury (AM/PM)
                                </label>
                                <input
                                  type="time"
                                  value={formData.timeOfInjury}
                                  onChange={(e) => setFormData({ ...formData, timeOfInjury: e.target.value })}
                                  className="w-full px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                                />
                              </div>

                              <div>
                                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
                                  Date injury was first known to be work-related
                                </label>
                                <input
                                  type="date"
                                  value={formData.dateInjuryKnownWorkRelated}
                                  onChange={(e) => setFormData({ ...formData, dateInjuryKnownWorkRelated: e.target.value })}
                                  className="w-full px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                                />
                              </div>
                            </div>
                          </div>

                          {/* Injury Location & Witness Information */}
                          <div className="space-y-3 sm:space-y-4 p-3 sm:p-4 bg-white/50 dark:bg-slate-800/50 rounded-lg border border-amber-100 dark:border-amber-900">
                            <h5 className="text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300">Injury Location & Witnesses</h5>

                            <div>
                              <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
                                Where did the injury occur? (Be specific to location)
                              </label>
                              <input
                                type="text"
                                value={formData.injuryLocation}
                                onChange={(e) => setFormData({ ...formData, injuryLocation: e.target.value })}
                                placeholder="e.g., Line 3 packaging area, near conveyor belt B2"
                                className="w-full px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                              />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                              <div>
                                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
                                  Was injury caused by or made worse by work activity?
                                </label>
                                <select
                                  value={formData.injuryCausedByWork}
                                  onChange={(e) => setFormData({ ...formData, injuryCausedByWork: e.target.value as any })}
                                  className="w-full px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                                >
                                  <option value="">Select</option>
                                  <option value="YES">Yes - Directly caused by work</option>
                                  <option value="NO">No - Not work related</option>
                                  <option value="UNCERTAIN">Uncertain - Under investigation</option>
                                  <option value="NA">N/A</option>
                                </select>
                              </div>

                              <div>
                                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
                                  Was the injury witnessed by anyone?
                                </label>
                                <select
                                  value={formData.injuryWitnessed === null ? '' : formData.injuryWitnessed ? 'true' : 'false'}
                                  onChange={(e) => setFormData({ ...formData, injuryWitnessed: e.target.value === '' ? null : e.target.value === 'true' })}
                                  className="w-full px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                                >
                                  <option value="">Select</option>
                                  <option value="true">Yes</option>
                                  <option value="false">No</option>
                                </select>
                              </div>
                            </div>

                            {formData.injuryWitnessed && (
                              <div>
                                <div className="flex items-center mb-1.5 sm:mb-2">
                                  <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Name(s) of witness(es)
                                  </label>
                                  <NACheckbox
                                    fieldName="witnessNames"
                                    checked={isFieldNA(formData.witnessNames)}
                                    onChange={(checked) => toggleFieldNA('witnessNames', formData.witnessNames)}
                                  />
                                </div>
                                <input
                                  type="text"
                                  value={formData.witnessNames}
                                  onChange={(e) => setFormData({ ...formData, witnessNames: e.target.value })}
                                  placeholder="Enter witness names"
                                  disabled={isFieldNA(formData.witnessNames)}
                                  className={`w-full px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 ${isFieldNA(formData.witnessNames) ? 'opacity-60 cursor-not-allowed bg-gray-100 dark:bg-slate-600' : ''}`}
                                />
                              </div>
                            )}
                          </div>

                          {/* Injury Description */}
                          <div className="space-y-3 sm:space-y-4 p-3 sm:p-4 bg-white/50 dark:bg-slate-800/50 rounded-lg border border-amber-100 dark:border-amber-900">
                            <h5 className="text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300">Injury Details</h5>

                            <div>
                              <div className="flex items-center mb-1.5 sm:mb-2">
                                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">
                                  List ALL body parts injured
                                </label>
                                <NACheckbox
                                  fieldName="allBodyPartsInjured"
                                  checked={isFieldNA(formData.allBodyPartsInjured)}
                                  onChange={(checked) => toggleFieldNA('allBodyPartsInjured', formData.allBodyPartsInjured)}
                                />
                              </div>
                              <textarea
                                value={formData.allBodyPartsInjured}
                                onChange={(e) => setFormData({ ...formData, allBodyPartsInjured: e.target.value })}
                                rows={2}
                                placeholder="e.g., Right wrist, lower back, left knee"
                                disabled={isFieldNA(formData.allBodyPartsInjured)}
                                className={`w-full px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 ${isFieldNA(formData.allBodyPartsInjured) ? 'opacity-60 cursor-not-allowed bg-gray-100 dark:bg-slate-600' : ''}`}
                              />
                            </div>

                            <div>
                              <div className="flex items-center justify-between mb-1.5 sm:mb-2">
                                <div className="flex items-center">
                                  <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Describe how the injury occurred
                                  </label>
                                  <NACheckbox
                                    fieldName="injuryDescriptionDetailed"
                                    checked={isFieldNA(formData.injuryDescriptionDetailed)}
                                    onChange={(checked) => toggleFieldNA('injuryDescriptionDetailed', formData.injuryDescriptionDetailed)}
                                  />
                                </div>
                                <AIEnhanceButton
                                  onClick={() => enhanceText('injuryDescriptionDetailed', 'Injury Description')}
                                  isLoading={enhancingField === 'injuryDescriptionDetailed'}
                                  show={formData.type === 'WORKPLACE_SAFETY' && formData.injuryDescriptionDetailed.trim().length >= 5 && !isFieldNA(formData.injuryDescriptionDetailed)}
                                />
                              </div>
                              <textarea
                                value={formData.injuryDescriptionDetailed}
                                onChange={(e) => setFormData({ ...formData, injuryDescriptionDetailed: e.target.value })}
                                rows={3}
                                placeholder="Describe in detail what happened and how the injury occurred"
                                disabled={isFieldNA(formData.injuryDescriptionDetailed)}
                                className={`w-full px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 ${isFieldNA(formData.injuryDescriptionDetailed) ? 'opacity-60 cursor-not-allowed bg-gray-100 dark:bg-slate-600' : ''}`}
                              />
                            </div>

                            <div>
                              <div className="flex items-center justify-between mb-1.5 sm:mb-2">
                                <div className="flex items-center">
                                  <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">
                                    What acts or conditions contributed to this injury?
                                  </label>
                                  <NACheckbox
                                    fieldName="contributingActsConditions"
                                    checked={isFieldNA(formData.contributingActsConditions)}
                                    onChange={(checked) => toggleFieldNA('contributingActsConditions', formData.contributingActsConditions)}
                                  />
                                </div>
                                <AIEnhanceButton
                                  onClick={() => enhanceText('contributingActsConditions', 'Contributing Acts/Conditions')}
                                  isLoading={enhancingField === 'contributingActsConditions'}
                                  show={formData.type === 'WORKPLACE_SAFETY' && formData.contributingActsConditions.trim().length >= 5 && !isFieldNA(formData.contributingActsConditions)}
                                />
                              </div>
                              <textarea
                                value={formData.contributingActsConditions}
                                onChange={(e) => setFormData({ ...formData, contributingActsConditions: e.target.value })}
                                rows={2}
                                placeholder="e.g., Wet floor, equipment malfunction"
                                disabled={isFieldNA(formData.contributingActsConditions)}
                                className={`w-full px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 ${isFieldNA(formData.contributingActsConditions) ? 'opacity-60 cursor-not-allowed bg-gray-100 dark:bg-slate-600' : ''}`}
                              />
                            </div>
                          </div>

                          {/* Step 4 Navigation */}
                          <div className="flex justify-between pt-3 sm:pt-4 border-t border-amber-200 dark:border-amber-800">
                            <button
                              type="button"
                              onClick={() => setIncidentReportStep(3)}
                              className="px-3 sm:px-6 py-1.5 sm:py-2 text-xs sm:text-sm bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-slate-600 transition-all flex items-center gap-1 sm:gap-2 touch-manipulation"
                            >
                              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                              </svg>
                              <span className="hidden sm:inline">Back: Contributing Factors</span><span className="sm:hidden">Back</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setIncidentReportStep(5)}
                              className="px-3 sm:px-6 py-1.5 sm:py-2 text-xs sm:text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-all flex items-center gap-1 sm:gap-2 shadow-md hover:shadow-lg touch-manipulation"
                            >
                              <span className="hidden sm:inline">Next: Employment Details</span><span className="sm:hidden">Next</span>
                              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </button>
                          </div>
                        </div>
                        </>
                        )}

                        {/* Incident Report Step 5: Employment Details */}
                        {incidentReportStep === 5 && (
                        <>
                        <div className="space-y-3 sm:space-y-4 mt-2">
                          <h4 className="text-sm sm:text-md font-medium text-gray-800 dark:text-gray-200 border-b border-amber-300 dark:border-amber-700 pb-2 flex items-center gap-2">
                            <span>👔</span> Employment & Medical Details
                          </h4>

                          {/* Employee Personal Information */}
                          <div className="space-y-3 sm:space-y-4 p-3 sm:p-4 bg-white/50 dark:bg-slate-800/50 rounded-lg border border-amber-100 dark:border-amber-900">
                            <h5 className="text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300">Employee Personal Information</h5>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                              <div>
                                <div className="flex items-center mb-1.5 sm:mb-2">
                                  <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Last 4 Digits of SSN
                                  </label>
                                  <NACheckbox
                                    fieldName="employeeLastSSN4"
                                    checked={isFieldNA(formData.employeeLastSSN4)}
                                    onChange={(checked) => toggleFieldNA('employeeLastSSN4', formData.employeeLastSSN4)}
                                  />
                                </div>
                                <input
                                  type="text"
                                  maxLength={4}
                                  value={formData.employeeLastSSN4}
                                  onChange={(e) => setFormData({ ...formData, employeeLastSSN4: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                                  placeholder="e.g., 1234"
                                  disabled={isFieldNA(formData.employeeLastSSN4)}
                                  className={`w-full px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 ${isFieldNA(formData.employeeLastSSN4) ? 'opacity-60 cursor-not-allowed bg-gray-100 dark:bg-slate-600' : ''}`}
                                />
                              </div>

                              <div>
                                <div className="flex items-center mb-1.5 sm:mb-2">
                                  <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Employee Email
                                  </label>
                                  <NACheckbox
                                    fieldName="employeeEmail"
                                    checked={isFieldNA(formData.employeeEmail)}
                                    onChange={(checked) => toggleFieldNA('employeeEmail', formData.employeeEmail)}
                                  />
                                </div>
                                <input
                                  type="email"
                                  value={formData.employeeEmail}
                                  onChange={(e) => setFormData({ ...formData, employeeEmail: e.target.value })}
                                  placeholder="employee@company.com"
                                  disabled={isFieldNA(formData.employeeEmail)}
                                  className={`w-full px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 ${isFieldNA(formData.employeeEmail) ? 'opacity-60 cursor-not-allowed bg-gray-100 dark:bg-slate-600' : ''}`}
                                />
                              </div>

                              <div>
                                <div className="flex items-center mb-1.5 sm:mb-2">
                                  <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Current Phone #
                                  </label>
                                  <NACheckbox
                                    fieldName="employeePhone"
                                    checked={isFieldNA(formData.employeePhone)}
                                    onChange={(checked) => toggleFieldNA('employeePhone', formData.employeePhone)}
                                  />
                                </div>
                                <input
                                  type="tel"
                                  value={formData.employeePhone}
                                  onChange={handlePhoneChange}
                                  placeholder="(555) 123-4567"
                                  disabled={isFieldNA(formData.employeePhone)}
                                  className={`w-full px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 ${isFieldNA(formData.employeePhone) ? 'opacity-60 cursor-not-allowed bg-gray-100 dark:bg-slate-600' : ''}`}
                                />
                                <p className="mt-1 text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">
                                  USA/Canada: (XXX) XXX-XXXX
                                </p>
                              </div>
                            </div>

                            <div>
                              <div className="flex items-center mb-1.5 sm:mb-2">
                                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">
                                  Home Address
                                </label>
                                <NACheckbox
                                  fieldName="employeeHomeAddress"
                                  checked={isFieldNA(formData.employeeHomeAddress)}
                                  onChange={(checked) => toggleFieldNA('employeeHomeAddress', formData.employeeHomeAddress)}
                                />
                              </div>
                              <input
                                type="text"
                                value={formData.employeeHomeAddress}
                                onChange={(e) => setFormData({ ...formData, employeeHomeAddress: e.target.value })}
                                placeholder="Full home address"
                                disabled={isFieldNA(formData.employeeHomeAddress)}
                                className={`w-full px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 ${isFieldNA(formData.employeeHomeAddress) ? 'opacity-60 cursor-not-allowed bg-gray-100 dark:bg-slate-600' : ''}`}
                              />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                              <div>
                                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
                                  Language Primarily Spoken
                                </label>
                                <select
                                  value={formData.employeeLanguage}
                                  onChange={(e) => setFormData({ ...formData, employeeLanguage: e.target.value })}
                                  className="w-full px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                                >
                                  <option value="">Select language</option>
                                  {(dropdownOptions.EMPLOYEE_LANGUAGE || []).map((option: any) => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                  ))}
                                  <option value="N/A">N/A</option>
                                </select>
                              </div>

                              <div>
                                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
                                  Gender (Optional)
                                </label>
                                <select
                                  value={formData.employeeGender}
                                  onChange={(e) => setFormData({ ...formData, employeeGender: e.target.value })}
                                  className="w-full px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                                >
                                  <option value="">Prefer not to say</option>
                                  {(dropdownOptions.EMPLOYEE_GENDER || []).map((option: any) => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                  ))}
                                </select>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                              <div>
                                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
                                  Do you need an interpreter to understand this report?
                                </label>
                                <div className="flex gap-3 sm:gap-4">
                                  <label className="flex items-center gap-1.5 sm:gap-2 cursor-pointer">
                                    <input
                                      type="radio"
                                      name="needsInterpreter"
                                      checked={formData.needsInterpreter === true}
                                      onChange={() => setFormData({ ...formData, needsInterpreter: true })}
                                      className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-600 focus:ring-amber-500"
                                    />
                                    <span className="text-xs sm:text-sm text-gray-700 dark:text-gray-300">Yes</span>
                                  </label>
                                  <label className="flex items-center gap-1.5 sm:gap-2 cursor-pointer">
                                    <input
                                      type="radio"
                                      name="needsInterpreter"
                                      checked={formData.needsInterpreter === false}
                                      onChange={() => setFormData({ ...formData, needsInterpreter: false })}
                                      className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-600 focus:ring-amber-500"
                                    />
                                    <span className="text-xs sm:text-sm text-gray-700 dark:text-gray-300">No</span>
                                  </label>
                                </div>
                              </div>

                              <div>
                                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
                                  Is interpreter assisting with this document?
                                </label>
                                <div className="flex gap-3 sm:gap-4">
                                  <label className="flex items-center gap-1.5 sm:gap-2 cursor-pointer">
                                    <input
                                      type="radio"
                                      name="interpreterAssisting"
                                      checked={formData.interpreterAssisting === true}
                                      onChange={() => setFormData({ ...formData, interpreterAssisting: true })}
                                      className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-600 focus:ring-amber-500"
                                    />
                                    <span className="text-xs sm:text-sm text-gray-700 dark:text-gray-300">Yes</span>
                                  </label>
                                  <label className="flex items-center gap-1.5 sm:gap-2 cursor-pointer">
                                    <input
                                      type="radio"
                                      name="interpreterAssisting"
                                      checked={formData.interpreterAssisting === false}
                                      onChange={() => setFormData({ ...formData, interpreterAssisting: false })}
                                      className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-600 focus:ring-amber-500"
                                    />
                                    <span className="text-xs sm:text-sm text-gray-700 dark:text-gray-300">No</span>
                                  </label>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Job Assignment & Compliance */}
                          <div className="space-y-3 sm:space-y-4 p-3 sm:p-4 bg-white/50 dark:bg-slate-800/50 rounded-lg border border-amber-100 dark:border-amber-900">
                            <h5 className="text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300">Job Assignment & Compliance</h5>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                              <div>
                                <div className="flex items-center mb-1.5 sm:mb-2">
                                  <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Owned Job Title and Department
                                  </label>
                                  <NACheckbox
                                    fieldName="ownedJobTitle"
                                    checked={isFieldNA(formData.ownedJobTitle)}
                                    onChange={(checked) => toggleFieldNA('ownedJobTitle', formData.ownedJobTitle)}
                                  />
                                </div>
                                <input
                                  type="text"
                                  value={formData.ownedJobTitle}
                                  onChange={(e) => setFormData({ ...formData, ownedJobTitle: e.target.value })}
                                  placeholder="e.g., Food Handler - Production"
                                  disabled={isFieldNA(formData.ownedJobTitle)}
                                  className={`w-full px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 ${isFieldNA(formData.ownedJobTitle) ? 'opacity-60 cursor-not-allowed bg-gray-100 dark:bg-slate-600' : ''}`}
                                />
                              </div>

                              <div>
                                <div className="flex items-center mb-1.5 sm:mb-2">
                                  <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Job Assignment Where Injury Took Place
                                  </label>
                                  <NACheckbox
                                    fieldName="jobAssignmentAtInjury"
                                    checked={isFieldNA(formData.jobAssignmentAtInjury)}
                                    onChange={(checked) => toggleFieldNA('jobAssignmentAtInjury', formData.jobAssignmentAtInjury)}
                                  />
                                </div>
                                <input
                                  type="text"
                                  value={formData.jobAssignmentAtInjury}
                                  onChange={(e) => setFormData({ ...formData, jobAssignmentAtInjury: e.target.value })}
                                  placeholder="e.g., Food Handler"
                                  disabled={isFieldNA(formData.jobAssignmentAtInjury)}
                                  className={`w-full px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 ${isFieldNA(formData.jobAssignmentAtInjury) ? 'opacity-60 cursor-not-allowed bg-gray-100 dark:bg-slate-600' : ''}`}
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                              <div>
                                <div className="flex items-center mb-1.5 sm:mb-2">
                                  <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Department Where Injury Took Place
                                  </label>
                                  <NACheckbox
                                    fieldName="departmentWhereInjury"
                                    checked={isFieldNA(formData.departmentWhereInjury)}
                                    onChange={(checked) => toggleFieldNA('departmentWhereInjury', formData.departmentWhereInjury)}
                                  />
                                </div>
                                <input
                                  type="text"
                                  value={formData.departmentWhereInjury}
                                  onChange={(e) => setFormData({ ...formData, departmentWhereInjury: e.target.value })}
                                  placeholder="e.g., Bakery, Production"
                                  disabled={isFieldNA(formData.departmentWhereInjury)}
                                  className={`w-full px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 ${isFieldNA(formData.departmentWhereInjury) ? 'opacity-60 cursor-not-allowed bg-gray-100 dark:bg-slate-600' : ''}`}
                                />
                              </div>

                              <div>
                                <div className="flex items-center mb-1.5 sm:mb-2">
                                  <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">
                                    OSHA Case Number (if applicable)
                                  </label>
                                  <NACheckbox
                                    fieldName="oshaCaseNumber"
                                    checked={isFieldNA(formData.oshaCaseNumber)}
                                    onChange={(checked) => toggleFieldNA('oshaCaseNumber', formData.oshaCaseNumber)}
                                  />
                                </div>
                                <input
                                  type="text"
                                  value={formData.oshaCaseNumber}
                                  onChange={(e) => setFormData({ ...formData, oshaCaseNumber: e.target.value })}
                                  placeholder="Enter OSHA case number"
                                  disabled={isFieldNA(formData.oshaCaseNumber)}
                                  className={`w-full px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 ${isFieldNA(formData.oshaCaseNumber) ? 'opacity-60 cursor-not-allowed bg-gray-100 dark:bg-slate-600' : ''}`}
                                />
                              </div>
                            </div>

                            <div>
                              <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
                                Is this a Lost Time incident?
                              </label>
                              <div className="flex gap-3 sm:gap-4">
                                <label className="flex items-center gap-1.5 sm:gap-2 cursor-pointer">
                                  <input
                                    type="radio"
                                    name="isLostTime"
                                    checked={formData.isLostTime === true}
                                    onChange={() => setFormData({ ...formData, isLostTime: true })}
                                    className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-600 focus:ring-amber-500"
                                  />
                                  <span className="text-xs sm:text-sm text-gray-700 dark:text-gray-300">Yes</span>
                                </label>
                                <label className="flex items-center gap-1.5 sm:gap-2 cursor-pointer">
                                  <input
                                    type="radio"
                                    name="isLostTime"
                                    checked={formData.isLostTime === false}
                                    onChange={() => setFormData({ ...formData, isLostTime: false })}
                                    className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-600 focus:ring-amber-500"
                                  />
                                  <span className="text-xs sm:text-sm text-gray-700 dark:text-gray-300">No</span>
                                </label>
                              </div>
                            </div>
                          </div>

                          {/* Safety Compliance Section */}
                          <div className="space-y-3 sm:space-y-4 p-3 sm:p-4 bg-white/50 dark:bg-slate-800/50 rounded-lg border border-amber-100 dark:border-amber-900">
                            <h5 className="text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300">Safety Compliance Assessment</h5>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                              <div>
                                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
                                  Was accident a violation of company safety rules?
                                </label>
                                <div className="flex gap-3 sm:gap-4">
                                  <label className="flex items-center gap-1.5 sm:gap-2 cursor-pointer">
                                    <input
                                      type="radio"
                                      name="wasViolationOfSafetyRules"
                                      checked={formData.wasViolationOfSafetyRules === true}
                                      onChange={() => setFormData({ ...formData, wasViolationOfSafetyRules: true })}
                                      className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-600 focus:ring-amber-500"
                                    />
                                    <span className="text-xs sm:text-sm text-gray-700 dark:text-gray-300">Yes</span>
                                  </label>
                                  <label className="flex items-center gap-1.5 sm:gap-2 cursor-pointer">
                                    <input
                                      type="radio"
                                      name="wasViolationOfSafetyRules"
                                      checked={formData.wasViolationOfSafetyRules === false}
                                      onChange={() => setFormData({ ...formData, wasViolationOfSafetyRules: false })}
                                      className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-600 focus:ring-amber-500"
                                    />
                                    <span className="text-xs sm:text-sm text-gray-700 dark:text-gray-300">No</span>
                                  </label>
                                </div>
                              </div>

                              <div>
                                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
                                  Was proper procedure being followed?
                                </label>
                                <div className="flex gap-3 sm:gap-4">
                                  <label className="flex items-center gap-1.5 sm:gap-2 cursor-pointer">
                                    <input
                                      type="radio"
                                      name="wasProperProcedureFollowed"
                                      checked={formData.wasProperProcedureFollowed === true}
                                      onChange={() => setFormData({ ...formData, wasProperProcedureFollowed: true })}
                                      className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-600 focus:ring-amber-500"
                                    />
                                    <span className="text-xs sm:text-sm text-gray-700 dark:text-gray-300">Yes</span>
                                  </label>
                                  <label className="flex items-center gap-1.5 sm:gap-2 cursor-pointer">
                                    <input
                                      type="radio"
                                      name="wasProperProcedureFollowed"
                                      checked={formData.wasProperProcedureFollowed === false}
                                      onChange={() => setFormData({ ...formData, wasProperProcedureFollowed: false })}
                                      className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-600 focus:ring-amber-500"
                                    />
                                    <span className="text-xs sm:text-sm text-gray-700 dark:text-gray-300">No</span>
                                  </label>
                                </div>
                              </div>

                              <div>
                                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
                                  Employee instructed in safe operating procedures?
                                </label>
                                <div className="flex gap-3 sm:gap-4">
                                  <label className="flex items-center gap-1.5 sm:gap-2 cursor-pointer">
                                    <input
                                      type="radio"
                                      name="wasEmployeeInstructedInSOP"
                                      checked={formData.wasEmployeeInstructedInSOP === true}
                                      onChange={() => setFormData({ ...formData, wasEmployeeInstructedInSOP: true })}
                                      className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-600 focus:ring-amber-500"
                                    />
                                    <span className="text-xs sm:text-sm text-gray-700 dark:text-gray-300">Yes</span>
                                  </label>
                                  <label className="flex items-center gap-1.5 sm:gap-2 cursor-pointer">
                                    <input
                                      type="radio"
                                      name="wasEmployeeInstructedInSOP"
                                      checked={formData.wasEmployeeInstructedInSOP === false}
                                      onChange={() => setFormData({ ...formData, wasEmployeeInstructedInSOP: false })}
                                      className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-600 focus:ring-amber-500"
                                    />
                                    <span className="text-xs sm:text-sm text-gray-700 dark:text-gray-300">No</span>
                                  </label>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Medical Reporting */}
                          <div className="space-y-3 sm:space-y-4 p-3 sm:p-4 bg-white/50 dark:bg-slate-800/50 rounded-lg border border-amber-100 dark:border-amber-900">
                            <h5 className="text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300">Medical Reporting</h5>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                              <div>
                                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
                                  Who has been notified?
                                </label>
                                <input
                                  type="text"
                                  value={formData.notifiedIndividuals}
                                  onChange={(e) => setFormData({ ...formData, notifiedIndividuals: e.target.value })}
                                  placeholder="e.g., Supervisor John Smith, HR"
                                  className="w-full px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                                />
                              </div>

                              <div>
                                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
                                  Has been reported to Medical Department?
                                </label>
                                <select
                                  value={formData.reportedToMedicalDept === null ? '' : formData.reportedToMedicalDept ? 'true' : 'false'}
                                  onChange={(e) => setFormData({ ...formData, reportedToMedicalDept: e.target.value === '' ? null : e.target.value === 'true' })}
                                  className="w-full px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                                >
                                  <option value="">Select</option>
                                  <option value="true">Yes</option>
                                  <option value="false">No</option>
                                </select>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                              <div>
                                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
                                  Medical providers involved (if any)
                                </label>
                                <input
                                  type="text"
                                  value={formData.medicalProvidersInvolved}
                                  onChange={(e) => setFormData({ ...formData, medicalProvidersInvolved: e.target.value })}
                                  placeholder="e.g., On-site nurse, Urgent Care"
                                  className="w-full px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                                />
                              </div>

                              <div>
                                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
                                  Type of injury (describe)
                                </label>
                                <input
                                  type="text"
                                  value={formData.injuryTypeDescription}
                                  onChange={(e) => setFormData({ ...formData, injuryTypeDescription: e.target.value })}
                                  placeholder="e.g., Strain, sprain, laceration"
                                  className="w-full px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                                />
                              </div>
                            </div>
                          </div>

                          {/* Prior Medical History */}
                          <div className="space-y-3 sm:space-y-4 p-3 sm:p-4 bg-white/50 dark:bg-slate-800/50 rounded-lg border border-amber-100 dark:border-amber-900">
                            <h5 className="text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300">Prior Medical History</h5>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                              <div>
                                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
                                  Any prior surgery performed on injured body part(s)?
                                </label>
                                <select
                                  value={formData.priorSurgeryPerformed === null ? '' : formData.priorSurgeryPerformed ? 'true' : 'false'}
                                  onChange={(e) => setFormData({ ...formData, priorSurgeryPerformed: e.target.value === '' ? null : e.target.value === 'true' })}
                                  className="w-full px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                                >
                                  <option value="">Select</option>
                                  <option value="true">Yes</option>
                                  <option value="false">No</option>
                                </select>
                              </div>

                              <div>
                                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
                                  Has similar condition been reported to HR before?
                                </label>
                                <select
                                  value={formData.previousSimilarConditionReported === null ? '' : formData.previousSimilarConditionReported ? 'true' : 'false'}
                                  onChange={(e) => setFormData({ ...formData, previousSimilarConditionReported: e.target.value === '' ? null : e.target.value === 'true' })}
                                  className="w-full px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                                >
                                  <option value="">Select</option>
                                  <option value="true">Yes</option>
                                  <option value="false">No</option>
                                </select>
                              </div>
                            </div>

                            {formData.priorSurgeryPerformed && (
                              <div>
                                <div className="flex items-center mb-1.5 sm:mb-2">
                                  <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">
                                    When and what surgery? (Prior surgery details)
                                  </label>
                                  <NACheckbox
                                    fieldName="priorSurgeryDescription"
                                    checked={isFieldNA(formData.priorSurgeryDescription)}
                                    onChange={(checked) => toggleFieldNA('priorSurgeryDescription', formData.priorSurgeryDescription)}
                                  />
                                </div>
                                <textarea
                                  value={formData.priorSurgeryDescription}
                                  onChange={(e) => setFormData({ ...formData, priorSurgeryDescription: e.target.value })}
                                  rows={2}
                                  placeholder="e.g., January 2022 - ACL reconstruction"
                                  disabled={isFieldNA(formData.priorSurgeryDescription)}
                                  className={`w-full px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 ${isFieldNA(formData.priorSurgeryDescription) ? 'opacity-60 cursor-not-allowed bg-gray-100 dark:bg-slate-600' : ''}`}
                                />
                              </div>
                            )}

                            {formData.previousSimilarConditionReported && (
                              <div>
                                <div className="flex items-center mb-1.5 sm:mb-2">
                                  <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">
                                    When and for what condition? (Previous similar condition details)
                                  </label>
                                  <NACheckbox
                                    fieldName="previousSimilarConditionDetails"
                                    checked={isFieldNA(formData.previousSimilarConditionDetails)}
                                    onChange={(checked) => toggleFieldNA('previousSimilarConditionDetails', formData.previousSimilarConditionDetails)}
                                  />
                                </div>
                                <textarea
                                  value={formData.previousSimilarConditionDetails}
                                  onChange={(e) => setFormData({ ...formData, previousSimilarConditionDetails: e.target.value })}
                                  rows={2}
                                  placeholder="e.g., March 2023 - Lower back strain"
                                  disabled={isFieldNA(formData.previousSimilarConditionDetails)}
                                  className={`w-full px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 ${isFieldNA(formData.previousSimilarConditionDetails) ? 'opacity-60 cursor-not-allowed bg-gray-100 dark:bg-slate-600' : ''}`}
                                />
                              </div>
                            )}

                            <div>
                              <div className="flex items-center mb-1.5 sm:mb-2">
                                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">
                                  Treating doctor(s) or medical facility
                                </label>
                                <NACheckbox
                                  fieldName="treatingDoctors"
                                  checked={isFieldNA(formData.treatingDoctors)}
                                  onChange={(checked) => toggleFieldNA('treatingDoctors', formData.treatingDoctors)}
                                />
                              </div>
                              <input
                                type="text"
                                value={formData.treatingDoctors}
                                onChange={(e) => setFormData({ ...formData, treatingDoctors: e.target.value })}
                                placeholder="e.g., Dr. John Smith, City Orthopedic"
                                disabled={isFieldNA(formData.treatingDoctors)}
                                className={`w-full px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 ${isFieldNA(formData.treatingDoctors) ? 'opacity-60 cursor-not-allowed bg-gray-100 dark:bg-slate-600' : ''}`}
                              />
                            </div>
                          </div>

                          {/* Additional Employment Information */}
                          <div className="space-y-3 sm:space-y-4 p-3 sm:p-4 bg-white/50 dark:bg-slate-800/50 rounded-lg border border-amber-100 dark:border-amber-900">
                            <h5 className="text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300">Additional Employment Information</h5>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                              <div>
                                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
                                  Is employee currently employed by any other company?
                                </label>
                                <select
                                  value={formData.employedElsewhere === null ? '' : formData.employedElsewhere ? 'true' : 'false'}
                                  onChange={(e) => setFormData({ ...formData, employedElsewhere: e.target.value === '' ? null : e.target.value === 'true' })}
                                  className="w-full px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                                >
                                  <option value="">Select</option>
                                  <option value="true">Yes</option>
                                  <option value="false">No</option>
                                </select>
                              </div>

                              <div>
                                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
                                  Has employee worked for any other employer in last 6 months?
                                </label>
                                <select
                                  value={formData.workedForOtherLast6Months === null ? '' : formData.workedForOtherLast6Months ? 'true' : 'false'}
                                  onChange={(e) => setFormData({ ...formData, workedForOtherLast6Months: e.target.value === '' ? null : e.target.value === 'true' })}
                                  className="w-full px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                                >
                                  <option value="">Select</option>
                                  <option value="true">Yes</option>
                                  <option value="false">No</option>
                                </select>
                              </div>
                            </div>

                            {formData.employedElsewhere && (
                              <>
                                <div>
                                  <div className="flex items-center mb-1.5 sm:mb-2">
                                    <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">
                                      Names and addresses of additional employer(s)
                                    </label>
                                    <NACheckbox
                                      fieldName="additionalEmployers"
                                      checked={isFieldNA(formData.additionalEmployers)}
                                      onChange={(checked) => toggleFieldNA('additionalEmployers', formData.additionalEmployers)}
                                    />
                                  </div>
                                  <textarea
                                    value={formData.additionalEmployers}
                                    onChange={(e) => setFormData({ ...formData, additionalEmployers: e.target.value })}
                                    rows={2}
                                    placeholder="Enter employer name(s) and address(es)"
                                    disabled={isFieldNA(formData.additionalEmployers)}
                                    className={`w-full px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 ${isFieldNA(formData.additionalEmployers) ? 'opacity-60 cursor-not-allowed bg-gray-100 dark:bg-slate-600' : ''}`}
                                  />
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                                  <div>
                                    <div className="flex items-center mb-1.5 sm:mb-2">
                                      <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">
                                        Hours per week for additional employer(s)
                                      </label>
                                      <NACheckbox
                                        fieldName="additionalEmployerHours"
                                        checked={isFieldNA(formData.additionalEmployerHours)}
                                        onChange={(checked) => toggleFieldNA('additionalEmployerHours', formData.additionalEmployerHours)}
                                      />
                                    </div>
                                    <input
                                      type="text"
                                      value={formData.additionalEmployerHours}
                                      onChange={(e) => setFormData({ ...formData, additionalEmployerHours: e.target.value })}
                                      placeholder="e.g., 20 hours/week"
                                      disabled={isFieldNA(formData.additionalEmployerHours)}
                                      className={`w-full px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 ${isFieldNA(formData.additionalEmployerHours) ? 'opacity-60 cursor-not-allowed bg-gray-100 dark:bg-slate-600' : ''}`}
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
                                      Start date with additional employer(s)
                                    </label>
                                    <input
                                      type="date"
                                      value={formData.additionalEmployerStartDate}
                                      onChange={(e) => setFormData({ ...formData, additionalEmployerStartDate: e.target.value })}
                                      className="w-full px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                                    />
                                  </div>
                                </div>
                              </>
                            )}

                            {formData.workedForOtherLast6Months && (
                              <div>
                                <div className="flex items-center mb-1.5 sm:mb-2">
                                  <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Names of other employers in last 6 months
                                  </label>
                                  <NACheckbox
                                    fieldName="otherEmployerNames"
                                    checked={isFieldNA(formData.otherEmployerNames)}
                                    onChange={(checked) => toggleFieldNA('otherEmployerNames', formData.otherEmployerNames)}
                                  />
                                </div>
                                <input
                                  type="text"
                                  value={formData.otherEmployerNames}
                                  onChange={(e) => setFormData({ ...formData, otherEmployerNames: e.target.value })}
                                  placeholder="Enter employer name(s)"
                                  disabled={isFieldNA(formData.otherEmployerNames)}
                                  className={`w-full px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 ${isFieldNA(formData.otherEmployerNames) ? 'opacity-60 cursor-not-allowed bg-gray-100 dark:bg-slate-600' : ''}`}
                                />
                              </div>
                            )}
                          </div>

                          {/* AI Validation Section */}
                          <ValidationResultsPanel
                            validation={incidentReportValidation}
                            isValidating={validatingIncidentReport}
                            onValidate={handleValidateIncidentReport}
                            tabName="Incident Report"
                          />

                          {/* Step 5 Navigation & Submit Incident Report */}
                          <div className="flex justify-between items-center pt-3 sm:pt-4 border-t border-amber-200 dark:border-amber-800">
                            <button
                              type="button"
                              onClick={() => setIncidentReportStep(4)}
                              className="px-3 sm:px-6 py-1.5 sm:py-2 text-xs sm:text-sm bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-slate-600 transition-all flex items-center gap-1 sm:gap-2 touch-manipulation"
                            >
                              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                              </svg>
                              <span className="hidden sm:inline">Back: Regulatory Info</span><span className="sm:hidden">Back</span>
                            </button>

                            {/* Submit Incident Report Button */}
                            {!incidentReportSubmitted ? (
                              <button
                                type="button"
                                onClick={handleSubmitIncidentReport}
                                disabled={incidentReportSubmitting || !formData.type || !formData.categoryId || !formData.description || !formData.facilityId}
                                className={`px-6 py-3 rounded-lg font-medium flex items-center gap-2 transition-colors ${
                                  incidentReportSubmitting || !formData.type || !formData.categoryId || !formData.description || !formData.facilityId
                                    ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 cursor-not-allowed'
                                    : 'bg-amber-600 hover:bg-amber-700 text-white'
                                }`}
                              >
                                {incidentReportSubmitting ? (
                                  <>
                                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                    </svg>
                                    {uploadProgress ? `Uploading (${uploadProgress.uploaded}/${uploadProgress.total})...` : 'Submitting...'}
                                  </>
                                ) : (
                                  <>
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    {stagedFiles.length > 0 ? `Submit Incident Report (${stagedFiles.length} files)` : 'Submit Incident Report'}
                                  </>
                                )}
                              </button>
                            ) : (
                              <div className="flex items-center gap-3">
                                <span className="text-green-600 dark:text-green-400 font-medium flex items-center gap-2">
                                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                  </svg>
                                  Incident Report submitted successfully
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setIncidentReportSubmitted(false)}
                                  className="text-sm text-amber-600 dark:text-amber-400 hover:underline"
                                >
                                  Edit & Resubmit
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Prompt to complete Investigation */}
                          {incidentReportSubmitted && !investigationSubmitted && (
                            <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                              <p className="text-sm text-blue-700 dark:text-blue-300 flex items-center gap-2">
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                </svg>
                                <span><strong>Next Step:</strong> Complete the <button type="button" onClick={() => setWorkplaceSafetyTab('investigation')} className="text-blue-600 dark:text-blue-400 underline font-medium">Incident Investigation (Leader/Supervisor)</button> section to enable Root Cause Analysis.</span>
                              </p>
                            </div>
                          )}
                        </div>
                        </>
                        )}
                        </>
                        )}

                        {/* ===== TAB 2: INVESTIGATION with internal pagination ===== */}
                        {workplaceSafetyTab === 'investigation' && (
                          <>
                        {/* Progress Bar for Investigation */}
                        <div className="space-y-3 mt-4">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium text-amber-700 dark:text-amber-400">
                              Step {investigationStep} of {INVESTIGATION_STEPS.length}: {INVESTIGATION_STEPS[investigationStep - 1]?.name}
                            </span>
                            <span className="text-gray-500 dark:text-gray-400">
                              {Math.round((investigationStep / INVESTIGATION_STEPS.length) * 100)}% Complete
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-2">
                            <div
                              className="bg-gradient-to-r from-amber-500 to-orange-500 h-2 rounded-full transition-all duration-500"
                              style={{ width: `${(investigationStep / INVESTIGATION_STEPS.length) * 100}%` }}
                            />
                          </div>
                          {/* Step Indicators */}
                          <div className="flex justify-between">
                            {INVESTIGATION_STEPS.map((stepItem) => (
                              <button
                                key={stepItem.id}
                                type="button"
                                onClick={() => setInvestigationStep(stepItem.id)}
                                className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-all ${
                                  investigationStep === stepItem.id
                                    ? 'bg-amber-600 text-white'
                                    : investigationStep > stepItem.id
                                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                    : 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-400'
                                }`}
                              >
                                <span>{stepItem.icon}</span>
                                <span className="hidden sm:inline">{stepItem.name}</span>
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Investigation Step 1: Classification */}
                        {investigationStep === 1 && (
                        <div className="space-y-3 sm:space-y-4 mt-2">
                          {/* Data Entry Requirements Notice */}
                          <div className="p-2.5 sm:p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg">
                            <p className="text-xs sm:text-sm text-blue-700 dark:text-blue-300 flex items-start gap-1.5 sm:gap-2">
                              <span className="text-base sm:text-lg">ℹ️</span>
                              <span><strong>Data Entry Requirements:</strong> All fields must be completed. For text fields that are not applicable, check the <strong>N/A checkbox</strong> beside the field label.</span>
                            </p>
                          </div>

                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-0">
                            <div>
                              <h4 className="text-sm sm:text-md font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
                                <span>🔍</span> <span className="hidden sm:inline">Incident Investigation (Leader/Supervisor Assessment)</span><span className="sm:hidden">Investigation Assessment</span>
                              </h4>
                              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 italic mt-1">
                                Complete this section to document the supervisor's investigation findings.
                              </p>
                            </div>
                            {investigationSubmitted && (
                              <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 sm:py-1.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-lg text-xs sm:text-sm font-medium">
                                <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                                <span className="hidden sm:inline">Investigation Submitted</span><span className="sm:hidden">Submitted</span>
                              </div>
                            )}
                          </div>

                          {/* Incident Classification */}
                          <div className="space-y-3 sm:space-y-4 p-3 sm:p-4 bg-white/50 dark:bg-slate-800/50 rounded-lg border border-amber-100 dark:border-amber-900">
                            <h5 className="text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300">Incident Classification</h5>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                              <div>
                                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
                                  Is the case OSHA recordable?
                                </label>
                                <div className="flex gap-3 sm:gap-4">
                                  <label className="flex items-center gap-1.5 sm:gap-2 cursor-pointer">
                                    <input
                                      type="radio"
                                      name="isOshaRecordable"
                                      checked={formData.isOshaRecordable === true}
                                      onChange={() => setFormData({ ...formData, isOshaRecordable: true })}
                                      className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-600 focus:ring-amber-500"
                                    />
                                    <span className="text-xs sm:text-sm text-gray-700 dark:text-gray-300">Yes</span>
                                  </label>
                                  <label className="flex items-center gap-1.5 sm:gap-2 cursor-pointer">
                                    <input
                                      type="radio"
                                      name="isOshaRecordable"
                                      checked={formData.isOshaRecordable === false}
                                      onChange={() => setFormData({ ...formData, isOshaRecordable: false })}
                                      className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-600 focus:ring-amber-500"
                                    />
                                    <span className="text-xs sm:text-sm text-gray-700 dark:text-gray-300">No</span>
                                  </label>
                                </div>
                              </div>

                              <div>
                                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
                                  Case Classification
                                </label>
                                <select
                                  value={formData.caseClassification}
                                  onChange={(e) => setFormData({ ...formData, caseClassification: e.target.value })}
                                  className="w-full px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                                >
                                  <option value="">Select classification</option>
                                  {addNAOption(dropdownOptions.CASE_CLASSIFICATION).map((option) => (
                                    <option key={option.id || option.value} value={option.value}>{option.label}</option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          </div>

                          {/* Employee & Job Information */}
                          <div className="space-y-3 sm:space-y-4 p-3 sm:p-4 bg-white/50 dark:bg-slate-800/50 rounded-lg border border-amber-100 dark:border-amber-900">
                            <h5 className="text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300">Employee & Job Information</h5>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                              <div>
                                <div className="flex items-center mb-1.5 sm:mb-2">
                                  <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Employee Name
                                  </label>
                                  <NACheckbox
                                    fieldName="employeeName"
                                    checked={isFieldNA(formData.employeeName)}
                                    onChange={(checked) => toggleFieldNA('employeeName', formData.employeeName)}
                                  />
                                </div>
                                <input
                                  type="text"
                                  value={formData.employeeName}
                                  onChange={(e) => setFormData({ ...formData, employeeName: e.target.value })}
                                  placeholder="Full name of injured employee"
                                  disabled={isFieldNA(formData.employeeName)}
                                  className={`w-full px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 ${isFieldNA(formData.employeeName) ? 'opacity-60 cursor-not-allowed bg-gray-100 dark:bg-slate-600' : ''}`}
                                />
                              </div>

                              <div>
                                <div className="flex items-center mb-1.5 sm:mb-2">
                                  <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Employee ID Number
                                  </label>
                                  <NACheckbox
                                    fieldName="employeeIdNumber"
                                    checked={isFieldNA(formData.employeeIdNumber)}
                                    onChange={(checked) => toggleFieldNA('employeeIdNumber', formData.employeeIdNumber)}
                                  />
                                </div>
                                <input
                                  type="text"
                                  value={formData.employeeIdNumber}
                                  onChange={(e) => setFormData({ ...formData, employeeIdNumber: e.target.value })}
                                  placeholder="Employee badge or ID number"
                                  disabled={isFieldNA(formData.employeeIdNumber)}
                                  className={`w-full px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 ${isFieldNA(formData.employeeIdNumber) ? 'opacity-60 cursor-not-allowed bg-gray-100 dark:bg-slate-600' : ''}`}
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                              <div>
                                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
                                  Position (Job) at Time of Incident
                                </label>
                                <select
                                  value={formData.positionAtTimeOfIncident}
                                  onChange={(e) => setFormData({ ...formData, positionAtTimeOfIncident: e.target.value })}
                                  className="w-full px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                                >
                                  <option value="">Select position/job type</option>
                                  {addNAOption(dropdownOptions.POSITION_JOB_TYPE).map((option) => (
                                    <option key={option.id || option.value} value={option.value}>{option.label}</option>
                                  ))}
                                </select>
                              </div>

                              <div>
                                <div className="flex items-center mb-1.5 sm:mb-2">
                                  <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Specific Location Where Injury Happened
                                  </label>
                                  <NACheckbox
                                    fieldName="specificInjuryLocation"
                                    checked={isFieldNA(formData.specificInjuryLocation)}
                                    onChange={(checked) => toggleFieldNA('specificInjuryLocation', formData.specificInjuryLocation)}
                                  />
                                </div>
                                <input
                                  type="text"
                                  value={formData.specificInjuryLocation}
                                  onChange={(e) => setFormData({ ...formData, specificInjuryLocation: e.target.value })}
                                  placeholder="e.g., Dock 3, Line 5 infeed"
                                  disabled={isFieldNA(formData.specificInjuryLocation)}
                                  className={`w-full px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 ${isFieldNA(formData.specificInjuryLocation) ? 'opacity-60 cursor-not-allowed bg-gray-100 dark:bg-slate-600' : ''}`}
                                />
                              </div>
                            </div>
                          </div>

                          {/* Step 1 Navigation */}
                          <div className="flex justify-end pt-3 sm:pt-4 border-t border-amber-200 dark:border-amber-800">
                            <button
                              type="button"
                              onClick={() => setInvestigationStep(2)}
                              className="px-3 sm:px-6 py-1.5 sm:py-2 text-xs sm:text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-all flex items-center gap-1 sm:gap-2 shadow-md hover:shadow-lg touch-manipulation"
                            >
                              <span className="hidden sm:inline">Next: Employee Info</span><span className="sm:hidden">Next</span>
                              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </button>
                          </div>
                        </div>
                        )}

                        {/* Investigation Step 2: Employee Info */}
                        {investigationStep === 2 && (
                        <div className="space-y-3 sm:space-y-4 mt-2">
                          <h4 className="text-sm sm:text-md font-medium text-gray-800 dark:text-gray-200 border-b border-amber-300 dark:border-amber-700 pb-2">
                            👤 Employee Info & Timing
                          </h4>

                          {/* Incident Date & Time */}
                          <div className="space-y-3 sm:space-y-4 p-3 sm:p-4 bg-white/50 dark:bg-slate-800/50 rounded-lg border border-amber-100 dark:border-amber-900">
                            <h5 className="text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300">Incident Date & Time</h5>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                              <div>
                                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
                                  Incident Date
                                </label>
                                <input
                                  type="date"
                                  value={formData.incidentDate}
                                  onChange={(e) => setFormData({ ...formData, incidentDate: e.target.value })}
                                  className="w-full px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                                />
                              </div>

                              <div>
                                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
                                  Incident Time
                                </label>
                                <input
                                  type="time"
                                  value={formData.incidentTime}
                                  onChange={(e) => setFormData({ ...formData, incidentTime: e.target.value })}
                                  className="w-full px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                                />
                              </div>

                              <div>
                                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
                                  Date Incident Was Reported
                                </label>
                                <input
                                  type="date"
                                  value={formData.dateIncidentReported}
                                  onChange={(e) => setFormData({ ...formData, dateIncidentReported: e.target.value })}
                                  className="w-full px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                                />
                              </div>
                            </div>

                            <div>
                              <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
                                Was the employee clocked in at the time of the incident?
                              </label>
                              <div className="flex gap-3 sm:gap-4">
                                <label className="flex items-center gap-1.5 sm:gap-2 cursor-pointer">
                                  <input
                                    type="radio"
                                    name="wasClockedIn"
                                    checked={formData.wasClockedIn === true}
                                    onChange={() => setFormData({ ...formData, wasClockedIn: true })}
                                    className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-600 focus:ring-amber-500"
                                  />
                                  <span className="text-xs sm:text-sm text-gray-700 dark:text-gray-300">Yes</span>
                                </label>
                                <label className="flex items-center gap-1.5 sm:gap-2 cursor-pointer">
                                  <input
                                    type="radio"
                                    name="wasClockedIn"
                                    checked={formData.wasClockedIn === false}
                                    onChange={() => setFormData({ ...formData, wasClockedIn: false })}
                                    className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-600 focus:ring-amber-500"
                                  />
                                  <span className="text-xs sm:text-sm text-gray-700 dark:text-gray-300">No</span>
                                </label>
                              </div>
                            </div>
                          </div>

                          {/* Incident Pattern & Work Relation */}
                          <div className="space-y-3 sm:space-y-4 p-3 sm:p-4 bg-white/50 dark:bg-slate-800/50 rounded-lg border border-amber-100 dark:border-amber-900">
                            <h5 className="text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300">Incident Pattern & Work Relation</h5>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                              <div>
                                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
                                  Did the injury develop over time or occur on a specific date?
                                </label>
                                <select
                                  value={formData.injuryDevelopmentPattern}
                                  onChange={(e) => setFormData({ ...formData, injuryDevelopmentPattern: e.target.value })}
                                  className="w-full px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                                >
                                  <option value="">Select</option>
                                  {addNAOption(dropdownOptions.INJURY_DEVELOPMENT).map((option) => (
                                    <option key={option.id || option.value} value={option.value}>{option.label}</option>
                                  ))}
                                </select>
                              </div>

                              <div>
                                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
                                  Was the injury caused by work activity or made worse by work activity?
                                </label>
                                <select
                                  value={formData.injuryWorkRelation}
                                  onChange={(e) => setFormData({ ...formData, injuryWorkRelation: e.target.value })}
                                  className="w-full px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                                >
                                  <option value="">Select</option>
                                  {addNAOption(dropdownOptions.INJURY_WORK_RELATION).map((option) => (
                                    <option key={option.id || option.value} value={option.value}>{option.label}</option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          </div>

                          {/* Step 2 Navigation */}
                          <div className="flex justify-between pt-3 sm:pt-4 border-t border-amber-200 dark:border-amber-800">
                            <button
                              type="button"
                              onClick={() => setInvestigationStep(1)}
                              className="px-3 sm:px-6 py-1.5 sm:py-2 text-xs sm:text-sm bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-slate-600 transition-all flex items-center gap-1 sm:gap-2 touch-manipulation"
                            >
                              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                              </svg>
                              <span className="hidden sm:inline">Back: Classification</span><span className="sm:hidden">Back</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setInvestigationStep(3)}
                              className="px-3 sm:px-6 py-1.5 sm:py-2 text-xs sm:text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-all flex items-center gap-1 sm:gap-2 shadow-md hover:shadow-lg touch-manipulation"
                            >
                              <span className="hidden sm:inline">Next: Investigation Details</span><span className="sm:hidden">Next</span>
                              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </button>
                          </div>
                        </div>
                        )}

                        {/* Investigation Step 3: Investigation Details */}
                        {investigationStep === 3 && (
                        <div className="space-y-3 sm:space-y-4 mt-2">
                          <h4 className="text-sm sm:text-md font-medium text-gray-800 dark:text-gray-200 border-b border-amber-300 dark:border-amber-700 pb-2">
                            🔎 Investigation Details
                          </h4>

                          {/* Incident Description */}
                          <div className="space-y-3 sm:space-y-4 p-3 sm:p-4 bg-white/50 dark:bg-slate-800/50 rounded-lg border border-amber-100 dark:border-amber-900">
                            <h5 className="text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300">Incident Description</h5>

                            <div>
                              <div className="flex items-center justify-between mb-1.5 sm:mb-2">
                                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">
                                  Describe how the incident occurred
                                </label>
                                <AIEnhanceButton
                                  onClick={() => enhanceText('incidentDescriptionDetailed', 'Incident Description')}
                                  isLoading={enhancingField === 'incidentDescriptionDetailed'}
                                  show={formData.type === 'WORKPLACE_SAFETY' && formData.incidentDescriptionDetailed.trim().length >= 5}
                                />
                              </div>
                              <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 mb-1.5 sm:mb-2 italic">
                                Include task performed, equipment used, materials handled, and PPE in use.
                              </p>
                              <textarea
                                value={formData.incidentDescriptionDetailed}
                                onChange={(e) => setFormData({ ...formData, incidentDescriptionDetailed: e.target.value })}
                                rows={4}
                                placeholder="Provide detailed description of what happened..."
                                className="w-full px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                              />
                            </div>
                          </div>

                          {/* Body Part & Injury Details */}
                          <div className="space-y-3 sm:space-y-4 p-3 sm:p-4 bg-white/50 dark:bg-slate-800/50 rounded-lg border border-amber-100 dark:border-amber-900">
                            <h5 className="text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300">Body Part & Injury Details</h5>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                              <div>
                                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
                                  List all body parts injured
                                </label>
                                <div className="max-h-40 sm:max-h-48 overflow-y-auto p-2 sm:p-3 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700">
                                  {(dropdownOptions.BODY_PART || []).map((option) => (
                                    <label key={option.id} className="flex items-center gap-1.5 sm:gap-2 py-0.5 sm:py-1 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-600 px-1.5 sm:px-2 rounded">
                                      <input
                                        type="checkbox"
                                        checked={formData.investigationBodyParts.includes(option.value)}
                                        onChange={(e) => {
                                          if (e.target.checked) {
                                            setFormData({ ...formData, investigationBodyParts: [...formData.investigationBodyParts, option.value] });
                                          } else {
                                            setFormData({ ...formData, investigationBodyParts: formData.investigationBodyParts.filter(p => p !== option.value) });
                                          }
                                        }}
                                        className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-600 focus:ring-amber-500 rounded"
                                      />
                                      <span className="text-xs sm:text-sm text-gray-700 dark:text-gray-300">{option.label}</span>
                                    </label>
                                  ))}
                                </div>
                              </div>

                              <div>
                                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
                                  Injury Type
                                </label>
                                <select
                                  value={formData.investigationInjuryType}
                                  onChange={(e) => setFormData({ ...formData, investigationInjuryType: e.target.value })}
                                  className="w-full px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                                >
                                  <option value="">Select injury type</option>
                                  {addNAOption(dropdownOptions.INJURY_TYPE).map((option) => (
                                    <option key={option.id || option.value} value={option.value}>{option.label}</option>
                                  ))}
                                </select>
                              </div>
                            </div>

                            {/* Injury Mechanism */}
                            <div>
                              <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
                                Injury Mechanism (How did the injury occur?)
                              </label>
                              <select
                                value={formData.injuryMechanism || ''}
                                onChange={(e) => setFormData({ ...formData, injuryMechanism: e.target.value })}
                                className="w-full px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                              >
                                <option value="">Select injury mechanism</option>
                                {addNAOption(dropdownOptions.INJURY_MECHANISM).map((option) => (
                                  <option key={option.id || option.value} value={option.value}>{option.label}</option>
                                ))}
                              </select>
                            </div>
                          </div>

                          {/* Task & Duty Assessment */}
                          <div className="space-y-3 sm:space-y-4 p-3 sm:p-4 bg-white/50 dark:bg-slate-800/50 rounded-lg border border-amber-100 dark:border-amber-900">
                            <h5 className="text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300">Task & Duty Assessment</h5>

                            <div>
                              <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
                                Was the employee performing duties other than normal job duties?
                              </label>
                              <div className="flex gap-3 sm:gap-4">
                                <label className="flex items-center gap-1.5 sm:gap-2 cursor-pointer">
                                  <input
                                    type="radio"
                                    name="wasPerformingOtherDuties"
                                    checked={formData.wasPerformingOtherDuties === true}
                                    onChange={() => setFormData({ ...formData, wasPerformingOtherDuties: true })}
                                    className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-600 focus:ring-amber-500"
                                  />
                                  <span className="text-xs sm:text-sm text-gray-700 dark:text-gray-300">Yes</span>
                                </label>
                                <label className="flex items-center gap-1.5 sm:gap-2 cursor-pointer">
                                  <input
                                    type="radio"
                                    name="wasPerformingOtherDuties"
                                    checked={formData.wasPerformingOtherDuties === false}
                                    onChange={() => setFormData({ ...formData, wasPerformingOtherDuties: false })}
                                    className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-600 focus:ring-amber-500"
                                  />
                                  <span className="text-xs sm:text-sm text-gray-700 dark:text-gray-300">No</span>
                                </label>
                              </div>
                            </div>

                            {formData.wasPerformingOtherDuties && (
                              <div>
                                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
                                  Explain what other duties were being performed
                                </label>
                                <textarea
                                  value={formData.otherDutiesExplanation}
                                  onChange={(e) => setFormData({ ...formData, otherDutiesExplanation: e.target.value })}
                                  rows={2}
                                  placeholder="Describe the non-standard duties..."
                                  className="w-full px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                                />
                              </div>
                            )}
                          </div>

                          {/* Witness & Site Review */}
                          <div className="space-y-3 sm:space-y-4 p-3 sm:p-4 bg-white/50 dark:bg-slate-800/50 rounded-lg border border-amber-100 dark:border-amber-900">
                            <h5 className="text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300">Witness & Site Review</h5>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                              <div>
                                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
                                  Was the injury witnessed?
                                </label>
                                <div className="flex gap-3 sm:gap-4">
                                  <label className="flex items-center gap-1.5 sm:gap-2 cursor-pointer">
                                    <input
                                      type="radio"
                                      name="wasInjuryWitnessed"
                                      checked={formData.wasInjuryWitnessed === true}
                                      onChange={() => setFormData({ ...formData, wasInjuryWitnessed: true })}
                                      className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-600 focus:ring-amber-500"
                                    />
                                    <span className="text-xs sm:text-sm text-gray-700 dark:text-gray-300">Yes</span>
                                  </label>
                                  <label className="flex items-center gap-1.5 sm:gap-2 cursor-pointer">
                                    <input
                                      type="radio"
                                      name="wasInjuryWitnessed"
                                      checked={formData.wasInjuryWitnessed === false}
                                      onChange={() => setFormData({ ...formData, wasInjuryWitnessed: false, witnessNamesList: '', interviewedNames: '', wereInterviewsDocumented: null })}
                                      className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-600 focus:ring-amber-500"
                                    />
                                    <span className="text-xs sm:text-sm text-gray-700 dark:text-gray-300">No</span>
                                  </label>
                                </div>
                              </div>

                              <div>
                                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
                                  Were co-workers present at the incident site?
                                </label>
                                <div className="flex gap-3 sm:gap-4">
                                  <label className="flex items-center gap-1.5 sm:gap-2 cursor-pointer">
                                    <input
                                      type="radio"
                                      name="wereCoworkersPresent"
                                      checked={formData.wereCoworkersPresent === true}
                                      onChange={() => setFormData({ ...formData, wereCoworkersPresent: true })}
                                      className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-600 focus:ring-amber-500"
                                    />
                                    <span className="text-xs sm:text-sm text-gray-700 dark:text-gray-300">Yes</span>
                                  </label>
                                  <label className="flex items-center gap-1.5 sm:gap-2 cursor-pointer">
                                    <input
                                      type="radio"
                                      name="wereCoworkersPresent"
                                      checked={formData.wereCoworkersPresent === false}
                                      onChange={() => setFormData({ ...formData, wereCoworkersPresent: false })}
                                      className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-600 focus:ring-amber-500"
                                    />
                                    <span className="text-xs sm:text-sm text-gray-700 dark:text-gray-300">No</span>
                                  </label>
                                </div>
                              </div>
                            </div>

                            {formData.wasInjuryWitnessed && (
                              <div>
                                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
                                  List witness name(s)
                                </label>
                                <textarea
                                  value={formData.witnessNamesList}
                                  onChange={(e) => setFormData({ ...formData, witnessNamesList: e.target.value })}
                                  rows={2}
                                  placeholder="Enter names of all witnesses..."
                                  className="w-full px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                                />
                              </div>
                            )}

                            <div>
                              <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
                                Was the incident site viewed?
                              </label>
                              <div className="flex gap-3 sm:gap-4">
                                <label className="flex items-center gap-1.5 sm:gap-2 cursor-pointer">
                                  <input
                                    type="radio"
                                    name="wasIncidentSiteViewed"
                                    checked={formData.wasIncidentSiteViewed === true}
                                    onChange={() => setFormData({ ...formData, wasIncidentSiteViewed: true })}
                                    className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-600 focus:ring-amber-500"
                                  />
                                  <span className="text-xs sm:text-sm text-gray-700 dark:text-gray-300">Yes</span>
                                </label>
                                <label className="flex items-center gap-1.5 sm:gap-2 cursor-pointer">
                                  <input
                                    type="radio"
                                    name="wasIncidentSiteViewed"
                                    checked={formData.wasIncidentSiteViewed === false}
                                    onChange={() => setFormData({ ...formData, wasIncidentSiteViewed: false })}
                                    className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-600 focus:ring-amber-500"
                                  />
                                  <span className="text-xs sm:text-sm text-gray-700 dark:text-gray-300">No</span>
                                </label>
                              </div>
                            </div>

                            {formData.wasIncidentSiteViewed && (
                              <>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                                  <div>
                                    <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
                                      Site view date
                                    </label>
                                    <input
                                      type="date"
                                      value={formData.siteViewDate}
                                      onChange={(e) => setFormData({ ...formData, siteViewDate: e.target.value })}
                                      className="w-full px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                                    />
                                  </div>

                                  <div>
                                    <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
                                      Site view time
                                    </label>
                                    <input
                                      type="time"
                                      value={formData.siteViewTime}
                                      onChange={(e) => setFormData({ ...formData, siteViewTime: e.target.value })}
                                      className="w-full px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                                    />
                                  </div>
                                </div>

                                <div>
                                  <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
                                    Did the site view reveal the cause of the incident?
                                  </label>
                                  <div className="flex gap-3 sm:gap-4">
                                    <label className="flex items-center gap-1.5 sm:gap-2 cursor-pointer">
                                      <input
                                        type="radio"
                                        name="didSiteRevealCause"
                                        checked={formData.didSiteRevealCause === true}
                                        onChange={() => setFormData({ ...formData, didSiteRevealCause: true })}
                                        className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-600 focus:ring-amber-500"
                                      />
                                      <span className="text-xs sm:text-sm text-gray-700 dark:text-gray-300">Yes</span>
                                    </label>
                                    <label className="flex items-center gap-1.5 sm:gap-2 cursor-pointer">
                                      <input
                                        type="radio"
                                        name="didSiteRevealCause"
                                        checked={formData.didSiteRevealCause === false}
                                        onChange={() => setFormData({ ...formData, didSiteRevealCause: false })}
                                        className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-600 focus:ring-amber-500"
                                      />
                                      <span className="text-xs sm:text-sm text-gray-700 dark:text-gray-300">No</span>
                                    </label>
                                  </div>
                                </div>

                                {formData.didSiteRevealCause && (
                                  <div>
                                    <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
                                      Explain what the site view revealed
                                    </label>
                                    <textarea
                                      value={formData.siteRevealExplanation}
                                      onChange={(e) => setFormData({ ...formData, siteRevealExplanation: e.target.value })}
                                      rows={2}
                                      placeholder="Describe findings from site review..."
                                      className="w-full px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                                    />
                                  </div>
                                )}
                              </>
                            )}
                          </div>

                          {/* Consistency & Verification */}
                          <div className="space-y-3 sm:space-y-4 p-3 sm:p-4 bg-white/50 dark:bg-slate-800/50 rounded-lg border border-amber-100 dark:border-amber-900">
                            <h5 className="text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300">Consistency & Verification</h5>

                            <div>
                              <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
                                Was the reported mechanism consistent with the site visit?
                              </label>
                              <div className="flex gap-3 sm:gap-4">
                                <label className="flex items-center gap-1.5 sm:gap-2 cursor-pointer">
                                  <input
                                    type="radio"
                                    name="wasInjuryConsistentWithSite"
                                    checked={formData.wasInjuryConsistentWithSite === true}
                                    onChange={() => setFormData({ ...formData, wasInjuryConsistentWithSite: true })}
                                    className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-600 focus:ring-amber-500"
                                  />
                                  <span className="text-xs sm:text-sm text-gray-700 dark:text-gray-300">Yes</span>
                                </label>
                                <label className="flex items-center gap-1.5 sm:gap-2 cursor-pointer">
                                  <input
                                    type="radio"
                                    name="wasInjuryConsistentWithSite"
                                    checked={formData.wasInjuryConsistentWithSite === false}
                                    onChange={() => setFormData({ ...formData, wasInjuryConsistentWithSite: false })}
                                    className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-600 focus:ring-amber-500"
                                  />
                                  <span className="text-xs sm:text-sm text-gray-700 dark:text-gray-300">No</span>
                                </label>
                              </div>
                            </div>

                            {formData.wasInjuryConsistentWithSite === false && (
                              <div>
                                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
                                  Explain the inconsistencies
                                </label>
                                <textarea
                                  value={formData.inconsistencyExplanation}
                                  onChange={(e) => setFormData({ ...formData, inconsistencyExplanation: e.target.value })}
                                  rows={2}
                                  placeholder="Describe what was inconsistent..."
                                  className="w-full px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                                />
                              </div>
                            )}
                          </div>

                          {/* Interviews */}
                          <div className={`space-y-3 sm:space-y-4 p-3 sm:p-4 bg-white/50 dark:bg-slate-800/50 rounded-lg border border-amber-100 dark:border-amber-900 ${formData.wasInjuryWitnessed === false ? 'opacity-50' : ''}`}>
                            <h5 className="text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300">Interviews</h5>

                            <div>
                              <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
                                Names of co-employees or witnesses interviewed
                              </label>
                              <textarea
                                value={formData.interviewedNames}
                                onChange={(e) => setFormData({ ...formData, interviewedNames: e.target.value })}
                                disabled={formData.wasInjuryWitnessed === false}
                                rows={2}
                                placeholder="List all people interviewed..."
                                className={`w-full px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 ${formData.wasInjuryWitnessed === false ? 'cursor-not-allowed' : ''}`}
                              />
                            </div>

                            <div>
                              <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
                                Were witness interviews documented?
                              </label>
                              <div className="flex gap-3 sm:gap-4">
                                <label className={`flex items-center gap-1.5 sm:gap-2 ${formData.wasInjuryWitnessed === false ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                                  <input
                                    type="radio"
                                    name="wereInterviewsDocumented"
                                    checked={formData.wereInterviewsDocumented === true}
                                    onChange={() => setFormData({ ...formData, wereInterviewsDocumented: true })}
                                    disabled={formData.wasInjuryWitnessed === false}
                                    className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-600 focus:ring-amber-500"
                                  />
                                  <span className="text-xs sm:text-sm text-gray-700 dark:text-gray-300">Yes</span>
                                </label>
                                <label className={`flex items-center gap-1.5 sm:gap-2 ${formData.wasInjuryWitnessed === false ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                                  <input
                                    type="radio"
                                    name="wereInterviewsDocumented"
                                    checked={formData.wereInterviewsDocumented === false}
                                    onChange={() => setFormData({ ...formData, wereInterviewsDocumented: false })}
                                    disabled={formData.wasInjuryWitnessed === false}
                                    className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-600 focus:ring-amber-500"
                                  />
                                  <span className="text-xs sm:text-sm text-gray-700 dark:text-gray-300">No</span>
                                </label>
                              </div>
                            </div>
                          </div>

                          {/* Medical & Work Status */}
                          <div className="space-y-3 sm:space-y-4 p-3 sm:p-4 bg-white/50 dark:bg-slate-800/50 rounded-lg border border-amber-100 dark:border-amber-900">
                            <h5 className="text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300">Medical & Work Status</h5>

                            <div>
                              <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
                                Was the employee working under any physical restrictions?
                              </label>
                              <div className="flex gap-3 sm:gap-4">
                                <label className="flex items-center gap-1.5 sm:gap-2 cursor-pointer">
                                  <input
                                    type="radio"
                                    name="hadPhysicalRestrictions"
                                    checked={formData.hadPhysicalRestrictions === true}
                                    onChange={() => setFormData({ ...formData, hadPhysicalRestrictions: true })}
                                    className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-600 focus:ring-amber-500"
                                  />
                                  <span className="text-xs sm:text-sm text-gray-700 dark:text-gray-300">Yes</span>
                                </label>
                                <label className="flex items-center gap-1.5 sm:gap-2 cursor-pointer">
                                  <input
                                    type="radio"
                                    name="hadPhysicalRestrictions"
                                    checked={formData.hadPhysicalRestrictions === false}
                                    onChange={() => setFormData({ ...formData, hadPhysicalRestrictions: false })}
                                    className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-600 focus:ring-amber-500"
                                  />
                                  <span className="text-xs sm:text-sm text-gray-700 dark:text-gray-300">No</span>
                                </label>
                              </div>
                            </div>

                            {formData.hadPhysicalRestrictions && (
                              <div>
                                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
                                  List known restrictions
                                </label>
                                <textarea
                                  value={formData.knownRestrictions}
                                  onChange={(e) => setFormData({ ...formData, knownRestrictions: e.target.value })}
                                  rows={2}
                                  placeholder="e.g., No lifting over 25 lbs..."
                                  className="w-full px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                                />
                              </div>
                            )}

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                              <div>
                                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
                                  Did the employee leave work due to the incident?
                                </label>
                                <div className="flex gap-3 sm:gap-4">
                                  <label className="flex items-center gap-1.5 sm:gap-2 cursor-pointer">
                                    <input
                                      type="radio"
                                      name="didLeaveWork"
                                      checked={formData.didLeaveWork === true}
                                      onChange={() => setFormData({ ...formData, didLeaveWork: true })}
                                      className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-600 focus:ring-amber-500"
                                    />
                                    <span className="text-xs sm:text-sm text-gray-700 dark:text-gray-300">Yes</span>
                                  </label>
                                  <label className="flex items-center gap-1.5 sm:gap-2 cursor-pointer">
                                    <input
                                      type="radio"
                                      name="didLeaveWork"
                                      checked={formData.didLeaveWork === false}
                                      onChange={() => setFormData({ ...formData, didLeaveWork: false, didReturnToWork: null, dateTimeLeftWork: '', dateTimeReturnedToWork: '' })}
                                      className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-600 focus:ring-amber-500"
                                    />
                                    <span className="text-xs sm:text-sm text-gray-700 dark:text-gray-300">No</span>
                                  </label>
                                </div>
                              </div>

                              <div className={formData.didLeaveWork === false ? 'opacity-50' : ''}>
                                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
                                  Did the employee return to work?
                                </label>
                                <div className="flex gap-3 sm:gap-4">
                                  <label className={`flex items-center gap-1.5 sm:gap-2 ${formData.didLeaveWork === false ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                                    <input
                                      type="radio"
                                      name="didReturnToWork"
                                      checked={formData.didReturnToWork === true}
                                      onChange={() => setFormData({ ...formData, didReturnToWork: true })}
                                      disabled={formData.didLeaveWork === false}
                                      className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-600 focus:ring-amber-500"
                                    />
                                    <span className="text-xs sm:text-sm text-gray-700 dark:text-gray-300">Yes</span>
                                  </label>
                                  <label className={`flex items-center gap-1.5 sm:gap-2 ${formData.didLeaveWork === false ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                                    <input
                                      type="radio"
                                      name="didReturnToWork"
                                      checked={formData.didReturnToWork === false}
                                      onChange={() => setFormData({ ...formData, didReturnToWork: false })}
                                      disabled={formData.didLeaveWork === false}
                                      className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-600 focus:ring-amber-500"
                                    />
                                    <span className="text-xs sm:text-sm text-gray-700 dark:text-gray-300">No</span>
                                  </label>
                                </div>
                              </div>
                            </div>

                            {formData.didLeaveWork && (
                              <div>
                                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
                                  Date/Time Left Work
                                </label>
                                <input
                                  type="datetime-local"
                                  value={formData.dateTimeLeftWork}
                                  onChange={(e) => setFormData({ ...formData, dateTimeLeftWork: e.target.value })}
                                  className="w-full px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                                />
                              </div>
                            )}

                            {formData.didReturnToWork && (
                              <div>
                                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
                                  Date/Time Returned to Work
                                </label>
                                <input
                                  type="datetime-local"
                                  value={formData.dateTimeReturnedToWork}
                                  onChange={(e) => setFormData({ ...formData, dateTimeReturnedToWork: e.target.value })}
                                  className="w-full px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                                />
                              </div>
                            )}
                          </div>

                          {/* Surveillance & Evidence */}
                          <div className="space-y-3 sm:space-y-4 p-3 sm:p-4 bg-white/50 dark:bg-slate-800/50 rounded-lg border border-amber-100 dark:border-amber-900">
                            <h5 className="text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300">Surveillance & Evidence</h5>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                              <div>
                                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
                                  Is area under video/audio surveillance?
                                </label>
                                <div className="flex gap-3 sm:gap-4">
                                  <label className="flex items-center gap-1.5 sm:gap-2 cursor-pointer">
                                    <input
                                      type="radio"
                                      name="isAreaUnderSurveillance"
                                      checked={formData.isAreaUnderSurveillance === true}
                                      onChange={() => setFormData({ ...formData, isAreaUnderSurveillance: true })}
                                      className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-600 focus:ring-amber-500"
                                    />
                                    <span className="text-xs sm:text-sm text-gray-700 dark:text-gray-300">Yes</span>
                                  </label>
                                  <label className="flex items-center gap-1.5 sm:gap-2 cursor-pointer">
                                    <input
                                      type="radio"
                                      name="isAreaUnderSurveillance"
                                      checked={formData.isAreaUnderSurveillance === false}
                                      onChange={() => setFormData({ ...formData, isAreaUnderSurveillance: false, wasSurveillanceAvailable: null, werePhotosVideosTaken: null })}
                                      className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-600 focus:ring-amber-500"
                                    />
                                    <span className="text-xs sm:text-sm text-gray-700 dark:text-gray-300">No</span>
                                  </label>
                                </div>
                              </div>

                              {formData.isAreaUnderSurveillance && (
                                <div>
                                  <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
                                    Was surveillance available for review?
                                  </label>
                                  <div className="flex gap-3 sm:gap-4">
                                    <label className="flex items-center gap-1.5 sm:gap-2 cursor-pointer">
                                      <input
                                        type="radio"
                                        name="wasSurveillanceAvailable"
                                        checked={formData.wasSurveillanceAvailable === true}
                                        onChange={() => setFormData({ ...formData, wasSurveillanceAvailable: true })}
                                        className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-600 focus:ring-amber-500"
                                      />
                                      <span className="text-xs sm:text-sm text-gray-700 dark:text-gray-300">Yes</span>
                                    </label>
                                    <label className="flex items-center gap-1.5 sm:gap-2 cursor-pointer">
                                      <input
                                        type="radio"
                                        name="wasSurveillanceAvailable"
                                        checked={formData.wasSurveillanceAvailable === false}
                                        onChange={() => setFormData({ ...formData, wasSurveillanceAvailable: false })}
                                        className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-600 focus:ring-amber-500"
                                      />
                                      <span className="text-xs sm:text-sm text-gray-700 dark:text-gray-300">No</span>
                                    </label>
                                  </div>
                                </div>
                              )}
                            </div>

                            <div className={formData.isAreaUnderSurveillance === false ? 'opacity-50' : ''}>
                              <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
                                Were photos or video of the site taken?
                              </label>
                              <div className="flex gap-3 sm:gap-4">
                                <label className={`flex items-center gap-1.5 sm:gap-2 ${formData.isAreaUnderSurveillance === false ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                                  <input
                                    type="radio"
                                    name="werePhotosVideosTaken"
                                    checked={formData.werePhotosVideosTaken === true}
                                    onChange={() => setFormData({ ...formData, werePhotosVideosTaken: true })}
                                    disabled={formData.isAreaUnderSurveillance === false}
                                    className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-600 focus:ring-amber-500"
                                  />
                                  <span className="text-xs sm:text-sm text-gray-700 dark:text-gray-300">Yes</span>
                                </label>
                                <label className={`flex items-center gap-1.5 sm:gap-2 ${formData.isAreaUnderSurveillance === false ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                                  <input
                                    type="radio"
                                    name="werePhotosVideosTaken"
                                    checked={formData.werePhotosVideosTaken === false}
                                    onChange={() => setFormData({ ...formData, werePhotosVideosTaken: false })}
                                    disabled={formData.isAreaUnderSurveillance === false}
                                    className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-600 focus:ring-amber-500"
                                  />
                                  <span className="text-xs sm:text-sm text-gray-700 dark:text-gray-300">No</span>
                                </label>
                              </div>
                              <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 mt-1 italic">
                                Attach photos/videos in Evidence Submission below.
                              </p>
                            </div>
                          </div>

                          {/* Step 3 Navigation */}
                          <div className="flex justify-between pt-3 sm:pt-4 border-t border-amber-200 dark:border-amber-800">
                            <button
                              type="button"
                              onClick={() => setInvestigationStep(2)}
                              className="px-3 sm:px-6 py-1.5 sm:py-2 text-xs sm:text-sm bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-slate-600 transition-all flex items-center gap-1.5 sm:gap-2 touch-manipulation"
                            >
                              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                              </svg>
                              <span className="hidden sm:inline">Back: Employee Info</span>
                              <span className="sm:hidden">Back</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setInvestigationStep(4)}
                              className="px-3 sm:px-6 py-1.5 sm:py-2 text-xs sm:text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-all flex items-center gap-1.5 sm:gap-2 shadow-md hover:shadow-lg touch-manipulation"
                            >
                              <span className="hidden sm:inline">Next: Recommendations</span>
                              <span className="sm:hidden">Next</span>
                              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </button>
                          </div>
                        </div>
                        )}

                        {/* Investigation Step 4: Recommendations */}
                        {investigationStep === 4 && (
                        <>
                        <div className="space-y-3 sm:space-y-4 mt-2">
                          <h4 className="text-sm sm:text-md font-medium text-gray-800 dark:text-gray-200 border-b border-amber-300 dark:border-amber-700 pb-2">
                            ✅ Root Cause & Recommendations
                          </h4>

                          {/* Contributing Factors Selection */}
                          <div className="space-y-3 sm:space-y-4 p-3 sm:p-4 bg-white/50 dark:bg-slate-800/50 rounded-lg border border-amber-100 dark:border-amber-900">
                            <h5 className="text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300">Contributing Factors (Select all that apply)</h5>
                            <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 italic">
                              Identify the People, Process, Equipment, and Environment factors.
                            </p>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                              {/* People Factors */}
                              <div className="space-y-1.5 sm:space-y-2">
                                <h6 className="text-[10px] sm:text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide">👤 People Factors</h6>
                                <div className="max-h-32 sm:max-h-40 overflow-y-auto p-1.5 sm:p-2 border border-gray-200 dark:border-slate-600 rounded-lg bg-white/50 dark:bg-slate-700/50">
                                  {(dropdownOptions.CONTRIBUTING_FACTOR_TYPE || [])
                                    .filter((opt) => opt.value.startsWith('PEOPLE_'))
                                    .map((option) => (
                                    <label key={option.id} className="flex items-center gap-1.5 sm:gap-2 py-0.5 sm:py-1 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-600 px-1.5 sm:px-2 rounded">
                                      <input
                                        type="checkbox"
                                        checked={formData.contributingFactorTypes.includes(option.value)}
                                        onChange={(e) => {
                                          if (e.target.checked) {
                                            setFormData({ ...formData, contributingFactorTypes: [...formData.contributingFactorTypes, option.value] });
                                          } else {
                                            setFormData({ ...formData, contributingFactorTypes: formData.contributingFactorTypes.filter(f => f !== option.value) });
                                          }
                                        }}
                                        className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-600 focus:ring-amber-500 rounded"
                                      />
                                      <span className="text-xs sm:text-sm text-gray-700 dark:text-gray-300">{option.label.replace('People - ', '')}</span>
                                    </label>
                                  ))}
                                </div>
                              </div>

                              {/* Process Factors */}
                              <div className="space-y-1.5 sm:space-y-2">
                                <h6 className="text-[10px] sm:text-xs font-semibold text-green-600 dark:text-green-400 uppercase tracking-wide">📋 Process Factors</h6>
                                <div className="max-h-32 sm:max-h-40 overflow-y-auto p-1.5 sm:p-2 border border-gray-200 dark:border-slate-600 rounded-lg bg-white/50 dark:bg-slate-700/50">
                                  {(dropdownOptions.CONTRIBUTING_FACTOR_TYPE || [])
                                    .filter((opt) => opt.value.startsWith('PROCESS_'))
                                    .map((option) => (
                                    <label key={option.id} className="flex items-center gap-1.5 sm:gap-2 py-0.5 sm:py-1 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-600 px-1.5 sm:px-2 rounded">
                                      <input
                                        type="checkbox"
                                        checked={formData.contributingFactorTypes.includes(option.value)}
                                        onChange={(e) => {
                                          if (e.target.checked) {
                                            setFormData({ ...formData, contributingFactorTypes: [...formData.contributingFactorTypes, option.value] });
                                          } else {
                                            setFormData({ ...formData, contributingFactorTypes: formData.contributingFactorTypes.filter(f => f !== option.value) });
                                          }
                                        }}
                                        className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-600 focus:ring-amber-500 rounded"
                                      />
                                      <span className="text-xs sm:text-sm text-gray-700 dark:text-gray-300">{option.label.replace('Process - ', '')}</span>
                                    </label>
                                  ))}
                                </div>
                              </div>

                              {/* Equipment Factors */}
                              <div className="space-y-1.5 sm:space-y-2">
                                <h6 className="text-[10px] sm:text-xs font-semibold text-orange-600 dark:text-orange-400 uppercase tracking-wide">⚙️ Equipment Factors</h6>
                                <div className="max-h-32 sm:max-h-40 overflow-y-auto p-1.5 sm:p-2 border border-gray-200 dark:border-slate-600 rounded-lg bg-white/50 dark:bg-slate-700/50">
                                  {(dropdownOptions.CONTRIBUTING_FACTOR_TYPE || [])
                                    .filter((opt) => opt.value.startsWith('EQUIPMENT_'))
                                    .map((option) => (
                                    <label key={option.id} className="flex items-center gap-1.5 sm:gap-2 py-0.5 sm:py-1 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-600 px-1.5 sm:px-2 rounded">
                                      <input
                                        type="checkbox"
                                        checked={formData.contributingFactorTypes.includes(option.value)}
                                        onChange={(e) => {
                                          if (e.target.checked) {
                                            setFormData({ ...formData, contributingFactorTypes: [...formData.contributingFactorTypes, option.value] });
                                          } else {
                                            setFormData({ ...formData, contributingFactorTypes: formData.contributingFactorTypes.filter(f => f !== option.value) });
                                          }
                                        }}
                                        className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-600 focus:ring-amber-500 rounded"
                                      />
                                      <span className="text-xs sm:text-sm text-gray-700 dark:text-gray-300">{option.label.replace('Equipment - ', '')}</span>
                                    </label>
                                  ))}
                                </div>
                              </div>

                              {/* Environment Factors */}
                              <div className="space-y-1.5 sm:space-y-2">
                                <h6 className="text-[10px] sm:text-xs font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wide">🌡️ Environment Factors</h6>
                                <div className="max-h-32 sm:max-h-40 overflow-y-auto p-1.5 sm:p-2 border border-gray-200 dark:border-slate-600 rounded-lg bg-white/50 dark:bg-slate-700/50">
                                  {(dropdownOptions.CONTRIBUTING_FACTOR_TYPE || [])
                                    .filter((opt) => opt.value.startsWith('ENVIRONMENT_'))
                                    .map((option) => (
                                    <label key={option.id} className="flex items-center gap-1.5 sm:gap-2 py-0.5 sm:py-1 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-600 px-1.5 sm:px-2 rounded">
                                      <input
                                        type="checkbox"
                                        checked={formData.contributingFactorTypes.includes(option.value)}
                                        onChange={(e) => {
                                          if (e.target.checked) {
                                            setFormData({ ...formData, contributingFactorTypes: [...formData.contributingFactorTypes, option.value] });
                                          } else {
                                            setFormData({ ...formData, contributingFactorTypes: formData.contributingFactorTypes.filter(f => f !== option.value) });
                                          }
                                        }}
                                        className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-600 focus:ring-amber-500 rounded"
                                      />
                                      <span className="text-xs sm:text-sm text-gray-700 dark:text-gray-300">{option.label.replace('Environment - ', '')}</span>
                                    </label>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Root Cause & Prevention (Leader Assessment) */}
                          <div className="space-y-3 sm:space-y-4 p-3 sm:p-4 bg-white/50 dark:bg-slate-800/50 rounded-lg border border-amber-100 dark:border-amber-900">
                            <h5 className="text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300">Root Cause & Prevention (Leader Assessment)</h5>

                            <div>
                              <div className="flex items-center mb-1.5 sm:mb-2">
                                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">
                                  What acts or conditions contributed most to this incident?
                                </label>
                                <NACheckbox
                                  fieldName="leaderActsConditionsOpinion"
                                  checked={isFieldNA(formData.leaderActsConditionsOpinion)}
                                  onChange={(checked) => toggleFieldNA('leaderActsConditionsOpinion', formData.leaderActsConditionsOpinion)}
                                />
                              </div>
                              <textarea
                                value={formData.leaderActsConditionsOpinion}
                                onChange={(e) => setFormData({ ...formData, leaderActsConditionsOpinion: e.target.value })}
                                rows={3}
                                placeholder="Describe the primary contributing factors..."
                                disabled={isFieldNA(formData.leaderActsConditionsOpinion)}
                                className={`w-full px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 ${isFieldNA(formData.leaderActsConditionsOpinion) ? 'opacity-60 cursor-not-allowed bg-gray-100 dark:bg-slate-600' : ''}`}
                              />
                            </div>

                            {/* Corrective Action Types */}
                            <div>
                              <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
                                Corrective Action Types (Select all that apply)
                              </label>
                              <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 italic mb-1.5 sm:mb-2">
                                What types of corrective actions are recommended?
                              </p>
                              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1.5 sm:gap-2 max-h-40 sm:max-h-48 overflow-y-auto p-2 sm:p-3 border border-gray-200 dark:border-slate-600 rounded-lg bg-white/50 dark:bg-slate-700/50">
                                {(dropdownOptions.CORRECTIVE_ACTION_TYPE || []).map((option) => (
                                  <label key={option.id} className="flex items-center gap-1.5 sm:gap-2 py-0.5 sm:py-1 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-600 px-1.5 sm:px-2 rounded">
                                    <input
                                      type="checkbox"
                                      checked={formData.correctiveActionTypes?.includes(option.value) || false}
                                      onChange={(e) => {
                                        const currentTypes = formData.correctiveActionTypes || [];
                                        if (e.target.checked) {
                                          setFormData({ ...formData, correctiveActionTypes: [...currentTypes, option.value] });
                                        } else {
                                          setFormData({ ...formData, correctiveActionTypes: currentTypes.filter(t => t !== option.value) });
                                        }
                                      }}
                                      className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-600 focus:ring-amber-500 rounded"
                                    />
                                    <span className="text-xs sm:text-sm text-gray-700 dark:text-gray-300">{option.label}</span>
                                  </label>
                                ))}
                              </div>
                            </div>

                            <div>
                              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-1.5 sm:mb-2 gap-1">
                                <div className="flex items-center">
                                  <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">
                                    What should be done to prevent recurrence?
                                  </label>
                                  <NACheckbox
                                    fieldName="preventionRecommendations"
                                    checked={isFieldNA(formData.preventionRecommendations)}
                                    onChange={(checked) => toggleFieldNA('preventionRecommendations', formData.preventionRecommendations)}
                                  />
                                </div>
                                <AIEnhanceButton
                                  onClick={() => enhanceText('preventionRecommendations', 'Prevention Recommendations')}
                                  isLoading={enhancingField === 'preventionRecommendations'}
                                  show={formData.type === 'WORKPLACE_SAFETY' && formData.preventionRecommendations.trim().length >= 5 && !isFieldNA(formData.preventionRecommendations)}
                                />
                              </div>
                              <textarea
                                value={formData.preventionRecommendations}
                                onChange={(e) => setFormData({ ...formData, preventionRecommendations: e.target.value })}
                                rows={3}
                                placeholder="List specific actions and responsible parties..."
                                disabled={isFieldNA(formData.preventionRecommendations)}
                                className={`w-full px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 ${isFieldNA(formData.preventionRecommendations) ? 'opacity-60 cursor-not-allowed bg-gray-100 dark:bg-slate-600' : ''}`}
                              />
                            </div>

                            <div>
                              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-1.5 sm:mb-2 gap-1">
                                <div className="flex items-center">
                                  <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">
                                    What actions are you taking to ensure completion?
                                  </label>
                                  <NACheckbox
                                    fieldName="supervisorActions"
                                    checked={isFieldNA(formData.supervisorActions)}
                                    onChange={(checked) => toggleFieldNA('supervisorActions', formData.supervisorActions)}
                                  />
                                </div>
                                <AIEnhanceButton
                                  onClick={() => enhanceText('supervisorActions', 'Supervisor Actions')}
                                  isLoading={enhancingField === 'supervisorActions'}
                                  show={formData.type === 'WORKPLACE_SAFETY' && formData.supervisorActions.trim().length >= 5 && !isFieldNA(formData.supervisorActions)}
                                />
                              </div>
                              <textarea
                                value={formData.supervisorActions}
                                onChange={(e) => setFormData({ ...formData, supervisorActions: e.target.value })}
                                rows={3}
                                placeholder="Describe your follow-up actions and timeline..."
                                disabled={isFieldNA(formData.supervisorActions)}
                                className={`w-full px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 ${isFieldNA(formData.supervisorActions) ? 'opacity-60 cursor-not-allowed bg-gray-100 dark:bg-slate-600' : ''}`}
                              />
                            </div>

                            {/* Incident Pattern */}
                            <div>
                              <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
                                Incident Pattern Analysis
                              </label>
                              <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 italic mb-1.5 sm:mb-2">
                                Is this an isolated incident or part of a larger pattern?
                              </p>
                              <select
                                value={formData.incidentPattern}
                                onChange={(e) => setFormData({ ...formData, incidentPattern: e.target.value })}
                                className="w-full px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500"
                              >
                                <option value="">Select Incident Pattern...</option>
                                {addNAOption(dropdownOptions.INCIDENT_PATTERN).map((option) => (
                                  <option key={option.id || option.value} value={option.value}>{option.label}</option>
                                ))}
                              </select>
                            </div>
                          </div>

                          {/* AI Validation Section for Investigation */}
                          <ValidationResultsPanel
                            validation={investigationValidation}
                            isValidating={validatingInvestigation}
                            onValidate={handleValidateInvestigation}
                            tabName="Investigation"
                          />

                          {/* Submit Investigation Button */}
                          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4 pt-3 sm:pt-4 border-t border-amber-200 dark:border-amber-800 mt-4 sm:mt-6">
                            <div>
                              {/* Prompt when Incident Report not submitted */}
                              {!incidentReportSubmitted && (
                                <div className="p-2 sm:p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg">
                                  <p className="text-xs sm:text-sm text-amber-700 dark:text-amber-300">
                                    <span>Submit the <button type="button" onClick={() => setWorkplaceSafetyTab('incident-report')} className="text-amber-600 dark:text-amber-400 underline font-medium">Incident Report</button> first.</span>
                                  </p>
                                </div>
                              )}
                            </div>

                            {!investigationSubmitted ? (
                              <button
                                type="button"
                                onClick={handleSubmitInvestigation}
                                disabled={investigationSubmitting || !incidentReportSubmitted}
                                className={`px-4 sm:px-6 py-2 sm:py-3 text-xs sm:text-sm rounded-lg font-medium flex items-center gap-1.5 sm:gap-2 transition-colors touch-manipulation ${
                                  investigationSubmitting || !incidentReportSubmitted
                                    ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 cursor-not-allowed'
                                    : 'bg-amber-600 hover:bg-amber-700 text-white'
                                }`}
                              >
                                {investigationSubmitting ? (
                                  <>
                                    <svg className="animate-spin h-4 w-4 sm:h-5 sm:w-5" viewBox="0 0 24 24">
                                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                    </svg>
                                    <span className="hidden sm:inline">Submitting Investigation...</span>
                                    <span className="sm:hidden">Submitting...</span>
                                  </>
                                ) : (
                                  <>
                                    <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <span className="hidden sm:inline">Submit Investigation</span>
                                    <span className="sm:hidden">Submit</span>
                                  </>
                                )}
                              </button>
                            ) : (
                              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3">
                                <span className="text-xs sm:text-sm text-green-600 dark:text-green-400 font-medium flex items-center gap-1.5 sm:gap-2">
                                  <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                  </svg>
                                  <span className="hidden sm:inline">Investigation submitted successfully</span>
                                  <span className="sm:hidden">Submitted</span>
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setInvestigationSubmitted(false)}
                                  className="text-xs sm:text-sm text-amber-600 dark:text-amber-400 hover:underline touch-manipulation"
                                >
                                  Edit & Resubmit
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Step 4 Navigation */}
                        <div className="flex justify-start pt-3 sm:pt-4 border-t border-amber-200 dark:border-amber-800">
                          <button
                            type="button"
                            onClick={() => setInvestigationStep(3)}
                            className="px-3 sm:px-6 py-1.5 sm:py-2 text-xs sm:text-sm bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-slate-600 transition-all flex items-center gap-1.5 sm:gap-2 touch-manipulation"
                          >
                            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                            <span className="hidden sm:inline">Back: Investigation Details</span>
                            <span className="sm:hidden">Back</span>
                          </button>
                        </div>
                        </>
                        )}

                        </>
                        )}

                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      <div>
                        <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
                          Occurred At *
                        </label>
                        <input
                          type="datetime-local"
                          value={formData.occurredAt}
                          onChange={(e) => setFormData({ ...formData, occurredAt: e.target.value })}
                          required
                          className="w-full px-3 sm:px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 text-sm sm:text-base"
                        />
                      </div>

                      <div>
                        <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
                          Severity *
                        </label>
                        <select
                          value={formData.severity}
                          onChange={(e) => setFormData({ ...formData, severity: e.target.value as any })}
                          required
                          className="w-full px-3 sm:px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 text-sm sm:text-base"
                        >
                          <option value="">Select Severity...</option>
                          {(dropdownOptions.SEVERITY_LEVEL || []).map((option) => (
                            <option key={option.id} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                {formPage === 3 && (
                  <div className="incident-section mb-4">
                    <div>
                      <h2 className="font-semibold text-gray-900 dark:text-white">
                        Evidence & Final Review
                      </h2>
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        Add evidence, review the summary, then submit or save the incident.
                      </p>
                    </div>
                  </div>
                )}

                {/* Step 4: Evidence Submission - Always visible */}
                <div className={formPage === 3 ? 'incident-section mb-4' : 'hidden'}>
                  <h2 className="font-semibold text-gray-900 dark:text-white">
                    Evidence Submission
                  </h2>
                  <EvidenceUpload
                    incidentId={incidentId || undefined}
                    onStagedFilesChange={setStagedFiles}
                    onUploadComplete={(files) => {
                      console.log('Evidence uploaded:', files);
                    }}
                  />

                  {/* Upload Progress Indicator */}
                  {uploadProgress && (
                    <div className="mt-3 sm:mt-4 p-3 sm:p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                      <div className="flex items-center gap-2 sm:gap-3">
                        <div className="animate-spin rounded-full h-4 w-4 sm:h-5 sm:w-5 border-b-2 border-blue-600"></div>
                        <span className="text-xs sm:text-sm text-blue-800 dark:text-blue-200">
                          Uploading... {uploadProgress.uploaded}/{uploadProgress.total}
                        </span>
                      </div>
                      <div className="mt-1.5 sm:mt-2 w-full bg-blue-200 rounded-full h-1.5 sm:h-2">
                        <div
                          className="bg-blue-600 h-1.5 sm:h-2 rounded-full transition-all duration-300"
                          style={{ width: `${(uploadProgress.uploaded / uploadProgress.total) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Step 5: Summary - At the end of the form */}
                <div className={formPage === 3 ? 'incident-section mb-4' : 'hidden'}>
                  <h2 className="font-semibold text-gray-900 dark:text-white">
                    Incident Summary
                  </h2>
                  <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-4 dark:border-blue-800 dark:bg-blue-900/20">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Summary for Records
                        </label>
                      </div>
                      <button
                        type="button"
                        onClick={generateAISummary}
                        disabled={generatingAI || !formData.description}
                        className={`px-4 py-2 text-sm font-medium rounded-lg transition-all flex items-center gap-2 ${
                          generatingAI || !formData.description
                            ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 cursor-not-allowed'
                            : 'bg-primary-600 hover:bg-primary-700 text-white shadow-sm hover:shadow'
                        }`}
                      >
                        {generatingAI ? (
                          <>
                            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            {analyzingAttachments ? 'Reading files...' : 'Creating...'}
                          </>
                        ) : (
                          <>
                            Generate Summary {stagedFiles.length > 0 && `(${stagedFiles.length} files)`}
                          </>
                        )}
                      </button>
                    </div>

                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                      {stagedFiles.length > 0
                        ? `Use the ${stagedFiles.length} uploaded file(s) and the incident details to create a clear summary.`
                        : 'Use the incident details, location, date, and description to create a clear summary for official records.'
                      }
                    </p>

                    <textarea
                      value={formData.aiSummary}
                      onChange={(e) => setFormData({ ...formData, aiSummary: e.target.value })}
                      rows={4}
                      placeholder="Click 'Generate Summary' to create a clear summary from the information you entered. You can edit it after it is created."
                      className="w-full px-4 py-2 rounded-lg border border-blue-200 dark:border-blue-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 placeholder-gray-400 dark:placeholder-gray-500"
                    />

                    {/* Suggested Severity */}
                    {aiSuggestedSeverity && (
                      <div className="mt-3 flex items-center gap-2 p-2 bg-white dark:bg-slate-800 rounded-lg border border-blue-200 dark:border-blue-700">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Suggested Severity:</span>
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          aiSuggestedSeverity === 'CRITICAL' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' :
                          aiSuggestedSeverity === 'HIGH' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300' :
                          aiSuggestedSeverity === 'MEDIUM' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' :
                          'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                        }`}>
                          {aiSuggestedSeverity}
                        </span>
                        {formData.severity !== aiSuggestedSeverity && (
                          <button
                            type="button"
                            onClick={() => setFormData({ ...formData, severity: aiSuggestedSeverity as any })}
                            className="ml-auto text-xs text-primary-600 dark:text-primary-400 hover:underline"
                          >
                            Apply suggestion
                          </button>
                        )}
                      </div>
                    )}

                    {/* Summary details shown after files are reviewed */}
                    {aiAnalysisResults && (
                      <div className="mt-4 space-y-4">
                        {/* Attachment Summary */}
                        {aiAnalysisResults.attachmentAnalysis && (
                          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="text-sm font-semibold text-blue-800 dark:text-blue-200 flex items-center gap-2">
                                Attachment Review
                                <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-800 text-xs rounded-full">
                                  {aiAnalysisResults.attachmentAnalysis.totalAttachments} file(s) reviewed
                                </span>
                              </h4>
                              <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                aiAnalysisResults.attachmentAnalysis.analysisConfidence >= 80 ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
                                aiAnalysisResults.attachmentAnalysis.analysisConfidence >= 50 ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' :
                                'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                              }`}>
                                {aiAnalysisResults.attachmentAnalysis.analysisConfidence}% confidence
                              </span>
                            </div>

                            {/* Risk Assessment */}
                            {aiAnalysisResults.attachmentAnalysis.riskAssessment && (
                              <div className="mb-2 p-2 bg-white dark:bg-slate-800 rounded">
                                <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Evidence-Based Risk: </span>
                                <span className={`px-2 py-0.5 text-xs font-semibold rounded ${
                                  aiAnalysisResults.attachmentAnalysis.riskAssessment.level === 'CRITICAL' ? 'bg-red-100 text-red-800' :
                                  aiAnalysisResults.attachmentAnalysis.riskAssessment.level === 'HIGH' ? 'bg-orange-100 text-orange-800' :
                                  aiAnalysisResults.attachmentAnalysis.riskAssessment.level === 'MEDIUM' ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-green-100 text-green-800'
                                }`}>
                                  {aiAnalysisResults.attachmentAnalysis.riskAssessment.level}
                                </span>
                              </div>
                            )}

                            {/* Individual File Analyses */}
                            {aiAnalysisResults.attachmentAnalysis.individualAnalyses.length > 0 && (
                              <div className="mt-2 space-y-1">
                                {aiAnalysisResults.attachmentAnalysis.individualAnalyses.map((analysis, idx) => (
                                  <div key={idx} className="flex items-start gap-2 text-xs p-2 bg-white dark:bg-slate-800 rounded">
                                    <div className="flex-1 min-w-0">
                                      <p className="font-medium text-gray-800 dark:text-gray-200 truncate">{analysis.filename}</p>
                                      <p className="text-gray-600 dark:text-gray-400 line-clamp-2">{analysis.summary}</p>
                                    </div>
                                    <span className={`flex-shrink-0 px-1.5 py-0.5 rounded text-xs ${
                                      analysis.status === 'success' ? 'bg-green-100 text-green-700' :
                                      analysis.status === 'partial' ? 'bg-yellow-100 text-yellow-700' :
                                      'bg-red-100 text-red-700'
                                    }`}>
                                      {analysis.status}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Evidence Summary */}
                        {aiAnalysisResults.evidenceSummary && (
                          <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                            <h4 className="text-sm font-semibold text-amber-800 dark:text-amber-200 mb-2 flex items-center gap-2">
                              Evidence Summary
                            </h4>
                            <p className="text-sm text-amber-700 dark:text-amber-300">{aiAnalysisResults.evidenceSummary}</p>
                          </div>
                        )}

                        {/* Key Findings */}
                        {aiAnalysisResults.keyFindings.length > 0 && (
                          <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                            <h4 className="text-sm font-semibold text-green-800 dark:text-green-200 mb-2 flex items-center gap-2">
                              Key Findings
                            </h4>
                            <ul className="space-y-1">
                              {aiAnalysisResults.keyFindings.map((finding, idx) => (
                                <li key={idx} className="text-sm text-green-700 dark:text-green-300 flex items-start gap-2">
                                  <span className="flex-shrink-0 mt-1">•</span>
                                  <span>{finding}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Investigation Guidance */}
                        {aiAnalysisResults.investigationGuidance.length > 0 && (
                          <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg">
                            <h4 className="text-sm font-semibold text-indigo-800 dark:text-indigo-200 mb-2 flex items-center gap-2">
                              Investigation Guidance
                            </h4>
                            <ul className="space-y-1">
                              {aiAnalysisResults.investigationGuidance.map((guidance, idx) => (
                                <li key={idx} className="text-sm text-indigo-700 dark:text-indigo-300 flex items-start gap-2">
                                  <span className="flex-shrink-0 mt-1">{idx + 1}.</span>
                                  <span>{guidance}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* RCA Methodology Recommendation */}
                        {aiAnalysisResults.recommendedRCAMethodology && (
                          <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-4 dark:border-blue-800 dark:bg-blue-900/20">
                            <h4 className="mb-3 text-sm font-semibold text-blue-800 dark:text-blue-200">
                              Recommended RCA Method
                            </h4>

                            <div className="flex items-center gap-3 mb-3">
                              <div className={`px-4 py-2 rounded-lg text-white font-semibold ${
                                aiAnalysisResults.recommendedRCAMethodology.primary === 'FIVE_WHYS'
                                  ? 'bg-primary-600'
                                  : 'bg-primary-600'
                              }`}>
                                {aiAnalysisResults.recommendedRCAMethodology.primary === 'FIVE_WHYS'
                                  ? '5 Whys Analysis'
                                  : 'Fishbone Diagram'}
                              </div>
                              <div className="flex items-center gap-1">
                                <span className={`text-xs font-medium px-2 py-1 rounded ${
                                  aiAnalysisResults.recommendedRCAMethodology.confidence >= 80
                                    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                                    : aiAnalysisResults.recommendedRCAMethodology.confidence >= 60
                                      ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                                      : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                                }`}>
                                  {aiAnalysisResults.recommendedRCAMethodology.confidence}% confidence
                                </span>
                              </div>
                            </div>

                            <p className="text-sm text-blue-700 dark:text-blue-300 mb-3">
                              {aiAnalysisResults.recommendedRCAMethodology.reason}
                            </p>

                            {aiAnalysisResults.recommendedRCAMethodology.alternativeMethod && (
                              <div className="mt-3 border-t border-blue-200 pt-3 dark:border-blue-700">
                                <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                                  <span className="font-medium">Alternative option:</span>{' '}
                                  {aiAnalysisResults.recommendedRCAMethodology.alternativeMethod === 'FIVE_WHYS'
                                    ? '5 Whys Analysis'
                                    : 'Fishbone Diagram'}
                                </p>
                                {aiAnalysisResults.recommendedRCAMethodology.alternativeReason && (
                                  <p className="text-xs text-gray-500 dark:text-gray-500">
                                    {aiAnalysisResults.recommendedRCAMethodology.alternativeReason}
                                  </p>
                                )}
                              </div>
                            )}

                            <div className="mt-3 p-2 bg-white/50 dark:bg-black/20 rounded text-xs text-gray-600 dark:text-gray-400">
                              <strong>Note:</strong> This recommendation is based on the incident type, evidence review, and complexity of the situation.
                              You can choose a different method in the RCA step if needed.
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                      This summary is based on the form details, description, category, date, location, {stagedFiles.length > 0 ? 'and uploaded files.' : 'and evidence notes.'}
                    </p>
                  </div>
                </div>

              </>
            )}
          </div>

            <div className="border-t border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="min-w-0 text-xs text-slate-500 dark:text-slate-400">
                  <span className="font-medium text-slate-700 dark:text-slate-200">Step {formPage} of 3</span>
                  <span className="ml-2">
                    {formPage === 1
                      ? 'Select an incident type.'
                      : formPage === 2
                        ? 'Complete the required details.'
                        : 'Review evidence and submit.'}
                  </span>
                  {formPage === 3 && (
                    <span className={`ml-2 font-semibold ${
                      draftSaveInProgress
                        ? 'text-slate-600 dark:text-slate-300'
                        : isStepThreeDraftSaved
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-red-600 dark:text-red-400'
                    }`}>
                      {stepThreeDraftStatusText}
                    </span>
                  )}
                </div>

                <div className="flex flex-col gap-2 sm:ml-auto sm:flex-row sm:items-center">
                  <button
                    type="button"
                    onClick={handleIncidentModalBack}
                    className="w-full border border-slate-200 bg-white px-4 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 sm:w-auto"
                  >
                    {formPage === 1 ? 'Cancel' : 'Back'}
                  </button>

                  {formPage < 3 ? (
                    <button
                      type="button"
                      onClick={handleIncidentModalNext}
                      disabled={!canMoveToNextIncidentFormPage}
                      className={`w-full px-4 py-1.5 text-xs font-medium transition-colors sm:w-auto ${
                        canMoveToNextIncidentFormPage
                          ? 'bg-primary-600 text-white hover:bg-primary-700'
                          : 'cursor-not-allowed bg-slate-200 text-slate-400 dark:bg-slate-700 dark:text-slate-500'
                      }`}
                    >
                      Next
                    </button>
                  ) : (
                    <>
                      {isSubmittedEditMode ? (
                        <button
                          type="button"
                          onClick={handleSaveExistingIncidentDetails}
                          disabled={loading || !isDetailsPageComplete}
                          className="w-full bg-primary-600 px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                        >
                          {loading ? 'Saving...' : 'Save Changes'}
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={handleSubmitIncidentReport}
                            disabled={incidentReportSubmitting || !isDetailsPageComplete}
                            className="w-full bg-primary-600 px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                          >
                            {uploadProgress ? `Uploading (${uploadProgress.uploaded}/${uploadProgress.total})...` : incidentReportSubmitting ? 'Submitting...' : stagedFiles.length > 0 ? `Submit Incident (${stagedFiles.length} files)` : 'Submit Incident'}
                          </button>
                          <button
                            type="button"
                            onClick={handleSaveDraftFromFooter}
                            disabled={incidentReportSubmitting || draftSaveInProgress || !isDetailsPageComplete}
                            className="w-full bg-gray-600 px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                          >
                            {draftSaveInProgress ? 'Saving to Draft.......' : 'Save Draft'}
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={handleCloseIncidentForm}
                        className="w-full bg-gray-200 px-4 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-300 dark:bg-slate-700 dark:text-gray-300 dark:hover:bg-slate-600 sm:w-auto"
                      >
                        Cancel
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
        </div>
      </div>
        </>
      )}
    </>
  );

  return embedded ? formContent : (
    <ProtectedRoute requireAuth={true}>
      {formContent}
    </ProtectedRoute>
  );
}
