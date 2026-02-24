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
// POST /api/policy-parsing/parse-sections
// AI-powered policy document parsing with disciplinary progressive action detection
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

    const systemPrompt = `You are an expert HR policy analyst. Your job is to parse workplace policy documents into structured, consistently formatted sections.

For EACH rule or section in the policy, you must:
1. Identify the rule/section number and title
2. Extract the full content/description of the rule
3. Identify the progressive disciplinary actions if they exist for that rule. Progressive discipline typically follows this hierarchy:
   - Verbal Warning (1st offense)
   - Written Warning (2nd offense)
   - Suspension (3rd offense)
   - Discharge/Termination (4th offense or severe violations)

Some rules may have different progressive steps (e.g., immediate discharge for severe violations, or only verbal + written warning for minor infractions). Capture exactly what the policy states.

4. Classify each section into one of these types: OVERVIEW, DEFINITIONS, GUIDELINES, PROCEDURES, VIOLATIONS, CONSEQUENCES, REPORTING, APPEALS, OTHER

5. Extract relevant keywords from each section (up to 10)

IMPORTANT:
- Format ALL sections consistently regardless of the original document format
- If the document doesn't specify progressive discipline for a section, set progressiveActions to an empty array
- If a rule says "immediate termination" or "immediate discharge", represent that as a single action
- Preserve the original meaning — do not invent disciplinary actions that aren't in the policy
- If the text is a general overview/introduction with no rules, still parse it as a section with no progressive actions

Return a JSON object with this exact structure:
{
  "sections": [
    {
      "sectionNumber": "1",
      "title": "Section Title",
      "content": "Full text content of this section...",
      "type": "VIOLATIONS",
      "keywords": ["keyword1", "keyword2"],
      "orderIndex": 0,
      "progressiveActions": [
        {
          "offense": "1st Offense",
          "action": "Verbal Warning",
          "description": "Optional additional details from the policy"
        },
        {
          "offense": "2nd Offense",
          "action": "Written Warning",
          "description": ""
        },
        {
          "offense": "3rd Offense",
          "action": "Suspension",
          "description": "3-day suspension without pay"
        },
        {
          "offense": "4th Offense",
          "action": "Discharge",
          "description": "Termination of employment"
        }
      ]
    }
  ],
  "summary": {
    "totalSections": 10,
    "sectionsWithDiscipline": 5,
    "policyType": "Employee Conduct Policy"
  }
}`;

    const userPrompt = `Parse the following workplace policy document${policyName ? ` titled "${policyName}"` : ''} into structured sections with progressive disciplinary actions:

---
${extractedText.substring(0, 30000)}
---

Return the structured JSON with all sections, their progressive disciplinary actions, and a summary.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 8000,
      temperature: 0.2,
      response_format: { type: 'json_object' },
    });

    const content = completion.choices[0]?.message?.content || '';
    const parsed = JSON.parse(content);

    // Validate and ensure each section has an id
    const sections = (parsed.sections || []).map((section: any, index: number) => ({
      id: `section-${Date.now()}-${index}`,
      sectionNumber: section.sectionNumber || `${index + 1}`,
      title: section.title || `Section ${index + 1}`,
      content: section.content || '',
      type: section.type || 'OTHER',
      keywords: Array.isArray(section.keywords) ? section.keywords : [],
      orderIndex: section.orderIndex ?? index,
      progressiveActions: Array.isArray(section.progressiveActions)
        ? section.progressiveActions.map((action: any) => ({
            offense: action.offense || '',
            action: action.action || '',
            description: action.description || '',
          }))
        : [],
    }));

    return res.json({
      success: true,
      data: {
        sections,
        summary: parsed.summary || {
          totalSections: sections.length,
          sectionsWithDiscipline: sections.filter((s: any) => s.progressiveActions.length > 0).length,
          policyType: policyName || 'Workplace Policy',
        },
        parsedAt: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error('Error parsing policy with AI:', error);

    // If it's a JSON parse error from GPT response, give specific message
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
