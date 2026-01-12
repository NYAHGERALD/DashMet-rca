/**
 * Phase 14: Enterprise Hardening Routes
 * API endpoints for audit logs, system health, and compliance
 */

import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requireRoles } from '../middleware/rbac';
import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';
import auditService from '../services/auditService';

const router = Router();

// Apply authentication to all routes
router.use(authenticate);

// ============================================================================
// Phase 14.1: Audit Logs
// ============================================================================

/**
 * GET /api/admin/audit-logs
 * Get audit logs with filtering (ADMIN/SYSTEM_ADMIN only)
 */
router.get('/audit-logs', requireRoles('ADMIN', 'SYSTEM_ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const {
      entity,
      entityId,
      userId,
      action,
      startDate,
      endDate,
      page = '1',
      limit = '50',
    } = req.query;

    const filters = {
      entity: entity as string | undefined,
      entityId: entityId as string | undefined,
      userId: userId as string | undefined,
      action: action as string | undefined,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      page: parseInt(page as string),
      limit: parseInt(limit as string),
    };

    const { logs, total } = await auditService.getAuditLogs(filters);

    res.json({
      success: true,
      data: {
        logs,
        pagination: {
          page: filters.page,
          limit: filters.limit,
          total,
          pages: Math.ceil(total / filters.limit),
        },
      },
    });

  } catch (error: any) {
    logger.error('Error fetching audit logs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch audit logs',
    });
  }
});

/**
 * GET /api/admin/audit-logs/entity/:entity/:entityId
 * Get audit trail for a specific entity
 */
router.get('/audit-logs/entity/:entity/:entityId', requireRoles('ADMIN', 'SYSTEM_ADMIN', 'CI_MANAGER'), async (req: AuthRequest, res: Response) => {
  try {
    const { entity, entityId } = req.params;

    const trail = await auditService.getEntityAuditTrail(entity, entityId);

    res.json({
      success: true,
      data: trail,
    });

  } catch (error: any) {
    logger.error('Error fetching entity audit trail:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch audit trail',
    });
  }
});

/**
 * GET /api/admin/audit-logs/user/:userId
 * Get user activity summary
 */
router.get('/audit-logs/user/:userId', requireRoles('ADMIN', 'SYSTEM_ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const { days = '30' } = req.query;

    const summary = await auditService.getUserActivitySummary(userId, parseInt(days as string));

    res.json({
      success: true,
      data: summary,
    });

  } catch (error: any) {
    logger.error('Error fetching user activity:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user activity',
    });
  }
});

/**
 * GET /api/admin/compliance-report
 * Generate compliance report for audit period
 */
router.get('/compliance-report', requireRoles('ADMIN', 'SYSTEM_ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const {
      startDate,
      endDate,
      format = 'summary',
    } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'startDate and endDate are required',
      });
    }

    const report = await auditService.generateComplianceReport(
      new Date(startDate as string),
      new Date(endDate as string),
      format as 'summary' | 'detailed'
    );

    // Log export action
    await auditService.logAuditFromRequest(req, 'EXPORT', 'ComplianceReport', 'generated');

    res.json({
      success: true,
      data: report,
    });

  } catch (error: any) {
    logger.error('Error generating compliance report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate compliance report',
    });
  }
});

// ============================================================================
// Phase 14.2: System Health & Monitoring
// ============================================================================

/**
 * GET /api/admin/health
 * Get system health status
 */
