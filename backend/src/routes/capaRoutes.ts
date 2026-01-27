/**
 * Phase 9: CAPA (Corrective & Preventive Action) Routes
 * API endpoints for managing CAPA actions tied to RCA analyses
 */

import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requireMinimumRole, requireRoles, requirePrivilege } from '../middleware/rbac';
import { UserRole, ActionStatus, ActionType, ActionPriority } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { ValidationError } from '../middleware/errorHandler';
import { v4 as uuidv4 } from 'uuid';
import { 
  analyzeActionQuality, 
  detectWeakActions,
  suggestActionImprovements,
  mapRegulatoryTags
} from '../services/capaService';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ============================================================================
// Phase 9.1: CAPA CRUD Operations
// ============================================================================

/**
 * GET /api/capa
 * List CAPA actions with filters
 */
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const {
      rcaAnalysisId,
      status,
      priority,
      ownerId,
      actionType,
      overdueOnly,
      page = '1',
      limit = '20',
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};

    if (rcaAnalysisId) where.RCAAnalysisId = rcaAnalysisId;
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (ownerId) where.userId = ownerId;
    if (actionType) where.actionType = actionType;
    if (overdueOnly === 'true') {
      where.dueDate = { lt: new Date() };
      where.status = { notIn: ['COMPLETED', 'VERIFIED'] };
    }

    const [actions, total] = await Promise.all([
      prisma.cAPAction.findMany({
        where,
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
            select: {
              id: true,
              status: true,
              Incident: {
                select: {
                  id: true,
                  customTitle: true,
                  incidentNumber: true,
                  type: true,
                },
              },
            },
          },
        },
        orderBy: [
          { priority: 'desc' },
          { dueDate: 'asc' },
        ],
        skip,
        take: limitNum,
      }),
      prisma.cAPAction.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        actions,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/capa/stats
 * Get CAPA statistics for dashboard
 */
