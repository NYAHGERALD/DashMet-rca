// Phase 1.2: RBAC Utilities

import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { ForbiddenError } from './errorHandler';
import { PrismaClient, UserRole, FeatureModule } from '@prisma/client';

const prisma = new PrismaClient();

// Role hierarchy for permission checking
export const ROLE_HIERARCHY: Record<string, number> = {
  OPERATOR: 1,
  SUPERVISOR: 2,
  QA_FOOD_SAFETY: 3,
  MAINTENANCE_ENGINEERING: 3,
  CI_MANAGER: 4,
  SAFETY_SECURITY_MANAGER: 4,
  ADMIN: 5,
  SYSTEM_ADMIN: 6,
};

// Check if user has minimum required role level
export function hasMinimumRole(userRole: string, requiredRole: string): boolean {
  const userLevel = ROLE_HIERARCHY[userRole] || 0;
  const requiredLevel = ROLE_HIERARCHY[requiredRole] || 999;
  return userLevel >= requiredLevel;
}

// Middleware to require minimum role level
export function requireMinimumRole(minimumRole: string) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new ForbiddenError('Authentication required');
    }

    if (!hasMinimumRole(req.user.role, minimumRole)) {
      throw new ForbiddenError(`Requires ${minimumRole} role or higher`);
    }

    next();
  };
}

// Middleware to require specific roles
export function requireRoles(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new ForbiddenError('Authentication required');
    }

    if (!roles.includes(req.user.role)) {
      throw new ForbiddenError(`Access restricted to: ${roles.join(', ')}`);
    }

    next();
  };
}

// Middleware to require admin access
export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    throw new ForbiddenError('Authentication required');
  }

  if (!['ADMIN', 'SYSTEM_ADMIN'].includes(req.user.role)) {
    throw new ForbiddenError('Admin access required');
  }

  next();
}

// Middleware to require system admin access
export function requireSystemAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    throw new ForbiddenError('Authentication required');
  }

  if (req.user.role !== 'SYSTEM_ADMIN') {
    throw new ForbiddenError('System admin access required');
  }

  next();
}

// Check if user can access organization data
export function canAccessOrganization(userOrganizationId: string, targetOrganizationId: string, userRole: string): boolean {
  // System admins can access all organizations
  if (userRole === 'SYSTEM_ADMIN') {
    return true;
  }

  // Others can only access their own organization
  return userOrganizationId === targetOrganizationId;
}

// Middleware to verify organization access
export function verifyOrganizationAccess(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    throw new ForbiddenError('Authentication required');
  }

  const targetOrganizationId = req.params.organizationId || req.body.organizationId;

  if (!targetOrganizationId) {
    return next();
  }

  if (!canAccessOrganization(req.user.organizationId, targetOrganizationId, req.user.role)) {
    throw new ForbiddenError('Cannot access data from another organization');
  }

  next();
}

// Add organization filter to query for non-system-admins
export function addOrganizationFilter(req: AuthRequest): { organizationId?: string } {
  if (!req.user) {
    return {};
  }

  // System admins see all data
  if (req.user.role === 'SYSTEM_ADMIN') {
    return {};
  }

  // Others only see their organization's data
  return { organizationId: req.user.organizationId };
}

// ============================================================================
// PRIVILEGE-BASED ACCESS CONTROL
// ============================================================================

