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

// ============================================================================
// SYSTEMATIC PROGRESSIVE DISCIPLINE CLASSIFICATION
// This runs AFTER AI parsing to ensure correct categorization.
// Uses keyword matching to guarantee each action is placed in the right column.
// ============================================================================

const VERBAL_KEYWORDS = ['verbal', 'verbal warning', 'oral', 'oral warning', 'counseling', 'coaching'];
const WRITTEN_KEYWORDS = ['written', 'written warning', 'written reprimand', 'written notice', 'letter of warning', 'formal warning'];
const SUSPENSION_KEYWORDS = ['suspension', 'suspend', 'suspended', 'unpaid leave', 'without pay', 'disciplinary leave', 'days off'];
const DISCHARGE_KEYWORDS = ['discharge', 'termination', 'terminate', 'terminated', 'dismissal', 'dismissed', 'fired', 'separation', 'end of employment', 'removal'];

function classifyProgression(actionText: string): 'first' | 'second' | 'third' | 'fourth' | null {
  const lower = actionText.toLowerCase().trim();

  // Check discharge/termination FIRST (highest severity)
  if (DISCHARGE_KEYWORDS.some(kw => lower.includes(kw))) return 'fourth';

  // Check suspension
  if (SUSPENSION_KEYWORDS.some(kw => lower.includes(kw))) return 'third';

  // Check written warning (before verbal, since "written" is more specific)
  if (WRITTEN_KEYWORDS.some(kw => lower.includes(kw))) return 'second';

  // Check verbal warning
  if (VERBAL_KEYWORDS.some(kw => lower.includes(kw))) return 'first';

  return null;
}

/**
 * Systematically extract and validate the 4 progressive discipline columns
 * from a section's progressive actions array.
 *
 * This is the authoritative classification — it overrides AI categorization
 * to ensure legal accuracy.
 */
function extractProgressionColumns(progressiveActions: any[]): {
  firstProgression: string | null;
  secondProgression: string | null;
  thirdProgression: string | null;
  fourthProgression: string | null;
} {
  const result = {
    firstProgression: null as string | null,
    secondProgression: null as string | null,
    thirdProgression: null as string | null,
    fourthProgression: null as string | null,
  };

  if (!Array.isArray(progressiveActions) || progressiveActions.length === 0) {
    return result;
  }

  for (const action of progressiveActions) {
    const actionText = (action.action || '').trim();
    const description = (action.description || '').trim();
    const fullText = description ? `${actionText} - ${description}` : actionText;

    if (!actionText) continue;

    const classification = classifyProgression(actionText);

    switch (classification) {
      case 'first':
        if (!result.firstProgression) result.firstProgression = fullText;
        break;
      case 'second':
        if (!result.secondProgression) result.secondProgression = fullText;
        break;
      case 'third':
        if (!result.thirdProgression) result.thirdProgression = fullText;
        break;
      case 'fourth':
        if (!result.fourthProgression) result.fourthProgression = fullText;
        break;
      default:
        // If we can't classify by keyword, use offense ordering as fallback
        const offense = (action.offense || '').toLowerCase();
        if (offense.includes('1st') || offense.includes('first')) {
          if (!result.firstProgression) result.firstProgression = fullText;
        } else if (offense.includes('2nd') || offense.includes('second')) {
          if (!result.secondProgression) result.secondProgression = fullText;
        } else if (offense.includes('3rd') || offense.includes('third')) {
          if (!result.thirdProgression) result.thirdProgression = fullText;
        } else if (offense.includes('4th') || offense.includes('fourth')) {
          if (!result.fourthProgression) result.fourthProgression = fullText;
        }
        break;
    }
  }

  return result;
}

// ============================================================================
// POST /api/policy-parsing/parse-sections
// AI-powered policy document parsing with 4-column progressive discipline
// ============================================================================

