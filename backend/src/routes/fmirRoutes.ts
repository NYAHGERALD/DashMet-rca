import { Router, Request, Response, NextFunction } from 'express';
import asyncHandler from 'express-async-handler';
import { PrismaClient, FMIRStatus } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { websocketService } from '../services/websocketService';
import { validateFMIRForLocking, analyzeFMIRCompliance, explainRegulation, generateFMIRSuccessAudit } from '../services/aiService';
import { adminStorage } from '../config/firebase-admin';

const router = Router();
const prisma = new PrismaClient();

// Configure multer for file uploads - use memory storage for Firebase upload
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'video/mp4',
      'video/webm',
      'video/quicktime',
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} not allowed`));
    }
  },
});

// Get all QA/Food Safety users in an organization
async function getQAFoodSafetyUsers(organizationId: string): Promise<string[]> {
  const qaUsers = await prisma.user.findMany({
    where: {
      organizationId,
      role: 'QA_FOOD_SAFETY',
      isActive: true,
    },
    select: { id: true },
  });
  return qaUsers.map(u => u.id);
}

// Generate unique FMIR report number
// Format: FMIR-{FACILITY}-0001-{YEAR}
async function generateReportNumber(organizationId: string, facilityId?: string): Promise<string> {
  const today = new Date();
  const year = today.getFullYear();
  
  // Get facility abbreviation
  let facilityAbbr = 'GEN'; // Default if no facility
  if (facilityId) {
    const facility = await prisma.facility.findUnique({
      where: { id: facilityId },
      select: { name: true },
    });
    if (facility?.name) {
      // Create abbreviation from facility name (uppercase, remove spaces/special chars, max 10 chars)
      facilityAbbr = facility.name
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .substring(0, 10);
    }
  }
  
  const prefix = `FMIR-${facilityAbbr}`;
  
  // Count existing reports for this facility and year
  const count = await prisma.foreignMaterialIncident.count({
    where: {
      organizationId,
      reportNumber: {
        startsWith: prefix,
        endsWith: `-${year}`,
      },
    },
  });
  
  return `${prefix}-${String(count + 1).padStart(4, '0')}-${year}`;
}

/**
 * @route   GET /api/fmir/organization-users
 * @desc    Get all users in the organization for collaborator selection (excludes QA/Food Safety - they are auto-added)
 * @access  Private
 */
router.get(
  '/organization-users',
  authenticate,
  asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthRequest;
    const userId = authReq.user?.id;
    const userOrgId = authReq.user?.organizationId;

    if (!userId || !userOrgId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Exclude QA_FOOD_SAFETY users - they are automatically added to all FMIR reports
    const users = await prisma.user.findMany({
      where: {
        organizationId: userOrgId,
        isActive: true,
        role: {
          not: 'QA_FOOD_SAFETY',
        },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        profilePicture: true,
        role: true,
      },
      orderBy: [
        { firstName: 'asc' },
        { lastName: 'asc' },
      ],
    });

    res.json({
      success: true,
      data: users,
    });
  })
);

/**
 * @route   GET /api/fmir/qa-users
 * @desc    Get all QA/Food Safety users in the organization (for display purposes)
 * @access  Private
 */
router.get(
  '/qa-users',
  authenticate,
  asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthRequest;
    const userId = authReq.user?.id;
    const userOrgId = authReq.user?.organizationId;

    if (!userId || !userOrgId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const qaUsers = await prisma.user.findMany({
      where: {
        organizationId: userOrgId,
        isActive: true,
        role: 'QA_FOOD_SAFETY',
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        profilePicture: true,
        role: true,
      },
      orderBy: [
        { firstName: 'asc' },
        { lastName: 'asc' },
      ],
    });

    res.json({
      success: true,
      data: qaUsers,
    });
  })
);

/**
 * @route   GET /api/fmir
 * @desc    Get all FMIR reports for the organization (visible to user)
 * @access  Private
 */
router.get(
  '/',
  authenticate,
  asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthRequest;
    const userId = authReq.user?.id;
    const userOrgId = authReq.user?.organizationId;

    if (!userId || !userOrgId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { status, search, page = '1', limit = '20' } = req.query;
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    // User can see reports they created OR are a collaborator on (but only if visible)
    // Owners always see their own reports regardless of visibility
    const where: any = {
      organizationId: userOrgId,
      OR: [
        // Owner always sees their reports (regardless of visibility)
        { createdById: userId },
        // Collaborators only see reports that are visible
        { 
          AND: [
            { collaboratorIds: { has: userId } },
            { isVisible: true },
          ],
        },
      ],
    };

    if (status) {
      // Validate status is a valid FMIRStatus enum value
      const validStatuses: FMIRStatus[] = ['DRAFT', 'SUBMITTED', 'UNDER_INVESTIGATION', 'RESOLVED', 'CLOSED'];
      if (validStatuses.includes(status as FMIRStatus)) {
        where.AND = where.AND || [];
        where.AND.push({ status: status as FMIRStatus });
      }
    }

    if (search) {
      where.AND = where.AND || [];
      where.AND.push({
        OR: [
          { reportNumber: { contains: search as string, mode: 'insensitive' } },
          { productName: { contains: search as string, mode: 'insensitive' } },
          { foreignMaterialDescription: { contains: search as string, mode: 'insensitive' } },
          { individualsInvolved: { contains: search as string, mode: 'insensitive' } },
        ],
      });
    }

    const [reports, total] = await Promise.all([
      prisma.foreignMaterialIncident.findMany({
        where,
        include: {
          Facility: true,
          User_ForeignMaterialIncident_createdByIdToUser: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              profilePicture: true,
            },
          },
          User_ForeignMaterialIncident_submittedByIdToUser: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          FMIREvidence: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.foreignMaterialIncident.count({ where }),
    ]);

    // Fetch collaborator details for each report
    const reportsWithCollaborators = await Promise.all(
      reports.map(async (report) => {
        let collaborators: any[] = [];
        if (report.collaboratorIds && report.collaboratorIds.length > 0) {
          collaborators = await prisma.user.findMany({
            where: {
              id: { in: report.collaboratorIds },
            },
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              profilePicture: true,
            },
          });
        }
        return {
          ...report,
          Collaborators: collaborators,
          isOwner: report.createdById === userId,
        };
      })
    );

    res.json({
      success: true,
      data: {
        reports: reportsWithCollaborators,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      },
    });
  })
);

/**
 * @route   GET /api/fmir/:id
 * @desc    Get a single FMIR report by ID
 * @access  Private
 */
router.get(
  '/:id',
  authenticate,
  asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthRequest;
    const { id } = req.params;
    const userId = authReq.user?.id;
    const userOrgId = authReq.user?.organizationId;

    if (!userId || !userOrgId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const report = await prisma.foreignMaterialIncident.findFirst({
      where: {
        id,
        organizationId: userOrgId,
      },
      include: {
        Facility: true,
        User_ForeignMaterialIncident_createdByIdToUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            profilePicture: true,
          },
        },
        User_ForeignMaterialIncident_submittedByIdToUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        FMIREvidence: true,
      },
    });

    if (!report) {
      res.status(404).json({ error: 'FMIR report not found' });
      return;
    }

    // Check if user has access (owner or collaborator)
    const hasAccess = report.createdById === userId || (report.collaboratorIds && report.collaboratorIds.includes(userId));
    if (!hasAccess) {
      res.status(403).json({ error: 'You do not have access to this report' });
      return;
    }

    // Fetch collaborator details
    let collaborators: any[] = [];
    if (report.collaboratorIds && report.collaboratorIds.length > 0) {
      collaborators = await prisma.user.findMany({
        where: {
          id: { in: report.collaboratorIds },
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          profilePicture: true,
        },
      });
    }

    res.json({
      success: true,
      data: {
        ...report,
        Collaborators: collaborators,
        isOwner: report.createdById === userId,
      },
    });
  })
);

/**
 * @route   POST /api/fmir
 * @desc    Create a new FMIR report
 * @access  Private
 */
router.post(
  '/',
  authenticate,
  asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthRequest;
    const userId = authReq.user?.id;
    const userOrgId = authReq.user?.organizationId;

    if (!userId || !userOrgId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const {
      incidentDate,
      incidentTime,
      department,
      area,
      line,
      rawMaterialSource,
      fmSourceCategory,
      fmSourceType,
      productName,
      productItemNumber,
      productCodeBatchLot,
      amount,
      individualsInvolved,
      foreignMaterialDescription,
      foreignMaterialSize,
      foreignMaterialHardness,
      section2Initials,
      section2Date,
      isHardSharpOrLarge,
      unforeseeHazardFormRequired,
      causeIdentification,
      possibleSource,
      howWhyOccurred,
      section3Initials,
      section3Date,
      correctiveAction,
      section4Initials,
      section4Date,
      verificationActions,
      section5Initials,
      section5Date,
      maintenanceWorkCompleted,
      sanitationRequired,
      sanitationNotes,
      productPlacedOnHold,
      itemsHeld,
      holdDecisionDetails,
      contaminationWindowDetails,
      section6Initials,
      section6Date,
      screeningProcess,
      section7Initials,
      section7Date,
      finalDisposition,
      dispositionVolume,
      dispositionJustification,
      section8Initials,
      section8Date,
      dispositionDate,
      dispositionInitials,
      preventionMeasures,
      section9Initials,
      section9Date,
      corporateNotified,
      corporatePersonsNotified,
      preShipmentReview,
      preShipmentReviewDate,
      preShipmentSignatureRequired,
      facilityId,
      status = 'DRAFT',
    } = req.body;

    const reportNumber = await generateReportNumber(userOrgId, facilityId);
    
    // Auto-add QA/Food Safety users as collaborators for DRAFT or SUBMITTED reports
    let collaboratorIds: string[] = [];
    if (status === 'DRAFT' || status === 'SUBMITTED') {
      const qaUserIds = await getQAFoodSafetyUsers(userOrgId);
      // Don't add the creator if they're a QA user
      collaboratorIds = qaUserIds.filter(id => id !== userId);
    }

    const report = await prisma.foreignMaterialIncident.create({
      data: {
        reportNumber,
        status: status as FMIRStatus,
        collaboratorIds,
        incidentDate: new Date(incidentDate || new Date()),
        incidentTime,
        department,
        area,
        line,
        rawMaterialSource,
        fmSourceCategory,
        fmSourceType,
        productName,
        productItemNumber,
        productCodeBatchLot,
        amount,
        individualsInvolved,
        foreignMaterialDescription: foreignMaterialDescription || '',
        foreignMaterialSize,
        foreignMaterialHardness,
        section2Initials,
        section2Date: section2Date ? new Date(section2Date) : null,
        isHardSharpOrLarge: isHardSharpOrLarge || false,
        unforeseeHazardFormRequired: unforeseeHazardFormRequired || false,
        causeIdentification,
        possibleSource,
        howWhyOccurred,
        section3Initials,
        section3Date: section3Date ? new Date(section3Date) : null,
        correctiveAction,
        section4Initials,
        section4Date: section4Date ? new Date(section4Date) : null,
        verificationActions,
        section5Initials,
        section5Date: section5Date ? new Date(section5Date) : null,
        maintenanceWorkCompleted,
        sanitationRequired: sanitationRequired || false,
        sanitationNotes,
        productPlacedOnHold: productPlacedOnHold || false,
        itemsHeld,
        holdDecisionDetails,
        contaminationWindowDetails,
        section6Initials,
        section6Date: section6Date ? new Date(section6Date) : null,
        screeningProcess,
        section7Initials,
        section7Date: section7Date ? new Date(section7Date) : null,
        finalDisposition,
        dispositionVolume,
        dispositionJustification,
        section8Initials,
        section8Date: section8Date ? new Date(section8Date) : null,
        dispositionDate: dispositionDate ? new Date(dispositionDate) : null,
        dispositionInitials,
        preventionMeasures,
        section9Initials,
        section9Date: section9Date ? new Date(section9Date) : null,
        corporateNotified: corporateNotified || false,
        corporatePersonsNotified,
        preShipmentReview,
        preShipmentReviewDate: preShipmentReviewDate ? new Date(preShipmentReviewDate) : null,
        preShipmentSignatureRequired: preShipmentSignatureRequired || false,
        facilityId,
        organizationId: userOrgId,
        createdById: userId,
      },
      include: {
        Facility: true,
        User_ForeignMaterialIncident_createdByIdToUser: {
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
      data: report,
    });
  })
);

/**
 * @route   PUT /api/fmir/:id
 * @desc    Update an FMIR report
 * @access  Private (Owner or Collaborator)
 */
router.put(
  '/:id',
  authenticate,
  asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthRequest;
    const { id } = req.params;
    const userId = authReq.user?.id;
    const userOrgId = authReq.user?.organizationId;

    if (!userId || !userOrgId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Check if report exists and belongs to organization
    const existing = await prisma.foreignMaterialIncident.findFirst({
      where: {
        id,
        organizationId: userOrgId,
      },
    });

    if (!existing) {
      res.status(404).json({ error: 'FMIR report not found' });
      return;
    }

    // Check if user has edit access (owner or collaborator)
    const isOwner = existing.createdById === userId;
    const isCollaborator = existing.collaboratorIds && existing.collaboratorIds.includes(userId);
    
    if (!isOwner && !isCollaborator) {
      res.status(403).json({ error: 'You do not have permission to edit this report' });
      return;
    }

    const updateData: any = { ...req.body };
    
    // Handle date conversions - convert valid dates or set to null for empty strings
    const dateFields = [
      'incidentDate',
      'section2Date',
      'section3Date',
      'section4Date',
      'section5Date',
      'section6Date',
      'section7Date',
      'section8Date',
      'section9Date',
      'dispositionDate',
      'preShipmentReviewDate',
      'submittedAt',
    ];

    dateFields.forEach((field) => {
      if (updateData[field] !== undefined) {
        if (updateData[field] && updateData[field] !== '') {
          updateData[field] = new Date(updateData[field]);
        } else {
          updateData[field] = null;
        }
      }
    });

    // Remove fields that shouldn't be updated
    delete updateData.id;
    delete updateData.reportNumber;
    delete updateData.organizationId;
    delete updateData.createdById;
    delete updateData.createdAt;

    // Regenerate report number if facility changed on a DRAFT report
    if (
      existing.status === 'DRAFT' &&
      updateData.facilityId &&
      updateData.facilityId !== existing.facilityId
    ) {
      updateData.reportNumber = await generateReportNumber(userOrgId, updateData.facilityId);
    }

    // Track if status is changing (for real-time notifications)
    const previousStatus = existing.status;
    const newStatus = updateData.status;
    const statusChanged = previousStatus !== newStatus && newStatus !== undefined;

    const report = await prisma.foreignMaterialIncident.update({
      where: { id },
      data: updateData,
      include: {
        Facility: true,
        User_ForeignMaterialIncident_createdByIdToUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        FMIREvidence: true,
      },
    });

    // Emit real-time update to all collaborators and owner working on this FMIR
    const allLinkedUserIds = [report.createdById, ...(report.collaboratorIds || [])];
    const uniqueUserIds = [...new Set(allLinkedUserIds)];
    
    const userName = `${authReq.user?.firstName} ${authReq.user?.lastName}`;
    
    // Check if this is a status change that needs special notification
    if (statusChanged && previousStatus === 'UNDER_INVESTIGATION' && newStatus === 'SUBMITTED') {
      // This is a validation/submit from investigation - emit status-changed for modal
      const statusDisplayNames: Record<string, string> = {
        'DRAFT': 'Draft',
        'SUBMITTED': 'Submitted',
        'UNDER_INVESTIGATION': 'Under Investigation',
        'RESOLVED': 'Resolved',
        'CLOSED': 'Closed',
      };
      
      console.log(`📡 FMIR ${report.reportNumber} status changed: ${previousStatus} → ${newStatus} by ${userName}`);
      
      for (const linkedUserId of uniqueUserIds) {
        if (linkedUserId !== userId) {
          // Emit status-changed for the Investigation Off modal
          websocketService.emitToUser(linkedUserId, 'fmir:status-changed', {
            reportId: id,
            reportNumber: report.reportNumber,
            previousStatus: previousStatus,
            newStatus: newStatus,
            statusDisplay: statusDisplayNames[newStatus] || newStatus,
            changedBy: userName,
            changedById: userId,
            notes: null,
            timestamp: new Date().toISOString(),
          });
          // Also emit updated for list page refresh
          websocketService.emitToUser(linkedUserId, 'fmir:updated', {
            reportId: id,
            reportNumber: report.reportNumber,
            updatedById: userId,
            updatedByName: userName,
            updateType: 'submit',
            newStatus: newStatus,
          });
        }
      }
    } else {
      console.log(`📡 FMIR ${report.reportNumber} updated by user ${userId}, notifying ${uniqueUserIds.length} linked users`);
      
      for (const linkedUserId of uniqueUserIds) {
        // Notify all users except the one who made the save
        if (linkedUserId !== userId) {
          websocketService.emitToUser(linkedUserId, 'fmir:updated', {
            reportId: id,
            reportNumber: report.reportNumber,
            updatedById: userId,
            updatedByName: userName,
            updateType: statusChanged ? 'submit' : 'save',
            newStatus: statusChanged ? newStatus : undefined,
          });
        }
      }
    }

    res.json({
      success: true,
      data: report,
    });
  })
);

/**
 * @route   POST /api/fmir/:id/validate-for-submit
 * @desc    Validate an FMIR for submission with AI analysis
 * @access  Private (Report owner or collaborator)
 * 
 * This endpoint validates:
 * 1. Required description fields are filled
 * 2. Description fields align with the foreign material incident
 * 3. Evidence (photos/documents) align with the foreign material
 * 4. Provides AI recommendations for improvement
 */
router.post(
  '/:id/validate-for-submit',
  authenticate,
  asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthRequest;
    const { id } = req.params;
    const userId = authReq.user?.id;
    const userOrgId = authReq.user?.organizationId;

    if (!userId || !userOrgId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Get the report with evidence
    const report = await prisma.foreignMaterialIncident.findFirst({
      where: {
        id,
        organizationId: userOrgId,
      },
      include: {
        FMIREvidence: true,
        Facility: true,
        User_ForeignMaterialIncident_createdByIdToUser: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    if (!report) {
      res.status(404).json({ error: 'Report not found' });
      return;
    }

    // Check user has access (owner or collaborator)
    const isOwner = report.createdById === userId;
    const isCollaborator = report.collaboratorIds?.includes(userId);
    if (!isOwner && !isCollaborator) {
      res.status(403).json({ error: 'You do not have access to validate this report' });
      return;
    }

    // Basic field validation
    const validationResult = validateFMIRForLocking(report, report.FMIREvidence);

    // Get AI compliance analysis
    const complianceAnalysis = await analyzeFMIRCompliance(report, report.FMIREvidence, validationResult);

    // Determine if ready to submit - must have all required fields filled
    const canSubmit = validationResult.isValid;
    
    // Build evidence recommendations
    const evidenceRecommendations: string[] = [];
    if (!report.FMIREvidence || report.FMIREvidence.length === 0) {
      evidenceRecommendations.push('📷 No evidence attached. Consider adding photos of the foreign material for better documentation.');
    } else {
      const hasPhoto = report.FMIREvidence.some(e => e.type === 'PHOTO');
      if (!hasPhoto) {
        evidenceRecommendations.push('📷 No photos attached. Visual evidence of the foreign material is highly recommended.');
      }
      
      // Check for evidence descriptions
      const evidenceWithoutDesc = report.FMIREvidence.filter(e => !e.description || e.description.trim() === '');
      if (evidenceWithoutDesc.length > 0) {
        evidenceRecommendations.push(`📝 ${evidenceWithoutDesc.length} evidence file(s) have no description. Adding descriptions improves audit readiness.`);
      }
    }

    res.json({
      success: true,
      data: {
        canSubmit,
        validation: {
          isComplete: validationResult.isValid,
          missingFields: validationResult.missingFields,
          hasEvidence: validationResult.hasEvidence,
          evidenceCount: validationResult.evidenceCount,
        },
        compliance: complianceAnalysis,
        evidenceRecommendations,
        report: {
          id: report.id,
          reportNumber: report.reportNumber,
          status: report.status,
          foreignMaterialDescription: report.foreignMaterialDescription,
          evidenceCount: report.FMIREvidence?.length || 0,
        },
      },
    });
  })
);

/**
 * @route   POST /api/fmir/:id/submit
 * @desc    Submit an FMIR report
 * @access  Private
 */
router.post(
  '/:id/submit',
  authenticate,
  asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthRequest;
    const { id } = req.params;
    const userId = authReq.user?.id;
    const userOrgId = authReq.user?.organizationId;

    if (!userId || !userOrgId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const report = await prisma.foreignMaterialIncident.findFirst({
      where: {
        id,
        organizationId: userOrgId,
      },
    });

    if (!report) {
      res.status(404).json({ error: 'FMIR report not found' });
      return;
    }

    // Allow submitting from DRAFT (initial submit) or UNDER_INVESTIGATION (validation after investigation)
    if (report.status !== 'DRAFT' && report.status !== 'UNDER_INVESTIGATION') {
      res.status(400).json({ error: 'Report has already been submitted' });
      return;
    }

    // Track if this is a re-submission from investigation (for real-time modal)
    const wasUnderInvestigation = report.status === 'UNDER_INVESTIGATION';

    // Ensure QA/Food Safety users are added as collaborators when submitting
    const qaUserIds = await getQAFoodSafetyUsers(userOrgId);
    // Don't add the creator if they're a QA user
    const existingCollaboratorIds = report.collaboratorIds || [];
    const newQaCollaborators = qaUserIds.filter(id => id !== report.createdById && !existingCollaboratorIds.includes(id));
    const updatedCollaboratorIds = [...new Set([...existingCollaboratorIds, ...newQaCollaborators])];

    const updated = await prisma.foreignMaterialIncident.update({
      where: { id },
      data: {
        status: 'SUBMITTED',
        submittedAt: new Date(),
        submittedById: userId,
        collaboratorIds: updatedCollaboratorIds,
      },
      include: {
        Facility: true,
        User_ForeignMaterialIncident_createdByIdToUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        User_ForeignMaterialIncident_submittedByIdToUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        FMIREvidence: true,
      },
    });

    // Emit real-time update to all collaborators and owner about the submission
    const allLinkedUserIds = [updated.createdById, ...(updated.collaboratorIds || [])];
    const uniqueUserIds = [...new Set(allLinkedUserIds)];
    
    const userName = `${authReq.user?.firstName} ${authReq.user?.lastName}`;
    console.log(`📡 FMIR ${updated.reportNumber} submitted by user ${userId}, notifying ${uniqueUserIds.length} linked users`);
    
    for (const linkedUserId of uniqueUserIds) {
      // Notify all users except the one who submitted
      if (linkedUserId !== userId) {
        // If this was under investigation, emit status-changed for the Investigation Off modal
        if (wasUnderInvestigation) {
          const statusDisplayNames: Record<string, string> = {
            'DRAFT': 'Draft',
            'SUBMITTED': 'Submitted',
            'UNDER_INVESTIGATION': 'Under Investigation',
            'RESOLVED': 'Resolved',
            'CLOSED': 'Closed',
          };
          
          websocketService.emitToUser(linkedUserId, 'fmir:status-changed', {
            reportId: id,
            reportNumber: updated.reportNumber,
            previousStatus: 'UNDER_INVESTIGATION',
            newStatus: 'SUBMITTED',
            statusDisplay: statusDisplayNames['SUBMITTED'],
            changedBy: userName,
            changedById: userId,
            notes: null,
            timestamp: new Date().toISOString(),
          });
        }
        
        // Also emit updated for list page refresh
        websocketService.emitToUser(linkedUserId, 'fmir:updated', {
          reportId: id,
          reportNumber: updated.reportNumber,
          updatedById: userId,
          updatedByName: userName,
          updateType: 'submit',
          newStatus: 'SUBMITTED',
        });
      }
    }

    res.json({
      success: true,
      data: updated,
    });
  })
);

/**
 * @route   PATCH /api/fmir/:id/status
 * @desc    Change FMIR report status (QA/Food Safety workflow)
 * @access  Private (QA_FOOD_SAFETY, SAFETY_SECURITY_MANAGER, ADMIN only)
 * 
 * Valid transitions:
 * - SUBMITTED -> UNDER_INVESTIGATION (Start investigation)
 * - UNDER_INVESTIGATION -> RESOLVED (Mark as resolved)
 * - RESOLVED -> CLOSED (Archive the report)
 * - Any status -> DRAFT (Reopen for editing - Admin only)
 */
router.patch(
  '/:id/status',
  authenticate,
  asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthRequest;
    const { id } = req.params;
    const { status: newStatus, notes } = req.body;
    const userId = authReq.user?.id;
    const userOrgId = authReq.user?.organizationId;
    const userRole = authReq.user?.role;

    if (!userId || !userOrgId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Only QA/Food Safety, Safety/Security Manager, or Admin can change status
    const allowedRoles = ['QA_FOOD_SAFETY', 'SAFETY_SECURITY_MANAGER', 'ADMIN'];
    if (!allowedRoles.includes(userRole || '')) {
      res.status(403).json({ error: 'Only QA/Food Safety personnel can change report status' });
      return;
    }

    // Validate new status
    const validStatuses: FMIRStatus[] = ['DRAFT', 'SUBMITTED', 'UNDER_INVESTIGATION', 'RESOLVED', 'CLOSED'];
    if (!validStatuses.includes(newStatus as FMIRStatus)) {
      res.status(400).json({ error: 'Invalid status value' });
      return;
    }

    // Get the report
    const report = await prisma.foreignMaterialIncident.findFirst({
      where: {
        id,
        organizationId: userOrgId,
      },
      include: {
        User_ForeignMaterialIncident_createdByIdToUser: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });

    if (!report) {
      res.status(404).json({ error: 'Report not found' });
      return;
    }

    const currentStatus = report.status;

    // Define valid status transitions
    const validTransitions: Record<FMIRStatus, FMIRStatus[]> = {
      'DRAFT': ['SUBMITTED'], // Owner submits
      'SUBMITTED': ['UNDER_INVESTIGATION', 'DRAFT'], // QA starts investigation or returns to draft
      'UNDER_INVESTIGATION': ['RESOLVED', 'SUBMITTED'], // QA resolves or sends back
      'RESOLVED': ['CLOSED', 'UNDER_INVESTIGATION'], // QA closes or reopens investigation
      'CLOSED': ['RESOLVED'], // Reopen if needed (Admin only for DRAFT)
    };

    // Check if transition is valid
    const allowedTransitions = validTransitions[currentStatus] || [];
    
    // Admin can reopen to DRAFT from any status
    if (userRole === 'ADMIN' && newStatus === 'DRAFT') {
      // Allowed - Admin override
    } else if (!allowedTransitions.includes(newStatus as FMIRStatus)) {
      res.status(400).json({ 
        error: `Invalid status transition from ${currentStatus} to ${newStatus}`,
        allowedTransitions: allowedTransitions,
      });
      return;
    }

    // Get user info for audit trail
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true },
    });
    const userName = user ? `${user.firstName} ${user.lastName}` : 'Unknown';

    // Update the status
    const updateData: any = {
      status: newStatus as FMIRStatus,
      updatedAt: new Date(),
    };

    // Set specific timestamps based on status
    if (newStatus === 'CLOSED') {
      updateData.closedAt = new Date();
      updateData.closedById = userId;
      updateData.isClosed = true;
    } else if (currentStatus === 'CLOSED' && newStatus !== 'CLOSED') {
      // Reopening - clear closed fields
      updateData.isClosed = false;
      updateData.closedAt = null;
      updateData.closedById = null;
    }

    const updated = await prisma.foreignMaterialIncident.update({
      where: { id },
      data: updateData,
      include: {
        Facility: true,
        User_ForeignMaterialIncident_createdByIdToUser: {
          select: { id: true, firstName: true, lastName: true, email: true, profilePicture: true },
        },
        FMIREvidence: true,
      },
    });

    // Get status display names
    const statusDisplayNames: Record<string, string> = {
      'DRAFT': 'Draft',
      'SUBMITTED': 'Submitted',
      'UNDER_INVESTIGATION': 'Under Investigation',
      'RESOLVED': 'Resolved',
      'CLOSED': 'Closed',
    };

    // Notify via WebSocket
    const uniqueUserIds = new Set<string>();
    if (report.createdById) uniqueUserIds.add(report.createdById);
    if (updated.collaboratorIds) {
      updated.collaboratorIds.forEach((id: string) => uniqueUserIds.add(id));
    }

    console.log(`📡 FMIR ${updated.reportNumber} status changed: ${currentStatus} → ${newStatus} by ${userName}`);

    for (const targetUserId of uniqueUserIds) {
      if (targetUserId !== userId) {
        websocketService.emitToUser(targetUserId, 'fmir:status-changed', {
          reportId: updated.id,
          reportNumber: updated.reportNumber,
          previousStatus: currentStatus,
          newStatus: newStatus,
          statusDisplay: statusDisplayNames[newStatus] || newStatus,
          changedBy: userName,
          changedById: userId,
          notes: notes || null,
          timestamp: new Date().toISOString(),
        });
      }
    }

    res.json({
      success: true,
      data: updated,
      message: `Status changed from ${statusDisplayNames[currentStatus]} to ${statusDisplayNames[newStatus]}`,
    });
  })
);

/**
 * @route   DELETE /api/fmir/:id
 * @desc    Delete an FMIR report
 * @access  Private (QA_FOOD_SAFETY can delete any, Owners can only delete non-visible reports without participants)
 */
router.delete(
  '/:id',
  authenticate,
  asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthRequest;
    const { id } = req.params;
    const userId = authReq.user?.id;
    const userOrgId = authReq.user?.organizationId;
    const userRole = authReq.user?.role;

    if (!userId || !userOrgId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const report = await prisma.foreignMaterialIncident.findFirst({
      where: {
        id,
        organizationId: userOrgId,
      },
    });

    if (!report) {
      res.status(404).json({ error: 'FMIR report not found' });
      return;
    }

    // QA/Food Safety and Admin roles can delete any report
    const isQAFoodSafety = userRole === 'QA_FOOD_SAFETY';
    const isAdmin = ['ADMIN', 'SYSTEM_ADMIN'].includes(userRole || '');
    const isCreator = report.createdById === userId;

    // QA/Food Safety and Admins can delete any report
    if (isQAFoodSafety || isAdmin) {
      // Proceed with deletion
    } else if (isCreator) {
      // Owners can only delete reports that:
      // 1. Are NOT visible
      // 2. Have NO collaborators
      // 3. Have NO other users' initials (section initials from other users)
      
      // Check if report is visible
      if (report.isVisible) {
        res.status(403).json({ 
          error: 'Cannot delete this report',
          message: 'This report is visible to others and can only be deleted by QA/Food Safety personnel.'
        });
        return;
      }

      // Check if any section has initials from other users (indicating other users have edited)
      // Note: We don't check collaboratorIds because QA users are auto-added to all reports
      const sectionInitials = [
        report.section2Initials,
        report.section3Initials,
        report.section4Initials,
        report.section5Initials,
        report.section6Initials,
        report.section7Initials,
        report.section8Initials,
        report.section9Initials,
        report.dispositionInitials,
      ].filter(Boolean); // Remove null/empty values

      if (sectionInitials.length > 0) {
        res.status(403).json({ 
          error: 'Cannot delete this report',
          message: 'This report has been edited by other users and can only be deleted by QA/Food Safety personnel.'
        });
        return;
      }
    } else {
      res.status(403).json({ error: 'You do not have permission to delete this report' });
      return;
    }

    // Delete associated evidence files
    const evidence = await prisma.fMIREvidence.findMany({
      where: { fmirId: id },
    });

    for (const file of evidence) {
      const filePath = path.join(__dirname, '../../', file.filePath);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    // Get the deleting user's name
    const deletingUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true },
    });
    const deletedByName = deletingUser ? `${deletingUser.firstName} ${deletingUser.lastName}` : 'QA/Food Safety';

    // Store report info before deletion for WebSocket notification
    const deletedReportInfo = {
      reportId: id,
      reportNumber: report.reportNumber,
      deletedById: userId,
      deletedByName,
      collaboratorIds: report.collaboratorIds || [],
      createdById: report.createdById,
    };

    await prisma.foreignMaterialIncident.delete({
      where: { id },
    });

    // Notify all affected users (owner and collaborators) about the deletion
    const affectedUserIds = new Set<string>();
    
    // Add owner if not the one deleting
    if (report.createdById !== userId) {
      affectedUserIds.add(report.createdById);
    }
    
    // Add all collaborators
    if (report.collaboratorIds) {
      for (const collabId of report.collaboratorIds) {
        if (collabId !== userId) {
          affectedUserIds.add(collabId);
        }
      }
    }

    // Emit deletion event to all affected users
    for (const affectedUserId of affectedUserIds) {
      websocketService.emitToUser(affectedUserId, 'fmir:deleted', deletedReportInfo);
    }

    // Also broadcast to organization for list page updates
    websocketService.emitToOrganization(userOrgId, 'fmir:deleted', deletedReportInfo);

    res.json({
      success: true,
      message: 'FMIR report deleted successfully',
    });
  })
);

/**
 * @route   POST /api/fmir/:id/evidence
 * @desc    Upload evidence to an FMIR report
 * @access  Private
 */
router.post(
  '/:id/evidence',
  authenticate,
  upload.array('files', 10),
  asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthRequest;
    const { id } = req.params;
    const userId = authReq.user?.id;
    const userOrgId = authReq.user?.organizationId;
    const userName = `${authReq.user?.firstName || ''} ${authReq.user?.lastName || ''}`.trim() || 'Unknown User';

    if (!userId || !userOrgId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const report = await prisma.foreignMaterialIncident.findFirst({
      where: {
        id,
        organizationId: userOrgId,
      },
    });

    if (!report) {
      res.status(404).json({ error: 'FMIR report not found' });
      return;
    }

    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      res.status(400).json({ error: 'No files uploaded' });
      return;
    }

    const descriptions = req.body.descriptions 
      ? (Array.isArray(req.body.descriptions) ? req.body.descriptions : [req.body.descriptions])
      : [];

    // Upload files to Firebase Storage and create evidence records
    const bucket = adminStorage.bucket();
    const evidence = await Promise.all(
      files.map(async (file, index) => {
        // Determine evidence type based on mime type
        let evidenceType: 'PHOTO' | 'VIDEO' | 'DOCUMENT' = 'DOCUMENT';
        if (file.mimetype.startsWith('image/')) {
          evidenceType = 'PHOTO';
        } else if (file.mimetype.startsWith('video/')) {
          evidenceType = 'VIDEO';
        }

        // Generate unique filename for Firebase Storage
        const fileExtension = path.extname(file.originalname);
        const uniqueFileName = `fmir/${id}/${uuidv4()}${fileExtension}`;
        
        // Upload to Firebase Storage from memory buffer
        const firebaseFile = bucket.file(uniqueFileName);
        
        await firebaseFile.save(file.buffer, {
          metadata: {
            contentType: file.mimetype,
            metadata: {
              originalName: file.originalname,
              uploadedBy: userId,
              fmirId: id,
              evidenceType: evidenceType,
            },
          },
        });

        // Store the Firebase Storage path (not public URL - we'll use signed URLs for access)
        // The path format is: fmir/{fmirId}/{uuid}.{ext}
        const storagePath = `gs://${bucket.name}/${uniqueFileName}`;

        return prisma.fMIREvidence.create({
          data: {
            fmirId: id,
            type: evidenceType,
            fileName: file.originalname,
            filePath: storagePath,
            fileSize: file.size,
            mimeType: file.mimetype,
            description: descriptions[index] || null,
            uploadedById: userId,
          },
        });
      })
    );

    // Emit WebSocket event to owner and collaborators for real-time evidence sync
    const usersToNotify = new Set<string>();
    
    // Add report owner
    if (report.createdById && report.createdById !== userId) {
      usersToNotify.add(report.createdById);
    }
    
    // Add all collaborators except the current user
    (report.collaboratorIds || []).forEach((collabId: string) => {
      if (collabId !== userId) {
        usersToNotify.add(collabId);
      }
    });
    
    // Notify all users
    usersToNotify.forEach((targetUserId) => {
      websocketService.emitToUser(targetUserId, 'fmir:evidence-updated', {
        reportId: id,
        reportNumber: report.reportNumber,
        action: 'upload',
        evidence: evidence,
        updatedById: userId,
        updatedByName: userName,
      });
    });

    res.status(201).json({
      success: true,
      data: evidence,
    });
  })
);

