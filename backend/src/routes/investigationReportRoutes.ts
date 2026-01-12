import { Router, Request, Response, NextFunction } from 'express';
import asyncHandler from 'express-async-handler';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';
import { generateInvestigationReportPDF, validateIncidentForReport } from '../services/investigationReportService';

const router = Router();
const prisma = new PrismaClient();

/**
 * @route   POST /api/investigation-report/:incidentId/generate-pdf
 * @desc    Generate a filled PDF for Team Leader Investigation Report
 * @access  Private (Supervisors, Safety Managers, Admins)
 */
router.post(
  '/:incidentId/generate-pdf',
  authenticate,
  asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthRequest;
    const { incidentId } = req.params;
    const userId = authReq.user?.id;
    const userOrgId = authReq.user?.organizationId;
    const userRole = authReq.user?.role;

    if (!userId || !userOrgId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Role check - only specific roles can generate reports
    const allowedRoles = [
      'SUPERVISOR',
      'QA_FOOD_SAFETY',
      'MAINTENANCE_ENGINEERING',
      'SAFETY_SECURITY_MANAGER',
      'CI_MANAGER',
      'ADMIN',
      'SYSTEM_ADMIN',
    ];

    if (!userRole || !allowedRoles.includes(userRole)) {
      res.status(403).json({ error: 'You do not have permission to generate investigation reports' });
      return;
    }

    try {
      // Fetch the incident with all related data
      const incident = await prisma.incident.findFirst({
        where: {
          id: incidentId,
          organizationId: userOrgId,
        },
        include: {
          Facility: true,
          Area: true,
          Department: true,
          Category: true,
          Line: true,
          Shift: true,
          User_Incident_assignedToIdToUser: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          User_Incident_createdByIdToUser: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });

      if (!incident) {
        res.status(404).json({
          error: 'Incident not found',
          details: 'The incident may not exist or you may not have access to it.',
        });
        return;
      }

      // Validate the incident has sufficient data
      const validation = validateIncidentForReport(incident as any);
      
      // Generate the PDF
      const pdfBuffer = await generateInvestigationReportPDF(incident as any);

      // Set response headers for PDF download
      const fileName = `investigation-report-${incident.incidentNumber}.pdf`;
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      
      // Include any warnings in custom header
      if (validation.warnings.length > 0) {
        res.setHeader('X-Report-Warnings', JSON.stringify(validation.warnings));
      }

      // Send the PDF
      res.send(pdfBuffer);

    } catch (error: any) {
      console.error('Error generating investigation report PDF:', error);
      
      if (error.message?.includes('template not found')) {
        res.status(500).json({
          error: 'PDF template not found',
          details: 'The report template is missing. Please contact your system administrator.',
        });
        return;
      }
      
      res.status(500).json({
        error: 'Failed to generate report',
        details: error.message || 'An unexpected error occurred while generating the report.',
      });
    }
  })
);

/**
 * @route   GET /api/investigation-report/:incidentId/validate
 * @desc    Validate an incident before generating the investigation report
 * @access  Private
 */
router.get(
  '/:incidentId/validate',
  authenticate,
  asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthRequest;
    const { incidentId } = req.params;
    const userOrgId = authReq.user?.organizationId;

    if (!userOrgId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    try {
      const incident = await prisma.incident.findFirst({
        where: {
          id: incidentId,
          organizationId: userOrgId,
        },
        include: {
          Facility: true,
          Area: true,
          Department: true,
        },
      });

      if (!incident) {
        res.status(404).json({ error: 'Incident not found' });
        return;
      }

      const validation = validateIncidentForReport(incident as any);
      
      res.json({
        incidentId,
        incidentNumber: incident.incidentNumber,
        ...validation,
      });

    } catch (error: any) {
      console.error('Error validating incident for report:', error);
      res.status(500).json({
        error: 'Validation failed',
        details: error.message,
      });
    }
  })
);

/**
 * @route   GET /api/investigation-report/incidents
 * @desc    Get all incidents that can have investigation reports generated
 * @access  Private
 */
router.get(
  '/incidents',
  authenticate,
  asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthRequest;
    const userOrgId = authReq.user?.organizationId;
    const { type, status, search } = req.query;

    if (!userOrgId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    try {
      const whereClause: any = {
        organizationId: userOrgId,
        // Only show WORKPLACE_SAFETY incidents for Team Leader Investigation Reports
        type: 'WORKPLACE_SAFETY',
      };

      // Filter by status if specified
      if (status && status !== 'ALL') {
        whereClause.status = status;
      }

      // Search filter
      if (search) {
        whereClause.OR = [
          { incidentNumber: { contains: search as string, mode: 'insensitive' } },
          { customTitle: { contains: search as string, mode: 'insensitive' } },
          { employeeName: { contains: search as string, mode: 'insensitive' } },
          { description: { contains: search as string, mode: 'insensitive' } },
        ];
      }

      const incidents = await prisma.incident.findMany({
        where: whereClause,
        select: {
          id: true,
          incidentNumber: true,
          customTitle: true,
          type: true,
          status: true,
          severity: true,
          occurredAt: true,
          reportedAt: true,
          employeeName: true,
          description: true,
          Facility: {
            select: { name: true },
          },
          Department: {
            select: { name: true },
          },
          Area: {
            select: { name: true },
          },
        },
        orderBy: {
          occurredAt: 'desc',
        },
        take: 100,
      });

      res.json({
        incidents,
        total: incidents.length,
      });

    } catch (error: any) {
      console.error('Error fetching incidents for investigation reports:', error);
      res.status(500).json({
        error: 'Failed to fetch incidents',
        details: error.message,
      });
    }
  })
);

export default router;
