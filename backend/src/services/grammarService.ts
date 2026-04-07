/**
 * Enterprise Grammar & Writing Assistant Service
 * Provides Grammarly-like functionality using OpenAI
 * - Real-time spelling correction
 * - Grammar analysis
 * - Sentence improvement suggestions
 * - Professional tone enhancement
 */

import OpenAI from 'openai';
import { sanitizeForPrompt, wrapUserContent } from '../utils/promptSanitizer';

// Lazy initialization of OpenAI client
function getOpenAIClient(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

export interface GrammarIssue {
  type: 'spelling' | 'grammar' | 'punctuation' | 'style' | 'clarity';
  severity: 'error' | 'warning' | 'suggestion';
  message: string;
  offset: number;
  length: number;
  originalText: string;
  suggestions: string[];
  explanation?: string;
}

export interface GrammarAnalysisResult {
  issues: GrammarIssue[];
  correctedText: string;
  overallScore: number; // 0-100
  metrics: {
    spelling: number;
    grammar: number;
    punctuation: number;
    clarity: number;
    tone: number;
  };
  suggestions: string[];
  error?: boolean;
  errorMessage?: string;
}

export interface QuickFixResult {
  correctedText: string;
  appliedFixes: string[];
  error?: boolean;
}

export interface EnhanceTextResult {
  enhancedText: string;
  changes: Array<{
    original: string;
    replacement: string;
    reason: string;
  }>;
  improvementSummary: string;
  error?: boolean;
}

/**
 * Analyze text for grammar, spelling, and style issues
 * Returns detailed issues with positions for inline highlighting
 */
export async function analyzeGrammar(
  text: string,
  context?: string
): Promise<GrammarAnalysisResult> {
  const openai = getOpenAIClient();

  if (!openai) {
    console.error('Grammar analysis unavailable: No OpenAI API key configured');
    return {
      issues: [],
      correctedText: text,
      overallScore: 100,
      metrics: { spelling: 100, grammar: 100, punctuation: 100, clarity: 100, tone: 100 },
      suggestions: [],
      error: true,
      errorMessage: 'AI service not configured',
    };
  }

  if (!text || text.trim().length < 3) {
    return {
      issues: [],
      correctedText: text,
      overallScore: 100,
      metrics: { spelling: 100, grammar: 100, punctuation: 100, clarity: 100, tone: 100 },
      suggestions: [],
    };
  }

  try {
    const systemPrompt = `You are an enterprise-grade writing assistant similar to Grammarly. Analyze the provided text for:
1. Spelling errors
2. Grammar mistakes
3. Punctuation issues
4. Clarity problems
5. Professional tone

Context: ${context || 'Professional business/industrial documentation'}

Return a JSON object with this EXACT structure:
{
  "issues": [
    {
      "type": "spelling|grammar|punctuation|style|clarity",
      "severity": "error|warning|suggestion",
      "message": "Brief description of the issue",
      "offset": <character position where issue starts>,
      "length": <length of problematic text>,
      "originalText": "the problematic text",
      "suggestions": ["suggestion1", "suggestion2"],
      "explanation": "Why this is an issue and how to fix it"
    }
  ],
  "correctedText": "The fully corrected version of the text",
  "overallScore": <0-100 score>,
  "metrics": {
    "spelling": <0-100>,
    "grammar": <0-100>,
    "punctuation": <0-100>,
    "clarity": <0-100>,
    "tone": <0-100>
  },
  "suggestions": ["General improvement suggestion 1", "General improvement suggestion 2"]
}

IMPORTANT:
- Calculate accurate character offsets for each issue
- Provide multiple suggestions when possible
- Be thorough but not overly critical
- Focus on professional communication standards
- Return ONLY valid JSON, no markdown or extra text`;

    const response = await openai.chat.completions.create({
      model: process.env.AI_MODEL || 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Analyze this text:\n\n${wrapUserContent(sanitizeForPrompt(text, { maxLength: 5000, context: 'grammar-text' }), 'text_to_analyze')}` },
      ],
      temperature: 0.3,
      max_completion_tokens: 2000,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from AI');
    }

    // Parse the JSON response
    const cleanedContent = content.replace(/```json\n?|\n?```/g, '').trim();
    const result = JSON.parse(cleanedContent);

    return {
      issues: result.issues || [],
      correctedText: result.correctedText || text,
      overallScore: result.overallScore || 100,
      metrics: result.metrics || { spelling: 100, grammar: 100, punctuation: 100, clarity: 100, tone: 100 },
      suggestions: result.suggestions || [],
    };
  } catch (error) {
    console.error('Grammar analysis error:', error);
    return {
      issues: [],
      correctedText: text,
      overallScore: 100,
      metrics: { spelling: 100, grammar: 100, punctuation: 100, clarity: 100, tone: 100 },
      suggestions: [],
      error: true,
      errorMessage: error instanceof Error ? error.message : 'Analysis failed',
    };
  }
}

/**
 * Quick fix - automatically correct all spelling and grammar errors
 */
export async function quickFixText(text: string): Promise<QuickFixResult> {
  const openai = getOpenAIClient();

  if (!openai) {
    return { correctedText: text, appliedFixes: [], error: true };
  }

  if (!text || text.trim().length < 3) {
    return { correctedText: text, appliedFixes: [] };
  }

  try {
    const response = await openai.chat.completions.create({
      model: process.env.AI_MODEL || 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a text correction assistant. Fix all spelling and grammar errors in the text.
Return a JSON object with:
{
  "correctedText": "the corrected text",
  "appliedFixes": ["description of fix 1", "description of fix 2"]
}
Keep the original meaning and tone. Only fix actual errors. Return ONLY valid JSON.`,
        },
        { role: 'user', content: text },
      ],
      temperature: 0.2,
      max_completion_tokens: 1000,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response');
    }

    const cleanedContent = content.replace(/```json\n?|\n?```/g, '').trim();
    const result = JSON.parse(cleanedContent);

    return {
      correctedText: result.correctedText || text,
      appliedFixes: result.appliedFixes || [],
    };
  } catch (error) {
    console.error('Quick fix error:', error);
    return { correctedText: text, appliedFixes: [], error: true };
  }
}

