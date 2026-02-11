import express, { Request, Response, Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';

const router: Router = express.Router();
const prisma = new PrismaClient();

// Async handler wrapper
const asyncHandler = (fn: (req: Request, res: Response) => Promise<void>) => {
  return (req: Request, res: Response) => {
    Promise.resolve(fn(req, res)).catch((error) => {
      console.error('Work Order Route Error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Internal server error',
        message: error.message 
      });
    });
  };
};

/**
 * Generate unique WO number
 * Format: WO-YYYY-NNNN (e.g., WO-2026-0001)
 */
async function generateWONumber(organizationId: string): Promise<string> {
  const currentYear = new Date().getFullYear();
  const prefix = `WO-${currentYear}-`;
  
  // Find the highest WO number for this year and org
  const lastWorkOrder = await prisma.workOrder.findFirst({
    where: {
      organizationId,
      woNumber: {
        startsWith: prefix,
      },
    },
    orderBy: {
      woNumber: 'desc',
    },
    select: {
      woNumber: true,
    },
  });

  let nextNumber = 1;
  if (lastWorkOrder) {
    const lastNumberStr = lastWorkOrder.woNumber.replace(prefix, '');
    const lastNumber = parseInt(lastNumberStr, 10);
    if (!isNaN(lastNumber)) {
      nextNumber = lastNumber + 1;
    }
  }

  return `${prefix}${nextNumber.toString().padStart(4, '0')}`;
}

/**
 * @route   GET /api/work-orders
 * @desc    Get all work orders for the organization
 * @access  Private (any authenticated user)
 */
router.get(
  '/',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthRequest;
    const organizationId = authReq.user?.organizationId;
    const { type, status, assessmentId } = req.query;

    if (!organizationId) {
      res.status(400).json({ 
        success: false, 
        error: 'Organization ID is required' 
      });
      return;
    }

    const whereClause: any = { organizationId };
    
    if (type && ['IN_APP', 'UPLOADED'].includes(type as string)) {
      whereClause.type = type as WorkOrderType;
    }
    
    if (status && ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].includes(status as string)) {
      whereClause.status = status as WorkOrderStatus;
    }
    
    if (assessmentId) {
      whereClause.assessmentId = assessmentId as string;
    }

    const workOrders = await prisma.workOrder.findMany({
      where: whereClause,
      include: {
        CreatedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        AssignedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        Assessment: {
          select: {
            id: true,
            assessmentNumber: true,
            date: true,
            department: true,
            status: true,
          },
        },
        StatusHistory: {
          include: {
            ChangedBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
          orderBy: {
            changedAt: 'desc',
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.json({
      success: true,
      data: workOrders,
      count: workOrders.length,
    });
  })
);

/**
 * @route   GET /api/work-orders/:id
 * @desc    Get a single work order by ID
 * @access  Private
 */
router.get(
  '/:id',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthRequest;
    const organizationId = authReq.user?.organizationId;
    const { id } = req.params;

    if (!organizationId) {
      res.status(400).json({ 
        success: false, 
        error: 'Organization ID is required' 
      });
      return;
    }

    const workOrder = await prisma.workOrder.findFirst({
      where: {
        id,
        organizationId,
      },
      include: {
        CreatedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        AssignedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        Assessment: {
          select: {
            id: true,
            assessmentNumber: true,
            date: true,
            department: true,
            status: true,
          },
        },
        StatusHistory: {
          include: {
            ChangedBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
          orderBy: {
            changedAt: 'desc',
          },
        },
      },
    });

    if (!workOrder) {
      res.status(404).json({ 
        success: false, 
        error: 'Work order not found' 
      });
      return;
    }

    res.json({
      success: true,
      data: workOrder,
    });
  })
);

/**
 * @route   POST /api/work-orders
 * @desc    Create a new work order (In-App form submission)
 * @access  Private
 */
router.post(
  '/',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthRequest;
    const userId = authReq.user?.id;
    const organizationId = authReq.user?.organizationId;

    if (!organizationId || !userId) {
      res.status(400).json({ 
        success: false, 
        error: 'Authentication required' 
      });
      return;
    }

    const {
      assessmentId,
      assessmentNumber,
      sectionId,
      itemId,
      itemDescription,
      requestDate,
      expenseClass,
      originator,
      woType,
      priority,
      description,
      equipmentNo,
      equipmentDescription,
      fullDescriptionOfIssue,
      department,
      assignedTo,
    } = req.body;

    console.log('[Work Order] Creating work order with:', {
      assessmentId,
      assessmentNumber,
      sectionId,
      itemId,
      organizationId,
    });

    // Validate required fields
    if (!assessmentId || !assessmentNumber) {
      console.error('[Work Order] Missing required fields:', { assessmentId, assessmentNumber });
      res.status(400).json({ 
        success: false, 
        error: 'Assessment information is required' 
      });
      return;
    }

    // Generate WO number
    const woNumber = await generateWONumber(organizationId);

    // Create work order
    const workOrder = await prisma.workOrder.create({
      data: {
        woNumber,
        type: 'IN_APP',
        assessmentId,
        assessmentNumber,
        sectionId,
        itemId,
        itemDescription,
        requestDate: requestDate ? new Date(requestDate) : new Date(),
        expenseClass,
        originator,
        woType,
        priority: priority ? parseInt(priority, 10) : null,
        description,
        equipmentNo,
        equipmentDescription,
        fullDescriptionOfIssue,
        department,
        assignedTo,
        assignedById: userId,
        status: 'PENDING',
        createdById: userId,
        organizationId,
      },
      include: {
        CreatedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        Assessment: {
          select: {
            id: true,
            assessmentNumber: true,
          },
        },
      },
    });

    // Create initial status history entry
    await prisma.workOrderStatusHistory.create({
      data: {
        workOrderId: workOrder.id,
        fromStatus: null,
        toStatus: 'PENDING',
        changedById: userId,
        notes: 'Work order created',
      },
    });

    console.log(`Work order created: ${woNumber} for assessment ${assessmentNumber}`);

    res.status(201).json({
      success: true,
      data: workOrder,
      message: `Work order ${woNumber} created successfully`,
    });
  })
);

