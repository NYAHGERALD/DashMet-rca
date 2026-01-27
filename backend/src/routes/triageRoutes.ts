// Phase 4: Triage & Auto-Assignment Routes
// Routes for assignment rules, SLA configuration, and triage operations

import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { requireMinimumRole } from '../middleware/rbac';
import { UserRole, IncidentType, Severity } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { ValidationError } from '../middleware/errorHandler';
import {
  triageIncident,
  applyTriageToIncident,
  detectSeverity,
  findMatchingAssignmentRule,
  checkSLABreaches,
} from '../services/triageService';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ==================== ASSIGNMENT RULES ====================

// GET /api/triage/assignment-rules - List assignment rules
router.get('/assignment-rules', requireMinimumRole(UserRole.CI_MANAGER), async (req, res) => {
  const user = (req as any).user;
  const { isActive } = req.query;

  const where: any = {
    organizationId: user.organizationId,
  };

  if (isActive !== undefined) {
    where.isActive = isActive === 'true';
  }

  const rules = await prisma.assignmentRule.findMany({
    where,
    orderBy: { priority: 'desc' },
  });

  res.json({
    success: true,
    data: rules,
  });
});

// GET /api/triage/assignment-rules/:id - Get single assignment rule
router.get('/assignment-rules/:id', requireMinimumRole(UserRole.CI_MANAGER), async (req, res) => {
  const { id } = req.params;

  const rule = await prisma.assignmentRule.findUnique({
    where: { id },
  });

  if (!rule) {
    throw new ValidationError('Assignment rule not found');
  }

  res.json({
    success: true,
    data: rule,
  });
});

// POST /api/triage/assignment-rules - Create assignment rule
router.post('/assignment-rules', requireMinimumRole(UserRole.ADMIN), async (req, res) => {
  const user = (req as any).user;
  const {
    name,
    description,
    priority,
    incidentType,
    categoryId,
    facilityId,
    areaId,
    severity,
    assignToUserId,
    assignToRole,
    slaResponseHours,
    slaResolutionHours,
  } = req.body;

  if (!name) {
    throw new ValidationError('Rule name is required');
  }

  // Validate that at least one assignment target is specified
  if (!assignToUserId && !assignToRole) {
    throw new ValidationError('Either assignToUserId or assignToRole must be specified');
  }

  const rule = await prisma.assignmentRule.create({
    data: {
      id: uuidv4(),
      updatedAt: new Date(),
      name,
      description,
      organizationId: user.organizationId,
      priority: priority || 0,
      incidentType: incidentType as IncidentType,
      categoryId,
      facilityId,
      areaId,
      severity: severity as Severity,
      assignToUserId,
      assignToRole: assignToRole as UserRole,
      slaResponseHours,
      slaResolutionHours,
    },
  });

  res.status(201).json({
    success: true,
    data: rule,
  });
});

// PATCH /api/triage/assignment-rules/:id - Update assignment rule
router.patch('/assignment-rules/:id', requireMinimumRole(UserRole.ADMIN), async (req, res) => {
  const { id } = req.params;
  const {
    name,
    description,
    isActive,
    priority,
    incidentType,
    categoryId,
    facilityId,
    areaId,
    severity,
    assignToUserId,
    assignToRole,
    slaResponseHours,
    slaResolutionHours,
  } = req.body;

  const rule = await prisma.assignmentRule.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(isActive !== undefined && { isActive }),
      ...(priority !== undefined && { priority }),
      ...(incidentType !== undefined && { incidentType: incidentType as IncidentType }),
      ...(categoryId !== undefined && { categoryId }),
      ...(facilityId !== undefined && { facilityId }),
      ...(areaId !== undefined && { areaId }),
      ...(severity !== undefined && { severity: severity as Severity }),
      ...(assignToUserId !== undefined && { assignToUserId }),
      ...(assignToRole !== undefined && { assignToRole: assignToRole as UserRole }),
      ...(slaResponseHours !== undefined && { slaResponseHours }),
      ...(slaResolutionHours !== undefined && { slaResolutionHours }),
    },
  });

  res.json({
    success: true,
    data: rule,
  });
});

