// Phase 4: Triage & Auto-Assignment Service
// Handles severity detection, auto-assignment, and SLA management

import { prisma } from '../utils/prisma';
import { IncidentType, Severity, UserRole, IncidentStatus } from '@prisma/client';
import { generateIncidentSummary } from './aiService';

interface TriageResult {
  suggestedSeverity: Severity;
  assignedToId?: string;
  assignedToName?: string;
  assignmentRuleId?: string;
  slaResponseDeadline?: Date;
  slaResolutionDeadline?: Date;
  autoAssigned: boolean;
}

interface IncidentForTriage {
  id: string;
  type: IncidentType;
  categoryId: string;
  facilityId: string;
  areaId?: string | null;
  description: string;
  severity?: Severity | null;
  organizationId: string;
}

/**
 * Phase 4.1: AI-assisted severity detection
 * Analyzes incident description to suggest appropriate severity level
 */
export async function detectSeverity(description: string, type: IncidentType): Promise<Severity> {
  const lowerDesc = description.toLowerCase();

  // Critical indicators - immediate safety hazards
  const criticalKeywords = [
    'contamination', 'recall', 'injury', 'allergen exposure', 'glass found',
    'metal fragment', 'safety hazard', 'immediate danger', 'hospitalization',
    'foreign object in product', 'pathogen', 'listeria', 'salmonella', 'e.coli',
    'consumer complaint illness', 'product consumed', 'severe allergic',
    'chemical spill', 'fire', 'explosion', 'major leak', 'production halt'
  ];

  // High severity indicators - significant impact
  const highKeywords = [
    'breakdown', 'complete failure', 'shutdown', 'stopped production',
    'not working', 'major malfunction', 'quality issue batch',
    'out of specification', 'temperature deviation', 'cross-contact',
    'mislabeled', 'wrong label', 'expired product', 'spoiled',
    'multiple units affected', 'line down', 'urgent repair',
    'customer complaint', 'regulatory violation', 'audit finding'
  ];

  // Medium severity indicators - moderate concern
  const mediumKeywords = [
    'intermittent', 'occasional issue', 'minor deviation', 'slight',
    'small quantity', 'adjustment needed', 'calibration required',
    'warning light', 'alert triggered', 'maintenance needed', 'wear detected',
    'partial failure', 'slow performance', 'quality variance',
    'documentation error', 'training issue', 'procedure deviation'
  ];

  // Low severity indicators - minimal impact
  const lowKeywords = [
    'cosmetic', 'minor scratch', 'routine', 'scheduled',
    'preventive', 'observation', 'suggestion', 'improvement',
    'normal wear', 'standard maintenance', 'informational'
  ];

  // Score-based severity calculation
  let score = 0;

  criticalKeywords.forEach(kw => {
    if (lowerDesc.includes(kw)) score += 4;
  });

  highKeywords.forEach(kw => {
    if (lowerDesc.includes(kw)) score += 2;
  });

  mediumKeywords.forEach(kw => {
    if (lowerDesc.includes(kw)) score += 1;
  });

  lowKeywords.forEach(kw => {
    if (lowerDesc.includes(kw)) score -= 1;
  });

  // Food safety incidents start at higher base severity
  if (type === 'FOOD_SAFETY') {
    score += 1;
  }

  // Determine severity based on score
  if (score >= 4) return 'CRITICAL';
  if (score >= 2) return 'HIGH';
  if (score >= 0) return 'MEDIUM';
  return 'LOW';
}

/**
 * Phase 4.2: Find matching assignment rule
 * Returns the highest priority matching rule
 */
export async function findMatchingAssignmentRule(incident: IncidentForTriage) {
  const rules = await prisma.assignmentRule.findMany({
    where: {
      organizationId: incident.organizationId,
      isActive: true,
    },
    orderBy: {
      priority: 'desc',
    },
  });

  for (const rule of rules) {
    let matches = true;

    // Check each condition (null means "any")
    if (rule.incidentType && rule.incidentType !== incident.type) {
      matches = false;
    }
    if (rule.categoryId && rule.categoryId !== incident.categoryId) {
      matches = false;
    }
    if (rule.facilityId && rule.facilityId !== incident.facilityId) {
      matches = false;
    }
    if (rule.areaId && rule.areaId !== incident.areaId) {
      matches = false;
    }
    if (rule.severity && rule.severity !== incident.severity) {
      matches = false;
    }

    if (matches) {
      return rule;
    }
  }

  return null;
}