/**
 * @route   DELETE /api/fmir/:id/evidence/:evidenceId
 * @desc    Delete evidence from an FMIR report
 * @access  Private
 */
router.delete(
  '/:id/evidence/:evidenceId',
  authenticate,
  asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthRequest;
    const { id, evidenceId } = req.params;
    const userId = authReq.user?.id;
    const userOrgId = authReq.user?.organizationId;
    const userName = `${authReq.user?.firstName || ''} ${authReq.user?.lastName || ''}`.trim() || 'Unknown User';

    if (!userId || !userOrgId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const report = await prisma.foreignMaterialIncident.findFirst({
      where: {
        id,
        organizationId: userOrgId,
      },
    });

    if (!report) {
      res.status(404).json({ error: 'FMIR report not found' });
      return;
    }

    const evidence = await prisma.fMIREvidence.findFirst({
      where: {
        id: evidenceId,
        fmirId: id,
      },
    });

    if (!evidence) {
      res.status(404).json({ error: 'Evidence not found' });
      return;
    }

    // Delete file from Firebase Storage if it's a Firebase URL (gs:// or storage.googleapis.com)
    if (evidence.filePath.startsWith('gs://') || evidence.filePath.includes('storage.googleapis.com')) {
      try {
        const bucket = adminStorage.bucket();
        let firebaseFilePath: string;
        
        if (evidence.filePath.startsWith('gs://')) {
          // Extract path from gs:// URL: gs://bucket-name/path/to/file
          firebaseFilePath = evidence.filePath.replace(`gs://${bucket.name}/`, '');
        } else {
          // Legacy: Extract from storage.googleapis.com URL
          const urlParts = evidence.filePath.split(`${bucket.name}/`);
          firebaseFilePath = urlParts.length > 1 ? decodeURIComponent(urlParts[1]) : '';
        }
        
        if (firebaseFilePath) {
          await bucket.file(firebaseFilePath).delete();
        }
      } catch (error) {
        console.error('Error deleting file from Firebase Storage:', error);
        // Continue with database deletion even if file deletion fails
      }
    } else if (evidence.filePath.startsWith('uploads/')) {
      // Legacy: Delete from local disk if it's a local file
      const filePath = path.join(__dirname, '../../', evidence.filePath);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    await prisma.fMIREvidence.delete({
      where: { id: evidenceId },
    });

    // Emit WebSocket event to owner and collaborators for real-time evidence sync
    const usersToNotify = new Set<string>();
    
    // Add report owner
    if (report.createdById && report.createdById !== userId) {
      usersToNotify.add(report.createdById);
    }
    
    // Add all collaborators except the current user
    (report.collaboratorIds || []).forEach((collabId: string) => {
      if (collabId !== userId) {
        usersToNotify.add(collabId);
      }
    });
    
    // Notify all users
    usersToNotify.forEach((targetUserId) => {
      websocketService.emitToUser(targetUserId, 'fmir:evidence-updated', {
        reportId: id,
        reportNumber: report.reportNumber,
        action: 'delete',
        evidenceId: evidenceId,
        updatedById: userId,
        updatedByName: userName,
      });
    });

    res.json({
      success: true,
      message: 'Evidence deleted successfully',
    });
  })
);

