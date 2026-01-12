import { Router, Request, Response, NextFunction } from 'express';
import asyncHandler from 'express-async-handler';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';
import { validateIncidentForReport } from '../services/workplaceReportService';
import { 
  generateWorkplaceReportExcel, 
  generateWorkplaceReportPDFFromExcel,
  validateIncidentForExcelReport 
} from '../services/workplaceExcelReportService';

const router = Router();
const prisma = new PrismaClient();

/**
 * @route   POST /api/workplace-report/:incidentId/generate-pdf
 * @desc    Generate a filled PDF report for a workplace safety incident
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
      res.status(403).json({ error: 'You do not have permission to generate workplace reports' });
      return;
    }

    try {
      // Fetch the incident with all related data
      const incident = await prisma.incident.findFirst({
        where: {
          id: incidentId,
          organizationId: userOrgId,
          type: 'WORKPLACE_SAFETY',
        },
        include: {
          Facility: true,
          Area: true,
          Department: true,
          Category: true,
          Line: true,
          Shift: true,
        },
      });

      if (!incident) {
        res.status(404).json({
          error: 'Incident not found',
          details: 'The incident may not exist, may not be a Workplace Safety incident, or you may not have access to it.',
        });
        return;
      }

      // Validate the incident has sufficient data
      const validation = validateIncidentForExcelReport(incident as any);
      
      // Generate the PDF from Excel-based template
      const pdfBuffer = await generateWorkplaceReportPDFFromExcel(incident as any);

      // Set response headers for PDF download
      const fileName = `workplace-report-${incident.incidentNumber}.pdf`;
      
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
      console.error('Error generating workplace report PDF:', error);
      
      if (error.message?.includes('template not found')) {
        res.status(500).json({
          error: 'Excel template not found',
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
 * @route   POST /api/workplace-report/:incidentId/generate-excel
 * @desc    Generate a filled Excel report for a workplace safety incident
 * @access  Private (Supervisors, Safety Managers, Admins)
 */
router.post(
  '/:incidentId/generate-excel',
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
      res.status(403).json({ error: 'You do not have permission to generate workplace reports' });
      return;
    }

    try {
      // Fetch the incident with all related data
      const incident = await prisma.incident.findFirst({
        where: {
          id: incidentId,
          organizationId: userOrgId,
          type: 'WORKPLACE_SAFETY',
        },
        include: {
          Facility: true,
          Area: true,
          Department: true,
          Category: true,
          Line: true,
          Shift: true,
        },
      });

      if (!incident) {
        res.status(404).json({
          error: 'Incident not found',
          details: 'The incident may not exist, may not be a Workplace Safety incident, or you may not have access to it.',
        });
        return;
      }

      // Validate the incident has sufficient data
      const validation = validateIncidentForExcelReport(incident as any);
      
      // Generate the Excel report
      const excelBuffer = await generateWorkplaceReportExcel(incident as any);

      // Set response headers for Excel download
      const fileName = `workplace-report-${incident.incidentNumber}.xlsx`;
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.setHeader('Content-Length', excelBuffer.length);
      
      // Include any warnings in custom header
      if (validation.warnings.length > 0) {
        res.setHeader('X-Report-Warnings', JSON.stringify(validation.warnings));
      }

      // Send the Excel file
      res.send(excelBuffer);

    } catch (error: any) {
      console.error('Error generating workplace report Excel:', error);
      
      if (error.message?.includes('template not found')) {
        res.status(500).json({
          error: 'Excel template not found',
          details: 'The report template is missing. Please contact your system administrator.',
        });
        return;
      }

      res.status(500).json({
        error: 'Failed to generate Excel report',
        details: error.message || 'An unexpected error occurred while generating the report.',
      });
    }
  })
);

/**
 * @route   GET /api/workplace-report/:incidentId/preview-data
 * @desc    Get incident data formatted for report preview
 * @access  Private
 */
router.get(
  '/:incidentId/preview-data',
  authenticate,
  asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthRequest;
    const { incidentId } = req.params;
    const userId = authReq.user?.id;
    const userOrgId = authReq.user?.organizationId;

    if (!userId || !userOrgId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    try {
      const incident = await prisma.incident.findFirst({
        where: {
          id: incidentId,
          organizationId: userOrgId,
          type: 'WORKPLACE_SAFETY',
        },
        include: {
          Facility: true,
          Area: true,
          Department: true,
          Category: true,
          Line: true,
          Shift: true,
        },
      });

      if (!incident) {
        res.status(404).json({ error: 'Incident not found' });
        return;
      }

      // Validate and return the data
      const validation = validateIncidentForReport(incident as any);

      res.json({
        incident: {
          id: incident.id,
          incidentNumber: incident.incidentNumber,
          employeeName: incident.employeeName,
          employeeIdNumber: incident.employeeIdNumber,
          facilityName: incident.Facility?.name,
          departmentName: incident.Department?.name,
          dateOfInjury: incident.dateOfInjury,
          timeOfInjury: incident.timeOfInjury,
          injuryLocation: incident.injuryLocation,
          description: incident.description,
          incidentDescriptionDetailed: incident.incidentDescriptionDetailed,
          bodyPartsAffected: incident.bodyPartsAffected,
          injuryType: incident.injuryType,
          status: incident.status,
        },
        validation,
      });
    } catch (error: any) {
      console.error('Error fetching preview data:', error);
      res.status(500).json({ error: 'Failed to fetch preview data' });
    }
  })
);

/**
 * @route   GET /api/workplace-report/templates
 * @desc    Get available report templates
 * @access  Private (Admin only)
 */
router.get(
  '/templates',
  authenticate,
  asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthRequest;
    const userRole = authReq.user?.role;

    if (!['ADMIN', 'SYSTEM_ADMIN'].includes(userRole || '')) {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    // For now, we just have one template
    res.json({
      templates: [
        {
          id: 'employee-injury-report',
          name: 'Employee Injury/Illness Report Form',
          description: 'Standard workplace safety incident report form',
          incidentTypes: ['WORKPLACE_SAFETY'],
          fields: 87,
        },
      ],
    });
  })
);

export default router;
