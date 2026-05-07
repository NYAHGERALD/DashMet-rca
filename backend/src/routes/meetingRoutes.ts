/**
 * Meeting Routes for Meeting Intelligence Mobile App
 * 
 * Endpoints:
 * - POST   /api/mobile/meetings           - Create a new meeting (draft)
 * - GET    /api/mobile/meetings           - Get meetings for user
 * - GET    /api/mobile/meetings/:id       - Get single meeting by ID
 * - PATCH  /api/mobile/meetings/:id       - Update meeting (status, details)
 * - DELETE /api/mobile/meetings/:id       - Delete a meeting
 * - POST   /api/mobile/meetings/:id/bookmarks - Add a bookmark during recording
 * - POST   /api/mobile/meetings/:id/participants - Add a participant
 * - PATCH  /api/mobile/meetings/:id/upload - Mark meeting as uploaded with recording URL
 */

import { Router, Request, Response } from 'express';
import multer from 'multer';
import { PrismaClient, MeetingStatus, MeetingType } from '@prisma/client';
import {
  createSignedMeetingAudioUrl,
  deleteMeetingAudioObject,
  downloadMeetingAudioBuffer,
  getOrCreateMeetingRecordingRetentionPolicy,
  uploadMeetingAudioToFirebase,
} from '../services/meetingRecordingStorageService';

const router = Router();
const prisma = new PrismaClient();

const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 500 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    const allowedMimes = [
      'audio/mpeg',
      'audio/mp3',
      'audio/mp4',
      'audio/m4a',
      'audio/wav',
      'audio/webm',
      'audio/ogg',
      'audio/flac',
      'audio/x-m4a',
      'audio/aac',
      'video/mp4',
      'video/webm',
    ];

    if (
      allowedMimes.includes(file.mimetype) ||
      /\.(mp3|mp4|m4a|wav|webm|ogg|flac|mpeg|mpga|aac)$/i.test(file.originalname)
    ) {
      cb(null, true);
      return;
    }

    cb(new Error('Invalid file type. Please upload an audio recording.'));
  },
});

const SUPPORTED_MEETING_TYPES = new Set<MeetingType>([
  'GENERAL',
  'STANDUP',
  'ONE_ON_ONE',
  'TEAM_SYNC',
  'CLIENT_CALL',
  'INTERVIEW',
  'BRAINSTORM',
  'REVIEW',
  'OTHER',
  'MANUAL',
]);

const MEETING_TYPE_ALIASES: Record<string, MeetingType> = {
  CLIENT: 'CLIENT_CALL',
  DAILY_STANDUP: 'STANDUP',
  INCIDENT_REVIEW: 'REVIEW',
  PLANNING: 'REVIEW',
  PRODUCTION: 'REVIEW',
  QUALITY: 'REVIEW',
  RCA: 'REVIEW',
  RETROSPECTIVE: 'REVIEW',
  SAFETY: 'REVIEW',
  SAFETY_BRIEFING: 'REVIEW',
  TRAINING: 'REVIEW',
};

function normalizeMeetingType(value: unknown): MeetingType {
  if (typeof value !== 'string') return 'GENERAL';

  const normalized = value.trim().toUpperCase();
  if (SUPPORTED_MEETING_TYPES.has(normalized as MeetingType)) return normalized as MeetingType;

  return MEETING_TYPE_ALIASES[normalized] || 'GENERAL';
}

function currentUser(req: Request) {
  return (req as any).user as { id: string; role: string; organizationId?: string | null } | undefined;
}

function canAccessMeeting(
  user: ReturnType<typeof currentUser>,
  meeting: { creatorId: string; organizationId: string },
) {
  if (!user) return false;
  if (meeting.creatorId === user.id) return true;
  if (user.role === 'SYSTEM_ADMIN') return true;
  if (['ADMIN', 'CI_MANAGER'].includes(user.role) && user.organizationId === meeting.organizationId) return true;
  return false;
}

function parseOptionalDate(value: unknown) {
  if (!value) return null;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseOptionalDuration(value: unknown) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function normalizeTranscriptionLanguage(value: unknown) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw || raw === 'auto' || raw === 'english' || raw === 'en') return undefined;
  if (/^[a-z]{2,3}(-[a-z]{2})?$/.test(raw)) return raw;
  return undefined;
}

