/**
 * Phase 11: Reporting & Compliance Routes
 * API endpoints for generating reports, audit trails, and compliance documentation
 */

import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requireRoles, requireMinimumRole } from '../middleware/rbac';
import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';

const router = Router();

// Apply authentication to all routes
router.use(authenticate);

// ============================================================================
// Phase 11.1: Full RCA Report Export
// ============================================================================

/**
 * GET /api/reports/rca/:rcaId
 * Generate comprehensive RCA report data
 */
router.get('/rca/:rcaId', requireRoles('QA_FOOD_SAFETY', 'CI_MANAGER', 'ADMIN', 'SYSTEM_ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { rcaId } = req.params;

    const rcaAnalysis = await prisma.rCAAnalysis.findUnique({
      where: { id: rcaId },
      include: {
        Incident: {
          include: {
            Category: true,
            Facility: true,
            Department: true,
            Area: true,
            Line: true,
            Shift: true,
            User_Incident_createdByIdToUser: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
            User_Incident_assignedToIdToUser: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
            Evidence: true,
            Comment: {
              include: {
                User: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                  },
                },
              },
              orderBy: { createdAt: 'asc' },
            },
          },
        },
        User: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
          },
        },
        CAPAction: {
          include: {
            User: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
          orderBy: { priority: 'desc' },
        },
      },
    });

    if (!rcaAnalysis) {
      return res.status(404).json({
        success: false,
        error: 'RCA Analysis not found',
      });
    }

    // Structure data for report
    const reportData = {
      generatedAt: new Date().toISOString(),
      reportTitle: `RCA Report - ${rcaAnalysis.Incident.incidentNumber}`,
      
      // Executive Summary
      executiveSummary: {
        incidentNumber: rcaAnalysis.Incident.incidentNumber,
        incidentType: rcaAnalysis.Incident.type,
        severity: rcaAnalysis.Incident.severity,
        category: rcaAnalysis.Incident.Category.name,
        facility: rcaAnalysis.Incident.Facility.name,
        occurredAt: rcaAnalysis.Incident.occurredAt,
        reportedAt: rcaAnalysis.Incident.reportedAt,
        incidentStatus: rcaAnalysis.Incident.status,
        rcaStatus: rcaAnalysis.status,
        rcaMethod: rcaAnalysis.method,
        rootCause: rcaAnalysis.rootCauseStatement,
        aiSummary: rcaAnalysis.Incident.aiSummary,
      },

      // Incident Details
      incidentDetails: {
        description: rcaAnalysis.Incident.description,
        customTitle: rcaAnalysis.Incident.customTitle,
        department: rcaAnalysis.Incident.Department?.name || 'N/A',
        area: rcaAnalysis.Incident.Area?.name || 'N/A',
        line: rcaAnalysis.Incident.Line?.name || 'N/A',
        shift: rcaAnalysis.Incident.Shift?.name || 'N/A',
        productName: rcaAnalysis.Incident.productName,
        lotNumber: rcaAnalysis.Incident.lotNumber,
        machineId: rcaAnalysis.Incident.machineId,
        reportedBy: rcaAnalysis.Incident.User_Incident_createdByIdToUser ? 
          `${rcaAnalysis.Incident.User_Incident_createdByIdToUser.firstName} ${rcaAnalysis.Incident.User_Incident_createdByIdToUser.lastName}` : 'Unknown',
        assignedTo: rcaAnalysis.Incident.User_Incident_assignedToIdToUser ?
          `${rcaAnalysis.Incident.User_Incident_assignedToIdToUser.firstName} ${rcaAnalysis.Incident.User_Incident_assignedToIdToUser.lastName}` : 'Unassigned',
      },

      // RCA Investigation
      investigation: {
        analyst: rcaAnalysis.User ?
          `${rcaAnalysis.User.firstName} ${rcaAnalysis.User.lastName}` : 'N/A',
        method: rcaAnalysis.method,
        startedAt: rcaAnalysis.createdAt,
        isValidated: rcaAnalysis.isValidated,
        validatedAt: rcaAnalysis.validatedAt,
      },

      // Analysis Data
      analysisData: {
        fiveWhysData: rcaAnalysis.fiveWhysData,
        fishboneData: rcaAnalysis.fishboneData,
        aiRecommendedMethod: rcaAnalysis.aiRecommendedMethod,
        aiRecommendationReason: rcaAnalysis.aiRecommendationReason,
      },

      // Root Cause Determination
      rootCauseDetermination: {
        rootCause: rcaAnalysis.rootCauseStatement || 'Under investigation',
      },

      // CAPA Actions
      correctiveActions: {
        totalActions: rcaAnalysis.CAPAction.length,
        summary: summarizeCAPA(rcaAnalysis.CAPAction),
        actions: rcaAnalysis.CAPAction.map((action: any) => ({
          id: action.id,
          type: action.actionType,
          title: action.title,
          description: action.description,
          owner: action.User ?
            `${action.User.firstName} ${action.User.lastName}` : 'Unassigned',
          priority: action.priority,
          status: action.status,
          dueDate: action.dueDate,
          completedAt: action.completedAt,
          isEffective: action.isEffective,
          effectivenessScore: action.effectivenessScore,
          aiQualityScore: action.aiQualityScore,
          regulatoryTags: action.regulatoryTags,
        })),
      },

      // Evidence & Documentation
      evidence: rcaAnalysis.Incident.Evidence.map((ev: any) => ({
        id: ev.id,
        type: ev.type,
        fileName: ev.fileName,
        description: ev.description,
        uploadedAt: ev.uploadedAt,
      })),

      // Comments
      comments: rcaAnalysis.Incident.Comment.map((c: any) => ({
        author: c.User ? `${c.User.firstName} ${c.User.lastName}` : 'Unknown',
        content: c.content,
        createdAt: c.createdAt,
      })),

      // Regulatory Compliance
      compliance: {
        regulatoryTags: collectRegulatoryTags(rcaAnalysis.CAPAction),
        complianceNotes: generateComplianceNotes(rcaAnalysis),
      },
    };

    res.json({
      success: true,
      data: reportData,
    });

  } catch (error: any) {
    logger.error('Error generating RCA report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate RCA report',
    });
  }
});

