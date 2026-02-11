/**
 * Enterprise Speaker Detection Service
 * 
 * Uses GPT-4 to intelligently detect speaker changes in transcripts
 * and format the output with natural paragraph breaks.
 * 
 * Key Features:
 * - Contextual speaker change detection (no explicit labels)
 * - Natural paragraph formatting with blank lines between speakers
 * - Handles large transcripts with intelligent chunking
 * - Preserves original words exactly - only adds formatting
 */
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 120000, // 2 minutes
  maxRetries: 2,
});

/**
 * The core prompt for speaker detection
 * This prompt is carefully crafted to:
 * 1. Detect speaker changes based on conversational context
 * 2. NOT add any labels like "Speaker 1" or "Person A"
 * 3. Simply separate different speakers with blank lines
 * 4. Preserve the original text exactly
 */
const SPEAKER_DETECTION_PROMPT = `You are an expert conversation analyst. Your task is to analyze a transcript and identify when different people are speaking based on conversational context.

CRITICAL RULES - READ CAREFULLY:

1. DO NOT add any speaker labels like "Speaker 1:", "Person A:", "Speaker:", or any other identifiers
2. DO NOT add any new words, introductions, or commentary
3. DO NOT modify, paraphrase, or change any of the original words
4. ONLY add paragraph breaks (blank lines) between different speakers

HOW TO DETECT SPEAKER CHANGES:
- Question followed by an answer = different speakers
- "I" statements that refer to different contexts = different speakers
- Responses that address what was just said = different speakers
- Shifts in perspective or topic that suggest a new person = different speakers
- Greetings, introductions, or name mentions = speaker boundary
- "You said..." or references to the other person = speaker boundary

OUTPUT FORMAT:
- Each speaker's continuous speech should be ONE paragraph
- Separate different speakers with a SINGLE blank line
- Keep sentences from the same speaker together in one paragraph
- Preserve all original punctuation and capitalization

EXAMPLE INPUT:
"Hello, how are you today? I'm doing great, thank you for asking. What brings you here? I wanted to discuss the project timeline. That sounds good, let me pull up the details."

EXAMPLE OUTPUT:
Hello, how are you today?

I'm doing great, thank you for asking.

What brings you here?

I wanted to discuss the project timeline.

That sounds good, let me pull up the details.

Now process the following transcript. Remember: ONLY add blank lines between speakers. Do NOT add any labels or change any words.`;

/**
 * Supplementary prompt for chunk processing to maintain consistency
 */
const CHUNK_CONTEXT_PROMPT = `This is part ${'{chunkIndex}'} of ${'{totalChunks}'} from a larger conversation. 
Maintain consistency in speaker detection. The conversation may start mid-sentence from the previous chunk.
Apply the same rules: detect speaker changes and separate with blank lines. No labels.`;

/**
 * Detect speakers and format transcript with paragraph breaks
 */