function normalizeMeetingTypeForTranscription(value: unknown) {
  return String(value || 'general')
    .trim()
    .toLowerCase()
    .replace(/_/g, '-')
    .replace(/[^a-z0-9-]/g, '') || 'general';
}

// ============================================================================
// POST /api/mobile/meetings
// Create a new meeting (starts as DRAFT)
// ============================================================================
router.post('/', async (req: Request, res: Response) => {
  try {
    const { 
      title, 
      meetingType,
      location,
      locationType,
      tags,
      language,
      scheduledAt,
      departmentId,
      objective,
      agendaItems,
      liveTranscriptionEnabled,
      aiProcessingMode,
      confidentialityLevel,
      participants,
      creatorId, 
      organizationId, 
      facilityId 
    } = req.body;

    if (!creatorId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: creatorId',
      });
    }

    // Look up creator by Prisma UUID or Firebase UID
    const creator = await prisma.user.findFirst({
      where: {
        OR: [
          { id: creatorId },
          { firebaseUid: creatorId },
        ],
      },
    });

    if (!creator) {
      return res.status(404).json({
        success: false,
        error: 'Creator not found',
      });
    }

    // Resolve organizationId: use provided value, fall back to creator's org, then first org in DB
    let resolvedOrgId = organizationId || creator.organizationId;
    if (!resolvedOrgId) {
      const fallbackOrg = await prisma.organization.findFirst({ select: { id: true } });
      resolvedOrgId = fallbackOrg?.id || null;
    }
    if (!resolvedOrgId) {
      return res.status(400).json({
        success: false,
        error: 'No organization found. Please set up an organization first.',
      });
    }

    const meeting = await prisma.meeting.create({
      data: {
        title: title?.trim() || null,
        meetingType: normalizeMeetingType(meetingType),
        status: 'DRAFT',
        location: location?.trim() || null,
        locationType: locationType || null,
        tags: tags || [],
        language: language || 'en',
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        departmentId: departmentId || null,
        objective: objective?.trim() || null,
        agendaItems: agendaItems || [],
        liveTranscriptionEnabled: liveTranscriptionEnabled !== false,
        aiProcessingMode: aiProcessingMode || null,
        confidentialityLevel: confidentialityLevel || null,
        creatorId: creator.id,
        organizationId: resolvedOrgId,
        facilityId: facilityId || null,
      },
      include: {
        creator: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        department: {
          select: { id: true, name: true },
        },
        participants: true,
        bookmarks: true,
        _count: { select: { actionItems: true } },
      },
    });

    // If participants were provided, add them
    if (participants && Array.isArray(participants) && participants.length > 0) {
      await prisma.meetingParticipant.createMany({
        data: participants.map((p: any) => ({
          meetingId: meeting.id,
          userId: p.userId || null,
          name: p.name || null,
          email: p.email || null,
          phone: p.phone || null,
        })),
      });
      
      // Re-fetch meeting with participants
      const updatedMeeting = await prisma.meeting.findUnique({
        where: { id: meeting.id },
        include: {
          creator: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          department: {
            select: { id: true, name: true },
          },
          participants: true,
          bookmarks: true,
          _count: { select: { actionItems: true } },
        },
      });
      
      return res.status(201).json({ success: true, meeting: updatedMeeting });
    }

    return res.status(201).json({ success: true, meeting });
  } catch (error: any) {
    console.error('Create meeting error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create meeting',
    });
  }
});