// DELETE /api/triage/assignment-rules/:id - Delete assignment rule
router.delete('/assignment-rules/:id', requireMinimumRole(UserRole.ADMIN), async (req, res) => {
  const { id } = req.params;

  await prisma.assignmentRule.delete({
    where: { id },
  });

  res.json({
    success: true,
    message: 'Assignment rule deleted successfully',
  });
});

// ==================== SLA CONFIGURATION ====================

// GET /api/triage/sla-config - Get SLA configuration for organization
router.get('/sla-config', requireMinimumRole(UserRole.CI_MANAGER), async (req, res) => {
  const user = (req as any).user;

  const configs = await prisma.sLAConfiguration.findMany({
    where: { organizationId: user.organizationId },
    orderBy: { severity: 'asc' },
  });

  res.json({
    success: true,
    data: configs,
  });
});

// POST /api/triage/sla-config - Create or update SLA configuration
router.post('/sla-config', requireMinimumRole(UserRole.ADMIN), async (req, res) => {
  const user = (req as any).user;
  const {
    severity,
    responseTimeHours,
    resolutionTimeHours,
    escalationEnabled,
    escalationAfterHours,
    escalationToRole,
  } = req.body;

  if (!severity || !responseTimeHours || !resolutionTimeHours) {
    throw new ValidationError('Severity, response time, and resolution time are required');
  }

  const config = await prisma.sLAConfiguration.upsert({
    where: {
      organizationId_severity: {
        organizationId: user.organizationId,
        severity: severity as Severity,
      },
    },
    create: {
      organizationId: user.organizationId,
      severity: severity as Severity,
      responseTimeHours,
      resolutionTimeHours,
      escalationEnabled: escalationEnabled ?? true,
      escalationAfterHours,
      escalationToRole: escalationToRole as UserRole,
    },
    update: {
      responseTimeHours,
      resolutionTimeHours,
      escalationEnabled: escalationEnabled ?? true,
      escalationAfterHours,
      escalationToRole: escalationToRole as UserRole,
    },
  });

  res.json({
    success: true,
    data: config,
  });
});

// POST /api/triage/sla-config/seed - Seed default SLA configuration
router.post('/sla-config/seed', requireMinimumRole(UserRole.ADMIN), async (req, res) => {
  const user = (req as any).user;

  const defaultConfigs = [
    { severity: 'CRITICAL' as Severity, responseTimeHours: 1, resolutionTimeHours: 4 },
    { severity: 'HIGH' as Severity, responseTimeHours: 4, resolutionTimeHours: 24 },
    { severity: 'MEDIUM' as Severity, responseTimeHours: 8, resolutionTimeHours: 72 },
    { severity: 'LOW' as Severity, responseTimeHours: 24, resolutionTimeHours: 168 },
  ];

  const results = await Promise.all(
    defaultConfigs.map(config =>
      prisma.sLAConfiguration.upsert({
        where: {
          organizationId_severity: {
            organizationId: user.organizationId,
            severity: config.severity,
          },
        },
        create: {
          organizationId: user.organizationId,
          ...config,
        },
        update: {},
      })
    )
  );

  res.json({
    success: true,
    data: results,
    message: 'Default SLA configuration seeded',
  });
});

// ==================== TRIAGE OPERATIONS ====================

