/**
 * Phase 5-8: RCA (Root Cause Analysis) Service
 * Core business logic for RCA Workspace, 5 Whys, and Fishbone analysis
 */

import { prisma } from '../utils/prisma';
import { RCAMethod, RCAStatus, Severity, IncidentStatus, Prisma } from '@prisma/client';
import { getAIMethodRecommendation } from './aiService';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// Types
// ============================================================================

export interface FiveWhysStep {
  stepNumber: number;
  question: string;
  answer: string;
  evidence?: string[];
  aiSuggestion?: string;
  isSymptomLevel?: boolean;
}

export interface FiveWhysData {
  steps: FiveWhysStep[];
  rootCause?: string;
  aiAnalysis?: {
    depth: 'shallow' | 'adequate' | 'deep';
    suggestions: string[];
    strengthScore: number;
  };
}

export interface FishboneCause {
  id: string;
  text: string;
  evidence?: string[];
  aiSuggested?: boolean;
}

export interface FishboneCategory {
  id: string;
  name: string;
  causes: FishboneCause[];
}

export interface FishboneData {
  problem: string;
  categories: FishboneCategory[];
  rootCauseText?: string;
  aiAnalysis?: {
    categoryCoverage: Record<string, number>;
    suggestions: string[];
  };
}

export interface RCARecommendation {
  recommendedMethod: RCAMethod;
  reason: string;
  confidence: number;
  factors: {
    complexity: 'low' | 'medium' | 'high';
    recurrence: boolean;
    severity: Severity | null;
    hasMultipleCauses: boolean;
  };
}

// ============================================================================
// RCA Incident Context Builder
// ============================================================================

/**
 * Build comprehensive incident context for AI-powered RCA analysis
 * This function transforms the Prisma incident data into the rich context
 * that the AI functions need for intelligent analysis
 */
function buildRCAIncidentContext(incident: {
  id: string;
  incidentNumber: string;
  description: string;
  type: string;
  severity: Severity | null;
  incidentDate?: Date | null;
  shiftTime?: string | null;
  aiSummary?: string | null;
  aiAnalysisData?: any;
  immediateActionsTaken?: string | null;
  // Workplace safety fields
  injuryCausedByWork?: string | null;
  directCause?: string | null;
  contributingFactors?: string[] | null;
  unsafeActOrCondition?: string | null;
  injuryType?: string | null;
  bodyPartsAffected?: string[] | null;
  environmentalConditions?: string[] | null;
  equipmentInvolved?: string | null;
  taskPerformed?: string | null;
  // Quality/Food safety fields
  productAffected?: string | null;
  batchLot?: string | null;
  quantityAffected?: string | null;
  deviationType?: string | null;
  contaminationType?: string | null;
  // Relations
  Category?: { name: string } | null;
  Facility?: { name: string } | null;
  Area?: { name: string } | null;
  Line?: { name: string } | null;
  Evidence?: Array<{
    id: string;
    fileName: string;
    type: string;
    aiAnalysis?: string | null;
    extractedText?: string | null;
  }> | null;
  RCAAnalysis?: Array<{ id: string; method: string; isValidated?: boolean | null }> | null;
}) {
  // Parse aiAnalysisData if it's a string
  let aiAnalysisData = null;
  if (incident.aiAnalysisData) {
    try {
      aiAnalysisData = typeof incident.aiAnalysisData === 'string' 
        ? JSON.parse(incident.aiAnalysisData) 
        : incident.aiAnalysisData;
    } catch (e) {
      console.warn('Failed to parse aiAnalysisData:', e);
    }
  }

  // Check if this is a recurring issue
  const previousRCAs = incident.RCAAnalysis?.filter(rca => rca.isValidated) || [];
  const isRecurring = previousRCAs.length > 0;

  // Build the context object
  return {
    // Core details
    description: incident.description,
    type: incident.type,
    severity: incident.severity,
    incidentNumber: incident.incidentNumber,
    incidentDate: incident.incidentDate || undefined,
    shiftTime: incident.shiftTime,
    
    // Category and location
    categoryName: incident.Category?.name,
    facilityName: incident.Facility?.name,
    areaName: incident.Area?.name,
    lineName: incident.Line?.name,
    
    // AI-generated insights
    aiSummary: incident.aiSummary,
    aiAnalysisData: aiAnalysisData,
    
    // Immediate actions
    immediateActionsTaken: incident.immediateActionsTaken,
    
    // Workplace safety context
    workplaceSafety: incident.type === 'WORKPLACE_SAFETY' ? {
      injuryCausedByWork: incident.injuryCausedByWork,
      directCause: incident.directCause,
      contributingFactors: incident.contributingFactors,
      unsafeActOrCondition: incident.unsafeActOrCondition,
      injuryType: incident.injuryType,
      bodyPartsAffected: incident.bodyPartsAffected,
      environmentalConditions: incident.environmentalConditions,
      equipmentInvolved: incident.equipmentInvolved,
      taskPerformed: incident.taskPerformed,
    } : null,
    
    // Quality/Food safety context
    qualitySafety: incident.type === 'FOOD_SAFETY' ? {
      productAffected: incident.productAffected,
      batchLot: incident.batchLot,
      quantityAffected: incident.quantityAffected,
      deviationType: incident.deviationType,
      contaminationType: incident.contaminationType,
    } : null,
    
    // Evidence with transcription
    evidence: incident.Evidence?.map(e => ({
      fileName: e.fileName,
      type: e.type,
      transcription: e.transcription,
    })),
    
    // Historical context
    isRecurring,
    similarIncidentsCount: previousRCAs.length,
    similarIncidentsMethods: previousRCAs.map(rca => ({
      method: rca.method,
      success: rca.isValidated || false,
    })),
  };
}