// ============================================================================
// GET /api/mobile/meetings
// Get meetings for a user (created by them)
// ============================================================================
router.get('/', async (req: Request, res: Response) => {
  try {
    const { userId, status, limit = '50', offset = '0' } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId is required',
      });
    }

    // Resolve userId — could be Prisma UUID or Firebase UID
    const resolvedUser = await prisma.user.findFirst({
      where: {
        OR: [
          { id: userId as string },
          { firebaseUid: userId as string },
        ],
      },
      select: { id: true },
    });

    const resolvedUserId = resolvedUser?.id || (userId as string);

    let whereClause: any = { creatorId: resolvedUserId };
    if (status) {
      whereClause.status = status as MeetingStatus;
    }

    const meetings = await prisma.meeting.findMany({
      where: whereClause,
      include: {
        creator: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        department: {
          select: { id: true, name: true },
        },
        participants: {
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true, email: true },
            },
          },
        },
        bookmarks: { orderBy: { timestamp: 'asc' } },
        summary: {
          select: { rawTranscript: true, narrative: true, briefSummary: true },
        },
        _count: { select: { actionItems: true, transcript: true } },
      },
      orderBy: [{ createdAt: 'desc' }],
      take: parseInt(limit as string),
      skip: parseInt(offset as string),
    });

    // Add hasTranscript and hasAISummary flags for each meeting
    const meetingsWithFlags = meetings.map(m => ({
      ...m,
      hasTranscript: !!(m.summary?.rawTranscript || m._count?.transcript > 0),
      hasAISummary: !!(m.summary?.narrative || m.summary?.briefSummary),
    }));

    const totalCount = await prisma.meeting.count({ where: whereClause });

    return res.json({
      success: true,
      meetings: meetingsWithFlags,
      count: meetings.length,
      totalCount,
    });
  } catch (error: any) {
    console.error('Get meetings error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch meetings',
    });
  }
});

// ============================================================================
// GET /api/mobile/meetings/:id
// Get a single meeting by ID with full details
// ============================================================================
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const meeting = await prisma.meeting.findUnique({
      where: { id },
      include: {
        creator: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        department: {
          select: { id: true, name: true },
        },
        participants: {
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true, email: true },
            },
          },
        },
        bookmarks: { orderBy: { timestamp: 'asc' } },
        transcript: { orderBy: { startTime: 'asc' } },
        summary: true,
        actionItems: {
          select: {
            id: true,
            title: true,
            description: true,
            status: true,
            priority: true,
            dueDate: true,
            isAiExtracted: true,
            sourceText: true,
            createdAt: true,
            owner: {
              select: { id: true, firstName: true, lastName: true, email: true },
            },
            assignee: {
              select: { id: true, firstName: true, lastName: true, email: true },
            },
          },
        },
        attachments: true,
      },
    });

    if (!meeting) {
      return res.status(404).json({
        success: false,
        error: 'Meeting not found',
      });
    }

    // Flatten summary data into meeting response for web app compatibility
    const response: any = {
      ...meeting,
      rawTranscript: meeting.summary?.rawTranscript || null,
      hasTranscript: !!(meeting.summary?.rawTranscript || meeting.transcript?.length > 0),
      hasAISummary: !!(meeting.summary?.narrative || meeting.summary?.briefSummary),
    };

    return res.json({ success: true, meeting: response });
  } catch (error: any) {
    console.error('Get meeting error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch meeting',
    });
  }
});

