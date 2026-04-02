import { Router, Request, Response } from 'express';
import asyncHandler from 'express-async-handler';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';
import { logAuditEvent, getClientIp } from '../services/auditService';
import crypto from 'crypto';

const router = Router();
const prisma = new PrismaClient();

// Helper to remap Prisma relation names to client-friendly names
function remapAssessment(assessment: any): any {
  if (!assessment) return assessment;
  const { WSASection, WSAPhoto, User, ...rest } = assessment;
  const result: any = { ...rest };
  if (User !== undefined) result.CreatedBy = User;
  if (WSAPhoto !== undefined) result.Photos = WSAPhoto;
  if (WSASection !== undefined) {
    result.Sections = WSASection.map((section: any) => {
      const { WSAItem, ...sectionRest } = section;
      return { ...sectionRest, Items: WSAItem ?? [] };
    });
  }
  // Remap _count fields
  if (result._count) {
    const { WSASection: secCount, WSAPhoto: photoCount, ...countRest } = result._count;
    result._count = { ...countRest };
    if (secCount !== undefined) result._count.Sections = secCount;
    if (photoCount !== undefined) result._count.Photos = photoCount;
  }
  return result;
}

// Allowed roles for workplace safety assessments
const ALLOWED_ROLES = [
  'SUPERVISOR',
  'QA_FOOD_SAFETY',
  'MAINTENANCE_ENGINEERING',
  'SAFETY_SECURITY_MANAGER',
  'CI_MANAGER',
  'ADMIN',
  'SYSTEM_ADMIN',
];

/**
 * @route   GET /api/workplace-safety
 * @desc    Get all workplace safety assessments for the user's organization
 * @access  Private (Supervisors+)
 */
router.get(
  '/',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthRequest;
    const userId = authReq.user?.id;
    const userOrgId = authReq.user?.organizationId;
    const userRole = authReq.user?.role;

    if (!userId || !userOrgId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!userRole || !ALLOWED_ROLES.includes(userRole)) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const assessments = await prisma.workplaceSafetyAssessment.findMany({
      where: { organizationId: userOrgId },
      include: {
        Department: { select: { id: true, name: true } },
        Facility: { select: { id: true, name: true } },
        User: { select: { id: true, firstName: true, lastName: true, email: true } },
        _count: {
          select: {
            WSASection: true,
            WSAPhoto: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      data: { assessments: assessments.map(remapAssessment) },
    });
  })
);

/**
 * @route   GET /api/workplace-safety/by-number/:assessmentNumber
 * @desc    Get a draft workplace safety assessment by assessment number
 * @access  Private (Supervisors+)
 */
router.get(
  '/by-number/:assessmentNumber',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthRequest;
    const { assessmentNumber } = req.params;
    const userId = authReq.user?.id;
    const userOrgId = authReq.user?.organizationId;
    const userRole = authReq.user?.role;

    if (!userId || !userOrgId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!userRole || !ALLOWED_ROLES.includes(userRole)) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    // Find assessment by assessment number - only return DRAFT status
    const assessment = await prisma.workplaceSafetyAssessment.findFirst({
      where: {
        assessmentNumber,
        organizationId: userOrgId,
        status: 'DRAFT', // Only return draft assessments for editing
      },
      include: {
        Department: { select: { id: true, name: true } },
        Facility: { select: { id: true, name: true } },
        User: { select: { id: true, firstName: true, lastName: true, email: true } },
        WSASection: {
          include: {
            WSAItem: {
              orderBy: { sortOrder: 'asc' },
            },
          },
          orderBy: { sortOrder: 'asc' },
        },
        WSAPhoto: {
          orderBy: { uploadedAt: 'desc' },
        },
      },
    });

    if (!assessment) {
      // Check if assessment exists but is not a draft (submitted)
      const existingSubmitted = await prisma.workplaceSafetyAssessment.findFirst({
        where: {
          assessmentNumber,
          organizationId: userOrgId,
          status: { not: 'DRAFT' },
        },
        select: { status: true },
      });

      if (existingSubmitted) {
        res.status(400).json({ 
          error: 'Assessment already submitted',
          details: `Assessment ${assessmentNumber} has been submitted and cannot be edited. Status: ${existingSubmitted.status}`,
          status: existingSubmitted.status,
        });
        return;
      }

      // No assessment found - this is OK, user can create new
      res.status(404).json({ 
        error: 'Assessment not found',
        details: 'No draft assessment found with this number',
      });
      return;
    }

    // Calculate completion statistics
    const allItems = assessment.WSASection.flatMap(s => s.WSAItem);
    const totalItems = allItems.length;
    const completedItems = allItems.filter(item => item.status !== null).length;
    const pendingItems = allItems.filter(item => item.status === null);
    const unacceptableItems = allItems.filter(item => item.status === 'U');
    
    // Get missing sections info
    const incompleteSections = assessment.WSASection.filter(section => 
      section.WSAItem.some(item => item.status === null)
    ).map(section => ({
      id: section.sectionId,
      title: section.title,
      totalItems: section.WSAItem.length,
      completedItems: section.WSAItem.filter(item => item.status !== null).length,
      pendingItemIds: section.WSAItem.filter(item => item.status === null).map(item => item.itemId),
    }));

    res.json({
      success: true,
      data: { 
        assessment: remapAssessment(assessment),
        completionStats: {
          totalItems,
          completedItems,
          pendingItems: pendingItems.length,
          completionPercentage: totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0,
          incompleteSections,
          unacceptableCount: unacceptableItems.length,
        },
      },
    });
  })
);

