/**
 * Meeting Summary Narration Service
 * 
 * Generates intelligent, professional narrative summaries of meetings
 * and converts them to realistic speech using OpenAI TTS.
 * 
 * Features:
 * - GPT-4o powered narrative generation
 * - Context-aware professional tone
 * - OpenAI TTS with realistic male voice (onyx)
 * - Structured summary with key insights
 */

import OpenAI from 'openai';
import { Readable } from 'stream';

// Lazy initialization of OpenAI client
let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not configured');
  }
  
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: 120000,
      maxRetries: 2,
    });
  }
  
  return openaiClient;
}

/**
 * Input data for generating meeting summary narrative
 */
export interface MeetingSummaryInput {
  meetingTitle: string;
  meetingType: string;
  meetingDate: string;  // ISO date string
  meetingTime: string;  // e.g., "3:30 AM"
  duration?: number;    // in seconds
  transcript: string;
  language?: string;
  participantCount?: number;
  existingSummary?: {
    overview?: string;
    keyPoints?: string[];
    decisions?: string[];
    nextSteps?: string[];
  };
}

/**
 * Generated narrative summary output
 */
export interface NarrativeSummary {
  narrative: string;           // Full narrative text
  briefSummary: string;        // 2-3 sentence summary
  objectives: string[];        // Meeting objectives identified
  keyDiscussions: string[];    // Main discussion points
  actionItems: string[];       // Action items with assignees/deadlines
  takeaways: string[];         // Key takeaways
  tone: string;                // Detected meeting tone (formal, casual, urgent, etc.)
  generatedAt: string;         // ISO timestamp
}

/**
 * Generate an intelligent narrative summary of a meeting
 */
export async function generateNarrativeSummary(
  input: MeetingSummaryInput
): Promise<NarrativeSummary> {
  const openai = getOpenAIClient();
  
  // Format the meeting date nicely
  const meetingDate = new Date(input.meetingDate);
  const formattedDate = meetingDate.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  
  // Calculate duration in human-readable format
  let durationText = '';
  if (input.duration) {
    const minutes = Math.floor(input.duration / 60);
    const seconds = input.duration % 60;
    if (minutes > 0) {
      durationText = `${minutes} minute${minutes !== 1 ? 's' : ''}`;
      if (seconds > 0) {
        durationText += ` and ${seconds} second${seconds !== 1 ? 's' : ''}`;
      }
    } else {
      durationText = `${seconds} second${seconds !== 1 ? 's' : ''}`;
    }
  }

  const systemPrompt = `You are an elite executive assistant with exceptional skills in meeting analysis and professional communication. Your task is to create a detailed, comprehensive narrative summary of a meeting that sounds natural when read aloud.

Your narrative MUST:
1. Open with the meeting context (title, date, time, duration) woven naturally into the narrative
2. Cover EVERY significant topic, discussion point, and idea raised during the meeting — do not omit or gloss over anything
3. Explain each discussion topic in enough detail that someone who was NOT in the meeting can fully understand what was discussed, what positions were taken, and what conclusions were reached
4. Capture the reasoning, context, and background behind decisions — not just the decisions themselves
5. Include ALL action items, responsibilities, and deadlines discussed, woven naturally into the narrative (e.g., "It was agreed that John would finalize the budget report by Friday")
6. Highlight key decisions, agreements, and any points of disagreement or unresolved matters
7. Identify objectives, whether stated or implied
8. Maintain a professional, formal, yet clear and approachable tone — use simple English that is easy to understand by all readers
9. Be suitable for text-to-speech narration (avoid bullet points, use flowing prose with clear paragraph transitions)
10. Write in a natural, human-like style — as if a skilled professional is narrating the meeting to a colleague. Avoid robotic or templated phrasing.

IMPORTANT GUIDELINES:
- Be THOROUGH. The narrative should be long enough to cover all points discussed. A 5-minute meeting might need 400-600 words; a 30-minute meeting might need 800-1500+ words. Scale the length to the content.
- Do NOT summarize superficially. If the meeting discussed a budget issue, explain WHAT the budget issue was, WHY it matters, what numbers or figures were mentioned, and what was decided.
- Use clear paragraph breaks for different topics to aid readability.
- Include names of participants when mentioned in the transcript and attribute statements, decisions, or action items to specific people where possible.
- End with a clear closing paragraph that summarises the overall outcome and next steps.

Write as if you are briefing someone who was absent and needs to understand everything that happened without reading the full transcript. Be insightful, not just descriptive. Draw connections and identify patterns in the discussion.`;

  const userPrompt = `Please analyze this meeting and create a professional narrative summary:

**Meeting Details:**
- Title: ${input.meetingTitle}
- Type: ${input.meetingType}
- Date: ${formattedDate}
- Time: ${input.meetingTime}
${durationText ? `- Duration: ${durationText}` : ''}
${input.participantCount ? `- Participants: ${input.participantCount}` : ''}
${input.language ? `- Language: ${input.language}` : ''}

**Meeting Transcript:**
${input.transcript}

${input.existingSummary?.overview ? `\n**Existing Overview:**\n${input.existingSummary.overview}` : ''}
${input.existingSummary?.keyPoints?.length ? `\n**Previously Identified Key Points:**\n${input.existingSummary.keyPoints.join('\n')}` : ''}

Please respond in the following JSON format:
{
  "narrative": "A detailed, comprehensive narrative summary suitable for text-to-speech. Cover ALL discussion points thoroughly. Scale the length to the meeting content — typically 400-1500+ words depending on meeting length. Use clear paragraph structure with natural transitions.",
  "briefSummary": "A concise 2-3 sentence summary of the meeting highlighting the main purpose and outcome",
  "objectives": ["objective 1", "objective 2", "...(list ALL objectives identified)"],
  "keyDiscussions": ["detailed discussion point 1", "detailed discussion point 2", "...(list ALL significant discussion topics, be specific and descriptive)"],
  "actionItems": ["action item 1 with assignee and deadline if mentioned", "action item 2", "...(list ALL action items discussed)"],
  "takeaways": ["key takeaway 1", "key takeaway 2", "...(list ALL important takeaways)"],
  "tone": "The overall tone of the meeting (e.g., collaborative, urgent, informational, strategic)"
}`;

  console.log('🧠 Generating narrative summary with GPT-4o...');

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    temperature: 0.7,
    max_tokens: 4096,
    response_format: { type: 'json_object' }
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No response from GPT-4o');
  }

  const parsed = JSON.parse(content);

  console.log('✅ Narrative summary generated successfully');

  return {
    narrative: parsed.narrative,
    briefSummary: parsed.briefSummary,
    objectives: parsed.objectives || [],
    keyDiscussions: parsed.keyDiscussions || [],
    actionItems: parsed.actionItems || [],
    takeaways: parsed.takeaways || [],
    tone: parsed.tone || 'professional',
    generatedAt: new Date().toISOString()
  };
}

