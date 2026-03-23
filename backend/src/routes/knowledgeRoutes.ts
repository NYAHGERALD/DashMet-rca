/**
 * Phase 13: Knowledge Base Routes
 * API endpoints for knowledge article management, similar incident search, and AI coaching
 */

import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requireRoles } from '../middleware/rbac';
import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';
import { generateRCACoachGuidance } from '../services/aiService';

const router = Router();

// Apply authentication to all routes
router.use(authenticate);

// ============================================================================
// Phase 13.1: Knowledge Article Management
// ============================================================================

/**
 * GET /api/knowledge/articles
 * List knowledge articles with filtering
 */
router.get('/articles', async (req: AuthRequest, res: Response) => {
  try {
    const { 
      search,
      incidentType,
      page = '1',
      limit = '20',
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Build where clause
    const where: any = {
      ...(incidentType && { incidentType: incidentType as any }),
    };

    // Add search condition if provided
    if (search) {
      where.OR = [
        { title: { contains: search as string, mode: 'insensitive' } },
        { summary: { contains: search as string, mode: 'insensitive' } },
        { keywords: { has: search as string } },
        { rootCause: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    const [articles, total] = await Promise.all([
      prisma.knowledgeArticle.findMany({
        where,
        orderBy: [
          { viewCount: 'desc' },
          { createdAt: 'desc' },
        ],
        skip,
        take: limitNum,
      }),
      prisma.knowledgeArticle.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        articles,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum),
        },
      },
    });

  } catch (error: any) {
    logger.error('Error fetching knowledge articles:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch knowledge articles',
    });
  }
});

/**
 * GET /api/knowledge/articles/:id
 * Get a single knowledge article
 */
router.get('/articles/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const article = await prisma.knowledgeArticle.findUnique({
      where: { id },
    });

    if (!article) {
      return res.status(404).json({
        success: false,
        error: 'Article not found',
      });
    }

    // Increment view count
    await prisma.knowledgeArticle.update({
      where: { id },
      data: { viewCount: { increment: 1 } },
    });

    // Get the source incident for more context
    const sourceIncident = await prisma.incident.findUnique({
      where: { id: article.sourceIncidentId },
      include: {
        Category: { select: { name: true } },
        Facility: { select: { name: true } },
        RCAAnalysis: {
          select: {
            id: true,
            method: true,
            rootCauseStatement: true,
            fishboneData: true,
            fiveWhysData: true,
            CAPAction: {
              select: {
                title: true,
                description: true,
                actionType: true,
                status: true,
              },
            },
          },
        },
      },
    });

    res.json({
      success: true,
      data: {
        ...article,
        sourceIncident,
      },
    });

  } catch (error: any) {
    logger.error('Error fetching knowledge article:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch knowledge article',
    });
  }
});

/**
 * POST /api/knowledge/articles
 * Create a new knowledge article manually
 */
router.post('/articles', requireRoles('CI_MANAGER', 'QA_FOOD_SAFETY', 'ADMIN', 'SYSTEM_ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const {
      title,
      summary,
      sourceIncidentId,
      incidentType,
      categoryNames,
      rootCause,
      successfulActions,
      keywords,
    } = req.body;

    if (!title || !summary || !sourceIncidentId) {
      return res.status(400).json({
        success: false,
        error: 'Title, summary, and sourceIncidentId are required',
      });
    }

    // Verify incident exists
    const incident = await prisma.incident.findUnique({
      where: { id: sourceIncidentId },
    });

    if (!incident) {
      return res.status(404).json({
        success: false,
        error: 'Source incident not found',
      });
    }

    const article = await prisma.knowledgeArticle.create({
      data: {
        title,
        summary,
        sourceIncidentId,
        incidentType: incidentType || incident.type,
        categoryNames: categoryNames || [],
        rootCause: rootCause || '',
        successfulActions: successfulActions || [],
        keywords: keywords || [],
      },
    });

    logger.info(`Knowledge article created: ${article.id}`);

    res.status(201).json({
      success: true,
      data: article,
    });

  } catch (error: any) {
    logger.error('Error creating knowledge article:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({
        success: false,
        error: 'A knowledge article already exists for this incident',
      });
    }
    res.status(500).json({
      success: false,
      error: 'Failed to create knowledge article',
    });
  }
});