/**
 * @route   GET /api/fmir/:id/evidence/:evidenceId/download
 * @desc    Download evidence file
 * @access  Private
 */
router.get(
  '/:id/evidence/:evidenceId/download',
  authenticate,
  asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthRequest;
    const { id, evidenceId } = req.params;
    const userId = authReq.user?.id;
    const userOrgId = authReq.user?.organizationId;

    if (!userId || !userOrgId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const report = await prisma.foreignMaterialIncident.findFirst({
      where: {
        id,
        organizationId: userOrgId,
      },
    });

    if (!report) {
      res.status(404).json({ error: 'FMIR report not found' });
      return;
    }

    const evidence = await prisma.fMIREvidence.findFirst({
      where: {
        id: evidenceId,
        fmirId: id,
      },
    });

    if (!evidence) {
      res.status(404).json({ error: 'Evidence not found' });
      return;
    }

    // Handle Firebase Storage files (gs:// or storage.googleapis.com URLs)
    if (evidence.filePath.startsWith('gs://') || evidence.filePath.includes('storage.googleapis.com')) {
      try {
        const bucket = adminStorage.bucket();
        let firebaseFilePath: string;
        
        if (evidence.filePath.startsWith('gs://')) {
          // Extract path from gs:// URL
          // Format: gs://bucket-name/path/to/file
          const gsUrl = evidence.filePath.replace(`gs://${bucket.name}/`, '');
          firebaseFilePath = gsUrl;
        } else {
          // Legacy: Extract path from storage.googleapis.com URL
          const urlParts = evidence.filePath.split(`${bucket.name}/`);
          firebaseFilePath = urlParts.length > 1 ? decodeURIComponent(urlParts[1]) : '';
        }
        
        const file = bucket.file(firebaseFilePath);
        
        // Check if file exists
        const [exists] = await file.exists();
        if (!exists) {
          res.status(404).json({ error: 'File not found in storage' });
          return;
        }
        
        // Stream the file directly to avoid CORS issues with redirects
        // Set appropriate headers
        res.setHeader('Content-Type', evidence.mimeType || 'application/octet-stream');
        res.setHeader('Content-Disposition', `inline; filename="${evidence.fileName}"`);
        
        // Create a read stream and pipe to response
        const readStream = file.createReadStream();
        readStream.on('error', (streamError) => {
          console.error('Error streaming file:', streamError);
          if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to stream file' });
          }
        });
        readStream.pipe(res);
        return;
      } catch (error) {
        console.error('Error accessing Firebase Storage file:', error);
        res.status(500).json({ error: 'Failed to access file in storage' });
        return;
      }
    }

    // Legacy: serve from local disk
    const filePath = path.join(__dirname, '../../', evidence.filePath);
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: 'File not found' });
      return;
    }

    res.download(filePath, evidence.fileName);
  })
);

