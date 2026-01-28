/**
 * Meeting Transcript Routes
 * API endpoints for AI meeting transcription and smart summaries
 */
import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  createTranscript,
  addTranscriptEntries,
  endMeeting,
  generateAISummary,
  getTranscript,
  getTranscriptByRoom,
  getIncidentTranscripts,
  searchTranscripts,
} from '../controllers/transcriptController';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Transcript CRUD operations
router.post('/', createTranscript);                          // Create new transcript
router.get('/search', searchTranscripts);                    // Search transcripts
router.get('/room/:roomName', getTranscriptByRoom);          // Get by room name
router.get('/:id', getTranscript);                           // Get by ID
router.patch('/:id/entries', addTranscriptEntries);          // Add entries
router.patch('/:id/end', endMeeting);                        // End meeting

// AI Summary generation
router.post('/:id/summarize', generateAISummary);            // Generate AI summary

export default router;