/**
 * @route   POST /api/work-orders/uploaded
 * @desc    Create a work order record for uploaded file attachments
 * @access  Private
 */
router.post(
  '/uploaded',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthRequest;
    const userId = authReq.user?.id;
    const organizationId = authReq.user?.organizationId;

    if (!organizationId || !userId) {
      res.status(400).json({ 
        success: false, 
        error: 'Authentication required' 
      });
      return;
    }

    const {
      assessmentId,
      assessmentNumber,
      sectionId,
      itemId,
      itemDescription,
      fileName,
      fileUrl,
      fileSize,
    } = req.body;

    // Validate required fields
    if (!assessmentId || !assessmentNumber || !fileName || !fileUrl) {
      res.status(400).json({ 
        success: false, 
        error: 'Assessment and file information are required' 
      });
      return;
    }

    // Generate WO number
    const woNumber = await generateWONumber(organizationId);

    // Create work order for uploaded file
    const workOrder = await prisma.workOrder.create({
      data: {
        woNumber,
        type: 'UPLOADED',
        assessmentId,
        assessmentNumber,
        sectionId,
        itemId,
        itemDescription,
        fileName,
        fileUrl,
        fileSize: fileSize ? parseInt(fileSize, 10) : null,
        uploadedAt: new Date(),
        status: 'PENDING',
        createdById: userId,
        organizationId,
      },
      include: {
        CreatedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        Assessment: {
          select: {
            id: true,
            assessmentNumber: true,
          },
        },
      },
    });

    // Create initial status history entry
    await prisma.workOrderStatusHistory.create({
      data: {
        workOrderId: workOrder.id,
        fromStatus: null,
        toStatus: 'PENDING',
        changedById: userId,
        notes: 'Work order uploaded',
      },
    });

    console.log(`Uploaded work order created: ${woNumber} for assessment ${assessmentNumber}`);

    res.status(201).json({
      success: true,
      data: workOrder,
      message: `Work order ${woNumber} created successfully`,
    });
  })
);

/**
 * @route   PUT /api/work-orders/:id/status
 * @desc    Update work order status with audit trail
 * @access  Private
 */
router.put(
  '/:id/status',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthRequest;
    const userId = authReq.user?.id;
    const organizationId = authReq.user?.organizationId;
    const { id } = req.params;
    const { status, notes } = req.body;

    if (!organizationId || !userId) {
      res.status(400).json({ 
        success: false, 
        error: 'Authentication required' 
      });
      return;
    }

    // Validate status
    if (!status || !['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].includes(status)) {
      res.status(400).json({ 
        success: false, 
        error: 'Valid status is required (PENDING, IN_PROGRESS, COMPLETED, CANCELLED)' 
      });
      return;
    }

    // Get current work order
    const currentWorkOrder = await prisma.workOrder.findFirst({
      where: {
        id,
        organizationId,
      },
    });

    if (!currentWorkOrder) {
      res.status(404).json({ 
        success: false, 
        error: 'Work order not found' 
      });
      return;
    }

    const fromStatus = currentWorkOrder.status;

    // Update work order status
    const updatedWorkOrder = await prisma.workOrder.update({
      where: { id },
      data: {
        status: status as WorkOrderStatus,
        completionDate: status === 'COMPLETED' ? new Date() : 
                       (status !== 'COMPLETED' && currentWorkOrder.status === 'COMPLETED' as WorkOrderStatus) 
                         ? null : currentWorkOrder.completionDate,
        updatedAt: new Date(),
      },
      include: {
        CreatedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        AssignedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        Assessment: {
          select: {
            id: true,
            assessmentNumber: true,
          },
        },
      },
    });

    // Create status history entry
    await prisma.workOrderStatusHistory.create({
      data: {
        workOrderId: id,
        fromStatus: fromStatus as WorkOrderStatus,
        toStatus: status as WorkOrderStatus,
        changedById: userId,
        notes: notes || null,
      },
    });

    // Get the user who made the change
    const changedByUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true },
    });

    console.log(`Work order ${currentWorkOrder.woNumber} status changed from ${fromStatus} to ${status} by ${changedByUser?.firstName} ${changedByUser?.lastName}`);

    res.json({
      success: true,
      data: updatedWorkOrder,
      message: `Status updated to ${status}`,
    });
  })
);

