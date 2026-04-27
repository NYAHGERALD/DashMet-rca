/**
 * Phase 14: Audit Service
 * Comprehensive audit logging for regulatory compliance
 * 
 * IMPORTANT: This service is organization-scoped.
 * - Each audit log is associated with an organization
 * - SYSTEM_ADMIN activities are NEVER logged
 * - Organizations can only see their own audit logs
 */

import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';
import { Request } from 'express';
import { AuthRequest } from '../middleware/auth';
import { v4 as uuidv4 } from 'uuid';

type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'EXPORT' | 'VIEW';

interface AuditLogParams {
  action: AuditAction;
  entity: string;
  entityId: string;
  userId?: string;
  organizationId?: string;
  changes?: any;
  ipAddress?: string;
  userAgent?: string;
}

function isFailedLoginEvent(changes: unknown): boolean {
  if (!changes || typeof changes !== 'object' || Array.isArray(changes)) {
    return false;
  }

  const result = (changes as { result?: unknown }).result;
  return typeof result === 'string' && result.toLowerCase() === 'failed';
}

/**
 * Log an audit event
 * Note: Will NOT log if user is SYSTEM_ADMIN or if no organizationId is provided
 */
export async function logAuditEvent(params: AuditLogParams): Promise<void> {
  try {
    // Skip logging if no organization (system-level actions are not logged)
    if (!params.organizationId) {
      logger.debug(`Audit skipped: No organizationId for ${params.action} on ${params.entity}:${params.entityId}`);
      return;
    }

    await prisma.auditLog.create({
      data: {
        id: uuidv4(),
        action: params.action,
        entity: params.entity,
        entityId: params.entityId,
        userId: params.userId,
        organizationId: params.organizationId,
        changes: params.changes,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      },
    });

    logger.info(`Audit: ${params.action} on ${params.entity}:${params.entityId} by ${params.userId || 'system'} in org ${params.organizationId}`);
  } catch (error) {
    logger.error('Failed to log audit event:', error);
    // Don't throw - audit logging should not break operations
  }
}

/**
 * Log audit event from request context
 * IMPORTANT: Will NOT log for SYSTEM_ADMIN users
 */
export async function logAuditFromRequest(
  req: AuthRequest,
  action: AuditAction,
  entity: string,
  entityId: string,
  changes?: any
): Promise<void> {
  const user = req.user;
  
  // NEVER log System Admin activities
  if (user?.role === 'SYSTEM_ADMIN') {
    logger.debug(`Audit skipped: SYSTEM_ADMIN user ${user.id} performing ${action} on ${entity}`);
    return;
  }

  // Skip if user has no organization
  if (!user?.organizationId) {
    logger.debug(`Audit skipped: User ${user?.id} has no organization`);
    return;
  }

  const ipAddress = getClientIp(req);
  const userAgent = req.headers['user-agent'];

  await logAuditEvent({
    action,
    entity,
    entityId,
    userId: user.id,
    organizationId: user.organizationId,
    changes,
    ipAddress,
    userAgent,
  });
}

/**
 * Get client IP from request
 */
export function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const ips = (typeof forwarded === 'string' ? forwarded : forwarded[0]).split(',');
    return ips[0].trim();
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
}

/**
 * Get audit logs with filtering - ORGANIZATION SCOPED
 * Only returns logs for the specified organization
 */
export async function getAuditLogs(filters: {
  organizationId: string; // Required - organization scope
  entity?: string;
  entityId?: string;
  userId?: string;
  action?: string;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
}): Promise<{ logs: any[]; total: number }> {
  const {
    organizationId,
    entity,
    entityId,
    userId,
    action,
    startDate,
    endDate,
    page = 1,
    limit = 50,
  } = filters;

  // Organization is required for filtering
  const where: any = {
    organizationId, // Always filter by organization
  };
  
  if (entity) where.entity = entity;
  if (entityId) where.entityId = entityId;
  if (userId) where.userId = userId;
  if (action) where.action = action;
  
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = startDate;
    if (endDate) where.createdAt.lte = endDate;
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: {
        User: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.auditLog.count({ where }),
  ]);

  // Transform logs to include user info in a friendly format
  const transformedLogs = logs.map(log => ({
    id: log.id,
    action: log.action,
    entity: log.entity,
    entityId: log.entityId,
    userId: log.userId,
    changes: log.changes,
    ipAddress: log.ipAddress,
    userAgent: log.userAgent,
    createdAt: log.createdAt,
    user: log.User ? {
      id: log.User.id,
      firstName: log.User.firstName,
      lastName: log.User.lastName,
      email: log.User.email,
    } : null,
  }));

  return { logs: transformedLogs, total };
}

