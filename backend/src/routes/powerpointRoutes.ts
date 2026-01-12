/**
 * PowerPoint Generation Routes
 * API endpoints for generating and downloading RCA PowerPoint reports
 */

import express, { Request, Response } from 'express';
import { generateRCAPowerPoint, getRCADataForPowerPoint } from '../services/powerpointService';
import { authenticate } from '../middleware/auth';
import { prisma } from '../utils/prisma';
import * as path from 'path';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import * as admin from 'firebase-admin';

const router = express.Router();

// In-memory job tracking (in production, use Redis or database)
interface GenerationJob {
  id: string;
  rcaId: string;
  userId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  currentStep: string;
  message: string;
  filePath?: string;
  fileName?: string;
  fileSize?: number;
  firebaseUrl?: string;
  error?: string;
  createdAt: Date;
  completedAt?: Date;
}

const jobs = new Map<string, GenerationJob>();

// Cleanup old jobs periodically (every hour)
setInterval(() => {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  for (const [jobId, job] of jobs.entries()) {
    if (job.createdAt.getTime() < oneHourAgo) {
      // Clean up file if exists
      if (job.filePath && fs.existsSync(job.filePath)) {
        fs.unlinkSync(job.filePath);
      }
      jobs.delete(jobId);
    }
  }
}, 60 * 60 * 1000);

/**
 * Start PowerPoint generation
 * POST /api/powerpoint/generate/:rcaId
 */
router.post('/generate/:rcaId', authenticate, async (req: Request, res: Response) => {
  try {
    const { rcaId } = req.params;
    const userId = (req as any).user?.id || 'unknown';

    // Validate RCA exists and user has access
    const rca = await prisma.rCAAnalysis.findUnique({
      where: { id: rcaId },
      include: {
        Incident: {
          select: { incidentNumber: true },
        },
      },
    });

    if (!rca) {
      return res.status(404).json({
        success: false,
        error: 'RCA not found',
      });
    }

    // Create job
    const jobId = uuidv4();
    const job: GenerationJob = {
      id: jobId,
      rcaId,
      userId,
      status: 'pending',
      progress: 0,
      currentStep: 'queued',
      message: 'PowerPoint generation queued...',
      createdAt: new Date(),
    };

    jobs.set(jobId, job);

    // Start generation in background
    processGeneration(jobId, rcaId);

    res.json({
      success: true,
      jobId,
      message: 'PowerPoint generation started',
    });
  } catch (error: any) {
    console.error('Failed to start PowerPoint generation:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to start PowerPoint generation',
    });
  }
});

/**
 * Get generation status
 * GET /api/powerpoint/status/:jobId
 */
router.get('/status/:jobId', authenticate, async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const job = jobs.get(jobId);

    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Job not found',
      });
    }

    res.json({
      success: true,
      job: {
        id: job.id,
        status: job.status,
        progress: job.progress,
        currentStep: job.currentStep,
        message: job.message,
        fileName: job.fileName,
        fileSize: job.fileSize,
        error: job.error,
        createdAt: job.createdAt,
        completedAt: job.completedAt,
      },
    });
  } catch (error: any) {
    console.error('Failed to get job status:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get job status',
    });
  }
});

/**
 * Download generated PowerPoint
 * GET /api/powerpoint/download/:jobId
 */
router.get('/download/:jobId', authenticate, async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const job = jobs.get(jobId);

    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Job not found',
      });
    }

    if (job.status !== 'completed' || !job.filePath) {
      return res.status(400).json({
        success: false,
        error: 'PowerPoint not ready for download',
      });
    }

    if (!fs.existsSync(job.filePath)) {
      return res.status(404).json({
        success: false,
        error: 'File not found',
      });
    }

    res.download(job.filePath, job.fileName || 'RCA_Report.pptx');
  } catch (error: any) {
    console.error('Failed to download PowerPoint:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to download PowerPoint',
    });
  }
});

/**
 * Save PowerPoint to Firebase
 * POST /api/powerpoint/save/:jobId
 */
