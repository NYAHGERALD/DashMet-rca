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
 */

import axios, { AxiosError } from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';

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
