import { Router, Response, NextFunction } from 'express';
import { body, query, validationResult } from 'express-validator';
import asyncHandler from 'express-async-handler';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requireAdmin, requireSystemAdmin } from '../middleware/rbac';
import { prisma } from '../utils/prisma';
import { SupportRecipientRole } from '@prisma/client';
import { upload, handleMulterError } from '../middleware/upload';
import { adminStorage } from '../config/firebase-admin';
import { v4 as uuidv4 } from 'uuid';
import { websocketService } from '../services/websocketService';
import { getAccessTokenFromRequest } from '../utils/sessionCookies';

const router = Router();

const getInboxRecipientRoleForUser = (role?: string): SupportRecipientRole | null => {
  if (role === 'ADMIN') return 'ADMIN';
  if (role === 'QUALITY_CONTROL_MANAGER') return 'QUALITY_CONTROL_MANAGER';
  return null;
};

const optionalAuthenticate = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (getAccessTokenFromRequest(req)) {
    authenticate(req, res, next);
  } else {
    next();
  }
};

// Helper function to upload support attachments to Firebase Storage
async function uploadSupportAttachment(
  file: Express.Multer.File,
  organizationId: string | undefined
): Promise<{
  id: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  uploadedAt: string;
}> {
  const bucket = adminStorage.bucket();
  const fileId = uuidv4();
  const ext = file.originalname.split('.').pop() || '';
  const fileName = `${fileId}.${ext}`;
  const storagePath = `support-attachments/${organizationId || 'general'}/${fileName}`;
  
  const fileRef = bucket.file(storagePath);
  
  await fileRef.save(file.buffer, {
    metadata: {
      contentType: file.mimetype,
    },
  });
  
  // Get signed URL for the file (valid for 7 days - support requests should be handled quickly)
  const [url] = await fileRef.getSignedUrl({
    action: 'read',
    expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
  });
  
  return {
    id: fileId,
    fileName,
    originalName: file.originalname,
    mimeType: file.mimetype,
    size: file.size,
    url,
    uploadedAt: new Date().toISOString(),
  };
}