/**
 * Voice options for TTS
 */
export type TTSVoice = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';

/**
 * Convert text to speech using OpenAI TTS
 * Returns audio as a Buffer (MP3 format)
 * 
 * Voice options:
 * - onyx: Deep, authoritative male voice (recommended for professional summaries)
 * - echo: Warm, engaging male voice
 * - alloy: Neutral, balanced voice
 * - fable: Expressive, storytelling voice
 * - nova: Warm female voice
 * - shimmer: Clear female voice
 */
export async function textToSpeech(
  text: string,
  voice: TTSVoice = 'onyx',
  speed: number = 1.0
): Promise<Buffer> {
  const openai = getOpenAIClient();

  console.log(`🎙️ Converting to speech with voice: ${voice}, speed: ${speed}x`);
  console.log(`📝 Text length: ${text.length} characters`);

  // OpenAI TTS has a limit of 4096 characters per request
  if (text.length > 4096) {
    console.log('⚠️ Text exceeds 4096 chars, will be chunked');
    return await textToSpeechChunked(text, voice, speed);
  }

  const response = await openai.audio.speech.create({
    model: 'tts-1-hd',  // High-definition model for best quality
    voice: voice,
    input: text,
    speed: speed,
    response_format: 'mp3'
  });

  // Convert response to Buffer
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  console.log(`✅ TTS generated: ${buffer.length} bytes`);

  return buffer;
}

/**
 * Handle long text by chunking and concatenating audio
 */
async function textToSpeechChunked(
  text: string,
  voice: TTSVoice,
  speed: number
): Promise<Buffer> {
  const openai = getOpenAIClient();
  
  // Split text at sentence boundaries, keeping under 4000 chars per chunk
  const chunks: string[] = [];
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  
  let currentChunk = '';
  for (const sentence of sentences) {
    if ((currentChunk + sentence).length > 4000) {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
      }
      currentChunk = sentence;
    } else {
      currentChunk += sentence;
    }
  }
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  console.log(`📦 Split into ${chunks.length} chunks for TTS`);

  // Generate audio for each chunk
  const audioBuffers: Buffer[] = [];
  for (let i = 0; i < chunks.length; i++) {
    console.log(`🔊 Processing chunk ${i + 1}/${chunks.length}...`);
    
    const response = await openai.audio.speech.create({
      model: 'tts-1-hd',
      voice: voice,
      input: chunks[i],
      speed: speed,
      response_format: 'mp3'
    });

    const arrayBuffer = await response.arrayBuffer();
    audioBuffers.push(Buffer.from(arrayBuffer));
  }

  // Concatenate all audio buffers
  // Note: Simple concatenation works for MP3 but may have slight gaps
  const combinedBuffer = Buffer.concat(audioBuffers);

  console.log(`✅ Combined TTS audio: ${combinedBuffer.length} bytes`);

  return combinedBuffer;
}

/**
 * Generate both narrative summary and audio in one call
 */
export async function generateNarrativeSummaryWithAudio(
  input: MeetingSummaryInput,
  voice: TTSVoice = 'onyx',
  speed: number = 1.0
): Promise<{
  summary: NarrativeSummary;
  audioBuffer: Buffer;
}> {
  // First generate the narrative
  const summary = await generateNarrativeSummary(input);

  // Then convert to speech
  const audioBuffer = await textToSpeech(summary.narrative, voice, speed);

  return {
    summary,
    audioBuffer
  };
}

export default {
  generateNarrativeSummary,
  textToSpeech,
  generateNarrativeSummaryWithAudio
};