/**
 * Get audit trail for a specific entity - ORGANIZATION SCOPED
 */
export async function getEntityAuditTrail(
  entity: string, 
  entityId: string,
  organizationId: string
): Promise<any[]> {
  return prisma.auditLog.findMany({
    where: {
      entity,
      entityId,
      organizationId, // Only return logs for this organization
    },
    include: {
      User: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Get user activity summary - ORGANIZATION SCOPED
 */
export async function getUserActivitySummary(
  userId: string, 
  organizationId: string,
  days: number = 30
): Promise<any> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const logs = await prisma.auditLog.findMany({
    where: {
      userId,
      organizationId, // Only logs from this organization
      createdAt: { gte: startDate },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Summarize by action
  const actionCounts: Record<string, number> = {};
  const entityCounts: Record<string, number> = {};

  for (const log of logs) {
    actionCounts[log.action] = (actionCounts[log.action] || 0) + 1;
    entityCounts[log.entity] = (entityCounts[log.entity] || 0) + 1;
  }

  // Get last successful login (ignore failed attempts captured as LOGIN with result=failed)
  const lastLogin =
    logs.find(l => l.action === 'LOGIN' && !isFailedLoginEvent(l.changes)) ||
    logs.find(l => l.action === 'LOGIN');

  return {
    totalActions: logs.length,
    actionCounts,
    entityCounts,
    lastLogin: lastLogin?.createdAt,
    recentActivity: logs.slice(0, 10),
  };
}

/**
 * Generate compliance report for audit period - ORGANIZATION SCOPED
 */
export async function generateComplianceReport(
  organizationId: string,
  startDate: Date,
  endDate: Date,
  format: 'summary' | 'detailed' = 'summary'
): Promise<any> {
  const logs = await prisma.auditLog.findMany({
    where: {
      organizationId, // Only logs from this organization
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    },
    include: {
      User: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
          role: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  // Summary stats
  const summary = {
    period: {
      start: startDate.toISOString(),
      end: endDate.toISOString(),
    },
    totalEvents: logs.length,
    uniqueUsers: new Set(logs.map(l => l.userId).filter(Boolean)).size,
    byAction: {} as Record<string, number>,
    byEntity: {} as Record<string, number>,
    byUser: {} as Record<string, number>,
    securityEvents: {
      logins: 0,
      logouts: 0,
      failedLogins: 0,
    },
    dataEvents: {
      creates: 0,
      updates: 0,
      deletes: 0,
      exports: 0,
    },
  };

  for (const log of logs) {
    // Count by action
    summary.byAction[log.action] = (summary.byAction[log.action] || 0) + 1;
    
    // Count by entity
    summary.byEntity[log.entity] = (summary.byEntity[log.entity] || 0) + 1;
    
    // Count by user
    if (log.userId) {
      summary.byUser[log.userId] = (summary.byUser[log.userId] || 0) + 1;
    }

    // Categorize events
    switch (log.action) {
      case 'LOGIN':
        if (isFailedLoginEvent(log.changes)) {
          summary.securityEvents.failedLogins++;
        } else {
          summary.securityEvents.logins++;
        }
        break;
      case 'LOGOUT':
        summary.securityEvents.logouts++;
        break;
      case 'CREATE':
        summary.dataEvents.creates++;
        break;
      case 'UPDATE':
        summary.dataEvents.updates++;
        break;
      case 'DELETE':
        summary.dataEvents.deletes++;
        break;
      case 'EXPORT':
        summary.dataEvents.exports++;
        break;
    }
  }

  if (format === 'detailed') {
    return {
      ...summary,
      logs,
    };
  }

  return summary;
}

export default {
  logAuditEvent,
  logAuditFromRequest,
  getAuditLogs,
  getEntityAuditTrail,
  getUserActivitySummary,
  generateComplianceReport,
  getClientIp,
};
