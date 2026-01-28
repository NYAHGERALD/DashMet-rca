'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import { formatDate } from '@/lib/dateUtils';
import FiveWhysBuilder from '@/components/rca/FiveWhysBuilder';
import FishboneBuilder from '@/components/rca/FishboneBuilder';
import TimelinePanel from '@/components/rca/TimelinePanel';
import EvidencePanel from '@/components/rca/EvidencePanel';
import CommentPanel from '@/components/rca/CommentPanel';
import { ChatSidebar } from '@/components/team';
import { useAuth } from '@/components/providers/AuthProvider';
import { useWebSocket } from '@/lib/websocket';
import { usePrivileges, RCA_PRIVILEGES } from '@/lib/usePrivileges';
import { useAccessDeniedModal, handlePrivilegeError } from '@/components/modals/AccessDeniedModal';

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
  createdAt: string;
  updatedAt: string;
  incident: {
    id: string;
    incidentNumber: string;
    description: string;
    type: string;
    status: string;
    severity: string | null;
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

export default function RCAWorkspacePage() {
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
  const canEditRCA = hasPrivilege(RCA_PRIVILEGES.EDIT);
  const canUseAI = hasPrivilege(RCA_PRIVILEGES.AI_FIVE_WHYS) || hasPrivilege(RCA_PRIVILEGES.AI_FISHBONE);
  const { showAccessDenied, accessDeniedModal } = useAccessDeniedModal();

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
  const [showMethodSelector, setShowMethodSelector] = useState(false);
  const [generatingCAPA, setGeneratingCAPA] = useState(false);
  const [capaGenerated, setCapaGenerated] = useState(false);

  // Check if current user is the incident owner
  const isOwner = Boolean(user?.id && rca?.incident?.createdBy?.id === user.id);
  
  // Check if current user is the RCA analyst
  const isAnalyst = Boolean(user?.id && rca?.analyst?.id === user.id);
  
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

  const handleMethodChange = async (method: 'FIVE_WHYS' | 'FISHBONE') => {
    try {
      setSaving(true);
      await api.patch(`/rca/${rcaId}/method`, { method });
      await fetchRCA();
      setShowMethodSelector(false);
    } catch (err: any) {
      // Check if this is a privilege error (403)
      handlePrivilegeError(err, showAccessDenied, setError, 'Change Method');
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
      setSaving(true);
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
    if (!hasPrivilege('capa.create')) {
      showAccessDenied();
      return;
    }
    try {
      setGeneratingCAPA(true);
      const response = await api.post(`/capa/generate-from-rca/${rcaId}`);
      setCapaGenerated(true);
      // Show success toast instead of alert
      setError(''); // Clear any previous error
      // The CAPA generation was successful - user will be notified
      router.push('/capa');
    } catch (err: any) {
      // Check if this is a privilege error (403)
      handlePrivilegeError(err, showAccessDenied, setError, 'Generate CAPA');
    } finally {
      setGeneratingCAPA(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!rca) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">RCA Not Found</h2>
          <button
            onClick={() => router.push('/rca')}
            className="mt-4 text-blue-600 hover:text-blue-500"
          >
            Back to RCA List
          </button>
        </div>
      </div>
    );
  }

  // Safety check: ensure incident data exists
  if (!rca.incident) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Incident Data Not Available</h2>
          <p className="mt-2 text-gray-500 dark:text-gray-400">The incident associated with this RCA could not be loaded.</p>
          <button
            onClick={() => router.push('/rca')}
            className="mt-4 text-blue-600 hover:text-blue-500"
          >
            Back to RCA List
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow">
        <div className="w-full px-3 sm:px-4 md:px-6 lg:px-8 py-3 sm:py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
            <div className="flex items-center space-x-3 sm:space-x-4">
              <button
                onClick={() => router.push('/rca')}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </button>
              <div className="min-w-0 flex-1">
                <h1 className="text-base sm:text-xl font-bold text-gray-900 dark:text-white truncate">
                  RCA Workspace - {rca.incident?.incidentNumber || 'Unknown'}
                </h1>
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 truncate">
                  {rca.incident?.category?.name || 'Unknown'} | {rca.incident?.facility?.name || 'Unknown'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
              <span className={`px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-xs sm:text-sm font-medium ${
                rca.isValidated
                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                  : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
              }`}>
                {rca.isValidated ? 'Validated' : rca.status.replace('_', ' ')}
              </span>
              {saving && (
                <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                  Saving...
                </span>
              )}
            </div>
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
            {/* Incident Details Card */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-3 sm:p-6">
              <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-3 sm:mb-4">
                Incident Details
              </h2>
              <div className="space-y-3 sm:space-y-4">
                <div>
                  <span className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400">Description:</span>
                  {/* Check if description contains FMIR report structure with section markers */}
                  {rca.incident?.description?.includes('─') || rca.incident?.description?.includes('═') || rca.incident?.description?.includes('FOREIGN MATERIAL INCIDENT REPORT') ? (
                    <div className="mt-2 space-y-3 sm:space-y-4 text-xs sm:text-sm text-gray-900 dark:text-white">
                      {/* Parse and render FMIR-formatted description */}
                      {(() => {
                        const desc = rca.incident?.description || '';
                        
                        // First, clean all unicode box-drawing characters
                        const cleanedDesc = desc
                          .replace(/[═─━│┃┄┅┆┇┈┉┊┋╌╍╎╏┌┐└┘├┤┬┴┼╔╗╚╝╠╣╦╩╬╭╮╯╰▀▄█▌▐░▒▓■□▪▫●○◘◙♦♣♠♥—–―_]+/g, '')
                          .replace(/[\u2500-\u257F]+/g, '') // Remove box drawing block
                          .replace(/[\u2580-\u259F]+/g, '') // Remove block elements
                          .replace(/\n{3,}/g, '\n\n') // Collapse multiple newlines
                          .trim();
                        
                        // Extract sections from FMIR format
                        const sections: { title: string; content: string }[] = [];
                        
                        // Known FMIR sections
                        const sectionTitles = ['GENERAL INFORMATION', 'FOREIGN MATERIAL DESCRIPTION', 'CAUSE IDENTIFICATION', 'CORRECTIVE ACTION TAKEN', 'VERIFICATION ACTIONS', 'EVIDENCE'];
                        
                        // Split by section titles
                        const lines = cleanedDesc.split('\n');
                        let currentSection = '';
                        let currentContent: string[] = [];
                        
                        for (const line of lines) {
                          const trimmedLine = line.trim();
                          const matchedTitle = sectionTitles.find(title => trimmedLine === title || trimmedLine.startsWith(title + ' '));
                          
                          if (matchedTitle) {
                            // Save previous section
                            if (currentSection) {
                              sections.push({ title: currentSection, content: currentContent.join('\n').trim() });
                            }
                            currentSection = matchedTitle;
                            // Check if there's content after the title on the same line
                            const contentAfterTitle = trimmedLine.replace(matchedTitle, '').trim();
                            currentContent = contentAfterTitle ? [contentAfterTitle] : [];
                          } else if (trimmedLine.includes('FMIR-') && !currentSection) {
                            // First part is usually the report title - skip it or add as report
                            if (!sections.find(s => s.title === 'Report')) {
                              sections.push({ title: 'Report', content: trimmedLine });
                            }
                          } else if (currentSection && trimmedLine) {
                            currentContent.push(trimmedLine);
                          } else if (!currentSection && trimmedLine && !trimmedLine.includes('FOREIGN MATERIAL INCIDENT REPORT')) {
                            // Content before any section - add to a general section
                            currentContent.push(trimmedLine);
                          }
                        }
                        
                        // Add last section
                        if (currentSection && currentContent.length > 0) {
                          sections.push({ title: currentSection, content: currentContent.join('\n').trim() });
                        }
                        
                        // If no structured sections found, try to display as clean paragraphs
                        if (sections.length === 0) {
                          return (
                            <p className="whitespace-pre-wrap leading-relaxed">
                              {cleanedDesc}
                            </p>
                          );
                        }
                        
                        return sections.map((section, idx) => (
                          <div key={idx} className="border-l-2 border-blue-400 dark:border-blue-600 pl-3">
                            <h4 className="font-medium text-blue-600 dark:text-blue-400 text-xs uppercase tracking-wide mb-1">
                              {section.title}
                            </h4>
                            <p className="text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap">
                              {section.content}
                            </p>
                          </div>
                        ));
                      })()}
                    </div>
                  ) : (
                    <p className="text-gray-900 dark:text-white mt-1">{rca.incident?.description || 'No description'}</p>
                  )}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2 border-t border-gray-200 dark:border-gray-700">
                  <div>
                    <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Type:</span>
                    <p className="text-gray-900 dark:text-white">{rca.incident?.type?.replace('_', ' ') || 'Unknown'}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Severity:</span>
                    <p className="text-gray-900 dark:text-white">{rca.incident?.severity || 'Not set'}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Category:</span>
                    <p className="text-gray-900 dark:text-white">{rca.incident?.category?.name || 'Unknown'}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Reported By:</span>
                    <p className="text-gray-900 dark:text-white">
                      {rca.incident?.createdBy?.firstName || ''} {rca.incident?.createdBy?.lastName || 'Unknown'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* AI Insights from Incident Analysis */}
            {(rca.incident?.aiAnalysisData || rca.incident?.aiSummary) && (
              <div className="bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-lg shadow border border-purple-200 dark:border-purple-800 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-xl">🤖</span>
                  <h2 className="text-lg font-semibold text-purple-900 dark:text-purple-100">
                    AI Insights from Incident Analysis
                  </h2>
                </div>
                
                {/* AI Summary */}
                {rca.incident?.aiSummary && (
                  <div className="mb-4">
                    <h3 className="text-sm font-medium text-purple-800 dark:text-purple-200 mb-2">Summary</h3>
                    <p className="text-sm text-purple-700 dark:text-purple-300 bg-white/50 dark:bg-gray-800/50 rounded-lg p-3">
                      {rca.incident.aiSummary}
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Key Findings */}
                  {rca.incident?.aiAnalysisData?.keyFindings && rca.incident.aiAnalysisData.keyFindings.length > 0 && (
                    <div className="bg-white/50 dark:bg-gray-800/50 rounded-lg p-4">
                      <h3 className="text-sm font-medium text-purple-800 dark:text-purple-200 mb-2 flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                        </svg>
                        Key Findings
                      </h3>
                      <ul className="space-y-1">
                        {rca.incident.aiAnalysisData.keyFindings.map((finding: string, idx: number) => (
                          <li key={idx} className="text-sm text-purple-700 dark:text-purple-300 flex items-start gap-2">
                            <span className="text-purple-500 mt-1">•</span>
                            <span>{finding}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Investigation Guidance */}
                  {rca.incident?.aiAnalysisData?.investigationGuidance && rca.incident.aiAnalysisData.investigationGuidance.length > 0 && (
                    <div className="bg-white/50 dark:bg-gray-800/50 rounded-lg p-4">
                      <h3 className="text-sm font-medium text-purple-800 dark:text-purple-200 mb-2 flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                        Investigation Guidance
                      </h3>
                      <ul className="space-y-1">
                        {rca.incident.aiAnalysisData.investigationGuidance.map((guidance: string, idx: number) => (
                          <li key={idx} className="text-sm text-purple-700 dark:text-purple-300 flex items-start gap-2">
                            <span className="text-purple-500 mt-1">•</span>
                            <span>{guidance}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Contributing Factors */}
                {rca.incident?.aiAnalysisData?.contributingFactors && rca.incident.aiAnalysisData.contributingFactors.length > 0 && (
                  <div className="mt-4 bg-white/50 dark:bg-gray-800/50 rounded-lg p-4">
                    <h3 className="text-sm font-medium text-purple-800 dark:text-purple-200 mb-2 flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      Contributing Factors to Explore
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {rca.incident.aiAnalysisData.contributingFactors.map((factor: string, idx: number) => (
                        <span key={idx} className="px-2 py-1 text-xs bg-purple-200 dark:bg-purple-800 text-purple-800 dark:text-purple-200 rounded-full">
                          {factor}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* AI Recommended RCA Methodology - Enhanced Display */}
                {rca.incident?.aiAnalysisData?.recommendedRCAMethodology && (
                  <div className="mt-4 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-lg p-4 border border-amber-200 dark:border-amber-700">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 mt-0.5">
                        <span className="text-2xl">✨</span>
                      </div>
                      <div className="flex-1">
                        <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-200 mb-2">
                          AI Recommendation: {rca.incident.aiAnalysisData.recommendedRCAMethodology.primary === 'FISHBONE' 
                            ? 'Fishbone Diagram' 
                            : '5 Whys'}
                        </h3>
                        
                        {/* Simple explanation */}
                        <p className="text-sm text-amber-700 dark:text-amber-300 leading-relaxed">
                          {rca.incident.aiAnalysisData.recommendedRCAMethodology.reason}
                        </p>
                        
                        {/* Confidence indicator */}
                        <div className="mt-3 flex items-center gap-2">
                          <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                            Confidence: {rca.incident.aiAnalysisData.recommendedRCAMethodology.confidence}%
                          </span>
                          <div className="flex-1 h-1.5 bg-amber-200 dark:bg-amber-800 rounded-full overflow-hidden max-w-[100px]">
                            <div 
                              className="h-full bg-amber-500 dark:bg-amber-400 rounded-full transition-all duration-300"
                              style={{ width: `${rca.incident.aiAnalysisData.recommendedRCAMethodology.confidence}%` }}
                            />
                          </div>
                        </div>
                        
                        {/* Alternative method hint */}
                        {rca.incident.aiAnalysisData.recommendedRCAMethodology.alternativeReason && (
                          <p className="mt-3 text-xs text-amber-600 dark:text-amber-400 italic">
                            💡 Alternative: {rca.incident.aiAnalysisData.recommendedRCAMethodology.alternativeReason}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Method Selector / AI Recommendation */}
            {!rca.isValidated && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-3 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0 mb-3 sm:mb-4">
                  <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
                    Analysis Method
                  </h2>
                  <button
                    onClick={() => setShowMethodSelector(!showMethodSelector)}
                    className="text-blue-600 hover:text-blue-700 dark:text-blue-400 text-xs sm:text-sm font-medium self-start sm:self-auto"
                  >
                    Change Method
                  </button>
                </div>

                {/* Current Method */}
                <div className="flex items-center space-x-3 sm:space-x-4 mb-3 sm:mb-4">
                  <div className={`p-2 sm:p-3 rounded-lg ${
                    rca.method === 'FIVE_WHYS'
                      ? 'bg-purple-100 dark:bg-purple-900'
                      : 'bg-teal-100 dark:bg-teal-900'
                  }`}>
                    {rca.method === 'FIVE_WHYS' ? (
                      <svg className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600 dark:text-purple-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 sm:w-6 sm:h-6 text-teal-600 dark:text-teal-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                      </svg>
                    )}
                  </div>
                  <div>
                    <p className="text-sm sm:text-base font-medium text-gray-900 dark:text-white">
                      {rca.method === 'FIVE_WHYS' ? '5 Whys Analysis' : 'Fishbone Diagram'}
                    </p>
                    <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                      {rca.method === 'FIVE_WHYS'
                        ? 'Iterative questioning to find root cause'
                        : 'Visual cause-and-effect diagram'}
                    </p>
                  </div>
                </div>

                {/* AI Recommendation - Use incident's AI analysis data first, then fall back to recommendation API */}
                {(() => {
                  // Prioritize AI recommendation from incident analysis
                  const incidentRec = rca.incident?.aiAnalysisData?.recommendedRCAMethodology;
                  const apiRec = recommendation;
                  
                  // Determine which recommendation to show
                  const recMethod = incidentRec?.primary || apiRec?.recommendedMethod;
                  const recReason = incidentRec?.reason || apiRec?.reason;
                  const recConfidence = incidentRec?.confidence || (apiRec?.confidence ? apiRec.confidence * 100 : null);
                  const recAlternativeReason = incidentRec?.alternativeReason || apiRec?.alternativeReason;
                  
                  // Show recommendation box when method differs OR always show to explain current choice
                  if (recMethod) {
                    const methodMatches = rca.method === recMethod;
                    
                    return (
                      <div className={`rounded-lg p-3 sm:p-4 ${
                        methodMatches 
                          ? 'bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700'
                          : 'bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700'
                      }`}>
                        <div className="flex items-start space-x-2 sm:space-x-3">
                          <span className="text-lg sm:text-xl mt-0.5">{methodMatches ? '✅' : '💡'}</span>
                          <div className="flex-1 min-w-0">
                            <p className={`text-xs sm:text-sm font-semibold ${
                              methodMatches 
                                ? 'text-green-800 dark:text-green-200'
                                : 'text-yellow-800 dark:text-yellow-200'
                            }`}>
                              {methodMatches 
                                ? `You're using the AI-recommended method: ${recMethod === 'FIVE_WHYS' ? '5 Whys' : 'Fishbone Diagram'}`
                                : `AI Recommends: ${recMethod === 'FIVE_WHYS' ? '5 Whys' : 'Fishbone Diagram'}`
                              }
                            </p>
                            {recReason && (
                              <p className={`text-xs sm:text-sm mt-1.5 sm:mt-2 leading-relaxed ${
                                methodMatches 
                                  ? 'text-green-700 dark:text-green-300'
                                  : 'text-yellow-700 dark:text-yellow-300'
                              }`}>
                                {recReason}
                              </p>
                            )}
                            {recConfidence && (
                              <div className="mt-1.5 sm:mt-2 flex items-center gap-2">
                                <span className={`text-xs font-medium ${
                                  methodMatches 
                                    ? 'text-green-600 dark:text-green-400'
                                    : 'text-yellow-600 dark:text-yellow-400'
                                }`}>
                                  Confidence: {Math.round(recConfidence)}%
                                </span>
                              </div>
                            )}
                            {!methodMatches && (
                              <p className={`text-xs mt-1.5 sm:mt-2 italic text-yellow-600 dark:text-yellow-400`}>
                                You can continue with your current choice. The AI recommendation is just a suggestion based on the incident analysis.
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}

                {/* Method Selector Modal */}
                {showMethodSelector && (
                  <div className="mt-4 p-4 border border-gray-200 dark:border-gray-600 rounded-lg">
                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                      Select your preferred analysis method:
                    </p>
                    <div className="flex space-x-4">
                      <button
                        onClick={() => handleMethodChange('FIVE_WHYS')}
                        disabled={saving}
                        className={`flex-1 p-4 border rounded-lg transition-colors ${
                          rca.method === 'FIVE_WHYS'
                            ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30'
                            : 'border-gray-200 dark:border-gray-600 hover:border-purple-300'
                        }`}
                      >
                        <span className="font-medium text-gray-900 dark:text-white">5 Whys</span>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Best for simple, linear problems
                        </p>
                      </button>
                      <button
                        onClick={() => handleMethodChange('FISHBONE')}
                        disabled={saving}
                        className={`flex-1 p-4 border rounded-lg transition-colors ${
                          rca.method === 'FISHBONE'
                            ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/30'
                            : 'border-gray-200 dark:border-gray-600 hover:border-teal-300'
                        }`}
                      >
                        <span className="font-medium text-gray-900 dark:text-white">Fishbone</span>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Best for complex, multi-factor problems
                        </p>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* CAPA Generation Card - Show when RCA is validated */}
            {rca.isValidated && (
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 dark:border-green-800 rounded-lg shadow p-6">
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0">
                    <div className="p-3 bg-green-100 dark:bg-green-900/50 rounded-full">
                      <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-green-800 dark:text-green-200">
                      RCA Analysis Validated ✓
                    </h3>
                    <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                      Root Cause: {rca.rootCauseStatement}
                    </p>
                    <p className="text-sm text-green-600 dark:text-green-400 mt-2">
                      Now you can generate Corrective & Preventive Actions (CAPA) from your action plans.
                    </p>
                    <div className="mt-4 flex items-center space-x-4">
                      {capaGenerated || (rca.capActions && rca.capActions.length > 0) ? (
                        <a
                          href="/capa"
                          className="inline-flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors"
                        >
                          <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                          </svg>
                          View CAPA Board ({rca.capActions?.length || 'Generated'})
                        </a>
                      ) : (
                        <button
                          onClick={handleGenerateCAPA}
                          disabled={generatingCAPA}
                          className="inline-flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-medium rounded-lg transition-colors"
                        >
                          {generatingCAPA ? (
                            <>
                              <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              Generating...
                            </>
                          ) : (
                            <>
                              <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                              </svg>
                              Generate CAPA Actions
                            </>
                          )}
                        </button>
                      )}
                      <span className="text-xs text-green-600 dark:text-green-400">
                        Creates formal action items from your action plans
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Analysis Builder */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
              {rca.method === 'FIVE_WHYS' ? (
                <FiveWhysBuilder
                  rcaId={rca.id}
                  data={rca.fiveWhysData || { steps: [] }}
                  isValidated={rca.isValidated}
                  onSave={handleSaveFiveWhys}
                  onValidate={handleValidate}
                />
              ) : (
                <FishboneBuilder
                  rcaId={rca.id}
                  incidentId={rca.incident?.id || rca.incidentId}
                  currentUserId={user?.id}
                  data={(() => {
                    // If fishboneData exists, check if problem needs cleaning
                    if (rca.fishboneData) {
                      const currentProblem = rca.fishboneData.problem || '';
                      // If the saved problem contains raw FMIR format, extract just the FM description
                      if (currentProblem.includes('FOREIGN MATERIAL INCIDENT REPORT') || currentProblem.includes('─')) {
                        return {
                          ...rca.fishboneData,
                          problem: extractProblemFromFMIR(currentProblem)
                        };
                      }
                      return rca.fishboneData;
                    }
                    // No fishboneData, extract from incident description
                    return { 
                      problem: extractProblemFromFMIR(rca.incident?.description) || '', 
                      categories: [] 
                    };
                  })()}
                  isValidated={rca.isValidated}
                  onSave={handleSaveFishbone}
                  onValidate={handleValidate}
                  onReopen={isAnalyst ? handleReopenRCA : undefined}
                />
              )}
            </div>

            {/* Version History - Now inline */}
            {rca.versionHistory && rca.versionHistory.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                  Version History
                </h3>
                <div className="flex flex-wrap gap-2">
                  {rca.versionHistory.slice(0, 5).map((version: any) => (
                    <div
                      key={version.id}
                      className="text-sm text-gray-600 dark:text-gray-300 px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded"
                    >
                      <span className="font-medium">v{version.versionNumber}</span>
                      <span className="mx-2">•</span>
                      <span>{formatDate(version.createdAt)}</span>
                      {version.changeReason && (
                        <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                          ({version.changeReason})
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
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
        />
      )}

      {/* Access Denied Modal */}
      {accessDeniedModal}
    </div>
  );
}