/**
 * @route   GET /api/workplace-safety/view/:assessmentNumber
 * @desc    Get any workplace safety assessment by number for viewing (any status)
 * @access  Private (Supervisors+)
 */
router.get(
  '/view/:assessmentNumber',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthRequest;
    const { assessmentNumber } = req.params;
    const userId = authReq.user?.id;
    const userOrgId = authReq.user?.organizationId;
    const userRole = authReq.user?.role;

    if (!userId || !userOrgId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!userRole || !ALLOWED_ROLES.includes(userRole)) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    // Find assessment by assessment number - any status for viewing
    const assessment = await prisma.workplaceSafetyAssessment.findFirst({
      where: {
        assessmentNumber,
        organizationId: userOrgId,
      },
      include: {
        Department: { select: { id: true, name: true } },
        Facility: { select: { id: true, name: true } },
        Organization: { select: { id: true, name: true } },
        User: { select: { id: true, firstName: true, lastName: true, email: true } },
        WSASection: {
          include: {
            WSAItem: {
              orderBy: { sortOrder: 'asc' },
            },
          },
          orderBy: { sortOrder: 'asc' },
        },
        WSAPhoto: {
          orderBy: { uploadedAt: 'desc' },
        },
      },
    });

    if (!assessment) {
      res.status(404).json({ 
        error: 'Assessment not found',
        details: 'No assessment found with this number',
      });
      return;
    }

    // Map photos to their respective items
    const photosMap = new Map<string, any[]>();
    assessment.WSAPhoto.forEach((photo: any) => {
      if (photo.itemId) {
        if (!photosMap.has(photo.itemId)) {
          photosMap.set(photo.itemId, []);
        }
        photosMap.get(photo.itemId)!.push(photo);
      }
    });

    // Attach photos to items
    const sectionsWithPhotos = assessment.WSASection.map((section: any) => {
      const { WSAItem, ...sectionRest } = section;
      return {
        ...sectionRest,
        Items: (WSAItem ?? []).map((item: any) => ({
          ...item,
          Photos: photosMap.get(item.itemId) || [],
        })),
      };
    });

    const { WSASection: _s, WSAPhoto: _p, User: _u, ...assessmentRest } = assessment as any;
    res.json({
      success: true,
      data: { 
        assessment: {
          ...assessmentRest,
          CreatedBy: _u,
          Sections: sectionsWithPhotos,
          Photos: _p,
        },
      },
    });
  })
);

/**
 * @route   GET /api/workplace-safety/:id
 * @desc    Get a single workplace safety assessment by ID
 * @access  Private (Supervisors+)
 */
router.get(
  '/:id',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthRequest;
    const { id } = req.params;
    const userId = authReq.user?.id;
    const userOrgId = authReq.user?.organizationId;
    const userRole = authReq.user?.role;

    if (!userId || !userOrgId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!userRole || !ALLOWED_ROLES.includes(userRole)) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const assessment = await prisma.workplaceSafetyAssessment.findFirst({
      where: {
        id,
        organizationId: userOrgId,
      },
      include: {
        Department: { select: { id: true, name: true } },
        Facility: { select: { id: true, name: true } },
        User: { select: { id: true, firstName: true, lastName: true, email: true } },
        WSASection: {
          include: {
            WSAItem: {
              orderBy: { sortOrder: 'asc' },
            },
          },
          orderBy: { sortOrder: 'asc' },
        },
        WSAPhoto: {
          orderBy: { uploadedAt: 'desc' },
        },
      },
    });

    if (!assessment) {
      res.status(404).json({ error: 'Assessment not found' });
      return;
    }

    res.json({
      success: true,
      data: { assessment: remapAssessment(assessment) },
    });
  })
);

