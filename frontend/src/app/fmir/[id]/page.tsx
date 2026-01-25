'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/providers/AuthProvider';
import { useWebSocket } from '@/lib/websocket';
import { usePrivileges, FMIR_PRIVILEGES } from '@/lib/usePrivileges';
import AccessDeniedModal, { useAccessDeniedModal, handlePrivilegeError } from '@/components/modals/AccessDeniedModal';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import FMIRVisibilityOffModal from '@/components/fmir/FMIRVisibilityOffModal';
import api from '@/lib/api';
import {
  ArrowLeft,
  Edit,
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
  Download,
  File,
  Image,
  Video,
  Info,
  Printer,
  Eye,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  X,
} from 'lucide-react';
import { format } from 'date-fns';

interface Evidence {
  id: string;
  type: 'PHOTO' | 'VIDEO' | 'DOCUMENT';
  fileName: string;
  fileSize: number;
  mimeType: string;
  description?: string;
  filePath: string;
}

interface FMIRReport {
  id: string;
  reportNumber: string;
  status: 'DRAFT' | 'SUBMITTED' | 'UNDER_INVESTIGATION' | 'RESOLVED' | 'CLOSED';
  incidentDate: string;
  incidentTime?: string;
  department?: string;
  area?: string;
  line?: string;
  fmSourceCategory?: string;
  fmSourceType?: string;
  rawMaterialSource?: string;
  productName?: string;
  productItemNumber?: string;
  productCodeBatchLot?: string;
  amount?: string;
  individualsInvolved?: string;
  foreignMaterialDescription: string;
  foreignMaterialSize?: string;
  foreignMaterialHardness?: string;
  section2Initials?: string;
  section2Date?: string;
  isHardSharpOrLarge: boolean;
  unforeseeHazardFormRequired: boolean;
  causeIdentification?: string;
  possibleSource?: string;
  howWhyOccurred?: string;
  section3Initials?: string;
  section3Date?: string;
  correctiveAction?: string;
  section4Initials?: string;
  section4Date?: string;
  verificationActions?: string;
  section5Initials?: string;
  section5Date?: string;
  maintenanceWorkCompleted?: string;
  sanitationRequired: boolean;
  sanitationNotes?: string;
  productPlacedOnHold: boolean;
  itemsHeld?: string;
  holdDecisionDetails?: string;
  contaminationWindowDetails?: string;
  section6Initials?: string;
  section6Date?: string;
  screeningProcess?: string;
  section7Initials?: string;
  section7Date?: string;
  finalDisposition?: string;
  dispositionVolume?: string;
  dispositionJustification?: string;
  section8Initials?: string;
  section8Date?: string;
  dispositionDate?: string;
  dispositionInitials?: string;
  preventionMeasures?: string;
  section9Initials?: string;
  section9Date?: string;
  corporateNotified: boolean;
  corporatePersonsNotified?: string;
  preShipmentReview?: string;
  preShipmentReviewDate?: string;
  preShipmentSignatureRequired: boolean;
  createdAt: string;
  updatedAt: string;
  submittedAt?: string;
  Facility?: {
    id: string;
    name: string;
  };
  CreatedBy?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  Evidence: Evidence[];
  FMIREvidence?: Evidence[];
}

// Detail row component
const DetailRow = ({
  label,
  value,
}: {
  label: string;
  value: string | React.ReactNode | null | undefined;
}) => {
  if (!value) return null;

  return (
    <div className="py-2">
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
        {label}
      </p>
      <p className="text-sm text-gray-900 dark:text-white mt-0.5">{value}</p>
    </div>
  );
};

// Section component - PDF-style boxed section
const DetailSection = ({
  title,
  sectionNumber,
  icon: Icon,
  children,
  isEmpty = false,
}: {
  title: string;
  sectionNumber: number;
  icon: React.ElementType;
  children: React.ReactNode;
  isExpanded?: boolean;
  onToggle?: () => void;
  isEmpty?: boolean;
}) => (
  <div className="border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800">
    <div className="px-4 py-3 bg-gray-100 dark:bg-gray-700 border-b-2 border-gray-300 dark:border-gray-600">
      <div className="flex items-center gap-2">
        <span className="flex items-center justify-center w-6 h-6 bg-primary-600 text-white text-xs font-bold rounded">
          {sectionNumber}
        </span>
        <Icon className="w-4 h-4 text-gray-600 dark:text-gray-300" />
        <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wide">{title}</h3>
        {isEmpty && (
          <span className="px-2 py-0.5 text-xs font-medium bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-400">
            Empty
          </span>
        )}
      </div>
    </div>
    <div className="px-4 py-3">{children}</div>
  </div>
);

