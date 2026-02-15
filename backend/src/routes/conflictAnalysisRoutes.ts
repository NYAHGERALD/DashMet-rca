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
  // Dynamic fields based on evidence provided
  witnessAnalysis?: string[];
  priorHistoryAnalysis?: string[];
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
    
    // Track what additional evidence we have
    const hasWitnesses = witnessStatements && witnessStatements.length > 0;
    const hasPriorHistory = priorHistory && priorHistory.length > 0;
    
    console.log(`📋 Analysis request - Witnesses: ${witnessStatements?.length || 0}, Prior History: ${priorHistory?.length || 0}`);
    
    // Build witness context if available
    let witnessContext = '';
    if (hasWitnesses) {
      witnessContext = `\n\n═══════════════════════════════════════════════════════════════
WITNESS ACCOUNTS (${witnessStatements.length} statement${witnessStatements.length > 1 ? 's' : ''})
═══════════════════════════════════════════════════════════════
${witnessStatements.map((w, i) => 
        `WITNESS ${i+1}: ${w.witnessName}
Statement: "${w.text}"`
      ).join('\n\n')}

IMPORTANT: You MUST analyze these witness statements and incorporate their perspectives into your analysis. Consider:
- Do witnesses corroborate either party's account?
- Do witnesses provide additional details not mentioned by the complainants?
- Are there any contradictions between witness accounts and the main statements?`;
    }
    
    // Build prior history context if available
    let priorHistoryContext = '';
    if (hasPriorHistory) {
      const historyItems = priorHistory.map(h => {
        const typeLabel = h.type === 'prior_complaint' ? 'Prior Complaint' :
                          h.type === 'counseling_record' ? 'Counseling Record' :
                          h.type === 'warning_document' ? 'Written Warning' : 'Prior Record';
        const dateStr = h.documentDate ? ` (${h.documentDate})` : '';
        const employeeStr = h.employeeName ? ` involving ${h.employeeName}` : '';
        return `📄 ${typeLabel}${dateStr}${employeeStr}:\n${h.summary}`;
      }).join('\n\n');
      priorHistoryContext = `\n\n═══════════════════════════════════════════════════════════════
PRIOR HISTORY/RECORDS (${priorHistory.length} document${priorHistory.length > 1 ? 's' : ''})
═══════════════════════════════════════════════════════════════
${historyItems}

CRITICAL: This prior history MUST be incorporated into your analysis. Consider:
- Does this history show a pattern of behavior?
- Is this incident an escalation of previous issues?
- How does this context affect your assessment of the current situation?`;
    }
    
    // Build dynamic evidence section for the prompt
    let evidenceInstruction = '';
    if (hasWitnesses || hasPriorHistory) {
      evidenceInstruction = `\n\nADDITIONAL EVIDENCE TO ANALYZE:`;
      if (hasWitnesses) {
        evidenceInstruction += `\n- ${witnessStatements.length} WITNESS STATEMENT(S) - You MUST reference these in your analysis`;
      }
      if (hasPriorHistory) {
        evidenceInstruction += `\n- ${priorHistory.length} PRIOR HISTORY DOCUMENT(S) - You MUST reference these in your analysis`;
      }
      evidenceInstruction += `\n\nYour analysis MUST explicitly discuss all provided evidence. Do NOT say "no witnesses" if witness statements are provided above.`;
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
- When witness statements are provided, you MUST analyze them and reference them explicitly
- When prior history documents are provided, you MUST incorporate them into your analysis

IMPORTANT BOUNDARIES:
- You NEVER determine guilt or innocence
- You NEVER accuse anyone of lying
- You present discrepancies as "different perspectives" not "one person is wrong"
- You remain neutral while still being insightful
- You note concerns without making accusations

Your analysis should feel like advice from a trusted HR mentor - thoughtful, nuanced, and genuinely helpful.`;

    // Build dynamic JSON schema based on available evidence
    let witnessAnalysisField = '';
    let priorHistoryAnalysisField = '';
    let witnessInstruction = '';
    let priorHistoryInstruction = '';
    
    if (hasWitnesses) {
      witnessAnalysisField = `,
  "witnessAnalysis": [
    "Analyze each witness statement provided above. For each witness, explain: What do they corroborate? What new details do they add? Do they contradict either party? Example: 'Witness [Name] confirms that ${nameA} was present at the location. Their account supports ${nameB}'s timeline but adds that there was a 5-minute gap before the altercation.'"
  ]`;
      witnessInstruction = `\n\nWITNESS ANALYSIS REQUIRED: ${witnessStatements.length} witness statement(s) have been provided above. You MUST:
- Reference each witness by name
- Explain what their statement corroborates or contradicts
- Include their perspectives in the neutralSummary
- Do NOT say "no witnesses" or suggest gathering witness statements if they are already provided`;
    }
    
    if (hasPriorHistory) {
      priorHistoryAnalysisField = `,
  "priorHistoryAnalysis": [
    "Analyze the prior history documents provided above. Explain how they relate to the current incident. Look for patterns, escalation, or context that affects your assessment. Example: 'A prior counseling record from 3 months ago shows ${nameA} received feedback about communication issues. This context suggests the current incident may be part of an ongoing pattern.'"
  ]`;
      priorHistoryInstruction = `\n\nPRIOR HISTORY ANALYSIS REQUIRED: ${priorHistory.length} prior history document(s) have been provided above. You MUST:
- Reference each document and its type (warning, counseling record, prior complaint)
- Explain how the history relates to the current incident
- Identify any patterns of behavior or escalation
- Include this context in the neutralSummary`;
    }

    const userPrompt = `I need your expert analysis of a workplace incident. Please review both statements carefully and provide your professional assessment.

INCIDENT DETAILS:
- Date: ${caseDetails.incidentDate}
- Location: ${caseDetails.location}
- Department: ${caseDetails.department}

STATEMENT FROM ${nameA.toUpperCase()}:
"${textA}"

STATEMENT FROM ${nameB.toUpperCase()}:
"${textB}"${witnessContext}${priorHistoryContext}${evidenceInstruction}

Please provide your analysis in JSON format. Remember to use "${nameA}" and "${nameB}" by name throughout - never use generic terms like "Party A" or "Party B".${witnessInstruction}${priorHistoryInstruction}

{
  "timelineDifferences": [
    "Describe specific timing discrepancies you've identified. Use their names."
  ],
  "agreementPoints": [
    "Identify what both employees agree on - these are your foundation facts. Use their names."
  ],
  "contradictions": [
    "Describe key points where their accounts directly conflict. Present both versions WITH CONTEXT about why this matters. Use their names."
  ],
  "emotionalLanguage": [
    "Note emotional indicators in their language that reveal how they're feeling about this situation. Provide professional insight."
  ],
  "missingDetails": [
    "Identify gaps in the narrative that still need investigation. If witnesses or prior history were provided, focus on what ADDITIONAL information is still needed beyond what was already provided."
  ]${witnessAnalysisField}${priorHistoryAnalysisField},
  "neutralSummary": "Write a 3-4 paragraph executive summary. IMPORTANT: If witness statements were provided, you MUST discuss what the witnesses observed. If prior history was provided, you MUST discuss how it provides context for this incident. Start with what we know happened (the common ground). Then describe where the accounts diverge. If witnesses were provided, discuss their perspectives. If prior history exists, explain how it relates to the current incident. End with specific recommendations. Use ${nameA} and ${nameB}'s names throughout.",
  "sideBySideComparison": [
    {
      "topic": "A clear, specific aspect of the incident",
      "partyAVersion": "${nameA}'s perspective on this specific point",
      "partyBVersion": "${nameB}'s perspective on this specific point", 
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
- If witness statements were provided above, you MUST reference them in your analysis - do NOT suggest gathering witnesses if statements are already included
- If prior history was provided above, you MUST incorporate it into your analysis and summary`;

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
