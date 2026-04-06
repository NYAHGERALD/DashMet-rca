import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient, UserRole, FeatureModule, PrivilegeAction } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';
import { websocketService } from '../services/websocketService';
import { v4 as uuidv4 } from 'uuid';

const router = Router();
const prisma = new PrismaClient();

// Async handler wrapper
const asyncHandler = (fn: Function) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// ============================================================================
// AUDIT LOG HELPER FUNCTION
// ============================================================================

interface AuditLogParams {
  organizationId: string;
  role: UserRole;
  module: FeatureModule;
  featureKey: string;
  action: PrivilegeAction;
  displayName?: string;
  previousValue: boolean;
  newValue: boolean;
  changeType: 'enable' | 'disable' | 'reset' | 'bulk_update' | 'revert';
  changedById: string;
  changedByName: string;
  changedByRole: UserRole;
  description?: string;
  ipAddress?: string;
  userAgent?: string;
}

async function createAuditLog(params: AuditLogParams) {
  return prisma.privilegeAuditLog.create({
    data: {
      id: uuidv4(),
      organizationId: params.organizationId,
      role: params.role,
      module: params.module,
      featureKey: params.featureKey,
      action: params.action,
      displayName: params.displayName,
      previousValue: params.previousValue,
      newValue: params.newValue,
      changeType: params.changeType,
      changedById: params.changedById,
      changedByName: params.changedByName,
      changedByRole: params.changedByRole,
      description: params.description,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    },
  });
}

// ============================================================================
// PRIVILEGE DEFINITIONS - Master list of all controllable features
// ============================================================================

interface PrivilegeDefinition {
  key: string;
  module: FeatureModule;
  action: PrivilegeAction;
  displayName: string;
  description: string;
  category: string;
  sortOrder: number;
  defaultRoles: UserRole[]; // Roles that have this privilege by default
}