export async function detectAndFormatSpeakers(
  transcript: string,
  isChunk: boolean = false,
  chunkIndex: number = 0,
  totalChunks: number = 1
): Promise<string> {
  
  if (!process.env.OPENAI_API_KEY) {
    console.error('[SpeakerDetection] OpenAI API key not configured');
    throw new Error('AI service not configured');
  }

  const trimmedTranscript = transcript.trim();
  
  if (!trimmedTranscript) {
    return transcript;
  }

  console.log(`[SpeakerDetection] Processing ${trimmedTranscript.length} characters`);

  // Build the prompt
  let systemPrompt = SPEAKER_DETECTION_PROMPT;
  
  if (isChunk && totalChunks > 1) {
    systemPrompt += '\n\n' + CHUNK_CONTEXT_PROMPT
      .replace('{chunkIndex}', String(chunkIndex + 1))
      .replace('{totalChunks}', String(totalChunks));
  }

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o', // Use GPT-4o for best quality
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: `Process this transcript:\n\n${trimmedTranscript}`,
        },
      ],
      temperature: 0.1, // Low temperature for consistent formatting
      max_tokens: 4000,
    });

    const result = response.choices[0]?.message?.content;
    
    if (!result) {
      console.error('[SpeakerDetection] Empty response from GPT');
      throw new Error('AI returned empty response');
    }

    // Clean up the result
    const cleanedResult = cleanupFormattedTranscript(result);
    
    console.log(`[SpeakerDetection] Successfully formatted transcript`);
    console.log(`[SpeakerDetection] Paragraphs detected: ${cleanedResult.split('\n\n').length}`);
    
    return cleanedResult;
    
  } catch (error: any) {
    console.error('[SpeakerDetection] GPT API error:', error.message);
    
    // If GPT fails, return a basic formatted version
    if (error.code === 'insufficient_quota') {
      throw new Error('AI service quota exceeded');
    }
    
    if (error.code === 'invalid_api_key') {
      throw new Error('AI service configuration error');
    }
    
    // Fallback: basic sentence-based formatting
    console.log('[SpeakerDetection] Using fallback formatting');
    return fallbackFormatting(trimmedTranscript);
  }
}

/**
 * Clean up the formatted transcript
 */
function cleanupFormattedTranscript(text: string): string {
  let result = text;
  
  // Remove any accidental speaker labels that GPT might have added
  result = result.replace(/^(Speaker\s*\d*\s*:?\s*)/gmi, '');
  result = result.replace(/^(Person\s*[A-Z]?\s*:?\s*)/gmi, '');
  result = result.replace(/^(\[\s*Speaker\s*\d*\s*\]\s*)/gmi, '');
  
  // Normalize line breaks
  result = result.replace(/\r\n/g, '\n');
  
  // Ensure consistent paragraph spacing (exactly one blank line between paragraphs)
  result = result.replace(/\n{3,}/g, '\n\n');
  
  // Trim each paragraph
  result = result.split('\n\n')
    .map(p => p.trim())
    .filter(p => p.length > 0)
    .join('\n\n');
  
  return result.trim();
}

/**
 * Fallback formatting when GPT is unavailable
 * Uses basic heuristics to detect likely speaker changes
 */
function fallbackFormatting(transcript: string): string {
  // Split into sentences
  const sentences = transcript.split(/(?<=[.!?])\s+/);
  
  if (sentences.length <= 1) {
    return transcript;
  }
  
  const paragraphs: string[] = [];
  let currentParagraph: string[] = [];
  
  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i].trim();
    const prevSentence = i > 0 ? sentences[i - 1].trim() : '';
    
    // Heuristics for speaker change
    const isQuestion = prevSentence.endsWith('?');
    const startsWithAnswer = /^(yes|no|well|actually|i think|i believe|that's|it's|we|they)/i.test(sentence);
    const hasQuestionResponse = isQuestion && startsWithAnswer;
    
    // Check for greeting/introduction patterns
    const isGreeting = /^(hello|hi|hey|good morning|good afternoon|good evening)/i.test(sentence);
    const isThankYou = /^(thank you|thanks|thank)/i.test(sentence);
    
    // Detect likely speaker change
    if (currentParagraph.length > 0 && (hasQuestionResponse || isGreeting || isThankYou)) {
      paragraphs.push(currentParagraph.join(' '));
      currentParagraph = [];
    }
    
    currentParagraph.push(sentence);
    
    // Start new paragraph after questions (likely speaker will respond)
    if (sentence.endsWith('?') && i < sentences.length - 1) {
      paragraphs.push(currentParagraph.join(' '));
      currentParagraph = [];
    }
  }
  
  // Add remaining sentences
  if (currentParagraph.length > 0) {
    paragraphs.push(currentParagraph.join(' '));
  }
  
  return paragraphs.join('\n\n');
}

/**
 * Check if speaker detection is available
 */
export function isConfigured(): boolean {
  return !!process.env.OPENAI_API_KEY;
}