// ============================================================================
// Phase 5.1: RCA Workspace Shell
// ============================================================================

/**
 * Get RCA analyses for an incident
 */
export async function getIncidentRCAAnalyses(incidentId: string) {
  return prisma.rCAAnalysis.findMany({
    where: { incidentId },
    include: {
      User: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
        },
      },
      Comment: {
        include: {
          User: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      },
      Evidence: true,
      CAPAction: {
        include: {
          User: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      },
      RCAVersion: {
        orderBy: { versionNumber: 'desc' },
        take: 10,
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Get a single RCA analysis by ID
 */
export async function getRCAAnalysis(rcaId: string) {
  return prisma.rCAAnalysis.findUnique({
    where: { id: rcaId },
    include: {
      Incident: {
        include: {
          Category: true,
          Facility: true,
          Department: true,
          Area: true,
          Line: true,
          Shift: true,
          Evidence: true,
          User_Incident_createdByIdToUser: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          IncidentParticipant: {
            where: { isActive: true },
            include: {
              User_IncidentParticipant_userIdToUser: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                  role: true,
                  isOnline: true,
                },
              },
            },
          },
        },
      },
      User: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
        },
      },
      Comment: {
        include: {
          User: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      },
      Evidence: true,
      CAPAction: {
        include: {
          User: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      },
      RCAVersion: {
        orderBy: { versionNumber: 'desc' },
      },
    },
  });
}

/**
 * Create a new RCA analysis for an incident
 */
export async function createRCAAnalysis(
  incidentId: string,
  method: RCAMethod,
  analystId: string
) {
  // Fetch FULL incident context including AI analysis, evidence, and all details
  const incident = await prisma.incident.findUnique({
    where: { id: incidentId },
    include: {
      Category: true,
      RCAAnalysis: true,
      Facility: true,
      Area: true,
      Line: true,
      Evidence: {
        select: {
          id: true,
          fileName: true,
          type: true,
          transcription: true,
        },
      },
    },
  });

  if (!incident) {
    throw new Error('Incident not found');
  }

  // Build rich incident context for AI method recommendation
  const incidentContext = buildRCAIncidentContext(incident);

  // Get AI-powered recommendation using full context
  const recommendation = await getAIMethodRecommendation(incidentContext);

  // Create the RCA analysis
  const rcaAnalysis = await prisma.rCAAnalysis.create({
    data: {
      id: uuidv4(),
      updatedAt: new Date(),
      incidentId,
      method,
      analystId,
      status: RCAStatus.NOT_STARTED,
      aiRecommendedMethod: recommendation.recommendedMethod,
      aiRecommendationReason: recommendation.reason,
      fiveWhysData: method === RCAMethod.FIVE_WHYS ? { steps: [] } : Prisma.JsonNull,
      fishboneData: method === RCAMethod.FISHBONE ? {
        problem: incident.description,
        categories: getDefaultFishboneCategories(incident.type),
      } as unknown as Prisma.InputJsonValue : Prisma.JsonNull,
    },
    include: {
      Incident: true,
      User: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  // Update incident status to IN_PROGRESS if it's SUBMITTED
  if (incident.status === 'SUBMITTED') {
    await prisma.incident.update({
      where: { id: incidentId },
      data: { status: IncidentStatus.IN_PROGRESS },
    });
  }

  return rcaAnalysis;
}

/**
 * Get timeline events for an incident (for Timeline Panel)
 */
export async function getIncidentTimeline(incidentId: string) {
  const incident = await prisma.incident.findUnique({
    where: { id: incidentId },
    include: {
      User_Incident_createdByIdToUser: { select: { firstName: true, lastName: true } },
      User_Incident_assignedToIdToUser: { select: { firstName: true, lastName: true } },
      Comment: {
        include: {
          User: { select: { firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'asc' },
      },
      Evidence: {
        orderBy: { uploadedAt: 'asc' },
      },
      RCAAnalysis: {
        include: {
          User: { select: { firstName: true, lastName: true } },
          RCAVersion: {
            orderBy: { createdAt: 'asc' },
          },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!incident) {
    throw new Error('Incident not found');
  }

  // Build timeline events
  const events: Array<{
    id: string;
    type: string;
    title: string;
    description: string;
    timestamp: Date;
    user?: { firstName: string; lastName: string };
    metadata?: Record<string, unknown>;
  }> = [];

  // Incident created
  events.push({
    id: `created-${incident.id}`,
    type: 'incident_created',
    title: 'Incident Created',
    description: `Incident ${incident.incidentNumber} was created`,
    timestamp: incident.createdAt,
    user: incident.User_Incident_createdByIdToUser,
  });

  // Evidence uploads
  incident.Evidence.forEach((ev) => {
    events.push({
      id: `evidence-${ev.id}`,
      type: 'evidence_uploaded',
      title: 'Evidence Uploaded',
      description: `${ev.type} file "${ev.fileName}" was uploaded`,
      timestamp: ev.uploadedAt,
      metadata: { evidenceType: ev.type, fileName: ev.fileName },
    });
  });

  // Comments
  incident.Comment.forEach((comment) => {
    events.push({
      id: `comment-${comment.id}`,
      type: 'comment_added',
      title: 'Comment Added',
      description: comment.content.substring(0, 100) + (comment.content.length > 100 ? '...' : ''),
      timestamp: comment.createdAt,
      user: comment.User,
    });
  });

  // RCA analyses
  incident.RCAAnalysis.forEach((rca) => {
    events.push({
      id: `rca-${rca.id}`,
      type: 'rca_started',
      title: `${rca.method.replace('_', ' ')} Analysis Started`,
      description: `Root cause analysis using ${rca.method.replace('_', ' ')} method`,
      timestamp: rca.createdAt,
      user: rca.User,
    });

    // RCA version updates
    rca.RCAVersion.forEach((version, idx) => {
      if (idx > 0) { // Skip first version (creation)
        events.push({
          id: `rca-version-${version.id}`,
          type: 'rca_updated',
          title: 'RCA Updated',
          description: version.changeReason || `Version ${version.versionNumber}`,
          timestamp: version.createdAt,
          metadata: { versionNumber: version.versionNumber },
        });
      }
    });

    // RCA validated
    if (rca.isValidated && rca.validatedAt) {
      events.push({
        id: `rca-validated-${rca.id}`,
        type: 'rca_validated',
        title: 'Root Cause Validated',
        description: rca.rootCauseStatement || 'Root cause has been validated',
        timestamp: rca.validatedAt,
      });
    }
  });

  // Sort by timestamp
  events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  return events;
}

/**
 * Add a comment to an incident or RCA
 */
export async function addComment(
  userId: string,
  content: string,
  incidentId?: string,
  rcaAnalysisId?: string
) {
  if (!incidentId && !rcaAnalysisId) {
    throw new Error('Either incidentId or rcaAnalysisId is required');
  }

  return prisma.comment.create({
    data: {
      id: uuidv4(),
      updatedAt: new Date(),
      content,
      userId,
      incidentId,
      rcaAnalysisId,
    },
    include: {
      User: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });
}

// ============================================================================
// Phase 5.2: RCA Method Selector
// ============================================================================

/**
 * Get default fishbone categories based on incident type
 */
function getDefaultFishboneCategories(incidentType: string): FishboneCategory[] {
  if (incidentType === 'FOOD_SAFETY') {
    return [
      { id: '1', name: 'Man (People)', causes: [] },
      { id: '2', name: 'Machine (Equipment)', causes: [] },
      { id: '3', name: 'Method (Process)', causes: [] },
      { id: '4', name: 'Material (Ingredients)', causes: [] },
      { id: '5', name: 'Measurement', causes: [] },
      { id: '6', name: 'Environment', causes: [] },
    ];
  }
  
  // MACHINE_EQUIPMENT type
  return [
    { id: '1', name: 'Machine', causes: [] },
    { id: '2', name: 'Man (Operator)', causes: [] },
    { id: '3', name: 'Material', causes: [] },
    { id: '4', name: 'Method', causes: [] },
    { id: '5', name: 'Measurement', causes: [] },
    { id: '6', name: 'Mother Nature (Environment)', causes: [] },
  ];
}

/**
 * Update RCA method selection
 */
export async function updateRCAMethod(rcaId: string, method: RCAMethod) {
  console.log('[updateRCAMethod] Starting with rcaId:', rcaId, 'method:', method);
  
  const rca = await prisma.rCAAnalysis.findUnique({
    where: { id: rcaId },
    include: { Incident: true },
  });

  if (!rca) {
    throw new Error('RCA analysis not found');
  }

  console.log('[updateRCAMethod] Found RCA:', rca.id, 'current method:', rca.method);

  // Initialize data for the new method
  const updateData: Record<string, unknown> = { method };

  if (method === RCAMethod.FIVE_WHYS && !rca.fiveWhysData) {
    updateData.fiveWhysData = { steps: [] };
  } else if (method === RCAMethod.FISHBONE && !rca.fishboneData) {
    updateData.fishboneData = {
      problem: rca.Incident.description,
      categories: getDefaultFishboneCategories(rca.Incident.type),
    };
  }

  console.log('[updateRCAMethod] Updating with data keys:', Object.keys(updateData));

  const result = await prisma.rCAAnalysis.update({
    where: { id: rcaId },
    data: updateData,
  });
  
  console.log('[updateRCAMethod] Update successful');
  return result;
}

// ============================================================================
// Phase 5.3: AI Method Recommendation
// ============================================================================

/**
 * Get AI-powered method recommendation based on incident characteristics
 * PRIORITY: Use existing aiAnalysisData.recommendedRCAMethodology if available
 * to maintain consistency with the AI analysis shown on the incident detail page
 */
export async function getMethodRecommendation(incident: {
  id: string;
  description: string;
  severity?: Severity | null;
  type: string;
  Category?: { name: string } | null;
  aiAnalysisData?: any;
}): Promise<RCARecommendation> {
  // PRIORITY 1: Check if incident already has AI recommendation from initial analysis
  // This ensures consistency between incident detail page and RCA workspace
  if (incident.aiAnalysisData?.recommendedRCAMethodology) {
    const existingRec = incident.aiAnalysisData.recommendedRCAMethodology;
    console.log(`[getMethodRecommendation] Found existing AI recommendation data:`, JSON.stringify(existingRec, null, 2));
    
    const methodMap: Record<string, RCAMethod> = {
      'fishbone': RCAMethod.FISHBONE,
      'five_whys': RCAMethod.FIVE_WHYS,
      '5_whys': RCAMethod.FIVE_WHYS,
      'FISHBONE': RCAMethod.FISHBONE,
      'FIVE_WHYS': RCAMethod.FIVE_WHYS,
    };
    
    // FIXED: Check for 'primary' field (actual structure) not 'method'
    const methodValue = existingRec.primary || existingRec.method;
    const mappedMethod = methodMap[methodValue] || methodMap[methodValue?.toLowerCase()];
    
    if (mappedMethod) {
      // Normalize confidence: if it's a percentage (e.g., 80), convert to decimal (0.8)
      const rawConfidence = existingRec.confidence || 80;
      const normalizedConfidence = rawConfidence > 1 ? rawConfidence / 100 : rawConfidence;
      
      console.log(`[getMethodRecommendation] Using existing AI recommendation: ${mappedMethod} (confidence: ${normalizedConfidence})`);
      return {
        recommendedMethod: mappedMethod,
        reason: existingRec.reason || existingRec.reasoning || 'Based on AI analysis of the incident evidence and description.',
        confidence: normalizedConfidence,
        factors: {
          complexity: existingRec.factors?.complexity || 'medium',
          recurrence: existingRec.factors?.recurrence || false,
          severity: incident.severity ?? null,
          hasMultipleCauses: existingRec.factors?.hasMultipleCauses || false,
        },
      };
    } else {
      console.log(`[getMethodRecommendation] Could not map method value: ${methodValue}`);
    }
  } else {
    console.log(`[getMethodRecommendation] No aiAnalysisData.recommendedRCAMethodology found. aiAnalysisData:`, incident.aiAnalysisData ? 'exists' : 'null');
  }

  // FALLBACK: Calculate recommendation if no existing AI analysis
  console.log(`[getMethodRecommendation] No existing AI recommendation found, calculating...`);

  // Check for similar past incidents
  const similarIncidents = await prisma.incident.findMany({
    where: {
      type: incident.type as any,
      id: { not: incident.id },
      RCAAnalysis: {
        some: {
          isValidated: true,
        },
      },
    },
    include: {
      RCAAnalysis: {
        where: { isValidated: true },
        select: { method: true, rootCauseStatement: true },
      },
    },
    take: 10,
    orderBy: { createdAt: 'desc' },
  });

  // Analyze complexity factors
  const descriptionLength = incident.description.length;
  const hasMultiplePotentialCauses = containsMultipleCauseIndicators(incident.description);
  const isRecurring = similarIncidents.length > 2;
  const isSevere = incident.severity === 'CRITICAL' || incident.severity === 'HIGH';

  // Calculate complexity
  let complexity: 'low' | 'medium' | 'high' = 'low';
  let complexityScore = 0;

  if (descriptionLength > 500) complexityScore += 2;
  else if (descriptionLength > 200) complexityScore += 1;

  if (hasMultiplePotentialCauses) complexityScore += 2;
  if (isRecurring) complexityScore += 1;
  if (isSevere) complexityScore += 1;

  if (complexityScore >= 4) complexity = 'high';
  else if (complexityScore >= 2) complexity = 'medium';

  // Determine recommended method
  let recommendedMethod: RCAMethod;
  let reason: string;
  let confidence: number;

  if (complexity === 'high' || hasMultiplePotentialCauses) {
    recommendedMethod = RCAMethod.FISHBONE;
    reason = 'This incident appears to have multiple potential causes across different categories. ' +
      'A Fishbone (Ishikawa) diagram will help systematically explore all possible contributing factors.';
    confidence = hasMultiplePotentialCauses ? 0.85 : 0.7;
  } else if (complexity === 'low' && !isRecurring) {
    recommendedMethod = RCAMethod.FIVE_WHYS;
    reason = 'This appears to be a straightforward incident with a likely single root cause. ' +
      'The 5 Whys method will help drill down to the fundamental cause efficiently.';
    confidence = 0.8;
  } else {
    // Medium complexity - check what worked for similar incidents
    const methodCounts = similarIncidents.reduce((acc, inc) => {
      inc.rcaAnalyses.forEach((rca) => {
        acc[rca.method] = (acc[rca.method] || 0) + 1;
      });
      return acc;
    }, {} as Record<string, number>);

    if (methodCounts[RCAMethod.FISHBONE] > methodCounts[RCAMethod.FIVE_WHYS]) {
      recommendedMethod = RCAMethod.FISHBONE;
      reason = 'Similar incidents were successfully analyzed using Fishbone diagrams. ' +
        'This method has proven effective for this type of issue.';
    } else {
      recommendedMethod = RCAMethod.FIVE_WHYS;
      reason = 'The 5 Whys method is recommended for medium-complexity incidents like this one. ' +
        'It provides a structured approach to finding the root cause.';
    }
    confidence = 0.65;
  }

  return {
    recommendedMethod,
    reason,
    confidence,
    factors: {
      complexity,
      recurrence: isRecurring,
      severity: incident.severity ?? null,
      hasMultipleCauses: hasMultiplePotentialCauses,
    },
  };
}

/**
 * Check if description indicates multiple potential causes
 */
function containsMultipleCauseIndicators(description: string): boolean {
  const indicators = [
    'multiple',
    'several',
    'various',
    'different',
    'combination',
    'both',
    'and also',
    'in addition',
    'furthermore',
    'as well as',
    'along with',
    'factors',
    'causes',
    'issues',
    'problems',
  ];

  const lowerDesc = description.toLowerCase();
  return indicators.some((indicator) => lowerDesc.includes(indicator));
}

// ============================================================================
// Phase 6: 5 Whys Engine
// ============================================================================

/**
 * Update 5 Whys data for an RCA analysis
 */
export async function updateFiveWhys(
  rcaId: string,
  userId: string,
  fiveWhysData: FiveWhysData,
  changeReason?: string
) {
  const rca = await prisma.rCAAnalysis.findUnique({
    where: { id: rcaId },
  });

  if (!rca) {
    throw new Error('RCA analysis not found');
  }

  // Create version history entry
  const latestVersion = await prisma.rCAVersion.findFirst({
    where: { rcaAnalysisId: rcaId },
    orderBy: { versionNumber: 'desc' },
  });

  const newVersionNumber = (latestVersion?.versionNumber || 0) + 1;

  await prisma.rCAVersion.create({
    data: {
      id: uuidv4(),
      rcaAnalysisId: rcaId,
      versionNumber: newVersionNumber,
      data: fiveWhysData as any,
      changedBy: userId,
      changeReason: changeReason || 'Updated 5 Whys analysis',
    },
  });

  // Update the RCA analysis
  const updatedStatus = fiveWhysData.rootCause ? RCAStatus.IN_PROGRESS : rca.status;

  return prisma.rCAAnalysis.update({
    where: { id: rcaId },
    data: {
      fiveWhysData: fiveWhysData as any,
      status: updatedStatus,
      rootCauseStatement: fiveWhysData.rootCause,
    },
  });
}

/**
 * Get AI suggestions for 5 Whys
 */
export async function getFiveWhysAISuggestions(
  rcaId: string,
  currentStep: number,
  currentAnswer: string
): Promise<{
  suggestedQuestion: string;
  depthAnalysis: string;
  isSymptomLevel: boolean;
  betterPhrasing?: string;
}> {
  const rca = await prisma.rCAAnalysis.findUnique({
    where: { id: rcaId },
    include: {
      Incident: {
        include: { Category: true },
      },
    },
  });

  if (!rca) {
    throw new Error('RCA analysis not found');
  }

  const fiveWhysData = rca.fiveWhysData as FiveWhysData | null;
  const previousSteps = fiveWhysData?.steps || [];

  // Build context for AI
  const context = `
Incident: ${rca.Incident.description}
Category: ${rca.Incident.Category?.name || 'Unknown'}
Previous Why steps:
${previousSteps.map((s) => `Why ${s.stepNumber}: ${s.question}\nAnswer: ${s.answer}`).join('\n')}
Current step: Why ${currentStep}
Current answer: ${currentAnswer}
`;

  // Use AI to analyze (if available, otherwise use rule-based)
  try {
    // AI integration placeholder - for now, use rule-based suggestions
    return generateRuleBasedFiveWhysSuggestion(currentStep, currentAnswer, previousSteps);
  } catch (error) {
    return generateRuleBasedFiveWhysSuggestion(currentStep, currentAnswer, previousSteps);
  }
}

/**
 * Generate rule-based 5 Whys suggestion when AI is unavailable
 */
function generateRuleBasedFiveWhysSuggestion(
  currentStep: number,
  currentAnswer: string,
  previousSteps: FiveWhysStep[]
): {
  suggestedQuestion: string;
  depthAnalysis: string;
  isSymptomLevel: boolean;
  betterPhrasing?: string;
} {
  const isSymptom = isLikelySymptom(currentAnswer);
  
  let depthAnalysis = '';
  if (currentStep <= 2) {
    depthAnalysis = 'You are still at the symptom level. Keep asking "why" to dig deeper into the root cause.';
  } else if (currentStep === 3 || currentStep === 4) {
    depthAnalysis = 'Getting closer to the root cause. Consider if this answer reveals a systemic issue.';
  } else {
    depthAnalysis = 'You should be approaching the root cause. Consider if this is something that can be directly addressed with an action.';
  }

  // Generate next question
  const cleanAnswer = currentAnswer.toLowerCase().replace(/\.$/, '').replace(/^because\s+/i, '');
  const suggestedQuestion = `Why did ${cleanAnswer}?`;

  return {
    suggestedQuestion,
    depthAnalysis,
    isSymptomLevel: isSymptom,
    betterPhrasing: isSymptom ? 'Consider rephrasing to focus on the process or system failure rather than the immediate symptom.' : undefined,
  };
}

/**
 * Check if an answer is likely a symptom rather than a cause
 */
function isLikelySymptom(answer: string): boolean {
  const symptomIndicators = [
    'broke',
    'failed',
    'stopped',
    'didn\'t work',
    'malfunctioned',
    'error',
    'wrong',
    'incorrect',
    'missing',
    'not available',
    'wasn\'t there',
    'wasn\'t working',
  ];

  const lowerAnswer = answer.toLowerCase();
  return symptomIndicators.some((indicator) => lowerAnswer.includes(indicator));
}

// ============================================================================
// Phase 7: Fishbone Engine
// ============================================================================

/**
 * Update Fishbone data for an RCA analysis
 */
export async function updateFishbone(
  rcaId: string,
  userId: string,
  fishboneData: FishboneData,
  changeReason?: string
) {
  const rca = await prisma.rCAAnalysis.findUnique({
    where: { id: rcaId },
  });

  if (!rca) {
    throw new Error('RCA analysis not found');
  }

  // Create version history entry
  const latestVersion = await prisma.rCAVersion.findFirst({
    where: { rcaAnalysisId: rcaId },
    orderBy: { versionNumber: 'desc' },
  });

  const newVersionNumber = (latestVersion?.versionNumber || 0) + 1;

  await prisma.rCAVersion.create({
    data: {
      id: uuidv4(),
      rcaAnalysisId: rcaId,
      versionNumber: newVersionNumber,
      data: fishboneData as any,
      changedBy: userId,
      changeReason: changeReason || 'Updated Fishbone diagram',
    },
  });

  // Update the RCA analysis
  const updatedStatus = fishboneData.rootCauseText ? RCAStatus.IN_PROGRESS : rca.status;

  return prisma.rCAAnalysis.update({
    where: { id: rcaId },
    data: {
      fishboneData: fishboneData as any,
      status: updatedStatus,
      rootCauseStatement: fishboneData.rootCauseText,
    },
  });
}

/**
 * Get AI suggestions for Fishbone causes
 */
export async function getFishboneAISuggestions(
  rcaId: string,
  categoryName: string
): Promise<{
  suggestedCauses: string[];
  categoryAnalysis: string;
}> {
  const rca = await prisma.rCAAnalysis.findUnique({
    where: { id: rcaId },
    include: {
      Incident: {
        include: { Category: true },
      },
    },
  });

  if (!rca) {
    throw new Error('RCA analysis not found');
  }

  // Build context for suggestions
  const context = `
Incident type: ${rca.Incident.type}
Incident description: ${rca.Incident.description}
Category: ${rca.Incident.Category?.name || 'Unknown'}
Fishbone category to suggest for: ${categoryName}
`;

  try {
    // AI integration placeholder - for now, use rule-based suggestions
    return generateRuleBasedFishboneSuggestions(rca.Incident.type, categoryName, rca.Incident.description);
  } catch (error) {
    return generateRuleBasedFishboneSuggestions(rca.Incident.type, categoryName, rca.Incident.description);
  }
}

/**
 * Generate rule-based Fishbone suggestions when AI is unavailable
 */
function generateRuleBasedFishboneSuggestions(
  incidentType: string,
  categoryName: string,
  description: string
): { suggestedCauses: string[]; categoryAnalysis: string } {
  const suggestions: Record<string, Record<string, string[]>> = {
    FOOD_SAFETY: {
      'Man (People)': [
        'Inadequate training on food safety procedures',
        'Human error during handling',
        'Lack of supervision',
        'Fatigue or distraction',
        'Non-compliance with SOPs',
      ],
      'Machine (Equipment)': [
        'Equipment malfunction',
        'Inadequate maintenance',
        'Calibration issues',
        'Design limitations',
        'Equipment age/wear',
      ],
      'Method (Process)': [
        'Unclear or missing procedures',
        'Outdated SOPs',
        'Process not validated',
        'Inadequate process controls',
        'Missing critical steps',
      ],
      'Material (Ingredients)': [
        'Supplier quality issues',
        'Incoming inspection failures',
        'Storage conditions',
        'Material contamination',
        'Specification non-conformance',
      ],
      'Measurement': [
        'Inaccurate measurement devices',
        'Missing quality checks',
        'Inadequate sampling',
        'Wrong specifications',
        'Testing method issues',
      ],
      'Environment': [
        'Temperature control issues',
        'Humidity problems',
        'Sanitation gaps',
        'Cross-contamination risk',
        'Facility design issues',
      ],
    },
    MACHINE_EQUIPMENT: {
      'Machine': [
        'Mechanical failure',
        'Electrical issues',
        'Software/control problems',
        'Wear and tear',
        'Design limitations',
      ],
      'Man (Operator)': [
        'Operator error',
        'Insufficient training',
        'Fatigue',
        'Miscommunication',
        'Procedure not followed',
      ],
      'Material': [
        'Wrong material used',
        'Material defects',
        'Supply chain issues',
        'Incompatible materials',
        'Material degradation',
      ],
      'Method': [
        'Incorrect setup',
        'Wrong parameters',
        'Missing maintenance steps',
        'Inadequate procedures',
        'Process variation',
      ],
      'Measurement': [
        'Sensor failure',
        'Calibration drift',
        'Wrong readings',
        'Missing inspections',
        'Specification errors',
      ],
      'Mother Nature (Environment)': [
        'Temperature extremes',
        'Humidity effects',
        'Dust/contamination',
        'Vibration',
        'Power fluctuations',
      ],
    },
  };

  const typeSuggestions = suggestions[incidentType] || suggestions['MACHINE_EQUIPMENT'];
  const categorySuggestions = typeSuggestions[categoryName] || [];

  return {
    suggestedCauses: categorySuggestions,
    categoryAnalysis: `Common causes in the "${categoryName}" category for ${incidentType.replace('_', ' ')} incidents`,
  };
}

/**
 * Convert Fishbone diagram to root cause text
 */
export async function convertFishboneToText(rcaId: string): Promise<string> {
  const rca = await prisma.rCAAnalysis.findUnique({
    where: { id: rcaId },
    include: {
      incident: true,
    },
  });

  if (!rca || !rca.fishboneData) {
    throw new Error('RCA analysis or Fishbone data not found');
  }

  const fishboneData = rca.fishboneData as unknown as FishboneData;
  
  // Build text representation
  let text = `Root Cause Analysis - Fishbone Diagram\n`;
  text += `Problem: ${fishboneData.problem}\n\n`;
  text += `Contributing Factors:\n`;

  fishboneData.categories.forEach((category) => {
    if (category.causes.length > 0) {
      text += `\n${category.name}:\n`;
      category.causes.forEach((cause) => {
        text += `  • ${cause.text}\n`;
      });
    }
  });

  if (fishboneData.rootCauseText) {
    text += `\nRoot Cause Statement:\n${fishboneData.rootCauseText}`;
  }

  return text;
}

// ============================================================================
// RCA Validation
// ============================================================================

/**
 * Validate and finalize an RCA analysis
 */
export async function validateRCA(
  rcaId: string,
  validatorId: string,
  rootCauseStatement: string
) {
  const rca = await prisma.rCAAnalysis.findUnique({
    where: { id: rcaId },
    include: { Incident: true },
  });

  if (!rca) {
    throw new Error('RCA analysis not found');
  }

  // Update RCA as validated
  const updatedRCA = await prisma.rCAAnalysis.update({
    where: { id: rcaId },
    data: {
      isValidated: true,
      validatedAt: new Date(),
      validatedById: validatorId,
      rootCauseStatement,
      status: RCAStatus.VALIDATED,
    },
  });

  // Update incident status to IN_REVIEW when RCA is validated (awaiting final closure)
  await prisma.incident.update({
    where: { id: rca.incidentId },
    data: { status: IncidentStatus.IN_REVIEW },
  });

  return updatedRCA;
}

/**
 * Re-open a validated RCA for editing
 */
export async function reopenRCA(rcaId: string, userId: string, reason?: string) {
  const rca = await prisma.rCAAnalysis.findUnique({
    where: { id: rcaId },
    include: { Incident: true },
  });

  if (!rca) {
    throw new Error('RCA analysis not found');
  }

  if (!rca.isValidated) {
    throw new Error('RCA is not validated, cannot re-open');
  }

  // Create a version history entry before re-opening
  const latestVersion = await prisma.rCAVersion.findFirst({
    where: { rcaAnalysisId: rcaId },
    orderBy: { versionNumber: 'desc' },
  });

  await prisma.rCAVersion.create({
    data: {
      id: uuidv4(),
      rcaAnalysisId: rcaId,
      versionNumber: (latestVersion?.versionNumber || 0) + 1,
      data: {
        method: rca.method,
        fiveWhysData: rca.fiveWhysData,
        fishboneData: rca.fishboneData,
        rootCauseStatement: rca.rootCauseStatement,
        status: rca.status,
        isValidated: rca.isValidated,
        validatedAt: rca.validatedAt,
      },
      changedBy: userId,
      changeReason: reason || 'Re-opened for editing',
    },
  });

  // Update RCA to re-open it
  const updatedRCA = await prisma.rCAAnalysis.update({
    where: { id: rcaId },
    data: {
      isValidated: false,
      validatedAt: null,
      validatedById: null,
      status: RCAStatus.IN_PROGRESS,
    },
  });

  // Update incident status back to in progress
  await prisma.incident.update({
    where: { id: rca.incidentId },
    data: { status: IncidentStatus.IN_PROGRESS },
  });

  return updatedRCA;
}

/**
 * Get RCA version history
 */
export async function getRCAVersionHistory(rcaId: string) {
  return prisma.rCAVersion.findMany({
    where: { rcaAnalysisId: rcaId },
    orderBy: { versionNumber: 'desc' },
  });
}

/**
 * Restore a previous RCA version
 */
export async function restoreRCAVersion(
  rcaId: string,
  versionId: string,
  userId: string
) {
  const version = await prisma.rCAVersion.findUnique({
    where: { id: versionId },
  });

  if (!version) {
    throw new Error('Version not found');
  }

  const rca = await prisma.rCAAnalysis.findUnique({
    where: { id: rcaId },
  });

  if (!rca) {
    throw new Error('RCA analysis not found');
  }

  // Create a new version for the restoration
  const latestVersion = await prisma.rCAVersion.findFirst({
    where: { rcaAnalysisId: rcaId },
    orderBy: { versionNumber: 'desc' },
  });

  const newVersionNumber = (latestVersion?.versionNumber || 0) + 1;

  await prisma.rCAVersion.create({
    data: {
      id: uuidv4(),
      rcaAnalysisId: rcaId,
      versionNumber: newVersionNumber,
      data: version.data as any,
      changedBy: userId,
      changeReason: `Restored from version ${version.versionNumber}`,
    },
  });

  // Determine which data field to update based on method
  const updateData: Record<string, unknown> = {};
  if (rca.method === RCAMethod.FIVE_WHYS) {
    updateData.fiveWhysData = version.data;
    const data = version.data as unknown as FiveWhysData;
    updateData.rootCauseStatement = data.rootCause;
  } else {
    updateData.fishboneData = version.data;
    const data = version.data as unknown as FishboneData;
    updateData.rootCauseStatement = data.rootCauseText;
  }

  return prisma.rCAAnalysis.update({
    where: { id: rcaId },
    data: updateData,
  });
}

export default {
  getIncidentRCAAnalyses,
  getRCAAnalysis,
  createRCAAnalysis,
  getIncidentTimeline,
  addComment,
  updateRCAMethod,
  getMethodRecommendation,
  updateFiveWhys,
  getFiveWhysAISuggestions,
  updateFishbone,
  getFishboneAISuggestions,
  convertFishboneToText,
  validateRCA,
  reopenRCA,
  getRCAVersionHistory,
  restoreRCAVersion,
};
