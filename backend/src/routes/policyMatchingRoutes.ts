import { Router, Request, Response } from 'express';
import OpenAI from 'openai';
import { sanitizeForPrompt, sanitizeForSystemPrompt, wrapUserContent } from '../utils/promptSanitizer';

const router = Router();

// Lazy initialization of OpenAI client
let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }
  
  if (openaiClient) {
    return openaiClient;
  }
  
  openaiClient = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    timeout: 120000,
    maxRetries: 2,
  });
  
  return openaiClient;
}

interface PolicySection {
  id: string;
  sectionNumber: string;
  title: string;
  content: string;
  type: string;
  keywords?: string[];
  firstProgression?: string;
  secondProgression?: string;
  thirdProgression?: string;
  fourthProgression?: string;
}

interface PolicyMatchRequest {
  caseDetails: {
    caseType: string;
    incidentDate: string;
    location: string;
    department: string;
  };
  complaintA: {
    employeeName: string;
    text: string;
  };
  complaintB: {
    employeeName: string;
    text: string;
  };
  analysisResult?: {
    contradictions: string[];
    agreementPoints: string[];
    neutralSummary: string;
  };
  witnessStatements?: Array<{
    witnessName: string;
    text: string;
  }>;
  policySections: PolicySection[];
}

interface PolicyMatchResult {
  sectionId: string;
  sectionNumber: string;
  sectionTitle: string;
  relevanceExplanation: string;
  matchConfidence: number;
  keyPhrases: string[];
}

/**
 * Match case details against policy sections
 * POST /api/policy-matching/match
 */