// ============================================================================
// PATCH /api/mobile/meetings/:id
// Update a meeting (status, title, etc.)
// ============================================================================
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { 
      title, 
      meetingType,
      location,
      tags,
      language,
      status,
      recordingUrl,
      duration,
      recordedAt,
      processingError
    } = req.body;

    const existingMeeting = await prisma.meeting.findUnique({
      where: { id },
    });

    if (!existingMeeting) {
      return res.status(404).json({
        success: false,
        error: 'Meeting not found',
      });
    }

    const user = currentUser(req);
    if (!canAccessMeeting(user, existingMeeting)) {
      return res.status(403).json({
        success: false,
        error: 'You do not have access to this meeting',
      });
    }

    const updateData: any = {};
    
    if (title !== undefined) updateData.title = title?.trim() || null;
    if (meetingType !== undefined) updateData.meetingType = meetingType;
    if (location !== undefined) updateData.location = location?.trim() || null;
    if (tags !== undefined) updateData.tags = tags;
    if (language !== undefined) updateData.language = language;
    if (recordingUrl !== undefined) updateData.recordingUrl = recordingUrl;
    if (duration !== undefined) updateData.duration = duration;
    if (recordedAt !== undefined) updateData.recordedAt = recordedAt ? new Date(recordedAt) : null;
    if (processingError !== undefined) updateData.processingError = processingError;
    
    if (status !== undefined) {
      updateData.status = status;
      
      if (status === MeetingStatus.PROCESSING && existingMeeting.status !== MeetingStatus.PROCESSING) {
        updateData.processingStartedAt = new Date();
      }
      if ((status === MeetingStatus.READY || status === MeetingStatus.NEEDS_REVIEW) 
          && existingMeeting.status === MeetingStatus.PROCESSING) {
        updateData.processingCompletedAt = new Date();
      }
      if (status === MeetingStatus.PUBLISHED && !existingMeeting.publishedAt) {
        updateData.publishedAt = new Date();
      }
    }

    let meeting = await prisma.meeting.update({
      where: { id },
      data: updateData,
      include: {
        creator: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        participants: true,
        bookmarks: { orderBy: { timestamp: 'asc' } },
        _count: { select: { actionItems: true, transcript: true } },
      },
    });

    if (
      status === MeetingStatus.READY &&
      meeting.recordingDeletedAt === null &&
      (meeting.recordingStoragePath || meeting.recordingUrl?.startsWith('gs://'))
    ) {
      const retentionPolicy = await getOrCreateMeetingRecordingRetentionPolicy(meeting.organizationId);
      if (retentionPolicy.audioRetentionMode === 'DELETE_AFTER_TRANSCRIPTION') {
        await deleteMeetingAudioObject(meeting);
        meeting = await prisma.meeting.update({
          where: { id },
          data: {
            recordingUrl: null,
            recordingDeletedAt: new Date(),
            recordingDeletionReason: 'transcription_complete',
          },
          include: {
            creator: {
              select: { id: true, firstName: true, lastName: true, email: true },
            },
            participants: true,
            bookmarks: { orderBy: { timestamp: 'asc' } },
            _count: { select: { actionItems: true, transcript: true } },
          },
        });
      }
    }

    return res.json({ success: true, meeting });
  } catch (error: any) {
    console.error('Update meeting error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update meeting',
    });
  }
});

// ============================================================================
// DELETE /api/mobile/meetings/:id
// Delete a meeting and all related data
// ============================================================================
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const existingMeeting = await prisma.meeting.findUnique({
      where: { id },
    });

    if (!existingMeeting) {
      return res.status(404).json({
        success: false,
        error: 'Meeting not found',
      });
    }

    const user = currentUser(req);
    if (!canAccessMeeting(user, existingMeeting)) {
      return res.status(403).json({
        success: false,
        error: 'You do not have access to this meeting',
      });
    }

    await deleteMeetingAudioObject(existingMeeting).catch((error) => {
      console.warn(`[MeetingRoutes] Failed to delete audio for meeting ${id}:`, error?.message || error);
    });
    await prisma.meeting.delete({ where: { id } });

    return res.json({
      success: true,
      message: 'Meeting deleted successfully',
    });
  } catch (error: any) {
    console.error('Delete meeting error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete meeting',
    });
  }
});

// ============================================================================
// POST /api/mobile/meetings/:id/bookmarks
// Add a bookmark during recording
// ============================================================================
router.post('/:id/bookmarks', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { timestamp, label, note } = req.body;

    const meeting = await prisma.meeting.findUnique({
      where: { id },
    });

    if (!meeting) {
      return res.status(404).json({
        success: false,
        error: 'Meeting not found',
      });
    }

    if (timestamp === undefined || timestamp === null || timestamp < 0) {
      return res.status(400).json({
        success: false,
        error: 'Valid timestamp is required',
      });
    }

    const bookmark = await prisma.meetingBookmark.create({
      data: {
        meetingId: id,
        timestamp: parseInt(timestamp),
        label: label?.trim() || null,
        note: note?.trim() || null,
      },
    });

    return res.status(201).json({ success: true, bookmark });
  } catch (error: any) {
    console.error('Create bookmark error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create bookmark',
    });
  }
});

// ============================================================================
// POST /api/mobile/meetings/:id/participants
// Add a participant to a meeting
// ============================================================================
router.post('/:id/participants', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { userId, name, email, phone, speakerLabel } = req.body;

    const meeting = await prisma.meeting.findUnique({
      where: { id },
    });

    if (!meeting) {
      return res.status(404).json({
        success: false,
        error: 'Meeting not found',
      });
    }

    if (!userId && !name) {
      return res.status(400).json({
        success: false,
        error: 'Either userId or name is required',
      });
    }

    if (userId) {
      // Resolve userId — could be Prisma UUID or Firebase UID
      const user = await prisma.user.findFirst({
        where: {
          OR: [
            { id: userId },
            { firebaseUid: userId },
          ],
        },
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found',
        });
      }
    }

    const participant = await prisma.meetingParticipant.create({
      data: {
        meetingId: id,
        userId: userId || null,
        name: name?.trim() || null,
        email: email?.trim() || null,
        phone: phone?.trim() || null,
        speakerLabel: speakerLabel || null,
      },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });

    return res.status(201).json({ success: true, participant });
  } catch (error: any) {
    console.error('Add participant error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to add participant',
    });
  }
});

