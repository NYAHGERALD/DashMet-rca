/**
 * FFmpeg.wasm-based video trimmer that preserves original format
 * Uses stream copy (no re-encoding) for fast, lossless trimming
 */

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

let ffmpeg: FFmpeg | null = null;
let isLoading = false;
let loadPromise: Promise<FFmpeg> | null = null;

/**
 * Load FFmpeg.wasm - singleton pattern to avoid multiple loads
 */
export async function loadFFmpeg(
  onProgress?: (progress: number) => void
): Promise<FFmpeg> {
  // Return existing instance if loaded
  if (ffmpeg && ffmpeg.loaded) {
    return ffmpeg;
  }

  // Return existing load promise if loading
  if (isLoading && loadPromise) {
    return loadPromise;
  }

  isLoading = true;
  
  loadPromise = (async () => {
    try {
      ffmpeg = new FFmpeg();
      
      // Set up progress handler for loading
      ffmpeg.on('progress', ({ progress }) => {
        onProgress?.(Math.round(progress * 100));
      });

      // Load FFmpeg with CDN-hosted core files
      const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
      
      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      });

      console.log('FFmpeg.wasm loaded successfully');
      return ffmpeg;
    } catch (error) {
      console.error('Failed to load FFmpeg.wasm:', error);
      ffmpeg = null;
      throw error;
    } finally {
      isLoading = false;
    }
  })();

  return loadPromise;
}

/**
 * Get file extension from filename or mime type
 */
function getFileExtension(fileName: string, mimeType: string): string {
  // Try to get from filename first
  const extMatch = fileName.match(/\.([^.]+)$/);
  if (extMatch) {
    return extMatch[1].toLowerCase();
  }
  
  // Fall back to mime type
  const mimeToExt: Record<string, string> = {
    'video/mp4': 'mp4',
    'video/quicktime': 'mov',
    'video/x-msvideo': 'avi',
    'video/x-matroska': 'mkv',
    'video/webm': 'webm',
    'video/3gpp': '3gp',
    'video/x-flv': 'flv',
  };
  
  return mimeToExt[mimeType] || 'mp4';
}

/**
 * Check if format supports stream copy (lossless trimming)
 */
function supportsStreamCopy(extension: string): boolean {
  // These formats support stream copy well
  const supportedFormats = ['mp4', 'mov', 'mkv', 'webm', 'avi'];
  return supportedFormats.includes(extension.toLowerCase());
}

export interface TrimOptions {
  file: File | Blob;
  fileName: string;
  mimeType: string;
  startTime: number;
  endTime: number;
  onProgress?: (progress: number) => void;
}

export interface TrimResult {
  blob: Blob;
  fileName: string;
  mimeType: string;
  duration: number;
}

/**
 * Trim video using FFmpeg.wasm - preserves original format
 * Uses stream copy for fast, lossless trimming when possible
 */
export async function trimVideo(options: TrimOptions): Promise<TrimResult> {
  const { file, fileName, mimeType, startTime, endTime, onProgress } = options;
  
  const duration = endTime - startTime;
  if (duration < 0.1) {
    throw new Error('Trim duration too short');
  }

  onProgress?.(5);

  // Load FFmpeg if not already loaded
  const ff = await loadFFmpeg((p) => {
    // Loading progress: 5-20%
    onProgress?.(5 + Math.round(p * 0.15));
  });

  onProgress?.(20);

  // Determine file extension and output format
  const inputExt = getFileExtension(fileName, mimeType);
  const outputExt = inputExt; // Preserve original format
  const inputFileName = `input.${inputExt}`;
  const outputFileName = `output.${outputExt}`;

  // Set up progress handler for transcoding
  ff.on('progress', ({ progress, time }) => {
    // Transcoding progress: 25-90%
    const p = Math.min(progress, 1);
    onProgress?.(25 + Math.round(p * 65));
  });

  try {
    // Write input file to FFmpeg virtual filesystem
    const fileData = await fetchFile(file);
    await ff.writeFile(inputFileName, fileData);
    
    onProgress?.(25);

    // Build FFmpeg command
    // Use -ss before -i for fast seeking, then -t for duration
    // -c copy attempts stream copy (no re-encoding) for speed
    // -avoid_negative_ts make_zero fixes timestamp issues
    const ffmpegArgs = [
      '-ss', startTime.toFixed(3),           // Seek to start time
      '-i', inputFileName,                    // Input file
      '-t', duration.toFixed(3),              // Duration to copy
      '-c', 'copy',                           // Stream copy (no re-encoding)
      '-avoid_negative_ts', 'make_zero',      // Fix timestamp issues
      '-y',                                   // Overwrite output
      outputFileName
    ];

    console.log('FFmpeg command:', ffmpegArgs.join(' '));
    
    // Execute FFmpeg command
    await ff.exec(ffmpegArgs);
    
    onProgress?.(90);

    // Read output file
    const outputData = await ff.readFile(outputFileName);
    
    // Clean up virtual filesystem
    try {
      await ff.deleteFile(inputFileName);
      await ff.deleteFile(outputFileName);
    } catch (e) {
      // Ignore cleanup errors
    }

    onProgress?.(95);

    // Create output blob with correct mime type
    const outputMimeType = mimeType; // Preserve original mime type
    // FFmpeg returns Uint8Array - create a new Uint8Array to ensure it's a proper BlobPart
    const outputBytes = new Uint8Array(outputData as Uint8Array);
    const outputBlob = new Blob([outputBytes], { type: outputMimeType });
    
    // Generate output filename
    const baseName = fileName.replace(/\.[^.]+$/, '');
    const outputName = `${baseName}_trimmed.${outputExt}`;

    onProgress?.(100);

    return {
      blob: outputBlob,
      fileName: outputName,
      mimeType: outputMimeType,
      duration
    };
  } catch (error: any) {
    console.error('FFmpeg trim error:', error);
    
    // If stream copy fails (e.g., seeking issues), try with re-encoding
    if (error.message?.includes('copy') || error.message?.includes('seek')) {
      console.log('Stream copy failed, attempting re-encode...');
      return trimVideoWithReencode(ff, options, inputFileName, outputFileName, outputExt);
    }
    
    throw new Error(`Video trimming failed: ${error.message}`);
  }
}