router.post('/parse-sections', async (req: Request, res: Response) => {
  try {
    const { extractedText, policyName } = req.body;

    if (!extractedText || typeof extractedText !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'extractedText is required and must be a string',
      });
    }

    const openai = getOpenAIClient();
    if (!openai) {
      return res.status(503).json({
        success: false,
        error: 'AI service is not configured',
      });
    }

    const systemPrompt = `You are an expert HR policy analyst specializing in workplace progressive discipline. Parse the policy into structured sections.

For EACH rule or section, identify:
1. The rule/section number and title
2. The full content/description
3. The progressive disciplinary actions. Look carefully for these 4 levels:
   - 1st Offense / First Progression: Usually a Verbal Warning, Oral Warning, Counseling, or Coaching
   - 2nd Offense / Second Progression: Usually a Written Warning, Written Reprimand, or Formal Warning
   - 3rd Offense / Third Progression: Usually a Suspension (with or without pay), Disciplinary Leave
   - 4th Offense / Fourth Progression: Usually Discharge, Termination, Dismissal, or Separation

CRITICAL RULES:
- Some rules may skip levels (e.g., immediate termination for severe violations)
- Some rules may have fewer than 4 levels — only include what the policy states
- NEVER invent or assume disciplinary actions not explicitly in the policy text
- If a section has NO disciplinary actions, return an empty progressiveActions array
- Preserve the EXACT wording from the policy document for each action

4. Section type: OVERVIEW, DEFINITIONS, GUIDELINES, PROCEDURES, VIOLATIONS, CONSEQUENCES, REPORTING, APPEALS, or OTHER

Return JSON:
{
  "sections": [
    {
      "sectionNumber": "1",
      "title": "Section Title",
      "content": "Full text content...",
      "type": "VIOLATIONS",
      "orderIndex": 0,
      "progressiveActions": [
        {"offense": "1st Offense", "action": "Verbal Warning", "description": ""},
        {"offense": "2nd Offense", "action": "Written Warning", "description": ""},
        {"offense": "3rd Offense", "action": "Suspension", "description": "3-day suspension without pay"},
        {"offense": "4th Offense", "action": "Discharge", "description": ""}
      ]
    }
  ],
  "summary": {
    "totalSections": 10,
    "sectionsWithDiscipline": 5,
    "policyType": "Employee Conduct Policy"
  }
}`;

    const userPrompt = `Parse this workplace policy document${policyName ? ` titled "${policyName}"` : ''} into structured sections. For every rule, identify the progressive disciplinary actions (verbal warning, written warning, suspension, discharge/termination):

---
${extractedText.substring(0, 30000)}
---

Return the structured JSON.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 8000,
      temperature: 0.1,
      response_format: { type: 'json_object' },
    });

    const content = completion.choices[0]?.message?.content || '';
    const parsed = JSON.parse(content);

    // Process each section: AI parsing + systematic code validation
    const sections = (parsed.sections || []).map((section: any, index: number) => {
      const progressiveActions = Array.isArray(section.progressiveActions)
        ? section.progressiveActions.map((action: any) => ({
            offense: action.offense || '',
            action: action.action || '',
            description: action.description || '',
          }))
        : [];

      // SYSTEMATIC CODE VALIDATION: Extract the 4 progression columns
      // This overrides AI categorization with keyword-based classification
      const progressions = extractProgressionColumns(progressiveActions);

      return {
        id: `section-${Date.now()}-${index}`,
        sectionNumber: section.sectionNumber || `${index + 1}`,
        title: section.title || `Section ${index + 1}`,
        content: section.content || '',
        type: section.type || 'OTHER',
        orderIndex: section.orderIndex ?? index,
        // The 4 progression columns — stored per section
        firstProgression: progressions.firstProgression,
        secondProgression: progressions.secondProgression,
        thirdProgression: progressions.thirdProgression,
        fourthProgression: progressions.fourthProgression,
      };
    });

    const sectionsWithDiscipline = sections.filter((s: any) =>
      s.firstProgression || s.secondProgression || s.thirdProgression || s.fourthProgression
    ).length;

    return res.json({
      success: true,
      data: {
        sections,
        summary: parsed.summary || {
          totalSections: sections.length,
          sectionsWithDiscipline,
          policyType: policyName || 'Workplace Policy',
        },
        parsedAt: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error('Error parsing policy with AI:', error);

    if (error instanceof SyntaxError) {
      return res.status(500).json({
        success: false,
        error: 'AI returned an invalid response. Please try again.',
      });
    }

    return res.status(500).json({
      success: false,
      error: 'Failed to parse policy document',
      details: error.message,
    });
  }
});

export default router;