export const PRIVILEGE_DEFINITIONS: PrivilegeDefinition[] = [
  // ============================================================================
  // INCIDENTS MODULE
  // ============================================================================
  {
    key: 'incidents.view',
    module: 'INCIDENTS',
    action: 'VIEW',
    displayName: 'View Incidents',
    description: 'View incident list and details',
    category: 'Incidents',
    sortOrder: 100,
    defaultRoles: ['OPERATOR', 'SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'MAINTENANCE_ENGINEERING', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN', 'SYSTEM_ADMIN'],
  },
  {
    key: 'incidents.view_all',
    module: 'INCIDENTS',
    action: 'VIEW',
    displayName: 'View All Organization Incidents',
    description: 'View all incidents across the organization, not just own or team',
    category: 'Incidents',
    sortOrder: 101,
    defaultRoles: ['QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'CI_MANAGER', 'ADMIN', 'SYSTEM_ADMIN'],
  },
  {
    key: 'incidents.create',
    module: 'INCIDENTS',
    action: 'CREATE',
    displayName: 'Create Incidents',
    description: 'Create new incident reports',
    category: 'Incidents',
    sortOrder: 102,
    defaultRoles: ['OPERATOR', 'SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'MAINTENANCE_ENGINEERING', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN'],
  },
  {
    key: 'incidents.edit',
    module: 'INCIDENTS',
    action: 'EDIT',
    displayName: 'Edit Incidents',
    description: 'Edit incident details (own incidents)',
    category: 'Incidents',
    sortOrder: 103,
    defaultRoles: ['OPERATOR', 'SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'MAINTENANCE_ENGINEERING', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN'],
  },
  {
    key: 'incidents.edit_any',
    module: 'INCIDENTS',
    action: 'EDIT',
    displayName: 'Edit Any Incident',
    description: 'Edit any incident in the organization',
    category: 'Incidents',
    sortOrder: 104,
    defaultRoles: ['CI_MANAGER', 'ADMIN', 'SYSTEM_ADMIN'],
  },
  {
    key: 'incidents.delete',
    module: 'INCIDENTS',
    action: 'DELETE',
    displayName: 'Delete Incidents',
    description: 'Delete incident reports',
    category: 'Incidents',
    sortOrder: 105,
    defaultRoles: ['CI_MANAGER', 'ADMIN', 'SYSTEM_ADMIN'],
  },
  {
    key: 'incidents.assign',
    module: 'INCIDENTS',
    action: 'MANAGE',
    displayName: 'Assign Incidents',
    description: 'Assign incidents to team members',
    category: 'Incidents',
    sortOrder: 106,
    defaultRoles: ['SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'CI_MANAGER', 'ADMIN'],
  },
  {
    key: 'incidents.change_status',
    module: 'INCIDENTS',
    action: 'MANAGE',
    displayName: 'Change Incident Status',
    description: 'Update incident workflow status',
    category: 'Incidents',
    sortOrder: 107,
    defaultRoles: ['SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'MAINTENANCE_ENGINEERING', 'CI_MANAGER', 'ADMIN'],
  },
  {
    key: 'incidents.manage_team',
    module: 'INCIDENTS',
    action: 'MANAGE',
    displayName: 'Manage Incident Team',
    description: 'Add or remove team participants from incidents',
    category: 'Incidents',
    sortOrder: 108,
    defaultRoles: ['SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'CI_MANAGER', 'ADMIN'],
  },
  {
    key: 'incidents.ai_analysis',
    module: 'INCIDENTS',
    action: 'EXECUTE',
    displayName: 'Run AI Analysis',
    description: 'Execute AI-powered incident analysis and triage',
    category: 'Incidents',
    sortOrder: 109,
    defaultRoles: ['SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'MAINTENANCE_ENGINEERING', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN'],
  },
  {
    key: 'incidents.ai.auto_categorize',
    module: 'INCIDENTS',
    action: 'EXECUTE',
    displayName: 'AI Auto-Categorization',
    description: 'Use AI to automatically categorize and classify incidents',
    category: 'Incidents',
    sortOrder: 110,
    defaultRoles: ['SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'CI_MANAGER', 'ADMIN'],
  },
  {
    key: 'incidents.ai.suggest_actions',
    module: 'INCIDENTS',
    action: 'EXECUTE',
    displayName: 'AI Action Suggestions',
    description: 'Get AI-suggested corrective actions for incidents',
    category: 'Incidents',
    sortOrder: 111,
    defaultRoles: ['SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'MAINTENANCE_ENGINEERING', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN'],
  },
  {
    key: 'incidents.ai.summarize',
    module: 'INCIDENTS',
    action: 'EXECUTE',
    displayName: 'AI Incident Summary',
    description: 'Generate AI-powered incident summaries and reports',
    category: 'Incidents',
    sortOrder: 112,
    defaultRoles: ['SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'CI_MANAGER', 'ADMIN'],
  },
  {
    key: 'incidents.ai.predict_impact',
    module: 'INCIDENTS',
    action: 'EXECUTE',
    displayName: 'AI Impact Prediction',
    description: 'Use AI to predict incident impact and severity',
    category: 'Incidents',
    sortOrder: 113,
    defaultRoles: ['QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'CI_MANAGER', 'ADMIN'],
  },

  // ============================================================================
  // RCA MODULE
  // ============================================================================
  {
    key: 'rca.view',
    module: 'RCA',
    action: 'VIEW',
    displayName: 'View RCA Analyses',
    description: 'View root cause analysis workspace and details',
    category: 'Root Cause Analysis',
    sortOrder: 200,
    defaultRoles: ['SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'MAINTENANCE_ENGINEERING', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN'],
  },
  {
    key: 'rca.create',
    module: 'RCA',
    action: 'CREATE',
    displayName: 'Create RCA Analysis',
    description: 'Initiate new root cause analysis',
    category: 'Root Cause Analysis',
    sortOrder: 201,
    defaultRoles: ['SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'MAINTENANCE_ENGINEERING', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN'],
  },
  {
    key: 'rca.edit',
    module: 'RCA',
    action: 'EDIT',
    displayName: 'Edit RCA Analysis',
    description: 'Modify RCA analysis details and findings',
    category: 'Root Cause Analysis',
    sortOrder: 202,
    defaultRoles: ['SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'MAINTENANCE_ENGINEERING', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN'],
  },
  {
    key: 'rca.validate',
    module: 'RCA',
    action: 'APPROVE',
    displayName: 'Validate RCA',
    description: 'Approve and validate completed RCA analysis',
    category: 'Root Cause Analysis',
    sortOrder: 203,
    defaultRoles: ['QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'CI_MANAGER', 'ADMIN'],
  },
  {
    key: 'rca.ai_analysis',
    module: 'RCA',
    action: 'EXECUTE',
    displayName: 'Run AI RCA Tools',
    description: 'Execute AI-powered 5 Whys and Fishbone analysis',
    category: 'Root Cause Analysis',
    sortOrder: 204,
    defaultRoles: ['SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'MAINTENANCE_ENGINEERING', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN'],
  },
  {
    key: 'rca.ai.five_whys',
    module: 'RCA',
    action: 'EXECUTE',
    displayName: 'AI 5-Whys Analysis',
    description: 'Use AI to assist with 5-Whys root cause investigation',
    category: 'Root Cause Analysis',
    sortOrder: 205,
    defaultRoles: ['SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'MAINTENANCE_ENGINEERING', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN'],
  },
  {
    key: 'rca.ai.fishbone',
    module: 'RCA',
    action: 'EXECUTE',
    displayName: 'AI Fishbone Diagram',
    description: 'Generate AI-powered Ishikawa/Fishbone diagrams',
    category: 'Root Cause Analysis',
    sortOrder: 206,
    defaultRoles: ['SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'MAINTENANCE_ENGINEERING', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN'],
  },
  {
    key: 'rca.ai.suggest_causes',
    module: 'RCA',
    action: 'EXECUTE',
    displayName: 'AI Cause Suggestions',
    description: 'Get AI-suggested potential root causes',
    category: 'Root Cause Analysis',
    sortOrder: 207,
    defaultRoles: ['SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'CI_MANAGER', 'ADMIN'],
  },
  {
    key: 'rca.ai.validation',
    module: 'RCA',
    action: 'EXECUTE',
    displayName: 'AI RCA Validation',
    description: 'Use AI to validate RCA completeness and quality',
    category: 'Root Cause Analysis',
    sortOrder: 208,
    defaultRoles: ['QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'CI_MANAGER', 'ADMIN'],
  },
  {
    key: 'rca.ai.generate_report',
    module: 'RCA',
    action: 'EXECUTE',
    displayName: 'AI RCA Report Generation',
    description: 'Generate AI-powered RCA summary reports',
    category: 'Root Cause Analysis',
    sortOrder: 209,
    defaultRoles: ['SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'CI_MANAGER', 'ADMIN'],
  },

  // ============================================================================
  // CAPA MODULE
  // ============================================================================
  {
    key: 'capa.view',
    module: 'CAPA',
    action: 'VIEW',
    displayName: 'View CAPA Board',
    description: 'View corrective and preventive action board',
    category: 'CAPA',
    sortOrder: 300,
    defaultRoles: ['SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'MAINTENANCE_ENGINEERING', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN'],
  },
  {
    key: 'capa.create',
    module: 'CAPA',
    action: 'CREATE',
    displayName: 'Create CAPA Actions',
    description: 'Create new corrective or preventive actions',
    category: 'CAPA',
    sortOrder: 301,
    defaultRoles: ['SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'MAINTENANCE_ENGINEERING', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN'],
  },
  {
    key: 'capa.edit',
    module: 'CAPA',
    action: 'EDIT',
    displayName: 'Edit CAPA Actions',
    description: 'Modify CAPA details and progress',
    category: 'CAPA',
    sortOrder: 302,
    defaultRoles: ['SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'MAINTENANCE_ENGINEERING', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN'],
  },
  {
    key: 'capa.delete',
    module: 'CAPA',
    action: 'DELETE',
    displayName: 'Delete CAPA Actions',
    description: 'Remove CAPA records',
    category: 'CAPA',
    sortOrder: 303,
    defaultRoles: ['CI_MANAGER', 'ADMIN'],
  },
  {
    key: 'capa.verify',
    module: 'CAPA',
    action: 'APPROVE',
    displayName: 'Verify CAPA Effectiveness',
    description: 'Verify and approve CAPA completion',
    category: 'CAPA',
    sortOrder: 304,
    defaultRoles: ['QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'CI_MANAGER', 'ADMIN'],
  },
  {
    key: 'capa.ai.suggest_actions',
    module: 'CAPA',
    action: 'EXECUTE',
    displayName: 'AI Action Suggestions',
    description: 'Get AI-suggested corrective and preventive actions',
    category: 'CAPA',
    sortOrder: 305,
    defaultRoles: ['SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'MAINTENANCE_ENGINEERING', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN'],
  },
  {
    key: 'capa.ai.prioritize',
    module: 'CAPA',
    action: 'EXECUTE',
    displayName: 'AI CAPA Prioritization',
    description: 'Use AI to prioritize CAPA actions by impact',
    category: 'CAPA',
    sortOrder: 306,
    defaultRoles: ['SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'CI_MANAGER', 'ADMIN'],
  },
  {
    key: 'capa.ai.effectiveness_prediction',
    module: 'CAPA',
    action: 'EXECUTE',
    displayName: 'AI Effectiveness Prediction',
    description: 'Predict CAPA effectiveness using AI analysis',
    category: 'CAPA',
    sortOrder: 307,
    defaultRoles: ['QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'CI_MANAGER', 'ADMIN'],
  },
  {
    key: 'capa.ai.similar_actions',
    module: 'CAPA',
    action: 'VIEW',
    displayName: 'AI Similar CAPA Finder',
    description: 'Find similar past CAPA actions using AI',
    category: 'CAPA',
    sortOrder: 308,
    defaultRoles: ['SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'CI_MANAGER', 'ADMIN'],
  },
  {
    key: 'capa.ai.generate_report',
    module: 'CAPA',
    action: 'EXECUTE',
    displayName: 'AI CAPA Report Generation',
    description: 'Generate AI-powered CAPA summary reports',
    category: 'CAPA',
    sortOrder: 309,
    defaultRoles: ['SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'CI_MANAGER', 'ADMIN'],
  },

  // ============================================================================
  // FMIR MODULE - Core Operations
  // ============================================================================
  {
    key: 'fmir.view',
    module: 'FMIR',
    action: 'VIEW',
    displayName: 'View FMIR Reports',
    description: 'View foreign material incident reports (own and visible)',
    category: 'Foreign Material',
    sortOrder: 400,
    defaultRoles: ['OPERATOR', 'SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'MAINTENANCE_ENGINEERING', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN'],
  },
  {
    key: 'fmir.view_all',
    module: 'FMIR',
    action: 'VIEW',
    displayName: 'View All Organization FMIRs',
    description: 'View all FMIR reports across the organization regardless of visibility',
    category: 'Foreign Material',
    sortOrder: 401,
    defaultRoles: ['QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'CI_MANAGER', 'ADMIN'],
  },
  {
    key: 'fmir.create',
    module: 'FMIR',
    action: 'CREATE',
    displayName: 'Create FMIR Reports',
    description: 'Create new foreign material incident reports',
    category: 'Foreign Material',
    sortOrder: 402,
    defaultRoles: ['OPERATOR', 'SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'MAINTENANCE_ENGINEERING', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN'],
  },
  {
    key: 'fmir.edit',
    module: 'FMIR',
    action: 'EDIT',
    displayName: 'Edit Own FMIR Reports',
    description: 'Edit FMIR reports you created or are a collaborator on',
    category: 'Foreign Material',
    sortOrder: 403,
    defaultRoles: ['OPERATOR', 'SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'MAINTENANCE_ENGINEERING', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN'],
  },
  {
    key: 'fmir.edit_any',
    module: 'FMIR',
    action: 'EDIT',
    displayName: 'Edit Any FMIR Report',
    description: 'Edit any FMIR report in the organization',
    category: 'Foreign Material',
    sortOrder: 404,
    defaultRoles: ['QUALITY_CONTROL_MANAGER', 'CI_MANAGER', 'ADMIN'],
  },
  {
    key: 'fmir.delete',
    module: 'FMIR',
    action: 'DELETE',
    displayName: 'Delete Own FMIR Reports',
    description: 'Delete FMIR reports you created (before visibility is enabled)',
    category: 'Foreign Material',
    sortOrder: 405,
    defaultRoles: ['OPERATOR', 'SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'MAINTENANCE_ENGINEERING', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN'],
  },
  {
    key: 'fmir.delete_visible',
    module: 'FMIR',
    action: 'DELETE',
    displayName: 'Delete Visible FMIR Reports',
    description: 'Delete any visible FMIR report in the organization',
    category: 'Foreign Material',
    sortOrder: 406,
    defaultRoles: ['QUALITY_CONTROL_MANAGER', 'ADMIN'],
  },

  // ============================================================================
  // FMIR MODULE - Status Management
  // ============================================================================
  {
    key: 'fmir.submit',
    module: 'FMIR',
    action: 'EXECUTE',
    displayName: 'Submit FMIR Reports',
    description: 'Submit FMIR reports for review (Draft → Submitted)',
    category: 'Foreign Material',
    sortOrder: 410,
    defaultRoles: ['OPERATOR', 'SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'MAINTENANCE_ENGINEERING', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN'],
  },
  {
    key: 'fmir.change_status',
    module: 'FMIR',
    action: 'MANAGE',
    displayName: 'Change FMIR Status',
    description: 'Change FMIR report status workflow',
    category: 'Foreign Material',
    sortOrder: 411,
    defaultRoles: ['QUALITY_CONTROL_MANAGER', 'CI_MANAGER', 'ADMIN'],
  },
  {
    key: 'fmir.toggle_investigation',
    module: 'FMIR',
    action: 'MANAGE',
    displayName: 'Toggle Investigation Mode',
    description: 'Start or stop FMIR investigation status',
    category: 'Foreign Material',
    sortOrder: 412,
    defaultRoles: ['QUALITY_CONTROL_MANAGER', 'SAFETY_SECURITY_MANAGER', 'ADMIN'],
  },
  {
    key: 'fmir.close',
    module: 'FMIR',
    action: 'MANAGE',
    displayName: 'Close/Reopen FMIR',
    description: 'Close or reopen FMIR investigations (lock/unlock)',
    category: 'Foreign Material',
    sortOrder: 413,
    defaultRoles: ['QUALITY_CONTROL_MANAGER'],
  },
  {
    key: 'fmir.toggle_visibility',
    module: 'FMIR',
    action: 'MANAGE',
    displayName: 'Toggle FMIR Visibility',
    description: 'Toggle visibility to make FMIR reports visible to collaborators',
    category: 'Foreign Material',
    sortOrder: 414,
    defaultRoles: ['OPERATOR', 'SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'MAINTENANCE_ENGINEERING', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN'],
  },

  // ============================================================================
  // FMIR MODULE - Evidence Management
  // ============================================================================
  {
    key: 'fmir.evidence.upload',
    module: 'FMIR',
    action: 'CREATE',
    displayName: 'Upload FMIR Evidence',
    description: 'Upload photos, videos, and documents as evidence',
    category: 'Foreign Material',
    sortOrder: 420,
    defaultRoles: ['OPERATOR', 'SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'MAINTENANCE_ENGINEERING', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN'],
  },
  {
    key: 'fmir.evidence.download',
    module: 'FMIR',
    action: 'VIEW',
    displayName: 'Download FMIR Evidence',
    description: 'Download evidence files from FMIR reports',
    category: 'Foreign Material',
    sortOrder: 421,
    defaultRoles: ['OPERATOR', 'SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'MAINTENANCE_ENGINEERING', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN'],
  },
  {
    key: 'fmir.evidence.delete',
    module: 'FMIR',
    action: 'DELETE',
    displayName: 'Delete FMIR Evidence',
    description: 'Delete evidence files from FMIR reports',
    category: 'Foreign Material',
    sortOrder: 422,
    defaultRoles: ['OPERATOR', 'SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'MAINTENANCE_ENGINEERING', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN'],
  },
  {
    key: 'fmir.evidence.edit',
    module: 'FMIR',
    action: 'EDIT',
    displayName: 'Edit FMIR Evidence',
    description: 'Rename, crop, or replace evidence files',
    category: 'Foreign Material',
    sortOrder: 423,
    defaultRoles: ['OPERATOR', 'SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'MAINTENANCE_ENGINEERING', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN'],
  },

  // ============================================================================
  // FMIR MODULE - Collaborator Management
  // ============================================================================
  {
    key: 'fmir.collaborators.view',
    module: 'FMIR',
    action: 'VIEW',
    displayName: 'View FMIR Collaborators',
    description: 'View list of collaborators on FMIR reports',
    category: 'Foreign Material',
    sortOrder: 430,
    defaultRoles: ['OPERATOR', 'SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'MAINTENANCE_ENGINEERING', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN'],
  },
  {
    key: 'fmir.collaborators.add',
    module: 'FMIR',
    action: 'MANAGE',
    displayName: 'Add FMIR Collaborators',
    description: 'Add collaborators to FMIR reports',
    category: 'Foreign Material',
    sortOrder: 431,
    defaultRoles: ['OPERATOR', 'SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'MAINTENANCE_ENGINEERING', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN'],
  },
  {
    key: 'fmir.collaborators.remove',
    module: 'FMIR',
    action: 'MANAGE',
    displayName: 'Remove FMIR Collaborators',
    description: 'Remove collaborators from FMIR reports',
    category: 'Foreign Material',
    sortOrder: 432,
    defaultRoles: ['OPERATOR', 'SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'MAINTENANCE_ENGINEERING', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN'],
  },

  // ============================================================================
  // FMIR MODULE - AI Features
  // ============================================================================
  {
    key: 'fmir.ai.validate_submit',
    module: 'FMIR',
    action: 'EXECUTE',
    displayName: 'AI Submission Validation',
    description: 'Use AI to validate FMIR completeness before submission',
    category: 'Foreign Material',
    sortOrder: 440,
    defaultRoles: ['OPERATOR', 'SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'MAINTENANCE_ENGINEERING', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN'],
  },
  {
    key: 'fmir.ai.validate_lock',
    module: 'FMIR',
    action: 'EXECUTE',
    displayName: 'AI Lock Compliance Check',
    description: 'Use AI compliance analysis before locking FMIR',
    category: 'Foreign Material',
    sortOrder: 441,
    defaultRoles: ['QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'ADMIN'],
  },
  {
    key: 'fmir.ai.explain_regulation',
    module: 'FMIR',
    action: 'VIEW',
    displayName: 'AI Regulation Explanation',
    description: 'Get AI explanations for food safety regulations',
    category: 'Foreign Material',
    sortOrder: 442,
    defaultRoles: ['OPERATOR', 'SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'MAINTENANCE_ENGINEERING', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN'],
  },
  {
    key: 'fmir.ai.enhance_text',
    module: 'FMIR',
    action: 'EXECUTE',
    displayName: 'AI Text Enhancement',
    description: 'Use AI to improve grammar and clarity in FMIR fields',
    category: 'Foreign Material',
    sortOrder: 443,
    defaultRoles: ['OPERATOR', 'SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'MAINTENANCE_ENGINEERING', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN'],
  },
  {
    key: 'fmir.ai.generate_audit',
    module: 'FMIR',
    action: 'EXECUTE',
    displayName: 'Generate AI Audit Report',
    description: 'Generate AI-powered audit reports when closing FMIR',
    category: 'Foreign Material',
    sortOrder: 444,
    defaultRoles: ['QUALITY_CONTROL_MANAGER', 'ADMIN'],
  },

  // ============================================================================
  // FMIR MODULE - Comments
  // ============================================================================
  {
    key: 'fmir.comments.view',
    module: 'FMIR',
    action: 'VIEW',
    displayName: 'View FMIR Comments',
    description: 'View comments on FMIR report sections',
    category: 'Foreign Material',
    sortOrder: 450,
    defaultRoles: ['OPERATOR', 'SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'MAINTENANCE_ENGINEERING', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN'],
  },
  {
    key: 'fmir.comments.add',
    module: 'FMIR',
    action: 'CREATE',
    displayName: 'Add FMIR Comments',
    description: 'Add comments to FMIR report sections',
    category: 'Foreign Material',
    sortOrder: 451,
    defaultRoles: ['QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'CI_MANAGER', 'ADMIN'],
  },
  {
    key: 'fmir.comments.delete',
    module: 'FMIR',
    action: 'DELETE',
    displayName: 'Delete Own FMIR Comments',
    description: 'Delete your own comments from FMIR reports',
    category: 'Foreign Material',
    sortOrder: 452,
    defaultRoles: ['QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'CI_MANAGER', 'ADMIN'],
  },
  {
    key: 'fmir.comments.delete_any',
    module: 'FMIR',
    action: 'DELETE',
    displayName: 'Delete Any FMIR Comment',
    description: 'Delete any comment from FMIR reports',
    category: 'Foreign Material',
    sortOrder: 453,
    defaultRoles: ['QUALITY_CONTROL_MANAGER', 'ADMIN'],
  },

  // ============================================================================
  // FMIR MODULE - Audit History
  // ============================================================================
  {
    key: 'fmir.audit.view',
    module: 'FMIR',
    action: 'VIEW',
    displayName: 'View FMIR Audit History',
    description: 'View audit trail and history for FMIR reports',
    category: 'Foreign Material',
    sortOrder: 460,
    defaultRoles: ['SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'CI_MANAGER', 'ADMIN'],
  },
  {
    key: 'fmir.audit.view_org',
    module: 'FMIR',
    action: 'VIEW',
    displayName: 'View Organization Audits',
    description: 'View all FMIR audit reports across the organization',
    category: 'Foreign Material',
    sortOrder: 461,
    defaultRoles: ['QUALITY_CONTROL_MANAGER', 'CI_MANAGER', 'ADMIN'],
  },

  // ============================================================================
  // FMIR MODULE - Export Features
  // ============================================================================
  {
    key: 'fmir.export.print',
    module: 'FMIR',
    action: 'EXPORT',
    displayName: 'Print FMIR Reports',
    description: 'Print FMIR reports using browser print',
    category: 'Foreign Material',
    sortOrder: 470,
    defaultRoles: ['SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'MAINTENANCE_ENGINEERING', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN'],
  },
  {
    key: 'fmir.export.pdf',
    module: 'FMIR',
    action: 'EXPORT',
    displayName: 'Export FMIR as PDF',
    description: 'Export FMIR reports as PDF documents',
    category: 'Foreign Material',
    sortOrder: 471,
    defaultRoles: ['SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'MAINTENANCE_ENGINEERING', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN'],
  },

  // ============================================================================
  // FMIR MODULE - Assignment Features
  // ============================================================================
  {
    key: 'fmir.assign.line',
    module: 'FMIR',
    action: 'MANAGE',
    displayName: 'Assign FMIR to Line',
    description: 'Assign FMIR reports to production lines',
    category: 'Foreign Material',
    sortOrder: 480,
    defaultRoles: ['OPERATOR', 'SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'CI_MANAGER', 'ADMIN'],
  },
  {
    key: 'fmir.assign.area',
    module: 'FMIR',
    action: 'MANAGE',
    displayName: 'Assign FMIR to Area',
    description: 'Assign FMIR reports to facility areas',
    category: 'Foreign Material',
    sortOrder: 481,
    defaultRoles: ['OPERATOR', 'SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'CI_MANAGER', 'ADMIN'],
  },
  {
    key: 'fmir.assign.qa_user',
    module: 'FMIR',
    action: 'MANAGE',
    displayName: 'Assign QA User to FMIR',
    description: 'Assign QA personnel to FMIR reports',
    category: 'Foreign Material',
    sortOrder: 482,
    defaultRoles: ['SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'CI_MANAGER', 'ADMIN'],
  },

  // ============================================================================
  // FMIR MODULE - RCA Integration
  // ============================================================================
  {
    key: 'fmir.link_rca',
    module: 'FMIR',
    action: 'MANAGE',
    displayName: 'Link FMIR to RCA',
    description: 'Link FMIR reports to Root Cause Analysis',
    category: 'Foreign Material',
    sortOrder: 490,
    defaultRoles: ['SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'CI_MANAGER', 'ADMIN'],
  },

  // ============================================================================
  // WORKPLACE REPORT MODULE
  // ============================================================================
  {
    key: 'workplace_report.view',
    module: 'WORKPLACE_REPORT',
    action: 'VIEW',
    displayName: 'View Workplace Reports',
    description: 'Access workplace safety report section',
    category: 'Reports',
    sortOrder: 500,
    defaultRoles: ['SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'MAINTENANCE_ENGINEERING', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN'],
  },
  {
    key: 'workplace_report.generate',
    module: 'WORKPLACE_REPORT',
    action: 'EXECUTE',
    displayName: 'Generate Workplace Reports',
    description: 'Generate PDF and Excel workplace reports',
    category: 'Reports',
    sortOrder: 501,
    defaultRoles: ['SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'MAINTENANCE_ENGINEERING', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN'],
  },

  // ============================================================================
  // INVESTIGATION REPORT MODULE
  // ============================================================================
  {
    key: 'investigation_report.view',
    module: 'INVESTIGATION_REPORT',
    action: 'VIEW',
    displayName: 'View Investigation Reports',
    description: 'Access investigation report section',
    category: 'Reports',
    sortOrder: 510,
    defaultRoles: ['SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'MAINTENANCE_ENGINEERING', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN'],
  },
  {
    key: 'investigation_report.generate',
    module: 'INVESTIGATION_REPORT',
    action: 'EXECUTE',
    displayName: 'Generate Investigation Reports',
    description: 'Generate investigation report PDFs',
    category: 'Reports',
    sortOrder: 511,
    defaultRoles: ['SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'MAINTENANCE_ENGINEERING', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN'],
  },

  // ============================================================================
  // SAFETY ASSESSMENT MODULE
  // ============================================================================
  {
    key: 'safety_assessment.view',
    module: 'SAFETY_ASSESSMENT',
    action: 'VIEW',
    displayName: 'View Safety Assessments',
    description: 'View workplace safety assessment list and details',
    category: 'Safety Assessment',
    sortOrder: 520,
    defaultRoles: ['OPERATOR', 'SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'MAINTENANCE_ENGINEERING', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN'],
  },
  {
    key: 'safety_assessment.view_all',
    module: 'SAFETY_ASSESSMENT',
    action: 'VIEW',
    displayName: 'View All Safety Assessments',
    description: 'View all safety assessments across the organization',
    category: 'Safety Assessment',
    sortOrder: 521,
    defaultRoles: ['SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN'],
  },
  {
    key: 'safety_assessment.create',
    module: 'SAFETY_ASSESSMENT',
    action: 'CREATE',
    displayName: 'Create Safety Assessments',
    description: 'Create new workplace safety assessments',
    category: 'Safety Assessment',
    sortOrder: 522,
    defaultRoles: ['SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'MAINTENANCE_ENGINEERING', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN'],
  },
  {
    key: 'safety_assessment.edit',
    module: 'SAFETY_ASSESSMENT',
    action: 'EDIT',
    displayName: 'Edit Safety Assessments',
    description: 'Edit own safety assessment details',
    category: 'Safety Assessment',
    sortOrder: 523,
    defaultRoles: ['SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'MAINTENANCE_ENGINEERING', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN'],
  },
  {
    key: 'safety_assessment.edit_any',
    module: 'SAFETY_ASSESSMENT',
    action: 'EDIT',
    displayName: 'Edit Any Safety Assessment',
    description: 'Edit any safety assessment in the organization',
    category: 'Safety Assessment',
    sortOrder: 524,
    defaultRoles: ['SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN'],
  },
  {
    key: 'safety_assessment.delete',
    module: 'SAFETY_ASSESSMENT',
    action: 'DELETE',
    displayName: 'Delete Safety Assessments',
    description: 'Delete safety assessment reports',
    category: 'Safety Assessment',
    sortOrder: 525,
    defaultRoles: ['SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN'],
  },
  {
    key: 'safety_assessment.submit',
    module: 'SAFETY_ASSESSMENT',
    action: 'EXECUTE',
    displayName: 'Submit Safety Assessments',
    description: 'Submit completed safety assessments for review',
    category: 'Safety Assessment',
    sortOrder: 526,
    defaultRoles: ['SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'MAINTENANCE_ENGINEERING', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN'],
  },
  {
    key: 'safety_assessment.approve',
    module: 'SAFETY_ASSESSMENT',
    action: 'MANAGE',
    displayName: 'Approve Safety Assessments',
    description: 'Review and approve submitted safety assessments',
    category: 'Safety Assessment',
    sortOrder: 527,
    defaultRoles: ['QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN'],
  },
  {
    key: 'safety_assessment.sign',
    module: 'SAFETY_ASSESSMENT',
    action: 'EXECUTE',
    displayName: 'Sign Safety Assessments',
    description: 'Add digital signature to safety assessments',
    category: 'Safety Assessment',
    sortOrder: 528,
    defaultRoles: ['SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'MAINTENANCE_ENGINEERING', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN'],
  },
  {
    key: 'safety_assessment.generate_report',
    module: 'SAFETY_ASSESSMENT',
    action: 'EXECUTE',
    displayName: 'Generate Assessment Reports',
    description: 'Generate and print safety assessment PDF reports',
    category: 'Safety Assessment',
    sortOrder: 529,
    defaultRoles: ['SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'MAINTENANCE_ENGINEERING', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN'],
  },
  {
    key: 'safety_assessment.manage_work_orders',
    module: 'SAFETY_ASSESSMENT',
    action: 'MANAGE',
    displayName: 'Manage Work Orders',
    description: 'Create and manage work orders from safety assessments',
    category: 'Safety Assessment',
    sortOrder: 530,
    defaultRoles: ['SUPERVISOR', 'MAINTENANCE_ENGINEERING', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN'],
  },

  // ============================================================================
  // KNOWLEDGE BASE MODULE
  // ============================================================================
  {
    key: 'knowledge.view',
    module: 'KNOWLEDGE_BASE',
    action: 'VIEW',
    displayName: 'View Knowledge Base',
    description: 'Access knowledge base articles',
    category: 'Knowledge Base',
    sortOrder: 600,
    defaultRoles: ['SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'MAINTENANCE_ENGINEERING', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN'],
  },
  {
    key: 'knowledge.create',
    module: 'KNOWLEDGE_BASE',
    action: 'CREATE',
    displayName: 'Create Knowledge Articles',
    description: 'Create new knowledge base articles',
    category: 'Knowledge Base',
    sortOrder: 601,
    defaultRoles: ['QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'CI_MANAGER', 'ADMIN'],
  },
  {
    key: 'knowledge.edit',
    module: 'KNOWLEDGE_BASE',
    action: 'EDIT',
    displayName: 'Edit Knowledge Articles',
    description: 'Modify existing knowledge base articles',
    category: 'Knowledge Base',
    sortOrder: 602,
    defaultRoles: ['QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'CI_MANAGER', 'ADMIN'],
  },
  {
    key: 'knowledge.delete',
    module: 'KNOWLEDGE_BASE',
    action: 'DELETE',
    displayName: 'Delete Knowledge Articles',
    description: 'Remove knowledge base articles',
    category: 'Knowledge Base',
    sortOrder: 603,
    defaultRoles: ['CI_MANAGER', 'ADMIN'],
  },

  // ============================================================================
  // ANALYTICS MODULE
  // ============================================================================
  {
    key: 'analytics.view',
    module: 'ANALYTICS',
    action: 'VIEW',
    displayName: 'View Analytics Dashboard',
    description: 'Access analytics and insights dashboard',
    category: 'Analytics',
    sortOrder: 700,
    defaultRoles: ['SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'MAINTENANCE_ENGINEERING', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN'],
  },
  {
    key: 'analytics.view_trends',
    module: 'ANALYTICS',
    action: 'VIEW',
    displayName: 'View Incident Trends',
    description: 'Access incident trend analytics',
    category: 'Analytics',
    sortOrder: 701,
    defaultRoles: ['QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'CI_MANAGER', 'ADMIN'],
  },
  {
    key: 'analytics.view_predictive',
    module: 'ANALYTICS',
    action: 'VIEW',
    displayName: 'View Predictive Insights',
    description: 'Access AI-powered predictive analytics',
    category: 'Analytics',
    sortOrder: 702,
    defaultRoles: ['CI_MANAGER', 'ADMIN'],
  },
  {
    key: 'analytics.export',
    module: 'ANALYTICS',
    action: 'EXPORT',
    displayName: 'Export Analytics Data',
    description: 'Export analytics data to files',
    category: 'Analytics',
    sortOrder: 703,
    defaultRoles: ['CI_MANAGER', 'ADMIN'],
  },

  // ============================================================================
  // REPORTS MODULE
  // ============================================================================
  {
    key: 'reports.view',
    module: 'REPORTS',
    action: 'VIEW',
    displayName: 'View Reports & Compliance',
    description: 'Access reports and compliance section',
    category: 'Reports & Compliance',
    sortOrder: 800,
    defaultRoles: ['SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'MAINTENANCE_ENGINEERING', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN'],
  },
  {
    key: 'reports.generate',
    module: 'REPORTS',
    action: 'EXECUTE',
    displayName: 'Generate Reports',
    description: 'Generate compliance and summary reports',
    category: 'Reports & Compliance',
    sortOrder: 801,
    defaultRoles: ['QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'CI_MANAGER', 'ADMIN'],
  },
  {
    key: 'reports.generate_powerpoint',
    module: 'REPORTS',
    action: 'EXECUTE',
    displayName: 'Generate Presentations',
    description: 'Generate PowerPoint presentations',
    category: 'Reports & Compliance',
    sortOrder: 802,
    defaultRoles: ['QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'CI_MANAGER', 'ADMIN'],
  },

  // ============================================================================
  // ADMIN MODULE
  // ============================================================================
  {
    key: 'admin.view_users',
    module: 'ADMIN',
    action: 'VIEW',
    displayName: 'View User List',
    description: 'View organization user directory',
    category: 'User Management',
    sortOrder: 900,
    defaultRoles: ['ADMIN', 'SYSTEM_ADMIN'],
  },
  {
    key: 'admin.manage_users',
    module: 'ADMIN',
    action: 'MANAGE',
    displayName: 'Manage Users',
    description: 'Activate, deactivate, and modify user accounts',
    category: 'User Management',
    sortOrder: 901,
    defaultRoles: ['ADMIN', 'SYSTEM_ADMIN'],
  },
  {
    key: 'admin.change_roles',
    module: 'ADMIN',
    action: 'MANAGE',
    displayName: 'Change User Roles',
    description: 'Modify user role assignments',
    category: 'User Management',
    sortOrder: 902,
    defaultRoles: ['ADMIN', 'SYSTEM_ADMIN'],
  },
  {
    key: 'admin.delete_users',
    module: 'ADMIN',
    action: 'DELETE',
    displayName: 'Delete Users',
    description: 'Permanently remove user accounts',
    category: 'User Management',
    sortOrder: 903,
    defaultRoles: ['SYSTEM_ADMIN'],
  },
  {
    key: 'admin.manage_facilities',
    module: 'ADMIN',
    action: 'MANAGE',
    displayName: 'Manage Facilities',
    description: 'Create, edit, and delete facilities',
    category: 'Organization Structure',
    sortOrder: 910,
    defaultRoles: ['ADMIN', 'SYSTEM_ADMIN'],
  },
  {
    key: 'admin.manage_departments',
    module: 'ADMIN',
    action: 'MANAGE',
    displayName: 'Manage Departments',
    description: 'Create, edit, and delete departments',
    category: 'Organization Structure',
    sortOrder: 911,
    defaultRoles: ['ADMIN', 'SYSTEM_ADMIN'],
  },
  {
    key: 'admin.manage_areas',
    module: 'ADMIN',
    action: 'MANAGE',
    displayName: 'Manage Areas',
    description: 'Create, edit, and delete areas',
    category: 'Organization Structure',
    sortOrder: 912,
    defaultRoles: ['ADMIN', 'SYSTEM_ADMIN'],
  },
  {
    key: 'admin.manage_lines',
    module: 'ADMIN',
    action: 'MANAGE',
    displayName: 'Manage Production Lines',
    description: 'Create, edit, and delete production lines',
    category: 'Organization Structure',
    sortOrder: 913,
    defaultRoles: ['ADMIN', 'SYSTEM_ADMIN'],
  },
  {
    key: 'admin.manage_shifts',
    module: 'ADMIN',
    action: 'MANAGE',
    displayName: 'Manage Shifts',
    description: 'Create, edit, and delete shift schedules',
    category: 'Organization Structure',
    sortOrder: 914,
    defaultRoles: ['ADMIN', 'SYSTEM_ADMIN'],
  },
  {
    key: 'admin.manage_categories',
    module: 'ADMIN',
    action: 'MANAGE',
    displayName: 'Manage Categories',
    description: 'Create, edit, and delete incident categories',
    category: 'Organization Structure',
    sortOrder: 915,
    defaultRoles: ['ADMIN', 'SYSTEM_ADMIN'],
  },
  {
    key: 'admin.manage_triage',
    module: 'ADMIN',
    action: 'MANAGE',
    displayName: 'Manage Triage Rules',
    description: 'Configure assignment and SLA rules',
    category: 'Organization Structure',
    sortOrder: 916,
    defaultRoles: ['ADMIN', 'SYSTEM_ADMIN'],
  },
  {
    key: 'admin.manage_access_codes',
    module: 'ADMIN',
    action: 'MANAGE',
    displayName: 'Manage Access Codes',
    description: 'Create and manage organization access codes',
    category: 'Access Control',
    sortOrder: 920,
    defaultRoles: ['ADMIN', 'SYSTEM_ADMIN'],
  },
  {
    key: 'admin.manage_privileges',
    module: 'ADMIN',
    action: 'MANAGE',
    displayName: 'Manage Role Privileges',
    description: 'Configure feature privileges for roles',
    category: 'Access Control',
    sortOrder: 921,
    defaultRoles: ['ADMIN', 'SYSTEM_ADMIN'],
  },
  {
    key: 'admin.view_audit_logs',
    module: 'ADMIN',
    action: 'VIEW',
    displayName: 'View Audit Logs',
    description: 'Access system audit trail',
    category: 'Compliance',
    sortOrder: 930,
    defaultRoles: ['ADMIN', 'SYSTEM_ADMIN'],
  },

  // ============================================================================
  // SYSTEM MODULE (SYSTEM_ADMIN only by default)
  // ============================================================================
  {
    key: 'system.view_all_orgs',
    module: 'SYSTEM',
    action: 'VIEW',
    displayName: 'View All Organizations',
    description: 'Access all organizations across the platform',
    category: 'System Administration',
    sortOrder: 1000,
    defaultRoles: ['SYSTEM_ADMIN'],
  },
  {
    key: 'system.manage_orgs',
    module: 'SYSTEM',
    action: 'MANAGE',
    displayName: 'Manage Organizations',
    description: 'Create, edit, and deactivate organizations',
    category: 'System Administration',
    sortOrder: 1001,
    defaultRoles: ['SYSTEM_ADMIN'],
  },
  {
    key: 'system.manage_policies',
    module: 'SYSTEM',
    action: 'MANAGE',
    displayName: 'Manage Policies',
    description: 'Edit and publish platform policies',
    category: 'System Administration',
    sortOrder: 1002,
    defaultRoles: ['SYSTEM_ADMIN'],
  },
  {
    key: 'system.view_support',
    module: 'SYSTEM',
    action: 'VIEW',
    displayName: 'View Support Requests',
    description: 'Access all support requests',
    category: 'System Administration',
    sortOrder: 1003,
    defaultRoles: ['SYSTEM_ADMIN'],
  },
  {
    key: 'system.manage_support',
    module: 'SYSTEM',
    action: 'MANAGE',
    displayName: 'Manage Support Requests',
    description: 'Respond to and resolve support requests',
    category: 'System Administration',
    sortOrder: 1004,
    defaultRoles: ['SYSTEM_ADMIN'],
  },

  // ============================================================================
  // CHAT MODULE
  // ============================================================================
  {
    key: 'chat.send_messages',
    module: 'CHAT',
    action: 'CREATE',
    displayName: 'Send Chat Messages',
    description: 'Send messages in incident chat',
    category: 'Collaboration',
    sortOrder: 1100,
    defaultRoles: ['OPERATOR', 'SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'MAINTENANCE_ENGINEERING', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN'],
  },
  {
    key: 'chat.delete_any_message',
    module: 'CHAT',
    action: 'DELETE',
    displayName: 'Delete Any Message',
    description: 'Delete any chat message in the organization',
    category: 'Collaboration',
    sortOrder: 1101,
    defaultRoles: ['ADMIN', 'SYSTEM_ADMIN'],
  },
  {
    key: 'chat.manage_action_items',
    module: 'CHAT',
    action: 'MANAGE',
    displayName: 'Manage Action Items',
    description: 'Create and manage chat action items',
    category: 'Collaboration',
    sortOrder: 1102,
    defaultRoles: ['SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'CI_MANAGER', 'ADMIN'],
  },

  // ============================================================================
  // NAVIGATION MODULE — Controls sidebar link visibility & page access
  // ============================================================================

  // ── Quick Navigation Links ──
  {
    key: 'nav.dashboard',
    module: 'NAVIGATION',
    action: 'VIEW',
    displayName: 'Dashboard',
    description: 'Access the main dashboard',
    category: 'Quick Navigation',
    sortOrder: 1200,
    defaultRoles: ['OPERATOR', 'SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'MAINTENANCE_ENGINEERING', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN'],
  },
  {
    key: 'nav.create_incident',
    module: 'NAVIGATION',
    action: 'VIEW',
    displayName: 'Create Incident',
    description: 'Access the create incident page',
    category: 'Quick Navigation',
    sortOrder: 1201,
    defaultRoles: ['OPERATOR', 'SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'MAINTENANCE_ENGINEERING', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN'],
  },
  {
    key: 'nav.my_incidents',
    module: 'NAVIGATION',
    action: 'VIEW',
    displayName: 'My Incidents',
    description: 'Access personal incident list',
    category: 'Quick Navigation',
    sortOrder: 1202,
    defaultRoles: ['OPERATOR', 'SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'MAINTENANCE_ENGINEERING', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN'],
  },
  {
    key: 'nav.team_incidents',
    module: 'NAVIGATION',
    action: 'VIEW',
    displayName: 'Team Incidents',
    description: 'Access team incident list',
    category: 'Quick Navigation',
    sortOrder: 1203,
    defaultRoles: ['SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'MAINTENANCE_ENGINEERING', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN'],
  },
  {
    key: 'nav.public_incidents',
    module: 'NAVIGATION',
    action: 'VIEW',
    displayName: 'Public Incidents',
    description: 'Access public incident list',
    category: 'Quick Navigation',
    sortOrder: 1204,
    defaultRoles: ['OPERATOR', 'SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'MAINTENANCE_ENGINEERING', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN'],
  },
  {
    key: 'nav.rca',
    module: 'NAVIGATION',
    action: 'VIEW',
    displayName: 'RCA Workspace',
    description: 'Access root cause analysis workspace',
    category: 'Quick Navigation',
    sortOrder: 1205,
    defaultRoles: ['SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'MAINTENANCE_ENGINEERING', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN'],
  },
  {
    key: 'nav.capa',
    module: 'NAVIGATION',
    action: 'VIEW',
    displayName: 'CAPA Board',
    description: 'Access corrective and preventive actions board',
    category: 'Quick Navigation',
    sortOrder: 1206,
    defaultRoles: ['SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'MAINTENANCE_ENGINEERING', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN'],
  },
  {
    key: 'nav.reports',
    module: 'NAVIGATION',
    action: 'VIEW',
    displayName: 'Reports & Compliance',
    description: 'Access reports and compliance dashboard',
    category: 'Quick Navigation',
    sortOrder: 1207,
    defaultRoles: ['SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'MAINTENANCE_ENGINEERING', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN'],
  },
  {
    key: 'nav.analytics',
    module: 'NAVIGATION',
    action: 'VIEW',
    displayName: 'Analytics & Insights',
    description: 'Access analytics dashboard',
    category: 'Quick Navigation',
    sortOrder: 1208,
    defaultRoles: ['SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'MAINTENANCE_ENGINEERING', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN'],
  },
  {
    key: 'nav.knowledge',
    module: 'NAVIGATION',
    action: 'VIEW',
    displayName: 'Knowledge Base',
    description: 'Access the knowledge base',
    category: 'Quick Navigation',
    sortOrder: 1209,
    defaultRoles: ['SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'MAINTENANCE_ENGINEERING', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN'],
  },
  {
    key: 'nav.workplace_report',
    module: 'NAVIGATION',
    action: 'VIEW',
    displayName: 'Workplace Report',
    description: 'Access workplace reports',
    category: 'Quick Navigation',
    sortOrder: 1210,
    defaultRoles: ['OPERATOR', 'SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'MAINTENANCE_ENGINEERING', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN'],
  },
  {
    key: 'nav.investigation_report',
    module: 'NAVIGATION',
    action: 'VIEW',
    displayName: 'Investigation Report',
    description: 'Access investigation reports',
    category: 'Quick Navigation',
    sortOrder: 1211,
    defaultRoles: ['OPERATOR', 'SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'MAINTENANCE_ENGINEERING', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN'],
  },
  {
    key: 'nav.fmir',
    module: 'NAVIGATION',
    action: 'VIEW',
    displayName: 'Foreign Material',
    description: 'Access foreign material incident reports',
    category: 'Quick Navigation',
    sortOrder: 1212,
    defaultRoles: ['OPERATOR', 'SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'MAINTENANCE_ENGINEERING', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN'],
  },
  {
    key: 'nav.safety_assessment',
    module: 'NAVIGATION',
    action: 'VIEW',
    displayName: 'Safety Assessment',
    description: 'Access workplace safety assessments',
    category: 'Quick Navigation',
    sortOrder: 1213,
    defaultRoles: ['SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'MAINTENANCE_ENGINEERING', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN'],
  },
  {
    key: 'nav.hr',
    module: 'NAVIGATION',
    action: 'VIEW',
    displayName: 'HR Resolution',
    description: 'Access HR conflict resolution',
    category: 'Quick Navigation',
    sortOrder: 1214,
    defaultRoles: ['SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN'],
  },
  {
    key: 'nav.bakery_metrics',
    module: 'NAVIGATION',
    action: 'VIEW',
    displayName: 'Bakery Metrics',
    description: 'Access bakery performance metrics',
    category: 'Quick Navigation',
    sortOrder: 1215,
    defaultRoles: ['OPERATOR', 'SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'MAINTENANCE_ENGINEERING', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN'],
  },
  {
    key: 'nav.lsw',
    module: 'NAVIGATION',
    action: 'VIEW',
    displayName: 'Leaders Standard Work',
    description: 'Access leader standard work boards',
    category: 'Quick Navigation',
    sortOrder: 1216,
    defaultRoles: ['OPERATOR', 'SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'MAINTENANCE_ENGINEERING', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN'],
  },
  {
    key: 'nav.vacation',
    module: 'NAVIGATION',
    action: 'VIEW',
    displayName: 'Vacation Hub',
    description: 'Access vacation management',
    category: 'Quick Navigation',
    sortOrder: 1217,
    defaultRoles: ['OPERATOR', 'SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'MAINTENANCE_ENGINEERING', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN'],
  },
  {
    key: 'nav.meetings',
    module: 'NAVIGATION',
    action: 'VIEW',
    displayName: 'Meeting Intelligence',
    description: 'Access meeting intelligence',
    category: 'Quick Navigation',
    sortOrder: 1218,
    defaultRoles: ['OPERATOR', 'SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'MAINTENANCE_ENGINEERING', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN'],
  },
  {
    key: 'nav.operations',
    module: 'NAVIGATION',
    action: 'VIEW',
    displayName: 'Operations',
    description: 'Access operations issue tracking',
    category: 'Quick Navigation',
    sortOrder: 1219,
    defaultRoles: ['OPERATOR', 'SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'MAINTENANCE_ENGINEERING', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN'],
  },
  {
    key: 'nav.action_items',
    module: 'NAVIGATION',
    action: 'VIEW',
    displayName: 'My Action Items',
    description: 'Access assigned action items',
    category: 'Quick Navigation',
    sortOrder: 1220,
    defaultRoles: ['OPERATOR', 'SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'MAINTENANCE_ENGINEERING', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN'],
  },

  // ── Organization Management Links ──
  {
    key: 'nav.admin_organizations',
    module: 'NAVIGATION',
    action: 'VIEW',
    displayName: 'Organizations',
    description: 'Access organization management',
    category: 'Organization Management',
    sortOrder: 1300,
    defaultRoles: ['ADMIN'],
  },
  {
    key: 'nav.admin_facilities',
    module: 'NAVIGATION',
    action: 'VIEW',
    displayName: 'Facilities',
    description: 'Access facility management',
    category: 'Organization Management',
    sortOrder: 1301,
    defaultRoles: ['ADMIN'],
  },
  {
    key: 'nav.admin_departments',
    module: 'NAVIGATION',
    action: 'VIEW',
    displayName: 'Departments',
    description: 'Access department management',
    category: 'Organization Management',
    sortOrder: 1302,
    defaultRoles: ['ADMIN'],
  },
  {
    key: 'nav.admin_areas',
    module: 'NAVIGATION',
    action: 'VIEW',
    displayName: 'Areas',
    description: 'Access area management',
    category: 'Organization Management',
    sortOrder: 1303,
    defaultRoles: ['ADMIN'],
  },
  {
    key: 'nav.admin_lines',
    module: 'NAVIGATION',
    action: 'VIEW',
    displayName: 'Lines',
    description: 'Access production line management',
    category: 'Organization Management',
    sortOrder: 1304,
    defaultRoles: ['ADMIN'],
  },
  {
    key: 'nav.admin_equipment',
    module: 'NAVIGATION',
    action: 'VIEW',
    displayName: 'Machine Registry',
    description: 'Access machine/equipment registry',
    category: 'Organization Management',
    sortOrder: 1305,
    defaultRoles: ['ADMIN'],
  },
  {
    key: 'nav.admin_shifts',
    module: 'NAVIGATION',
    action: 'VIEW',
    displayName: 'Shifts',
    description: 'Access shift management',
    category: 'Organization Management',
    sortOrder: 1306,
    defaultRoles: ['ADMIN'],
  },
  {
    key: 'nav.admin_categories',
    module: 'NAVIGATION',
    action: 'VIEW',
    displayName: 'Categories',
    description: 'Access incident category management',
    category: 'Organization Management',
    sortOrder: 1307,
    defaultRoles: ['ADMIN'],
  },
  {
    key: 'nav.admin_users',
    module: 'NAVIGATION',
    action: 'VIEW',
    displayName: 'User Management',
    description: 'Access user management',
    category: 'Organization Management',
    sortOrder: 1308,
    defaultRoles: ['ADMIN'],
  },
  {
    key: 'nav.admin_invitations',
    module: 'NAVIGATION',
    action: 'VIEW',
    displayName: 'Invitations',
    description: 'Access invitation management',
    category: 'Organization Management',
    sortOrder: 1309,
    defaultRoles: ['ADMIN'],
  },
  {
    key: 'nav.admin_privileges',
    module: 'NAVIGATION',
    action: 'VIEW',
    displayName: 'Role Privileges',
    description: 'Access role privilege configuration',
    category: 'Organization Management',
    sortOrder: 1310,
    defaultRoles: ['ADMIN'],
  },
  {
    key: 'nav.admin_work_orders',
    module: 'NAVIGATION',
    action: 'VIEW',
    displayName: 'Work Order Templates',
    description: 'Access work order template management',
    category: 'Organization Management',
    sortOrder: 1311,
    defaultRoles: ['ADMIN'],
  },
  {
    key: 'nav.admin_enterprise',
    module: 'NAVIGATION',
    action: 'VIEW',
    displayName: 'Enterprise',
    description: 'Access enterprise settings',
    category: 'Organization Management',
    sortOrder: 1312,
    defaultRoles: ['ADMIN'],
  },
  {
    key: 'nav.admin_calendar',
    module: 'NAVIGATION',
    action: 'VIEW',
    displayName: 'Calendar Year Config',
    description: 'Access calendar year configuration',
    category: 'Organization Management',
    sortOrder: 1313,
    defaultRoles: ['ADMIN'],
  },
  {
    key: 'nav.admin_bakery_settings',
    module: 'NAVIGATION',
    action: 'VIEW',
    displayName: 'Bakery KPI Settings',
    description: 'Access bakery KPI settings',
    category: 'Organization Management',
    sortOrder: 1314,
    defaultRoles: ['ADMIN'],
  },
  {
    key: 'nav.support_inbox',
    module: 'NAVIGATION',
    action: 'VIEW',
    displayName: 'Support Inbox',
    description: 'Access support inbox',
    category: 'Organization Management',
    sortOrder: 1315,
    defaultRoles: ['QUALITY_CONTROL_MANAGER', 'ADMIN'],
  },
];

// ============================================================================
// API ENDPOINTS
// ============================================================================

/**
 * @route   GET /api/privileges/definitions
 * @desc    Get all privilege definitions (master list)
 * @access  Private (ADMIN+)
 */
router.get(
  '/definitions',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthRequest;
    const userRole = authReq.user?.role;

    if (!['ADMIN', 'SYSTEM_ADMIN'].includes(userRole || '')) {
      res.status(403).json({ error: 'Access denied. Admin privileges required.' });
      return;
    }

    // Group by category for better UI presentation
    const grouped = PRIVILEGE_DEFINITIONS.reduce((acc, priv) => {
      if (!acc[priv.category]) {
        acc[priv.category] = [];
      }
      acc[priv.category].push(priv);
      return acc;
    }, {} as Record<string, PrivilegeDefinition[]>);

    res.json({
      success: true,
      data: {
        definitions: PRIVILEGE_DEFINITIONS,
        grouped,
        modules: Object.values(FeatureModule),
        actions: Object.values(PrivilegeAction),
        roles: Object.values(UserRole),
      },
    });
  })
);

/**
 * @route   GET /api/privileges/organization
 * @desc    Get all privilege settings for the organization
 * @access  Private (ADMIN+)
 */
router.get(
  '/organization',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthRequest;
    const userRole = authReq.user?.role;
    const userOrgId = authReq.user?.organizationId;

    if (!['ADMIN', 'SYSTEM_ADMIN'].includes(userRole || '')) {
      res.status(403).json({ error: 'Access denied. Admin privileges required.' });
      return;
    }

    if (!userOrgId) {
      res.status(400).json({ error: 'Organization not found' });
      return;
    }

    // Get existing privilege overrides for this organization
    const privileges = await prisma.rolePrivilege.findMany({
      where: { organizationId: userOrgId },
      orderBy: [{ role: 'asc' }, { featureKey: 'asc' }],
    });

    // Build a complete matrix: for each role, for each privilege, what's the status
    const matrix: Record<string, Record<string, boolean>> = {};
    const allRoles = Object.values(UserRole);

    // Initialize with defaults
    for (const role of allRoles) {
      matrix[role] = {};
      for (const def of PRIVILEGE_DEFINITIONS) {
        matrix[role][def.key] = def.defaultRoles.includes(role as UserRole);
      }
    }

    // Apply organization overrides
    for (const priv of privileges) {
      if (matrix[priv.role]) {
        matrix[priv.role][priv.featureKey] = priv.isEnabled;
      }
    }

    res.json({
      success: true,
      data: {
        matrix,
        overrides: privileges,
        definitions: PRIVILEGE_DEFINITIONS,
      },
    });
  })
);

/**
 * @route   PUT /api/privileges/organization
 * @desc    Update privilege settings for a role in the organization
 * @access  Private (ADMIN+, or QUALITY_CONTROL_MANAGER for FMIR privileges only)
 */
router.put(
  '/organization',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthRequest;
    const userRole = authReq.user?.role;
    const userOrgId = authReq.user?.organizationId;
    const userId = authReq.user?.id;

    // Allow QUALITY_CONTROL_MANAGER to manage FMIR privileges
    const isQCM = userRole === 'QUALITY_CONTROL_MANAGER';
    const isAdmin = ['ADMIN', 'SYSTEM_ADMIN'].includes(userRole || '');

    if (!isAdmin && !isQCM) {
      res.status(403).json({ error: 'Access denied. Admin or Quality Control Manager privileges required.' });
      return;
    }

    if (!userOrgId) {
      res.status(400).json({ error: 'Organization not found' });
      return;
    }

    const { role, featureKey, isEnabled, description } = req.body;

    if (!role || !featureKey || typeof isEnabled !== 'boolean') {
      res.status(400).json({ error: 'Missing required fields: role, featureKey, isEnabled' });
      return;
    }

    // Find the privilege definition
    const definition = PRIVILEGE_DEFINITIONS.find(d => d.key === featureKey);
    if (!definition) {
      res.status(400).json({ error: 'Invalid privilege key' });
      return;
    }

    // QCM can only modify FMIR privileges
    if (isQCM && !isAdmin && definition.module !== 'FMIR') {
      res.status(403).json({ error: 'Quality Control Managers can only manage Foreign Material privileges' });
      return;
    }

    // Prevent modifying SYSTEM_ADMIN privileges (they should always have full access)
    if (role === 'SYSTEM_ADMIN') {
      res.status(403).json({ error: 'Cannot modify SYSTEM_ADMIN privileges' });
      return;
    }

    // Get current value for audit log
    const existingPrivilege = await prisma.rolePrivilege.findUnique({
      where: {
        organizationId_role_featureKey: {
          organizationId: userOrgId,
          role: role as UserRole,
          featureKey,
        },
      },
    });

    // Determine previous value (check org override or default)
    const previousValue = existingPrivilege 
      ? existingPrivilege.isEnabled 
      : definition.defaultRoles.includes(role as UserRole);

    // Skip if no actual change
    if (previousValue === isEnabled) {
      res.json({
        success: true,
        message: 'No change needed - privilege already set to this value',
        data: existingPrivilege || { isEnabled },
      });
      return;
    }

    // Get user info for audit log
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true, role: true },
    });
    const changedByName = user ? `${user.firstName} ${user.lastName}` : 'Unknown User';

    // Upsert the privilege override
    const privilege = await prisma.rolePrivilege.upsert({
      where: {
        organizationId_role_featureKey: {
          organizationId: userOrgId,
          role: role as UserRole,
          featureKey,
        },
      },
      update: {
        isEnabled,
        updatedAt: new Date(),
      },
      create: {
        id: uuidv4(),
        organizationId: userOrgId,
        role: role as UserRole,
        module: definition.module,
        featureKey,
        action: definition.action,
        isEnabled,
        description: definition.description,
        createdById: userId,
        updatedAt: new Date(),
      },
    });

    // Create audit log entry
    const auditLog = await createAuditLog({
      organizationId: userOrgId,
      role: role as UserRole,
      module: definition.module,
      featureKey,
      action: definition.action,
      displayName: definition.displayName,
      previousValue,
      newValue: isEnabled,
      changeType: isEnabled ? 'enable' : 'disable',
      changedById: userId!,
      changedByName,
      changedByRole: user?.role as UserRole,
      description: description || `${isEnabled ? 'Enabled' : 'Disabled'} ${definition.displayName} for ${role}`,
      ipAddress: req.ip || req.socket.remoteAddress,
      userAgent: req.get('user-agent'),
    });

    // Broadcast privilege change to all users in the organization
    websocketService.emitToOrganization(userOrgId, 'privilege:changed', {
      organizationId: userOrgId,
      affectedRoles: [role],
      role,
      featureKey,
      isEnabled,
      changedBy: changedByName,
      changedAt: new Date().toISOString(),
      auditLogId: auditLog.id,
    });

    res.json({
      success: true,
      data: privilege,
      auditLogId: auditLog.id,
      message: `Privilege ${featureKey} for ${role} set to ${isEnabled ? 'enabled' : 'disabled'}`,
    });
  })
);

/**
 * @route   PUT /api/privileges/organization/bulk
 * @desc    Bulk update privileges for a role
 * @access  Private (ADMIN+)
 */
router.put(
  '/organization/bulk',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthRequest;
    const userRole = authReq.user?.role;
    const userOrgId = authReq.user?.organizationId;
    const userId = authReq.user?.id;

    if (!['ADMIN', 'SYSTEM_ADMIN'].includes(userRole || '')) {
      res.status(403).json({ error: 'Access denied. Admin privileges required.' });
      return;
    }

    if (!userOrgId) {
      res.status(400).json({ error: 'Organization not found' });
      return;
    }

    const { role, privileges } = req.body;

    if (!role || !privileges || !Array.isArray(privileges)) {
      res.status(400).json({ error: 'Missing required fields: role, privileges[]' });
      return;
    }

    if (role === 'SYSTEM_ADMIN') {
      res.status(403).json({ error: 'Cannot modify SYSTEM_ADMIN privileges' });
      return;
    }

    const results = [];

    for (const { featureKey, isEnabled } of privileges) {
      const definition = PRIVILEGE_DEFINITIONS.find(d => d.key === featureKey);
      if (!definition) continue;

      const privilege = await prisma.rolePrivilege.upsert({
        where: {
          organizationId_role_featureKey: {
            organizationId: userOrgId,
            role: role as UserRole,
            featureKey,
          },
        },
        update: {
          isEnabled,
          updatedAt: new Date(),
        },
        create: {
          id: uuidv4(),
          organizationId: userOrgId,
          role: role as UserRole,
          module: definition.module,
          featureKey,
          action: definition.action,
          isEnabled,
          description: definition.description,
          createdById: userId,
          updatedAt: new Date(),
        },
      });

      results.push(privilege);
    }

    // Broadcast privilege change to all users in the organization
    websocketService.emitToOrganization(userOrgId, 'privilege:changed', {
      organizationId: userOrgId,
      affectedRoles: [role],
      role,
      bulkUpdate: true,
      count: results.length,
      changedBy: `${authReq.user?.firstName || ''} ${authReq.user?.lastName || ''}`.trim() || 'Admin',
      changedAt: new Date().toISOString(),
    });

    res.json({
      success: true,
      data: results,
      message: `Updated ${results.length} privileges for ${role}`,
    });
  })
);

/**
 * @route   POST /api/privileges/organization/reset
 * @desc    Reset all privileges for a role to defaults
 * @access  Private (ADMIN+)
 */
router.post(
  '/organization/reset',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthRequest;
    const userRole = authReq.user?.role;
    const userOrgId = authReq.user?.organizationId;

    if (!['ADMIN', 'SYSTEM_ADMIN'].includes(userRole || '')) {
      res.status(403).json({ error: 'Access denied. Admin privileges required.' });
      return;
    }

    if (!userOrgId) {
      res.status(400).json({ error: 'Organization not found' });
      return;
    }

    const { role } = req.body;

    if (role) {
      // Reset specific role
      await prisma.rolePrivilege.deleteMany({
        where: {
          organizationId: userOrgId,
          role: role as UserRole,
        },
      });
    } else {
      // Reset all roles
      await prisma.rolePrivilege.deleteMany({
        where: { organizationId: userOrgId },
      });
    }

    // Broadcast privilege change to all users in the organization
    // When role is 'ALL', don't specify affectedRoles so all users refresh
    websocketService.emitToOrganization(userOrgId, 'privilege:changed', {
      organizationId: userOrgId,
      affectedRoles: role ? [role] : undefined,
      role: role || 'ALL',
      reset: true,
      changedBy: `${authReq.user?.firstName || ''} ${authReq.user?.lastName || ''}`.trim() || 'Admin',
      changedAt: new Date().toISOString(),
    });

    res.json({
      success: true,
      message: role ? `Privileges reset to defaults for ${role}` : 'All privileges reset to defaults',
    });
  })
);

/**
 * @route   GET /api/privileges/check/:featureKey
 * @desc    Check if current user has a specific privilege
 * @access  Private
 */
router.get(
  '/check/:featureKey',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthRequest;
    const { featureKey } = req.params;
    const userRole = authReq.user?.role;
    const userOrgId = authReq.user?.organizationId;

    if (!userRole) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Find the definition
    const definition = PRIVILEGE_DEFINITIONS.find(d => d.key === featureKey);
    if (!definition) {
      res.status(400).json({ error: 'Invalid privilege key' });
      return;
    }

    // SYSTEM_ADMIN always has all privileges
    if (userRole === 'SYSTEM_ADMIN') {
      res.json({ success: true, hasPrivilege: true });
      return;
    }

    // Priority 1: Check for user-specific override (highest priority)
    if (userOrgId && authReq.user?.id) {
      const userOverride = await prisma.userPrivilegeOverride.findUnique({
        where: {
          userId_featureKey: {
            userId: authReq.user.id,
            featureKey,
          },
        },
      });
      if (userOverride) {
        res.json({ success: true, hasPrivilege: userOverride.isEnabled });
        return;
      }
    }

    // Priority 2: Check for organization role override
    if (userOrgId) {
      const override = await prisma.rolePrivilege.findUnique({
        where: {
          organizationId_role_featureKey: {
            organizationId: userOrgId,
            role: userRole as UserRole,
            featureKey,
          },
        },
      });

      if (override) {
        res.json({ success: true, hasPrivilege: override.isEnabled });
        return;
      }
    }

    // Fall back to default
    const hasPrivilege = definition.defaultRoles.includes(userRole as UserRole);
    res.json({ success: true, hasPrivilege });
  })
);

/**
 * @route   GET /api/privileges/my-privileges
 * @desc    Get all privileges for the current user
 * @access  Private
 */
router.get(
  '/my-privileges',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthRequest;
    const userRole = authReq.user?.role;
    const userOrgId = authReq.user?.organizationId;

    if (!userRole) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const privileges: Record<string, boolean> = {};

    // SYSTEM_ADMIN has all privileges
    if (userRole === 'SYSTEM_ADMIN') {
      for (const def of PRIVILEGE_DEFINITIONS) {
        privileges[def.key] = true;
      }
      res.json({ success: true, data: privileges });
      return;
    }

    // Get organization role overrides
    const roleOverrides: Record<string, boolean> = {};
    if (userOrgId) {
      const orgPrivileges = await prisma.rolePrivilege.findMany({
        where: {
          organizationId: userOrgId,
          role: userRole as UserRole,
        },
      });
      for (const priv of orgPrivileges) {
        roleOverrides[priv.featureKey] = priv.isEnabled;
      }
    }

    // Get user-specific overrides (highest priority)
    const userOverrides: Record<string, boolean> = {};
    if (authReq.user?.id) {
      const userPrivileges = await prisma.userPrivilegeOverride.findMany({
        where: { userId: authReq.user.id },
      });
      for (const priv of userPrivileges) {
        userOverrides[priv.featureKey] = priv.isEnabled;
      }
    }

    // Build complete privilege list: user override > role override > default
    for (const def of PRIVILEGE_DEFINITIONS) {
      if (def.key in userOverrides) {
        privileges[def.key] = userOverrides[def.key];
      } else if (def.key in roleOverrides) {
        privileges[def.key] = roleOverrides[def.key];
      } else {
        privileges[def.key] = def.defaultRoles.includes(userRole as UserRole);
      }
    }

    res.json({ success: true, data: privileges });
  })
);

// ============================================================================
// AUDIT LOG ENDPOINTS
// ============================================================================

/**
 * @route   GET /api/privileges/audit-logs
 * @desc    Get privilege audit logs for the organization
 * @access  Private (ADMIN+, or QUALITY_CONTROL_MANAGER for FMIR logs only)
 */
router.get(
  '/audit-logs',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthRequest;
    const userRole = authReq.user?.role;
    const userOrgId = authReq.user?.organizationId;

    const isQCM = userRole === 'QUALITY_CONTROL_MANAGER';
    const isAdmin = ['ADMIN', 'SYSTEM_ADMIN'].includes(userRole || '');

    if (!isAdmin && !isQCM) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    if (!userOrgId) {
      res.status(400).json({ error: 'Organization not found' });
      return;
    }

    const { 
      page = '1', 
      limit = '50', 
      role, 
      module, 
      featureKey,
      changedById,
      startDate,
      endDate,
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Build filter
    const where: any = { organizationId: userOrgId };

    // QCM can only see FMIR logs
    if (isQCM && !isAdmin) {
      where.module = 'FMIR';
    } else if (module) {
      where.module = module;
    }

    if (role) where.role = role;
    if (featureKey) where.featureKey = featureKey;
    if (changedById) where.changedById = changedById;
    if (startDate || endDate) {
      where.changedAt = {};
      if (startDate) where.changedAt.gte = new Date(startDate as string);
      if (endDate) where.changedAt.lte = new Date(endDate as string);
    }

    const [logs, total] = await Promise.all([
      prisma.privilegeAuditLog.findMany({
        where,
        orderBy: { changedAt: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.privilegeAuditLog.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        logs,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      },
    });
  })
);

/**
 * @route   GET /api/privileges/audit-logs/:id
 * @desc    Get a specific audit log entry
 * @access  Private (ADMIN+, or QUALITY_CONTROL_MANAGER for FMIR logs)
 */
router.get(
  '/audit-logs/:id',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthRequest;
    const userRole = authReq.user?.role;
    const userOrgId = authReq.user?.organizationId;
    const { id } = req.params;

    const isQCM = userRole === 'QUALITY_CONTROL_MANAGER';
    const isAdmin = ['ADMIN', 'SYSTEM_ADMIN'].includes(userRole || '');

    if (!isAdmin && !isQCM) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const log = await prisma.privilegeAuditLog.findUnique({
      where: { id },
    });

    if (!log || log.organizationId !== userOrgId) {
      res.status(404).json({ error: 'Audit log not found' });
      return;
    }

    // QCM can only see FMIR logs
    if (isQCM && !isAdmin && log.module !== 'FMIR') {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    res.json({ success: true, data: log });
  })
);

/**
 * @route   POST /api/privileges/audit-logs/:id/revert
 * @desc    Revert a privilege change from audit log
 * @access  Private (ADMIN+, or QUALITY_CONTROL_MANAGER for FMIR)
 */
router.post(
  '/audit-logs/:id/revert',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthRequest;
    const userRole = authReq.user?.role;
    const userOrgId = authReq.user?.organizationId;
    const userId = authReq.user?.id;
    const { id } = req.params;

    const isQCM = userRole === 'QUALITY_CONTROL_MANAGER';
    const isAdmin = ['ADMIN', 'SYSTEM_ADMIN'].includes(userRole || '');

    if (!isAdmin && !isQCM) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    if (!userOrgId) {
      res.status(400).json({ error: 'Organization not found' });
      return;
    }

    // Get the audit log entry to revert
    const auditLog = await prisma.privilegeAuditLog.findUnique({
      where: { id },
    });

    if (!auditLog || auditLog.organizationId !== userOrgId) {
      res.status(404).json({ error: 'Audit log not found' });
      return;
    }

    // QCM can only revert FMIR changes
    if (isQCM && !isAdmin && auditLog.module !== 'FMIR') {
      res.status(403).json({ error: 'Access denied - can only revert Foreign Material privilege changes' });
      return;
    }

    // Check if already reverted
    if (auditLog.isReverted) {
      res.status(400).json({ error: 'This change has already been reverted' });
      return;
    }

    // Get user info
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true, role: true },
    });
    const revertedByName = user ? `${user.firstName} ${user.lastName}` : 'Unknown User';

    // Find the privilege definition
    const definition = PRIVILEGE_DEFINITIONS.find(d => d.key === auditLog.featureKey);
    if (!definition) {
      res.status(400).json({ error: 'Privilege definition not found' });
      return;
    }

    // Revert: set the value back to previousValue
    const revertedValue = auditLog.previousValue;

    // Update the privilege
    const privilege = await prisma.rolePrivilege.upsert({
      where: {
        organizationId_role_featureKey: {
          organizationId: userOrgId,
          role: auditLog.role,
          featureKey: auditLog.featureKey,
        },
      },
      update: {
        isEnabled: revertedValue,
        updatedAt: new Date(),
      },
      create: {
        id: uuidv4(),
        organizationId: userOrgId,
        role: auditLog.role,
        module: auditLog.module,
        featureKey: auditLog.featureKey,
        action: auditLog.action,
        isEnabled: revertedValue,
        description: definition.description,
        createdById: userId,
        updatedAt: new Date(),
      },
    });

    // Create a new audit log for the revert action
    const revertAuditLog = await createAuditLog({
      organizationId: userOrgId,
      role: auditLog.role,
      module: auditLog.module,
      featureKey: auditLog.featureKey,
      action: auditLog.action,
      displayName: auditLog.displayName || definition.displayName,
      previousValue: auditLog.newValue, // The current value (what we're reverting from)
      newValue: revertedValue,
      changeType: 'revert',
      changedById: userId!,
      changedByName: revertedByName,
      changedByRole: user?.role as UserRole,
      description: `Reverted change from audit log ${auditLog.id}`,
      ipAddress: req.ip || req.socket.remoteAddress,
      userAgent: req.get('user-agent'),
    });

    // Mark the original audit log as reverted
    await prisma.privilegeAuditLog.update({
      where: { id },
      data: {
        isReverted: true,
        revertedAt: new Date(),
        revertedById: userId,
        revertedByName,
        revertLogId: revertAuditLog.id,
      },
    });

    // Broadcast privilege change to all users in the organization
    websocketService.emitToOrganization(userOrgId, 'privilege:changed', {
      organizationId: userOrgId,
      affectedRoles: [auditLog.role],
      role: auditLog.role,
      featureKey: auditLog.featureKey,
      isEnabled: revertedValue,
      changedBy: revertedByName,
      changedAt: new Date().toISOString(),
      auditLogId: revertAuditLog.id,
      isRevert: true,
      revertedFrom: id,
    });

    res.json({
      success: true,
      data: {
        privilege,
        revertAuditLog,
        originalLogId: id,
      },
      message: `Reverted ${auditLog.displayName || auditLog.featureKey} for ${auditLog.role} to ${revertedValue ? 'enabled' : 'disabled'}`,
    });
  })
);

/**
 * @route   GET /api/privileges/fmir
 * @desc    Get FMIR-specific privileges for QCM management
 * @access  Private (QUALITY_CONTROL_MANAGER+)
 */
router.get(
  '/fmir',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthRequest;
    const userRole = authReq.user?.role;
    const userOrgId = authReq.user?.organizationId;

    const allowedRoles = ['QUALITY_CONTROL_MANAGER', 'ADMIN', 'SYSTEM_ADMIN'];
    if (!allowedRoles.includes(userRole || '')) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    if (!userOrgId) {
      res.status(400).json({ error: 'Organization not found' });
      return;
    }

    // Get only FMIR privilege definitions
    const fmirDefinitions = PRIVILEGE_DEFINITIONS.filter(d => d.module === 'FMIR');

    // Get existing privilege overrides for this organization
    const privileges = await prisma.rolePrivilege.findMany({
      where: { 
        organizationId: userOrgId,
        module: 'FMIR',
      },
      orderBy: [{ role: 'asc' }, { featureKey: 'asc' }],
    });

    // Build matrix for FMIR only
    const matrix: Record<string, Record<string, boolean>> = {};
    const allRoles = Object.values(UserRole);

    for (const role of allRoles) {
      matrix[role] = {};
      for (const def of fmirDefinitions) {
        matrix[role][def.key] = def.defaultRoles.includes(role as UserRole);
      }
    }

    // Apply organization overrides
    for (const priv of privileges) {
      if (matrix[priv.role]) {
        matrix[priv.role][priv.featureKey] = priv.isEnabled;
      }
    }

    res.json({
      success: true,
      data: {
        matrix,
        overrides: privileges,
        definitions: fmirDefinitions,
      },
    });
  })
);

// ============================================================================
// USER PRIVILEGE OVERRIDE ENDPOINTS
// ============================================================================

/**
 * @route   GET /api/privileges/user-overrides/:userId
 * @desc    Get all privilege overrides for a specific user
 * @access  Private (ADMIN+)
 */
router.get(
  '/user-overrides/:userId',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthRequest;
    const userRole = authReq.user?.role;
    const userOrgId = authReq.user?.organizationId;
    const { userId } = req.params;

    if (!['ADMIN', 'SYSTEM_ADMIN'].includes(userRole || '')) {
      res.status(403).json({ error: 'Access denied. Admin role required.' });
      return;
    }

    if (!userOrgId) {
      res.status(400).json({ error: 'Organization not found' });
      return;
    }

    // Verify target user belongs to the same organization
    const targetUser = await prisma.user.findFirst({
      where: { id: userId, organizationId: userOrgId },
      select: { id: true, firstName: true, lastName: true, email: true, role: true },
    });

    if (!targetUser) {
      res.status(404).json({ error: 'User not found in your organization' });
      return;
    }

    const overrides = await prisma.userPrivilegeOverride.findMany({
      where: { userId, organizationId: userOrgId },
      orderBy: { featureKey: 'asc' },
    });

    res.json({
      success: true,
      data: {
        user: targetUser,
        overrides,
      },
    });
  })
);

/**
 * @route   PUT /api/privileges/user-overrides/:userId
 * @desc    Set or update a privilege override for a specific user
 * @access  Private (ADMIN+)
 */
router.put(
  '/user-overrides/:userId',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthRequest;
    const userRole = authReq.user?.role;
    const userOrgId = authReq.user?.organizationId;
    const adminId = authReq.user?.id;
    const { userId } = req.params;
    const { featureKey, isEnabled } = req.body;

    if (!['ADMIN', 'SYSTEM_ADMIN'].includes(userRole || '')) {
      res.status(403).json({ error: 'Access denied. Admin role required.' });
      return;
    }

    if (!userOrgId || !adminId) {
      res.status(400).json({ error: 'Organization not found' });
      return;
    }

    // Validate inputs
    if (!featureKey || typeof isEnabled !== 'boolean') {
      res.status(400).json({ error: 'featureKey (string) and isEnabled (boolean) are required' });
      return;
    }

    // Validate featureKey exists in definitions
    const definition = PRIVILEGE_DEFINITIONS.find(d => d.key === featureKey);
    if (!definition) {
      res.status(400).json({ error: `Invalid feature key: ${featureKey}` });
      return;
    }

    // Verify target user belongs to the same organization
    const targetUser = await prisma.user.findFirst({
      where: { id: userId, organizationId: userOrgId },
      select: { id: true, firstName: true, lastName: true, email: true, role: true },
    });

    if (!targetUser) {
      res.status(404).json({ error: 'User not found in your organization' });
      return;
    }

    // Cannot override SYSTEM_ADMIN privileges
    if (targetUser.role === 'SYSTEM_ADMIN') {
      res.status(403).json({ error: 'Cannot override SYSTEM_ADMIN privileges' });
      return;
    }

    // Cannot set overrides for yourself
    if (userId === adminId) {
      res.status(403).json({ error: 'Cannot set privilege overrides for yourself' });
      return;
    }

    const override = await prisma.userPrivilegeOverride.upsert({
      where: {
        userId_featureKey: { userId, featureKey },
      },
      update: {
        isEnabled,
        updatedAt: new Date(),
      },
      create: {
        userId,
        organizationId: userOrgId,
        featureKey,
        isEnabled,
        createdById: adminId,
      },
    });

    // Log the change
    await prisma.privilegeAuditLog.create({
      data: {
        organizationId: userOrgId,
        featureKey,
        module: definition.module as FeatureModule,
        action: definition.action,
        role: targetUser.role as UserRole,
        previousValue: !isEnabled,
        newValue: isEnabled,
        changedById: adminId,
        reason: `User-specific override for ${targetUser.firstName} ${targetUser.lastName} (${targetUser.email})`,
      },
    });

    res.json({ success: true, data: override });
  })
);

/**
 * @route   PUT /api/privileges/user-overrides/:userId/bulk
 * @desc    Set multiple privilege overrides for a user at once
 * @access  Private (ADMIN+)
 */
router.put(
  '/user-overrides/:userId/bulk',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthRequest;
    const userRole = authReq.user?.role;
    const userOrgId = authReq.user?.organizationId;
    const adminId = authReq.user?.id;
    const { userId } = req.params;
    const { overrides } = req.body;

    if (!['ADMIN', 'SYSTEM_ADMIN'].includes(userRole || '')) {
      res.status(403).json({ error: 'Access denied. Admin role required.' });
      return;
    }

    if (!userOrgId || !adminId) {
      res.status(400).json({ error: 'Organization not found' });
      return;
    }

    if (!Array.isArray(overrides)) {
      res.status(400).json({ error: 'overrides must be an array of { featureKey, isEnabled }' });
      return;
    }

    // Validate all feature keys
    for (const o of overrides) {
      if (!o.featureKey || typeof o.isEnabled !== 'boolean') {
        res.status(400).json({ error: 'Each override must have featureKey (string) and isEnabled (boolean)' });
        return;
      }
      if (!PRIVILEGE_DEFINITIONS.find(d => d.key === o.featureKey)) {
        res.status(400).json({ error: `Invalid feature key: ${o.featureKey}` });
        return;
      }
    }

    // Verify target user
    const targetUser = await prisma.user.findFirst({
      where: { id: userId, organizationId: userOrgId },
      select: { id: true, firstName: true, lastName: true, email: true, role: true },
    });

    if (!targetUser) {
      res.status(404).json({ error: 'User not found in your organization' });
      return;
    }

    if (targetUser.role === 'SYSTEM_ADMIN') {
      res.status(403).json({ error: 'Cannot override SYSTEM_ADMIN privileges' });
      return;
    }

    if (userId === adminId) {
      res.status(403).json({ error: 'Cannot set privilege overrides for yourself' });
      return;
    }

    // Apply all overrides in transaction
    const results = await prisma.$transaction(
      overrides.map((o: { featureKey: string; isEnabled: boolean }) =>
        prisma.userPrivilegeOverride.upsert({
          where: {
            userId_featureKey: { userId, featureKey: o.featureKey },
          },
          update: { isEnabled: o.isEnabled, updatedAt: new Date() },
          create: {
            userId,
            organizationId: userOrgId,
            featureKey: o.featureKey,
            isEnabled: o.isEnabled,
            createdById: adminId,
          },
        })
      )
    );

    res.json({ success: true, data: { count: results.length, overrides: results } });
  })
);

/**
 * @route   DELETE /api/privileges/user-overrides/:userId/:featureKey
 * @desc    Remove a specific privilege override for a user
 * @access  Private (ADMIN+)
 */
router.delete(
  '/user-overrides/:userId/:featureKey',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthRequest;
    const userRole = authReq.user?.role;
    const userOrgId = authReq.user?.organizationId;
    const { userId, featureKey } = req.params;

    if (!['ADMIN', 'SYSTEM_ADMIN'].includes(userRole || '')) {
      res.status(403).json({ error: 'Access denied. Admin role required.' });
      return;
    }

    if (!userOrgId) {
      res.status(400).json({ error: 'Organization not found' });
      return;
    }

    // Verify target user belongs to same org
    const targetUser = await prisma.user.findFirst({
      where: { id: userId, organizationId: userOrgId },
    });

    if (!targetUser) {
      res.status(404).json({ error: 'User not found in your organization' });
      return;
    }

    try {
      await prisma.userPrivilegeOverride.delete({
        where: {
          userId_featureKey: { userId, featureKey },
        },
      });
      res.json({ success: true, message: 'Override removed' });
    } catch {
      res.status(404).json({ error: 'Override not found' });
    }
  })
);