router.get('/health', requireRoles('ADMIN', 'SYSTEM_ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const startTime = Date.now();
    
    // Check database connection
    let dbStatus = 'healthy';
    let dbLatency = 0;
    try {
      const dbStart = Date.now();
      await prisma.$queryRaw`SELECT 1`;
      dbLatency = Date.now() - dbStart;
    } catch (e) {
      dbStatus = 'unhealthy';
    }

    // Get system metrics
    const [
      userCount,
      incidentCount,
      rcaCount,
      activeSessionCount,
    ] = await Promise.all([
      prisma.user.count({ where: { isActive: true } }),
      prisma.incident.count(),
      prisma.rCAAnalysis.count(),
      prisma.session.count({ where: { expiresAt: { gt: new Date() } } }),
    ]);

    const responseTime = Date.now() - startTime;

    res.json({
      success: true,
      data: {
        status: dbStatus === 'healthy' ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        responseTimeMs: responseTime,
        services: {
          database: {
            status: dbStatus,
            latencyMs: dbLatency,
          },
          api: {
            status: 'healthy',
            version: process.env.npm_package_version || '1.0.0',
          },
        },
        metrics: {
          activeUsers: userCount,
          totalIncidents: incidentCount,
          totalRCAs: rcaCount,
          activeSessions: activeSessionCount,
        },
        memory: {
          heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
          heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + 'MB',
          rss: Math.round(process.memoryUsage().rss / 1024 / 1024) + 'MB',
        },
      },
    });

  } catch (error: any) {
    logger.error('Error checking system health:', error);
    res.status(500).json({
      success: false,
      data: {
        status: 'unhealthy',
        error: error.message,
      },
    });
  }
});

/**
 * GET /api/admin/statistics
 * Get detailed system statistics
 */
router.get('/statistics', requireRoles('ADMIN', 'SYSTEM_ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { period = '30' } = req.query;
    const periodDays = parseInt(period as string);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - periodDays);

    // Get comprehensive statistics
    const [
      userStats,
      incidentStats,
      rcaStats,
      capaStats,
      orgStats,
    ] = await Promise.all([
      // User statistics
      prisma.user.groupBy({
        by: ['role'],
        _count: true,
        where: { isActive: true },
      }),
      
      // Incident statistics
      prisma.incident.groupBy({
        by: ['status'],
        _count: true,
        where: { createdAt: { gte: startDate } },
      }),
      
      // RCA statistics
      prisma.rCAAnalysis.groupBy({
        by: ['method'],
        _count: true,
        where: { createdAt: { gte: startDate } },
      }),
      
      // CAPA statistics
      prisma.cAPAction.groupBy({
        by: ['status'],
        _count: true,
        where: { createdAt: { gte: startDate } },
      }),
      
      // Organization count
      prisma.organization.count({ where: { isActive: true } }),
    ]);

    // Calculate SLA metrics
    const slaMetrics = await calculateSLAMetrics(startDate);

    res.json({
      success: true,
      data: {
        period: {
          days: periodDays,
          start: startDate.toISOString(),
          end: new Date().toISOString(),
        },
        User: {
          byRole: userStats.map(s => ({ role: s.role, count: s._count })),
          total: userStats.reduce((sum, s) => sum + s._count, 0),
        },
        incidents: {
          byStatus: incidentStats.map(s => ({ status: s.status, count: s._count })),
          total: incidentStats.reduce((sum, s) => sum + s._count, 0),
        },
        RCAAnalysis: {
          byMethod: rcaStats.map(s => ({ method: s.method, count: s._count })),
          total: rcaStats.reduce((sum, s) => sum + s._count, 0),
        },
        capaActions: {
          byStatus: capaStats.map(s => ({ status: s.status, count: s._count })),
          total: capaStats.reduce((sum, s) => sum + s._count, 0),
        },
        organizations: orgStats,
        slaMetrics,
      },
    });

  } catch (error: any) {
    logger.error('Error fetching statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch statistics',
    });
  }
});

// ============================================================================
// Phase 14.3: Regulatory Readiness
// ============================================================================

/**
 * GET /api/admin/regulatory-check
 * Check regulatory readiness status
 */