/**
 * Phase 4.2: Find a user to assign based on role
 * Returns an available user with the specified role in the same organization
 */
async function findUserByRole(
  organizationId: string,
  role: UserRole,
  facilityId?: string
): Promise<{ id: string; firstName: string; lastName: string } | null> {
  // Find active users with the specified role
  const users = await prisma.user.findMany({
    where: {
      organizationId,
      role,
      isActive: true,
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      // Could add workload consideration here
    },
    take: 1, // For now, just take the first available
  });

  return users[0] || null;
}

/**
 * Phase 4.3: Get SLA configuration for severity
 */
async function getSLAConfiguration(organizationId: string, severity: Severity) {
  const config = await prisma.sLAConfiguration.findUnique({
    where: {
      organizationId_severity: {
        organizationId,
        severity,
      },
    },
  });

  // Default SLA times if no configuration exists (in hours)
  const defaults: Record<Severity, { response: number; resolution: number }> = {
    CRITICAL: { response: 1, resolution: 4 },
    HIGH: { response: 4, resolution: 24 },
    MEDIUM: { response: 8, resolution: 72 },
    LOW: { response: 24, resolution: 168 }, // 1 week
  };

  return {
    responseTimeHours: config?.responseTimeHours || defaults[severity].response,
    resolutionTimeHours: config?.resolutionTimeHours || defaults[severity].resolution,
  };
}

/**
 * Phase 4: Main triage function
 * Performs AI severity detection, auto-assignment, and SLA calculation
 */
export async function triageIncident(incident: IncidentForTriage): Promise<TriageResult> {
  const result: TriageResult = {
    suggestedSeverity: incident.severity || 'MEDIUM',
    autoAssigned: false,
  };

  // Step 1: AI Severity Detection (Phase 4.1)
  if (!incident.severity) {
    result.suggestedSeverity = await detectSeverity(incident.description, incident.type);
  }

  // Step 2: Find matching assignment rule (Phase 4.2)
  const incidentWithSeverity = {
    ...incident,
    severity: incident.severity || result.suggestedSeverity,
  };
  const rule = await findMatchingAssignmentRule(incidentWithSeverity);

  if (rule) {
    result.assignmentRuleId = rule.id;

    // Assign to specific user or find user by role
    if (rule.assignToUserId) {
      const user = await prisma.user.findUnique({
        where: { id: rule.assignToUserId },
        select: { id: true, firstName: true, lastName: true },
      });
      if (user) {
        result.assignedToId = user.id;
        result.assignedToName = `${user.firstName} ${user.lastName}`;
        result.autoAssigned = true;
      }
    } else if (rule.assignToRole) {
      const user = await findUserByRole(
        incident.organizationId,
        rule.assignToRole,
        incident.facilityId
      );
      if (user) {
        result.assignedToId = user.id;
        result.assignedToName = `${user.firstName} ${user.lastName}`;
        result.autoAssigned = true;
      }
    }

    // Use rule's SLA settings if defined
    if (rule.slaResponseHours || rule.slaResolutionHours) {
      const now = new Date();
      if (rule.slaResponseHours) {
        result.slaResponseDeadline = new Date(now.getTime() + rule.slaResponseHours * 60 * 60 * 1000);
      }
      if (rule.slaResolutionHours) {
        result.slaResolutionDeadline = new Date(now.getTime() + rule.slaResolutionHours * 60 * 60 * 1000);
      }
    }
  }

  // Step 3: Calculate SLA deadlines if not set by rule (Phase 4.3)
  if (!result.slaResponseDeadline || !result.slaResolutionDeadline) {
    const slaConfig = await getSLAConfiguration(
      incident.organizationId,
      incident.severity || result.suggestedSeverity
    );
    const now = new Date();

    if (!result.slaResponseDeadline) {
      result.slaResponseDeadline = new Date(now.getTime() + slaConfig.responseTimeHours * 60 * 60 * 1000);
    }
    if (!result.slaResolutionDeadline) {
      result.slaResolutionDeadline = new Date(now.getTime() + slaConfig.resolutionTimeHours * 60 * 60 * 1000);
    }
  }

  return result;
}

