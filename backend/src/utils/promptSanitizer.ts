/**
 * Centralized Prompt Sanitization Utility
 * 
 * Protects against LLM prompt injection, role hijacking, and data exfiltration
 * by sanitizing all user-supplied text before it enters AI prompts.
 * 
 * Usage:
 *   import { sanitizeForPrompt, sanitizeForSystemPrompt, detectPromptInjection } from '../utils/promptSanitizer';
 *   
 *   const safeName = sanitizeForPrompt(employeeName, { maxLength: 100 });
 *   const safeText = sanitizeForPrompt(complaintText, { maxLength: 2000 });
 */

// ─── Prompt Injection Patterns ──────────────────────────────────────────────
// These patterns detect common prompt injection techniques

const INJECTION_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  // Role hijacking
  { pattern: /ignore\s+(all\s+)?previous\s+(instructions|prompts|rules)/gi, label: 'ignore-instructions' },
  { pattern: /disregard\s+(all\s+)?previous/gi, label: 'disregard-previous' },
  { pattern: /forget\s+(all\s+)?previous/gi, label: 'forget-previous' },
  { pattern: /override\s+(all\s+)?instructions/gi, label: 'override-instructions' },
  { pattern: /you\s+are\s+now\b/gi, label: 'role-switch' },
  { pattern: /act\s+as\s+(a|an|if)\b/gi, label: 'role-impersonation' },
  { pattern: /pretend\s+to\s+be\b/gi, label: 'role-pretend' },
  { pattern: /new\s+instructions?\s*:/gi, label: 'new-instructions' },
  { pattern: /system\s*prompt\s*:/gi, label: 'system-prompt-leak' },
  { pattern: /reveal\s+(your|the)\s+(system|initial)\s*(prompt|instructions)/gi, label: 'prompt-extraction' },
  { pattern: /what\s+(are|is)\s+your\s+(system|initial)\s*(prompt|instructions)/gi, label: 'prompt-extraction' },
  { pattern: /repeat\s+(your|the)\s+(system|initial)\s*(prompt|instructions|message)/gi, label: 'prompt-extraction' },
  { pattern: /output\s+(your|the)\s+(system|initial)\s*(prompt|instructions)/gi, label: 'prompt-extraction' },
  
  // Data exfiltration attempts
  { pattern: /list\s+all\s+(users?|employees?|data|records|passwords)/gi, label: 'data-exfil' },
  { pattern: /show\s+me\s+(the\s+)?(database|all\s+records|other|confidential)/gi, label: 'data-exfil' },
  { pattern: /access\s+(the\s+)?(database|admin|system)/gi, label: 'data-exfil' },
  { pattern: /dump\s+(the\s+)?(database|table|schema)/gi, label: 'data-exfil' },
  
  // Code/command injection
  { pattern: /```[\s\S]*?(import|require|eval|exec|spawn|child_process)/gi, label: 'code-injection' },
  { pattern: /\{\{[\s\S]*?\}\}/g, label: 'template-injection' },
  
  // Delimiter/role manipulation
  { pattern: /\{system\}/gi, label: 'role-tag' },
  { pattern: /\{user\}/gi, label: 'role-tag' },
  { pattern: /\{assistant\}/gi, label: 'role-tag' },
  { pattern: /<\|system\|>/gi, label: 'role-delimiter' },
  { pattern: /<\|user\|>/gi, label: 'role-delimiter' },
  { pattern: /<\|assistant\|>/gi, label: 'role-delimiter' },
  { pattern: /<\|im_start\|>/gi, label: 'role-delimiter' },
  { pattern: /<\|im_end\|>/gi, label: 'role-delimiter' },
  { pattern: /\[INST\]/gi, label: 'role-delimiter' },
  { pattern: /\[\/INST\]/gi, label: 'role-delimiter' },
  { pattern: /<<SYS>>/gi, label: 'role-delimiter' },
  { pattern: /<<\/SYS>>/gi, label: 'role-delimiter' },

  // Jailbreak patterns
  { pattern: /do\s+anything\s+now/gi, label: 'jailbreak-DAN' },
  { pattern: /\bDAN\s+mode\b/gi, label: 'jailbreak-DAN' },
  { pattern: /developer\s+mode\s+(enabled|on|activated)/gi, label: 'jailbreak' },
  { pattern: /bypass\s+(safety|content|filter|restriction)/gi, label: 'jailbreak' },
];

interface SanitizeOptions {
  /** Maximum allowed length after sanitization (default: 2000) */
  maxLength?: number;
  /** Whether to strip all newlines (default: false, normalizes to max 2 consecutive) */
  stripNewlines?: boolean;
  /** If true, logs detected injection attempts (default: true) */
  logDetections?: boolean;
  /** Custom label for logging context (e.g., 'employee-statement') */
  context?: string;
}

/**
 * Detect prompt injection attempts in text.
 * Returns array of detected pattern labels, or empty array if clean.
 */
export function detectPromptInjection(text: string): string[] {
  if (!text || typeof text !== 'string') return [];
  
  const detected: string[] = [];
  for (const { pattern, label } of INJECTION_PATTERNS) {
    // Reset regex lastIndex for global patterns
    pattern.lastIndex = 0;
    if (pattern.test(text)) {
      detected.push(label);
    }
  }
  return detected;
}

/**
 * Sanitize user input for inclusion in LLM prompts (user message role).
 * 
 * - Strips prompt injection patterns
 * - Removes role delimiter tokens
 * - Normalizes whitespace
 * - Caps length
 * - Removes code fences
 */
export function sanitizeForPrompt(text: string, options: SanitizeOptions = {}): string {
  const {
    maxLength = 2000,
    stripNewlines = false,
    logDetections = true,
    context = 'unknown',
  } = options;

  if (!text || typeof text !== 'string') return '';

  // 1. Detect and log injection attempts before stripping
  if (logDetections) {
    const detections = detectPromptInjection(text);
    if (detections.length > 0) {
      console.warn(
        `[PromptSanitizer] ⚠️ Injection patterns detected in "${context}": [${detections.join(', ')}]`
      );
    }
  }

  let sanitized = text;

  // 2. Strip role delimiters and injection control tokens
  for (const { pattern } of INJECTION_PATTERNS) {
    pattern.lastIndex = 0;
    sanitized = sanitized.replace(pattern, '');
  }

  // 3. Remove code fences (triple backticks)
  sanitized = sanitized.replace(/```/g, '');

  // 4. Remove any remaining role-like XML tags
  sanitized = sanitized.replace(/<\/?(?:system|user|assistant|instruction|prompt|context)\s*>/gi, '');

  // 5. Normalize whitespace
  if (stripNewlines) {
    sanitized = sanitized.replace(/[\r\n]+/g, ' ');
  } else {
    sanitized = sanitized.replace(/\n{3,}/g, '\n\n');
  }
  sanitized = sanitized.replace(/[ \t]{3,}/g, '  ');

  // 6. Trim and cap length
  sanitized = sanitized.trim();
  if (sanitized.length > maxLength) {
    sanitized = sanitized.slice(0, maxLength);
    // Don't cut mid-word
    const lastSpace = sanitized.lastIndexOf(' ');
    if (lastSpace > maxLength * 0.8) {
      sanitized = sanitized.slice(0, lastSpace);
    }
  }

  return sanitized;
}

