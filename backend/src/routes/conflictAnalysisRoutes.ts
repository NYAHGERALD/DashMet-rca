import { Router, Request, Response } from 'express';
import OpenAI from 'openai';

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

interface CompareComplaintsRequest {
  complaintA: {
    employeeName: string;
    originalText: string;
    translatedText?: string;
    cleanedText?: string;
  };
  complaintB: {
    employeeName: string;
    originalText: string;
    translatedText?: string;
    cleanedText?: string;
  };
  caseDetails: {
    incidentDate: string;
    location: string;
    department: string;
  };
  witnessStatements?: Array<{
    witnessName: string;
    text: string;
  }>;
}

interface AnalysisResult {
  timelineDifferences: string[];
  agreementPoints: string[];
  contradictions: string[];
  emotionalLanguage: string[];
  missingDetails: string[];
  neutralSummary: string;
  sideBySideComparison: {
    topic: string;
    partyAVersion: string;
    partyBVersion: string;
    status: 'agreement' | 'contradiction' | 'partial' | 'unclear';
  }[];
}

/**
 * Compare two complaints and generate AI analysis
 * POST /api/conflict-analysis/compare
 */
router.post('/compare', async (req: Request, res: Response) => {
  try {
    const { 
      complaintA, 
      complaintB, 
      caseDetails,
      witnessStatements 
    } = req.body as CompareComplaintsRequest;
    
    if (!complaintA || !complaintB) {
      return res.status(400).json({ 
        error: 'Both complaints are required for comparison' 
      });
    }
    
    const openai = getOpenAIClient();
    if (!openai) {
      return res.status(503).json({ 
        error: 'AI service unavailable',
        message: 'OpenAI API key not configured. Please contact your administrator.'
      });
    }
    
    // Use the cleaned/translated text if available, otherwise original
    const textA = complaintA.translatedText || complaintA.cleanedText || complaintA.originalText;
    const textB = complaintB.translatedText || complaintB.cleanedText || complaintB.originalText;
    
    // Build witness context if available
    let witnessContext = '';
    if (witnessStatements && witnessStatements.length > 0) {
      witnessContext = `\n\nWITNESS STATEMENTS:\n${witnessStatements.map((w, i) => 
        `Witness ${i + 1} (${w.witnessName}):\n${w.text}`
      ).join('\n\n')}`;
    }
    
    const systemPrompt = `You are an impartial workplace conflict analysis assistant. Your role is to objectively analyze statements from both parties involved in a workplace incident WITHOUT making accusations or determining fault.

CRITICAL GUIDELINES:
1. NEVER accuse either party of wrongdoing
2. NEVER determine who is "right" or "wrong"
3. ONLY identify factual differences, agreements, and missing information
4. Use neutral, professional language throughout
5. Present findings as observations, not judgments
6. Flag emotional language as context, not criticism
7. Highlight what needs clarification, not what's "false"

Your analysis should help supervisors understand the situation objectively so they can make informed decisions.`;

    const userPrompt = `Analyze the following workplace incident statements:

CASE DETAILS:
- Incident Date: ${caseDetails.incidentDate}
- Location: ${caseDetails.location}
- Department: ${caseDetails.department}

PARTY A (${complaintA.employeeName}):
${textA}

PARTY B (${complaintB.employeeName}):
${textB}${witnessContext}

Please provide a comprehensive, NEUTRAL analysis in the following JSON format:

{
  "timelineDifferences": [
    "List specific timeline discrepancies between the two accounts, stating what each party claims without judgment"
  ],
  "agreementPoints": [
    "List facts that both parties agree on or describe consistently"
  ],
  "contradictions": [
    "List direct contradictions where Party A says X but Party B says Y - present both versions neutrally"
  ],
  "emotionalLanguage": [
    "Note instances of emotional, escalated, or strong language from either party (for context, not criticism)"
  ],
  "missingDetails": [
    "List important details that are unclear or not addressed by either party (e.g., specific times, witnesses mentioned but not interviewed)"
  ],
  "neutralSummary": "A 2-3 paragraph summary of the incident based on both accounts. Present what happened according to each party without determining truth. End with what aspects need further clarification.",
  "sideBySideComparison": [
    {
      "topic": "The main point being compared (e.g., 'Time of incident', 'Who initiated contact')",
      "partyAVersion": "What Party A claims about this topic",
      "partyBVersion": "What Party B claims about this topic", 
      "status": "agreement|contradiction|partial|unclear"
    }
  ]
}

Ensure:
- Each array has at least 1 item, up to 5-8 items for thorough analysis
- Side-by-side comparison covers all major disputed points
- Language remains completely neutral and professional
- No conclusions about who is telling the truth`;

    console.log('Conflict Analysis: Starting comparison...');
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 4096,
      temperature: 0.3, // Lower temperature for more consistent analysis
      response_format: { type: 'json_object' }
    });
    
    const content = completion.choices[0]?.message?.content || '';
    console.log('Conflict Analysis: Received response, parsing...');
    
    try {
      const analysis: AnalysisResult = JSON.parse(content);
      
      // Validate required fields
      if (!analysis.timelineDifferences) analysis.timelineDifferences = [];
      if (!analysis.agreementPoints) analysis.agreementPoints = [];
      if (!analysis.contradictions) analysis.contradictions = [];
      if (!analysis.emotionalLanguage) analysis.emotionalLanguage = [];
      if (!analysis.missingDetails) analysis.missingDetails = [];
      if (!analysis.neutralSummary) analysis.neutralSummary = 'Analysis could not generate a summary.';
      if (!analysis.sideBySideComparison) analysis.sideBySideComparison = [];
      
      return res.json({
        success: true,
        data: {
          ...analysis,
          generatedAt: new Date().toISOString(),
          partyAName: complaintA.employeeName,
          partyBName: complaintB.employeeName
        }
      });
      
    } catch (parseError) {
      console.error('Conflict Analysis: Failed to parse JSON response', parseError);
      return res.status(500).json({
        error: 'Failed to parse analysis results',
        message: 'The AI returned an invalid response format'
      });
    }
    
  } catch (error: any) {
    console.error('Conflict Analysis error:', error);
    return res.status(500).json({ 
      error: 'Analysis failed',
      message: error.message || 'An error occurred during analysis'
    });
  }
});

/**
 * Health check endpoint
 * GET /api/conflict-analysis/health
 */
router.get('/health', (req: Request, res: Response) => {
  const openai = getOpenAIClient();
  res.json({
    status: 'ok',
    aiAvailable: openai !== null
  });
});

export default router;
