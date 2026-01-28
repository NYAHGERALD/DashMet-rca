import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { websocketService } from '../services/websocketService';

const prisma = new PrismaClient();

// Helper to get Socket.IO instance
const getIO = () => websocketService.getIO();

// ============================================================================
// EVIDENCE SPOTLIGHT - Present evidence to all call participants
// ============================================================================

/**
 * Start spotlighting an evidence item - broadcasts to all participants
 */
export const startSpotlight = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id;
    const { incidentId, evidenceId, roomName, fmirId } = req.body;

    if (!incidentId || !evidenceId || !roomName) {
      return res.status(400).json({ error: 'incidentId, evidenceId, and roomName are required' });
    }

    // Verify user has access to the incident
    const incident = await prisma.incident.findFirst({
      where: {
        id: incidentId,
        OR: [
          { createdById: userId },
          { assignedToId: userId },
          { IncidentParticipant: { some: { userId, isActive: true } } }
        ]
      },
      include: {
        FMIRReport: true
      }
    });

    if (!incident) {
      return res.status(403).json({ error: 'Access denied to this incident' });
    }

    // Check for evidence - could be regular Evidence or FMIREvidence
    let evidence: any = null;
    let isFmirEvidence = false;
    
    // First try regular Evidence table
    evidence = await prisma.evidence.findFirst({
      where: { id: evidenceId, incidentId }
    });
    
    // If not found and incident has linked FMIR, try FMIREvidence
    if (!evidence && (fmirId || incident.fmirReportId)) {
      const fmirIdToCheck = fmirId || incident.fmirReportId;
      evidence = await prisma.fMIREvidence.findFirst({
        where: { id: evidenceId, fmirId: fmirIdToCheck }
      });
      if (evidence) {
        isFmirEvidence = true;
      }
    }

    if (!evidence) {
      return res.status(404).json({ error: 'Evidence not found for this incident' });
    }

    // End any existing spotlight for this room
    await prisma.evidenceSpotlight.updateMany({
      where: { roomName, endedAt: null },
      data: { endedAt: new Date() }
    });

    // Create new spotlight session
    // Note: For FMIR evidence, we store the evidenceId in fmirEvidenceId field
    const spotlight = await prisma.evidenceSpotlight.create({
      data: {
        incidentId,
        evidenceId: isFmirEvidence ? null : evidenceId,
        fmirEvidenceId: isFmirEvidence ? evidenceId : null,
        roomName,
        presentedById: userId,
        presentedAt: new Date()
      },
      include: {
        presentedBy: {
          select: { id: true, firstName: true, lastName: true, email: true }
        }
      }
    });

    // Broadcast to all participants in the room via WebSocket
    const io = getIO();
    io?.to(`incident:${incidentId}`).emit('spotlight:started', {
      spotlightId: spotlight.id,
      evidenceId,
      isFmirEvidence,
      fmirId: fmirId || incident.fmirReportId,
      evidence: {
        id: evidence.id,
        fileName: evidence.fileName,
        type: evidence.type,
        mimeType: evidence.mimeType
      },
      presentedBy: spotlight.presentedBy,
      roomName,
      startedAt: spotlight.presentedAt
    });

    console.log(`🔦 Spotlight started: Evidence ${evidenceId} (FMIR: ${isFmirEvidence}) by user ${userId} in room ${roomName}`);

    return res.status(201).json({
      ...spotlight,
      evidenceId, // Return the actual evidenceId for client use
      isFmirEvidence,
      evidence
    });
  } catch (error) {
    console.error('Error starting spotlight:', error);
    next(error);
  }
};

/**
 * End the current spotlight session
 */
export const endSpotlight = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id;
    const { spotlightId } = req.params;

    const spotlight = await prisma.evidenceSpotlight.findUnique({
      where: { id: spotlightId }
    });

    if (!spotlight) {
      return res.status(404).json({ error: 'Spotlight session not found' });
    }

    // Calculate duration
    const duration = spotlight.presentedAt 
      ? Math.round((new Date().getTime() - spotlight.presentedAt.getTime()) / 1000)
      : 0;

    const updatedSpotlight = await prisma.evidenceSpotlight.update({
      where: { id: spotlightId },
      data: {
        endedAt: new Date(),
        duration
      }
    });

    // Broadcast to all participants
    const io = getIO();
    io?.to(`incident:${spotlight.incidentId}`).emit('spotlight:ended', {
      spotlightId,
      endedAt: updatedSpotlight.endedAt,
      duration
    });

    console.log(`🔦 Spotlight ended: ${spotlightId}, duration: ${duration}s`);

    return res.json(updatedSpotlight);
  } catch (error) {
    console.error('Error ending spotlight:', error);
    next(error);
  }
};

/**
 * Get current active spotlight for a room
 */
export const getActiveSpotlight = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { roomName } = req.params;

    const spotlight = await prisma.evidenceSpotlight.findFirst({
      where: {
        roomName,
        endedAt: null
      },
      include: {
        evidence: true,
        presentedBy: {
          select: { id: true, firstName: true, lastName: true, email: true }
        },
        annotations: {
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true }
            }
          }
        }
      }
    });

    return res.json(spotlight);
  } catch (error) {
    console.error('Error getting active spotlight:', error);
    next(error);
  }
};