// ============================================================================
// Phase 11.2: Audit Reports
// ============================================================================

/**
 * GET /api/reports/audit
 * Generate audit trail report
 */
router.get('/audit', requireRoles('QA_FOOD_SAFETY', 'ADMIN', 'SYSTEM_ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { 
      startDate,
      endDate,
      facilityId,
      incidentType,
      limit = '100',
    } = req.query;

    const where: any = {};
    
    // Date range filter
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate as string);
      if (endDate) where.createdAt.lte = new Date(endDate as string);
    }

    // Get incidents with audit trail
    const incidents = await prisma.incident.findMany({
      where: {
        ...where,
        ...(facilityId && { facilityId: facilityId as string }),
        ...(incidentType && { type: incidentType as any }),
      },
      include: {
        Category: true,
        Facility: true,
        User_Incident_createdByIdToUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
          },
        },
        User_Incident_assignedToIdToUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
          },
        },
        RCAAnalysis: {
          include: {
            User: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
            CAPAction: {
              select: {
                id: true,
                status: true,
                completedAt: true,
              },
            },
          },
        },
        Comment: {
          include: {
            User: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string),
    });

    // Build audit report
    const auditReport = {
      generatedAt: new Date().toISOString(),
      reportPeriod: {
        start: startDate || 'Beginning',
        end: endDate || 'Present',
      },
      summary: {
        totalIncidents: incidents.length,
        byType: countByField(incidents, 'type'),
        byStatus: countByField(incidents, 'status'),
        bySeverity: countByField(incidents, 'severity'),
        withRCA: incidents.filter((i: any) => i.RCAAnalysis.length > 0).length,
        completedRCAs: incidents.filter((i: any) => 
          i.RCAAnalysis.some((r: any) => r.status === 'COMPLETED' || r.isValidated)
        ).length,
      },
      incidents: incidents.map((incident: any) => ({
        id: incident.id,
        incidentNumber: incident.incidentNumber,
        type: incident.type,
        category: incident.Category.name,
        facility: incident.Facility.name,
        severity: incident.severity,
        status: incident.status,
        occurredAt: incident.occurredAt,
        reportedAt: incident.reportedAt,
        reportedBy: incident.User_Incident_createdByIdToUser ? 
          `${incident.User_Incident_createdByIdToUser.firstName} ${incident.User_Incident_createdByIdToUser.lastName}` : 'Unknown',
        assignedTo: incident.User_Incident_assignedToIdToUser ?
          `${incident.User_Incident_assignedToIdToUser.firstName} ${incident.User_Incident_assignedToIdToUser.lastName}` : 'Unassigned',
        
        // RCA Summary
        rcaSummary: incident.RCAAnalysis.length > 0 ? {
          rcaId: incident.RCAAnalysis[0].id,
          status: incident.RCAAnalysis[0].status,
          method: incident.RCAAnalysis[0].method,
          rootCause: incident.RCAAnalysis[0].rootCauseStatement,
          analyst: incident.RCAAnalysis[0].User ?
            `${incident.RCAAnalysis[0].User.firstName} ${incident.RCAAnalysis[0].User.lastName}` : null,
          isValidated: incident.RCAAnalysis[0].isValidated,
          actionsCount: incident.RCAAnalysis[0].CAPAction.length,
          completedActions: incident.RCAAnalysis[0].CAPAction.filter((a: any) => 
            a.status === 'COMPLETED' || a.status === 'VERIFIED'
          ).length,
        } : null,

        // Audit Trail
        auditTrail: generateAuditTrail(incident),
      })),
    };

    res.json({
      success: true,
      data: auditReport,
    });

  } catch (error: any) {
    logger.error('Error generating audit report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate audit report',
    });
  }
});

