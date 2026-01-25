'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { useWebSocket } from '@/lib/websocket';
import api from '@/lib/api';

// Privilege check result
interface PrivilegeCheckResult {
  hasPrivilege: boolean;
  loading: boolean;
  error: string | null;
}

// User's full privilege map
interface UserPrivileges {
  [key: string]: boolean;
}

// Cache for privileges - persists across hook instances
let privilegeCache: UserPrivileges | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Global version counter to force re-renders across all hook instances
let privilegeVersion = 0;

/**
 * Hook to fetch and check user privileges
 * Caches privileges for performance
 * Listens for real-time privilege changes via WebSocket
 */
export function usePrivileges() {
  const { user } = useAuth();
  const { onPrivilegeChanged } = useWebSocket();
  const [privileges, setPrivileges] = useState<UserPrivileges | null>(privilegeCache);
  const [loading, setLoading] = useState(!privilegeCache);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(privilegeVersion);
  const isFetching = useRef(false);

  // Fetch user privileges
  const fetchPrivileges = useCallback(async (forceRefresh = false) => {
    if (!user) {
      setPrivileges(null);
      privilegeCache = null;
      return;
    }

    // Prevent concurrent fetches (but allow force refresh to override)
    if (isFetching.current && !forceRefresh) {
      return;
    }

    // Check cache validity (skip if force refresh)
    const now = Date.now();
    if (!forceRefresh && privilegeCache && (now - cacheTimestamp) < CACHE_DURATION) {
      setPrivileges(privilegeCache);
      setLoading(false);
      return;
    }

    isFetching.current = true;
    setLoading(true);
    setError(null);

    try {
      console.log('🔐 Fetching privileges from server...');
      const response = await api.get('/privileges/my-privileges');
      const newPrivileges = response.data.data || response.data.privileges || {};
      
      console.log('🔐 Privileges fetched successfully:', Object.keys(newPrivileges).length, 'privileges');
      
      privilegeCache = newPrivileges;
      cacheTimestamp = Date.now();
      privilegeVersion++;
      
      // Update both privileges and version to ensure re-render
      setPrivileges({ ...newPrivileges }); // Create new object to trigger re-render
      setVersion(privilegeVersion);
    } catch (err: any) {
      console.error('Failed to fetch privileges:', err);
      setError(err.response?.data?.error || 'Failed to load privileges');
      // On error, use empty privileges (default deny)
      setPrivileges({});
    } finally {
      setLoading(false);
      isFetching.current = false;
    }
  }, [user]);

  // Fetch on mount and when user changes
  useEffect(() => {
    fetchPrivileges();
  }, [fetchPrivileges]);

  // Listen for real-time privilege changes via WebSocket
  useEffect(() => {
    if (!onPrivilegeChanged || !user) return;

    const unsubscribe = onPrivilegeChanged((data: { 
      organizationId: string; 
      changedBy: string; 
      changedAt: string; 
      affectedRoles?: string[]; 
      affectedUsers?: string[]; 
      changes?: any;
    }) => {
      console.log('🔐 Privilege changed event received:', data);
      
      // Check if this privilege change affects the current user
      const affectsCurrentUser = 
        // If no specific roles/users are specified, refresh for all
        (!data.affectedRoles && !data.affectedUsers) ||
        // If affectedRoles includes the current user's role
        (data.affectedRoles && data.affectedRoles.includes(user.role)) ||
        // If affectedUsers includes the current user's ID
        (data.affectedUsers && data.affectedUsers.includes(user.id));
      
      if (affectsCurrentUser) {
        console.log('🔐 Privilege change affects current user (role:', user.role, ', id:', user.id, ') - refreshing privileges in real-time');
        
        // Invalidate cache immediately
        privilegeCache = null;
        cacheTimestamp = 0;
        
        // Force refresh privileges
        fetchPrivileges(true);
      } else {
        console.log('🔐 Privilege change does not affect current user - skipping refresh');
      }
    });

    return unsubscribe;
  }, [onPrivilegeChanged, fetchPrivileges, user]);

  /**
   * Check if user has a specific privilege
   * @param privilegeKey - The privilege key to check (e.g., 'fmir.delete_visible')
   * @returns boolean - true if user has the privilege
   */
  const hasPrivilege = useCallback((privilegeKey: string): boolean => {
    if (!privileges) return false;
    
    // SYSTEM_ADMIN always has all privileges
    if (user?.role === 'SYSTEM_ADMIN') return true;
    
    const result = privileges[privilegeKey] === true;
    return result;
  }, [privileges, user?.role, version]); // Include version to ensure updates

  /**
   * Check if user has ANY of the specified privileges
   * @param privilegeKeys - Array of privilege keys to check
   * @returns boolean - true if user has at least one privilege
   */
  const hasAnyPrivilege = useCallback((privilegeKeys: string[]): boolean => {
    if (!privileges) return false;
    if (user?.role === 'SYSTEM_ADMIN') return true;
    
    return privilegeKeys.some(key => privileges[key] === true);
  }, [privileges, user?.role, version]); // Include version to ensure updates

  /**
   * Check if user has ALL of the specified privileges
   * @param privilegeKeys - Array of privilege keys to check
   * @returns boolean - true if user has all privileges
   */
  const hasAllPrivileges = useCallback((privilegeKeys: string[]): boolean => {
    if (!privileges) return false;
    if (user?.role === 'SYSTEM_ADMIN') return true;
    
    return privilegeKeys.every(key => privileges[key] === true);
  }, [privileges, user?.role, version]); // Include version to ensure updates

  /**
   * Invalidate cache and refetch privileges
   */
  const refreshPrivileges = useCallback(() => {
    privilegeCache = null;
    cacheTimestamp = 0;
    fetchPrivileges(true);
  }, [fetchPrivileges]);

  return {
    privileges,
    loading,
    error,
    hasPrivilege,
    hasAnyPrivilege,
    hasAllPrivileges,
    refreshPrivileges,
  };
}