router.post('/match', async (req: Request, res: Response) => {
  try {
    const {
      caseDetails,
      complaintA,
      complaintB,
      analysisResult,
      witnessStatements,
      policySections
    } = req.body as PolicyMatchRequest;

    if (!caseDetails || !complaintA || !complaintB) {
      return res.status(400).json({
        error: 'Case details and both complaints are required'
      });
    }

    if (!policySections || policySections.length === 0) {
      return res.status(400).json({
        error: 'No policy sections provided for matching'
      });
    }

    const openai = getOpenAIClient();
    if (!openai) {
      return res.status(503).json({
        error: 'AI service unavailable',
        message: 'OpenAI API key not configured. Please contact your administrator.'
      });
    }

    // Build witness context if available
    let witnessContext = '';
    if (witnessStatements && witnessStatements.length > 0) {
      witnessContext = `\n\nWITNESS ACCOUNTS:\n${witnessStatements.map(w =>
        `${sanitizeForSystemPrompt(w.witnessName, { maxLength: 100, context: 'witness-name' })}: ${wrapUserContent(sanitizeForPrompt(w.text, { maxLength: 1500, context: 'witness-text' }), 'witness_statement')}`
      ).join('\n')}`;
    }

    // Build analysis context if available
    let analysisContext = '';
    if (analysisResult) {
      const contradictions = analysisResult.contradictions || [];
      const agreementPoints = analysisResult.agreementPoints || [];
      const summary = analysisResult.neutralSummary || '';
      analysisContext = `\n\nPREVIOUS ANALYSIS FINDINGS:
Key Contradictions: ${sanitizeForPrompt(contradictions.slice(0, 3).join('; '), { maxLength: 500, context: 'contradictions' })}
Agreement Points: ${sanitizeForPrompt(agreementPoints.slice(0, 3).join('; '), { maxLength: 500, context: 'agreements' })}
Summary: ${sanitizeForPrompt(summary.substring(0, 500), { maxLength: 500, context: 'analysis-summary' })}`;
    }

    // Format policy sections for the prompt
    const policySectionsText = policySections.map(section => {
      let sectionText = `[Section ${section.sectionNumber}: ${section.title}]
Type: ${section.type}
Content: ${section.content.substring(0, 800)}${section.content.length > 800 ? '...' : ''}`;

      // Include progressive discipline if available
      const progressions: string[] = [];
      if (section.firstProgression) progressions.push(`1st Offense: ${section.firstProgression}`);
      if (section.secondProgression) progressions.push(`2nd Offense: ${section.secondProgression}`);
      if (section.thirdProgression) progressions.push(`3rd Offense: ${section.thirdProgression}`);
      if (section.fourthProgression) progressions.push(`4th Offense: ${section.fourthProgression}`);
      
      if (progressions.length > 0) {
        sectionText += `\nProgressive Discipline: ${progressions.join(' | ')}`;
      }

      // Legacy keywords support
      if (section.keywords && section.keywords.length > 0) {
        sectionText += `\nKeywords: ${section.keywords.join(', ')}`;
      }

      return sectionText;
    }).join('\n\n---\n\n');

    const systemPrompt = `You are a senior HR Policy Specialist with 20+ years of experience in workplace policy interpretation and compliance. Your role is to analyze workplace incidents and identify which company policy sections MAY be relevant.

YOUR APPROACH:
- You identify policy sections that POTENTIALLY relate to the situation
- You explain in plain, professional language WHY each section might apply
- You use employee names when referring to specific behaviors
- You NEVER accuse anyone or determine guilt
- You present policy relevance as "This section may be relevant because..." NOT "This person violated..."
- You focus on the BEHAVIORS described, not the people
- You prioritize sections that address the core issues raised in both statements
- When progressive discipline levels are provided, reference the appropriate offense level based on context

IMPORTANT BOUNDARIES:
- You are NOT determining if a policy was violated
- You are SUGGESTING which policies a supervisor should review
- You present findings as guidance, not conclusions
- You remain completely neutral and objective`;

    const safeNameA = sanitizeForSystemPrompt(complaintA.employeeName, { maxLength: 100, context: 'employee-A' });
    const safeNameB = sanitizeForSystemPrompt(complaintB.employeeName, { maxLength: 100, context: 'employee-B' });

    const userPrompt = `Please analyze this workplace incident and identify which policy sections may be relevant.

INCIDENT DETAILS:
- Type: ${sanitizeForPrompt(caseDetails.caseType, { maxLength: 200, context: 'case-type' })}
- Date: ${sanitizeForPrompt(caseDetails.incidentDate, { maxLength: 50, context: 'date' })}
- Location: ${sanitizeForPrompt(caseDetails.location, { maxLength: 200, context: 'location' })}
- Department: ${sanitizeForPrompt(caseDetails.department, { maxLength: 200, context: 'department' })}

${safeNameA.toUpperCase()}'S STATEMENT:
${wrapUserContent(sanitizeForPrompt(complaintA.text, { maxLength: 2000, context: 'complaint-A' }), 'employee_statement_A')}

${safeNameB.toUpperCase()}'S STATEMENT:
${wrapUserContent(sanitizeForPrompt(complaintB.text, { maxLength: 2000, context: 'complaint-B' }), 'employee_statement_B')}${witnessContext}${analysisContext}

COMPANY POLICY SECTIONS TO CONSIDER:
${policySectionsText}

Please identify which policy sections may be relevant to this situation. For each relevant section, provide:
1. Why it might apply (in professional, neutral language)
2. A confidence score (0.0-1.0) based on how clearly the section relates
3. Key phrases from the statements that triggered this match

Respond in JSON format:
{
  "matches": [
    {
      "sectionId": "the section's ID",
      "sectionNumber": "the section number (e.g., '3.2')",
      "sectionTitle": "the section title",
      "relevanceExplanation": "A 2-3 sentence professional explanation of why this section may be relevant. Use ${safeNameA} and ${safeNameB}'s names. Focus on behaviors described, not accusations. Start with 'This section may be relevant because...'",
      "matchConfidence": 0.85,
      "keyPhrases": ["specific phrases from statements that relate to this policy"]
    }
  ],
  "overallGuidance": "A brief paragraph of professional guidance for the supervisor about how to use these policy references in their review. Emphasize that these are suggestions for consideration, not determinations of violation."
}

QUALITY STANDARDS:
- Only include sections with genuine relevance (confidence > 0.5)
- Maximum 5 most relevant sections
- Use employee names in explanations, never "Party A" or "Party B"
- Explanations should be helpful and actionable
- Maintain completely neutral, professional tone`;

    console.log('Policy Matching: Starting analysis...');

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 4000,
      temperature: 0.4,
      response_format: { type: 'json_object' }
    });

    const content = completion.choices[0]?.message?.content || '';
    console.log('Policy Matching: Received response, parsing...');

    try {
      const result = JSON.parse(content);

      // Validate and clean up matches
      const matches: PolicyMatchResult[] = (result.matches || [])
        .filter((m: any) => m.matchConfidence >= 0.5)
        .slice(0, 5)
        .map((m: any) => ({
          sectionId: m.sectionId || '',
          sectionNumber: m.sectionNumber || '',
          sectionTitle: m.sectionTitle || '',
          relevanceExplanation: m.relevanceExplanation || '',
          matchConfidence: Math.min(1, Math.max(0, m.matchConfidence || 0)),
          keyPhrases: m.keyPhrases || []
        }));

      return res.json({
        success: true,
        data: {
          matches,
          overallGuidance: result.overallGuidance || '',
          generatedAt: new Date().toISOString()
        }
      });

    } catch (parseError) {
      console.error('Policy Matching: Failed to parse JSON response', parseError);
      return res.status(500).json({
        error: 'Failed to parse policy matching results',
        message: 'The AI returned an invalid response format'
      });
    }

  } catch (error: any) {
    console.error('Policy Matching error:', error);
    return res.status(500).json({
      error: 'Policy matching failed',
      message: error.message || 'An error occurred during policy analysis'
    });
  }
});

/**
 * Health check endpoint
 * GET /api/policy-matching/health
 */
router.get('/health', (req: Request, res: Response) => {
  const openai = getOpenAIClient();
  res.json({
    status: 'ok',
    aiAvailable: openai !== null
  });
});

export default router;