/**
 * POST /api/knowledge/articles/generate/:incidentId
 * Auto-generate a knowledge article from a closed incident with validated RCA
 */
router.post('/articles/generate/:incidentId', requireRoles('CI_MANAGER', 'QA_FOOD_SAFETY', 'ADMIN', 'SYSTEM_ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { incidentId } = req.params;

    // Get incident with RCA data
    const incidentWithRca = await prisma.incident.findUnique({
      where: { id: incidentId },
      include: {
        Category: { select: { name: true } },
        Facility: { select: { name: true } },
        Department: { select: { name: true } },
        RCAAnalysis: {
          where: { isValidated: true },
          include: {
            CAPAction: {
              where: { status: { in: ['COMPLETED', 'VERIFIED'] } },
              select: {
                title: true,
                description: true,
                actionType: true,
                isEffective: true,
              },
            },
          },
          take: 1,
        },
      },
    });

    const incident = incidentWithRca;

    if (!incident) {
      return res.status(404).json({
        success: false,
        error: 'Incident not found',
      });
    }

    if (incident.status !== 'CLOSED') {
      return res.status(400).json({
        success: false,
        error: 'Incident must be closed before generating knowledge article',
      });
    }

    if (!incident.RCAAnalysis || incident.RCAAnalysis.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No validated RCA found for this incident',
      });
    }

    // Check if article already exists
    const existingArticle = await prisma.knowledgeArticle.findUnique({
      where: { sourceIncidentId: incidentId },
    });

    if (existingArticle) {
      return res.status(400).json({
        success: false,
        error: 'Knowledge article already exists for this incident',
        articleId: existingArticle.id,
      });
    }

    const rca = incident.RCAAnalysis[0];

    // Generate article content
    const title = generateArticleTitle(incident);
    const summary = generateArticleSummary(incident, rca);
    const successfulActions = rca.CAPAction
      .filter((a: any) => a.isEffective !== false)
      .map((a: any) => a.title);
    const keywords = extractKeywords(incident, rca);
    const categoryNames = incident.Category ? [incident.Category.name] : [];

    const article = await prisma.knowledgeArticle.create({
      data: {
        title,
        summary,
        sourceIncidentId: incident.id,
        incidentType: incident.type,
        categoryNames,
        rootCause: rca.rootCauseStatement || 'Root cause analysis completed',
        successfulActions,
        keywords,
      },
    });

    logger.info(`Knowledge article auto-generated from incident ${incidentId}: ${article.id}`);

    res.status(201).json({
      success: true,
      data: article,
      message: 'Knowledge article generated successfully',
    });

  } catch (error: any) {
    logger.error('Error generating knowledge article:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate knowledge article',
    });
  }
});

/**
 * PUT /api/knowledge/articles/:id
 * Update a knowledge article
 */
router.put('/articles/:id', requireRoles('CI_MANAGER', 'QA_FOOD_SAFETY', 'ADMIN', 'SYSTEM_ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const {
      title,
      summary,
      rootCause,
      successfulActions,
      keywords,
      categoryNames,
    } = req.body;

    const article = await prisma.knowledgeArticle.update({
      where: { id },
      data: {
        ...(title && { title }),
        ...(summary && { summary }),
        ...(rootCause && { rootCause }),
        ...(successfulActions && { successfulActions }),
        ...(keywords && { keywords }),
        ...(categoryNames && { categoryNames }),
        updatedAt: new Date(),
      },
    });

    res.json({
      success: true,
      data: article,
    });

  } catch (error: any) {
    logger.error('Error updating knowledge article:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update knowledge article',
    });
  }
});

/**
 * POST /api/knowledge/articles/:id/helpful
 * Mark article as helpful
 */
router.post('/articles/:id/helpful', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const article = await prisma.knowledgeArticle.update({
      where: { id },
      data: { helpfulCount: { increment: 1 } },
    });

    res.json({
      success: true,
      data: { helpfulCount: article.helpfulCount },
    });

  } catch (error: any) {
    logger.error('Error marking article helpful:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update article',
    });
  }
});

/**
 * DELETE /api/knowledge/articles/:id
 * Delete a knowledge article
 */