/**
 * @route   PATCH /api/fmir/:id/evidence/:evidenceId
 * @desc    Update evidence metadata (rename)
 * @access  Private
 */
router.patch(
  '/:id/evidence/:evidenceId',
  authenticate,
  asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthRequest;
    const { id, evidenceId } = req.params;
    const { fileName } = req.body;
    const userId = authReq.user?.id;
    const userOrgId = authReq.user?.organizationId;

    if (!userId || !userOrgId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!fileName || typeof fileName !== 'string' || !fileName.trim()) {
      res.status(400).json({ error: 'Valid file name is required' });
      return;
    }

    const report = await prisma.foreignMaterialIncident.findFirst({
      where: {
        id,
        organizationId: userOrgId,
      },
    });

    if (!report) {
      res.status(404).json({ error: 'FMIR report not found' });
      return;
    }

    const evidence = await prisma.fMIREvidence.findFirst({
      where: {
        id: evidenceId,
        fmirId: id,
      },
    });

    if (!evidence) {
      res.status(404).json({ error: 'Evidence not found' });
      return;
    }

    // Update the file name in database
    const updatedEvidence = await prisma.fMIREvidence.update({
      where: { id: evidenceId },
      data: { fileName: fileName.trim() },
    });

    res.json({
      success: true,
      data: updatedEvidence,
    });
  })
);