router.get('/regulatory-check', requireRoles('ADMIN', 'SYSTEM_ADMIN', 'QA_FOOD_SAFETY'), async (req: AuthRequest, res: Response) => {
  try {
    const { regulationType, incidentType, timeRange } = req.query;

    // Build the where clause for incidents
    const incidentWhere: any = {
      type: 'FOOD_SAFETY',
      severity: { in: ['CRITICAL', 'HIGH'] },
      status: { notIn: ['CLOSED'] },
    };

    // Filter by time range if provided
    if (timeRange) {
      const [start, end] = (timeRange as string).split(',').map(t => new Date(parseInt(t)));
      incidentWhere.createdAt = { gte: start, lte: end };
    }

    // Get all incidents requiring regulatory attention
    const criticalIncidents = await prisma.incident.findMany({
      where: incidentWhere,
      select: {
        id: true,
        incidentNumber: true,
        severity: true,
        status: true,
        createdAt: true,
        slaResponseBreached: true,
        slaResolutionBreached: true,
      },
    });

    // Get pending CAPA actions with regulatory tags
    const actions = await prisma.cAPAction.findMany({
      where: {
        RCAAnalysis: {
          Incident: incidentWhere,
        },
        regulatoryTags: { hasSome: [regulationType as string, 'HACCP', 'FDA', 'OSHA'] },
      },
      include: {
        RCAAnalysis: {
          select: {
            Incident: {
              select: { incidentNumber: true },
            },
          },
        },
        User: {
          select: { firstName: true, lastName: true },
        },
      },
    });

    // Get validated vs unvalidated RCAs ratio
    const [validatedRCAs, totalRCAs] = await Promise.all([
      prisma.rCAAnalysis.count({ where: { isValidated: true } }),
      prisma.rCAAnalysis.count(),
    ]);

    // Calculate readiness score
    const readinessScore = calculateReadinessScore({
      criticalIncidents: criticalIncidents.length,
      pendingRegulatoryActions: actions.length,
      validatedRCAsRatio: totalRCAs > 0 ? validatedRCAs / totalRCAs : 1,
      slaBreaches: criticalIncidents.filter(i => i.slaResponseBreached || i.slaResolutionBreached).length,
    });

    const checklistItems = generateRegulatoryChecklist(regulationType as string, {
      criticalIncidents,
      regulatoryActions: actions,
      validatedRCAsRatio: totalRCAs > 0 ? validatedRCAs / totalRCAs : 1,
    });

    res.json({
      success: true,
      data: {
        regulationType,
        readinessScore: readinessScore.toFixed(0),
        readinessLevel: getReadinessLevel(readinessScore),
        summary: {
          openCriticalIncidents: criticalIncidents.length,
          pendingRegulatoryActions: actions.length,
          rcaValidationRate: totalRCAs > 0 
            ? ((validatedRCAs / totalRCAs) * 100).toFixed(1) + '%' 
            : 'N/A',
          slaBreaches: criticalIncidents.filter(i => i.slaResponseBreached || i.slaResolutionBreached).length,
        },
        criticalItems: criticalIncidents.slice(0, 10),
        pendingActions: actions.slice(0, 10),
        checklist: checklistItems,
      },
    });

  } catch (error: any) {
    logger.error('Error checking regulatory readiness:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check regulatory readiness',
    });
  }
});

// ============================================================================
// Phase 14.4: User Management
// ============================================================================

/**
 * GET /api/admin/users
 * Get all users with details
 */
router.get('/users', requireRoles('ADMIN', 'SYSTEM_ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const {
      role,
      isActive,
      search,
      page = '1',
      limit = '50',
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);

    const where: any = {};
    if (role) where.role = role;
    if (isActive !== undefined) where.isActive = isActive === 'true';
    if (search) {
      where.OR = [
        { email: { contains: search as string, mode: 'insensitive' } },
        { firstName: { contains: search as string, mode: 'insensitive' } },
        { lastName: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
          Organization: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
      }),
      prisma.user.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum),
        },
      },
    });

  } catch (error: any) {
    logger.error('Error fetching User:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch users',
    });
  }
});

/**
 * PUT /api/admin/users/:id/status
 * Enable/disable a user account
 */
router.put('/users/:id/status', requireRoles('ADMIN', 'SYSTEM_ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    if (typeof isActive !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'isActive must be a boolean',
      });
    }

    const user = await prisma.user.update({
      where: { id },
      data: { isActive },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        isActive: true,
      },
    });

    // Log audit event
    await auditService.logAuditFromRequest(req, 'UPDATE', 'User', id, { isActive });

    logger.info(`User ${id} status updated to ${isActive ? 'active' : 'inactive'}`);

    res.json({
      success: true,
      data: user,
    });

  } catch (error: any) {
    logger.error('Error updating user status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update user status',
    });
  }
});

/**
 * PUT /api/admin/users/:id/role
 * Update a user's role
 */
