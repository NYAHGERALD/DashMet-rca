import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Request, Response, NextFunction } from 'express';
import { ValidationError } from './errorHandler';

// Phase 0.4: Secure File Upload Validation

// Max file size: 50MB to accommodate videos
// Frontend limits: Photos 10MB, Videos 50MB, Documents 25MB, Voice 25MB
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || '52428800'); // 50MB

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, process.env.UPLOAD_PATH || './uploads');
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

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
