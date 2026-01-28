import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  // Spotlight
  startSpotlight,
  endSpotlight,
  getActiveSpotlight,
  getSpotlightHistory,
  // Annotations
  addAnnotation,
  updateAnnotation,
  deleteAnnotation,
  getSpotlightAnnotations,
  clearSpotlightAnnotations,
  // Discussion Markers
  addDiscussionMarker,
  getDiscussionMarkers,
  deleteDiscussionMarker
} from '../controllers/spotlightController';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ============================================================================
// SPOTLIGHT ROUTES
// ============================================================================

// Start presenting evidence to all participants
router.post('/spotlight', startSpotlight);

// End the current spotlight session
router.patch('/spotlight/:spotlightId/end', endSpotlight);

// Get active spotlight for a room
router.get('/spotlight/room/:roomName', getActiveSpotlight);

// Get spotlight history for an incident
router.get('/spotlight/incident/:incidentId', getSpotlightHistory);

// ============================================================================
// ANNOTATION ROUTES
// ============================================================================

// Add an annotation
router.post('/annotations', addAnnotation);

// Update an annotation
router.patch('/annotations/:annotationId', updateAnnotation);

// Delete an annotation
router.delete('/annotations/:annotationId', deleteAnnotation);

// Get all annotations for a spotlight session
router.get('/annotations/spotlight/:spotlightId', getSpotlightAnnotations);

// Clear all annotations for a spotlight session (when spotlight ends)
router.delete('/annotations/spotlight/:spotlightId', clearSpotlightAnnotations);

// ============================================================================
// DISCUSSION MARKER ROUTES
// ============================================================================

// Add a discussion marker
router.post('/markers', addDiscussionMarker);

// Get discussion markers for an incident
router.get('/markers/incident/:incidentId', getDiscussionMarkers);

// Delete a discussion marker
router.delete('/markers/:markerId', deleteDiscussionMarker);

export default router;