router.delete('/articles/:id', requireRoles('ADMIN', 'SYSTEM_ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.knowledgeArticle.delete({
      where: { id },
    });

    logger.info(`Knowledge article deleted: ${id}`);

    res.json({
      success: true,
      message: 'Article deleted successfully',
    });

  } catch (error: any) {
    logger.error('Error deleting knowledge article:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete knowledge article',
    });
  }
});

// ============================================================================
// Phase 13.2: Similar Incident Search
// ============================================================================

/**
 * POST /api/knowledge/search/similar
 * Find similar incidents based on description and category
 */
router.post('/search/similar', async (req: AuthRequest, res: Response) => {
  try {
    const {
      description,
      categoryId,
      incidentType,
      facilityId,
      excludeIncidentId,
      limit = 10,
    } = req.body;

    if (!description) {
      return res.status(400).json({
        success: false,
        error: 'Description is required for similarity search',
      });
    }

    // Extract keywords from description
    const searchKeywords = extractSearchKeywords(description);

    // Build search conditions
    const baseWhere: any = {
      status: { in: ['CLOSED', 'IN_REVIEW'] },
      ...(categoryId && { categoryId }),
      ...(incidentType && { type: incidentType }),
      ...(facilityId && { facilityId }),
      ...(excludeIncidentId && { id: { not: excludeIncidentId } }),
    };

    // Search for similar incidents using keywords
    const similarIncidents = await prisma.incident.findMany({
      where: {
        ...baseWhere,
        OR: searchKeywords.flatMap(keyword => [
          { description: { contains: keyword, mode: 'insensitive' as const } },
          { customTitle: { contains: keyword, mode: 'insensitive' as const } },
          { aiGeneratedSummary: { contains: keyword, mode: 'insensitive' as const } },
        ]),
      },
      include: {
        Category: { select: { name: true } },
        Facility: { select: { name: true } },
        RCAAnalysis: {
          where: { isValidated: true },
          select: {
            id: true,
            method: true,
            rootCauseStatement: true,
          },
          take: 1,
        },
      },
      take: parseInt(limit as string),
      orderBy: { createdAt: 'desc' },
    });

    // Calculate similarity scores
    const scoredResults = similarIncidents.map(incident => ({
      ...incident,
      similarityScore: calculateSimilarityScore(description, incident, searchKeywords),
    })).sort((a, b) => b.similarityScore - a.similarityScore);

    res.json({
      success: true,
      data: {
        query: {
          description: description.substring(0, 100) + '...',
          keywords: searchKeywords,
        },
        results: scoredResults,
        count: scoredResults.length,
      },
    });

  } catch (error: any) {
    logger.error('Error searching similar incidents:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search similar incidents',
    });
  }
});

/**
 * GET /api/knowledge/search/related/:incidentId
 * Find related incidents and knowledge articles for a specific incident
 */
router.get('/search/related/:incidentId', async (req: AuthRequest, res: Response) => {
  try {
    const { incidentId } = req.params;

    // Get the source incident
    const sourceIncident = await prisma.incident.findUnique({
      where: { id: incidentId },
      select: {
        id: true,
        description: true,
        categoryId: true,
        type: true,
        facilityId: true,
        lineId: true,
      },
    });

    if (!sourceIncident) {
      return res.status(404).json({
        success: false,
        error: 'Incident not found',
      });
    }

    // Find related incidents (same category or line)
    const relatedIncidents = await prisma.incident.findMany({
      where: {
        id: { not: incidentId },
        status: { in: ['CLOSED', 'IN_REVIEW', 'IN_PROGRESS'] },
        OR: [
          { categoryId: sourceIncident.categoryId },
          ...(sourceIncident.lineId ? [{ lineId: sourceIncident.lineId }] : []),
        ],
      },
      include: {
        Category: { select: { name: true } },
        Facility: { select: { name: true } },
        RCAAnalysis: {
          where: { isValidated: true },
          select: {
            rootCauseStatement: true,
          },
          take: 1,
        },
      },
      take: 10,
      orderBy: { createdAt: 'desc' },
    });

    // Search knowledge base too
    const relatedArticles = await prisma.knowledgeArticle.findMany({
      where: {
        incidentType: sourceIncident.type,
      },
      select: {
        id: true,
        title: true,
        rootCause: true,
        viewCount: true,
        categoryNames: true,
      },
      take: 5,
      orderBy: { viewCount: 'desc' },
    });

    res.json({
      success: true,
      data: {
        sourceIncident: {
          id: sourceIncident.id,
          categoryId: sourceIncident.categoryId,
          type: sourceIncident.type,
        },
        relatedIncidents,
        relatedArticles,
      },
    });

  } catch (error: any) {
    logger.error('Error finding related incidents:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to find related incidents',
    });
  }
});

