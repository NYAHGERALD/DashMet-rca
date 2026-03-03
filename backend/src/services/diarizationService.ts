/**
 * Enterprise Speaker Diarization Service (Node.js Bridge)
 * ═══════════════════════════════════════════════════════
 * Bridges the Node.js backend to the Python Pyannote+Whisper
 * diarization microservice for enterprise-grade speaker-attributed
 * transcription with timestamps.
 * 
 * Architecture:
 *   Client → Node.js Backend → Python Diarization Service
 *                                 ├─ Pyannote (speaker diarization)
 *                                 └─ Whisper  (word-level transcription)
 * 
 * Fallback: If the Python service is unavailable, falls back to
 * the existing Whisper API + GPT-4o speaker detection pipeline.
 */

import axios, { AxiosError } from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
import os from 'os';

// ── Configuration ──────────────────────────────────────────

const DIARIZATION_SERVICE_URL = process.env.DIARIZATION_SERVICE_URL || 'http://localhost:8100';
const DIARIZATION_TIMEOUT = parseInt(process.env.DIARIZATION_TIMEOUT || '600000', 10); // 10 min default

// ── Types ──────────────────────────────────────────────────

export interface DiarizedBlock {
  speaker: string;
  content: string;
  startTime: number;
  endTime: number;
  confidence: number;
  wordCount: number;
}

export interface QualityMetrics {
  avgConfidence: number;
  diarizationCoverage: number;
  segmentsBeforeFilter: number;
  segmentsAfterFilter: number;
  segmentsAfterMerge: number;
  smoothedBlocks: number;
  clusteringThreshold: number;
}

export interface DiarizationResult {
  success: boolean;
  blocks: DiarizedBlock[];
  speakers: string[];
  speakerCount: number;
  totalDuration: number;
  totalWords: number;
  language: string;
  processingTimeSeconds: number;
  error?: string;
  fallbackUsed?: boolean;
  qualityMetrics?: QualityMetrics;
}

// ── Service Health Check ───────────────────────────────────

export async function isDiarizationServiceAvailable(): Promise<boolean> {
  try {
    const response = await axios.get(`${DIARIZATION_SERVICE_URL}/health`, {
      timeout: 5000,
    });
    return response.data?.status === 'ok';
  } catch {
    return false;
  }
}

// ── Main Diarization Function (from file path) ────────────

export async function diarizeFromFile(
  filePath: string,
  options: {
    language?: string;
    numSpeakers?: number;
    minSpeakers?: number;
    maxSpeakers?: number;
    clusteringThreshold?: number;
  } = {}
): Promise<DiarizationResult> {
  const startTime = Date.now();

  try {
    // Verify file exists
    if (!fs.existsSync(filePath)) {
      return {
        success: false,
        blocks: [],
        speakers: [],
        speakerCount: 0,
        totalDuration: 0,
        totalWords: 0,
        language: 'en',
        processingTimeSeconds: 0,
        error: 'Audio file not found',
      };
    }

    const fileBuffer = fs.readFileSync(filePath);
    const fileName = path.basename(filePath);

    return await diarizeFromBuffer(fileBuffer, fileName, options);
  } catch (error: any) {
    const elapsed = (Date.now() - startTime) / 1000;
    console.error('[Diarization] Error:', error.message);
    return {
      success: false,
      blocks: [],
      speakers: [],
      speakerCount: 0,
      totalDuration: 0,
      totalWords: 0,
      language: 'en',
      processingTimeSeconds: elapsed,
      error: error.message,
    };
  }
}

// ── Main Diarization Function (from buffer) ───────────────