/**
 * @route   POST /api/workplace-safety
 * @desc    Create a new workplace safety assessment (Save Draft)
 * @access  Private (Supervisors+)
 */
router.post(
  '/',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthRequest;
    const userId = authReq.user?.id;
    const userOrgId = authReq.user?.organizationId;
    const userRole = authReq.user?.role;

    console.log('📝 POST /workplace-safety - Creating/Updating assessment');
    console.log('📝 User:', { userId, userOrgId, userRole });
    console.log('📝 Request body:', JSON.stringify(req.body, null, 2));

    if (!userId || !userOrgId) {
      console.log('❌ Unauthorized - missing userId or userOrgId');
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!userRole || !ALLOWED_ROLES.includes(userRole)) {
      console.log('❌ Access denied - role not allowed:', userRole);
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const {
      assessmentNumber,
      version,
      date,
      department,
      departmentId,
      teamLeaderName,
      teamLeaderSignature,
      employeeName,
      employeeSignature,
      operationManagerName,
      operationManagerSignature,
      plantManagerName,
      plantManagerSignature,
      safetyManagerName,
      safetyManagerSignature,
      facilityId,
      sections,
    } = req.body;

    // Validate required fields
    if (!assessmentNumber || !date || !teamLeaderName) {
      console.log('❌ Missing required fields:', { assessmentNumber, date, teamLeaderName });
      res.status(400).json({ 
        error: 'Missing required fields',
        details: 'assessmentNumber, date, and teamLeaderName are required',
      });
      return;
    }

    console.log('✅ Required fields validated');

    // Sanitize optional foreign key fields - convert empty strings to null
    const sanitizedDepartmentId = departmentId && departmentId.trim() !== '' ? departmentId : null;
    let sanitizedFacilityId = facilityId && facilityId.trim() !== '' ? facilityId : null;

    // If no facilityId provided, try to get the user's facility from the organization
    if (!sanitizedFacilityId && userOrgId) {
      const userFacility = await prisma.facility.findFirst({
        where: { organizationId: userOrgId },
        select: { id: true },
      });
      if (userFacility) {
        sanitizedFacilityId = userFacility.id;
      }
    }

    // Check if assessment number already exists
    const existing = await prisma.workplaceSafetyAssessment.findUnique({
      where: { assessmentNumber },
      include: {
        WSASection: true,
      },
    });

    // If this is a NEW assessment (not updating an existing one), enforce one-per-month-per-user
    if (!existing) {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

      const existingThisMonth = await prisma.workplaceSafetyAssessment.findFirst({
        where: {
          createdById: userId,
          organizationId: userOrgId,
          createdAt: {
            gte: monthStart,
            lt: monthEnd,
          },
        },
        select: { id: true, assessmentNumber: true },
      });

      if (existingThisMonth) {
        res.status(409).json({
          error: 'Monthly assessment limit reached',
          details: `You have already created assessment ${existingThisMonth.assessmentNumber} for this month. Only one assessment per user per month is allowed.`,
          existingAssessmentNumber: existingThisMonth.assessmentNumber,
        });
        return;
      }
    }

    // If exists and is DRAFT, update it instead of creating new
    if (existing) {
      if (existing.status !== 'DRAFT') {
        res.status(400).json({ 
          error: 'Assessment already submitted',
          details: `Assessment ${assessmentNumber} has been submitted and cannot be modified. Status: ${existing.status}`,
        });
        return;
      }

      // Update existing draft assessment
      const updatedAssessment = await prisma.$transaction(async (tx) => {
        // Delete existing sections and items
        await tx.wSASection.deleteMany({
          where: { assessmentId: existing.id },
        });

        // Update the assessment
        const updated = await tx.workplaceSafetyAssessment.update({
          where: { id: existing.id },
          data: {
            version: version || '3/19/25',
            date: new Date(date),
            department,
            departmentId: sanitizedDepartmentId,
            teamLeaderName,
            teamLeaderSignature,
            employeeName,
            employeeSignature,
            operationManagerName,
            operationManagerSignature,
            plantManagerName,
            plantManagerSignature,
            safetyManagerName,
            safetyManagerSignature,
            facilityId: sanitizedFacilityId,
            WSASection: sections ? {
              create: sections.map((section: any, sectionIndex: number) => ({
                id: crypto.randomUUID(),
                sectionId: section.id,
                title: section.title,
                sortOrder: sectionIndex,
                WSAItem: {
                  create: section.items.map((item: any, itemIndex: number) => ({
                    id: crypto.randomUUID(),
                    itemId: item.id,
                    description: item.description,
                    status: item.status,
                    deficiency: item.deficiency,
                    correctiveAction: item.correctiveAction,
                    dynamicEntries: item.dynamicEntries || null,
                    workOrderPlaced: item.workOrderPlaced || false,
                    reportedViaSafetyApp: item.reportedViaSafetyApp || false,
                    safetyAppReportDate: item.safetyAppReportDate ? new Date(item.safetyAppReportDate) : null,
                    workOrderDateCreated: item.workOrderDateCreated ? new Date(item.workOrderDateCreated) : null,
                    workOrderAssignedTo: item.workOrderAssignedTo || null,
                    workOrderAttachment: item.workOrderAttachment || null,
                    sortOrder: itemIndex,
                  })),
                },
              })),
            } : undefined,
          },
          include: {
            WSASection: {
              include: {
                WSAItem: true,
              },
            },
          },
        });

        return updated;
      });

      // Audit log
      await logAuditEvent({
        action: 'UPDATE',
        entity: 'WorkplaceSafetyAssessment',
        entityId: existing.id,
        userId,
        organizationId: userOrgId,
        changes: { assessmentNumber, action: 'Draft auto-updated' },
        ipAddress: getClientIp(authReq),
        userAgent: req.headers['user-agent'] as string,
      });

      console.log('✅ Draft assessment UPDATED:', updatedAssessment.id);
      res.json({
        success: true,
        data: { assessment: remapAssessment(updatedAssessment) },
        message: 'Draft assessment updated',
        isUpdate: true,
      });
      return;
    }

    console.log('📝 Creating NEW assessment... [v3-uuid-fix]');
    // Create the assessment with sections and items
    const assessmentId = crypto.randomUUID();
    const assessment = await prisma.workplaceSafetyAssessment.create({
      data: {
        id: assessmentId,
        assessmentNumber,
        version: version || '3/19/25',
        date: new Date(date),
        department,
        departmentId: sanitizedDepartmentId,
        teamLeaderName,
        teamLeaderSignature,
        employeeName,
        employeeSignature,
        operationManagerName,
        operationManagerSignature,
        plantManagerName,
        plantManagerSignature,
        safetyManagerName,
        safetyManagerSignature,
        status: 'DRAFT',
        organizationId: userOrgId,
        facilityId: sanitizedFacilityId,
        createdById: userId,
        updatedAt: new Date(),
        WSASection: sections ? {
          create: sections.map((section: any, sectionIndex: number) => ({
            id: crypto.randomUUID(),
            sectionId: section.id,
            title: section.title,
            sortOrder: sectionIndex,
            WSAItem: {
              create: section.items.map((item: any, itemIndex: number) => ({
                id: crypto.randomUUID(),
                itemId: item.id,
                description: item.description,
                status: item.status,
                deficiency: item.deficiency,
                correctiveAction: item.correctiveAction,
                dynamicEntries: item.dynamicEntries || null,
                workOrderPlaced: item.workOrderPlaced || false,
                reportedViaSafetyApp: item.reportedViaSafetyApp || false,
                safetyAppReportDate: item.safetyAppReportDate ? new Date(item.safetyAppReportDate) : null,
                workOrderDateCreated: item.workOrderDateCreated ? new Date(item.workOrderDateCreated) : null,
                workOrderAssignedTo: item.workOrderAssignedTo || null,
                workOrderAttachment: item.workOrderAttachment || null,
                sortOrder: itemIndex,
              })),
            },
          })),
        } : undefined,
      },
      include: {
        WSASection: {
          include: {
            WSAItem: true,
          },
        },
      },
    });

    // Audit log
    await logAuditEvent({
      action: 'CREATE',
      entity: 'WorkplaceSafetyAssessment',
      entityId: assessment.id,
      userId,
      organizationId: userOrgId,
      changes: { assessmentNumber, status: 'DRAFT' },
      ipAddress: getClientIp(authReq),
      userAgent: req.headers['user-agent'] as string,
    });

    console.log('✅ NEW assessment CREATED:', assessment.id);
    res.status(201).json({
      success: true,
      data: { assessment: remapAssessment(assessment) },
      message: 'Assessment saved as draft',
    });
  })
);