// ============================================================================
// Phase 13.3: AI-Guided RCA Coach
// ============================================================================

/**
 * POST /api/knowledge/coach/guidance
 * Get AI-guided suggestions for RCA analysis
 */
router.post('/coach/guidance', async (req: AuthRequest, res: Response) => {
  try {
    const {
      incidentDescription,
      incidentType,
      categoryName,
      currentStep,
      selectedMethod,
      currentData,
    } = req.body;

    if (!currentStep) {
      return res.status(400).json({
        success: false,
        error: 'Current step is required',
      });
    }

    // Generate AI-powered contextual guidance
    const guidance = await generateRCACoachGuidance({
      incidentDescription: incidentDescription || 'General RCA guidance request',
      incidentType,
      categoryName,
      currentStep,
      selectedMethod,
      currentData,
    });

    res.json({
      success: true,
      data: guidance,
    });

  } catch (error: any) {
    logger.error('Error generating RCA guidance:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate RCA guidance',
    });
  }
});


/**
 * POST /api/knowledge/coach/suggestions
 * Get suggestions based on historical data
 */
router.post('/coach/suggestions', async (req: AuthRequest, res: Response) => {
  try {
    const {
      categoryId,
      incidentType,
    } = req.body;

    // Get common root causes for this category
    const historicalRCAs = await prisma.rCAAnalysis.findMany({
      where: {
        isValidated: true,
        Incident: {
          ...(categoryId && { categoryId }),
          ...(incidentType && { type: incidentType }),
        },
      },
      select: {
        rootCauseStatement: true,
        method: true,
        CAPAction: {
          where: { isEffective: true },
          select: {
            title: true,
            actionType: true,
          },
        },
      },
      take: 20,
      orderBy: { createdAt: 'desc' },
    });

    // Analyze patterns
    const rootCausePatterns = analyzeRootCausePatterns(historicalRCAs);
    const commonActions = analyzeCommonActions(historicalRCAs);
    const methodBreakdown = analyzeMethodUsage(historicalRCAs);

    res.json({
      success: true,
      data: {
        historicalCount: historicalRCAs.length,
        rootCausePatterns,
        commonActions,
        methodBreakdown,
        suggestions: generateSuggestions(rootCausePatterns, commonActions),
      },
    });

  } catch (error: any) {
    logger.error('Error generating suggestions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate suggestions',
    });
  }
});

/**
 * GET /api/knowledge/coach/tips/:method
 * Get tips for a specific RCA method
 */
router.get('/coach/tips/:method', async (req: AuthRequest, res: Response) => {
  try {
    const { method } = req.params;

    const tips = getRCAMethodTips(method);

    res.json({
      success: true,
      data: tips,
    });

  } catch (error: any) {
    logger.error('Error getting method tips:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get method tips',
    });
  }
});

// ============================================================================
// Helper Functions
// ============================================================================

function generateArticleTitle(incident: any): string {
  const categoryName = incident.Category?.name || incident.type;
  const facilityName = incident.facility?.name || 'Facility';
  return `${categoryName} - Root Cause Analysis at ${facilityName}`;
}

function generateArticleSummary(incident: any, rca: any): string {
  const parts: string[] = [];
  
  parts.push(`This knowledge article documents the root cause analysis for a ${incident.type.toLowerCase().replace('_', ' ')} incident.`);
  
  if (incident.Category?.name) {
    parts.push(`Category: ${incident.Category.name}.`);
  }
  
  if (rca.rootCauseStatement) {
    parts.push(`Root Cause: ${rca.rootCauseStatement}`);
  }
  
  if (rca.CAPAction && rca.CAPAction.length > 0) {
    const effectiveCount = rca.CAPAction.filter((a: any) => a.isEffective !== false).length;
    parts.push(`${effectiveCount} corrective actions were implemented.`);
  }
  
  return parts.join(' ');
}

