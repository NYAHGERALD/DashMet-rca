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
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

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

    if (!creatorId || !organizationId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: creatorId, organizationId',
      });
    }

    const creator = await prisma.user.findUnique({
      where: { id: creatorId },
    });

    if (!creator) {
      return res.status(404).json({
        success: false,
        error: 'Creator not found',
      });
    }

    const meeting = await prisma.meeting.create({
      data: {
        title: title?.trim() || null,
        meetingType: meetingType || 'GENERAL',
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
        creatorId,
        organizationId,
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

    let whereClause: any = { creatorId: userId as string };
    if (status) {
      whereClause.status = status as MeetingStatus;
    }

    const meetings = await prisma.meeting.findMany({
      where: whereClause,
      include: {
        creator: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        participants: {
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true, email: true },
            },
          },
        },
        bookmarks: { orderBy: { timestamp: 'asc' } },
        _count: { select: { actionItems: true, transcript: true } },
      },
      orderBy: [{ createdAt: 'desc' }],
      take: parseInt(limit as string),
      skip: parseInt(offset as string),
    });

    const totalCount = await prisma.meeting.count({ where: whereClause });

    return res.json({
      success: true,
      meetings,
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
          include: {
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

    return res.json({ success: true, meeting });
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

    const meeting = await prisma.meeting.update({
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
      const user = await prisma.user.findUnique({
        where: { id: userId },
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
