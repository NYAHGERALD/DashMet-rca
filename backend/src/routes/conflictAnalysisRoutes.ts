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
  priorHistory?: Array<{
    type: string;  // "prior_complaint", "counseling_record", "warning_document"
    documentDate?: string;
    summary: string;
    employeeName?: string;
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
      witnessStatements,
      priorHistory
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
    
    // Get employee names for personalized analysis
    const nameA = complaintA.employeeName;
    const nameB = complaintB.employeeName;
    
    // Build witness context if available
    let witnessContext = '';
    if (witnessStatements && witnessStatements.length > 0) {
      witnessContext = `\n\nWITNESS ACCOUNTS:\n${witnessStatements.map((w, i) => 
        `${w.witnessName}'s Statement:\n${w.text}`
      ).join('\n\n')}`;
    }
    
    // Build prior history context if available
    let priorHistoryContext = '';
    if (priorHistory && priorHistory.length > 0) {
      const historyItems = priorHistory.map(h => {
        const typeLabel = h.type === 'prior_complaint' ? 'Prior Complaint' :
                          h.type === 'counseling_record' ? 'Counseling Record' :
                          h.type === 'warning_document' ? 'Written Warning' : 'Prior Record';
        const dateStr = h.documentDate ? ` (${h.documentDate})` : '';
        const employeeStr = h.employeeName ? ` - ${h.employeeName}` : '';
        return `${typeLabel}${dateStr}${employeeStr}:\n${h.summary}`;
      }).join('\n\n');
      priorHistoryContext = `\n\nPRIOR HISTORY/RECORDS:\n${historyItems}\n\nNote: This prior history should be considered as context for the current incident. Look for patterns of behavior, escalation, or recurring issues.`;
    }
    
    const systemPrompt = `You are a senior Human Resources professional with 20+ years of experience in workplace conflict resolution, employee relations, and organizational behavior. You have handled hundreds of workplace disputes and have developed keen insight into human dynamics, communication patterns, and the underlying factors that contribute to workplace conflicts.

YOUR APPROACH:
- You analyze situations like a seasoned professional, not a robot
- You use the employees' actual names throughout your analysis - never "Party A" or "Party B"
- You provide genuine insight, not just surface-level observations
- You identify patterns, underlying tensions, and communication breakdowns
- You notice what's NOT being said as much as what IS being said
- You understand workplace dynamics, power imbalances, and interpersonal friction
- You write professionally but with warmth - as if briefing a colleague
- You provide actionable observations that help supervisors understand the full picture

IMPORTANT BOUNDARIES:
- You NEVER determine guilt or innocence
- You NEVER accuse anyone of lying
- You present discrepancies as "different perspectives" not "one person is wrong"
- You remain neutral while still being insightful
- You note concerns without making accusations

Your analysis should feel like advice from a trusted HR mentor - thoughtful, nuanced, and genuinely helpful.`;

    const userPrompt = `I need your expert analysis of a workplace incident. Please review both statements carefully and provide your professional assessment.

INCIDENT DETAILS:
- Date: ${caseDetails.incidentDate}
- Location: ${caseDetails.location}
- Department: ${caseDetails.department}

STATEMENT FROM ${nameA.toUpperCase()}:
"${textA}"

STATEMENT FROM ${nameB.toUpperCase()}:
"${textB}"${witnessContext}${priorHistoryContext}

Please provide your analysis in JSON format. Remember to use "${nameA}" and "${nameB}" by name throughout - never use generic terms like "Party A" or "Party B".

{
  "timelineDifferences": [
    "Describe specific timing discrepancies you've identified. Use their names. Example: '${nameA} places the conversation at around 10:30 AM, while ${nameB} recalls it happening closer to lunch, around 11:45 AM. This 75-minute gap is significant and worth clarifying.'"
  ],
  "agreementPoints": [
    "Identify what both employees agree on - these are your foundation facts. Use their names. Example: 'Both ${nameA} and ${nameB} confirm that the interaction took place near the loading dock, and both acknowledge that voices were raised at some point.'"
  ],
  "contradictions": [
    "Describe key points where their accounts directly conflict. Present both versions WITH CONTEXT about why this matters. Use their names. Example: '${nameA} states that ${nameB} approached them first, while ${nameB} describes being called over by ${nameA}. Who initiated the interaction often sets the tone for what follows, making this an important point to clarify.'"
  ],
  "emotionalLanguage": [
    "Note emotional indicators in their language that reveal how they're feeling about this situation. Provide professional insight. Example: '${nameA} uses phrases like \"always does this\" and \"never listens\" - this pattern of absolute language suggests this may not be an isolated incident from their perspective, and there could be underlying frustration building over time.'"
  ],
  "missingDetails": [
    "Identify gaps in the narrative that a thorough investigation should address. Be specific about WHY these details matter. Example: 'Neither statement mentions whether other team members witnessed the exchange. Given that this occurred during shift change, it's likely others were present - their perspectives could provide valuable context.'"
  ],
  "neutralSummary": "Write a 3-4 paragraph executive summary as if you're briefing a senior manager. Start with what we know happened (the common ground). Then describe where the accounts diverge and what that might indicate about the situation. Discuss any patterns or underlying dynamics you've observed. End with specific recommendations for what the supervisor should explore further. Use ${nameA} and ${nameB}'s names throughout. Write naturally, as a professional would speak.",
  "sideBySideComparison": [
    {
      "topic": "A clear, specific aspect of the incident (e.g., 'Who initiated the conversation', 'Tone of the exchange', 'What was said about the deadline')",
      "partyAVersion": "${nameA}'s perspective on this specific point, in your professional summary (not a direct quote)",
      "partyBVersion": "${nameB}'s perspective on this specific point, in your professional summary (not a direct quote)", 
      "status": "agreement|contradiction|partial|unclear"
    }
  ]
}

QUALITY STANDARDS:
- Write as a human professional, not a template-filling machine
- Each bullet point should contain genuine insight, not just restated facts
- Use ${nameA} and ${nameB}'s names - NEVER say "Party A" or "Party B"
- The summary should read like a professional briefing, not a form response
- Identify 4-6 comparison points that matter most for understanding this situation
- If something seems significant, explain WHY it matters
- Consider workplace dynamics, communication patterns, and what's left unsaid`;

    console.log('Conflict Analysis: Starting comparison...');
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 6000,
      temperature: 0.5, // Balanced for natural, professional responses
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