function extractKeywords(incident: any, rca: any): string[] {
  const keywords: string[] = [];
  
  // Add category
  if (incident.Category?.name) {
    keywords.push(incident.Category.name.toLowerCase());
  }
  
  // Add type
  keywords.push(incident.type.toLowerCase().replace('_', ' '));
  
  // Add method
  if (rca.method) {
    keywords.push(rca.method.toLowerCase().replace('_', ' '));
  }
  
  // Extract significant words from root cause
  if (rca.rootCauseStatement) {
    const words = rca.rootCauseStatement.toLowerCase().split(/\s+/);
    const significantWords = words.filter((w: string) => w.length > 4);
    keywords.push(...significantWords.slice(0, 5));
  }
  
  return [...new Set(keywords)];
}

function extractSearchKeywords(description: string): string[] {
  const stopWords = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare',
    'and', 'but', 'or', 'nor', 'for', 'yet', 'so', 'as', 'at', 'by',
    'in', 'of', 'on', 'to', 'from', 'with', 'that', 'this', 'it',
  ]);

  const words = description.toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 3 && !stopWords.has(word));

  return [...new Set(words)].slice(0, 10);
}

function calculateSimilarityScore(query: string, incident: any, keywords: string[]): number {
  let score = 0;
  const incidentText = `${incident.description || ''} ${incident.customTitle || ''} ${incident.aiGeneratedSummary || ''}`.toLowerCase();

  keywords.forEach(keyword => {
    if (incidentText.includes(keyword)) {
      score += 10;
    }
  });

  if (incident.RCAAnalysis && incident.RCAAnalysis.length > 0) {
    score += 20;
    if (incident.RCAAnalysis[0].rootCauseStatement) {
      score += 10;
    }
  }

  return Math.min(100, score);
}

function generateRCAGuidance(
  description: string,
  incidentType: string,
  categoryName: string,
  currentStep: string,
  currentData: any
): any {
  const guidance: any = {
    step: currentStep,
    tips: [],
    questions: [],
    examples: [],
    nextSteps: [],
  };

  switch (currentStep) {
    case 'problem_statement':
      guidance.tips = [
        'Be specific about what happened, when, and where',
        'Include measurable impacts (quantity, cost, time)',
        'Avoid assigning blame or jumping to conclusions',
      ];
      guidance.questions = [
        'What exactly happened?',
        'When did it occur?',
        'Where did it happen?',
        'What is the impact?',
      ];
      break;

    case 'five_whys':
      guidance.tips = [
        'Ask "why" until you reach a root cause you can act on',
        'Verify each answer before moving to the next why',
        'Consider multiple branches if there are multiple causes',
        'Stop when you reach a systemic or process issue',
      ];
      guidance.questions = [
        'Why did this failure occur?',
        'What process allowed this to happen?',
        'What was the underlying cause?',
      ];
      break;

    case 'fishbone':
      guidance.tips = [
        'Consider all 6 categories: Man, Machine, Method, Material, Measurement, Environment',
        'Brainstorm multiple causes per category',
        'Prioritize the most likely causes',
      ];
      guidance.questions = [
        'Could this be a training or human error issue?',
        'Was equipment functioning properly?',
        'Were procedures followed correctly?',
        'Were materials within specification?',
      ];
      break;

    case 'root_cause':
      guidance.tips = [
        'The root cause should be actionable',
        'It should prevent recurrence if addressed',
        'Validate with evidence before finalizing',
      ];
      guidance.nextSteps = [
        'Document the root cause statement clearly',
        'Get validation from stakeholders',
        'Proceed to corrective action planning',
      ];
      break;

    case 'corrective_actions':
      guidance.tips = [
        'Include both immediate containment and long-term prevention',
        'Assign clear owners and due dates',
        'Make actions SMART: Specific, Measurable, Achievable, Relevant, Time-bound',
      ];
      guidance.questions = [
        'What immediate action prevents further damage?',
        'What long-term change prevents recurrence?',
        'Who is responsible for implementation?',
      ];
      break;
  }

  return guidance;
}

function analyzeRootCausePatterns(rcas: any[]): any[] {
  const patterns: Record<string, number> = {};
  
  rcas.forEach(rca => {
    if (rca.rootCauseStatement) {
      const category = categorizeRootCause(rca.rootCauseStatement);
      patterns[category] = (patterns[category] || 0) + 1;
    }
  });

  return Object.entries(patterns)
    .map(([pattern, count]) => ({ 
      pattern, 
      count, 
      percentage: rcas.length > 0 ? Math.round((count / rcas.length) * 100) : 0 
    }))
    .sort((a, b) => b.count - a.count);
}