// Default privilege settings for roles that haven't been customized
// Maps privilege key to array of roles that have it by default
// MUST match PRIVILEGE_DEFINITIONS in privilegeRoutes.ts
const DEFAULT_PRIVILEGES: Record<string, UserRole[]> = {
  // ============================================================================
  // INCIDENTS MODULE
  // ============================================================================
  'incidents.view': ['OPERATOR', 'SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'MAINTENANCE_ENGINEERING', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN', 'SYSTEM_ADMIN'],
  'incidents.view_all': ['QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'CI_MANAGER', 'ADMIN', 'SYSTEM_ADMIN'],
  'incidents.create': ['OPERATOR', 'SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'MAINTENANCE_ENGINEERING', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN', 'SYSTEM_ADMIN'],
  'incidents.edit': ['OPERATOR', 'SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'MAINTENANCE_ENGINEERING', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN', 'SYSTEM_ADMIN'],
  'incidents.edit_any': ['CI_MANAGER', 'ADMIN', 'SYSTEM_ADMIN'],
  'incidents.delete': ['CI_MANAGER', 'ADMIN', 'SYSTEM_ADMIN'],
  'incidents.assign': ['SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'CI_MANAGER', 'ADMIN', 'SYSTEM_ADMIN'],
  'incidents.change_status': ['SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'MAINTENANCE_ENGINEERING', 'CI_MANAGER', 'ADMIN', 'SYSTEM_ADMIN'],
  'incidents.manage_team': ['SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'CI_MANAGER', 'ADMIN', 'SYSTEM_ADMIN'],
  'incidents.ai_analysis': ['SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'MAINTENANCE_ENGINEERING', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN', 'SYSTEM_ADMIN'],
  'incidents.ai.auto_categorize': ['SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'CI_MANAGER', 'ADMIN', 'SYSTEM_ADMIN'],
  'incidents.ai.suggest_actions': ['SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'MAINTENANCE_ENGINEERING', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN', 'SYSTEM_ADMIN'],
  'incidents.ai.summarize': ['SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'CI_MANAGER', 'ADMIN', 'SYSTEM_ADMIN'],
  'incidents.ai.predict_impact': ['QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'CI_MANAGER', 'ADMIN', 'SYSTEM_ADMIN'],

  // ============================================================================
  // RCA MODULE
  // ============================================================================
  'rca.view': ['SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'MAINTENANCE_ENGINEERING', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN', 'SYSTEM_ADMIN'],
  'rca.create': ['SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'MAINTENANCE_ENGINEERING', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN', 'SYSTEM_ADMIN'],
  'rca.edit': ['SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'MAINTENANCE_ENGINEERING', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN', 'SYSTEM_ADMIN'],
  'rca.validate': ['QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'CI_MANAGER', 'ADMIN', 'SYSTEM_ADMIN'],
  'rca.ai_analysis': ['SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'MAINTENANCE_ENGINEERING', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN', 'SYSTEM_ADMIN'],
  'rca.ai.five_whys': ['SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'MAINTENANCE_ENGINEERING', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN', 'SYSTEM_ADMIN'],
  'rca.ai.fishbone': ['SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'MAINTENANCE_ENGINEERING', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN', 'SYSTEM_ADMIN'],
  'rca.ai.suggest_causes': ['SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'CI_MANAGER', 'ADMIN', 'SYSTEM_ADMIN'],
  'rca.ai.validation': ['QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'CI_MANAGER', 'ADMIN', 'SYSTEM_ADMIN'],
  'rca.ai.generate_report': ['SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'CI_MANAGER', 'ADMIN', 'SYSTEM_ADMIN'],

  // ============================================================================
  // CAPA MODULE
  // ============================================================================
  'capa.view': ['SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'MAINTENANCE_ENGINEERING', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN', 'SYSTEM_ADMIN'],
  'capa.create': ['SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'MAINTENANCE_ENGINEERING', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN', 'SYSTEM_ADMIN'],
  'capa.edit': ['SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'MAINTENANCE_ENGINEERING', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN', 'SYSTEM_ADMIN'],
  'capa.delete': ['CI_MANAGER', 'ADMIN', 'SYSTEM_ADMIN'],
  'capa.verify': ['QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'CI_MANAGER', 'ADMIN', 'SYSTEM_ADMIN'],
  'capa.ai.suggest_actions': ['SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'MAINTENANCE_ENGINEERING', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN', 'SYSTEM_ADMIN'],
  'capa.ai.prioritize': ['SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'CI_MANAGER', 'ADMIN', 'SYSTEM_ADMIN'],
  'capa.ai.effectiveness_prediction': ['QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'CI_MANAGER', 'ADMIN', 'SYSTEM_ADMIN'],
  'capa.ai.similar_actions': ['SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'CI_MANAGER', 'ADMIN', 'SYSTEM_ADMIN'],
  'capa.ai.generate_report': ['SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'CI_MANAGER', 'ADMIN', 'SYSTEM_ADMIN'],

  // ============================================================================
  // FMIR MODULE - Core Operations
  // ============================================================================
  'fmir.view': ['OPERATOR', 'SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'MAINTENANCE_ENGINEERING', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN', 'SYSTEM_ADMIN'],
  'fmir.view_all': ['QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'CI_MANAGER', 'ADMIN', 'SYSTEM_ADMIN'],
  'fmir.create': ['OPERATOR', 'SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'MAINTENANCE_ENGINEERING', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN', 'SYSTEM_ADMIN'],
  'fmir.edit': ['OPERATOR', 'SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'MAINTENANCE_ENGINEERING', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN', 'SYSTEM_ADMIN'],
  'fmir.edit_any': ['QUALITY_CONTROL_MANAGER', 'CI_MANAGER', 'ADMIN', 'SYSTEM_ADMIN'],
  'fmir.delete': ['OPERATOR', 'SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'MAINTENANCE_ENGINEERING', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN', 'SYSTEM_ADMIN'],
  'fmir.delete_visible': ['QUALITY_CONTROL_MANAGER', 'ADMIN', 'SYSTEM_ADMIN'],

  // FMIR - Status Management
  'fmir.submit': ['OPERATOR', 'SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'MAINTENANCE_ENGINEERING', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN', 'SYSTEM_ADMIN'],
  'fmir.change_status': ['QUALITY_CONTROL_MANAGER', 'CI_MANAGER', 'ADMIN', 'SYSTEM_ADMIN'],
  'fmir.toggle_investigation': ['QUALITY_CONTROL_MANAGER', 'SAFETY_SECURITY_MANAGER', 'ADMIN', 'SYSTEM_ADMIN'],
  'fmir.close': ['QUALITY_CONTROL_MANAGER', 'SYSTEM_ADMIN'],
  'fmir.toggle_visibility': ['OPERATOR', 'SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'MAINTENANCE_ENGINEERING', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN', 'SYSTEM_ADMIN'],

  // FMIR - Evidence Management
  'fmir.evidence.upload': ['OPERATOR', 'SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'MAINTENANCE_ENGINEERING', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN', 'SYSTEM_ADMIN'],
  'fmir.evidence.download': ['OPERATOR', 'SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'MAINTENANCE_ENGINEERING', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN', 'SYSTEM_ADMIN'],
  'fmir.evidence.delete': ['OPERATOR', 'SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'MAINTENANCE_ENGINEERING', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN', 'SYSTEM_ADMIN'],
  'fmir.evidence.edit': ['OPERATOR', 'SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'MAINTENANCE_ENGINEERING', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN', 'SYSTEM_ADMIN'],

  // FMIR - Collaborator Management
  'fmir.collaborators.view': ['OPERATOR', 'SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'MAINTENANCE_ENGINEERING', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN', 'SYSTEM_ADMIN'],
  'fmir.collaborators.add': ['OPERATOR', 'SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'MAINTENANCE_ENGINEERING', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN', 'SYSTEM_ADMIN'],
  'fmir.collaborators.remove': ['OPERATOR', 'SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'MAINTENANCE_ENGINEERING', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN', 'SYSTEM_ADMIN'],

  // FMIR - AI Features
  'fmir.ai.validate_submit': ['OPERATOR', 'SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'MAINTENANCE_ENGINEERING', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN', 'SYSTEM_ADMIN'],
  'fmir.ai.validate_lock': ['QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'ADMIN', 'SYSTEM_ADMIN'],
  'fmir.ai.explain_regulation': ['OPERATOR', 'SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'MAINTENANCE_ENGINEERING', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN', 'SYSTEM_ADMIN'],
  'fmir.ai.enhance_text': ['OPERATOR', 'SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'MAINTENANCE_ENGINEERING', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN', 'SYSTEM_ADMIN'],
  'fmir.ai.generate_audit': ['QUALITY_CONTROL_MANAGER', 'ADMIN', 'SYSTEM_ADMIN'],

  // FMIR - Comments
  'fmir.comments.view': ['OPERATOR', 'SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'MAINTENANCE_ENGINEERING', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN', 'SYSTEM_ADMIN'],
  'fmir.comments.add': ['QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'CI_MANAGER', 'ADMIN', 'SYSTEM_ADMIN'],
  'fmir.comments.delete': ['QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'CI_MANAGER', 'ADMIN', 'SYSTEM_ADMIN'],
  'fmir.comments.delete_any': ['QUALITY_CONTROL_MANAGER', 'ADMIN', 'SYSTEM_ADMIN'],

  // FMIR - Audit History
  'fmir.audit.view': ['SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'CI_MANAGER', 'ADMIN', 'SYSTEM_ADMIN'],
  'fmir.audit.view_org': ['QUALITY_CONTROL_MANAGER', 'CI_MANAGER', 'ADMIN', 'SYSTEM_ADMIN'],

  // FMIR - Export Features
  'fmir.export.print': ['SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'MAINTENANCE_ENGINEERING', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN', 'SYSTEM_ADMIN'],
  'fmir.export.pdf': ['SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'MAINTENANCE_ENGINEERING', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN', 'SYSTEM_ADMIN'],

  // FMIR - Assignment Features
  'fmir.assign.line': ['OPERATOR', 'SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'CI_MANAGER', 'ADMIN', 'SYSTEM_ADMIN'],
  'fmir.assign.area': ['OPERATOR', 'SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'CI_MANAGER', 'ADMIN', 'SYSTEM_ADMIN'],
  'fmir.assign.qa_user': ['SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'CI_MANAGER', 'ADMIN', 'SYSTEM_ADMIN'],

  // FMIR - RCA Integration
  'fmir.link_rca': ['SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'CI_MANAGER', 'ADMIN', 'SYSTEM_ADMIN'],

  // ============================================================================
  // WORKPLACE REPORT MODULE
  // ============================================================================
  'workplace_report.view': ['SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'MAINTENANCE_ENGINEERING', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN', 'SYSTEM_ADMIN'],
  'workplace_report.generate': ['SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'MAINTENANCE_ENGINEERING', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN', 'SYSTEM_ADMIN'],

  // ============================================================================
  // INVESTIGATION REPORT MODULE
  // ============================================================================
  'investigation_report.view': ['SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'MAINTENANCE_ENGINEERING', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN', 'SYSTEM_ADMIN'],
  'investigation_report.generate': ['SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'MAINTENANCE_ENGINEERING', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN', 'SYSTEM_ADMIN'],

  // ============================================================================
  // KNOWLEDGE BASE MODULE
  // ============================================================================
  'knowledge.view': ['SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'MAINTENANCE_ENGINEERING', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN', 'SYSTEM_ADMIN'],
  'knowledge.create': ['QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'CI_MANAGER', 'ADMIN', 'SYSTEM_ADMIN'],
  'knowledge.edit': ['QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'CI_MANAGER', 'ADMIN', 'SYSTEM_ADMIN'],
  'knowledge.delete': ['CI_MANAGER', 'ADMIN', 'SYSTEM_ADMIN'],
  'knowledge.ai.generate_summary': ['SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'CI_MANAGER', 'ADMIN', 'SYSTEM_ADMIN'],
  'knowledge.ai.suggest_related': ['SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'CI_MANAGER', 'ADMIN', 'SYSTEM_ADMIN'],

  // ============================================================================
  // ANALYTICS MODULE
  // ============================================================================
  'analytics.view_dashboard': ['SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'CI_MANAGER', 'ADMIN', 'SYSTEM_ADMIN'],
  'analytics.view_trends': ['SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'CI_MANAGER', 'ADMIN', 'SYSTEM_ADMIN'],
  'analytics.export_reports': ['SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'CI_MANAGER', 'ADMIN', 'SYSTEM_ADMIN'],
  'analytics.ai.generate_insights': ['QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'CI_MANAGER', 'ADMIN', 'SYSTEM_ADMIN'],
  'analytics.ai.predict_trends': ['QUALITY_CONTROL_MANAGER', 'CI_MANAGER', 'ADMIN', 'SYSTEM_ADMIN'],

  // ============================================================================
  // NAVIGATION MODULE - Quick Navigation
  // ============================================================================
  'nav.dashboard': ['OPERATOR', 'SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'MAINTENANCE_ENGINEERING', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN', 'SYSTEM_ADMIN'],
  'nav.create_incident': ['OPERATOR', 'SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'MAINTENANCE_ENGINEERING', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN', 'SYSTEM_ADMIN'],
  'nav.my_incidents': ['OPERATOR', 'SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'MAINTENANCE_ENGINEERING', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN', 'SYSTEM_ADMIN'],
  'nav.team_incidents': ['SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'MAINTENANCE_ENGINEERING', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN', 'SYSTEM_ADMIN'],
  'nav.public_incidents': ['OPERATOR', 'SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'MAINTENANCE_ENGINEERING', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN', 'SYSTEM_ADMIN'],
  'nav.rca': ['SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'MAINTENANCE_ENGINEERING', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN', 'SYSTEM_ADMIN'],
  'nav.capa': ['SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'MAINTENANCE_ENGINEERING', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN', 'SYSTEM_ADMIN'],
  'nav.reports': ['SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'MAINTENANCE_ENGINEERING', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN', 'SYSTEM_ADMIN'],
  'nav.analytics': ['SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'MAINTENANCE_ENGINEERING', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN', 'SYSTEM_ADMIN'],
  'nav.knowledge': ['SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'MAINTENANCE_ENGINEERING', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN', 'SYSTEM_ADMIN'],
  'nav.workplace_report': ['OPERATOR', 'SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'MAINTENANCE_ENGINEERING', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN', 'SYSTEM_ADMIN'],
  'nav.investigation_report': ['OPERATOR', 'SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'MAINTENANCE_ENGINEERING', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN', 'SYSTEM_ADMIN'],
  'nav.fmir': ['OPERATOR', 'SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'MAINTENANCE_ENGINEERING', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN', 'SYSTEM_ADMIN'],
  'nav.safety_assessment': ['SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'MAINTENANCE_ENGINEERING', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN', 'SYSTEM_ADMIN'],
  'nav.hr': ['SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'MAINTENANCE_ENGINEERING', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN', 'SYSTEM_ADMIN'],
  'nav.bakery_metrics': ['OPERATOR', 'SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'MAINTENANCE_ENGINEERING', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN', 'SYSTEM_ADMIN'],
  'nav.lsw': ['OPERATOR', 'SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'MAINTENANCE_ENGINEERING', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN', 'SYSTEM_ADMIN'],
  'nav.vacation': ['OPERATOR', 'SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'MAINTENANCE_ENGINEERING', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN', 'SYSTEM_ADMIN'],
  'nav.meetings': ['OPERATOR', 'SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'MAINTENANCE_ENGINEERING', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN', 'SYSTEM_ADMIN'],
  'nav.operations': ['OPERATOR', 'SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'MAINTENANCE_ENGINEERING', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN', 'SYSTEM_ADMIN'],
  'nav.action_items': ['OPERATOR', 'SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'MAINTENANCE_ENGINEERING', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN', 'SYSTEM_ADMIN'],
  'nav.canvas_ai': ['OPERATOR', 'SUPERVISOR', 'QA_FOOD_SAFETY', 'QUALITY_CONTROL_MANAGER', 'MAINTENANCE_ENGINEERING', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN', 'SYSTEM_ADMIN'],

  // ============================================================================
  // NAVIGATION MODULE - Organization Management
  // ============================================================================
  'nav.admin_organizations': ['ADMIN', 'SYSTEM_ADMIN'],
  'nav.admin_facilities': ['ADMIN', 'SYSTEM_ADMIN'],
  'nav.admin_departments': ['ADMIN', 'SYSTEM_ADMIN'],
  'nav.admin_areas': ['ADMIN', 'SYSTEM_ADMIN'],
  'nav.admin_lines': ['ADMIN', 'SYSTEM_ADMIN'],
  'nav.admin_equipment': ['ADMIN', 'SYSTEM_ADMIN'],
  'nav.admin_shifts': ['ADMIN', 'SYSTEM_ADMIN'],
  'nav.admin_categories': ['ADMIN', 'SYSTEM_ADMIN'],
  'nav.admin_users': ['ADMIN', 'SYSTEM_ADMIN'],
  'nav.admin_invitations': ['ADMIN', 'SYSTEM_ADMIN'],
  'nav.admin_privileges': ['ADMIN', 'SYSTEM_ADMIN'],
  'nav.admin_work_orders': ['ADMIN', 'SYSTEM_ADMIN'],
  'nav.admin_enterprise': ['ADMIN', 'SYSTEM_ADMIN'],
  'nav.admin_calendar': ['ADMIN', 'SYSTEM_ADMIN'],
  'nav.admin_bakery_settings': ['ADMIN', 'SYSTEM_ADMIN'],
  'nav.support_inbox': ['QUALITY_CONTROL_MANAGER', 'ADMIN', 'SYSTEM_ADMIN'],
};

/**
 * Check if a user has a specific privilege
 * Priority: UserPrivilegeOverride > RolePrivilege (org override) > DefaultPrivilege
 */
export async function hasPrivilege(
  organizationId: string,
  userRole: UserRole,
  privilegeKey: string,
  userId?: string
): Promise<boolean> {
  // System admins always have all privileges
  if (userRole === 'SYSTEM_ADMIN') {
    return true;
  }

  try {
    // Priority 1: Check for user-specific override (highest priority)
    if (userId) {
      const userOverride = await prisma.userPrivilegeOverride.findUnique({
        where: {
          userId_featureKey: { userId, featureKey: privilegeKey },
        },
      });
      if (userOverride) {
        return userOverride.isEnabled;
      }
    }

    // Priority 2: Check for organization-specific role override
    const privilegeOverride = await prisma.rolePrivilege.findFirst({
      where: {
        organizationId,
        role: userRole,
        featureKey: privilegeKey,
      },
    });

    if (privilegeOverride) {
      return privilegeOverride.isEnabled;
    }

    // Fall back to default privileges
    const defaultRoles = DEFAULT_PRIVILEGES[privilegeKey];
    if (defaultRoles) {
      return defaultRoles.includes(userRole);
    }

    // If no default defined, deny access
    return false;
  } catch (error) {
    console.error('Error checking privilege:', error);
    // On error, fall back to default privileges
    const defaultRoles = DEFAULT_PRIVILEGES[privilegeKey];
    if (defaultRoles) {
      return defaultRoles.includes(userRole);
    }
    return false;
  }
}

/**
 * Middleware factory to require a specific privilege
 */
export function requirePrivilege(privilegeKey: string) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new ForbiddenError('Authentication required');
    }

    const hasAccess = await hasPrivilege(
      req.user.organizationId,
      req.user.role as UserRole,
      privilegeKey,
      req.user.id
    );

    if (!hasAccess) {
      res.status(403).json({
        success: false,
        error: 'Access denied',
        message: `You do not have permission to perform this action. Required privilege: ${privilegeKey}`,
        privilegeKey,
      });
      return;
    }

    next();
  };
}

/**
 * Middleware factory to require any of the specified privileges
 */
export function requireAnyPrivilege(...privilegeKeys: string[]) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new ForbiddenError('Authentication required');
    }

    for (const privilegeKey of privilegeKeys) {
      const hasAccess = await hasPrivilege(
        req.user.organizationId,
        req.user.role as UserRole,
        privilegeKey,
        req.user.id
      );

      if (hasAccess) {
        return next();
      }
    }

    res.status(403).json({
      success: false,
      error: 'Access denied',
      message: `You do not have permission to perform this action. Required one of: ${privilegeKeys.join(', ')}`,
      privilegeKeys,
    });
  };
}

// ============================================================================
// NAVIGATION ACCESS CONTROL
// ============================================================================

/**
 * Maps API route prefixes to navigation privilege keys.
 * Used by requireNavAccess middleware to enforce server-side access control.
 */
const API_ROUTE_TO_NAV_KEY: Record<string, string> = {
  '/api/dashboard': 'nav.dashboard',
  '/api/incidents': 'nav.my_incidents',
  '/api/rca': 'nav.rca',
  '/api/capa': 'nav.capa',
  '/api/reports': 'nav.reports',
  '/api/analytics': 'nav.analytics',
  '/api/knowledge': 'nav.knowledge',
  '/api/workplace-reports': 'nav.workplace_report',
  '/api/investigation-reports': 'nav.investigation_report',
  '/api/fmir': 'nav.fmir',
  '/api/safety-assessment': 'nav.safety_assessment',
  '/api/hr': 'nav.hr',
  '/api/bakery-metrics': 'nav.bakery_metrics',
  '/api/lsw': 'nav.lsw',
  '/api/vacation': 'nav.vacation',
  '/api/meetings': 'nav.meetings',
  '/api/operations': 'nav.operations',
  '/api/action-items': 'nav.action_items',
  '/api/boards': 'nav.canvas_ai',
  '/api/mindmaps': 'nav.canvas_ai',
  '/api/organizations': 'nav.admin_organizations',
  '/api/facilities': 'nav.admin_facilities',
  '/api/departments': 'nav.admin_departments',
  '/api/areas': 'nav.admin_areas',
  '/api/lines': 'nav.admin_lines',
  '/api/equipment': 'nav.admin_equipment',
  '/api/shifts': 'nav.admin_shifts',
  '/api/categories': 'nav.admin_categories',
  '/api/users': 'nav.admin_users',
  '/api/invitations': 'nav.admin_invitations',
  '/api/privileges': 'nav.admin_privileges',
  '/api/work-orders': 'nav.admin_work_orders',
  '/api/enterprise': 'nav.admin_enterprise',
  '/api/calendar': 'nav.admin_calendar',
  '/api/bakery-settings': 'nav.admin_bakery_settings',
  '/api/support': 'nav.support_inbox',
};

/**
 * Middleware factory to require navigation access for a specific nav key.
 * Checks the 3-tier priority: UserPrivilegeOverride > RolePrivilege > DefaultPrivilege
 */
export function requireNavAccess(navKey: string) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new ForbiddenError('Authentication required');
    }

    // SYSTEM_ADMIN always has full access
    if (req.user.role === 'SYSTEM_ADMIN') {
      return next();
    }

    const hasAccess = await hasPrivilege(
      req.user.organizationId,
      req.user.role as UserRole,
      navKey,
      req.user.id
    );

    if (!hasAccess) {
      res.status(403).json({
        success: false,
        error: 'Navigation access denied',
        message: 'You do not have access to this section. Contact your administrator.',
        navKey,
      });
      return;
    }

    next();
  };
}

/**
 * Auto-detect navigation access based on request path.
 * Use as route-level middleware to automatically enforce navigation privileges.
 */
export function autoRequireNavAccess() {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(); // Let authenticate middleware handle this
    }

    // SYSTEM_ADMIN always has full access
    if (req.user.role === 'SYSTEM_ADMIN') {
      return next();
    }

    // Find matching nav key for this route
    const path = req.path;
    let navKey: string | undefined;
    for (const [routePrefix, key] of Object.entries(API_ROUTE_TO_NAV_KEY)) {
      if (path.startsWith(routePrefix)) {
        navKey = key;
        break;
      }
    }

    // If no nav key mapped, allow access (route not nav-controlled)
    if (!navKey) {
      return next();
    }

    const hasAccess = await hasPrivilege(
      req.user.organizationId,
      req.user.role as UserRole,
      navKey,
      req.user.id
    );

    if (!hasAccess) {
      res.status(403).json({
        success: false,
        error: 'Navigation access denied',
        message: 'You do not have access to this section. Contact your administrator.',
        navKey,
      });
      return;
    }

    next();
  };
}
