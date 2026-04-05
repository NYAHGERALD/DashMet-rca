import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Request, Response, NextFunction } from 'express';
import { ValidationError } from './errorHandler';

// Phase 0.4: Secure File Upload Validation

// Max file size: 50MB to accommodate videos
// Frontend limits: Photos 10MB, Videos 50MB, Documents 25MB, Voice 25MB
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || '52428800'); // 50MB

// Use memory storage for cloud deployment (Railway, Render, etc.)
// Files are stored in memory buffer and uploaded directly to Firebase Storage
const storage = multer.memoryStorage();

const fileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  // Allowed file types
  const allowedTypes = [
    // Images
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/heic',
    'image/heif',
    // Videos
    'video/mp4',
    'video/mpeg',
    'video/quicktime',
    'video/x-msvideo',
    'video/webm',  // For trimmed videos
    'video/x-matroska',
    'video/3gpp',
    // Documents
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',  // .txt files
    'text/csv',    // .csv files
    // Audio (for voice recordings)
    'audio/mpeg',
    'audio/wav',
    'audio/webm',
    'audio/mp4',
    'audio/ogg',
    'audio/x-m4a',
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new ValidationError(
        `File type ${file.mimetype} is not allowed. Allowed types: images, videos, documents, audio.`
      )
    );
  }
};

export const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
  fileFilter,
});

// Multer error handler middleware
export const handleMulterError = (err: any, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: `File too large. Maximum allowed size is ${MAX_FILE_SIZE / (1024 * 1024)}MB.`,
        timestamp: new Date().toISOString(),
      });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        error: 'Too many files uploaded.',
        timestamp: new Date().toISOString(),
      });
    }
    return res.status(400).json({
      success: false,
      error: `Upload error: ${err.message}`,
      timestamp: new Date().toISOString(),
    });
  }
  // Pass other errors to next error handler
  next(err);
};

// Specific upload configurations
export const uploadSingle = upload.single('file');
export const uploadMultiple = upload.array('files', 10);
export const uploadEvidence = upload.fields([
  { name: 'photos', maxCount: 10 },
  { name: 'videos', maxCount: 5 },
  { name: 'documents', maxCount: 5 },
  { name: 'voiceRecordings', maxCount: 3 },
]);

// Magic-byte signatures for file content validation
const MAGIC_BYTES: Record<string, number[][]> = {
  'image/jpeg': [[0xFF, 0xD8, 0xFF]],
  'image/png': [[0x89, 0x50, 0x4E, 0x47]],
  'image/gif': [[0x47, 0x49, 0x46, 0x38]],
  'image/webp': [[0x52, 0x49, 0x46, 0x46]], // RIFF header
  'application/pdf': [[0x25, 0x50, 0x44, 0x46]], // %PDF
  'video/mp4': [[0x00, 0x00, 0x00], [0x66, 0x74, 0x79, 0x70]], // ftyp (offset 4)
  'audio/mpeg': [[0xFF, 0xFB], [0xFF, 0xF3], [0xFF, 0xF2], [0x49, 0x44, 0x33]], // MP3 + ID3
};

function validateMagicBytes(buffer: Buffer, mimetype: string): boolean {
  const signatures = MAGIC_BYTES[mimetype];
  if (!signatures) return true; // No signature to check — allow by default
  return signatures.some(sig =>
    sig.every((byte, i) => {
      // MP4 ftyp signature starts at offset 4
      const offset = mimetype === 'video/mp4' && sig[0] === 0x66 ? i + 4 : i;
      return buffer.length > offset && buffer[offset] === byte;
    })
  );
}

// Middleware to validate file content matches declared MIME type
export const validateFileContent = (req: Request, res: Response, next: NextFunction) => {
  const files: Express.Multer.File[] = [];

  if (req.file) files.push(req.file);
  if (req.files) {
    if (Array.isArray(req.files)) {
      files.push(...req.files);
    } else {
      Object.values(req.files).forEach(arr => files.push(...arr));
    }
  }

  for (const file of files) {
    if (file.buffer && file.buffer.length > 0) {
      if (!validateMagicBytes(file.buffer, file.mimetype)) {
        return res.status(400).json({
          success: false,
          error: 'File content does not match its declared type.',
          timestamp: new Date().toISOString(),
        });
      }
    }
  }

  next();
};
