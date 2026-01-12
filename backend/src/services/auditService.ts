/**
 * Phase 14: Audit Service
 * Comprehensive audit logging for regulatory compliance
 */

import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';
import { Request } from 'express';
import { AuthRequest } from '../middleware/auth';

interface AuditLogParams {
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'EXPORT' | 'VIEW';
  entity: string;
  entityId: string;
  userId?: string;
  changes?: any;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Log an audit event
 */
export async function logAuditEvent(params: AuditLogParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        action: params.action,
        entity: params.entity,
        entityId: params.entityId,
        userId: params.userId,
        changes: params.changes,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      },
    });

    logger.info(`Audit: ${params.action} on ${params.entity}:${params.entityId} by ${params.userId || 'system'}`);
  } catch (error) {
    logger.error('Failed to log audit event:', error);
    // Don't throw - audit logging should not break operations
  }
}

/**
 * Log audit event from request context
 */
export async function logAuditFromRequest(
  req: AuthRequest,
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'EXPORT' | 'VIEW',
  entity: string,
  entityId: string,
  changes?: any
): Promise<void> {
  const userId = req.user?.id;
  const ipAddress = getClientIp(req);
  const userAgent = req.headers['user-agent'];

  await logAuditEvent({
    action,
    entity,
    entityId,
    userId,
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
 * Get audit logs with filtering
 */
export async function getAuditLogs(filters: {
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
    entity,
    entityId,
    userId,
    action,
    startDate,
    endDate,
    page = 1,
    limit = 50,
  } = filters;

  const where: any = {};
  
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

  return { logs, total };
}

/**
 * Get audit trail for a specific entity
 */
export async function getEntityAuditTrail(entity: string, entityId: string): Promise<any[]> {
  return prisma.auditLog.findMany({
    where: {
      entity,
      entityId,
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
 * Get user activity summary
 */
export async function getUserActivitySummary(userId: string, days: number = 30): Promise<any> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const logs = await prisma.auditLog.findMany({
    where: {
      userId,
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

  // Get last login
  const lastLogin = logs.find(l => l.action === 'LOGIN');

  return {
    totalActions: logs.length,
    actionCounts,
    entityCounts,
    lastLogin: lastLogin?.createdAt,
    recentActivity: logs.slice(0, 10),
  };
}

/**
 * Generate compliance report for audit period
 */
export async function generateComplianceReport(
  startDate: Date,
  endDate: Date,
  format: 'summary' | 'detailed' = 'summary'
): Promise<any> {
  const logs = await prisma.auditLog.findMany({
    where: {
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
        summary.securityEvents.logins++;
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