/**
 * Apply triage results to an incident
 */
export async function applyTriageToIncident(incidentId: string, triageResult: TriageResult) {
  const updateData: any = {
    aiSuggestedSeverity: triageResult.suggestedSeverity,
    slaResponseDeadline: triageResult.slaResponseDeadline,
    slaResolutionDeadline: triageResult.slaResolutionDeadline,
    autoAssigned: triageResult.autoAssigned,
  };

  if (triageResult.assignedToId) {
    updateData.assignedToId = triageResult.assignedToId;
    updateData.status = 'ASSIGNED';
  } else {
    updateData.status = 'IN_TRIAGE';
  }

  if (triageResult.assignmentRuleId) {
    updateData.assignmentRuleId = triageResult.assignmentRuleId;
  }

  return prisma.incident.update({
    where: { id: incidentId },
    data: updateData,
  });
}

/**
 * Check for SLA breaches and create notifications
 * This should be called by a scheduled job
 */
export async function checkSLABreaches() {
  const now = new Date();

  // Find incidents with breached response SLA
  const responseBreachers = await prisma.incident.findMany({
    where: {
      slaResponseDeadline: { lt: now },
      slaResponseBreached: false,
      respondedAt: null,
      status: {
        in: ['SUBMITTED', 'IN_TRIAGE', 'ASSIGNED'],
      },
    },
    include: {
      User_Incident_assignedToIdToUser: true,
      User_Incident_createdByIdToUser: true,
    },
  });

  // Find incidents with breached resolution SLA
  const resolutionBreachers = await prisma.incident.findMany({
    where: {
      slaResolutionDeadline: { lt: now },
      slaResolutionBreached: false,
      resolvedAt: null,
      status: {
        notIn: ['CLOSED', 'REJECTED', 'DRAFT'],
      },
    },
    include: {
      User_Incident_assignedToIdToUser: true,
      User_Incident_createdByIdToUser: true,
    },
  });

  // Mark breaches and create notifications
  for (const incident of responseBreachers) {
    await prisma.incident.update({
      where: { id: incident.id },
      data: { slaResponseBreached: true },
    });

    // Notify assigned user and manager
    if (incident.assignedToId) {
      await prisma.notification.create({
        data: {
          type: 'SLA_RESPONSE_BREACHED',
          title: 'SLA Response Time Breached',
          message: `Incident ${incident.incidentNumber} has exceeded its response time SLA`,
          userId: incident.assignedToId,
          incidentId: incident.id,
        },
      });
    }
  }

  for (const incident of resolutionBreachers) {
    await prisma.incident.update({
      where: { id: incident.id },
      data: { slaResolutionBreached: true },
    });

    // Notify assigned user
    if (incident.assignedToId) {
      await prisma.notification.create({
        data: {
          type: 'SLA_RESOLUTION_BREACHED',
          title: 'SLA Resolution Time Breached',
          message: `Incident ${incident.incidentNumber} has exceeded its resolution time SLA`,
          userId: incident.assignedToId,
          incidentId: incident.id,
        },
      });
    }
  }

  return {
    responseBreaches: responseBreachers.length,
    resolutionBreaches: resolutionBreachers.length,
  };
}

/**
 * Mark incident as responded (first action taken)
 */
export async function markIncidentResponded(incidentId: string) {
  const incident = await prisma.incident.findUnique({
    where: { id: incidentId },
    select: { respondedAt: true },
  });

  if (incident && !incident.respondedAt) {
    await prisma.incident.update({
      where: { id: incidentId },
      data: { respondedAt: new Date() },
    });
  }
}

/**
 * Mark incident as resolved
 */
export async function markIncidentResolved(incidentId: string) {
  await prisma.incident.update({
    where: { id: incidentId },
    data: { resolvedAt: new Date() },
  });
}

export default {
  detectSeverity,
  findMatchingAssignmentRule,
  triageIncident,
  applyTriageToIncident,
  checkSLABreaches,
  markIncidentResponded,
  markIncidentResolved,
};
