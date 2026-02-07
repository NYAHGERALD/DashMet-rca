/**
 * Enterprise Whisper Transcription Service
 * Server-side audio transcription using OpenAI Whisper API
 * 
 * Features:
 * - Automatic audio chunking for files > 25MB
 * - Support for recordings up to 60+ minutes
 * - Intelligent prompts for high-quality transcription
 * - Proper punctuation and sentence structure
 * - Seamless chunk concatenation
 */
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Initialize OpenAI client with extended timeout for long audio
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 600000, // 10 minutes timeout for long transcriptions
  maxRetries: 3,
});

// Constants
const MAX_FILE_SIZE = 24 * 1024 * 1024; // 24MB (leave buffer below 25MB limit)
const CHUNK_DURATION_MINUTES = 10; // Split into 10-minute chunks for reliability

export interface WhisperConfig {
  language?: string;
  prompt?: string;
  temperature?: number;
  meetingType?: string;
}

export interface TranscriptionResult {
  success: boolean;
  text?: string;
  language?: string;
  duration?: number;
  segments?: TranscriptionSegment[];
  error?: string;
}

export interface TranscriptionSegment {
  start: number;
  end: number;
  text: string;
}

/**
 * Generate enterprise-grade context prompt based on meeting type
 * These prompts help Whisper produce better punctuation and formatting
 */
function getMeetingPrompt(meetingType?: string, previousContext?: string): string {
  // Base prompt that encourages proper punctuation and professional transcription
  const basePrompt = `Professional business meeting transcription with proper punctuation, capitalization, and sentence structure. `;
  
  const typePrompts: Record<string, string> = {
    'standup': basePrompt + 
      `Daily standup meeting. Common phrases: "Yesterday I worked on", "Today I will", "I'm blocked by", "No blockers". ` +
      `Team members discuss progress, blockers, and plans.`,
    
    'planning': basePrompt + 
      `Project planning session. Common phrases: "sprint goal", "story points", "acceptance criteria", "definition of done". ` +
      `Discussion of milestones, tasks, resource allocation, and deadlines.`,
    
    'review': basePrompt + 
      `Sprint review or retrospective meeting. Common phrases: "What went well", "What could improve", "action items", "lessons learned". ` +
      `Team discusses completed work, feedback, and improvements.`,
    
    'brainstorm': basePrompt + 
      `Brainstorming and ideation session. Creative discussion with multiple speakers contributing ideas. ` +
      `Phrases like "What if we", "Building on that idea", "Another approach could be".`,
    
    'interview': basePrompt + 
      `Job interview or candidate assessment. Interviewer asks questions, candidate provides detailed responses. ` +
      `Professional Q&A format with behavioral and technical questions.`,
    
    'one-on-one': basePrompt + 
      `One-on-one meeting between manager and team member. Discussion of performance, goals, career development, and feedback. ` +
      `Supportive and constructive conversation.`,
    
    'client': basePrompt + 
      `Client meeting discussing project requirements, deliverables, timelines, and expectations. ` +
      `Professional business discussion with stakeholders.`,
    
    'training': basePrompt + 
      `Training or educational session. Instructor explains concepts, procedures, and best practices. ` +
      `May include Q&A and demonstrations.`,
    
    'board': basePrompt + 
      `Board meeting or executive discussion. Formal business language discussing strategy, finances, and key decisions. ` +
      `Professional corporate vocabulary.`,
    
    'sales': basePrompt + 
      `Sales call or pitch meeting. Discussion of products, services, pricing, and value propositions. ` +
      `Persuasive language and customer needs assessment.`,
    
    'general': basePrompt + 
      `General business discussion between professionals. Clear communication with proper business terminology.`,
  };
  
  let prompt = typePrompts[meetingType || 'general'] || typePrompts['general'];
  
  // Add previous context for continuity between chunks
  if (previousContext) {
    // Take last 200 characters for context continuity
    const contextSnippet = previousContext.slice(-200).trim();
    prompt += ` Continuing from: "${contextSnippet}"`;
  }
  
  return prompt;
}

/**
 * Get audio file duration using ffprobe (if available) or file size estimation
 */