// ============================================================================
// Phase 11.3: Regulatory Evidence Archive
// ============================================================================

/**
 * GET /api/reports/regulatory/:type
 * Generate regulatory evidence package
 */
router.get('/regulatory/:type', requireRoles('QA_FOOD_SAFETY', 'ADMIN', 'SYSTEM_ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { type } = req.params;
    const { startDate, endDate, facilityId } = req.query;

    const regulatoryType = type.toUpperCase();
    const validTypes = ['FSMA', 'HACCP', 'OSHA', 'GMP', 'ISO22000', 'FDA', 'SQF', 'BRC'];
    
    if (!validTypes.includes(regulatoryType)) {
      return res.status(400).json({
        success: false,
        error: `Invalid regulatory type. Must be one of: ${validTypes.join(', ')}`,
      });
    }

    // Build date filter
    const dateFilter: any = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.gte = new Date(startDate as string);
      if (endDate) dateFilter.createdAt.lte = new Date(endDate as string);
    }

    // Find CAPA actions with matching regulatory tags
    const actions = await prisma.cAPAction.findMany({
      where: {
        regulatoryTags: {
          has: regulatoryType,
        },
        ...dateFilter,
      },
      include: {
        User: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        RCAAnalysis: {
          include: {
            Incident: {
              include: {
                Category: true,
                Facility: true,
                Evidence: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Group by incident for context
    const incidentMap = new Map<string, any>();
    
    for (const action of actions) {
      if (!action.RCAAnalysis?.Incident) continue;
      const incidentId = action.RCAAnalysis.Incident.id;
      if (!incidentMap.has(incidentId)) {
        incidentMap.set(incidentId, {
          incident: {
            id: action.RCAAnalysis.Incident.id,
            incidentNumber: action.RCAAnalysis.Incident.incidentNumber,
            type: action.RCAAnalysis.Incident.type,
            category: action.RCAAnalysis.Incident.Category?.name || 'Unknown',
            facility: action.RCAAnalysis.Incident.Facility?.name || 'Unknown',
            description: action.RCAAnalysis.Incident.description,
            occurredAt: action.RCAAnalysis.Incident.occurredAt,
            severity: action.RCAAnalysis.Incident.severity,
          },
          rcaAnalysis: {
            id: action.RCAAnalysis.id,
            rootCause: action.RCAAnalysis.rootCauseStatement,
            status: action.RCAAnalysis.status,
            method: action.RCAAnalysis.method,
          },
          actions: [],
          evidence: action.RCAAnalysis.Incident.Evidence,
        });
      }
      
      incidentMap.get(incidentId)?.actions.push({
        id: action.id,
        type: action.actionType,
        title: action.title,
        description: action.description,
        owner: action.User ? 
          `${action.User.firstName} ${action.User.lastName}` : 'Unassigned',
        status: action.status,
        dueDate: action.dueDate,
        completedAt: action.completedAt,
        isEffective: action.isEffective,
        regulatoryTags: action.regulatoryTags,
      });
    }

    const regulatoryReport = {
      generatedAt: new Date().toISOString(),
      regulatoryFramework: regulatoryType,
      reportPeriod: {
        start: startDate || 'All time',
        end: endDate || 'Present',
      },
      summary: {
        totalIncidents: incidentMap.size,
        totalActions: actions.length,
        completedActions: actions.filter((a: any) => a.status === 'COMPLETED' || a.status === 'VERIFIED').length,
        verifiedActions: actions.filter((a: any) => a.status === 'VERIFIED').length,
        pendingActions: actions.filter((a: any) => a.status === 'PLANNED' || a.status === 'IN_PROGRESS').length,
      },
      complianceGuidance: getRegulatoryGuidance(regulatoryType),
      records: Array.from(incidentMap.values()),
    };

    res.json({
      success: true,
      data: regulatoryReport,
    });

  } catch (error: any) {
    logger.error('Error generating regulatory report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate regulatory report',
    });
  }
});

// ============================================================================
// Phase 11.4: Executive Dashboard Data
// ============================================================================

/**
 * GET /api/reports/executive
 * Generate executive dashboard data
 */
router.get('/executive', requireRoles('CI_MANAGER', 'ADMIN', 'SYSTEM_ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { period = '30', facilityId } = req.query;
    const periodDays = parseInt(period as string);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - periodDays);

    const baseWhere: any = {
      createdAt: { gte: startDate },
      ...(facilityId && { facilityId: facilityId as string }),
    };

    // Get aggregate metrics
    const [
      totalIncidents,
      incidentsByType,
      incidentsBySeverity,
      incidentsByStatus,
      incidentsByFacility,
      rcaCount,
      capaCount,
      slaMetrics,
    ] = await Promise.all([
      prisma.incident.count({ where: baseWhere }),
      prisma.incident.groupBy({
        by: ['type'],
        where: baseWhere,
        _count: { id: true },
      }),
      prisma.incident.groupBy({
        by: ['severity'],
        where: baseWhere,
        _count: { id: true },
      }),
      prisma.incident.groupBy({
        by: ['status'],
        where: baseWhere,
        _count: { id: true },
      }),
      prisma.incident.groupBy({
        by: ['facilityId'],
        where: baseWhere,
        _count: { id: true },
      }),
      prisma.rCAAnalysis.count({
        where: {
          createdAt: { gte: startDate },
        },
      }),
      prisma.cAPAction.count({
        where: {
          createdAt: { gte: startDate },
        },
      }),
      // Count SLA breaches separately
      prisma.incident.count({
        where: {
          ...baseWhere,
          slaResponseBreached: true,
        },
      }),
    ]);

    // Get resolution breaches
    const slaResolutionBreaches = await prisma.incident.count({
      where: {
        ...baseWhere,
        slaResolutionBreached: true,
      },
    });
    
    const totalSlaBreaches = (slaMetrics as number) + slaResolutionBreaches;

    // Calculate RCA and CAPA quality scores
    const rcaAnalyses = await prisma.rCAAnalysis.findMany({
      where: { createdAt: { gte: startDate } },
      select: { status: true, isValidated: true },
    });
    
    const capaActions = await prisma.cAPAction.findMany({
      where: { createdAt: { gte: startDate } },
      select: { aiQualityScore: true, status: true, isEffective: true },
    });
    
    // Calculate avg RCA score based on completion/validation status
    const completedRCAs = rcaAnalyses.filter((r: any) => r.status === 'COMPLETED' || r.isValidated).length;
    const avgRCAScore = rcaCount > 0 ? ((completedRCAs / rcaCount) * 100).toFixed(0) + '%' : 'N/A';
    
    // Calculate avg CAPA quality score
    const capaScores = capaActions.filter((c: any) => c.aiQualityScore).map((c: any) => c.aiQualityScore);
    const avgCAPAQuality = capaScores.length > 0 
      ? (capaScores.reduce((a: number, b: number) => a + b, 0) / capaScores.length).toFixed(1) + '/10'
      : 'N/A';

    // Calculate trends
    const previousStartDate = new Date(startDate);
    previousStartDate.setDate(previousStartDate.getDate() - periodDays);

    const previousIncidents = await prisma.incident.count({
      where: {
        createdAt: { gte: previousStartDate, lt: startDate },
        ...(facilityId && { facilityId: facilityId as string }),
      },
    });

    const trend = previousIncidents > 0 
      ? ((totalIncidents - previousIncidents) / previousIncidents * 100).toFixed(1)
      : totalIncidents > 0 ? '+100' : '0';

    // Get facility names - filter out null facilityIds
    const facilityIds = incidentsByFacility
      .map((f: any) => f.facilityId)
      .filter((id: string | null) => id !== null);
    
    const facilities = facilityIds.length > 0 ? await prisma.facility.findMany({
      where: {
        id: { in: facilityIds },
      },
      select: { id: true, name: true },
    }) : [];
    const facilityMap = new Map(facilities.map((f: any) => [f.id, f.name]));

    // Get critical/overdue items
    // Filter for incidents that are not closed or rejected (still active)
    const criticalItems = await prisma.incident.findMany({
      where: {
        ...baseWhere,
        OR: [
          { severity: 'CRITICAL' },
          { slaResponseBreached: true },
          { slaResolutionBreached: true },
        ],
        status: { 
          notIn: ['CLOSED', 'REJECTED'] as any
        },
      },
      include: {
        Facility: { select: { name: true } },
        Category: { select: { name: true } },
        User_Incident_assignedToIdToUser: { select: { firstName: true, lastName: true } },
      },
      orderBy: { occurredAt: 'desc' },
      take: 10,
    });

    // Get overdue CAPA actions
    const overdueActions = await prisma.cAPAction.findMany({
      where: {
        dueDate: { lt: new Date() },
        status: { in: ['PLANNED', 'IN_PROGRESS'] as any },
      },
      include: {
        User: { select: { firstName: true, lastName: true } },
        RCAAnalysis: {
          include: {
            Incident: {
              select: { incidentNumber: true, Facility: { select: { name: true } } },
            },
          },
        },
      },
      orderBy: { dueDate: 'asc' },
      take: 10,
    });

    const executiveDashboard = {
      generatedAt: new Date().toISOString(),
      period: {
        days: periodDays,
        start: startDate.toISOString(),
        end: new Date().toISOString(),
      },

      // Key Metrics
      keyMetrics: {
        totalIncidents,
        trend: `${trend}%`,
        avgRCAScore,
        avgCAPAQuality,
        slaCompliance: totalIncidents > 0 
          ? (((totalIncidents - totalSlaBreaches) / totalIncidents) * 100).toFixed(1) + '%'
          : '100%',
      },

      // Breakdowns
      byType: incidentsByType.map((i: any) => ({
        type: i.type,
        count: i._count.id,
        percentage: totalIncidents > 0 ? ((i._count.id / totalIncidents) * 100).toFixed(1) + '%' : '0%',
      })),

      bySeverity: incidentsBySeverity.map((i: any) => ({
        severity: i.severity || 'UNASSIGNED',
        count: i._count.id,
        percentage: totalIncidents > 0 ? ((i._count.id / totalIncidents) * 100).toFixed(1) + '%' : '0%',
      })),

      byStatus: incidentsByStatus.map((i: any) => ({
        status: i.status,
        count: i._count.id,
        percentage: totalIncidents > 0 ? ((i._count.id / totalIncidents) * 100).toFixed(1) + '%' : '0%',
      })),

      byFacility: incidentsByFacility.map((i: any) => ({
        facilityId: i.facilityId,
        facilityName: facilityMap.get(i.facilityId) || 'Unknown',
        count: i._count.id,
        percentage: totalIncidents > 0 ? ((i._count.id / totalIncidents) * 100).toFixed(1) + '%' : '0%',
      })),

      // Critical Items
      criticalItems: criticalItems.map((i: any) => ({
        id: i.id,
        incidentNumber: i.incidentNumber,
        type: i.type,
        severity: i.severity,
        category: i.Category?.name || 'Uncategorized',
        facility: i.Facility?.name || 'Unknown',
        assignedTo: i.User_Incident_assignedToIdToUser ? 
          `${i.User_Incident_assignedToIdToUser.firstName} ${i.User_Incident_assignedToIdToUser.lastName}` : 'Unassigned',
        occurredAt: i.occurredAt,
        slaBreached: i.slaResponseBreached || i.slaResolutionBreached,
      })),

      // Overdue Actions
      overdueActions: overdueActions.map((a: any) => ({
        id: a.id,
        incidentNumber: a.RCAAnalysis?.Incident?.incidentNumber || 'N/A',
        facility: a.RCAAnalysis?.Incident?.Facility?.name || 'Unknown',
        description: a.description ? (a.description.substring(0, 100) + (a.description.length > 100 ? '...' : '')) : '',
        owner: a.User ? `${a.User.firstName} ${a.User.lastName}` : 'Unassigned',
        dueDate: a.dueDate,
        daysOverdue: a.dueDate ? Math.floor((new Date().getTime() - new Date(a.dueDate).getTime()) / (1000 * 60 * 60 * 24)) : 0,
      })),
    };

    res.json({
      success: true,
      data: executiveDashboard,
    });

  } catch (error: any) {
    logger.error('Error generating executive dashboard:', error);
    logger.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      error: 'Failed to generate executive dashboard',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

/**
 * GET /api/reports/trends
 * Generate time-series trend data
 */
router.get('/trends', requireRoles('CI_MANAGER', 'ADMIN', 'SYSTEM_ADMIN', 'QA_FOOD_SAFETY'), async (req: AuthRequest, res: Response) => {
  try {
    const { 
      period = '30',
      facilityId,
      groupBy = 'day',
    } = req.query;

    const periodDays = parseInt(period as string);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - periodDays);

    // Get incidents grouped by date
    const incidents = await prisma.incident.findMany({
      where: {
        createdAt: { gte: startDate },
        ...(facilityId && { facilityId: facilityId as string }),
      },
      select: {
        id: true,
        type: true,
        severity: true,
        status: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    // Group data by time period
    const groupedData = new Map<string, { total: number; byType: Record<string, number>; bySeverity: Record<string, number> }>();

    for (const incident of incidents) {
      const dateKey = getDateKey(incident.createdAt, groupBy as string);
      
      if (!groupedData.has(dateKey)) {
        groupedData.set(dateKey, { 
          total: 0, 
          byType: {}, 
          bySeverity: {} 
        });
      }

      const group = groupedData.get(dateKey)!;
      group.total++;
      group.byType[incident.type] = (group.byType[incident.type] || 0) + 1;
      if (incident.severity) {
        group.bySeverity[incident.severity] = (group.bySeverity[incident.severity] || 0) + 1;
      }
    }

    // Convert to array for charting
    const trendData = Array.from(groupedData.entries())
      .map(([date, data]) => ({
        date,
        ...data,
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    res.json({
      success: true,
      data: {
        period: {
          days: periodDays,
          groupBy,
          start: startDate.toISOString(),
          end: new Date().toISOString(),
        },
        trends: trendData,
        summary: {
          total: incidents.length,
          average: trendData.length > 0 ? (incidents.length / trendData.length).toFixed(1) : '0',
        },
      },
    });

  } catch (error: any) {
    logger.error('Error generating trend data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate trend data',
    });
  }
});

// ============================================================================
// Helper Functions
// ============================================================================

function summarizeCAPA(actions: any[]): Record<string, number> {
  const summary: Record<string, number> = {
    PLANNED: 0,
    IN_PROGRESS: 0,
    COMPLETED: 0,
    VERIFIED: 0,
    INEFFECTIVE: 0,
  };

  for (const action of actions) {
    if (summary.hasOwnProperty(action.status)) {
      summary[action.status]++;
    }
  }

  return summary;
}

function collectRegulatoryTags(actions: any[]): string[] {
  const tags = new Set<string>();
  for (const action of actions) {
    if (action.regulatoryTags) {
      for (const tag of action.regulatoryTags) {
        tags.add(tag);
      }
    }
  }
  return Array.from(tags);
}

function generateComplianceNotes(rcaAnalysis: any): string[] {
  const notes: string[] = [];

  if (rcaAnalysis.Incident.type === 'FOOD_SAFETY') {
    notes.push('Food safety incident - may require regulatory notification per FSMA requirements');
  }

  if (rcaAnalysis.Incident.severity === 'CRITICAL') {
    notes.push('Critical severity - ensure all corrective actions are documented and verified');
  }

  const unverifiedActions = rcaAnalysis.CAPAction.filter((a: any) => a.status !== 'VERIFIED');
  if (unverifiedActions.length > 0) {
    notes.push(`${unverifiedActions.length} action(s) pending verification`);
  }

  if (!rcaAnalysis.isValidated) {
    notes.push('RCA analysis has not been validated');
  }

  return notes;
}

function countByField(items: any[], field: string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    const value = item[field] || 'UNKNOWN';
    counts[value] = (counts[value] || 0) + 1;
  }
  return counts;
}

function generateAuditTrail(incident: any): any[] {
  const trail: any[] = [];

  trail.push({
    timestamp: incident.createdAt,
    action: 'CREATED',
    user: incident.User_Incident_createdByIdToUser ? 
      `${incident.User_Incident_createdByIdToUser.firstName} ${incident.User_Incident_createdByIdToUser.lastName}` : 'System',
    details: 'Incident created',
  });

  if (incident.User_Incident_assignedToIdToUser && incident.assignedToId !== incident.createdById) {
    trail.push({
      timestamp: incident.updatedAt,
      action: 'ASSIGNED',
      user: 'System',
      details: `Assigned to ${incident.User_Incident_assignedToIdToUser.firstName} ${incident.User_Incident_assignedToIdToUser.lastName}`,
    });
  }

  for (const comment of incident.Comment || []) {
    trail.push({
      timestamp: comment.createdAt,
      action: 'COMMENT',
      user: comment.User ? 
        `${comment.User.firstName} ${comment.User.lastName}` : 'Unknown',
      details: 'Added comment',
    });
  }

  if (incident.RCAAnalysis && incident.RCAAnalysis.length > 0) {
    const rca = incident.RCAAnalysis[0];
    trail.push({
      timestamp: rca.createdAt,
      action: 'RCA_STARTED',
      user: rca.User ? 
        `${rca.User.firstName} ${rca.User.lastName}` : 'System',
      details: `RCA investigation initiated (${rca.method})`,
    });

    if (rca.isValidated && rca.validatedAt) {
      trail.push({
        timestamp: rca.validatedAt,
        action: 'RCA_VALIDATED',
        user: 'System',
        details: 'RCA validated',
      });
    }
  }

  return trail.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

function getRegulatoryGuidance(type: string): any {
  const guidance: Record<string, any> = {
    FSMA: {
      name: 'Food Safety Modernization Act',
      keyRequirements: [
        'Preventive controls documentation',
        'Hazard analysis records',
        'Corrective action procedures',
        'Verification activities',
        'Record retention (2+ years)',
      ],
      reportingTimeline: '24 hours for critical food safety incidents',
    },
    HACCP: {
      name: 'Hazard Analysis Critical Control Points',
      keyRequirements: [
        'CCP monitoring records',
        'Deviation and corrective action logs',
        'Verification procedures',
        'Document control',
      ],
      reportingTimeline: 'Immediate for CCP deviations',
    },
    OSHA: {
      name: 'Occupational Safety and Health Administration',
      keyRequirements: [
        'Injury and illness records (OSHA 300)',
        'Investigation documentation',
        'Corrective measures implementation',
        'Training records',
      ],
      reportingTimeline: '8 hours for fatalities, 24 hours for hospitalizations',
    },
    GMP: {
      name: 'Good Manufacturing Practices',
      keyRequirements: [
        'Process deviation records',
        'Corrective action documentation',
        'Equipment maintenance logs',
        'Personnel training records',
      ],
      reportingTimeline: 'Per facility SOPs',
    },
    ISO22000: {
      name: 'ISO 22000 Food Safety Management',
      keyRequirements: [
        'Nonconformity records',
        'Corrective action effectiveness',
        'Internal audit findings',
        'Management review inputs',
      ],
      reportingTimeline: 'Per management system procedures',
    },
    FDA: {
      name: 'Food and Drug Administration',
      keyRequirements: [
        'Complaint records',
        'Investigation reports',
        'Corrective action documentation',
        'Product disposition records',
      ],
      reportingTimeline: 'Varies by product category',
    },
    SQF: {
      name: 'Safe Quality Food',
      keyRequirements: [
        'Nonconformance records',
        'Root cause analysis documentation',
        'Corrective action verification',
        'Supplier corrective actions',
      ],
      reportingTimeline: 'Within 24 hours for critical nonconformances',
    },
    BRC: {
      name: 'British Retail Consortium',
      keyRequirements: [
        'Incident investigation records',
        'Corrective and preventive actions',
        'Root cause analysis',
        'Effectiveness verification',
      ],
      reportingTimeline: 'Immediate notification for food safety incidents',
    },
  };

  return guidance[type] || {
    name: type,
    keyRequirements: ['Document all findings', 'Implement corrective actions', 'Verify effectiveness'],
    reportingTimeline: 'Per regulatory requirements',
  };
}

function getDateKey(date: Date, groupBy: string): string {
  const d = new Date(date);
  
  switch (groupBy) {
    case 'week':
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      d.setDate(diff);
      return d.toISOString().split('T')[0];
    case 'month':
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
    default:
      return d.toISOString().split('T')[0];
  }
}

export default router;
