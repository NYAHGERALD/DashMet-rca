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

// Risk levels for recommendations
type RiskLevel = 'low' | 'moderate' | 'high' | 'critical';

interface RecommendationOption {
  id: string;
  type: 'coaching' | 'counseling' | 'warning' | 'escalate';
  title: string;
  description: string;
  rationale: string;
  riskLevel: RiskLevel;
  riskExplanation: string;
  nextSteps: string[];
  timeframe: string;
  confidence: number;
  targetEmployeeNames: string[];  // Which employees this recommendation applies to
}

interface RecommendationRequest {
  caseDetails: {
    caseType: string;
    incidentDate: string;
    location: string;
    department: string;
  };
  complaintA: {
    employeeName: string;
    employeeId?: string;  // Optional employee ID for tracking
    text: string;
  };
  complaintB: {
    employeeName: string;
    employeeId?: string;  // Optional employee ID for tracking
    text: string;
  };
  analysisResult?: {
    contradictions: string[];
    agreementPoints: string[];
    neutralSummary: string;
    emotionalLanguage?: string[];
  };
  policyMatches?: Array<{
    sectionTitle: string;
    relevanceExplanation: string;
    matchConfidence: number;
  }>;
  witnessStatements?: Array<{
    witnessName: string;
    text: string;
  }>;
  priorHistory?: {
    hasPriorComplaints: boolean;
    hasPriorCounseling: boolean;
    hasPriorWarnings: boolean;
    notes?: string;
  };
}

/**
 * Generate AI-powered recommendations for case resolution
 * POST /api/decision-support/recommendations
 */