/**
 * Stricter sanitization for values that will be placed in SYSTEM prompts.
 * System prompts define AI behavior, so injected values here are extra dangerous.
 * 
 * - Short max length (200 chars)
 * - Strips all special formatting
 * - Only allows alphanumeric, spaces, basic punctuation
 */
export function sanitizeForSystemPrompt(text: string, options: SanitizeOptions = {}): string {
  const {
    maxLength = 200,
    logDetections = true,
    context = 'system-prompt-value',
  } = options;

  if (!text || typeof text !== 'string') return '';

  // Detect first
  if (logDetections) {
    const detections = detectPromptInjection(text);
    if (detections.length > 0) {
      console.warn(
        `[PromptSanitizer] 🔴 SYSTEM PROMPT injection attempt in "${context}": [${detections.join(', ')}]`
      );
    }
  }

  // Aggressive sanitization — only allow safe characters
  let sanitized = text
    .replace(/[^\w\s.,!?;:'"()\-\/&@#%+=$]/g, '') // Strip everything except safe chars
    .replace(/\s+/g, ' ')
    .trim();

  return sanitized.slice(0, maxLength);
}

/**
 * Wrap user content in XML-style delimiters to help the LLM distinguish
 * user data from instructions. Use this when placing user text in prompts.
 * 
 * Example:
 *   const prompt = `Analyze this text:\n${wrapUserContent(sanitizedText)}`;
 */
export function wrapUserContent(text: string, label: string = 'user_input'): string {
  return `<${label}>\n${text}\n</${label}>`;
}

/**
 * Sanitize an object's string values recursively.
 * Useful for sanitizing entire request bodies before prompt construction.
 */
export function sanitizeObject(
  obj: Record<string, any>,
  options: SanitizeOptions = {}
): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      result[key] = sanitizeForPrompt(value, { ...options, context: key });
    } else if (Array.isArray(value)) {
      result[key] = value.map((item) =>
        typeof item === 'string'
          ? sanitizeForPrompt(item, { ...options, context: key })
          : typeof item === 'object' && item !== null
          ? sanitizeObject(item, options)
          : item
      );
    } else if (value && typeof value === 'object') {
      result[key] = sanitizeObject(value, options);
    } else {
      result[key] = value;
    }
  }
  return result;
}