/**
 * Fallback: Trim with re-encoding (slower but more compatible)
 */
async function trimVideoWithReencode(
  ff: FFmpeg,
  options: TrimOptions,
  inputFileName: string,
  outputFileName: string,
  outputExt: string
): Promise<TrimResult> {
  const { file, fileName, mimeType, startTime, endTime, onProgress } = options;
  const duration = endTime - startTime;

  try {
    // Write input file again if needed
    const fileData = await fetchFile(file);
    await ff.writeFile(inputFileName, fileData);

    // Re-encode with reasonable quality
    const ffmpegArgs = [
      '-ss', startTime.toFixed(3),
      '-i', inputFileName,
      '-t', duration.toFixed(3),
      '-c:v', 'libx264',                      // H.264 video codec
      '-preset', 'fast',                       // Fast encoding
      '-crf', '23',                            // Good quality (lower = better)
      '-c:a', 'aac',                           // AAC audio codec
      '-b:a', '128k',                          // Audio bitrate
      '-movflags', '+faststart',               // Web-optimized MP4
      '-y',
      outputFileName.replace(/\.[^.]+$/, '.mp4') // Output as MP4 for re-encode
    ];

    await ff.exec(ffmpegArgs);

    const actualOutputFile = outputFileName.replace(/\.[^.]+$/, '.mp4');
    const outputData = await ff.readFile(actualOutputFile);

    // Clean up
    try {
      await ff.deleteFile(inputFileName);
      await ff.deleteFile(actualOutputFile);
    } catch (e) { /* ignore */ }

    // FFmpeg returns Uint8Array - create a new Uint8Array to ensure it's a proper BlobPart
    const outputBytes = new Uint8Array(outputData as Uint8Array);
    const outputBlob = new Blob([outputBytes], { type: 'video/mp4' });
    const baseName = fileName.replace(/\.[^.]+$/, '');
    const outputName = `${baseName}_trimmed.mp4`;

    onProgress?.(100);

    return {
      blob: outputBlob,
      fileName: outputName,
      mimeType: 'video/mp4',
      duration
    };
  } catch (error: any) {
    throw new Error(`Video re-encoding failed: ${error.message}`);
  }
}

/**
 * Check if FFmpeg.wasm is supported in this browser
 */
export function isFFmpegSupported(): boolean {
  return typeof SharedArrayBuffer !== 'undefined' && 
         typeof WebAssembly !== 'undefined';
}

/**
 * Preload FFmpeg to avoid delay on first trim
 */
export function preloadFFmpeg(): void {
  if (isFFmpegSupported()) {
    loadFFmpeg().catch(console.error);
  }
}

/**
 * Check if a file is already WebM format
 */
export function isWebMFormat(file: File | Blob, fileName?: string): boolean {
  if (file.type === 'video/webm') return true;
  if (fileName?.toLowerCase().endsWith('.webm')) return true;
  return false;
}

export interface ConvertOptions {
  file: File | Blob;
  fileName: string;
  onProgress?: (progress: number) => void;
  /** Target quality (0-51, lower = better, default 28 for good balance) */
  quality?: number;
  /** Max width to scale down to (maintains aspect ratio) */
  maxWidth?: number;
}

