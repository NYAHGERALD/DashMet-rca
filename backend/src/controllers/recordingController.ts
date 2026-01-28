import { Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma';
import { websocketService } from '../services/websocketService';

/**
 * Create a new meeting recording
 */
export const createRecording = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id;
    const { 
      incidentId, 
      roomName, 
      title, 
      description, 
      fileName, 
      fileUrl, 
      firebasePath, 
      fileSize, 
      duration, 
      mimeType, 
      recordingType,
      thumbnailUrl,
      startedAt,
      endedAt
    } = req.body;

    if (!incidentId || !roomName || !fileName || !fileUrl || !firebasePath) {
      return res.status(400).json({ 
        error: 'incidentId, roomName, fileName, fileUrl, and firebasePath are required' 
      });
    }

    // Validate dates - use current time as fallback for invalid dates
    const now = new Date();
    const parsedStartedAt = startedAt ? new Date(startedAt) : now;
    const parsedEndedAt = endedAt ? new Date(endedAt) : now;
    
    // Check for invalid dates and use fallback
    const validStartedAt = isNaN(parsedStartedAt.getTime()) ? now : parsedStartedAt;
    const validEndedAt = isNaN(parsedEndedAt.getTime()) ? now : parsedEndedAt;

    const recording = await prisma.meetingRecording.create({
      data: {
        incidentId,
        roomName,
        title: title || `Recording - ${new Date().toLocaleString()}`,
        description,
        fileName,
        fileUrl,
        firebasePath,
        fileSize: fileSize || 0,
        duration,
        mimeType: mimeType || 'video/webm',
        recordingType: recordingType || 'screen',
        thumbnailUrl,
        status: 'ready',
        recordedById: userId,
        startedAt: validStartedAt,
        endedAt: validEndedAt
      },
      include: {
        recordedBy: {
          select: { id: true, firstName: true, lastName: true, profilePicture: true }
        }
      }
    });

    // Broadcast to all participants using websocketService
    websocketService.emitToIncident(incidentId, 'recording:created', {
      recording: {
        id: recording.id,
        title: recording.title,
        fileName: recording.fileName,
        fileUrl: recording.fileUrl,
        duration: recording.duration,
        recordingType: recording.recordingType,
        recordedBy: recording.recordedBy,
        startedAt: recording.startedAt,
        endedAt: recording.endedAt,
        createdAt: recording.createdAt
      }
    });

    console.log(`🎥 Meeting recording created: ${recording.title} for incident ${incidentId}`);

    return res.status(201).json(recording);
  } catch (error) {
    console.error('Error creating recording:', error);
    next(error);
  }
};

/**
 * Get all recordings for an incident
 */
export const getRecordingsByIncident = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { incidentId } = req.params;
    const { roomName } = req.query;

    const where: any = { incidentId };
    if (roomName) {
      where.roomName = roomName;
    }

    const recordings = await prisma.meetingRecording.findMany({
      where,
      include: {
        recordedBy: {
          select: { id: true, firstName: true, lastName: true, profilePicture: true }
        }
      },
      orderBy: { startedAt: 'desc' }
    });

    return res.json(recordings);
  } catch (error) {
    console.error('Error getting recordings:', error);
    next(error);
  }
};

/**
 * Get a single recording by ID
 */
export const getRecordingById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { recordingId } = req.params;

    const recording = await prisma.meetingRecording.findUnique({
      where: { id: recordingId },
      include: {
        recordedBy: {
          select: { id: true, firstName: true, lastName: true, profilePicture: true }
        },
        incident: {
          select: { id: true, incidentNumber: true, customTitle: true }
        }
      }
    });

    if (!recording) {
      return res.status(404).json({ error: 'Recording not found' });
    }

    return res.json(recording);
  } catch (error) {
    console.error('Error getting recording:', error);
    next(error);
  }
};

/**
 * Update recording metadata
 */
export const updateRecording = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { recordingId } = req.params;
    const { title, description, status, duration } = req.body;

    const recording = await prisma.meetingRecording.update({
      where: { id: recordingId },
      data: {
        ...(title && { title }),
        ...(description !== undefined && { description }),
        ...(status && { status }),
        ...(duration !== undefined && { duration })
      },
      include: {
        recordedBy: {
          select: { id: true, firstName: true, lastName: true, profilePicture: true }
        }
      }
    });

    return res.json(recording);
  } catch (error) {
    console.error('Error updating recording:', error);
    next(error);
  }
};

/**
 * Delete a recording
 */
export const deleteRecording = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id;
    const { recordingId } = req.params;

    const recording = await prisma.meetingRecording.findUnique({
      where: { id: recordingId }
    });

    if (!recording) {
      return res.status(404).json({ error: 'Recording not found' });
    }

    // Only the user who recorded or incident owner can delete
    // For now, allow the recorder to delete
    if (recording.recordedById !== userId) {
      return res.status(403).json({ error: 'You can only delete your own recordings' });
    }

    await prisma.meetingRecording.delete({
      where: { id: recordingId }
    });

    // Broadcast deletion using websocketService
    websocketService.emitToIncident(recording.incidentId, 'recording:deleted', {
      recordingId: recording.id
    });

    console.log(`🎥 Meeting recording deleted: ${recording.id}`);

    return res.json({ message: 'Recording deleted successfully' });
  } catch (error) {
    console.error('Error deleting recording:', error);
    next(error);
  }
};

/**
 * Get recording stats for an incident
 */
export const getRecordingStats = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { incidentId } = req.params;

    const recordings = await prisma.meetingRecording.findMany({
      where: { incidentId },
      select: {
        id: true,
        duration: true,
        fileSize: true,
        roomName: true
      }
    });

    const stats = {
      totalRecordings: recordings.length,
      totalDuration: recordings.reduce((sum: number, r: { duration: number | null }) => sum + (r.duration || 0), 0),
      totalSize: recordings.reduce((sum: number, r: { fileSize: number }) => sum + (r.fileSize || 0), 0),
      sessions: [...new Set(recordings.map((r: { roomName: string }) => r.roomName))].length
    };

    return res.json(stats);
  } catch (error) {
    console.error('Error getting recording stats:', error);
    next(error);
  }
};