router.post('/save/:jobId', authenticate, async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const job = jobs.get(jobId);

    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Job not found',
      });
    }

    if (job.status !== 'completed' || !job.filePath) {
      return res.status(400).json({
        success: false,
        error: 'PowerPoint not ready for saving',
      });
    }

    if (!fs.existsSync(job.filePath)) {
      return res.status(404).json({
        success: false,
        error: 'File not found',
      });
    }

    // Upload to Firebase Storage
    const bucket = admin.storage().bucket();
    const destination = `powerpoint-reports/${job.rcaId}/${job.fileName}`;
    
    await bucket.upload(job.filePath, {
      destination,
      metadata: {
        contentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        metadata: {
          rcaId: job.rcaId,
          generatedAt: new Date().toISOString(),
          generatedBy: job.userId,
        },
      },
    });

    // Get signed URL
    const file = bucket.file(destination);
    const [url] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    job.firebaseUrl = url;

    // Create evidence record
    const rcaData = await getRCADataForPowerPoint(job.rcaId);
    if (rcaData) {
      await prisma.evidence.create({
        data: {
          type: 'DOCUMENT',
          fileName: job.fileName || 'RCA_Report.pptx',
          mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          fileSize: job.fileSize || 0,
          filePath: destination,
          uploadedById: job.userId,
          uploadedAt: new Date(),
          incidentId: rcaData.incident.id,
          rcaAnalysisId: job.rcaId,
        },
      });
    }

    res.json({
      success: true,
      firebaseUrl: url,
      message: 'PowerPoint saved to Firebase successfully',
    });
  } catch (error: any) {
    console.error('Failed to save PowerPoint to Firebase:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to save PowerPoint to Firebase',
    });
  }
});

/**
 * Get previous PowerPoint reports for an RCA
 * GET /api/powerpoint/history/:rcaId
 */
router.get('/history/:rcaId', authenticate, async (req: Request, res: Response) => {
  try {
    const { rcaId } = req.params;

    const reports = await prisma.evidence.findMany({
      where: {
        rcaAnalysisId: rcaId,
        mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      },
      orderBy: {
        uploadedAt: 'desc',
      },
      take: 10,
    });

    res.json({
      success: true,
      reports,
    });
  } catch (error: any) {
    console.error('Failed to get PowerPoint history:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get PowerPoint history',
    });
  }
});

/**
 * Download a saved PowerPoint report from Firebase
 * GET /api/powerpoint/download-saved/:evidenceId
 */
router.get('/download-saved/:evidenceId', authenticate, async (req: Request, res: Response) => {
  try {
    const { evidenceId } = req.params;

    // Find the evidence record
    const evidence = await prisma.evidence.findUnique({
      where: { id: evidenceId },
    });

    if (!evidence) {
      return res.status(404).json({
        success: false,
        error: 'Report not found',
      });
    }

    // Generate signed URL from Firebase
    const bucket = admin.storage().bucket();
    const file = bucket.file(evidence.filePath);

    // Check if file exists
    const [exists] = await file.exists();
    if (!exists) {
      return res.status(404).json({
        success: false,
        error: 'File not found in storage',
      });
    }

    // Generate signed URL valid for 1 hour
    const [url] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + 60 * 60 * 1000, // 1 hour
      responseDisposition: `attachment; filename="${evidence.fileName}"`,
    });

    res.json({
      success: true,
      url,
      fileName: evidence.fileName,
    });
  } catch (error: any) {
    console.error('Failed to get download URL:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get download URL',
    });
  }
});

/**
 * Process PowerPoint generation in background
 */
async function processGeneration(jobId: string, rcaId: string): Promise<void> {
  const job = jobs.get(jobId);
  if (!job) return;

  job.status = 'processing';
  job.message = 'Starting PowerPoint generation...';

  try {
    const result = await generateRCAPowerPoint(rcaId, (step, progress, message) => {
      job.currentStep = step;
      job.progress = progress;
      job.message = message;
    });

    if (result.success) {
      job.status = 'completed';
      job.filePath = result.filePath;
      job.fileName = result.fileName;
      job.fileSize = result.fileSize;
      job.completedAt = new Date();
      job.message = 'PowerPoint generation completed successfully!';
    } else {
      job.status = 'failed';
      job.error = result.error;
      job.message = `Generation failed: ${result.error}`;
    }
  } catch (error: any) {
    job.status = 'failed';
    job.error = error.message;
    job.message = `Generation failed: ${error.message}`;
  }
}

export default router;
