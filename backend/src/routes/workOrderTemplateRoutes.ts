import express, { Request, Response, Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';

const router: Router = express.Router();
const prisma = new PrismaClient();

// Async handler wrapper
const asyncHandler = (fn: (req: Request, res: Response) => Promise<void>) => {
  return (req: Request, res: Response) => {
    Promise.resolve(fn(req, res)).catch((error) => {
      console.error('Work Order Template Route Error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Internal server error',
        message: error.message 
      });
    });
  };
};

/**
 * @route   GET /api/work-order-templates
 * @desc    Get the active work order template for the organization
 * @access  Private (any authenticated user)
 */
router.get(
  '/',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthRequest;
    const organizationId = authReq.user?.organizationId;

    if (!organizationId) {
      res.status(400).json({ 
        success: false, 
        error: 'Organization ID is required' 
      });
      return;
    }

    const template = await prisma.workOrderTemplate.findFirst({
      where: {
        organizationId,
        isActive: true,
      },
      include: {
        UploadedBy: {
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
      data: {
        template,
        hasTemplate: !!template,
      },
    });
  })
);

/**
 * @route   GET /api/work-order-templates/all
 * @desc    Get all work order templates (including inactive) for admin view
 * @access  Private (ADMIN, SYSTEM_ADMIN)
 */
router.get(
  '/all',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthRequest;
    const userRole = authReq.user?.role;
    const organizationId = authReq.user?.organizationId;

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

    const templates = await prisma.workOrderTemplate.findMany({
      where: {
        organizationId,
      },
      include: {
        UploadedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: {
        uploadedAt: 'desc',
      },
    });

    res.json({
      success: true,
      data: {
        templates,
      },
    });
  })
);

/**
 * @route   POST /api/work-order-templates
 * @desc    Upload a new work order template
 * @access  Private (ADMIN, SYSTEM_ADMIN)
 */
router.post(
  '/',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthRequest;
    const userRole = authReq.user?.role;
    const userId = authReq.user?.id;
    const organizationId = authReq.user?.organizationId;

    if (!['ADMIN', 'SYSTEM_ADMIN'].includes(userRole || '')) {
      res.status(403).json({ 
        success: false, 
        error: 'Access denied. Admin privileges required.' 
      });
      return;
    }

    if (!organizationId || !userId) {
      res.status(400).json({ 
        success: false, 
        error: 'Organization ID and User ID are required' 
      });
      return;
    }

    const { name, fileName, fileUrl, fileSize, mimeType, description } = req.body;

    if (!name || !fileName || !fileUrl) {
      res.status(400).json({ 
        success: false, 
        error: 'Name, fileName, and fileUrl are required' 
      });
      return;
    }

    // Validate file type
    const allowedMimeTypes = [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
      'application/msword', // .doc
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'application/pdf', // .pdf (also allow PDF)
    ];

    if (mimeType && !allowedMimeTypes.includes(mimeType)) {
      res.status(400).json({ 
        success: false, 
        error: 'Invalid file type. Only Word documents (.doc, .docx), Excel files (.xls, .xlsx), and PDFs are allowed.' 
      });
      return;
    }

    // Deactivate any existing active templates for this organization
    await prisma.workOrderTemplate.updateMany({
      where: {
        organizationId,
        isActive: true,
      },
      data: {
        isActive: false,
      },
    });

    // Get the next version number
    const lastTemplate = await prisma.workOrderTemplate.findFirst({
      where: { organizationId },
      orderBy: { version: 'desc' },
    });
    const nextVersion = (lastTemplate?.version || 0) + 1;

    // Create the new template
    const template = await prisma.workOrderTemplate.create({
      data: {
        organizationId,
        name,
        fileName,
        fileUrl,
        fileSize: fileSize || null,
        mimeType: mimeType || null,
        description: description || null,
        version: nextVersion,
        isActive: true,
        uploadedById: userId,
      },
      include: {
        UploadedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    console.log(`Work order template uploaded: ${name} (v${nextVersion}) by user ${userId}`);

    res.status(201).json({
      success: true,
      data: {
        template,
      },
      message: 'Work order template uploaded successfully',
    });
  })
);

// ==================== WORK ORDER SETTINGS ROUTES ====================
// NOTE: These routes MUST be defined BEFORE the /:id routes to avoid path conflicts

/**
 * @route   GET /api/work-order-templates/settings
 * @desc    Get work order settings for the organization
 * @access  Private (any authenticated user)
 */
router.get(
  '/settings',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthRequest;
    const organizationId = authReq.user?.organizationId;

    if (!organizationId) {
      res.status(400).json({ 
        success: false, 
        error: 'Organization ID is required' 
      });
      return;
    }

    // Get or create default settings
    let settings = await prisma.workOrderSettings.findUnique({
      where: { organizationId },
    });

    // If no settings exist, return default values
    if (!settings) {
      settings = {
        id: '',
        organizationId,
        enableInAppForm: true,
        enableTemplateDownload: false,
        preferredOption: 'form',
        formTitle: 'Maintenance Work Order Request',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }

    res.json({
      success: true,
      data: { settings },
    });
  })
);

