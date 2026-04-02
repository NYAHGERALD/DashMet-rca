'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/components/providers/AuthProvider';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import api from '@/lib/api';
import { formatDate } from '@/lib/dateUtils';
import dynamic from 'next/dynamic';

// Dynamically import RichTextEditor to avoid SSR issues
const RichTextEditor = dynamic(
  () => import('@/components/ui/RichTextEditor'),
  { ssr: false, loading: () => <div className="h-40 bg-gray-100 dark:bg-gray-700 rounded-lg animate-pulse" /> }
);

// Types
interface EvidenceFile {
  id: string;
  name: string;
  type: 'photo' | 'document' | 'link';
  url?: string;
  file?: File;
  preview?: string;
  uploadedAt: string;
  size?: number;
}

interface ImplementationStep {
  stepNumber: number;
  actionDescription: string;
  estimatedTime: string;
  responsibleParty: string;
  dueDate: string;
  ownership: string;
  verificationMethod: string;
  status: string;
  notes: string;
}

interface CAPAction {
  id: string;
  title: string;
  description: string;
  actionType: 'CORRECTIVE' | 'PREVENTIVE';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: string;
  dueDate: string;
  startedAt: string | null;
  implementationPlan: string | null;
  implementationNotes: string | null;
  owner: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  rcaAnalysis: {
    id: string;
    rootCauseStatement?: string;
    incident: {
      id: string;
      customTitle?: string;
      description: string;
      type: string;
      severity?: string;
      category?: { name: string };
      facility?: { name: string };
      line?: { name: string };
    };
  };
}

interface DeviationValidation {
  isValid: boolean;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  gaps: string[];
  risks: string[];
  recommendations: string[];
  summary: string;
}

interface LessonsValidation {
  isValid: boolean;
  clarity: number;
  applicability: number;
  enhancements: string[];
  relatedCategories: string[];
  summary: string;
}