router.post('/recommendations', async (req: Request, res: Response) => {
  try {
    const {
      caseDetails,
      complaintA,
      complaintB,
      analysisResult,
      policyMatches,
      witnessStatements,
      priorHistory
    } = req.body as RecommendationRequest;

    if (!caseDetails || !complaintA || !complaintB) {
      return res.status(400).json({
        error: 'Case details and both complaints are required'
      });
    }

    const openai = getOpenAIClient();
    if (!openai) {
      return res.status(503).json({
        error: 'AI service unavailable',
        message: 'OpenAI API key not configured. Please contact your administrator.'
      });
    }

    // Build context sections
    let witnessContext = '';
    if (witnessStatements && witnessStatements.length > 0) {
      witnessContext = `\n\nWITNESS ACCOUNTS:\n${witnessStatements.map(w =>
        `${w.witnessName}: "${w.text}"`
      ).join('\n')}`;
    }

    let analysisContext = '';
    if (analysisResult) {
      analysisContext = `\n\nANALYSIS FINDINGS:
Key Contradictions: ${analysisResult.contradictions.slice(0, 4).join('; ')}
Agreement Points: ${analysisResult.agreementPoints.slice(0, 4).join('; ')}
Emotional Language Detected: ${analysisResult.emotionalLanguage?.slice(0, 3).join('; ') || 'None noted'}
Summary: ${analysisResult.neutralSummary.substring(0, 600)}`;
    }

    let policyContext = '';
    if (policyMatches && policyMatches.length > 0) {
      policyContext = `\n\nRELEVANT POLICY SECTIONS:
${policyMatches.slice(0, 4).map(p =>
        `- ${p.sectionTitle} (${Math.round(p.matchConfidence * 100)}% relevance): ${p.relevanceExplanation.substring(0, 200)}`
      ).join('\n')}`;
    }

    let historyContext = '';
    if (priorHistory) {
      const historyItems: string[] = [];
      if (priorHistory.hasPriorComplaints) historyItems.push('Prior complaints exist between these employees');
      if (priorHistory.hasPriorCounseling) historyItems.push('Previous counseling documented');
      if (priorHistory.hasPriorWarnings) historyItems.push('Previous warnings issued');
      if (historyItems.length > 0) {
        historyContext = `\n\nPRIOR HISTORY:\n${historyItems.join('\n')}${priorHistory.notes ? `\nNotes: ${priorHistory.notes}` : ''}`;
      }
    }

    const systemPrompt = `You are a senior HR Director with 25+ years of experience in employee relations, workplace investigations, and conflict resolution. You specialize in providing balanced, legally-sound recommendations that protect both employees and the organization.

YOUR APPROACH:
- You consider ALL evidence before making recommendations
- You weigh the severity of the situation against proportionate response
- You factor in prior history when relevant
- You consider the organizational culture and relationship dynamics
- You recommend the LEAST punitive effective action that addresses the situation
- You always explain your reasoning in clear, professional language

RECOMMENDATION OPTIONS (in order of severity):

1. COACHING - Informal guidance session
   - Use when: Minor issues, first occurrence, misunderstanding, low severity
   - Goal: Course correction through conversation
   - Outcome: No formal documentation in employee file

2. DOCUMENTED COUNSELING - Formal discussion with written record
   - Use when: Moderate issues, pattern emerging, needs documented follow-up
   - Goal: Address behavior with accountability
   - Outcome: Documentation in employee file, improvement plan

3. WRITTEN WARNING - Formal disciplinary action
   - Use when: Serious policy violation, repeated issues despite counseling
   - Goal: Final opportunity before termination consideration
   - Outcome: Official warning with consequences for future violations

4. ESCALATE TO HR - Refer to HR for formal investigation/action
   - Use when: Severe allegations, potential legal implications, complex situations
   - Goal: Ensure proper investigation procedures and organizational protection
   - Outcome: HR takes ownership of further process

CRITICAL PRINCIPLES:
- NEVER suggest termination at this level - that's an HR decision
- DO NOT determine guilt - provide options based on the information available
- ALWAYS consider proportionality
- ALWAYS use employee names, never "Party A/B"
- Present recommendations as OPTIONS for the supervisor to choose`;

    const userPrompt = `Please analyze this workplace incident and provide recommendation options for the supervisor.

INCIDENT DETAILS:
- Type: ${caseDetails.caseType}
- Date: ${caseDetails.incidentDate}
- Location: ${caseDetails.location}
- Department: ${caseDetails.department}

${complaintA.employeeName.toUpperCase()}'S STATEMENT:
"${complaintA.text}"

${complaintB.employeeName.toUpperCase()}'S STATEMENT:
"${complaintB.text}"${witnessContext}${analysisContext}${policyContext}${historyContext}

Please provide 3-4 recommendation options, ordered from least to most severe. The supervisor will make the final decision.

IMPORTANT: For each recommendation, specify EXACTLY which employee(s) the action should be applied to based on your assessment. The employees are: "${complaintA.employeeName}" and "${complaintB.employeeName}". Be specific - if only one employee needs action, list only that one. If both need the same action, list both.

Respond in JSON format:
{
  "recommendations": [
    {
      "id": "option_a",
      "type": "coaching|counseling|warning|escalate",
      "title": "Brief action title including employee name(s) (e.g., 'Issue Written Warning to John Smith')",
      "description": "2-3 sentences describing what this action involves",
      "rationale": "3-4 sentences explaining why this option is appropriate for this situation. Be specific about what in the case supports this recommendation.",
      "riskLevel": "low|moderate|high|critical",
      "riskExplanation": "1-2 sentences explaining the risk level - what could happen if this path is chosen",
      "nextSteps": ["Step 1 for supervisor", "Step 2", "Step 3"],
      "timeframe": "e.g., 'Within 48 hours' or 'Complete within 2 weeks'",
      "confidence": 0.85,
      "targetEmployeeNames": ["${complaintA.employeeName}"] or ["${complaintB.employeeName}"] or ["${complaintA.employeeName}", "${complaintB.employeeName}"]
    }
  ],
  "primaryRecommendation": "option_a|option_b|option_c|option_d",
  "supervisorGuidance": "A professional paragraph advising the supervisor on how to approach this decision. Acknowledge complexity if present. Emphasize that the supervisor knows their team best and should use their judgment. Remind them that all options are valid based on the information available."
}

QUALITY STANDARDS:
- Confidence scores should reflect how clearly the evidence supports each option (0.5-1.0)
- Risk levels should be realistic and proportionate
- Next steps should be actionable and specific
- Always include at least one lower-severity option when appropriate`;

    console.log('Decision Support: Generating recommendations...');

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 5000,
      temperature: 0.4,
      response_format: { type: 'json_object' }
    });

    const content = completion.choices[0]?.message?.content || '';
    console.log('Decision Support: Received response, parsing...');

    try {
      const result = JSON.parse(content);
      
      // Employee names for inference
      const employeeNameA = complaintA.employeeName;
      const employeeNameB = complaintB.employeeName;

      // Helper to infer target employee from text if AI didn't specify
      const inferTargetFromText = (title: string, description: string): string[] => {
        const text = `${title} ${description}`.toLowerCase();
        const targets: string[] = [];
        
        // Check if employee A's name appears in title/description
        if (employeeNameA && text.includes(employeeNameA.toLowerCase())) {
          targets.push(employeeNameA);
        }
        
        // Check if employee B's name appears in title/description
        if (employeeNameB && text.includes(employeeNameB.toLowerCase())) {
          targets.push(employeeNameB);
        }
        
        return targets;
      };

      // Validate and clean up recommendations
      const recommendations: RecommendationOption[] = (result.recommendations || [])
        .slice(0, 4)
        .map((r: any, index: number) => {
          // If AI provided targetEmployeeNames, use them
          let targetEmployeeNames: string[] = [];
          if (Array.isArray(r.targetEmployeeNames) && r.targetEmployeeNames.length > 0) {
            targetEmployeeNames = r.targetEmployeeNames;
          } else {
            // Try to infer from recommendation title/description
            targetEmployeeNames = inferTargetFromText(r.title || '', r.description || '');
            if (targetEmployeeNames.length > 0) {
              console.log(`Inferred target employees from text: ${targetEmployeeNames.join(', ')}`);
            }
          }
          
          return {
            id: r.id || `option_${String.fromCharCode(97 + index)}`,
            type: r.type || 'coaching',
            title: r.title || '',
            description: r.description || '',
            rationale: r.rationale || '',
            riskLevel: r.riskLevel || 'moderate',
            riskExplanation: r.riskExplanation || '',
            nextSteps: r.nextSteps || [],
            timeframe: r.timeframe || '',
            confidence: Math.min(1, Math.max(0, r.confidence || 0.7)),
            // Include target employees - inferred from title/description if not specified
            targetEmployeeNames
          };
        });

      return res.json({
        success: true,
        data: {
          recommendations,
          primaryRecommendation: result.primaryRecommendation || recommendations[0]?.id || '',
          supervisorGuidance: result.supervisorGuidance || '',
          generatedAt: new Date().toISOString(),
          // Include employee info for client-side ID matching
          employeeNames: {
            complaintA: complaintA.employeeName,
            complaintB: complaintB.employeeName
          }
        }
      });

    } catch (parseError) {
      console.error('Decision Support: Failed to parse JSON response', parseError);
      return res.status(500).json({
        error: 'Failed to parse recommendations',
        message: 'The AI returned an invalid response format'
      });
    }

  } catch (error: any) {
    console.error('Decision Support error:', error);
    return res.status(500).json({
      error: 'Recommendation generation failed',
      message: error.message || 'An error occurred during analysis'
    });
  }
});

/**
 * Health check endpoint
 * GET /api/decision-support/health
 */
router.get('/health', (req: Request, res: Response) => {
  const openai = getOpenAIClient();
  res.json({
    status: 'ok',
    aiAvailable: openai !== null
  });
});

export default router;