// POST /api/triage/detect-severity - AI severity detection
router.post('/detect-severity', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { description, type } = req.body;

    if (!description || !type) {
      throw new ValidationError('Description and incident type are required');
    }

    const suggestedSeverity = await detectSeverity(description, type as IncidentType);

    res.json({
      success: true,
      data: {
        suggestedSeverity,
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/triage/preview - Preview triage results without applying
router.post('/preview', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    const { type, categoryId, facilityId, areaId, description, severity } = req.body;

    if (!type || !categoryId || !facilityId || !description) {
      throw new ValidationError('Type, category, facility, and description are required');
    }

    const triageResult = await triageIncident({
      id: 'preview',
      type: type as IncidentType,
      categoryId,
      facilityId,
      areaId,
      description,
      severity: severity as Severity,
      organizationId: user.organizationId,
    });

    res.json({
      success: true,
      data: triageResult,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/triage/incidents/:id - Triage an existing incident
router.post('/incidents/:id', requireMinimumRole(UserRole.CI_MANAGER), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { applyResults = true } = req.body;

    // Get incident details
    const incident = await prisma.incident.findUnique({
      where: { id },
      select: {
        id: true,
        type: true,
        categoryId: true,
        facilityId: true,
        areaId: true,
        description: true,
        severity: true,
        organizationId: true,
        status: true,
      },
    });

    if (!incident) {
      throw new ValidationError('Incident not found');
    }

    // Only allow triage for SUBMITTED incidents
    if (incident.status !== 'SUBMITTED') {
      throw new ValidationError('Only submitted incidents can be triaged');
    }

    // Run triage
    const triageResult = await triageIncident(incident);

    // Apply results if requested
    if (applyResults) {
      await applyTriageToIncident(id, triageResult);
    }

    res.json({
      success: true,
      data: {
        triageResult,
        applied: applyResults,
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/triage/check-sla-breaches - Check and process SLA breaches (for scheduled job)
router.post('/check-sla-breaches', requireMinimumRole(UserRole.ADMIN), async (req, res) => {
  const result = await checkSLABreaches();

  res.json({
    success: true,
    data: result,
    message: `Processed ${result.responseBreaches} response breaches and ${result.resolutionBreaches} resolution breaches`,
  });
});

// GET /api/triage/incidents-needing-triage - Get incidents that need triage
router.get('/incidents-needing-triage', requireMinimumRole(UserRole.CI_MANAGER), async (req, res) => {
  const user = (req as any).user;

  const incidents = await prisma.incident.findMany({
    where: {
      organizationId: user.organizationId,
      status: 'SUBMITTED',
      assignedToId: null,
    },
    include: {
      Facility: { select: { id: true, name: true } },
      Category: { select: { id: true, name: true } },
      User_Incident_createdByIdToUser: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: [
      { severity: 'desc' },
      { createdAt: 'asc' },
    ],
  });

  res.json({
    success: true,
    data: incidents,
  });
});

// GET /api/triage/sla-dashboard - Get SLA status dashboard
router.get('/sla-dashboard', requireMinimumRole(UserRole.CI_MANAGER), async (req, res) => {
  const user = (req as any).user;
  const now = new Date();

  // Get counts by SLA status
  const [
    breachedResponse,
    breachedResolution,
    atRiskResponse,
    atRiskResolution,
    onTrack,
  ] = await Promise.all([
    // Breached response SLA
    prisma.incident.count({
      where: {
        organizationId: user.organizationId,
        slaResponseBreached: true,
        status: { notIn: ['CLOSED', 'REJECTED', 'DRAFT'] },
      },
    }),
    // Breached resolution SLA
    prisma.incident.count({
      where: {
        organizationId: user.organizationId,
        slaResolutionBreached: true,
        status: { notIn: ['CLOSED', 'REJECTED', 'DRAFT'] },
      },
    }),
    // At risk (response deadline within 4 hours)
    prisma.incident.count({
      where: {
        organizationId: user.organizationId,
        slaResponseDeadline: {
          gt: now,
          lt: new Date(now.getTime() + 4 * 60 * 60 * 1000),
        },
        slaResponseBreached: false,
        respondedAt: null,
        status: { notIn: ['CLOSED', 'REJECTED', 'DRAFT'] },
      },
    }),
    // At risk (resolution deadline within 24 hours)
    prisma.incident.count({
      where: {
        organizationId: user.organizationId,
        slaResolutionDeadline: {
          gt: now,
          lt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
        },
        slaResolutionBreached: false,
        resolvedAt: null,
        status: { notIn: ['CLOSED', 'REJECTED', 'DRAFT'] },
      },
    }),
    // On track
    prisma.incident.count({
      where: {
        organizationId: user.organizationId,
        slaResponseBreached: false,
        slaResolutionBreached: false,
        status: { notIn: ['CLOSED', 'REJECTED', 'DRAFT'] },
        OR: [
          { slaResponseDeadline: { gt: new Date(now.getTime() + 4 * 60 * 60 * 1000) } },
          { respondedAt: { not: null } },
        ],
      },
    }),
  ]);

  res.json({
    success: true,
    data: {
      breachedResponse,
      breachedResolution,
      atRiskResponse,
      atRiskResolution,
      onTrack,
      total: breachedResponse + breachedResolution + atRiskResponse + atRiskResolution + onTrack,
    },
  });
});

export default router;
