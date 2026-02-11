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

// Action types
type ActionType = 'coaching' | 'counseling' | 'warning' | 'escalate';

interface ActionGenerationRequest {
  actionType: ActionType;
  caseDetails: {
    caseNumber: string;
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
  policyMatches?: Array<{
    sectionNumber: string;
    sectionTitle: string;
    relevanceExplanation: string;
  }>;
  recommendationRationale?: string;
  supervisorName?: string;
}

// Response structures for each action type
interface CoachingDocument {
  title: string;
  overview: string;
  discussionOutline: {
    opening: string;
    keyPoints: string[];
    transitionStatements: string[];
  };
  talkingPoints: string[];
  questionsToAsk: string[];
  behavioralFocusAreas: {
    area: string;
    description: string;
    expectedChange: string;
  }[];
  followUpPlan: {
    timeline: string;
    checkInDates: string[];
    successIndicators: string[];
  };
}

interface CounselingDocument {
  title: string;
  documentDate: string;
  employeeNames: string[];
  incidentSummary: string;
  discussionPoints: string[];
  expectations: string[];
  policyReferences: string[];
  improvementPlan: {
    goals: string[];
    timeline: string;
    supportProvided: string[];
  };
  consequences: string;
  acknowledgmentSection: string;
}

interface WarningDocument {
  title: string;
  documentDate: string;
  employeeNames: string[];
  warningLevel: string;
  incidentDescription: string;
  policyViolations: string[];
  priorActions: string;
  expectations: string[];
  consequences: string;
  improvementRequired: string[];
  reviewDate: string;
  signatureSection: {
    employeeAcknowledgment: string;
    supervisorStatement: string;
    hrReviewStatement: string;
  };
}

interface EscalationDocument {
  title: string;
  documentDate: string;
  preparedBy: string;
  caseSummary: {
    caseNumber: string;
    caseType: string;
    incidentDate: string;
    location: string;
    department: string;
  };
  involvedParties: {
    name: string;
    role: string;
    summary: string;
  }[];
  incidentTimeline: {
    date: string;
    event: string;
  }[];
  evidenceSummary: string[];
  policyReferences: {
    section: string;
    relevance: string;
  }[];
  analysisFindings: string[];
  supervisorNotes: string;
  recommendedActions: string[];
  urgencyLevel: string;
  requestedHRActions: string[];
}

/**
 * Generate action documentation based on selected recommendation
 * POST /api/action-generation/generate
 */
router.post('/generate', async (req: Request, res: Response) => {
  try {
    const {
      actionType,
      caseDetails,
      complaintA,
      complaintB,
      analysisResult,
      policyMatches,
      recommendationRationale,
      supervisorName
    } = req.body as ActionGenerationRequest;

    if (!actionType || !caseDetails || !complaintA || !complaintB) {
      return res.status(400).json({
        error: 'Action type, case details, and both complaints are required'
      });
    }

    const openai = getOpenAIClient();
    if (!openai) {
      return res.status(503).json({
        error: 'AI service unavailable',
        message: 'OpenAI API key not configured. Please contact your administrator.'
      });
    }

    // Build context
    let analysisContext = '';
    if (analysisResult) {
      analysisContext = `\n\nANALYSIS FINDINGS:
Key Contradictions: ${analysisResult.contradictions.slice(0, 3).join('; ')}
Agreement Points: ${analysisResult.agreementPoints.slice(0, 3).join('; ')}
Summary: ${analysisResult.neutralSummary.substring(0, 500)}`;
    }

    let policyContext = '';
    if (policyMatches && policyMatches.length > 0) {
      policyContext = `\n\nRELEVANT POLICY SECTIONS:
${policyMatches.slice(0, 4).map(p =>
        `- Section ${p.sectionNumber}: ${p.sectionTitle} - ${p.relevanceExplanation.substring(0, 150)}`
      ).join('\n')}`;
    }

    const baseContext = `CASE DETAILS:
- Case Number: ${caseDetails.caseNumber}
- Type: ${caseDetails.caseType}
- Date: ${caseDetails.incidentDate}
- Location: ${caseDetails.location}
- Department: ${caseDetails.department}

${complaintA.employeeName.toUpperCase()}'S STATEMENT:
"${complaintA.text.substring(0, 800)}"

${complaintB.employeeName.toUpperCase()}'S STATEMENT:
"${complaintB.text.substring(0, 800)}"${analysisContext}${policyContext}

${recommendationRationale ? `RECOMMENDATION RATIONALE:\n${recommendationRationale}\n` : ''}`;

    let systemPrompt = '';
    let userPrompt = '';
    let responseFormat = '';

    switch (actionType) {
      case 'coaching':
        systemPrompt = `You are an expert HR coach specializing in constructive workplace conversations. You help supervisors prepare for informal coaching sessions that address workplace issues while maintaining positive relationships.

YOUR APPROACH:
- Create conversation guides that are supportive, not punitive
- Focus on behaviors and situations, not personalities
- Provide specific, actionable talking points
- Use neutral, professional language
- Emphasize growth and improvement
- Include open-ended questions that encourage dialogue`;

        userPrompt = `${baseContext}

Generate a comprehensive COACHING SESSION GUIDE for the supervisor to use when meeting with ${complaintA.employeeName} and ${complaintB.employeeName}.

Respond in JSON format:
{
  "title": "Coaching Session Guide - [Brief topic]",
  "overview": "1-2 paragraph overview of the coaching session's purpose and approach",
  "discussionOutline": {
    "opening": "How to open the conversation positively",
    "keyPoints": ["Key point 1 to address", "Key point 2", "Key point 3"],
    "transitionStatements": ["Phrases to use when moving between topics"]
  },
  "talkingPoints": [
    "Specific talking point using ${complaintA.employeeName}'s name where relevant",
    "Talking point for ${complaintB.employeeName}",
    "More talking points (5-7 total)"
  ],
  "questionsToAsk": [
    "Open-ended question 1?",
    "Question 2?",
    "Question 3?",
    "4-6 questions total"
  ],
  "behavioralFocusAreas": [
    {
      "area": "Focus area name",
      "description": "What needs to change",
      "expectedChange": "What success looks like"
    }
  ],
  "followUpPlan": {
    "timeline": "Suggested follow-up timeline (e.g., '2 weeks')",
    "checkInDates": ["Suggested check-in 1", "Check-in 2"],
    "successIndicators": ["How to measure improvement"]
  }
}`;
        break;

      case 'counseling':
        systemPrompt = `You are an HR documentation specialist who creates professional counseling documentation. Your documents are objective, factual, and focused on improvement while protecting both the employee and organization.

YOUR APPROACH:
- Use objective, neutral language throughout
- Document facts, not opinions or emotions
- Include clear expectations and timelines
- Reference policies when applicable
- Create actionable improvement plans
- Ensure document is suitable for employee files`;

        userPrompt = `${baseContext}

Generate a FORMAL COUNSELING DOCUMENT for this workplace incident involving ${complaintA.employeeName} and ${complaintB.employeeName}.

Respond in JSON format:
{
  "title": "Employee Counseling Documentation",
  "documentDate": "${new Date().toISOString().split('T')[0]}",
  "employeeNames": ["${complaintA.employeeName}", "${complaintB.employeeName}"],
  "incidentSummary": "3-4 sentence objective summary of the incident",
  "discussionPoints": [
    "Point discussed with employees (5-6 points)",
    "Another discussion point"
  ],
  "expectations": [
    "Clear expectation 1",
    "Clear expectation 2",
    "3-5 expectations total"
  ],
  "policyReferences": [
    "Relevant policy reference if applicable",
    "Another policy reference"
  ],
  "improvementPlan": {
    "goals": ["Specific improvement goal 1", "Goal 2"],
    "timeline": "Timeline for improvement (e.g., '30 days')",
    "supportProvided": ["Support the company will provide"]
  },
  "consequences": "Statement about potential consequences if improvement is not achieved",
  "acknowledgmentSection": "Standard acknowledgment text for employee signature"
}`;
        break;

      case 'warning':
        systemPrompt = `You are an HR compliance expert who drafts formal written warnings. Your documents are legally sound, professionally worded, and clearly communicate the seriousness of the situation while maintaining fairness.

YOUR APPROACH:
- Use formal, professional language
- Clearly state the company rules violated
- Document the incident objectively and in detail
- Specify the conduct deficiency clearly
- Define required corrective actions
- State consequences of not performing
- Ensure document meets HR standards`;

        userPrompt = `${baseContext}

Generate a FORMAL WRITTEN WARNING DOCUMENT for this workplace incident involving ${complaintA.employeeName} and ${complaintB.employeeName}.

Respond in JSON format:
{
  "title": "Written Warning Notice",
  "documentDate": "${new Date().toISOString().split('T')[0]}",
  "employeeNames": ["${complaintA.employeeName}", "${complaintB.employeeName}"],
  "warningLevel": "First Written Warning / Final Written Warning",
  "companyRulesViolated": [
    "Specific company rule or policy violated",
    "Another rule/policy if applicable"
  ],
  "describeInDetail": "Detailed, objective description of what happened. Include dates, times, locations, and specific behaviors observed or reported. This should be a thorough account of the incident (3-5 paragraphs).",
  "conductDeficiency": "Clear statement of the specific conduct deficiency. What behavior or action fell below company standards? Be specific about the gap between expected and actual conduct.",
  "requiredCorrectiveAction": [
    "Specific corrective action required 1",
    "Specific corrective action required 2",
    "Additional actions as needed (3-5 total)"
  ],
  "consequencesOfNotPerforming": "Clear statement of consequences if corrective action is not taken and improvement is not demonstrated. Include potential progressive discipline steps.",
  "reviewDate": "Date for formal review (typically 30-90 days)",
  "priorActions": "Statement about any prior coaching or counseling (or 'No prior formal actions documented')",
  "signatureSection": {
    "employeeAcknowledgment": "I acknowledge receipt of this warning. My signature does not necessarily indicate agreement with its contents, but confirms I have received and understand this document.",
    "supervisorStatement": "I have discussed this matter with the employee(s) and provided them with a copy of this warning.",
    "hrReviewStatement": "This warning has been reviewed and approved by Human Resources."
  }
}`;
        break;

      case 'escalate':
        systemPrompt = `You are a senior HR investigator who prepares comprehensive case packages for HR escalation. Your documents provide complete context for HR to take appropriate action.

YOUR APPROACH:
- Compile all relevant information systematically
- Present facts objectively and chronologically
- Summarize evidence clearly
- Reference all applicable policies
- Provide clear supervisor observations
- Request specific HR actions`;

        userPrompt = `${baseContext}

Generate a COMPREHENSIVE HR ESCALATION PACKAGE for this case. The supervisor${supervisorName ? ` (${supervisorName})` : ''} is requesting HR intervention.

Respond in JSON format:
{
  "title": "HR Escalation Request - Case ${caseDetails.caseNumber}",
  "documentDate": "${new Date().toISOString().split('T')[0]}",
  "preparedBy": "${supervisorName || 'Supervisor'}",
  "caseSummary": {
    "caseNumber": "${caseDetails.caseNumber}",
    "caseType": "${caseDetails.caseType}",
    "incidentDate": "${caseDetails.incidentDate}",
    "location": "${caseDetails.location}",
    "department": "${caseDetails.department}"
  },
  "involvedParties": [
    {
      "name": "${complaintA.employeeName}",
      "role": "Complainant/Involved Party",
      "summary": "Brief summary of their involvement"
    },
    {
      "name": "${complaintB.employeeName}",
      "role": "Complainant/Involved Party",
      "summary": "Brief summary of their involvement"
    }
  ],
  "incidentTimeline": [
    {"date": "Date", "event": "Event description"},
    {"date": "Date", "event": "Another event"}
  ],
  "evidenceSummary": [
    "Summary of complaint A",
    "Summary of complaint B",
    "Other evidence noted"
  ],
  "policyReferences": [
    {"section": "Policy section number/title", "relevance": "Why this policy may apply"}
  ],
  "analysisFindings": [
    "Key finding 1 from analysis",
    "Key finding 2",
    "3-5 findings"
  ],
  "supervisorNotes": "Supervisor's observations and concerns about why this needs HR escalation (2-3 paragraphs)",
  "recommendedActions": [
    "Recommended action for HR to consider",
    "Another recommendation"
  ],
  "urgencyLevel": "Standard / High / Urgent",
  "requestedHRActions": [
    "Specific action requested from HR",
    "Another requested action"
  ]
}`;
        break;

      default:
        return res.status(400).json({
          error: 'Invalid action type',
          message: 'Action type must be: coaching, counseling, warning, or escalate'
        });
    }

    console.log(`Action Generation: Creating ${actionType} document...`);

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
    console.log('Action Generation: Received response, parsing...');

    try {
      const document = JSON.parse(content);

      return res.json({
        success: true,
        data: {
          actionType,
          document,
          generatedAt: new Date().toISOString(),
          isEditable: true
        }
      });

    } catch (parseError) {
      console.error('Action Generation: Failed to parse JSON response', parseError);
      return res.status(500).json({
        error: 'Failed to parse generated document',
        message: 'The AI returned an invalid response format'
      });
    }

  } catch (error: any) {
    console.error('Action Generation error:', error);
    return res.status(500).json({
      error: 'Document generation failed',
      message: error.message || 'An error occurred during generation'
    });
  }
});

/**
 * Health check endpoint
 * GET /api/action-generation/health
 */
router.get('/health', (req: Request, res: Response) => {
  const openai = getOpenAIClient();
  res.json({
    status: 'ok',
    aiAvailable: openai !== null
  });
});

export default router;