// ============================================================================
// POST /api/mobile/meetings/:id/transcript
// Save transcript blocks for a meeting (raw, processed, or AI-generated)
// ============================================================================
router.post('/:id/transcript', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { blocks, rawText, processedText, type = 'raw' } = req.body;

    const existingMeeting = await prisma.meeting.findUnique({
      where: { id },
    });

    if (!existingMeeting) {
      return res.status(404).json({
        success: false,
        error: 'Meeting not found',
      });
    }

    // If blocks array provided, create TranscriptBlocks
    if (blocks && Array.isArray(blocks) && blocks.length > 0) {
      // Delete existing transcript blocks first
      await prisma.transcriptBlock.deleteMany({
        where: { meetingId: id },
      });

      // Create new blocks
      const createdBlocks = await prisma.transcriptBlock.createMany({
        data: blocks.map((block: any) => ({
          meetingId: id,
          speakerLabel: block.speakerLabel || 'Speaker 1',
          speakerId: block.speakerId || null,
          content: block.content || block.text,
          startTime: block.startTime || 0,
          endTime: block.endTime || 0,
          confidence: block.confidence || null,
        })),
      });

      // Also save combined transcript to MeetingSummary for web app compatibility
      const combinedTranscript = blocks.map((b: any) => b.content || b.text).join('\n\n');
      const wordCount = combinedTranscript.split(/\s+/).filter((w: string) => w.length > 0).length;
      await prisma.meetingSummary.upsert({
        where: { meetingId: id },
        update: {
          rawTranscript: combinedTranscript,
          transcriptWordCount: wordCount,
          transcriptSavedAt: new Date(),
        },
        create: {
          meetingId: id,
          rawTranscript: combinedTranscript,
          transcriptWordCount: wordCount,
          transcriptSavedAt: new Date(),
        },
      });

      return res.status(201).json({
        success: true,
        message: `Created ${createdBlocks.count} transcript blocks`,
        count: createdBlocks.count,
      });
    }

    // If rawText/processedText provided, create a single block
    if (rawText || processedText) {
      // Delete existing transcript blocks first
      await prisma.transcriptBlock.deleteMany({
        where: { meetingId: id },
      });

      const content = processedText || rawText;
      const block = await prisma.transcriptBlock.create({
        data: {
          meetingId: id,
          speakerLabel: 'Full Transcript',
          content: content,
          startTime: 0,
          endTime: existingMeeting.duration || 0,
          confidence: type === 'processed' ? 0.95 : 0.8,
        },
      });

      // Also save to MeetingSummary table for web app compatibility
      const wordCount = content.split(/\s+/).filter((w: string) => w.length > 0).length;
      await prisma.meetingSummary.upsert({
        where: { meetingId: id },
        update: {
          rawTranscript: rawText || content,
          processedTranscript: processedText || null,
          transcriptWordCount: wordCount,
          transcriptDuration: existingMeeting.duration || 0,
          transcriptSavedAt: new Date(),
        },
        create: {
          meetingId: id,
          rawTranscript: rawText || content,
          processedTranscript: processedText || null,
          transcriptWordCount: wordCount,
          transcriptDuration: existingMeeting.duration || 0,
          transcriptSavedAt: new Date(),
        },
      });

      return res.status(201).json({
        success: true,
        message: 'Transcript saved successfully',
        transcriptBlock: block,
      });
    }

    return res.status(400).json({
      success: false,
      error: 'Either blocks array or rawText/processedText is required',
    });
  } catch (error: any) {
    console.error('Save transcript error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to save transcript',
    });
  }
});

