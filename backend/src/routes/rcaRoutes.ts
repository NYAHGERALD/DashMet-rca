/**
 * Phase 5-8: RCA (Root Cause Analysis) Routes
 * API endpoints for RCA Workspace, 5 Whys, Fishbone, and validation
 */

import { Router, Request, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requireRoles, requirePrivilege } from '../middleware/rbac';
import { UserRole } from '@prisma/client';
import { prisma } from '../utils/prisma';
import rcaService from '../services/rcaService';
import { websocketService } from '../services/websocketService';
import { 
  generateAIFiveWhysAnalysis, 
  generateAIFishboneAnalysis,
  generateAIFiveWhysSuggestion,
  generateAIFishboneCategorySuggestions,
  validateFirstWhyAnswer,
  generateCompleteFiveWhysFromFirstAnswer,
  generateContextualFirstQuestion,
  validateFishboneProblemStatement,
  analyzeFishboneCauseWithFiveWhys,
  generateEnhancedFishboneAnalysis,
  getAIMethodRecommendation
} from '../services/aiService';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

/**
 * Helper to build incident context for AI from Prisma RCA data
 * Maps Prisma relation names (uppercase) to context properties
 */
function buildIncidentContextFromRCA(rca: any): {
  description: string;
  type: string;
  severity: string | null;
  categoryName: string | undefined;
  facilityName: string | undefined;
  areaName: string | undefined;
  lineName: string | undefined;
  evidence: { fileName: string; type: string; transcription?: string | null }[];
  // New fields for enhanced AI analysis
  incidentNumber?: string;
  incidentDate?: Date;
  shiftTime?: string | null;
  aiSummary?: string | null;
  aiAnalysisData?: any;
  immediateActionsTaken?: string | null;
  workplaceSafety?: {
    injuryCausedByWork?: string | null;
    directCause?: string | null;
    contributingFactors?: string[] | null;
    unsafeActOrCondition?: string | null;
    injuryType?: string | null;
    bodyPartsAffected?: string[] | null;
    environmentalConditions?: string[] | null;
    equipmentInvolved?: string | null;
    taskPerformed?: string | null;
  } | null;
  qualitySafety?: {
    productAffected?: string | null;
    batchLot?: string | null;
    quantityAffected?: string | null;
    deviationType?: string | null;
    contaminationType?: string | null;
  } | null;
  isRecurring?: boolean;
  similarIncidentsCount?: number;
} {
  const incident = rca.Incident;
  
  // Parse aiAnalysisData if it's a string
  let aiAnalysisData = null;
  if (incident?.aiAnalysisData) {
    try {
      aiAnalysisData = typeof incident.aiAnalysisData === 'string' 
        ? JSON.parse(incident.aiAnalysisData) 
        : incident.aiAnalysisData;
    } catch (e) {
      console.warn('Failed to parse aiAnalysisData:', e);
    }
  }
  
  return {
    // Core details
    description: incident?.description || '',
    type: incident?.type || '',
    severity: incident?.severity || null,
    incidentNumber: incident?.incidentNumber,
    incidentDate: incident?.incidentDate,
    shiftTime: incident?.shiftTime,
    
    // Location
    categoryName: incident?.Category?.name,
    facilityName: incident?.Facility?.name,
    areaName: incident?.Area?.name,
    lineName: incident?.Line?.name,
    
    // AI insights from incident detail
    aiSummary: incident?.aiSummary,
    aiAnalysisData: aiAnalysisData,
    
    // Immediate actions
    immediateActionsTaken: incident?.immediateActionsTaken,
    
    // Evidence with transcription
    evidence: incident?.Evidence?.map((e: any) => ({
      fileName: e.fileName,
      type: e.type,
      transcription: e.transcription,
    })) || [],
    
    // Workplace safety context (for WORKPLACE_SAFETY incidents)
    workplaceSafety: incident?.type === 'WORKPLACE_SAFETY' ? {
      injuryCausedByWork: incident?.injuryCausedByWork,
      directCause: incident?.directCause,
      contributingFactors: incident?.contributingFactors,
      unsafeActOrCondition: incident?.unsafeActOrCondition,
      injuryType: incident?.injuryType,
      bodyPartsAffected: incident?.bodyPartsAffected,
      environmentalConditions: incident?.environmentalConditions,
      equipmentInvolved: incident?.equipmentInvolved,
      taskPerformed: incident?.taskPerformed,
    } : null,
    
    // Quality/Food safety context (for FOOD_SAFETY incidents)
    qualitySafety: incident?.type === 'FOOD_SAFETY' ? {
      productAffected: incident?.productAffected,
      batchLot: incident?.batchLot,
      quantityAffected: incident?.quantityAffected,
      deviationType: incident?.deviationType,
      contaminationType: incident?.contaminationType,
    } : null,
    
    // Historical context
    isRecurring: (incident?.RCAAnalysis?.filter((r: any) => r.isValidated)?.length || 0) > 0,
    similarIncidentsCount: incident?.RCAAnalysis?.filter((r: any) => r.isValidated)?.length || 0,
  };
}

// All RCA routes require authentication
router.use(authenticate);

// ============================================================================
// Phase 5.1: RCA Workspace Shell
// ============================================================================

/**
 * GET /api/rca/incidents/:incidentId
 * Get all RCA analyses for an incident
 */