async function getAudioDuration(filePath: string): Promise<number> {
  try {
    const { stdout } = await execAsync(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`
    );
    return parseFloat(stdout.trim());
  } catch {
    // Estimate based on file size (rough approximation for m4a ~128kbps)
    const stats = fs.statSync(filePath);
    return (stats.size / (128 * 1024 / 8)); // seconds
  }
}

/**
 * Get audio file size
 */
function getFileSize(filePath: string): number {
  const stats = fs.statSync(filePath);
  return stats.size;
}

/**
 * Split audio file into chunks using ffmpeg
 */
async function splitAudioFile(
  inputPath: string,
  outputDir: string,
  chunkDurationSeconds: number
): Promise<string[]> {
  const chunkPaths: string[] = [];
  const duration = await getAudioDuration(inputPath);
  const numChunks = Math.ceil(duration / chunkDurationSeconds);
  
  console.log(`[Whisper] Splitting ${duration.toFixed(0)}s audio into ${numChunks} chunks`);
  
  for (let i = 0; i < numChunks; i++) {
    const startTime = i * chunkDurationSeconds;
    const chunkPath = path.join(outputDir, `chunk_${i.toString().padStart(3, '0')}.m4a`);
    
    try {
      await execAsync(
        `ffmpeg -y -i "${inputPath}" -ss ${startTime} -t ${chunkDurationSeconds} -c copy "${chunkPath}" 2>/dev/null`
      );
      
      if (fs.existsSync(chunkPath) && fs.statSync(chunkPath).size > 0) {
        chunkPaths.push(chunkPath);
      }
    } catch (error) {
      console.error(`[Whisper] Error creating chunk ${i}:`, error);
    }
  }
  
  return chunkPaths;
}

/**
 * Transcribe a single audio chunk
 */
async function transcribeChunk(
  filePath: string,
  config: WhisperConfig,
  previousText?: string
): Promise<TranscriptionResult> {
  try {
    const prompt = getMeetingPrompt(config.meetingType, previousText);
    const fileStream = fs.createReadStream(filePath);
    
    console.log(`[Whisper] Transcribing chunk: ${path.basename(filePath)}`);
    
    const response = await openai.audio.transcriptions.create({
      file: fileStream,
      model: 'whisper-1',
      language: config.language || 'en',
      prompt: prompt,
      temperature: config.temperature || 0,
      response_format: 'verbose_json',
    });
    
    return {
      success: true,
      text: response.text,
      language: response.language,
      duration: response.duration,
      segments: response.segments?.map(seg => ({
        start: seg.start,
        end: seg.end,
        text: seg.text,
      })),
    };
  } catch (error: any) {
    console.error(`[Whisper] Chunk transcription error:`, error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Clean and enhance transcription text
 */
function enhanceTranscription(text: string): string {
  let enhanced = text;
  
  // Fix common transcription issues
  enhanced = enhanced
    // Ensure proper spacing after punctuation
    .replace(/([.!?])([A-Z])/g, '$1 $2')
    // Fix multiple spaces
    .replace(/\s+/g, ' ')
    // Capitalize first letter of sentences
    .replace(/(^|[.!?]\s+)([a-z])/g, (match, p1, p2) => p1 + p2.toUpperCase())
    // Capitalize "I" when standalone
    .replace(/\s+i\s+/g, ' I ')
    .replace(/\s+i'/g, " I'")
    .replace(/\s+i,/g, ' I,')
    // Fix common contractions
    .replace(/\b(dont|cant|wont|isnt|arent|wasnt|werent|hasnt|havent|hadnt|couldnt|wouldnt|shouldnt)\b/gi, 
      (match) => {
        const contractions: Record<string, string> = {
          'dont': "don't", 'cant': "can't", 'wont': "won't",
          'isnt': "isn't", 'arent': "aren't", 'wasnt': "wasn't",
          'werent': "weren't", 'hasnt': "hasn't", 'havent': "haven't",
          'hadnt': "hadn't", 'couldnt': "couldn't", 'wouldnt': "wouldn't",
          'shouldnt': "shouldn't"
        };
        return contractions[match.toLowerCase()] || match;
      })
    // Ensure proper paragraph structure (add line breaks after long sentences)
    .trim();
  
  return enhanced;
}

/**
 * Concatenate multiple transcription chunks intelligently
 */
function concatenateChunks(chunks: TranscriptionResult[], chunkDurationSeconds: number): TranscriptionResult {
  if (chunks.length === 0) {
    return { success: false, error: 'No chunks to concatenate' };
  }
  
  if (chunks.length === 1) {
    return {
      ...chunks[0],
      text: enhanceTranscription(chunks[0].text || ''),
    };
  }
  
  const allTexts: string[] = [];
  const allSegments: TranscriptionSegment[] = [];
  let totalDuration = 0;
  let cumulativeOffset = 0;
  
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    if (!chunk.success || !chunk.text) continue;
    
    // Add text with intelligent joining
    let chunkText = chunk.text.trim();
    
    // If previous chunk didn't end with punctuation, add a period
    if (i > 0 && allTexts.length > 0) {
      const lastText = allTexts[allTexts.length - 1];
      if (lastText && !lastText.match(/[.!?]$/)) {
        allTexts[allTexts.length - 1] = lastText + '.';
      }
    }
    
    allTexts.push(chunkText);
    
    // Adjust segment timestamps
    if (chunk.segments) {
      for (const seg of chunk.segments) {
        allSegments.push({
          start: seg.start + cumulativeOffset,
          end: seg.end + cumulativeOffset,
          text: seg.text,
        });
      }
    }
    
    totalDuration += chunk.duration || chunkDurationSeconds;
    cumulativeOffset += chunk.duration || chunkDurationSeconds;
  }
  
  const combinedText = allTexts.join(' ');
  const enhancedText = enhanceTranscription(combinedText);
  
  // Format into paragraphs for readability
  const paragraphedText = formatIntoParagraphs(enhancedText);
  
  return {
    success: true,
    text: paragraphedText,
    duration: totalDuration,
    segments: allSegments,
    language: chunks[0].language,
  };
}

/**
 * Format long text into readable paragraphs
 */
function formatIntoParagraphs(text: string, sentencesPerParagraph: number = 4): string {
  // Split by sentence-ending punctuation
  const sentences = text.split(/(?<=[.!?])\s+/);
  
  if (sentences.length <= sentencesPerParagraph) {
    return text;
  }
  
  const paragraphs: string[] = [];
  let currentParagraph: string[] = [];
  
  for (const sentence of sentences) {
    currentParagraph.push(sentence.trim());
    
    if (currentParagraph.length >= sentencesPerParagraph) {
      paragraphs.push(currentParagraph.join(' '));
      currentParagraph = [];
    }
  }
  
  // Don't forget remaining sentences
  if (currentParagraph.length > 0) {
    paragraphs.push(currentParagraph.join(' '));
  }
  
  return paragraphs.join('\n\n');
}

/**
 * Main transcription function - handles files of any size
 */
export async function transcribeFromFile(
  filePath: string,
  config: WhisperConfig = {}
): Promise<TranscriptionResult> {
  try {
    // Validate API key
    if (!process.env.OPENAI_API_KEY) {
      return { success: false, error: 'OpenAI API key not configured on server' };
    }
    
    // Validate file exists
    if (!fs.existsSync(filePath)) {
      return { success: false, error: 'Audio file not found' };
    }
    
    const fileSize = getFileSize(filePath);
    const duration = await getAudioDuration(filePath);
    
    console.log(`[Whisper] ====== transcribeFromFile ======`);
    console.log(`[Whisper] File path: ${filePath}`);
    console.log(`[Whisper] File size: ${(fileSize / 1024 / 1024).toFixed(2)}MB (${fileSize} bytes)`);
    console.log(`[Whisper] Estimated duration: ${duration.toFixed(1)}s`);
    console.log(`[Whisper] Max file size limit: ${(MAX_FILE_SIZE / 1024 / 1024).toFixed(0)}MB`);
    
    // If file is small enough, transcribe directly
    if (fileSize <= MAX_FILE_SIZE) {
      console.log(`[Whisper] File within size limit, transcribing directly (no chunking)`);
      const result = await transcribeChunk(filePath, config);
      
      console.log(`[Whisper] Direct transcription result:`);
      console.log(`[Whisper]   Success: ${result.success}`);
      console.log(`[Whisper]   Duration from API: ${result.duration?.toFixed(1)}s`);
      console.log(`[Whisper]   Text length: ${result.text?.length || 0} characters`);
      console.log(`[Whisper]   Segments: ${result.segments?.length || 0}`);
      
      if (result.success && result.text) {
        result.text = formatIntoParagraphs(enhanceTranscription(result.text));
        console.log(`[Whisper]   Enhanced text length: ${result.text.length} characters`);
      }
      return result;
    }
    
    // File is too large - need to split into chunks
    console.log(`[Whisper] File exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB, splitting into chunks`);
    
    const tempDir = path.join(os.tmpdir(), `whisper_chunks_${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });
    
    try {
      const chunkDurationSeconds = CHUNK_DURATION_MINUTES * 60;
      const chunkPaths = await splitAudioFile(filePath, tempDir, chunkDurationSeconds);
      
      if (chunkPaths.length === 0) {
        // ffmpeg not available, try transcribing anyway (may fail for very large files)
        console.log(`[Whisper] Could not split file, attempting direct transcription`);
        const result = await transcribeChunk(filePath, config);
        if (result.success && result.text) {
          result.text = formatIntoParagraphs(enhanceTranscription(result.text));
        }
        return result;
      }
      
      // Transcribe each chunk with context from previous chunk
      const chunkResults: TranscriptionResult[] = [];
      let previousText = '';
      
      for (let i = 0; i < chunkPaths.length; i++) {
        console.log(`[Whisper] Processing chunk ${i + 1}/${chunkPaths.length}`);
        
        const chunkConfig = {
          ...config,
          // Pass previous text for context continuity
        };
        
        const result = await transcribeChunk(chunkPaths[i], chunkConfig, previousText);
        chunkResults.push(result);
        
        if (result.success && result.text) {
          previousText = result.text;
        }
        
        // Small delay between chunks to avoid rate limiting
        if (i < chunkPaths.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
      // Concatenate all chunks
      const finalResult = concatenateChunks(chunkResults, chunkDurationSeconds);
      console.log(`[Whisper] Transcription complete: ${finalResult.text?.length || 0} characters`);
      
      return finalResult;
      
    } finally {
      // Cleanup temp directory
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch (e) {
        console.error('[Whisper] Error cleaning up temp files:', e);
      }
    }
    
  } catch (error: any) {
    console.error('[Whisper] Transcription error:', error);
    
    if (error.code === 'invalid_api_key') {
      return { success: false, error: 'Invalid OpenAI API key' };
    }
    
    if (error.code === 'insufficient_quota') {
      return { success: false, error: 'OpenAI API quota exceeded' };
    }
    
    return { success: false, error: error.message || 'Transcription failed' };
  }
}

/**
 * Transcribe audio from a Buffer
 */
export async function transcribeFromBuffer(
  buffer: Buffer,
  fileName: string,
  config: WhisperConfig = {}
): Promise<TranscriptionResult> {
  const tempDir = os.tmpdir();
  const tempFilePath = path.join(tempDir, `whisper_${Date.now()}_${fileName}`);
  
  console.log(`[Whisper] transcribeFromBuffer called`);
  console.log(`[Whisper] Buffer size: ${buffer.length} bytes (${(buffer.length / 1024 / 1024).toFixed(2)}MB)`);
  console.log(`[Whisper] Temp file: ${tempFilePath}`);
  
  try {
    fs.writeFileSync(tempFilePath, buffer);
    
    // Verify file was written correctly
    const writtenStats = fs.statSync(tempFilePath);
    console.log(`[Whisper] Temp file written: ${writtenStats.size} bytes`);
    
    if (writtenStats.size !== buffer.length) {
      console.error(`[Whisper] ⚠️ File write mismatch! Buffer: ${buffer.length}, Written: ${writtenStats.size}`);
    }
    
    return await transcribeFromFile(tempFilePath, config);
  } finally {
    if (fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
      console.log(`[Whisper] Temp file cleaned up`);
    }
  }
}

/**
 * Transcribe audio from a URL
 */
export async function transcribeFromUrl(
  audioUrl: string,
  config: WhisperConfig = {}
): Promise<TranscriptionResult> {
  const axios = require('axios');
  const tempDir = os.tmpdir();
  const tempFilePath = path.join(tempDir, `whisper_${Date.now()}.m4a`);
  
  try {
    console.log(`[Whisper] Downloading audio from URL`);
    
    const response = await axios.get(audioUrl, {
      responseType: 'arraybuffer',
      timeout: 300000, // 5 minutes for download
      maxContentLength: 500 * 1024 * 1024, // 500MB max
    });
    
    fs.writeFileSync(tempFilePath, Buffer.from(response.data));
    return await transcribeFromFile(tempFilePath, config);
    
  } catch (error: any) {
    console.error('[Whisper] Error downloading audio:', error.message);
    return { success: false, error: `Failed to download audio: ${error.message}` };
  } finally {
    if (fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }
  }
}

/**
 * Check if Whisper service is configured
 */
export function isConfigured(): boolean {
  return !!process.env.OPENAI_API_KEY;
}
