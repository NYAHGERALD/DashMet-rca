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

    // Submit the job and return the submit result wrapped as a DiarizationResult
    const submitResult = await submitDiarization(fileBuffer, fileName, options);
    if (!submitResult.jobId) {
      return {
        success: false,
        blocks: [],
        speakers: [],
        speakerCount: 0,
        totalDuration: 0,
        totalWords: 0,
        language: 'en',
        processingTimeSeconds: 0,
        error: submitResult.error || 'Failed to submit diarization job',
      };
    }

    // Poll until complete
    const deadline = Date.now() + DIARIZATION_TIMEOUT;
    while (Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      const status = await pollDiarizationJob(submitResult.jobId);
      if (status?.status === 'complete' && status.result) {
        return status.result;
      }
      if (status?.status === 'failed') {
        return status.result || {
          success: false, blocks: [], speakers: [], speakerCount: 0,
          totalDuration: 0, totalWords: 0, language: 'en',
          processingTimeSeconds: 0, error: 'Diarization failed',
        };
      }
    }

    return {
      success: false, blocks: [], speakers: [], speakerCount: 0,
      totalDuration: 0, totalWords: 0, language: 'en',
      processingTimeSeconds: (Date.now() - startTime) / 1000,
      error: 'Diarization timed out',
    };
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

// ── Submit Diarization Job (returns immediately with jobId) ──

export interface SubmitResult {
  jobId?: string;
  error?: string;
}

export async function submitDiarization(
  buffer: Buffer,
  fileName: string,
  options: {
    language?: string;
    numSpeakers?: number;
    minSpeakers?: number;
    maxSpeakers?: number;
    clusteringThreshold?: number;
  } = {}
): Promise<SubmitResult> {
  console.log(`[Diarization] ====== submitDiarization ======`);
  console.log(`[Diarization] File: ${fileName}`);
  console.log(`[Diarization] Size: ${(buffer.length / 1024 / 1024).toFixed(2)}MB`);

  try {
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

    console.log(`[Diarization] Submitting to ${DIARIZATION_SERVICE_URL}/diarize`);

    const response = await axios.post(
      `${DIARIZATION_SERVICE_URL}/diarize`,
      form,
      {
        headers: { ...form.getHeaders() },
        timeout: 120000, // 2 min for upload
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      }
    );

    const jobId = response.data?.jobId;
    if (!jobId) {
      return { error: 'Diarization service did not return a job ID' };
    }

    console.log(`[Diarization] Job submitted: ${jobId}`);
    return { jobId };
  } catch (error: any) {
    if (error instanceof AxiosError) {
      const detail = error.response?.data?.detail || error.response?.data?.error;
      console.error(`[Diarization] Submit error HTTP ${error.response?.status}: ${detail || error.message}`);
      return { error: detail || `Diarization service error (HTTP ${error.response?.status})` };
    }
    console.error('[Diarization] Submit error:', error.message);
    return { error: error.message || 'Failed to submit diarization' };
  }
}

// ── Poll Diarization Job Status ──

export interface JobStatusResult {
  jobId: string;
  status: string;  // 'processing' | 'complete' | 'failed'
  progress?: string;
  result?: DiarizationResult;
}

export async function pollDiarizationJob(jobId: string): Promise<JobStatusResult | null> {
  try {
    const response = await axios.get(
      `${DIARIZATION_SERVICE_URL}/jobs/${jobId}`,
      { timeout: 10000 }
    );
    return response.data;
  } catch (error: any) {
    if (error instanceof AxiosError && error.response?.status === 404) {
      return null;
    }
    console.error(`[Diarization] Poll error for job ${jobId}:`, error.message);
    throw error;
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