function categorizeRootCause(rootCause: string): string {
  const lowerCase = rootCause.toLowerCase();
  
  if (lowerCase.includes('training') || lowerCase.includes('procedure')) return 'Training/Procedure';
  if (lowerCase.includes('equipment') || lowerCase.includes('machine')) return 'Equipment';
  if (lowerCase.includes('material') || lowerCase.includes('supplier')) return 'Material/Supplier';
  if (lowerCase.includes('environment') || lowerCase.includes('temperature')) return 'Environment';
  if (lowerCase.includes('human') || lowerCase.includes('error')) return 'Human Error';
  if (lowerCase.includes('maintenance') || lowerCase.includes('wear')) return 'Maintenance';
  
  return 'Other';
}

function analyzeCommonActions(rcas: any[]): any[] {
  const actions: Record<string, number> = {};
  
  rcas.forEach(rca => {
    rca.CAPAction?.forEach((action: any) => {
      const actionType = action.actionType;
      actions[actionType] = (actions[actionType] || 0) + 1;
    });
  });

  return Object.entries(actions)
    .map(([actionType, count]) => ({ actionType, count }))
    .sort((a, b) => b.count - a.count);
}

function analyzeMethodUsage(rcas: any[]): any {
  const methods: Record<string, number> = {};
  
  rcas.forEach(rca => {
    methods[rca.method] = (methods[rca.method] || 0) + 1;
  });

  return methods;
}

function generateSuggestions(patterns: any[], actions: any[]): string[] {
  const suggestions: string[] = [];
  
  if (patterns.length > 0) {
    suggestions.push(`Most common root cause pattern: ${patterns[0].pattern} (${patterns[0].percentage}% of cases)`);
  }
  
  if (actions.length > 0) {
    suggestions.push(`Common corrective action types: ${actions.slice(0, 3).map((a: any) => a.actionType).join(', ')}`);
  }
  
  suggestions.push('Review similar incidents in the knowledge base for proven solutions');
  
  return suggestions;
}

function getRCAMethodTips(method: string): any {
  const tips: Record<string, any> = {
    FIVE_WHYS: {
      method: '5 Whys',
      description: 'A simple but powerful technique that involves asking "Why?" repeatedly to drill down to the root cause.',
      steps: [
        'State the problem clearly',
        'Ask "Why did this happen?"',
        'For each answer, ask "Why?" again',
        'Continue until you reach an actionable root cause',
        'Typically 5 iterations are needed, but may be more or fewer',
      ],
      bestPractices: [
        'Verify each answer with data before proceeding',
        'Avoid blame - focus on processes and systems',
        'Consider multiple "why" branches for complex problems',
        'Stop when you reach something you can control and prevent',
      ],
    },
    FISHBONE: {
      method: 'Fishbone (Ishikawa) Diagram',
      description: 'A visual brainstorming tool that categorizes potential causes into six categories.',
      categories: {
        Man: 'Human factors - training, experience, fatigue, errors',
        Machine: 'Equipment - maintenance, calibration, age, capacity',
        Method: 'Processes - procedures, workflows, standards',
        Material: 'Inputs - raw materials, specifications, suppliers',
        Measurement: 'Inspection - accuracy, frequency, methods',
        Environment: 'Conditions - temperature, humidity, cleanliness',
      },
      bestPractices: [
        'Include cross-functional team members',
        'Don\'t filter ideas during brainstorming',
        'Prioritize causes based on likelihood and impact',
        'Verify top causes with evidence',
      ],
    },
    COMBINED: {
      method: 'Combined Analysis',
      description: 'Uses both 5 Whys and Fishbone for comprehensive root cause analysis.',
      steps: [
        'Start with Fishbone to identify potential causes across all categories',
        'Prioritize the top 2-3 most likely causes',
        'Apply 5 Whys to each prioritized cause',
        'Validate findings with evidence',
      ],
      bestPractices: [
        'Use Fishbone for brainstorming breadth',
        'Use 5 Whys for drilling down depth',
        'Cross-reference findings between methods',
      ],
    },
  };

  return tips[method] || tips['FIVE_WHYS'];
}

export default router;
