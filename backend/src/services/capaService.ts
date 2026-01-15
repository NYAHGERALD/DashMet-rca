/**
 * Phase 9: CAPA (Corrective & Preventive Action) Service
 * AI-powered quality analysis, weak action detection, and regulatory mapping
 */

import { ActionType, IncidentType } from '@prisma/client';
import OpenAI from 'openai';

// Lazy initialization of OpenAI client
function getOpenAIClient(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

// ============================================================================
// Types
// ============================================================================

export interface ActionQualityAnalysis {
  score: number; // 0-100
  rating: 'POOR' | 'FAIR' | 'GOOD' | 'EXCELLENT';
  weaknesses: string[];
  strengths: string[];
}

export interface WeaknessAnalysis {
  isWeak: boolean;
  flags: string[];
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  details: string[];
}

export interface ActionImprovement {
  currentIssue: string;
  suggestion: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
}

// ============================================================================
// Phase 9.2: AI Action Quality Review
// ============================================================================

/**
 * Analyze the quality of a CAPA action using AI or rule-based fallback
 */
export async function analyzeActionQuality(
  title: string,
  description: string,
  actionType: ActionType
): Promise<ActionQualityAnalysis> {
  const openai = getOpenAIClient();

  if (!openai) {
    return analyzeActionQualityFallback(title, description, actionType);
  }

  try {
    const completion = await openai.chat.completions.create({
      model: process.env.AI_MODEL || 'gpt-4',
      messages: [
        {
          role: 'system',
          content: `You are a practical workplace advisor who reviews action plans. Your job is to check if an action makes sense and can actually be done.

Think about it like a experienced supervisor would:
- Is this action clear enough that someone could actually do it?
- Does it make sense for fixing or preventing the problem?
- Is it realistic with normal workplace resources?
- Will someone know when it's done?

For ${actionType === 'CORRECTIVE' ? 'CORRECTIVE (fixing what happened)' : 'PREVENTIVE (stopping it from happening again)'} actions:
${actionType === 'CORRECTIVE' 
  ? '- Should clearly fix the immediate problem\n- Should be doable in a reasonable timeframe\n- Should have a clear end point'
  : '- Should stop the problem from happening again\n- Should be something that can be maintained long-term\n- Should include a way to check it\'s working'}

Be helpful and constructive - point out what's good and what could be clearer.

Respond in JSON format:
{
  "score": <0-100>,
  "rating": "<POOR|FAIR|GOOD|EXCELLENT>",
  "weaknesses": ["explain issues in simple words"],
  "strengths": ["explain good points in simple words"]
}`,
        },
        {
          role: 'user',
          content: `Analyze this ${actionType} action:
Title: ${title}
Description: ${description}`,
        },
      ],
      temperature: 0.3,
      max_completion_tokens: 500,
      response_format: { type: 'json_object' },
    });

    const response = completion.choices[0]?.message?.content || '';
    const analysis = JSON.parse(response);

    return {
      score: Math.min(100, Math.max(0, analysis.score)),
      rating: analysis.rating,
      weaknesses: analysis.weaknesses || [],
      strengths: analysis.strengths || [],
    };
  } catch (error) {
    console.error('AI action quality analysis failed:', error);
    return analyzeActionQualityFallback(title, description, actionType);
  }
}

/**
 * Rule-based fallback for action quality analysis
 */
function analyzeActionQualityFallback(
  title: string,
  description: string,
  actionType: ActionType
): ActionQualityAnalysis {
  const combined = `${title} ${description}`.toLowerCase();
  let score = 50;
  const weaknesses: string[] = [];
  const strengths: string[] = [];

  // Length checks
  if (title.length < 10) {
    score -= 10;
    weaknesses.push('Title is too brief');
  } else if (title.length >= 20) {
    score += 5;
    strengths.push('Descriptive title');
  }

  if (description.length < 50) {
    score -= 15;
    weaknesses.push('Description lacks detail');
  } else if (description.length >= 100) {
    score += 10;
    strengths.push('Comprehensive description');
  }

  // Specificity indicators
  const specificWords = ['will', 'by', 'within', 'using', 'through', 'implement', 'install', 'replace', 'update', 'train'];
  const specificCount = specificWords.filter(word => combined.includes(word)).length;
  if (specificCount >= 3) {
    score += 15;
    strengths.push('Contains specific action language');
  } else if (specificCount < 1) {
    score -= 10;
    weaknesses.push('Lacks specific action verbs');
  }

  // Measurability indicators
  const measurablePatterns = [
    /\d+\s*%/, // percentages
    /\d+\s*(days?|weeks?|hours?|minutes?)/, // time
    /\d+\s*(units?|pieces?|items?)/, // quantities
    /daily|weekly|monthly/, // frequency
  ];
  const hasMeasurable = measurablePatterns.some(pattern => pattern.test(combined));
  if (hasMeasurable) {
    score += 10;
    strengths.push('Includes measurable criteria');
  } else {
    score -= 5;
    weaknesses.push('No measurable success criteria');
  }

  // Vague/weak language indicators
  const vagueWords = ['try', 'maybe', 'possibly', 'could', 'might', 'consider', 'look at', 'check', 'review', 'evaluate'];
  const vagueCount = vagueWords.filter(word => combined.includes(word)).length;
  if (vagueCount >= 2) {
    score -= 15;
    weaknesses.push('Contains vague or non-committal language');
  }

  // Preventive vs corrective specific checks
  if (actionType === 'PREVENTIVE') {
    const preventiveWords = ['prevent', 'monitor', 'audit', 'procedure', 'training', 'system', 'process'];
    if (preventiveWords.some(word => combined.includes(word))) {
      score += 10;
      strengths.push('Addresses systemic prevention');
    } else {
      score -= 5;
      weaknesses.push('Missing preventive focus');
    }
  } else {
    const correctiveWords = ['fix', 'repair', 'replace', 'correct', 'resolve', 'eliminate'];
    if (correctiveWords.some(word => combined.includes(word))) {
      score += 10;
      strengths.push('Clear corrective action');
    }
  }

  // Clamp score
  score = Math.min(100, Math.max(0, score));

  // Determine rating
  let rating: 'POOR' | 'FAIR' | 'GOOD' | 'EXCELLENT';
  if (score >= 80) rating = 'EXCELLENT';
  else if (score >= 60) rating = 'GOOD';
  else if (score >= 40) rating = 'FAIR';
  else rating = 'POOR';

  return { score, rating, weaknesses, strengths };
}

// ============================================================================
// Phase 9.3: Weak Action Detection
// ============================================================================

/**
 * Detect weak or ineffective actions
 */
export async function detectWeakActions(
  title: string,
  description: string
): Promise<WeaknessAnalysis> {
  const combined = `${title} ${description}`.toLowerCase();
  const flags: string[] = [];
  const details: string[] = [];

  // Generic/vague patterns
  const vaguePatterns = [
    { pattern: /\b(check|review|look at|evaluate)\b(?!\s+and\s+(correct|fix|update))/, flag: 'VAGUE_ACTION', detail: 'Action verb is too vague - specify what happens after the check/review' },
    { pattern: /\b(improve|enhance|better)\b(?!\s+by)/, flag: 'UNSPECIFIC_IMPROVEMENT', detail: 'Improvement goal without specific method' },
    { pattern: /\btraining\b(?!\s+(on|for|about|regarding|in))/, flag: 'GENERIC_TRAINING', detail: 'Training mentioned without specific topic or scope' },
    { pattern: /\b(ensure|make sure)\b(?!\s+by)/, flag: 'VAGUE_ASSURANCE', detail: '"Ensure/Make sure" without specific mechanism' },
    { pattern: /\b(more|better|increase|decrease)\b(?!\s+\d)/, flag: 'NO_QUANTIFICATION', detail: 'Relative term without specific target' },
  ];

  for (const { pattern, flag, detail } of vaguePatterns) {
    if (pattern.test(combined)) {
      flags.push(flag);
      details.push(detail);
    }
  }

  // Check for missing components
  if (!/\b(by|within|before|until|deadline)\b/.test(combined) && !/\d{4}|\d{1,2}\/\d{1,2}/.test(combined)) {
    flags.push('NO_TIMELINE');
    details.push('No deadline or timeline specified');
  }

  if (!/\b(responsible|owner|assigned|lead|manager|supervisor)\b/.test(combined) && description.length > 50) {
    flags.push('NO_OWNERSHIP');
    details.push('Consider specifying who is responsible');
  }

  if (!/\b(verify|confirm|validate|measure|track|monitor)\b/.test(combined)) {
    flags.push('NO_VERIFICATION');
    details.push('No verification or success measurement method');
  }

  // Symptom vs root cause treatment
  const symptomWords = ['clean', 'wipe', 'remove', 'dispose', 'discard'];
  const rootCauseWords = ['prevent', 'eliminate', 'redesign', 'replace', 'update procedure', 'implement control'];
  const hasSymptomOnly = symptomWords.some(word => combined.includes(word)) && 
                          !rootCauseWords.some(word => combined.includes(word));
  if (hasSymptomOnly) {
    flags.push('SYMPTOM_TREATMENT');
    details.push('Appears to address symptom rather than root cause');
  }

  // Determine severity
  let severity: 'LOW' | 'MEDIUM' | 'HIGH';
  if (flags.length >= 4) severity = 'HIGH';
  else if (flags.length >= 2) severity = 'MEDIUM';
  else severity = 'LOW';

  return {
    isWeak: flags.length >= 2,
    flags,
    severity,
    details,
  };
}

/**
 * Suggest improvements for a CAPA action
 */
export async function suggestActionImprovements(
  title: string,
  description: string,
  actionType: ActionType,
  incidentType: IncidentType | string,
  categoryName: string
): Promise<ActionImprovement[]> {
  const openai = getOpenAIClient();

  if (!openai) {
    return suggestImprovementsFallback(title, description, actionType);
  }

  try {
    const completion = await openai.chat.completions.create({
      model: process.env.AI_MODEL || 'gpt-4',
      messages: [
        {
          role: 'system',
          content: `You are a helpful coworker giving friendly advice on how to improve an action plan. Speak in simple, everyday language like you're chatting with a colleague.

Look at the action and think:
- Is anything unclear that could confuse someone?
- Is there a simple way to make this better?
- What's missing that would help someone actually do this?
- Would a new employee understand what to do?

Give practical, realistic suggestions - things that can actually be done in a normal workplace. Don't suggest complicated solutions when simple ones work.

Respond in JSON format:
{
  "suggestions": [
    {
      "currentIssue": "Explain the problem in plain English",
      "suggestion": "Give a practical tip to fix it - like advice to a coworker",
      "priority": "HIGH|MEDIUM|LOW"
    }
  ]
}

Keep suggestions friendly and helpful, not critical or overwhelming. 2-4 suggestions is usually enough.`,
        },
        {
          role: 'user',
          content: `Help me improve this ${actionType === 'CORRECTIVE' ? 'fix-it' : 'prevention'} action for a ${incidentType === 'FOOD_SAFETY' ? 'food safety' : 'workplace'} issue (${categoryName}):

Action: ${title}
Details: ${description}`,
        },
      ],
      temperature: 0.4,
      max_completion_tokens: 600,
      response_format: { type: 'json_object' },
    });

    const response = completion.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(response);
    return parsed.suggestions || [];
  } catch (error) {
    console.error('AI improvement suggestions failed:', error);
    return suggestImprovementsFallback(title, description, actionType);
  }
}

function suggestImprovementsFallback(
  title: string,
  description: string,
  actionType: ActionType
): ActionImprovement[] {
  const combined = `${title} ${description}`.toLowerCase();
  const suggestions: ActionImprovement[] = [];

  // Check for vague verbs
  if (/\b(check|review|look at)\b/.test(combined)) {
    suggestions.push({
      currentIssue: 'Action uses vague verb (check/review)',
      suggestion: 'Replace with specific action: "Verify X is within Y tolerance and document results"',
      priority: 'HIGH',
    });
  }

  // Check for missing timeline
  if (!/\b(by|within|deadline|before)\b/.test(combined) && !/\d{4}/.test(combined)) {
    suggestions.push({
      currentIssue: 'No timeline specified',
      suggestion: 'Add specific deadline: "Complete by [date]" or "Within X business days"',
      priority: 'HIGH',
    });
  }

  // Check for missing measurement
  if (!/\b(measure|track|verify|confirm|audit)\b/.test(combined)) {
    suggestions.push({
      currentIssue: 'No verification method',
      suggestion: 'Add success criteria: "Verified effective when X metric shows Y improvement"',
      priority: 'MEDIUM',
    });
  }

  // Preventive action specific suggestions
  if (actionType === 'PREVENTIVE' && !/\b(procedure|training|system|control|monitor)\b/.test(combined)) {
    suggestions.push({
      currentIssue: 'Preventive action lacks systemic approach',
      suggestion: 'Consider adding: updated procedure, training requirement, or monitoring system',
      priority: 'MEDIUM',
    });
  }

  // Training without specifics
  if (/\btraining\b/.test(combined) && !/\b(all|staff|operators|team|employees)\b/.test(combined)) {
    suggestions.push({
      currentIssue: 'Training audience not specified',
      suggestion: 'Specify who needs training: "Train all Line X operators on..."',
      priority: 'MEDIUM',
    });
  }

  return suggestions;
}

// ============================================================================
// Phase 9.4: Regulatory Tag Mapping
// ============================================================================

/**
 * Map CAPA actions to relevant regulatory requirements
 */
export async function mapRegulatoryTags(
  incidentType: IncidentType,
  categoryName: string
): Promise<string[]> {
  const tags: string[] = [];

  // Food Safety regulatory tags
  if (incidentType === 'FOOD_SAFETY') {
    // FSMA (FDA Food Safety Modernization Act)
    tags.push('FSMA');

    // Category-specific tags
    const categoryLower = categoryName.toLowerCase();
    
    if (categoryLower.includes('foreign') || categoryLower.includes('material')) {
      tags.push('HACCP-CCP', 'FSMA-PC', 'SQF-11.2');
    }
    if (categoryLower.includes('allergen')) {
      tags.push('FALCPA', 'FSMA-PC', 'SQF-11.7');
    }
    if (categoryLower.includes('micro')) {
      tags.push('HACCP-CCP', 'FSMA-PC', 'SQF-11.4');
    }
    if (categoryLower.includes('temperature')) {
      tags.push('HACCP-CCP', 'FSMA-PC', 'SQF-11.3');
    }
    if (categoryLower.includes('sanitation')) {
      tags.push('GMP', 'FSMA-SANITATION', 'SQF-11.5');
    }
    if (categoryLower.includes('label')) {
      tags.push('FDA-LABELING', 'FALCPA', 'SQF-14.1');
    }
    if (categoryLower.includes('packaging')) {
      tags.push('FDA-PACKAGING', 'SQF-13.1');
    }
    if (categoryLower.includes('supplier')) {
      tags.push('FSMA-FSVP', 'SQF-10.2');
    }

    // Default GFSI tag
    if (!tags.includes('SQF-11.2')) {
      tags.push('GFSI');
    }
  }

  // Machine/Equipment regulatory tags
  if (incidentType === 'MACHINE_EQUIPMENT') {
    tags.push('OEE');

    const categoryLower = categoryName.toLowerCase();
    
    if (categoryLower.includes('electrical')) {
      tags.push('NFPA-70', 'OSHA-1910.303');
    }
    if (categoryLower.includes('mechanical') || categoryLower.includes('guard')) {
      tags.push('OSHA-1910.212', 'ANSI-B11');
    }
    if (categoryLower.includes('calibration')) {
      tags.push('ISO-17025', 'GMP-CALIBRATION');
    }
    if (categoryLower.includes('pneumatic') || categoryLower.includes('hydraulic')) {
      tags.push('OSHA-1910.147', 'ANSI-B11');
    }
    if (categoryLower.includes('sensor') || categoryLower.includes('control')) {
      tags.push('IEC-62443', 'NIST-CYBERSECURITY');
    }
    if (categoryLower.includes('lubrication')) {
      tags.push('ISO-21469', 'NSF-H1');
    }

    // Default tags
    tags.push('TPM', 'LOTO');
  }

  // Remove duplicates
  return [...new Set(tags)];
}

// Default export
export default {
  analyzeActionQuality,
  detectWeakActions,
  suggestActionImprovements,
  mapRegulatoryTags,
};
