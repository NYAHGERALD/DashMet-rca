/**
 * Whisper Transcription Service
 * Server-side audio transcription using OpenAI Whisper API
 * This keeps the API key secure on the server
 */
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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
  error?: string;
}

/**
 * Generate a context prompt based on meeting type
 */
function getMeetingPrompt(meetingType?: string): string {
  const basePrompt = 'This is a professional business meeting transcription. ';
  
  const typePrompts: Record<string, string> = {
    'standup': basePrompt + 'Daily standup meeting discussing progress, blockers, and plans.',
    'planning': basePrompt + 'Planning session for project milestones, tasks, and resource allocation.',
    'review': basePrompt + 'Review meeting discussing completed work, feedback, and improvements.',
    'brainstorm': basePrompt + 'Brainstorming session generating and discussing new ideas.',
    'interview': basePrompt + 'Interview session with questions and candidate responses.',
    'one-on-one': basePrompt + 'One-on-one meeting discussing performance, goals, and feedback.',
    'client': basePrompt + 'Client meeting discussing requirements, deliverables, and timelines.',
    'training': basePrompt + 'Training session explaining concepts and procedures.',
    'general': basePrompt + 'General business discussion.',
  };
  
  return typePrompts[meetingType || 'general'] || typePrompts['general'];
}

/**
 * Transcribe audio from a file path
 */
export async function transcribeFromFile(
  filePath: string,
  config: WhisperConfig = {}
): Promise<TranscriptionResult> {
  try {
    // Check if API key is configured
    if (!process.env.OPENAI_API_KEY) {
      return {
        success: false,
        error: 'OpenAI API key not configured on server',
      };
    }

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return {
        success: false,
        error: 'Audio file not found',
      };
    }

    // Generate prompt based on meeting type
    const prompt = config.prompt || getMeetingPrompt(config.meetingType);

    // Create file stream
    const fileStream = fs.createReadStream(filePath);

    // Call Whisper API
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
    };
  } catch (error: any) {
    console.error('Whisper transcription error:', error);
    
    // Handle specific OpenAI errors
    if (error.code === 'invalid_api_key') {
      return {
        success: false,
        error: 'Invalid OpenAI API key',
      };
    }
    
    if (error.code === 'insufficient_quota') {
      return {
        success: false,
        error: 'OpenAI API quota exceeded',
      };
    }

    return {
      success: false,
      error: error.message || 'Transcription failed',
    };
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
  // Create a temporary file
  const tempDir = os.tmpdir();
  const tempFilePath = path.join(tempDir, `whisper_${Date.now()}_${fileName}`);
  
  try {
    // Write buffer to temp file
    fs.writeFileSync(tempFilePath, buffer);
    
    // Transcribe
    const result = await transcribeFromFile(tempFilePath, config);
    
    return result;
  } finally {
    // Clean up temp file
    if (fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }
  }
}

/**
 * Transcribe audio from a URL (downloads first, then transcribes)
 */
export async function transcribeFromUrl(
  audioUrl: string,
  config: WhisperConfig = {}
): Promise<TranscriptionResult> {
  const axios = require('axios');
  const tempDir = os.tmpdir();
  const tempFilePath = path.join(tempDir, `whisper_${Date.now()}.m4a`);
  
  try {
    // Download the audio file
    const response = await axios.get(audioUrl, {
      responseType: 'arraybuffer',
      timeout: 60000, // 60 second timeout
    });
    
    // Write to temp file
    fs.writeFileSync(tempFilePath, Buffer.from(response.data));
    
    // Transcribe
    const result = await transcribeFromFile(tempFilePath, config);
    
    return result;
  } catch (error: any) {
    console.error('Error downloading audio for transcription:', error);
    return {
      success: false,
      error: `Failed to download audio: ${error.message}`,
    };
  } finally {
    // Clean up temp file
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