/**
 * @route   PATCH /api/fmir/:id/visibility
 * @desc    Toggle visibility of an FMIR report (owner only)
 * @access  Private
 */
router.patch(
  '/:id/visibility',
  authenticate,
  asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthRequest;
    const { id } = req.params;
    const { isVisible } = req.body;
    const userId = authReq.user?.id;
    const userOrgId = authReq.user?.organizationId;

    if (!userId || !userOrgId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (typeof isVisible !== 'boolean') {
      res.status(400).json({ error: 'isVisible must be a boolean' });
      return;
    }

    // Check if report exists and user is the owner
    const report = await prisma.foreignMaterialIncident.findFirst({
      where: {
        id,
        organizationId: userOrgId,
      },
    });

    if (!report) {
      res.status(404).json({ error: 'FMIR report not found' });
      return;
    }

    // Only the owner can toggle visibility
    if (report.createdById !== userId) {
      res.status(403).json({ error: 'Only the owner can change visibility' });
      return;
    }

    // Update visibility
    const updatedReport = await prisma.foreignMaterialIncident.update({
      where: { id },
      data: { isVisible },
      include: {
        Facility: true,
        User_ForeignMaterialIncident_createdByIdToUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            profilePicture: true,
          },
        },
      },
    });

    console.log(`📡 FMIR ${report.reportNumber} visibility changed to ${isVisible ? 'VISIBLE' : 'HIDDEN'} by owner`);

    // Emit WebSocket event to all users in the organization so they refresh their FMIR list
    websocketService.emitToOrganization(userOrgId, 'fmir:visibility-changed', {
      reportId: id,
      reportNumber: report.reportNumber,
      isVisible,
      ownerId: userId,
    });

    // When visibility is turned OFF, send direct notification to each collaborator
    // This is used to show an immediate modal to users who are currently editing the FMIR
    if (!isVisible && report.collaboratorIds && report.collaboratorIds.length > 0) {
      console.log(`📡 Notifying ${report.collaboratorIds.length} collaborators about visibility OFF`);
      for (const collaboratorId of report.collaboratorIds) {
        // Don't notify the owner (who is making the change)
        if (collaboratorId !== userId) {
          websocketService.emitToUser(collaboratorId, 'fmir:visibility-off', {
            reportId: id,
            reportNumber: report.reportNumber,
            ownerId: userId,
            ownerName: `${updatedReport.User_ForeignMaterialIncident_createdByIdToUser.firstName} ${updatedReport.User_ForeignMaterialIncident_createdByIdToUser.lastName}`,
          });
        }
      }
    }

    res.json({
      success: true,
      data: updatedReport,
    });
  })
);

/**
 * @route   GET /api/fmir/:id/validate-for-lock
 * @desc    Validate an FMIR for locking and get AI compliance analysis
 * @access  Private (QA_FOOD_SAFETY role only)
 */
router.get(
  '/:id/validate-for-lock',
  authenticate,
  asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthRequest;
    const { id } = req.params;
    const userId = authReq.user?.id;
    const userOrgId = authReq.user?.organizationId;
    const userRole = authReq.user?.role;

    if (!userId || !userOrgId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Only QA/Food Safety users can validate for locking
    if (userRole !== 'QA_FOOD_SAFETY') {
      res.status(403).json({ error: 'Only QA/Food Safety users can validate for locking' });
      return;
    }

    // Find the report with evidence
    const report = await prisma.foreignMaterialIncident.findFirst({
      where: {
        id,
        organizationId: userOrgId,
      },
      include: {
        FMIREvidence: true,
        Facility: true,
        User_ForeignMaterialIncident_createdByIdToUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!report) {
      res.status(404).json({ error: 'Report not found' });
      return;
    }

    // Validate the report
    const validationResult = validateFMIRForLocking(report, report.FMIREvidence);

    // Get AI compliance analysis
    const complianceAnalysis = await analyzeFMIRCompliance(report, report.FMIREvidence, validationResult);

    res.json({
      success: true,
      data: {
        validation: validationResult,
        compliance: complianceAnalysis,
        reportNumber: report.reportNumber,
        canLock: validationResult.isValid,
      },
    });
  })
);

/**
 * @route   POST /api/fmir/explain-regulation
 * @desc    Get AI explanation of a food safety regulation in plain English
 * @access  Private
 */
router.post(
  '/explain-regulation',
  authenticate,
  asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthRequest;
    const userId = authReq.user?.id;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { regulatoryReference, fieldName, issue, recommendation } = req.body;

    if (!regulatoryReference) {
      res.status(400).json({ error: 'Regulatory reference is required' });
      return;
    }

    const explanation = await explainRegulation(
      regulatoryReference,
      fieldName || 'this field',
      issue || 'This field needs attention',
      recommendation || 'Please complete this field properly'
    );

    res.json({
      success: true,
      data: explanation,
    });
  })
);

/**
 * @route   PATCH /api/fmir/:id/closed-status
 * @desc    Toggle closed status of an FMIR report (QA/Food Safety only)
 * @access  Private (QA_FOOD_SAFETY role only)
 */
