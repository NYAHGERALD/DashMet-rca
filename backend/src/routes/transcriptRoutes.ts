/**
 * Meeting Transcript Routes
 * API endpoints for AI meeting transcription and smart summaries
 * Enterprise-grade transcription supporting up to 60+ minute recordings
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
  processSpeakers,
  generateNarrativeSummary,
  generateSummaryAudio,
  saveAISummary,
  getAISummary,
  saveProcessedTranscript,
  getProcessedTranscript,
  diarizeAudio,
} from '../controllers/transcriptController';
import multer from 'multer';

const router = Router();

// Configure multer for audio file uploads
// Support large files for enterprise (up to 500MB for 60+ minute recordings)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB limit for long recordings
  },
  fileFilter: (req, file, cb) => {
    // Accept common audio formats
    const allowedMimes = [
      'audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/m4a',
      'audio/wav', 'audio/webm', 'audio/ogg', 'audio/flac',
      'audio/x-m4a', 'audio/aac', 'video/mp4', 'video/webm'
    ];
    if (allowedMimes.includes(file.mimetype) || file.originalname.match(/\.(mp3|mp4|m4a|wav|webm|ogg|flac|mpeg|mpga|aac)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Supported: mp3, mp4, m4a, wav, webm, ogg, flac, aac'));
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

// Enterprise Speaker Diarization (Pyannote + Whisper)
router.post('/diarize', upload.single('audio'), diarizeAudio);       // Diarize + transcribe audio

// AI Speaker detection and formatting
router.post('/process-speakers', processSpeakers);           // Process transcript to detect speakers

// AI Narrative Summary with TTS
router.post('/narrative-summary', generateNarrativeSummary); // Generate narrative summary
router.post('/summary-audio', generateSummaryAudio);         // Generate TTS audio from summary

// AI Summary persistence
router.post('/save-ai-summary', saveAISummary);              // Save AI summary to database
router.get('/ai-summary/:meetingId', getAISummary);          // Get AI summary by meeting ID

// Processed Transcript persistence
router.post('/save-processed', saveProcessedTranscript);     // Save processed transcript to database
router.get('/processed/:meetingId', getProcessedTranscript); // Get processed transcript by meeting ID

export default router;