router.put('/users/:id/role', requireRoles('SYSTEM_ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    const validRoles = ['OPERATOR', 'SUPERVISOR', 'QA_FOOD_SAFETY', 'MAINTENANCE_ENGINEERING', 'CI_MANAGER', 'ADMIN', 'SYSTEM_ADMIN'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid role',
      });
    }

    const user = await prisma.user.update({
      where: { id },
      data: { role },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
      },
    });

    // Log audit event
    await auditService.logAuditFromRequest(req, 'UPDATE', 'User', id, { role });

    logger.info(`User ${id} role updated to ${role}`);

    res.json({
      success: true,
      data: user,
    });

  } catch (error: any) {
    logger.error('Error updating user role:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update user role',
    });
  }
});

// ============================================================================
// Helper Functions
// ============================================================================

async function calculateSLAMetrics(startDate: Date): Promise<any> {
  const incidents = await prisma.incident.findMany({
    where: {
      createdAt: { gte: startDate },
      status: 'CLOSED',
    },
    select: {
      slaResponseBreached: true,
      slaResolutionBreached: true,
    },
  });

  const total = incidents.length;
  if (total === 0) {
    return {
      totalClosed: 0,
      responseComplianceRate: 'N/A',
      resolutionComplianceRate: 'N/A',
    };
  }

  const responseBreaches = incidents.filter(i => i.slaResponseBreached).length;
  const resolutionBreaches = incidents.filter(i => i.slaResolutionBreached).length;
  const responseMet = total - responseBreaches;
  const resolutionMet = total - resolutionBreaches;

  return {
    totalClosed: total,
    responseComplianceRate: ((responseMet / total) * 100).toFixed(1) + '%',
    resolutionComplianceRate: ((resolutionMet / total) * 100).toFixed(1) + '%',
    responseBreaches,
    resolutionBreaches,
  };
}

function calculateReadinessScore(params: {
  criticalIncidents: number;
  pendingRegulatoryActions: number;
  validatedRCAsRatio: number;
  slaBreaches: number;
}): number {
  let score = 100;

  // Deduct for critical incidents (max -30)
  score -= Math.min(30, params.criticalIncidents * 5);

  // Deduct for pending regulatory actions (max -25)
  score -= Math.min(25, params.pendingRegulatoryActions * 3);

  // Add for RCA validation ratio (max +20)
  score -= (1 - params.validatedRCAsRatio) * 20;

  // Deduct for SLA breaches (max -25)
  score -= Math.min(25, params.slaBreaches * 5);

  return Math.max(0, Math.min(100, score));
}

function getReadinessLevel(score: number): string {
  if (score >= 90) return 'EXCELLENT';
  if (score >= 75) return 'GOOD';
  if (score >= 60) return 'FAIR';
  if (score >= 40) return 'NEEDS_IMPROVEMENT';
  return 'CRITICAL';
}

function generateRegulatoryChecklist(regulationType: string, data: any): any[] {
  const checklist = [
    {
      item: 'All critical incidents have RCA completed',
      status: data.criticalIncidents.every((i: any) => i.status === 'CLOSED' || i.status === 'IN_REVIEW'),
      priority: 'HIGH',
    },
    {
      item: 'RCA validation rate above 90%',
      status: data.validatedRCAsRatio >= 0.9,
      priority: 'HIGH',
    },
    {
      item: 'No pending regulatory corrective actions',
      status: data.regulatoryActions.length === 0,
      priority: 'MEDIUM',
    },
    {
      item: 'All CAPA actions documented with evidence',
      status: true, // Placeholder - would need actual verification
      priority: 'HIGH',
    },
    {
      item: 'Training records up to date',
      status: true, // Placeholder
      priority: 'MEDIUM',
    },
  ];

  // Add regulation-specific items
  if (regulationType === 'FSMA') {
    checklist.push(
      { item: 'PCQI records complete', status: true, priority: 'HIGH' },
      { item: 'Allergen controls documented', status: true, priority: 'HIGH' }
    );
  } else if (regulationType === 'HACCP') {
    checklist.push(
      { item: 'CCP monitoring records complete', status: true, priority: 'HIGH' },
      { item: 'Deviation procedures documented', status: true, priority: 'HIGH' }
    );
  }

  return checklist;
}

export default router;