/**
 * @route   PUT /api/workplace-safety/:id
 * @desc    Update an existing workplace safety assessment
 * @access  Private (Supervisors+)
 */
router.put(
  '/:id',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthRequest;
    const { id } = req.params;
    const userId = authReq.user?.id;
    const userOrgId = authReq.user?.organizationId;
    const userRole = authReq.user?.role;

    if (!userId || !userOrgId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!userRole || !ALLOWED_ROLES.includes(userRole)) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    // Check if assessment exists and belongs to the organization
    const existing = await prisma.workplaceSafetyAssessment.findFirst({
      where: {
        id,
        organizationId: userOrgId,
      },
    });

    if (!existing) {
      res.status(404).json({ error: 'Assessment not found' });
      return;
    }

    // Only allow updates to DRAFT assessments
    if (existing.status !== 'DRAFT') {
      res.status(400).json({ 
        error: 'Cannot update',
        details: 'Only draft assessments can be updated',
      });
      return;
    }

    const {
      department,
      departmentId,
      teamLeaderName,
      teamLeaderSignature,
      employeeName,
      employeeSignature,
      operationManagerName,
      operationManagerSignature,
      plantManagerName,
      plantManagerSignature,
      safetyManagerName,
      safetyManagerSignature,
      facilityId,
      sections,
    } = req.body;

    // Sanitize optional foreign key fields - convert empty strings to null
    const sanitizedDepartmentId = departmentId && departmentId.trim() !== '' ? departmentId : null;
    let sanitizedFacilityId = facilityId && facilityId.trim() !== '' ? facilityId : null;

    // If no facilityId provided, try to get the user's facility from the organization
    if (!sanitizedFacilityId && userOrgId) {
      const userFacility = await prisma.facility.findFirst({
        where: { organizationId: userOrgId },
        select: { id: true },
      });
      if (userFacility) {
        sanitizedFacilityId = userFacility.id;
      }
    }

    // Update assessment
    const assessment = await prisma.$transaction(async (tx) => {
      // Delete existing sections and items
      await tx.wSASection.deleteMany({
        where: { assessmentId: id },
      });

      // Update the assessment
      const updated = await tx.workplaceSafetyAssessment.update({
        where: { id },
        data: {
          department,
          departmentId: sanitizedDepartmentId,
          teamLeaderName,
          teamLeaderSignature,
          employeeName,
          employeeSignature,
          operationManagerName,
          operationManagerSignature,
          plantManagerName,
          plantManagerSignature,
          safetyManagerName,
          safetyManagerSignature,
          facilityId: sanitizedFacilityId,
          WSASection: sections ? {
            create: sections.map((section: any, sectionIndex: number) => ({
              id: crypto.randomUUID(),
              sectionId: section.id,
              title: section.title,
              sortOrder: sectionIndex,
              WSAItem: {
                create: section.items.map((item: any, itemIndex: number) => ({
                  id: crypto.randomUUID(),
                  itemId: item.id,
                  description: item.description,
                  status: item.status,
                  deficiency: item.deficiency,
                  correctiveAction: item.correctiveAction,
                  dynamicEntries: item.dynamicEntries || null,
                  workOrderPlaced: item.workOrderPlaced || false,
                  reportedViaSafetyApp: item.reportedViaSafetyApp || false,
                  safetyAppReportDate: item.safetyAppReportDate ? new Date(item.safetyAppReportDate) : null,
                  workOrderDateCreated: item.workOrderDateCreated ? new Date(item.workOrderDateCreated) : null,
                  workOrderAssignedTo: item.workOrderAssignedTo || null,
                  workOrderAttachment: item.workOrderAttachment || null,
                  sortOrder: itemIndex,
                })),
              },
            })),
          } : undefined,
        },
        include: {
          WSASection: {
            include: {
              WSAItem: true,
            },
          },
        },
      });

      return updated;
    });

    // Audit log
    await logAuditEvent({
      action: 'UPDATE',
      entity: 'WorkplaceSafetyAssessment',
      entityId: id,
      userId,
      organizationId: userOrgId,
      changes: { action: 'Draft updated' },
      ipAddress: getClientIp(authReq),
      userAgent: req.headers['user-agent'] as string,
    });

    res.json({
      success: true,
      data: { assessment: remapAssessment(assessment) },
      message: 'Assessment updated',
    });
  })
);