export interface ConvertResult {
  blob: Blob;
  fileName: string;
  mimeType: string;
  originalSize: number;
  convertedSize: number;
  compressionRatio: number;
}

/**
 * Convert/compress video for efficient storage
 * Uses available codecs in FFmpeg.wasm (tries multiple approaches)
 */
export async function convertToWebM(options: ConvertOptions): Promise<ConvertResult> {
  const { file, fileName, onProgress, quality = 28, maxWidth } = options;
  
  // Skip if already WebM (assume it's already optimized)
  if (isWebMFormat(file, fileName)) {
    console.log('Video is already WebM, skipping conversion');
    return {
      blob: file instanceof File ? file : new Blob([file], { type: 'video/webm' }),
      fileName: fileName.replace(/\.[^.]+$/, '.webm'),
      mimeType: 'video/webm',
      originalSize: file.size,
      convertedSize: file.size,
      compressionRatio: 1
    };
  }

  onProgress?.(5);

  // Load FFmpeg
  const ff = await loadFFmpeg((p) => {
    onProgress?.(5 + Math.round(p * 0.1));
  });

  onProgress?.(15);

  // Get file extension
  const extMatch = fileName.match(/\.([^.]+)$/);
  const inputExt = extMatch ? extMatch[1].toLowerCase() : 'mp4';
  const inputFileName = `input.${inputExt}`;

  // Set up progress handler
  ff.on('progress', ({ progress }) => {
    // Conversion progress: 20-90%
    const p = Math.min(progress, 1);
    onProgress?.(20 + Math.round(p * 70));
  });

  try {
    // Write input file
    const fileData = await fetchFile(file);
    await ff.writeFile(inputFileName, fileData);

    onProgress?.(20);

    // Try to compress using available codecs
    // First try: MP4 with libx264 (most compatible with ffmpeg.wasm)
    let outputExt = 'mp4';
    let outputMime = 'video/mp4';
    let outputFile = 'output.mp4';
    
    // Calculate target bitrate based on quality (lower quality = more compression)
    // quality 28 = ~1.5Mbps, quality 35 = ~800kbps
    const targetBitrate = Math.max(400, Math.round(2500 - (quality * 60)));
    
    const ffmpegArgs = [
      '-i', inputFileName,
      '-c:v', 'libx264',               // H.264 video codec
      '-preset', 'fast',               // Encoding speed
      '-crf', quality.toString(),      // Quality (0-51, lower = better, 23 is default)
      '-c:a', 'aac',                   // AAC audio codec
      '-b:a', '96k',                   // Audio bitrate
      '-ac', '2',                      // Stereo audio
      '-movflags', '+faststart',       // Web-optimized MP4
    ];

    // Add scaling if maxWidth specified
    if (maxWidth) {
      ffmpegArgs.push('-vf', `scale='min(${maxWidth},iw)':-2`);
    }

    ffmpegArgs.push('-y', outputFile);

    console.log('FFmpeg compression:', ffmpegArgs.join(' '));

    // Execute conversion
    await ff.exec(ffmpegArgs);

    onProgress?.(90);

    // Read output
    const outputData = await ff.readFile(outputFile);

    // Clean up
    try {
      await ff.deleteFile(inputFileName);
      await ff.deleteFile(outputFile);
    } catch (e) { /* ignore */ }

    onProgress?.(95);

    // Create output blob
    const outputBytes = new Uint8Array(outputData as Uint8Array);
    const outputBlob = new Blob([outputBytes], { type: outputMime });

    // Generate output filename
    const baseName = fileName.replace(/\.[^.]+$/, '');
    const outputName = `${baseName}_compressed.${outputExt}`;

    const originalSize = file.size;
    const convertedSize = outputBlob.size;
    const compressionRatio = originalSize / convertedSize;

    console.log(`Video compressed: ${(originalSize / 1024 / 1024).toFixed(2)}MB → ${(convertedSize / 1024 / 1024).toFixed(2)}MB (${compressionRatio.toFixed(1)}x compression)`);

    onProgress?.(100);

    return {
      blob: outputBlob,
      fileName: outputName,
      mimeType: outputMime,
      originalSize,
      convertedSize,
      compressionRatio
    };
  } catch (error: any) {
    console.error('Video compression error:', error);
    throw new Error(`Video compression failed: ${error?.message || 'Unknown error'}`);
  }
}

/**
 * Compress video with fast settings (for quick uploads)
 * Uses higher CRF for faster encoding, smaller files
 */
export async function convertToWebMFast(options: Omit<ConvertOptions, 'quality'>): Promise<ConvertResult> {
  return convertToWebM({
    ...options,
    quality: 32, // Higher CRF = faster encoding, smaller files, lower quality
  });
}
