import { Router, Response, NextFunction } from 'express';
import { body, query, validationResult } from 'express-validator';
import asyncHandler from 'express-async-handler';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requireAdmin, requireSystemAdmin } from '../middleware/rbac';
import { prisma } from '../utils/prisma';

const router = Router();

const optionalAuthenticate = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.headers.authorization) {
    authenticate(req, res, next);
  } else {
    next();
  }
};

// 1. Submit a new support request (Authenticated or Unauthenticated)
router.post(
  '/',
  optionalAuthenticate,
  [
    body('subject').trim().isLength({ min: 5, max: 100 }),
    body('description').trim().isLength({ min: 10, max: 5000 }),
    body('category').isIn([
      'GENERAL_INQUIRY',
      'TECHNICAL_ISSUE',
      'BILLING_QUESTION',
      'FEATURE_REQUEST',
      'BUG_REPORT',
      'ACCOUNT_ASSISTANCE',
      'OTHER',
    ]),
    body('email').if((value, { req }) => !(req as AuthRequest).user).isEmail().normalizeEmail(),
  ],
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
    } else {
        const { subject, description, category, email } = req.body;
        const user = req.user;

        if (!user && !email) {
            res.status(400).json({ message: 'Email is required for unauthenticated users.' });
        } else {
            const supportRequest = await prisma.supportRequest.create({
              data: {
                subject,
                description,
                category,
                submittedByUserId: user?.id,
                submittedByUserEmail: user ? user.email : email,
                organizationId: user?.organizationId,
                status: 'OPEN',
              },
            });

            res.status(201).json(supportRequest);
        }
    }
  })
);

// 2. Get all support requests (SYSTEM_ADMIN ONLY - System Admin Portal)
// This endpoint is restricted to SYSTEM_ADMIN to manage ALL support requests
// across all organizations from the System Admin Portal
router.get(
  '/',
  authenticate,
  requireSystemAdmin, // Changed from requireAdmin to requireSystemAdmin
  [
    query('status').optional().isIn(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']),
    query('category').optional().isIn([
      'GENERAL_INQUIRY', 'TECHNICAL_ISSUE', 'BILLING_QUESTION',
      'FEATURE_REQUEST', 'BUG_REPORT', 'ACCOUNT_ASSISTANCE', 'OTHER'
    ]),
    query('organizationId').optional().isUUID(),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ],
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { 
      status, 
      category, 
      organizationId, 
      startDate, 
      endDate,
      page = '1',
      limit = '20'
    } = req.query;

    // Build where clause with filters
    const whereClause: any = {};
    
    if (status) {
      whereClause.status = status;
    }
    
    if (category) {
      whereClause.category = category;
    }
    
    if (organizationId) {
      whereClause.organizationId = organizationId;
    }
    
    if (startDate || endDate) {
      whereClause.createdAt = {};
      if (startDate) {
        whereClause.createdAt.gte = new Date(startDate as string);
      }
      if (endDate) {
        whereClause.createdAt.lte = new Date(endDate as string);
      }
    }

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const [requests, total] = await Promise.all([
      prisma.supportRequest.findMany({
        where: whereClause,
        include: {
          User_SupportRequest_submittedByUserIdToUser: {
            select: { id: true, firstName: true, lastName: true, email: true, role: true },
          },
          Organization: {
            select: { id: true, name: true },
          },
          User_SupportRequest_resolvedByUserIdToUser: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limitNum,
      }),
      prisma.supportRequest.count({ where: whereClause }),
    ]);

    // Get organizations for filter dropdown
    const organizations = await prisma.organization.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });

    // Calculate stats
    const allRequests = await prisma.supportRequest.findMany({
      select: { status: true },
    });
    
    const stats = {
      total: allRequests.length,
      open: allRequests.filter(r => r.status === 'OPEN').length,
      inProgress: allRequests.filter(r => r.status === 'IN_PROGRESS').length,
      resolved: allRequests.filter(r => r.status === 'RESOLVED').length,
      closed: allRequests.filter(r => r.status === 'CLOSED').length,
    };
    
    res.status(200).json({
      success: true,
      data: requests,
      organizations,
      stats,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  })
);

// 3. Get a single support request (SYSTEM_ADMIN ONLY)
router.get(
  '/:id',
  authenticate,
  requireSystemAdmin, // Changed from requireAdmin to requireSystemAdmin
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    
    const request = await prisma.supportRequest.findUnique({
      where: { id },
      include: {
        User_SupportRequest_submittedByUserIdToUser: {
          select: { id: true, firstName: true, lastName: true, email: true, role: true },
        },
        User_SupportRequest_resolvedByUserIdToUser: {
          select: { id: true, firstName: true, lastName: true },
        },
        Organization: {
          select: { id: true, name: true },
        },
      },
    });

    if (!request) {
      res.status(404).json({ 
        success: false, 
        message: 'Support request not found.' 
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: request
    });
  })
);

// 4. Update a support request (SYSTEM_ADMIN ONLY)
router.put(
  '/:id',
  authenticate,
  requireSystemAdmin, // Changed from requireAdmin to requireSystemAdmin
  [
    body('status').optional().isIn(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']),
    body('internalNotes').optional().isString().isLength({ max: 5000 }),
  ],
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ 
        success: false, 
        errors: errors.array() 
      });
      return;
    }
    
    const { id } = req.params;
    const { status, internalNotes } = req.body;
    const adminUser = req.user!;

    const existingRequest = await prisma.supportRequest.findUnique({ where: { id } });
    
    if (!existingRequest) {
      res.status(404).json({ 
        success: false, 
        message: 'Support request not found.' 
      });
      return;
    }

    const data: any = {};
    
    if (status !== undefined) {
      data.status = status;
    }
    
    if (internalNotes !== undefined) {
      data.internalNotes = internalNotes;
    }

    // Set resolved info when status changes to RESOLVED
    const isResolving = status === 'RESOLVED' && existingRequest.status !== 'RESOLVED';
    if (isResolving) {
      data.resolvedAt = new Date();
      data.resolvedByUserId = adminUser.id;
    }

    const updatedRequest = await prisma.supportRequest.update({
      where: { id },
      data,
      include: {
        User_SupportRequest_submittedByUserIdToUser: {
          select: { id: true, firstName: true, lastName: true, email: true, role: true },
        },
        User_SupportRequest_resolvedByUserIdToUser: {
          select: { id: true, firstName: true, lastName: true },
        },
        Organization: {
          select: { id: true, name: true },
        },
      },
    });

    res.status(200).json({
      success: true,
      data: updatedRequest
    });
  })
);

export default router;