export async function diarizeFromBuffer(
  buffer: Buffer,
  fileName: string,
  options: {
    language?: string;
    numSpeakers?: number;
    minSpeakers?: number;
    maxSpeakers?: number;
    clusteringThreshold?: number;
  } = {}
): Promise<DiarizationResult> {
  const startTime = Date.now();

  console.log(`[Diarization] ====== diarizeFromBuffer ======`);
  console.log(`[Diarization] File: ${fileName}`);
  console.log(`[Diarization] Size: ${(buffer.length / 1024 / 1024).toFixed(2)}MB`);
  console.log(`[Diarization] Language: ${options.language || 'auto'}`);
  console.log(`[Diarization] Expected speakers: ${options.numSpeakers || 'auto'}`);
  console.log(`[Diarization] Speaker bounds: min=${options.minSpeakers || 'auto'} max=${options.maxSpeakers || 'auto'}`);
  console.log(`[Diarization] Clustering threshold: ${options.clusteringThreshold || 'default'}`);

  try {
    // Build multipart form data
    const form = new FormData();
    form.append('audio', buffer, {
      filename: fileName,
      contentType: getContentType(fileName),
    });
    if (options.language) {
      form.append('language', options.language);
    }
    if (options.numSpeakers) {
      form.append('num_speakers', String(options.numSpeakers));
    }
    if (options.minSpeakers) {
      form.append('min_speakers', String(options.minSpeakers));
    }
    if (options.maxSpeakers) {
      form.append('max_speakers', String(options.maxSpeakers));
    }
    if (options.clusteringThreshold) {
      form.append('clustering_threshold', String(options.clusteringThreshold));
    }

    console.log(`[Diarization] Sending to Python service at ${DIARIZATION_SERVICE_URL}/diarize`);

    const response = await axios.post(
      `${DIARIZATION_SERVICE_URL}/diarize`,
      form,
      {
        headers: {
          ...form.getHeaders(),
        },
        timeout: DIARIZATION_TIMEOUT,
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      }
    );

    const result: DiarizationResult = response.data;
    const elapsed = (Date.now() - startTime) / 1000;

    console.log(`[Diarization] ====== Result ======`);
    console.log(`[Diarization] Success: ${result.success}`);
    console.log(`[Diarization] Blocks: ${result.blocks?.length || 0}`);
    console.log(`[Diarization] Speakers: ${result.speakerCount} (${result.speakers?.join(', ')})`);
    console.log(`[Diarization] Words: ${result.totalWords}`);
    console.log(`[Diarization] Duration: ${result.totalDuration}s`);
    console.log(`[Diarization] Processing: ${result.processingTimeSeconds}s (total: ${elapsed.toFixed(1)}s)`);
    if (result.qualityMetrics) {
      console.log(`[Diarization] Quality: confidence=${result.qualityMetrics.avgConfidence} ` +
        `coverage=${result.qualityMetrics.diarizationCoverage}% ` +
        `segments(raw=${result.qualityMetrics.segmentsBeforeFilter} ` +
        `filtered=${result.qualityMetrics.segmentsAfterFilter} ` +
        `merged=${result.qualityMetrics.segmentsAfterMerge}) ` +
        `smoothed=${result.qualityMetrics.smoothedBlocks}`);
    }

    return {
      ...result,
      processingTimeSeconds: elapsed,
    };
  } catch (error: any) {
    const elapsed = (Date.now() - startTime) / 1000;

    if (error instanceof AxiosError) {
      const status = error.response?.status;
      const detail = error.response?.data?.detail || error.response?.data?.error;
      console.error(`[Diarization] HTTP ${status}: ${detail || error.message}`);

      return {
        success: false,
        blocks: [],
        speakers: [],
        speakerCount: 0,
        totalDuration: 0,
        totalWords: 0,
        language: 'en',
        processingTimeSeconds: elapsed,
        error: detail || `Diarization service error (HTTP ${status})`,
      };
    }

    console.error('[Diarization] Error:', error.message);
    return {
      success: false,
      blocks: [],
      speakers: [],
      speakerCount: 0,
      totalDuration: 0,
      totalWords: 0,
      language: 'en',
      processingTimeSeconds: elapsed,
      error: error.message || 'Diarization failed',
    };
  }
}

// ── Fallback: Whisper + GPT-4o Pipeline ───────────────────