/**
 * Get spotlight history for an incident
 */
export const getSpotlightHistory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { incidentId } = req.params;

    const spotlights = await prisma.evidenceSpotlight.findMany({
      where: { incidentId },
      include: {
        evidence: true,
        presentedBy: {
          select: { id: true, firstName: true, lastName: true }
        }
      },
      orderBy: { presentedAt: 'desc' }
    });

    return res.json(spotlights);
  } catch (error) {
    console.error('Error getting spotlight history:', error);
    next(error);
  }
};

// ============================================================================
// EVIDENCE ANNOTATIONS - Collaborative drawing/markup on evidence
// ============================================================================

/**
 * Add an annotation to evidence during a spotlight session
 */
export const addAnnotation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id;
    const { spotlightId, annotationType, data, color, strokeWidth, evidenceId: requestEvidenceId } = req.body;

    if (!spotlightId || !annotationType || !data) {
      return res.status(400).json({ error: 'spotlightId, annotationType, and data are required' });
    }

    // Validate annotation type
    const validTypes = ['circle', 'arrow', 'rectangle', 'freehand', 'text', 'highlight'];
    if (!validTypes.includes(annotationType)) {
      return res.status(400).json({ error: `annotationType must be one of: ${validTypes.join(', ')}` });
    }

    // Get the spotlight to verify it exists and get the incident ID
    const spotlight = await prisma.evidenceSpotlight.findUnique({
      where: { id: spotlightId },
      select: { incidentId: true, evidenceId: true, fmirEvidenceId: true }
    });

    if (!spotlight) {
      return res.status(404).json({ error: 'Spotlight session not found' });
    }

    const annotation = await prisma.evidenceAnnotation.create({
      data: {
        spotlightId,
        userId,
        annotationType,
        data,
        color: color || '#FF0000',
        strokeWidth: strokeWidth || 2
      },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true }
        }
      }
    });

    // Broadcast to all participants via WebSocket
    const io = getIO();
    const roomName = `incident:${spotlight.incidentId}`;
    
    // Use the evidenceId from request (what frontend is using) or fall back to spotlight record
    const broadcastEvidenceId = requestEvidenceId || spotlight.evidenceId || spotlight.fmirEvidenceId;
    
    io?.to(roomName).emit('spotlight:annotation', {
      annotation: {
        id: annotation.id,
        spotlightId,
        evidenceId: broadcastEvidenceId,
        annotationType,
        data,
        color: annotation.color,
        strokeWidth: annotation.strokeWidth,
        user: annotation.user,
        createdAt: annotation.createdAt
      }
    });

    console.log(`✏️ Annotation added: ${annotationType} by user ${userId}`);

    return res.status(201).json(annotation);
  } catch (error) {
    console.error('Error adding annotation:', error);
    next(error);
  }
};

/**
 * Update an annotation
 */
export const updateAnnotation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id;
    const { annotationId } = req.params;
    const { data, color, strokeWidth } = req.body;

    const annotation = await prisma.evidenceAnnotation.findUnique({
      where: { id: annotationId }
    });

    if (!annotation) {
      return res.status(404).json({ error: 'Annotation not found' });
    }

    // Only the creator can update their annotation
    if (annotation.userId !== userId) {
      return res.status(403).json({ error: 'Can only update your own annotations' });
    }

    const updatedAnnotation = await prisma.evidenceAnnotation.update({
      where: { id: annotationId },
      data: {
        data: data ?? annotation.data,
        color: color ?? annotation.color,
        strokeWidth: strokeWidth ?? annotation.strokeWidth
      },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true }
        }
      }
    });

    // Broadcast update - get incident ID from the spotlight
    const spotlight = await prisma.evidenceSpotlight.findUnique({
      where: { id: annotation.spotlightId },
      select: { incidentId: true }
    });
    
    if (spotlight?.incidentId) {
      const io = getIO();
      io?.to(`incident:${spotlight.incidentId}`).emit('spotlight:annotation-updated', {
        annotationId,
        data: updatedAnnotation.data,
        color: updatedAnnotation.color,
        strokeWidth: updatedAnnotation.strokeWidth
      });
    }

    return res.json(updatedAnnotation);
  } catch (error) {
    console.error('Error updating annotation:', error);
    next(error);
  }
};

/**
 * Delete an annotation
 */
export const deleteAnnotation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id;
    const { annotationId } = req.params;

    const annotation = await prisma.evidenceAnnotation.findUnique({
      where: { id: annotationId }
    });

    if (!annotation) {
      return res.status(404).json({ error: 'Annotation not found' });
    }

    // Only the creator can delete their annotation
    if (annotation.userId !== userId) {
      return res.status(403).json({ error: 'Can only delete your own annotations' });
    }

    await prisma.evidenceAnnotation.delete({
      where: { id: annotationId }
    });

    // Broadcast deletion - get incident ID from the spotlight
    const spotlight = await prisma.evidenceSpotlight.findUnique({
      where: { id: annotation.spotlightId },
      select: { incidentId: true, evidenceId: true, fmirEvidenceId: true }
    });
    
    if (spotlight?.incidentId) {
      const io = getIO();
      io?.to(`incident:${spotlight.incidentId}`).emit('spotlight:annotation-deleted', {
        annotationId,
        evidenceId: spotlight.evidenceId || spotlight.fmirEvidenceId,
        spotlightId: annotation.spotlightId
      });
    }

    return res.json({ message: 'Annotation deleted successfully' });
  } catch (error) {
    console.error('Error deleting annotation:', error);
    next(error);
  }
};