// ============================================================================
// POST /api/mobile/meetings/:id/summary
// Save AI-generated summary for a meeting
// ============================================================================
router.post('/:id/summary', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { executiveSummary, keyPoints, decisions, nextSteps } = req.body;

    const existingMeeting = await prisma.meeting.findUnique({
      where: { id },
    });

    if (!existingMeeting) {
      return res.status(404).json({
        success: false,
        error: 'Meeting not found',
      });
    }

    // Upsert summary (create or update)
    const summary = await prisma.meetingSummary.upsert({
      where: { meetingId: id },
      update: {
        executiveSummary: executiveSummary || null,
        keyPoints: keyPoints || null,
        decisions: decisions || null,
        nextSteps: nextSteps || null,
      },
      create: {
        meetingId: id,
        executiveSummary: executiveSummary || null,
        keyPoints: keyPoints || null,
        decisions: decisions || null,
        nextSteps: nextSteps || null,
      },
    });

    return res.status(201).json({
      success: true,
      message: 'Summary saved successfully',
      summary,
    });
  } catch (error: any) {
    console.error('Save summary error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to save summary',
    });
  }
});

// ============================================================================
// POST /api/mobile/meetings/:id/ai-summary
// Save AI Narrative Summary with all GPT-4o generated fields + TTS audio URL
// ============================================================================
router.post('/:id/ai-summary', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { 
      narrative,
      briefSummary,
      tone,
      objectives,
      keyDiscussions,
      actionItems,
      takeaways,
      audioUrl,
      audioVoice,
      audioDuration,
      generatedAt
    } = req.body;

    // Validate required fields
    if (!narrative || !briefSummary) {
      return res.status(400).json({
        success: false,
        error: 'narrative and briefSummary are required',
      });
    }

    const existingMeeting = await prisma.meeting.findUnique({
      where: { id },
    });

    if (!existingMeeting) {
      return res.status(404).json({
        success: false,
        error: 'Meeting not found',
      });
    }

    // Upsert AI summary (create or update)
    const summary = await prisma.meetingSummary.upsert({
      where: { meetingId: id },
      update: {
        // AI Narrative fields
        narrative: narrative,
        briefSummary: briefSummary,
        tone: tone || null,
        objectives: objectives || null,
        keyDiscussions: keyDiscussions || null,
        actionItems: actionItems || null,
        takeaways: takeaways || null,
        // AI Audio fields
        audioUrl: audioUrl || null,
        audioVoice: audioVoice || null,
        audioDuration: audioDuration || null,
        // Also set executiveSummary for backward compatibility
        executiveSummary: briefSummary,
        // Update timestamp
        generatedAt: generatedAt ? new Date(generatedAt) : new Date(),
        editedAt: new Date(),
      },
      create: {
        meetingId: id,
        narrative: narrative,
        briefSummary: briefSummary,
        tone: tone || null,
        objectives: objectives || null,
        keyDiscussions: keyDiscussions || null,
        actionItems: actionItems || null,
        takeaways: takeaways || null,
        audioUrl: audioUrl || null,
        audioVoice: audioVoice || null,
        audioDuration: audioDuration || null,
        executiveSummary: briefSummary,
        generatedAt: generatedAt ? new Date(generatedAt) : new Date(),
      },
    });

    console.log(`✅ AI Summary saved for meeting: ${id}`);
    if (audioUrl) {
      console.log(`   🔊 Audio URL: ${audioUrl}`);
    }

    return res.status(201).json({
      success: true,
      message: 'AI Summary saved successfully',
      summary,
    });
  } catch (error: any) {
    console.error('Save AI summary error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to save AI summary',
    });
  }
});

// ============================================================================
// GET /api/mobile/meetings/:id/ai-summary
// Get AI Summary for a meeting
// ============================================================================
router.get('/:id/ai-summary', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const summary = await prisma.meetingSummary.findUnique({
      where: { meetingId: id },
      select: {
        id: true,
        meetingId: true,
        narrative: true,
        briefSummary: true,
        tone: true,
        objectives: true,
        keyDiscussions: true,
        actionItems: true,
        takeaways: true,
        audioUrl: true,
        audioVoice: true,
        audioDuration: true,
        generatedAt: true,
        // Also include legacy fields
        executiveSummary: true,
        keyPoints: true,
        decisions: true,
        nextSteps: true,
      },
    });

    if (!summary) {
      return res.status(404).json({
        success: false,
        error: 'AI Summary not found',
      });
    }

    // Check if this is an AI narrative summary (has narrative field)
    const isAISummary = summary.narrative !== null;

    return res.status(200).json({
      success: true,
      summary,
      isAISummary,
    });
  } catch (error: any) {
    console.error('Get AI summary error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get AI summary',
    });
  }
});