// 1. Submit a new support request (Authenticated or Unauthenticated)
router.post(
  '/',
  optionalAuthenticate,
  upload.array('attachments', 5), // Allow up to 5 attachments
  handleMulterError,
  [
    body('subject').trim().isLength({ min: 5, max: 100 }),
    body('description').optional().trim().isLength({ min: 10, max: 5000 }),
    body('message').optional().trim().isLength({ min: 1, max: 5000 }),
    body('category').optional().isIn([
      'GENERAL_INQUIRY',
      'TECHNICAL_ISSUE',
      'BILLING_QUESTION',
      'FEATURE_REQUEST',
      'BUG_REPORT',
      'ACCOUNT_ASSISTANCE',
      'OTHER',
    ]),
    body('recipientRole').optional().isIn(['ADMIN', 'QUALITY_CONTROL_MANAGER']),
    body('email').if((value, { req }) => !(req as AuthRequest).user).isEmail().normalizeEmail(),
  ],
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
    } else {
        const { subject, description, message, category, email, recipientRole } = req.body;
        const user = req.user;
        const files = req.files as Express.Multer.File[];
        
        // Use description if provided, otherwise use message
        const messageContent = description || message;
        
        if (!messageContent) {
            res.status(400).json({ message: 'Message or description is required.' });
            return;
        }

        if (!user && !email) {
            res.status(400).json({ message: 'Email is required for unauthenticated users.' });
        } else {
            if (user?.role === 'SYSTEM_ADMIN') {
              res.status(403).json({
                success: false,
                message: 'System Admin does not submit support requests. Use Support Request Management.'
              });
              return;
            }

            // Upload attachments to Firebase Storage
            let attachments = null;
            if (files && files.length > 0) {
              attachments = await Promise.all(
                files.map(file => uploadSupportAttachment(file, user?.organizationId))
              );
            }
            
            const supportRequest: any = await prisma.supportRequest.create({
              data: {
                subject,
                description: messageContent,
                category: category || 'GENERAL_INQUIRY',
                recipientRole: recipientRole || null,
                attachments: attachments as any,
                submittedByUserId: user?.id,
                submittedByUserEmail: user ? user.email : email,
                organizationId: user?.organizationId,
                status: 'OPEN',
              },
              include: {
                User_SupportRequest_submittedByUserIdToUser: {
                  select: { id: true, firstName: true, lastName: true, email: true, role: true, profilePicture: true },
                },
              },
            });

            // Emit WebSocket event to notify Admin/QC Manager about new support request
            if (user?.organizationId) {
              websocketService.emitToOrganization(user.organizationId, 'support:new-request', {
                id: supportRequest.id,
                subject: supportRequest.subject,
                description: supportRequest.description,
                category: supportRequest.category,
                recipientRole: supportRequest.recipientRole,
                status: supportRequest.status,
                createdAt: supportRequest.createdAt,
                submittedByUser: supportRequest.User_SupportRequest_submittedByUserIdToUser,
                submittedByUserEmail: supportRequest.submittedByUserEmail,
                hasAttachments: !!attachments && attachments.length > 0,
              });
              console.log(`📤 Emitted support:new-request to organization ${user.organizationId}`);
            }

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

// 3. Get support requests for Admin or QC Manager (based on recipientRole)
// Admins see requests with recipientRole='ADMIN', QC Managers see recipientRole='QUALITY_CONTROL_MANAGER'
router.get(
  '/my-inbox',
  authenticate,
  [
    query('status').optional().isIn(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ],
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const user = req.user!;
    const { status, page = '1', limit = '20' } = req.query;
    
    // Determine which role this user can receive messages for
    const recipientRole = getInboxRecipientRoleForUser(user.role);

    if (!recipientRole) {
      res.status(403).json({ 
        success: false, 
        message: 'Only Admin or QC Manager can access support inbox.' 
      });
      return;
    }
    
    // Build where clause
    const whereClause: any = {
      recipientRole,
      organizationId: user.organizationId, // Only see requests from same organization
    };
    
    if (status) {
      whereClause.status = status;
    }
    
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;
    
    const [requests, total] = await Promise.all([
      prisma.supportRequest.findMany({
        where: whereClause,
        include: {
          User_SupportRequest_submittedByUserIdToUser: {
            select: { id: true, firstName: true, lastName: true, email: true, role: true, profilePicture: true },
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
    
    // Calculate stats for this inbox
    const allInboxRequests = await prisma.supportRequest.findMany({
      where: { 
        recipientRole: recipientRole as SupportRecipientRole, 
        organizationId: user.organizationId,
      },
      select: { status: true },
    });
    
    const stats = {
      total: allInboxRequests.length,
      open: allInboxRequests.filter(r => r.status === 'OPEN').length,
      inProgress: allInboxRequests.filter(r => r.status === 'IN_PROGRESS').length,
      resolved: allInboxRequests.filter(r => r.status === 'RESOLVED').length,
      closed: allInboxRequests.filter(r => r.status === 'CLOSED').length,
    };
    
    res.status(200).json({
      success: true,
      data: requests,
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

// 4. Get user's own submitted support requests
router.get(
  '/my-requests',
  authenticate,
  [
    query('status').optional().isIn(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ],
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const user = req.user!;
    const { status, page = '1', limit = '20' } = req.query;
    
    // Build where clause
    const whereClause: any = {
      submittedByUserId: user.id,
    };
    
    if (status) {
      whereClause.status = status;
    }
    
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;
    
    const [requests, total] = await Promise.all([
      prisma.supportRequest.findMany({
        where: whereClause,
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limitNum,
      }),
      prisma.supportRequest.count({ where: whereClause }),
    ]);
    
    res.status(200).json({
      success: true,
      data: requests,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  })
);

// 5. Get a single support request (SYSTEM_ADMIN ONLY)
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

// 7. Update support request status (Admin/QC Manager responding to their inbox)
router.patch(
  '/inbox/:id',
  authenticate,
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
    
    const user = req.user!;
    const { id } = req.params;
    const { status, internalNotes } = req.body;
    
    // Determine which role this user can manage
    const recipientRole = getInboxRecipientRoleForUser(user.role);

    if (!recipientRole) {
      res.status(403).json({ 
        success: false, 
        message: 'Only Admin or QC Manager can manage support requests.' 
      });
      return;
    }
    
    const existingRequest = await prisma.supportRequest.findUnique({ where: { id } });
    
    if (!existingRequest) {
      res.status(404).json({ 
        success: false, 
        message: 'Support request not found.' 
      });
      return;
    }
    
    // Verify user can manage this request
    if (existingRequest.recipientRole !== recipientRole) {
      res.status(403).json({ 
        success: false, 
        message: 'You can only manage support requests directed to your role.' 
      });
      return;
    }
    
    // Verify same organization
    if (existingRequest.organizationId !== user.organizationId) {
      res.status(403).json({ 
        success: false, 
        message: 'You can only manage support requests from your organization.' 
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
      data.resolvedByUserId = user.id;
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
      },
    });

    // Emit WebSocket notification to the user who submitted the request
    // when status changes to IN_PROGRESS or RESOLVED
    if (status && existingRequest.submittedByUserId && 
        (status === 'IN_PROGRESS' || status === 'RESOLVED')) {
      const statusMessage = status === 'RESOLVED' 
        ? 'Your support request has been resolved!' 
        : 'Your support request is now being reviewed.';
      
      websocketService.emitToUser(existingRequest.submittedByUserId, 'support:status-changed', {
        id: updatedRequest.id,
        subject: updatedRequest.subject,
        status: status,
        previousStatus: existingRequest.status,
        message: statusMessage,
        resolvedBy: status === 'RESOLVED' ? {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
        } : null,
        updatedAt: new Date().toISOString(),
      });
      console.log(`📤 Emitted support:status-changed to user ${existingRequest.submittedByUserId} (status: ${status})`);
    }

    res.status(200).json({
      success: true,
      data: updatedRequest
    });
  })
);

// ============================================================================
// ALERT MANAGEMENT ENDPOINTS (For Admin/QC Manager persistent alert modals)
// ============================================================================

// Get pending support request alerts for the current user (Admin/QC Manager)
// Returns all OPEN support requests that this user has NOT dismissed
router.get(
  '/alerts/pending',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const user = req.user!;
    
    const recipientRole = getInboxRecipientRoleForUser(user.role);
    if (!recipientRole) {
      res.status(200).json({ data: [] });
      return;
    }
    
    // Get all dismissed alert IDs for this user
    const dismissedAlerts = await prisma.supportRequestAlertDismissal.findMany({
      where: { userId: user.id },
      select: { supportRequestId: true }
    });
    const dismissedIds = dismissedAlerts.map(d => d.supportRequestId);
    
    // Build the where clause for fetching pending alerts
    const whereClause: any = {
      organizationId: user.organizationId,
      status: 'OPEN', // Only show OPEN requests as alerts
      id: { notIn: dismissedIds },
    };
    
    // Filter by recipient role if specified
    // If recipientRole is null, show to all. Otherwise, only show to matching role
    if (recipientRole === 'QUALITY_CONTROL_MANAGER') {
      whereClause.OR = [
        { recipientRole: null },
        { recipientRole: 'QUALITY_CONTROL_MANAGER' }
      ];
    } else if (recipientRole === 'ADMIN') {
      whereClause.OR = [
        { recipientRole: null },
        { recipientRole: 'ADMIN' }
      ];
    }
    
    // Fetch pending alerts
    const pendingAlerts = await prisma.supportRequest.findMany({
      where: whereClause,
      orderBy: { createdAt: 'asc' }, // Show oldest first
      include: {
        User_SupportRequest_submittedByUserIdToUser: {
          select: { 
            id: true, 
            firstName: true, 
            lastName: true, 
            email: true, 
            role: true, 
            profilePicture: true 
          }
        }
      }
    });
    
    // Transform to match the expected format
    const transformedAlerts = pendingAlerts.map(alert => ({
      id: alert.id,
      subject: alert.subject,
      description: alert.description,
      category: alert.category,
      recipientRole: alert.recipientRole,
      status: alert.status,
      createdAt: alert.createdAt.toISOString(),
      submittedByUser: alert.User_SupportRequest_submittedByUserIdToUser,
      submittedByUserEmail: alert.submittedByUserEmail,
      hasAttachments: !!(alert.attachments && Array.isArray(alert.attachments) && (alert.attachments as any[]).length > 0)
    }));
    
    res.status(200).json({ data: transformedAlerts });
  })
);

// Dismiss a support request alert for the current user
router.post(
  '/alerts/:requestId/dismiss',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const user = req.user!;
    const { requestId } = req.params;
    const recipientRole = getInboxRecipientRoleForUser(user.role);

    if (!recipientRole) {
      res.status(403).json({
        success: false,
        message: 'Only Admin or QC Manager can dismiss support alerts.'
      });
      return;
    }
    
    // Verify the support request exists in the same organization
    const supportRequest = await prisma.supportRequest.findFirst({
      where: {
        id: requestId,
        organizationId: user.organizationId,
      }
    });
    
    if (!supportRequest) {
      res.status(404).json({ error: 'Support request not found' });
      return;
    }

    if (supportRequest.recipientRole && supportRequest.recipientRole !== recipientRole) {
      res.status(403).json({
        success: false,
        message: 'You can only dismiss alerts directed to your role.'
      });
      return;
    }
    
    // Create dismissal record (upsert to avoid duplicates)
    await prisma.supportRequestAlertDismissal.upsert({
      where: {
        supportRequestId_userId: {
          supportRequestId: requestId,
          userId: user.id
        }
      },
      update: {
        dismissedAt: new Date()
      },
      create: {
        supportRequestId: requestId,
        userId: user.id
      }
    });
    
    res.status(200).json({ success: true });
  })
);

// Dismiss all pending support request alerts for the current user
router.post(
  '/alerts/dismiss-all',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const user = req.user!;
    const recipientRole = getInboxRecipientRoleForUser(user.role);

    if (!recipientRole) {
      res.status(403).json({
        success: false,
        message: 'Only Admin or QC Manager can dismiss support alerts.'
      });
      return;
    }
    
    // Get all OPEN support requests for this organization
    const openRequests = await prisma.supportRequest.findMany({
      where: {
        organizationId: user.organizationId,
        status: 'OPEN',
        OR: [
          { recipientRole: null },
          { recipientRole }
        ]
      },
      select: { id: true }
    });
    
    // Create dismissal records for all of them
    const dismissals = openRequests.map(request => ({
      supportRequestId: request.id,
      userId: user.id
    }));
    
    // Use createMany with skipDuplicates to avoid errors on existing dismissals
    await prisma.supportRequestAlertDismissal.createMany({
      data: dismissals,
      skipDuplicates: true
    });
    
    res.status(200).json({ success: true });
  })
);

// ============================================================================
// STATUS NOTIFICATION ENDPOINTS (For users receiving status updates)
// ============================================================================

// Get pending status notifications for the current user
// Returns all status updates (IN_PROGRESS, RESOLVED) that this user has NOT dismissed
router.get(
  '/status-notifications/pending',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const user = req.user!;
    
    // Get all dismissed status notifications for this user
    const dismissedNotifications = await prisma.supportStatusNotificationDismissal.findMany({
      where: { userId: user.id },
      select: { supportRequestId: true, status: true }
    });
    
    // Create a set of "requestId:status" combinations that are dismissed
    const dismissedSet = new Set(
      dismissedNotifications.map(d => `${d.supportRequestId}:${d.status}`)
    );
    
    // Get support requests submitted by this user that have been updated
    // (status is IN_PROGRESS or RESOLVED)
    const updatedRequests = await prisma.supportRequest.findMany({
      where: {
        submittedByUserId: user.id,
        status: { in: ['IN_PROGRESS', 'RESOLVED'] }
      },
      orderBy: { updatedAt: 'desc' },
      include: {
        User_SupportRequest_resolvedByUserIdToUser: {
          select: { id: true, firstName: true, lastName: true }
        }
      }
    });
    
    // Filter out notifications that have been dismissed
    const pendingNotifications = updatedRequests
      .filter(request => !dismissedSet.has(`${request.id}:${request.status}`))
      .map(request => ({
        id: request.id,
        subject: request.subject,
        status: request.status,
        previousStatus: 'OPEN', // We don't track previous status, assume OPEN
        message: request.status === 'RESOLVED' 
          ? 'Your support request has been resolved!' 
          : 'Your support request is now being reviewed.',
        resolvedBy: request.User_SupportRequest_resolvedByUserIdToUser,
        updatedAt: request.updatedAt.toISOString()
      }));
    
    res.status(200).json({ data: pendingNotifications });
  })
);

// Dismiss a status notification for the current user
router.post(
  '/status-notifications/:requestId/dismiss',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const user = req.user!;
    const { requestId } = req.params;
    const { status } = req.body;
    
    if (!status) {
      res.status(400).json({ error: 'Status is required' });
      return;
    }
    
    // Verify the support request exists and belongs to this user
    const supportRequest = await prisma.supportRequest.findFirst({
      where: { 
        id: requestId,
        submittedByUserId: user.id
      }
    });
    
    if (!supportRequest) {
      res.status(404).json({ error: 'Support request not found' });
      return;
    }
    
    // Create dismissal record (upsert to avoid duplicates)
    await prisma.supportStatusNotificationDismissal.upsert({
      where: {
        supportRequestId_userId_status: {
          supportRequestId: requestId,
          userId: user.id,
          status: status
        }
      },
      update: {
        dismissedAt: new Date()
      },
      create: {
        supportRequestId: requestId,
        userId: user.id,
        status: status
      }
    });
    
    res.status(200).json({ success: true });
  })
);

// Dismiss all pending status notifications for the current user
router.post(
  '/status-notifications/dismiss-all',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const user = req.user!;
    
    // Get all support requests submitted by this user that have status updates
    const updatedRequests = await prisma.supportRequest.findMany({
      where: {
        submittedByUserId: user.id,
        status: { in: ['IN_PROGRESS', 'RESOLVED'] }
      },
      select: { id: true, status: true }
    });
    
    // Create dismissal records for all of them
    const dismissals = updatedRequests.map(request => ({
      supportRequestId: request.id,
      userId: user.id,
      status: request.status
    }));
    
    // Use createMany with skipDuplicates to avoid errors on existing dismissals
    await prisma.supportStatusNotificationDismissal.createMany({
      data: dismissals,
      skipDuplicates: true
    });
    
    res.status(200).json({ success: true });
  })
);

export default router;