/**
 * @route   POST /api/privileges/user-overrides/:userId/reset
 * @desc    Remove all privilege overrides for a user (revert to role defaults)
 * @access  Private (ADMIN+)
 */
router.post(
  '/user-overrides/:userId/reset',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthRequest;
    const userRole = authReq.user?.role;
    const userOrgId = authReq.user?.organizationId;
    const adminId = authReq.user?.id;
    const { userId } = req.params;

    if (!['ADMIN', 'SYSTEM_ADMIN'].includes(userRole || '')) {
      res.status(403).json({ error: 'Access denied. Admin role required.' });
      return;
    }

    if (!userOrgId || !adminId) {
      res.status(400).json({ error: 'Organization not found' });
      return;
    }

    const targetUser = await prisma.user.findFirst({
      where: { id: userId, organizationId: userOrgId },
    });

    if (!targetUser) {
      res.status(404).json({ error: 'User not found in your organization' });
      return;
    }

    const result = await prisma.userPrivilegeOverride.deleteMany({
      where: { userId, organizationId: userOrgId },
    });

    // Log the reset
    await prisma.privilegeAuditLog.create({
      data: {
        organizationId: userOrgId,
        featureKey: 'ALL',
        module: 'SYSTEM' as FeatureModule,
        action: 'VIEW',
        role: targetUser.role as UserRole,
        previousValue: true,
        newValue: true,
        changedById: adminId,
        reason: `Reset all user-specific overrides for ${targetUser.firstName} ${targetUser.lastName} (${targetUser.email}) (${result.count} overrides removed)`,
      },
    });

    res.json({ success: true, message: `Removed ${result.count} overrides` });
  })
);

/**
 * @route   GET /api/privileges/users-by-role
 * @desc    Get users grouped by role for the navigation override UI
 * @access  Private (ADMIN+)
 */
router.get(
  '/users-by-role',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthRequest;
    const userRole = authReq.user?.role;
    const userOrgId = authReq.user?.organizationId;

    if (!['ADMIN', 'SYSTEM_ADMIN'].includes(userRole || '')) {
      res.status(403).json({ error: 'Access denied. Admin role required.' });
      return;
    }

    if (!userOrgId) {
      res.status(400).json({ error: 'Organization not found' });
      return;
    }

    const { role } = req.query;

    const whereClause: Record<string, unknown> = {
      organizationId: userOrgId,
      isActive: true,
    };

    if (role && typeof role === 'string') {
      whereClause.role = role;
    }

    const users = await prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        PrivilegeOverrides: {
          select: {
            featureKey: true,
            isEnabled: true,
          },
        },
      },
      orderBy: [{ role: 'asc' }, { firstName: 'asc' }],
    });

    // Map firstName/lastName to name for frontend
    const mapped = users.map(u => ({
      ...u,
      name: `${u.firstName} ${u.lastName}`.trim(),
    }));

    res.json({ success: true, data: mapped });
  })
);

export default router;
