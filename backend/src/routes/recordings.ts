import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  createRecording,
  getRecordingsByIncident,
  getRecordingById,
  updateRecording,
  deleteRecording,
  getRecordingStats
} from '../controllers/recordingController';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Create a new recording
router.post('/', createRecording);

// Get all recordings for an incident
router.get('/incident/:incidentId', getRecordingsByIncident);

// Get recording stats for an incident
router.get('/incident/:incidentId/stats', getRecordingStats);

// Get a single recording
router.get('/:recordingId', getRecordingById);

// Update recording metadata
router.patch('/:recordingId', updateRecording);

// Delete a recording
router.delete('/:recordingId', deleteRecording);

export default router;
