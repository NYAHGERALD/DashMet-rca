'use client';

import React, { useState, useEffect, Suspense, useCallback, useRef, useMemo, useLayoutEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/providers/AuthProvider';
import { useWebSocket } from '@/lib/websocket';
import { usePrivileges, FMIR_PRIVILEGES } from '@/lib/usePrivileges';
import AccessDeniedModal, { useAccessDeniedModal, handlePrivilegeError } from '@/components/modals/AccessDeniedModal';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import FMIRVisibilityOffModal from '@/components/fmir/FMIRVisibilityOffModal';
import FMIRCommentModal from '@/components/fmir/FMIRCommentModal';
import FMIRCommentPopup from '@/components/fmir/FMIRCommentPopup';
import AIEnhancedTextarea from '@/components/fmir/AIEnhancedTextarea';
import api from '@/lib/api';
import {
  ArrowLeft,
  Save,
  Send,
  AlertTriangle,
  Calendar,
  Clock,
  Building2,
  User,
  FileText,
  Search,
  ClipboardCheck,
  Shield,
  Package,
  Truck,
  CheckCircle,
  AlertCircle,
  Loader2,
  Upload,
  X,
  File,
  Image,
  Video,
  Trash2,
  Download,
  ChevronDown,
  ChevronUp,
  Info,
  BookOpen,
  Edit2,
  Crop,
  Lock,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Scissors,
  Camera,
  Sparkles,
  XCircle,
  RefreshCw,
  Plus,
  ChevronRight,
  Eye,
  UserMinus,
  MessageSquare,
} from 'lucide-react';
import { format } from 'date-fns';
// FFmpeg imports removed - using MediaRecorder approach which works without special headers

interface Facility {
  id: string;
  name: string;
}

interface Department {
  id: string;
  name: string;
  facilityId: string;
}

interface Area {
  id: string;
  name: string;
  departmentId: string;
}

interface Line {
  id: string;
  name: string;
  areaId: string;
}

interface Category {
  id: string;
  name: string;
  type: string;
  parentId: string | null;
}

interface Evidence {
  id: string;
  type: 'PHOTO' | 'VIDEO' | 'DOCUMENT';
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  description?: string;
  url?: string;
}

interface FMIRFormData {
  // Section 1: Basic Information
  incidentDate: string;
  incidentTime: string;
  department: string;
  area: string;
  line: string;
  rawMaterialSource: string;
  fmSourceCategory: string;
  fmSourceType: string;
  productName: string;
  productItemNumber: string;
  productCodeBatchLot: string;
  amount: string;
  individualsInvolved: string;

  // Section 2: Foreign Material Description
  foreignMaterialDescription: string;
  foreignMaterialSize: string;
  foreignMaterialHardness: string;
  section2Initials: string;
  section2Date: string;
  isHardSharpOrLarge: boolean;
  unforeseeHazardFormRequired: boolean;

  // Section 3: Cause Identification
  causeIdentification: string;
  possibleSource: string;
  howWhyOccurred: string;
  section3Initials: string;
  section3Date: string;

  // Section 4: Corrective Action
  correctiveAction: string;
  section4Initials: string;
  section4Date: string;

  // Section 5: Verification (QC)
  verificationActions: string;
  section5Initials: string;
  section5Date: string;
  maintenanceWorkCompleted: string;
  sanitationRequired: boolean;
  sanitationNotes: string;

  // Section 6: Product Hold
  productPlacedOnHold: boolean;
  itemsHeld: string;
  holdDecisionDetails: string;
  contaminationWindowDetails: string;
  section6Initials: string;
  section6Date: string;

  // Section 7: Screening Process
  screeningProcess: string;
  section7Initials: string;
  section7Date: string;

  // Section 8: Final Disposition
  finalDisposition: string;
  dispositionVolume: string;
  dispositionJustification: string;
  section8Initials: string;
  section8Date: string;
  dispositionDate: string;
  dispositionInitials: string;

  // Section 9: Prevention Measures
  preventionMeasures: string;
  section9Initials: string;
  section9Date: string;

  // Corporate & Pre-Shipment
  corporateNotified: boolean;
  corporatePersonsNotified: string;
  preShipmentReview: string;
  preShipmentReviewDate: string;
  preShipmentSignatureRequired: boolean;

  // Facility
  facilityId: string;
  status: 'DRAFT' | 'SUBMITTED' | 'UNDER_INVESTIGATION' | 'RESOLVED' | 'CLOSED';
}

const initialFormData: FMIRFormData = {
  incidentDate: new Date().toISOString().split('T')[0],
  incidentTime: '',
  department: '',
  area: '',
  line: '',
  rawMaterialSource: '',
  fmSourceCategory: '',
  fmSourceType: '',
  productName: '',
  productItemNumber: '',
  productCodeBatchLot: '',
  amount: '',
  individualsInvolved: '',
  foreignMaterialDescription: '',
  foreignMaterialSize: '',
  foreignMaterialHardness: '',
  section2Initials: '',
  section2Date: '',
  isHardSharpOrLarge: false,
  unforeseeHazardFormRequired: false,
  causeIdentification: '',
  possibleSource: '',
  howWhyOccurred: '',
  section3Initials: '',
  section3Date: '',
  correctiveAction: '',
  section4Initials: '',
  section4Date: '',
  verificationActions: '',
  section5Initials: '',
  section5Date: '',
  maintenanceWorkCompleted: '',
  sanitationRequired: false,
  sanitationNotes: '',
  productPlacedOnHold: false,
  itemsHeld: '',
  holdDecisionDetails: '',
  contaminationWindowDetails: '',
  section6Initials: '',
  section6Date: '',
  screeningProcess: '',
  section7Initials: '',
  section7Date: '',
  finalDisposition: '',
  dispositionVolume: '',
  dispositionJustification: '',
  section8Initials: '',
  section8Date: '',
  dispositionDate: '',
  dispositionInitials: '',
  preventionMeasures: '',
  section9Initials: '',
  section9Date: '',
  corporateNotified: false,
  corporatePersonsNotified: '',
  preShipmentReview: '',
  preShipmentReviewDate: '',
  preShipmentSignatureRequired: false,
  facilityId: '',
  status: 'DRAFT',
};

// Section component for collapsible sections
const FormSection = ({
  title,
  sectionNumber,
  icon: Icon,
  children,
  isExpanded,
  onToggle,
  isRequired = false,
  readOnly = false,
  readOnlyMessage,
  commentCount = 0,
  onAddComment,
  onViewComments,
  hasUnreadComments = false,
  onClearUnread,
}: {
  title: string;
  sectionNumber: number;
  icon: React.ElementType;
  children: React.ReactNode;
  isExpanded: boolean;
  onToggle: () => void;
  isRequired?: boolean;
  readOnly?: boolean;
  readOnlyMessage?: string;
  commentCount?: number;
  onAddComment?: () => void;
  onViewComments?: (e: React.MouseEvent) => void;
  hasUnreadComments?: boolean;
  onClearUnread?: () => void;
}) => (
  <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden transition-all duration-200`}>
    <button
      type="button"
      onClick={onToggle}
      className="w-full px-3 sm:px-4 py-3 flex items-center justify-between bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-750 hover:from-gray-100 hover:to-gray-150 dark:hover:from-gray-750 dark:hover:to-gray-700 transition-all duration-200"
    >
      <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0 mr-2">
        <div className={`flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-br from-primary-500 to-primary-600 text-white font-bold text-xs sm:text-sm shadow flex-shrink-0`}>
          {sectionNumber}
        </div>
        <Icon className={`w-4 h-4 sm:w-5 sm:h-5 text-primary-600 dark:text-primary-400 flex-shrink-0`} />
        <h3 className="text-sm sm:text-base font-bold text-gray-900 dark:text-white text-left leading-tight sm:truncate">{title}</h3>
        {isRequired && (
          <span className="hidden sm:inline-flex px-2 py-0.5 text-xs font-semibold rounded-full bg-red-500 text-white flex-shrink-0">
            Required
          </span>
        )}
        {readOnly && (
          <span className="hidden sm:inline-flex px-2 py-0.5 text-xs font-semibold rounded-full bg-amber-500 text-white flex-shrink-0">
            QA Only
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Comment indicator - shows count when there are comments */}
        {commentCount > 0 && (
          <div
            onClick={(e) => {
              e.stopPropagation();
              onClearUnread?.();
              onViewComments?.(e);
            }}
            className={`
              relative flex items-center gap-1.5 px-3 py-1.5 rounded-xl 
              bg-gradient-to-r from-blue-500 to-indigo-500 
              text-white font-semibold
              shadow-lg shadow-blue-500/30 
              hover:shadow-xl hover:shadow-blue-500/40 
              hover:scale-105 active:scale-95
              transition-all duration-300 cursor-pointer
              ${hasUnreadComments ? 'animate-comment-glitter' : ''}
            `}
            title={hasUnreadComments ? "New comments! Click to view" : "View comments"}
          >
            {/* Continuous glitter effect when there are unread comments */}
            {hasUnreadComments && (
              <>
                {/* Outer glow ring */}
                <span className="absolute -inset-1 rounded-xl bg-gradient-to-r from-blue-400 via-purple-400 to-indigo-400 opacity-60 blur-sm animate-pulse" />
                {/* Ping effect */}
                <span className="absolute inset-0 rounded-xl bg-blue-400 animate-ping opacity-50" />
                {/* Sparkle dots */}
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-yellow-300 rounded-full animate-bounce shadow-lg shadow-yellow-400/50" />
                <span className="absolute -bottom-0.5 -left-0.5 w-1.5 h-1.5 bg-pink-300 rounded-full animate-ping" />
              </>
            )}
            
            <MessageSquare className="w-4 h-4 relative z-10" />
            <span className="text-sm font-bold relative z-10">{commentCount}</span>
          </div>
        )}
        {/* Add comment button - always visible */}
        {onAddComment && (
          <div
            onClick={(e) => {
              e.stopPropagation();
              onAddComment();
            }}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 hover:text-primary-600 dark:hover:text-primary-400 transition-colors cursor-pointer"
            title="Add comment"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="text-xs font-medium hidden sm:inline">Comment</span>
          </div>
        )}
        <div className={`p-1.5 rounded-lg transition-all duration-200 ${isExpanded ? 'bg-primary-100 dark:bg-primary-900/50' : 'bg-gray-100 dark:bg-gray-700'}`}>
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-primary-600 dark:text-primary-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-500" />
          )}
        </div>
      </div>
    </button>
    <div className={`transition-all duration-300 ease-in-out ${isExpanded ? 'max-h-[5000px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}`}>
      <div className="px-3 sm:px-4 py-4 border-t border-gray-200 dark:border-gray-700 space-y-3 sm:space-y-4 bg-white dark:bg-gray-800">
        {readOnly && (
          <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg mb-4">
            <Lock className="w-4 h-4 text-amber-500 flex-shrink-0" />
            <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
              {readOnlyMessage || 'View only - This section can only be edited by QA/Food Safety personnel'}
            </p>
          </div>
        )}
        {children}
      </div>
    </div>
  </div>
);

// Input field component
const FormInput = ({
  label,
  name,
  value,
  onChange,
  type = 'text',
  placeholder,
  required = false,
  disabled = false,
  rows,
  className = '',
}: {
  label: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  rows?: number;
  className?: string;
}) => (
  <div className={className}>
    <label className="block text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
      {label}
      {required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
    {rows ? (
      <textarea
        name={name}
        value={value}
        onChange={onChange}
        rows={rows}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full px-3 py-2 bg-white dark:bg-gray-700/80 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:opacity-50 disabled:cursor-not-allowed resize-none transition-all text-sm"
      />
    ) : (
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full px-3 py-2 bg-white dark:bg-gray-700/80 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm"
      />
    )}
  </div>
);

// Signature field component - Read-only display for initials and date
const SignatureField = ({
  label,
  initialsValue,
  dateValue,
}: {
  label: string;
  initialsValue: string;
  dateValue: string;
}) => (
  <div className="flex flex-col gap-2 p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg border border-dashed border-gray-300 dark:border-gray-600">
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
      <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide min-w-fit">
        {label}
      </span>
      <div className="flex items-center gap-3 flex-1">
        <div className="flex items-center gap-1.5">
          <label className="text-xs text-gray-500 dark:text-gray-400">Initials:</label>
          <div className="w-16 px-2 py-1.5 bg-gray-100 dark:bg-gray-600 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-center font-bold text-sm">
            {initialsValue || '--'}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <label className="text-xs text-gray-500 dark:text-gray-400">Date:</label>
          <div className="px-2 py-1.5 bg-gray-100 dark:bg-gray-600 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-sm min-w-[120px]">
            {dateValue ? new Date(dateValue).toLocaleDateString() : '--/--/----'}
          </div>
        </div>
      </div>
    </div>
    <p className="text-xs text-gray-500 dark:text-gray-400 italic flex items-center gap-1">
      <Info className="w-3 h-3" />
      Initials and date are automatically recorded when you complete this section.
    </p>
  </div>
);

// Toggle/Checkbox component
const FormToggle = ({
  label,
  checked,
  onChange,
  name,
  description,
  disabled = false,
}: {
  label: string;
  checked: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  name: string;
  description?: string;
  disabled?: boolean;
}) => (
  <label className={`flex items-start gap-3 group ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}>
    <div className="relative flex items-center justify-center flex-shrink-0 mt-0.5">
      <input
        type="checkbox"
        name={name}
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className={`w-5 h-5 rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500 focus:ring-offset-0 ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
      />
    </div>
    <div>
      <span className="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white">
        {label}
      </span>
      {description && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{description}</p>
      )}
    </div>
  </label>
);

// Radio group component
const FormRadioGroup = ({
  label,
  name,
  value,
  options,
  onChange,
  disabled = false,
}: {
  label: string;
  name: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  disabled?: boolean;
}) => (
  <div className={disabled ? 'opacity-60' : ''}>
    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
      {label}
    </label>
    <div className="flex flex-wrap gap-3">
      {options.map((option) => (
        <label
          key={option.value}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
            disabled ? 'cursor-not-allowed' : 'cursor-pointer'
          } ${
            value === option.value
              ? 'bg-primary-50 dark:bg-primary-900/30 border-primary-500 text-primary-700 dark:text-primary-300'
              : 'bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-650'
          }`}
        >
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            onChange={() => !disabled && onChange(option.value)}
            disabled={disabled}
            className="sr-only"
          />
          <span className="text-sm font-medium">{option.label}</span>
        </label>
      ))}
    </div>
  </div>
);

export default function FMIRNewPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-full bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
        </div>
      }
    >
      <FMIRNewPageContent />
    </Suspense>
  );
}

function FMIRNewPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, getIdToken } = useAuth();
  const { onFmirVisibilityOff, onFmirUpdated, onFmirClosedStatusChanged, onFmirStatusChanged, onFmirDeleted, onFmirEvidenceUpdated, onFmirCollaboratorRemoved, onFmirCommentAdded, onFmirCommentDeleted } = useWebSocket();
  const editId = searchParams.get('edit');

  // Form state
  const [formData, setFormData] = useState<FMIRFormData>(initialFormData);
  const [isEditMode, setIsEditMode] = useState(false);
  const [reportNumber, setReportNumber] = useState<string | null>(null);
  const [reportCreatedById, setReportCreatedById] = useState<string | null>(null);

  // UI state - start loading as true if editing to prevent flash
  const [loading, setLoading] = useState(!!editId);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Access denied modal for privilege errors from API calls
  const { showAccessDenied, modal: accessDeniedModal } = useAccessDeniedModal();
  
  const [showSOPModal, setShowSOPModal] = useState(false);
  const [sopModalPos, setSopModalPos] = useState<{ x: number; y: number } | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showEvidenceWarning, setShowEvidenceWarning] = useState(false);
  const [showAlreadySubmittedModal, setShowAlreadySubmittedModal] = useState(false);
  const [showResubmitWarningModal, setShowResubmitWarningModal] = useState(false);
  const sopModalRef = useRef<HTMLDivElement>(null);
  const sopDragRef = useRef<{ active: boolean; offsetX: number; offsetY: number }>({ active: false, offsetX: 0, offsetY: 0 });
  
  // Visibility off modal state
  const [showVisibilityOffModal, setShowVisibilityOffModal] = useState(false);
  const [visibilityOffOwnerName, setVisibilityOffOwnerName] = useState('');
  const [visibilityOffReportNumber, setVisibilityOffReportNumber] = useState('');
  const [savingBeforeClose, setSavingBeforeClose] = useState(false);
  
  // FMIR locked modal state (when QA closes the report)
  const [showLockedModal, setShowLockedModal] = useState(false);
  const [lockedReportNumber, setLockedReportNumber] = useState('');
  
  // FMIR investigation off modal state (when QA toggles investigation off - status changes to SUBMITTED)
  const [showInvestigationOffModal, setShowInvestigationOffModal] = useState(false);
  const [investigationOffReportNumber, setInvestigationOffReportNumber] = useState('');
  const [investigationOffByName, setInvestigationOffByName] = useState('');
  
  // FMIR deleted modal state (when QA deletes the report)
  const [showDeletedModal, setShowDeletedModal] = useState(false);
  const [deletedReportNumber, setDeletedReportNumber] = useState('');
  const [deletedByName, setDeletedByName] = useState('');
  const [deleteCountdown, setDeleteCountdown] = useState(10);
  
  // FMIR collaborator removed modal state (when owner removes current user from collaboration)
  const [showRemovedModal, setShowRemovedModal] = useState(false);
  const [removedReportNumber, setRemovedReportNumber] = useState('');
  const [removedByName, setRemovedByName] = useState('');
  const [removeCountdown, setRemoveCountdown] = useState(10);
  
  // Submit validation modal state
  const [showSubmitValidationModal, setShowSubmitValidationModal] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validationData, setValidationData] = useState<{
    canSubmit: boolean;
    validation: {
      isComplete: boolean;
      missingFields: { field: string; label: string; reason: string }[];
      hasEvidence: boolean;
      evidenceCount: number;
    };
    compliance: {
      overallCompliance: 'COMPLIANT' | 'NEEDS_IMPROVEMENT' | 'NON_COMPLIANT';
      complianceScore: number;
      summary: string;
      fieldAnalysis: { field: string; issue: string; recommendation: string }[];
      evidenceAnalysis: {
        adequate: boolean;
        summary: string;
        recommendations: string[];
      };
      aiExplanation: string;
    };
    evidenceRecommendations: string[];
  } | null>(null);
  
  // Password verification modal state (for submission)
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [verifyingPassword, setVerifyingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [enteredPassword, setEnteredPassword] = useState('');
  
  // Submitted by name (for success modal)
  const [submittedByName, setSubmittedByName] = useState('');
  
  // Real-time collaboration sync state
  const [lastSyncedBy, setLastSyncedBy] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  
  // Auto-save state
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(false);
  const [autoSaveLoaded, setAutoSaveLoaded] = useState(false);
  const [currentReportId, setCurrentReportId] = useState<string | null>(editId);
  const [autoSaving, setAutoSaving] = useState(false);
  const [lastAutoSaved, setLastAutoSaved] = useState<Date | null>(null);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pendingChangesRef = useRef<boolean>(false);

  // Section expansion state
  const [expandedSections, setExpandedSections] = useState<Record<number, boolean>>({
    1: true,
    2: true,
    3: false,
    4: false,
    5: false,
    6: false,
    7: false,
    8: false,
    9: false,
    10: false,
  });

  // Data state
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [fmSourceCategories, setFmSourceCategories] = useState<Category[]>([]);
  const [fmSourceTypes, setFmSourceTypes] = useState<Category[]>([]);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);

  // Evidence rename/crop modal state
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showCropModal, setShowCropModal] = useState(false);
  const [selectedEvidence, setSelectedEvidence] = useState<Evidence | null>(null);
  const [newFileName, setNewFileName] = useState('');
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState({ x: 0, y: 0 });
  const [selectionEnd, setSelectionEnd] = useState({ x: 0, y: 0 });
  const [hasSelection, setHasSelection] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0, naturalWidth: 0, naturalHeight: 0 });
  const cropCanvasRef = useRef<HTMLCanvasElement>(null);
  const cropImageRef = useRef<HTMLImageElement>(null);
  const cropContainerRef = useRef<HTMLDivElement>(null);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  
  // Video view/trim modal state
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [videoUrls, setVideoUrls] = useState<Record<string, string>>({});
  const [videoCurrentTime, setVideoCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [videoVolume, setVideoVolume] = useState(1);
  const [isSeeking, setIsSeeking] = useState(false);
  const [trimRange, setTrimRange] = useState({ start: 0, end: 0 });
  const [isTrimming, setIsTrimming] = useState(false);
  const [trimProgress, setTrimProgress] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoProgressRef = useRef<HTMLDivElement>(null);
  
  // Comment state
  const [sectionComments, setSectionComments] = useState<Record<number, any[]>>({});
  const [commentCounts, setCommentCounts] = useState<Record<number, number>>({});
  const [unreadCommentSections, setUnreadCommentSections] = useState<Record<number, boolean>>({});
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [commentModalSection, setCommentModalSection] = useState<{ number: number; title: string } | null>(null);
  const [showCommentPopup, setShowCommentPopup] = useState(false);
  const [commentPopupSection, setCommentPopupSection] = useState<number | null>(null);
  const [commentPopupPosition, setCommentPopupPosition] = useState<{ top: number; left: number } | null>(null);
  const [collaborators, setCollaborators] = useState<{ id: string; firstName: string; lastName: string; email: string; profilePicture?: string }[]>([]);
  
  const getUserInitials = useCallback(() => {
    if (!user) return '';
    const first = user.firstName?.charAt(0)?.toUpperCase() || '';
    const last = user.lastName?.charAt(0)?.toUpperCase() || '';
    return `${first}${last}`;
  }, [user]);

  // Use privilege-based access control
  const { hasPrivilege, loading: privilegesLoading } = usePrivileges();
  
  // Check create/edit privilege - if not editing and no create privilege, show access denied
  const canCreateFMIR = hasPrivilege(FMIR_PRIVILEGES.CREATE);
  const canEditFMIR = hasPrivilege(FMIR_PRIVILEGES.EDIT);
  
  // Permission checks for section editing
  // QA/Food Safety and Quality Control Manager can edit all sections
  const isQAFoodSafety = user?.role === 'QA_FOOD_SAFETY' || user?.role === 'QUALITY_CONTROL_MANAGER';
  // Quality Control Manager has additional privileges (Investigation, Close toggles)
  const isQualityControlManager = user?.role === 'QUALITY_CONTROL_MANAGER';
  // Check if user is the owner of the report
  const isReportOwner = !reportCreatedById || reportCreatedById === user?.id;
  // Sections 5-10 are restricted to QA/Food Safety and Quality Control Manager only
  // Owners and collaborators who are NOT QA/Food Safety can only edit sections 1-4 and upload evidence
  const canEditRestrictedSections = isQAFoodSafety;
  
  // Privilege-based checks
  const canAddComments = hasPrivilege(FMIR_PRIVILEGES.COMMENTS_ADD);
  const canViewComments = hasPrivilege(FMIR_PRIVILEGES.COMMENTS_VIEW);
  const canUploadEvidence = hasPrivilege(FMIR_PRIVILEGES.EVIDENCE_UPLOAD);
  const canDeleteEvidence = hasPrivilege(FMIR_PRIVILEGES.EVIDENCE_DELETE);
  const canSubmitFMIR = hasPrivilege(FMIR_PRIVILEGES.SUBMIT);
  const canUseAIValidation = hasPrivilege(FMIR_PRIVILEGES.AI_VALIDATE_SUBMIT);
  const canUseAITextEnhance = hasPrivilege(FMIR_PRIVILEGES.AI_ENHANCE_TEXT);

  // Get current date in YYYY-MM-DD format
  const getCurrentDate = useCallback(() => {
    return new Date().toISOString().split('T')[0];
  }, []);

  // Map form fields to their respective sections (sections with initials/date)
  const sectionFieldsMap: Record<number, string[]> = {
    2: ['foreignMaterialDescription', 'foreignMaterialSize', 'foreignMaterialHardness', 'isHardSharpOrLarge', 'unforeseeHazardFormRequired'],
    3: ['causeIdentification', 'possibleSource', 'howWhyOccurred'],
    4: ['correctiveAction'],
    5: ['verificationActions', 'maintenanceWorkCompleted', 'sanitationRequired', 'sanitationNotes'],
    6: ['productPlacedOnHold', 'itemsHeld', 'holdDecisionDetails', 'contaminationWindowDetails'],
    7: ['screeningProcess'],
    8: ['finalDisposition', 'dispositionVolume', 'dispositionJustification', 'dispositionDate', 'dispositionInitials'],
    9: ['preventionMeasures'],
  };

  // Auto-dismiss success toast after 5 seconds
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        setSuccess(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  // Get section number for a field name
  const getSectionForField = useCallback((fieldName: string): number | null => {
    for (const [section, fields] of Object.entries(sectionFieldsMap)) {
      if (fields.includes(fieldName)) {
        return parseInt(section);
      }
    }
    return null;
  }, []);

  useLayoutEffect(() => {
    if (!showSOPModal || !sopModalRef.current) return;
    const rect = sopModalRef.current.getBoundingClientRect();
    const margin = 12;
    setSopModalPos({
      x: Math.max(margin, Math.round((window.innerWidth - rect.width) / 2)),
      y: Math.max(margin, Math.round((window.innerHeight - rect.height) / 2)),
    });
  }, [showSOPModal]);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!sopDragRef.current.active || !sopModalRef.current) return;
      const rect = sopModalRef.current.getBoundingClientRect();
      const margin = 8;
      const maxX = Math.max(margin, window.innerWidth - rect.width - margin);
      const maxY = Math.max(margin, window.innerHeight - rect.height - margin);
      setSopModalPos({
        x: Math.min(maxX, Math.max(margin, e.clientX - sopDragRef.current.offsetX)),
        y: Math.min(maxY, Math.max(margin, e.clientY - sopDragRef.current.offsetY)),
      });
    };

    const onMouseUp = () => {
      sopDragRef.current.active = false;
      document.body.style.userSelect = '';
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  // Toggle section expansion
  const toggleSection = (section: number) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  // Section title map for comments
  const sectionTitles: Record<number, string> = {
    1: 'General Information',
    2: 'Describe the Foreign Material/Object',
    3: 'Identify the Cause of this Incident',
    4: 'Corrective Action Taken',
    5: 'Verification - Completed by QC',
    6: 'Was Product Placed on Hold?',
    7: 'Screening Process - Completed by QC',
    8: 'Final Disposition - Completed by QC',
    9: 'Prevention Measures - Completed by QC',
    10: 'Corporate Notification & Pre-Shipment',
  };

  // Open comment modal for a section
  const handleOpenCommentModal = (sectionNumber: number) => {
    setCommentModalSection({
      number: sectionNumber,
      title: sectionTitles[sectionNumber] || `Section ${sectionNumber}`,
    });
    setShowCommentModal(true);
  };

  // Open comment popup to view comments for a section
  const handleViewComments = (sectionNumber: number, event: React.MouseEvent) => {
    const rect = (event.target as HTMLElement).getBoundingClientRect();
    setCommentPopupSection(sectionNumber);
    setCommentPopupPosition({
      top: Math.min(rect.bottom + 8, window.innerHeight - 400),
      left: Math.min(rect.left, window.innerWidth - 400),
    });
    setShowCommentPopup(true);
  };

  // Refresh comments after adding or deleting
  const refreshComments = async () => {
    const currentEditId = currentReportId || editId;
    if (!currentEditId) return;

    try {
      const countsResponse = await api.get(`/fmir/${currentEditId}/comments/counts`);
      if (countsResponse.data.success) {
        setCommentCounts(countsResponse.data.data);
      }

      const commentsResponse = await api.get(`/fmir/${currentEditId}/comments`);
      if (commentsResponse.data.success) {
        const grouped: Record<number, any[]> = {};
        for (const comment of commentsResponse.data.data) {
          if (!grouped[comment.sectionNumber]) {
            grouped[comment.sectionNumber] = [];
          }
          grouped[comment.sectionNumber].push(comment);
        }
        setSectionComments(grouped);
      }
    } catch (err) {
      console.error('Error refreshing comments:', err);
    }
  };

  // Fetch facilities and departments
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [facilitiesRes, departmentsRes, categoriesRes, preferencesRes] = await Promise.all([
          api.get('/facilities'),
          api.get('/facilities/departments'),
          api.get('/categories?type=FOOD_SAFETY'),
          api.get('/preferences')
        ]);
        
        if (facilitiesRes.data.success) {
          // Facilities are nested in data.Facility
          const facilitiesData = facilitiesRes.data.data?.Facility || facilitiesRes.data.data;
          const facilitiesList = Array.isArray(facilitiesData) ? facilitiesData : [];
          setFacilities(facilitiesList);
          
          // Auto-select facility if not editing and no facility selected yet
          if (!editId && facilitiesList.length > 0) {
            // Use the first facility as default
            setFormData(prev => ({
              ...prev,
              facilityId: prev.facilityId || facilitiesList[0].id
            }));
          }
        }
        
        if (departmentsRes.data.success) {
          // Departments are nested in data.departments
          const departmentsData = departmentsRes.data.data?.departments || departmentsRes.data.data;
          setDepartments(Array.isArray(departmentsData) ? departmentsData : []);
        }
        
        if (categoriesRes.data.success) {
          // Get only the "Foreign Material" parent category for FMIR reports
          const allCategories = categoriesRes.data.data || [];
          const foreignMaterialCategories = allCategories.filter((cat: Category) => 
            cat.parentId === null && cat.name === 'Foreign Material'
          );
          setFmSourceCategories(foreignMaterialCategories);
        }
        
        // Set auto-save preference from user's saved preferences
        if (preferencesRes.data.success && preferencesRes.data.data) {
          setAutoSaveEnabled(preferencesRes.data.data.autoSaveEnabled || false);
        }
        setAutoSaveLoaded(true);
      } catch (err) {
        console.error('Error fetching data:', err);
        setFacilities([]);
        setDepartments([]);
        setFmSourceCategories([]);
        setAutoSaveLoaded(true);
      }
    };
    fetchData();
  }, []);

  // Fetch FM Source Types when category changes
  useEffect(() => {
    const fetchFmSourceTypes = async () => {
      if (!formData.fmSourceCategory) {
        setFmSourceTypes([]);
        return;
      }
      
      // Find the selected category to get its ID
      const selectedCategory = fmSourceCategories.find(cat => cat.name === formData.fmSourceCategory);
      if (!selectedCategory) {
        setFmSourceTypes([]);
        return;
      }
      
      try {
        const response = await api.get(`/categories?type=FOOD_SAFETY&parentId=${selectedCategory.id}`);
        if (response.data.success) {
          setFmSourceTypes(response.data.data || []);
        }
      } catch (err) {
        console.error('Error fetching FM Source Types:', err);
        setFmSourceTypes([]);
      }
    };
    fetchFmSourceTypes();
  }, [formData.fmSourceCategory, fmSourceCategories]);

  // Fetch Areas when department changes
  useEffect(() => {
    const fetchAreas = async () => {
      if (!formData.department) {
        setAreas([]);
        return;
      }
      
      // Find the selected department to get its ID
      const selectedDepartment = departments.find(dept => dept.name === formData.department);
      if (!selectedDepartment) {
        setAreas([]);
        return;
      }
      
      try {
        const response = await api.get(`/facilities/areas?departmentId=${selectedDepartment.id}`);
        if (response.data.success) {
          const areasData = response.data.data?.areas || [];
          setAreas(Array.isArray(areasData) ? areasData : []);
        }
      } catch (err) {
        console.error('Error fetching Areas:', err);
        setAreas([]);
      }
    };
    fetchAreas();
  }, [formData.department, departments]);

  // Fetch Lines when area changes
  useEffect(() => {
    const fetchLines = async () => {
      if (!formData.area) {
        setLines([]);
        return;
      }
      
      // Find the selected area to get its ID
      const selectedArea = areas.find(a => a.name === formData.area);
      if (!selectedArea) {
        setLines([]);
        return;
      }
      
      try {
        const response = await api.get(`/facilities/lines?areaId=${selectedArea.id}`);
        if (response.data.success) {
          const linesData = response.data.data?.lines || [];
          setLines(Array.isArray(linesData) ? linesData : []);
        }
      } catch (err) {
        console.error('Error fetching Lines:', err);
        setLines([]);
      }
    };
    fetchLines();
  }, [formData.area, areas]);

  // Fetch existing report if editing
  useEffect(() => {
    const fetchReport = async () => {
      if (!editId) return;

      setLoading(true);
      try {
        const response = await api.get(`/fmir/${editId}`);
        if (response.data.success) {
          const report = response.data.data;
          
          // Check if the report is SUBMITTED - if so, show the investigation off modal
          // Users cannot edit SUBMITTED reports until QA starts investigation
          if (report.status === 'SUBMITTED') {
            setInvestigationOffReportNumber(report.reportNumber);
            setInvestigationOffByName('');
            setShowInvestigationOffModal(true);
            setLoading(false);
            return; // Don't load the form data since editing is not allowed
          }
          
          setIsEditMode(true);
          setReportNumber(report.reportNumber);
          setReportCreatedById(report.createdById || null);
          // Map FMIREvidence to Evidence with proper filePath
          const evidenceData = report.FMIREvidence || report.Evidence || [];
          setEvidence(evidenceData.map((e: any) => ({
            id: e.id,
            type: e.type,
            fileName: e.fileName,
            filePath: e.filePath || '',
            fileSize: e.fileSize,
            mimeType: e.mimeType,
            description: e.description,
            url: e.filePath,
          })));

          // Map report data to form data
          setFormData({
            incidentDate: report.incidentDate ? report.incidentDate.split('T')[0] : '',
            incidentTime: report.incidentTime || '',
            department: report.department || '',
            area: report.area || '',
            line: report.line || '',
            rawMaterialSource: report.rawMaterialSource || '',
            fmSourceCategory: report.fmSourceCategory || '',
            fmSourceType: report.fmSourceType || '',
            productName: report.productName || '',
            productItemNumber: report.productItemNumber || '',
            productCodeBatchLot: report.productCodeBatchLot || '',
            amount: report.amount || '',
            individualsInvolved: report.individualsInvolved || '',
            foreignMaterialDescription: report.foreignMaterialDescription || '',
            foreignMaterialSize: report.foreignMaterialSize || '',
            foreignMaterialHardness: report.foreignMaterialHardness || '',
            section2Initials: report.section2Initials || '',
            section2Date: report.section2Date ? report.section2Date.split('T')[0] : '',
            isHardSharpOrLarge: report.isHardSharpOrLarge || false,
            unforeseeHazardFormRequired: report.unforeseeHazardFormRequired || false,
            causeIdentification: report.causeIdentification || '',
            possibleSource: report.possibleSource || '',
            howWhyOccurred: report.howWhyOccurred || '',
            section3Initials: report.section3Initials || '',
            section3Date: report.section3Date ? report.section3Date.split('T')[0] : '',
            correctiveAction: report.correctiveAction || '',
            section4Initials: report.section4Initials || '',
            section4Date: report.section4Date ? report.section4Date.split('T')[0] : '',
            verificationActions: report.verificationActions || '',
            section5Initials: report.section5Initials || '',
            section5Date: report.section5Date ? report.section5Date.split('T')[0] : '',
            maintenanceWorkCompleted: report.maintenanceWorkCompleted || '',
            sanitationRequired: report.sanitationRequired || false,
            sanitationNotes: report.sanitationNotes || '',
            productPlacedOnHold: report.productPlacedOnHold || false,
            itemsHeld: report.itemsHeld || '',
            holdDecisionDetails: report.holdDecisionDetails || '',
            contaminationWindowDetails: report.contaminationWindowDetails || '',
            section6Initials: report.section6Initials || '',
            section6Date: report.section6Date ? report.section6Date.split('T')[0] : '',
            screeningProcess: report.screeningProcess || '',
            section7Initials: report.section7Initials || '',
            section7Date: report.section7Date ? report.section7Date.split('T')[0] : '',
            finalDisposition: report.finalDisposition || '',
            dispositionVolume: report.dispositionVolume || '',
            dispositionJustification: report.dispositionJustification || '',
            section8Initials: report.section8Initials || '',
            section8Date: report.section8Date ? report.section8Date.split('T')[0] : '',
            dispositionDate: report.dispositionDate ? report.dispositionDate.split('T')[0] : '',
            dispositionInitials: report.dispositionInitials || '',
            preventionMeasures: report.preventionMeasures || '',
            section9Initials: report.section9Initials || '',
            section9Date: report.section9Date ? report.section9Date.split('T')[0] : '',
            corporateNotified: report.corporateNotified || false,
            corporatePersonsNotified: report.corporatePersonsNotified || '',
            preShipmentReview: report.preShipmentReview || '',
            preShipmentReviewDate: report.preShipmentReviewDate
              ? report.preShipmentReviewDate.split('T')[0]
              : '',
            preShipmentSignatureRequired: report.preShipmentSignatureRequired || false,
            facilityId: report.facilityId || '',
            status: report.status || 'DRAFT',
          });
        }
      } catch (err: any) {
        console.error('Error fetching report:', err);
        // Check if this is a privilege error (403) - show modal instead of error toast
        if (!handlePrivilegeError(err, showAccessDenied, setError, 'Edit Foreign Material Report')) {
          setError(err.response?.data?.error || 'Failed to load report');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchReport();
  }, [editId]);

  // Auto-save function
  const performAutoSave = useCallback(async (dataToSave: FMIRFormData, reportId: string | null) => {
    if (!autoSaveEnabled) return;
    
    setAutoSaving(true);
    try {
      const payload = {
        ...dataToSave,
        status: 'DRAFT',
      };

      let response;
      if (reportId) {
        // Update existing report
        response = await api.put(`/fmir/${reportId}`, payload);
        // Update report number if it changed (e.g., facility changed)
        if (response.data.success && response.data.data.reportNumber) {
          setReportNumber(response.data.data.reportNumber);
        }
      } else {
        // Create new report
        response = await api.post('/fmir', payload);
        if (response.data.success && response.data.data.id) {
          // Update URL and state with new report ID
          setCurrentReportId(response.data.data.id);
          setIsEditMode(true);
          setReportNumber(response.data.data.reportNumber);
          // Update URL without navigation
          window.history.replaceState(null, '', `/fmir/new?edit=${response.data.data.id}`);
        }
      }

      if (response.data.success) {
        setLastAutoSaved(new Date());
        pendingChangesRef.current = false;
      }
    } catch (err: any) {
      console.error('Auto-save error:', err);
      // Don't show error for auto-save failures - just log
    } finally {
      setAutoSaving(false);
    }
  }, [autoSaveEnabled]);

  // Immediate save for QA-only fields (productPlacedOnHold, corporateNotified, maintenanceWorkCompleted)
  // These need instant sync for real-time collaboration - no debounce
  const saveQAFieldImmediately = useCallback(async (fieldName: string, fieldValue: boolean | string, updatedFormData: FMIRFormData) => {
    const reportId = currentReportId || editId;
    if (!reportId) return; // Can't save if no report exists yet
    
    console.log(`🔄 Immediate save for QA field: ${fieldName} = ${fieldValue}`);
    
    try {
      const payload = {
        ...updatedFormData,
        [fieldName]: fieldValue,
      };
      
      const response = await api.put(`/fmir/${reportId}`, payload);
      
      if (response.data.success) {
        setLastAutoSaved(new Date());
        pendingChangesRef.current = false;
        console.log(`✅ QA field ${fieldName} saved and WebSocket notified`);
      }
    } catch (err: any) {
      console.error('Error saving QA field:', err);
      // Check if this is a privilege error (403) - show modal instead of error toast
      if (!handlePrivilegeError(err, showAccessDenied, undefined, 'Edit Foreign Material Report')) {
        setError(`Failed to save ${fieldName} change`);
        setTimeout(() => setError(null), 3000);
      }
    }
  }, [currentReportId, editId, showAccessDenied]);

  // Debounced auto-save trigger
  const triggerAutoSave = useCallback((updatedFormData: FMIRFormData) => {
    if (!autoSaveEnabled) return;
    
    pendingChangesRef.current = true;
    
    // Clear existing timer
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    
    // Set new timer for debounced save (1.5 seconds delay)
    autoSaveTimerRef.current = setTimeout(() => {
      performAutoSave(updatedFormData, currentReportId);
    }, 1500);
  }, [autoSaveEnabled, currentReportId, performAutoSave]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, []);

  // Auto-save new report once facility is auto-selected (to generate report number)
  const initialSaveTriggered = useRef(false);
  useEffect(() => {
    // Only for new reports (not editing), once auto-save is loaded and enabled
    if (
      !editId && 
      !currentReportId && 
      autoSaveLoaded && 
      autoSaveEnabled && 
      formData.facilityId && 
      !initialSaveTriggered.current
    ) {
      initialSaveTriggered.current = true;
      // Trigger save after a short delay to ensure state is settled
      setTimeout(() => {
        performAutoSave(formData, null);
      }, 500);
    }
  }, [editId, currentReportId, autoSaveLoaded, autoSaveEnabled, formData.facilityId, formData, performAutoSave]);

  // Save pending changes before leaving
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (pendingChangesRef.current && autoSaveEnabled) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [autoSaveEnabled]);

  // Listen for FMIR visibility OFF event from owner (real-time modal notification)
  useEffect(() => {
    const unsubscribe = onFmirVisibilityOff((data: { reportId: string; reportNumber: string; ownerId: string; ownerName: string }) => {
      console.log('🚫 FMIR visibility OFF event received:', data);
      
      // Only show modal if this is the FMIR we're currently editing
      const currentEditId = currentReportId || editId;
      if (currentEditId && data.reportId === currentEditId) {
        // Don't show modal to the owner themselves
        if (data.ownerId !== user?.id) {
          setVisibilityOffOwnerName(data.ownerName);
          setVisibilityOffReportNumber(data.reportNumber);
          setShowVisibilityOffModal(true);
        }
      }
    });

    return () => unsubscribe();
  }, [onFmirVisibilityOff, currentReportId, editId, user?.id]);

  // Listen for FMIR updated event (real-time collaboration sync)
  useEffect(() => {
    const unsubscribe = onFmirUpdated((data: { reportId: string; reportNumber: string; updatedById: string; updatedByName: string; updateType: 'save' | 'submit'; newStatus?: string }) => {
      console.log('📝 FMIR updated event received:', data);
      
      // Only sync if this is the FMIR we're currently editing
      const currentEditId = currentReportId || editId;
      if (currentEditId && data.reportId === currentEditId) {
        // Don't sync if we're the one who made the update
        if (data.updatedById !== user?.id) {
          console.log(`🔄 Syncing FMIR data from ${data.updatedByName}...`);
          setLastSyncedBy(data.updatedByName);
          setLastSyncedAt(new Date());
          setIsSyncing(true);
          
          // If the report was submitted by someone else, show the Investigation Off modal
          // This informs the user they can no longer edit (NOT the success modal)
          if (data.updateType === 'submit' && data.newStatus === 'SUBMITTED') {
            setInvestigationOffReportNumber(data.reportNumber);
            setInvestigationOffByName(data.updatedByName);
            setShowInvestigationOffModal(true);
            // Also update the local form status
            setFormData(prev => ({ ...prev, status: 'SUBMITTED' }));
            setIsSyncing(false);
            return;
          }
          
          // Fetch the latest data
          api.get(`/fmir/${currentEditId}`)
            .then((response) => {
              if (response.data.success) {
                const report = response.data.data;
                // Update form data with the latest from server
                setFormData({
                  incidentDate: report.incidentDate ? report.incidentDate.split('T')[0] : new Date().toISOString().split('T')[0],
                  incidentTime: report.incidentTime || '',
                  department: report.department || '',
                  area: report.area || '',
                  line: report.line || '',
                  rawMaterialSource: report.rawMaterialSource || '',
                  fmSourceCategory: report.fmSourceCategory || '',
                  fmSourceType: report.fmSourceType || '',
                  productName: report.productName || '',
                  productItemNumber: report.productItemNumber || '',
                  productCodeBatchLot: report.productCodeBatchLot || '',
                  amount: report.amount || '',
                  individualsInvolved: report.individualsInvolved || '',
                  foreignMaterialDescription: report.foreignMaterialDescription || '',
                  foreignMaterialSize: report.foreignMaterialSize || '',
                  foreignMaterialHardness: report.foreignMaterialHardness || '',
                  section2Initials: report.section2Initials || '',
                  section2Date: report.section2Date ? report.section2Date.split('T')[0] : '',
                  isHardSharpOrLarge: report.isHardSharpOrLarge || false,
                  unforeseeHazardFormRequired: report.unforeseeHazardFormRequired || false,
                  causeIdentification: report.causeIdentification || '',
                  possibleSource: report.possibleSource || '',
                  howWhyOccurred: report.howWhyOccurred || '',
                  section3Initials: report.section3Initials || '',
                  section3Date: report.section3Date ? report.section3Date.split('T')[0] : '',
                  correctiveAction: report.correctiveAction || '',
                  section4Initials: report.section4Initials || '',
                  section4Date: report.section4Date ? report.section4Date.split('T')[0] : '',
                  verificationActions: report.verificationActions || '',
                  section5Initials: report.section5Initials || '',
                  section5Date: report.section5Date ? report.section5Date.split('T')[0] : '',
                  maintenanceWorkCompleted: report.maintenanceWorkCompleted || '',
                  sanitationRequired: report.sanitationRequired || false,
                  sanitationNotes: report.sanitationNotes || '',
                  productPlacedOnHold: report.productPlacedOnHold || false,
                  itemsHeld: report.itemsHeld || '',
                  holdDecisionDetails: report.holdDecisionDetails || '',
                  contaminationWindowDetails: report.contaminationWindowDetails || '',
                  section6Initials: report.section6Initials || '',
                  section6Date: report.section6Date ? report.section6Date.split('T')[0] : '',
                  screeningProcess: report.screeningProcess || '',
                  section7Initials: report.section7Initials || '',
                  section7Date: report.section7Date ? report.section7Date.split('T')[0] : '',
                  finalDisposition: report.finalDisposition || '',
                  dispositionVolume: report.dispositionVolume || '',
                  dispositionJustification: report.dispositionJustification || '',
                  section8Initials: report.section8Initials || '',
                  section8Date: report.section8Date ? report.section8Date.split('T')[0] : '',
                  dispositionDate: report.dispositionDate ? report.dispositionDate.split('T')[0] : '',
                  dispositionInitials: report.dispositionInitials || '',
                  preventionMeasures: report.preventionMeasures || '',
                  section9Initials: report.section9Initials || '',
                  section9Date: report.section9Date ? report.section9Date.split('T')[0] : '',
                  corporateNotified: report.corporateNotified || false,
                  corporatePersonsNotified: report.corporatePersonsNotified || '',
                  preShipmentReview: report.preShipmentReview || '',
                  preShipmentReviewDate: report.preShipmentReviewDate ? report.preShipmentReviewDate.split('T')[0] : '',
                  preShipmentSignatureRequired: report.preShipmentSignatureRequired || false,
                  facilityId: report.facilityId || '',
                  status: report.status || 'DRAFT',
                });
                
                // Update evidence if included
                if (report.FMIREvidence || report.Evidence) {
                  const evidenceData = report.FMIREvidence || report.Evidence || [];
                  setEvidence(evidenceData.map((e: any) => ({
                    id: e.id,
                    type: e.type,
                    fileName: e.fileName,
                    filePath: e.filePath || '',
                    fileSize: e.fileSize,
                    mimeType: e.mimeType,
                    description: e.description,
                    url: e.filePath,
                  })));
                }
                
                // Update report number
                if (report.reportNumber) {
                  setReportNumber(report.reportNumber);
                }
                
                // Clear pending changes since we just synced
                pendingChangesRef.current = false;
              }
            })
            .catch((err) => {
              console.error('Failed to sync FMIR data:', err);
            })
            .finally(() => {
              setIsSyncing(false);
              // Clear the synced by name after a short delay
              setTimeout(() => {
                setLastSyncedBy(null);
                setLastSyncedAt(null);
              }, 5000);
            });
        }
      }
    });

    return () => unsubscribe();
  }, [onFmirUpdated, currentReportId, editId, user?.id]);

  // Listen for FMIR closed status changed event (when QA locks/unlocks the report)
  useEffect(() => {
    const unsubscribe = onFmirClosedStatusChanged((data: { reportId: string; reportNumber: string; isClosed: boolean; closedById: string | null; closedAt: string | null }) => {
      console.log('🔒 FMIR closed status changed event received:', data);
      
      // Only handle if this is the FMIR we're currently editing
      const currentEditId = currentReportId || editId;
      if (currentEditId && data.reportId === currentEditId) {
        if (data.isClosed) {
          // Report was locked by QA - show modal and redirect
          setLockedReportNumber(data.reportNumber);
          setShowLockedModal(true);
        }
      }
    });

    return () => unsubscribe();
  }, [onFmirClosedStatusChanged, currentReportId, editId]);

  // Listen for FMIR status changed event (when QA toggles investigation on/off)
  useEffect(() => {
    const unsubscribe = onFmirStatusChanged((data: { reportId: string; reportNumber: string; previousStatus: string; newStatus: string; statusDisplay: string; changedBy: string; changedById: string; notes: string | null; timestamp: string }) => {
      console.log('📊 FMIR status changed event received:', data);
      
      // Only handle if this is the FMIR we're currently editing
      const currentEditId = currentReportId || editId;
      if (currentEditId && data.reportId === currentEditId) {
        // If investigation was turned off (status changed to SUBMITTED from UNDER_INVESTIGATION)
        // Show the investigation off modal to inform the user
        if (data.previousStatus === 'UNDER_INVESTIGATION' && data.newStatus === 'SUBMITTED') {
          setInvestigationOffReportNumber(data.reportNumber);
          setInvestigationOffByName(data.changedBy);
          setShowInvestigationOffModal(true);
          // Also update the local form status
          setFormData(prev => ({ ...prev, status: 'SUBMITTED' }));
        }
        // If investigation was turned on (status changed to UNDER_INVESTIGATION)
        // Update the form status to allow editing
        else if (data.newStatus === 'UNDER_INVESTIGATION') {
          setFormData(prev => ({ ...prev, status: 'UNDER_INVESTIGATION' }));
        }
      }
    });

    return () => unsubscribe();
  }, [onFmirStatusChanged, currentReportId, editId]);

  // Listen for FMIR deleted event (when QA deletes the report)
  useEffect(() => {
    const unsubscribe = onFmirDeleted((data: { reportId: string; reportNumber: string; deletedById: string; deletedByName: string }) => {
      console.log('🗑️ FMIR deleted event received:', data);
      
      // Only handle if this is the FMIR we're currently editing
      const currentEditId = currentReportId || editId;
      if (currentEditId && data.reportId === currentEditId) {
        // Report was deleted by QA - show modal
        setDeletedReportNumber(data.reportNumber);
        setDeletedByName(data.deletedByName);
        setDeleteCountdown(10);
        setShowDeletedModal(true);
      }
    });

    return () => unsubscribe();
  }, [onFmirDeleted, currentReportId, editId]);

  // Listen for FMIR collaborator removed event (when owner removes current user from collaboration)
  useEffect(() => {
    const unsubscribe = onFmirCollaboratorRemoved((data: { reportId: string; reportNumber: string; removedUserId: string; removedByName: string }) => {
      console.log('👤 FMIR collaborator removed event received:', data);
      
      // Only handle if this is the FMIR we're currently editing and current user was removed
      const currentEditId = currentReportId || editId;
      if (currentEditId && data.reportId === currentEditId && data.removedUserId === user?.id) {
        // User was removed from collaboration - show modal
        setRemovedReportNumber(data.reportNumber);
        setRemovedByName(data.removedByName);
        setRemoveCountdown(10);
        setShowRemovedModal(true);
      }
    });

    return () => unsubscribe();
  }, [onFmirCollaboratorRemoved, currentReportId, editId, user?.id]);

  // Listen for FMIR evidence updated event (real-time evidence sync)
  useEffect(() => {
    const unsubscribe = onFmirEvidenceUpdated((data: { reportId: string; reportNumber: string; action: 'upload' | 'delete'; evidence?: any[]; evidenceId?: string; updatedById: string; updatedByName: string }) => {
      console.log('📎 FMIR evidence updated event received:', data);
      
      // Only sync if this is the FMIR we're currently editing
      const currentEditId = currentReportId || editId;
      if (currentEditId && data.reportId === currentEditId) {
        // Don't sync if we're the one who made the update
        if (data.updatedById !== user?.id) {
          console.log(`📎 Syncing evidence from ${data.updatedByName}...`);
          
          if (data.action === 'upload' && data.evidence) {
            // Add new evidence
            setEvidence((prev) => [...prev, ...data.evidence!]);
          } else if (data.action === 'delete' && data.evidenceId) {
            // Remove deleted evidence
            setEvidence((prev) => prev.filter((e) => e.id !== data.evidenceId));
          }
        }
      }
    });

    return () => unsubscribe();
  }, [onFmirEvidenceUpdated, currentReportId, editId, user?.id]);

  // Fetch comments and collaborators when report is loaded
  useEffect(() => {
    const fetchCommentsAndCollaborators = async () => {
      const currentEditId = currentReportId || editId;
      if (!currentEditId) return;

      try {
        // Fetch comment counts
        const countsResponse = await api.get(`/fmir/${currentEditId}/comments/counts`);
        if (countsResponse.data.success) {
          setCommentCounts(countsResponse.data.data);
        }

        // Fetch all comments
        const commentsResponse = await api.get(`/fmir/${currentEditId}/comments`);
        if (commentsResponse.data.success) {
          // Group comments by section
          const grouped: Record<number, any[]> = {};
          for (const comment of commentsResponse.data.data) {
            if (!grouped[comment.sectionNumber]) {
              grouped[comment.sectionNumber] = [];
            }
            grouped[comment.sectionNumber].push(comment);
          }
          setSectionComments(grouped);
        }

        // Fetch collaborators
        const reportResponse = await api.get(`/fmir/${currentEditId}`);
        if (reportResponse.data.success) {
          const report = reportResponse.data.data;
          const collabList: any[] = [];
          
          // Add owner (field name from Prisma: User_ForeignMaterialIncident_createdByIdToUser)
          const owner = report.User_ForeignMaterialIncident_createdByIdToUser || report.createdBy;
          if (owner) {
            collabList.push({
              id: owner.id,
              firstName: owner.firstName,
              lastName: owner.lastName,
              email: owner.email,
              profilePicture: owner.profilePicture,
            });
          }
          
          // Add collaborators (field name from backend: Collaborators with capital C)
          const collaboratorList = report.Collaborators || report.collaborators || [];
          if (collaboratorList) {
            for (const collab of collaboratorList) {
              if (collab.id !== owner?.id) {
                collabList.push({
                  id: collab.id,
                  firstName: collab.firstName,
                  lastName: collab.lastName,
                  email: collab.email,
                  profilePicture: collab.profilePicture,
                });
              }
            }
          }
          
          setCollaborators(collabList);
        }
      } catch (err) {
        console.error('Error fetching comments:', err);
      }
    };

    fetchCommentsAndCollaborators();
  }, [currentReportId, editId]);

  // Listen for FMIR comment added event (real-time comment sync)
  useEffect(() => {
    const unsubscribe = onFmirCommentAdded((data: { reportId: string; reportNumber: string; comment: any; addedByName: string }) => {
      console.log('💬 FMIR comment added event received:', data);
      
      const currentEditId = currentReportId || editId;
      if (currentEditId && data.reportId === currentEditId) {
        // Add the new comment to the appropriate section
        setSectionComments((prev) => {
          const section = data.comment.sectionNumber;
          const existing = prev[section] || [];
          return {
            ...prev,
            [section]: [...existing, data.comment],
          };
        });
        
        // Update comment count
        setCommentCounts((prev) => ({
          ...prev,
          [data.comment.sectionNumber]: (prev[data.comment.sectionNumber] || 0) + 1,
        }));
        
        // Mark section as having unread comments (will glitter until clicked)
        setUnreadCommentSections((prev) => ({
          ...prev,
          [data.comment.sectionNumber]: true,
        }));
      }
    });

    return () => unsubscribe();
  }, [onFmirCommentAdded, currentReportId, editId]);

  // Listen for FMIR comment deleted event (real-time comment sync)
  useEffect(() => {
    const unsubscribe = onFmirCommentDeleted((data: { reportId: string; reportNumber: string; commentId: string; sectionNumber: number; deletedByName: string }) => {
      console.log('🗑️ FMIR comment deleted event received:', data);
      
      const currentEditId = currentReportId || editId;
      if (currentEditId && data.reportId === currentEditId) {
        // Remove the comment from the appropriate section
        setSectionComments((prev) => {
          const section = data.sectionNumber;
          const existing = prev[section] || [];
          return {
            ...prev,
            [section]: existing.filter((c) => c.id !== data.commentId),
          };
        });
        
        // Update comment count
        setCommentCounts((prev) => ({
          ...prev,
          [data.sectionNumber]: Math.max((prev[data.sectionNumber] || 0) - 1, 0),
        }));
      }
    });

    return () => unsubscribe();
  }, [onFmirCommentDeleted, currentReportId, editId]);

  // Countdown timer for deleted modal
  useEffect(() => {
    if (showDeletedModal && deleteCountdown > 0) {
      const timer = setTimeout(() => {
        setDeleteCountdown(prev => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (showDeletedModal && deleteCountdown === 0) {
      // Redirect to FMIR list when countdown reaches 0
      router.push('/fmir');
    }
  }, [showDeletedModal, deleteCountdown, router]);

  // Countdown timer for removed from collaboration modal
  useEffect(() => {
    if (showRemovedModal && removeCountdown > 0) {
      const timer = setTimeout(() => {
        setRemoveCountdown(prev => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (showRemovedModal && removeCountdown === 0) {
      // Redirect to FMIR list when countdown reaches 0
      router.push('/fmir');
    }
  }, [showRemovedModal, removeCountdown, router]);

  // Handle save and close from visibility off modal
  const handleSaveAndCloseFromModal = async () => {
    setSavingBeforeClose(true);
    setError(null);

    try {
      const payload = {
        ...formData,
        status: 'DRAFT',
      };

      const reportId = currentReportId || editId;
      if (reportId) {
        await api.put(`/fmir/${reportId}`, payload);
      }
      // Navigate to FMIR list page
      router.push('/fmir');
    } catch (err: any) {
      console.error('Error saving before close:', err);
      // Check if this is a privilege error (403) - show modal instead of error toast
      if (!handlePrivilegeError(err, showAccessDenied, undefined, 'Edit Foreign Material Report')) {
        setError(err.response?.data?.error || 'Failed to save. Redirecting anyway...');
        // Even if save fails, redirect after a short delay
        setTimeout(() => {
          router.push('/fmir');
        }, 1500);
      }
    } finally {
      setSavingBeforeClose(false);
    }
  };

  // Handle close without saving from visibility off modal
  const handleCloseWithoutSaving = () => {
    router.push('/fmir');
  };

  // Handle input change
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    let newFormData = {
      ...formData,
      [name]: type === 'checkbox' ? checked : value,
    };

    // Auto-update section initials and date if this field belongs to a section with signature
    const sectionNumber = getSectionForField(name);
    if (sectionNumber && user) {
      const initialsKey = `section${sectionNumber}Initials` as keyof FMIRFormData;
      const dateKey = `section${sectionNumber}Date` as keyof FMIRFormData;
      newFormData = {
        ...newFormData,
        [initialsKey]: getUserInitials(),
        [dateKey]: getCurrentDate(),
      };
    }

    setFormData(newFormData);
    
    // Trigger auto-save if enabled
    if (autoSaveEnabled) {
      triggerAutoSave(newFormData);
    }
  };

  // Handle checkbox change (for non-input checkboxes)
  const handleCheckboxChange = (name: string, checked: boolean) => {
    let newFormData = {
      ...formData,
      [name]: checked,
    };
    
    // Auto-update section initials and date if this field belongs to a section with signature
    const sectionNumber = getSectionForField(name);
    if (sectionNumber && user) {
      const initialsKey = `section${sectionNumber}Initials` as keyof FMIRFormData;
      const dateKey = `section${sectionNumber}Date` as keyof FMIRFormData;
      newFormData = {
        ...newFormData,
        [initialsKey]: getUserInitials(),
        [dateKey]: getCurrentDate(),
      };
    }
    
    setFormData(newFormData);
    
    // Trigger auto-save if enabled
    if (autoSaveEnabled) {
      triggerAutoSave(newFormData);
    }
  };

  // Handle select change (for dropdowns)
  const handleSelectChange = (name: string, value: string) => {
    let newFormData = {
      ...formData,
      [name]: value,
    };
    
    // Auto-update section initials and date if this field belongs to a section with signature
    const sectionNumber = getSectionForField(name);
    if (sectionNumber && user) {
      const initialsKey = `section${sectionNumber}Initials` as keyof FMIRFormData;
      const dateKey = `section${sectionNumber}Date` as keyof FMIRFormData;
      newFormData = {
        ...newFormData,
        [initialsKey]: getUserInitials(),
        [dateKey]: getCurrentDate(),
      };
    }
    
    setFormData(newFormData);
    
    // Trigger auto-save if enabled
    if (autoSaveEnabled) {
      triggerAutoSave(newFormData);
    }
  };

  // Save as draft (manual save - uses same logic as auto-save)
  const handleSaveDraft = async () => {
    // Don't allow manual save if auto-save is enabled
    if (autoSaveEnabled) return;
    
    setAutoSaving(true);
    setError(null);

    try {
      const payload = {
        ...formData,
        status: 'DRAFT',
      };

      let response;
      const reportId = currentReportId || editId;
      if (reportId) {
        response = await api.put(`/fmir/${reportId}`, payload);
      } else {
        response = await api.post('/fmir', payload);
      }

      if (response.data.success) {
        setLastAutoSaved(new Date());
        pendingChangesRef.current = false;
        
        // Always update report number in case facility changed
        if (response.data.data.reportNumber) {
          setReportNumber(response.data.data.reportNumber);
        }
        
        if (!currentReportId && response.data.data.id) {
          setCurrentReportId(response.data.data.id);
          setIsEditMode(true);
          window.history.replaceState(null, '', `/fmir/new?edit=${response.data.data.id}`);
        }
      }
    } catch (err: any) {
      console.error('Error saving draft:', err);
      // Check if this is a privilege error (403) - show modal instead of error toast
      if (!handlePrivilegeError(err, showAccessDenied, setError, 'Save Foreign Material Report')) {
        setError(err.response?.data?.error || 'Failed to save draft');
      }
    } finally {
      setAutoSaving(false);
    }
  };

  // Check if required fields are filled for submission
  const canSubmit = !!(formData.foreignMaterialDescription.trim() && formData.facilityId);

  // Check if form is FULLY complete (stricter check for when auto-save is on)
  // All essential fields must be filled for the report to be considered complete
  const isFormFullyComplete = !!(
    // Section 1: Basic Information
    formData.incidentDate &&
    formData.incidentTime &&
    formData.facilityId &&
    formData.department &&
    formData.area &&
    formData.line &&
    formData.fmSourceCategory &&
    formData.fmSourceType &&
    formData.productName.trim() &&
    formData.productItemNumber.trim() &&
    formData.productCodeBatchLot.trim() &&
    formData.amount.trim() &&
    
    // Section 2: Foreign Material Description
    formData.foreignMaterialDescription.trim() &&
    formData.foreignMaterialSize.trim() &&
    formData.foreignMaterialHardness.trim() &&
    
    // Section 3: Cause Identification (possibleSource and howWhyOccurred removed - covered by causeIdentification)
    formData.causeIdentification.trim() &&
    
    // Section 4: Corrective Action
    formData.correctiveAction.trim() &&
    
    // Section 5: Verification
    formData.verificationActions.trim() &&
    
    // Section 6: Product Hold (decision must be documented, items held required if product placed on hold)
    formData.holdDecisionDetails.trim() &&
    (!formData.productPlacedOnHold || formData.itemsHeld.trim()) &&
    
    // Section 7: Screening Process
    formData.screeningProcess.trim() &&
    
    // Section 8: Final Disposition
    formData.finalDisposition.trim() &&
    formData.dispositionJustification.trim() &&
    
    // Section 9: Prevention Measures
    formData.preventionMeasures.trim() &&
    
    // Section 10: Corporate Notification & Pre-Shipment
    // corporateNotified is always set (boolean - true or false) - no additional check needed
    // If corporateNotified is true, corporatePersonsNotified is required
    // If productPlacedOnHold is true, preShipmentReview is required
    (!formData.corporateNotified || formData.corporatePersonsNotified.trim()) &&
    (!formData.productPlacedOnHold || formData.preShipmentReview.trim())
  );

  // Debug: Log which fields are missing (only in development)
  if (process.env.NODE_ENV === 'development' && !isFormFullyComplete && autoSaveEnabled) {
    const missingFields: string[] = [];
    if (!formData.incidentDate) missingFields.push('incidentDate');
    if (!formData.incidentTime) missingFields.push('incidentTime');
    if (!formData.facilityId) missingFields.push('facilityId');
    if (!formData.department) missingFields.push('department');
    if (!formData.area) missingFields.push('area');
    if (!formData.line) missingFields.push('line');
    if (!formData.fmSourceCategory) missingFields.push('fmSourceCategory');
    if (!formData.fmSourceType) missingFields.push('fmSourceType');
    if (!formData.productName.trim()) missingFields.push('productName');
    if (!formData.productItemNumber.trim()) missingFields.push('productItemNumber');
    if (!formData.productCodeBatchLot.trim()) missingFields.push('productCodeBatchLot');
    if (!formData.amount.trim()) missingFields.push('amount');
    if (!formData.foreignMaterialDescription.trim()) missingFields.push('foreignMaterialDescription');
    if (!formData.foreignMaterialSize.trim()) missingFields.push('foreignMaterialSize');
    if (!formData.foreignMaterialHardness.trim()) missingFields.push('foreignMaterialHardness');
    if (!formData.causeIdentification.trim()) missingFields.push('causeIdentification');
    if (!formData.correctiveAction.trim()) missingFields.push('correctiveAction');
    if (!formData.verificationActions.trim()) missingFields.push('verificationActions');
    if (!formData.holdDecisionDetails.trim()) missingFields.push('holdDecisionDetails');
    if (formData.productPlacedOnHold && !formData.itemsHeld.trim()) missingFields.push('itemsHeld (required when product on hold)');
    if (!formData.screeningProcess.trim()) missingFields.push('screeningProcess');
    if (!formData.finalDisposition.trim()) missingFields.push('finalDisposition');
    if (!formData.dispositionJustification.trim()) missingFields.push('dispositionJustification');
    if (!formData.preventionMeasures.trim()) missingFields.push('preventionMeasures');
    if (formData.corporateNotified && !formData.corporatePersonsNotified.trim()) missingFields.push('corporatePersonsNotified (required when corporate notified)');
    if (formData.productPlacedOnHold && !formData.preShipmentReview.trim()) missingFields.push('preShipmentReview (required when product on hold)');
    if (missingFields.length > 0) {
      console.log('🚫 Form incomplete. Missing fields:', missingFields);
    }
  }

  // Show submit button: Always when Auto Save OFF, only when fully complete when Auto Save ON
  // Hide submit button when status is UNDER_INVESTIGATION (show Validate instead)
  const showSubmitButton = formData.status !== 'UNDER_INVESTIGATION' && (!autoSaveEnabled || (autoSaveEnabled && isFormFullyComplete && currentReportId));
  
  // Debug logging for submit button visibility
  console.log('📋 Submit Button Debug:', {
    showSubmitButton,
    status: formData.status,
    autoSaveEnabled,
    isFormFullyComplete,
    currentReportId,
    corporateNotified: formData.corporateNotified,
    productPlacedOnHold: formData.productPlacedOnHold,
  });
  
  // Show validate button: Only when status is UNDER_INVESTIGATION
  const showValidateButton = formData.status === 'UNDER_INVESTIGATION';

  // Initiate submit - first validate with AI
  const handleInitiateSubmit = async () => {
    // First save the current state
    if (currentReportId) {
      await handleSaveDraft();
    }

    setValidating(true);
    setShowSubmitValidationModal(true);
    setValidationData(null);

    try {
      const reportId = currentReportId || editId;
      if (!reportId) {
        // Need to save first
        const payload = { ...formData };
        const response = await api.post('/fmir', payload);
        if (response.data.success) {
          setCurrentReportId(response.data.data.id);
          setReportNumber(response.data.data.reportNumber);
          window.history.replaceState(null, '', `/fmir/new?edit=${response.data.data.id}`);
          
          // Now validate
          const validationResponse = await api.post(`/fmir/${response.data.data.id}/validate-for-submit`);
          if (validationResponse.data.success) {
            setValidationData(validationResponse.data.data);
          }
        }
      } else {
        const validationResponse = await api.post(`/fmir/${reportId}/validate-for-submit`);
        if (validationResponse.data.success) {
          setValidationData(validationResponse.data.data);
        }
      }
    } catch (err: any) {
      console.error('Error validating report:', err);
      setError(err.response?.data?.error || 'Failed to validate report');
      setShowSubmitValidationModal(false);
    } finally {
      setValidating(false);
    }
  };

  // Submit report (called after password verification)
  const handleSubmit = async () => {
    // Close the password modal
    setShowPasswordModal(false);
    setEnteredPassword('');
    setPasswordError('');
    
    // Validate required fields
    if (!formData.foreignMaterialDescription.trim()) {
      setError('Please describe the foreign material');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const payload = {
        ...formData,
        status: 'SUBMITTED',
      };

      let response;
      const reportId = currentReportId || editId;
      
      // Prepare validation data payload to save AI analysis
      const submitPayload = validationData ? { validationData } : {};
      
      if (reportId) {
        response = await api.put(`/fmir/${reportId}`, payload);
        // Also submit with validation data
        await api.post(`/fmir/${reportId}/submit`, submitPayload);
      } else {
        response = await api.post('/fmir', payload);
        if (response.data.success) {
          await api.post(`/fmir/${response.data.data.id}/submit`, submitPayload);
        }
      }

      pendingChangesRef.current = false;
      // Set the submitter's name for success modal
      const userName = user?.firstName && user?.lastName 
        ? `${user.firstName} ${user.lastName}` 
        : user?.email || 'Unknown User';
      setSubmittedByName(userName);
      setShowSuccessModal(true);
    } catch (err: any) {
      console.error('Error submitting report:', err);
      // Check if this is a privilege error (403) - show modal instead of error toast
      if (handlePrivilegeError(err, showAccessDenied, undefined, 'Submit Foreign Material Report')) {
        return;
      }
      
      const errorMessage = err.response?.data?.error || 'Failed to submit report';
      
      // Check if error is "already submitted" and show special modal
      if (errorMessage.toLowerCase().includes('already been submitted') || errorMessage.toLowerCase().includes('already submitted')) {
        setShowAlreadySubmittedModal(true);
      } else {
        setError(errorMessage);
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Handle password verification before submission
  const handlePasswordVerification = async () => {
    if (!enteredPassword.trim()) {
      setPasswordError('Please enter your password');
      return;
    }

    setVerifyingPassword(true);
    setPasswordError('');

    try {
      await api.post('/auth/verify-password', { password: enteredPassword });

      // Password verified, proceed with submission
      handleSubmit();
    } catch (err: any) {
      console.error('Error verifying password:', err);
      setPasswordError(err.response?.data?.error || err.message || 'Failed to verify password');
    } finally {
      setVerifyingPassword(false);
    }
  };

  // Open password modal (called from validation modal)
  // Owner doesn't need password verification, only linked users
  const handleProceedToSubmit = () => {
    setShowSubmitValidationModal(false);
    
    // Check if the report has already been submitted
    if (formData.status === 'SUBMITTED') {
      // Show resubmit warning modal instead of proceeding directly
      setShowResubmitWarningModal(true);
      return;
    }
    
    // If user is the owner of the report (or it's a new report), skip password verification
    const isOwner = !reportCreatedById || reportCreatedById === user?.id;
    if (isOwner) {
      // Owner can submit directly
      handleSubmit();
    } else {
      // Linked users need password verification
      setShowPasswordModal(true);
      setEnteredPassword('');
      setPasswordError('');
    }
  };
  
  // Handle proceeding with resubmit after warning
  const handleProceedWithResubmit = () => {
    setShowResubmitWarningModal(false);
    
    // If user is the owner of the report (or it's a new report), skip password verification
    const isOwner = !reportCreatedById || reportCreatedById === user?.id;
    if (isOwner) {
      // Owner can submit directly
      handleSubmit();
    } else {
      // Linked users need password verification
      setShowPasswordModal(true);
      setEnteredPassword('');
      setPasswordError('');
    }
  };
  
  // Handle creating a new report from resubmit warning
  const handleCreateNewReport = () => {
    setShowResubmitWarningModal(false);
    // Reset form to create a new report
    setFormData(initialFormData);
    setEvidence([]);
    setCurrentReportId(null);
    setReportNumber(null);
    setReportCreatedById(null);
    setIsEditMode(false);
    // Remove edit query param from URL
    router.push('/fmir/new');
    setSuccess('Ready to create a new FMIR report');
  };

  // File upload handler - uploads files directly without conversion
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const reportId = currentReportId || editId;
    if (!e.target.files) return;
    
    // If no report exists yet, create one first
    if (!reportId) {
      setError('Please save the report first before uploading files, or enable Auto Save.');
      e.target.value = '';
      return;
    }

    setUploadingFiles(true);
    const files = Array.from(e.target.files);
    const formDataUpload = new FormData();

    files.forEach((file) => {
      formDataUpload.append('files', file);
    });

    try {
      const response = await api.post(`/fmir/${reportId}/evidence`, formDataUpload, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.data.success) {
        setEvidence((prev) => [...prev, ...response.data.data]);
        setSuccess('Files uploaded successfully');
        // Update last auto-saved time since evidence is saved
        if (autoSaveEnabled) {
          setLastAutoSaved(new Date());
        }
      }
    } catch (err: any) {
      console.error('Error uploading files:', err);
      // Check if this is a privilege error (403) - show modal instead of error toast
      if (!handlePrivilegeError(err, showAccessDenied, setError, 'Upload Evidence')) {
        setError(err.response?.data?.error || 'Failed to upload files');
      }
    } finally {
      setUploadingFiles(false);
      e.target.value = '';
    }
  };

  // Delete evidence
  const handleDeleteEvidence = async (evidenceId: string) => {
    const reportId = currentReportId || editId;
    if (!reportId || !confirm('Are you sure you want to delete this file?')) return;

    try {
      await api.delete(`/fmir/${reportId}/evidence/${evidenceId}`);
      setEvidence((prev) => prev.filter((e) => e.id !== evidenceId));
      setSuccess('File deleted successfully');
      // Update last auto-saved time
      if (autoSaveEnabled) {
        setLastAutoSaved(new Date());
      }
    } catch (err: any) {
      console.error('Error deleting evidence:', err);
      // Check if this is a privilege error (403) - show modal instead of error toast
      if (!handlePrivilegeError(err, showAccessDenied, setError, 'Delete Evidence')) {
        setError(err.response?.data?.error || 'Failed to delete file');
      }
    }
  };

  // Open rename modal
  const openRenameModal = (file: Evidence) => {
    setSelectedEvidence(file);
    // Extract filename without extension
    const lastDotIndex = file.fileName.lastIndexOf('.');
    const nameWithoutExt = lastDotIndex > 0 ? file.fileName.substring(0, lastDotIndex) : file.fileName;
    setNewFileName(nameWithoutExt);
    setShowRenameModal(true);
  };

  // Handle rename evidence
  const handleRenameEvidence = async () => {
    if (!selectedEvidence || !newFileName.trim()) return;
    
    const reportId = currentReportId || editId;
    if (!reportId) return;

    // Get file extension
    const lastDotIndex = selectedEvidence.fileName.lastIndexOf('.');
    const extension = lastDotIndex > 0 ? selectedEvidence.fileName.substring(lastDotIndex) : '';
    const fullNewName = newFileName.trim() + extension;

    try {
      const response = await api.patch(`/fmir/${reportId}/evidence/${selectedEvidence.id}`, {
        fileName: fullNewName,
      });

      if (response.data.success) {
        setEvidence((prev) =>
          prev.map((e) =>
            e.id === selectedEvidence.id ? { ...e, fileName: fullNewName } : e
          )
        );
        setSuccess('File renamed successfully');
        setShowRenameModal(false);
        setSelectedEvidence(null);
        setNewFileName('');
      }
    } catch (err: any) {
      console.error('Error renaming evidence:', err);
      setError(err.response?.data?.error || 'Failed to rename file');
    }
  };

  // Open crop modal for photos
  const openCropModal = (file: Evidence) => {
    if (file.type !== 'PHOTO') return;
    setSelectedEvidence(file);
    setHasSelection(false);
    setIsSelecting(false);
    setSelectionStart({ x: 0, y: 0 });
    setSelectionEnd({ x: 0, y: 0 });
    setImageLoaded(false);
    setShowCropModal(true);
  };

  // Handle image load in crop modal
  const handleCropImageLoad = () => {
    if (cropImageRef.current) {
      const img = cropImageRef.current;
      setImageDimensions({
        width: img.width,
        height: img.height,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
      });
      setImageLoaded(true);
    }
  };

  // Get selection rectangle in display coordinates
  const getSelectionRect = () => {
    const x = Math.min(selectionStart.x, selectionEnd.x);
    const y = Math.min(selectionStart.y, selectionEnd.y);
    const width = Math.abs(selectionEnd.x - selectionStart.x);
    const height = Math.abs(selectionEnd.y - selectionStart.y);
    return { x, y, width, height };
  };

  // Handle crop and save
  const handleCropSave = async () => {
    if (!selectedEvidence || !cropCanvasRef.current || !cropImageRef.current) return;
    if (!hasSelection) {
      setError('Please select an area to crop first');
      return;
    }
    
    const reportId = currentReportId || editId;
    if (!reportId) return;

    const canvas = cropCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = cropImageRef.current;
    const rect = getSelectionRect();
    
    // Calculate the scale between displayed image and natural image
    const scaleX = img.naturalWidth / img.width;
    const scaleY = img.naturalHeight / img.height;
    
    // Convert selection coordinates to natural image coordinates
    const sourceX = rect.x * scaleX;
    const sourceY = rect.y * scaleY;
    const sourceWidth = rect.width * scaleX;
    const sourceHeight = rect.height * scaleY;
    
    // Set canvas size to the cropped dimensions
    canvas.width = sourceWidth;
    canvas.height = sourceHeight;

    // Draw cropped area
    ctx.drawImage(
      img,
      sourceX, sourceY, sourceWidth, sourceHeight,
      0, 0, sourceWidth, sourceHeight
    );

    try {
      // Convert canvas to blob
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => {
          if (b) resolve(b);
          else reject(new Error('Failed to create blob'));
        }, selectedEvidence.mimeType || 'image/jpeg', 0.9);
      });

      // Upload cropped image
      const formData = new FormData();
      formData.append('file', blob, selectedEvidence.fileName);

      const response = await api.post(`/fmir/${reportId}/evidence/${selectedEvidence.id}/replace`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (response.data.success) {
        // Revoke old blob URL and clear cache to force reload
        if (imageUrls[selectedEvidence.id]) {
          URL.revokeObjectURL(imageUrls[selectedEvidence.id]);
        }
        
        // Remove from cache so it will be reloaded
        setImageUrls(prev => {
          const newUrls = { ...prev };
          delete newUrls[selectedEvidence.id];
          return newUrls;
        });
        
        // Update the evidence
        setEvidence((prev) =>
          prev.map((e) =>
            e.id === selectedEvidence.id ? { ...e, ...response.data.data } : e
          )
        );
        
        setSuccess('Image cropped and saved successfully');
        setShowCropModal(false);
        setSelectedEvidence(null);
        
        // Reload the image for the updated evidence
        setTimeout(() => {
          const updatedEvidence = evidence.find(e => e.id === selectedEvidence.id);
          if (updatedEvidence) {
            loadEvidenceImage(updatedEvidence);
          }
        }, 100);
      }
    } catch (err: any) {
      console.error('Error saving cropped image:', err);
      setError(err.response?.data?.error || 'Failed to save cropped image');
    }
  };

  // Handle mouse events for selection in crop modal
  const handleCropMouseDown = (e: React.MouseEvent) => {
    if (!cropContainerRef.current || !cropImageRef.current) return;
    
    const containerRect = cropContainerRef.current.getBoundingClientRect();
    const imgRect = cropImageRef.current.getBoundingClientRect();
    
    // Calculate position relative to the image
    const x = e.clientX - imgRect.left;
    const y = e.clientY - imgRect.top;
    
    // Make sure we're clicking on the image
    if (x >= 0 && x <= imgRect.width && y >= 0 && y <= imgRect.height) {
      setIsSelecting(true);
      setHasSelection(false);
      setSelectionStart({ x, y });
      setSelectionEnd({ x, y });
    }
  };

  const handleCropMouseMove = (e: React.MouseEvent) => {
    if (!isSelecting || !cropImageRef.current) return;
    
    const imgRect = cropImageRef.current.getBoundingClientRect();
    
    // Calculate position relative to the image, clamped to image bounds
    const x = Math.max(0, Math.min(imgRect.width, e.clientX - imgRect.left));
    const y = Math.max(0, Math.min(imgRect.height, e.clientY - imgRect.top));
    
    setSelectionEnd({ x, y });
  };

  const handleCropMouseUp = () => {
    if (isSelecting) {
      const rect = getSelectionRect();
      // Only set hasSelection if the selection is big enough (at least 10x10 pixels)
      if (rect.width > 10 && rect.height > 10) {
        setHasSelection(true);
      } else {
        setHasSelection(false);
      }
    }
    setIsSelecting(false);
  };

  // Clear selection
  const clearSelection = () => {
    setHasSelection(false);
    setSelectionStart({ x: 0, y: 0 });
    setSelectionEnd({ x: 0, y: 0 });
  };

  // Load image with authentication (always use download endpoint for Firebase Storage)
  const loadEvidenceImage = useCallback(async (file: Evidence) => {
    if (file.type !== 'PHOTO') return;
    
    const reportId = currentReportId || editId;
    if (!reportId) return;

    // Check if already loaded (use ref-like check to avoid stale closure)
    setImageUrls(prev => {
      if (prev[file.id]) return prev; // Already loaded, skip
      
      // Load in background
      (async () => {
        try {
          // Always download through API for authenticated access
          // Firebase Storage with firebasestorage.app buckets requires signed URLs
          const response = await api.get(`/fmir/${reportId}/evidence/${file.id}/download`, {
            responseType: 'blob',
          });
          
          const blobUrl = URL.createObjectURL(response.data);
          setImageUrls(p => ({ ...p, [file.id]: blobUrl }));
        } catch (err) {
          console.error('Error loading evidence image:', err);
        }
      })();
      
      return prev;
    });
  }, [currentReportId, editId]);

  // Load images when evidence changes
  useEffect(() => {
    evidence.filter(e => e.type === 'PHOTO').forEach(file => {
      loadEvidenceImage(file);
    });

    // Cleanup blob URLs when component unmounts
    return () => {
      Object.values(imageUrls).forEach(url => {
        URL.revokeObjectURL(url);
      });
    };
  }, [evidence]);

  // Get evidence image URL (with auth)
  const getEvidenceImageUrl = (file: Evidence) => {
    return imageUrls[file.id] || '';
  };

  // Load video with authentication
  const loadEvidenceVideo = useCallback(async (file: Evidence) => {
    if (file.type !== 'VIDEO') return;
    
    const reportId = currentReportId || editId;
    if (!reportId) return;

    // Check if already loaded (use ref-like check to avoid stale closure)
    setVideoUrls(prev => {
      if (prev[file.id]) return prev; // Already loaded, skip
      
      // Load in background
      (async () => {
        try {
          const response = await api.get(`/fmir/${reportId}/evidence/${file.id}/download`, {
            responseType: 'blob',
          });
          
          const blobUrl = URL.createObjectURL(response.data);
          setVideoUrls(p => ({ ...p, [file.id]: blobUrl }));
        } catch (err) {
          console.error('Error loading evidence video:', err);
        }
      })();
      
      return prev;
    });
  }, [currentReportId, editId]);

  // Load videos when evidence changes
  useEffect(() => {
    evidence.filter(e => e.type === 'VIDEO').forEach(file => {
      loadEvidenceVideo(file);
    });

    // Cleanup blob URLs when component unmounts
    return () => {
      Object.values(videoUrls).forEach(url => {
        URL.revokeObjectURL(url);
      });
    };
  }, [evidence]);

  // Open video modal
  const openVideoModal = (file: Evidence) => {
    if (file.type !== 'VIDEO') return;
    setSelectedEvidence(file);
    setVideoCurrentTime(0);
    setVideoDuration(0);
    setIsVideoPlaying(false);
    setTrimRange({ start: 0, end: 0 });
    setShowVideoModal(true);
  };

  // Close video modal
  const closeVideoModal = () => {
    setShowVideoModal(false);
    setSelectedEvidence(null);
    setIsVideoPlaying(false);
    if (videoRef.current) {
      videoRef.current.pause();
    }
  };

  // Video player controls
  const toggleVideoPlay = () => {
    if (videoRef.current) {
      if (isVideoPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsVideoPlaying(!isVideoPlaying);
    }
  };

  const toggleVideoMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isVideoMuted;
      setIsVideoMuted(!isVideoMuted);
    }
  };

  const handleVideoTimeUpdate = () => {
    if (videoRef.current) {
      setVideoCurrentTime(videoRef.current.currentTime);
      // Auto-pause at trim end if trimming
      if (trimRange.end > 0 && videoRef.current.currentTime >= trimRange.end && isVideoPlaying) {
        videoRef.current.pause();
        setIsVideoPlaying(false);
      }
    }
  };

  const handleVideoLoaded = () => {
    if (videoRef.current) {
      const duration = videoRef.current.duration;
      if (isFinite(duration) && !isNaN(duration) && duration > 0) {
        setVideoDuration(duration);
        setTrimRange({ start: 0, end: duration });
      }
    }
  };

  // Format time as M:SS.mmm with milliseconds
  const formatVideoTime = (seconds: number, showMs = true) => {
    if (!isFinite(seconds) || isNaN(seconds)) return showMs ? '0:00.000' : '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    if (showMs) {
      const ms = Math.floor((seconds % 1) * 1000);
      return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Seek video to position
  const seekVideo = (time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setVideoCurrentTime(time);
    }
  };

  // Handle progress bar seek with RAF for smooth scrubbing
  const handleVideoSeekStart = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsSeeking(true);
    
    if (isVideoPlaying && videoRef.current) {
      videoRef.current.pause();
      setIsVideoPlaying(false);
    }
    
    handleVideoProgressClick(e);
  };

  const handleVideoProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!videoProgressRef.current || !videoDuration) return;
    const rect = videoProgressRef.current.getBoundingClientRect();
    const percentage = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const newTime = percentage * videoDuration;
    seekVideo(newTime);
  };

  // Global mouse events for seeking
  useEffect(() => {
    if (!isSeeking) return;
    
    let rafId: number | null = null;
    let pendingTime: number | null = null;
    let lastSeekTime = 0;
    const SEEK_THROTTLE = 33;
    
    const updateVideoTime = () => {
      if (pendingTime !== null && videoRef.current) {
        const now = performance.now();
        if (now - lastSeekTime >= SEEK_THROTTLE) {
          videoRef.current.currentTime = pendingTime;
          lastSeekTime = now;
        }
      }
      rafId = requestAnimationFrame(updateVideoTime);
    };
    
    rafId = requestAnimationFrame(updateVideoTime);
    
    const handleMouseUp = () => {
      if (rafId) cancelAnimationFrame(rafId);
      if (pendingTime !== null && videoRef.current) {
        videoRef.current.currentTime = pendingTime;
      }
      setIsSeeking(false);
    };
    
    const handleMouseMove = (e: MouseEvent) => {
      if (!videoProgressRef.current || !videoDuration) return;
      
      const rect = videoProgressRef.current.getBoundingClientRect();
      const percentage = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const newTime = percentage * videoDuration;
      
      setVideoCurrentTime(newTime);
      pendingTime = newTime;
    };

    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('mousemove', handleMouseMove);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mousemove', handleMouseMove);
    };
  }, [isSeeking, videoDuration]);

  // Handle trim range changes
  const handleTrimStartChange = (value: number) => {
    const newStart = Math.min(value, trimRange.end - 0.5);
    setTrimRange(prev => ({ ...prev, start: Math.max(0, newStart) }));
  };

  const handleTrimEndChange = (value: number) => {
    const newEnd = Math.max(value, trimRange.start + 0.5);
    setTrimRange(prev => ({ ...prev, end: Math.min(videoDuration, newEnd) }));
  };

  // Preload FFmpeg when video modal opens (optional - for future use)
  useEffect(() => {
    // FFmpeg preload disabled - using MediaRecorder approach instead
  }, [showVideoModal]);

  // Apply video trim using MediaRecorder (works without special headers)
  const applyVideoTrim = async () => {
    if (!selectedEvidence || !videoRef.current) {
      setError('No video selected');
      return;
    }
    
    const duration = trimRange.end - trimRange.start;
    if (duration < 0.5) {
      setError('Please select at least 0.5 seconds of video');
      return;
    }

    setIsTrimming(true);
    setTrimProgress(0);
    setError('');

    try {
      // Create a fresh video element for processing
      const video = document.createElement('video');
      video.src = videoUrls[selectedEvidence.id] || '';
      video.playsInline = true;
      video.crossOrigin = 'anonymous';
      video.muted = false;
      video.volume = 1;
      
      // Wait for video to load
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Video load timeout')), 15000);
        video.onloadedmetadata = () => {
          clearTimeout(timeout);
          resolve();
        };
        video.onerror = () => {
          clearTimeout(timeout);
          reject(new Error('Failed to load video for trimming'));
        };
      });

      setTrimProgress(10);

      // Create canvas for capturing
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context not available');

      // Get best supported mime type
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
        ? 'video/webm;codecs=vp9,opus'
        : MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
        ? 'video/webm;codecs=vp8,opus'
        : 'video/webm';

      // Create canvas stream
      const canvasStream = canvas.captureStream(30);
      
      // Setup audio capture
      let audioCtx: AudioContext | null = null;
      let audioSource: MediaElementAudioSourceNode | null = null;
      
      try {
        audioCtx = new AudioContext();
        if (audioCtx.state === 'suspended') {
          await audioCtx.resume();
        }
        audioSource = audioCtx.createMediaElementSource(video);
        const audioDest = audioCtx.createMediaStreamDestination();
        audioSource.connect(audioDest);
        audioSource.connect(audioCtx.destination);
        
        const audioTrack = audioDest.stream.getAudioTracks()[0];
        if (audioTrack) {
          canvasStream.addTrack(audioTrack);
        }
      } catch (e) {
        console.warn('Audio capture setup failed:', e);
      }

      // Setup recorder
      const recorder = new MediaRecorder(canvasStream, { 
        mimeType, 
        videoBitsPerSecond: 5000000,
        audioBitsPerSecond: 128000
      });
      
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => { 
        if (e.data.size > 0) chunks.push(e.data); 
      };

      setTrimProgress(15);

      // Seek to start position
      video.currentTime = trimRange.start;
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Seek timeout')), 10000);
        const onSeeked = () => {
          clearTimeout(timeout);
          video.removeEventListener('seeked', onSeeked);
          resolve();
        };
        video.addEventListener('seeked', onSeeked);
      });

      setTrimProgress(20);

      // Start recording
      recorder.start(100);
      await new Promise(r => setTimeout(r, 100));
      
      // Start playing video
      try {
        await video.play();
      } catch (playErr) {
        console.warn('Autoplay failed, trying muted:', playErr);
        video.muted = true;
        await video.play();
      }

      // Capture frames until we reach trim end
      await new Promise<void>((resolve) => {
        const checkAndDraw = () => {
          if (video.currentTime >= trimRange.end - 0.05 || video.paused || video.ended) {
            video.pause();
            setTimeout(() => {
              if (recorder.state === 'recording') {
                recorder.stop();
              }
              resolve();
            }, 300);
            return;
          }
          
          // Draw frame to canvas
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          
          // Update progress (20-90%)
          const elapsed = video.currentTime - trimRange.start;
          const progress = 20 + (elapsed / duration) * 70;
          setTrimProgress(Math.min(90, Math.round(progress)));
          
          requestAnimationFrame(checkAndDraw);
        };
        checkAndDraw();
      });

      // Wait for recorder to finish
      const outputBlob = await new Promise<Blob>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Recording timeout')), 10000);
        if (recorder.state === 'inactive' && chunks.length > 0) {
          clearTimeout(timeout);
          resolve(new Blob(chunks, { type: mimeType }));
          return;
        }
        recorder.onstop = () => {
          clearTimeout(timeout);
          if (chunks.length === 0) {
            reject(new Error('No video data recorded'));
            return;
          }
          resolve(new Blob(chunks, { type: mimeType }));
        };
      });

      setTrimProgress(95);

      // Cleanup
      if (audioSource) {
        try { audioSource.disconnect(); } catch (e) { /* ignore */ }
      }
      if (audioCtx) {
        try { await audioCtx.close(); } catch (e) { /* ignore */ }
      }
      video.pause();
      video.src = '';

      if (outputBlob.size < 1000) {
        throw new Error('Trimmed video is too small - recording may have failed');
      }

      // Upload the trimmed video
      const reportId = currentReportId || editId;
      if (!reportId) throw new Error('No report ID - please save the FMIR first');

      // Ensure the blob has the correct MIME type
      const typedBlob = new Blob([outputBlob], { type: 'video/webm' });
      const newFileName = selectedEvidence.fileName.replace(/\.[^.]+$/, '_trimmed.webm');

      const formData = new FormData();
      formData.append('files', typedBlob, newFileName);

      const uploadResponse = await api.post(`/fmir/${reportId}/evidence`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (uploadResponse.data.success && uploadResponse.data.data) {
        // Delete old video and add new one
        const oldId = selectedEvidence.id;
        try {
          await api.delete(`/fmir/${reportId}/evidence/${oldId}`);
        } catch (delErr) {
          console.warn('Could not delete original video:', delErr);
        }
        
        // Update evidence list - remove old and add new
        setEvidence(prev => [
          ...prev.filter(e => e.id !== oldId),
          ...uploadResponse.data.data
        ]);
        
        // Revoke old URL
        if (videoUrls[oldId]) {
          URL.revokeObjectURL(videoUrls[oldId]);
          setVideoUrls(prev => {
            const newUrls = { ...prev };
            delete newUrls[oldId];
            return newUrls;
          });
        }
        
        setSuccess('Video trimmed and saved successfully!');
        closeVideoModal();
      } else {
        throw new Error('Failed to upload trimmed video');
      }

      setTrimProgress(100);
    } catch (err: any) {
      console.error('Error trimming video:', err);
      setError(err.message || 'Failed to trim video. Please try again.');
    } finally {
      setIsTrimming(false);
      setTrimProgress(0);
    }
  };

  // Get file icon based on type
  const getFileIcon = (type: string) => {
    switch (type) {
      case 'PHOTO':
        return <Image className="w-5 h-5 text-blue-500" />;
      case 'VIDEO':
        return <Video className="w-5 h-5 text-purple-500" />;
      default:
        return <File className="w-5 h-5 text-gray-500" />;
    }
  };

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Check privilege inline (not just via useEffect) to prevent flash of content
  const shouldShowAccessDenied = !privilegesLoading && (
    (editId && !canEditFMIR) || (!editId && !canCreateFMIR)
  );

  // Show loading state while privileges are still loading
  if (loading || privilegesLoading) {
    return (
      <div className="min-h-full bg-gradient-to-br from-gray-50 via-gray-100 to-gray-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center">
        {/* Animated background elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-primary-400/20 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-orange-400/20 rounded-full blur-3xl animate-pulse delay-500" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-purple-400/10 rounded-full blur-3xl animate-pulse delay-1000" />
        </div>
        
        {/* Glassy modal */}
        <div className="relative flex flex-col items-center gap-5 p-10 backdrop-blur-xl bg-white/70 dark:bg-gray-800/70 rounded-3xl shadow-2xl border border-white/50 dark:border-gray-700/50">
          {/* Glowing ring animation */}
          <div className="relative">
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-primary-500 via-orange-500 to-amber-500 blur-lg opacity-60 animate-pulse" />
            <div className="relative p-5 bg-gradient-to-br from-primary-500 via-primary-600 to-orange-500 rounded-2xl shadow-xl">
              {/* Spinning loader with orbit effect */}
              <div className="relative w-12 h-12">
                <div className="absolute inset-0 rounded-full border-4 border-white/30" />
                <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-white animate-spin" />
                <div className="absolute inset-2 rounded-full border-2 border-transparent border-b-white/60 animate-spin" style={{ animationDirection: 'reverse', animationDuration: '0.8s' }} />
              </div>
            </div>
          </div>
          
          {/* Text with shimmer effect */}
          <div className="flex flex-col items-center gap-2">
            <span className="text-gray-700 dark:text-gray-200 font-semibold text-xl">{privilegesLoading ? 'Checking permissions...' : 'Loading report...'}</span>
            <span className="text-gray-500 dark:text-gray-400 text-sm flex items-center gap-2">
              <span className="inline-block w-1.5 h-1.5 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="inline-block w-1.5 h-1.5 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="inline-block w-1.5 h-1.5 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              <span className="ml-1">Hang on, Fetching your data</span>
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Show access denied modal if user lacks privilege (using inline check to prevent flash)
  if (shouldShowAccessDenied) {
    return (
      <ProtectedRoute requireAuth>
        <AccessDeniedModal
          isOpen={shouldShowAccessDenied}
          onClose={() => {
            router.push('/fmir');
          }}
          featureName={editId ? 'Edit Foreign Material Report' : 'Create Foreign Material Report'}
          requiredPrivilege={editId ? FMIR_PRIVILEGES.EDIT : FMIR_PRIVILEGES.CREATE}
        />
        {/* Empty background - modal is the only content */}
        <div className="min-h-full bg-gradient-to-br from-gray-50 via-gray-100 to-gray-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900" />
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute requireAuth>
      {/* Access Denied Modal for API privilege errors */}
      {accessDeniedModal}
      
      <div className="min-h-full bg-gradient-to-br from-gray-50 via-gray-100 to-gray-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          {/* Header */}
          <div className="mb-6 sm:mb-8 lg:mb-10">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => router.push('/fmir')}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm transition-colors"
                  title="Back to Foreign Material Reports"
                  aria-label="Back to Foreign Material Reports"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span className="hidden sm:inline text-sm font-medium">Back</span>
                </button>
                <div className="p-2 sm:p-3 bg-gradient-to-br from-amber-400 via-orange-500 to-red-500 rounded-xl shadow-lg shadow-orange-500/20 flex-shrink-0">
                  <AlertTriangle className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                </div>
                <div>
                  <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 dark:text-white leading-tight">
                    {isEditMode ? 'Edit FMIR Report' : 'New FMIR Report'}
                  </h1>
                  <p className="text-gray-500 dark:text-gray-400 flex items-center gap-1.5 text-xs sm:text-sm">
                    <FileText className="w-3 h-3" />
                    {reportNumber ? (
                      <span>Report #{reportNumber}</span>
                    ) : (
                      <span className="italic">Report number will be assigned on save</span>
                    )}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0 flex-wrap justify-end">
                {/* Auto-save toggle */}
                <div className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoSaveEnabled}
                      disabled={!autoSaveLoaded}
                      onChange={async (e) => {
                        const newValue = e.target.checked;
                        setAutoSaveEnabled(newValue);
                        // Save preference to database
                        try {
                          await api.patch('/preferences', { autoSaveEnabled: newValue });
                        } catch (err) {
                          console.error('Failed to save auto-save preference:', err);
                        }
                      }}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-green-500"></div>
                  </label>
                  <span className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                    Auto Save
                  </span>
                </div>

<button
                  onClick={() => setShowSOPModal(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-amber-50 dark:bg-amber-900/30 hover:bg-amber-100 dark:hover:bg-amber-900/50 text-amber-700 dark:text-amber-300 font-medium rounded-lg transition-all border border-amber-200 dark:border-amber-700 shadow-sm text-sm"
                  title="View Standard Operating Procedure"
                >
                  <BookOpen className="w-4 h-4" />
                  <span className="hidden sm:inline">SOP Guide</span>
                  <span className="sm:hidden">SOP</span>
                </button>
                <button
                  onClick={handleSaveDraft}
                  disabled={autoSaveEnabled || autoSaving || submitting}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 font-medium rounded-lg transition-all border shadow-sm text-sm ${
                    autoSaveEnabled
                      ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 border-gray-200 dark:border-gray-700 cursor-not-allowed opacity-50'
                      : 'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 disabled:opacity-50'
                  }`}
                  title={autoSaveEnabled ? 'Auto Save is enabled' : 'Save draft manually'}
                >
                  {autoSaving && !autoSaveEnabled ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  <span className="hidden sm:inline">Save Draft</span>
                  <span className="sm:hidden">Save</span>
                </button>
                {showSubmitButton && (
                  <button
                    onClick={handleInitiateSubmit}
                    disabled={autoSaving || submitting || validating || !canSubmit}
                    className={`inline-flex items-center gap-1.5 px-4 py-2 font-medium rounded-lg transition-all shadow-md text-sm ${
                      canSubmit
                        ? 'bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-700 hover:to-primary-600 text-white'
                        : 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                    } disabled:opacity-50`}
                    title={!canSubmit ? 'Please fill in required fields' : 'Submit report'}
                  >
                    {submitting || validating ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                    <span className="hidden sm:inline">Submit Report</span>
                    <span className="sm:hidden">Submit</span>
                  </button>
                )}
                {!showSubmitButton && !showValidateButton && (
                  <span className="text-xs text-amber-600 dark:text-amber-400 inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-700">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Fill all required fields to submit</span>
                    <span className="sm:hidden">Fill required fields</span>
                  </span>
                )}
                {showValidateButton && (
                  <button
                    onClick={handleInitiateSubmit}
                    disabled={autoSaving || submitting || validating || !canSubmit}
                    className={`inline-flex items-center gap-1.5 px-4 py-2 font-medium rounded-lg transition-all shadow-md text-sm ${
                      canSubmit
                        ? 'bg-gradient-to-r from-green-600 to-emerald-500 hover:from-green-700 hover:to-emerald-600 text-white'
                        : 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                    } disabled:opacity-50`}
                    title={!canSubmit ? 'Please fill in required fields' : 'Validate report for compliance'}
                  >
                    {submitting || validating ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <ClipboardCheck className="w-4 h-4" />
                    )}
                    <span className="hidden sm:inline">Validate Report</span>
                    <span className="sm:hidden">Validate</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Alerts */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-red-700 dark:text-red-400 font-medium text-sm">Error</p>
                <p className="text-red-600 dark:text-red-300 text-xs">{error}</p>
              </div>
              <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Form Sections */}
          <div className="space-y-3 sm:space-y-4">
            {/* Section 1: Basic Information */}
            <FormSection
              title="General Information"
              sectionNumber={1}
              icon={Info}
              isExpanded={expandedSections[1]}
              onToggle={() => toggleSection(1)}
              isRequired
              commentCount={commentCounts[1] || 0}
              hasUnreadComments={unreadCommentSections[1] || false}
              onClearUnread={() => setUnreadCommentSections(prev => ({ ...prev, 1: false }))}
              onAddComment={() => handleOpenCommentModal(1)}
              onViewComments={(e) => handleViewComments(1, e)}
            >
              {/* Row 1: Date and Time */}
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <FormInput
                  label="Date"
                  name="incidentDate"
                  type="date"
                  value={formData.incidentDate}
                  onChange={handleChange}
                  required
                />
                <FormInput
                  label="Time"
                  name="incidentTime"
                  type="time"
                  value={formData.incidentTime}
                  onChange={handleChange}
                />
              </div>

              {/* Row 2: Facility and Department */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1 sm:mb-1.5">
                    Facility
                  </label>
                  <select
                    name="facilityId"
                    value={formData.facilityId}
                    onChange={(e) => {
                      handleChange(e);
                      // Clear Department, Area, and Line when facility changes
                      if (formData.department || formData.area || formData.line) {
                        setFormData(prev => ({ ...prev, department: '', area: '', line: '' }));
                      }
                    }}
                    className="w-full px-3 py-2 sm:py-2.5 bg-white dark:bg-gray-700/80 border-2 border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                  >
                    <option value="">Select facility</option>
                    {Array.isArray(facilities) && facilities.map((facility) => (
                      <option key={facility.id} value={facility.id}>
                        {facility.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1 sm:mb-1.5">
                    Department
                  </label>
                  <select
                    name="department"
                    value={formData.department}
                    onChange={(e) => {
                      handleChange(e);
                      // Clear Area and Line when department changes
                      if (formData.area || formData.line) {
                        setFormData(prev => ({ ...prev, area: '', line: '' }));
                      }
                    }}
                    disabled={!formData.facilityId}
                    className="w-full px-3 py-2 sm:py-2.5 bg-white dark:bg-gray-700/80 border-2 border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="">Select department</option>
                    {Array.isArray(departments) && departments
                      .filter(dept => dept.facilityId === formData.facilityId)
                      .map((dept) => (
                        <option key={dept.id} value={dept.name}>
                          {dept.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              {/* Row 3: Area and Line */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1 sm:mb-1.5">
                    Area
                  </label>
                  <select
                    name="area"
                    value={formData.area}
                    onChange={(e) => {
                      handleChange(e);
                      // Clear Line when area changes
                      if (formData.line) {
                        setFormData(prev => ({ ...prev, line: '' }));
                      }
                    }}
                    disabled={!formData.department}
                    className="w-full px-3 py-2 sm:py-2.5 bg-white dark:bg-gray-700/80 border-2 border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="">Select area</option>
                    {Array.isArray(areas) && areas.map((area) => (
                      <option key={area.id} value={area.name}>
                        {area.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1 sm:mb-1.5">
                    Line
                  </label>
                  <select
                    name="line"
                    value={formData.line}
                    onChange={handleChange}
                    disabled={!formData.area}
                    className="w-full px-3 py-2 sm:py-2.5 bg-white dark:bg-gray-700/80 border-2 border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="">Select line</option>
                    {Array.isArray(lines) && lines.map((line) => (
                      <option key={line.id} value={line.name}>
                        {line.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row 4: FM Source Category and FM Source Type */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1 sm:mb-1.5">
                    FM Source Category
                  </label>
                  <select
                    name="fmSourceCategory"
                    value={formData.fmSourceCategory}
                    onChange={(e) => {
                      handleChange(e);
                      // Clear FM Source Type when category changes
                      if (formData.fmSourceType) {
                        setFormData(prev => ({ ...prev, fmSourceType: '' }));
                      }
                    }}
                    className="w-full px-3 py-2 sm:py-2.5 bg-white dark:bg-gray-700/80 border-2 border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                  >
                    <option value="">Select category</option>
                    {Array.isArray(fmSourceCategories) && fmSourceCategories.map((cat) => (
                      <option key={cat.id} value={cat.name}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1 sm:mb-1.5">
                    FM Source Type
                  </label>
                  <select
                    name="fmSourceType"
                    value={formData.fmSourceType}
                    onChange={handleChange}
                    disabled={!formData.fmSourceCategory}
                    className="w-full px-3 py-2 sm:py-2.5 bg-white dark:bg-gray-700/80 border-2 border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="">Select type</option>
                    {Array.isArray(fmSourceTypes) && fmSourceTypes.map((type) => (
                      <option key={type.id} value={type.name}>
                        {type.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row 5: Item Number and Amount */}
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <FormInput
                  label="Item Number"
                  name="productItemNumber"
                  value={formData.productItemNumber}
                  onChange={handleChange}
                  placeholder="e.g., 80758"
                />
                <FormInput
                  label="Amount"
                  name="amount"
                  value={formData.amount}
                  onChange={handleChange}
                  placeholder="2, or 3"
                />
              </div>

              {/* Row 3: Name of Product, Product Code(s)/Batch/Lot Involved */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <FormInput
                  label="Name of Product"
                  name="productName"
                  value={formData.productName}
                  onChange={handleChange}
                  placeholder="Product name"
                />
                <FormInput
                  label="Product Code(s)/Batch/Lot Involved"
                  name="productCodeBatchLot"
                  value={formData.productCodeBatchLot}
                  onChange={handleChange}
                  placeholder="Codes, batch, lot numbers"
                />
              </div>

              {/* Row 4: Individuals Involved */}
              <FormInput
                label="Individuals Involved"
                name="individualsInvolved"
                value={formData.individualsInvolved}
                onChange={handleChange}
                placeholder="Names of individuals involved"
              />
            </FormSection>

            {/* Section 2: Foreign Material Description */}
            <FormSection
              title="Describe the Foreign Material/Object"
              sectionNumber={2}
              icon={Search}
              isExpanded={expandedSections[2]}
              onToggle={() => toggleSection(2)}
              isRequired
              commentCount={commentCounts[2] || 0}
              hasUnreadComments={unreadCommentSections[2] || false}
              onClearUnread={() => setUnreadCommentSections(prev => ({ ...prev, 2: false }))}
              onAddComment={() => handleOpenCommentModal(2)}
              onViewComments={(e) => handleViewComments(2, e)}
            >
              <AIEnhancedTextarea
                label="Describe, in detail, the foreign material/object. Include size and hardness."
                name="foreignMaterialDescription"
                value={formData.foreignMaterialDescription}
                onChange={handleChange}
                placeholder="Describe the foreign material - what is it, color, texture, etc."
                rows={3}
                required
                context="Foreign Material Description - FMIR Report"
              />

              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <FormInput
                  label="Size (mm)"
                  name="foreignMaterialSize"
                  value={formData.foreignMaterialSize}
                  onChange={handleChange}
                  placeholder="e.g., 5mm x 3mm"
                />
                <FormInput
                  label="Hardness"
                  name="foreignMaterialHardness"
                  value={formData.foreignMaterialHardness}
                  onChange={handleChange}
                  placeholder="Hard, Soft, Flexible"
                />
              </div>

              {/* Warning box for hard/sharp objects */}
              <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg">
                <p className="text-xs sm:text-sm text-amber-800 dark:text-amber-300 font-medium mb-2">
                  <AlertTriangle className="w-4 h-4 inline mr-1" />
                  If the (found) object is either hard or sharp and/or 7-25 mm:
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-400 mb-3 pl-5">
                  a) for USDA items complete the Unforeseen Hazard Corrective Action Form and Reassessment if the Object would not have been identified at a CCP
                  <br />
                  b) for FDA items complete the Unanticipated Food Safety Problem Assessment
                </p>
                <div className="flex flex-col sm:flex-row gap-3 pl-5">
                  <FormToggle
                    label="Object is hard/sharp/7-25mm"
                    name="isHardSharpOrLarge"
                    checked={formData.isHardSharpOrLarge}
                    onChange={handleChange}
                  />
                  <FormToggle
                    label="Unforeseen Hazard Form Required"
                    name="unforeseeHazardFormRequired"
                    checked={formData.unforeseeHazardFormRequired}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <SignatureField
                label="Section 2"
                initialsValue={formData.section2Initials}
                dateValue={formData.section2Date}
              />
            </FormSection>

            {/* Section 3: Cause Identification */}
            <FormSection
              title="Identify the Cause of this Incident"
              sectionNumber={3}
              icon={Search}
              isExpanded={expandedSections[3]}
              onToggle={() => toggleSection(3)}
              isRequired={true}
              commentCount={commentCounts[3] || 0}
              hasUnreadComments={unreadCommentSections[3] || false}
              onClearUnread={() => setUnreadCommentSections(prev => ({ ...prev, 3: false }))}
              onAddComment={() => handleOpenCommentModal(3)}
              onViewComments={(e) => handleViewComments(3, e)}
            >
              <AIEnhancedTextarea
                label="Identify the cause of this incident: Possible source? How/Why did the incident occur?"
                name="causeIdentification"
                value={formData.causeIdentification}
                onChange={handleChange}
                placeholder="What caused this incident? Include as much detail as possible, pictures might be helpful."
                rows={3}
                context="Cause Identification - FMIR Report"
              />

              <SignatureField
                label="Section 3"
                initialsValue={formData.section3Initials}
                dateValue={formData.section3Date}
              />
            </FormSection>

            {/* Section 4: Corrective Action */}
            <FormSection
              title="Corrective Action Taken"
              sectionNumber={4}
              icon={ClipboardCheck}
              isExpanded={expandedSections[4]}
              onToggle={() => toggleSection(4)}
              isRequired={true}
              commentCount={commentCounts[4] || 0}
              hasUnreadComments={unreadCommentSections[4] || false}
              onClearUnread={() => setUnreadCommentSections(prev => ({ ...prev, 4: false }))}
              onAddComment={() => handleOpenCommentModal(4)}
              onViewComments={(e) => handleViewComments(4, e)}
            >
              <AIEnhancedTextarea
                label="What action was taken when the incident was noted, how was it corrected?"
                name="correctiveAction"
                value={formData.correctiveAction}
                onChange={handleChange}
                placeholder="Describe corrective actions to isolate this event from future operations (wash downs, equipment changes, replacing malfunctioning parts, etc.)"
                rows={3}
                context="Corrective Action Taken - FMIR Report"
              />

              <SignatureField
                label="Section 4"
                initialsValue={formData.section4Initials}
                dateValue={formData.section4Date}
              />
            </FormSection>

            {/* Section 5: Verification (QC) */}
            <FormSection
              title="Verification - Completed by QC"
              sectionNumber={5}
              icon={CheckCircle}
              isExpanded={expandedSections[5]}
              onToggle={() => toggleSection(5)}
              isRequired={true}
              readOnly={!canEditRestrictedSections}
              commentCount={commentCounts[5] || 0}
              hasUnreadComments={unreadCommentSections[5] || false}
              onClearUnread={() => setUnreadCommentSections(prev => ({ ...prev, 5: false }))}
              onAddComment={() => handleOpenCommentModal(5)}
              onViewComments={(e) => handleViewComments(5, e)}
            >
              <AIEnhancedTextarea
                label="What actions were taken to verify the corrective actions were implemented?"
                name="verificationActions"
                value={formData.verificationActions}
                onChange={handleChange}
                placeholder="Verification (i.e. Direct Observation) that the corrective actions taken above actually occurred"
                rows={3}
                context="Verification Actions - FMIR Report"
                disabled={!canEditRestrictedSections}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                {/* Was Maintenance Work Completed - with N/A option */}
                <div className={!canEditRestrictedSections ? 'opacity-60' : ''}>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Was Maintenance Work Completed?
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {/* N/A Option */}
                    <label
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
                        !canEditRestrictedSections ? 'cursor-not-allowed' : 'cursor-pointer'
                      } ${
                        formData.maintenanceWorkCompleted === 'NA'
                          ? 'bg-gray-200 dark:bg-gray-600 border-gray-500 text-gray-700 dark:text-gray-200'
                          : 'bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-650'
                      }`}
                    >
                      <input
                        type="radio"
                        name="maintenanceWorkCompleted"
                        value="NA"
                        checked={formData.maintenanceWorkCompleted === 'NA'}
                        onChange={() => {
                          if (!canEditRestrictedSections) return;
                          const updatedFormData = { ...formData, maintenanceWorkCompleted: 'NA' };
                          setFormData(updatedFormData);
                          saveQAFieldImmediately('maintenanceWorkCompleted', 'NA', updatedFormData);
                        }}
                        disabled={!canEditRestrictedSections}
                        className="sr-only"
                      />
                      <span className="text-sm font-medium">N/A</span>
                    </label>
                    
                    {/* Yes Option */}
                    <label
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
                        !canEditRestrictedSections || formData.maintenanceWorkCompleted === 'NA' ? 'cursor-not-allowed' : 'cursor-pointer'
                      } ${
                        formData.maintenanceWorkCompleted === 'NA'
                          ? 'opacity-40 bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500'
                          : formData.maintenanceWorkCompleted === 'Y'
                            ? 'bg-primary-50 dark:bg-primary-900/30 border-primary-500 text-primary-700 dark:text-primary-300'
                            : 'bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-650'
                      }`}
                    >
                      <input
                        type="radio"
                        name="maintenanceWorkCompleted"
                        value="Y"
                        checked={formData.maintenanceWorkCompleted === 'Y'}
                        onChange={() => {
                          if (!canEditRestrictedSections || formData.maintenanceWorkCompleted === 'NA') return;
                          const updatedFormData = { ...formData, maintenanceWorkCompleted: 'Y' };
                          setFormData(updatedFormData);
                          saveQAFieldImmediately('maintenanceWorkCompleted', 'Y', updatedFormData);
                        }}
                        disabled={!canEditRestrictedSections || formData.maintenanceWorkCompleted === 'NA'}
                        className="sr-only"
                      />
                      <span className="text-sm font-medium">Yes</span>
                    </label>
                    
                    {/* No Option */}
                    <label
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
                        !canEditRestrictedSections || formData.maintenanceWorkCompleted === 'NA' ? 'cursor-not-allowed' : 'cursor-pointer'
                      } ${
                        formData.maintenanceWorkCompleted === 'NA'
                          ? 'opacity-40 bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500'
                          : formData.maintenanceWorkCompleted === 'N'
                            ? 'bg-primary-50 dark:bg-primary-900/30 border-primary-500 text-primary-700 dark:text-primary-300'
                            : 'bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-650'
                      }`}
                    >
                      <input
                        type="radio"
                        name="maintenanceWorkCompleted"
                        value="N"
                        checked={formData.maintenanceWorkCompleted === 'N'}
                        onChange={() => {
                          if (!canEditRestrictedSections || formData.maintenanceWorkCompleted === 'NA') return;
                          const updatedFormData = { ...formData, maintenanceWorkCompleted: 'N' };
                          setFormData(updatedFormData);
                          saveQAFieldImmediately('maintenanceWorkCompleted', 'N', updatedFormData);
                        }}
                        disabled={!canEditRestrictedSections || formData.maintenanceWorkCompleted === 'NA'}
                        className="sr-only"
                      />
                      <span className="text-sm font-medium">No</span>
                    </label>
                  </div>
                </div>
                <FormToggle
                  label="Sanitation/Clean-up Required"
                  name="sanitationRequired"
                  checked={formData.sanitationRequired}
                  onChange={(e) => {
                    const newValue = e.target.checked;
                    const updatedFormData = { ...formData, sanitationRequired: newValue };
                    setFormData(updatedFormData);
                    // Immediate save for real-time sync with other users
                    saveQAFieldImmediately('sanitationRequired', newValue, updatedFormData);
                  }}
                  disabled={!canEditRestrictedSections}
                />
              </div>

              {formData.sanitationRequired && (
                <div className="p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg">
                  <p className="text-xs text-blue-700 dark:text-blue-300 italic">
                    Note: If Sanitation/Clean up is needed, assure activities and pre-op results are documented on Daily Sanitation Operative Report
                  </p>
                  <AIEnhancedTextarea
                    label="Sanitation Notes"
                    name="sanitationNotes"
                    value={formData.sanitationNotes}
                    onChange={handleChange}
                    placeholder="Describe sanitation activities"
                    rows={2}
                    context="Sanitation Notes - FMIR Report"
                    disabled={!canEditRestrictedSections}
                  />
                </div>
              )}

              <SignatureField
                label="Section 5 (QC)"
                initialsValue={formData.section5Initials}
                dateValue={formData.section5Date}
              />
            </FormSection>

            {/* Section 6: Product Hold */}
            <FormSection
              title="Was Product Placed on Hold?"
              sectionNumber={6}
              icon={Package}
              isExpanded={expandedSections[6]}
              onToggle={() => toggleSection(6)}
              isRequired={true}
              readOnly={!canEditRestrictedSections}
              commentCount={commentCounts[6] || 0}
              hasUnreadComments={unreadCommentSections[6] || false}
              onClearUnread={() => setUnreadCommentSections(prev => ({ ...prev, 6: false }))}
              onAddComment={() => handleOpenCommentModal(6)}
              onViewComments={(e) => handleViewComments(6, e)}
            >
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 items-end">
                <FormRadioGroup
                  label="Was product placed on hold?"
                  name="productPlacedOnHoldRadio"
                  value={formData.productPlacedOnHold ? 'YES' : 'NO'}
                  options={[
                    { value: 'YES', label: 'Yes' },
                    { value: 'NO', label: 'No' },
                  ]}
                  onChange={(value) => {
                    const newValue = value === 'YES';
                    const updatedFormData = { ...formData, productPlacedOnHold: newValue };
                    setFormData(updatedFormData);
                    // Immediate save for real-time sync with other users
                    saveQAFieldImmediately('productPlacedOnHold', newValue, updatedFormData);
                  }}
                  disabled={!canEditRestrictedSections}
                />
                <FormInput
                  label="Item #'s Held"
                  name="itemsHeld"
                  value={formData.itemsHeld}
                  onChange={handleChange}
                  placeholder="List item numbers"
                  className="col-span-2 sm:col-span-2"
                  disabled={!canEditRestrictedSections || !formData.productPlacedOnHold}
                />
              </div>

              {formData.productPlacedOnHold ? (
                <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg">
                  <p className="text-xs font-semibold text-green-800 dark:text-green-300 mb-2">
                    If Yes, Include details of decision making process for determining the window of contamination:
                  </p>
                  <AIEnhancedTextarea
                    label="Decision Making Process Details"
                    name="holdDecisionDetails"
                    value={formData.holdDecisionDetails}
                    onChange={handleChange}
                    placeholder="Top priority is control of the FM window, including review of source raw material/product. Include rework and similar product that may be implicated."
                    rows={3}
                    context="Decision Making Process Details - Product Hold Section"
                    disabled={!canEditRestrictedSections}
                  />
                  <AIEnhancedTextarea
                    label="Contamination Window Details"
                    name="contaminationWindowDetails"
                    value={formData.contaminationWindowDetails}
                    onChange={handleChange}
                    placeholder="Do not dispose of any product or inedible material, regardless of whether or not you believe it to be contaminated."
                    rows={2}
                    context="Contamination Window Details - Product Hold Section"
                    disabled={!canEditRestrictedSections}
                  />
                </div>
              ) : (
                <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg">
                  <p className="text-xs font-semibold text-yellow-800 dark:text-yellow-300 mb-2">
                    If No, Include details of decision making process and how you came to this conclusion:
                  </p>
                  <AIEnhancedTextarea
                    label="Decision Details (No Hold)"
                    name="holdDecisionDetails"
                    value={formData.holdDecisionDetails}
                    onChange={handleChange}
                    placeholder="Explain why product was not placed on hold and the decision-making process"
                    rows={2}
                    context="Decision Details (No Hold) - Product Hold Section"
                    disabled={!canEditRestrictedSections}
                  />
                </div>
              )}

              <SignatureField
                label="Section 6"
                initialsValue={formData.section6Initials}
                dateValue={formData.section6Date}
              />
            </FormSection>

            {/* Section 7: Screening Process */}
            <FormSection
              title="Screening Process - Completed by QC"
              sectionNumber={7}
              icon={Shield}
              isExpanded={expandedSections[7]}
              onToggle={() => toggleSection(7)}
              isRequired={true}
              readOnly={!canEditRestrictedSections}
              commentCount={commentCounts[7] || 0}
              hasUnreadComments={unreadCommentSections[7] || false}
              onClearUnread={() => setUnreadCommentSections(prev => ({ ...prev, 7: false }))}
              onAddComment={() => handleOpenCommentModal(7)}
              onViewComments={(e) => handleViewComments(7, e)}
            >
              <AIEnhancedTextarea
                label="If applicable, what screening process will be used?"
                name="screeningProcess"
                value={formData.screeningProcess}
                onChange={handleChange}
                placeholder="Was the affected product screened prior to release (metal detection, visual inspection, etc.)? If Rework is used for screening process, Lot Inspection of end product shall be conducted by QC."
                rows={3}
                context="Screening Process - FMIR Report"
                disabled={!canEditRestrictedSections}
              />

              <SignatureField
                label="Section 7 (QC)"
                initialsValue={formData.section7Initials}
                dateValue={formData.section7Date}
              />
            </FormSection>

            {/* Section 8: Final Disposition */}
            <FormSection
              title="Final Disposition - Completed by QC"
              sectionNumber={8}
              icon={Truck}
              isExpanded={expandedSections[8]}
              onToggle={() => toggleSection(8)}
              isRequired={true}
              readOnly={!canEditRestrictedSections}
              commentCount={commentCounts[8] || 0}
              hasUnreadComments={unreadCommentSections[8] || false}
              onClearUnread={() => setUnreadCommentSections(prev => ({ ...prev, 8: false }))}
              onAddComment={() => handleOpenCommentModal(8)}
              onViewComments={(e) => handleViewComments(8, e)}
            >
              <AIEnhancedTextarea
                label="Final disposition of product or materials affected/Volume, include justification for decision"
                name="finalDisposition"
                value={formData.finalDisposition}
                onChange={handleChange}
                placeholder="Describe the final disposition"
                rows={3}
                context="Final Disposition - FMIR Report"
                disabled={!canEditRestrictedSections}
              />

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                <FormInput
                  label="Volume"
                  name="dispositionVolume"
                  value={formData.dispositionVolume}
                  onChange={handleChange}
                  placeholder="e.g., 1000 lbs"
                  disabled={!canEditRestrictedSections}
                />
                <FormInput
                  label="Date(s) of Disposition"
                  name="dispositionDate"
                  type="date"
                  value={formData.dispositionDate}
                  onChange={handleChange}
                  disabled={!canEditRestrictedSections}
                />
                <FormInput
                  label="Disposition Initials"
                  name="dispositionInitials"
                  value={formData.dispositionInitials}
                  onChange={handleChange}
                  placeholder="XX"
                  disabled={!canEditRestrictedSections}
                />
              </div>

              <AIEnhancedTextarea
                label="Justification for Decision"
                name="dispositionJustification"
                value={formData.dispositionJustification}
                onChange={handleChange}
                placeholder="Include justification for the disposition decision"
                rows={2}
                context="Disposition Justification - FMIR Report"
                disabled={!canEditRestrictedSections}
              />

              <SignatureField
                label="Section 8 (QC)"
                initialsValue={formData.section8Initials}
                dateValue={formData.section8Date}
              />
            </FormSection>

            {/* Section 9: Prevention Measures */}
            <FormSection
              title="Prevention Measures - Completed by QC"
              sectionNumber={9}
              icon={Shield}
              isExpanded={expandedSections[9]}
              onToggle={() => toggleSection(9)}
              isRequired={true}
              readOnly={!canEditRestrictedSections}
              commentCount={commentCounts[9] || 0}
              hasUnreadComments={unreadCommentSections[9] || false}
              onClearUnread={() => setUnreadCommentSections(prev => ({ ...prev, 9: false }))}
              onAddComment={() => handleOpenCommentModal(9)}
              onViewComments={(e) => handleViewComments(9, e)}
            >
              <AIEnhancedTextarea
                label="What measures were taken to prevent the incident from re-occurring?"
                name="preventionMeasures"
                value={formData.preventionMeasures}
                onChange={handleChange}
                placeholder="Actions taken to ensure it does not happen again (if re-train is part, need documentation). Should address the ROOT CAUSE of the incident to ensure it doesn't repeat."
                rows={3}
                context="Prevention Measures - FMIR Report"
                disabled={!canEditRestrictedSections}
              />

              <SignatureField
                label="Section 9 (QC)"
                initialsValue={formData.section9Initials}
                dateValue={formData.section9Date}
              />
            </FormSection>

            {/* Section 10: Corporate & Pre-Shipment */}
            <FormSection
              title="Corporate Notification & Pre-Shipment"
              sectionNumber={10}
              icon={Building2}
              isExpanded={expandedSections[10]}
              onToggle={() => toggleSection(10)}
              isRequired={true}
              readOnly={!canEditRestrictedSections}
              commentCount={commentCounts[10] || 0}
              hasUnreadComments={unreadCommentSections[10] || false}
              onClearUnread={() => setUnreadCommentSections(prev => ({ ...prev, 10: false }))}
              onAddComment={() => handleOpenCommentModal(10)}
              onViewComments={(e) => handleViewComments(10, e)}
            >
              {/* Corporate Notification Row */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 items-end">
                <FormRadioGroup
                  label="Corporate Notified"
                  name="corporateNotifiedRadio"
                  value={formData.corporateNotified ? 'YES' : 'NO'}
                  options={[
                    { value: 'YES', label: 'Yes' },
                    { value: 'NO', label: 'No' },
                  ]}
                  onChange={(value) => {
                    const newValue = value === 'YES';
                    const updatedFormData = { ...formData, corporateNotified: newValue };
                    setFormData(updatedFormData);
                    // Immediate save for real-time sync with other users
                    saveQAFieldImmediately('corporateNotified', newValue, updatedFormData);
                  }}
                  disabled={!canEditRestrictedSections}
                />
                <FormInput
                  label="Person(s) Notified"
                  name="corporatePersonsNotified"
                  value={formData.corporatePersonsNotified}
                  onChange={handleChange}
                  placeholder="Names of contacts notified"
                  className="col-span-2 sm:col-span-2"
                  disabled={!canEditRestrictedSections || !formData.corporateNotified}
                />
              </div>

              {/* Pre-Shipment Review Row */}
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg">
                <p className="text-xs font-semibold text-blue-800 dark:text-blue-300 mb-2">
                  Pre-Shipment Review
                </p>
                <p className="text-xs text-blue-600 dark:text-blue-400 mb-3 italic">
                  *Pre-Shipment signature is required when product is placed on hold
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <FormInput
                    label="Pre-Shipment Review Notes"
                    name="preShipmentReview"
                    value={formData.preShipmentReview}
                    onChange={handleChange}
                    placeholder="Review notes"
                    disabled={!canEditRestrictedSections || !formData.productPlacedOnHold}
                  />
                  <FormInput
                    label="Date"
                    name="preShipmentReviewDate"
                    type="date"
                    value={formData.preShipmentReviewDate}
                    onChange={handleChange}
                    disabled={!canEditRestrictedSections || !formData.productPlacedOnHold}
                  />
                </div>
              </div>
            </FormSection>

            {/* Evidence Attachments */}
            <div id="evidence-section" className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="px-3 sm:px-4 py-3 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-750 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="p-1.5 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
                      <Upload className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white">
                          Evidence Attachments
                        </h3>
                        <span className="hidden sm:inline-flex px-2 py-0.5 text-xs font-semibold rounded-full bg-red-500 text-white">
                          Required
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        Save ALL FM known to exist and submit with report
                      </p>
                    </div>
                  </div>
                  {isEditMode && (
                    <label className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg cursor-pointer transition-colors shadow-sm">
                      {uploadingFiles ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Upload className="w-4 h-4" />
                      )}
                      <span className="hidden sm:inline">Upload Evidence</span>
                      <span className="sm:hidden">Upload</span>
                      <input
                        type="file"
                        className="hidden"
                        multiple
                        accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx"
                        onChange={handleFileUpload}
                        disabled={uploadingFiles}
                      />
                    </label>
                  )}
                </div>
              </div>

              <div className="p-3 sm:p-4">
                {!isEditMode ? (
                  <div className="text-center py-4 text-gray-500 dark:text-gray-400">
                    <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Save the report as a draft first to upload evidence files.</p>
                  </div>
                ) : (
                  <>
                    {/* Upload area */}
                    <label className="block mb-4">
                      <div className="flex items-center justify-center w-full h-24 px-4 transition bg-gray-50 dark:bg-gray-700/50 border-2 border-gray-300 dark:border-gray-600 border-dashed rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700">
                        <div className="flex flex-col items-center">
                          {uploadingFiles ? (
                            <Loader2 className="w-6 h-6 animate-spin text-primary-500 mb-1" />
                          ) : (
                            <Upload className="w-8 h-8 text-gray-400 mb-2" />
                          )}
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {uploadingFiles ? 'Uploading...' : 'Click to upload or drag and drop'}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-500">
                            Images, videos, PDFs, Excel, Word (max 50MB)
                          </p>
                        </div>
                        <input
                          type="file"
                          className="hidden"
                          multiple
                          accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx"
                          onChange={handleFileUpload}
                          disabled={uploadingFiles}
                        />
                      </div>
                    </label>

                    {/* Evidence list */}
                    {evidence.length > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {evidence.map((file) => (
                          <div
                            key={file.id}
                            className="group relative bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-200 dark:border-gray-600 overflow-hidden transition-all hover:shadow-lg hover:border-primary-300 dark:hover:border-primary-600"
                          >
                            {/* Thumbnail area for photos */}
                            {file.type === 'PHOTO' ? (
                              <div 
                                className="relative aspect-video bg-gray-100 dark:bg-gray-800 cursor-pointer overflow-hidden"
                                onClick={() => openCropModal(file)}
                              >
                                {imageUrls[file.id] ? (
                                  <img
                                    src={getEvidenceImageUrl(file)}
                                    alt={file.fileName}
                                    className="w-full h-full object-cover transition-transform group-hover:scale-105"
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="%236b7280" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>';
                                    }}
                                  />
                                ) : (
                                  <div className="flex items-center justify-center w-full h-full">
                                    <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
                                  </div>
                                )}
                                {/* Crop overlay on hover */}
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                                  <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2 text-white bg-black/50 px-3 py-1.5 rounded-full">
                                    <Crop className="w-4 h-4" />
                                    <span className="text-sm font-medium">Click to Crop</span>
                                  </div>
                                </div>
                              </div>
                            ) : file.type === 'VIDEO' ? (
                              <div 
                                className="relative aspect-video bg-gray-100 dark:bg-gray-800 cursor-pointer overflow-hidden"
                                onClick={() => openVideoModal(file)}
                              >
                                {videoUrls[file.id] ? (
                                  <video
                                    src={videoUrls[file.id]}
                                    className="w-full h-full object-cover"
                                    preload="metadata"
                                    muted
                                  />
                                ) : (
                                  <div className="flex items-center justify-center w-full h-full">
                                    <Video className="w-12 h-12 text-purple-500" />
                                  </div>
                                )}
                                {/* Play overlay on hover */}
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                                  <div className="opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center gap-1">
                                    <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
                                      <Play className="w-6 h-6 text-slate-800 ml-0.5" />
                                    </div>
                                    <span className="text-xs font-medium text-white bg-black/50 px-2 py-0.5 rounded">Play</span>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center justify-center aspect-video bg-gray-100 dark:bg-gray-800">
                                <File className="w-12 h-12 text-gray-400" />
                              </div>
                            )}

                            {/* File info */}
                            <div className="p-3">
                              <button
                                onClick={() => openRenameModal(file)}
                                className="w-full text-left group/name hover:bg-gray-100 dark:hover:bg-gray-600 -mx-2 px-2 py-1 rounded-lg transition-colors"
                                title="Click to rename"
                              >
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate flex-1">
                                    {file.fileName}
                                  </p>
                                  <Edit2 className="w-3.5 h-3.5 text-gray-400 opacity-0 group-hover/name:opacity-100 transition-opacity flex-shrink-0" />
                                </div>
                              </button>
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                {formatFileSize(file.fileSize)} • {file.type}
                              </p>
                            </div>

                            {/* Action buttons */}
                            <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              {file.type === 'PHOTO' && (
                                <button
                                  onClick={() => openCropModal(file)}
                                  className="p-1.5 bg-white/90 dark:bg-gray-800/90 text-gray-600 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 rounded-lg shadow-sm transition-colors"
                                  title="Crop image"
                                >
                                  <Crop className="w-4 h-4" />
                                </button>
                              )}
                              {file.type === 'VIDEO' && (
                                <button
                                  onClick={() => openVideoModal(file)}
                                  className="p-1.5 bg-white/90 dark:bg-gray-800/90 text-gray-600 dark:text-gray-300 hover:text-purple-600 dark:hover:text-purple-400 rounded-lg shadow-sm transition-colors"
                                  title="Play video"
                                >
                                  <Scissors className="w-4 h-4" />
                                </button>
                              )}
                              <button
                                onClick={() => openRenameModal(file)}
                                className="p-1.5 bg-white/90 dark:bg-gray-800/90 text-gray-600 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 rounded-lg shadow-sm transition-colors"
                                title="Rename file"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <a
                                href={`${process.env.NEXT_PUBLIC_API_URL}/fmir/${currentReportId || editId}/evidence/${file.id}/download`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 bg-white/90 dark:bg-gray-800/90 text-gray-600 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 rounded-lg shadow-sm transition-colors"
                                title="Download file"
                              >
                                <Download className="w-4 h-4" />
                              </a>
                              <button
                                onClick={() => handleDeleteEvidence(file.id)}
                                className="p-1.5 bg-white/90 dark:bg-gray-800/90 text-gray-600 dark:text-gray-300 hover:text-red-600 dark:hover:text-red-400 rounded-lg shadow-sm transition-colors"
                                title="Delete file"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Confidentiality Notice */}
            <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <p className="text-xs text-gray-600 dark:text-gray-400 italic">
                This material constitutes trade secrets and commercial or financial information,
                is privileged or confidential, and may not be disclosed.
              </p>
            </div>
          </div>

          {/* Bottom action buttons */}
          <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-end">
            <button
              onClick={() => router.push('/fmir')}
              className="px-6 py-2.5 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 font-medium rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveDraft}
              disabled={autoSaveEnabled || autoSaving || submitting}
              className={`inline-flex items-center justify-center gap-2 px-6 py-2.5 font-medium rounded-lg transition-colors ${
                autoSaveEnabled
                  ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed opacity-50'
                  : 'bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-800 dark:text-white disabled:opacity-50'
              }`}
              title={autoSaveEnabled ? 'Auto Save is enabled' : 'Save draft manually'}
            >
              {autoSaving && !autoSaveEnabled ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Draft
            </button>
            {showSubmitButton && (
              <button
                onClick={handleInitiateSubmit}
                disabled={autoSaving || submitting || validating || !canSubmit}
                className={`inline-flex items-center justify-center gap-2 px-6 py-2.5 font-medium rounded-lg transition-colors shadow-sm ${
                  canSubmit
                    ? 'bg-primary-600 hover:bg-primary-700 text-white'
                    : 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                } disabled:opacity-50`}
                title={!canSubmit ? 'Please fill in required fields' : 'Submit report'}
              >
                {validating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                {validating ? 'Validating...' : 'Submit Report'}
              </button>
            )}
            {!showSubmitButton && !showValidateButton && (
              <span className="text-xs text-amber-600 dark:text-amber-400 inline-flex items-center gap-1 px-3 py-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                <AlertCircle className="w-3.5 h-3.5" />
                Fill all required fields to enable Submit
              </span>
            )}
            {showValidateButton && (
              <button
                onClick={handleInitiateSubmit}
                disabled={autoSaving || submitting || validating || !canSubmit}
                className={`inline-flex items-center justify-center gap-2 px-6 py-2.5 font-medium rounded-lg transition-colors shadow-sm ${
                  canSubmit
                    ? 'bg-green-600 hover:bg-green-700 text-white'
                    : 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                } disabled:opacity-50`}
                title={!canSubmit ? 'Please fill in required fields' : 'Validate report for compliance'}
              >
                {validating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ClipboardCheck className="w-4 h-4" />
                )}
                {validating ? 'Validating...' : 'Validate Report'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* AI Validation Modal */}
      {showSubmitValidationModal && validationData && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            {/* Backdrop - no click handler, user must use modal buttons */}
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />

            {/* Modal */}
            <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
              {/* Header */}
              <div className={`sticky top-0 px-6 py-4 flex items-center justify-between ${
                validationData.compliance?.overallCompliance === 'COMPLIANT' 
                  ? 'bg-gradient-to-r from-green-500 to-emerald-500' 
                  : validationData.compliance?.overallCompliance === 'NEEDS_IMPROVEMENT'
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500'
                  : 'bg-gradient-to-r from-red-500 to-rose-500'
              }`}>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-lg">
                    {validationData.compliance?.overallCompliance === 'COMPLIANT' ? (
                      <CheckCircle className="w-6 h-6 text-white" />
                    ) : validationData.compliance?.overallCompliance === 'NEEDS_IMPROVEMENT' ? (
                      <AlertTriangle className="w-6 h-6 text-white" />
                    ) : (
                      <XCircle className="w-6 h-6 text-white" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">AI Pre-Submission Validation</h3>
                    <p className="text-white/80 text-sm">
                      Compliance Score: {validationData.compliance?.complianceScore || 0}%
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowSubmitValidationModal(false)}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>

              {/* Content */}
              <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)] space-y-6">
                {/* Status Badge */}
                <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${
                  validationData.compliance?.overallCompliance === 'COMPLIANT' 
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' 
                    : validationData.compliance?.overallCompliance === 'NEEDS_IMPROVEMENT'
                    ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                    : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                }`}>
                  {validationData.compliance?.overallCompliance === 'COMPLIANT' && <CheckCircle className="w-4 h-4" />}
                  {validationData.compliance?.overallCompliance === 'NEEDS_IMPROVEMENT' && <AlertTriangle className="w-4 h-4" />}
                  {validationData.compliance?.overallCompliance === 'NON_COMPLIANT' && <XCircle className="w-4 h-4" />}
                  {validationData.compliance?.overallCompliance === 'COMPLIANT' ? 'Ready to Submit' : 
                   validationData.compliance?.overallCompliance === 'NEEDS_IMPROVEMENT' ? 'Review Recommended' : 'Action Required'}
                </div>

                {/* Field Analysis */}
                {validationData.compliance?.fieldAnalysis && validationData.compliance.fieldAnalysis.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      Description Field Analysis
                    </h4>
                    <div className="space-y-2">
                      {validationData.compliance.fieldAnalysis.map((field: any, idx: number) => (
                        <div key={idx} className="p-3 rounded-lg border bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
                          <div className="flex items-start justify-between">
                            <span className="font-medium text-gray-900 dark:text-white text-sm">
                              {field.field}
                            </span>
                            {field.section && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                                Section {field.section}
                              </span>
                            )}
                          </div>
                          {field.issue && (
                            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                              <span className="text-amber-500">⚠️</span> {field.issue}
                            </p>
                          )}
                          {field.recommendation && (
                            <p className="mt-2 text-xs text-blue-600 dark:text-blue-400 italic">
                              💡 {field.recommendation}
                            </p>
                          )}
                          {field.regulatoryReference && (
                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">
                              📋 {field.regulatoryReference}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Evidence Analysis */}
                {validationData.compliance?.evidenceAnalysis && (
                  <div className="space-y-3">
                    <h4 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                      <Camera className="w-4 h-4" />
                      Evidence Analysis
                    </h4>
                    <div className={`p-4 rounded-lg border ${
                      validationData.compliance.evidenceAnalysis.adequate 
                        ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' 
                        : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
                    }`}>
                      <div className="flex items-center gap-2 mb-2">
                        {validationData.compliance.evidenceAnalysis.adequate ? (
                          <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                        )}
                        <span className="font-medium text-sm text-gray-900 dark:text-white">
                          {validationData.compliance.evidenceAnalysis.adequate ? 'Evidence is Adequate' : 'Evidence Needs Improvement'}
                        </span>
                      </div>
                      
                      {validationData.compliance.evidenceAnalysis.summary && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                          {validationData.compliance.evidenceAnalysis.summary}
                        </p>
                      )}
                      
                      {validationData.compliance.evidenceAnalysis.recommendations && validationData.compliance.evidenceAnalysis.recommendations.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-xs font-medium text-gray-700 dark:text-gray-300">Recommendations:</p>
                          <ul className="space-y-1">
                            {validationData.compliance.evidenceAnalysis.recommendations.map((rec: string, i: number) => (
                              <li key={i} className="text-xs text-blue-600 dark:text-blue-400 flex items-start gap-1">
                                <span className="mt-0.5">💡</span>
                                {rec}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Additional Evidence Recommendations */}
                {validationData.evidenceRecommendations && validationData.evidenceRecommendations.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                      <Info className="w-4 h-4" />
                      Additional Recommendations
                    </h4>
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                      <ul className="space-y-2">
                        {validationData.evidenceRecommendations.map((rec: string, i: number) => (
                          <li key={i} className="text-sm text-blue-700 dark:text-blue-300">
                            {rec}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {/* AI Summary */}
                {validationData.compliance?.aiExplanation && (
                  <div className="space-y-3">
                    <h4 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                      <Sparkles className="w-4 h-4" />
                      AI Summary
                    </h4>
                    <div className="p-4 bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        {validationData.compliance.aiExplanation}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer Actions */}
              <div className="sticky bottom-0 bg-gray-50 dark:bg-gray-800 px-6 py-4 flex items-center justify-end gap-3 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => setShowSubmitValidationModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                >
                  {validationData.canSubmit ? 'Cancel & Edit' : 'Go Back & Complete Form'}
                </button>
                {validationData.canSubmit && (
                  <button
                    onClick={handleProceedToSubmit}
                    disabled={submitting}
                    className="inline-flex items-center gap-2 px-6 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <Send className="w-4 h-4" />
                    Proceed to Submit
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SOP Modal */}
      {showSOPModal && (
        <div className="fixed inset-0 z-50 p-4" onClick={() => setShowSOPModal(false)}>
            {/* Modal */}
            <div
              ref={sopModalRef}
              className="fixed bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden"
              style={{ left: sopModalPos?.x ?? 16, top: sopModalPos?.y ?? 16 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div
                className="sticky top-0 bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-4 flex items-center justify-between cursor-move select-none"
                onMouseDown={(e) => {
                  if ((e.target as HTMLElement).closest('button')) return;
                  if (!sopModalRef.current) return;
                  sopDragRef.current.active = true;
                  const rect = sopModalRef.current.getBoundingClientRect();
                  sopDragRef.current.offsetX = e.clientX - rect.left;
                  sopDragRef.current.offsetY = e.clientY - rect.top;
                  document.body.style.userSelect = 'none';
                  e.preventDefault();
                }}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <BookOpen className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">
                      Foreign Material Incident Report
                    </h2>
                    <p className="text-amber-100 text-xs">Standard Operating Procedure</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowSOPModal(false)}
                  className="p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Content */}
              <div className="p-5 sm:p-6 overflow-y-auto max-h-[calc(90vh-140px)] space-y-5 text-[13px] sm:text-sm leading-relaxed">
                {/* Confidentiality Notice */}
                <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg border-l-4 border-gray-400">
                  <p className="text-xs text-gray-600 dark:text-gray-400 italic leading-relaxed">
                    This material constitutes trade secrets and commercial or financial information, is privileged or confidential, is considered by this Company to fall within the exemption from disclosure of the Freedom of Information Act contained in 5 USCS § 552(b)(4), and may not be disclosed without prior approval from this Company.
                  </p>
                </div>

                {/* Emergency Action */}
                <div className="p-5 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800">
                  <h3 className="text-base font-bold text-red-700 dark:text-red-400 mb-3">
                    ⚠️ If foreign material is found, or a FM quality check has failed:
                  </h3>
                  <p className="text-xl font-extrabold text-red-600 dark:text-red-400 mb-4">
                    STOP THE LINE IMMEDIATELY.
                  </p>
                  <ol className="space-y-2 text-gray-700 dark:text-gray-300">
                    <li className="flex items-start gap-2">
                      <span className="font-bold text-red-600 dark:text-red-400">1.</span>
                      <span>Notify the <strong>Lead Supervisor/Superintendent</strong>, and <strong>QC Supervisor</strong>.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-bold text-red-600 dark:text-red-400">2.</span>
                      <span>Use the Foreign Material Incident Report to help guide you through the investigation process.</span>
                    </li>
                  </ol>
                </div>

                {/* Main Report Sections */}
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white border-b-2 border-amber-500 pb-2">
                    FOREIGN MATERIAL INCIDENT REPORT
                  </h3>

                  {/* Section 1 */}
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
                    <h4 className="text-base font-bold text-blue-700 dark:text-blue-400 mb-2 flex items-center gap-2">
                      <span className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm">1</span>
                      Header/General Information
                    </h4>
                    <p className="text-gray-700 dark:text-gray-300 mb-2">Collect this information about the incident immediately.</p>
                    <div className="ml-4 p-3 bg-white/50 dark:bg-gray-800/50 rounded-lg">
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        <strong>Note:</strong> <em>Amount Involved</em> may need to be determined later using traceability exercises.
                      </p>
                    </div>
                  </div>

                  {/* Section 2 */}
                  <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl border border-purple-200 dark:border-purple-800">
                    <h4 className="text-base font-bold text-purple-700 dark:text-purple-400 mb-2 flex items-center gap-2">
                      <span className="w-7 h-7 rounded-full bg-purple-600 text-white flex items-center justify-center text-sm">2</span>
                      Describe the foreign object in detail
                    </h4>
                    <p className="text-gray-700 dark:text-gray-300 mb-2">Include size and hardness.</p>
                    <ul className="ml-4 space-y-2 text-gray-700 dark:text-gray-300">
                      <li className="flex items-start gap-2">
                        <span className="text-purple-600">a.</span>
                        <span>Save ALL FM known to exist and submit with report.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-purple-600">b.</span>
                        <span>Include specific size (in mm) and details about the foreign material.</span>
                      </li>
                    </ul>
                  </div>

                  {/* Section 3 */}
                  <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800">
                    <h4 className="text-base font-bold text-green-700 dark:text-green-400 mb-2 flex items-center gap-2">
                      <span className="w-7 h-7 rounded-full bg-green-600 text-white flex items-center justify-center text-sm">3</span>
                      Identify the cause of this incident
                    </h4>
                    <p className="text-gray-700 dark:text-gray-300 mb-2">Possible source? How/Why did the incident occur?</p>
                    <ul className="ml-4 space-y-2 text-gray-700 dark:text-gray-300">
                      <li className="flex items-start gap-2">
                        <span className="text-green-600">a.</span>
                        <span><strong>What Happened?</strong> – Include as much details as possible, pictures might be helpful.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-green-600">b.</span>
                        <span>Interview ALL those involved, including craftsmen if applicable.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-green-600">c.</span>
                        <span>Identifying the cause of the incident is critical to ensure the remaining procedures are adequate.</span>
                      </li>
                    </ul>
                  </div>

                  {/* Section 4 */}
                  <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-xl border border-orange-200 dark:border-orange-800">
                    <h4 className="text-base font-bold text-orange-700 dark:text-orange-400 mb-2 flex items-center gap-2">
                      <span className="w-7 h-7 rounded-full bg-orange-600 text-white flex items-center justify-center text-sm">4</span>
                      What action was taken when the incident was noted?
                    </h4>
                    <p className="text-gray-700 dark:text-gray-300 mb-2">How was it corrected?</p>
                    <ul className="ml-4 space-y-2 text-gray-700 dark:text-gray-300">
                      <li className="flex items-start gap-2">
                        <span className="text-orange-600">a.</span>
                        <span>Perform corrective actions to isolate this event from future operations.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-orange-600">b.</span>
                        <span>May include wash downs, changing out effected equipment, or replacing malfunctioning parts.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-orange-600">c.</span>
                        <span>Walk the process and review upstream control for any additional signs of the FM.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-orange-600">d.</span>
                        <span>Review these corrective actions with QC to gain their agreement moving forward.</span>
                      </li>
                    </ul>
                  </div>

                  {/* QC Department Notice */}
                  <div className="p-4 bg-amber-100 dark:bg-amber-900/30 rounded-xl border-2 border-amber-400 dark:border-amber-600">
                    <p className="text-amber-800 dark:text-amber-300 font-bold text-center">
                      ⭐ Sections 5, 6, 7, 8, and 9 Shall be completed by QC Department
                    </p>
                  </div>

                  {/* Section 5 */}
                  <div className="p-4 bg-teal-50 dark:bg-teal-900/20 rounded-xl border border-teal-200 dark:border-teal-800">
                    <h4 className="text-base font-bold text-teal-700 dark:text-teal-400 mb-2 flex items-center gap-2">
                      <span className="w-7 h-7 rounded-full bg-teal-600 text-white flex items-center justify-center text-sm">5</span>
                      Verify corrective actions were implemented (QC)
                    </h4>
                    <ul className="ml-4 space-y-2 text-gray-700 dark:text-gray-300">
                      <li className="flex items-start gap-2">
                        <span className="text-teal-600">a.</span>
                        <span>Verification (i.e. Direct Observation) that the corrective actions taken above actually occurred.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-teal-600">b.</span>
                        <span>If Maintenance work was completed, have the maintenance operator sign the document confirming complete and communicate the area (if applicable) that needs to be cleaned.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-teal-600">c.</span>
                        <span>After corrective actions have been implemented, secure QC's approval to restart production.</span>
                      </li>
                    </ul>
                  </div>

                  {/* Section 6 */}
                  <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-200 dark:border-indigo-800">
                    <h4 className="text-base font-bold text-indigo-700 dark:text-indigo-400 mb-2 flex items-center gap-2">
                      <span className="w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center text-sm">6</span>
                      Was product placed on hold?
                    </h4>
                    <ul className="ml-4 space-y-3 text-gray-700 dark:text-gray-300">
                      <li className="flex items-start gap-2">
                        <span className="text-indigo-600">a.</span>
                        <span><strong>Item #'s Held</strong> - Any implicated product must be placed on Category 1 hold and physically tagged.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-indigo-600">b.</span>
                        <div>
                          <span><strong>If Yes</strong>, Include details of decision making process for determining the window of contamination:</span>
                          <ul className="mt-2 ml-4 space-y-1 text-sm">
                            <li className="flex items-start gap-2">
                              <span className="text-indigo-500">i.</span>
                              <span>Top priority is control of the FM window, including review of source raw material/product.</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="text-indigo-500">ii.</span>
                              <span>Include rework and similar product that may be implicated (byproducts, scrap, product sent to another dept, or product used in a prior manufacturing step).</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="text-indigo-500">iii.</span>
                              <span>Do not dispose of any product or inedible material, regardless of whether or not you believe it to be contaminated. (We may need to account for all FM.)</span>
                            </li>
                          </ul>
                        </div>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-indigo-600">c.</span>
                        <span><strong>If No</strong>, Include details of decision making process and how you came to this conclusion.</span>
                      </li>
                    </ul>
                  </div>

                  {/* Section 7 */}
                  <div className="p-4 bg-pink-50 dark:bg-pink-900/20 rounded-xl border border-pink-200 dark:border-pink-800">
                    <h4 className="text-base font-bold text-pink-700 dark:text-pink-400 mb-2 flex items-center gap-2">
                      <span className="w-7 h-7 rounded-full bg-pink-600 text-white flex items-center justify-center text-sm">7</span>
                      If applicable, what screening process will be used?*
                    </h4>
                    <div className="ml-4 text-gray-700 dark:text-gray-300">
                      <p className="flex items-start gap-2">
                        <span className="text-pink-600">a.</span>
                        <span>Was the affected product screened prior to release (metal detection, visual inspection, etc)?</span>
                      </p>
                    </div>
                  </div>

                  {/* Section 8 */}
                  <div className="p-4 bg-cyan-50 dark:bg-cyan-900/20 rounded-xl border border-cyan-200 dark:border-cyan-800">
                    <h4 className="text-base font-bold text-cyan-700 dark:text-cyan-400 mb-2 flex items-center gap-2">
                      <span className="w-7 h-7 rounded-full bg-cyan-600 text-white flex items-center justify-center text-sm">8</span>
                      Final disposition of product or materials affected/Volume*
                    </h4>
                    <p className="text-gray-700 dark:text-gray-300 mb-2">Include justification for decision.</p>
                    <div className="ml-4 text-gray-700 dark:text-gray-300">
                      <p className="flex items-start gap-2">
                        <span className="text-cyan-600">a.</span>
                        <span>If Rework is used for screening process, Lot Inspection of end product shall be conducted by QC.</span>
                      </p>
                    </div>
                  </div>

                  {/* Section 9 */}
                  <div className="p-4 bg-rose-50 dark:bg-rose-900/20 rounded-xl border border-rose-200 dark:border-rose-800">
                    <h4 className="text-base font-bold text-rose-700 dark:text-rose-400 mb-2 flex items-center gap-2">
                      <span className="w-7 h-7 rounded-full bg-rose-600 text-white flex items-center justify-center text-sm">9</span>
                      What measures were taken to prevent the incident from re-occurring?*
                    </h4>
                    <ul className="ml-4 space-y-2 text-gray-700 dark:text-gray-300">
                      <li className="flex items-start gap-2">
                        <span className="text-rose-600">a.</span>
                        <span>Actions taken to ensure it does not happen again, if re-train is part, need documentation.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-rose-600">b.</span>
                        <span>Should address the ROOT CAUSE of the incident to ensure it doesn't repeat.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-rose-600">c.</span>
                        <span>If there is not a control in your process or if the control is not effective, what else can we do?</span>
                      </li>
                    </ul>
                  </div>
                </div>

                {/* Follow-up Procedures */}
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white border-b-2 border-amber-500 pb-2">
                    FOLLOW-UP PROCEDURES
                  </h3>
                  <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                    <ol className="space-y-3 text-gray-700 dark:text-gray-300">
                      <li className="flex items-start gap-3">
                        <span className="w-6 h-6 rounded-full bg-gray-600 text-white flex items-center justify-center text-sm flex-shrink-0">1</span>
                        <span>Compose a detailed E-mail containing your findings and send to appropriate personnel.</span>
                      </li>
                      <li className="flex items-start gap-3">
                        <span className="w-6 h-6 rounded-full bg-gray-600 text-white flex items-center justify-center text-sm flex-shrink-0">2</span>
                        <span>Submit with the FM report with ALL FM known to exist to QC Department.</span>
                      </li>
                      <li className="flex items-start gap-3">
                        <span className="w-6 h-6 rounded-full bg-gray-600 text-white flex items-center justify-center text-sm flex-shrink-0">3</span>
                        <span>QC: Review Flow Diagram to ensure required documentation and procedures are followed.</span>
                      </li>
                    </ol>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="sticky bottom-0 bg-gray-100 dark:bg-gray-800 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => setShowSOPModal(false)}
                  className="w-full px-4 py-3 text-sm font-semibold text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 rounded-lg transition-colors shadow-md"
                >
                  Close Guide
                </button>
              </div>
            </div>
        </div>
      )}

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            {/* Backdrop */}
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />

            {/* Modal */}
            <div className="relative bg-white dark:bg-gray-900 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-bounce-in">
              {/* Animated background */}
              <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-0 left-1/4 w-32 h-32 bg-green-400/20 rounded-full blur-2xl animate-pulse" />
                <div className="absolute bottom-0 right-1/4 w-40 h-40 bg-primary-400/20 rounded-full blur-2xl animate-pulse" style={{ animationDelay: '500ms' }} />
              </div>

              {/* Content */}
              <div className="relative p-8 text-center">
                {/* Success icon with animation */}
                <div className="relative mx-auto w-24 h-24 mb-6">
                  <div className="absolute inset-0 rounded-full bg-gradient-to-r from-green-400 via-emerald-500 to-teal-500 blur-lg opacity-60 animate-pulse" />
                  <div className="relative w-24 h-24 bg-gradient-to-br from-green-400 via-emerald-500 to-teal-500 rounded-full flex items-center justify-center shadow-xl">
                    <CheckCircle className="w-12 h-12 text-white" />
                  </div>
                </div>

                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  Report Submitted! 🎉
                </h2>
                <p className="text-gray-600 dark:text-gray-400 mb-2">
                  Your FMIR report has been successfully submitted.
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-500 mb-2">
                  Report #{reportNumber}
                </p>
                {submittedByName && (
                  <p className="text-sm text-primary-600 dark:text-primary-400 font-medium mb-6">
                    Submitted by: {submittedByName}
                  </p>
                )}

                {/* Confetti-like decorations */}
                <div className="flex justify-center gap-2 mb-6">
                  <span className="inline-block w-2 h-2 bg-yellow-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="inline-block w-2 h-2 bg-green-400 rounded-full animate-bounce" style={{ animationDelay: '100ms' }} />
                  <span className="inline-block w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '200ms' }} />
                  <span className="inline-block w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  <span className="inline-block w-2 h-2 bg-pink-400 rounded-full animate-bounce" style={{ animationDelay: '400ms' }} />
                </div>

                <button
                  onClick={() => {
                    setShowSuccessModal(false);
                    router.push('/fmir');
                  }}
                  className="w-full px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-semibold rounded-xl shadow-lg transition-all transform hover:scale-105"
                >
                  View All Reports
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Password Verification Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            {/* Backdrop - no click handler, user must use modal buttons */}
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />

            {/* Modal */}
            <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
              {/* Header */}
              <div className="bg-gradient-to-r from-primary-500 to-primary-600 px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <Shield className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">Verify Your Identity</h3>
                    <p className="text-white/80 text-sm">Enter your password to submit</p>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="p-6 space-y-4">
                {/* User Info */}
                <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                    <User className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {user?.firstName} {user?.lastName}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{user?.email}</p>
                  </div>
                </div>

                <p className="text-sm text-gray-600 dark:text-gray-400">
                  For security, please enter your password to confirm the submission of this FMIR report.
                </p>

                {/* Password Input */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Password
                  </label>
                  <input
                    type="password"
                    value={enteredPassword}
                    onChange={(e) => {
                      setEnteredPassword(e.target.value);
                      setPasswordError('');
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && enteredPassword.trim()) {
                        handlePasswordVerification();
                      }
                    }}
                    placeholder="Enter your password"
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    autoFocus
                  />
                  {passwordError && (
                    <p className="mt-2 text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      {passwordError}
                    </p>
                  )}
                </div>
              </div>

              {/* Footer Actions */}
              <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800 flex items-center justify-end gap-3 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => {
                    setShowPasswordModal(false);
                    setEnteredPassword('');
                    setPasswordError('');
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePasswordVerification}
                  disabled={verifyingPassword || !enteredPassword.trim()}
                  className="inline-flex items-center gap-2 px-6 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors disabled:opacity-50"
                >
                  {verifyingPassword ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Verifying...
                    </>
                  ) : submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Confirm & Submit
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Already Submitted Modal */}
      {showAlreadySubmittedModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            {/* Backdrop - no click handler, user must use modal buttons */}
            <div className="fixed inset-0 bg-black/40 backdrop-blur-xl" />

            {/* Ultra Glassy Apple-style Modal */}
            <div className="relative bg-white/20 dark:bg-gray-900/25 backdrop-blur-3xl backdrop-saturate-150 rounded-3xl w-full max-w-md overflow-hidden animate-bounce-in border border-white/30 dark:border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.12),inset_0_0_0_1px_rgba(255,255,255,0.1)]">
              {/* Top highlight edge (Apple glass effect) */}
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent" />
              
              {/* Glossy shine overlay - subtle light reflection */}
              <div className="absolute inset-0 bg-gradient-to-br from-white/30 via-white/5 to-transparent pointer-events-none" />
              
              {/* Secondary light layer for depth */}
              <div className="absolute inset-0 bg-gradient-to-t from-transparent via-transparent to-white/10 pointer-events-none" />
              
              {/* Animated background blobs */}
              <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-10 -left-10 w-40 h-40 bg-blue-400/20 rounded-full blur-3xl animate-pulse" />
                <div className="absolute -bottom-10 -right-10 w-48 h-48 bg-purple-400/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '500ms' }} />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-indigo-400/15 rounded-full blur-2xl animate-pulse" style={{ animationDelay: '250ms' }} />
              </div>

              {/* Content */}
              <div className="relative p-8 text-center">
                {/* Info icon with animation */}
                <div className="relative mx-auto w-24 h-24 mb-6">
                  <div className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-400 via-indigo-500 to-purple-500 blur-xl opacity-50 animate-pulse" />
                  <div className="relative w-24 h-24 bg-gradient-to-br from-blue-400 via-indigo-500 to-purple-500 rounded-full flex items-center justify-center shadow-2xl ring-4 ring-white/20 backdrop-blur-sm">
                    <CheckCircle className="w-12 h-12 text-white drop-shadow-lg" />
                  </div>
                </div>

                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2 drop-shadow-sm">
                  Submitted Successfully! ✓
                </h2>
                <p className="text-gray-700 dark:text-gray-200 mb-4 drop-shadow-sm">
                  Your report has been successfully submitted.
                </p>

                {/* Auto Save Status */}
                {autoSaveEnabled && (
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-500/15 backdrop-blur-md border border-green-400/30 rounded-full mb-4 shadow-sm">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse shadow-[0_0_8px_rgba(74,222,128,0.6)]" />
                    <span className="text-sm font-medium text-green-700 dark:text-green-300 drop-shadow-sm">Auto Save is ON</span>
                  </div>
                )}
                
                <div className="bg-blue-500/10 backdrop-blur-md border border-blue-400/20 rounded-xl p-4 mb-6 text-left shadow-inner">
                  <p className="text-sm text-blue-800 dark:text-blue-100 font-medium mb-2 drop-shadow-sm">
                    💡 What you can do:
                  </p>
                  <ul className="text-sm text-blue-700 dark:text-blue-200 space-y-1.5">
                    <li className="flex items-start gap-2">
                      <span className="text-blue-400 mt-0.5">•</span>
                      <span className="drop-shadow-sm">Continue editing - your changes will be auto-saved</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-400 mt-0.5">•</span>
                      <span className="drop-shadow-sm">View the submitted report in the reports list</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-400 mt-0.5">•</span>
                      <span className="drop-shadow-sm">Create a new FMIR report if needed</span>
                    </li>
                  </ul>
                </div>

                {/* Decorative dots */}
                <div className="flex justify-center gap-2 mb-6">
                  <span className="inline-block w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="inline-block w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '100ms' }} />
                  <span className="inline-block w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '200ms' }} />
                  <span className="inline-block w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  <span className="inline-block w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '400ms' }} />
                </div>

                <div className="flex flex-col gap-3">
                  <button
                    onClick={() => {
                      setShowAlreadySubmittedModal(false);
                      router.push('/fmir');
                    }}
                    className="w-full px-6 py-3.5 bg-gradient-to-r from-blue-500/90 to-indigo-500/90 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold rounded-xl shadow-lg backdrop-blur-sm transition-all transform hover:scale-[1.02] hover:shadow-xl border border-white/20"
                  >
                    View All Reports
                  </button>
                </div>
              </div>
              
              {/* Bottom edge highlight */}
              <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
            </div>
          </div>
        </div>
      )}

      {/* Resubmit Warning Modal */}
      {showResubmitWarningModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            {/* Backdrop - no click handler, user must use modal buttons */}
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />

            {/* Modal */}
            <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-bounce-in">
              {/* Header */}
              <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-white/20 rounded-xl">
                    <AlertTriangle className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">Report Already Submitted</h2>
                    <p className="text-amber-100 text-sm mt-0.5">This report has been submitted previously</p>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="p-6">
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 mb-6">
                  <p className="text-amber-800 dark:text-amber-200 font-medium mb-2">
                    ⚠️ Warning: This FMIR has already been submitted
                  </p>
                  <p className="text-amber-700 dark:text-amber-300 text-sm">
                    If you proceed, any new changes will <strong>override</strong> the current submitted values.
                  </p>
                </div>

                <p className="text-gray-600 dark:text-gray-400 mb-6 text-sm">
                  Choose one of the following options:
                </p>

                <div className="space-y-3">
                  {/* Override Current Report */}
                  <button
                    onClick={handleProceedWithResubmit}
                    className="w-full flex items-center gap-4 p-4 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 hover:from-orange-100 hover:to-amber-100 dark:hover:from-orange-900/30 dark:hover:to-amber-900/30 border border-orange-200 dark:border-orange-800 rounded-xl transition-all group"
                  >
                    <div className="p-2.5 bg-orange-100 dark:bg-orange-900/40 rounded-lg group-hover:bg-orange-200 dark:group-hover:bg-orange-900/60 transition-colors">
                      <RefreshCw className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="font-semibold text-gray-900 dark:text-white">Override Current Submission</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Update the existing report with new changes</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-orange-500 transition-colors" />
                  </button>

                  {/* Create New Report */}
                  <button
                    onClick={handleCreateNewReport}
                    className="w-full flex items-center gap-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 hover:from-blue-100 hover:to-indigo-100 dark:hover:from-blue-900/30 dark:hover:to-indigo-900/30 border border-blue-200 dark:border-blue-800 rounded-xl transition-all group"
                  >
                    <div className="p-2.5 bg-blue-100 dark:bg-blue-900/40 rounded-lg group-hover:bg-blue-200 dark:group-hover:bg-blue-900/60 transition-colors">
                      <Plus className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="font-semibold text-gray-900 dark:text-white">Create New Report</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Start fresh with a new blank FMIR report</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-blue-500 transition-colors" />
                  </button>

                  {/* Cancel */}
                  <button
                    onClick={() => setShowResubmitWarningModal(false)}
                    className="w-full p-3.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-xl transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Evidence Warning Modal */}
      {showEvidenceWarning && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            {/* Backdrop - no click handler, user must use modal buttons */}
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />

            {/* Modal */}
            <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
              {/* Header */}
              <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <AlertTriangle className="w-6 h-6 text-white" />
                  </div>
                  <h2 className="text-xl font-bold text-white">No Evidence Uploaded</h2>
                </div>
              </div>

              {/* Content */}
              <div className="p-6">
                <p className="text-gray-700 dark:text-gray-300 mb-4">
                  You haven't uploaded any evidence attachments for this report.
                </p>
                <p className="text-gray-600 dark:text-gray-400 text-sm mb-6">
                  It is recommended to upload photos, documents, or other evidence before submitting the report. However, you can still proceed without evidence if needed.
                </p>

                <div className="flex flex-col gap-3">
                  <button
                    onClick={() => {
                      setShowEvidenceWarning(false);
                      // Scroll to evidence section
                      document.getElementById('evidence-section')?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="w-full px-4 py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold rounded-lg transition-colors"
                  >
                    <Upload className="w-4 h-4 inline mr-2" />
                    Upload Evidence First
                  </button>
                  <button
                    onClick={() => {
                      setShowEvidenceWarning(false);
                      handleSubmit(); // Submit anyway
                    }}
                    className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg transition-colors"
                  >
                    Submit Without Evidence
                  </button>
                  <button
                    onClick={() => setShowEvidenceWarning(false)}
                    className="w-full px-4 py-3 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 font-medium transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rename File Modal */}
      {showRenameModal && selectedEvidence && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            {/* Backdrop */}
            <div 
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => {
                setShowRenameModal(false);
                setSelectedEvidence(null);
                setNewFileName('');
              }}
            />

            {/* Modal */}
            <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
              {/* Header */}
              <div className="bg-gradient-to-r from-primary-500 to-primary-600 px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/20 rounded-lg">
                      <Edit2 className="w-5 h-5 text-white" />
                    </div>
                    <h2 className="text-lg font-bold text-white">Rename File</h2>
                  </div>
                  <button
                    onClick={() => {
                      setShowRenameModal(false);
                      setSelectedEvidence(null);
                      setNewFileName('');
                    }}
                    className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5 text-white" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="p-6">
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Current name
                  </label>
                  <p className="text-sm text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded-lg truncate">
                    {selectedEvidence.fileName}
                  </p>
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    New name
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newFileName}
                      onChange={(e) => setNewFileName(e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="Enter new filename"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRenameEvidence();
                        if (e.key === 'Escape') {
                          setShowRenameModal(false);
                          setSelectedEvidence(null);
                          setNewFileName('');
                        }
                      }}
                    />
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {selectedEvidence.fileName.includes('.') 
                        ? selectedEvidence.fileName.substring(selectedEvidence.fileName.lastIndexOf('.'))
                        : ''}
                    </span>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowRenameModal(false);
                      setSelectedEvidence(null);
                      setNewFileName('');
                    }}
                    className="flex-1 px-4 py-2.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleRenameEvidence}
                    disabled={!newFileName.trim()}
                    className="flex-1 px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Crop Image Modal */}
      {showCropModal && selectedEvidence && selectedEvidence.type === 'PHOTO' && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            {/* Backdrop */}
            <div 
              className="fixed inset-0 bg-black/80 backdrop-blur-sm"
              onClick={() => {
                setShowCropModal(false);
                setSelectedEvidence(null);
              }}
            />

            {/* Modal */}
            <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden">
              {/* Header */}
              <div className="bg-gradient-to-r from-purple-500 to-indigo-600 px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/20 rounded-lg">
                      <Crop className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-white">Crop Image</h2>
                      <p className="text-sm text-white/70 truncate max-w-xs">{selectedEvidence.fileName}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setShowCropModal(false);
                      setSelectedEvidence(null);
                    }}
                    className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5 text-white" />
                  </button>
                </div>
              </div>

              {/* Image preview area with selection */}
              <div 
                ref={cropContainerRef}
                className="relative bg-gray-900 overflow-hidden flex items-center justify-center select-none"
                style={{ height: '60vh' }}
              >
                {getEvidenceImageUrl(selectedEvidence) ? (
                  <div className="relative inline-block">
                    <img
                      ref={cropImageRef}
                      src={getEvidenceImageUrl(selectedEvidence)}
                      alt={selectedEvidence.fileName}
                      className="max-w-full max-h-[60vh] object-contain"
                      draggable={false}
                      onLoad={handleCropImageLoad}
                      onMouseDown={handleCropMouseDown}
                      onMouseMove={handleCropMouseMove}
                      onMouseUp={handleCropMouseUp}
                      onMouseLeave={handleCropMouseUp}
                      style={{ cursor: 'crosshair' }}
                    />
                    
                    {/* Selection overlay - darken non-selected areas */}
                    {(isSelecting || hasSelection) && (
                      <>
                        {/* Darkening overlay with cutout */}
                        <div 
                          className="absolute inset-0 pointer-events-none"
                          style={{
                            background: `
                              linear-gradient(to right, rgba(0,0,0,0.6) ${getSelectionRect().x}px, transparent ${getSelectionRect().x}px),
                              linear-gradient(to left, rgba(0,0,0,0.6) ${imageDimensions.width - getSelectionRect().x - getSelectionRect().width}px, transparent ${imageDimensions.width - getSelectionRect().x - getSelectionRect().width}px),
                              linear-gradient(to bottom, rgba(0,0,0,0.6) ${getSelectionRect().y}px, transparent ${getSelectionRect().y}px),
                              linear-gradient(to top, rgba(0,0,0,0.6) ${imageDimensions.height - getSelectionRect().y - getSelectionRect().height}px, transparent ${imageDimensions.height - getSelectionRect().y - getSelectionRect().height}px)
                            `
                          }}
                        />
                        
                        {/* Selection rectangle */}
                        <div
                          className="absolute pointer-events-none border-2 border-white border-dashed"
                          style={{
                            left: getSelectionRect().x,
                            top: getSelectionRect().y,
                            width: getSelectionRect().width,
                            height: getSelectionRect().height,
                            boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)',
                          }}
                        >
                          {/* Corner handles */}
                          <div className="absolute -top-1 -left-1 w-3 h-3 bg-white rounded-sm shadow-md" />
                          <div className="absolute -top-1 -right-1 w-3 h-3 bg-white rounded-sm shadow-md" />
                          <div className="absolute -bottom-1 -left-1 w-3 h-3 bg-white rounded-sm shadow-md" />
                          <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-white rounded-sm shadow-md" />
                          
                          {/* Selection dimensions */}
                          {hasSelection && (
                            <div className="absolute -bottom-7 left-1/2 -translate-x-1/2 bg-black/70 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                              {Math.round(getSelectionRect().width * (imageDimensions.naturalWidth / imageDimensions.width))} × {Math.round(getSelectionRect().height * (imageDimensions.naturalHeight / imageDimensions.height))} px
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3 text-white/70">
                    <Loader2 className="w-12 h-12 animate-spin" />
                    <span>Loading image...</span>
                  </div>
                )}

                {/* Instructions */}
                {imageLoaded && !hasSelection && !isSelecting && (
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/70 text-white px-4 py-2 rounded-full text-sm">
                    <Crop className="w-4 h-4" />
                    Click and drag on the image to select crop area
                  </div>
                )}
              </div>

              {/* Controls */}
              <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  {/* Selection info */}
                  <div className="flex items-center gap-3">
                    {hasSelection ? (
                      <>
                        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                          <CheckCircle className="w-4 h-4 text-green-500" />
                          <span>Area selected</span>
                        </div>
                        <button
                          onClick={clearSelection}
                          className="px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        >
                          Clear Selection
                        </button>
                      </>
                    ) : (
                      <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                        <AlertCircle className="w-4 h-4" />
                        <span>No area selected</span>
                      </div>
                    )}
                  </div>

                  {/* Dimensions preview */}
                  {hasSelection && (
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Output: <span className="font-medium text-gray-900 dark:text-white">
                        {Math.round(getSelectionRect().width * (imageDimensions.naturalWidth / imageDimensions.width))} × {Math.round(getSelectionRect().height * (imageDimensions.naturalHeight / imageDimensions.height))} px
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Action buttons */}
              <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex gap-3">
                <button
                  onClick={() => {
                    setShowCropModal(false);
                    setSelectedEvidence(null);
                  }}
                  className="flex-1 px-4 py-2.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCropSave}
                  disabled={!hasSelection}
                  className={`flex-1 px-4 py-2.5 font-medium rounded-lg transition-colors ${
                    hasSelection
                      ? 'bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white'
                      : 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                  }`}
                >
                  <Crop className="w-4 h-4 inline mr-2" />
                  Crop & Save
                </button>
              </div>

              {/* Hidden canvas for cropping */}
              <canvas ref={cropCanvasRef} className="hidden" />
            </div>
          </div>
        </div>
      )}

      {/* Video Player Modal (Playback Only) */}
      {showVideoModal && selectedEvidence && selectedEvidence.type === 'VIDEO' && (
        <div 
          className="fixed inset-0 bg-slate-900/95 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={closeVideoModal}
        >
          <div 
            className="relative w-full max-w-4xl bg-gradient-to-b from-slate-800 to-slate-850 rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/10"
            onClick={(e) => e.stopPropagation()}
            style={{ backgroundColor: '#1e293b' }}
          >
            {/* Header */}
            <div className="text-center py-5 px-4 bg-gradient-to-b from-slate-700/50 to-transparent">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-purple-600/20 rounded-xl border border-purple-500/30">
                    <Video className="w-5 h-5 text-purple-400" />
                  </div>
                  <div className="text-left">
                    <h2 className="text-lg font-bold text-white">{selectedEvidence.fileName}</h2>
                    <p className="text-slate-400 text-sm">Video Player</p>
                  </div>
                </div>
                <button
                  onClick={closeVideoModal}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>
            </div>
            
            {/* Video Preview */}
            <div className="relative bg-black mx-4 rounded-xl overflow-hidden shadow-inner ring-1 ring-white/10">
              <video
                ref={videoRef}
                src={videoUrls[selectedEvidence.id] || ''}
                className="w-full max-h-[55vh] object-contain"
                preload="metadata"
                muted={isVideoMuted}
                playsInline
                controls
                onLoadedMetadata={handleVideoLoaded}
                onTimeUpdate={handleVideoTimeUpdate}
                onEnded={() => setIsVideoPlaying(false)}
                style={{ backgroundColor: '#000' }}
              />
            </div>
            
            {/* Close button */}
            <div className="p-4 border-t border-slate-700">
              <button
                onClick={closeVideoModal}
                className="w-full px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FMIR Comment Modal */}
      {commentModalSection && (
        <FMIRCommentModal
          isOpen={showCommentModal}
          onClose={() => {
            setShowCommentModal(false);
            setCommentModalSection(null);
          }}
          fmirId={currentReportId || editId || ''}
          sectionNumber={commentModalSection.number}
          sectionTitle={commentModalSection.title}
          collaborators={collaborators}
          currentUserId={user?.id || ''}
          onCommentAdded={refreshComments}
        />
      )}

      {/* FMIR Comment Popup */}
      {commentPopupSection && (
        <FMIRCommentPopup
          isOpen={showCommentPopup}
          onClose={() => {
            setShowCommentPopup(false);
            setCommentPopupSection(null);
            setCommentPopupPosition(null);
          }}
          comments={sectionComments[commentPopupSection] || []}
          currentUserId={user?.id || ''}
          fmirId={currentReportId || editId || ''}
          sectionNumber={commentPopupSection}
          onCommentDeleted={refreshComments}
          anchorPosition={commentPopupPosition || undefined}
        />
      )}

      {/* FMIR Visibility Off Modal */}
      <FMIRVisibilityOffModal
        isOpen={showVisibilityOffModal}
        reportNumber={visibilityOffReportNumber}
        ownerName={visibilityOffOwnerName}
        saving={savingBeforeClose}
        onSaveAndClose={handleSaveAndCloseFromModal}
        onClose={handleCloseWithoutSaving}
      />

      {/* FMIR Locked Modal (when QA closes the report) */}
      {showLockedModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center justify-center mb-4">
              <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                <Lock className="w-8 h-8 text-red-600 dark:text-red-400" />
              </div>
            </div>
            <h3 className="text-xl font-bold text-center text-gray-900 dark:text-white mb-2">
              FMIR Locked
            </h3>
            <p className="text-center text-gray-600 dark:text-gray-300 mb-6">
              Report <span className="font-semibold">{lockedReportNumber}</span> has been locked by QA/Food Safety. 
              This report can no longer be edited.
            </p>
            <button
              onClick={() => router.push('/fmir')}
              className="w-full px-4 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium"
            >
              Return to FMIR List
            </button>
          </div>
        </div>
      )}

      {/* FMIR Investigation Off Modal (when QA toggles investigation off - status changes to SUBMITTED) */}
      {showInvestigationOffModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden">
            {/* Header with gradient */}
            <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-500 p-6">
              <div className="flex items-center justify-center">
                <div className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center ring-4 ring-white/30">
                  <AlertTriangle className="w-10 h-10 text-white" />
                </div>
              </div>
            </div>
            
            {/* Content */}
            <div className="p-6">
              <h3 className="text-2xl font-bold text-center text-gray-900 dark:text-white mb-3">
                Investigation Paused
              </h3>
              <p className="text-center text-gray-600 dark:text-gray-300 mb-4">
                Report <span className="font-bold text-amber-600 dark:text-amber-400">{investigationOffReportNumber}</span> has been submitted and is not currently under investigation.
              </p>
              
              {investigationOffByName && (
                <div className="flex items-center justify-center gap-2 mb-4">
                  <div className="w-8 h-8 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center">
                    <User className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  </div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    Investigation turned off by <span className="font-semibold text-gray-700 dark:text-gray-300">{investigationOffByName}</span>
                  </span>
                </div>
              )}

              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-4 mb-6">
                <div className="flex items-start gap-3">
                  <Info className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-amber-800 dark:text-amber-200 font-medium mb-1">
                      Editing is no longer available
                    </p>
                    <p className="text-sm text-amber-700 dark:text-amber-300">
                      This report is not under investigation. If you need to make any changes, please contact a QA/Food Safety personnel to start the investigation again.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <button
                  onClick={() => router.push('/fmir')}
                  className="w-full px-4 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl hover:from-amber-600 hover:to-orange-600 transition-all shadow-lg shadow-amber-500/25 font-semibold flex items-center justify-center gap-2"
                >
                  <ArrowLeft className="w-5 h-5" />
                  Return to FMIR List
                </button>
                <button
                  onClick={() => {
                    setShowInvestigationOffModal(false);
                    router.push(`/fmir/${currentReportId || editId}`);
                  }}
                  className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium flex items-center justify-center gap-2"
                >
                  <Eye className="w-5 h-5" />
                  View Report (Read Only)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FMIR Deleted Modal (when QA deletes the report) */}
      {showDeletedModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center justify-center mb-4">
              <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                <Trash2 className="w-8 h-8 text-red-600 dark:text-red-400" />
              </div>
            </div>
            <h3 className="text-xl font-bold text-center text-gray-900 dark:text-white mb-2">
              Report Deleted
            </h3>
            <p className="text-center text-gray-600 dark:text-gray-300 mb-4">
              Report <span className="font-semibold">{deletedReportNumber}</span> has been deleted by{' '}
              <span className="font-semibold">{deletedByName}</span>.
            </p>
            <p className="text-center text-gray-500 dark:text-gray-400 mb-6 text-sm">
              You no longer have access to this report.
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => router.push('/fmir')}
                className="w-full px-4 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium"
              >
                Return to FMIR List
              </button>
              <p className="text-center text-gray-400 dark:text-gray-500 text-sm">
                Redirecting automatically in <span className="font-semibold text-amber-500">{deleteCountdown}</span> seconds...
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Removed from Collaboration Modal (when owner removes current user) */}
      {showRemovedModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-bounce-in">
            {/* Header gradient */}
            <div className="bg-gradient-to-r from-orange-500 to-amber-500 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                  <UserMinus className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Access Removed</h3>
                  <p className="text-white/80 text-sm">You've been removed from this report</p>
                </div>
              </div>
            </div>
            
            {/* Content */}
            <div className="p-6">
              <div className="flex items-center justify-center mb-4">
                <div className="w-20 h-20 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center">
                  <UserMinus className="w-10 h-10 text-orange-600 dark:text-orange-400" />
                </div>
              </div>
              
              <p className="text-center text-gray-600 dark:text-gray-300 mb-2">
                You have been removed from collaborating on
              </p>
              <p className="text-center font-semibold text-lg text-gray-900 dark:text-white mb-4">
                {removedReportNumber}
              </p>
              <p className="text-center text-gray-500 dark:text-gray-400 mb-6 text-sm">
                <span className="font-medium">{removedByName}</span> has removed your access to this report.
                You can no longer view or edit it.
              </p>
              
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => router.push('/fmir')}
                  className="w-full px-4 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl hover:from-orange-600 hover:to-amber-600 transition-all shadow-lg shadow-orange-500/25 font-semibold flex items-center justify-center gap-2"
                >
                  <ArrowLeft className="w-5 h-5" />
                  Return to FMIR List
                </button>
                <p className="text-center text-gray-400 dark:text-gray-500 text-sm">
                  Redirecting automatically in <span className="font-semibold text-orange-500">{removeCountdown}</span> seconds...
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Sync Status Toast - Bottom right */}
      {(isSyncing || lastSyncedBy) && (
        <div className="fixed bottom-4 right-4 z-[100] animate-slide-in-right">
          <div className={`relative overflow-hidden rounded-xl shadow-2xl min-w-[280px] max-w-sm transition-all duration-300 ${
            isSyncing 
              ? 'bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600 shadow-blue-500/25' 
              : 'bg-gradient-to-r from-emerald-500 via-green-500 to-teal-500 shadow-green-500/25'
          }`}>
            {/* Shimmer effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full animate-shimmer" />
            
            {/* Glow effect */}
            <div className={`absolute -inset-1 rounded-xl blur-lg opacity-30 animate-pulse ${
              isSyncing 
                ? 'bg-gradient-to-r from-blue-400 via-blue-500 to-indigo-400' 
                : 'bg-gradient-to-r from-emerald-400 via-green-400 to-teal-400'
            }`} />
            
            <div className="relative flex items-center gap-3 p-3">
              {/* Icon */}
              <div className="flex-shrink-0">
                {isSyncing ? (
                  <div className="relative w-8 h-8 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center ring-2 ring-white/30">
                    <div className="w-4 h-4 border-2 border-white/40 rounded-full animate-spin border-t-white" />
                  </div>
                ) : (
                  <div className="relative">
                    <div className="absolute inset-0 bg-white/30 rounded-full animate-ping" />
                    <div className="relative w-8 h-8 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center ring-2 ring-white/30">
                      <CheckCircle className="w-4 h-4 text-white" />
                    </div>
                  </div>
                )}
              </div>
              
              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-white text-sm">
                  {isSyncing ? 'Syncing...' : 'Synced'}
                </p>
                <p className="text-white/80 text-xs mt-0.5">
                  {isSyncing 
                    ? `Receiving changes from ${lastSyncedBy}` 
                    : `Updated by ${lastSyncedBy}${lastSyncedAt ? ` at ${lastSyncedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}`
                  }
                </p>
              </div>
            </div>
            
            {/* Progress bar for synced state */}
            {!isSyncing && (
              <div className="h-1 bg-white/20">
                <div 
                  className="h-full bg-white/60 animate-shrink-width"
                  style={{ animationDuration: '5s' }}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Floating Toast Notification - Slides from right */}
      {success && (
        <div className="fixed top-4 right-4 z-[100] animate-slide-in-right">
          <div className="relative overflow-hidden bg-gradient-to-r from-emerald-500 via-green-500 to-teal-500 rounded-xl shadow-2xl shadow-green-500/25 min-w-[320px] max-w-md">
            {/* Shimmer effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full animate-shimmer" />
            
            {/* Glow effect */}
            <div className="absolute -inset-1 bg-gradient-to-r from-emerald-400 via-green-400 to-teal-400 rounded-xl blur-lg opacity-30 animate-pulse" />
            
            <div className="relative flex items-start gap-3 p-4">
              {/* Animated success icon */}
              <div className="flex-shrink-0">
                <div className="relative">
                  <div className="absolute inset-0 bg-white/30 rounded-full animate-ping" />
                  <div className="relative w-10 h-10 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center ring-2 ring-white/30">
                    <CheckCircle className="w-5 h-5 text-white" />
                  </div>
                </div>
              </div>
              
              {/* Content */}
              <div className="flex-1 min-w-0 pt-0.5">
                <p className="font-semibold text-white text-sm flex items-center gap-2">
                  Success
                  <span className="inline-flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </span>
                </p>
                <p className="text-white/90 text-sm mt-0.5">{success}</p>
              </div>
              
              {/* Close button */}
              <button
                onClick={() => setSuccess(null)}
                className="flex-shrink-0 p-1.5 hover:bg-white/20 rounded-lg transition-colors group"
              >
                <X className="w-4 h-4 text-white/80 group-hover:text-white transition-colors" />
              </button>
            </div>
            
            {/* Progress bar */}
            <div className="h-1 bg-white/20">
              <div 
                className="h-full bg-white/60 animate-shrink-width"
                style={{ animationDuration: '5s' }}
              />
            </div>
          </div>
        </div>
      )}
    </ProtectedRoute>
  );
}
