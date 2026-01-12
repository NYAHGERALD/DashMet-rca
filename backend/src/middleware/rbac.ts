// Phase 1.2: RBAC Utilities

import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { ForbiddenError } from './errorHandler';

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