function CompleteActionContent() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const actionId = params.id as string;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // State
  const [action, setAction] = useState<CAPAction | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Evidence & Documentation
  const [evidenceFiles, setEvidenceFiles] = useState<EvidenceFile[]>([]);
  const [externalLinks, setExternalLinks] = useState<{ url: string; description: string }[]>([]);
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [newLinkDescription, setNewLinkDescription] = useState('');
  const [uploadingFile, setUploadingFile] = useState(false);

  // Completion Evidence (required text)
  const [completionEvidence, setCompletionEvidence] = useState('');
  const [completionNotes, setCompletionNotes] = useState('');

  // Deviation from Plan
  const [hasDeviation, setHasDeviation] = useState(false);
  const [deviationDescription, setDeviationDescription] = useState('');
  const [deviationValidation, setDeviationValidation] = useState<DeviationValidation | null>(null);
  const [validatingDeviation, setValidatingDeviation] = useState(false);

  // Lessons Learned
  const [lessonsLearned, setLessonsLearned] = useState('');
  const [lessonsLearnedJson, setLessonsLearnedJson] = useState(''); // TipTap JSON storage
  const [lessonsValidation, setLessonsValidation] = useState<LessonsValidation | null>(null);
  const [validatingLessons, setValidatingLessons] = useState(false);
  const [generatingLessons, setGeneratingLessons] = useState(false);
  const [isEditingLessons, setIsEditingLessons] = useState(false);
  const [originalLessonsContent, setOriginalLessonsContent] = useState('');
  const [improvingWriting, setImprovingWriting] = useState(false);
  const [showOverrideConfirm, setShowOverrideConfirm] = useState(false);

  // Implementation Plan Modal
  const [showPlanModal, setShowPlanModal] = useState(false);

  // Load action data
  useEffect(() => {
    loadActionData();
  }, [actionId]);

  const loadActionData = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/capa/${actionId}`);
      const actionData = response.data.data;
      setAction(actionData);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load action');
    } finally {
      setLoading(false);
    }
  };

  // Generate unique ID
  const generateId = () => `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Handle file selection
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>, isCamera: boolean = false) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploadingFile(true);

    try {
      for (const file of Array.from(files)) {
        const isImage = file.type.startsWith('image/');
        const isDocument = file.type === 'application/pdf' || 
                          file.type.includes('document') || 
                          file.type.includes('spreadsheet');

        // Create preview for images
        let preview = '';
        if (isImage) {
          preview = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(file);
          });
        }

        const newFile: EvidenceFile = {
          id: generateId(),
          name: file.name,
          type: isImage ? 'photo' : 'document',
          file: file,
          preview: preview,
          uploadedAt: new Date().toISOString(),
          size: file.size,
        };

        setEvidenceFiles(prev => [...prev, newFile]);
      }
    } catch (err) {
      setError('Failed to process file');
    } finally {
      setUploadingFile(false);
      // Reset input
      if (event.target) event.target.value = '';
    }
  };

  // Remove file
  const removeFile = (fileId: string) => {
    setEvidenceFiles(prev => prev.filter(f => f.id !== fileId));
  };

  // Add external link
  const addExternalLink = () => {
    if (!newLinkUrl.trim()) return;
    
    // Basic URL validation
    let url = newLinkUrl.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }

    setExternalLinks(prev => [...prev, {
      url,
      description: newLinkDescription.trim() || url,
    }]);
    setNewLinkUrl('');
    setNewLinkDescription('');
  };

  // Remove external link
  const removeLink = (index: number) => {
    setExternalLinks(prev => prev.filter((_, i) => i !== index));
  };

  // AI: Validate deviation
  const validateDeviation = async () => {
    if (!deviationDescription.trim()) {
      setError('Please describe the deviation before validating');
      return;
    }

    setValidatingDeviation(true);
    setDeviationValidation(null);

    try {
      const response = await api.post(`/capa/${actionId}/validate-deviation`, {
        deviationDescription,
        originalPlan: action?.implementationPlan,
        actionTitle: action?.title,
        actionType: action?.actionType,
        rootCause: action?.rcaAnalysis?.rootCauseStatement,
      });

      if (response.data.success) {
        setDeviationValidation(response.data.data);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to validate deviation');
    } finally {
      setValidatingDeviation(false);
    }
  };

  // AI: Generate lessons learned - check for existing content first
  const handleGenerateLessons = () => {
    // If there's existing content, show confirmation modal
    if (lessonsLearned.trim()) {
      setShowOverrideConfirm(true);
    } else {
      // No existing content, proceed directly
      generateLessonsLearned();
    }
  };

  // AI: Generate lessons learned (actual generation)
  const generateLessonsLearned = async () => {
    setShowOverrideConfirm(false);
    setGeneratingLessons(true);
    setLessonsValidation(null);

    try {
      const response = await api.post(`/capa/${actionId}/generate-lessons`, {
        completionEvidence,
        deviationDescription: hasDeviation ? deviationDescription : null,
        actionTitle: action?.title,
        actionDescription: action?.description,
        actionType: action?.actionType,
        implementationPlan: action?.implementationPlan,
        rootCause: action?.rcaAnalysis?.rootCauseStatement,
        incidentDescription: action?.rcaAnalysis?.incident?.description,
        category: action?.rcaAnalysis?.incident?.category?.name,
      });

      if (response.data.success && response.data.data.lessons) {
        const generatedLessons = response.data.data.lessons;
        setLessonsLearned(generatedLessons);
        setLessonsLearnedJson(''); // Clear JSON so TipTap uses the plain text
        // Automatically enter edit mode so user can edit the generated content
        setIsEditingLessons(true);
        setOriginalLessonsContent(generatedLessons);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to generate lessons');
    } finally {
      setGeneratingLessons(false);
    }
  };

  // AI: Validate lessons learned
  const validateLessons = async () => {
    if (!lessonsLearned.trim()) {
      setError('Please enter lessons learned before validating');
      return;
    }

    setValidatingLessons(true);
    setLessonsValidation(null);

    try {
      const response = await api.post(`/capa/${actionId}/validate-lessons`, {
        lessonsLearned,
        actionTitle: action?.title,
        actionType: action?.actionType,
        rootCause: action?.rcaAnalysis?.rootCauseStatement,
        category: action?.rcaAnalysis?.incident?.category?.name,
      });

      if (response.data.success) {
        setLessonsValidation(response.data.data);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to validate lessons');
    } finally {
      setValidatingLessons(false);
    }
  };

  // AI: Improve writing for lessons learned
  const improveWriting = async () => {
    if (!lessonsLearned.trim()) {
      setError('Please enter content before using AI assist');
      return;
    }

    setImprovingWriting(true);

    try {
      const response = await api.post(`/capa/${actionId}/improve-writing`, {
        content: lessonsLearned,
        context: `lessons learned for ${action?.actionType?.toLowerCase()} action: ${action?.title}`,
      });

      if (response.data.success && response.data.data.improvedContent) {
        setLessonsLearned(response.data.data.improvedContent);
        setLessonsLearnedJson(''); // Clear JSON so editor resets with new text
        setLessonsValidation(null);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to improve writing');
    } finally {
      setImprovingWriting(false);
    }
  };

  // Edit mode handlers for lessons learned
  const startEditingLessons = () => {
    setOriginalLessonsContent(lessonsLearnedJson || lessonsLearned);
    setIsEditingLessons(true);
  };

  const saveLessonsEdit = () => {
    setIsEditingLessons(false);
    setLessonsValidation(null);
  };

  const cancelLessonsEdit = () => {
    // Restore original content
    if (originalLessonsContent) {
      try {
        // Check if it's JSON
        JSON.parse(originalLessonsContent);
        setLessonsLearnedJson(originalLessonsContent);
      } catch {
        setLessonsLearned(originalLessonsContent);
        setLessonsLearnedJson('');
      }
    }
    setIsEditingLessons(false);
  };

  // Handler for TipTap editor changes
  const handleLessonsEditorChange = (json: string, html: string, text: string) => {
    setLessonsLearnedJson(json);
    setLessonsLearned(text);
    setLessonsValidation(null);
  };

  // Submit completion
  const handleSubmit = async () => {
    if (!completionEvidence.trim()) {
      setError('Completion evidence is required');
      return;
    }

    if (hasDeviation && !deviationDescription.trim()) {
      setError('Please describe the deviation from the plan');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      // Prepare evidence data
      const evidenceData = {
        files: evidenceFiles.map(f => ({
          name: f.name,
          type: f.type,
          url: f.url || f.preview,
          uploadedAt: f.uploadedAt,
        })),
        links: externalLinks,
      };

      await api.patch(`/capa/${actionId}/status`, {
        status: 'COMPLETED',
        completionEvidence,
        completionNotes,
        notes: completionNotes,
        evidence: JSON.stringify(evidenceData),
        deviationFromPlan: hasDeviation ? deviationDescription : null,
        deviationValidation: deviationValidation ? JSON.stringify(deviationValidation) : null,
        lessonsLearned,
        lessonsLearnedJson: lessonsLearnedJson || null, // Store TipTap JSON for rich text
        lessonsValidation: lessonsValidation ? JSON.stringify(lessonsValidation) : null,
      });

      router.push('/capa');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to complete action');
    } finally {
      setSubmitting(false);
    }
  };

  // Format file size
  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="flex flex-col items-center justify-center">
          <div className="relative mb-8">
            <div className="absolute inset-0 w-20 h-20 rounded-full border-4 border-primary-200 dark:border-primary-900/50" />
            <div className="w-20 h-20 rounded-full border-4 border-transparent border-t-primary-600 border-r-primary-600 animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <svg className="w-8 h-8 text-primary-600 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Hang tight!</h3>
          <p className="text-gray-500 dark:text-gray-400 text-center max-w-sm">Loading action details...</p>
          <div className="flex items-center gap-1.5 mt-6">
            <div className="w-2 h-2 bg-primary-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      </div>
    );
  }

  if (!action) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 dark:text-red-400 mb-4">Action not found</p>
          <Link href="/capa" className="text-primary-600 hover:underline">
            Return to CAPA Board
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <nav className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-40">
        <div className="w-full px-3 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:justify-between gap-2 py-2 sm:py-0 sm:h-16">
            <div className="flex items-center space-x-2 sm:space-x-4">
              <div className="relative w-7 h-7 sm:w-8 sm:h-8">
                <Image src="/images/logo.png" alt="DASHMET Logo" fill className="object-contain" />
              </div>
              <div className="h-4 sm:h-6 w-px bg-gray-300 dark:bg-gray-600"></div>
              <h1 className="text-base sm:text-xl font-bold text-gray-900 dark:text-white">
                ✅ Complete Action
              </h1>
            </div>
            <div className="flex items-center justify-end space-x-2 sm:space-x-4 pb-2 sm:pb-0">
              <button
                onClick={() => router.push('/capa')}
                className="px-3 sm:px-4 py-1.5 sm:py-2 text-sm text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 touch-manipulation"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting || !completionEvidence.trim()}
                className="px-4 sm:px-6 py-1.5 sm:py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 sm:gap-2 touch-manipulation"
              >
                {submitting ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    <span className="hidden sm:inline">Completing...</span>
                    <span className="sm:hidden">...</span>
                  </>
                ) : (
                  <>
                    ✅ <span className="hidden xs:inline">Mark</span> Complete
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
        onChange={(e) => handleFileSelect(e, false)}
        className="hidden"
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => handleFileSelect(e, true)}
        className="hidden"
      />

      <main className="w-full px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
        {error && (
          <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-sm">
            {error}
            <button onClick={() => setError('')} className="ml-2 sm:ml-4 text-xs sm:text-sm underline">Dismiss</button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Left Column: Action Context */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 sm:p-6 lg:sticky lg:top-24">
              {/* Action Summary */}
              <div className="mb-4 sm:mb-6">
                <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white mb-2 sm:mb-3">
                  Action Details
                </h2>
                <div className="space-y-2 sm:space-y-3">
                  <div>
                    <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Title</p>
                    <p className="text-sm sm:text-base text-gray-900 dark:text-white font-medium">{action.title}</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5 sm:gap-2">
                    <span className={`px-1.5 sm:px-2 py-0.5 sm:py-1 text-[10px] sm:text-xs font-medium rounded ${
                      action.actionType === 'CORRECTIVE'
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                        : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                    }`}>
                      {action.actionType}
                    </span>
                    <span className={`px-1.5 sm:px-2 py-0.5 sm:py-1 text-[10px] sm:text-xs font-medium rounded ${
                      action.priority === 'CRITICAL' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' :
                      action.priority === 'HIGH' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300' :
                      action.priority === 'MEDIUM' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' :
                      'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                    }`}>
                      {action.priority}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Description</p>
                    <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-300">{action.description}</p>
                  </div>
                  <div>
                    <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Owner</p>
                    <p className="text-sm sm:text-base text-gray-900 dark:text-white">
                      {action.owner?.firstName || 'Unassigned'} {action.owner?.lastName || ''}
                    </p>
                  </div>
                  {action.startedAt && (
                    <div>
                      <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Started</p>
                      <p className="text-sm sm:text-base text-gray-900 dark:text-white">
                        {formatDate(action.startedAt)}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Implementation Plan Summary */}
              {action.implementationPlan && (
                <div className="pt-3 sm:pt-4 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400">
                      📋 Implementation Plan
                    </h3>
                    <button
                      onClick={() => setShowPlanModal(true)}
                      className="text-[10px] sm:text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-1 touch-manipulation"
                    >
                      👁️ View
                    </button>
                  </div>
                  <div className="text-xs sm:text-sm bg-gray-100 dark:bg-gray-700/50 p-2 sm:p-3 rounded-lg max-h-36 sm:max-h-48 overflow-y-auto space-y-2 sm:space-y-3 border border-gray-200 dark:border-gray-600">
                    {formatImplementationPlanCompact(action.implementationPlan)}
                  </div>
                </div>
              )}

              {/* Root Cause Context */}
              {action.rcaAnalysis?.rootCauseStatement && (
                <div className="pt-3 sm:pt-4 border-t border-gray-200 dark:border-gray-700 mt-3 sm:mt-4">
                  <h3 className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                    🎯 Root Cause
                  </h3>
                  <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 bg-amber-50 dark:bg-amber-900/20 p-2 sm:p-3 rounded-lg border border-amber-200 dark:border-amber-800">
                    {action.rcaAnalysis?.rootCauseStatement}
                  </p>
                </div>
              )}

              {/* Note about verification */}
              <div className="mt-4 sm:mt-6 p-3 sm:p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                <p className="text-xs sm:text-sm text-amber-800 dark:text-amber-300">
                  <strong>⚠️ Note:</strong> After completion, this action will require effectiveness verification within 30 days.
                </p>
              </div>
            </div>
          </div>

          {/* Right Column: Completion Details */}
          <div className="lg:col-span-2 space-y-4 sm:space-y-6">
            {/* Section 1: Evidence & Documentation */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 sm:p-6">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-3 sm:mb-4">
                📎 Evidence & Documentation
              </h2>

              {/* Completion Evidence Text */}
              <div className="mb-4 sm:mb-6">
                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
                  Completion Evidence <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={completionEvidence}
                  onChange={(e) => setCompletionEvidence(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  placeholder="Document what was done, reference numbers, links to documentation..."
                />
                <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Include references, document IDs, or descriptions that prove the action was completed.
                </p>
              </div>

              {/* File Attachments */}
              <div className="mb-4 sm:mb-6">
                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
                  File Attachments
                </label>
                <div className="flex flex-wrap gap-2 mb-3">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingFile}
                    className="px-3 sm:px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5 sm:gap-2 touch-manipulation"
                  >
                    📁 Upload <span className="hidden sm:inline">Files</span>
                  </button>
                  <button
                    onClick={() => cameraInputRef.current?.click()}
                    disabled={uploadingFile}
                    className="px-3 sm:px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-1.5 sm:gap-2 touch-manipulation"
                  >
                    📷 Capture <span className="hidden xs:inline">Photo</span>
                  </button>
                </div>

                {uploadingFile && (
                  <div className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                    Processing files...
                  </div>
                )}

                {/* File List */}
                {evidenceFiles.length > 0 && (
                  <div className="grid grid-cols-1 gap-2 sm:gap-3">
                    {evidenceFiles.map((file) => (
                      <div
                        key={file.id}
                        className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600"
                      >
                        {file.type === 'photo' && file.preview ? (
                          <img
                            src={file.preview}
                            alt={file.name}
                            className="w-10 h-10 sm:w-12 sm:h-12 object-cover rounded"
                          />
                        ) : (
                          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gray-200 dark:bg-gray-600 rounded flex items-center justify-center text-sm">
                            📄
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white truncate">
                            {file.name}
                          </p>
                          <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">
                            {file.type === 'photo' ? '📷 Photo' : '📄 Document'}
                            {file.size && ` • ${formatFileSize(file.size)}`}
                          </p>
                        </div>
                        <button
                          onClick={() => removeFile(file.id)}
                          className="p-1.5 text-red-500 hover:text-red-700 touch-manipulation"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* External Links */}
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
                  External Links
                </label>
                <div className="flex flex-col sm:flex-row gap-2 mb-3">
                  <input
                    type="text"
                    value={newLinkUrl}
                    onChange={(e) => setNewLinkUrl(e.target.value)}
                    placeholder="https://example.com/document"
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  />
                  <input
                    type="text"
                    value={newLinkDescription}
                    onChange={(e) => setNewLinkDescription(e.target.value)}
                    placeholder="Description (optional)"
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  />
                  <button
                    onClick={addExternalLink}
                    disabled={!newLinkUrl.trim()}
                    className="px-4 py-2 bg-gray-600 text-white text-sm rounded-lg hover:bg-gray-700 disabled:opacity-50 touch-manipulation whitespace-nowrap"
                  >
                    Add
                  </button>
                </div>

                {externalLinks.length > 0 && (
                  <div className="space-y-2">
                    {externalLinks.map((link, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-3 p-2 bg-gray-50 dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600"
                      >
                        <span className="text-blue-500">🔗</span>
                        <div className="flex-1 min-w-0">
                          <a
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-blue-600 dark:text-blue-400 hover:underline truncate block"
                          >
                            {link.description}
                          </a>
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            {link.url}
                          </p>
                        </div>
                        <button
                          onClick={() => removeLink(index)}
                          className="p-1 text-red-500 hover:text-red-700"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Completion Notes */}
              <div className="mt-4 sm:mt-6">
                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
                  Completion Notes
                </label>
                <textarea
                  value={completionNotes}
                  onChange={(e) => setCompletionNotes(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  placeholder="Any additional notes, observations, or context..."
                />
              </div>
            </div>

            {/* Section 2: Deviation from Plan */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 sm:gap-0 mb-3 sm:mb-4">
                <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">
                  ⚠️ Deviation from Plan
                </h2>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasDeviation}
                    onChange={(e) => setHasDeviation(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded touch-manipulation"
                  />
                  <span className="text-xs sm:text-sm text-gray-700 dark:text-gray-300">
                    There were deviations
                  </span>
                </label>
              </div>

              {hasDeviation ? (
                <div className="space-y-3 sm:space-y-4">
                  <div>
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-1.5 sm:mb-2">
                      <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">
                        Describe the Deviation <span className="text-red-500">*</span>
                      </label>
                      <button
                        onClick={validateDeviation}
                        disabled={validatingDeviation || !deviationDescription.trim()}
                        className="text-xs sm:text-sm px-2.5 sm:px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 flex items-center gap-1 touch-manipulation self-start sm:self-auto"
                      >
                        {validatingDeviation ? '...' : '🔍 AI Validate'}
                      </button>
                    </div>
                    <textarea
                      value={deviationDescription}
                      onChange={(e) => {
                        setDeviationDescription(e.target.value);
                        setDeviationValidation(null);
                      }}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                      placeholder="Describe what was different from the original implementation plan, why the deviation occurred, and what was done instead..."
                    />
                  </div>

                  {/* Deviation Validation Results */}
                  {deviationValidation && (
                    <div className={`p-3 sm:p-4 rounded-lg border ${
                      deviationValidation.riskLevel === 'LOW' 
                        ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                        : deviationValidation.riskLevel === 'MEDIUM'
                        ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
                        : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                    }`}>
                      <div className="flex flex-wrap items-center gap-2 mb-2 sm:mb-3">
                        <span className={`px-1.5 sm:px-2 py-0.5 sm:py-1 text-[10px] sm:text-xs font-bold rounded ${
                          deviationValidation.riskLevel === 'LOW' 
                            ? 'bg-green-200 text-green-800'
                            : deviationValidation.riskLevel === 'MEDIUM'
                            ? 'bg-yellow-200 text-yellow-800'
                            : 'bg-red-200 text-red-800'
                        }`}>
                          {deviationValidation.riskLevel} RISK
                        </span>
                        <span className="text-xs sm:text-sm text-gray-700 dark:text-gray-300">
                          AI Analysis
                        </span>
                      </div>

                      <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 mb-2 sm:mb-3">
                        {deviationValidation.summary}
                      </p>

                      {deviationValidation.gaps.length > 0 && (
                        <div className="mb-2 sm:mb-3">
                          <p className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Gaps Identified:</p>
                          <ul className="list-disc list-inside text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                            {deviationValidation.gaps.map((gap, i) => (
                              <li key={i}>{gap}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {deviationValidation.risks.length > 0 && (
                        <div className="mb-2 sm:mb-3">
                          <p className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Risks:</p>
                          <ul className="list-disc list-inside text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                            {deviationValidation.risks.map((risk, i) => (
                              <li key={i}>{risk}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {deviationValidation.recommendations.length > 0 && (
                        <div>
                          <p className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Recommendations:</p>
                          <ul className="list-disc list-inside text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                            {deviationValidation.recommendations.map((rec, i) => (
                              <li key={i}>{rec}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-gray-500 dark:text-gray-400 text-xs sm:text-sm">
                  Check the box above if the implementation deviated from the original plan.
                </p>
              )}
            </div>

            {/* Section 3: Lessons Learned */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 sm:gap-0 mb-3 sm:mb-4">
                <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">
                  💡 Lessons Learned
                </h2>
                <div className="flex flex-wrap gap-2">
                  {!isEditingLessons ? (
                    <>
                      <button
                        onClick={handleGenerateLessons}
                        disabled={generatingLessons}
                        className="text-xs sm:text-sm px-2.5 sm:px-3 py-1.5 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 sm:gap-1.5 justify-center transition-all touch-manipulation"
                      >
                        {generatingLessons ? (
                          <>
                            <svg className="w-3 h-3 sm:w-4 sm:h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            <span className="hidden sm:inline">Generating...</span>
                            <span className="sm:hidden">...</span>
                          </>
                        ) : (
                          <>✨ Generate<span className="hidden sm:inline"> with AI</span></>
                        )}
                      </button>
                      <button
                        onClick={validateLessons}
                        disabled={validatingLessons || !lessonsLearned.trim()}
                        className="text-xs sm:text-sm px-2.5 sm:px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 sm:gap-1.5 justify-center transition-all touch-manipulation"
                      >
                        {validatingLessons ? (
                          <>
                            <svg className="w-3 h-3 sm:w-4 sm:h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            <span className="hidden sm:inline">Validating...</span>
                            <span className="sm:hidden">...</span>
                          </>
                        ) : (
                          <>🔍 AI <span className="hidden xs:inline">Validate</span></>
                        )}
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={cancelLessonsEdit}
                        className="text-xs sm:text-sm px-2.5 sm:px-3 py-1 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-1 touch-manipulation"
                      >
                        ✕ Cancel
                      </button>
                      <button
                        onClick={saveLessonsEdit}
                        className="text-xs sm:text-sm px-2.5 sm:px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 flex items-center gap-1 touch-manipulation"
                      >
                        ✓ Save
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Document Lessons Learned
                    </label>
                    {!isEditingLessons && lessonsLearned.trim() && (
                      <button
                        onClick={startEditingLessons}
                        className="text-sm px-2 py-1 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Edit
                      </button>
                    )}
                  </div>
                  
                  {isEditingLessons ? (
                    // Edit Mode: TipTap Rich Text Editor
                    <RichTextEditor
                      content={lessonsLearnedJson || lessonsLearned}
                      onChange={handleLessonsEditorChange}
                      placeholder="What insights were gained from this incident and the corrective/preventive action? What would you do differently? What best practices emerged?"
                      onAIAssist={improveWriting}
                      onAIValidate={validateLessons}
                      isAILoading={improvingWriting}
                      isValidating={validatingLessons}
                    />
                  ) : lessonsLearned.trim() ? (
                    // Read-only Mode: Formatted Display
                    <div 
                      className="min-h-[120px] p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600 cursor-pointer hover:border-blue-300 dark:hover:border-blue-600 transition-colors"
                      onClick={startEditingLessons}
                    >
                      <RichTextEditor
                        content={lessonsLearnedJson || lessonsLearned}
                        readOnly={true}
                      />
                    </div>
                  ) : (
                    // Empty State: Show textarea-like prompt to start editing
                    <div 
                      className="min-h-[120px] p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 cursor-pointer hover:border-blue-400 dark:hover:border-blue-500 transition-colors flex flex-col items-center justify-center"
                      onClick={startEditingLessons}
                    >
                      <svg className="w-8 h-8 text-gray-400 dark:text-gray-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      <p className="text-gray-500 dark:text-gray-400 text-sm text-center">
                        Click to add lessons learned
                      </p>
                      <p className="text-gray-400 dark:text-gray-500 text-xs text-center mt-1">
                        Use rich text formatting, AI assistance, and more
                      </p>
                    </div>
                  )}
                  
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    Capture valuable insights that can improve future incident response and prevention.
                  </p>
                </div>

                {/* Lessons Validation Results */}
                {lessonsValidation && (
                  <div className={`p-4 rounded-lg border ${
                    lessonsValidation.isValid 
                      ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                      : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
                  }`}>
                    <div className="flex items-center gap-4 mb-3">
                      <span className={`px-2 py-1 text-xs font-bold rounded ${
                        lessonsValidation.isValid 
                          ? 'bg-green-200 text-green-800'
                          : 'bg-yellow-200 text-yellow-800'
                      }`}>
                        {lessonsValidation.isValid ? '✓ VALIDATED' : '⚠ NEEDS IMPROVEMENT'}
                      </span>
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        Clarity: <strong>{lessonsValidation.clarity}%</strong>
                      </span>
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        Applicability: <strong>{lessonsValidation.applicability}%</strong>
                      </span>
                    </div>

                    <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
                      {lessonsValidation.summary}
                    </p>

                    {lessonsValidation.enhancements.length > 0 && (
                      <div className="mb-3">
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Suggested Enhancements:</p>
                        <ul className="list-disc list-inside text-sm text-gray-600 dark:text-gray-400">
                          {lessonsValidation.enhancements.map((e, i) => (
                            <li key={i}>{e}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {lessonsValidation.relatedCategories.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-3">
                        <span className="text-xs text-gray-500">Applicable to:</span>
                        {lessonsValidation.relatedCategories.map((cat, i) => (
                          <span key={i} className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 rounded">
                            {cat}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Knowledge Base Tip */}
                <div className="p-2.5 sm:p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <p className="text-xs sm:text-sm text-blue-800 dark:text-blue-300">
                    <strong>💡 Tip:</strong> Well-documented lessons learned will be added to the Knowledge Base and can help prevent similar incidents in the future.
                  </p>
                </div>
              </div>
            </div>

            {/* Completion Summary */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 sm:p-6">
              <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white mb-3 sm:mb-4">
                📊 Completion Summary
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
                <div className="text-center p-2 sm:p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <p className="text-xl sm:text-2xl font-bold text-green-600">{evidenceFiles.length}</p>
                  <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">Files Attached</p>
                </div>
                <div className="text-center p-2 sm:p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <p className="text-xl sm:text-2xl font-bold text-blue-600">{externalLinks.length}</p>
                  <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">External Links</p>
                </div>
                <div className="text-center p-2 sm:p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <p className="text-xl sm:text-2xl font-bold text-amber-600">{hasDeviation ? 'Yes' : 'No'}</p>
                  <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">Deviation</p>
                </div>
                <div className="text-center p-2 sm:p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <p className="text-xl sm:text-2xl font-bold text-purple-600">{lessonsLearned.trim() ? '✓' : '—'}</p>
                  <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">Lessons Learned</p>
                </div>
              </div>

              {/* Readiness Check */}
              <div className="mt-3 sm:mt-4 p-3 sm:p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <h3 className="text-sm sm:text-base font-medium text-gray-900 dark:text-white mb-2">Completion Checklist:</h3>
                <div className="space-y-1.5 sm:space-y-2">
                  <div className="flex items-center gap-2 text-xs sm:text-sm">
                    <span className={completionEvidence.trim() ? 'text-green-500' : 'text-gray-400'}>
                      {completionEvidence.trim() ? '✓' : '○'}
                    </span>
                    <span className={completionEvidence.trim() ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}>
                      Completion evidence documented
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs sm:text-sm">
                    <span className={evidenceFiles.length > 0 || externalLinks.length > 0 ? 'text-green-500' : 'text-gray-400'}>
                      {evidenceFiles.length > 0 || externalLinks.length > 0 ? '✓' : '○'}
                    </span>
                    <span className={evidenceFiles.length > 0 || externalLinks.length > 0 ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}>
                      Supporting files/links <span className="hidden sm:inline">attached </span>(recommended)
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs sm:text-sm">
                    <span className={!hasDeviation || deviationDescription.trim() ? 'text-green-500' : 'text-gray-400'}>
                      {!hasDeviation || deviationDescription.trim() ? '✓' : '○'}
                    </span>
                    <span className={!hasDeviation || deviationDescription.trim() ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}>
                      Deviation documented <span className="hidden sm:inline">(if applicable)</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs sm:text-sm">
                    <span className={lessonsLearned.trim() ? 'text-green-500' : 'text-gray-400'}>
                      {lessonsLearned.trim() ? '✓' : '○'}
                    </span>
                    <span className={lessonsLearned.trim() ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}>
                      Lessons learned <span className="hidden sm:inline">captured </span>(recommended)
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Implementation Plan Modal */}
      {showPlanModal && action?.implementationPlan && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-end sm:items-center justify-center min-h-screen px-0 sm:px-4 pt-4 pb-0 sm:pb-20 text-center">
            {/* Backdrop */}
            <div 
              className="fixed inset-0 bg-black/60 transition-opacity"
              onClick={() => setShowPlanModal(false)}
            />

            {/* Modal Panel */}
            <div className="relative inline-block w-full sm:max-w-4xl text-left align-middle transition-all transform bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-xl shadow-2xl sm:my-8 max-h-[90vh] sm:max-h-none flex flex-col">
              {/* Modal Header */}
              <div className="flex items-start sm:items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 dark:border-gray-700">
                <div className="pr-4">
                  <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    📋 Implementation Plan
                  </h2>
                  <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                    {action.title}
                  </p>
                </div>
                <button
                  onClick={() => setShowPlanModal(false)}
                  className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 touch-manipulation flex-shrink-0"
                >
                  <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Modal Body */}
              <div className="px-4 sm:px-6 py-4 sm:py-6 overflow-y-auto flex-1" style={{ maxHeight: 'calc(90vh - 140px)' }}>
                <div className="space-y-4 sm:space-y-6 text-sm sm:text-base">
                  {formatImplementationPlan(action.implementationPlan)}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex justify-end px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 rounded-b-xl">
                <button
                  onClick={() => setShowPlanModal(false)}
                  className="px-5 sm:px-6 py-2 bg-gray-600 text-white text-sm sm:text-base rounded-lg hover:bg-gray-700 transition-colors touch-manipulation"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Override Confirmation Modal */}
      {showOverrideConfirm && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
            {/* Backdrop */}
            <div 
              className="fixed inset-0 bg-black/60 transition-opacity"
              onClick={() => setShowOverrideConfirm(false)}
            />

            {/* Modal Panel */}
            <div className="relative inline-block w-full max-w-md my-8 text-left align-middle transition-all transform bg-white dark:bg-gray-800 rounded-xl shadow-2xl">
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0 w-10 h-10 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                      Override Existing Content?
                    </h3>
                  </div>
                </div>
              </div>

              {/* Modal Body */}
              <div className="px-6 py-4">
                <p className="text-gray-600 dark:text-gray-300">
                  There is already content in the Lessons Learned section. Generating new content with AI will <strong className="text-red-600 dark:text-red-400">replace</strong> the existing text.
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-3">
                  Are you sure you want to continue?
                </p>
              </div>

              {/* Modal Footer */}
              <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 rounded-b-xl">
                <button
                  onClick={() => setShowOverrideConfirm(false)}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={generateLessonsLearned}
                  className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Continue & Override
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper function to format implementation plan text
function formatImplementationPlan(text: string): React.ReactNode[] {
  if (!text) return [];

  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let currentList: { type: 'ul' | 'ol'; items: React.ReactNode[] } | null = null;
  let keyIndex = 0;

  const parseInlineFormatting = (line: string): React.ReactNode => {
    // Remove ** and replace with bold styling
    const parts: React.ReactNode[] = [];
    let remaining = line;
    let partKey = 0;

    while (remaining.length > 0) {
      const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
      if (boldMatch && boldMatch.index !== undefined) {
        // Add text before bold
        if (boldMatch.index > 0) {
          parts.push(<span key={partKey++}>{remaining.substring(0, boldMatch.index)}</span>);
        }
        // Add bold text
        parts.push(<strong key={partKey++} className="font-semibold text-gray-900 dark:text-white">{boldMatch[1]}</strong>);
        remaining = remaining.substring(boldMatch.index + boldMatch[0].length);
      } else {
        parts.push(<span key={partKey++}>{remaining}</span>);
        break;
      }
    }

    return parts.length > 0 ? parts : line;
  };

  const flushList = () => {
    if (currentList) {
      if (currentList.type === 'ol') {
        elements.push(
          <ol key={keyIndex++} className="list-decimal list-outside ml-4 sm:ml-6 space-y-2 sm:space-y-3 text-gray-700 dark:text-gray-300">
            {currentList.items}
          </ol>
        );
      } else {
        elements.push(
          <ul key={keyIndex++} className="list-disc list-outside ml-4 sm:ml-6 space-y-1.5 sm:space-y-2 text-gray-700 dark:text-gray-300">
            {currentList.items}
          </ul>
        );
      }
      currentList = null;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (!line) {
      flushList();
      continue;
    }

    // Main title (starts with ** and ends with **)
    if (line.startsWith('**') && line.endsWith('**') && !line.includes(':')) {
      flushList();
      const titleText = line.replace(/\*\*/g, '');
      elements.push(
        <h2 key={keyIndex++} className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2 sm:pb-3">
          {titleText}
        </h2>
      );
      continue;
    }

    // Section heading (like **Preparation Phase:**)
    if (line.startsWith('**') && line.includes(':**')) {
      flushList();
      const headingText = line.replace(/\*\*/g, '').replace(/:$/, '');
      elements.push(
        <h3 key={keyIndex++} className="text-base sm:text-lg font-semibold text-blue-600 dark:text-blue-400 mt-4 sm:mt-6 mb-2 sm:mb-3 flex items-center gap-2">
          <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-blue-600 dark:bg-blue-400 rounded-full"></span>
          {headingText}
        </h3>
      );
      continue;
    }

    // Numbered list item (1. **Title:** Description)
    const numberedMatch = line.match(/^(\d+)\.\s*(.+)$/);
    if (numberedMatch) {
      if (!currentList || currentList.type !== 'ol') {
        flushList();
        currentList = { type: 'ol', items: [] };
      }
      
      const content = numberedMatch[2];
      // Check if it has a bold title followed by description
      const titleMatch = content.match(/^\*\*(.+?)\*\*\s*(.*)$/);
      
      if (titleMatch) {
        currentList.items.push(
          <li key={keyIndex++} className="text-sm sm:text-base leading-relaxed pl-1 sm:pl-2">
            <span className="font-semibold text-gray-900 dark:text-white">{titleMatch[1]}</span>
            {titleMatch[2] && <span className="text-gray-700 dark:text-gray-300"> {titleMatch[2]}</span>}
          </li>
        );
      } else {
        currentList.items.push(
          <li key={keyIndex++} className="text-sm sm:text-base leading-relaxed pl-1 sm:pl-2">
            {parseInlineFormatting(content)}
          </li>
        );
      }
      continue;
    }

    // Sub-item with dash (- **Label:** Value)
    const subItemMatch = line.match(/^-\s*(.+)$/);
    if (subItemMatch) {
      if (!currentList) {
        currentList = { type: 'ul', items: [] };
      }
      
      const content = subItemMatch[1];
      // Check for **Label:** Value pattern
      const labelMatch = content.match(/^\*\*(.+?)\*\*\s*(.*)$/);
      
      if (labelMatch) {
        currentList.items.push(
          <li key={keyIndex++} className="text-xs sm:text-sm leading-relaxed ml-2 sm:ml-4 text-gray-600 dark:text-gray-400">
            <span className="font-medium text-gray-700 dark:text-gray-300">{labelMatch[1]}</span>
            {labelMatch[2] && <span> {labelMatch[2]}</span>}
          </li>
        );
      } else {
        currentList.items.push(
          <li key={keyIndex++} className="text-xs sm:text-sm leading-relaxed ml-2 sm:ml-4 text-gray-600 dark:text-gray-400">
            {parseInlineFormatting(content)}
          </li>
        );
      }
      continue;
    }

    // Regular paragraph
    flushList();
    elements.push(
      <p key={keyIndex++} className="text-sm sm:text-base text-gray-700 dark:text-gray-300 leading-relaxed">
        {parseInlineFormatting(line)}
      </p>
    );
  }

  flushList();
  return elements;
}

// Compact version for sidebar preview
function formatImplementationPlanCompact(text: string): React.ReactNode[] {
  if (!text) return [];

  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let currentList: { type: 'ul' | 'ol'; items: React.ReactNode[] } | null = null;
  let keyIndex = 0;

  const parseInlineFormatting = (line: string): React.ReactNode => {
    const parts: React.ReactNode[] = [];
    let remaining = line;
    let partKey = 0;

    while (remaining.length > 0) {
      const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
      if (boldMatch && boldMatch.index !== undefined) {
        if (boldMatch.index > 0) {
          parts.push(<span key={partKey++}>{remaining.substring(0, boldMatch.index)}</span>);
        }
        parts.push(<strong key={partKey++} className="font-semibold text-gray-900 dark:text-gray-100">{boldMatch[1]}</strong>);
        remaining = remaining.substring(boldMatch.index + boldMatch[0].length);
      } else {
        parts.push(<span key={partKey++}>{remaining}</span>);
        break;
      }
    }

    return parts.length > 0 ? parts : line;
  };

  const flushList = () => {
    if (currentList) {
      if (currentList.type === 'ol') {
        elements.push(
          <ol key={keyIndex++} className="list-decimal list-outside ml-4 space-y-1 text-gray-700 dark:text-gray-200 text-xs">
            {currentList.items}
          </ol>
        );
      } else {
        elements.push(
          <ul key={keyIndex++} className="list-disc list-outside ml-4 space-y-1 text-gray-700 dark:text-gray-200 text-xs">
            {currentList.items}
          </ul>
        );
      }
      currentList = null;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (!line) {
      flushList();
      continue;
    }

    // Main title
    if (line.startsWith('**') && line.endsWith('**') && !line.includes(':')) {
      flushList();
      const titleText = line.replace(/\*\*/g, '');
      elements.push(
        <h4 key={keyIndex++} className="text-sm font-bold text-gray-900 dark:text-gray-100 pb-1 border-b border-gray-300 dark:border-gray-500">
          {titleText}
        </h4>
      );
      continue;
    }

    // Section heading
    if (line.startsWith('**') && line.includes(':**')) {
      flushList();
      const headingText = line.replace(/\*\*/g, '').replace(/:$/, '');
      elements.push(
        <h5 key={keyIndex++} className="text-xs font-semibold text-blue-700 dark:text-blue-300 mt-2 mb-1">
          {headingText}
        </h5>
      );
      continue;
    }

    // Numbered list item
    const numberedMatch = line.match(/^(\d+)\.\s*(.+)$/);
    if (numberedMatch) {
      if (!currentList || currentList.type !== 'ol') {
        flushList();
        currentList = { type: 'ol', items: [] };
      }
      
      const content = numberedMatch[2];
      const titleMatch = content.match(/^\*\*(.+?)\*\*\s*(.*)$/);
      
      if (titleMatch) {
        currentList.items.push(
          <li key={keyIndex++} className="text-xs leading-relaxed">
            <span className="font-semibold text-gray-900 dark:text-gray-100">{titleMatch[1]}</span>
            {titleMatch[2] && <span className="text-gray-700 dark:text-gray-300"> {titleMatch[2]}</span>}
          </li>
        );
      } else {
        currentList.items.push(
          <li key={keyIndex++} className="text-xs leading-relaxed text-gray-700 dark:text-gray-300">
            {parseInlineFormatting(content)}
          </li>
        );
      }
      continue;
    }

    // Sub-item with dash
    const subItemMatch = line.match(/^-\s*(.+)$/);
    if (subItemMatch) {
      if (!currentList) {
        currentList = { type: 'ul', items: [] };
      }
      
      const content = subItemMatch[1];
      const labelMatch = content.match(/^\*\*(.+?)\*\*\s*(.*)$/);
      
      if (labelMatch) {
        currentList.items.push(
          <li key={keyIndex++} className="text-xs leading-relaxed ml-2 text-gray-600 dark:text-gray-400">
            <span className="font-medium text-gray-700 dark:text-gray-200">{labelMatch[1]}</span>
            {labelMatch[2] && <span> {labelMatch[2]}</span>}
          </li>
        );
      } else {
        currentList.items.push(
          <li key={keyIndex++} className="text-xs leading-relaxed ml-2 text-gray-600 dark:text-gray-400">
            {parseInlineFormatting(content)}
          </li>
        );
      }
      continue;
    }

    // Regular paragraph
    flushList();
    elements.push(
      <p key={keyIndex++} className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
        {parseInlineFormatting(line)}
      </p>
    );
  }

  flushList();
  return elements;
}

export default function CompleteActionPage() {
  return (
    <ProtectedRoute requireAuth={true}>
      <CompleteActionContent />
    </ProtectedRoute>
  );
}