/**
 * @route   PATCH /api/workplace-safety/:id/signature
 * @desc    Update a signature on an assessment
 * @access  Private (Supervisors+)
 */
router.patch(
  '/:id/signature',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthRequest;
    const { id } = req.params;
    const userId = authReq.user?.id;
    const userOrgId = authReq.user?.organizationId;
    const userRole = authReq.user?.role;

    if (!userId || !userOrgId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!userRole || !ALLOWED_ROLES.includes(userRole)) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const { signatureType, signatureUrl, signerName } = req.body;

    // Validate signature type
    const validTypes = [
      'teamLeader',
      'employee',
      'operationManager',
      'plantManager',
      'safetyManager',
    ];

    if (!signatureType || !validTypes.includes(signatureType)) {
      res.status(400).json({ 
        error: 'Invalid signature type',
        details: `signatureType must be one of: ${validTypes.join(', ')}`,
      });
      return;
    }

    // Check if assessment exists
    const existing = await prisma.workplaceSafetyAssessment.findFirst({
      where: {
        id,
        organizationId: userOrgId,
      },
    });

    if (!existing) {
      res.status(404).json({ error: 'Assessment not found' });
      return;
    }

    // Build update data based on signature type
    const updateData: any = {};
    updateData[`${signatureType}Signature`] = signatureUrl;
    if (signerName) {
      updateData[`${signatureType}Name`] = signerName;
    }

    const assessment = await prisma.workplaceSafetyAssessment.update({
      where: { id },
      data: updateData,
    });

    // Audit log
    await logAuditEvent({
      action: 'UPDATE',
      entity: 'WorkplaceSafetyAssessment',
      entityId: id,
      userId,
      organizationId: userOrgId,
      changes: { signatureType, action: 'Signature added' },
      ipAddress: getClientIp(authReq),
      userAgent: req.headers['user-agent'] as string,
    });

    res.json({
      success: true,
      data: { assessment },
      message: `${signatureType} signature saved`,
    });
  })
);