router.get('/incidents/:incidentId', async (req: AuthRequest, res: Response) => {
  try {
    const { incidentId } = req.params;
    const analyses = await rcaService.getIncidentRCAAnalyses(incidentId);

    res.json({
      success: true,
      data: analyses,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/rca/:rcaId
 * Get a single RCA analysis with full details
 */
router.get('/:rcaId', async (req: AuthRequest, res: Response) => {
  try {
    const { rcaId } = req.params;
    const analysis = await rcaService.getRCAAnalysis(rcaId);

    if (!analysis) {
      return res.status(404).json({
        success: false,
        error: 'RCA analysis not found',
      });
    }

    // Parse aiAnalysisData if it exists (stored as JSON in database)
    let parsedAiAnalysisData = null;
    if (analysis.Incident?.aiAnalysisData) {
      try {
        parsedAiAnalysisData = typeof analysis.Incident.aiAnalysisData === 'string'
          ? JSON.parse(analysis.Incident.aiAnalysisData)
          : analysis.Incident.aiAnalysisData;
      } catch (e) {
        console.warn('Failed to parse aiAnalysisData:', e);
      }
    }

    // Transform Prisma response to match frontend expectations
    const transformedAnalysis = {
      id: analysis.id,
      method: analysis.method,
      status: analysis.status,
      aiRecommendedMethod: analysis.aiRecommendedMethod,
      aiRecommendationReason: analysis.aiRecommendationReason,
      rootCauseStatement: analysis.rootCauseStatement,
      fiveWhysData: analysis.fiveWhysData,
      fishboneData: analysis.fishboneData,
      fiveWhysModalState: analysis.fiveWhysModalState,
      isValidated: analysis.isValidated,
      validatedAt: analysis.validatedAt,
      createdAt: analysis.createdAt,
      updatedAt: analysis.updatedAt,
      incident: analysis.Incident ? {
        id: analysis.Incident.id,
        incidentNumber: analysis.Incident.incidentNumber,
        description: analysis.Incident.description,
        type: analysis.Incident.type,
        status: analysis.Incident.status,
        severity: analysis.Incident.severity,
        isTeamIncident: analysis.Incident.isTeamIncident,
        visibility: analysis.Incident.visibility,
        category: analysis.Incident.Category,
        facility: analysis.Incident.Facility,
        department: analysis.Incident.Department,
        area: analysis.Incident.Area,
        line: analysis.Incident.Line,
        shift: analysis.Incident.Shift,
        evidence: analysis.Incident.Evidence,
        createdBy: analysis.Incident.User_Incident_createdByIdToUser,
        // Include AI analysis data from incident
        aiSummary: analysis.Incident.aiSummary,
        aiAnalysisData: parsedAiAnalysisData,
        participants: analysis.Incident.IncidentParticipant?.map((p: any) => ({
          id: p.id,
          userId: p.userId,
          role: p.role,
          canEdit: p.canEdit,
          canChat: p.canChat,
          isActive: p.isActive,
          invitationStatus: p.invitationStatus,
          user: p.User_IncidentParticipant_userIdToUser,
        })) || [],
      } : null,
      analyst: analysis.User,
      comments: analysis.Comment?.map((c: any) => ({
        ...c,
        user: c.User,
      })) || [],
      evidence: analysis.Evidence || [],
      capActions: analysis.CAPAction?.map((a: any) => ({
        ...a,
        user: a.User,
      })) || [],
      versionHistory: analysis.RCAVersion || [],
    };

    res.json({
      success: true,
      data: transformedAnalysis,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/rca/incidents/:incidentId
 * Create a new RCA analysis for an incident
 */
router.post('/incidents/:incidentId', requirePrivilege('rca.create'), async (req: AuthRequest, res: Response) => {
  try {
    const { incidentId } = req.params;
    const { method } = req.body;
    const analystId = req.user!.id;

    if (!method || !['FIVE_WHYS', 'FISHBONE'].includes(method)) {
      return res.status(400).json({
        success: false,
        error: 'Valid method is required (FIVE_WHYS or FISHBONE)',
      });
    }

    const analysis = await rcaService.createRCAAnalysis(incidentId, method, analystId);

    // Emit WebSocket event so team members see RCA started instantly
    websocketService.emitToIncident(incidentId, 'rca:created', {
      incidentId,
      rcaId: analysis.id,
      method: analysis.method,
      status: analysis.status,
      createdBy: {
        id: req.user!.id,
        firstName: req.user!.firstName,
        lastName: req.user!.lastName,
      },
    });

    res.status(201).json({
      success: true,
      data: analysis,
      message: 'RCA analysis created successfully',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/rca/incidents/:incidentId/timeline
 * Get timeline events for an incident
 */
router.get('/incidents/:incidentId/timeline', async (req: AuthRequest, res: Response) => {
  try {
    const { incidentId } = req.params;
    const timeline = await rcaService.getIncidentTimeline(incidentId);

    res.json({
      success: true,
      data: timeline,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/rca/:rcaId/comments
 * Add a comment to an RCA analysis
 */
router.post('/:rcaId/comments', async (req: AuthRequest, res: Response) => {
  try {
    const { rcaId } = req.params;
    const { content, incidentId } = req.body;
    const userId = req.user!.id;

    if (!content) {
      return res.status(400).json({
        success: false,
        error: 'Comment content is required',
      });
    }

    const comment = await rcaService.addComment(userId, content, incidentId, rcaId);

    res.status(201).json({
      success: true,
      data: comment,
      message: 'Comment added successfully',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/rca/incidents/:incidentId/comments
 * Add a comment to an incident
 */
router.post('/incidents/:incidentId/comments', async (req: AuthRequest, res: Response) => {
  try {
    const { incidentId } = req.params;
    const { content } = req.body;
    const userId = req.user!.id;

    if (!content) {
      return res.status(400).json({
        success: false,
        error: 'Comment content is required',
      });
    }

    const comment = await rcaService.addComment(userId, content, incidentId);

    res.status(201).json({
      success: true,
      data: comment,
      message: 'Comment added successfully',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ============================================================================
// Phase 5.2 & 5.3: RCA Method Selection & AI Recommendation
// ============================================================================

/**
 * PATCH /api/rca/:rcaId/method
 * Update the RCA method
 */
router.patch('/:rcaId/method', requirePrivilege('rca.edit'), async (req: AuthRequest, res: Response) => {
  try {
    const { rcaId } = req.params;
    const { method } = req.body;
    const userId = req.user!.id;
    const user = req.user!;

    console.log('[RCA Method Update] rcaId:', rcaId, 'method:', method);

    if (!method || !['FIVE_WHYS', 'FISHBONE'].includes(method)) {
      return res.status(400).json({
        success: false,
        error: 'Valid method is required (FIVE_WHYS or FISHBONE)',
      });
    }

    const analysis = await rcaService.updateRCAMethod(rcaId, method as 'FIVE_WHYS' | 'FISHBONE');

    // Get incidentId for WebSocket broadcast
    const rcaWithIncident = await prisma.rCAAnalysis.findUnique({
      where: { id: rcaId },
      select: { incidentId: true }
    });

    if (rcaWithIncident?.incidentId) {
      websocketService.emitToIncident(rcaWithIncident.incidentId, 'rca:method-changed', {
        rcaId,
        method,
        updatedBy: {
          id: userId,
          firstName: user.firstName,
          lastName: user.lastName,
        },
        timestamp: new Date().toISOString(),
      });
    }

    res.json({
      success: true,
      data: analysis,
      message: 'RCA method updated successfully',
    });
  } catch (error: any) {
    console.error('[RCA Method Update Error]:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/rca/incidents/:incidentId/analyze-methodology
 * Perform on-demand AI analysis to recommend the best RCA methodology
 * This does a thorough analysis of the incident including all evidence
 */
router.post('/incidents/:incidentId/analyze-methodology', requirePrivilege('rca.create'), async (req: AuthRequest, res: Response) => {
  try {
    const { incidentId } = req.params;
    const userId = req.user!.id;

    // Get incident with all related data for comprehensive analysis
    const incident = await prisma.incident.findUnique({
      where: { id: incidentId },
      include: {
        Category: true,
        Facility: true,
        Area: true,
        Line: true,
        Evidence: true,
        IncidentParticipant: {
          where: { isActive: true },
          include: {
            User_IncidentParticipant_userIdToUser: {
              select: { id: true, firstName: true, lastName: true }
            }
          }
        },
        RCAAnalysis: {
          where: { isValidated: true },
          select: { id: true, method: true, rootCauseStatement: true }
        }
      }
    });

    if (!incident) {
      return res.status(404).json({
        success: false,
        error: 'Incident not found',
      });
    }

    // Parse aiAnalysisData if it exists
    let parsedAiAnalysisData = null;
    if (incident.aiAnalysisData) {
      try {
        parsedAiAnalysisData = typeof incident.aiAnalysisData === 'string'
          ? JSON.parse(incident.aiAnalysisData)
          : incident.aiAnalysisData;
      } catch (e) {
        console.warn('Failed to parse aiAnalysisData:', e);
      }
    }

    // Build comprehensive incident context for AI analysis
    const incidentContext = {
      id: incident.id,
      incidentNumber: incident.incidentNumber,
      type: incident.type,
      description: incident.description,
      severity: incident.severity,
      categoryName: incident.Category?.name,
      facilityName: incident.Facility?.name,
      areaName: incident.Area?.name,
      lineName: incident.Line?.name,
      aiSummary: incident.aiSummary,
      aiAnalysisData: parsedAiAnalysisData,
      isRecurring: false, // Will check below
      
      // Evidence analysis
      evidence: incident.Evidence?.map(e => ({
        id: e.id,
        fileName: e.fileName,
        type: e.type,
        aiAnalysis: (e as any).aiAnalysis,
        extractedText: (e as any).extractedText,
      })) || [],

      // Workplace safety context
      workplaceSafety: incident.type === 'WORKPLACE_SAFETY' ? {
        injuryType: incident.injuryType,
        bodyPartsAffected: incident.bodyPartsAffected,
        directCause: incident.directCause,
        contributingFactors: incident.contributingFactors,
        unsafeActOrCondition: incident.unsafeActOrCondition,
        environmentalConditions: incident.environmentalConditions,
        equipmentInvolved: (incident as any).equipmentInvolved,
        taskPerformed: (incident as any).taskPerformed,
      } : null,

      // Quality/food safety context
      qualitySafety: incident.type === 'FOOD_SAFETY' || (incident.type as string) === 'QUALITY' ? {
        productAffected: incident.productName,
        batchLot: incident.lotNumber,
        deviationType: incident.type,
      } : null,
    };

    // Check for similar past incidents
    const similarIncidents = await prisma.incident.count({
      where: {
        type: incident.type as any,
        id: { not: incident.id },
        Category: { id: incident.categoryId },
        createdAt: { gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) } // Last year
      }
    });
    incidentContext.isRecurring = similarIncidents > 2;

    // Emit WebSocket event that analysis is starting
    websocketService.emitToIncident(incidentId, 'rca:methodology-analysis-started', {
      incidentId,
      analyzedBy: {
        id: userId,
        firstName: req.user!.firstName,
        lastName: req.user!.lastName,
      },
      startedAt: new Date().toISOString(),
    });

    // Get AI recommendation
    const recommendation = await getAIMethodRecommendation(incidentContext as any);

    // Emit WebSocket event with analysis result
    websocketService.emitToIncident(incidentId, 'rca:methodology-analysis-complete', {
      incidentId,
      recommendation: {
        ...recommendation,
        analyzedAt: new Date().toISOString(),
        analyzedBy: {
          id: userId,
          firstName: req.user!.firstName,
          lastName: req.user!.lastName,
        },
      },
    });

    res.json({
      success: true,
      data: {
        recommendation,
        incidentContext: {
          type: incident.type,
          severity: incident.severity,
          hasEvidence: (incident.Evidence?.length || 0) > 0,
          evidenceCount: incident.Evidence?.length || 0,
          hasAiSummary: !!incident.aiSummary,
          isRecurring: incidentContext.isRecurring,
          similarIncidentsCount: similarIncidents,
        },
        analyzedAt: new Date().toISOString(),
      },
      message: 'AI methodology analysis complete',
    });
  } catch (error: any) {
    console.error('Error in analyze-methodology:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/rca/:rcaId/recommendation
 * Get AI method recommendation for an RCA
 * Uses the AI insights from incident analysis when available
 */
router.get('/:rcaId/recommendation', async (req: AuthRequest, res: Response) => {
  try {
    const { rcaId } = req.params;
    const analysis = await rcaService.getRCAAnalysis(rcaId);

    if (!analysis) {
      return res.status(404).json({
        success: false,
        error: 'RCA analysis not found',
      });
    }

    // Parse aiAnalysisData if it exists
    let parsedAiAnalysisData = null;
    if (analysis.Incident?.aiAnalysisData) {
      try {
        parsedAiAnalysisData = typeof analysis.Incident.aiAnalysisData === 'string'
          ? JSON.parse(analysis.Incident.aiAnalysisData)
          : analysis.Incident.aiAnalysisData;
      } catch (e) {
        console.warn('Failed to parse aiAnalysisData for recommendation:', e);
      }
    }

    // Log for debugging
    console.log(`[RCA /recommendation] Incident ${analysis.Incident?.incidentNumber}:`);
    console.log(`  - aiAnalysisData exists: ${!!parsedAiAnalysisData}`);
    console.log(`  - recommendedRCAMethodology: ${parsedAiAnalysisData?.recommendedRCAMethodology?.primary || 'not set'}`);

    // Create incident object with parsed aiAnalysisData
    const incidentWithParsedData = {
      ...analysis.Incident,
      aiAnalysisData: parsedAiAnalysisData
    };

    const recommendation = await rcaService.getMethodRecommendation(incidentWithParsedData);

    res.json({
      success: true,
      data: {
        ...recommendation,
        currentMethod: analysis.method,
        aiRecommendedMethod: analysis.aiRecommendedMethod,
        aiRecommendationReason: analysis.aiRecommendationReason,
        // Include the original AI insights from incident analysis
        incidentAiInsights: parsedAiAnalysisData ? {
          keyFindings: parsedAiAnalysisData.keyFindings || [],
          investigationGuidance: parsedAiAnalysisData.investigationGuidance || [],
          contributingFactors: parsedAiAnalysisData.contributingFactors || [],
          recommendedRCAMethodology: parsedAiAnalysisData.recommendedRCAMethodology || null,
        } : null,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ============================================================================
// Phase 6: 5 Whys Engine
// ============================================================================

/**
 * PATCH /api/rca/:rcaId/five-whys
 * Update 5 Whys data
 */
router.patch('/:rcaId/five-whys', async (req: AuthRequest, res: Response) => {
  try {
    const { rcaId } = req.params;
    const { fiveWhysData, changeReason } = req.body;
    const userId = req.user!.id;
    const user = req.user!;

    if (!fiveWhysData) {
      return res.status(400).json({
        success: false,
        error: '5 Whys data is required',
      });
    }

    const analysis = await rcaService.updateFiveWhys(rcaId, userId, fiveWhysData, changeReason);

    // Get RCA with incident to emit WebSocket event
    const rcaWithIncident = await prisma.rCAAnalysis.findUnique({
      where: { id: rcaId },
      select: { incidentId: true }
    });

    if (rcaWithIncident?.incidentId) {
      websocketService.emitToIncident(rcaWithIncident.incidentId, 'rca:data-updated', {
        rcaId,
        type: 'five-whys',
        updatedBy: {
          id: userId,
          firstName: user.firstName,
          lastName: user.lastName,
        },
        timestamp: new Date().toISOString(),
        data: analysis,
      });
    }

    res.json({
      success: true,
      data: analysis,
      message: '5 Whys data updated successfully',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/rca/:rcaId/five-whys/suggestions
 * Get AI suggestions for current 5 Whys step
 */
router.post('/:rcaId/five-whys/suggestions', async (req: AuthRequest, res: Response) => {
  try {
    const { rcaId } = req.params;
    const { currentStep, currentAnswer } = req.body;

    if (!currentStep || !currentAnswer) {
      return res.status(400).json({
        success: false,
        error: 'Current step and answer are required',
      });
    }

    const suggestions = await rcaService.getFiveWhysAISuggestions(rcaId, currentStep, currentAnswer);

    res.json({
      success: true,
      data: suggestions,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ============================================================================
// Phase 7: Fishbone Engine
// ============================================================================

/**
 * PATCH /api/rca/:rcaId/fishbone
 * Update Fishbone data
 */
router.patch('/:rcaId/fishbone', async (req: AuthRequest, res: Response) => {
  try {
    const { rcaId } = req.params;
    const { fishboneData, changeReason } = req.body;
    const userId = req.user!.id;
    const user = req.user!;

    if (!fishboneData) {
      return res.status(400).json({
        success: false,
        error: 'Fishbone data is required',
      });
    }

    const analysis = await rcaService.updateFishbone(rcaId, userId, fishboneData, changeReason);

    // Get RCA with incident to emit WebSocket event
    const rcaWithIncident = await prisma.rCAAnalysis.findUnique({
      where: { id: rcaId },
      select: { incidentId: true }
    });

    if (rcaWithIncident?.incidentId) {
      websocketService.emitToIncident(rcaWithIncident.incidentId, 'rca:data-updated', {
        rcaId,
        type: 'fishbone',
        updatedBy: {
          id: userId,
          firstName: user.firstName,
          lastName: user.lastName,
        },
        timestamp: new Date().toISOString(),
        data: analysis,
      });
    }

    res.json({
      success: true,
      data: analysis,
      message: 'Fishbone data updated successfully',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/rca/:rcaId/fishbone/suggestions
 * Get AI suggestions for a Fishbone category
 */
router.post('/:rcaId/fishbone/suggestions', async (req: AuthRequest, res: Response) => {
  try {
    const { rcaId } = req.params;
    const { categoryName } = req.body;

    if (!categoryName) {
      return res.status(400).json({
        success: false,
        error: 'Category name is required',
      });
    }

    const suggestions = await rcaService.getFishboneAISuggestions(rcaId, categoryName);

    res.json({
      success: true,
      data: suggestions,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/rca/:rcaId/fishbone/to-text
 * Convert Fishbone diagram to text
 */
router.post('/:rcaId/fishbone/to-text', async (req: AuthRequest, res: Response) => {
  try {
    const { rcaId } = req.params;
    const text = await rcaService.convertFishboneToText(rcaId);

    res.json({
      success: true,
      data: { text },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ============================================================================
// AI-Powered RCA Analysis Generation
// ============================================================================

/**
 * POST /api/rca/:rcaId/ai/generate-five-whys
 * Generate complete 5 Whys analysis using AI
 */
router.post('/:rcaId/ai/generate-five-whys', requirePrivilege('rca.ai.five_whys'), async (req: AuthRequest, res: Response) => {
  try {
    const { rcaId } = req.params;
    const userId = req.user!.id;
    const user = req.user!;
    
    // Get RCA with incident details
    const rca = await rcaService.getRCAAnalysis(rcaId);
    
    if (!rca) {
      return res.status(404).json({
        success: false,
        error: 'RCA analysis not found',
      });
    }

    // Broadcast that AI generation started
    if (rca.incidentId) {
      websocketService.emitToIncident(rca.incidentId, 'rca:ai-generation-started', {
        rcaId,
        type: 'five-whys',
        startedBy: {
          id: userId,
          firstName: user.firstName,
          lastName: user.lastName,
        },
        timestamp: new Date().toISOString(),
      });
    }

    // Build incident context for AI
    const incidentContext = buildIncidentContextFromRCA(rca);

    // Generate AI analysis
    const aiAnalysis = await generateAIFiveWhysAnalysis(incidentContext);

    if (aiAnalysis.error) {
      return res.status(503).json({
        success: false,
        error: 'AI analysis service unavailable. Please try again later.',
        data: aiAnalysis,
      });
    }

    // Optionally auto-save if requested
    const { autoSave } = req.body;
    if (autoSave && aiAnalysis.steps.length > 0) {
      await rcaService.updateFiveWhys(rcaId, userId, {
        steps: aiAnalysis.steps,
        rootCause: aiAnalysis.rootCause,
        aiAnalysis: {
          depth: aiAnalysis.steps.length >= 5 ? 'deep' : aiAnalysis.steps.length >= 3 ? 'adequate' : 'shallow',
          suggestions: aiAnalysis.recommendations,
          strengthScore: aiAnalysis.confidence,
        },
      }, 'AI-generated 5 Whys analysis');

      // Broadcast AI generation complete with data update
      if (rca.incidentId) {
        websocketService.emitToIncident(rca.incidentId, 'rca:ai-generation-complete', {
          rcaId,
          type: 'five-whys',
          generatedBy: {
            id: userId,
            firstName: user.firstName,
            lastName: user.lastName,
          },
          autoSaved: true,
          timestamp: new Date().toISOString(),
        });
      }
    }

    res.json({
      success: true,
      data: aiAnalysis,
      message: 'AI analysis generated successfully. Review and edit as needed.',
    });
  } catch (error: any) {
    console.error('AI 5 Whys generation error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/rca/:rcaId/ai/generate-fishbone
 * Generate complete Fishbone analysis using AI
 */
router.post('/:rcaId/ai/generate-fishbone', requirePrivilege('rca.ai.fishbone'), async (req: AuthRequest, res: Response) => {
  try {
    const { rcaId } = req.params;
    const userId = req.user!.id;
    const user = req.user!;
    
    // Get RCA with incident details
    const rca = await rcaService.getRCAAnalysis(rcaId);
    
    if (!rca) {
      return res.status(404).json({
        success: false,
        error: 'RCA analysis not found',
      });
    }

    // Broadcast that AI generation started
    if (rca.incidentId) {
      websocketService.emitToIncident(rca.incidentId, 'rca:ai-generation-started', {
        rcaId,
        type: 'fishbone',
        startedBy: {
          id: userId,
          firstName: user.firstName,
          lastName: user.lastName,
        },
        timestamp: new Date().toISOString(),
      });
    }

    // Build incident context for AI
    const incidentContext = buildIncidentContextFromRCA(rca);

    // Generate AI analysis
    const aiAnalysis = await generateAIFishboneAnalysis(incidentContext);

    if (aiAnalysis.error) {
      return res.status(503).json({
        success: false,
        error: 'AI analysis service unavailable. Please try again later.',
        data: aiAnalysis,
      });
    }

    // Optionally auto-save if requested
    const { autoSave } = req.body;
    if (autoSave && aiAnalysis.categories.length > 0) {
      await rcaService.updateFishbone(rcaId, userId, {
        problem: aiAnalysis.problem,
        categories: aiAnalysis.categories,
        rootCauseText: aiAnalysis.rootCauseText,
        aiAnalysis: {
          categoryCoverage: aiAnalysis.categories.reduce((acc: any, cat: any) => {
            acc[cat.name] = cat.causes.length;
            return acc;
          }, {}),
          suggestions: aiAnalysis.recommendations,
        },
      }, 'AI-generated Fishbone analysis');

      // Broadcast AI generation complete with data update
      if (rca.incidentId) {
        websocketService.emitToIncident(rca.incidentId, 'rca:ai-generation-complete', {
          rcaId,
          type: 'fishbone',
          generatedBy: {
            id: userId,
            firstName: user.firstName,
            lastName: user.lastName,
          },
          autoSaved: true,
          timestamp: new Date().toISOString(),
        });
      }
    }

    res.json({
      success: true,
      data: aiAnalysis,
      message: 'AI analysis generated successfully. Review and edit as needed.',
    });
  } catch (error: any) {
    console.error('AI Fishbone generation error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/rca/:rcaId/ai/fishbone-validate-problem
 * Validate the problem statement before generating Fishbone analysis
 */
router.post('/:rcaId/ai/fishbone-validate-problem', async (req: AuthRequest, res: Response) => {
  try {
    const { rcaId } = req.params;
    const { problem } = req.body;
    const userId = req.user!.id;
    const user = req.user!;
    
    if (!problem || !problem.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Problem statement is required',
      });
    }

    // Get RCA with incident details for context
    const rca = await rcaService.getRCAAnalysis(rcaId);
    
    if (!rca) {
      return res.status(404).json({
        success: false,
        error: 'RCA analysis not found',
      });
    }

    // Broadcast that AI validation started
    if (rca.incidentId) {
      websocketService.emitToIncident(rca.incidentId, 'rca:ai-validation-started', {
        rcaId,
        type: 'problem-validation',
        problem,
        startedBy: {
          id: userId,
          firstName: user.firstName,
          lastName: user.lastName,
        },
        timestamp: new Date().toISOString(),
      });
    }

    // Build incident context
    const incidentContext = {
      description: rca.Incident?.description || '',
      type: rca.Incident?.type || '',
      severity: rca.Incident?.severity || null,
      categoryName: rca.Incident?.Category?.name,
      facilityName: rca.Incident?.Facility?.name,
      areaName: rca.Incident?.Area?.name,
    };

    // Validate problem statement
    const validation = await validateFishboneProblemStatement(problem, incidentContext);

    // Broadcast validation result
    if (rca.incidentId) {
      websocketService.emitToIncident(rca.incidentId, 'rca:ai-validation-complete', {
        rcaId,
        type: 'problem-validation',
        validation,
        validatedBy: {
          id: userId,
          firstName: user.firstName,
          lastName: user.lastName,
        },
        timestamp: new Date().toISOString(),
      });
    }

    res.json({
      success: true,
      data: validation,
    });
  } catch (error: any) {
    console.error('Problem validation error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/rca/:rcaId/ai/fishbone-enhanced
 * Generate enhanced Fishbone analysis with action plans
 */
router.post('/:rcaId/ai/fishbone-enhanced', async (req: AuthRequest, res: Response) => {
  try {
    const { rcaId } = req.params;
    const userId = req.user!.id;
    const user = req.user!;
    
    // Get RCA with incident details
    const rca = await rcaService.getRCAAnalysis(rcaId);
    
    if (!rca) {
      return res.status(404).json({
        success: false,
        error: 'RCA analysis not found',
      });
    }

    // Broadcast that AI generation started
    if (rca.incidentId) {
      websocketService.emitToIncident(rca.incidentId, 'rca:ai-suggestions-started', {
        rcaId,
        type: 'fishbone-enhanced',
        startedBy: {
          id: userId,
          firstName: user.firstName,
          lastName: user.lastName,
        },
        timestamp: new Date().toISOString(),
      });
    }

    // Build incident context for AI
    const incidentContext = buildIncidentContextFromRCA(rca);

    // Generate enhanced AI analysis with action plans
    const aiAnalysis = await generateEnhancedFishboneAnalysis(incidentContext);

    // Broadcast AI suggestions to all users so they can see and provide input
    if (rca.incidentId) {
      websocketService.emitToIncident(rca.incidentId, 'rca:ai-suggestions-received', {
        rcaId,
        type: 'fishbone-enhanced',
        analysis: aiAnalysis,
        generatedBy: {
          id: userId,
          firstName: user.firstName,
          lastName: user.lastName,
        },
        timestamp: new Date().toISOString(),
      });
    }

    // Return the analysis even if there was an AI error
    // The frontend will handle displaying the error message
    res.json({
      success: !aiAnalysis.error,
      data: aiAnalysis,
      message: aiAnalysis.error 
        ? 'AI analysis service unavailable. Please try again later.' 
        : 'Enhanced Fishbone analysis generated successfully.',
    });
  } catch (error: any) {
    console.error('Enhanced Fishbone generation error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/rca/:rcaId/ai/fishbone-cause-five-whys
 * Apply 5 Whys analysis to a specific Fishbone cause
 */
router.post('/:rcaId/ai/fishbone-cause-five-whys', async (req: AuthRequest, res: Response) => {
  try {
    const { rcaId } = req.params;
    const { causeId, causeText, categoryName, problem } = req.body;
    
    if (!causeId || !causeText || !categoryName || !problem) {
      return res.status(400).json({
        success: false,
        error: 'Cause ID, text, category name, and problem statement are required',
      });
    }

    // Get RCA with incident details
    const rca = await rcaService.getRCAAnalysis(rcaId);
    
    if (!rca) {
      return res.status(404).json({
        success: false,
        error: 'RCA analysis not found',
      });
    }

    // Build incident context
    const incidentContext = {
      description: rca.Incident?.description || '',
      type: rca.Incident?.type || '',
      severity: rca.Incident?.severity || null,
      categoryName: rca.Incident?.Category?.name,
      facilityName: rca.Incident?.Facility?.name,
    };

    // Analyze cause with 5 Whys
    const result = await analyzeFishboneCauseWithFiveWhys(
      problem,
      { id: causeId, text: causeText, categoryName },
      incidentContext
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('Fishbone cause 5 Whys error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/rca/:rcaId/ai/save-five-whys-analysis
 * Save AI-generated 5 Whys analysis to the database (same table as manual analysis)
 */
router.post('/:rcaId/ai/save-five-whys-analysis', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { rcaId } = req.params;
    const userId = req.user?.id;
    const { causeId, causeText, categoryName, steps, rootCause, isValidRootCause, resolvesOriginalProblem } = req.body;
    
    if (!causeId || !causeText || !steps || !Array.isArray(steps)) {
      return res.status(400).json({
        success: false,
        error: 'causeId, causeText, and steps are required',
      });
    }

    // Check if analysis already exists
    const existing = await prisma.fiveWhysAnalysis.findFirst({
      where: { 
        rcaAnalysisId: rcaId,
        causeId: causeId 
      },
      include: {
        steps: {
          orderBy: { stepNumber: 'asc' }
        }
      }
    });
    
    let analysis;
    
    if (existing) {
      // Update existing analysis with AI results
      // First update the steps
      for (const step of steps) {
        await prisma.fiveWhysStep.updateMany({
          where: {
            analysisId: existing.id,
            stepNumber: step.stepNumber
          },
          data: {
            question: step.question,
            answer: step.answer || ''
          }
        });
      }
      
      // Update the analysis metadata
      analysis = await prisma.fiveWhysAnalysis.update({
        where: { id: existing.id },
        data: {
          rootCause: rootCause || '',
          analysisMethod: 'ai',
          isComplete: true,
          isValidated: true,
          recommendation: isValidRootCause ? 'keep' : null
        },
        include: {
          steps: {
            orderBy: { stepNumber: 'asc' }
          }
        }
      });
    } else {
      // Create new analysis with AI-generated data
      analysis = await prisma.fiveWhysAnalysis.create({
        data: {
          rcaAnalysisId: rcaId,
          causeId,
          causeText,
          categoryId: '',
          categoryName: categoryName || '',
          analysisMethod: 'ai',
          rootCause: rootCause || '',
          isComplete: true,
          isValidated: true,
          recommendation: isValidRootCause ? 'keep' : null,
          createdById: userId,
          steps: {
            create: steps.map((step: any) => ({
              stepNumber: step.stepNumber,
              question: step.question,
              answer: step.answer || ''
            }))
          }
        },
        include: {
          steps: {
            orderBy: { stepNumber: 'asc' }
          }
        }
      });
    }
    
    // Get RCA for incident ID to broadcast
    const rca = await prisma.rCAAnalysis.findUnique({
      where: { id: rcaId },
      select: { incidentId: true }
    });
    
    const hasAnswers = analysis.steps.some((s: any) => s.answer && s.answer.trim() !== '');
    const answerCount = analysis.steps.filter((s: any) => s.answer && s.answer.trim() !== '').length;
    
    if (rca?.incidentId) {
      websocketService.emitToIncident(rca.incidentId, 'rca:five-whys-analysis-created', {
        rcaId,
        causeId,
        analysis: {
          ...analysis,
          hasAnswers,
          answerCount
        }
      });
    }
    
    res.json({
      success: true,
      analysis: {
        ...analysis,
        hasAnswers,
        answerCount
      }
    });
  } catch (error: any) {
    console.error('Save AI 5 Whys analysis error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * PATCH /api/rca/:rcaId/five-whys-autosave
 * Auto-save manual 5 Whys progress as user types (creates or updates)
 */
router.patch('/:rcaId/five-whys-autosave', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { rcaId } = req.params;
    const userId = req.user?.id;
    const { causeId, causeText, categoryName, steps, rootCause, fieldType, stepNumber, analysisMethod } = req.body;
    
    if (!causeId || !causeText) {
      return res.status(400).json({
        success: false,
        error: 'causeId and causeText are required',
      });
    }

    // Check if analysis already exists
    let analysis = await prisma.fiveWhysAnalysis.findFirst({
      where: { 
        rcaAnalysisId: rcaId,
        causeId: causeId 
      },
      include: {
        steps: {
          orderBy: { stepNumber: 'asc' }
        }
      }
    });
    
    if (analysis) {
      // Update existing analysis
      if (fieldType === 'why' && stepNumber && steps) {
        // Update specific step
        const stepData = steps.find((s: any) => s.stepNumber === stepNumber);
        if (stepData) {
          await prisma.fiveWhysStep.updateMany({
            where: {
              analysisId: analysis.id,
              stepNumber: stepNumber
            },
            data: {
              question: stepData.question,
              answer: stepData.answer || '',
              answeredAt: stepData.answer ? new Date() : null,
              answeredById: stepData.answer ? userId : null
            }
          });
        }
      } else if (fieldType === 'rootCause') {
        // Update root cause
        await prisma.fiveWhysAnalysis.update({
          where: { id: analysis.id },
          data: {
            rootCause: rootCause || ''
          }
        });
      } else if (steps) {
        // Update all steps
        for (const step of steps) {
          await prisma.fiveWhysStep.updateMany({
            where: {
              analysisId: analysis.id,
              stepNumber: step.stepNumber
            },
            data: {
              question: step.question,
              answer: step.answer || '',
              answeredAt: step.answer ? new Date() : null,
              answeredById: step.answer ? userId : null
            }
          });
        }
        
        // Update rootCause and/or analysisMethod if provided
        const updateData: { rootCause?: string; analysisMethod?: string } = {};
        if (rootCause !== undefined) {
          updateData.rootCause = rootCause || '';
        }
        if (analysisMethod) {
          updateData.analysisMethod = analysisMethod;
        }
        if (Object.keys(updateData).length > 0) {
          await prisma.fiveWhysAnalysis.update({
            where: { id: analysis.id },
            data: updateData
          });
        }
      }
      
      // Also update analysisMethod if provided separately (for method-only updates)
      if (analysisMethod && !fieldType && !steps) {
        await prisma.fiveWhysAnalysis.update({
          where: { id: analysis.id },
          data: { analysisMethod }
        });
      }
      
      // Refetch the analysis
      analysis = await prisma.fiveWhysAnalysis.findFirst({
        where: { id: analysis.id },
        include: {
          steps: {
            orderBy: { stepNumber: 'asc' }
          }
        }
      });
    } else {
      // Create new analysis with initial data
      const defaultSteps = [
        { stepNumber: 1, question: 'Why did this happen?', answer: '' },
        { stepNumber: 2, question: 'Why?', answer: '' },
        { stepNumber: 3, question: 'Why?', answer: '' },
        { stepNumber: 4, question: 'Why?', answer: '' },
        { stepNumber: 5, question: 'Why?', answer: '' },
      ];
      
      // Merge with provided steps
      const stepsToCreate = steps || defaultSteps;
      
      analysis = await prisma.fiveWhysAnalysis.create({
        data: {
          rcaAnalysisId: rcaId,
          causeId,
          causeText,
          categoryId: '',
          categoryName: categoryName || '',
          analysisMethod: analysisMethod || null,
          rootCause: rootCause || '',
          isComplete: false,
          isValidated: false,
          createdById: userId,
          steps: {
            create: stepsToCreate.map((step: any) => ({
              stepNumber: step.stepNumber,
              question: step.question,
              answer: step.answer || '',
              answeredAt: step.answer ? new Date() : null,
              answeredById: step.answer ? userId : null
            }))
          }
        },
        include: {
          steps: {
            orderBy: { stepNumber: 'asc' }
          }
        }
      });
    }
    
    // Check if analysis has any answers (to determine button color)
    const hasAnswers = analysis?.steps?.some((step: any) => step.answer && step.answer.trim()) || false;
    const answerCount = analysis?.steps?.filter((step: any) => step.answer && step.answer.trim()).length || 0;
    
    res.json({
      success: true,
      analysis: {
        ...analysis,
        hasAnswers,
        answerCount
      }
    });
  } catch (error: any) {
    console.error('Auto-save 5 Whys error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/rca/:rcaId/five-whys-analysis/:causeId
 * Get saved 5 Whys analysis for a specific cause
 */
router.get('/:rcaId/five-whys-analysis/:causeId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { rcaId, causeId } = req.params;
    
    const analysis = await prisma.fiveWhysAnalysis.findFirst({
      where: { 
        rcaAnalysisId: rcaId,
        causeId: causeId 
      },
      include: {
        steps: {
          orderBy: { stepNumber: 'asc' }
        },
        createdBy: {
          select: { id: true, firstName: true, lastName: true }
        }
      }
    });
    
    if (!analysis) {
      return res.json({
        success: true,
        analysis: null
      });
    }
    
    const hasAnswers = analysis.steps?.some((step: any) => step.answer && step.answer.trim()) || false;
    const answerCount = analysis.steps?.filter((step: any) => step.answer && step.answer.trim()).length || 0;
    
    res.json({
      success: true,
      analysis: {
        ...analysis,
        hasAnswers,
        answerCount
      }
    });
  } catch (error: any) {
    console.error('Get 5 Whys analysis error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/rca/:rcaId/ai/validate-edited-five-whys
 * Validate user-edited 5 Whys answers and determine if they make logical sense
 */
router.post('/:rcaId/ai/validate-edited-five-whys', async (req: AuthRequest, res: Response) => {
  try {
    const { rcaId } = req.params;
    const { causeText, categoryName, problem, editedSteps, editedRootCause } = req.body;
    
    if (!causeText || !problem || !editedSteps || editedSteps.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Cause text, problem, and edited steps are required',
      });
    }

    // Get RCA for context
    const rca = await rcaService.getRCAAnalysis(rcaId);
    
    if (!rca) {
      return res.status(404).json({
        success: false,
        error: 'RCA analysis not found',
      });
    }

    // Validate the edited 5 Whys with AI
    const { validateEditedFiveWhys } = await import('../services/aiService');
    const validation = await validateEditedFiveWhys({
      causeText,
      categoryName,
      problem,
      editedSteps,
      editedRootCause,
      incidentDescription: rca.Incident?.description || '',
      incidentType: rca.Incident?.type || '',
    });

    res.json({
      success: true,
      data: validation,
    });
  } catch (error: any) {
    console.error('Validate edited 5 Whys error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/rca/:rcaId/ai/validate-five-whys
 * Validate manual 5 Whys analysis for accuracy, spelling, and logic
 */
router.post('/:rcaId/ai/validate-five-whys', async (req: AuthRequest, res: Response) => {
  try {
    const { rcaId } = req.params;
    const { causeText, categoryName, problem, fiveWhysSteps, rootCause } = req.body;
    
    if (!causeText || !problem || !fiveWhysSteps || fiveWhysSteps.length === 0 || !rootCause) {
      return res.status(400).json({
        success: false,
        error: 'Cause text, problem, five whys steps, and root cause are required',
      });
    }

    // Get RCA for context
    const rca = await rcaService.getRCAAnalysis(rcaId);
    
    if (!rca) {
      return res.status(404).json({
        success: false,
        error: 'RCA analysis not found',
      });
    }

    // Validate the manual 5 Whys with AI
    const { validateManualFiveWhys } = await import('../services/aiService');
    const validation = await validateManualFiveWhys({
      causeText,
      categoryName: categoryName || 'Unknown',
      problem,
      fiveWhysSteps,
      rootCause,
      incidentDescription: rca.Incident?.description || '',
      incidentType: rca.Incident?.type || '',
    });

    res.json({
      success: true,
      data: validation,
    });
  } catch (error: any) {
    console.error('Validate manual 5 Whys error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/rca/:rcaId/ai/five-whys-suggestion
 * Get AI suggestion for next 5 Whys step
 */
router.post('/:rcaId/ai/five-whys-suggestion', async (req: AuthRequest, res: Response) => {
  try {
    const { rcaId } = req.params;
    const { currentStep, currentAnswer, previousSteps } = req.body;
    
    if (!currentStep || !currentAnswer) {
      return res.status(400).json({
        success: false,
        error: 'Current step and answer are required',
      });
    }

    // Get RCA with incident details
    const rca = await rcaService.getRCAAnalysis(rcaId);
    
    if (!rca) {
      return res.status(404).json({
        success: false,
        error: 'RCA analysis not found',
      });
    }

    // Build incident context
    const incidentContext = {
      description: rca.Incident?.description || '',
      type: rca.Incident?.type || '',
      severity: rca.Incident?.severity || null,
      categoryName: rca.Incident?.Category?.name,
    };

    // Get AI suggestion
    const suggestion = await generateAIFiveWhysSuggestion(
      incidentContext,
      currentStep,
      currentAnswer,
      previousSteps || []
    );

    res.json({
      success: true,
      data: suggestion,
    });
  } catch (error: any) {
    console.error('AI 5 Whys suggestion error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/rca/:rcaId/ai/generate-first-question
 * Generate a contextual first Why question based on incident data
 */
router.post('/:rcaId/ai/generate-first-question', async (req: AuthRequest, res: Response) => {
  try {
    const { rcaId } = req.params;
    
    // Get RCA with incident details
    const rca = await rcaService.getRCAAnalysis(rcaId);
    
    if (!rca) {
      return res.status(404).json({
        success: false,
        error: 'RCA analysis not found',
      });
    }

    // Build incident context
    const incidentContext = buildIncidentContextFromRCA(rca);

    // Generate contextual first question
    const result = await generateContextualFirstQuestion(incidentContext);

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('AI first question generation error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/rca/:rcaId/ai/validate-first-why
 * Validate the user's first Why answer against incident data
 */
router.post('/:rcaId/ai/validate-first-why', async (req: AuthRequest, res: Response) => {
  try {
    const { rcaId } = req.params;
    const { firstWhyQuestion, firstWhyAnswer } = req.body;
    
    if (!firstWhyAnswer) {
      return res.status(400).json({
        success: false,
        error: 'First Why answer is required',
      });
    }

    // Get RCA with incident details
    const rca = await rcaService.getRCAAnalysis(rcaId);
    
    if (!rca) {
      return res.status(404).json({
        success: false,
        error: 'RCA analysis not found',
      });
    }

    // Build incident context
    const incidentContext = buildIncidentContextFromRCA(rca);

    // Validate the first Why answer
    const validation = await validateFirstWhyAnswer(incidentContext, firstWhyQuestion, firstWhyAnswer);

    res.json({
      success: true,
      data: validation,
    });
  } catch (error: any) {
    console.error('AI first Why validation error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/rca/:rcaId/ai/complete-five-whys
 * Generate remaining 5 Whys steps based on user's first answer
 */
router.post('/:rcaId/ai/complete-five-whys', async (req: AuthRequest, res: Response) => {
  try {
    const { rcaId } = req.params;
    const { firstWhyQuestion, firstWhyAnswer } = req.body;
    const userId = req.user!.id;
    
    if (!firstWhyAnswer) {
      return res.status(400).json({
        success: false,
        error: 'First Why answer is required',
      });
    }

    // Get RCA with incident details
    const rca = await rcaService.getRCAAnalysis(rcaId);
    
    if (!rca) {
      return res.status(404).json({
        success: false,
        error: 'RCA analysis not found',
      });
    }

    // Build incident context
    const incidentContext = buildIncidentContextFromRCA(rca);

    // Generate complete analysis based on first answer
    const aiAnalysis = await generateCompleteFiveWhysFromFirstAnswer(incidentContext, firstWhyQuestion, firstWhyAnswer);

    if (aiAnalysis.error) {
      return res.status(503).json({
        success: false,
        error: 'AI analysis service unavailable. Please try again later.',
        data: aiAnalysis,
      });
    }

    // Optionally auto-save if requested
    const { autoSave } = req.body;
    if (autoSave && aiAnalysis.steps.length > 0) {
      await rcaService.updateFiveWhys(rcaId, userId, {
        steps: aiAnalysis.steps,
        rootCause: aiAnalysis.rootCause,
        aiAnalysis: {
          depth: aiAnalysis.steps.length >= 5 ? 'deep' : aiAnalysis.steps.length >= 3 ? 'adequate' : 'shallow',
          suggestions: aiAnalysis.recommendations,
          strengthScore: aiAnalysis.confidence,
        },
      }, 'AI-generated 5 Whys analysis from user-provided first answer');
    }

    res.json({
      success: true,
      data: aiAnalysis,
      message: 'AI analysis generated successfully based on your first answer.',
    });
  } catch (error: any) {
    console.error('AI complete 5 Whys error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/rca/:rcaId/ai/fishbone-category-suggestions
 * Get AI suggestions for a Fishbone category
 */
router.post('/:rcaId/ai/fishbone-category-suggestions', async (req: AuthRequest, res: Response) => {
  try {
    const { rcaId } = req.params;
    const { categoryName, existingCauses } = req.body;
    
    if (!categoryName) {
      return res.status(400).json({
        success: false,
        error: 'Category name is required',
      });
    }

    // Get RCA with incident details
    const rca = await rcaService.getRCAAnalysis(rcaId);
    
    if (!rca) {
      return res.status(404).json({
        success: false,
        error: 'RCA analysis not found',
      });
    }

    // Build incident context
    const incidentContext = {
      description: rca.Incident?.description || '',
      type: rca.Incident?.type || '',
      severity: rca.Incident?.severity || null,
      categoryName: rca.Incident?.Category?.name,
      facilityName: rca.Incident?.Facility?.name,
      areaName: rca.Incident?.Area?.name,
    };

    // Get AI suggestions
    const suggestions = await generateAIFishboneCategorySuggestions(
      incidentContext,
      categoryName,
      existingCauses || []
    );

    res.json({
      success: true,
      data: suggestions,
    });
  } catch (error: any) {
    console.error('AI Fishbone category suggestion error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ============================================================================
// Phase 8: RCA Validation
// ============================================================================

/**
 * POST /api/rca/:rcaId/validate
 * Validate and finalize an RCA analysis
 * Allowed: CI_MANAGER, ADMIN, SYSTEM_ADMIN, or the assigned RCA analyst
 */
router.post(
  '/:rcaId/validate',
  async (req: AuthRequest, res: Response) => {
    try {
      const { rcaId } = req.params;
      const { rootCauseStatement } = req.body;
      const validatorId = req.user!.id;
      const userRole = req.user!.role;

      // Check if user has management role OR is the assigned analyst
      const rca = await rcaService.getRCAAnalysis(rcaId);
      
      if (!rca) {
        return res.status(404).json({
          success: false,
          error: 'RCA analysis not found',
        });
      }

      const allowedRoles: UserRole[] = [UserRole.CI_MANAGER, UserRole.ADMIN, UserRole.SYSTEM_ADMIN];
      const isManager = allowedRoles.includes(userRole as UserRole);
      const isAssignedAnalyst = rca.analystId === validatorId;

      if (!isManager && !isAssignedAnalyst) {
        return res.status(403).json({
          success: false,
          error: 'You must be a CI Manager, Admin, or the assigned analyst to validate this RCA',
        });
      }

      if (!rootCauseStatement) {
        return res.status(400).json({
          success: false,
          error: 'Root cause statement is required',
        });
      }

      const analysis = await rcaService.validateRCA(rcaId, validatorId, rootCauseStatement);

      // Broadcast validation to all team members
      if (rca.incidentId) {
        websocketService.emitToIncident(rca.incidentId, 'rca:validated', {
          rcaId,
          rootCauseStatement,
          isValidated: true,
          validatedBy: {
            id: validatorId,
            firstName: req.user!.firstName,
            lastName: req.user!.lastName,
          },
          timestamp: new Date().toISOString(),
        });
      }

      res.json({
        success: true,
        data: analysis,
        message: 'RCA validated successfully',
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

/**
 * POST /api/rca/:rcaId/reopen
 * Re-open a validated RCA for editing
 * Allowed: Only the RCA owner (analyst)
 */
router.post(
  '/:rcaId/reopen',
  async (req: AuthRequest, res: Response) => {
    try {
      const { rcaId } = req.params;
      const { reason } = req.body;
      const userId = req.user!.id;
      const user = req.user!;

      // First, fetch the RCA to check ownership and get incidentId
      const rca = await prisma.rCAAnalysis.findUnique({
        where: { id: rcaId },
        select: { analystId: true, incidentId: true },
      });

      if (!rca) {
        return res.status(404).json({
          success: false,
          error: 'RCA not found',
        });
      }

      // Only the owner (analyst) can re-open the RCA
      if (rca.analystId !== userId) {
        return res.status(403).json({
          success: false,
          error: 'Only the RCA owner can re-open this RCA',
        });
      }

      const analysis = await rcaService.reopenRCA(rcaId, userId, reason);

      // Broadcast reopen to all team members
      if (rca.incidentId) {
        websocketService.emitToIncident(rca.incidentId, 'rca:reopened', {
          rcaId,
          reason,
          isValidated: false,
          reopenedBy: {
            id: userId,
            firstName: user.firstName,
            lastName: user.lastName,
          },
          timestamp: new Date().toISOString(),
        });
      }

      res.json({
        success: true,
        data: analysis,
        message: 'RCA re-opened successfully',
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

/**
 * GET /api/rca/:rcaId/versions
 * Get RCA version history
 */
router.get('/:rcaId/versions', async (req: AuthRequest, res: Response) => {
  try {
    const { rcaId } = req.params;
    const versions = await rcaService.getRCAVersionHistory(rcaId);

    res.json({
      success: true,
      data: versions,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/rca/:rcaId/versions/:versionId/restore
 * Restore a previous RCA version
 */
router.post('/:rcaId/versions/:versionId/restore', async (req: AuthRequest, res: Response) => {
  try {
    const { rcaId, versionId } = req.params;
    const userId = req.user!.id;

    const analysis = await rcaService.restoreRCAVersion(rcaId, versionId, userId);

    res.json({
      success: true,
      data: analysis,
      message: 'Version restored successfully',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ============================================================================
// Corrective Actions AI Endpoints
// ============================================================================

/**
 * POST /api/rca/:rcaId/ai/generate-corrective-actions
 * Generate AI-powered corrective actions and preventive controls based on analyzed root causes
 */
router.post('/:rcaId/ai/generate-corrective-actions', async (req: AuthRequest, res: Response) => {
  try {
    const { rcaId } = req.params;
    const { problem, analyzedCauses, existingActions } = req.body;

    if (!problem || !analyzedCauses || analyzedCauses.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Problem statement and analyzed causes are required',
      });
    }

    // Get RCA with incident details for context
    const rca = await rcaService.getRCAAnalysis(rcaId);
    
    if (!rca) {
      return res.status(404).json({
        success: false,
        error: 'RCA analysis not found',
      });
    }

    const incidentContext = {
      description: rca.Incident?.description || '',
      type: rca.Incident?.type || '',
      severity: rca.Incident?.severity || 'MEDIUM',
      categoryName: rca.Incident?.Category?.name,
      facilityName: rca.Incident?.Facility?.name,
    };

    // Generate corrective actions and preventive controls using AI
    const { generateCorrectiveActions } = await import('../services/aiService');
    const result = await generateCorrectiveActions(
      problem,
      analyzedCauses,
      incidentContext,
      existingActions
    );

    res.json({
      success: true,
      data: { 
        actionPlans: result.actionPlans,
        preventiveControls: result.preventiveControls,
      },
    });
  } catch (error: any) {
    console.error('Generate corrective actions error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/rca/:rcaId/ai/validate-corrective-actions
 * Validate corrective actions against analyzed root causes
 */
router.post('/:rcaId/ai/validate-corrective-actions', async (req: AuthRequest, res: Response) => {
  try {
    const { rcaId } = req.params;
    const { problem, analyzedCauses, actionPlans } = req.body;

    if (!problem || !analyzedCauses || !actionPlans) {
      return res.status(400).json({
        success: false,
        error: 'Problem, analyzed causes, and action plans are required',
      });
    }

    // Get RCA with incident details for context
    const rca = await rcaService.getRCAAnalysis(rcaId);
    
    if (!rca) {
      return res.status(404).json({
        success: false,
        error: 'RCA analysis not found',
      });
    }

    const incidentContext = {
      description: rca.Incident?.description || '',
      type: rca.Incident?.type || '',
      severity: rca.Incident?.severity || 'MEDIUM',
      categoryName: rca.Incident?.Category?.name,
      facilityName: rca.Incident?.Facility?.name,
    };

    // Validate corrective actions using AI
    const { validateCorrectiveActions } = await import('../services/aiService');
    const validation = await validateCorrectiveActions(
      problem,
      analyzedCauses,
      actionPlans,
      incidentContext
    );

    res.json({
      success: true,
      data: validation,
    });
  } catch (error: any) {
    console.error('Validate corrective actions error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/rca/:rcaId/ai/generate-preventive-controls
 * Generate AI-powered preventive controls based on 5 Whys analysis
 */
router.post('/:rcaId/ai/generate-preventive-controls', async (req: AuthRequest, res: Response) => {
  try {
    const { rcaId } = req.params;
    const { rootCause, fiveWhysSteps, existingControls } = req.body;

    if (!rootCause || !fiveWhysSteps || fiveWhysSteps.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Root cause and 5 Whys analysis steps are required',
      });
    }

    // Get RCA with incident details for context
    const rca = await rcaService.getRCAAnalysis(rcaId);
    
    if (!rca) {
      return res.status(404).json({
        success: false,
        error: 'RCA analysis not found',
      });
    }

    const incidentContext = {
      description: rca.Incident?.description || '',
      type: rca.Incident?.type || '',
      severity: rca.Incident?.severity || 'MEDIUM',
      categoryName: rca.Incident?.Category?.name,
      facilityName: rca.Incident?.Facility?.name,
    };

    // Generate preventive controls using AI
    const { generatePreventiveControlsForFiveWhys } = await import('../services/aiService');
    const result = await generatePreventiveControlsForFiveWhys(
      rootCause,
      fiveWhysSteps,
      incidentContext,
      existingControls
    );

    res.json({
      success: true,
      data: { 
        preventiveControls: result.preventiveControls,
      },
    });
  } catch (error: any) {
    console.error('Generate preventive controls error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ============================================================================
// AI Fishbone Session Management - Auto-save and Recovery
// ============================================================================

/**
 * GET /rca/:rcaId/ai-fishbone-session
 * Get the current AI Fishbone session for an RCA
 */
router.get('/:rcaId/ai-fishbone-session', async (req: AuthRequest, res: Response) => {
  try {
    const { rcaId } = req.params;
    
    const session = await prisma.aIFishboneSession.findUnique({
      where: { rcaAnalysisId: rcaId },
      include: {
        StartedBy: {
          select: { id: true, firstName: true, lastName: true }
        },
        LastUpdatedBy: {
          select: { id: true, firstName: true, lastName: true }
        }
      }
    });

    res.json({
      success: true,
      data: session || null
    });
  } catch (error: any) {
    console.error('Get AI Fishbone session error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /rca/:rcaId/ai-fishbone-session
 * Create or update an AI Fishbone session (auto-save)
 */
router.post('/:rcaId/ai-fishbone-session', async (req: AuthRequest, res: Response) => {
  try {
    const { rcaId } = req.params;
    const userId = req.user?.id;
    const user = req.user;
    
    if (!userId || !user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    
    const {
      workflowStep,
      problemValidation,
      clarificationAnswers,
      aiAnalysisResult
    } = req.body;
    
    // Get the RCA to find the incidentId
    const rca = await prisma.rCAAnalysis.findUnique({
      where: { id: rcaId },
      select: { incidentId: true }
    });
    
    if (!rca) {
      return res.status(404).json({ success: false, error: 'RCA not found' });
    }
    
    // Map workflow step string to enum
    const workflowStepEnum = workflowStep?.toUpperCase().replace(/-/g, '_') || 'IDLE';
    
    // Upsert the session
    const session = await prisma.aIFishboneSession.upsert({
      where: { rcaAnalysisId: rcaId },
      create: {
        rcaAnalysisId: rcaId,
        incidentId: rca.incidentId,
        workflowStep: workflowStepEnum as any,
        problemValidation: problemValidation || null,
        clarificationAnswers: clarificationAnswers || [],
        aiAnalysisResult: aiAnalysisResult || null,
        startedById: userId,
        startedByFirstName: user.firstName,
        startedByLastName: user.lastName,
        startedAt: new Date(),
        lastUpdatedById: userId,
        lastUpdatedByFirstName: user.firstName,
        lastUpdatedByLastName: user.lastName
      },
      update: {
        workflowStep: workflowStepEnum as any,
        problemValidation: problemValidation !== undefined ? problemValidation : undefined,
        clarificationAnswers: clarificationAnswers !== undefined ? clarificationAnswers : undefined,
        aiAnalysisResult: aiAnalysisResult !== undefined ? aiAnalysisResult : undefined,
        lastUpdatedById: userId,
        lastUpdatedByFirstName: user.firstName,
        lastUpdatedByLastName: user.lastName,
        completedAt: workflowStep === 'complete' ? new Date() : undefined
      },
      include: {
        StartedBy: {
          select: { id: true, firstName: true, lastName: true }
        },
        LastUpdatedBy: {
          select: { id: true, firstName: true, lastName: true }
        }
      }
    });

    // Broadcast the session update to all users in the incident room
    websocketService.emitToIncident(rca.incidentId, 'rca:ai-session-updated', {
      rcaId,
      session,
      updatedBy: {
        id: userId,
        firstName: user.firstName,
        lastName: user.lastName
      },
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      data: session
    });
  } catch (error: any) {
    console.error('Save AI Fishbone session error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /rca/:rcaId/ai-fishbone-session
 * Delete/clear the AI Fishbone session (e.g., when user cancels or analysis is applied)
 */
router.delete('/:rcaId/ai-fishbone-session', async (req: AuthRequest, res: Response) => {
  try {
    const { rcaId } = req.params;
    const userId = req.user?.id;
    const user = req.user;
    
    if (!userId || !user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    
    // Get the session first to find incidentId
    const existingSession = await prisma.aIFishboneSession.findUnique({
      where: { rcaAnalysisId: rcaId },
      select: { incidentId: true }
    });
    
    if (!existingSession) {
      return res.json({ success: true, message: 'No session to delete' });
    }
    
    await prisma.aIFishboneSession.delete({
      where: { rcaAnalysisId: rcaId }
    });

    // Broadcast the session deletion to all users in the incident room
    websocketService.emitToIncident(existingSession.incidentId, 'rca:ai-session-cleared', {
      rcaId,
      clearedBy: {
        id: userId,
        firstName: user.firstName,
        lastName: user.lastName
      },
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      message: 'Session deleted successfully'
    });
  } catch (error: any) {
    console.error('Delete AI Fishbone session error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================================
// 5 WHYS INDIVIDUAL CAUSE ANALYSIS PERSISTENCE
// ============================================================================

/**
 * GET /:rcaId/five-whys-analyses
 * Get all 5 Whys analyses for an RCA (with answer status for color coding)
 */
router.get('/:rcaId/five-whys-analyses', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { rcaId } = req.params;
    
    const analyses = await prisma.fiveWhysAnalysis.findMany({
      where: { rcaAnalysisId: rcaId },
      include: {
        steps: {
          orderBy: { stepNumber: 'asc' }
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });
    
    // Map analyses with hasAnswers flag for color coding
    const analysesWithStatus = analyses.map(analysis => ({
      ...analysis,
      hasAnswers: analysis.steps.some(step => step.answer && step.answer.trim() !== ''),
      answerCount: analysis.steps.filter(step => step.answer && step.answer.trim() !== '').length
    }));
    
    res.json({
      success: true,
      analyses: analysesWithStatus
    });
  } catch (error: any) {
    console.error('Get 5 Whys analyses error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /:rcaId/five-whys-analysis/:causeId
 * Get a specific 5 Whys analysis for a cause
 */
router.get('/:rcaId/five-whys-analysis/:causeId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { rcaId, causeId } = req.params;
    
    const analysis = await prisma.fiveWhysAnalysis.findFirst({
      where: { 
        rcaAnalysisId: rcaId,
        causeId: causeId 
      },
      include: {
        steps: {
          orderBy: { stepNumber: 'asc' },
          include: {
            answeredBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true
              }
            }
          }
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });
    
    if (!analysis) {
      return res.json({
        success: true,
        analysis: null
      });
    }
    
    res.json({
      success: true,
      analysis: {
        ...analysis,
        hasAnswers: analysis.steps.some(step => step.answer && step.answer.trim() !== ''),
        answerCount: analysis.steps.filter(step => step.answer && step.answer.trim() !== '').length
      }
    });
  } catch (error: any) {
    console.error('Get 5 Whys analysis error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /:rcaId/five-whys-analysis
 * Create or update a 5 Whys analysis for a cause
 */
router.post('/:rcaId/five-whys-analysis', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { rcaId } = req.params;
    const userId = req.user?.id;
    const { causeId, causeText, categoryId, categoryName, initialQuestion } = req.body;
    
    if (!causeId || !causeText) {
      return res.status(400).json({
        success: false,
        error: 'causeId and causeText are required'
      });
    }
    
    // Check if analysis already exists
    const existing = await prisma.fiveWhysAnalysis.findFirst({
      where: { 
        rcaAnalysisId: rcaId,
        causeId: causeId 
      },
      include: {
        steps: {
          orderBy: { stepNumber: 'asc' }
        }
      }
    });
    
    if (existing) {
      return res.json({
        success: true,
        analysis: {
          ...existing,
          hasAnswers: existing.steps.some(step => step.answer && step.answer.trim() !== ''),
          answerCount: existing.steps.filter(step => step.answer && step.answer.trim() !== '').length
        },
        isNew: false
      });
    }
    
    // Create new analysis with 5 empty steps
    const analysis = await prisma.fiveWhysAnalysis.create({
      data: {
        rcaAnalysisId: rcaId,
        causeId,
        causeText,
        categoryId: categoryId || '',
        categoryName: categoryName || '',
        createdById: userId,
        steps: {
          create: [
            { stepNumber: 1, question: initialQuestion || `Why did "${causeText}" occur?` },
            { stepNumber: 2, question: 'Why?' },
            { stepNumber: 3, question: 'Why?' },
            { stepNumber: 4, question: 'Why?' },
            { stepNumber: 5, question: 'Why?' }
          ]
        }
      },
      include: {
        steps: {
          orderBy: { stepNumber: 'asc' }
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });
    
    // Get RCA for incident ID to broadcast
    const rca = await prisma.rCAAnalysis.findUnique({
      where: { id: rcaId },
      select: { incidentId: true }
    });
    
    if (rca?.incidentId) {
      websocketService.emitToIncident(rca.incidentId, 'rca:five-whys-analysis-created', {
        rcaId,
        analysis: {
          ...analysis,
          hasAnswers: false,
          answerCount: 0
        }
      });
    }
    
    res.json({
      success: true,
      analysis: {
        ...analysis,
        hasAnswers: false,
        answerCount: 0
      },
      isNew: true
    });
  } catch (error: any) {
    console.error('Create 5 Whys analysis error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PATCH /:rcaId/five-whys-analysis/:causeId/step/:stepNumber
 * Update a specific step in a 5 Whys analysis
 */
router.patch('/:rcaId/five-whys-analysis/:causeId/step/:stepNumber', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { rcaId, causeId, stepNumber } = req.params;
    const userId = req.user?.id;
    const { answer, nextQuestion } = req.body;
    
    // Find the analysis
    const analysis = await prisma.fiveWhysAnalysis.findFirst({
      where: { 
        rcaAnalysisId: rcaId,
        causeId: causeId 
      }
    });
    
    if (!analysis) {
      return res.status(404).json({
        success: false,
        error: 'Analysis not found'
      });
    }
    
    // Update the step
    const step = await prisma.fiveWhysStep.update({
      where: {
        analysisId_stepNumber: {
          analysisId: analysis.id,
          stepNumber: parseInt(stepNumber)
        }
      },
      data: {
        answer: answer || '',
        answeredById: answer ? userId : null,
        answeredAt: answer ? new Date() : null
      }
    });
    
    // If nextQuestion is provided, update the next step's question
    const currentStepNum = parseInt(stepNumber);
    if (nextQuestion && currentStepNum < 5) {
      await prisma.fiveWhysStep.update({
        where: {
          analysisId_stepNumber: {
            analysisId: analysis.id,
            stepNumber: currentStepNum + 1
          }
        },
        data: {
          question: nextQuestion
        }
      });
    }
    
    // Get updated analysis with all steps
    const updatedAnalysis = await prisma.fiveWhysAnalysis.findFirst({
      where: { id: analysis.id },
      include: {
        steps: {
          orderBy: { stepNumber: 'asc' },
          include: {
            answeredBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true
              }
            }
          }
        }
      }
    });
    
    // Get RCA for incident ID to broadcast
    const rca = await prisma.rCAAnalysis.findUnique({
      where: { id: rcaId },
      select: { incidentId: true }
    });
    
    if (rca?.incidentId && updatedAnalysis) {
      const hasAnswers = updatedAnalysis.steps.some(s => s.answer && s.answer.trim() !== '');
      const answerCount = updatedAnalysis.steps.filter(s => s.answer && s.answer.trim() !== '').length;
      
      websocketService.emitToIncident(rca.incidentId, 'rca:five-whys-step-updated', {
        rcaId,
        causeId,
        stepNumber: currentStepNum,
        answer,
        nextQuestion,
        hasAnswers,
        answerCount
      });
    }
    
    res.json({
      success: true,
      step,
      analysis: updatedAnalysis ? {
        ...updatedAnalysis,
        hasAnswers: updatedAnalysis.steps.some(s => s.answer && s.answer.trim() !== ''),
        answerCount: updatedAnalysis.steps.filter(s => s.answer && s.answer.trim() !== '').length
      } : null
    });
  } catch (error: any) {
    console.error('Update 5 Whys step error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PATCH /:rcaId/five-whys-analysis/:causeId
 * Update 5 Whys analysis metadata (root cause, validation, recommendation)
 */
router.patch('/:rcaId/five-whys-analysis/:causeId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { rcaId, causeId } = req.params;
    const { rootCause, isComplete, isValidated, recommendation } = req.body;
    
    const analysis = await prisma.fiveWhysAnalysis.updateMany({
      where: { 
        rcaAnalysisId: rcaId,
        causeId: causeId 
      },
      data: {
        ...(rootCause !== undefined && { rootCause }),
        ...(isComplete !== undefined && { isComplete }),
        ...(isValidated !== undefined && { isValidated }),
        ...(recommendation !== undefined && { recommendation })
      }
    });
    
    if (analysis.count === 0) {
      return res.status(404).json({
        success: false,
        error: 'Analysis not found'
      });
    }
    
    // Fetch updated analysis
    const updatedAnalysis = await prisma.fiveWhysAnalysis.findFirst({
      where: { 
        rcaAnalysisId: rcaId,
        causeId: causeId 
      },
      include: {
        steps: {
          orderBy: { stepNumber: 'asc' }
        }
      }
    });
    
    // Get RCA for incident ID to broadcast
    const rca = await prisma.rCAAnalysis.findUnique({
      where: { id: rcaId },
      select: { incidentId: true }
    });
    
    if (rca?.incidentId && updatedAnalysis) {
      websocketService.emitToIncident(rca.incidentId, 'rca:five-whys-analysis-updated', {
        rcaId,
        causeId,
        analysis: {
          ...updatedAnalysis,
          hasAnswers: updatedAnalysis.steps.some(s => s.answer && s.answer.trim() !== ''),
          answerCount: updatedAnalysis.steps.filter(s => s.answer && s.answer.trim() !== '').length
        }
      });
    }
    
    res.json({
      success: true,
      analysis: updatedAnalysis ? {
        ...updatedAnalysis,
        hasAnswers: updatedAnalysis.steps.some(s => s.answer && s.answer.trim() !== ''),
        answerCount: updatedAnalysis.steps.filter(s => s.answer && s.answer.trim() !== '').length
      } : null
    });
  } catch (error: any) {
    console.error('Update 5 Whys analysis error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /:rcaId/five-whys-analysis/:causeId
 * Delete a 5 Whys analysis for a cause
 */
router.delete('/:rcaId/five-whys-analysis/:causeId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { rcaId, causeId } = req.params;
    
    const deleted = await prisma.fiveWhysAnalysis.deleteMany({
      where: { 
        rcaAnalysisId: rcaId,
        causeId: causeId 
      }
    });
    
    if (deleted.count === 0) {
      return res.status(404).json({
        success: false,
        error: 'Analysis not found'
      });
    }
    
    // Get RCA for incident ID to broadcast
    const rca = await prisma.rCAAnalysis.findUnique({
      where: { id: rcaId },
      select: { incidentId: true }
    });
    
    if (rca?.incidentId) {
      websocketService.emitToIncident(rca.incidentId, 'rca:five-whys-analysis-deleted', {
        rcaId,
        causeId
      });
    }
    
    res.json({
      success: true,
      message: 'Analysis deleted successfully'
    });
  } catch (error: any) {
    console.error('Delete 5 Whys analysis error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