// ============================================================================
// POST /api/mobile/meetings/:id/recording
// Upload meeting audio to private Firebase Storage and store the cloud object path
// ============================================================================
router.post('/:id/recording', audioUpload.single('audio'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = currentUser(req);
    const file = req.file;

    if (!user) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    if (!file) {
      return res.status(400).json({ success: false, error: 'Audio file is required' });
    }

    const existingMeeting = await prisma.meeting.findUnique({ where: { id } });
    if (!existingMeeting) {
      return res.status(404).json({ success: false, error: 'Meeting not found' });
    }

    if (!canAccessMeeting(user, existingMeeting)) {
      return res.status(403).json({ success: false, error: 'You do not have access to this meeting' });
    }

    const duration = parseOptionalDuration(req.body.duration);
    const recordedAt = parseOptionalDate(req.body.recordedAt) || new Date();
    const uploaded = await uploadMeetingAudioToFirebase({
      meeting: existingMeeting,
      user: { id: user.id, organizationId: user.organizationId || null },
      file,
      duration,
      recordedAt,
    });

    const meeting = await prisma.meeting.update({
      where: { id },
      data: {
        status: MeetingStatus.UPLOADED,
        recordingUrl: uploaded.gsUri,
        recordingStorageBucket: uploaded.bucketName,
        recordingStoragePath: uploaded.storagePath,
        recordingFileName: file.originalname,
        recordingMimeType: file.mimetype || 'audio/m4a',
        recordingFileSize: file.size || null,
        recordingUploadedAt: uploaded.uploadedAt,
        recordingRetentionExpiresAt: uploaded.retentionExpiresAt,
        recordingDeletedAt: null,
        recordingDeletionReason: null,
        duration,
        recordedAt,
      },
      include: {
        creator: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        department: {
          select: { id: true, name: true },
        },
        participants: true,
        bookmarks: { orderBy: { timestamp: 'asc' } },
        _count: { select: { actionItems: true, transcript: true } },
      },
    });

    return res.status(201).json({
      success: true,
      meeting,
      data: {
        recordingUrl: uploaded.gsUri,
        recordingStoragePath: uploaded.storagePath,
        recordingRetentionExpiresAt: uploaded.retentionExpiresAt,
      },
      message: 'Meeting audio uploaded securely. It is ready for playback and transcript processing.',
    });
  } catch (error: any) {
    console.error('Upload meeting recording error:', error);
    return res.status(500).json({
      success: false,
      error: error?.message || 'Failed to upload meeting audio',
    });
  }
});

// ============================================================================
// GET /api/mobile/meetings/:id/recording/playback
// Return a short-lived signed URL for private Firebase audio playback
// ============================================================================
router.get('/:id/recording/playback', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = currentUser(req);

    if (!user) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const meeting = await prisma.meeting.findUnique({ where: { id } });
    if (!meeting) {
      return res.status(404).json({ success: false, error: 'Meeting not found' });
    }

    if (!canAccessMeeting(user, meeting)) {
      return res.status(403).json({ success: false, error: 'You do not have access to this meeting' });
    }

    const signed = await createSignedMeetingAudioUrl(meeting);
    return res.json({
      success: true,
      data: {
        playbackUrl: signed.url,
        expiresAt: signed.expiresAt,
      },
    });
  } catch (error: any) {
    console.error('Create meeting recording playback URL error:', error);
    return res.status(404).json({
      success: false,
      error: error?.message || 'Meeting audio is not available',
    });
  }
});