/**
 * Hook to check a single privilege
 * More efficient for components that only need one check
 */
export function useHasPrivilege(privilegeKey: string): PrivilegeCheckResult {
  const { hasPrivilege, loading, error } = usePrivileges();
  
  const result = useMemo(() => ({
    hasPrivilege: hasPrivilege(privilegeKey),
    loading,
    error,
  }), [hasPrivilege, privilegeKey, loading, error]);

  return result;
}

/**
 * Higher-order function to check privileges before executing an action
 * @param privilegeKey - The privilege key required
 * @param action - The action to execute if privilege is granted
 * @param onDenied - Optional callback when privilege is denied
 */
export function withPrivilegeCheck(
  privilegeKey: string,
  action: () => void | Promise<void>,
  onDenied?: () => void
) {
  return async (hasPrivilege: (key: string) => boolean) => {
    if (hasPrivilege(privilegeKey)) {
      await action();
    } else {
      if (onDenied) {
        onDenied();
      } else {
        console.warn(`Privilege denied: ${privilegeKey}`);
      }
    }
  };
}

// ============================================================================
// INCIDENTS-Specific Privilege Constants
// ============================================================================

export const INCIDENTS_PRIVILEGES = {
  VIEW: 'incidents.view',
  VIEW_ALL: 'incidents.view_all',
  CREATE: 'incidents.create',
  EDIT: 'incidents.edit',
  EDIT_ANY: 'incidents.edit_any',
  DELETE: 'incidents.delete',
  ASSIGN: 'incidents.assign',
  CHANGE_STATUS: 'incidents.change_status',
  MANAGE_TEAM: 'incidents.manage_team',
  AI_ANALYSIS: 'incidents.ai_analysis',
  AI_AUTO_CATEGORIZE: 'incidents.ai.auto_categorize',
  AI_SUGGEST_ACTIONS: 'incidents.ai.suggest_actions',
  AI_SUMMARIZE: 'incidents.ai.summarize',
  AI_PREDICT_IMPACT: 'incidents.ai.predict_impact',
} as const;

export type IncidentsPrivilegeKey = typeof INCIDENTS_PRIVILEGES[keyof typeof INCIDENTS_PRIVILEGES];

// ============================================================================
// RCA-Specific Privilege Constants
// ============================================================================

export const RCA_PRIVILEGES = {
  VIEW: 'rca.view',
  CREATE: 'rca.create',
  EDIT: 'rca.edit',
  VALIDATE: 'rca.validate',
  AI_ANALYSIS: 'rca.ai_analysis',
  AI_FIVE_WHYS: 'rca.ai.five_whys',
  AI_FISHBONE: 'rca.ai.fishbone',
  AI_SUGGEST_CAUSES: 'rca.ai.suggest_causes',
  AI_VALIDATION: 'rca.ai.validation',
  AI_GENERATE_REPORT: 'rca.ai.generate_report',
} as const;

export type RCAPrivilegeKey = typeof RCA_PRIVILEGES[keyof typeof RCA_PRIVILEGES];

// ============================================================================
// CAPA-Specific Privilege Constants
// ============================================================================

export const CAPA_PRIVILEGES = {
  VIEW: 'capa.view',
  CREATE: 'capa.create',
  EDIT: 'capa.edit',
  DELETE: 'capa.delete',
  VERIFY: 'capa.verify',
  AI_SUGGEST_ACTIONS: 'capa.ai.suggest_actions',
  AI_PRIORITIZE: 'capa.ai.prioritize',
  AI_EFFECTIVENESS_PREDICTION: 'capa.ai.effectiveness_prediction',
  AI_SIMILAR_ACTIONS: 'capa.ai.similar_actions',
  AI_GENERATE_REPORT: 'capa.ai.generate_report',
} as const;

export type CAPAPrivilegeKey = typeof CAPA_PRIVILEGES[keyof typeof CAPA_PRIVILEGES];

