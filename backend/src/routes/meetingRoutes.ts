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
import { PrismaClient, MeetingStatus, MeetingType } from '@prisma/client';

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
      tags,
      language,
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
        meetingType: meetingType || MeetingType.GENERAL,
        status: MeetingStatus.DRAFT,
        location: location?.trim() || null,
        tags: tags || [],
        language: language || 'en',
        creatorId,
        organizationId,
        facilityId: facilityId || null,
      },
      include: {
        creator: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        participants: true,
        bookmarks: true,
        _count: { select: { actionItems: true } },
      },
    });

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
