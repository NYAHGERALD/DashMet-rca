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
  transcribeAudio,
} from '../controllers/transcriptController';
import multer from 'multer';

const router = Router();

// Configure multer for audio file uploads (max 25MB for Whisper)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept common audio formats
    const allowedMimes = [
      'audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/m4a',
      'audio/wav', 'audio/webm', 'audio/ogg', 'audio/flac',
      'video/mp4', 'video/webm'
    ];
    if (allowedMimes.includes(file.mimetype) || file.originalname.match(/\.(mp3|mp4|m4a|wav|webm|ogg|flac|mpeg|mpga)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Supported: mp3, mp4, m4a, wav, webm, ogg, flac'));
    }
  },
});

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

// Whisper transcription (server-side)
router.post('/transcribe', upload.single('audio'), transcribeAudio);  // Transcribe audio file

export default router;