// ============================================================================
// FMIR-Specific Privilege Constants
// ============================================================================

export const FMIR_PRIVILEGES = {
  // Core Operations
  VIEW: 'fmir.view',
  VIEW_ALL: 'fmir.view_all',
  CREATE: 'fmir.create',
  EDIT: 'fmir.edit',
  EDIT_ANY: 'fmir.edit_any',
  DELETE: 'fmir.delete',
  DELETE_VISIBLE: 'fmir.delete_visible',

  // Status Management
  SUBMIT: 'fmir.submit',
  CHANGE_STATUS: 'fmir.change_status',
  TOGGLE_INVESTIGATION: 'fmir.toggle_investigation',
  CLOSE: 'fmir.close',
  TOGGLE_VISIBILITY: 'fmir.toggle_visibility',

  // Evidence
  EVIDENCE_UPLOAD: 'fmir.evidence.upload',
  EVIDENCE_DOWNLOAD: 'fmir.evidence.download',
  EVIDENCE_DELETE: 'fmir.evidence.delete',
  EVIDENCE_EDIT: 'fmir.evidence.edit',

  // Collaborators
  COLLABORATORS_VIEW: 'fmir.collaborators.view',
  COLLABORATORS_ADD: 'fmir.collaborators.add',
  COLLABORATORS_REMOVE: 'fmir.collaborators.remove',

  // AI Features
  AI_VALIDATE_SUBMIT: 'fmir.ai.validate_submit',
  AI_VALIDATE_LOCK: 'fmir.ai.validate_lock',
  AI_EXPLAIN_REGULATION: 'fmir.ai.explain_regulation',
  AI_ENHANCE_TEXT: 'fmir.ai.enhance_text',
  AI_GENERATE_AUDIT: 'fmir.ai.generate_audit',

  // Comments
  COMMENTS_VIEW: 'fmir.comments.view',
  COMMENTS_ADD: 'fmir.comments.add',
  COMMENTS_DELETE: 'fmir.comments.delete',
  COMMENTS_DELETE_ANY: 'fmir.comments.delete_any',

  // Audit
  AUDIT_VIEW: 'fmir.audit.view',
  AUDIT_VIEW_ORG: 'fmir.audit.view_org',

  // Export
  EXPORT_PRINT: 'fmir.export.print',
  EXPORT_PDF: 'fmir.export.pdf',

  // Assignment
  ASSIGN_LINE: 'fmir.assign.line',
  ASSIGN_AREA: 'fmir.assign.area',
  ASSIGN_QA_USER: 'fmir.assign.qa_user',

  // RCA Integration
  LINK_RCA: 'fmir.link_rca',
} as const;

export type FMIRPrivilegeKey = typeof FMIR_PRIVILEGES[keyof typeof FMIR_PRIVILEGES];

// ============================================================================
// WORKPLACE REPORT Privilege Constants
// ============================================================================

export const WORKPLACE_REPORT_PRIVILEGES = {
  VIEW: 'workplace_report.view',
  GENERATE: 'workplace_report.generate',
} as const;

export type WorkplaceReportPrivilegeKey = typeof WORKPLACE_REPORT_PRIVILEGES[keyof typeof WORKPLACE_REPORT_PRIVILEGES];

// ============================================================================
// INVESTIGATION REPORT Privilege Constants
// ============================================================================

export const INVESTIGATION_REPORT_PRIVILEGES = {
  VIEW: 'investigation_report.view',
  GENERATE: 'investigation_report.generate',
} as const;

export type InvestigationReportPrivilegeKey = typeof INVESTIGATION_REPORT_PRIVILEGES[keyof typeof INVESTIGATION_REPORT_PRIVILEGES];

// ============================================================================
// KNOWLEDGE BASE Privilege Constants
// ============================================================================

export const KNOWLEDGE_PRIVILEGES = {
  VIEW: 'knowledge.view',
  CREATE: 'knowledge.create',
  EDIT: 'knowledge.edit',
  DELETE: 'knowledge.delete',
  AI_GENERATE_SUMMARY: 'knowledge.ai.generate_summary',
  AI_SUGGEST_RELATED: 'knowledge.ai.suggest_related',
} as const;

export type KnowledgePrivilegeKey = typeof KNOWLEDGE_PRIVILEGES[keyof typeof KNOWLEDGE_PRIVILEGES];

// ============================================================================
// ANALYTICS Privilege Constants
// ============================================================================

export const ANALYTICS_PRIVILEGES = {
  VIEW_DASHBOARD: 'analytics.view_dashboard',
  VIEW_TRENDS: 'analytics.view_trends',
  EXPORT_REPORTS: 'analytics.export_reports',
  AI_GENERATE_INSIGHTS: 'analytics.ai.generate_insights',
  AI_PREDICT_TRENDS: 'analytics.ai.predict_trends',
} as const;

export type AnalyticsPrivilegeKey = typeof ANALYTICS_PRIVILEGES[keyof typeof ANALYTICS_PRIVILEGES];
