'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/components/providers/AuthProvider';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import api from '@/lib/api';

// Types for structured implementation steps
interface ImplementationStep {
  id: string;
  stepNumber: number;
  actionDescription: string;
  estimatedTime: string;
  responsibleParty: string;
  dueDate: string;
  ownership: string;
  verificationMethod: string;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'BLOCKED';
  notes: string;
  isValidated: boolean;
  validationFeedback?: {
    isValid: boolean;
    clarity: number;
    feasibility: number;
    alignment: number;
    suggestions: string[];
  };
}

interface CAPAction {
  id: string;
  title: string;
  description: string;
  actionType: 'CORRECTIVE' | 'PREVENTIVE';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: string;
  dueDate: string;
  owner: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  rcaAnalysis: {
    id: string;
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
    rootCauseStatement?: string;
  };
}

interface TeamMember {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
}

interface ResponsiblePartyOption {
  id: string;
  value: string;
  label: string;
  isDefault: boolean;
}

function StartActionContent() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const actionId = params.id as string;

  // State
  const [action, setAction] = useState<CAPAction | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [responsiblePartyOptions, setResponsiblePartyOptions] = useState<ResponsiblePartyOption[]>([]);

  // Implementation plan state
  const [implementationSteps, setImplementationSteps] = useState<ImplementationStep[]>([]);
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [targetDueDate, setTargetDueDate] = useState('');

  // AI states
  const [generatingAI, setGeneratingAI] = useState(false);
  const [validatingStep, setValidatingStep] = useState<string | null>(null);

  // Root Cause Modal state
  const [showRootCauseModal, setShowRootCauseModal] = useState(false);

  // Helper function to parse and format root cause statement
  const formatRootCauseStatement = (statement: string) => {
    // Split by numbered items like "1." "2." etc.
    const parts = statement.split(/(?=\d+\.\s*\[)/);
    return parts.filter(part => part.trim()).map(part => part.trim());
  };

  // Load action data
  useEffect(() => {
    loadActionData();
    loadTeamMembers();
    loadResponsiblePartyOptions();
  }, [actionId]);

  const loadActionData = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/capa/${actionId}`);
      const actionData = response.data.data;
      
      // Transform backend response to match frontend types
      const transformedAction = {
        ...actionData,
        owner: actionData.User || actionData.owner || { firstName: 'Unknown', lastName: '', email: '' },
        rcaAnalysis: actionData.RCAAnalysis ? {
          id: actionData.RCAAnalysis.id,
          incident: actionData.RCAAnalysis.Incident ? {
            id: actionData.RCAAnalysis.Incident.id,
            customTitle: actionData.RCAAnalysis.Incident.customTitle,
            description: actionData.RCAAnalysis.Incident.description || '',
            type: actionData.RCAAnalysis.Incident.type,
            severity: actionData.RCAAnalysis.Incident.severity,
            category: actionData.RCAAnalysis.Incident.Category,
            facility: actionData.RCAAnalysis.Incident.Facility,
            line: actionData.RCAAnalysis.Incident.Line,
          } : null,
          rootCauseStatement: actionData.RCAAnalysis.rootCauseStatement,
        } : actionData.rcaAnalysis,
      };
      
      setAction(transformedAction);
      
      // Set default due date
      if (actionData.dueDate) {
        setTargetDueDate(new Date(actionData.dueDate).toISOString().split('T')[0]);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load action');
    } finally {
      setLoading(false);
    }
  };

  const loadTeamMembers = async () => {
    try {
      const response = await api.get('/users');
      const data = response.data?.data;
      setTeamMembers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load team members:', err);
      setTeamMembers([]);
    }
  };

  const loadResponsiblePartyOptions = async () => {
    try {
      const response = await api.get('/dropdown-options?optionType=RESPONSIBLE_PARTY');
      const data = response.data?.data;
      if (Array.isArray(data)) {
        setResponsiblePartyOptions(data);
      }
    } catch (err) {
      console.error('Failed to load responsible party options:', err);
      setResponsiblePartyOptions([]);
    }
  };

  // Generate unique ID for steps
  const generateStepId = () => `step-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Add new empty step
  const addStep = () => {
    const newStep: ImplementationStep = {
      id: generateStepId(),
      stepNumber: implementationSteps.length + 1,
      actionDescription: '',
      estimatedTime: '',
      responsibleParty: '',
      dueDate: '',
      ownership: '',
      verificationMethod: '',
      status: 'NOT_STARTED',
      notes: '',
      isValidated: false,
    };
    setImplementationSteps([...implementationSteps, newStep]);
  };

  // Remove step
  const removeStep = (stepId: string) => {
    const updated = implementationSteps
      .filter(s => s.id !== stepId)
      .map((s, idx) => ({ ...s, stepNumber: idx + 1 }));
    setImplementationSteps(updated);
  };

  // Update step field
  const updateStep = (stepId: string, field: keyof ImplementationStep, value: any) => {
    setImplementationSteps(prev =>
      prev.map(s => s.id === stepId ? { ...s, [field]: value, isValidated: false } : s)
    );
  };

  // Move step up/down
  const moveStep = (stepId: string, direction: 'up' | 'down') => {
    const idx = implementationSteps.findIndex(s => s.id === stepId);
    if ((direction === 'up' && idx === 0) || (direction === 'down' && idx === implementationSteps.length - 1)) {
      return;
    }
    const newIdx = direction === 'up' ? idx - 1 : idx + 1;
    const updated = [...implementationSteps];
    [updated[idx], updated[newIdx]] = [updated[newIdx], updated[idx]];
    setImplementationSteps(updated.map((s, i) => ({ ...s, stepNumber: i + 1 })));
  };

  // AI: Generate full implementation plan
  const generateAIPlan = async () => {
    if (!action) return;
    
    setGeneratingAI(true);
    setError('');
    
    try {
      const response = await api.post(`/capa/${actionId}/generate-structured-plan`, {
        actionTitle: action.title,
        actionDescription: action.description,
        actionType: action.actionType,
        priority: action.priority,
        dueDate: action.dueDate,
        incidentDescription: action.rcaAnalysis.incident.description,
        rootCause: action.rcaAnalysis.rootCauseStatement,
        category: action.rcaAnalysis.incident.category?.name,
        facility: action.rcaAnalysis.incident.facility?.name,
      });

      if (response.data.success && response.data.data.steps) {
        const aiSteps: ImplementationStep[] = response.data.data.steps.map((step: any, idx: number) => ({
          id: generateStepId(),
          stepNumber: idx + 1,
          actionDescription: step.actionDescription || '',
          estimatedTime: step.estimatedTime || '',
          responsibleParty: step.responsibleParty || '',
          dueDate: step.dueDate || '',
          ownership: step.ownership || '',
          verificationMethod: step.verificationMethod || '',
          status: 'NOT_STARTED',
          notes: step.notes || '',
          isValidated: false,
        }));
        setImplementationSteps(aiSteps);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to generate AI plan');
    } finally {
      setGeneratingAI(false);
    }
  };

  // AI: Validate single step
  const validateStep = async (stepId: string) => {
    const step = implementationSteps.find(s => s.id === stepId);
    if (!step || !step.actionDescription.trim()) {
      setError('Please enter an action description before validating');
      return;
    }

    setValidatingStep(stepId);
    
    try {
      const response = await api.post(`/capa/${actionId}/validate-step`, {
        stepDescription: step.actionDescription,
        estimatedTime: step.estimatedTime,
        verificationMethod: step.verificationMethod,
        rootCause: action?.rcaAnalysis.rootCauseStatement,
        actionTitle: action?.title,
        actionType: action?.actionType,
      });

      if (response.data.success) {
        const validation = response.data.data;
        setImplementationSteps(prev =>
          prev.map(s => s.id === stepId ? {
            ...s,
            isValidated: true,
            validationFeedback: {
              isValid: validation.isValid,
              clarity: validation.clarity,
              feasibility: validation.feasibility,
              alignment: validation.alignment,
              suggestions: validation.suggestions || [],
            }
          } : s)
        );
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Validation failed');
    } finally {
      setValidatingStep(null);
    }
  };

  // AI: Suggest description for step
  const suggestStepDescription = async (stepId: string) => {
    const step = implementationSteps.find(s => s.id === stepId);
    if (!step) return;

    setValidatingStep(stepId);
    
    try {
      const response = await api.post(`/capa/${actionId}/suggest-step`, {
        stepNumber: step.stepNumber,
        existingSteps: implementationSteps.map(s => s.actionDescription).filter(Boolean),
        actionTitle: action?.title,
        actionDescription: action?.description,
        actionType: action?.actionType,
        rootCause: action?.rcaAnalysis.rootCauseStatement,
      });

      if (response.data.success && response.data.data.suggestion) {
        updateStep(stepId, 'actionDescription', response.data.data.suggestion);
        if (response.data.data.estimatedTime) {
          updateStep(stepId, 'estimatedTime', response.data.data.estimatedTime);
        }
        if (response.data.data.verificationMethod) {
          updateStep(stepId, 'verificationMethod', response.data.data.verificationMethod);
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to get AI suggestion');
    } finally {
      setValidatingStep(null);
    }
  };

  // Submit implementation plan
  const handleSubmit = async () => {
    if (implementationSteps.length === 0) {
      setError('Please add at least one implementation step');
      return;
    }

    const emptySteps = implementationSteps.filter(s => !s.actionDescription.trim());
    if (emptySteps.length > 0) {
      setError('All steps must have an action description');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      // Convert structured steps to implementation plan text for backward compatibility
      const planText = implementationSteps.map(step => 
        `**Step ${step.stepNumber}: ${step.actionDescription}**\n` +
        `- Estimated Time: ${step.estimatedTime || 'TBD'}\n` +
        `- Responsible: ${step.responsibleParty || 'TBD'}\n` +
        `- Due Date: ${step.dueDate || 'TBD'}\n` +
        `- Ownership: ${step.ownership || 'TBD'}\n` +
        `- Verification: ${step.verificationMethod || 'TBD'}\n` +
        (step.notes ? `- Notes: ${step.notes}\n` : '')
      ).join('\n');

      await api.patch(`/capa/${actionId}/status`, {
        status: 'IN_PROGRESS',
        implementationPlan: planText,
        implementationSteps: implementationSteps, // Store structured data
        notes: additionalNotes,
        targetDueDate: targetDueDate || undefined,
      });

      router.push('/capa');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to start action');
    } finally {
      setSubmitting(false);
    }
  };

  // Status color mapping
  const statusColors: Record<string, string> = {
    NOT_STARTED: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
    IN_PROGRESS: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    COMPLETED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    BLOCKED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading action details...</p>
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
          <div className="flex justify-between h-14 sm:h-16">
            <div className="flex items-center space-x-2 sm:space-x-4 min-w-0 flex-1">
              <div className="relative w-7 h-7 sm:w-8 sm:h-8 flex-shrink-0">
                <Image src="/images/logo.png" alt="DASHMET Logo" fill className="object-contain" />
              </div>
              <Link 
                href="/capa" 
                className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white flex items-center gap-1 text-sm sm:text-base flex-shrink-0"
              >
                <span className="hidden xs:inline">←</span> <span className="hidden sm:inline">Back to CAPA Board</span><span className="sm:hidden">← Back</span>
              </Link>
              <div className="hidden sm:block h-6 w-px bg-gray-300 dark:bg-gray-600 flex-shrink-0"></div>
              <h1 className="hidden sm:block text-lg sm:text-xl font-bold text-gray-900 dark:text-white truncate">
                🚀 Start Action
              </h1>
            </div>
            <div className="flex items-center space-x-2 sm:space-x-4 flex-shrink-0">
              <button
                onClick={() => router.push('/capa')}
                className="px-2 sm:px-4 py-1.5 sm:py-2 text-sm text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting || implementationSteps.length === 0}
                className="px-3 sm:px-6 py-1.5 sm:py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 sm:gap-2"
              >
                {submitting ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    <span className="hidden sm:inline">Starting...</span>
                  </>
                ) : (
                  <>
                    🚀 <span className="hidden sm:inline">Start Action</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="w-full px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
        {error && (
          <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-sm sm:text-base">
            {error}
            <button onClick={() => setError('')} className="ml-2 sm:ml-4 text-sm underline">Dismiss</button>
          </div>
        )}

        {/* Mobile Page Title */}
        <div className="sm:hidden mb-4">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            🚀 Start Action
          </h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Left Column: Action Context - Collapsible on Mobile */}
          <div className="lg:col-span-1 order-2 lg:order-1">
            <details className="lg:open group" open>
              <summary className="lg:hidden flex items-center justify-between bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 cursor-pointer list-none">
                <span className="font-semibold text-gray-900 dark:text-white">📋 Action Details</span>
                <svg className="w-5 h-5 text-gray-500 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </summary>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 sm:p-6 lg:sticky lg:top-20 mt-2 lg:mt-0">
              {/* Action Summary */}
              <div className="mb-4 sm:mb-6">
                <h2 className="hidden lg:block text-lg font-bold text-gray-900 dark:text-white mb-3">
                  Action Details
                </h2>
                <div className="space-y-2 sm:space-y-3">
                  <div>
                    <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Title</p>
                    <p className="text-gray-900 dark:text-white font-medium text-sm sm:text-base">{action.title}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className={`px-2 py-1 text-xs font-medium rounded ${
                      action.actionType === 'CORRECTIVE'
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                        : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                    }`}>
                      {action.actionType}
                    </span>
                    <span className={`px-2 py-1 text-xs font-medium rounded ${
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
                    <p className="text-gray-700 dark:text-gray-300 text-xs sm:text-sm">{action.description}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:block sm:space-y-3">
                    <div>
                      <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Owner</p>
                      <p className="text-gray-900 dark:text-white text-sm">
                        {action.owner.firstName} {action.owner.lastName}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Due Date</p>
                      <p className="text-gray-900 dark:text-white text-sm">
                        {new Date(action.dueDate).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Root Cause Context */}
              {action.rcaAnalysis?.rootCauseStatement && (
                <div className="pt-3 sm:pt-4 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400">
                      Root Cause
                    </h3>
                    <button
                      onClick={() => setShowRootCauseModal(true)}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1 px-2 py-1 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20"
                    >
                      <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                      </svg>
                      View Full
                    </button>
                  </div>
                  <p className="text-gray-700 dark:text-gray-300 text-xs sm:text-sm bg-amber-50 dark:bg-amber-900/20 p-2 sm:p-3 rounded-lg border border-amber-200 dark:border-amber-800 line-clamp-3 sm:line-clamp-4">
                    {action.rcaAnalysis.rootCauseStatement}
                  </p>
                </div>
              )}

              {/* Incident Context */}
              <div className="pt-3 sm:pt-4 border-t border-gray-200 dark:border-gray-700 mt-3 sm:mt-4">
                <h3 className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                  Related Incident
                </h3>
                <div className="text-xs sm:text-sm space-y-1">
                  <p className="text-gray-900 dark:text-white font-medium">
                    {action.rcaAnalysis.incident.customTitle || action.rcaAnalysis.incident.category?.name}
                  </p>
                  <p className="text-gray-600 dark:text-gray-400">
                    {action.rcaAnalysis.incident.facility?.name}
                    {action.rcaAnalysis.incident.line?.name && ` • ${action.rcaAnalysis.incident.line.name}`}
                  </p>
                </div>
              </div>

              {/* Target Due Date */}
              <div className="pt-3 sm:pt-4 border-t border-gray-200 dark:border-gray-700 mt-3 sm:mt-4">
                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Target Completion Date
                </label>
                <input
                  type="date"
                  value={targetDueDate}
                  onChange={(e) => setTargetDueDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                />
              </div>
              </div>
            </details>
          </div>

          {/* Right Column: Implementation Steps */}
          <div className="lg:col-span-2 order-1 lg:order-2">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 sm:p-6">
              {/* Header with AI Generate */}
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-0 mb-4 sm:mb-6">
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">
                    📋 Implementation Plan
                  </h2>
                  <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Define the steps required to implement this action
                  </p>
                </div>
                <button
                  onClick={generateAIPlan}
                  disabled={generatingAI}
                  className="w-full sm:w-auto px-4 py-2.5 sm:py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 flex items-center justify-center gap-2 text-sm sm:text-base"
                >
                  {generatingAI ? (
                    <>
                      <span className="animate-spin">⏳</span>
                      Generating...
                    </>
                  ) : (
                    <>
                      ✨ Generate with AI
                    </>
                  )}
                </button>
              </div>

              {/* Implementation Steps */}
              <div className="space-y-4">
                {implementationSteps.length === 0 ? (
                  <div className="text-center py-8 sm:py-12 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
                    <p className="text-gray-500 dark:text-gray-400 mb-4 text-sm sm:text-base">
                      No implementation steps yet
                    </p>
                    <div className="flex flex-col sm:flex-row justify-center gap-3 px-4 sm:px-0">
                      <button
                        onClick={addStep}
                        className="w-full sm:w-auto px-4 py-2.5 sm:py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm sm:text-base"
                      >
                        + Add Step Manually
                      </button>
                      <button
                        onClick={generateAIPlan}
                        disabled={generatingAI}
                        className="w-full sm:w-auto px-4 py-2.5 sm:py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 text-sm sm:text-base"
                      >
                        ✨ Generate with AI
                      </button>
                    </div>
                  </div>
                ) : (
                  implementationSteps.map((step, index) => (
                    <div
                      key={step.id}
                      className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 sm:p-4 bg-gray-50 dark:bg-gray-900/50"
                    >
                      {/* Step Header */}
                      <div className="flex justify-between items-start mb-3 sm:mb-4">
                        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-primary-600 text-white flex items-center justify-center font-bold text-xs sm:text-sm flex-shrink-0">
                            {step.stepNumber}
                          </div>
                          <div className="min-w-0">
                            <span className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white">
                              Step {step.stepNumber}
                            </span>
                            {step.isValidated && step.validationFeedback && (
                              <span className={`ml-1 sm:ml-2 px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-xs rounded ${
                                step.validationFeedback.isValid
                                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                                  : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
                              }`}>
                                {step.validationFeedback.isValid ? '✓' : '⚠'}<span className="hidden sm:inline"> {step.validationFeedback.isValid ? 'Validated' : 'Needs Review'}</span>
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                          <button
                            onClick={() => moveStep(step.id, 'up')}
                            disabled={index === 0}
                            className="p-1.5 sm:p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 touch-manipulation"
                            title="Move up"
                          >
                            ↑
                          </button>
                          <button
                            onClick={() => moveStep(step.id, 'down')}
                            disabled={index === implementationSteps.length - 1}
                            className="p-1.5 sm:p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 touch-manipulation"
                            title="Move down"
                          >
                            ↓
                          </button>
                          <button
                            onClick={() => removeStep(step.id)}
                            className="p-1.5 sm:p-1 text-red-400 hover:text-red-600 touch-manipulation"
                            title="Remove step"
                          >
                            ✕
                          </button>
                        </div>
                      </div>

                      {/* Action Description */}
                      <div className="mb-3 sm:mb-4">
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 sm:gap-0 mb-2 sm:mb-1">
                          <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">
                            Action Description <span className="text-red-500">*</span>
                          </label>
                          <div className="flex gap-2">
                            <button
                              onClick={() => suggestStepDescription(step.id)}
                              disabled={validatingStep === step.id}
                              className="text-xs px-2 py-1.5 sm:py-1 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded touch-manipulation"
                            >
                              {validatingStep === step.id ? '...' : '✨ AI Suggest'}
                            </button>
                            <button
                              onClick={() => validateStep(step.id)}
                              disabled={validatingStep === step.id || !step.actionDescription.trim()}
                              className="text-xs px-2 py-1.5 sm:py-1 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded disabled:opacity-50 touch-manipulation"
                            >
                              {validatingStep === step.id ? '...' : '🔍 Validate'}
                            </button>
                          </div>
                        </div>
                        <textarea
                          value={step.actionDescription}
                          onChange={(e) => updateStep(step.id, 'actionDescription', e.target.value)}
                          rows={3}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                          placeholder="Describe what needs to be done..."
                        />
                        
                        {/* Validation Feedback */}
                        {step.isValidated && step.validationFeedback && (
                          <div className={`mt-2 p-2 sm:p-3 rounded-lg text-xs sm:text-sm ${
                            step.validationFeedback.isValid
                              ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                              : 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800'
                          }`}>
                            <div className="grid grid-cols-3 gap-2 sm:flex sm:gap-4 mb-2">
                              <span className="text-gray-600 dark:text-gray-400 text-center sm:text-left">
                                <span className="block sm:inline">Clarity</span> <strong className="text-gray-900 dark:text-white">{step.validationFeedback.clarity}%</strong>
                              </span>
                              <span className="text-gray-600 dark:text-gray-400 text-center sm:text-left">
                                <span className="block sm:inline">Feasibility</span> <strong className="text-gray-900 dark:text-white">{step.validationFeedback.feasibility}%</strong>
                              </span>
                              <span className="text-gray-600 dark:text-gray-400 text-center sm:text-left">
                                <span className="block sm:inline">Alignment</span> <strong className="text-gray-900 dark:text-white">{step.validationFeedback.alignment}%</strong>
                              </span>
                            </div>
                            {step.validationFeedback.suggestions.length > 0 && (
                              <div>
                                <p className="font-medium text-gray-700 dark:text-gray-300 mb-1 text-xs sm:text-sm">Suggestions:</p>
                                <ul className="list-disc list-inside text-gray-600 dark:text-gray-400 text-xs sm:text-sm space-y-1">
                                  {step.validationFeedback.suggestions.map((s, i) => (
                                    <li key={i}>{s}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Step Details Grid */}
                      <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
                        <div>
                          <label className="block text-[10px] sm:text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                            Estimated Time
                          </label>
                          <input
                            type="text"
                            value={step.estimatedTime}
                            onChange={(e) => updateStep(step.id, 'estimatedTime', e.target.value)}
                            className="w-full px-2 py-2 sm:py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                            placeholder="e.g., 2 hours"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] sm:text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                            Responsible Party
                          </label>
                          <select
                            value={step.responsibleParty}
                            onChange={(e) => updateStep(step.id, 'responsibleParty', e.target.value)}
                            className="w-full px-2 py-2 sm:py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                          >
                            <option value="">Select...</option>
                            {/* Team members from users */}
                            {Array.isArray(teamMembers) && teamMembers.length > 0 && (
                              <optgroup label="Team Members">
                                {teamMembers.map(member => (
                                  <option key={member.id} value={`${member.firstName} ${member.lastName}`}>
                                    {member.firstName} {member.lastName}
                                  </option>
                                ))}
                              </optgroup>
                            )}
                            {/* Responsible party options from admin settings */}
                            {responsiblePartyOptions.length > 0 && (
                              <optgroup label="Teams">
                                {responsiblePartyOptions.map(option => (
                                  <option key={option.id} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </optgroup>
                            )}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] sm:text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                            Due Date
                          </label>
                          <input
                            type="date"
                            value={step.dueDate}
                            onChange={(e) => updateStep(step.id, 'dueDate', e.target.value)}
                            className="w-full px-2 py-2 sm:py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] sm:text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                            Ownership
                          </label>
                          <input
                            type="text"
                            value={step.ownership}
                            onChange={(e) => updateStep(step.id, 'ownership', e.target.value)}
                            className="w-full px-2 py-2 sm:py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                            placeholder="Department/Role"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] sm:text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                            Verification Method
                          </label>
                          <input
                            type="text"
                            value={step.verificationMethod}
                            onChange={(e) => updateStep(step.id, 'verificationMethod', e.target.value)}
                            className="w-full px-2 py-2 sm:py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                            placeholder="How to verify completion"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] sm:text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                            Status
                          </label>
                          <select
                            value={step.status}
                            onChange={(e) => updateStep(step.id, 'status', e.target.value)}
                            className={`w-full px-2 py-2 sm:py-1.5 border rounded text-sm ${statusColors[step.status]}`}
                          >
                            <option value="NOT_STARTED">Not Started</option>
                            <option value="IN_PROGRESS">In Progress</option>
                            <option value="COMPLETED">Completed</option>
                            <option value="BLOCKED">Blocked</option>
                          </select>
                        </div>
                      </div>

                      {/* Notes */}
                      <div className="mt-3 sm:mt-4">
                        <label className="block text-[10px] sm:text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                          Additional Notes (Optional)
                        </label>
                        <input
                          type="text"
                          value={step.notes}
                          onChange={(e) => updateStep(step.id, 'notes', e.target.value)}
                          className="w-full px-2 py-2 sm:py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                          placeholder="Any dependencies, resources needed, etc."
                        />
                      </div>
                    </div>
                  ))
                )}

                {/* Add Step Button */}
                {implementationSteps.length > 0 && (
                  <button
                    onClick={addStep}
                    className="w-full py-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-500 dark:text-gray-400 hover:border-primary-500 hover:text-primary-600 dark:hover:text-primary-400 transition-colors text-sm sm:text-base touch-manipulation"
                  >
                    + Add Another Step
                  </button>
                )}
              </div>

              {/* Additional Notes */}
              <div className="mt-4 sm:mt-6 pt-4 sm:pt-6 border-t border-gray-200 dark:border-gray-700">
                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Overall Notes / Dependencies
                </label>
                <textarea
                  value={additionalNotes}
                  onChange={(e) => setAdditionalNotes(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  placeholder="Any overall notes, dependencies, or resources needed for this implementation..."
                />
              </div>

              {/* Summary */}
              {implementationSteps.length > 0 && (
                <div className="mt-4 sm:mt-6 p-3 sm:p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <h3 className="font-medium text-blue-800 dark:text-blue-300 mb-2 text-sm sm:text-base">
                    📊 Implementation Summary
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 text-xs sm:text-sm">
                    <div>
                      <p className="text-blue-600 dark:text-blue-400">Total Steps</p>
                      <p className="text-lg sm:text-xl font-bold text-blue-800 dark:text-blue-300">{implementationSteps.length}</p>
                    </div>
                    <div>
                      <p className="text-blue-600 dark:text-blue-400">Validated</p>
                      <p className="text-lg sm:text-xl font-bold text-blue-800 dark:text-blue-300">
                        {implementationSteps.filter(s => s.isValidated && s.validationFeedback?.isValid).length}
                      </p>
                    </div>
                    <div>
                      <p className="text-blue-600 dark:text-blue-400">With Due Dates</p>
                      <p className="text-lg sm:text-xl font-bold text-blue-800 dark:text-blue-300">
                        {implementationSteps.filter(s => s.dueDate).length}
                      </p>
                    </div>
                    <div>
                      <p className="text-blue-600 dark:text-blue-400">Assigned</p>
                      <p className="text-lg sm:text-xl font-bold text-blue-800 dark:text-blue-300">
                        {implementationSteps.filter(s => s.responsibleParty).length}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Root Cause Analysis Modal */}
      {showRootCauseModal && action?.rcaAnalysis?.rootCauseStatement && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] sm:max-h-[85vh] overflow-hidden">
            {/* Modal Header */}
            <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-amber-500 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">
                      Root Cause Analysis
                    </h2>
                    <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 hidden sm:block">
                      Confirmed root causes from 5 Whys analysis
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowRootCauseModal(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors touch-manipulation"
                >
                  <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 overflow-y-auto max-h-[calc(90vh-160px)] sm:max-h-[calc(85vh-180px)]">
              {/* Related Incident Info */}
              <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <h3 className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 mb-1 sm:mb-2">Related Incident</h3>
                <p className="text-gray-900 dark:text-white font-medium text-sm sm:text-base">
                  {action.rcaAnalysis.incident?.customTitle || 'Incident'}
                </p>
                {action.rcaAnalysis.incident?.facility?.name && (
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {action.rcaAnalysis.incident.facility.name}
                    {action.rcaAnalysis.incident.line?.name && ` • ${action.rcaAnalysis.incident.line.name}`}
                  </p>
                )}
              </div>

              {/* Formatted Root Causes */}
              <div className="space-y-3 sm:space-y-4">
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <span className="text-amber-500">🎯</span>
                  Confirmed Root Causes
                </h3>
                
                {formatRootCauseStatement(action.rcaAnalysis.rootCauseStatement).map((cause, index) => {
                  // Extract category from bracket notation like [Man (People)]
                  const categoryMatch = cause.match(/\[([^\]]+)\]/);
                  const category = categoryMatch ? categoryMatch[1] : null;
                  const causeText = cause.replace(/^\d+\.\s*/, '').trim();
                  
                  return (
                    <div 
                      key={index} 
                      className="p-3 sm:p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm"
                    >
                      <div className="flex items-start gap-2 sm:gap-3">
                        <span className="flex-shrink-0 w-6 h-6 sm:w-8 sm:h-8 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center text-amber-700 dark:text-amber-300 font-bold text-xs sm:text-sm">
                          {index + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          {category && (
                            <span className="inline-block px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-[10px] sm:text-xs font-medium rounded mb-1 sm:mb-2">
                              {category}
                            </span>
                          )}
                          <p className="text-gray-800 dark:text-gray-200 leading-relaxed text-sm sm:text-base">
                            {causeText}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Problem Statement */}
              {action.rcaAnalysis.rootCauseStatement.includes('Problem:') && (
                <div className="mt-4 sm:mt-6 p-3 sm:p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                  <h3 className="text-xs sm:text-sm font-medium text-red-700 dark:text-red-300 mb-1 sm:mb-2 flex items-center gap-2">
                    <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    Problem Statement
                  </h3>
                  <p className="text-red-800 dark:text-red-200 text-sm">
                    {action.rcaAnalysis.rootCauseStatement.split('Problem:')[1]?.trim() || ''}
                  </p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex justify-end">
              <button
                onClick={() => setShowRootCauseModal(false)}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm sm:text-base touch-manipulation"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function StartActionPage() {
  return (
    <ProtectedRoute requireAuth={true}>
      <StartActionContent />
    </ProtectedRoute>
  );
}