/**
 * @route   POST /api/workplace-safety/:id/photos
 * @desc    Add a photo to an assessment (Firebase URL)
 * @access  Private (Supervisors+)
 */
router.post(
  '/:id/photos',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthRequest;
    const { id } = req.params;
    const userId = authReq.user?.id;
    const userOrgId = authReq.user?.organizationId;
    const userRole = authReq.user?.role;

    if (!userId || !userOrgId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!userRole || !ALLOWED_ROLES.includes(userRole)) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const { fileName, fileUrl, fileSize, mimeType, caption, itemId, sectionId } = req.body;

    if (!fileName || !fileUrl) {
      res.status(400).json({ 
        error: 'Missing required fields',
        details: 'fileName and fileUrl are required',
      });
      return;
    }

    // Check if assessment exists
    const existing = await prisma.workplaceSafetyAssessment.findFirst({
      where: {
        id,
        organizationId: userOrgId,
      },
    });

    if (!existing) {
      res.status(404).json({ error: 'Assessment not found' });
      return;
    }

    const photo = await prisma.wSAPhoto.create({
      data: {
        id: crypto.randomUUID(),
        assessmentId: id,
        itemId,
        sectionId,
        fileName,
        fileUrl,
        fileSize,
        mimeType,
        caption,
      },
    });

    res.status(201).json({
      success: true,
      data: { photo },
      message: 'Photo added to assessment',
    });
  })
);

/**
 * @route   DELETE /api/workplace-safety/:id/photos/:photoId
 * @desc    Remove a photo from an assessment
 * @access  Private (Supervisors+)
 */
