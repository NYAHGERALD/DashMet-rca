import { Router, Request, Response, NextFunction } from 'express';
import asyncHandler from 'express-async-handler';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requireMinimumRole, requirePrivilege, hasPrivilege } from '../middleware/rbac';
import { UserRole } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { ValidationError } from '../middleware/errorHandler';
import { uploadMultiple, handleMulterError, validateFileContent } from '../middleware/upload';
import { adminStorage } from '../config/firebase-admin';
import { generateIncidentSummary } from '../services/aiService';
import { triageIncident, applyTriageToIncident } from '../services/triageService';
import { notifyIncidentSubmitted, notifyIncidentAssignment, notifyIncidentStatusChange } from '../services/notificationService';
import { logAuditFromRequest } from '../services/auditService';
import { createStatusUpdateMessage } from './chatRoutes';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// All routes require authentication
router.use(authenticate);

// GET /api/incidents - List incidents with filters
router.get('/', async (req: Request, res: Response) => {
  const {
    status,
    type,
    facilityId,
    lineId,
    assignedToId,
    createdById,
    severity,
    scope, // 'my' (private only), 'team' (team incidents), 'public' (public incidents), or undefined (all visible)
    page = '1',
    limit = '20',
  } = req.query;
  
  const currentUserId = (req as any).user?.id;
  const currentUserOrgId = (req as any).user?.organizationId;

  const pageNum = parseInt(page as string);
  const limitNum = parseInt(limit as string);
  const skip = (pageNum - 1) * limitNum;

  // CRITICAL: Always filter by organization to ensure data isolation
  const where: any = {
    organizationId: currentUserOrgId,
  };

  if (status) where.status = status;
  if (type) where.type = type;
  if (facilityId) where.facilityId = facilityId;
  if (lineId) where.lineId = lineId;
  if (assignedToId) where.assignedToId = assignedToId;
  if (createdById) where.createdById = createdById;
  if (severity) where.severity = severity;
  
  // Scope-based filtering:
  // - 'my': Only PRIVATE incidents created by the current user
  // - 'team': TEAM incidents where user is creator, assignee, or active participant
  // - 'public': All PUBLIC incidents in the organization
  // - undefined/all: Show all visible incidents (default behavior)
  if (scope === 'my') {
    // My Incidents: Only private incidents created by the user
    where.visibility = 'PRIVATE';
    where.createdById = currentUserId;
  } else if (scope === 'team') {
    // Team Incidents: Team incidents where user is involved
    where.visibility = 'TEAM';
    where.OR = [
      { createdById: currentUserId },
      { assignedToId: currentUserId },
      { IncidentParticipant: { some: { userId: currentUserId, isActive: true, invitationStatus: 'ACCEPTED' } } },
    ];
  } else if (scope === 'public') {
    // Public Incidents: All public incidents in the organization
    where.visibility = 'PUBLIC';
  } else {
    // Default: Show all incidents visible to the user
    // Visibility filter:
    // - PUBLIC incidents are visible to all users in the organization
    // - PRIVATE incidents are visible only to: creator
    // - TEAM incidents are visible to: creator, assignee, or participants who have ACCEPTED the invitation
    where.OR = [
      { visibility: 'PUBLIC' },
      { visibility: 'PRIVATE', createdById: currentUserId },
      { visibility: 'TEAM', createdById: currentUserId },
      { visibility: 'TEAM', assignedToId: currentUserId },
      { visibility: 'TEAM', IncidentParticipant: { some: { userId: currentUserId, isActive: true, invitationStatus: 'ACCEPTED' } } },
    ];
  }

  const [incidents, total] = await Promise.all([
    prisma.incident.findMany({
      where,
      include: {
        Facility: {
          select: { id: true, name: true },
        },
        Line: {
          select: { id: true, name: true },
        },
        Area: {
          select: { id: true, name: true },
        },
        Category: {
          select: { id: true, name: true },
        },
        User_Incident_createdByIdToUser: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        User_Incident_assignedToIdToUser: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        Shift: {
          select: { id: true, name: true },
        },
        RCAAnalysis: {
          select: {
            id: true,
            method: true,
            status: true,
            aiRecommendedMethod: true,
            aiRecommendationReason: true,
            rootCauseStatement: true,
            isValidated: true,
            validatedAt: true,
            createdAt: true,
            updatedAt: true,
            User: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limitNum,
    }),
    prisma.incident.count({ where }),
  ]);

  res.json({
    success: true,
    data: {
      incidents,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    },
  });
});

// GET /api/incidents/dashboard/stats - Dashboard statistics
// For ADMIN/SUPERVISOR: Shows organization-wide stats
// For other roles: Shows only the user's own incidents
router.get('/dashboard/stats', async (req: Request, res: Response) => {
  const { timeRange = '30d' } = req.query;
  const currentUserId = (req as any).user?.id;
  const currentUserOrgId = (req as any).user?.organizationId;
  const currentUserRole = (req as any).user?.role;
  
  // Calculate date range
  const days = timeRange === '7d' ? 7 : timeRange === '90d' ? 90 : 30;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  // Determine if user should see org-wide data or just their own
  // ADMIN and CI_MANAGER see org-wide data, others see only their own incidents
  const isOrgAdmin = currentUserRole === 'ADMIN' || currentUserRole === 'CI_MANAGER' || currentUserRole === 'SYSTEM_ADMIN';
  
  // Build the where clause based on role
  const incidentWhere: any = {
    createdAt: { gte: startDate },
    organizationId: currentUserOrgId, // Always filter by organization
  };
  
  // For non-admin users, only show incidents they created
  if (!isOrgAdmin) {
    incidentWhere.createdById = currentUserId;
  }
  
  try {
    // Get all incidents within the time range (scoped by role)
    const incidents = await prisma.incident.findMany({
      where: incidentWhere,
      include: {
        Category: { select: { id: true, name: true } },
        RCAAnalysis: { select: { id: true, status: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Calculate basic stats
    const totalIncidents = incidents.length;
    const openIncidents = incidents.filter(i => i.status === 'SUBMITTED' || i.status === 'IN_TRIAGE').length;
    const inProgressIncidents = incidents.filter(i => i.status === 'IN_PROGRESS').length;
    const closedIncidents = incidents.filter(i => i.status === 'CLOSED' || i.status === 'REJECTED').length;
    const criticalIncidents = incidents.filter(i => i.severity === 'CRITICAL').length;

    // RCA stats
    const rcaInProgress = incidents.filter(i => 
      i.RCAAnalysis && i.RCAAnalysis.some((r: any) => r.status === 'IN_PROGRESS' || r.status === 'DRAFT')
    ).length;
    const rcaCompleted = incidents.filter(i => 
      i.RCAAnalysis && i.RCAAnalysis.some((r: any) => r.status === 'COMPLETED' || r.status === 'VALIDATED')
    ).length;

    // CAPA stats - filter based on incidents from the same scope
    // Get RCA IDs linked to these incidents
    const rcaIds = incidents.flatMap(i => i.RCAAnalysis?.map((r: any) => r.id) || []);
    
    let capaOpen = 0;
    let capaOverdue = 0;
    
    // Only query CAPA if we have RCAs
    if (rcaIds.length > 0) {
      const capaStats = await prisma.cAPAction.groupBy({
        by: ['status'],
        _count: true,
        where: {
          createdAt: { gte: startDate },
          rcaAnalysisId: { in: rcaIds },
        },
      });
      capaOpen = capaStats.filter(s => s.status === 'PLANNED' || s.status === 'IN_PROGRESS').reduce((sum, s) => sum + s._count, 0);
      capaOverdue = await prisma.cAPAction.count({
        where: {
          status: { in: ['PLANNED', 'IN_PROGRESS'] },
          dueDate: { lt: new Date() },
          rcaAnalysisId: { in: rcaIds },
        },
      });
    }

    // Calculate average resolution time (in days) for resolved incidents
    const resolvedIncidents = incidents.filter(i => i.resolvedAt && i.createdAt);
    let avgResolutionTime = 0;
    if (resolvedIncidents.length > 0) {
      const totalTime = resolvedIncidents.reduce((sum, i) => {
        const created = new Date(i.createdAt).getTime();
        const resolved = new Date(i.resolvedAt!).getTime();
        return sum + (resolved - created);
      }, 0);
      avgResolutionTime = Math.round((totalTime / resolvedIncidents.length / (1000 * 60 * 60 * 24)) * 10) / 10;
    }

    // Generate trend data (group by day/week based on time range)
    const groupByDays = days <= 7 ? 1 : days <= 30 ? 5 : 15;
    const trendData: { name: string; date: string; incidents: number; resolved: number }[] = [];
    
    for (let i = Math.ceil(days / groupByDays) - 1; i >= 0; i--) {
      const periodEnd = new Date();
      periodEnd.setDate(periodEnd.getDate() - (i * groupByDays));
      const periodStart = new Date(periodEnd);
      periodStart.setDate(periodStart.getDate() - groupByDays);
      
      const periodIncidents = incidents.filter(inc => {
        const date = new Date(inc.createdAt);
        return date >= periodStart && date < periodEnd;
      });
      
      const resolvedInPeriod = incidents.filter(inc => {
        if (!inc.resolvedAt) return false;
        const date = new Date(inc.resolvedAt);
        return date >= periodStart && date < periodEnd;
      });
      
      trendData.push({
        name: periodEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), // Fallback for compatibility
        date: periodEnd.toISOString(), // ISO timestamp for proper timezone handling
        incidents: periodIncidents.length,
        resolved: resolvedInPeriod.length,
      });
    }

    // Category distribution
    const categoryMap: Record<string, number> = {};
    incidents.forEach(i => {
      const cat = i.Category?.name || 'Uncategorized';
      categoryMap[cat] = (categoryMap[cat] || 0) + 1;
    });
    const incidentsByCategory = Object.entries(categoryMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);

    // Severity distribution
    const severityMap: Record<string, number> = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
    incidents.forEach(i => {
      if (i.severity && severityMap[i.severity] !== undefined) {
        severityMap[i.severity]++;
      }
    });
    const totalSeverity = Object.values(severityMap).reduce((a, b) => a + b, 0) || 1;
    const incidentsBySeverity = [
      { name: 'Critical', value: severityMap.CRITICAL, percentage: Math.round((severityMap.CRITICAL / totalSeverity) * 100), color: '#ef4444' },
      { name: 'High', value: severityMap.HIGH, percentage: Math.round((severityMap.HIGH / totalSeverity) * 100), color: '#f97316' },
      { name: 'Medium', value: severityMap.MEDIUM, percentage: Math.round((severityMap.MEDIUM / totalSeverity) * 100), color: '#eab308' },
      { name: 'Low', value: severityMap.LOW, percentage: Math.round((severityMap.LOW / totalSeverity) * 100), color: '#22c55e' },
    ];

    // Weekly performance (last 7 days)
    const weeklyPerformance: { day: string; created: number; resolved: number }[] = [];
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      const nextDay = new Date(date);
      nextDay.setDate(nextDay.getDate() + 1);
      
      const dayIncidents = incidents.filter(inc => {
        const created = new Date(inc.createdAt);
        return created >= date && created < nextDay;
      });
      
      const dayResolved = incidents.filter(inc => {
        if (!inc.resolvedAt) return false;
        const resolved = new Date(inc.resolvedAt);
        return resolved >= date && resolved < nextDay;
      });
      
      weeklyPerformance.push({
        day: dayNames[date.getDay()],
        created: dayIncidents.length,
        resolved: dayResolved.length,
      });
    }

    // Calculate trend percentages (compare to previous period) - scoped the same way
    const previousStartDate = new Date(startDate);
    previousStartDate.setDate(previousStartDate.getDate() - days);
    
    const previousIncidentWhere: any = {
      createdAt: { gte: previousStartDate, lt: startDate },
      organizationId: currentUserOrgId,
    };
    if (!isOrgAdmin) {
      previousIncidentWhere.createdById = currentUserId;
    }
    
    const previousIncidents = await prisma.incident.count({
      where: previousIncidentWhere,
    });
    
    const trendPercentage = previousIncidents > 0 
      ? Math.round(((totalIncidents - previousIncidents) / previousIncidents) * 100)
      : 0;

    res.json({
      success: true,
      data: {
        totalIncidents,
        openIncidents,
        closedIncidents,
        inProgressIncidents,
        criticalIncidents,
        rcaInProgress,
        rcaCompleted,
        capaOpen,
        capaOverdue,
        avgResolutionTime,
        trendPercentage,
        incidentsTrend: trendData,
        incidentsByCategory,
        incidentsBySeverity,
        weeklyPerformance,
        // Add context about what data is being shown
        dataScope: isOrgAdmin ? 'organization' : 'user',
      },
    });
  } catch (error: any) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard statistics',
    });
  }
});

// GET /api/incidents/:id - Get single incident with full details
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const currentUserId = (req as any).user?.id;

  const incident = await prisma.incident.findUnique({
    where: { id },
    include: {
      Facility: true,
      Line: true,
      Area: true,
      Category: true,
      Shift: true,
      User_Incident_createdByIdToUser: {
        select: { id: true, firstName: true, lastName: true, email: true, role: true },
      },
      User_Incident_assignedToIdToUser: {
        select: { id: true, firstName: true, lastName: true, email: true, role: true },
      },
      Evidence: {
        select: {
          id: true,
          type: true,
          fileName: true,
          filePath: true,
          fileSize: true,
          mimeType: true,
          transcription: true,
          uploadedById: true,
          uploadedAt: true,
        },
      },
      Comment: {
        include: {
          User: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
        orderBy: { createdAt: 'asc' },
      },
      RCAAnalysis: {
        select: { id: true, status: true, method: true },
      },
      // Include participants for team incidents (with invitation status)
      IncidentParticipant: {
        where: { isActive: true },
        select: {
          id: true,
          userId: true,
          role: true,
          isActive: true,
          invitationStatus: true,
          joinedAt: true,
          canEdit: true,
          canChat: true,
          User_IncidentParticipant_userIdToUser: {
            select: { id: true, firstName: true, lastName: true, email: true, role: true, isOnline: true, profilePicture: true },
          },
        },
      },
      // Include FMIR report if this incident was created from an FMIR
      FMIRReport: {
        include: {
          Facility: true,
          FMIREvidence: {
            select: {
              id: true,
              fileName: true,
              type: true,
              filePath: true,
              fileSize: true,
              mimeType: true,
              description: true,
              uploadedAt: true,
            },
            orderBy: { uploadedAt: 'asc' },
          },
          FMIRAIValidation: true,
          User_ForeignMaterialIncident_createdByIdToUser: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      },
    },
  });

  if (!incident) {
    throw new ValidationError('Incident not found');
  }

  // Visibility check:
  // - PUBLIC: anyone in org can view
  // - PRIVATE: only creator can view
  // - TEAM: creator, assignee, or participants with ACCEPTED invitation can view
  const isCreator = incident.createdById === currentUserId;
  const isAssignee = incident.assignedToId === currentUserId;
  const isAcceptedParticipant = incident.IncidentParticipant?.some(
    (p: any) => p.userId === currentUserId && p.isActive && p.invitationStatus === 'ACCEPTED'
  );
  
  if (incident.visibility === 'PRIVATE' && !isCreator) {
    throw new ValidationError('You do not have permission to view this incident');
  }
  
  if (incident.visibility === 'TEAM' && !isCreator && !isAssignee && !isAcceptedParticipant) {
    throw new ValidationError('You do not have permission to view this incident');
  }

  res.json({
    success: true,
    data: incident,
  });
}));

// POST /api/incidents - Create incident
router.post('/', requirePrivilege('incidents.create'), async (req, res) => {
  const {
    type,
    categoryId,
    customTitle,
    description,
    aiSummary,
    aiAnalysisData,
    facilityId,
    areaId,
    lineId,
    shiftId,
    productName,
    lotNumber,
    machineId,
    occurredAt,
    severity,
    status = 'DRAFT',
    // Workplace Safety specific fields
    injuryType,
    bodyPartsAffected,
    bodyPartsAffectedNA,
    otherBodyPartDetail,
    taskBeingPerformed,
    isRoutineTask,
    exposureDuration,
    taskFrequency,
    weightOrForce,
    environmentalConditions,
    environmentalConditionsNA,
    ppeRequired,
    ppeWorn,
    machineSafeguardsInPlace,
    lotoRequired,
    sopAvailable,
    sopFollowed,
    firstAidProvided,
    medicalTreatmentRequired,
    supervisorNotified,
    areaSecured,
    directCause,
    contributingFactors,
    unsafeActOrCondition,
    previousSimilarIncidents,
    // Regulatory & Workers' Compensation fields
    priorSurgeryPerformed,
    priorSurgeryDescription,
    treatingDoctors,
    employedElsewhere,
    additionalEmployers,
    additionalEmployerHours,
    additionalEmployerStartDate,
    workedForOtherLast6Months,
    otherEmployerNames,
    injuryDevelopedOverTime,
    dateOfInjury,
    timeOfInjury,
    injuryLocation,
    injuryCausedByWork,
    injuryWitnessed,
    witnessNames,
    dateInjuryKnownWorkRelated,
    allBodyPartsInjured,
    notifiedIndividuals,
    injuryDescriptionDetailed,
    contributingActsConditions,
    reportedToMedicalDept,
    medicalProvidersInvolved,
    injuryTypeDescription,
    previousSimilarConditionReported,
    previousSimilarConditionDetails,
    // Employee Information fields
    employeeLastSSN4,
    employeeHomeAddress,
    employeeEmail,
    employeePhone,
    employeeLanguage,
    needsInterpreter,
    employeeGender,
    interpreterAssisting,
    // Job/Compliance fields
    ownedJobTitle,
    jobAssignmentAtInjury,
    departmentWhereInjury,
    oshaCaseNumber,
    isLostTime,
    wasViolationOfSafetyRules,
    wasProperProcedureFollowed,
    wasEmployeeInstructedInSOP,
    // Additional form fields (dropdown-driven)
    injuryDevelopmentType,
    taskRoutineType,
    contributingFactorTypes,
    correctiveActionTypes,
    incidentPattern,
    weightOrForceUnit,
    // Team collaboration & visibility
    isTeamIncident,
    visibility,
    participants,
  } = req.body;

  // Validation
  if (!type || !categoryId || !facilityId || !description) {
    throw new ValidationError('Type, category, facility, and description are required');
  }

  // Validate visibility value
  const validVisibility = visibility || 'PRIVATE';
  if (!['PRIVATE', 'TEAM', 'PUBLIC'].includes(validVisibility)) {
    throw new ValidationError('Invalid visibility value. Must be PRIVATE, TEAM, or PUBLIC');
  }

  // Visibility-specific validation
  if (validVisibility === 'TEAM') {
    // TEAM visibility requires isTeamIncident to be true
    if (!isTeamIncident) {
      throw new ValidationError('Team visibility requires team collaboration to be enabled');
    }
    // TEAM visibility requires at least one participant
    if (!participants || !Array.isArray(participants) || participants.length === 0) {
      throw new ValidationError('Team incidents require at least one team member to be added');
    }
  }

  if (validVisibility === 'PUBLIC' && isTeamIncident) {
    throw new ValidationError('Public incidents cannot have team collaboration enabled');
  }

  // Get user from auth middleware
  const user = (req as any).user;

  // Validate foreign key references exist
  let validShiftId = shiftId || null;
  let validLineId = lineId || null;
  let validAreaId = areaId || null;
  
  if (shiftId) {
    const shiftExists = await prisma.shift.findUnique({ where: { id: shiftId } });
    if (!shiftExists) {
      console.warn(`Invalid shiftId: ${shiftId} - setting to null`);
      validShiftId = null;
    }
  }
  if (lineId) {
    const lineExists = await prisma.line.findUnique({ where: { id: lineId } });
    if (!lineExists) {
      console.warn(`Invalid lineId: ${lineId} - setting to null`);
      validLineId = null;
    }
  }
  if (areaId) {
    const areaExists = await prisma.area.findUnique({ where: { id: areaId } });
    if (!areaExists) {
      console.warn(`Invalid areaId: ${areaId} - setting to null`);
      validAreaId = null;
    }
  }

  // Generate incident number - use MAX incidentNumber to avoid duplicates
  const lastIncident = await prisma.incident.findFirst({
    orderBy: { incidentNumber: 'desc' },
    select: { incidentNumber: true },
  });
  
  let nextNumber = 1;
  if (lastIncident?.incidentNumber) {
    const match = lastIncident.incidentNumber.match(/INC-(\d+)/);
    if (match) {
      nextNumber = parseInt(match[1], 10) + 1;
    }
  }
  const incidentNumber = `INC-${String(nextNumber).padStart(6, '0')}`;

  // Build incident data object
  const incidentData: any = {
    incidentNumber,
    type: type as any,
    categoryId,
    customTitle,
    description,
    aiSummary,
    aiAnalysisData: aiAnalysisData || null,
    facilityId,
    areaId: validAreaId,
    lineId: validLineId,
    shiftId: validShiftId,
    productName,
    lotNumber,
    machineId,
    occurredAt: occurredAt ? new Date(occurredAt) : new Date(),
    severity: severity as any || 'MEDIUM',
    status: status as any,
    createdById: user.id,
    organizationId: user.organizationId,
    visibility: validVisibility as any,
    isTeamIncident: isTeamIncident || false,
  };

  // Add Workplace Safety specific fields if type is WORKPLACE_SAFETY
  if (type === 'WORKPLACE_SAFETY') {
    Object.assign(incidentData, {
      injuryType,
      bodyPartsAffected: bodyPartsAffected || [],
      bodyPartsAffectedNA,
      otherBodyPartDetail,
      taskBeingPerformed,
      isRoutineTask,
      exposureDuration,
      taskFrequency,
      weightOrForce,
      environmentalConditions: environmentalConditions || [],
      environmentalConditionsNA,
      ppeRequired,
      ppeWorn,
      machineSafeguardsInPlace,
      lotoRequired,
      sopAvailable,
      sopFollowed,
      firstAidProvided,
      medicalTreatmentRequired,
      supervisorNotified,
      areaSecured,
      directCause,
      contributingFactors: contributingFactors || null,
      unsafeActOrCondition,
      previousSimilarIncidents,
      // Regulatory & Workers' Compensation fields
      priorSurgeryPerformed,
      priorSurgeryDescription,
      treatingDoctors,
      employedElsewhere,
      additionalEmployers,
      additionalEmployerHours,
      additionalEmployerStartDate: additionalEmployerStartDate ? new Date(additionalEmployerStartDate) : null,
      workedForOtherLast6Months,
      otherEmployerNames,
      injuryDevelopedOverTime,
      dateOfInjury: dateOfInjury ? new Date(dateOfInjury) : null,
      timeOfInjury,
      injuryLocation,
      injuryCausedByWork,
      injuryWitnessed,
      witnessNames,
      dateInjuryKnownWorkRelated: dateInjuryKnownWorkRelated ? new Date(dateInjuryKnownWorkRelated) : null,
      allBodyPartsInjured,
      notifiedIndividuals,
      injuryDescriptionDetailed,
      contributingActsConditions,
      reportedToMedicalDept,
      medicalProvidersInvolved,
      injuryTypeDescription,
      previousSimilarConditionReported,
      previousSimilarConditionDetails,
      // Employee Information fields
      employeeLastSSN4,
      employeeHomeAddress,
      employeeEmail,
      employeePhone,
      employeeLanguage,
      needsInterpreter,
      employeeGender,
      interpreterAssisting,
      // Job/Compliance fields
      ownedJobTitle,
      jobAssignmentAtInjury,
      departmentWhereInjury,
      oshaCaseNumber,
      isLostTime,
      wasViolationOfSafetyRules,
      wasProperProcedureFollowed,
      wasEmployeeInstructedInSOP,
      // Additional form fields (dropdown-driven)
      injuryDevelopmentType,
      taskRoutineType,
      contributingFactorTypes: contributingFactorTypes || [],
      correctiveActionTypes: correctiveActionTypes || [],
      incidentPattern,
      weightOrForceUnit,
    });
  }

  const incident = await prisma.incident.create({
    data: incidentData,
    include: {
      Facility: {
        select: { id: true, name: true },
      },
      Category: {
        select: { id: true, name: true },
      },
      User_Incident_createdByIdToUser: {
        select: { id: true, firstName: true, lastName: true },
      },
    },
  });

  // Create team participants if this is a team incident
  if (isTeamIncident && participants && Array.isArray(participants) && participants.length > 0) {
    const participantData = participants.map((p: any) => ({
      id: uuidv4(),
      incidentId: incident.id,
      userId: p.userId,
      role: p.role || 'MEMBER',
      canEdit: p.canEdit !== undefined ? p.canEdit : true,
      canChat: p.canChat !== undefined ? p.canChat : true,
      addedById: user.id,
      updatedAt: new Date(),
    }));

    await prisma.incidentParticipant.createMany({
      data: participantData,
      skipDuplicates: true,
    });
  }

  // Also add the creator as an OWNER participant for team incidents
  if (isTeamIncident) {
    await prisma.incidentParticipant.create({
      data: {
        id: uuidv4(),
        incidentId: incident.id,
        userId: user.id,
        role: 'OWNER',
        canEdit: true,
        canChat: true,
        addedById: user.id,
        invitationStatus: 'ACCEPTED',  // Owner auto-accepts their own invitation
        respondedAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }

  // Audit log: Incident created
  await logAuditFromRequest(req as AuthRequest, 'CREATE', 'Incident', incident.id, {
    incidentNumber: incident.incidentNumber,
    type: incident.type,
    status: incident.status,
    visibility: incident.visibility,
    severity: incident.severity,
  });

  res.status(201).json({
    success: true,
    data: incident,
  });
});

// PATCH /api/incidents/:id - Update incident
router.patch('/:id', requirePrivilege('incidents.edit'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const {
      customTitle,
      description,
      aiSummary,
      aiAnalysisData,
      categoryId,
      areaId,
      lineId,
      shiftId,
      productName,
      lotNumber,
      machineId,
      occurredAt,
      severity,
      status,
      assignedToId,
      // Workplace Safety specific fields
      injuryType,
      bodyPartsAffected,
      bodyPartsAffectedNA,
      otherBodyPartDetail,
      taskBeingPerformed,
      isRoutineTask,
      exposureDuration,
      taskFrequency,
      weightOrForce,
      environmentalConditions,
      environmentalConditionsNA,
      ppeRequired,
      ppeWorn,
      machineSafeguardsInPlace,
      lotoRequired,
      sopAvailable,
      sopFollowed,
      firstAidProvided,
      medicalTreatmentRequired,
      supervisorNotified,
      areaSecured,
      directCause,
      contributingFactors,
      unsafeActOrCondition,
      previousSimilarIncidents,
      // Regulatory & Workers' Compensation fields
      priorSurgeryPerformed,
      priorSurgeryDescription,
      treatingDoctors,
      employedElsewhere,
      additionalEmployers,
      additionalEmployerHours,
      additionalEmployerStartDate,
      workedForOtherLast6Months,
      otherEmployerNames,
      injuryDevelopedOverTime,
      dateOfInjury,
      timeOfInjury,
      injuryLocation,
      injuryCausedByWork,
      injuryWitnessed,
      witnessNames,
      dateInjuryKnownWorkRelated,
      allBodyPartsInjured,
      notifiedIndividuals,
      injuryDescriptionDetailed,
      contributingActsConditions,
      reportedToMedicalDept,
      medicalProvidersInvolved,
      injuryTypeDescription,
      previousSimilarConditionReported,
      previousSimilarConditionDetails,
      // Employee Information fields
      employeeLastSSN4,
      employeeHomeAddress,
      employeeEmail,
      employeePhone,
      employeeLanguage,
      needsInterpreter,
      employeeGender,
      interpreterAssisting,
      // Job/Compliance fields
      ownedJobTitle,
      jobAssignmentAtInjury,
      departmentWhereInjury,
      oshaCaseNumber,
      isLostTime,
      wasViolationOfSafetyRules,
      wasProperProcedureFollowed,
      wasEmployeeInstructedInSOP,
      // Additional form fields (dropdown-driven)
      injuryDevelopmentType,
      taskRoutineType,
      contributingFactorTypes,
      correctiveActionTypes,
      incidentPattern,
      weightOrForceUnit,
    } = req.body;

    const user = (req as any).user;

    // Check if incident exists and user has permission
    const existing = await prisma.incident.findUnique({
      where: { id },
      select: { createdById: true, status: true, assignedToId: true, type: true },
    });

    if (!existing) {
      throw new ValidationError('Incident not found');
    }

    // Only creator or assigned user can edit, or ADMIN+
    const canEdit =
      existing.createdById === user.id ||
      existing.assignedToId === user.id ||
      user.role === UserRole.ADMIN ||
      user.role === UserRole.SYSTEM_ADMIN;

    if (!canEdit) {
      throw new ValidationError('You do not have permission to edit this incident');
    }

    const oldStatus = existing.status;
    const oldAssignee = existing.assignedToId;

    // Build update data
    const updateData: any = {
      ...(customTitle !== undefined && { customTitle }),
      ...(description !== undefined && { description }),
      ...(aiSummary !== undefined && { aiSummary }),
      ...(aiAnalysisData !== undefined && { aiAnalysisData }),
      ...(categoryId && { categoryId }),
      ...(areaId && { areaId }),
      ...(lineId && { lineId }),
      ...(shiftId && { shiftId }),
      ...(productName && { productName }),
      ...(lotNumber && { lotNumber }),
      ...(machineId && { machineId }),
      ...(occurredAt && { occurredAt: new Date(occurredAt) }),
      ...(severity && { severity: severity as any }),
      ...(status && { status: status as any }),
      ...(assignedToId && { assignedToId }),
      // Mark resolved if status is CLOSED
      ...(status === 'CLOSED' && { resolvedAt: new Date() }),
    };

    // Add Workplace Safety specific fields if this is a safety incident
    if (existing.type === 'WORKPLACE_SAFETY') {
      Object.assign(updateData, {
        ...(injuryType !== undefined && { injuryType }),
        ...(bodyPartsAffected !== undefined && { bodyPartsAffected }),
        ...(bodyPartsAffectedNA !== undefined && { bodyPartsAffectedNA }),
        ...(otherBodyPartDetail !== undefined && { otherBodyPartDetail }),
        ...(taskBeingPerformed !== undefined && { taskBeingPerformed }),
        ...(isRoutineTask !== undefined && { isRoutineTask }),
        ...(exposureDuration !== undefined && { exposureDuration }),
        ...(taskFrequency !== undefined && { taskFrequency }),
        ...(weightOrForce !== undefined && { weightOrForce }),
        ...(environmentalConditions !== undefined && { environmentalConditions }),
        ...(environmentalConditionsNA !== undefined && { environmentalConditionsNA }),
        ...(ppeRequired !== undefined && { ppeRequired }),
        ...(ppeWorn !== undefined && { ppeWorn }),
        ...(machineSafeguardsInPlace !== undefined && { machineSafeguardsInPlace }),
        ...(lotoRequired !== undefined && { lotoRequired }),
        ...(sopAvailable !== undefined && { sopAvailable }),
        ...(sopFollowed !== undefined && { sopFollowed }),
        ...(firstAidProvided !== undefined && { firstAidProvided }),
        ...(medicalTreatmentRequired !== undefined && { medicalTreatmentRequired }),
        ...(supervisorNotified !== undefined && { supervisorNotified }),
        ...(areaSecured !== undefined && { areaSecured }),
        ...(directCause !== undefined && { directCause }),
        ...(contributingFactors !== undefined && { contributingFactors }),
        ...(unsafeActOrCondition !== undefined && { unsafeActOrCondition }),
        ...(previousSimilarIncidents !== undefined && { previousSimilarIncidents }),
        // Regulatory & Workers' Compensation fields
        ...(priorSurgeryPerformed !== undefined && { priorSurgeryPerformed }),
        ...(priorSurgeryDescription !== undefined && { priorSurgeryDescription }),
        ...(treatingDoctors !== undefined && { treatingDoctors }),
        ...(employedElsewhere !== undefined && { employedElsewhere }),
        ...(additionalEmployers !== undefined && { additionalEmployers }),
        ...(additionalEmployerHours !== undefined && { additionalEmployerHours }),
        ...(additionalEmployerStartDate !== undefined && { additionalEmployerStartDate: additionalEmployerStartDate ? new Date(additionalEmployerStartDate) : null }),
        ...(workedForOtherLast6Months !== undefined && { workedForOtherLast6Months }),
        ...(otherEmployerNames !== undefined && { otherEmployerNames }),
        ...(injuryDevelopedOverTime !== undefined && { injuryDevelopedOverTime }),
        ...(dateOfInjury !== undefined && { dateOfInjury: dateOfInjury ? new Date(dateOfInjury) : null }),
        ...(timeOfInjury !== undefined && { timeOfInjury }),
        ...(injuryLocation !== undefined && { injuryLocation }),
        ...(injuryCausedByWork !== undefined && { injuryCausedByWork }),
        ...(injuryWitnessed !== undefined && { injuryWitnessed }),
        ...(witnessNames !== undefined && { witnessNames }),
        ...(dateInjuryKnownWorkRelated !== undefined && { dateInjuryKnownWorkRelated: dateInjuryKnownWorkRelated ? new Date(dateInjuryKnownWorkRelated) : null }),
        ...(allBodyPartsInjured !== undefined && { allBodyPartsInjured }),
        ...(notifiedIndividuals !== undefined && { notifiedIndividuals }),
        ...(injuryDescriptionDetailed !== undefined && { injuryDescriptionDetailed }),
        ...(contributingActsConditions !== undefined && { contributingActsConditions }),
        ...(reportedToMedicalDept !== undefined && { reportedToMedicalDept }),
        ...(medicalProvidersInvolved !== undefined && { medicalProvidersInvolved }),
        ...(injuryTypeDescription !== undefined && { injuryTypeDescription }),
        ...(previousSimilarConditionReported !== undefined && { previousSimilarConditionReported }),
        ...(previousSimilarConditionDetails !== undefined && { previousSimilarConditionDetails }),
        // Employee Information fields
        ...(employeeLastSSN4 !== undefined && { employeeLastSSN4 }),
        ...(employeeHomeAddress !== undefined && { employeeHomeAddress }),
        ...(employeeEmail !== undefined && { employeeEmail }),
        ...(employeePhone !== undefined && { employeePhone }),
        ...(employeeLanguage !== undefined && { employeeLanguage }),
        ...(needsInterpreter !== undefined && { needsInterpreter }),
        ...(employeeGender !== undefined && { employeeGender }),
        ...(interpreterAssisting !== undefined && { interpreterAssisting }),
        // Job/Compliance fields
        ...(ownedJobTitle !== undefined && { ownedJobTitle }),
        ...(jobAssignmentAtInjury !== undefined && { jobAssignmentAtInjury }),
        ...(departmentWhereInjury !== undefined && { departmentWhereInjury }),
        ...(oshaCaseNumber !== undefined && { oshaCaseNumber }),
        ...(isLostTime !== undefined && { isLostTime }),
        ...(wasViolationOfSafetyRules !== undefined && { wasViolationOfSafetyRules }),
        ...(wasProperProcedureFollowed !== undefined && { wasProperProcedureFollowed }),
        ...(wasEmployeeInstructedInSOP !== undefined && { wasEmployeeInstructedInSOP }),
        // Additional form fields (dropdown-driven)
        ...(injuryDevelopmentType !== undefined && { injuryDevelopmentType }),
        ...(taskRoutineType !== undefined && { taskRoutineType }),
        ...(contributingFactorTypes !== undefined && { contributingFactorTypes }),
        ...(correctiveActionTypes !== undefined && { correctiveActionTypes }),
        ...(incidentPattern !== undefined && { incidentPattern }),
        ...(weightOrForceUnit !== undefined && { weightOrForceUnit }),
      });
    }

    const incident = await prisma.incident.update({
      where: { id },
      data: updateData,
    });

    // Audit log: Incident updated
    await logAuditFromRequest(req as AuthRequest, 'UPDATE', 'Incident', incident.id, {
      incidentNumber: incident.incidentNumber,
      changedFields: Object.keys(updateData),
      oldStatus: oldStatus,
      newStatus: status || oldStatus,
    });

    // Send notifications for status changes
    if (status && status !== oldStatus) {
      await notifyIncidentStatusChange(id, oldStatus, status, `${user.firstName} ${user.lastName}`);
      // Create chat message for status change
      try {
        await createStatusUpdateMessage(id, user.id, oldStatus, status);
      } catch (err) {
        console.error('Failed to create status update chat message:', err);
      }
    }

    // Send notification for new assignment
    if (assignedToId && assignedToId !== oldAssignee) {
      await notifyIncidentAssignment(id, assignedToId, `${user.firstName} ${user.lastName}`);
    }

    res.json({
      success: true,
      data: incident,
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/incidents/:id - Delete incident (Owner or ADMIN)
// Users can delete their own incidents, Admins can delete any incident
router.delete('/:id', requirePrivilege('incidents.delete'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;

    // Find the incident to check ownership
    const incident = await prisma.incident.findUnique({
      where: { id },
      select: {
        id: true,
        createdById: true,
        incidentNumber: true,
      },
    });

    if (!incident) {
      throw new ValidationError('Incident not found');
    }

    // Check if user is the owner or has admin privileges
    const isOwner = incident.createdById === user.id;
    const isAdmin = user.role === UserRole.ADMIN || user.role === UserRole.SYSTEM_ADMIN;

    if (!isOwner && !isAdmin) {
      throw new ValidationError('You can only delete incidents you created');
    }

    // Delete associated records in proper order to avoid foreign key constraints
    // Delete RCA analyses and related records first
    const rcaAnalyses = await prisma.rCAAnalysis.findMany({
      where: { incidentId: id },
      select: { id: true },
    });

    for (const rca of rcaAnalyses) {
      // Delete RCA versions
      await prisma.rCAVersion.deleteMany({ where: { rcaAnalysisId: rca.id } });
      // Delete RCA comments
      await prisma.comment.deleteMany({ where: { rcaAnalysisId: rca.id } });
      // Delete RCA evidence
      await prisma.evidence.deleteMany({ where: { rcaAnalysisId: rca.id } });
      // Delete CAPA audit logs (linked to CAPAction)
      const capaActions = await prisma.cAPAction.findMany({ where: { rcaAnalysisId: rca.id }, select: { id: true } });
      if (capaActions.length > 0) {
        await prisma.cAPAuditLog.deleteMany({ where: { capActionId: { in: capaActions.map(c => c.id) } } });
      }
      // Delete CAPA actions (linked to RCA)
      await prisma.cAPAction.deleteMany({ where: { rcaAnalysisId: rca.id } });
    }

    // Delete RCA analyses
    await prisma.rCAAnalysis.deleteMany({ where: { incidentId: id } });

    // Delete evidence files
    await prisma.evidence.deleteMany({ where: { incidentId: id } });

    // Delete chat messages
    await prisma.chatMessage.deleteMany({ where: { incidentId: id } });

    // Delete incident participants
    await prisma.incidentParticipant.deleteMany({ where: { incidentId: id } });

    // Delete notifications related to this incident
    await prisma.notification.deleteMany({ where: { incidentId: id } });

    // Delete comments
    await prisma.comment.deleteMany({ where: { incidentId: id } });

    // Delete archived chat messages
    await prisma.archivedChatMessage.deleteMany({ where: { incidentId: id } });

    // Audit log: Incident deleted
    await logAuditFromRequest(req as AuthRequest, 'DELETE', 'Incident', id, {
      incidentNumber: incident.incidentNumber,
      deletedBy: user.id,
    });

    // Finally delete the incident
    await prisma.incident.delete({
      where: { id },
    });

    res.json({
      success: true,
      message: `Incident ${incident.incidentNumber} deleted successfully`,
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/incidents/:id/visibility - Change incident visibility (owner only)
// Enhanced to handle:
// - Team → Private restriction (must remove all members first)
// - Team → Public chat archiving
// - Proper isTeamIncident flag management
router.patch('/:id/visibility', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { visibility, confirmArchive } = req.body;
    const user = (req as any).user;

    // Validate input
    if (!visibility || !['PRIVATE', 'TEAM', 'PUBLIC'].includes(visibility)) {
      throw new ValidationError('visibility must be one of: PRIVATE, TEAM, PUBLIC');
    }

    // Check if incident exists
    const incident = await prisma.incident.findUnique({
      where: { id },
      select: { 
        id: true, 
        createdById: true, 
        visibility: true,
        isTeamIncident: true,
        incidentNumber: true,
        IncidentParticipant: {
          where: { isActive: true },
          select: { 
            id: true,
            userId: true,
          },
        },
      },
    });

    if (!incident) {
      throw new ValidationError('Incident not found');
    }

    // Only the incident creator can change visibility settings
    if (incident.createdById !== user.id) {
      throw new ValidationError('Only the incident owner can change visibility settings');
    }

    // Count active participants (excluding incident creator)
    const activeParticipants = incident.IncidentParticipant?.filter((p: any) => p.userId !== incident.createdById) || [];
    const activeParticipantsCount = activeParticipants.length;

    // === VALIDATION RULES ===

    // Team → Private: BLOCKED if any team members exist
    // User must manually remove all members first
    if (incident.visibility === 'TEAM' && visibility === 'PRIVATE' && activeParticipantsCount > 0) {
      return res.status(400).json({
        success: false,
        error: 'TEAM_MEMBERS_EXIST',
        message: 'Cannot switch to Private while team members are still assigned. Please remove all team members first.',
        data: {
          activeParticipantsCount,
          action: 'remove_members_first',
        },
      });
    }

    // Team → Public: Requires confirmation and will archive chat
    if (incident.visibility === 'TEAM' && visibility === 'PUBLIC') {
      // If team members exist, block completely
      if (activeParticipantsCount > 0) {
        return res.status(400).json({
          success: false,
          error: 'TEAM_MEMBERS_EXIST',
          message: 'This incident has active team members. To make it public, all team members must be removed first.',
          data: {
            activeParticipantsCount,
            action: 'remove_members_first',
          },
        });
      }

      // If no members but chat exists, require confirmation to archive
      const chatMessageCount = await prisma.chatMessage.count({
        where: { incidentId: id, isDeleted: false },
      });

      if (chatMessageCount > 0 && !confirmArchive) {
        return res.status(400).json({
          success: false,
          error: 'CHAT_ARCHIVE_REQUIRED',
          message: 'Switching from Team to Public will archive the current chat history. Please confirm this action.',
          requiresConfirmation: true,
          data: {
            chatMessageCount,
            willArchiveChat: true,
          },
        });
      }

      // Archive chat if there are messages
      if (chatMessageCount > 0) {
        const { archiveChatMessages } = await import('../services/chatArchiveService');
        await archiveChatMessages(id, user.id, 'TEAM_TO_PUBLIC');
      }
    }

    // Private/Public → Team: Add owner as participant if not already
    if (visibility === 'TEAM' && incident.visibility !== 'TEAM') {
      // Check if owner already exists as participant
      const existingOwnerParticipant = await prisma.incidentParticipant.findUnique({
        where: {
          incidentId_userId: {
            incidentId: id,
            userId: incident.createdById,
          },
        },
      });

      if (!existingOwnerParticipant) {
        // Add owner as participant with ACCEPTED status
        await prisma.incidentParticipant.create({
          data: {
            id: uuidv4(),
            incidentId: id,
            userId: incident.createdById,
            role: 'OWNER',
            canEdit: true,
            canChat: true,
            addedById: user.id,
            invitationStatus: 'ACCEPTED',
            respondedAt: new Date(),
            updatedAt: new Date(),
          },
        });
      } else if (existingOwnerParticipant.invitationStatus !== 'ACCEPTED') {
        // Update existing owner participant to ACCEPTED
        await prisma.incidentParticipant.update({
          where: { id: existingOwnerParticipant.id },
          data: {
            invitationStatus: 'ACCEPTED',
            respondedAt: new Date(),
            isActive: true,
          },
        });
      }
    }

    // === PERFORM THE UPDATE ===
    const updatedIncident = await prisma.incident.update({
      where: { id },
      data: { 
        visibility: visibility as any,
        // Set isTeamIncident based on visibility
        isTeamIncident: visibility === 'TEAM',
      },
      select: {
        id: true,
        incidentNumber: true,
        visibility: true,
        isTeamIncident: true,
      },
    });

    const visibilityLabels = {
      PRIVATE: 'private (only you can view)',
      TEAM: 'team (visible to team members)',
      PUBLIC: 'public (visible to all in organization)',
    };

    res.json({
      success: true,
      data: updatedIncident,
      message: `Incident ${updatedIncident.incidentNumber} is now ${visibilityLabels[visibility as keyof typeof visibilityLabels]}`,
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/incidents/:id/share - Share incident with specific users (owner only)
router.patch('/:id/share', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { userIds } = req.body;
    const user = (req as any).user;

    // Validate input
    if (!Array.isArray(userIds)) {
      throw new ValidationError('userIds must be an array');
    }

    // Check if incident exists
    const incident = await prisma.incident.findUnique({
      where: { id },
      select: { 
        id: true, 
        createdById: true, 
        incidentNumber: true,
        sharedWithUserIds: true,
      },
    });

    if (!incident) {
      throw new ValidationError('Incident not found');
    }

    // Only the incident creator can share
    if (incident.createdById !== user.id) {
      throw new ValidationError('Only the incident owner can share this incident');
    }

    // Verify all userIds exist and are in the same organization
    if (userIds.length > 0) {
      const validUsers = await prisma.user.findMany({
        where: {
          id: { in: userIds },
          organizationId: user.organizationId,
        },
        select: { id: true },
      });

      if (validUsers.length !== userIds.length) {
        throw new ValidationError('Some users are not in your organization');
      }
    }

    // Update the incident with shared users
    const updatedIncident = await prisma.incident.update({
      where: { id },
      data: { 
        sharedWithUserIds: userIds,
      },
      select: {
        id: true,
        incidentNumber: true,
        sharedWithUserIds: true,
      },
    });

    res.json({
      success: true,
      data: updatedIncident,
      message: userIds.length > 0 
        ? `Incident shared with ${userIds.length} user(s)`
        : 'Incident sharing cleared',
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/incidents/:id/toggle-public - Toggle public visibility (owner only)
router.patch('/:id/toggle-public', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { isPublic } = req.body;
    const user = (req as any).user;

    // Validate input
    if (typeof isPublic !== 'boolean') {
      throw new ValidationError('isPublic must be a boolean');
    }

    // Check if incident exists
    const incident = await prisma.incident.findUnique({
      where: { id },
      select: { 
        id: true, 
        createdById: true, 
        incidentNumber: true,
        isPublic: true,
      },
    });

    if (!incident) {
      throw new ValidationError('Incident not found');
    }

    // Only the incident creator can toggle visibility
    if (incident.createdById !== user.id) {
      throw new ValidationError('Only the incident owner can change visibility');
    }

    // Update the incident visibility
    const updatedIncident = await prisma.incident.update({
      where: { id },
      data: { 
        isPublic,
      },
      select: {
        id: true,
        incidentNumber: true,
        isPublic: true,
      },
    });

    res.json({
      success: true,
      data: updatedIncident,
      message: isPublic 
        ? 'Incident is now visible to all organization members'
        : 'Incident is now private',
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/incidents/:id/investigation - Submit investigation data separately
router.patch('/:id/investigation', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;

    // Check if incident exists and is WORKPLACE_SAFETY type
    const incident = await prisma.incident.findUnique({
      where: { id },
      select: { 
        id: true, 
        type: true, 
        createdById: true, 
        assignedToId: true,
        incidentNumber: true 
      },
    });

    if (!incident) {
      throw new ValidationError('Incident not found');
    }

    if (incident.type !== 'WORKPLACE_SAFETY') {
      throw new ValidationError('Investigation can only be submitted for Workplace Safety incidents');
    }

    // Only creator, assigned user, or admin can submit investigation
    const canSubmit =
      incident.createdById === user.id ||
      incident.assignedToId === user.id ||
      user.role === UserRole.ADMIN ||
      user.role === UserRole.SYSTEM_ADMIN ||
      user.role === UserRole.CI_MANAGER;

    if (!canSubmit) {
      throw new ValidationError('You do not have permission to submit investigation for this incident');
    }

    // Extract investigation-specific fields from request body
    const {
      isOshaRecordable,
      caseClassification,
      employeeName,
      employeeIdNumber,
      positionAtTimeOfIncident,
      specificInjuryLocation,
      incidentDate,
      incidentTime,
      dateIncidentReported,
      wasClockedIn,
      injuryDevelopmentPattern,
      injuryWorkRelation,
      incidentDescriptionDetailed,
      investigationBodyParts,
      investigationInjuryType,
      wasPerformingOtherDuties,
      otherDutiesExplanation,
      wasInjuryWitnessed,
      witnessNamesList,
      wereCoworkersPresent,
      wasIncidentSiteViewed,
      siteViewDate,
      siteViewTime,
      didSiteRevealCause,
      siteRevealExplanation,
      wasInjuryConsistentWithSite,
      inconsistencyExplanation,
      interviewedNames,
      wereInterviewsDocumented,
      hadPhysicalRestrictions,
      knownRestrictions,
      didLeaveWork,
      dateTimeLeftWork,
      didReturnToWork,
      dateTimeReturnedToWork,
      isAreaUnderSurveillance,
      wasSurveillanceAvailable,
      werePhotosVideosTaken,
      leaderActsConditionsOpinion,
      preventionRecommendations,
      supervisorActions,
      investigationSubmittedAt,
    } = req.body;

    // Build update data for investigation fields
    const investigationData: any = {
      ...(isOshaRecordable !== undefined && { isOshaRecordable }),
      ...(caseClassification !== undefined && { caseClassification }),
      ...(employeeName !== undefined && { employeeName }),
      ...(employeeIdNumber !== undefined && { employeeIdNumber }),
      ...(positionAtTimeOfIncident !== undefined && { positionAtTimeOfIncident }),
      ...(specificInjuryLocation !== undefined && { specificInjuryLocation }),
      ...(incidentDate !== undefined && { incidentDate: incidentDate ? new Date(incidentDate) : null }),
      ...(incidentTime !== undefined && { incidentTime }),
      ...(dateIncidentReported !== undefined && { dateIncidentReported: dateIncidentReported ? new Date(dateIncidentReported) : null }),
      ...(wasClockedIn !== undefined && { wasClockedIn }),
      ...(injuryDevelopmentPattern !== undefined && { injuryDevelopmentPattern }),
      ...(injuryWorkRelation !== undefined && { injuryWorkRelation }),
      ...(incidentDescriptionDetailed !== undefined && { incidentDescriptionDetailed }),
      ...(investigationBodyParts !== undefined && { investigationBodyParts }),
      ...(investigationInjuryType !== undefined && { investigationInjuryType }),
      ...(wasPerformingOtherDuties !== undefined && { wasPerformingOtherDuties }),
      ...(otherDutiesExplanation !== undefined && { otherDutiesExplanation }),
      ...(wasInjuryWitnessed !== undefined && { wasInjuryWitnessed }),
      ...(witnessNamesList !== undefined && { witnessNamesList }),
      ...(wereCoworkersPresent !== undefined && { wereCoworkersPresent }),
      ...(wasIncidentSiteViewed !== undefined && { wasIncidentSiteViewed }),
      ...(siteViewDate !== undefined && { siteViewDate: siteViewDate ? new Date(siteViewDate) : null }),
      ...(siteViewTime !== undefined && { siteViewTime }),
      ...(didSiteRevealCause !== undefined && { didSiteRevealCause }),
      ...(siteRevealExplanation !== undefined && { siteRevealExplanation }),
      ...(wasInjuryConsistentWithSite !== undefined && { wasInjuryConsistentWithSite }),
      ...(inconsistencyExplanation !== undefined && { inconsistencyExplanation }),
      ...(interviewedNames !== undefined && { interviewedNames }),
      ...(wereInterviewsDocumented !== undefined && { wereInterviewsDocumented }),
      ...(hadPhysicalRestrictions !== undefined && { hadPhysicalRestrictions }),
      ...(knownRestrictions !== undefined && { knownRestrictions }),
      ...(didLeaveWork !== undefined && { didLeaveWork }),
      ...(dateTimeLeftWork !== undefined && { dateTimeLeftWork: dateTimeLeftWork ? new Date(dateTimeLeftWork) : null }),
      ...(didReturnToWork !== undefined && { didReturnToWork }),
      ...(dateTimeReturnedToWork !== undefined && { dateTimeReturnedToWork: dateTimeReturnedToWork ? new Date(dateTimeReturnedToWork) : null }),
      ...(isAreaUnderSurveillance !== undefined && { isAreaUnderSurveillance }),
      ...(wasSurveillanceAvailable !== undefined && { wasSurveillanceAvailable }),
      ...(werePhotosVideosTaken !== undefined && { werePhotosVideosTaken }),
      ...(leaderActsConditionsOpinion !== undefined && { leaderActsConditionsOpinion }),
      ...(preventionRecommendations !== undefined && { preventionRecommendations }),
      ...(supervisorActions !== undefined && { supervisorActions }),
      investigationSubmittedAt: investigationSubmittedAt ? new Date(investigationSubmittedAt) : new Date(),
      investigationSubmittedById: user.id,
    };

    // Update the incident with investigation data
    const updatedIncident = await prisma.incident.update({
      where: { id },
      data: investigationData,
      select: {
        id: true,
        incidentNumber: true,
        investigationSubmittedAt: true,
      },
    });

    res.json({
      success: true,
      data: updatedIncident,
      message: `Investigation submitted for incident ${updatedIncident.incidentNumber}`,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/incidents/:id/submit - Submit draft incident
router.post('/:id/submit', requirePrivilege('incidents.change_status'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { autoTriage = true } = req.body; // Option to auto-triage on submit
    const user = (req as any).user;

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
        createdById: true,
        status: true,
        incidentNumber: true,
      },
    });

    if (!incident) {
      throw new ValidationError('Incident not found');
    }

    if (incident.createdById !== user.id) {
      throw new ValidationError('Only the creator can submit this incident');
    }

    // Allow both DRAFT and SUBMITTED status (in case status was already set)
    if (incident.status !== 'DRAFT' && incident.status !== 'SUBMITTED') {
      throw new ValidationError('Only draft incidents can be submitted');
    }

    // If already submitted, just return success
    if (incident.status === 'SUBMITTED') {
      res.json({
        success: true,
        data: incident,
        message: 'Incident already submitted',
      });
      return;
    }

    // Update status to SUBMITTED
    let updated = await prisma.incident.update({
      where: { id },
      data: {
        status: 'SUBMITTED',
      },
    });

    // Phase 4: Auto-triage on submit
    if (autoTriage) {
      try {
        const triageResult = await triageIncident({
          id: incident.id,
          type: incident.type,
          categoryId: incident.categoryId,
          facilityId: incident.facilityId,
          areaId: incident.areaId,
          description: incident.description,
          severity: incident.severity,
          organizationId: incident.organizationId,
        });

        // Apply triage results
        updated = await applyTriageToIncident(id, triageResult);

        // Send notifications
        await notifyIncidentSubmitted(id);

        // If auto-assigned, notify the assignee
        if (triageResult.assignedToId) {
          await notifyIncidentAssignment(
            id,
            triageResult.assignedToId,
            `${user.firstName} ${user.lastName}`
          );
        }

        res.json({
          success: true,
          data: updated,
          triageApplied: true,
          triageResult: {
            suggestedSeverity: triageResult.suggestedSeverity,
            autoAssigned: triageResult.autoAssigned,
            assignedToName: triageResult.assignedToName,
            slaResponseDeadline: triageResult.slaResponseDeadline,
            slaResolutionDeadline: triageResult.slaResolutionDeadline,
          },
        });

        // Audit log: Incident submitted with triage
        await logAuditFromRequest(req as AuthRequest, 'UPDATE', 'Incident', id, {
          incidentNumber: incident.incidentNumber,
          action: 'SUBMITTED',
          previousStatus: 'DRAFT',
          newStatus: 'SUBMITTED',
          triageApplied: true,
          autoAssigned: triageResult.autoAssigned,
        });

        return;
      } catch (triageError: any) {
        console.error('Triage failed, but incident was submitted:', triageError.message);
        // Continue without triage - incident was still submitted
      }
    }

    // Notify about submission (even without triage)
    await notifyIncidentSubmitted(id);

    // Audit log: Incident submitted without triage
    await logAuditFromRequest(req as AuthRequest, 'UPDATE', 'Incident', id, {
      incidentNumber: incident.incidentNumber,
      action: 'SUBMITTED',
      previousStatus: 'DRAFT',
      newStatus: 'SUBMITTED',
      triageApplied: false,
    });

    res.json({
      success: true,
      data: updated,
      triageApplied: false,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/incidents/:id/assign - Manually assign incident
router.post('/:id/assign', requirePrivilege('incidents.assign'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { assignToUserId } = req.body;
    const user = (req as any).user;

    if (!assignToUserId) {
      throw new ValidationError('assignToUserId is required');
    }

    const incident = await prisma.incident.findUnique({
      where: { id },
      select: { status: true, assignedToId: true },
    });

    if (!incident) {
      throw new ValidationError('Incident not found');
    }

    const oldStatus = incident.status;

    // Update assignment
    const updated = await prisma.incident.update({
      where: { id },
      data: {
        assignedToId: assignToUserId,
        status: 'ASSIGNED',
        respondedAt: new Date(), // Manual assignment counts as initial response
        autoAssigned: false,
      },
    });

    // Notify the assigned user
    await notifyIncidentAssignment(id, assignToUserId, `${user.firstName} ${user.lastName}`);

    // Notify about status change if it changed
    if (oldStatus !== 'ASSIGNED') {
      await notifyIncidentStatusChange(id, oldStatus, 'ASSIGNED', `${user.firstName} ${user.lastName}`);
    }

    // Audit log: Incident assigned
    await logAuditFromRequest(req as AuthRequest, 'UPDATE', 'Incident', id, {
      action: 'ASSIGNED',
      previousStatus: oldStatus,
      newStatus: 'ASSIGNED',
      previousAssignee: incident.assignedToId,
      newAssignee: assignToUserId,
    });

    res.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/incidents/:id/evidence - Upload evidence files to Firebase Storage
router.post('/:id/evidence', uploadMultiple, handleMulterError, validateFileContent, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { type, transcriptions } = req.body; // PHOTO, VIDEO, DOCUMENT, VOICE_RECORDING
    const user = (req as any).user;
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      throw new ValidationError('No files uploaded');
    }

    if (!type) {
      throw new ValidationError('Evidence type is required');
    }

    // Parse transcriptions if provided (for voice recordings)
    let parsedTranscriptions: string[] = [];
    if (transcriptions) {
      try {
        parsedTranscriptions = JSON.parse(transcriptions);
      } catch (e) {
        // Ignore parse errors
      }
    }

    // Verify incident exists and user has access
    const incident = await prisma.incident.findUnique({
      where: { id },
      select: { createdById: true, assignedToId: true },
    });

    if (!incident) {
      throw new ValidationError('Incident not found');
    }

    const hasAccess =
      incident.createdById === user.id ||
      incident.assignedToId === user.id ||
      ['ADMIN', 'SYSTEM_ADMIN', 'CI', 'MANAGER'].includes(user.role);

    if (!hasAccess) {
      throw new ValidationError('You do not have permission to upload evidence for this incident');
    }

    // Upload files to Firebase Storage and create evidence records
    const bucket = adminStorage.bucket();
    const evidenceRecords = await Promise.all(
      files.map(async (file, index) => {
        // Generate unique filename for Firebase Storage
        const fileExtension = path.extname(file.originalname);
        const uniqueFileName = `evidence/${id}/${uuidv4()}${fileExtension}`;
        
        // Upload to Firebase Storage from memory buffer (cloud-compatible)
        const firebaseFile = bucket.file(uniqueFileName);
        
        await firebaseFile.save(file.buffer, {
          metadata: {
            contentType: file.mimetype,
            metadata: {
              originalName: file.originalname,
              uploadedBy: user.id,
              incidentId: id,
              evidenceType: type,
            },
          },
        });

        // Make the file publicly accessible and get the URL
        await firebaseFile.makePublic();
        const publicUrl = `https://storage.googleapis.com/${bucket.name}/${uniqueFileName}`;

        // Get transcription for voice recordings
        const transcription = type === 'VOICE_RECORDING' && parsedTranscriptions[index] 
          ? parsedTranscriptions[index] 
          : null;

        // Create evidence record with Firebase Storage URL and transcription
        return prisma.evidence.create({
          data: {
            id: uuidv4(),
            type,
            fileName: file.originalname,
            filePath: publicUrl,
            fileSize: file.size,
            mimeType: file.mimetype,
            transcription,
            incidentId: id,
            uploadedById: user.id,
          },
        });
      })
    );

    res.json({
      success: true,
      data: evidenceRecords,
      message: `${files.length} file(s) uploaded to Firebase Storage successfully`,
    });
  } catch (error) {
    next(error);
  }
}, handleMulterError);

// DELETE /api/incidents/:incidentId/evidence/:evidenceId - Delete evidence from Firebase Storage
router.delete('/:incidentId/evidence/:evidenceId', async (req, res) => {
  const { incidentId, evidenceId } = req.params;
  const user = (req as any).user;

  // Verify incident and evidence exist
  const evidence = await prisma.evidence.findUnique({
    where: { id: evidenceId },
    include: {
      Incident: {
        select: { createdById: true, assignedToId: true },
      },
    },
  });

  if (!evidence || evidence.incidentId !== incidentId) {
    throw new ValidationError('Evidence not found');
  }

  const hasAccess =
    evidence.uploadedById === user.id ||
    evidence.Incident?.createdById === user.id ||
    ['ADMIN', 'SYSTEM_ADMIN'].includes(user.role);

  if (!hasAccess) {
    throw new ValidationError('You do not have permission to delete this evidence');
  }

  // Delete file from Firebase Storage if it's a Firebase URL
  if (evidence.filePath.includes('storage.googleapis.com')) {
    try {
      const bucket = adminStorage.bucket();
      // Extract the file path from the URL
      const urlParts = evidence.filePath.split(`${bucket.name}/`);
      if (urlParts.length > 1) {
        const firebasePath = urlParts[1];
        await bucket.file(firebasePath).delete();
      }
    } catch (error) {
      console.error('Error deleting file from Firebase Storage:', error);
      // Continue with database deletion even if storage deletion fails
    }
  } else {
    // Legacy: Delete file from local filesystem
    const localPath = evidence.filePath.startsWith('/uploads/') 
      ? path.join(process.env.UPLOAD_PATH || './uploads', evidence.filePath.replace('/uploads/', ''))
      : evidence.filePath;
    
    if (fs.existsSync(localPath)) {
      fs.unlinkSync(localPath);
    }
  }

  // Delete database record
  await prisma.evidence.delete({
    where: { id: evidenceId },
  });

  res.json({
    success: true,
    message: 'Evidence deleted successfully',
  });
});

// PATCH /api/incidents/:incidentId/evidence/:evidenceId - Rename evidence file
router.patch('/:incidentId/evidence/:evidenceId', async (req, res) => {
  const { incidentId, evidenceId } = req.params;
  const { fileName } = req.body;
  const user = (req as any).user;

  if (!fileName || typeof fileName !== 'string' || !fileName.trim()) {
    throw new ValidationError('New filename is required');
  }

  // Verify incident and evidence exist
  const evidence = await prisma.evidence.findUnique({
    where: { id: evidenceId },
    include: {
      Incident: {
        select: { createdById: true, assignedToId: true },
      },
    },
  });

  if (!evidence || evidence.incidentId !== incidentId) {
    throw new ValidationError('Evidence not found');
  }

  const hasAccess =
    evidence.uploadedById === user.id ||
    evidence.Incident?.createdById === user.id ||
    ['ADMIN', 'SYSTEM_ADMIN'].includes(user.role);

  if (!hasAccess) {
    throw new ValidationError('You do not have permission to rename this evidence');
  }

  // Update the filename in database
  const updated = await prisma.evidence.update({
    where: { id: evidenceId },
    data: { fileName: fileName.trim() },
  });

  res.json({
    success: true,
    data: updated,
    message: 'Evidence renamed successfully',
  });
});

// GET /api/incidents/:incidentId/evidence/:evidenceId/download - Download evidence file
router.get('/:incidentId/evidence/:evidenceId/download', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { incidentId, evidenceId } = req.params;
    const user = (req as any).user;
    const userOrgId = user?.organizationId;

    if (!user?.id || !userOrgId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Verify incident exists and belongs to user's organization
    const incident = await prisma.incident.findFirst({
      where: {
        id: incidentId,
        organizationId: userOrgId,
      },
    });

    if (!incident) {
      res.status(404).json({ error: 'Incident not found' });
      return;
    }

    // Verify evidence exists and belongs to this incident
    const evidence = await prisma.evidence.findFirst({
      where: {
        id: evidenceId,
        incidentId: incidentId,
      },
    });

    if (!evidence) {
      res.status(404).json({ error: 'Evidence not found' });
      return;
    }

    // Handle Firebase Storage files (gs:// or storage.googleapis.com URLs)
    if (evidence.filePath.startsWith('gs://') || evidence.filePath.includes('storage.googleapis.com') || evidence.filePath.includes('firebasestorage.googleapis.com')) {
      try {
        const bucket = adminStorage.bucket();
        let firebaseFilePath: string;
        
        if (evidence.filePath.startsWith('gs://')) {
          // Extract path from gs:// URL
          const gsUrl = evidence.filePath.replace(`gs://${bucket.name}/`, '');
          firebaseFilePath = gsUrl;
        } else if (evidence.filePath.includes('firebasestorage.googleapis.com')) {
          // Extract path from firebasestorage URL
          // Format: https://firebasestorage.googleapis.com/v0/b/bucket-name/o/path%2Fto%2Ffile?...
          const url = new URL(evidence.filePath);
          const pathMatch = url.pathname.match(/\/o\/(.+)/);
          if (pathMatch) {
            firebaseFilePath = decodeURIComponent(pathMatch[1]);
          } else {
            throw new Error('Could not parse Firebase Storage URL');
          }
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
        
        // Stream the file directly to avoid CORS issues
        res.setHeader('Content-Type', evidence.mimeType || (evidence as any).fileType || 'application/octet-stream');
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
      } catch (err) {
        console.error('Error accessing Firebase Storage:', err);
        res.status(500).json({ error: 'Failed to access file storage' });
        return;
      }
    }

    // Handle local files (legacy)
    const localPath = evidence.filePath.startsWith('/uploads/')
      ? path.join(process.env.UPLOAD_PATH || './uploads', evidence.filePath.replace('/uploads/', ''))
      : evidence.filePath;

    if (!fs.existsSync(localPath)) {
      res.status(404).json({ error: 'File not found' });
      return;
    }

    res.setHeader('Content-Type', evidence.mimeType || (evidence as any).fileType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${evidence.fileName}"`);
    fs.createReadStream(localPath).pipe(res);
  } catch (error) {
    next(error);
  }
});

// POST /api/incidents/:id/ai-summary - Generate AI summary for incident
router.post('/:id/ai-summary', requirePrivilege('incidents.ai_analysis'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;

    // Fetch incident with related data for AI context
    const incident = await prisma.incident.findUnique({
      where: { id },
      include: {
        Category: {
          include: {
            Category: true,
          },
        },
        Facility: true,
        Area: {
          include: {
            Department: true,
          },
        },
        Line: true,
      },
    });

    if (!incident) {
      throw new ValidationError('Incident not found');
    }

    // Check access
    const hasAccess =
      incident.createdById === user.id ||
      incident.assignedToId === user.id ||
      ['ADMIN', 'SYSTEM_ADMIN', 'CI', 'MANAGER'].includes(user.role);

    if (!hasAccess) {
      throw new ValidationError('You do not have permission to generate AI summary for this incident');
    }

    // Build data for AI service
    const aiData = {
      type: incident.type as 'FOOD_SAFETY' | 'MACHINE_EQUIPMENT' | 'WORKPLACE_SAFETY' | 'OPERATIONS',
      categoryName: incident.Category?.Category?.name || incident.Category?.name,
      subcategoryName: incident.Category?.Category ? incident.Category.name : undefined,
      customTitle: incident.customTitle || undefined,
      description: incident.description,
      facilityName: incident.Facility?.name,
      departmentName: incident.Area?.Department?.name,
      areaName: incident.Area?.name,
      lineName: incident.Line?.name,
      productName: incident.productName || undefined,
      lotNumber: incident.lotNumber || undefined,
      machineId: incident.machineId || undefined,
      severity: incident.severity || undefined,
    };

    // Generate AI summary
    const result = await generateIncidentSummary(aiData);

    // Update incident with AI summary and suggested severity
    const updated = await prisma.incident.update({
      where: { id },
      data: {
        aiSummary: result.summary,
        ...(result.suggestedSeverity && !incident.severity && {
          aiSuggestedSeverity: result.suggestedSeverity as any,
        }),
      },
    });

    res.json({
      success: true,
      data: {
        aiSummary: result.summary,
        suggestedSeverity: result.suggestedSeverity,
        incident: updated,
      },
      message: 'AI summary generated successfully',
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/incidents/generate-summary - Generate AI summary without saving (for preview)
router.post('/generate-summary', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      type,
      categoryId,
      customTitle,
      description,
      facilityId,
      departmentId,
      areaId,
      lineId,
      shiftId,
      productName,
      lotNumber,
      machineId,
      occurredAt,
      severity,
      evidenceFiles,
      // Workplace Safety specific fields
      injuryType,
      bodyPartsAffected,
      otherBodyPartDetail,
      taskBeingPerformed,
      isRoutineTask,
      exposureDuration,
      taskFrequency,
      weightOrForce,
      environmentalConditions,
      ppeRequired,
      ppeWorn,
      machineSafeguardsInPlace,
      lotoRequired,
      sopAvailable,
      sopFollowed,
      firstAidProvided,
      medicalTreatmentRequired,
      supervisorNotified,
      areaSecured,
      directCause,
      contributingFactors,
      unsafeActOrCondition,
      previousSimilarIncidents,
    } = req.body;

    if (!type || !description) {
      throw new ValidationError('Type and description are required');
    }

    // Fetch related data for context
    const [category, facility, department, area, line, shift] = await Promise.all([
      categoryId ? prisma.category.findUnique({
        where: { id: categoryId },
        include: { Category: true },
      }) : null,
      facilityId ? prisma.facility.findUnique({ where: { id: facilityId } }) : null,
      departmentId ? prisma.department.findUnique({ where: { id: departmentId } }) : null,
      areaId ? prisma.area.findUnique({ where: { id: areaId } }) : null,
      lineId ? prisma.line.findUnique({ where: { id: lineId } }) : null,
      shiftId ? prisma.shift.findUnique({ where: { id: shiftId } }) : null,
    ]);

    // Build data for AI service
    const aiData: any = {
      type: type as 'FOOD_SAFETY' | 'MACHINE_EQUIPMENT' | 'WORKPLACE_SAFETY' | 'OPERATIONS',
      categoryName: category?.Category?.name || category?.name || 'Unknown',
      subcategoryName: category?.Category ? category.name : undefined,
      customTitle: customTitle || undefined,
      description,
      facilityName: facility?.name,
      departmentName: department?.name,
      areaName: area?.name,
      lineName: line?.name,
      shiftName: shift?.name,
      productName: productName || undefined,
      lotNumber: lotNumber || undefined,
      machineId: machineId || undefined,
      occurredAt: occurredAt || undefined,
      severity: severity || undefined,
      evidenceFiles: evidenceFiles || undefined,
    };

    // Add workplace safety specific fields when applicable
    if (type === 'WORKPLACE_SAFETY') {
      aiData.injuryType = injuryType || undefined;
      aiData.bodyPartsAffected = bodyPartsAffected || undefined;
      aiData.otherBodyPartDetail = otherBodyPartDetail || undefined;
      aiData.taskBeingPerformed = taskBeingPerformed || undefined;
      aiData.isRoutineTask = isRoutineTask;
      aiData.exposureDuration = exposureDuration || undefined;
      aiData.taskFrequency = taskFrequency || undefined;
      aiData.weightOrForce = weightOrForce || undefined;
      aiData.environmentalConditions = environmentalConditions || undefined;
      aiData.ppeRequired = ppeRequired;
      aiData.ppeWorn = ppeWorn;
      aiData.machineSafeguardsInPlace = machineSafeguardsInPlace || undefined;
      aiData.lotoRequired = lotoRequired || undefined;
      aiData.sopAvailable = sopAvailable;
      aiData.sopFollowed = sopFollowed;
      aiData.firstAidProvided = firstAidProvided;
      aiData.medicalTreatmentRequired = medicalTreatmentRequired;
      aiData.supervisorNotified = supervisorNotified;
      aiData.areaSecured = areaSecured;
      aiData.directCause = directCause || undefined;
      aiData.contributingFactors = contributingFactors || undefined;
      aiData.unsafeActOrCondition = unsafeActOrCondition || undefined;
      aiData.previousSimilarIncidents = previousSimilarIncidents;
    }

    // Generate AI summary
    const result = await generateIncidentSummary(aiData);

    res.json({
      success: !result.error,
      data: {
        aiSummary: result.summary,
        suggestedSeverity: result.suggestedSeverity,
        aiError: result.error || false,
      },
      message: result.error ? 'AI summary unavailable' : 'AI summary generated successfully',
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/incidents/generate-summary-with-attachments - Generate AI summary with attachment analysis
router.post('/generate-summary-with-attachments', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      type,
      categoryId,
      customTitle,
      description,
      facilityId,
      areaId,
      lineId,
      productName,
      machineId,
      occurredAt,
      severity,
      // Workplace safety fields
      injuryType,
      bodyPartsAffected,
      taskBeingPerformed,
      ppeWorn,
      directCause,
      additionalFields,
      // Attachment URLs for analysis
      attachments, // Array of { filename, type, mimeType, fileUrl, transcription? }
    } = req.body;

    if (!type || !description) {
      throw new ValidationError('Type and description are required');
    }

    // Fetch related data for context
    const [category, facility, area, line] = await Promise.all([
      categoryId ? prisma.category.findUnique({
        where: { id: categoryId },
        include: { Category: true },
      }) : null,
      facilityId ? prisma.facility.findUnique({ where: { id: facilityId } }) : null,
      areaId ? prisma.area.findUnique({ where: { id: areaId } }) : null,
      lineId ? prisma.line.findUnique({ where: { id: lineId } }) : null,
    ]);

    // Import attachment analysis service
    const { analyzeAllAttachments, generateEnhancedSummaryWithAttachments } = await import('../services/attachmentAnalysisService');

    // Check if OpenAI is configured
    if (!process.env.OPENAI_API_KEY) {
      console.warn('⚠️ OPENAI_API_KEY not configured - skipping attachment analysis');
      return res.json({
        success: true,
        data: {
          aiSummary: 'AI analysis unavailable - OpenAI API key not configured.',
          suggestedSeverity: severity || 'MEDIUM',
          evidenceSummary: null,
          keyFindings: [],
          investigationGuidance: [],
          attachmentAnalysis: null,
          aiError: true,
          errorMessage: 'OpenAI API key not configured',
        },
        message: 'AI analysis unavailable - please configure OPENAI_API_KEY',
      });
    }

    // Analyze all attachments if provided
    let attachmentAnalysis = null;
    if (attachments && Array.isArray(attachments) && attachments.length > 0) {
      console.log('📎 Analyzing attachments:', attachments.map(a => ({
        filename: a.filename,
        type: a.type,
        mimeType: a.mimeType,
        hasFileUrl: !!a.fileUrl,
        fileUrlPrefix: a.fileUrl?.substring(0, 50),
      })));
      
      attachmentAnalysis = await analyzeAllAttachments(attachments, {
        type,
        category: category?.Category?.name || category?.name || 'Unknown',
        description,
        facility: facility?.name,
        area: area?.name,
        severity,
        additionalContext: customTitle,
      });
      
      console.log('📊 Attachment analysis result:', {
        totalAnalyses: attachmentAnalysis?.attachmentAnalyses?.length,
        confidence: attachmentAnalysis?.analysisConfidence,
        statuses: attachmentAnalysis?.attachmentAnalyses?.map(a => ({ file: a.filename, status: a.analysisStatus })),
      });
    }
    
    console.log('🔍 Checking condition for enhanced summary:', {
      hasAttachmentAnalysis: !!attachmentAnalysis,
      analysesLength: attachmentAnalysis?.attachmentAnalyses?.length,
      condition: !!(attachmentAnalysis && attachmentAnalysis.attachmentAnalyses?.length > 0),
    });

    // Generate enhanced summary with attachment insights
    if (attachmentAnalysis && attachmentAnalysis.attachmentAnalyses.length > 0) {
      console.log('🚀 Generating enhanced summary with attachments...');
      
      try {
        const enhancedResult = await generateEnhancedSummaryWithAttachments(
          {
            type,
            category: category?.Category?.name || category?.name || 'Unknown',
            subcategory: category?.Category ? category.name : undefined,
            description,
            facility: facility?.name,
            area: area?.name,
            line: line?.name,
            product: productName,
            machineId,
            severity,
            occurredAt,
            injuryType,
            bodyPartsAffected,
            taskBeingPerformed,
            ppeWorn,
            directCause,
            additionalFields,
          },
          attachmentAnalysis
        );
        
        console.log('✅ Enhanced summary generated:', {
          hasSummary: !!enhancedResult?.summary,
          summaryLength: enhancedResult?.summary?.length,
          suggestedSeverity: enhancedResult?.suggestedSeverity,
          hasEvidenceSummary: !!enhancedResult?.evidenceSummary,
          keyFindingsCount: enhancedResult?.keyFindings?.length,
          rcaMethodology: enhancedResult?.recommendedRCAMethodology?.primary,
        });

        console.log('📤 Sending success response with attachment analysis...');
        return res.json({
          success: true,
          data: {
            aiSummary: enhancedResult.summary,
            suggestedSeverity: enhancedResult.suggestedSeverity,
            evidenceSummary: enhancedResult.evidenceSummary,
            keyFindings: enhancedResult.keyFindings,
            investigationGuidance: enhancedResult.investigationGuidance,
            recommendedRCAMethodology: enhancedResult.recommendedRCAMethodology,
            attachmentAnalysis: {
              totalAttachments: attachmentAnalysis.attachmentAnalyses.length,
              analysisConfidence: attachmentAnalysis.analysisConfidence,
              riskAssessment: attachmentAnalysis.riskAssessment,
              individualAnalyses: attachmentAnalysis.attachmentAnalyses.map(a => ({
                filename: a.filename,
                type: a.type,
                status: a.analysisStatus,
                summary: a.summary,
                relevance: a.relevanceToIncident,
              })),
            },
          aiError: false,
        },
        message: 'Enhanced AI summary with attachment analysis generated successfully',
      });
      } catch (enhancedSummaryError: any) {
        console.error('❌ Error generating enhanced summary:', enhancedSummaryError);
        // Fall back to returning attachment analysis without enhanced summary
        return res.json({
          success: true,
          data: {
            aiSummary: attachmentAnalysis.overallSummary || 'Summary generation failed, but attachment analysis completed.',
            suggestedSeverity: attachmentAnalysis.riskAssessment?.level || 'MEDIUM',
            evidenceSummary: `Analyzed ${attachmentAnalysis.attachmentAnalyses.length} attachments.`,
            keyFindings: attachmentAnalysis.consolidatedFindings || [],
            investigationGuidance: attachmentAnalysis.recommendedActions || [],
            recommendedRCAMethodology: {
              primary: 'FIVE_WHYS',
              reason: 'Default recommendation. 5 Whys is a good starting point for most incidents.',
              confidence: 50,
            },
            attachmentAnalysis: {
              totalAttachments: attachmentAnalysis.attachmentAnalyses.length,
              analysisConfidence: attachmentAnalysis.analysisConfidence,
              riskAssessment: attachmentAnalysis.riskAssessment,
              individualAnalyses: attachmentAnalysis.attachmentAnalyses.map(a => ({
                filename: a.filename,
                type: a.type,
                status: a.analysisStatus,
                summary: a.summary,
                relevance: a.relevanceToIncident,
              })),
            },
            aiError: true,
            errorMessage: enhancedSummaryError.message,
          },
          message: 'Attachment analysis completed, but enhanced summary generation failed',
        });
      }
    } else {
      // No attachments - fall back to regular summary generation
      const aiData: any = {
        type,
        categoryName: category?.Category?.name || category?.name || 'Unknown',
        subcategoryName: category?.Category ? category.name : undefined,
        customTitle,
        description,
        facilityName: facility?.name,
        areaName: area?.name,
        lineName: line?.name,
        productName,
        machineId,
        occurredAt,
        severity,
      };

      if (type === 'WORKPLACE_SAFETY') {
        aiData.injuryType = injuryType;
        aiData.bodyPartsAffected = bodyPartsAffected;
        aiData.taskBeingPerformed = taskBeingPerformed;
        aiData.ppeWorn = ppeWorn;
        aiData.directCause = directCause;
      }

      const result = await generateIncidentSummary(aiData);

      res.json({
        success: !result.error,
        data: {
          aiSummary: result.summary,
          suggestedSeverity: result.suggestedSeverity,
          evidenceSummary: null,
          keyFindings: [],
          investigationGuidance: [],
          attachmentAnalysis: null,
          aiError: result.error || false,
        },
        message: result.error ? 'AI summary unavailable' : 'AI summary generated successfully',
      });
    }
  } catch (error) {
    next(error);
  }
});

// POST /api/incidents/enhance-text - Enhance user input text using AI
router.post('/enhance-text', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { text, incidentType, fieldContext } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Text is required',
      });
    }

    if (!incidentType || !['FOOD_SAFETY', 'MACHINE_EQUIPMENT', 'WORKPLACE_SAFETY', 'OPERATIONS'].includes(incidentType)) {
      return res.status(400).json({
        success: false,
        error: 'Valid incident type is required (FOOD_SAFETY, MACHINE_EQUIPMENT, WORKPLACE_SAFETY, OPERATIONS)',
      });
    }

    // Import the enhance function dynamically to avoid circular dependencies
    const { enhanceIncidentText } = await import('../services/aiService');
    
    const result = await enhanceIncidentText(text, incidentType, fieldContext);

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
  } catch (error) {
    next(error);
  }
});

// POST /incidents/validate-safety-form - AI validation for safety incident forms
router.post('/validate-safety-form', async (req, res, next) => {
  try {
    const { formTab, incidentCategory, incidentDescription, formData } = req.body;

    if (!formTab || !['incident-report', 'investigation'].includes(formTab)) {
      return res.status(400).json({
        success: false,
        error: 'Valid form tab is required (incident-report or investigation)',
      });
    }

    if (!formData || typeof formData !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Form data object is required',
      });
    }

    // Import the validation function
    const { validateSafetyIncidentForm } = await import('../services/aiService');
    
    const result = await validateSafetyIncidentForm({
      formTab,
      incidentCategory: incidentCategory || 'Unknown',
      incidentDescription: incidentDescription || '',
      formData,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/incidents/:id/regenerate-ai-insights - Regenerate AI insights for an existing incident
router.post('/:id/regenerate-ai-insights', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;

    // Get the incident with all its data
    const incident = await prisma.incident.findUnique({
      where: { id },
      include: {
        Category: {
          include: { Category: true }
        },
        Facility: true,
        Area: true,
        Line: true,
        Evidence: true,
      },
    });

    if (!incident) {
      throw new ValidationError('Incident not found');
    }

    // Check permissions - only owner, assignee, or admin can regenerate
    const canRegenerate =
      incident.createdById === user.id ||
      incident.assignedToId === user.id ||
      user.role === 'ADMIN' ||
      user.role === 'SYSTEM_ADMIN';

    if (!canRegenerate) {
      throw new ValidationError('You do not have permission to regenerate AI insights for this incident');
    }

    // Import the necessary services
    const { analyzeAllAttachments, generateEnhancedSummaryWithAttachments } = await import('../services/attachmentAnalysisService');

    const incidentContext = {
      type: incident.type,
      category: incident.Category?.Category?.name || incident.Category?.name || 'Unknown',
      subcategory: incident.Category?.Category ? incident.Category.name : undefined,
      description: incident.description,
      facility: incident.Facility?.name,
      area: incident.Area?.name,
      line: incident.Line?.name,
      product: incident.productName || undefined,
      machineId: incident.machineId || undefined,
      severity: incident.severity || undefined,
      occurredAt: incident.occurredAt?.toISOString(),
      injuryType: incident.injuryType as 'FIRST_AID' | 'RECORDABLE' | 'NEAR_MISS' | 'LOST_TIME' | '' | undefined,
      bodyPartsAffected: incident.bodyPartsAffected || undefined,
      taskBeingPerformed: incident.taskBeingPerformed || undefined,
      ppeWorn: incident.ppeWorn ?? undefined,
      directCause: incident.directCause || undefined,
    };

    let aiAnalysisData = null;
    let aiSummary = null;

    // If incident has evidence, analyze it
    if (incident.Evidence && incident.Evidence.length > 0) {
      const attachments = incident.Evidence.map(e => ({
        filename: e.fileName,
        type: e.type,
        mimeType: e.mimeType,
        fileUrl: e.filePath, // This should be the accessible URL
        transcription: e.transcription || undefined,
      }));

      console.log('🔄 Regenerating AI insights with', attachments.length, 'attachments');

      const attachmentAnalysis = await analyzeAllAttachments(attachments, {
        type: incident.type,
        category: incidentContext.category,
        description: incident.description,
        facility: incidentContext.facility,
        area: incidentContext.area,
        severity: incidentContext.severity || undefined,
        additionalContext: incident.customTitle || undefined,
      });

      if (attachmentAnalysis && attachmentAnalysis.attachmentAnalyses.length > 0) {
        const enhancedResult = await generateEnhancedSummaryWithAttachments(incidentContext, attachmentAnalysis);

        aiSummary = enhancedResult.summary;
        aiAnalysisData = {
          evidenceSummary: enhancedResult.evidenceSummary,
          keyFindings: enhancedResult.keyFindings,
          investigationGuidance: enhancedResult.investigationGuidance,
          recommendedRCAMethodology: enhancedResult.recommendedRCAMethodology,
          attachmentAnalysis: {
            totalAttachments: attachmentAnalysis.attachmentAnalyses.length,
            analysisConfidence: attachmentAnalysis.analysisConfidence,
            riskAssessment: attachmentAnalysis.riskAssessment,
            individualAnalyses: attachmentAnalysis.attachmentAnalyses.map(a => ({
              filename: a.filename,
              type: a.type,
              status: a.analysisStatus,
              summary: a.summary,
              relevance: a.relevanceToIncident,
            })),
          },
          generatedAt: new Date().toISOString(),
        };
      }
    }

    // If no attachments or attachment analysis failed, use regular summary generation
    if (!aiAnalysisData) {
      console.log('🔄 Regenerating AI insights without attachments (no evidence or analysis failed)');
      
      const result = await generateIncidentSummary({
        type: incident.type,
        categoryName: incidentContext.category,
        subcategoryName: incidentContext.subcategory,
        description: incident.description,
        facilityName: incidentContext.facility,
        areaName: incidentContext.area,
        lineName: incidentContext.line,
        productName: incidentContext.product,
        machineId: incidentContext.machineId,
        severity: incidentContext.severity,
        occurredAt: incidentContext.occurredAt,
        injuryType: incidentContext.injuryType as 'FIRST_AID' | 'RECORDABLE' | 'NEAR_MISS' | 'LOST_TIME' | '' | undefined,
        bodyPartsAffected: incidentContext.bodyPartsAffected,
        taskBeingPerformed: incidentContext.taskBeingPerformed,
        ppeWorn: incidentContext.ppeWorn ?? undefined,
      });

      aiSummary = result.summary;
      aiAnalysisData = {
        evidenceSummary: result.evidenceSummary || null,
        keyFindings: result.keyFindings || [],
        investigationGuidance: result.investigationGuidance || [],
        recommendedRCAMethodology: result.recommendedRCAMethodology || null,
        generatedAt: new Date().toISOString(),
      };
    }

    // Update the incident with the new AI data
    const updatedIncident = await prisma.incident.update({
      where: { id },
      data: {
        aiSummary,
        aiAnalysisData,
      },
      include: {
        Category: true,
        Facility: true,
        Area: true,
        Line: true,
        Shift: true,
        Evidence: true,
        User_Incident_createdByIdToUser: {
          select: { id: true, firstName: true, lastName: true, email: true, role: true },
        },
        User_Incident_assignedToIdToUser: {
          select: { id: true, firstName: true, lastName: true, email: true, role: true },
        },
        RCAAnalysis: {
          select: { id: true, status: true, method: true },
        },
      },
    });

    res.json({
      success: true,
      data: updatedIncident,
      message: 'AI insights regenerated successfully',
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/incidents/:id/activity-timeline - Get activity timeline for an incident
router.get('/:id/activity-timeline', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const currentUserId = (req as any).user?.id;

    // Verify incident exists and user has access
    const incident = await prisma.incident.findUnique({
      where: { id },
      select: {
        id: true,
        incidentNumber: true,
        createdById: true,
        createdAt: true,
        investigationSubmittedAt: true,
        status: true,
        visibility: true,
        description: true,
        IncidentParticipant: {
          where: { userId: currentUserId, isActive: true },
        },
      },
    });

    if (!incident) {
      return res.status(404).json({ error: 'Incident not found' });
    }

    // Gather all activity events from different sources
    const activities: Array<{
      id: string;
      type: string;
      category: 'incident' | 'team' | 'rca' | 'capa' | 'evidence';
      action: string;
      description: string;
      timestamp: Date;
      userId: string | null;
      userName: string | null;
      userEmail: string | null;
      details?: any;
    }> = [];

    // 1. Incident creation event
    const incidentCreator = await prisma.user.findUnique({
      where: { id: incident.createdById },
      select: { id: true, firstName: true, lastName: true, email: true },
    });
    activities.push({
      id: `incident-created-${incident.id}`,
      type: 'INCIDENT_CREATED',
      category: 'incident',
      action: 'created',
      description: `Incident ${incident.incidentNumber} was created`,
      timestamp: incident.createdAt,
      userId: incidentCreator?.id || null,
      userName: incidentCreator ? `${incidentCreator.firstName} ${incidentCreator.lastName}` : null,
      userEmail: incidentCreator?.email || null,
    });

    // 2. Incident submission event
    if (incident.investigationSubmittedAt) {
      activities.push({
        id: `incident-submitted-${incident.id}`,
        type: 'INCIDENT_SUBMITTED',
        category: 'incident',
        action: 'submitted',
        description: `Incident was submitted for investigation`,
        timestamp: incident.investigationSubmittedAt,
        userId: incidentCreator?.id || null,
        userName: incidentCreator ? `${incidentCreator.firstName} ${incidentCreator.lastName}` : null,
        userEmail: incidentCreator?.email || null,
      });
    }

    // 3. Team member events (invitations, responses)
    const participantEvents = await prisma.incidentParticipant.findMany({
      where: { incidentId: id },
      include: {
        User_IncidentParticipant_userIdToUser: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        User_IncidentParticipant_addedByIdToUser: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    for (const participant of participantEvents) {
      const invitedUser = participant.User_IncidentParticipant_userIdToUser;
      const addedByUser = participant.User_IncidentParticipant_addedByIdToUser;
      const invitedUserName = `${invitedUser.firstName} ${invitedUser.lastName}`;
      const addedByUserName = `${addedByUser.firstName} ${addedByUser.lastName}`;

      // Team member invited
      activities.push({
        id: `team-invited-${participant.id}`,
        type: 'TEAM_MEMBER_INVITED',
        category: 'team',
        action: 'invited',
        description: `${invitedUserName} was invited to the team`,
        timestamp: participant.invitedAt,
        userId: addedByUser.id,
        userName: addedByUserName,
        userEmail: addedByUser.email,
        details: {
          invitedUserId: invitedUser.id,
          invitedUserName,
          invitedUserEmail: invitedUser.email,
          role: participant.role,
        },
      });

      // Team member responded (if they did)
      if (participant.respondedAt && participant.invitationStatus !== 'PENDING') {
        const actionMap: Record<string, string> = {
          ACCEPTED: 'accepted',
          DECLINED: 'declined',
        };
        const descriptionMap: Record<string, string> = {
          ACCEPTED: `${invitedUserName} accepted the invitation`,
          DECLINED: `${invitedUserName} declined the invitation`,
        };

        activities.push({
          id: `team-response-${participant.id}`,
          type: `TEAM_MEMBER_${participant.invitationStatus}`,
          category: 'team',
          action: actionMap[participant.invitationStatus] || 'responded',
          description: descriptionMap[participant.invitationStatus] || `${invitedUserName} responded to invitation`,
          timestamp: participant.respondedAt,
          userId: invitedUser.id,
          userName: invitedUserName,
          userEmail: invitedUser.email,
          details: {
            status: participant.invitationStatus,
          },
        });
      }

      // Team member left (if they did)
      if (participant.leftAt) {
        activities.push({
          id: `team-left-${participant.id}`,
          type: 'TEAM_MEMBER_LEFT',
          category: 'team',
          action: 'left',
          description: `${invitedUserName} left the team`,
          timestamp: participant.leftAt,
          userId: invitedUser.id,
          userName: invitedUserName,
          userEmail: invitedUser.email,
        });
      }
    }

    // 4. RCA Analysis events
    const rcaAnalyses = await prisma.rCAAnalysis.findMany({
      where: { incidentId: id },
      include: {
        User: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    for (const rca of rcaAnalyses) {
      const analystName = `${rca.User.firstName} ${rca.User.lastName}`;

      // RCA created
      activities.push({
        id: `rca-created-${rca.id}`,
        type: 'RCA_CREATED',
        category: 'rca',
        action: 'created',
        description: `RCA Analysis started using ${rca.method.replace('_', ' ')} method`,
        timestamp: rca.createdAt,
        userId: rca.User.id,
        userName: analystName,
        userEmail: rca.User.email,
        details: {
          method: rca.method,
          status: rca.status,
        },
      });

      // RCA validated
      if (rca.isValidated && rca.validatedAt) {
        const validator = rca.validatedById ? await prisma.user.findUnique({
          where: { id: rca.validatedById },
          select: { id: true, firstName: true, lastName: true, email: true },
        }) : null;

        activities.push({
          id: `rca-validated-${rca.id}`,
          type: 'RCA_VALIDATED',
          category: 'rca',
          action: 'validated',
          description: `RCA Analysis was validated`,
          timestamp: rca.validatedAt,
          userId: validator?.id || null,
          userName: validator ? `${validator.firstName} ${validator.lastName}` : null,
          userEmail: validator?.email || null,
          details: {
            rootCauseStatement: rca.rootCauseStatement,
          },
        });
      }
    }

    // 5. RCA Versions (changes)
    const rcaVersions = await prisma.rCAVersion.findMany({
      where: {
        RCAAnalysis: {
          incidentId: id,
        },
      },
      include: {
        RCAAnalysis: {
          select: { id: true, method: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    for (const version of rcaVersions) {
      const changedByUser = await prisma.user.findUnique({
        where: { id: version.changedBy },
        select: { id: true, firstName: true, lastName: true, email: true },
      });

      if (version.versionNumber > 1) {
        activities.push({
          id: `rca-version-${version.id}`,
          type: 'RCA_UPDATED',
          category: 'rca',
          action: 'updated',
          description: version.changeReason || 'RCA Analysis was updated',
          timestamp: version.createdAt,
          userId: changedByUser?.id || null,
          userName: changedByUser ? `${changedByUser.firstName} ${changedByUser.lastName}` : null,
          userEmail: changedByUser?.email || null,
          details: {
            versionNumber: version.versionNumber,
            method: version.RCAAnalysis.method,
          },
        });
      }
    }

    // 6. CAPA Actions
    const capaActions = await prisma.cAPAction.findMany({
      where: {
        RCAAnalysis: {
          incidentId: id,
        },
      },
      include: {
        User: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    for (const action of capaActions) {
      const owner = action.User;
      
      // Fetch verifiedBy user if exists
      let verifiedByUser = null;
      if (action.verifiedById) {
        verifiedByUser = await prisma.user.findUnique({
          where: { id: action.verifiedById },
          select: { id: true, firstName: true, lastName: true, email: true },
        });
      }

      // CAPA created
      activities.push({
        id: `capa-created-${action.id}`,
        type: 'CAPA_CREATED',
        category: 'capa',
        action: 'created',
        description: `CAPA Action "${action.title}" was created`,
        timestamp: action.createdAt,
        userId: owner?.id || null,
        userName: owner ? `${owner.firstName} ${owner.lastName}` : null,
        userEmail: owner?.email || null,
        details: {
          title: action.title,
          type: action.actionType,
          status: action.status,
          owner: owner ? `${owner.firstName} ${owner.lastName}` : null,
        },
      });

      // CAPA completed
      if (action.completedAt) {
        // Fetch completedBy user if exists
        let completedByUser = null;
        if (action.completedById) {
          completedByUser = await prisma.user.findUnique({
            where: { id: action.completedById },
            select: { id: true, firstName: true, lastName: true, email: true },
          });
        }
        
        activities.push({
          id: `capa-completed-${action.id}`,
          type: 'CAPA_COMPLETED',
          category: 'capa',
          action: 'completed',
          description: `CAPA Action "${action.title}" was completed`,
          timestamp: action.completedAt,
          userId: completedByUser?.id || owner?.id || null,
          userName: completedByUser ? `${completedByUser.firstName} ${completedByUser.lastName}` : owner ? `${owner.firstName} ${owner.lastName}` : null,
          userEmail: completedByUser?.email || owner?.email || null,
        });
      }

      // CAPA verified
      if (action.verifiedAt && verifiedByUser) {
        activities.push({
          id: `capa-verified-${action.id}`,
          type: 'CAPA_VERIFIED',
          category: 'capa',
          action: 'verified',
          description: `CAPA Action "${action.title}" was verified`,
          timestamp: action.verifiedAt,
          userId: verifiedByUser.id,
          userName: `${verifiedByUser.firstName} ${verifiedByUser.lastName}`,
          userEmail: verifiedByUser.email,
        });
      }
    }

    // 7. Evidence added
    const evidences = await prisma.evidence.findMany({
      where: { incidentId: id },
      orderBy: { uploadedAt: 'asc' },
    });

    for (const evidence of evidences) {
      // Fetch uploader info
      const uploadedBy = await prisma.user.findUnique({
        where: { id: evidence.uploadedById },
        select: { id: true, firstName: true, lastName: true, email: true },
      });
      
      activities.push({
        id: `evidence-added-${evidence.id}`,
        type: 'EVIDENCE_ADDED',
        category: 'evidence',
        action: 'added',
        description: `Evidence "${evidence.fileName || evidence.type}" was uploaded`,
        timestamp: evidence.uploadedAt,
        userId: uploadedBy?.id || null,
        userName: uploadedBy ? `${uploadedBy.firstName} ${uploadedBy.lastName}` : null,
        userEmail: uploadedBy?.email || null,
        details: {
          fileName: evidence.fileName,
          fileType: evidence.type,
        },
      });
    }

    // 8. Get audit logs for this incident (status changes, etc.)
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        entity: 'Incident',
        entityId: id,
      },
      include: {
        User: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    for (const log of auditLogs) {
      const changes = log.changes as any;
      let description = '';
      let type = '';

      if (log.action === 'UPDATE' && changes?.status) {
        type = 'INCIDENT_STATUS_CHANGED';
        description = `Incident status changed from ${changes.status.from || 'unknown'} to ${changes.status.to}`;
      } else if (log.action === 'UPDATE' && changes?.description) {
        type = 'INCIDENT_DESCRIPTION_UPDATED';
        description = 'Incident description was updated';
      } else if (log.action === 'UPDATE') {
        type = 'INCIDENT_UPDATED';
        const changedFields = Object.keys(changes || {}).join(', ');
        description = `Incident was updated (${changedFields || 'details changed'})`;
      } else {
        continue; // Skip other audit log types
      }

      activities.push({
        id: `audit-${log.id}`,
        type,
        category: 'incident',
        action: 'updated',
        description,
        timestamp: log.createdAt,
        userId: log.User?.id || null,
        userName: log.User ? `${log.User.firstName} ${log.User.lastName}` : null,
        userEmail: log.User?.email || null,
        details: changes,
      });
    }

    // Sort all activities by timestamp (oldest first)
    activities.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    res.json({
      success: true,
      data: {
        incidentId: id,
        incidentNumber: incident.incidentNumber,
        activities,
        totalCount: activities.length,
      },
    });
  } catch (error) {
    console.error('Error fetching activity timeline:', error);
    res.status(500).json({ error: 'Failed to fetch activity timeline' });
  }
});

export default router;