router.get('/stats', async (req: AuthRequest, res: Response) => {
  try {
    const { organizationId } = req.query;

    // Build organization filter based on RCA -> Incident -> Organization
    const orgFilter = organizationId
      ? {
          RCAAnalysis: {
            Incident: {
              Facility: {
                organizationId: organizationId as string,
              },
            },
          },
        }
      : {};

    const [
      totalActions,
      byStatus,
      byPriority,
      overdueCount,
      effectivenessStats,
    ] = await Promise.all([
      // Total count
      prisma.cAPAction.count({ where: orgFilter }),

      // By status
      prisma.cAPAction.groupBy({
        by: ['status'],
        where: orgFilter,
        _count: true,
      }),

      // By priority
      prisma.cAPAction.groupBy({
        by: ['priority'],
        where: orgFilter,
        _count: true,
      }),

      // Overdue count
      prisma.cAPAction.count({
        where: {
          ...orgFilter,
          dueDate: { lt: new Date() },
          status: { notIn: ['COMPLETED', 'VERIFIED'] },
        },
      }),

      // Effectiveness stats
      prisma.cAPAction.aggregate({
        where: {
          ...orgFilter,
          isEffective: { not: null },
        },
        _count: { isEffective: true },
        _avg: { effectivenessScore: true },
      }),
    ]);

    // Calculate effectiveness rate
    const effectiveCount = await prisma.cAPAction.count({
      where: { ...orgFilter, isEffective: true },
    });

    const reviewedCount = await prisma.cAPAction.count({
      where: { ...orgFilter, isEffective: { not: null } },
    });

    res.json({
      success: true,
      data: {
        total: totalActions,
        byStatus: byStatus.reduce((acc, item) => {
          acc[item.status] = item._count;
          return acc;
        }, {} as Record<string, number>),
        byPriority: byPriority.reduce((acc, item) => {
          acc[item.priority] = item._count;
          return acc;
        }, {} as Record<string, number>),
        overdue: overdueCount,
        effectiveness: {
          reviewed: reviewedCount,
          effective: effectiveCount,
          rate: reviewedCount > 0 ? (effectiveCount / reviewedCount) * 100 : 0,
          avgScore: effectivenessStats._avg.effectivenessScore || 0,
        },
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/capa/:id
 * Get single CAPA action with full details
 */
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const action = await prisma.cAPAction.findUnique({
      where: { id },
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
        RCAAnalysis: {
          include: {
            Incident: {
              include: {
                Category: true,
                Facility: true,
              },
            },
          },
        },
      },
    });

    if (!action) {
      return res.status(404).json({
        success: false,
        error: 'CAPA action not found',
      });
    }

    res.json({
      success: true,
      data: action,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/capa
 * Create a new CAPA action
 */
router.post('/', requirePrivilege('capa.create'), async (req: AuthRequest, res: Response) => {
  try {
    const {
      rcaAnalysisId,
      actionType,
      title,
      description,
      priority,
      ownerId,
      dueDate,
      resourceImpact,
      regulatoryTags,
    } = req.body;

    // Validate required fields
    if (!rcaAnalysisId || !actionType || !title || !description || !priority || !ownerId || !dueDate) {
      throw new ValidationError('Missing required fields: rcaAnalysisId, actionType, title, description, priority, ownerId, dueDate');
    }

    // Validate action type
    if (!['CORRECTIVE', 'PREVENTIVE'].includes(actionType)) {
      throw new ValidationError('Invalid action type. Must be CORRECTIVE or PREVENTIVE');
    }

    // Validate priority
    if (!['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(priority)) {
      throw new ValidationError('Invalid priority. Must be LOW, MEDIUM, HIGH, or CRITICAL');
    }

    // Verify RCA analysis exists
    const rcaAnalysis = await prisma.rCAAnalysis.findUnique({
      where: { id: rcaAnalysisId },
      include: {
        Incident: {
          include: { Category: true },
        },
      },
    });

    if (!rcaAnalysis) {
      throw new ValidationError('RCA analysis not found');
    }

    // Verify owner exists
    const owner = await prisma.user.findUnique({
      where: { id: ownerId },
    });

    if (!owner) {
      throw new ValidationError('Owner user not found');
    }

    // Analyze action quality with AI
    const qualityAnalysis = await analyzeActionQuality(title, description, actionType as ActionType);

    // Map regulatory tags based on incident type/category
    const mappedRegulatoryTags = await mapRegulatoryTags(
      rcaAnalysis.Incident.type,
      rcaAnalysis.Incident.Category?.name || ''
    );

    const newAction = await prisma.cAPAction.create({
      data: {
        id: uuidv4(),
        updatedAt: new Date(),
        rcaAnalysisId,
        actionType: actionType as ActionType,
        title,
        description,
        priority: priority as ActionPriority,
        ownerId,
        dueDate: new Date(dueDate),
        resourceImpact,
        aiQualityScore: qualityAnalysis.score,
        aiWeaknessFlags: qualityAnalysis.weaknesses,
        regulatoryTags: regulatoryTags || [],
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
      },
    });

    res.status(201).json({
      success: true,
      data: { action: newAction },
      qualityAnalysis,
      message: 'CAPA action created successfully',
    });
  } catch (error: any) {
    if (error instanceof ValidationError) {
      return res.status(400).json({
        success: false,
        error: error.message,
      });
    }
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * PATCH /api/capa/:id
 * Update a CAPA action
 */
router.patch('/:id', requirePrivilege('capa.edit'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      priority,
      ownerId,
      dueDate,
      status,
      resourceImpact,
      regulatoryTags,
    } = req.body;

    const existingAction = await prisma.cAPAction.findUnique({
      where: { id },
    });

    if (!existingAction) {
      return res.status(404).json({
        success: false,
        error: 'CAPA action not found',
      });
    }

    // Re-analyze quality if title or description changed
    let qualityUpdate = {};
    if (title !== existingAction.title || description !== existingAction.description) {
      const qualityAnalysis = await analyzeActionQuality(
        title || existingAction.title,
        description || existingAction.description,
        existingAction.actionType
      );
      qualityUpdate = {
        aiQualityScore: qualityAnalysis.score,
        aiWeaknessFlags: qualityAnalysis.weaknesses,
      };
    }

    // Handle status transition
    let statusUpdate: any = {};
    if (status && status !== existingAction.status) {
      statusUpdate.status = status;
      if (status === 'COMPLETED') {
        statusUpdate.completedAt = new Date();
      }
    }

    const updatedAction = await prisma.cAPAction.update({
      where: { id },
      data: {
        ...(title && { title }),
        ...(description && { description }),
        ...(priority && { priority: priority as ActionPriority }),
        ...(ownerId && { ownerId }),
        ...(dueDate && { dueDate: new Date(dueDate) }),
        ...(resourceImpact !== undefined && { resourceImpact }),
        ...statusUpdate,
        ...qualityUpdate,
        regulatoryTags: regulatoryTags || [],
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
      },
    });

    res.json({
      success: true,
      data: { action: updatedAction },
      message: 'CAPA action updated successfully',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * PATCH /api/capa/:id/status
 * Update CAPA action status with enterprise audit trail
 * Requires notes/evidence for certain transitions
 */
router.patch('/:id/status', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { 
      status, 
      notes,
      implementationPlan,
      implementationNotes,
      completionEvidence,
      completionNotes,
      verificationNotes,
      targetDueDate 
    } = req.body;

    if (!status) {
      throw new ValidationError('Status is required');
    }

    const validStatuses: ActionStatus[] = ['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'VERIFIED', 'INEFFECTIVE'];
    if (!validStatuses.includes(status)) {
      throw new ValidationError(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
    }

    const existingAction = await prisma.cAPAction.findUnique({
      where: { id },
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
    });

    if (!existingAction) {
      return res.status(404).json({
        success: false,
        error: 'CAPA action not found',
      });
    }

    // Validate status transitions
    const validTransitions: Record<ActionStatus, ActionStatus[]> = {
      PLANNED: ['IN_PROGRESS', 'INEFFECTIVE'],
      IN_PROGRESS: ['COMPLETED', 'PLANNED', 'INEFFECTIVE'],
      COMPLETED: ['VERIFIED', 'IN_PROGRESS', 'INEFFECTIVE'],
      VERIFIED: ['INEFFECTIVE', 'IN_PROGRESS'],
      INEFFECTIVE: ['PLANNED'],
    };

    if (!validTransitions[existingAction.status].includes(status)) {
      throw new ValidationError(
        `Invalid status transition from ${existingAction.status} to ${status}`
      );
    }

    // Enterprise validation: require notes/evidence for certain transitions
    if (status === 'IN_PROGRESS' && !implementationPlan && !notes) {
      throw new ValidationError('Implementation plan or notes required when starting an action');
    }
    
    if (status === 'COMPLETED' && !completionEvidence && !completionNotes && !notes) {
      throw new ValidationError('Completion evidence or notes required when completing an action');
    }

    if (status === 'VERIFIED' && !verificationNotes && !notes) {
      throw new ValidationError('Verification notes required when verifying effectiveness');
    }

    if (status === 'INEFFECTIVE' && !notes) {
      throw new ValidationError('Notes required to explain why action was ineffective');
    }

    // Get current user info for audit
    const userId = req.user?.id || 'system';
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true },
    });
    const performedByName = currentUser 
      ? `${currentUser.firstName} ${currentUser.lastName}` 
      : 'System';

    // Build update data based on transition
    const updateData: any = { status };
    const previousData: any = {
      status: existingAction.status,
    };
    const newData: any = {
      status,
    };

    if (status === 'IN_PROGRESS') {
      updateData.startedAt = new Date();
      updateData.startedById = userId;
      if (implementationPlan) {
        updateData.implementationPlan = implementationPlan;
        newData.implementationPlan = implementationPlan;
      }
      if (implementationNotes) {
        updateData.implementationNotes = implementationNotes;
        newData.implementationNotes = implementationNotes;
      }
      if (targetDueDate) {
        updateData.dueDate = new Date(targetDueDate);
        previousData.dueDate = existingAction.dueDate;
        newData.dueDate = targetDueDate;
      }
    }

    if (status === 'COMPLETED') {
      updateData.completedAt = new Date();
      updateData.completedById = userId;
      if (completionEvidence) {
        updateData.completionEvidence = completionEvidence;
        newData.completionEvidence = completionEvidence;
      }
      if (completionNotes) {
        updateData.completionNotes = completionNotes;
        newData.completionNotes = completionNotes;
      }
      // Set effectiveness review date (30 days after completion by default)
      if (!existingAction.effectivenessReviewDate) {
        const reviewDate = new Date();
        reviewDate.setDate(reviewDate.getDate() + 30);
        updateData.effectivenessReviewDate = reviewDate;
      }
    }

    if (status === 'VERIFIED') {
      updateData.verifiedAt = new Date();
      updateData.verifiedById = userId;
      updateData.isEffective = true;
      if (verificationNotes) {
        updateData.verificationNotes = verificationNotes;
        newData.verificationNotes = verificationNotes;
      }
    }

    if (status === 'INEFFECTIVE') {
      updateData.isEffective = false;
    }

    // Perform update and create audit log in transaction
    const [action, auditLog] = await prisma.$transaction([
      prisma.cAPAction.update({
        where: { id },
        data: updateData,
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
      }),
      prisma.cAPAuditLog.create({
        data: {
          id: uuidv4(),
          capActionId: id,
          action: `STATUS_CHANGE`,
          previousStatus: existingAction.status,
          newStatus: status,
          previousData,
          newData,
          notes: notes || implementationNotes || completionNotes || verificationNotes,
          evidence: completionEvidence,
          performedById: userId,
          performedByName,
          ipAddress: req.ip || req.connection?.remoteAddress,
          userAgent: req.headers['user-agent'],
        },
      }),
    ]);

    res.json({
      success: true,
      data: action,
      auditLogId: auditLog.id,
      message: `Status updated to ${status}`,
    });
  } catch (error: any) {
    if (error instanceof ValidationError) {
      return res.status(400).json({
        success: false,
        error: error.message,
      });
    }
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/capa/:id/audit-log
 * Get complete audit trail for a CAPA action
 */
router.get('/:id/audit-log', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Verify action exists
    const action = await prisma.cAPAction.findUnique({
      where: { id },
      select: { id: true, title: true },
    });

    if (!action) {
      return res.status(404).json({
        success: false,
        error: 'CAPA action not found',
      });
    }

    const auditLogs = await prisma.cAPAuditLog.findMany({
      where: { capActionId: id },
      orderBy: { performedAt: 'desc' },
    });

    res.json({
      success: true,
      data: {
        action: action,
        auditLogs: auditLogs,
        totalEntries: auditLogs.length,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * DELETE /api/capa/:id
 * Delete a CAPA action (only if PLANNED status)
 */
router.delete(
  '/:id',
  requireMinimumRole(UserRole.CI_MANAGER),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;

      const action = await prisma.cAPAction.findUnique({
        where: { id },
      });

      if (!action) {
        return res.status(404).json({
          success: false,
          error: 'CAPA action not found',
        });
      }

      if (action.status !== 'PLANNED') {
        throw new ValidationError('Can only delete actions in PLANNED status');
      }

      await prisma.cAPAction.delete({
        where: { id },
      });

      res.json({
        success: true,
        message: 'CAPA action deleted successfully',
      });
    } catch (error: any) {
      if (error instanceof ValidationError) {
        return res.status(400).json({
          success: false,
          error: error.message,
        });
      }
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

// ============================================================================
// Phase 9.2 & 9.3: AI Quality Review & Weak Action Detection
// ============================================================================

/**
 * POST /api/capa/:id/analyze-quality
 * Get AI quality analysis for a CAPA action
 */
router.post('/:id/analyze-quality', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const action = await prisma.cAPAction.findUnique({
      where: { id },
      include: {
        RCAAnalysis: {
          include: {
            Incident: {
              include: { Category: true },
            },
          },
        },
      },
    });

    if (!action) {
      return res.status(404).json({
        success: false,
        error: 'CAPA action not found',
      });
    }

    const qualityAnalysis = await analyzeActionQuality(
      action.title,
      action.description,
      action.actionType
    );

    const weaknessAnalysis = await detectWeakActions(action.title, action.description);
    const suggestions = await suggestActionImprovements(
      action.title,
      action.description,
      action.actionType,
      action.RCAAnalysis?.Incident?.type || 'Unknown',
      action.RCAAnalysis?.Incident?.Category?.name || ''
    );

    // Update action with new quality score
    await prisma.cAPAction.update({
      where: { id },
      data: {
        aiQualityScore: qualityAnalysis.score,
        aiWeaknessFlags: weaknessAnalysis.flags,
      },
    });

    res.json({
      success: true,
      data: {
        qualityScore: qualityAnalysis.score,
        qualityRating: qualityAnalysis.rating,
        weaknesses: weaknessAnalysis,
        suggestions,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/capa/bulk-analyze
 * Analyze quality of multiple CAPA actions
 */
router.post('/bulk-analyze', async (req: AuthRequest, res: Response) => {
  try {
    const { actionIds } = req.body;

    if (!actionIds || !Array.isArray(actionIds) || actionIds.length === 0) {
      throw new ValidationError('actionIds array is required');
    }

    const actions = await prisma.cAPAction.findMany({
      where: { id: { in: actionIds } },
    });

    const results = await Promise.all(
      actions.map(async (action) => {
        const qualityAnalysis = await analyzeActionQuality(
          action.title,
          action.description,
          action.actionType
        );

        // Update action
        await prisma.cAPAction.update({
          where: { id: action.id },
          data: {
            aiQualityScore: qualityAnalysis.score,
            aiWeaknessFlags: qualityAnalysis.weaknesses,
          },
        });

        return {
          actionId: action.id,
          title: action.title,
          qualityScore: qualityAnalysis.score,
          weaknesses: qualityAnalysis.weaknesses,
        };
      })
    );

    res.json({
      success: true,
      data: results,
    });
  } catch (error: any) {
    if (error instanceof ValidationError) {
      return res.status(400).json({
        success: false,
        error: error.message,
      });
    }
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ============================================================================
// Phase 10.3: Effectiveness Review
// ============================================================================

/**
 * POST /api/capa/:id/effectiveness-review
 * Submit effectiveness review for a completed CAPA action
 */
router.post(
  '/:id/effectiveness-review',
  requireMinimumRole(UserRole.CI_MANAGER),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { effectivenessScore, isEffective, notes } = req.body;

      if (effectivenessScore === undefined || isEffective === undefined) {
        throw new ValidationError('effectivenessScore and isEffective are required');
      }

      if (effectivenessScore < 0 || effectivenessScore > 100) {
        throw new ValidationError('effectivenessScore must be between 0 and 100');
      }

      const action = await prisma.cAPAction.findUnique({
        where: { id },
      });

      if (!action) {
        return res.status(404).json({
          success: false,
          error: 'CAPA action not found',
        });
      }

      if (action.status !== 'COMPLETED' && action.status !== 'VERIFIED') {
        throw new ValidationError('Action must be COMPLETED or VERIFIED for effectiveness review');
      }

      const previousStatus = action.status;
      const newStatus = isEffective ? 'VERIFIED' : 'INEFFECTIVE';

      // Get current user info for audit
      const userId = req.user?.id || 'system';
      const currentUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { firstName: true, lastName: true },
      });
      const performedByName = currentUser 
        ? `${currentUser.firstName} ${currentUser.lastName}` 
        : 'System';

      const updatedAction = await prisma.cAPAction.update({
        where: { id },
        data: {
          effectivenessScore,
          isEffective,
          effectivenessReviewDate: new Date(),
          status: newStatus,
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
        },
      });

      // Create audit log entry for effectiveness review
      await prisma.cAPAuditLog.create({
        data: {
          id: uuidv4(),
          capActionId: id,
          action: 'EFFECTIVENESS_REVIEW',
          previousStatus,
          newStatus,
          performedById: userId,
          performedByName,
          notes: `Effectiveness Review: Score ${effectivenessScore}%. ${notes || ''}`,
          ipAddress: req.ip || 'unknown',
        },
      });

      res.json({
        success: true,
        data: updatedAction,
        message: 'Effectiveness review submitted successfully',
      });
    } catch (error: any) {
      if (error instanceof ValidationError) {
        return res.status(400).json({
          success: false,
          error: error.message,
        });
      }
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

// ============================================================================
// Phase 10.4: Recurrence Detection
// ============================================================================

/**
 * GET /api/capa/:id/recurrence-check
 * Check if similar issues have recurred after CAPA implementation
 */
router.get('/:id/recurrence-check', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const action = await prisma.cAPAction.findUnique({
      where: { id },
      include: {
        RCAAnalysis: {
          include: {
            Incident: {
              include: {
                Category: true,
                Facility: true,
              },
            },
          },
        },
      },
    });

    if (!action) {
      return res.status(404).json({
        success: false,
        error: 'CAPA action not found',
      });
    }

    if (!action.completedAt) {
      return res.json({
        success: true,
        data: {
          hasRecurrence: false,
          message: 'Action not yet completed',
          similarIncidents: [],
        },
      });
    }

    // Look for similar incidents after action completion
    if (!action.RCAAnalysis?.Incident) {
      return res.status(400).json({
        success: false,
        error: 'Action is not linked to an RCA analysis with an incident',
      });
    }
    const similarIncidents = await prisma.incident.findMany({
      where: {
        categoryId: action.RCAAnalysis.Incident.categoryId,
        facilityId: action.RCAAnalysis.Incident.facilityId,
        createdAt: { gt: action.completedAt },
        id: { not: action.RCAAnalysis.Incident.id },
      },
      select: {
        id: true,
        customTitle: true,
        incidentNumber: true,
        type: true,
        severity: true,
        createdAt: true,
        status: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    const hasRecurrence = similarIncidents.length > 0;

    // Update recurrence flag
    if (hasRecurrence !== action.recurrenceDetected) {
      await prisma.cAPAction.update({
        where: { id },
        data: { recurrenceDetected: hasRecurrence },
      });
    }

    res.json({
      success: true,
      data: {
        hasRecurrence,
        similarIncidentCount: similarIncidents.length,
        similarIncidents,
        message: hasRecurrence
          ? `${similarIncidents.length} similar incident(s) found after action completion`
          : 'No similar incidents found after action completion',
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ============================================================================
// Phase 9.6: Generate CAPA Actions from RCA Analysis
// ============================================================================

/**
 * POST /api/capa/generate-from-rca/:rcaId
 * Generate CAPA actions from an RCA's action plans
 * Converts action plans stored in fiveWhysData or fishboneData to formal CAPAction records
 */
router.post(
  '/generate-from-rca/:rcaId',
  requireMinimumRole(UserRole.SUPERVISOR),
  async (req: AuthRequest, res: Response) => {
    try {
      const { rcaId } = req.params;
      const userId = req.user?.id;

      // Fetch the RCA analysis with incident data
      const rca = await prisma.rCAAnalysis.findUnique({
        where: { id: rcaId },
        include: {
          Incident: {
            include: { Category: true },
          },
        },
      });

      if (!rca) {
        throw new ValidationError('RCA analysis not found');
      }

      if (!rca.isValidated) {
        throw new ValidationError('RCA must be validated before generating CAPA actions');
      }

      // Check if CAPA actions already exist for this RCA
      const existingActions = await prisma.cAPAction.count({
        where: { rcaAnalysisId: rcaId },
      });

      if (existingActions > 0) {
        throw new ValidationError(`CAPA actions already exist for this RCA (${existingActions} actions found)`);
      }

      // Extract action plans from RCA data
      let actionPlans: { immediate: any[]; shortTerm: any[]; longTerm: any[] } = {
        immediate: [],
        shortTerm: [],
        longTerm: [],
      };

      if (rca.method === 'FIVE_WHYS' && rca.fiveWhysData) {
        const data = rca.fiveWhysData as any;
        if (data.actionPlans) {
          actionPlans = data.actionPlans;
        }
      } else if (rca.method === 'FISHBONE' && rca.fishboneData) {
        const data = rca.fishboneData as any;
        if (data.actionPlans) {
          actionPlans = data.actionPlans;
        }
      }

      // Flatten and filter valid action items
      const allActions: Array<{
        action: string;
        priority: string;
        category: 'immediate' | 'shortTerm' | 'longTerm';
      }> = [];

      for (const item of actionPlans.immediate || []) {
        if (item.action && item.action.trim()) {
          allActions.push({ ...item, category: 'immediate' });
        }
      }
      for (const item of actionPlans.shortTerm || []) {
        if (item.action && item.action.trim()) {
          allActions.push({ ...item, category: 'shortTerm' });
        }
      }
      for (const item of actionPlans.longTerm || []) {
        if (item.action && item.action.trim()) {
          allActions.push({ ...item, category: 'longTerm' });
        }
      }

      if (allActions.length === 0) {
        throw new ValidationError('No action plans found in the RCA analysis. Please add action items before generating CAPA.');
      }

      // Map priority from RCA format to CAPA format
      const mapPriority = (priority: string, category: string): ActionPriority => {
        if (priority === 'high' || priority === 'critical' || category === 'immediate') {
          return category === 'immediate' ? ActionPriority.CRITICAL : ActionPriority.HIGH;
        }
        if (priority === 'medium' || category === 'shortTerm') {
          return ActionPriority.MEDIUM;
        }
        return ActionPriority.LOW;
      };

      // Map category to due date offset (days)
      const getDueDateOffset = (category: string): number => {
        switch (category) {
          case 'immediate': return 7;   // 1 week
          case 'shortTerm': return 30;  // 1 month
          case 'longTerm': return 90;   // 3 months
          default: return 30;
        }
      };

      // Determine action type based on category
      const getActionType = (category: string): ActionType => {
        // Immediate actions are corrective (fix the problem now)
        // Short/Long term actions are preventive (prevent recurrence)
        return category === 'immediate' ? ActionType.CORRECTIVE : ActionType.PREVENTIVE;
      };

      // Create CAPA actions
      const createdActions = [];
      for (const actionItem of allActions) {
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + getDueDateOffset(actionItem.Category));

        // Analyze quality with AI (if available)
        let qualityAnalysis = { score: null as number | null, weaknesses: [] as string[] };
        try {
          qualityAnalysis = await analyzeActionQuality(
            actionItem.action,
            actionItem.action,
            getActionType(actionItem.Category)
          );
        } catch {
          // AI analysis failed, continue without it
        }

        // Map regulatory tags
        let regulatoryTags: string[] = [];
        try {
          regulatoryTags = await mapRegulatoryTags(
            rca.Incident.type,
            rca.Incident.Category?.name || ''
          );
        } catch {
          // Tag mapping failed, continue without it
        }

        const action = await prisma.cAPAction.create({
          data: {
            id: uuidv4(),
            updatedAt: new Date(),
            rcaAnalysisId: rcaId,
            actionType: getActionType(actionItem.Category),
            title: actionItem.action.substring(0, 200), // Truncate if too long
            description: `${actionItem.Category === 'immediate' ? 'Immediate Action' : actionItem.Category === 'shortTerm' ? 'Short-Term Action' : 'Long-Term Action'}: ${actionItem.action}`,
            priority: mapPriority(actionItem.priority, actionItem.Category),
            ownerId: userId!, // Default to current user
            dueDate,
            aiQualityScore: qualityAnalysis.score,
            aiWeaknessFlags: qualityAnalysis.weaknesses,
            regulatoryTags,
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
          },
        });

        createdActions.push(action);
      }

      // Update incident status to IN_PROGRESS (CAPA phase)
      await prisma.incident.update({
        where: { id: rca.incidentId },
        data: { status: 'IN_PROGRESS' },
      });

      res.status(201).json({
        success: true,
        data: {
          created: createdActions.length,
          actions: createdActions,
          message: `Successfully created ${createdActions.length} CAPA action(s) from RCA analysis`,
        },
      });
    } catch (error: any) {
      if (error instanceof ValidationError) {
        res.status(400).json({
          success: false,
          error: error.message,
        });
      } else {
        res.status(500).json({
          success: false,
          error: error.message,
        });
      }
    }
  }
);

// ============================================================================
// Phase 9.5: AI-Powered Implementation Plan Generation
// ============================================================================

/**
 * POST /api/capa/:id/generate-implementation-plan
 * Generate AI-powered implementation plan for a CAPA action
 */
router.post('/:id/generate-implementation-plan', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const action = await prisma.cAPAction.findUnique({
      where: { id },
      include: {
        User: {
          select: {
            firstName: true,
            lastName: true,
            role: true,
          },
        },
        RCAAnalysis: {
          include: {
            Incident: {
              include: {
                Category: true,
                Facility: true,
                Line: true,
              },
            },
          },
        },
      },
    });

    if (!action) {
      return res.status(404).json({
        success: false,
        error: 'CAPA action not found',
      });
    }

    // Check if OpenAI is available
    if (!process.env.OPENAI_API_KEY) {
      return res.status(503).json({
        success: false,
        error: 'AI service is not available. Please configure OpenAI API key.',
        fallbackPlan: generateFallbackImplementationPlan(action),
      });
    }

    const OpenAI = (await import('openai')).default;
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const incident = action.RCAAnalysis?.Incident;
    const context = {
      actionTitle: action.title,
      actionDescription: action.description,
      actionType: action.actionType,
      priority: action.priority,
      dueDate: action.dueDate,
      incidentTitle: incident?.customTitle || incident?.Category?.name || 'Incident',
      incidentType: incident?.type || 'Unknown',
      incidentDescription: incident?.description || 'Not specified',
      category: incident?.Category?.name,
      facility: incident?.Facility?.name,
      line: incident?.Line?.name,
      severity: incident?.severity,
      ownerName: `${action.User.firstName} ${action.User.lastName}`,
      ownerRole: action.User.role,
    };

    const completion = await openai.chat.completions.create({
      model: process.env.AI_MODEL || 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a senior Quality Assurance and Continuous Improvement expert with 20+ years of experience in manufacturing, food safety, and operational excellence. You specialize in developing practical, actionable implementation plans for corrective and preventive actions (CAPA) that meet regulatory compliance standards (FDA, ISO 9001, ISO 22000, FSSC 22000).

Your implementation plans are known for being:
1. **Practical & Realistic** - Steps that can actually be executed with available resources
2. **Time-bound** - Clear milestones and deadlines aligned with the due date
3. **Measurable** - Success criteria that can be objectively verified
4. **Comprehensive** - Covers all aspects: preparation, execution, verification, documentation
5. **Risk-aware** - Anticipates potential obstacles and includes contingencies

Write in a natural, professional tone as if advising a colleague. Be specific and avoid generic platitudes. Tailor the plan to the specific incident context provided.`,
        },
        {
          role: 'user',
          content: `Please generate a detailed implementation plan for the following CAPA action:

**Action to Implement:** ${context.actionTitle}
**Action Type:** ${context.actionType} (${context.actionType === 'CORRECTIVE' ? 'Fix what happened' : 'Prevent future occurrences'})
**Priority:** ${context.priority}
**Due Date:** ${new Date(context.dueDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}

**Related Incident Context:**
- Incident: ${context.incidentTitle}
- Type: ${context.incidentType}
- Category: ${context.Category || 'General'}
- Facility: ${context.Facility || 'Not specified'}
- Production Line: ${context.Line || 'Not specified'}
- Severity: ${context.severity}

**Incident Description:**
${context.incidentDescription}

**Action Details:**
${context.actionDescription}

**Assigned Owner:** ${context.userName} (${context.userRole})

Please provide an implementation plan that includes:
1. **Preparation Phase** - What needs to be gathered, reviewed, or arranged before starting
2. **Execution Steps** - Specific actions in sequence with estimated timeframes
3. **Resources Needed** - Personnel, equipment, materials, approvals required
4. **Verification Method** - How to confirm the action was properly implemented
5. **Documentation Requirements** - What records need to be created/updated

Keep the plan concise but thorough. Write it as a practical guide the owner can follow day-by-day.`,
        },
      ],
      temperature: 0.7,
      max_completion_tokens: 1500,
    });

    const generatedPlan = completion.choices[0]?.message?.content || '';

    res.json({
      success: true,
      data: {
        implementationPlan: generatedPlan,
        generatedAt: new Date().toISOString(),
        actionContext: {
          title: action.title,
          type: action.actionType,
          priority: action.priority,
          dueDate: action.dueDate,
        },
      },
    });
  } catch (error: any) {
    console.error('AI Implementation Plan Generation Error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate implementation plan',
    });
  }
});

/**
 * POST /api/capa/:id/validate-implementation-plan
 * Validate and improve a user-provided or edited implementation plan
 */
router.post('/:id/validate-implementation-plan', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { implementationPlan } = req.body;

    if (!implementationPlan || implementationPlan.trim().length < 20) {
      return res.status(400).json({
        success: false,
        error: 'Implementation plan must be at least 20 characters',
      });
    }

    const action = await prisma.cAPAction.findUnique({
      where: { id },
      include: {
        RCAAnalysis: {
          include: {
            Incident: {
              include: {
                Category: true,
              },
            },
          },
        },
      },
    });

    if (!action) {
      return res.status(404).json({
        success: false,
        error: 'CAPA action not found',
      });
    }

    // Check if OpenAI is available
    if (!process.env.OPENAI_API_KEY) {
      // Provide basic validation without AI
      const basicValidation = performBasicValidation(implementationPlan, action);
      return res.json({
        success: true,
        data: basicValidation,
      });
    }

    const OpenAI = (await import('openai')).default;
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const incident = action.RCAAnalysis?.Incident;

    const completion = await openai.chat.completions.create({
      model: process.env.AI_MODEL || 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a Quality Assurance auditor and CAPA specialist reviewing implementation plans for compliance and effectiveness. You provide constructive, actionable feedback that helps improve plans without being overly critical.

Your review criteria:
1. **Completeness** - Does it cover all necessary aspects?
2. **Specificity** - Are steps concrete and actionable?
3. **Measurability** - Can success be objectively verified?
4. **Feasibility** - Is it realistic given typical resources?
5. **Compliance** - Does it meet regulatory expectations?

Be encouraging but thorough. If the plan is good, acknowledge it. Always offer at least one constructive suggestion.`,
        },
        {
          role: 'user',
          content: `Please validate this implementation plan for the following CAPA action:

**Action:** ${action.title}
**Type:** ${action.actionType}
**Priority:** ${action.priority}
**Due Date:** ${new Date(action.dueDate).toLocaleDateString()}

**Related Incident:** ${incident?.customTitle || incident?.Category?.name || 'Incident'}
**Category:** ${incident?.Category?.name || 'General'}
**Severity:** ${incident?.severity || 'Unknown'}

**Implementation Plan to Validate:**
${implementationPlan}

Please provide:
1. **Overall Score** (0-100) - How complete and effective is this plan?
2. **Strengths** - What's good about this plan (2-3 points)
3. **Gaps or Concerns** - What might be missing or needs improvement (if any)
4. **Suggestions** - Specific improvements to make it more effective
5. **Compliance Notes** - Any regulatory considerations to keep in mind
6. **Verdict** - APPROVED, NEEDS_REVISION, or INSUFFICIENT

Respond in JSON format:
{
  "score": number,
  "verdict": "APPROVED" | "NEEDS_REVISION" | "INSUFFICIENT",
  "strengths": ["string"],
  "gaps": ["string"],
  "suggestions": ["string"],
  "complianceNotes": ["string"],
  "summary": "One sentence overall assessment"
}`,
        },
      ],
      temperature: 0.5,
      max_completion_tokens: 1000,
      response_format: { type: 'json_object' },
    });

    const responseText = completion.choices[0]?.message?.content || '{}';
    let validation;
    
    try {
      validation = JSON.parse(responseText);
    } catch {
      validation = {
        score: 70,
        verdict: 'NEEDS_REVISION',
        strengths: ['Plan provided covers basic requirements'],
        gaps: ['Could not fully analyze the plan'],
        suggestions: ['Ensure all steps have clear timelines'],
        complianceNotes: [],
        summary: 'Plan requires additional review',
      };
    }

    res.json({
      success: true,
      data: {
        validation,
        validatedAt: new Date().toISOString(),
        planLength: implementationPlan.length,
        wordCount: implementationPlan.split(/\s+/).length,
      },
    });
  } catch (error: any) {
    console.error('AI Plan Validation Error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to validate implementation plan',
    });
  }
});

// Helper: Generate fallback plan when AI is unavailable
function generateFallbackImplementationPlan(action: any): string {
  const dueDate = new Date(action.dueDate);
  const today = new Date();
  const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  
  return `**Implementation Plan for: ${action.title}**

**Phase 1: Preparation (Days 1-${Math.max(1, Math.floor(daysUntilDue * 0.2))})**
- Review the incident details and root cause analysis
- Identify required resources and stakeholders
- Schedule kick-off meeting with relevant team members
- Gather necessary documentation and baseline data

**Phase 2: Execution (Days ${Math.max(2, Math.floor(daysUntilDue * 0.2) + 1)}-${Math.max(3, Math.floor(daysUntilDue * 0.7))})**
- Implement the primary ${action.actionType.toLowerCase()} measures
- Document progress at each milestone
- Address any obstacles or dependencies
- Conduct interim reviews as needed

**Phase 3: Verification (Days ${Math.max(4, Math.floor(daysUntilDue * 0.7) + 1)}-${daysUntilDue})**
- Verify implementation meets requirements
- Collect evidence of completion
- Update relevant procedures and training materials
- Prepare completion documentation

**Resources Needed:**
- Personnel: Action owner + relevant SMEs
- Documentation: Procedures, work instructions, training records
- Approvals: As required by your organization's CAPA process

**Success Criteria:**
- All steps completed and documented
- No recurrence of the original issue
- Stakeholder sign-off obtained`;
}

// Helper: Basic validation without AI
function performBasicValidation(plan: string, action: any): any {
  const wordCount = plan.split(/\s+/).length;
  const hasPhases = /phase|step|stage/i.test(plan);
  const hasTimeline = /day|week|date|deadline|timeline/i.test(plan);
  const hasVerification = /verify|check|confirm|review|test/i.test(plan);
  const hasResources = /resource|personnel|team|equipment|material/i.test(plan);
  
  let score = 50; // Base score
  const strengths: string[] = [];
  const gaps: string[] = [];
  const suggestions: string[] = [];

  if (wordCount >= 100) {
    score += 15;
    strengths.push('Comprehensive plan with good detail');
  } else if (wordCount >= 50) {
    score += 5;
    gaps.push('Plan could be more detailed');
  } else {
    gaps.push('Plan is too brief - add more specific steps');
  }

  if (hasPhases) {
    score += 10;
    strengths.push('Well-structured with clear phases');
  } else {
    suggestions.push('Consider organizing into phases (Preparation, Execution, Verification)');
  }

  if (hasTimeline) {
    score += 10;
    strengths.push('Includes timeline considerations');
  } else {
    suggestions.push('Add specific timelines or milestones');
  }

  if (hasVerification) {
    score += 10;
    strengths.push('Includes verification/review steps');
  } else {
    suggestions.push('Add verification criteria to confirm successful implementation');
  }

  if (hasResources) {
    score += 5;
  } else {
    suggestions.push('Specify required resources (personnel, equipment, approvals)');
  }

  const verdict = score >= 75 ? 'APPROVED' : score >= 50 ? 'NEEDS_REVISION' : 'INSUFFICIENT';

  return {
    validation: {
      score: Math.min(100, score),
      verdict,
      strengths: strengths.length > 0 ? strengths : ['Plan addresses the action'],
      gaps,
      suggestions,
      complianceNotes: ['Ensure documentation meets your organization\'s CAPA requirements'],
      summary: verdict === 'APPROVED' 
        ? 'Plan is adequate for implementation' 
        : 'Plan needs additional detail before proceeding',
    },
    validatedAt: new Date().toISOString(),
    planLength: plan.length,
    wordCount,
    aiPowered: false,
  };
}

// ============================================================================
// Phase 9.5: Structured Implementation Plan Generation (AI-Powered)
// ============================================================================

/**
 * POST /api/capa/:id/generate-structured-plan
 * Generate a structured, step-by-step implementation plan with AI
 */
router.post('/:id/generate-structured-plan', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { actionTitle, actionDescription, actionType, priority, dueDate, incidentDescription, rootCause, category, facility } = req.body;

    // Verify action exists
    const action = await prisma.cAPAction.findUnique({
      where: { id },
      include: {
        User: { select: { firstName: true, lastName: true, role: true } },
        RCAAnalysis: {
          include: {
            Incident: {
              include: { Category: true, Facility: true, Line: true },
            },
          },
        },
      },
    });

    if (!action) {
      return res.status(404).json({
        success: false,
        error: 'CAPA action not found',
      });
    }

    // Check if OpenAI is available
    if (!process.env.OPENAI_API_KEY) {
      // Return fallback structured plan
      return res.json({
        success: true,
        data: {
          steps: generateFallbackStructuredPlan(action),
          generatedAt: new Date().toISOString(),
          aiPowered: false,
        },
      });
    }

    const OpenAI = (await import('openai')).default;
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const completion = await openai.chat.completions.create({
      model: process.env.AI_MODEL || 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a helpful workplace safety advisor who explains things in simple, everyday language. Think of yourself as a friendly coworker with experience in fixing problems and preventing accidents.

Your job is to create step-by-step plans that anyone can follow - no fancy jargon, just clear and practical steps that make sense.

IMPORTANT RULES:
- Use simple words that everyone understands (avoid technical terms unless necessary)
- Give realistic steps that can actually be done with normal resources
- Think about what a regular employee or supervisor can realistically accomplish
- Make each step feel natural, like advice from an experienced colleague
- Be specific but not overly complicated

CRITICAL: Return ONLY valid JSON in this exact format:
{
  "steps": [
    {
      "actionDescription": "Write this like you're telling a coworker what to do - simple and clear",
      "estimatedTime": "Realistic time (e.g., '30 minutes', '1-2 hours', 'half a day')",
      "responsibleParty": "Who should do this (e.g., 'Supervisor', 'Safety Team', 'Maintenance')",
      "dueDate": "When this should be done by",
      "ownership": "Which team owns this",
      "verificationMethod": "Simple way to check it was done right",
      "notes": "Any helpful tips or things to watch out for"
    }
  ]
}

Generate 4-6 practical steps. Each step should be:
1. Easy to understand without special training
2. Something a real person can actually do
3. Have a clear way to check if it's done
4. Make sense in the order given`,
        },
        {
          role: 'user',
          content: `Generate a structured implementation plan for this CAPA action:

**Action:** ${actionTitle || action.title}
**Type:** ${actionType || action.actionType}
**Priority:** ${priority || action.priority}
**Due Date:** ${new Date(dueDate || action.dueDate).toLocaleDateString()}
**Description:** ${actionDescription || action.description}

**Incident Context:**
- Category: ${category || action.RCAAnalysis?.Incident?.Category?.name || 'General'}
- Facility: ${facility || action.RCAAnalysis?.Incident?.Facility?.name || 'Not specified'}
- Description: ${incidentDescription || action.RCAAnalysis?.Incident?.description || 'Not specified'}
${rootCause ? `- Root Cause: ${rootCause}` : ''}

**Owner:** ${action.User.firstName} ${action.User.lastName} (${action.User.role})

Return the structured steps as JSON.`,
        },
      ],
      temperature: 0.7,
      max_completion_tokens: 2000,
      response_format: { type: 'json_object' },
    });

    const responseText = completion.choices[0]?.message?.content || '{}';
    let parsedResponse;
    
    try {
      parsedResponse = JSON.parse(responseText);
    } catch {
      parsedResponse = { steps: generateFallbackStructuredPlan(action) };
    }

    res.json({
      success: true,
      data: {
        steps: parsedResponse.steps || [],
        generatedAt: new Date().toISOString(),
        aiPowered: true,
      },
    });
  } catch (error: any) {
    console.error('Structured Plan Generation Error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate structured plan',
    });
  }
});

/**
 * POST /api/capa/:id/validate-step
 * Validate a single implementation step for clarity, feasibility, and alignment
 */
router.post('/:id/validate-step', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { stepDescription, estimatedTime, verificationMethod, rootCause, actionTitle, actionType } = req.body;

    if (!stepDescription || !stepDescription.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Step description is required for validation',
      });
    }

    // Check if OpenAI is available
    if (!process.env.OPENAI_API_KEY) {
      // Provide basic rule-based validation
      return res.json({
        success: true,
        data: validateStepBasic(stepDescription, estimatedTime, verificationMethod),
      });
    }

    const OpenAI = (await import('openai')).default;
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const completion = await openai.chat.completions.create({
      model: process.env.AI_MODEL || 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a CAPA quality reviewer. Evaluate implementation steps for:
1. **Clarity** (0-100): Is it specific, unambiguous, and actionable?
2. **Feasibility** (0-100): Can it realistically be completed?
3. **Alignment** (0-100): Does it address the root cause/action objective?

Return JSON:
{
  "isValid": boolean (true if all scores >= 70),
  "clarity": number,
  "feasibility": number,
  "alignment": number,
  "suggestions": ["improvement suggestions if any"]
}`,
        },
        {
          role: 'user',
          content: `Validate this implementation step:

**Step Description:** ${stepDescription}
**Estimated Time:** ${estimatedTime || 'Not specified'}
**Verification Method:** ${verificationMethod || 'Not specified'}

**Context:**
- Action: ${actionTitle || 'CAPA Action'}
- Type: ${actionType || 'CORRECTIVE'}
${rootCause ? `- Root Cause: ${rootCause}` : ''}

Provide validation scores and suggestions.`,
        },
      ],
      temperature: 0.3,
      max_completion_tokens: 500,
      response_format: { type: 'json_object' },
    });

    const responseText = completion.choices[0]?.message?.content || '{}';
    let validation;
    
    try {
      validation = JSON.parse(responseText);
    } catch {
      validation = validateStepBasic(stepDescription, estimatedTime, verificationMethod);
    }

    res.json({
      success: true,
      data: {
        ...validation,
        validatedAt: new Date().toISOString(),
        aiPowered: true,
      },
    });
  } catch (error: any) {
    console.error('Step Validation Error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to validate step',
    });
  }
});

/**
 * POST /api/capa/:id/suggest-step
 * AI-suggest content for an implementation step
 */
router.post('/:id/suggest-step', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { stepNumber, existingSteps, actionTitle, actionDescription, actionType, rootCause } = req.body;

    // Check if OpenAI is available
    if (!process.env.OPENAI_API_KEY) {
      return res.json({
        success: true,
        data: {
          suggestion: `Step ${stepNumber}: Review and document the current state of the issue`,
          estimatedTime: '2-4 hours',
          verificationMethod: 'Documentation review and sign-off',
          aiPowered: false,
        },
      });
    }

    const OpenAI = (await import('openai')).default;
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const existingContext = existingSteps && existingSteps.length > 0
      ? `\n\nExisting steps in the plan:\n${existingSteps.map((s: string, i: number) => `${i + 1}. ${s}`).join('\n')}`
      : '';

    const completion = await openai.chat.completions.create({
      model: process.env.AI_MODEL || 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a CAPA implementation expert. Suggest the next logical step for an implementation plan. Return JSON:
{
  "suggestion": "Specific, actionable step description",
  "estimatedTime": "Realistic time estimate",
  "verificationMethod": "How to verify completion"
}`,
        },
        {
          role: 'user',
          content: `Suggest step ${stepNumber} for this CAPA:

**Action:** ${actionTitle || 'CAPA Action'}
**Description:** ${actionDescription || 'Implementation action'}
**Type:** ${actionType || 'CORRECTIVE'}
${rootCause ? `**Root Cause:** ${rootCause}` : ''}
${existingContext}

Provide a specific, actionable next step that logically follows the existing steps (or starts fresh if none exist).`,
        },
      ],
      temperature: 0.7,
      max_completion_tokens: 300,
      response_format: { type: 'json_object' },
    });

    const responseText = completion.choices[0]?.message?.content || '{}';
    let suggestion;
    
    try {
      suggestion = JSON.parse(responseText);
    } catch {
      suggestion = {
        suggestion: `Step ${stepNumber}: Implement the required changes and document the process`,
        estimatedTime: '2-4 hours',
        verificationMethod: 'Documentation review',
      };
    }

    res.json({
      success: true,
      data: {
        ...suggestion,
        aiPowered: true,
      },
    });
  } catch (error: any) {
    console.error('Step Suggestion Error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to suggest step',
    });
  }
});

// ============================================================================
// Phase 10.5: Complete Action - Deviation & Lessons Learned Endpoints
// ============================================================================

/**
 * POST /api/capa/:id/validate-deviation
 * AI-powered validation of deviation from implementation plan
 */
router.post('/:id/validate-deviation', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { deviationDescription, originalPlan, actionTitle, actionType, rootCause } = req.body;

    if (!deviationDescription) {
      throw new ValidationError('Deviation description is required');
    }

    // Check if action exists
    const action = await prisma.cAPAction.findUnique({
      where: { id },
      include: {
        RCAAnalysis: {
          select: {
            rootCauseStatement: true,
            Incident: {
              select: {
                description: true,
                Category: { select: { name: true } },
              },
            },
          },
        },
      },
    });

    if (!action) {
      return res.status(404).json({ success: false, error: 'Action not found' });
    }

    // Try AI-powered validation
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (openaiApiKey && openaiApiKey !== 'your-openai-api-key-here') {
      try {
        const OpenAI = require('openai');
        const openai = new OpenAI({ apiKey: openaiApiKey });

        const prompt = `As a quality assurance expert, analyze this deviation from an implementation plan:

ACTION: ${actionTitle || action.title}
TYPE: ${actionType || action.actionType}
ROOT CAUSE: ${rootCause || action.RCAAnalysis?.rootCauseStatement || 'Not specified'}

ORIGINAL PLAN:
${originalPlan || action.implementationPlan || 'No plan documented'}

DEVIATION DESCRIBED:
${deviationDescription}

Analyze this deviation and provide a JSON response with:
1. riskLevel: "LOW", "MEDIUM", "HIGH", or "CRITICAL"
2. gaps: Array of gaps or missing elements (max 5)
3. risks: Array of potential risks from this deviation (max 5)
4. recommendations: Array of recommendations to address the deviation (max 5)
5. summary: A brief professional summary (2-3 sentences)
6. isValid: Boolean indicating if the deviation is acceptable

Respond ONLY with valid JSON:`;

        const completion = await openai.chat.completions.create({
          model: process.env.AI_MODEL || 'gpt-4o',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
          max_completion_tokens: 1000,
        });

        const responseText = completion.choices[0].message.content || '';
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        
        if (jsonMatch) {
          const validation = JSON.parse(jsonMatch[0]);
          return res.json({
            success: true,
            data: {
              isValid: validation.isValid ?? true,
              riskLevel: validation.riskLevel || 'MEDIUM',
              gaps: validation.gaps || [],
              risks: validation.risks || [],
              recommendations: validation.recommendations || [],
              summary: validation.summary || 'Deviation analyzed.',
              aiPowered: true,
            },
          });
        }
      } catch (aiError: any) {
        console.error('AI deviation validation error:', aiError.message);
      }
    }

    // Fallback: Basic validation
    const validation = validateDeviationBasic(deviationDescription, originalPlan);
    return res.json({ success: true, data: validation });

  } catch (error: any) {
    console.error('Validate deviation error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to validate deviation',
    });
  }
});

/**
 * POST /api/capa/:id/generate-lessons
 * AI-powered lessons learned generation
 */
router.post('/:id/generate-lessons', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const {
      completionEvidence,
      deviationDescription,
      actionTitle,
      actionDescription,
      actionType,
      implementationPlan,
      rootCause,
      incidentDescription,
      category,
    } = req.body;

    // Check if action exists
    const action = await prisma.cAPAction.findUnique({
      where: { id },
      include: {
        RCAAnalysis: {
          select: {
            rootCauseStatement: true,
            Incident: {
              select: {
                description: true,
                Category: { select: { name: true } },
              },
            },
          },
        },
      },
    });

    if (!action) {
      return res.status(404).json({ success: false, error: 'Action not found' });
    }

    // Try AI-powered generation
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (openaiApiKey && openaiApiKey !== 'your-openai-api-key-here') {
      try {
        const OpenAI = require('openai');
        const openai = new OpenAI({ apiKey: openaiApiKey });

        const prompt = `As a continuous improvement expert, generate comprehensive lessons learned from this completed corrective/preventive action:

INCIDENT CONTEXT:
- Category: ${category || action.RCAAnalysis?.Incident?.Category?.name || 'General'}
- Description: ${incidentDescription || action.RCAAnalysis?.Incident?.description || 'Not specified'}

ROOT CAUSE: ${rootCause || action.RCAAnalysis?.rootCauseStatement || 'Not specified'}

ACTION DETAILS:
- Title: ${actionTitle || action.title}
- Type: ${actionType || action.actionType}
- Description: ${actionDescription || action.description}
- Implementation Plan: ${implementationPlan || action.implementationPlan || 'Not documented'}

COMPLETION EVIDENCE: ${completionEvidence || 'Not provided'}

${deviationDescription ? `DEVIATION FROM PLAN: ${deviationDescription}` : ''}

Generate lessons learned that include:
1. What was learned about the root cause and incident type
2. What worked well during the implementation
3. What could be improved in similar future incidents
4. Recommendations for preventing recurrence
5. Best practices identified

Format as a clear, professional narrative suitable for a knowledge base (3-5 paragraphs).`;

        const completion = await openai.chat.completions.create({
          model: process.env.AI_MODEL || 'gpt-4o',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.5,
          max_completion_tokens: 1500,
        });

        const lessons = completion.choices[0].message.content || '';
        return res.json({
          success: true,
          data: {
            lessons: lessons.trim(),
            aiPowered: true,
          },
        });
      } catch (aiError: any) {
        console.error('AI lessons generation error:', aiError.message);
      }
    }

    // Fallback: Template-based lessons
    const lessons = generateLessonsTemplate(action, completionEvidence, deviationDescription);
    return res.json({
      success: true,
      data: {
        lessons,
        aiPowered: false,
      },
    });

  } catch (error: any) {
    console.error('Generate lessons error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate lessons',
    });
  }
});

/**
 * POST /api/capa/:id/validate-lessons
 * AI-powered lessons learned validation
 */
router.post('/:id/validate-lessons', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { lessonsLearned, actionTitle, actionType, rootCause, category } = req.body;

    if (!lessonsLearned) {
      throw new ValidationError('Lessons learned content is required');
    }

    // Check if action exists
    const action = await prisma.cAPAction.findUnique({
      where: { id },
      include: {
        RCAAnalysis: {
          select: {
            rootCauseStatement: true,
            Incident: {
              select: {
                Category: { select: { name: true } },
              },
            },
          },
        },
      },
    });

    if (!action) {
      return res.status(404).json({ success: false, error: 'Action not found' });
    }

    // Try AI-powered validation
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (openaiApiKey && openaiApiKey !== 'your-openai-api-key-here') {
      try {
        const OpenAI = require('openai');
        const openai = new OpenAI({ apiKey: openaiApiKey });

        const prompt = `As a knowledge management expert, evaluate these lessons learned:

ACTION: ${actionTitle || action.title}
TYPE: ${actionType || action.actionType}
ROOT CAUSE: ${rootCause || action.RCAAnalysis?.rootCauseStatement || 'Not specified'}
CATEGORY: ${category || action.RCAAnalysis?.Incident?.Category?.name || 'General'}

LESSONS LEARNED:
${lessonsLearned}

Evaluate and provide a JSON response:
1. clarity: Score 0-100 (how clear and well-written)
2. applicability: Score 0-100 (how applicable to future incidents)
3. enhancements: Array of suggestions to improve (max 5)
4. relatedCategories: Array of incident categories this applies to
5. summary: Brief evaluation summary (1-2 sentences)
6. isValid: Boolean (true if scores average >= 70)

Respond ONLY with valid JSON:`;

        const completion = await openai.chat.completions.create({
          model: process.env.AI_MODEL || 'gpt-4o',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
          max_completion_tokens: 800,
        });

        const responseText = completion.choices[0].message.content || '';
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        
        if (jsonMatch) {
          const validation = JSON.parse(jsonMatch[0]);
          return res.json({
            success: true,
            data: {
              isValid: validation.isValid ?? true,
              clarity: validation.clarity ?? 70,
              applicability: validation.applicability ?? 70,
              enhancements: validation.enhancements || [],
              relatedCategories: validation.relatedCategories || [],
              summary: validation.summary || 'Lessons validated.',
              aiPowered: true,
            },
          });
        }
      } catch (aiError: any) {
        console.error('AI lessons validation error:', aiError.message);
      }
    }

    // Fallback: Basic validation
    const validation = validateLessonsBasic(lessonsLearned);
    return res.json({ success: true, data: validation });

  } catch (error: any) {
    console.error('Validate lessons error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to validate lessons',
    });
  }
});

/**
 * POST /api/capa/:id/improve-writing
 * AI-powered writing improvement for lessons learned
 * Corrects spelling, grammar, improves professionalism while preserving natural tone
 */
router.post('/:id/improve-writing', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { content, context } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Content is required for improvement',
      });
    }

    // Try AI-powered improvement
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (openaiApiKey && openaiApiKey !== 'your-openai-api-key-here') {
      try {
        const OpenAI = require('openai');
        const openai = new OpenAI({ apiKey: openaiApiKey });

        const prompt = `You are a professional writing assistant. Your task is to improve the following text while preserving its meaning and the author's voice.

INSTRUCTIONS:
1. Fix all spelling errors
2. Correct grammar and sentence structure
3. Improve clarity and professionalism
4. Keep the writing natural and human-sounding
5. Preserve the author's original meaning and tone
6. Do NOT add generic AI phrases or robotic language
7. Do NOT significantly change the content or add new information
8. Keep approximately the same length
9. Maintain any technical terms or industry-specific language

${context ? `CONTEXT: This is about ${context}` : ''}

ORIGINAL TEXT:
${content}

Return ONLY the improved text, nothing else. Do not include any explanations, prefixes, or metadata.`;

        const completion = await openai.chat.completions.create({
          model: process.env.AI_MODEL || 'gpt-4o',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
          max_completion_tokens: 2000,
        });

        const improvedContent = completion.choices[0].message.content?.trim() || content;
        
        return res.json({
          success: true,
          data: {
            improvedContent,
            aiPowered: true,
          },
        });
      } catch (aiError: any) {
        console.error('AI writing improvement error:', aiError.message);
      }
    }

    // Fallback: Return original with basic improvements (capitalize sentences, etc.)
    let improved = content;
    
    // Basic capitalization of first letter after sentence endings
    improved = improved.replace(/([.!?]\s+)([a-z])/g, (match: string, p1: string, p2: string) => p1 + p2.toUpperCase());
    
    // Capitalize first letter
    if (improved.length > 0 && /[a-z]/.test(improved[0])) {
      improved = improved[0].toUpperCase() + improved.slice(1);
    }

    return res.json({
      success: true,
      data: {
        improvedContent: improved,
        aiPowered: false,
      },
    });

  } catch (error: any) {
    console.error('Improve writing error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to improve writing',
    });
  }
});

// ============================================================================
// Helper Functions
// ============================================================================

// Helper: Basic deviation validation without AI
function validateDeviationBasic(description: string, originalPlan?: string): any {
  const wordCount = description.trim().split(/\s+/).length;
  const gaps: string[] = [];
  const risks: string[] = [];
  const recommendations: string[] = [];
  let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'MEDIUM';

  // Analyze description length
  if (wordCount < 20) {
    gaps.push('Deviation description lacks sufficient detail');
    recommendations.push('Provide more specific information about what changed and why');
  }

  // Check for key elements
  if (!description.toLowerCase().includes('because') && !description.toLowerCase().includes('due to') && !description.toLowerCase().includes('reason')) {
    gaps.push('Missing explanation for why deviation occurred');
    recommendations.push('Explain the reason or cause for the deviation');
  }

  if (!description.toLowerCase().includes('instead') && !description.toLowerCase().includes('alternative') && !description.toLowerCase().includes('changed')) {
    gaps.push('Unclear what alternative approach was taken');
    recommendations.push('Describe what was done instead of the original plan');
  }

  // Check for risk indicators
  const highRiskTerms = /safety|quality|regulatory|compliance|critical|failure/i;
  const lowRiskTerms = /minor|slight|small|administrative|timing|schedule/i;

  if (highRiskTerms.test(description)) {
    riskLevel = 'HIGH';
    risks.push('Deviation may impact quality or compliance requirements');
    recommendations.push('Ensure deviation is reviewed by quality assurance');
  } else if (lowRiskTerms.test(description)) {
    riskLevel = 'LOW';
  }

  // General risks
  if (originalPlan) {
    risks.push('Original plan was modified - verify all objectives still met');
  }
  risks.push('Deviation should be documented for future reference');

  return {
    isValid: true,
    riskLevel,
    gaps,
    risks,
    recommendations,
    summary: `Deviation documented with ${wordCount} words. Risk level assessed as ${riskLevel}. Review recommendations before finalizing.`,
    aiPowered: false,
  };
}

// Helper: Generate template lessons learned
function generateLessonsTemplate(action: any, completionEvidence?: string, deviationDescription?: string): string {
  const category = action.RCAAnalysis?.Incident?.Category?.name || 'this type of incident';
  const rootCause = action.RCAAnalysis?.rootCauseStatement || 'the identified root cause';
  
  let lessons = `**Lessons Learned from ${action.title}**\n\n`;
  lessons += `This ${action.actionType.toLowerCase()} action addressed ${rootCause}. `;
  lessons += `The implementation provided valuable insights for handling similar ${category} incidents in the future.\n\n`;
  
  lessons += `**Key Takeaways:**\n`;
  lessons += `- Early identification and documentation of the root cause is essential for effective corrective action.\n`;
  lessons += `- Clear communication with all stakeholders throughout the implementation process ensures alignment.\n`;
  lessons += `- Systematic verification of implemented changes confirms effectiveness.\n\n`;
  
  if (deviationDescription) {
    lessons += `**Adaptation Notes:**\n`;
    lessons += `The implementation required deviation from the original plan. This flexibility was necessary to address real-world conditions while still achieving the intended outcome.\n\n`;
  }
  
  lessons += `**Recommendations for Future Incidents:**\n`;
  lessons += `- Apply the systematic approach used in this action to similar incidents.\n`;
  lessons += `- Consider preventive measures to reduce the likelihood of recurrence.\n`;
  lessons += `- Update relevant procedures or training materials based on these findings.`;
  
  return lessons;
}

// Helper: Basic lessons validation without AI
function validateLessonsBasic(lessonsLearned: string): any {
  const wordCount = lessonsLearned.trim().split(/\s+/).length;
  const enhancements: string[] = [];
  let clarity = 50;
  let applicability = 50;

  // Word count scoring
  if (wordCount >= 100) {
    clarity += 30;
    applicability += 25;
  } else if (wordCount >= 50) {
    clarity += 15;
    applicability += 15;
    enhancements.push('Consider adding more detail to the lessons learned');
  } else {
    enhancements.push('Lessons learned should be more comprehensive');
  }

  // Check for key elements
  if (lessonsLearned.toLowerCase().includes('recommend') || lessonsLearned.toLowerCase().includes('suggestion') || lessonsLearned.toLowerCase().includes('should')) {
    applicability += 15;
  } else {
    enhancements.push('Include specific recommendations for future incidents');
  }

  if (lessonsLearned.toLowerCase().includes('learn') || lessonsLearned.toLowerCase().includes('insight') || lessonsLearned.toLowerCase().includes('found')) {
    clarity += 10;
  }

  if (lessonsLearned.toLowerCase().includes('prevent') || lessonsLearned.toLowerCase().includes('improve') || lessonsLearned.toLowerCase().includes('future')) {
    applicability += 10;
  } else {
    enhancements.push('Address how to prevent similar incidents in the future');
  }

  const isValid = clarity >= 70 && applicability >= 70;

  return {
    isValid,
    clarity: Math.min(100, clarity),
    applicability: Math.min(100, applicability),
    enhancements,
    relatedCategories: ['Quality', 'Operations', 'Safety'],
    summary: isValid 
      ? 'Lessons learned are well-documented and applicable.'
      : 'Consider enhancing the lessons learned with more detail and actionable recommendations.',
    aiPowered: false,
  };
}

// Helper: Generate fallback structured plan
function generateFallbackStructuredPlan(action: any): any[] {
  const dueDate = new Date(action.dueDate);
  const today = new Date();
  const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  
  return [
    {
      actionDescription: 'Review incident details and root cause analysis documentation',
      estimatedTime: '2 hours',
      responsibleParty: 'Quality Assurance',
      dueDate: new Date(today.getTime() + 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      ownership: 'Quality Department',
      verificationMethod: 'Completed review checklist signed off',
      notes: 'Gather all relevant documentation before starting',
    },
    {
      actionDescription: 'Identify and gather required resources (personnel, equipment, materials)',
      estimatedTime: '4 hours',
      responsibleParty: 'Action Owner',
      dueDate: new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      ownership: 'Operations',
      verificationMethod: 'Resource list documented and approved',
      notes: '',
    },
    {
      actionDescription: 'Conduct kick-off meeting with stakeholders to align on approach',
      estimatedTime: '1 hour',
      responsibleParty: 'Action Owner',
      dueDate: new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      ownership: 'Cross-functional',
      verificationMethod: 'Meeting minutes documented',
      notes: 'Invite all relevant departments',
    },
    {
      actionDescription: `Execute primary ${action.actionType.toLowerCase()} measures as defined`,
      estimatedTime: `${Math.max(1, Math.floor(daysUntilDue * 0.4))} days`,
      responsibleParty: 'Implementation Team',
      dueDate: new Date(today.getTime() + Math.floor(daysUntilDue * 0.6) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      ownership: 'Operations',
      verificationMethod: 'Implementation checklist completed',
      notes: 'Document progress at each milestone',
    },
    {
      actionDescription: 'Verify implementation effectiveness through inspection/audit',
      estimatedTime: '4 hours',
      responsibleParty: 'Quality Assurance',
      dueDate: new Date(today.getTime() + Math.floor(daysUntilDue * 0.8) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      ownership: 'Quality Department',
      verificationMethod: 'Verification report signed',
      notes: 'Compare before/after metrics if available',
    },
    {
      actionDescription: 'Complete all required documentation and update quality records',
      estimatedTime: '2 hours',
      responsibleParty: 'Action Owner',
      dueDate: new Date(dueDate.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      ownership: 'Quality Department',
      verificationMethod: 'Documentation archived in QMS',
      notes: 'Ensure regulatory compliance requirements met',
    },
  ];
}

// Helper: Basic step validation without AI
function validateStepBasic(description: string, estimatedTime?: string, verificationMethod?: string): any {
  let clarity = 50;
  let feasibility = 70;
  let alignment = 60;
  const suggestions: string[] = [];

  // Check description quality
  const wordCount = description.trim().split(/\s+/).length;
  if (wordCount >= 10) {
    clarity += 30;
  } else if (wordCount >= 5) {
    clarity += 15;
    suggestions.push('Consider adding more detail to the action description');
  } else {
    suggestions.push('Action description is too brief - add specific details');
  }

  // Check for action verbs
  const actionVerbs = /\b(review|implement|document|verify|train|update|create|conduct|perform|analyze|inspect|audit|communicate|schedule)\b/i;
  if (actionVerbs.test(description)) {
    clarity += 15;
  } else {
    suggestions.push('Start with a clear action verb (e.g., Review, Implement, Verify)');
  }

  // Check estimated time
  if (estimatedTime && estimatedTime.trim()) {
    feasibility += 15;
  } else {
    suggestions.push('Add an estimated time for completion');
  }

  // Check verification method
  if (verificationMethod && verificationMethod.trim()) {
    feasibility += 10;
    alignment += 20;
  } else {
    suggestions.push('Specify how completion will be verified');
  }

  const isValid = clarity >= 70 && feasibility >= 70 && alignment >= 70;

  return {
    isValid,
    clarity: Math.min(100, clarity),
    feasibility: Math.min(100, feasibility),
    alignment: Math.min(100, alignment),
    suggestions,
    aiPowered: false,
  };
}

export default router;