// ============================================================================
// POST /api/mobile/meetings/:id/recording/transcribe
// Transcribe a meeting directly from private Firebase Storage
// ============================================================================
router.post('/:id/recording/transcribe', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = currentUser(req);

    if (!user) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const meeting = await prisma.meeting.findUnique({ where: { id } });
    if (!meeting) {
      return res.status(404).json({ success: false, error: 'Meeting not found' });
    }

    if (!canAccessMeeting(user, meeting)) {
      return res.status(403).json({ success: false, error: 'You do not have access to this meeting' });
    }

    const whisperService = await import('../services/whisperService');
    if (!whisperService.isConfigured()) {
      return res.status(503).json({
        success: false,
        error: 'Transcription service is not configured. Please contact administrator.',
      });
    }

    const audio = await downloadMeetingAudioBuffer(meeting);
    const language = normalizeTranscriptionLanguage(req.body.language);
    const meetingType = normalizeMeetingTypeForTranscription(req.body.meetingType || meeting.meetingType);

    let result = await whisperService.transcribeFromBuffer(audio.buffer, audio.fileName, {
      language,
      meetingType,
    });

    if (result.success && language && !result.text?.trim()) {
      result = await whisperService.transcribeFromBuffer(audio.buffer, audio.fileName, {
        meetingType,
      });
    }

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error || 'Transcription failed',
      });
    }

    return res.json({
      success: true,
      transcript: result.text,
      language: result.language,
      duration: result.duration,
      segments: result.segments,
    });
  } catch (error: any) {
    console.error('Transcribe stored meeting recording error:', error);
    return res.status(500).json({
      success: false,
      error: error?.message || 'Failed to transcribe stored meeting audio',
    });
  }
});

// ============================================================================
// DELETE /api/mobile/meetings/:id/recording
// Delete the Firebase audio object and clear active recording reference
// ============================================================================
router.delete('/:id/recording', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = currentUser(req);

    if (!user) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const meeting = await prisma.meeting.findUnique({ where: { id } });
    if (!meeting) {
      return res.status(404).json({ success: false, error: 'Meeting not found' });
    }

    if (!canAccessMeeting(user, meeting)) {
      return res.status(403).json({ success: false, error: 'You do not have access to this meeting' });
    }

    const retentionPolicy = await getOrCreateMeetingRecordingRetentionPolicy(meeting.organizationId);
    const isAdmin = ['ADMIN', 'SYSTEM_ADMIN', 'CI_MANAGER'].includes(user.role);
    if (!retentionPolicy.allowUsersToDeleteAudio && !isAdmin) {
      return res.status(403).json({ success: false, error: 'Audio deletion is restricted by your organization policy' });
    }

    await deleteMeetingAudioObject(meeting);
    const updated = await prisma.meeting.update({
      where: { id },
      data: {
        recordingUrl: null,
        recordingRetentionExpiresAt: null,
        recordingDeletedAt: new Date(),
        recordingDeletionReason: 'manual_delete',
        status: meeting.status === MeetingStatus.UPLOADED ? MeetingStatus.DRAFT : meeting.status,
      },
    });

    return res.json({
      success: true,
      meeting: updated,
      message: 'Meeting audio deleted.',
    });
  } catch (error: any) {
    console.error('Delete meeting recording error:', error);
    return res.status(500).json({
      success: false,
      error: error?.message || 'Failed to delete meeting audio',
    });
  }
});

// ============================================================================
// PATCH /api/mobile/meetings/:id/upload
// Convenience endpoint to mark a meeting as uploaded with recording info
// ============================================================================
router.patch('/:id/upload', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { recordingUrl, duration, recordedAt } = req.body;

    const existingMeeting = await prisma.meeting.findUnique({
      where: { id },
    });

    if (!existingMeeting) {
      return res.status(404).json({
        success: false,
        error: 'Meeting not found',
      });
    }

    if (!recordingUrl) {
      return res.status(400).json({
        success: false,
        error: 'recordingUrl is required',
      });
    }

    const meeting = await prisma.meeting.update({
      where: { id },
      data: {
        status: MeetingStatus.UPLOADED,
        recordingUrl,
        duration: duration || null,
        recordedAt: recordedAt ? new Date(recordedAt) : new Date(),
      },
      include: {
        creator: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        participants: true,
        bookmarks: { orderBy: { timestamp: 'asc' } },
        _count: { select: { actionItems: true } },
      },
    });

    return res.json({
      success: true,
      meeting,
      message: 'Meeting marked as uploaded. Ready for AI processing.',
    });
  } catch (error: any) {
    console.error('Upload meeting error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update meeting upload status',
    });
  }
});

export default router;
