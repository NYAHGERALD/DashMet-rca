/**
 * Phase 5-8: RCA (Root Cause Analysis) Routes
 * API endpoints for RCA Workspace, 5 Whys, Fishbone, and validation
 */

import { Router, Request, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requireRoles } from '../middleware/rbac';
import { UserRole } from '@prisma/client';
import { prisma } from '../utils/prisma';
import rcaService from '../services/rcaService';
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
  generateEnhancedFishboneAnalysis
} from '../services/aiService';

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
router.post('/incidents/:incidentId', async (req: AuthRequest, res: Response) => {
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
router.patch('/:rcaId/method', async (req: AuthRequest, res: Response) => {
  try {
    const { rcaId } = req.params;
    const { method } = req.body;

    if (!method || !['FIVE_WHYS', 'FISHBONE'].includes(method)) {
      return res.status(400).json({
        success: false,
        error: 'Valid method is required (FIVE_WHYS or FISHBONE)',
      });
    }

    const analysis = await rcaService.updateRCAMethod(rcaId, method);

    res.json({
      success: true,
      data: analysis,
      message: 'RCA method updated successfully',
    });
  } catch (error: any) {
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

    if (!fiveWhysData) {
      return res.status(400).json({
        success: false,
        error: '5 Whys data is required',
      });
    }

    const analysis = await rcaService.updateFiveWhys(rcaId, userId, fiveWhysData, changeReason);

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

    if (!fishboneData) {
      return res.status(400).json({
        success: false,
        error: 'Fishbone data is required',
      });
    }

    const analysis = await rcaService.updateFishbone(rcaId, userId, fishboneData, changeReason);

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
router.post('/:rcaId/ai/generate-five-whys', async (req: AuthRequest, res: Response) => {
  try {
    const { rcaId } = req.params;
    const userId = req.user!.id;
    
    // Get RCA with incident details
    const rca = await rcaService.getRCAAnalysis(rcaId);
    
    if (!rca) {
      return res.status(404).json({
        success: false,
        error: 'RCA analysis not found',
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
router.post('/:rcaId/ai/generate-fishbone', async (req: AuthRequest, res: Response) => {
  try {
    const { rcaId } = req.params;
    const userId = req.user!.id;
    
    // Get RCA with incident details
    const rca = await rcaService.getRCAAnalysis(rcaId);
    
    if (!rca) {
      return res.status(404).json({
        success: false,
        error: 'RCA analysis not found',
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
    
    // Get RCA with incident details
    const rca = await rcaService.getRCAAnalysis(rcaId);
    
    if (!rca) {
      return res.status(404).json({
        success: false,
        error: 'RCA analysis not found',
      });
    }

    // Build incident context for AI
    const incidentContext = buildIncidentContextFromRCA(rca);

    // Generate enhanced AI analysis with action plans
    const aiAnalysis = await generateEnhancedFishboneAnalysis(incidentContext);

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

      // First, fetch the RCA to check ownership
      const rca = await prisma.rCAAnalysis.findUnique({
        where: { id: rcaId },
        select: { analystId: true },
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

export default router;