router.patch(
  '/:id/closed-status',
  authenticate,
  asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthRequest;
    const { id } = req.params;
    const { isClosed, skipValidation } = req.body;
    const userId = authReq.user?.id;
    const userOrgId = authReq.user?.organizationId;
    const userRole = authReq.user?.role;

    if (!userId || !userOrgId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Only QA/Food Safety users can toggle closed status
    if (userRole !== 'QA_FOOD_SAFETY') {
      res.status(403).json({ error: 'Only QA/Food Safety users can change closed status' });
      return;
    }

    // Find the report with evidence
    const report = await prisma.foreignMaterialIncident.findFirst({
      where: {
        id,
        organizationId: userOrgId,
      },
      include: {
        FMIREvidence: true,
        User_ForeignMaterialIncident_createdByIdToUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    if (!report) {
      res.status(404).json({ error: 'Report not found' });
      return;
    }

    // If trying to lock (close), validate the report first
    if (isClosed && !skipValidation) {
      // Helper function to emit audit progress
      const emitAuditProgress = (stepId: string, stepLabel: string, stepDescription: string, status: 'pending' | 'active' | 'completed', stepIndex: number, totalSteps: number, message?: string) => {
        websocketService.emitToUser(userId, 'fmir:audit-progress', {
          reportId: id,
          reportNumber: report.reportNumber,
          stepId,
          stepLabel,
          stepDescription,
          status,
          stepIndex,
          totalSteps,
          message,
        });
      };

      const totalSteps = 9;

      // Step 1: Incident Details - Start with validation
      emitAuditProgress('incident', 'Incident Details', `Validating foreign material: "${report.foreignMaterialDescription?.substring(0, 50)}..."`, 'active', 0, totalSteps);
      
      // Run the synchronous field validation FIRST
      const validationResult = validateFMIRForLocking(report, report.FMIREvidence);
      
      // Brief pause for UI feedback
      await new Promise(resolve => setTimeout(resolve, 800));
      
      if (!validationResult.isValid) {
        // Emit failure state
        emitAuditProgress('incident', 'Incident Details', 'Validation failed - missing required fields', 'completed', 0, totalSteps);
        
        // Get AI compliance analysis for the response
        const complianceAnalysis = await analyzeFMIRCompliance(report, report.FMIREvidence, validationResult);
        
        res.status(400).json({
          error: 'FMIR cannot be locked due to incomplete information',
          validationFailed: true,
          validation: validationResult,
          compliance: complianceAnalysis,
          reportNumber: report.reportNumber,
        });
        return;
      }

      // Validation passed - now do the REAL audit work with proper progress
      emitAuditProgress('incident', 'Incident Details', `Validated foreign material description`, 'completed', 0, totalSteps);
      
      // Step 2: Product Information
      emitAuditProgress('product', 'Product Information', report.productName ? `Checking product: ${report.productName}` : 'Verifying product documentation', 'active', 1, totalSteps);
      await new Promise(resolve => setTimeout(resolve, 1000));
      emitAuditProgress('product', 'Product Information', 'Product information verified', 'completed', 1, totalSteps);

      // Step 3: Evidence Analysis - This is a REAL step that takes time
      emitAuditProgress('evidence', 'Evidence Analysis', `Analyzing ${report.FMIREvidence?.length || 0} evidence files with AI Vision...`, 'active', 2, totalSteps);
      
      // The actual AI audit starts here - it will take time
      // We'll call generateFMIRSuccessAudit but emit progress during different phases
      const auditStartTime = Date.now();
      
      // Start the actual audit (this does evidence analysis + main AI call)
      const successAuditPromise = generateFMIRSuccessAudit(report, report.FMIREvidence);
      
      // Emit intermediate progress while waiting for the audit
      // These run concurrently with the AI call to show progress
      const progressInterval = setInterval(() => {
        const elapsed = Date.now() - auditStartTime;
        
        // Update progress based on elapsed time (AI audit typically takes 60-180s)
        if (elapsed < 8000) {
          // Still on evidence analysis (0-8s)
          emitAuditProgress('evidence', 'Evidence Analysis', `Processing evidence files... (${Math.floor(elapsed/1000)}s)`, 'active', 2, totalSteps);
        } else if (elapsed < 15000) {
          // Evidence done, move to department (8-15s)
          emitAuditProgress('evidence', 'Evidence Analysis', 'Evidence files analyzed', 'completed', 2, totalSteps);
          emitAuditProgress('department', 'Department Compliance', `Reviewing ${report.department || 'department'} protocols...`, 'active', 3, totalSteps);
        } else if (elapsed < 30000) {
          // Department done, root cause (15-30s)
          emitAuditProgress('department', 'Department Compliance', 'Department compliance verified', 'completed', 3, totalSteps);
          emitAuditProgress('rootcause', 'Root Cause Analysis', 'Evaluating root cause identification depth...', 'active', 4, totalSteps);
        } else if (elapsed < 50000) {
          // Root cause done, corrective (30-50s)
          emitAuditProgress('rootcause', 'Root Cause Analysis', 'Root cause analysis evaluated', 'completed', 4, totalSteps);
          emitAuditProgress('corrective', 'Corrective Actions', 'Assessing corrective action adequacy...', 'active', 5, totalSteps);
        } else if (elapsed < 75000) {
          // Corrective done, preventive (50-75s)
          emitAuditProgress('corrective', 'Corrective Actions', 'Corrective actions assessed', 'completed', 5, totalSteps);
          emitAuditProgress('preventive', 'Preventive Measures', 'Reviewing preventive controls...', 'active', 6, totalSteps);
        } else if (elapsed < 100000) {
          // Preventive done, compliance (75-100s)
          emitAuditProgress('preventive', 'Preventive Measures', 'Preventive measures reviewed', 'completed', 6, totalSteps);
          emitAuditProgress('compliance', 'Regulatory Compliance', 'Cross-referencing FDA 21 CFR Part 117 & FSMA...', 'active', 7, totalSteps);
        } else if (elapsed < 130000) {
          // Compliance done, quality scoring (100-130s)
          emitAuditProgress('compliance', 'Regulatory Compliance', 'Regulatory compliance verified', 'completed', 7, totalSteps);
          emitAuditProgress('quality', 'Quality Scoring', 'Computing overall quality score...', 'active', 8, totalSteps);
        } else {
          // Still on quality scoring (130s+)
          emitAuditProgress('quality', 'Quality Scoring', `AI analysis in progress... (${Math.floor(elapsed/1000)}s)`, 'active', 8, totalSteps);
        }
      }, 5000); // Update every 5 seconds
      
      // Wait for the actual audit to complete
      let successAudit;
      const auditEndTime = Date.now();
      try {
        successAudit = await successAuditPromise;
      } finally {
        // Always clear the interval
        clearInterval(progressInterval);
      }
      
      // Calculate audit duration
      const auditDurationMs = Date.now() - auditStartTime;
      
      // SAVE AUDIT REPORT TO DATABASE - for historical reference and team learning
      try {
        // Convert complex objects to plain JSON for Prisma storage
        const savedAuditReport = await prisma.fMIRAuditReport.create({
          data: {
            fmirId: id,
            reportNumber: report.reportNumber,
            organizationId: userOrgId,
            canBeClosed: successAudit.canBeClosed,
            auditScore: successAudit.auditScore || 0,
            overallVerdict: successAudit.overallVerdict || 'NEEDS_IMPROVEMENT',
            passesAudit: successAudit.passesAudit || false,
            congratulations: successAudit.congratulations || false,
            blockingReasons: successAudit.blockingReasons || [],
            summary: JSON.parse(JSON.stringify(successAudit.summary || {})),
            reportSummary: JSON.parse(JSON.stringify(successAudit.reportSummary || {})),
            answerQuality: JSON.parse(JSON.stringify(successAudit.answerQuality || {})),
            contentQuality: JSON.parse(JSON.stringify(successAudit.contentQuality || {})),
            evidenceAnalysis: JSON.parse(JSON.stringify(successAudit.evidenceAnalysis || {})),
            regulatoryReadiness: JSON.parse(JSON.stringify(successAudit.regulatoryReadiness || {})),
            fieldValidation: JSON.parse(JSON.stringify(successAudit.fieldValidation || [])),
            improvementAreas: JSON.parse(JSON.stringify(successAudit.improvementAreas || [])),
            auditorNarrative: successAudit.auditorNarrative || '',
            closingStatement: successAudit.closingStatement || '',
            auditedById: userId,
            auditDurationMs: auditDurationMs,
            aiModel: process.env.AI_MODEL || 'gpt-4o',
          },
        });
        console.log(`💾 Saved audit report ${savedAuditReport.id} for FMIR ${report.reportNumber} (score: ${successAudit.auditScore}%, duration: ${auditDurationMs}ms)`);
      } catch (saveError) {
        // Log but don't fail the request if saving fails
        console.error('❌ Failed to save audit report to database:', saveError);
      }
      
      // Mark all remaining steps as completed
      emitAuditProgress('evidence', 'Evidence Analysis', 'Evidence files analyzed', 'completed', 2, totalSteps);
      emitAuditProgress('department', 'Department Compliance', 'Department compliance verified', 'completed', 3, totalSteps);
      emitAuditProgress('rootcause', 'Root Cause Analysis', 'Root cause analysis evaluated', 'completed', 4, totalSteps);
      emitAuditProgress('corrective', 'Corrective Actions', 'Corrective actions assessed', 'completed', 5, totalSteps);
      emitAuditProgress('preventive', 'Preventive Measures', 'Preventive measures reviewed', 'completed', 6, totalSteps);
      emitAuditProgress('compliance', 'Regulatory Compliance', 'Regulatory compliance verified', 'completed', 7, totalSteps);
      emitAuditProgress('quality', 'Quality Scoring', `Audit score: ${successAudit.auditScore}%`, 'completed', 8, totalSteps, `AI analysis complete - Score: ${successAudit.auditScore}%`);
      
      // ENHANCED: Check if AI audit determined report cannot be closed
      // Allow QA override with explicit overridePassingScore parameter
      const { overridePassingScore } = req.body;
      
      if (!successAudit.canBeClosed && !overridePassingScore) {
        console.log(`📡 FMIR ${report.reportNumber} BLOCKED from closure - AI audit found ${successAudit.blockingReasons.length} blocking issue(s)`);
        
        res.status(400).json({
          error: 'FMIR cannot be closed due to quality concerns identified by AI audit',
          auditBlocked: true,
          successAudit: successAudit,
          blockingReasons: successAudit.blockingReasons,
          reportNumber: report.reportNumber,
        });
        return;
      }
      
      // If QA is overriding, log it for audit trail
      if (overridePassingScore && !successAudit.canBeClosed) {
        console.log(`📡 FMIR ${report.reportNumber} QA OVERRIDE - User ${userId} accepted score ${successAudit.auditScore}% as passing threshold`);
      }

      const wasOverridden = overridePassingScore && !successAudit.canBeClosed;
      
      // Update closed status
      const updatedReport = await prisma.foreignMaterialIncident.update({
        where: { id },
        data: {
          isClosed: isClosed,
          closedAt: new Date(),
          closedById: userId,
        },
        include: {
          Facility: true,
          User_ForeignMaterialIncident_createdByIdToUser: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              profilePicture: true,
            },
          },
          FMIREvidence: true,
        },
      });

      if (wasOverridden) {
        console.log(`📡 FMIR ${report.reportNumber} CLOSED with QA OVERRIDE by user ${userId} - Score: ${successAudit.auditScore}%`);
      } else {
        console.log(`📡 FMIR ${report.reportNumber} CLOSED successfully by QA user ${userId} - All validations passed, audit score: ${successAudit.auditScore}%`);
      }

      // Emit real-time update to organization
      websocketService.emitToOrganization(userOrgId, 'fmir:closed-status-changed', {
        reportId: id,
        reportNumber: report.reportNumber,
        isClosed: true,
        closedById: userId,
        closedAt: new Date().toISOString(),
        qaOverride: wasOverridden,
      });

      // Return success with audit analysis
      res.json({
        success: true,
        validationPassed: true,
        data: updatedReport,
        successAudit: wasOverridden ? {
          ...successAudit,
          canBeClosed: true, // Mark as closed since QA overrode
          qaOverride: true,
          originalCanBeClosed: false,
        } : successAudit,
        reportNumber: report.reportNumber,
        qaOverride: wasOverridden,
      });
      return;
    }

    // Update closed status
    const updatedReport = await prisma.foreignMaterialIncident.update({
      where: { id },
      data: {
        isClosed: isClosed,
        closedAt: isClosed ? new Date() : null,
        closedById: isClosed ? userId : null,
      },
      include: {
        Facility: true,
        User_ForeignMaterialIncident_createdByIdToUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            profilePicture: true,
          },
        },
        FMIREvidence: true,
      },
    });

    console.log(`📡 FMIR ${report.reportNumber} closed status changed to ${isClosed ? 'CLOSED' : 'OPEN'} by QA user ${userId}`);

    // Emit real-time update to organization
    websocketService.emitToOrganization(userOrgId, 'fmir:closed-status-changed', {
      reportId: id,
      reportNumber: report.reportNumber,
      isClosed,
      closedById: isClosed ? userId : null,
      closedAt: isClosed ? new Date().toISOString() : null,
    });

    res.json({
      success: true,
      data: updatedReport,
    });
  })
);

/**
 * @route   POST /api/fmir/:id/evidence/:evidenceId/replace
 * @desc    Replace evidence file (for cropped images)
 * @access  Private
 */