router.delete(
  '/:id/photos/:photoId',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthRequest;
    const { id, photoId } = req.params;
    const userId = authReq.user?.id;
    const userOrgId = authReq.user?.organizationId;
    const userRole = authReq.user?.role;

    if (!userId || !userOrgId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!userRole || !ALLOWED_ROLES.includes(userRole)) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    // Check if photo exists and belongs to the assessment
    const photo = await prisma.wSAPhoto.findFirst({
      where: {
        id: photoId,
        assessmentId: id,
        WorkplaceSafetyAssessment: {
          organizationId: userOrgId,
        },
      },
    });

    if (!photo) {
      res.status(404).json({ error: 'Photo not found' });
      return;
    }

    await prisma.wSAPhoto.delete({
      where: { id: photoId },
    });

    res.json({
      success: true,
      message: 'Photo removed',
    });
  })
);

/**
 * @route   POST /api/workplace-safety/:id/submit
 * @desc    Submit a workplace safety assessment
 * @access  Private (Supervisors+)
 */
router.post(
  '/:id/submit',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthRequest;
    const { id } = req.params;
    const userId = authReq.user?.id;
    const userOrgId = authReq.user?.organizationId;
    const userRole = authReq.user?.role;

    if (!userId || !userOrgId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!userRole || !ALLOWED_ROLES.includes(userRole)) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    // Check if assessment exists
    const existing = await prisma.workplaceSafetyAssessment.findFirst({
      where: {
        id,
        organizationId: userOrgId,
      },
      include: {
        WSASection: {
          include: {
            WSAItem: true,
          },
        },
      },
    });

    if (!existing) {
      res.status(404).json({ error: 'Assessment not found' });
      return;
    }

    if (existing.status !== 'DRAFT') {
      res.status(400).json({ 
        error: 'Cannot submit',
        details: 'Assessment has already been submitted',
      });
      return;
    }

    // Check if all items have been assessed
    const allItems = existing.WSASection.flatMap(s => s.WSAItem);
    const pendingItems = allItems.filter(item => !item.status);

    if (pendingItems.length > 0) {
      res.status(400).json({ 
        error: 'Incomplete assessment',
        details: `${pendingItems.length} items have not been assessed`,
      });
      return;
    }

    // Get signature URLs and timestamps from request body
    const { employeeSignatureUrl, teamLeaderSignatureUrl, employeeSignedAt, teamLeaderSignedAt } = req.body;

    const assessment = await prisma.workplaceSafetyAssessment.update({
      where: { id },
      data: {
        status: 'SUBMITTED',
        submittedAt: new Date(),
        ...(employeeSignatureUrl && { employeeSignature: employeeSignatureUrl }),
        ...(teamLeaderSignatureUrl && { teamLeaderSignature: teamLeaderSignatureUrl }),
      },
    });

    // Audit log
    await logAuditEvent({
      action: 'UPDATE',
      entity: 'WorkplaceSafetyAssessment',
      entityId: id,
      userId,
      organizationId: userOrgId,
      changes: { 
        status: 'SUBMITTED', 
        action: 'Assessment submitted',
        employeeSignature: employeeSignatureUrl ? 'provided' : 'not provided',
        teamLeaderSignature: teamLeaderSignatureUrl ? 'provided' : 'not provided',
        employeeSignedAt: employeeSignedAt || null,
        teamLeaderSignedAt: teamLeaderSignedAt || null,
      },
      ipAddress: getClientIp(authReq),
      userAgent: req.headers['user-agent'] as string,
    });

    res.json({
      success: true,
      data: { assessment },
      message: 'Assessment submitted successfully',
    });
  })
);

/**
 * @route   POST /api/workplace-safety/:id/edit
 * @desc    Revert a submitted assessment back to DRAFT for editing
 * @access  Private (Supervisors+)
 */
router.post(
  '/:id/edit',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthRequest;
    const { id } = req.params;
    const userId = authReq.user?.id;
    const userOrgId = authReq.user?.organizationId;
    const userRole = authReq.user?.role;

    if (!userId || !userOrgId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!userRole || !ALLOWED_ROLES.includes(userRole)) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const existing = await prisma.workplaceSafetyAssessment.findFirst({
      where: {
        id,
        organizationId: userOrgId,
      },
    });

    if (!existing) {
      res.status(404).json({ error: 'Assessment not found' });
      return;
    }

    if (existing.status === 'DRAFT') {
      res.status(400).json({
        error: 'Already a draft',
        details: 'Assessment is already in draft status',
      });
      return;
    }

    const assessment = await prisma.workplaceSafetyAssessment.update({
      where: { id },
      data: {
        status: 'DRAFT',
        submittedAt: null,
      },
      include: {
        WSASection: {
          include: {
            WSAItem: true,
          },
        },
        Department: true,
        User: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });

    await logAuditEvent({
      action: 'UPDATE',
      entity: 'WorkplaceSafetyAssessment',
      entityId: id,
      userId,
      organizationId: userOrgId,
      changes: { status: 'DRAFT', action: 'Assessment reverted to draft for editing' },
      ipAddress: getClientIp(authReq),
      userAgent: req.headers['user-agent'] as string,
    });

    res.json({
      success: true,
      data: { assessment: remapAssessment(assessment) },
      message: 'Assessment reverted to draft for editing',
    });
  })
);