/**
 * Get all annotations for a spotlight session
 */
export const getSpotlightAnnotations = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { spotlightId } = req.params;

    const annotations = await prisma.evidenceAnnotation.findMany({
      where: { spotlightId },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    return res.json(annotations);
  } catch (error) {
    console.error('Error getting spotlight annotations:', error);
    next(error);
  }
};

/**
 * Clear all annotations for a spotlight session (when spotlight ends)
 */
export const clearSpotlightAnnotations = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { spotlightId } = req.params;

    const result = await prisma.evidenceAnnotation.deleteMany({
      where: { spotlightId }
    });

    console.log(`🧹 Cleared ${result.count} annotations for spotlight ${spotlightId}`);

    return res.json({ cleared: result.count });
  } catch (error) {
    console.error('Error clearing spotlight annotations:', error);
    next(error);
  }
};

// ============================================================================
// DISCUSSION MARKERS - Timestamp markers linking discussion to evidence
// ============================================================================

/**
 * Add a discussion marker
 */
export const addDiscussionMarker = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id;
    const { incidentId, roomName, evidenceId, markerType, title, description, callOffset } = req.body;

    if (!incidentId || !roomName || !markerType || !title) {
      return res.status(400).json({ error: 'incidentId, roomName, markerType, and title are required' });
    }

    // Validate marker type
    const validTypes = ['evidence_discussed', 'decision_made', 'action_assigned', 'root_cause_identified', 'custom'];
    if (!validTypes.includes(markerType)) {
      return res.status(400).json({ error: `markerType must be one of: ${validTypes.join(', ')}` });
    }

    // Validate evidenceId if provided - ensure it exists in the database
    let validEvidenceId: string | null = null;
    if (evidenceId) {
      const evidenceExists = await prisma.evidence.findUnique({
        where: { id: evidenceId },
        select: { id: true }
      });
      if (evidenceExists) {
        validEvidenceId = evidenceId;
      }
      // If evidenceId doesn't exist, we just set it to null (marker without specific evidence)
    }

    const marker = await prisma.discussionMarker.create({
      data: {
        incidentId,
        roomName,
        evidenceId: validEvidenceId,
        markerType,
        title,
        description,
        timestamp: new Date(),
        callOffset,
        createdById: userId
      },
      include: {
        evidence: {
          select: { id: true, fileName: true, type: true }
        },
        createdBy: {
          select: { id: true, firstName: true, lastName: true }
        }
      }
    });

    // Broadcast to all participants
    const io = getIO();
    io?.to(`incident:${incidentId}`).emit('spotlight:marker-added', {
      marker: {
        id: marker.id,
        markerType,
        title,
        description,
        evidence: marker.evidence,
        createdBy: marker.createdBy,
        timestamp: marker.timestamp,
        callOffset
      }
    });

    console.log(`📍 Discussion marker added: ${markerType} - ${title}`);

    return res.status(201).json(marker);
  } catch (error) {
    console.error('Error adding discussion marker:', error);
    next(error);
  }
};

/**
 * Get discussion markers for an incident
 */
export const getDiscussionMarkers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { incidentId } = req.params;
    const { roomName } = req.query;

    const where: any = { incidentId };
    if (roomName) {
      where.roomName = roomName;
    }

    const markers = await prisma.discussionMarker.findMany({
      where,
      include: {
        evidence: {
          select: { id: true, fileName: true, type: true }
        },
        createdBy: {
          select: { id: true, firstName: true, lastName: true }
        }
      },
      orderBy: { timestamp: 'asc' }
    });

    return res.json(markers);
  } catch (error) {
    console.error('Error getting discussion markers:', error);
    next(error);
  }
};

/**
 * Delete a discussion marker
 */
export const deleteDiscussionMarker = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id;
    const { markerId } = req.params;

    const marker = await prisma.discussionMarker.findUnique({
      where: { id: markerId }
    });

    if (!marker) {
      return res.status(404).json({ error: 'Marker not found' });
    }

    // Only the creator can delete their marker
    if (marker.createdById !== userId) {
      return res.status(403).json({ error: 'Can only delete your own markers' });
    }

    await prisma.discussionMarker.delete({
      where: { id: markerId }
    });

    // Broadcast deletion
    const io = getIO();
    io?.to(`incident:${marker.incidentId}`).emit('spotlight:marker-deleted', {
      markerId
    });

    return res.json({ message: 'Marker deleted successfully' });
  } catch (error) {
    console.error('Error deleting discussion marker:', error);
    next(error);
  }
};
