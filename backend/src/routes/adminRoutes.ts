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
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Apply authentication to all routes
router.use(authenticate);

// ============================================================================
// Phase 14.1: Audit Logs
// ============================================================================

/**
 * GET /api/admin/audit-logs
 * Get audit logs with filtering (ADMIN only - organization scoped)
 * SYSTEM_ADMIN does not have access to audit logs (they are organization-specific)
 */
router.get('/audit-logs', requireRoles('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const currentUser = req.user!;
    
    // ADMIN must have an organization
    if (!currentUser.organizationId) {
      return res.status(400).json({
        success: false,
        error: 'No organization associated with your account',
      });
    }

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
      organizationId: currentUser.organizationId, // Always filter by user's organization
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
 * Get audit trail for a specific entity (ADMIN only - organization scoped)
 */
router.get('/audit-logs/entity/:entity/:entityId', requireRoles('ADMIN', 'CI_MANAGER'), async (req: AuthRequest, res: Response) => {
  try {
    const { entity, entityId } = req.params;
    const currentUser = req.user!;

    // Must have an organization
    if (!currentUser.organizationId) {
      return res.status(400).json({
        success: false,
        error: 'No organization associated with your account',
      });
    }

    const trail = await auditService.getEntityAuditTrail(entity, entityId, currentUser.organizationId);

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
 * Get user activity summary (ADMIN only - organization scoped)
 */
router.get('/audit-logs/user/:userId', requireRoles('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const { days = '30' } = req.query;
    const currentUser = req.user!;

    // Must have an organization
    if (!currentUser.organizationId) {
      return res.status(400).json({
        success: false,
        error: 'No organization associated with your account',
      });
    }

    const summary = await auditService.getUserActivitySummary(
      userId, 
      currentUser.organizationId,
      parseInt(days as string)
    );

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
 * Generate compliance report for audit period (ADMIN only - organization scoped)
 */
router.get('/compliance-report', requireRoles('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const currentUser = req.user!;

    // Must have an organization
    if (!currentUser.organizationId) {
      return res.status(400).json({
        success: false,
        error: 'No organization associated with your account',
      });
    }

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
      currentUser.organizationId,
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
      prisma.user.count({ where: { isActive: true, role: { not: 'SYSTEM_ADMIN' } } }),
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
      // User statistics (exclude SYSTEM_ADMIN - they are app owners, not org users)
      prisma.user.groupBy({
        by: ['role'],
        _count: true,
        where: { isActive: true, role: { not: 'SYSTEM_ADMIN' } },
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
// Phase 14.3: Regulatory Readiness (Fully Dynamic - No Hardcoded Values)
// ============================================================================

/**
 * Regulatory configuration by type
 * Maps each regulatory framework to relevant incident types and categories
 */
const REGULATORY_CONFIG: Record<string, {
  name: string;
  incidentTypes: string[];
  relevantCategories: string[];
  description: string;
}> = {
  FSMA: {
    name: 'Food Safety Modernization Act',
    incidentTypes: ['FOOD_SAFETY'],
    relevantCategories: ['foreign material', 'contamination', 'allergen', 'biological', 'chemical', 'physical'],
    description: 'FDA food safety preventive controls',
  },
  HACCP: {
    name: 'Hazard Analysis Critical Control Points',
    incidentTypes: ['FOOD_SAFETY'],
    relevantCategories: ['ccp', 'critical control', 'hazard', 'biological', 'chemical', 'physical'],
    description: 'HACCP-based food safety management',
  },
  FDA: {
    name: 'Food and Drug Administration',
    incidentTypes: ['FOOD_SAFETY', 'MACHINE_EQUIPMENT'],
    relevantCategories: ['contamination', 'labeling', 'packaging', 'recall', 'complaint'],
    description: 'FDA regulatory compliance for food and drugs',
  },
  OSHA: {
    name: 'Occupational Safety and Health',
    incidentTypes: ['WORKPLACE_SAFETY'],
    relevantCategories: ['injury', 'safety', 'workplace', 'ergonomic', 'slip', 'fall', 'equipment'],
    description: 'OSHA workplace safety compliance',
  },
};

/**
 * GET /api/admin/regulatory-check
 * Check regulatory readiness status - FULLY DYNAMIC from database
 */
router.get('/regulatory-check', requireRoles('ADMIN', 'QA_FOOD_SAFETY'), async (req: AuthRequest, res: Response) => {
  try {
    const { regulationType = 'FSMA', timeRange, facilityId } = req.query;
    const currentUser = req.user;
    const organizationId = currentUser?.organizationId;

    // Validate regulation type
    const regConfig = REGULATORY_CONFIG[regulationType as string];
    if (!regConfig) {
      return res.status(400).json({
        success: false,
        error: `Invalid regulation type. Must be one of: ${Object.keys(REGULATORY_CONFIG).join(', ')}`,
      });
    }

    // Validate facilityId if provided (must belong to user's organization)
    let facilityInfo: { id: string; name: string } | null = null;
    if (facilityId && facilityId !== 'all') {
      const facility = await prisma.facility.findFirst({
        where: {
          id: facilityId as string,
          ...(organizationId ? { organizationId } : {}),
        },
        select: { id: true, name: true },
      });
      if (!facility) {
        return res.status(400).json({
          success: false,
          error: 'Invalid facility or not authorized to access this facility',
        });
      }
      facilityInfo = facility;
    }

    // Check for active tracking to determine the time window
    let trackingInfo: { 
      id: string; 
      trackingStartDate: Date; 
      windowDays: number; 
      isActive: boolean;
    } | null = null;
    
    if (organizationId) {
      const tracking = await prisma.regulatoryTracking.findFirst({
        where: {
          organizationId,
          regulationType: regulationType as string,
          ...(facilityId && facilityId !== 'all' ? { facilityId: facilityId as string } : { facilityId: null }),
        },
        select: {
          id: true,
          trackingStartDate: true,
          windowDays: true,
          isActive: true,
        },
      });
      trackingInfo = tracking;
    }

    // Build date filter based on tracking or default
    let dateFilter: any = {};
    let trackingStatus: 'active' | 'inactive' | 'not_started' = 'not_started';
    
    if (timeRange) {
      // Manual time range override
      const [start, end] = (timeRange as string).split(',').map(t => new Date(parseInt(t)));
      dateFilter = { gte: start, lte: end };
    } else if (trackingInfo?.isActive) {
      // Use tracking window (from start date, up to windowDays days)
      trackingStatus = 'active';
      const windowEnd = new Date();
      const windowStart = trackingInfo.trackingStartDate;
      
      // If more than windowDays have passed, use rolling window
      const daysSinceStart = Math.floor((windowEnd.getTime() - windowStart.getTime()) / (24 * 60 * 60 * 1000));
      if (daysSinceStart > trackingInfo.windowDays) {
        // Rolling window: last N days
        dateFilter = { gte: new Date(Date.now() - trackingInfo.windowDays * 24 * 60 * 60 * 1000) };
      } else {
        // Fixed window from tracking start
        dateFilter = { gte: windowStart };
      }
    } else if (trackingInfo) {
      trackingStatus = 'inactive';
      // Tracking exists but is inactive - still show data from tracking period
      dateFilter = { gte: trackingInfo.trackingStartDate };
    } else {
      // No tracking - return early with "not started" status
      return res.json({
        success: true,
        data: {
          regulationType,
          regulationName: regConfig.name,
          regulationDescription: regConfig.description,
          trackingStatus: 'not_started',
          readinessScore: null,
          readinessLevel: null,
          message: 'Tracking has not been started for this scope. Click "Start Tracking" to begin.',
          scope: {
            type: facilityId && facilityId !== 'all' ? 'facility' : 'organization',
            facilityId: facilityInfo?.id || null,
            facilityName: facilityInfo?.name || null,
          },
        },
      });
    }

    // Build organization filter if user has one, and optionally filter by facility
    const orgFilter = {
      ...(organizationId ? { organizationId } : {}),
      ...(facilityId && facilityId !== 'all' ? { facilityId: facilityId as string } : {}),
    };

    // Get facility count for organization-level reporting
    const facilitiesCount = organizationId ? await prisma.facility.count({
      where: { organizationId },
    }) : 0;

    // =============================================
    // 1. Get CRITICAL/HIGH incidents that need attention
    // =============================================
    const criticalIncidents = await prisma.incident.findMany({
      where: {
        ...orgFilter,
        type: { in: regConfig.incidentTypes as any[] },
        severity: { in: ['CRITICAL', 'HIGH'] },
        status: { notIn: ['CLOSED'] },
        createdAt: dateFilter,
      },
      select: {
        id: true,
        incidentNumber: true,
        severity: true,
        status: true,
        createdAt: true,
        slaResponseBreached: true,
        slaResolutionBreached: true,
        Category: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // =============================================
    // 2. Get RCA completion and validation statistics
    // =============================================
    // Get all RCAs in time window for relevant incident types
    const rcaStats = await prisma.rCAAnalysis.findMany({
      where: {
        createdAt: dateFilter,
        Incident: {
          ...orgFilter,
          type: { in: regConfig.incidentTypes as any[] },
        },
      },
      select: {
        id: true,
        isValidated: true,
        status: true,
        Incident: {
          select: { severity: true },
        },
      },
    });

    const totalRCAs = rcaStats.length;
    const validatedRCAs = rcaStats.filter(r => r.isValidated).length;
    const completedRCAs = rcaStats.filter(r => r.status === 'COMPLETED').length;
    const criticalIncidentsWithRCA = rcaStats.filter(r => 
      r.Incident.severity === 'CRITICAL' || r.Incident.severity === 'HIGH'
    ).length;

    // Get critical incidents that should have RCAs
    const criticalIncidentIds = criticalIncidents.map(i => i.id);
    const criticalIncidentsNeedingRCA = await prisma.incident.count({
      where: {
        ...orgFilter,
        severity: { in: ['CRITICAL', 'HIGH'] },
        type: { in: regConfig.incidentTypes as any[] },
        status: { notIn: ['DRAFT'] }, // Only submitted incidents need RCA
        createdAt: dateFilter,
      },
    });

    const criticalIncidentsHavingRCA = await prisma.rCAAnalysis.count({
      where: {
        Incident: {
          ...orgFilter,
          severity: { in: ['CRITICAL', 'HIGH'] },
          type: { in: regConfig.incidentTypes as any[] },
          createdAt: dateFilter,
        },
        status: 'COMPLETED',
      },
    });

    // =============================================
    // 3. Get CAPA action statistics
    // =============================================
    const capaActions = await prisma.cAPAction.findMany({
      where: {
        createdAt: dateFilter,
        RCAAnalysis: {
          Incident: {
            ...orgFilter,
            type: { in: regConfig.incidentTypes as any[] },
          },
        },
        OR: [
          { regulatoryTags: { hasSome: [regulationType as string] } },
          { regulatoryTags: { isEmpty: true } }, // Include untagged actions too
        ],
      },
      select: {
        id: true,
        status: true,
        completionEvidence: true,
        completedAt: true,
        dueDate: true,
        priority: true,
      },
    });

    const pendingCAPAActions = capaActions.filter(a => 
      a.status !== 'COMPLETED' && a.status !== 'VERIFIED'
    ).length;
    const overdueCAPAActions = capaActions.filter(a => 
      a.status !== 'COMPLETED' && a.status !== 'VERIFIED' && 
      a.dueDate && new Date(a.dueDate) < new Date()
    ).length;
    const completedCAPAActions = capaActions.filter(a => 
      a.status === 'COMPLETED' || a.status === 'VERIFIED'
    ).length;
    const capaWithEvidence = capaActions.filter(a => 
      (a.status === 'COMPLETED' || a.status === 'VERIFIED') && 
      a.completionEvidence && a.completionEvidence.trim() !== ''
    ).length;

    // =============================================
    // 4. Get SLA breach statistics
    // =============================================
    const slaBreaches = criticalIncidents.filter(i => 
      i.slaResponseBreached || i.slaResolutionBreached
    ).length;

    // =============================================
    // 5. FMIR statistics (for FSMA/HACCP/FDA)
    // =============================================
    let fmirStats = { total: 0, closed: 0, withEvidence: 0, auditPassed: 0 };
    if (['FSMA', 'HACCP', 'FDA'].includes(regulationType as string)) {
      const fmirData = await prisma.foreignMaterialIncident.findMany({
        where: {
          ...orgFilter,
          createdAt: dateFilter,
        },
        select: {
          id: true,
          status: true,
          isClosed: true,
          FMIREvidence: { select: { id: true } },
          FMIRAuditReport: { 
            select: { passesAudit: true },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      });

      fmirStats = {
        total: fmirData.length,
        closed: fmirData.filter(f => f.isClosed).length,
        withEvidence: fmirData.filter(f => f.FMIREvidence.length > 0).length,
        auditPassed: fmirData.filter(f => 
          f.FMIRAuditReport.length > 0 && f.FMIRAuditReport[0].passesAudit
        ).length,
      };
    }

    // =============================================
    // 6. Evidence coverage statistics
    // =============================================
    const incidentsWithEvidence = await prisma.incident.count({
      where: {
        ...orgFilter,
        type: { in: regConfig.incidentTypes as any[] },
        createdAt: dateFilter,
        Evidence: { some: {} },
      },
    });

    const totalIncidentsInPeriod = await prisma.incident.count({
      where: {
        ...orgFilter,
        type: { in: regConfig.incidentTypes as any[] },
        createdAt: dateFilter,
        status: { notIn: ['DRAFT'] },
      },
    });

    // =============================================
    // Calculate readiness score dynamically
    // =============================================
    const readinessScore = calculateDynamicReadinessScore({
      regulationType: regulationType as string,
      criticalIncidentsOpen: criticalIncidents.length,
      pendingCAPAActions,
      overdueCAPAActions,
      rcaValidationRate: totalRCAs > 0 ? validatedRCAs / totalRCAs : 1,
      rcaCompletionRate: criticalIncidentsNeedingRCA > 0 
        ? criticalIncidentsHavingRCA / criticalIncidentsNeedingRCA : 1,
      slaBreaches,
      capaEvidenceRate: completedCAPAActions > 0 
        ? capaWithEvidence / completedCAPAActions : 1,
      fmirClosureRate: fmirStats.total > 0 
        ? fmirStats.closed / fmirStats.total : 1,
      evidenceCoverage: totalIncidentsInPeriod > 0 
        ? incidentsWithEvidence / totalIncidentsInPeriod : 1,
    });

    // =============================================
    // Generate dynamic checklist
    // =============================================
    const checklistItems = await generateDynamicChecklist({
      regulationType: regulationType as string,
      organizationId,
      dateFilter,
      stats: {
        criticalIncidents,
        criticalIncidentsNeedingRCA,
        criticalIncidentsHavingRCA,
        totalRCAs,
        validatedRCAs,
        completedCAPAActions,
        capaWithEvidence,
        pendingCAPAActions,
        overdueCAPAActions,
        fmirStats,
        incidentsWithEvidence,
        totalIncidentsInPeriod,
        slaBreaches,
      },
    });

    res.json({
      success: true,
      data: {
        regulationType,
        regulationName: regConfig.name,
        regulationDescription: regConfig.description,
        readinessScore: readinessScore.toFixed(0),
        readinessLevel: getReadinessLevel(readinessScore),
        summary: {
          openCriticalIncidents: criticalIncidents.length,
          pendingRegulatoryActions: pendingCAPAActions,
          rcaValidationRate: totalRCAs > 0 
            ? ((validatedRCAs / totalRCAs) * 100).toFixed(1) + '%' 
            : 'N/A',
          slaBreaches,
        },
        detailedMetrics: {
          rca: {
            total: totalRCAs,
            validated: validatedRCAs,
            completed: completedRCAs,
            validationRate: totalRCAs > 0 ? ((validatedRCAs / totalRCAs) * 100).toFixed(1) : 'N/A',
          },
          capa: {
            total: capaActions.length,
            completed: completedCAPAActions,
            pending: pendingCAPAActions,
            overdue: overdueCAPAActions,
            withEvidence: capaWithEvidence,
            evidenceRate: completedCAPAActions > 0 
              ? ((capaWithEvidence / completedCAPAActions) * 100).toFixed(1) : 'N/A',
          },
          fmir: fmirStats,
          evidence: {
            incidentsWithEvidence,
            totalIncidents: totalIncidentsInPeriod,
            coverageRate: totalIncidentsInPeriod > 0 
              ? ((incidentsWithEvidence / totalIncidentsInPeriod) * 100).toFixed(1) : 'N/A',
          },
        },
        criticalItems: criticalIncidents.slice(0, 10),
        checklist: checklistItems,
        timeWindow: {
          start: dateFilter.gte?.toISOString(),
          end: dateFilter.lte?.toISOString() || new Date().toISOString(),
        },
        // Facility scope information
        scope: {
          type: facilityId && facilityId !== 'all' ? 'facility' : 'organization',
          facilityId: facilityInfo?.id || null,
          facilityName: facilityInfo?.name || null,
          totalFacilities: facilitiesCount,
        },
        // Tracking information
        tracking: trackingInfo ? {
          id: trackingInfo.id,
          status: trackingStatus,
          startDate: trackingInfo.trackingStartDate.toISOString(),
          windowDays: trackingInfo.windowDays,
          daysActive: Math.floor((new Date().getTime() - trackingInfo.trackingStartDate.getTime()) / (24 * 60 * 60 * 1000)),
        } : null,
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
// Phase 14.3b: Regulatory Tracking Management
// ============================================================================

/**
 * GET /api/admin/regulatory-tracking
 * Get tracking status for a facility or organization
 */
router.get('/regulatory-tracking', requireRoles('ADMIN', 'QA_FOOD_SAFETY'), async (req: AuthRequest, res: Response) => {
  try {
    const { facilityId, regulationType = 'FSMA' } = req.query;
    const currentUser = req.user;
    const organizationId = currentUser?.organizationId;

    if (!organizationId) {
      return res.status(400).json({
        success: false,
        error: 'No organization associated with your account',
      });
    }

    // Find existing tracking record
    const tracking = await prisma.regulatoryTracking.findFirst({
      where: {
        organizationId,
        regulationType: regulationType as string,
        ...(facilityId && facilityId !== 'all' ? { facilityId: facilityId as string } : { facilityId: null }),
      },
      include: {
        Facility: { select: { id: true, name: true } },
        User: { select: { firstName: true, lastName: true } },
        RegulatorySnapshot: {
          orderBy: { periodStart: 'desc' },
          take: 12, // Last 12 months
        },
      },
    });

    res.json({
      success: true,
      data: {
        tracking,
        hasActiveTracking: tracking?.isActive ?? false,
      },
    });

  } catch (error: any) {
    logger.error('Error fetching regulatory tracking:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch regulatory tracking',
    });
  }
});

/**
 * POST /api/admin/regulatory-tracking/start
 * Start tracking for a facility or organization
 */
router.post('/regulatory-tracking/start', requireRoles('ADMIN', 'QA_FOOD_SAFETY'), async (req: AuthRequest, res: Response) => {
  try {
    const { facilityId, regulationType = 'FSMA', windowDays = 30 } = req.body;
    const currentUser = req.user;
    const organizationId = currentUser?.organizationId;

    if (!organizationId) {
      return res.status(400).json({
        success: false,
        error: 'No organization associated with your account',
      });
    }

    // Validate facilityId if provided
    if (facilityId && facilityId !== 'all') {
      const facility = await prisma.facility.findFirst({
        where: { id: facilityId, organizationId },
      });
      if (!facility) {
        return res.status(400).json({
          success: false,
          error: 'Invalid facility or not authorized',
        });
      }
    }

    // Check if tracking already exists
    const existing = await prisma.regulatoryTracking.findFirst({
      where: {
        organizationId,
        regulationType,
        ...(facilityId && facilityId !== 'all' ? { facilityId } : { facilityId: null }),
      },
    });

    let tracking;
    if (existing) {
      // Reactivate existing tracking
      tracking = await prisma.regulatoryTracking.update({
        where: { id: existing.id },
        data: {
          isActive: true,
          trackingStartDate: new Date(),
          windowDays,
        },
        include: {
          Facility: { select: { id: true, name: true } },
        },
      });
    } else {
      // Create new tracking
      tracking = await prisma.regulatoryTracking.create({
        data: {
          id: uuidv4(),
          organizationId,
          regulationType,
          facilityId: facilityId && facilityId !== 'all' ? facilityId : null,
          createdBy: currentUser!.id,
          windowDays,
        },
        include: {
          Facility: { select: { id: true, name: true } },
        },
      });
    }

    // Log the action
    await auditService.logAuditEvent({
      action: 'CREATE',
      entity: 'RegulatoryTracking',
      entityId: tracking.id,
      userId: currentUser!.id,
      organizationId,
      changes: {
        regulationType,
        facilityId: facilityId || 'organization-level',
        windowDays,
      },
    });

    res.json({
      success: true,
      message: 'Regulatory tracking started',
      data: tracking,
    });

  } catch (error: any) {
    logger.error('Error starting regulatory tracking:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start regulatory tracking',
    });
  }
});

/**
 * POST /api/admin/regulatory-tracking/reset
 * Reset tracking - archives current period and starts fresh
 */
router.post('/regulatory-tracking/reset', requireRoles('ADMIN', 'QA_FOOD_SAFETY'), async (req: AuthRequest, res: Response) => {
  try {
    const { trackingId, createSnapshot = true } = req.body;
    const currentUser = req.user;
    const organizationId = currentUser?.organizationId;

    if (!organizationId) {
      return res.status(400).json({
        success: false,
        error: 'No organization associated with your account',
      });
    }

    // Find the tracking record
    const tracking = await prisma.regulatoryTracking.findFirst({
      where: {
        id: trackingId,
        organizationId,
      },
    });

    if (!tracking) {
      return res.status(404).json({
        success: false,
        error: 'Tracking record not found',
      });
    }

    // Calculate period for snapshot
    const periodEnd = new Date();
    const periodStart = tracking.trackingStartDate;
    const periodLabel = periodStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    // Create snapshot of current period if requested
    if (createSnapshot) {
      // Get current readiness data for the snapshot
      const regConfig = REGULATORY_CONFIG[tracking.regulationType];
      const dateFilter = { gte: periodStart, lte: periodEnd };
      const orgFilter = {
        organizationId,
        ...(tracking.facilityId ? { facilityId: tracking.facilityId } : {}),
      };

      // Get metrics for snapshot
      const totalIncidents = await prisma.incident.count({
        where: {
          ...orgFilter,
          type: { in: regConfig?.incidentTypes as any[] || ['FOOD_SAFETY'] },
          createdAt: dateFilter,
          status: { notIn: ['DRAFT'] },
        },
      });

      const criticalIncidents = await prisma.incident.count({
        where: {
          ...orgFilter,
          type: { in: regConfig?.incidentTypes as any[] || ['FOOD_SAFETY'] },
          severity: { in: ['CRITICAL', 'HIGH'] },
          createdAt: dateFilter,
        },
      });

      const rcasCompleted = await prisma.rCAAnalysis.count({
        where: {
          createdAt: dateFilter,
          status: 'COMPLETED',
          Incident: orgFilter,
        },
      });

      const capasCompleted = await prisma.cAPAction.count({
        where: {
          createdAt: dateFilter,
          status: { in: ['COMPLETED', 'VERIFIED'] },
          RCAAnalysis: { Incident: orgFilter },
        },
      });

      // Calculate a simple readiness score for the snapshot
      let snapshotScore = 100;
      if (totalIncidents > 0) {
        const criticalRate = criticalIncidents / totalIncidents;
        snapshotScore -= criticalRate * 30;
      }
      if (criticalIncidents > 0 && rcasCompleted < criticalIncidents) {
        snapshotScore -= ((criticalIncidents - rcasCompleted) / criticalIncidents) * 20;
      }
      snapshotScore = Math.max(0, Math.min(100, snapshotScore));

      await prisma.regulatorySnapshot.create({
        data: {
          id: uuidv4(),
          trackingId: tracking.id,
          periodStart,
          periodEnd,
          periodLabel,
          readinessScore: snapshotScore,
          readinessLevel: getReadinessLevel(snapshotScore),
          metrics: {
            totalIncidents,
            criticalIncidents,
            rcasCompleted,
            capasCompleted,
          },
          summary: {
            windowDays: tracking.windowDays,
            regulationType: tracking.regulationType,
          },
          totalIncidents,
          criticalIncidents,
          rcasCompleted,
          capasCompleted,
        },
      });
    }

    // Reset the tracking start date
    const updatedTracking = await prisma.regulatoryTracking.update({
      where: { id: tracking.id },
      data: {
        trackingStartDate: new Date(),
      },
      include: {
        Facility: { select: { id: true, name: true } },
        RegulatorySnapshot: {
          orderBy: { periodStart: 'desc' },
          take: 12,
        },
      },
    });

    // Log the action
    await auditService.logAuditEvent({
      action: 'UPDATE',
      entity: 'RegulatoryTracking',
      entityId: tracking.id,
      userId: currentUser!.id,
      organizationId,
      changes: {
        action: 'RESET',
        previousPeriod: { start: periodStart, end: periodEnd },
        snapshotCreated: createSnapshot,
      },
    });

    res.json({
      success: true,
      message: 'Regulatory tracking reset successfully',
      data: updatedTracking,
    });

  } catch (error: any) {
    logger.error('Error resetting regulatory tracking:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reset regulatory tracking',
    });
  }
});

/**
 * GET /api/admin/regulatory-tracking/history
 * Get historical snapshots for a tracking record
 */
router.get('/regulatory-tracking/history', requireRoles('ADMIN', 'QA_FOOD_SAFETY'), async (req: AuthRequest, res: Response) => {
  try {
    const { facilityId, regulationType = 'FSMA', months = '12' } = req.query;
    const currentUser = req.user;
    const organizationId = currentUser?.organizationId;

    if (!organizationId) {
      return res.status(400).json({
        success: false,
        error: 'No organization associated with your account',
      });
    }

    // Find the tracking record
    const tracking = await prisma.regulatoryTracking.findFirst({
      where: {
        organizationId,
        regulationType: regulationType as string,
        ...(facilityId && facilityId !== 'all' ? { facilityId: facilityId as string } : { facilityId: null }),
      },
    });

    if (!tracking) {
      return res.json({
        success: true,
        data: {
          snapshots: [],
          message: 'No tracking history found',
        },
      });
    }

    const snapshots = await prisma.regulatorySnapshot.findMany({
      where: {
        trackingId: tracking.id,
      },
      orderBy: { periodStart: 'desc' },
      take: parseInt(months as string),
    });

    res.json({
      success: true,
      data: {
        trackingId: tracking.id,
        regulationType: tracking.regulationType,
        facilityId: tracking.facilityId,
        snapshots,
      },
    });

  } catch (error: any) {
    logger.error('Error fetching regulatory history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch regulatory history',
    });
  }
});

/**
 * POST /api/admin/regulatory-tracking/stop
 * Stop/pause tracking without deleting
 */
router.post('/regulatory-tracking/stop', requireRoles('ADMIN', 'QA_FOOD_SAFETY'), async (req: AuthRequest, res: Response) => {
  try {
    const { trackingId } = req.body;
    const currentUser = req.user;
    const organizationId = currentUser?.organizationId;

    if (!organizationId) {
      return res.status(400).json({
        success: false,
        error: 'No organization associated with your account',
      });
    }

    const tracking = await prisma.regulatoryTracking.findFirst({
      where: {
        id: trackingId,
        organizationId,
      },
    });

    if (!tracking) {
      return res.status(404).json({
        success: false,
        error: 'Tracking record not found',
      });
    }

    const updatedTracking = await prisma.regulatoryTracking.update({
      where: { id: tracking.id },
      data: { isActive: false },
    });

    // Log the action
    await auditService.logAuditEvent({
      action: 'UPDATE',
      entity: 'RegulatoryTracking',
      entityId: tracking.id,
      userId: currentUser!.id,
      organizationId,
      changes: { action: 'STOPPED' },
    });

    res.json({
      success: true,
      message: 'Regulatory tracking stopped',
      data: updatedTracking,
    });

  } catch (error: any) {
    logger.error('Error stopping regulatory tracking:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to stop regulatory tracking',
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

/**
 * Calculate readiness score dynamically based on multiple factors
 * Each factor is weighted according to regulatory importance
 */
function calculateDynamicReadinessScore(params: {
  regulationType: string;
  criticalIncidentsOpen: number;
  pendingCAPAActions: number;
  overdueCAPAActions: number;
  rcaValidationRate: number;
  rcaCompletionRate: number;
  slaBreaches: number;
  capaEvidenceRate: number;
  fmirClosureRate: number;
  evidenceCoverage: number;
}): number {
  let score = 100;

  // =============================================
  // Core deductions (apply to all regulation types)
  // =============================================
  
  // Critical incidents open: -5 points each, max -20
  score -= Math.min(20, params.criticalIncidentsOpen * 5);

  // Pending CAPA actions: -2 points each, max -15
  score -= Math.min(15, params.pendingCAPAActions * 2);

  // Overdue CAPA actions: -5 points each (more severe), max -20
  score -= Math.min(20, params.overdueCAPAActions * 5);

  // RCA validation rate: lose up to 15 points for low validation
  score -= (1 - params.rcaValidationRate) * 15;

  // RCA completion rate for critical incidents: lose up to 15 points
  score -= (1 - params.rcaCompletionRate) * 15;

  // SLA breaches: -3 points each, max -15
  score -= Math.min(15, params.slaBreaches * 3);

  // =============================================
  // Documentation quality factors
  // =============================================
  
  // CAPA evidence rate: lose up to 10 points for missing evidence
  score -= (1 - params.capaEvidenceRate) * 10;

  // Evidence coverage: lose up to 10 points for poor coverage
  score -= (1 - params.evidenceCoverage) * 10;

  // =============================================
  // Regulation-specific adjustments
  // =============================================
  
  if (params.regulationType === 'FSMA' || params.regulationType === 'FDA') {
    // FMIR closure rate is important for food safety
    score -= (1 - params.fmirClosureRate) * 10;
  }

  if (params.regulationType === 'OSHA') {
    // OSHA places extra emphasis on timely corrective actions
    if (params.overdueCAPAActions > 0) {
      score -= 5; // Additional penalty for any overdue actions
    }
  }

  return Math.max(0, Math.min(100, score));
}

function getReadinessLevel(score: number): string {
  if (score >= 90) return 'EXCELLENT';
  if (score >= 75) return 'GOOD';
  if (score >= 60) return 'FAIR';
  if (score >= 40) return 'NEEDS_IMPROVEMENT';
  return 'CRITICAL';
}

/**
 * Generate dynamic checklist based on actual database state
 */
async function generateDynamicChecklist(params: {
  regulationType: string;
  organizationId?: string;
  dateFilter: any;
  stats: {
    criticalIncidents: any[];
    criticalIncidentsNeedingRCA: number;
    criticalIncidentsHavingRCA: number;
    totalRCAs: number;
    validatedRCAs: number;
    completedCAPAActions: number;
    capaWithEvidence: number;
    pendingCAPAActions: number;
    overdueCAPAActions: number;
    fmirStats: { total: number; closed: number; withEvidence: number; auditPassed: number };
    incidentsWithEvidence: number;
    totalIncidentsInPeriod: number;
    slaBreaches: number;
  };
}): Promise<{ item: string; status: boolean; priority: 'HIGH' | 'MEDIUM' | 'LOW'; details?: string }[]> {
  const { stats, regulationType, organizationId, dateFilter } = params;
  const checklist: { item: string; status: boolean; priority: 'HIGH' | 'MEDIUM' | 'LOW'; details?: string }[] = [];

  // =============================================
  // Universal checklist items (all regulation types)
  // =============================================

  // 1. All critical incidents have RCA completed
  const criticalIncidentsRCAComplete = stats.criticalIncidentsNeedingRCA === 0 || 
    stats.criticalIncidentsHavingRCA >= stats.criticalIncidentsNeedingRCA;
  checklist.push({
    item: 'All critical incidents have RCA completed',
    status: criticalIncidentsRCAComplete,
    priority: 'HIGH',
    details: `${stats.criticalIncidentsHavingRCA}/${stats.criticalIncidentsNeedingRCA} critical incidents have completed RCA`,
  });

  // 2. RCA validation rate above 90%
  const rcaValidationRate = stats.totalRCAs > 0 ? (stats.validatedRCAs / stats.totalRCAs) : 1;
  checklist.push({
    item: 'RCA validation rate above 90%',
    status: rcaValidationRate >= 0.9,
    priority: 'HIGH',
    details: `Current rate: ${(rcaValidationRate * 100).toFixed(1)}% (${stats.validatedRCAs}/${stats.totalRCAs})`,
  });

  // 3. No pending regulatory corrective actions
  checklist.push({
    item: 'No pending regulatory corrective actions',
    status: stats.pendingCAPAActions === 0,
    priority: 'MEDIUM',
    details: stats.pendingCAPAActions > 0 
      ? `${stats.pendingCAPAActions} pending actions (${stats.overdueCAPAActions} overdue)`
      : 'All actions completed',
  });

  // 4. All CAPA actions documented with evidence
  const capaEvidenceComplete = stats.completedCAPAActions === 0 || 
    stats.capaWithEvidence >= stats.completedCAPAActions;
  checklist.push({
    item: 'All CAPA actions documented with evidence',
    status: capaEvidenceComplete,
    priority: 'HIGH',
    details: `${stats.capaWithEvidence}/${stats.completedCAPAActions} completed actions have evidence`,
  });

  // 5. Training records up to date
  // Query actual training-related data if available
  const orgFilter = organizationId ? { organizationId } : {};
  const trainingIncidents = await prisma.incident.count({
    where: {
      ...orgFilter,
      type: 'WORKPLACE_SAFETY',
      createdAt: dateFilter,
      description: { contains: 'training', mode: 'insensitive' },
    },
  });
  
  // Check if there are training-related corrective actions pending
  const trainingCAPAsPending = await prisma.cAPAction.count({
    where: {
      createdAt: dateFilter,
      status: { notIn: ['COMPLETED', 'VERIFIED'] },
      OR: [
        { title: { contains: 'training', mode: 'insensitive' } },
        { description: { contains: 'training', mode: 'insensitive' } },
      ],
    },
  });

  checklist.push({
    item: 'Training records up to date',
    status: trainingCAPAsPending === 0,
    priority: 'MEDIUM',
    details: trainingCAPAsPending > 0 
      ? `${trainingCAPAsPending} training-related actions pending`
      : 'No pending training-related actions',
  });

  // =============================================
  // FSMA-specific checklist items
  // =============================================
  if (regulationType === 'FSMA') {
    // PCQI records - check for incidents mentioning PCQI
    const pcqiRelatedIncidents = await prisma.incident.count({
      where: {
        ...orgFilter,
        type: 'FOOD_SAFETY',
        createdAt: dateFilter,
        status: { notIn: ['CLOSED'] },
        OR: [
          { description: { contains: 'PCQI', mode: 'insensitive' } },
          { description: { contains: 'preventive control', mode: 'insensitive' } },
        ],
      },
    });

    checklist.push({
      item: 'PCQI records complete',
      status: pcqiRelatedIncidents === 0,
      priority: 'HIGH',
      details: pcqiRelatedIncidents > 0 
        ? `${pcqiRelatedIncidents} open PCQI-related incidents` 
        : 'No open PCQI-related incidents',
    });

    // Allergen controls - check for allergen incidents
    const allergenIncidents = await prisma.incident.count({
      where: {
        ...orgFilter,
        type: 'FOOD_SAFETY',
        createdAt: dateFilter,
        status: { notIn: ['CLOSED'] },
        OR: [
          { description: { contains: 'allergen', mode: 'insensitive' } },
          { Category: { name: { contains: 'allergen', mode: 'insensitive' } } },
        ],
      },
    });

    checklist.push({
      item: 'Allergen controls documented',
      status: allergenIncidents === 0,
      priority: 'HIGH',
      details: allergenIncidents > 0 
        ? `${allergenIncidents} open allergen-related incidents`
        : 'No open allergen-related incidents',
    });
  }

  // =============================================
  // HACCP-specific checklist items
  // =============================================
  if (regulationType === 'HACCP') {
    // CCP monitoring - check for CCP-related incidents
    const ccpIncidents = await prisma.incident.count({
      where: {
        ...orgFilter,
        type: 'FOOD_SAFETY',
        createdAt: dateFilter,
        status: { notIn: ['CLOSED'] },
        OR: [
          { description: { contains: 'CCP', mode: 'insensitive' } },
          { description: { contains: 'critical control point', mode: 'insensitive' } },
          { Category: { name: { contains: 'CCP', mode: 'insensitive' } } },
        ],
      },
    });

    checklist.push({
      item: 'CCP monitoring records complete',
      status: ccpIncidents === 0,
      priority: 'HIGH',
      details: ccpIncidents > 0 
        ? `${ccpIncidents} open CCP-related incidents`
        : 'No open CCP-related incidents',
    });

    // Deviation procedures - check for deviations with proper documentation
    const deviationIncidents = await prisma.incident.count({
      where: {
        ...orgFilter,
        type: 'FOOD_SAFETY',
        createdAt: dateFilter,
        status: { notIn: ['CLOSED'] },
        OR: [
          { description: { contains: 'deviation', mode: 'insensitive' } },
          { description: { contains: 'corrective action', mode: 'insensitive' } },
        ],
      },
    });

    checklist.push({
      item: 'Deviation procedures documented',
      status: deviationIncidents === 0,
      priority: 'HIGH',
      details: deviationIncidents > 0 
        ? `${deviationIncidents} open deviation-related incidents`
        : 'No open deviation-related incidents',
    });
  }

  // =============================================
  // FDA-specific checklist items
  // =============================================
  if (regulationType === 'FDA') {
    // FMIR completion rate
    checklist.push({
      item: 'All FMIR reports properly closed',
      status: stats.fmirStats.total === 0 || stats.fmirStats.closed === stats.fmirStats.total,
      priority: 'HIGH',
      details: `${stats.fmirStats.closed}/${stats.fmirStats.total} FMIR reports closed`,
    });

    // Evidence attached to FMIRs
    checklist.push({
      item: 'FMIR reports have evidence attached',
      status: stats.fmirStats.total === 0 || stats.fmirStats.withEvidence >= stats.fmirStats.total * 0.9,
      priority: 'MEDIUM',
      details: `${stats.fmirStats.withEvidence}/${stats.fmirStats.total} reports have evidence`,
    });
  }

  // =============================================
  // OSHA-specific checklist items  
  // =============================================
  if (regulationType === 'OSHA') {
    // Workplace safety incidents properly documented
    const workplaceSafetyOpen = await prisma.incident.count({
      where: {
        ...orgFilter,
        type: 'WORKPLACE_SAFETY',
        createdAt: dateFilter,
        status: { notIn: ['CLOSED'] },
        severity: { in: ['CRITICAL', 'HIGH'] },
      },
    });

    checklist.push({
      item: 'All workplace safety incidents documented',
      status: workplaceSafetyOpen === 0,
      priority: 'HIGH',
      details: workplaceSafetyOpen > 0 
        ? `${workplaceSafetyOpen} open safety incidents require attention`
        : 'No open critical safety incidents',
    });

    // OSHA 300 log compliance (check for incidents mentioning OSHA case numbers)
    const oshaRelatedIncidents = await prisma.incident.count({
      where: {
        ...orgFilter,
        type: 'WORKPLACE_SAFETY',
        createdAt: dateFilter,
        oshaCaseNumber: { not: null },
      },
    });

    const oshaIncidentsTotal = await prisma.incident.count({
      where: {
        ...orgFilter,
        type: 'WORKPLACE_SAFETY',
        createdAt: dateFilter,
        severity: { in: ['CRITICAL', 'HIGH'] },
      },
    });

    checklist.push({
      item: 'OSHA 300 log entries complete',
      status: oshaIncidentsTotal === 0 || oshaRelatedIncidents >= oshaIncidentsTotal * 0.9,
      priority: 'HIGH',
      details: `${oshaRelatedIncidents}/${oshaIncidentsTotal} critical incidents have OSHA case numbers`,
    });

    // Investigation timeline compliance
    const investigationsPending = await prisma.incident.count({
      where: {
        ...orgFilter,
        type: 'WORKPLACE_SAFETY',
        createdAt: dateFilter,
        investigationSubmittedAt: null,
        severity: { in: ['CRITICAL', 'HIGH'] },
        status: { notIn: ['DRAFT', 'CLOSED'] },
      },
    });

    checklist.push({
      item: 'Investigation timelines met',
      status: investigationsPending === 0,
      priority: 'MEDIUM',
      details: investigationsPending > 0 
        ? `${investigationsPending} incidents pending investigation`
        : 'All investigations completed on time',
    });
  }

  return checklist;
}

export default router;