export async function diarizeWithFallback(
  buffer: Buffer,
  fileName: string,
  options: {
    language?: string;
    numSpeakers?: number;
    minSpeakers?: number;
    maxSpeakers?: number;
    clusteringThreshold?: number;
    meetingType?: string;
  } = {}
): Promise<DiarizationResult> {
  // Try the Python diarization service first
  const serviceAvailable = await isDiarizationServiceAvailable();

  if (serviceAvailable) {
    console.log('[Diarization] Python service available, using Pyannote+Whisper');
    const result = await diarizeFromBuffer(buffer, fileName, options);
    if (result.success) {
      return result;
    }
    console.warn('[Diarization] Python service failed, falling back to Whisper+GPT');
  } else {
    console.warn('[Diarization] Python service unavailable, using Whisper+GPT fallback');
  }

  // Fallback: Use existing Whisper API + GPT-4o speaker detection
  return await fallbackDiarization(buffer, fileName, options);
}

async function fallbackDiarization(
  buffer: Buffer,
  fileName: string,
  options: {
    language?: string;
    meetingType?: string;
  } = {}
): Promise<DiarizationResult> {
  const startTime = Date.now();

  try {
    // Import existing services dynamically
    const whisperService = await import('./whisperService');
    const speakerDetection = await import('./speakerDetectionService');

    // Step 1: Transcribe with Whisper API
    console.log('[Diarization:Fallback] Transcribing with Whisper API…');
    const transcription = await whisperService.transcribeFromBuffer(buffer, fileName, {
      language: options.language,
      meetingType: options.meetingType,
    });

    if (!transcription.success || !transcription.text) {
      throw new Error(transcription.error || 'Whisper transcription failed');
    }

    // Step 2: Detect speakers with GPT-4o
    console.log('[Diarization:Fallback] Detecting speakers with GPT-4o…');
    const formattedText = await speakerDetection.detectAndFormatSpeakers(
      transcription.text
    );

    // Step 3: Convert paragraphs to blocks (each paragraph = one speaker turn)
    const paragraphs = formattedText
      .split('\n\n')
      .map(p => p.trim())
      .filter(p => p.length > 0);

    const blocks: DiarizedBlock[] = [];
    const duration = transcription.duration || 0;
    const timePerChar = duration / (formattedText.length || 1);
    let charOffset = 0;

    for (let i = 0; i < paragraphs.length; i++) {
      const para = paragraphs[i];
      const startTime = charOffset * timePerChar;
      charOffset += para.length;
      const endTime = charOffset * timePerChar;
      const wordCount = para.split(/\s+/).filter(w => w.length > 0).length;

      blocks.push({
        speaker: `Speaker ${(i % 2) + 1}`, // Alternate speakers as heuristic
        content: para,
        startTime: Math.round(startTime),
        endTime: Math.round(endTime),
        confidence: 0.6, // Lower confidence for GPT-based detection
        wordCount,
      });
    }

    const elapsed = (Date.now() - startTime) / 1000;
    const speakers = [...new Set(blocks.map(b => b.speaker))];

    return {
      success: true,
      blocks,
      speakers,
      speakerCount: speakers.length,
      totalDuration: duration,
      totalWords: blocks.reduce((sum, b) => sum + b.wordCount, 0),
      language: transcription.language || 'en',
      processingTimeSeconds: elapsed,
      fallbackUsed: true,
    };
  } catch (error: any) {
    const elapsed = (Date.now() - startTime) / 1000;
    console.error('[Diarization:Fallback] Error:', error.message);
    return {
      success: false,
      blocks: [],
      speakers: [],
      speakerCount: 0,
      totalDuration: 0,
      totalWords: 0,
      language: 'en',
      processingTimeSeconds: elapsed,
      error: error.message,
      fallbackUsed: true,
    };
  }
}

// ── Utilities ──────────────────────────────────────────────

function getContentType(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase();
  const types: Record<string, string> = {
    '.m4a': 'audio/mp4',
    '.mp4': 'audio/mp4',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.ogg': 'audio/ogg',
    '.flac': 'audio/flac',
    '.webm': 'audio/webm',
    '.aac': 'audio/aac',
  };
  return types[ext] || 'audio/mp4';
}