/**
 * @route   PUT /api/work-order-templates/settings
 * @desc    Update work order settings for the organization
 * @access  Private (ADMIN, SYSTEM_ADMIN)
 */
router.put(
  '/settings',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthRequest;
    const userRole = authReq.user?.role;
    const organizationId = authReq.user?.organizationId;

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

    const { enableInAppForm, enableTemplateDownload, preferredOption, formTitle } = req.body;

    // Upsert settings
    const settings = await prisma.workOrderSettings.upsert({
      where: { organizationId },
      update: {
        enableInAppForm: enableInAppForm !== undefined ? enableInAppForm : undefined,
        enableTemplateDownload: enableTemplateDownload !== undefined ? enableTemplateDownload : undefined,
        preferredOption: preferredOption || undefined,
        formTitle: formTitle || undefined,
      },
      create: {
        organizationId,
        enableInAppForm: enableInAppForm ?? true,
        enableTemplateDownload: enableTemplateDownload ?? false,
        preferredOption: preferredOption || 'form',
        formTitle: formTitle || 'Maintenance Work Order Request',
      },
    });

    console.log(`Work order settings updated for org: ${organizationId}`);

    res.json({
      success: true,
      data: { settings },
      message: 'Work order settings updated successfully',
    });
  })
);

/**
 * @route   PUT /api/work-order-templates/:id
 * @desc    Update a work order template
 * @access  Private (ADMIN, SYSTEM_ADMIN)
 */
router.put(
  '/:id',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthRequest;
    const userRole = authReq.user?.role;
    const organizationId = authReq.user?.organizationId;
    const templateId = req.params.id;

    if (!['ADMIN', 'SYSTEM_ADMIN'].includes(userRole || '')) {
      res.status(403).json({ 
        success: false, 
        error: 'Access denied. Admin privileges required.' 
      });
      return;
    }

    // Verify template belongs to this organization
    const existingTemplate = await prisma.workOrderTemplate.findFirst({
      where: {
        id: templateId,
        organizationId,
      },
    });

    if (!existingTemplate) {
      res.status(404).json({ 
        success: false, 
        error: 'Template not found' 
      });
      return;
    }

    const { name, description, isActive } = req.body;

    // If setting this template as active, deactivate others
    if (isActive === true) {
      await prisma.workOrderTemplate.updateMany({
        where: {
          organizationId,
          isActive: true,
          id: { not: templateId },
        },
        data: {
          isActive: false,
        },
      });
    }

    const template = await prisma.workOrderTemplate.update({
      where: { id: templateId },
      data: {
        name: name || existingTemplate.name,
        description: description !== undefined ? description : existingTemplate.description,
        isActive: isActive !== undefined ? isActive : existingTemplate.isActive,
      },
      include: {
        UploadedBy: {
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
      data: {
        template,
      },
      message: 'Work order template updated successfully',
    });
  })
);

/**
 * @route   DELETE /api/work-order-templates/:id
 * @desc    Delete a work order template
 * @access  Private (ADMIN, SYSTEM_ADMIN)
 */
router.delete(
  '/:id',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthRequest;
    const userRole = authReq.user?.role;
    const organizationId = authReq.user?.organizationId;
    const templateId = req.params.id;

    if (!['ADMIN', 'SYSTEM_ADMIN'].includes(userRole || '')) {
      res.status(403).json({ 
        success: false, 
        error: 'Access denied. Admin privileges required.' 
      });
      return;
    }

    // Verify template belongs to this organization
    const existingTemplate = await prisma.workOrderTemplate.findFirst({
      where: {
        id: templateId,
        organizationId,
      },
    });

    if (!existingTemplate) {
      res.status(404).json({ 
        success: false, 
        error: 'Template not found' 
      });
      return;
    }

    await prisma.workOrderTemplate.delete({
      where: { id: templateId },
    });

    console.log(`Work order template deleted: ${existingTemplate.name} (ID: ${templateId})`);

    res.json({
      success: true,
      message: 'Work order template deleted successfully',
    });
  })
);

export default router;