// Signature display component
const SignatureDisplay = ({
  label,
  initials,
  date,
}: {
  label: string;
  initials?: string;
  date?: string;
}) => {
  if (!initials && !date) return null;

  return (
    <div className="flex items-center gap-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600 mt-4">
      <div className="flex-1">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</p>
        <div className="flex gap-4 mt-1">
          {initials && (
            <div>
              <span className="text-xs text-gray-400">Initials:</span>
              <span className="ml-2 text-sm font-medium text-gray-900 dark:text-white">
                {initials}
              </span>
            </div>
          )}
          {date && (
            <div>
              <span className="text-xs text-gray-400">Date:</span>
              <span className="ml-2 text-sm font-medium text-gray-900 dark:text-white">
                {format(new Date(date), 'MMM d, yyyy')}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Boolean badge component
const BooleanBadge = ({ value, trueLabel = 'Yes', falseLabel = 'No' }: { value: boolean; trueLabel?: string; falseLabel?: string }) => (
  <span
    className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
      value
        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
        : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
    }`}
  >
    {value ? <CheckCircle className="w-3 h-3" /> : null}
    {value ? trueLabel : falseLabel}
  </span>
);

export default function FMIRDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { user } = useAuth();
  const { onFmirVisibilityOff, onFmirUpdated, onFmirStatusChanged, onFmirClosedStatusChanged, onFmirEvidenceUpdated, onFmirDeleted } = useWebSocket();
  const reportId = params.id as string;

  const [report, setReport] = useState<FMIRReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Toast notification state
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'info' | 'warning'>('info');

  // Status change state
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [statusChanging, setStatusChanging] = useState(false);
  const [statusNotes, setStatusNotes] = useState('');

  // Visibility off modal state
  const [showVisibilityOffModal, setShowVisibilityOffModal] = useState(false);
  const [visibilityOffOwnerName, setVisibilityOffOwnerName] = useState('');
  const [visibilityOffReportNumber, setVisibilityOffReportNumber] = useState('');

  // Media URLs for authenticated evidence preview
  const [mediaUrls, setMediaUrls] = useState<Record<string, string>>({});

  // PDF generation state
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const printContainerRef = useRef<HTMLDivElement>(null);

  // Video player modal state
  const [showVideoPlayer, setShowVideoPlayer] = useState(false);
  const [currentVideoUrl, setCurrentVideoUrl] = useState<string>('');
  const [currentVideoName, setCurrentVideoName] = useState<string>('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isSeeking, setIsSeeking] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);

  // Fetch report
  useEffect(() => {
    const fetchReport = async () => {
      setLoading(true);
      try {
        const response = await api.get(`/fmir/${reportId}`);
        if (response.data.success) {
          const data = response.data.data;
          // Map FMIREvidence to Evidence for consistency
          if (data.FMIREvidence && !data.Evidence) {
            data.Evidence = data.FMIREvidence;
          }
          setReport(data);
        }
      } catch (err: any) {
        console.error('Error fetching report:', err);
        setError(err.response?.data?.error || 'Failed to load report');
      } finally {
        setLoading(false);
      }
    };

    if (reportId) {
      fetchReport();
    }
  }, [reportId]);

  // Load evidence media with authentication
  const loadEvidenceMedia = useCallback(async (file: Evidence) => {
    if (file.type !== 'PHOTO' && file.type !== 'VIDEO') return;
    if (mediaUrls[file.id]) return; // Already loaded
    
    try {
      const response = await api.get(`/fmir/${reportId}/evidence/${file.id}/download`, {
        responseType: 'blob',
      });
      
      const blobUrl = URL.createObjectURL(response.data);
      setMediaUrls(prev => ({ ...prev, [file.id]: blobUrl }));
    } catch (err) {
      console.error('Error loading evidence media:', err);
    }
  }, [reportId, mediaUrls]);

  // Load media when report evidence changes
  useEffect(() => {
    if (report?.Evidence) {
      report.Evidence.filter(e => e.type === 'PHOTO' || e.type === 'VIDEO').forEach(file => {
        loadEvidenceMedia(file);
      });
    }

    // Cleanup blob URLs when component unmounts
    return () => {
      Object.values(mediaUrls).forEach(url => {
        URL.revokeObjectURL(url);
      });
    };
  }, [report?.Evidence]);

  // Download evidence file
  const handleDownload = async (file: Evidence) => {
    try {
      const response = await api.get(`/fmir/${reportId}/evidence/${file.id}/download`, {
        responseType: 'blob',
      });
      
      const blobUrl = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = file.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error('Error downloading file:', err);
    }
  };

  // PDF download function
  const handleDownloadPdf = async () => {
    if (!report) return;
    
    setGeneratingPdf(true);
    try {
      // Dynamically import html2pdf to avoid SSR issues
      const html2pdfModule = await import('html2pdf.js');
      const html2pdf = html2pdfModule.default;
      
      // Get the print container
      const printContainer = printContainerRef.current;
      if (!printContainer) {
        console.error('Print container not found');
        setGeneratingPdf(false);
        return;
      }

      // Clone the content for PDF generation
      const clonedContent = printContainer.cloneNode(true) as HTMLElement;
      clonedContent.style.position = 'absolute';
      clonedContent.style.left = '0';
      clonedContent.style.top = '0';
      clonedContent.style.width = '8in';
      clonedContent.style.padding = '0.25in';
      clonedContent.style.backgroundColor = 'white';
      clonedContent.style.opacity = '1';
      clonedContent.style.pointerEvents = 'auto';
      
      // Append to body
      document.body.appendChild(clonedContent);
      
      const opt = {
        margin: 0.25,
        filename: `${report.reportNumber}.pdf`,
        image: { type: 'jpeg', quality: 0.95 },
        html2canvas: { 
          scale: 2,
          useCORS: true,
          logging: true,
          backgroundColor: '#ffffff',
        },
        jsPDF: { 
          unit: 'in', 
          format: 'letter', 
          orientation: 'portrait' 
        },
      };
      
      await html2pdf().set(opt).from(clonedContent).save();
      
      // Remove cloned element
      document.body.removeChild(clonedContent);
    } catch (err) {
      console.error('Error generating PDF:', err);
      alert('Error generating PDF. Please check the console for details.');
    } finally {
      setGeneratingPdf(false);
    }
  };

  // Video player functions
  const openVideoPlayer = (videoUrl: string, fileName: string) => {
    setCurrentVideoUrl(videoUrl);
    setCurrentVideoName(fileName);
    setShowVideoPlayer(true);
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const closeVideoPlayer = () => {
    setShowVideoPlayer(false);
    setCurrentVideoUrl('');
    setCurrentVideoName('');
    setIsPlaying(false);
    if (videoRef.current) {
      videoRef.current.pause();
    }
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
      setIsMuted(newVolume === 0);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  // Smooth seeking based on click/drag position on progress bar
  const calculateSeekTime = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current || !duration) return 0;
    const rect = progressBarRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, clickX / rect.width));
    return percentage * duration;
  };

  const handleProgressBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const newTime = calculateSeekTime(e);
    setCurrentTime(newTime);
    if (videoRef.current) {
      videoRef.current.currentTime = newTime;
    }
  };

  const handleSeekStart = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsSeeking(true);
    handleProgressBarClick(e);
  };

  const handleSeekMove = (e: React.MouseEvent<HTMLDivElement>) => {
    // Handled by document listener for reliability
  };

  const handleSeekEnd = () => {
    // Handled by document listener for reliability
  };

  // Global mouse up listener for seeking - with RAF throttling for smooth scrubbing
  useEffect(() => {
    if (!isSeeking) return;
    
    let rafId: number | null = null;
    let pendingTime: number | null = null;
    let lastSeekTime = 0;
    const SEEK_THROTTLE = 33; // ~30fps for video seeking
    
    // RAF loop for smooth video updates
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
      // Final seek to exact position
      if (pendingTime !== null && videoRef.current) {
        videoRef.current.currentTime = pendingTime;
      }
      setIsSeeking(false);
    };
    
    const handleMouseMove = (e: MouseEvent) => {
      if (!progressBarRef.current || !duration) return;
      
      const rect = progressBarRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const percentage = Math.max(0, Math.min(1, clickX / rect.width));
      const newTime = percentage * duration;
      
      // Update UI immediately for silky smooth feel
      setCurrentTime(newTime);
      pendingTime = newTime;
    };

    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('mousemove', handleMouseMove);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mousemove', handleMouseMove);
    };
  }, [isSeeking, duration]);

  const handleVideoEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
    }
  };

  const formatTime = (seconds: number, showMs = true) => {
    if (!isFinite(seconds) || isNaN(seconds)) return showMs ? '0:00.000' : '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    if (showMs) {
      const ms = Math.floor((seconds % 1) * 1000);
      return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const toggleFullscreen = () => {
    if (videoRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        videoRef.current.requestFullscreen();
      }
    }
  };

  // Listen for FMIR visibility OFF event from owner (real-time modal notification)
  useEffect(() => {
    const unsubscribe = onFmirVisibilityOff((data: { reportId: string; reportNumber: string; ownerId: string; ownerName: string }) => {
      console.log('🚫 FMIR visibility OFF event received:', data);
      
      // Only show modal if this is the FMIR we're currently viewing
      if (reportId && data.reportId === reportId) {
        // Don't show modal to the owner themselves
        if (data.ownerId !== user?.id) {
          setVisibilityOffOwnerName(data.ownerName);
          setVisibilityOffReportNumber(data.reportNumber);
          setShowVisibilityOffModal(true);
        }
      }
    });

    return () => unsubscribe();
  }, [onFmirVisibilityOff, reportId, user?.id]);

  // Listen for real-time FMIR updates (when someone saves the report)
  useEffect(() => {
    const unsubscribe = onFmirUpdated((data: { reportId: string; reportNumber: string; updatedById: string; updatedByName: string; updateType: 'save' | 'submit'; newStatus?: string }) => {
      console.log('📝 FMIR updated event received:', data);
      
      // Only update if this is the report we're viewing and we didn't make the change
      if (reportId && data.reportId === reportId && data.updatedById !== user?.id) {
        // Show toast notification
        setToastMessage(`${data.updatedByName} ${data.updateType === 'submit' ? 'submitted' : 'updated'} this report`);
        setToastType('info');
        setTimeout(() => setToastMessage(null), 5000);
        
        // Refetch the report to get the latest data
        api.get(`/fmir/${reportId}`)
          .then((response) => {
            if (response.data.success) {
              const updatedData = response.data.data;
              if (updatedData.FMIREvidence && !updatedData.Evidence) {
                updatedData.Evidence = updatedData.FMIREvidence;
              }
              setReport(updatedData);
            }
          })
          .catch((err) => console.error('Error refetching report:', err));
      }
    });

    return () => unsubscribe();
  }, [onFmirUpdated, reportId, user?.id]);

  // Listen for real-time status changes
  useEffect(() => {
    const unsubscribe = onFmirStatusChanged((data: { reportId: string; reportNumber: string; previousStatus: string; newStatus: string; changedById: string; changedBy?: string }) => {
      console.log('📊 FMIR status changed event received:', data);
      
      if (reportId && data.reportId === reportId) {
        // Show toast notification if we didn't make the change
        if (data.changedById !== user?.id) {
          const statusLabel = data.newStatus.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
          setToastMessage(`Status changed to ${statusLabel}${data.changedBy ? ` by ${data.changedBy}` : ''}`);
          setToastType('info');
          setTimeout(() => setToastMessage(null), 5000);
        }
        setReport(prev => prev ? { ...prev, status: data.newStatus as FMIRReport['status'] } : null);
      }
    });

    return () => unsubscribe();
  }, [onFmirStatusChanged, reportId, user?.id]);

  // Listen for real-time closed status changes (lock/unlock by QA)
  useEffect(() => {
    const unsubscribe = onFmirClosedStatusChanged((data: { reportId: string; reportNumber: string; isClosed: boolean; closedById: string | null; closedAt: string | null }) => {
      console.log('🔒 FMIR closed status changed event received:', data);
      
      if (reportId && data.reportId === reportId) {
        // Show toast notification if we didn't make the change
        if (data.closedById !== user?.id) {
          setToastMessage(data.isClosed ? 'This report has been locked by QA' : 'This report has been unlocked by QA');
          setToastType(data.isClosed ? 'warning' : 'info');
          setTimeout(() => setToastMessage(null), 5000);
        }
        
        // Refetch to get full report data including locked state
        api.get(`/fmir/${reportId}`)
          .then((response) => {
            if (response.data.success) {
              const updatedData = response.data.data;
              if (updatedData.FMIREvidence && !updatedData.Evidence) {
                updatedData.Evidence = updatedData.FMIREvidence;
              }
              setReport(updatedData);
            }
          })
          .catch((err) => console.error('Error refetching report:', err));
      }
    });

    return () => unsubscribe();
  }, [onFmirClosedStatusChanged, reportId, user?.id]);

  // Listen for real-time evidence updates
  useEffect(() => {
    const unsubscribe = onFmirEvidenceUpdated((data: { reportId: string; action: 'upload' | 'delete'; evidence?: any[]; evidenceId?: string; updatedById: string; updatedByName: string }) => {
      console.log('📸 FMIR evidence updated event received:', data);
      
      if (reportId && data.reportId === reportId && data.updatedById !== user?.id) {
        // Show toast notification
        setToastMessage(`${data.updatedByName} ${data.action === 'upload' ? 'added new evidence' : 'removed evidence'}`);
        setToastType('info');
        setTimeout(() => setToastMessage(null), 5000);
        
        // Refetch to get updated evidence
        api.get(`/fmir/${reportId}`)
          .then((response) => {
            if (response.data.success) {
              const updatedData = response.data.data;
              if (updatedData.FMIREvidence && !updatedData.Evidence) {
                updatedData.Evidence = updatedData.FMIREvidence;
              }
              setReport(updatedData);
            }
          })
          .catch((err) => console.error('Error refetching report:', err));
      }
    });

    return () => unsubscribe();
  }, [onFmirEvidenceUpdated, reportId, user?.id]);

  // Listen for real-time FMIR deletion
  useEffect(() => {
    const unsubscribe = onFmirDeleted((data: { reportId: string; reportNumber: string; deletedById: string; deletedByName: string }) => {
      console.log('🗑️ FMIR deleted event received:', data);
      
      if (reportId && data.reportId === reportId) {
        // Report was deleted, redirect to list
        alert(`This report has been deleted by ${data.deletedByName}`);
        router.push('/fmir');
      }
    });

    return () => unsubscribe();
  }, [onFmirDeleted, reportId, router]);

  // Handle close from visibility off modal (view page doesn't need save)
  const handleCloseFromVisibilityModal = () => {
    router.push('/fmir');
  };

  // Use privilege-based access control
  const { hasPrivilege, loading: privilegesLoading } = usePrivileges();
  const canViewFMIR = hasPrivilege(FMIR_PRIVILEGES.VIEW);
  const canChangeStatus = hasPrivilege(FMIR_PRIVILEGES.CHANGE_STATUS);
  const canExportPDF = hasPrivilege(FMIR_PRIVILEGES.EXPORT_PDF);
  const canPrint = hasPrivilege(FMIR_PRIVILEGES.EXPORT_PRINT);
  const canViewAudit = hasPrivilege(FMIR_PRIVILEGES.AUDIT_VIEW);

  // Access denied modal
  const { showAccessDenied, accessDeniedModal } = useAccessDeniedModal();
  
  // Check if user lacks VIEW privilege (inline check to prevent flash)
  const shouldShowAccessDenied = !privilegesLoading && !canViewFMIR;

  // Get next valid status transitions
  const getNextStatuses = (currentStatus: string): { value: string; label: string; color: string }[] => {
    const transitions: Record<string, { value: string; label: string; color: string }[]> = {
      'SUBMITTED': [
        { value: 'UNDER_INVESTIGATION', label: 'Start Investigation', color: 'yellow' },
        { value: 'DRAFT', label: 'Return to Draft', color: 'gray' },
      ],
      'UNDER_INVESTIGATION': [
        { value: 'RESOLVED', label: 'Mark as Resolved', color: 'purple' },
        { value: 'SUBMITTED', label: 'Return to Submitted', color: 'blue' },
      ],
      'RESOLVED': [
        { value: 'CLOSED', label: 'Close Report', color: 'green' },
        { value: 'UNDER_INVESTIGATION', label: 'Reopen Investigation', color: 'yellow' },
      ],
      'CLOSED': [
        { value: 'RESOLVED', label: 'Reopen to Resolved', color: 'purple' },
      ],
    };
    return transitions[currentStatus] || [];
  };

  // Handle status change
  const handleStatusChange = async (newStatus: string) => {
    if (!report) return;
    
    setStatusChanging(true);
    try {
      const response = await api.patch(`/fmir/${report.id}/status`, {
        status: newStatus,
        notes: statusNotes || undefined,
      });
      
      if (response.data.success) {
        setReport(response.data.data);
        setShowStatusModal(false);
        setStatusNotes('');
      }
    } catch (err: any) {
      console.error('Error changing status:', err);
      // Check if this is a privilege error (403)
      if (!handlePrivilegeError(err, showAccessDenied, undefined, 'Change Status')) {
        // Not a privilege error - show toast message
        setToastMessage(err.response?.data?.error || 'Failed to change status');
        setToastType('error');
      }
    } finally {
      setStatusChanging(false);
    }
  };

  // Get file icon
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

  // Get status badge
  const getStatusBadge = (status: string) => {
    const config: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
      DRAFT: {
        bg: 'bg-gray-100 dark:bg-gray-700',
        text: 'text-gray-700 dark:text-gray-300',
        icon: <Edit className="w-3.5 h-3.5" />,
      },
      SUBMITTED: {
        bg: 'bg-blue-100 dark:bg-blue-900/30',
        text: 'text-blue-700 dark:text-blue-400',
        icon: <Send className="w-3.5 h-3.5" />,
      },
      UNDER_INVESTIGATION: {
        bg: 'bg-yellow-100 dark:bg-yellow-900/30',
        text: 'text-yellow-700 dark:text-yellow-400',
        icon: <Eye className="w-3.5 h-3.5" />,
      },
      RESOLVED: {
        bg: 'bg-purple-100 dark:bg-purple-900/30',
        text: 'text-purple-700 dark:text-purple-400',
        icon: <CheckCircle className="w-3.5 h-3.5" />,
      },
      CLOSED: {
        bg: 'bg-green-100 dark:bg-green-900/30',
        text: 'text-green-700 dark:text-green-400',
        icon: <CheckCircle className="w-3.5 h-3.5" />,
      },
    };

    const { bg, text, icon } = config[status] || config.DRAFT;

    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${bg} ${text}`}>
        {icon}
        {status.replace('_', ' ')}
      </span>
    );
  };

  // Show loading state while report or privileges are loading
  if (loading || privilegesLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-100 to-gray-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center">
        {/* Animated background elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-primary-400/20 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-orange-400/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '500ms' }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-purple-400/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1000ms' }} />
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
          
          {/* Text with bouncing dots */}
          <div className="flex flex-col items-center gap-2">
            <span className="text-gray-700 dark:text-gray-200 font-semibold text-xl">Loading report...</span>
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

  if (error || !report) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            {error || 'Report not found'}
          </h2>
          <Link
            href="/fmir"
            className="inline-flex items-center gap-2 text-primary-600 hover:text-primary-700"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Reports
          </Link>
        </div>
      </div>
    );
  }

  // Show access denied modal if user lacks VIEW privilege
  if (shouldShowAccessDenied) {
    return (
      <ProtectedRoute requireAuth>
        <AccessDeniedModal
          isOpen={shouldShowAccessDenied}
          onClose={() => {
            router.push('/fmir');
          }}
          featureName="View Foreign Material Report"
          requiredPrivilege={FMIR_PRIVILEGES.VIEW}
        />
        {/* Empty background - modal is the only content */}
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-100 to-gray-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900" />
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute requireAuth>
      {/* Access Denied Modal for API privilege errors */}
      {accessDeniedModal}
      
      {/* Screen View - Hidden when printing */}
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 print:hidden">
        <div className="w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          {/* Header */}
          <div className="mb-8">
            <button
              onClick={() => router.push('/fmir')}
              className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-4 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Back to Reports</span>
            </button>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div className="flex items-start gap-4">
                  <img 
                    src="/images/organization-logo.png" 
                    alt="Organization Logo" 
                    className="w-28 h-28 object-contain flex-shrink-0"
                  />
                  <div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                        {report.reportNumber}
                      </h1>
                      {getStatusBadge(report.status)}
                    </div>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">
                      Foreign Material Incident Report
                    </p>
                    <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-gray-500 dark:text-gray-400">
                      <span className="inline-flex items-center gap-1.5">
                        <Calendar className="w-4 h-4" />
                        {format(new Date(report.incidentDate), 'MMMM d, yyyy')}
                      </span>
                      {report.incidentTime && (
                        <span className="inline-flex items-center gap-1.5">
                          <Clock className="w-4 h-4" />
                          {report.incidentTime}
                        </span>
                      )}
                      {report.Facility && (
                        <span className="inline-flex items-center gap-1.5">
                          <Building2 className="w-4 h-4" />
                          {report.Facility.name}
                        </span>
                      )}
                      {report.CreatedBy && (
                        <span className="inline-flex items-center gap-1.5">
                          <User className="w-4 h-4" />
                          {report.CreatedBy.firstName} {report.CreatedBy.lastName}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {canExportPDF && (
                    <button
                      onClick={handleDownloadPdf}
                      disabled={generatingPdf}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-400 text-white font-medium rounded-lg transition-colors"
                    >
                      {generatingPdf ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Download className="w-4 h-4" />
                          Download PDF
                        </>
                      )}
                    </button>
                  )}
                  {canPrint && (
                    <button
                      onClick={() => window.print()}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg transition-colors"
                    >
                      <Printer className="w-4 h-4" />
                      Print
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Status Change Modal */}
          {showStatusModal && report && canChangeStatus && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div 
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={() => !statusChanging && setShowStatusModal(false)}
              />
              <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 max-w-md w-full p-6 animate-in zoom-in-95 duration-200">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                  Change Report Status
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Current status: <span className="font-medium">{report.status.replace('_', ' ')}</span>
                </p>
                
                {/* Status Options */}
                <div className="space-y-2 mb-4">
                  {getNextStatuses(report.status).map((option) => (
                    <button
                      key={option.value}
                      onClick={() => handleStatusChange(option.value)}
                      disabled={statusChanging}
                      className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border transition-colors ${
                        option.color === 'yellow' 
                          ? 'border-yellow-300 bg-yellow-50 hover:bg-yellow-100 dark:border-yellow-700 dark:bg-yellow-900/20 dark:hover:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300'
                          : option.color === 'purple'
                          ? 'border-purple-300 bg-purple-50 hover:bg-purple-100 dark:border-purple-700 dark:bg-purple-900/20 dark:hover:bg-purple-900/30 text-purple-800 dark:text-purple-300'
                          : option.color === 'green'
                          ? 'border-green-300 bg-green-50 hover:bg-green-100 dark:border-green-700 dark:bg-green-900/20 dark:hover:bg-green-900/30 text-green-800 dark:text-green-300'
                          : option.color === 'blue'
                          ? 'border-blue-300 bg-blue-50 hover:bg-blue-100 dark:border-blue-700 dark:bg-blue-900/20 dark:hover:bg-blue-900/30 text-blue-800 dark:text-blue-300'
                          : 'border-gray-300 bg-gray-50 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-300'
                      } ${statusChanging ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <span className="font-medium">{option.label}</span>
                      {statusChanging && <Loader2 className="w-4 h-4 animate-spin" />}
                    </button>
                  ))}
                </div>

                {/* Optional Notes */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Notes (optional)
                  </label>
                  <textarea
                    value={statusNotes}
                    onChange={(e) => setStatusNotes(e.target.value)}
                    placeholder="Add any notes about this status change..."
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                    rows={2}
                    disabled={statusChanging}
                  />
                </div>

                {/* Cancel Button */}
                <button
                  onClick={() => setShowStatusModal(false)}
                  disabled={statusChanging}
                  className="w-full px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white font-medium transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Main Content - Two Column Layout */}
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Left Side - Report Sections */}
            <div className="flex-1 lg:w-2/3">
              <div className="border-2 border-gray-400 dark:border-gray-500 bg-white dark:bg-gray-800">
                {/* Report Sections Container */}
                <div className="divide-y-0">
            {/* Section 1: General Information */}
            <DetailSection
              title="General Information"
              sectionNumber={1}
              icon={Info}
            >
              <div className="space-y-0 lg:divide-y lg:divide-gray-200 lg:dark:divide-gray-600">
                {/* Row 1: Date, Time, Facility */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-y-1 lg:pb-3">
                  <div className="lg:pr-6"><DetailRow label="Date" value={report.incidentDate ? format(new Date(report.incidentDate), 'MM/dd/yyyy') : undefined} /></div>
                  <div className="lg:px-6 lg:border-l lg:border-gray-200 lg:dark:border-gray-600"><DetailRow label="Time" value={report.incidentTime} /></div>
                  <div className="lg:pl-6 lg:border-l lg:border-gray-200 lg:dark:border-gray-600"><DetailRow label="Facility" value={report.Facility?.name} /></div>
                </div>
                {/* Row 2: Department, Area, Line */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-y-1 lg:py-3">
                  <div className="lg:pr-6"><DetailRow label="Department" value={report.department} /></div>
                  <div className="lg:px-6 lg:border-l lg:border-gray-200 lg:dark:border-gray-600"><DetailRow label="Area" value={report.area} /></div>
                  <div className="lg:pl-6 lg:border-l lg:border-gray-200 lg:dark:border-gray-600"><DetailRow label="Line" value={report.line} /></div>
                </div>
                {/* Row 3: FM Source Category, FM Source Type, Item Number */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-y-1 lg:py-3">
                  <div className="lg:pr-6"><DetailRow label="FM Source Category" value={report.fmSourceCategory} /></div>
                  <div className="lg:px-6 lg:border-l lg:border-gray-200 lg:dark:border-gray-600"><DetailRow label="FM Source Type" value={report.fmSourceType} /></div>
                  <div className="lg:pl-6 lg:border-l lg:border-gray-200 lg:dark:border-gray-600"><DetailRow label="Item Number" value={report.productItemNumber} /></div>
                </div>
                {/* Row 4: Amount, Name of Product, Product Code(s)/Batch/Lot Involved */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-y-1 lg:py-3">
                  <div className="lg:pr-6"><DetailRow label="Amount" value={report.amount} /></div>
                  <div className="lg:px-6 lg:border-l lg:border-gray-200 lg:dark:border-gray-600"><DetailRow label="Name of Product" value={report.productName} /></div>
                  <div className="lg:pl-6 lg:border-l lg:border-gray-200 lg:dark:border-gray-600"><DetailRow label="Product Code(s)/Batch/Lot Involved" value={report.productCodeBatchLot} /></div>
                </div>
                {/* Row 5: Individuals Involved */}
                {report.individualsInvolved && (
                  <div className="lg:pt-3">
                    <DetailRow
                      label="Individuals Involved"
                      value={report.individualsInvolved}
                    />
                  </div>
                )}
              </div>
            </DetailSection>

            {/* Section 2: Foreign Material Description */}
            <DetailSection
              title="Foreign Material Description"
              sectionNumber={2}
              icon={Search}
            >
              <div className="space-y-3">
                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600">
                  <p className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap">
                    {report.foreignMaterialDescription}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1">
                  <DetailRow label="Size" value={report.foreignMaterialSize} />
                  <DetailRow label="Hardness" value={report.foreignMaterialHardness} />
                </div>

                {(report.isHardSharpOrLarge || report.unforeseeHazardFormRequired) && (
                  <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        {report.isHardSharpOrLarge && (
                          <p className="text-xs text-amber-800 dark:text-amber-300">
                            ⚠️ Object is hard, sharp, or large (7-25mm)
                          </p>
                        )}
                        {report.unforeseeHazardFormRequired && (
                          <p className="text-xs text-amber-800 dark:text-amber-300">
                            📋 Unforeseen Hazard Form is required
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <SignatureDisplay
                  label="Section 2 Verification"
                  initials={report.section2Initials}
                  date={report.section2Date}
                />
              </div>
            </DetailSection>

            {/* Section 3: Cause Identification */}
            <DetailSection
              title="Cause Identification"
              sectionNumber={3}
              icon={Search}
              isEmpty={!report.causeIdentification && !report.possibleSource && !report.howWhyOccurred}
            >
              <div className="space-y-4">
                {report.causeIdentification && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                      Cause Identification
                    </p>
                    <p className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap">
                      {report.causeIdentification}
                    </p>
                  </div>
                )}
                {report.possibleSource && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                      Possible Source
                    </p>
                    <p className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap">
                      {report.possibleSource}
                    </p>
                  </div>
                )}
                {report.howWhyOccurred && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                      How/Why Occurred
                    </p>
                    <p className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap">
                      {report.howWhyOccurred}
                    </p>
                  </div>
                )}
                <SignatureDisplay
                  label="Section 3 Verification"
                  initials={report.section3Initials}
                  date={report.section3Date}
                />
              </div>
            </DetailSection>

            {/* Section 4: Corrective Action */}
            <DetailSection
              title="Corrective Action"
              sectionNumber={4}
              icon={ClipboardCheck}
              isEmpty={!report.correctiveAction}
            >
              {report.correctiveAction ? (
                <div className="space-y-4">
                  <p className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap">
                    {report.correctiveAction}
                  </p>
                  <SignatureDisplay
                    label="Section 4 Verification"
                    initials={report.section4Initials}
                    date={report.section4Date}
                  />
                </div>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                  No corrective action documented
                </p>
              )}
            </DetailSection>

            {/* Section 5: Verification (QC) */}
            <DetailSection
              title="Verification (QC)"
              sectionNumber={5}
              icon={CheckCircle}
              isEmpty={!report.verificationActions}
            >
              <div className="space-y-4">
                {report.verificationActions && (
                  <p className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap">
                    {report.verificationActions}
                  </p>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {report.maintenanceWorkCompleted && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        Maintenance Work Completed:
                      </span>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {report.maintenanceWorkCompleted === 'Y'
                          ? 'Yes'
                          : report.maintenanceWorkCompleted === 'N'
                          ? 'No'
                          : 'N/A'}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      Sanitation Required:
                    </span>
                    <BooleanBadge value={report.sanitationRequired} />
                  </div>
                </div>
                {report.sanitationNotes && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                      Sanitation Notes
                    </p>
                    <p className="text-sm text-gray-900 dark:text-white">{report.sanitationNotes}</p>
                  </div>
                )}
                <SignatureDisplay
                  label="Section 5 Verification (QC)"
                  initials={report.section5Initials}
                  date={report.section5Date}
                />
              </div>
            </DetailSection>

            {/* Section 6: Product Hold */}
            <DetailSection
              title="Product Hold"
              sectionNumber={6}
              icon={Package}
            >
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    Product Placed on Hold:
                  </span>
                  <BooleanBadge value={report.productPlacedOnHold} />
                </div>
                {report.productPlacedOnHold && (
                  <>
                    <DetailRow label="Items Held" value={report.itemsHeld} />
                    {report.holdDecisionDetails && (
                      <div>
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                          Decision Making Process
                        </p>
                        <p className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap">
                          {report.holdDecisionDetails}
                        </p>
                      </div>
                    )}
                    {report.contaminationWindowDetails && (
                      <div>
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                          Contamination Window Details
                        </p>
                        <p className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap">
                          {report.contaminationWindowDetails}
                        </p>
                      </div>
                    )}
                  </>
                )}
                <SignatureDisplay
                  label="Section 6 Verification"
                  initials={report.section6Initials}
                  date={report.section6Date}
                />
              </div>
            </DetailSection>

            {/* Section 7: Screening Process */}
            <DetailSection
              title="Screening Process"
              sectionNumber={7}
              icon={Shield}
              isEmpty={!report.screeningProcess}
            >
              {report.screeningProcess ? (
                <div className="space-y-4">
                  <p className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap">
                    {report.screeningProcess}
                  </p>
                  <SignatureDisplay
                    label="Section 7 Verification (QC)"
                    initials={report.section7Initials}
                    date={report.section7Date}
                  />
                </div>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                  No screening process documented
                </p>
              )}
            </DetailSection>

            {/* Section 8: Final Disposition */}
            <DetailSection
              title="Final Disposition"
              sectionNumber={8}
              icon={Truck}
              isEmpty={!report.finalDisposition}
            >
              <div className="space-y-4">
                {report.finalDisposition && (
                  <p className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap">
                    {report.finalDisposition}
                  </p>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1">
                  <DetailRow label="Volume" value={report.dispositionVolume} />
                  <DetailRow
                    label="Date of Disposition"
                    value={
                      report.dispositionDate
                        ? format(new Date(report.dispositionDate), 'MMM d, yyyy')
                        : null
                    }
                  />
                  <DetailRow label="Disposition Initials" value={report.dispositionInitials} />
                </div>
                {report.dispositionJustification && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                      Justification
                    </p>
                    <p className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap">
                      {report.dispositionJustification}
                    </p>
                  </div>
                )}
                <SignatureDisplay
                  label="Section 8 Verification (QC)"
                  initials={report.section8Initials}
                  date={report.section8Date}
                />
              </div>
            </DetailSection>

            {/* Section 9: Prevention Measures */}
            <DetailSection
              title="Prevention Measures"
              sectionNumber={9}
              icon={Shield}
              isEmpty={!report.preventionMeasures}
            >
              {report.preventionMeasures ? (
                <div className="space-y-4">
                  <p className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap">
                    {report.preventionMeasures}
                  </p>
                  <SignatureDisplay
                    label="Section 9 Verification (QC)"
                    initials={report.section9Initials}
                    date={report.section9Date}
                  />
                </div>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                  No prevention measures documented
                </p>
              )}
            </DetailSection>

            {/* Section 10: Corporate & Pre-Shipment */}
            <DetailSection
              title="Corporate Notification & Pre-Shipment Review"
              sectionNumber={10}
              icon={Building2}
            >
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      Corporate Notified:
                    </span>
                    <BooleanBadge value={report.corporateNotified} />
                  </div>
                  {report.corporateNotified && report.corporatePersonsNotified && (
                    <DetailRow
                      label="Persons Notified"
                      value={report.corporatePersonsNotified}
                    />
                  )}
                </div>

                {(report.preShipmentReview ||
                  report.preShipmentReviewDate ||
                  report.preShipmentSignatureRequired) && (
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <h4 className="text-sm font-semibold text-blue-800 dark:text-blue-300 mb-3">
                      Pre-Shipment Review
                    </h4>
                    <div className="space-y-2">
                      {report.preShipmentReview && (
                        <p className="text-sm text-blue-900 dark:text-blue-200">
                          {report.preShipmentReview}
                        </p>
                      )}
                      {report.preShipmentReviewDate && (
                        <p className="text-sm text-blue-700 dark:text-blue-300">
                          Review Date: {format(new Date(report.preShipmentReviewDate), 'MMM d, yyyy')}
                        </p>
                      )}
                      {report.preShipmentSignatureRequired && (
                        <p className="text-sm text-blue-700 dark:text-blue-300">
                          ✓ Pre-Shipment Signature Required
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </DetailSection>

                {/* Metadata - inside left column */}
                <div className="border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-4">
                  <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-gray-600 dark:text-gray-400">
                    <span>
                      <strong>Created:</strong> {format(new Date(report.createdAt), 'MMM d, yyyy h:mm a')}
                    </span>
                    <span>
                      <strong>Updated:</strong> {format(new Date(report.updatedAt), 'MMM d, yyyy h:mm a')}
                    </span>
                    {report.submittedAt && (
                      <span>
                        <strong>Submitted:</strong> {format(new Date(report.submittedAt), 'MMM d, yyyy h:mm a')}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-3 italic border-t border-gray-200 dark:border-gray-600 pt-3">
                    This material constitutes trade secrets and commercial or financial information,
                    is privileged or confidential, and may not be disclosed.
                  </p>
                </div>
              </div>
              </div>
            </div>

            {/* Right Side - Evidence Panel */}
            <div className="lg:w-1/3">
              <div className="border-2 border-gray-400 dark:border-gray-500 bg-white dark:bg-gray-800 sticky top-6">
                <div className="px-4 py-3 bg-gray-100 dark:bg-gray-700 border-b-2 border-gray-400 dark:border-gray-500">
                  <div className="flex items-center gap-2">
                    <File className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wide">
                      Evidence Attachments
                    </h3>
                    {report.Evidence && report.Evidence.length > 0 && (
                      <span className="px-2 py-0.5 bg-primary-600 text-white text-xs font-bold rounded">
                        {report.Evidence.length}
                      </span>
                    )}
                  </div>
                </div>
                <div className="p-4">
                  {report.Evidence && report.Evidence.length > 0 ? (
                    <div className="space-y-4">
                      {report.Evidence.map((file) => (
                        <div
                          key={file.id}
                          className="border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 overflow-hidden"
                        >
                          {/* Large preview for images */}
                          {file.type === 'PHOTO' && (
                            <div className="relative group">
                              {mediaUrls[file.id] ? (
                                <>
                                  <img
                                    src={mediaUrls[file.id]}
                                    alt={file.fileName}
                                    className="w-full h-auto max-h-64 object-contain bg-gray-100 dark:bg-gray-800"
                                  />
                                  <a
                                    href={mediaUrls[file.id]}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity"
                                  >
                                    <span className="px-3 py-1.5 bg-white text-gray-900 text-sm font-medium rounded-lg shadow">
                                      View Full Size
                                    </span>
                                  </a>
                                </>
                              ) : (
                                <div className="w-full h-40 flex items-center justify-center bg-gray-100 dark:bg-gray-800">
                                  <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
                                </div>
                              )}
                            </div>
                          )}
                          
                          {/* Video preview with loop - clickable to open player */}
                          {file.type === 'VIDEO' && (
                            <div 
                              className="relative cursor-pointer group"
                              onClick={() => mediaUrls[file.id] && openVideoPlayer(mediaUrls[file.id], file.fileName)}
                            >
                              {mediaUrls[file.id] ? (
                                <>
                                  <video
                                    src={mediaUrls[file.id]}
                                    className="w-full h-auto max-h-64 object-contain bg-gray-900"
                                    autoPlay
                                    loop
                                    muted
                                    playsInline
                                  />
                                  {/* Play button overlay */}
                                  <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <div className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center shadow-xl">
                                      <Play className="w-8 h-8 text-gray-900 ml-1" />
                                    </div>
                                  </div>
                                  <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/70 text-white text-xs rounded flex items-center gap-1">
                                    <Video className="w-3 h-3" />
                                    Click to Play
                                  </div>
                                </>
                              ) : (
                                <div className="w-full h-40 flex items-center justify-center bg-gray-900">
                                  <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
                                </div>
                              )}
                            </div>
                          )}
                          
                          {/* Document placeholder */}
                          {file.type === 'DOCUMENT' && (
                            <div className="p-6 flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-800">
                              <File className="w-12 h-12 text-gray-400 dark:text-gray-500 mb-2" />
                              <p className="text-sm text-gray-500 dark:text-gray-400">Document</p>
                            </div>
                          )}
                          
                          {/* File info bar */}
                          <div className="p-3 flex items-center gap-3 border-t border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700">
                            <div className="flex-shrink-0">{getFileIcon(file.type)}</div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                {file.fileName}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {formatFileSize(file.fileSize)}
                              </p>
                            </div>
                            <button
                              onClick={() => handleDownload(file)}
                              className="p-2 text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 hover:bg-gray-100 dark:hover:bg-gray-600 rounded transition-colors"
                              title="Download"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <File className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                      <p className="text-sm text-gray-500 dark:text-gray-400">No evidence attached</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ============================================
          PROFESSIONAL PRINT VIEW - Only visible when printing or generating PDF
          ============================================ */}
      <div 
        ref={printContainerRef} 
        className="fmir-print-container bg-white p-4 absolute opacity-0 pointer-events-none print:opacity-100 print:pointer-events-auto print:static print:p-0"
        style={{ left: '-9999px', top: 0, width: '8.5in' }}
      >
        {/* Main Title Banner - At the very top */}
        <div className="bg-[#1e3a5f] text-white py-3 px-4 text-center mb-4">
          <h1 className="text-2xl font-bold uppercase tracking-widest">
            Foreign Material Incident Report
          </h1>
          <p className="text-sm text-white/80 mt-1">Quality Assurance Documentation</p>
        </div>

        {/* Print Header - Company Info & Report Details */}
        <div className="flex justify-between items-start pb-4 border-b-2 border-gray-300 mb-4">
          <div className="flex items-center gap-4">
            <img 
              src="/images/organization-logo.png" 
              alt="Organization Logo" 
              className="w-24 h-24 object-contain"
            />
            <div>
              <p className="text-xl font-bold text-gray-800">{user?.organizationName || 'Food Safety Division'}</p>
              <p className="text-sm text-gray-500">{report.Facility?.name || ''}</p>
            </div>
          </div>
          <div className="text-right">
            <div className="inline-block bg-[#1e3a5f] text-white px-3 py-1.5 font-bold text-sm mb-2">
              {report.reportNumber}
            </div>
            <br />
            <div className={`inline-block px-3 py-1 text-xs font-semibold rounded ${
              report.status === 'CLOSED' ? 'bg-green-100 text-green-800 border border-green-600' :
              report.status === 'RESOLVED' ? 'bg-blue-100 text-blue-800 border border-blue-600' :
              report.status === 'UNDER_INVESTIGATION' ? 'bg-yellow-100 text-yellow-800 border border-yellow-600' :
              'bg-purple-100 text-purple-800 border border-purple-600'
            }`}>
              {report.status.replace('_', ' ')}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Printed: {format(new Date(), 'MM/dd/yyyy h:mm a')}
            </p>
          </div>
        </div>

        {/* Section 1: General Information */}
        <div className="fmir-print-section border-2 border-gray-800 mb-3 print-avoid-break">
          <div className="fmir-print-section-header bg-[#1e3a5f] text-white px-3 py-2 flex items-center gap-2">
            <span className="w-5 h-5 bg-white text-[#1e3a5f] flex items-center justify-center font-bold text-xs rounded">1</span>
            <h3 className="text-sm font-bold uppercase tracking-wide">General Information</h3>
          </div>
          <div className="p-3">
            <div className="grid grid-cols-3 border-b border-gray-300">
              <div className="p-2 border-r border-gray-300">
                <p className="text-[8pt] font-semibold text-gray-500 uppercase">Date</p>
                <p className="text-[10pt] text-gray-900">{report.incidentDate ? format(new Date(report.incidentDate), 'MM/dd/yyyy') : '-'}</p>
              </div>
              <div className="p-2 border-r border-gray-300">
                <p className="text-[8pt] font-semibold text-gray-500 uppercase">Time</p>
                <p className="text-[10pt] text-gray-900">{report.incidentTime || '-'}</p>
              </div>
              <div className="p-2">
                <p className="text-[8pt] font-semibold text-gray-500 uppercase">Facility</p>
                <p className="text-[10pt] text-gray-900">{report.Facility?.name || '-'}</p>
              </div>
            </div>
            <div className="grid grid-cols-3 border-b border-gray-300">
              <div className="p-2 border-r border-gray-300">
                <p className="text-[8pt] font-semibold text-gray-500 uppercase">Department</p>
                <p className="text-[10pt] text-gray-900">{report.department || '-'}</p>
              </div>
              <div className="p-2 border-r border-gray-300">
                <p className="text-[8pt] font-semibold text-gray-500 uppercase">Area</p>
                <p className="text-[10pt] text-gray-900">{report.area || '-'}</p>
              </div>
              <div className="p-2">
                <p className="text-[8pt] font-semibold text-gray-500 uppercase">Line</p>
                <p className="text-[10pt] text-gray-900">{report.line || '-'}</p>
              </div>
            </div>
            <div className="grid grid-cols-3 border-b border-gray-300">
              <div className="p-2 border-r border-gray-300">
                <p className="text-[8pt] font-semibold text-gray-500 uppercase">FM Source Category</p>
                <p className="text-[10pt] text-gray-900">{report.fmSourceCategory || '-'}</p>
              </div>
              <div className="p-2 border-r border-gray-300">
                <p className="text-[8pt] font-semibold text-gray-500 uppercase">FM Source Type</p>
                <p className="text-[10pt] text-gray-900">{report.fmSourceType || '-'}</p>
              </div>
              <div className="p-2">
                <p className="text-[8pt] font-semibold text-gray-500 uppercase">Item Number</p>
                <p className="text-[10pt] text-gray-900">{report.productItemNumber || '-'}</p>
              </div>
            </div>
            <div className="grid grid-cols-3 border-b border-gray-300">
              <div className="p-2 border-r border-gray-300">
                <p className="text-[8pt] font-semibold text-gray-500 uppercase">Amount</p>
                <p className="text-[10pt] text-gray-900">{report.amount || '-'}</p>
              </div>
              <div className="p-2 border-r border-gray-300">
                <p className="text-[8pt] font-semibold text-gray-500 uppercase">Name of Product</p>
                <p className="text-[10pt] text-gray-900">{report.productName || '-'}</p>
              </div>
              <div className="p-2">
                <p className="text-[8pt] font-semibold text-gray-500 uppercase">Product Code(s)/Batch/Lot</p>
                <p className="text-[10pt] text-gray-900">{report.productCodeBatchLot || '-'}</p>
              </div>
            </div>
            {report.individualsInvolved && (
              <div className="p-2">
                <p className="text-[8pt] font-semibold text-gray-500 uppercase">Individuals Involved</p>
                <p className="text-[10pt] text-gray-900">{report.individualsInvolved}</p>
              </div>
            )}
          </div>
        </div>

        {/* Section 2: Foreign Material Description */}
        <div className="fmir-print-section border-2 border-gray-800 mb-3 print-avoid-break">
          <div className="fmir-print-section-header bg-[#1e3a5f] text-white px-3 py-2 flex items-center gap-2">
            <span className="w-5 h-5 bg-white text-[#1e3a5f] flex items-center justify-center font-bold text-xs rounded">2</span>
            <h3 className="text-sm font-bold uppercase tracking-wide">Foreign Material Description</h3>
          </div>
          <div className="p-3">
            <div className="bg-gray-50 border border-gray-300 p-3 mb-3">
              <p className="text-[10pt] text-gray-900 whitespace-pre-wrap">{report.foreignMaterialDescription}</p>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-3">
              <div>
                <p className="text-[8pt] font-semibold text-gray-500 uppercase">Size</p>
                <p className="text-[10pt] text-gray-900">{report.foreignMaterialSize || '-'}</p>
              </div>
              <div>
                <p className="text-[8pt] font-semibold text-gray-500 uppercase">Hardness</p>
                <p className="text-[10pt] text-gray-900">{report.foreignMaterialHardness || '-'}</p>
              </div>
            </div>
            {(report.isHardSharpOrLarge || report.unforeseeHazardFormRequired) && (
              <div className="bg-amber-50 border-2 border-amber-400 p-2 mb-3">
                <div className="flex items-center gap-2 text-amber-800">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="text-[9pt] font-semibold">HAZARD ALERT</span>
                </div>
                {report.isHardSharpOrLarge && <p className="text-[9pt] text-amber-800 mt-1">• Object is hard, sharp, or large (7-25mm)</p>}
                {report.unforeseeHazardFormRequired && <p className="text-[9pt] text-amber-800">• Unforeseen Hazard Form is required</p>}
              </div>
            )}
            {(report.section2Initials || report.section2Date) && (
              <div className="flex gap-6 p-2 bg-gray-50 border border-gray-200">
                <div className="flex items-center gap-2">
                  <span className="text-[8pt] text-gray-500 uppercase">Initials:</span>
                  <span className="text-[10pt] font-semibold border-b border-gray-400 px-2">{report.section2Initials || '___'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[8pt] text-gray-500 uppercase">Date:</span>
                  <span className="text-[10pt] font-semibold border-b border-gray-400 px-2">{report.section2Date ? format(new Date(report.section2Date), 'MM/dd/yyyy') : '___'}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Section 3: Cause Identification */}
        <div className="fmir-print-section border-2 border-gray-800 mb-3 print-avoid-break">
          <div className="fmir-print-section-header bg-[#1e3a5f] text-white px-3 py-2 flex items-center gap-2">
            <span className="w-5 h-5 bg-white text-[#1e3a5f] flex items-center justify-center font-bold text-xs rounded">3</span>
            <h3 className="text-sm font-bold uppercase tracking-wide">Cause Identification</h3>
          </div>
          <div className="p-3">
            {report.causeIdentification ? (
              <>
                <div className="mb-3">
                  <p className="text-[8pt] font-semibold text-gray-500 uppercase mb-1">Cause Identification</p>
                  <p className="text-[10pt] text-gray-900 whitespace-pre-wrap">{report.causeIdentification}</p>
                </div>
                {report.possibleSource && (
                  <div className="mb-3">
                    <p className="text-[8pt] font-semibold text-gray-500 uppercase mb-1">Possible Source</p>
                    <p className="text-[10pt] text-gray-900 whitespace-pre-wrap">{report.possibleSource}</p>
                  </div>
                )}
                {report.howWhyOccurred && (
                  <div className="mb-3">
                    <p className="text-[8pt] font-semibold text-gray-500 uppercase mb-1">How/Why Occurred</p>
                    <p className="text-[10pt] text-gray-900 whitespace-pre-wrap">{report.howWhyOccurred}</p>
                  </div>
                )}
              </>
            ) : (
              <p className="text-[10pt] text-gray-500 italic">No cause identification documented</p>
            )}
            {(report.section3Initials || report.section3Date) && (
              <div className="flex gap-6 p-2 bg-gray-50 border border-gray-200 mt-2">
                <div className="flex items-center gap-2">
                  <span className="text-[8pt] text-gray-500 uppercase">Initials:</span>
                  <span className="text-[10pt] font-semibold border-b border-gray-400 px-2">{report.section3Initials || '___'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[8pt] text-gray-500 uppercase">Date:</span>
                  <span className="text-[10pt] font-semibold border-b border-gray-400 px-2">{report.section3Date ? format(new Date(report.section3Date), 'MM/dd/yyyy') : '___'}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Section 4: Corrective Action */}
        <div className="fmir-print-section border-2 border-gray-800 mb-3 print-avoid-break">
          <div className="fmir-print-section-header bg-[#1e3a5f] text-white px-3 py-2 flex items-center gap-2">
            <span className="w-5 h-5 bg-white text-[#1e3a5f] flex items-center justify-center font-bold text-xs rounded">4</span>
            <h3 className="text-sm font-bold uppercase tracking-wide">Corrective Action</h3>
          </div>
          <div className="p-3">
            {report.correctiveAction ? (
              <p className="text-[10pt] text-gray-900 whitespace-pre-wrap">{report.correctiveAction}</p>
            ) : (
              <p className="text-[10pt] text-gray-500 italic">No corrective action documented</p>
            )}
            {(report.section4Initials || report.section4Date) && (
              <div className="flex gap-6 p-2 bg-gray-50 border border-gray-200 mt-2">
                <div className="flex items-center gap-2">
                  <span className="text-[8pt] text-gray-500 uppercase">Initials:</span>
                  <span className="text-[10pt] font-semibold border-b border-gray-400 px-2">{report.section4Initials || '___'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[8pt] text-gray-500 uppercase">Date:</span>
                  <span className="text-[10pt] font-semibold border-b border-gray-400 px-2">{report.section4Date ? format(new Date(report.section4Date), 'MM/dd/yyyy') : '___'}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Section 5: Verification (QC) */}
        <div className="fmir-print-section border-2 border-gray-800 mb-3 print-avoid-break">
          <div className="fmir-print-section-header bg-[#1e3a5f] text-white px-3 py-2 flex items-center gap-2">
            <span className="w-5 h-5 bg-white text-[#1e3a5f] flex items-center justify-center font-bold text-xs rounded">5</span>
            <h3 className="text-sm font-bold uppercase tracking-wide">Verification (QC)</h3>
          </div>
          <div className="p-3">
            {report.verificationActions && (
              <div className="mb-3">
                <p className="text-[10pt] text-gray-900 whitespace-pre-wrap">{report.verificationActions}</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4 mb-3">
              <div className="flex items-center gap-2">
                <span className="text-[9pt] text-gray-600">Maintenance Work Completed:</span>
                <span className={`px-2 py-0.5 text-[9pt] font-semibold rounded ${
                  report.maintenanceWorkCompleted === 'Y' ? 'bg-green-100 text-green-800 border border-green-600' :
                  report.maintenanceWorkCompleted === 'N' ? 'bg-red-100 text-red-800 border border-red-600' :
                  'bg-gray-100 text-gray-600 border border-gray-400'
                }`}>
                  {report.maintenanceWorkCompleted === 'Y' ? 'Yes' : report.maintenanceWorkCompleted === 'N' ? 'No' : 'N/A'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[9pt] text-gray-600">Sanitation Required:</span>
                <span className={`px-2 py-0.5 text-[9pt] font-semibold rounded ${
                  report.sanitationRequired ? 'bg-green-100 text-green-800 border border-green-600' : 'bg-red-100 text-red-800 border border-red-600'
                }`}>
                  {report.sanitationRequired ? 'Yes' : 'No'}
                </span>
              </div>
            </div>
            {report.sanitationNotes && (
              <div className="mb-3">
                <p className="text-[8pt] font-semibold text-gray-500 uppercase mb-1">Sanitation Notes</p>
                <p className="text-[10pt] text-gray-900">{report.sanitationNotes}</p>
              </div>
            )}
            {(report.section5Initials || report.section5Date) && (
              <div className="flex gap-6 p-2 bg-gray-50 border border-gray-200">
                <div className="flex items-center gap-2">
                  <span className="text-[8pt] text-gray-500 uppercase">Initials:</span>
                  <span className="text-[10pt] font-semibold border-b border-gray-400 px-2">{report.section5Initials || '___'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[8pt] text-gray-500 uppercase">Date:</span>
                  <span className="text-[10pt] font-semibold border-b border-gray-400 px-2">{report.section5Date ? format(new Date(report.section5Date), 'MM/dd/yyyy') : '___'}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Section 6: Product Hold */}
        <div className="fmir-print-section border-2 border-gray-800 mb-3 print-avoid-break">
          <div className="fmir-print-section-header bg-[#1e3a5f] text-white px-3 py-2 flex items-center gap-2">
            <span className="w-5 h-5 bg-white text-[#1e3a5f] flex items-center justify-center font-bold text-xs rounded">6</span>
            <h3 className="text-sm font-bold uppercase tracking-wide">Product Hold</h3>
          </div>
          <div className="p-3">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[9pt] text-gray-600">Product Placed on Hold:</span>
              <span className={`px-2 py-0.5 text-[9pt] font-semibold rounded ${
                report.productPlacedOnHold ? 'bg-green-100 text-green-800 border border-green-600' : 'bg-red-100 text-red-800 border border-red-600'
              }`}>
                {report.productPlacedOnHold ? 'Yes' : 'No'}
              </span>
            </div>
            {report.productPlacedOnHold && (
              <>
                {report.itemsHeld && (
                  <div className="mb-3">
                    <p className="text-[8pt] font-semibold text-gray-500 uppercase mb-1">Items Held</p>
                    <p className="text-[10pt] text-gray-900">{report.itemsHeld}</p>
                  </div>
                )}
                {report.holdDecisionDetails && (
                  <div className="mb-3">
                    <p className="text-[8pt] font-semibold text-gray-500 uppercase mb-1">Decision Making Process</p>
                    <p className="text-[10pt] text-gray-900 whitespace-pre-wrap">{report.holdDecisionDetails}</p>
                  </div>
                )}
                {report.contaminationWindowDetails && (
                  <div className="mb-3">
                    <p className="text-[8pt] font-semibold text-gray-500 uppercase mb-1">Contamination Window Details</p>
                    <p className="text-[10pt] text-gray-900 whitespace-pre-wrap">{report.contaminationWindowDetails}</p>
                  </div>
                )}
              </>
            )}
            {(report.section6Initials || report.section6Date) && (
              <div className="flex gap-6 p-2 bg-gray-50 border border-gray-200">
                <div className="flex items-center gap-2">
                  <span className="text-[8pt] text-gray-500 uppercase">Initials:</span>
                  <span className="text-[10pt] font-semibold border-b border-gray-400 px-2">{report.section6Initials || '___'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[8pt] text-gray-500 uppercase">Date:</span>
                  <span className="text-[10pt] font-semibold border-b border-gray-400 px-2">{report.section6Date ? format(new Date(report.section6Date), 'MM/dd/yyyy') : '___'}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Section 7: Screening Process */}
        <div className="fmir-print-section border-2 border-gray-800 mb-3 print-avoid-break">
          <div className="fmir-print-section-header bg-[#1e3a5f] text-white px-3 py-2 flex items-center gap-2">
            <span className="w-5 h-5 bg-white text-[#1e3a5f] flex items-center justify-center font-bold text-xs rounded">7</span>
            <h3 className="text-sm font-bold uppercase tracking-wide">Screening Process</h3>
          </div>
          <div className="p-3">
            {report.screeningProcess ? (
              <p className="text-[10pt] text-gray-900 whitespace-pre-wrap">{report.screeningProcess}</p>
            ) : (
              <p className="text-[10pt] text-gray-500 italic">No screening process documented</p>
            )}
            {(report.section7Initials || report.section7Date) && (
              <div className="flex gap-6 p-2 bg-gray-50 border border-gray-200 mt-2">
                <div className="flex items-center gap-2">
                  <span className="text-[8pt] text-gray-500 uppercase">Initials:</span>
                  <span className="text-[10pt] font-semibold border-b border-gray-400 px-2">{report.section7Initials || '___'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[8pt] text-gray-500 uppercase">Date:</span>
                  <span className="text-[10pt] font-semibold border-b border-gray-400 px-2">{report.section7Date ? format(new Date(report.section7Date), 'MM/dd/yyyy') : '___'}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Section 8: Final Disposition */}
        <div className="fmir-print-section border-2 border-gray-800 mb-3 print-avoid-break">
          <div className="fmir-print-section-header bg-[#1e3a5f] text-white px-3 py-2 flex items-center gap-2">
            <span className="w-5 h-5 bg-white text-[#1e3a5f] flex items-center justify-center font-bold text-xs rounded">8</span>
            <h3 className="text-sm font-bold uppercase tracking-wide">Final Disposition</h3>
          </div>
          <div className="p-3">
            {report.finalDisposition ? (
              <>
                <p className="text-[10pt] text-gray-900 whitespace-pre-wrap mb-3">{report.finalDisposition}</p>
                <div className="grid grid-cols-3 gap-4 mb-3">
                  <div>
                    <p className="text-[8pt] font-semibold text-gray-500 uppercase">Volume</p>
                    <p className="text-[10pt] text-gray-900">{report.dispositionVolume || '-'}</p>
                  </div>
                  <div>
                    <p className="text-[8pt] font-semibold text-gray-500 uppercase">Date of Disposition</p>
                    <p className="text-[10pt] text-gray-900">{report.dispositionDate ? format(new Date(report.dispositionDate), 'MM/dd/yyyy') : '-'}</p>
                  </div>
                  <div>
                    <p className="text-[8pt] font-semibold text-gray-500 uppercase">Disposition Initials</p>
                    <p className="text-[10pt] text-gray-900">{report.dispositionInitials || '-'}</p>
                  </div>
                </div>
                {report.dispositionJustification && (
                  <div className="mb-3">
                    <p className="text-[8pt] font-semibold text-gray-500 uppercase mb-1">Justification</p>
                    <p className="text-[10pt] text-gray-900 whitespace-pre-wrap">{report.dispositionJustification}</p>
                  </div>
                )}
              </>
            ) : (
              <p className="text-[10pt] text-gray-500 italic">No final disposition documented</p>
            )}
            {(report.section8Initials || report.section8Date) && (
              <div className="flex gap-6 p-2 bg-gray-50 border border-gray-200">
                <div className="flex items-center gap-2">
                  <span className="text-[8pt] text-gray-500 uppercase">Initials:</span>
                  <span className="text-[10pt] font-semibold border-b border-gray-400 px-2">{report.section8Initials || '___'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[8pt] text-gray-500 uppercase">Date:</span>
                  <span className="text-[10pt] font-semibold border-b border-gray-400 px-2">{report.section8Date ? format(new Date(report.section8Date), 'MM/dd/yyyy') : '___'}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Section 9: Prevention Measures */}
        <div className="fmir-print-section border-2 border-gray-800 mb-3 print-avoid-break">
          <div className="fmir-print-section-header bg-[#1e3a5f] text-white px-3 py-2 flex items-center gap-2">
            <span className="w-5 h-5 bg-white text-[#1e3a5f] flex items-center justify-center font-bold text-xs rounded">9</span>
            <h3 className="text-sm font-bold uppercase tracking-wide">Prevention Measures</h3>
          </div>
          <div className="p-3">
            {report.preventionMeasures ? (
              <p className="text-[10pt] text-gray-900 whitespace-pre-wrap">{report.preventionMeasures}</p>
            ) : (
              <p className="text-[10pt] text-gray-500 italic">No prevention measures documented</p>
            )}
            {(report.section9Initials || report.section9Date) && (
              <div className="flex gap-6 p-2 bg-gray-50 border border-gray-200 mt-2">
                <div className="flex items-center gap-2">
                  <span className="text-[8pt] text-gray-500 uppercase">Initials:</span>
                  <span className="text-[10pt] font-semibold border-b border-gray-400 px-2">{report.section9Initials || '___'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[8pt] text-gray-500 uppercase">Date:</span>
                  <span className="text-[10pt] font-semibold border-b border-gray-400 px-2">{report.section9Date ? format(new Date(report.section9Date), 'MM/dd/yyyy') : '___'}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Section 10: Corporate Notification & Pre-Shipment Review */}
        <div className="fmir-print-section border-2 border-gray-800 mb-3 print-avoid-break">
          <div className="fmir-print-section-header bg-[#1e3a5f] text-white px-3 py-2 flex items-center gap-2">
            <span className="w-5 h-5 bg-white text-[#1e3a5f] flex items-center justify-center font-bold text-xs rounded">10</span>
            <h3 className="text-sm font-bold uppercase tracking-wide">Corporate Notification & Pre-Shipment Review</h3>
          </div>
          <div className="p-3">
            <div className="flex items-center gap-4 mb-3">
              <div className="flex items-center gap-2">
                <span className="text-[9pt] text-gray-600">Corporate Notified:</span>
                <span className={`px-2 py-0.5 text-[9pt] font-semibold rounded ${
                  report.corporateNotified ? 'bg-green-100 text-green-800 border border-green-600' : 'bg-red-100 text-red-800 border border-red-600'
                }`}>
                  {report.corporateNotified ? 'Yes' : 'No'}
                </span>
              </div>
              {report.corporateNotified && report.corporatePersonsNotified && (
                <div>
                  <span className="text-[9pt] text-gray-600">Persons Notified: </span>
                  <span className="text-[10pt] text-gray-900">{report.corporatePersonsNotified}</span>
                </div>
              )}
            </div>
            {(report.preShipmentReview || report.preShipmentReviewDate || report.preShipmentSignatureRequired) && (
              <div className="bg-blue-50 border-2 border-blue-400 p-3">
                <h4 className="text-[10pt] font-semibold text-blue-800 mb-2">Pre-Shipment Review</h4>
                {report.preShipmentReview && <p className="text-[10pt] text-gray-900 mb-2">{report.preShipmentReview}</p>}
                <div className="flex gap-6">
                  {report.preShipmentReviewDate && (
                    <p className="text-[9pt] text-blue-700">Review Date: {format(new Date(report.preShipmentReviewDate), 'MM/dd/yyyy')}</p>
                  )}
                  {report.preShipmentSignatureRequired && (
                    <p className="text-[9pt] text-blue-700">✓ Pre-Shipment Signature Required</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Evidence Section - On a separate page with larger photos */}
        {report.Evidence && report.Evidence.length > 0 && (
          <div className="print-page-break-before">
            <div className="fmir-print-section border-2 border-gray-800 mb-3" style={{ pageBreakBefore: 'always', breakBefore: 'page' }}>
              <div className="fmir-print-section-header bg-[#1e3a5f] text-white px-3 py-2 flex items-center gap-2">
                <span className="w-5 h-5 bg-white text-[#1e3a5f] flex items-center justify-center font-bold text-xs rounded">E</span>
                <h3 className="text-sm font-bold uppercase tracking-wide">Evidence Attachments ({report.Evidence.length})</h3>
              </div>
              <div className="p-4">
                {/* Large photos - 2 per row for better visibility */}
                <div className="grid grid-cols-2 gap-4">
                  {report.Evidence.filter(f => f.type === 'PHOTO').map((file, index) => (
                    <div key={file.id} className="border-2 border-gray-300 p-3 text-center bg-white">
                      {mediaUrls[file.id] ? (
                        <img 
                          src={mediaUrls[file.id]} 
                          alt={file.fileName}
                          className="w-full h-auto max-h-[3.5in] object-contain bg-gray-50 mb-2"
                        />
                      ) : (
                        <div className="w-full h-48 bg-gray-100 flex items-center justify-center mb-2">
                          <File className="w-12 h-12 text-gray-400" />
                        </div>
                      )}
                      <p className="text-[9pt] font-medium text-gray-700">{file.fileName}</p>
                      <p className="text-[8pt] text-gray-500">Photo Evidence • {formatFileSize(file.fileSize)}</p>
                    </div>
                  ))}
                </div>
                
                {/* Videos and Documents listed separately */}
                {report.Evidence.filter(f => f.type !== 'PHOTO').length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-300">
                    <p className="text-[9pt] font-semibold text-gray-600 uppercase mb-2">Other Attachments</p>
                    <div className="grid grid-cols-3 gap-3">
                      {report.Evidence.filter(f => f.type !== 'PHOTO').map((file) => (
                        <div key={file.id} className="border border-gray-300 p-2 text-center bg-gray-50">
                          <div className="w-full h-16 flex items-center justify-center mb-2">
                            {file.type === 'VIDEO' ? (
                              <Video className="w-10 h-10 text-gray-400" />
                            ) : (
                              <File className="w-10 h-10 text-gray-400" />
                            )}
                          </div>
                          <p className="text-[8pt] text-gray-600 truncate">{file.fileName}</p>
                          <p className="text-[7pt] text-gray-400">{file.type} • {formatFileSize(file.fileSize)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Metadata Footer */}
        <div className="border-t-4 border-[#1e3a5f] pt-3 mt-4">
          <div className="flex justify-between text-[8pt] text-gray-500 mb-2">
            <span><strong>Created:</strong> {format(new Date(report.createdAt), 'MMM d, yyyy h:mm a')}</span>
            <span><strong>Updated:</strong> {format(new Date(report.updatedAt), 'MMM d, yyyy h:mm a')}</span>
            {report.submittedAt && <span><strong>Submitted:</strong> {format(new Date(report.submittedAt), 'MMM d, yyyy h:mm a')}</span>}
            {report.CreatedBy && <span><strong>Created By:</strong> {report.CreatedBy.firstName} {report.CreatedBy.lastName}</span>}
          </div>
          <p className="text-[8pt] text-gray-500 italic text-center border-t border-gray-200 pt-2">
            This material constitutes trade secrets and commercial or financial information, is privileged or confidential, and may not be disclosed.
          </p>
        </div>
      </div>

      {/* FMIR Visibility Off Modal */}
      <FMIRVisibilityOffModal
        isOpen={showVisibilityOffModal}
        reportNumber={visibilityOffReportNumber}
        ownerName={visibilityOffOwnerName}
        saving={false}
        onSaveAndClose={handleCloseFromVisibilityModal}
        onClose={handleCloseFromVisibilityModal}
      />

      {/* Video Player Modal */}
      {showVideoPlayer && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center"
          onClick={closeVideoPlayer}
        >
          {/* Backdrop with blur */}
          <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" />
          
          {/* Modal Content */}
          <div 
            className="relative w-full max-w-5xl mx-4 z-10 animate-in zoom-in-95 slide-in-from-bottom-4 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header - Professional glassmorphism */}
            <div className="flex items-center justify-between mb-4 p-3 bg-white/5 backdrop-blur-md rounded-xl border border-white/10">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-primary-600/20 rounded-xl border border-primary-500/30">
                  <Video className="w-5 h-5 text-primary-400" />
                </div>
                <div>
                  <h3 className="text-white font-semibold text-lg">{currentVideoName}</h3>
                  <p className="text-white/50 text-sm">Video Evidence</p>
                </div>
              </div>
              <button
                onClick={closeVideoPlayer}
                className="p-2.5 hover:bg-white/10 rounded-xl transition-all duration-150 hover:scale-105 active:scale-95 border border-transparent hover:border-white/10"
              >
                <X className="w-6 h-6 text-white" />
              </button>
            </div>

            {/* Video Container - Professional styling */}
            <div className="relative bg-black rounded-xl overflow-hidden shadow-2xl ring-1 ring-white/10">
              <video
                ref={videoRef}
                src={currentVideoUrl}
                className="w-full h-auto max-h-[70vh] object-contain"
                style={{ backgroundColor: '#000' }}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onEnded={handleVideoEnded}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onClick={togglePlay}
              />
              
              {/* Large center play button - Professional animated design */}
              {!isPlaying && (
                <div 
                  className="absolute inset-0 flex items-center justify-center cursor-pointer bg-gradient-to-t from-black/40 via-transparent to-transparent group"
                  onClick={togglePlay}
                >
                  <div className="w-20 h-20 rounded-full bg-white/95 backdrop-blur-md flex items-center justify-center shadow-2xl group-hover:scale-110 group-active:scale-95 transition-transform duration-150 border border-white/50">
                    <Play className="w-10 h-10 text-slate-800 ml-1.5" />
                  </div>
                </div>
              )}
            </div>

            {/* Custom Controls */}
            <div className="mt-4 bg-gradient-to-t from-black/90 via-black/60 to-transparent rounded-xl p-4 backdrop-blur-sm">
              {/* Current time floating indicator */}
              <div className="relative h-6 mb-2" style={{ pointerEvents: 'none' }}>
                <div 
                  className="absolute -translate-x-1/2 px-2.5 py-1 bg-primary-600 text-white text-xs font-mono rounded-md shadow-lg whitespace-nowrap"
                  style={{ 
                    left: `${(currentTime / (duration || 1)) * 100}%`,
                    opacity: isSeeking ? 1 : 0,
                    transition: 'opacity 150ms ease'
                  }}
                >
                  {formatTime(currentTime)}
                </div>
              </div>
              
              {/* Progress Bar - Professional smooth scrubbing */}
              <div className="mb-4 group">
                <div
                  ref={progressBarRef}
                  className="relative h-2 bg-white/20 rounded-full cursor-pointer group-hover:h-3 transition-[height] duration-150 overflow-visible"
                  style={{ boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.3)' }}
                  onMouseDown={handleSeekStart}
                >
                  {/* Tick marks for professional look */}
                  <div className="absolute inset-0 flex justify-between px-0.5 opacity-20 pointer-events-none overflow-hidden rounded-full">
                    {Array.from({ length: 21 }).map((_, i) => (
                      <div key={i} className={`w-px ${i % 5 === 0 ? 'h-full bg-white' : 'h-1/2 mt-auto bg-white/50'}`} />
                    ))}
                  </div>
                  
                  {/* Progress fill - instant update, no transitions */}
                  <div 
                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary-500 via-primary-400 to-emerald-400 rounded-full pointer-events-none"
                    style={{ 
                      width: `${(currentTime / (duration || 1)) * 100}%`,
                      boxShadow: '0 0 8px rgba(16, 185, 129, 0.5)',
                      transition: 'none'
                    }}
                  />
                  
                  {/* Playhead/thumb - Positioned at the END of progress fill, no transition for position */}
                  <div 
                    className="absolute top-1/2 w-5 h-6 bg-gradient-to-b from-white via-white to-slate-100 rounded-md shadow-xl
                      opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing select-none pointer-events-none"
                    style={{ 
                      left: `${(currentTime / (duration || 1)) * 100}%`,
                      transform: 'translate(-50%, -50%)',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.3), 0 0 0 2px rgba(16, 185, 129, 0.4)',
                      opacity: isSeeking ? 1 : undefined,
                      transition: 'opacity 150ms ease'
                    }}
                  >
                    {/* Grip lines */}
                    <div className="absolute inset-x-1.5 top-1/2 -translate-y-1/2 flex flex-col gap-0.5">
                      <div className="h-px bg-slate-300 rounded-full" />
                      <div className="h-px bg-slate-300 rounded-full" />
                      <div className="h-px bg-slate-300 rounded-full" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Control Buttons */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {/* Play/Pause Button */}
                  <button
                    onClick={togglePlay}
                    className="w-12 h-12 rounded-full bg-primary-600 hover:bg-primary-500 flex items-center justify-center transition-colors shadow-lg"
                  >
                    {isPlaying ? (
                      <Pause className="w-6 h-6 text-white" />
                    ) : (
                      <Play className="w-6 h-6 text-white ml-0.5" />
                    )}
                  </button>

                  {/* Time Display - With milliseconds */}
                  <div className="text-white font-mono text-sm tabular-nums">
                    <span className="text-emerald-400">{formatTime(currentTime)}</span>
                    <span className="text-white/40 mx-2">/</span>
                    <span className="text-white/60">{formatTime(duration)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  {/* Volume Control */}
                  <div className="flex items-center gap-2 group">
                    <button
                      onClick={toggleMute}
                      className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                    >
                      {isMuted || volume === 0 ? (
                        <VolumeX className="w-5 h-5 text-white" />
                      ) : (
                        <Volume2 className="w-5 h-5 text-white" />
                      )}
                    </button>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={isMuted ? 0 : volume}
                      onChange={handleVolumeChange}
                      className="w-20 h-1.5 bg-white/20 rounded-full appearance-none cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity
                        [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 
                        [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white 
                        [&::-webkit-slider-thumb]:cursor-pointer"
                    />
                  </div>

                  {/* Fullscreen Button */}
                  <button
                    onClick={toggleFullscreen}
                    className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                    title="Fullscreen"
                  >
                    <Maximize className="w-5 h-5 text-white" />
                  </button>

                  {/* Download Button */}
                  <button
                    onClick={() => {
                      const link = document.createElement('a');
                      link.href = currentVideoUrl;
                      link.download = currentVideoName;
                      link.click();
                    }}
                    className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                    title="Download"
                  >
                    <Download className="w-5 h-5 text-white" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-4 right-4 z-50 animate-slide-up">
          <div className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border ${
            toastType === 'success' 
              ? 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800' 
              : toastType === 'warning'
                ? 'bg-yellow-50 dark:bg-yellow-900/30 border-yellow-200 dark:border-yellow-800'
                : 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800'
          }`}>
            {toastType === 'success' ? (
              <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
            ) : toastType === 'warning' ? (
              <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
            ) : (
              <Info className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            )}
            <span className={`text-sm font-medium ${
              toastType === 'success' 
                ? 'text-green-800 dark:text-green-200'
                : toastType === 'warning'
                  ? 'text-yellow-800 dark:text-yellow-200'
                  : 'text-blue-800 dark:text-blue-200'
            }`}>{toastMessage}</span>
            <button
              onClick={() => setToastMessage(null)}
              className={`ml-2 p-1 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors ${
                toastType === 'success' 
                  ? 'text-green-600 dark:text-green-400'
                  : toastType === 'warning'
                    ? 'text-yellow-600 dark:text-yellow-400'
                    : 'text-blue-600 dark:text-blue-400'
              }`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Access Denied Modal */}
      {accessDeniedModal}
    </ProtectedRoute>
  );
}