router.post(
  '/:id/evidence/:evidenceId/replace',
  authenticate,
  upload.single('file'),
  asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthRequest;
    const { id, evidenceId } = req.params;
    const userId = authReq.user?.id;
    const userOrgId = authReq.user?.organizationId;

    if (!userId || !userOrgId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const report = await prisma.foreignMaterialIncident.findFirst({
      where: {
        id,
        organizationId: userOrgId,
      },
    });

    if (!report) {
      res.status(404).json({ error: 'FMIR report not found' });
      return;
    }

    const evidence = await prisma.fMIREvidence.findFirst({
      where: {
        id: evidenceId,
        fmirId: id,
      },
    });

    if (!evidence) {
      res.status(404).json({ error: 'Evidence not found' });
      return;
    }

    // Delete old file from Firebase Storage if it's a Firebase URL (gs:// or storage.googleapis.com)
    if (evidence.filePath.startsWith('gs://') || evidence.filePath.includes('storage.googleapis.com')) {
      try {
        const bucket = adminStorage.bucket();
        let firebaseFilePath: string;
        
        if (evidence.filePath.startsWith('gs://')) {
          firebaseFilePath = evidence.filePath.replace(`gs://${bucket.name}/`, '');
        } else {
          const urlParts = evidence.filePath.split(`${bucket.name}/`);
          firebaseFilePath = urlParts.length > 1 ? decodeURIComponent(urlParts[1]) : '';
        }
        
        if (firebaseFilePath) {
          await bucket.file(firebaseFilePath).delete();
        }
      } catch (error) {
        console.error('Error deleting old file from Firebase Storage:', error);
      }
    } else if (evidence.filePath.startsWith('uploads/')) {
      // Legacy: Delete from local disk
      const oldFilePath = path.join(__dirname, '../../', evidence.filePath);
      if (fs.existsSync(oldFilePath)) {
        fs.unlinkSync(oldFilePath);
      }
    }

    // Upload new file to Firebase Storage
    const bucket = adminStorage.bucket();
    const fileExtension = path.extname(req.file.originalname);
    const uniqueFileName = `fmir/${id}/${uuidv4()}${fileExtension}`;
    
    const firebaseFile = bucket.file(uniqueFileName);
    
    await firebaseFile.save(req.file.buffer, {
      metadata: {
        contentType: req.file.mimetype,
        metadata: {
          originalName: req.file.originalname,
          uploadedBy: userId,
          fmirId: id,
          evidenceType: evidence.type,
        },
      },
    });

    // Store the Firebase Storage path (not public URL)
    const storagePath = `gs://${bucket.name}/${uniqueFileName}`;

    // Update evidence record with new file
    const updatedEvidence = await prisma.fMIREvidence.update({
      where: { id: evidenceId },
      data: {
        filePath: storagePath,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
      },
    });

    res.json({
      success: true,
      data: updatedEvidence,
    });
  })
);

/**
 * @route   POST /api/fmir/:id/collaborators
 * @desc    Add collaborators to a report (owner only)
 * @access  Private
 */
router.post(
  '/:id/collaborators',
  authenticate,
  asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthRequest;
    const { id } = req.params;
    const userId = authReq.user?.id;
    const userOrgId = authReq.user?.organizationId;
    const { userIds } = req.body;

    if (!userId || !userOrgId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      res.status(400).json({ error: 'User IDs are required' });
      return;
    }

    const report = await prisma.foreignMaterialIncident.findFirst({
      where: {
        id,
        organizationId: userOrgId,
      },
    });

    if (!report) {
      res.status(404).json({ error: 'FMIR report not found' });
      return;
    }

    // Only owner can add collaborators
    if (report.createdById !== userId) {
      res.status(403).json({ error: 'Only the report owner can add collaborators' });
      return;
    }

    // Verify all users exist and are in the same organization
    const users = await prisma.user.findMany({
      where: {
        id: { in: userIds },
        organizationId: userOrgId,
        isActive: true,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        profilePicture: true,
      },
    });

    if (users.length !== userIds.length) {
      res.status(400).json({ error: 'Some users were not found or are inactive' });
      return;
    }

    // Don't add owner as collaborator
    const validUserIds = userIds.filter((uid: string) => uid !== report.createdById);

    // Merge with existing collaborators (no duplicates)
    const existingIds = report.collaboratorIds || [];
    const newCollaboratorIds = [...new Set([...existingIds, ...validUserIds])];

    const updatedReport = await prisma.foreignMaterialIncident.update({
      where: { id },
      data: {
        collaboratorIds: newCollaboratorIds,
      },
      include: {
        User_ForeignMaterialIncident_createdByIdToUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            profilePicture: true,
          },
        },
      },
    });

    // Fetch updated collaborators
    const collaborators = await prisma.user.findMany({
      where: {
        id: { in: newCollaboratorIds },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        profilePicture: true,
      },
    });

    // Emit WebSocket event to newly added collaborators so they see the report instantly
    const ownerName = `${authReq.user?.firstName} ${authReq.user?.lastName}`;
    const newlyAddedUserIds = validUserIds.filter((uid: string) => !existingIds.includes(uid));
    
    console.log(`👥 FMIR ${report.reportNumber}: ${newlyAddedUserIds.length} collaborator(s) added by ${ownerName}`);
    
    // Emit to each newly added user directly
    for (const addedUserId of newlyAddedUserIds) {
      websocketService.emitToUser(addedUserId, 'fmir:collaborator-added', {
        reportId: id,
        reportNumber: report.reportNumber,
        addedUserId: addedUserId,
        addedByName: ownerName,
        addedById: userId,
      });
    }
    
    // Also broadcast to organization so all viewers (including QA) see the update on their list
    websocketService.emitToOrganization(userOrgId, 'fmir:collaborators-updated', {
      reportId: id,
      reportNumber: report.reportNumber,
      action: 'added',
      collaboratorIds: newCollaboratorIds,
      collaborators: collaborators,
      updatedByName: ownerName,
      updatedById: userId,
    });

    res.json({
      success: true,
      data: {
        ...updatedReport,
        Collaborators: collaborators,
      },
    });
  })
);

/**
 * @route   DELETE /api/fmir/:id/collaborators/:collaboratorId
 * @desc    Remove a collaborator from a report (owner only)
 * @access  Private
 */
router.delete(
  '/:id/collaborators/:collaboratorId',
  authenticate,
  asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthRequest;
    const { id, collaboratorId } = req.params;
    const userId = authReq.user?.id;
    const userOrgId = authReq.user?.organizationId;

    if (!userId || !userOrgId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const report = await prisma.foreignMaterialIncident.findFirst({
      where: {
        id,
        organizationId: userOrgId,
      },
    });

    if (!report) {
      res.status(404).json({ error: 'FMIR report not found' });
      return;
    }

    // Only owner can remove collaborators
    if (report.createdById !== userId) {
      res.status(403).json({ error: 'Only the report owner can remove collaborators' });
      return;
    }

    const newCollaboratorIds = (report.collaboratorIds || []).filter(
      (cid) => cid !== collaboratorId
    );

    const updatedReport = await prisma.foreignMaterialIncident.update({
      where: { id },
      data: {
        collaboratorIds: newCollaboratorIds,
      },
    });

    // Fetch remaining collaborators
    let collaborators: any[] = [];
    if (newCollaboratorIds.length > 0) {
      collaborators = await prisma.user.findMany({
        where: {
          id: { in: newCollaboratorIds },
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          profilePicture: true,
        },
      });
    }

    // Emit WebSocket event to the removed collaborator so they see the update instantly
    const ownerName = `${authReq.user?.firstName} ${authReq.user?.lastName}`;
    console.log(`👤 FMIR ${report.reportNumber}: Collaborator ${collaboratorId} removed by ${ownerName}`);
    
    websocketService.emitToUser(collaboratorId, 'fmir:collaborator-removed', {
      reportId: id,
      reportNumber: report.reportNumber,
      removedUserId: collaboratorId,
      removedByName: ownerName,
    });
    
    // Also broadcast to organization so all viewers (including QA) see the update on their list
    websocketService.emitToOrganization(userOrgId, 'fmir:collaborators-updated', {
      reportId: id,
      reportNumber: report.reportNumber,
      action: 'removed',
      removedUserId: collaboratorId,
      collaboratorIds: newCollaboratorIds,
      collaborators: collaborators,
      updatedByName: ownerName,
      updatedById: userId,
    });

    res.json({
      success: true,
      data: {
        ...updatedReport,
        Collaborators: collaborators,
      },
    });
  })
);

// ============================================================================
// AUDIT HISTORY ENDPOINTS - For viewing past AI audits and learning from them
// ============================================================================

/**
 * GET /fmir/:fmirId/audits - Get all audit reports for a specific FMIR
 * Returns audit history sorted by most recent first
 */
router.get(
  '/:fmirId/audits',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { fmirId } = req.params;
    const userId = req.user?.id;
    const userOrgId = req.user?.organizationId;

    if (!userId || !userOrgId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Verify the FMIR exists and belongs to the user's organization
    const fmir = await prisma.foreignMaterialIncident.findFirst({
      where: {
        id: fmirId,
        organizationId: userOrgId,
      },
      select: { id: true, reportNumber: true },
    });

    if (!fmir) {
      res.status(404).json({ error: 'FMIR not found' });
      return;
    }

    // Get all audit reports for this FMIR
    const audits = await prisma.fMIRAuditReport.findMany({
      where: {
        fmirId: fmirId,
        organizationId: userOrgId,
      },
      include: {
        User: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            profilePicture: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      data: audits,
      reportNumber: fmir.reportNumber,
    });
  })
);

/**
 * GET /fmir/audits/:auditId - Get a specific audit report by ID
 * Returns full audit details including all assessments
 */
router.get(
  '/audits/:auditId',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { auditId } = req.params;
    const userId = req.user?.id;
    const userOrgId = req.user?.organizationId;

    if (!userId || !userOrgId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const audit = await prisma.fMIRAuditReport.findFirst({
      where: {
        id: auditId,
        organizationId: userOrgId,
      },
      include: {
        User: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            profilePicture: true,
          },
        },
        ForeignMaterialIncident: {
          select: {
            id: true,
            reportNumber: true,
            foreignMaterialDescription: true,
            incidentDate: true,
            department: true,
            productName: true,
            status: true,
            isClosed: true,
          },
        },
      },
    });

    if (!audit) {
      res.status(404).json({ error: 'Audit report not found' });
      return;
    }

    res.json({
      success: true,
      data: audit,
    });
  })
);

/**
 * GET /fmir/audits/organization/all - Get all audit reports for the organization
 * For learning and trend analysis - paginated
 */