/**
 * @route   GET /api/work-orders/:id/history
 * @desc    Get status history for a work order
 * @access  Private
 */
router.get(
  '/:id/history',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthRequest;
    const organizationId = authReq.user?.organizationId;
    const { id } = req.params;

    if (!organizationId) {
      res.status(400).json({ 
        success: false, 
        error: 'Organization ID is required' 
      });
      return;
    }

    // Verify work order belongs to org
    const workOrder = await prisma.workOrder.findFirst({
      where: {
        id,
        organizationId,
      },
      select: {
        id: true,
        woNumber: true,
      },
    });

    if (!workOrder) {
      res.status(404).json({ 
        success: false, 
        error: 'Work order not found' 
      });
      return;
    }

    const history = await prisma.workOrderStatusHistory.findMany({
      where: {
        workOrderId: id,
      },
      include: {
        ChangedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: {
        changedAt: 'desc',
      },
    });

    res.json({
      success: true,
      data: history,
      workOrderNumber: workOrder.woNumber,
    });
  })
);

/**
 * @route   PUT /api/work-orders/:id
 * @desc    Update a work order
 * @access  Private
 */
router.put(
  '/:id',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthRequest;
    const userId = authReq.user?.id;
    const organizationId = authReq.user?.organizationId;
    const { id } = req.params;

    if (!organizationId || !userId) {
      res.status(400).json({ 
        success: false, 
        error: 'Authentication required' 
      });
      return;
    }

    // Verify work order belongs to org
    const existingWorkOrder = await prisma.workOrder.findFirst({
      where: {
        id,
        organizationId,
      },
    });

    if (!existingWorkOrder) {
      res.status(404).json({ 
        success: false, 
        error: 'Work order not found' 
      });
      return;
    }

    const {
      expenseClass,
      woType,
      priority,
      description,
      equipmentNo,
      equipmentDescription,
      fullDescriptionOfIssue,
      department,
      assignedTo,
    } = req.body;

    const updatedWorkOrder = await prisma.workOrder.update({
      where: { id },
      data: {
        expenseClass,
        woType,
        priority: priority ? parseInt(priority, 10) : existingWorkOrder.priority,
        description,
        equipmentNo,
        equipmentDescription,
        fullDescriptionOfIssue,
        department,
        assignedTo,
        updatedAt: new Date(),
      },
      include: {
        CreatedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        Assessment: {
          select: {
            id: true,
            assessmentNumber: true,
          },
        },
      },
    });

    res.json({
      success: true,
      data: updatedWorkOrder,
      message: 'Work order updated successfully',
    });
  })
);

/**
 * @route   DELETE /api/work-orders/:id
 * @desc    Delete a work order
 * @access  Private (ADMIN, SYSTEM_ADMIN)
 */
router.delete(
  '/:id',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthRequest;
    const userRole = authReq.user?.role;
    const organizationId = authReq.user?.organizationId;
    const { id } = req.params;

    if (!['ADMIN', 'SYSTEM_ADMIN'].includes(userRole || '')) {
      res.status(403).json({ 
        success: false, 
        error: 'Access denied. Admin privileges required.' 
      });
      return;
    }

    if (!organizationId) {
      res.status(400).json({ 
        success: false, 
        error: 'Organization ID is required' 
      });
      return;
    }

    // Verify work order belongs to org
    const workOrder = await prisma.workOrder.findFirst({
      where: {
        id,
        organizationId,
      },
    });

    if (!workOrder) {
      res.status(404).json({ 
        success: false, 
        error: 'Work order not found' 
      });
      return;
    }

    await prisma.workOrder.delete({
      where: { id },
    });

    console.log(`Work order ${workOrder.woNumber} deleted`);

    res.json({
      success: true,
      message: `Work order ${workOrder.woNumber} deleted successfully`,
    });
  })
);

export default router;