/**
 * @route   DELETE /api/workplace-safety/:id
 * @desc    Permanently delete an assessment (requires confirmation)
 * @access  Private (Supervisors+)
 */
router.delete(
  '/:id',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthRequest;
    const { id } = req.params;
    const userId = authReq.user?.id;
    const userOrgId = authReq.user?.organizationId;
    const userRole = authReq.user?.role;

    if (!userId || !userOrgId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!userRole || !ALLOWED_ROLES.includes(userRole)) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    // confirmNumber must match the assessment number to prevent accidental deletion
    // Accept from both query params and body for flexibility
    const confirmNumber = (req.query.confirmNumber as string) || req.body?.confirmNumber;

    const existing = await prisma.workplaceSafetyAssessment.findFirst({
      where: {
        id,
        organizationId: userOrgId,
      },
      include: {
        WSASection: {
          include: { WSAItem: true },
        },
        WSAPhoto: true,
      },
    });

    if (!existing) {
      res.status(404).json({ error: 'Assessment not found' });
      return;
    }

    // Require matching assessment number for confirmation
    if (!confirmNumber || confirmNumber !== existing.assessmentNumber) {
      res.status(400).json({
        error: 'Confirmation required',
        details: 'You must provide the correct assessment number to confirm deletion.',
      });
      return;
    }

    // Cascade delete handles WSASection, WSAItem, WSAPhoto, and WorkOrder automatically
    await prisma.workplaceSafetyAssessment.delete({
      where: { id },
    });

    const totalItems = existing.WSASection.reduce((sum: number, s: any) => sum + (s.WSAItem?.length || 0), 0);

    // Audit log
    await logAuditEvent({
      action: 'DELETE',
      entity: 'WorkplaceSafetyAssessment',
      entityId: id,
      userId,
      organizationId: userOrgId,
      changes: {
        assessmentNumber: existing.assessmentNumber,
        status: existing.status,
        sectionCount: existing.WSASection.length,
        itemCount: totalItems,
        photoCount: existing.WSAPhoto.length,
      },
      ipAddress: getClientIp(authReq),
      userAgent: req.headers['user-agent'] as string,
    });

    res.json({
      success: true,
      message: 'Assessment permanently deleted',
    });
  })
);

/**
 * @route   POST /api/workplace-safety/enhance-text
 * @desc    Enhance deficiency or corrective action text using AI
 * @access  Private (Supervisors+)
 */
router.post(
  '/enhance-text',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthRequest;
    const userId = authReq.user?.id;
    const userRole = authReq.user?.role;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!userRole || !ALLOWED_ROLES.includes(userRole)) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const { text, fieldContext, sectionTitle, itemDescription } = req.body;

    if (!text || typeof text !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Text is required',
      });
      return;
    }

    if (text.trim().length < 5) {
      res.status(400).json({
        success: false,
        error: 'Please enter at least 5 characters before using AI enhancement',
      });
      return;
    }

    try {
      // Import the enhance function dynamically
      const { enhanceWorkplaceSafetyText } = await import('../services/aiService');
      
      const result = await enhanceWorkplaceSafetyText(text, fieldContext, sectionTitle, itemDescription);

      res.json({
        success: !result.error,
        data: {
          originalText: text,
          enhancedText: result.enhancedText,
          changes: result.changes,
          wasEnhanced: result.enhancedText !== text,
        },
        message: result.error ? 'AI enhancement unavailable' : 'Text enhanced successfully',
      });
    } catch (error: any) {
      console.error('AI Enhancement error:', error);
      res.status(500).json({
        success: false,
        error: 'AI enhancement failed',
        details: error.message,
      });
    }
  })
);

export default router;