router.get(
  '/audits/organization/all',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    const userOrgId = req.user?.organizationId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    // Filter options
    const minScore = req.query.minScore ? parseInt(req.query.minScore as string) : undefined;
    const maxScore = req.query.maxScore ? parseInt(req.query.maxScore as string) : undefined;
    const canBeClosed = req.query.canBeClosed === 'true' ? true : req.query.canBeClosed === 'false' ? false : undefined;
    const verdict = req.query.verdict as string | undefined;

    if (!userId || !userOrgId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Build where clause
    const where: any = { organizationId: userOrgId };
    if (minScore !== undefined) where.auditScore = { ...where.auditScore, gte: minScore };
    if (maxScore !== undefined) where.auditScore = { ...where.auditScore, lte: maxScore };
    if (canBeClosed !== undefined) where.canBeClosed = canBeClosed;
    if (verdict) where.overallVerdict = verdict;

    // Get total count
    const totalCount = await prisma.fMIRAuditReport.count({ where });

    // Get audits with pagination
    const audits = await prisma.fMIRAuditReport.findMany({
      where,
      include: {
        User: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            profilePicture: true,
          },
        },
        ForeignMaterialIncident: {
          select: {
            id: true,
            reportNumber: true,
            foreignMaterialDescription: true,
            incidentDate: true,
            department: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    });

    // Calculate summary statistics
    const stats = await prisma.fMIRAuditReport.aggregate({
      where: { organizationId: userOrgId },
      _avg: { auditScore: true },
      _min: { auditScore: true },
      _max: { auditScore: true },
      _count: true,
    });

    const passedCount = await prisma.fMIRAuditReport.count({
      where: { organizationId: userOrgId, canBeClosed: true },
    });

    const blockedCount = await prisma.fMIRAuditReport.count({
      where: { organizationId: userOrgId, canBeClosed: false },
    });

    res.json({
      success: true,
      data: audits,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
      statistics: {
        totalAudits: stats._count,
        averageScore: Math.round(stats._avg.auditScore || 0),
        minScore: stats._min.auditScore || 0,
        maxScore: stats._max.auditScore || 0,
        passedCount,
        blockedCount,
        passRate: stats._count > 0 ? Math.round((passedCount / stats._count) * 100) : 0,
      },
    });
  })
);

// =====================
// FMIR COMMENTS ROUTES
// =====================

// Get all comments for an FMIR
router.get(
  '/:id/comments',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }

    // Verify user has access to this FMIR
    const fmir = await prisma.foreignMaterialIncident.findUnique({
      where: { id },
      select: {
        id: true,
        createdById: true,
        collaboratorIds: true,
        organizationId: true,
      },
    });

    if (!fmir) {
      res.status(404).json({ success: false, error: 'FMIR not found' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, organizationId: true },
    });

    const isOwner = fmir.createdById === userId;
    const isCollaborator = fmir.collaboratorIds.includes(userId);
    const isQA = user?.role === 'QA_FOOD_SAFETY';
    const sameOrg = user?.organizationId === fmir.organizationId;

    if (!isOwner && !isCollaborator && !(isQA && sameOrg)) {
      res.status(403).json({ success: false, error: 'Access denied' });
      return;
    }

    // Fetch comments, filtering by visibility
    const comments = await prisma.fMIRComment.findMany({
      where: {
        fmirId: id,
        OR: [
          { authorId: userId }, // User's own comments
          { visibleToIds: { has: userId } }, // Comments explicitly visible to user
          { visibleToIds: { isEmpty: true } }, // Comments visible to all
        ],
      },
      include: {
        Author: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            profilePicture: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    res.json({ success: true, data: comments });
  })
);

// Get comments for a specific section
router.get(
  '/:id/comments/section/:sectionNumber',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id, sectionNumber } = req.params;
    const userId = req.user?.id;
    const section = parseInt(sectionNumber, 10);

    if (!userId) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }

    if (isNaN(section) || section < 1 || section > 10) {
      res.status(400).json({ success: false, error: 'Invalid section number' });
      return;
    }

    // Verify user has access to this FMIR
    const fmir = await prisma.foreignMaterialIncident.findUnique({
      where: { id },
      select: {
        id: true,
        createdById: true,
        collaboratorIds: true,
        organizationId: true,
      },
    });

    if (!fmir) {
      res.status(404).json({ success: false, error: 'FMIR not found' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, organizationId: true },
    });

    const isOwner = fmir.createdById === userId;
    const isCollaborator = fmir.collaboratorIds.includes(userId);
    const isQA = user?.role === 'QA_FOOD_SAFETY';
    const sameOrg = user?.organizationId === fmir.organizationId;

    if (!isOwner && !isCollaborator && !(isQA && sameOrg)) {
      res.status(403).json({ success: false, error: 'Access denied' });
      return;
    }

    // Fetch comments for the section, filtering by visibility
    const comments = await prisma.fMIRComment.findMany({
      where: {
        fmirId: id,
        sectionNumber: section,
        OR: [
          { authorId: userId },
          { visibleToIds: { has: userId } },
          { visibleToIds: { isEmpty: true } },
        ],
      },
      include: {
        Author: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            profilePicture: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    res.json({ success: true, data: comments });
  })
);

// Create a comment
router.post(
  '/:id/comments',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { sectionNumber, content, visibleToIds } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }

    if (!sectionNumber || !content) {
      res.status(400).json({ success: false, error: 'Section number and content are required' });
      return;
    }

    const section = parseInt(sectionNumber, 10);
    if (isNaN(section) || section < 1 || section > 10) {
      res.status(400).json({ success: false, error: 'Invalid section number' });
      return;
    }

    // Verify user has access to this FMIR
    const fmir = await prisma.foreignMaterialIncident.findUnique({
      where: { id },
      select: {
        id: true,
        reportNumber: true,
        createdById: true,
        collaboratorIds: true,
        organizationId: true,
      },
    });

    if (!fmir) {
      res.status(404).json({ success: false, error: 'FMIR not found' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, organizationId: true, firstName: true, lastName: true },
    });

    const isOwner = fmir.createdById === userId;
    const isCollaborator = fmir.collaboratorIds.includes(userId);
    const isQA = user?.role === 'QA_FOOD_SAFETY';
    const sameOrg = user?.organizationId === fmir.organizationId;

    if (!isOwner && !isCollaborator && !(isQA && sameOrg)) {
      res.status(403).json({ success: false, error: 'Access denied' });
      return;
    }

    // Create the comment
    const comment = await prisma.fMIRComment.create({
      data: {
        fmirId: id,
        sectionNumber: section,
        content: content.trim(),
        authorId: userId,
        visibleToIds: Array.isArray(visibleToIds) ? visibleToIds : [],
      },
      include: {
        Author: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            profilePicture: true,
          },
        },
      },
    });

    // Determine who to notify (owner + collaborators + QA users, minus current user)
    const allUserIds = new Set([fmir.createdById, ...fmir.collaboratorIds]);
    const qaUsers = await getQAFoodSafetyUsers(fmir.organizationId);
    qaUsers.forEach((uid) => allUserIds.add(uid));
    allUserIds.delete(userId); // Don't notify the author

    // Emit WebSocket event for real-time update
    for (const targetUserId of allUserIds) {
      // Only emit if comment is visible to this user
      const isVisible =
        comment.visibleToIds.length === 0 || comment.visibleToIds.includes(targetUserId);
      if (isVisible) {
        websocketService.emitToUser(targetUserId, 'fmir:comment-added', {
          reportId: id,
          reportNumber: fmir.reportNumber,
          comment,
          addedByName: `${user?.firstName} ${user?.lastName}`,
        });
      }
    }

    res.status(201).json({ success: true, data: comment });
  })
);

// Delete a comment
router.delete(
  '/:id/comments/:commentId',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id, commentId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }

    // Find the comment
    const comment = await prisma.fMIRComment.findUnique({
      where: { id: commentId },
      include: {
        ForeignMaterialIncident: {
          select: {
            id: true,
            reportNumber: true,
            createdById: true,
            collaboratorIds: true,
            organizationId: true,
          },
        },
      },
    });

    if (!comment || comment.fmirId !== id) {
      res.status(404).json({ success: false, error: 'Comment not found' });
      return;
    }

    // Only the author can delete their own comment
    if (comment.authorId !== userId) {
      res.status(403).json({ success: false, error: 'Only the comment author can delete it' });
      return;
    }

    const fmir = comment.ForeignMaterialIncident;

    // Delete the comment
    await prisma.fMIRComment.delete({
      where: { id: commentId },
    });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true },
    });

    // Determine who to notify
    const allUserIds = new Set([fmir.createdById, ...fmir.collaboratorIds]);
    const qaUsers = await getQAFoodSafetyUsers(fmir.organizationId);
    qaUsers.forEach((uid) => allUserIds.add(uid));
    allUserIds.delete(userId);

    // Emit WebSocket event for real-time update
    for (const targetUserId of allUserIds) {
      const wasVisible =
        comment.visibleToIds.length === 0 || comment.visibleToIds.includes(targetUserId);
      if (wasVisible) {
        websocketService.emitToUser(targetUserId, 'fmir:comment-deleted', {
          reportId: id,
          reportNumber: fmir.reportNumber,
          commentId,
          sectionNumber: comment.sectionNumber,
          deletedByName: `${user?.firstName} ${user?.lastName}`,
        });
      }
    }

    res.json({ success: true, message: 'Comment deleted' });
  })
);

// Get comment counts per section for an FMIR
router.get(
  '/:id/comments/counts',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }

    // Verify user has access to this FMIR
    const fmir = await prisma.foreignMaterialIncident.findUnique({
      where: { id },
      select: {
        id: true,
        createdById: true,
        collaboratorIds: true,
        organizationId: true,
      },
    });

    if (!fmir) {
      res.status(404).json({ success: false, error: 'FMIR not found' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, organizationId: true },
    });

    const isOwner = fmir.createdById === userId;
    const isCollaborator = fmir.collaboratorIds.includes(userId);
    const isQA = user?.role === 'QA_FOOD_SAFETY';
    const sameOrg = user?.organizationId === fmir.organizationId;

    if (!isOwner && !isCollaborator && !(isQA && sameOrg)) {
      res.status(403).json({ success: false, error: 'Access denied' });
      return;
    }

    // Get counts per section (only visible comments)
    const comments = await prisma.fMIRComment.findMany({
      where: {
        fmirId: id,
        OR: [
          { authorId: userId },
          { visibleToIds: { has: userId } },
          { visibleToIds: { isEmpty: true } },
        ],
      },
      select: { sectionNumber: true },
    });

    // Build counts object
    const counts: Record<number, number> = {};
    for (let i = 1; i <= 10; i++) {
      counts[i] = 0;
    }
    for (const c of comments) {
      counts[c.sectionNumber] = (counts[c.sectionNumber] || 0) + 1;
    }

    res.json({ success: true, data: counts });
  })
);

export default router;