/**
 * Enhance text - improve clarity, professionalism, and readability
 */
export async function enhanceText(
  text: string,
  style: 'professional' | 'formal' | 'concise' | 'detailed' = 'professional',
  context?: string
): Promise<EnhanceTextResult> {
  const openai = getOpenAIClient();

  if (!openai) {
    return {
      enhancedText: text,
      changes: [],
      improvementSummary: 'AI service not available',
      error: true,
    };
  }

  if (!text || text.trim().length < 5) {
    return {
      enhancedText: text,
      changes: [],
      improvementSummary: 'Text too short to enhance',
    };
  }

  const styleInstructions: Record<string, string> = {
    professional: 'Rewrite the text to be clear, simple, and easy to understand - like a helpful coworker would write it',
    formal: 'Make the text formal and suitable for official reports',
    concise: 'Make the text concise while retaining all key information',
    detailed: 'Expand the text with more detail and clarity',
  };

  try {
    const response = await openai.chat.completions.create({
      model: process.env.AI_MODEL || 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a helpful writing assistant for workplace incident reports. Your job is to clean up text while keeping it sounding NATURAL and HUMAN.

${styleInstructions[style]}
${context ? `Context: ${context}` : ''}

Return a JSON object:
{
  "enhancedText": "the improved text",
  "changes": [
    {"original": "original phrase", "replacement": "improved phrase", "reason": "why this change"}
  ],
  "improvementSummary": "Brief summary of improvements made"
}

CRITICAL RULES - READ CAREFULLY:
1. FIX spelling and grammar errors
2. Keep it SHORT - don't add unnecessary words
3. Write like a REAL PERSON talks - casual but professional
4. Use SIMPLE words everyone understands
5. Keep the SAME meaning - don't change facts or add information

WORDS/PHRASES TO AVOID (these sound robotic):
- "It was reported that..." → Just say what happened
- "Preliminary information indicates..." → Too formal
- "The incident occurred..." → Just describe it directly  
- "It has been determined..." → Just state the fact
- "Upon investigation..." → Too stiff
- "whilst", "henceforth", "pertaining to", "commenced", "utilize", "facilitate"

GOOD EXAMPLE:
Input: "a peiece of metal was found in a burrito on line 5 assembly. the piece was said to have come from the bakery on die cut line 5"
Output: "A piece of metal was found in a burrito on Assembly Line 5. The piece likely came from the bakery's Die Cut Line 5."

BAD EXAMPLE (too robotic):
"A piece of metal was discovered in a burrito on Assembly Line 5. It was reported to have originated from the bakery's Die Cut Line 5."

The goal is: Fix errors, make it clear, but keep it sounding like a normal person wrote it.
Return ONLY valid JSON.`,
        },
        { role: 'user', content: text },
      ],
      temperature: 0.3,
      max_completion_tokens: 1500,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response');
    }

    const cleanedContent = content.replace(/```json\n?|\n?```/g, '').trim();
    const result = JSON.parse(cleanedContent);

    return {
      enhancedText: result.enhancedText || text,
      changes: result.changes || [],
      improvementSummary: result.improvementSummary || 'Text enhanced',
    };
  } catch (error) {
    console.error('Enhance text error:', error);
    return {
      enhancedText: text,
      changes: [],
      improvementSummary: 'Enhancement failed',
      error: true,
    };
  }
}

/**
 * Get writing suggestions for a specific text selection
 */
export async function getSuggestions(
  text: string,
  selectedText: string,
  suggestionType: 'rephrase' | 'expand' | 'shorten' | 'formalize' | 'simplify'
): Promise<string[]> {
  const openai = getOpenAIClient();

  if (!openai || !selectedText) {
    return [];
  }

  const typeInstructions: Record<string, string> = {
    rephrase: 'Provide 3 alternative ways to phrase this text',
    expand: 'Provide 3 expanded versions with more detail',
    shorten: 'Provide 3 shorter, more concise versions',
    formalize: 'Provide 3 more formal versions',
    simplify: 'Provide 3 simpler, easier to understand versions',
  };

  try {
    const response = await openai.chat.completions.create({
      model: process.env.AI_MODEL || 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `${typeInstructions[suggestionType]}.
Context (full text): ${wrapUserContent(sanitizeForPrompt(text, { maxLength: 3000, context: 'suggestion-context' }), 'context')}
Return a JSON array of 3 suggestions: ["suggestion1", "suggestion2", "suggestion3"]
Return ONLY the JSON array.`,
        },
        { role: 'user', content: `Selected text: ${wrapUserContent(sanitizeForPrompt(selectedText, { maxLength: 1000, context: 'selected-text' }), 'selected_text')}` },
      ],
      temperature: 0.6,
      max_completion_tokens: 500,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return [];

    const cleanedContent = content.replace(/```json\n?|\n?```/g, '').trim();
    return JSON.parse(cleanedContent);
  } catch (error) {
    console.error('Get suggestions error:', error);
    return [];
  }
}

/**
 * Check a single word for spelling
 */
export async function checkSpelling(word: string): Promise<{ correct: boolean; suggestions: string[] }> {
  const openai = getOpenAIClient();

  if (!openai || !word || word.length < 2) {
    return { correct: true, suggestions: [] };
  }

  try {
    const response = await openai.chat.completions.create({
      model: process.env.AI_MODEL || 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `Check if this word is spelled correctly. Return JSON: {"correct": true/false, "suggestions": ["suggestion1", "suggestion2"]}`,
        },
        { role: 'user', content: word },
      ],
      temperature: 0.1,
      max_completion_tokens: 100,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return { correct: true, suggestions: [] };

    const cleanedContent = content.replace(/```json\n?|\n?```/g, '').trim();
    return JSON.parse(cleanedContent);
  } catch {
    return { correct: true, suggestions: [] };
  }
}

/**
 * Auto-complete sentence
 */
export async function autoComplete(
  text: string,
  context?: string
): Promise<string[]> {
  const openai = getOpenAIClient();

  if (!openai || !text || text.length < 5) {
    return [];
  }

  try {
    const response = await openai.chat.completions.create({
      model: process.env.AI_MODEL || 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `Complete this text with 3 professional suggestions.
${context ? `Context: ${context}` : ''}
Return a JSON array: ["completion1", "completion2", "completion3"]
Each completion should naturally continue the text.`,
        },
        { role: 'user', content: text },
      ],
      temperature: 0.7,
      max_completion_tokens: 300,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return [];

    const cleanedContent = content.replace(/```json\n?|\n?```/g, '').trim();
    return JSON.parse(cleanedContent);
  } catch {
    return [];
  }
}
