/**
 * Meeting Transcript Controller
 * Handles AI meeting transcription and smart summary generation
 */
import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';

const prisma = new PrismaClient();

// Types for transcript data
interface TranscriptEntry {
  timestamp: Date;
  speakerId: string;
  speakerName: string;
  text: string;
}

interface ActionItem {
  description: string;
  assignee?: string;
  dueDate?: Date;
}

interface KeyDecision {
  decision: string;
  madeBy?: string;
  timestamp?: Date;
}

interface RootCauseDiscussed {
  cause: string;
  category?: string;
  confidence?: number;
}

/**
 * Create a new meeting transcript record
 * POST /transcripts
 */
export const createTranscript = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { incidentId, roomName } = req.body;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    if (!incidentId || !roomName) {
      return res.status(400).json({ 
        success: false, 
        error: 'incidentId and roomName are required' 
      });
    }

    // Check if user has access to this incident
    const incident = await prisma.incident.findFirst({
      where: {
        id: incidentId,
        OR: [
          { createdById: userId },
          { assignedToId: userId },
          { IncidentParticipant: { some: { userId } } },
        ],
      },
    });

    if (!incident) {
      return res.status(403).json({ 
        success: false, 
        error: 'Access denied to this incident' 
      });
    }

    // Check if transcript already exists for this room
    const existingTranscript = await prisma.meetingTranscript.findFirst({
      where: { roomName },
    });

    if (existingTranscript) {
      return res.json({
        success: true,
        transcript: existingTranscript,
        isExisting: true,
      });
    }

    // Create new transcript
    const transcript = await prisma.meetingTranscript.create({
      data: {
        incidentId,
        roomName,
        participantIds: [userId],
        transcript: [],
        createdById: userId,
      },
    });

    console.log(`📝 Created new transcript for room: ${roomName}`);

    return res.status(201).json({
      success: true,
      transcript,
    });
  } catch (error) {
    console.error('Error creating transcript:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create transcript',
    });
  }
};

/**
 * Add transcript entries (append to existing transcript)
 * PATCH /transcripts/:id/entries
 */
export const addTranscriptEntries = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;
    const { entries } = req.body;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    if (!entries || !Array.isArray(entries)) {
      return res.status(400).json({ 
        success: false, 
        error: 'entries array is required' 
      });
    }

    const transcript = await prisma.meetingTranscript.findUnique({
      where: { id },
      include: { incident: true },
    });

    if (!transcript) {
      return res.status(404).json({ 
        success: false, 
        error: 'Transcript not found' 
      });
    }

    // Verify access
    const hasAccess = await prisma.incident.findFirst({
      where: {
        id: transcript.incidentId,
        OR: [
          { createdById: userId },
          { assignedToId: userId },
          { IncidentParticipant: { some: { userId } } },
        ],
      },
    });

    if (!hasAccess) {
      return res.status(403).json({ 
        success: false, 
        error: 'Access denied' 
      });
    }

    // Append new entries
    const existingTranscript = (transcript.transcript as TranscriptEntry[]) || [];
    const updatedTranscript = [...existingTranscript, ...entries];

    // Update participant list
    const existingParticipants = new Set(transcript.participantIds);
    entries.forEach((entry: TranscriptEntry) => {
      if (entry.speakerId && !existingParticipants.has(entry.speakerId)) {
        existingParticipants.add(entry.speakerId);
      }
    });

    const updated = await prisma.meetingTranscript.update({
      where: { id },
      data: {
        transcript: updatedTranscript,
        participantIds: Array.from(existingParticipants),
      },
    });

    return res.json({
      success: true,
      transcript: updated,
      entriesAdded: entries.length,
    });
  } catch (error) {
    console.error('Error adding transcript entries:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to add transcript entries',
    });
  }
};

/**
 * End a meeting and finalize transcript
 * PATCH /transcripts/:id/end
 */
export const endMeeting = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const transcript = await prisma.meetingTranscript.findUnique({
      where: { id },
    });

    if (!transcript) {
      return res.status(404).json({ 
        success: false, 
        error: 'Transcript not found' 
      });
    }

    // Calculate duration
    const endedAt = new Date();
    const startedAt = transcript.startedAt;
    const durationSeconds = Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000);

    const updated = await prisma.meetingTranscript.update({
      where: { id },
      data: {
        endedAt,
        duration: durationSeconds,
      },
    });

    console.log(`📝 Meeting ended for transcript ${id}, duration: ${durationSeconds}s`);

    return res.json({
      success: true,
      transcript: updated,
    });
  } catch (error) {
    console.error('Error ending meeting:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to end meeting',
    });
  }
};

/**
 * Generate AI summary for a transcript
 * POST /transcripts/:id/summarize
 */
export const generateAISummary = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const transcript = await prisma.meetingTranscript.findUnique({
      where: { id },
      include: { incident: true },
    });

    if (!transcript) {
      return res.status(404).json({ 
        success: false, 
        error: 'Transcript not found' 
      });
    }

    const entries = transcript.transcript as TranscriptEntry[];
    if (!entries || entries.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'No transcript entries to summarize' 
      });
    }

    // Check for OpenAI API key
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) {
      return res.status(500).json({ 
        success: false, 
        error: 'AI service not configured' 
      });
    }

    // Format transcript for AI
    const transcriptText = entries
      .map((e) => `[${e.speakerName}]: ${e.text}`)
      .join('\n');

    const incidentContext = `
Incident Title: ${transcript.incident.title}
Incident Type: ${transcript.incident.type}
Incident Description: ${transcript.incident.description || 'N/A'}
    `.trim();

    // Call OpenAI for summary
    const AI_MODEL = process.env.AI_MODEL || 'gpt-4o';
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [
          {
            role: 'system',
            content: `You are an expert meeting summarizer specializing in Root Cause Analysis (RCA) and incident investigation discussions.

Your task is to:
1. FIRST, clean up the raw transcript by correcting:
   - Speech recognition errors and misheard words
   - Grammar and punctuation issues
   - Filler words (um, uh, like, you know)
   - Incomplete sentences - complete them based on context

2. THEN, analyze the cleaned transcript and extract:
   - A professional, well-written summary of the discussion (2-3 paragraphs, written in natural human language)
   - Key decisions made during the meeting
   - Action items with assignees if mentioned
   - Root causes or contributing factors discussed

Make the summary sound professional and coherent, as if written by a skilled meeting secretary. Do NOT sound robotic or just list what was said - synthesize the information into flowing, readable prose.

Respond in JSON format:
{
  "summary": "A well-written, professional summary that flows naturally...",
  "keyDecisions": [{"decision": "string", "madeBy": "string or null"}],
  "actionItems": [{"description": "string", "assignee": "string or null"}],
  "rootCauses": [{"cause": "string", "category": "human|process|equipment|environment|management"}]
}`
          },
          {
            role: 'user',
            content: `Please analyze this RCA meeting transcript. Note: This transcript was captured using speech-to-text, so it may contain errors, incomplete sentences, or misheard words. Please correct these while preserving the original meaning.

INCIDENT CONTEXT:
${incidentContext}

RAW MEETING TRANSCRIPT:
${transcriptText}`
          }
        ],
        temperature: 0.3,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', errorText);
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to generate AI summary' 
      });
    }

    const data = await response.json() as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return res.status(500).json({ 
        success: false, 
        error: 'No content in AI response' 
      });
    }

    // Parse the JSON response
    let parsed;
    try {
      // Remove markdown code blocks if present
      const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsed = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      // Use raw content as summary if parsing fails
      parsed = {
        summary: content,
        keyDecisions: [],
        actionItems: [],
        rootCauses: [],
      };
    }

    // Update transcript with AI summary
    const updated = await prisma.meetingTranscript.update({
      where: { id },
      data: {
        aiSummary: parsed.summary,
        keyDecisions: parsed.keyDecisions,
        actionItems: parsed.actionItems,
        rootCauses: parsed.rootCauses,
      },
    });

    console.log(`🤖 Generated AI summary for transcript ${id}`);

    return res.json({
      success: true,
      transcript: updated,
      analysis: parsed,
    });
  } catch (error) {
    console.error('Error generating AI summary:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to generate AI summary',
    });
  }
};

/**
 * Get transcript by ID
 * GET /transcripts/:id
 */
export const getTranscript = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const transcript = await prisma.meetingTranscript.findUnique({
      where: { id },
      include: {
        incident: {
          select: { id: true, title: true, type: true },
        },
        createdBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });

    if (!transcript) {
      return res.status(404).json({ 
        success: false, 
        error: 'Transcript not found' 
      });
    }

    // Verify access
    const hasAccess = await prisma.incident.findFirst({
      where: {
        id: transcript.incidentId,
        OR: [
          { createdById: userId },
          { assignedToId: userId },
          { IncidentParticipant: { some: { userId } } },
        ],
      },
    });

    if (!hasAccess) {
      return res.status(403).json({ 
        success: false, 
        error: 'Access denied' 
      });
    }

    return res.json({
      success: true,
      transcript,
    });
  } catch (error) {
    console.error('Error getting transcript:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get transcript',
    });
  }
};

/**
 * Get transcript by room name
 * GET /transcripts/room/:roomName
 */
export const getTranscriptByRoom = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { roomName } = req.params;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const transcript = await prisma.meetingTranscript.findFirst({
      where: { roomName },
      include: {
        incident: {
          select: { id: true, title: true, type: true },
        },
        createdBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });

    if (!transcript) {
      return res.status(404).json({ 
        success: false, 
        error: 'Transcript not found' 
      });
    }

    return res.json({
      success: true,
      transcript,
    });
  } catch (error) {
    console.error('Error getting transcript by room:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get transcript',
    });
  }
};

/**
 * Get all transcripts for an incident
 * GET /incidents/:incidentId/transcripts
 */
export const getIncidentTranscripts = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { incidentId } = req.params;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    // Verify access
    const hasAccess = await prisma.incident.findFirst({
      where: {
        id: incidentId,
        OR: [
          { createdById: userId },
          { assignedToId: userId },
          { IncidentParticipant: { some: { userId } } },
        ],
      },
    });

    if (!hasAccess) {
      return res.status(403).json({ 
        success: false, 
        error: 'Access denied to this incident' 
      });
    }

    const transcripts = await prisma.meetingTranscript.findMany({
      where: { incidentId },
      orderBy: { startedAt: 'desc' },
      include: {
        createdBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });

    return res.json({
      success: true,
      transcripts,
      total: transcripts.length,
    });
  } catch (error) {
    console.error('Error getting incident transcripts:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get transcripts',
    });
  }
};

/**
 * Search transcripts
 * GET /transcripts/search?query=...
 */
export const searchTranscripts = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { query, incidentId } = req.query;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ 
        success: false, 
        error: 'query parameter is required' 
      });
    }

    // Get user's accessible incidents
    const accessibleIncidents = await prisma.incident.findMany({
      where: {
        OR: [
          { createdById: userId },
          { assignedToId: userId },
          { IncidentParticipant: { some: { userId } } },
        ],
        ...(incidentId ? { id: incidentId as string } : {}),
      },
      select: { id: true },
    });

    const incidentIds = accessibleIncidents.map((i) => i.id);

    // Search in transcripts
    const transcripts = await prisma.meetingTranscript.findMany({
      where: {
        incidentId: { in: incidentIds },
        OR: [
          { aiSummary: { contains: query, mode: 'insensitive' } },
        ],
      },
      include: {
        incident: {
          select: { id: true, title: true, type: true },
        },
        createdBy: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: { startedAt: 'desc' },
    });

    // Also search within transcript JSON content
    const filteredTranscripts = transcripts.filter((t) => {
      const entries = t.transcript as TranscriptEntry[];
      if (!entries) return true;
      return entries.some((e) => 
        e.text?.toLowerCase().includes(query.toLowerCase()) ||
        e.speakerName?.toLowerCase().includes(query.toLowerCase())
      );
    });

    return res.json({
      success: true,
      transcripts: filteredTranscripts,
      total: filteredTranscripts.length,
    });
  } catch (error) {
    console.error('Error searching transcripts:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to search transcripts',
    });
  }
};

/**
 * Transcribe audio using OpenAI Whisper API (server-side)
 * POST /transcripts/transcribe
 * Body: multipart/form-data with 'audio' file
 * Query params: language, meetingType
 */
export const transcribeAudio = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    // Check if file was uploaded
    const file = req.file;
    if (!file) {
      return res.status(400).json({
        success: false,
        error: 'No audio file provided. Please upload an audio file.',
      });
    }

    // Import whisper service
    const whisperService = await import('../services/whisperService');

    // Check if Whisper is configured
    if (!whisperService.isConfigured()) {
      return res.status(503).json({
        success: false,
        error: 'Transcription service is not configured. Please contact administrator.',
      });
    }

    // Get config from query params
    const { language, meetingType } = req.query;

    const fileSizeMB = (file.size / 1024 / 1024).toFixed(2);
    const fileSizeBytes = file.size;
    const bufferLength = file.buffer?.length || 0;
    
    console.log(`[Whisper] ====== TRANSCRIPTION REQUEST ======`);
    console.log(`[Whisper] User: ${userId}`);
    console.log(`[Whisper] File: ${file.originalname}`);
    console.log(`[Whisper] File size: ${fileSizeMB}MB (${fileSizeBytes} bytes)`);
    console.log(`[Whisper] Buffer length: ${bufferLength} bytes`);
    console.log(`[Whisper] MIME type: ${file.mimetype}`);
    console.log(`[Whisper] Language: ${language || 'en'}, Meeting type: ${meetingType || 'general'}`);
    
    // Verify buffer integrity
    if (bufferLength !== fileSizeBytes) {
      console.error(`[Whisper] ⚠️ Buffer size mismatch! File size: ${fileSizeBytes}, Buffer: ${bufferLength}`);
    }

    // Transcribe from buffer - handles chunking automatically for large files
    const result = await whisperService.transcribeFromBuffer(
      file.buffer,
      file.originalname,
      {
        language: language as string || 'en',
        meetingType: meetingType as string || 'general',
      }
    );

    if (!result.success) {
      console.error('[Whisper] Transcription failed:', result.error);
      return res.status(500).json({
        success: false,
        error: result.error || 'Transcription failed',
      });
    }

    console.log(`[Whisper] ====== TRANSCRIPTION COMPLETE ======`);
    console.log(`[Whisper] Duration: ${result.duration?.toFixed(0)}s`);
    console.log(`[Whisper] Text length: ${result.text?.length || 0} characters`);
    console.log(`[Whisper] Word count: ${result.text?.split(/\s+/).length || 0} words`);
    console.log(`[Whisper] Segments: ${result.segments?.length || 0}`);

    return res.json({
      success: true,
      transcript: result.text,
      language: result.language,
      duration: result.duration,
      segments: result.segments,
    });
  } catch (error: any) {
    console.error('[Whisper] Error transcribing audio:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to transcribe audio',
    });
  }
};

/**
 * Process transcript to detect speakers and format with paragraph breaks
 * Uses GPT to intelligently identify speaker changes based on context
 * POST /transcripts/process-speakers
 * Body: { transcript: string, isChunk?: boolean, chunkIndex?: number, totalChunks?: number }
 */
export const processSpeakers = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { transcript, isChunk, chunkIndex, totalChunks } = req.body;

    if (!transcript || typeof transcript !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Transcript text is required',
      });
    }

    console.log(`[SpeakerDetection] ====== PROCESSING REQUEST ======`);
    console.log(`[SpeakerDetection] User: ${userId}`);
    console.log(`[SpeakerDetection] Input length: ${transcript.length} characters`);
    console.log(`[SpeakerDetection] Is chunk: ${isChunk}, Index: ${chunkIndex}/${totalChunks}`);

    // Import and use the speaker detection service
    const speakerService = await import('../services/speakerDetectionService');
    
    const processedTranscript = await speakerService.detectAndFormatSpeakers(
      transcript,
      isChunk || false,
      chunkIndex || 0,
      totalChunks || 1
    );

    console.log(`[SpeakerDetection] ====== PROCESSING COMPLETE ======`);
    console.log(`[SpeakerDetection] Output length: ${processedTranscript.length} characters`);

    return res.json({
      success: true,
      processedTranscript,
    });
  } catch (error: any) {
    console.error('[SpeakerDetection] Error processing transcript:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to process transcript',
    });
  }
};

/**
 * Generate an intelligent narrative summary of a meeting
 * Uses GPT-4o to create a professional, natural-sounding summary
 * POST /transcripts/narrative-summary
 * Body: { 
 *   meetingTitle: string, 
 *   meetingType: string,
 *   meetingDate: string (ISO),
 *   meetingTime: string,
 *   duration?: number (seconds),
 *   transcript: string,
 *   language?: string,
 *   participantCount?: number
 * }
 */
export const generateNarrativeSummary = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { 
      meetingTitle, 
      meetingType, 
      meetingDate, 
      meetingTime,
      duration,
      transcript,
      language,
      participantCount
    } = req.body;

    if (!transcript || typeof transcript !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Transcript text is required',
      });
    }

    if (!meetingTitle || !meetingDate) {
      return res.status(400).json({
        success: false,
        error: 'Meeting title and date are required',
      });
    }

    console.log(`[NarrativeSummary] ====== GENERATING SUMMARY ======`);
    console.log(`[NarrativeSummary] User: ${userId}`);
    console.log(`[NarrativeSummary] Meeting: ${meetingTitle}`);
    console.log(`[NarrativeSummary] Transcript length: ${transcript.length} characters`);

    // Import and use the summary service
    const summaryService = await import('../services/meetingSummaryService');
    
    const summary = await summaryService.generateNarrativeSummary({
      meetingTitle,
      meetingType: meetingType || 'General',
      meetingDate,
      meetingTime: meetingTime || 'Unknown',
      duration,
      transcript,
      language,
      participantCount
    });

    console.log(`[NarrativeSummary] ====== SUMMARY GENERATED ======`);
    console.log(`[NarrativeSummary] Narrative length: ${summary.narrative.length} characters`);

    return res.json({
      success: true,
      summary,
    });
  } catch (error: any) {
    console.error('[NarrativeSummary] Error generating summary:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate narrative summary',
    });
  }
};

/**
 * Generate TTS audio from a narrative summary
 * Uses OpenAI TTS with realistic voice (onyx - professional male voice)
 * POST /transcripts/summary-audio
 * Body: { 
 *   text: string,
 *   voice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer',
 *   speed?: number (0.25 - 4.0)
 * }
 */
export const generateSummaryAudio = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { text, voice = 'onyx', speed = 1.0 } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Text is required for TTS',
      });
    }

    // Validate voice option
    const validVoices = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];
    if (!validVoices.includes(voice)) {
      return res.status(400).json({
        success: false,
        error: `Invalid voice. Valid options: ${validVoices.join(', ')}`,
      });
    }

    // Validate speed
    if (speed < 0.25 || speed > 4.0) {
      return res.status(400).json({
        success: false,
        error: 'Speed must be between 0.25 and 4.0',
      });
    }

    console.log(`[SummaryAudio] ====== GENERATING TTS ======`);
    console.log(`[SummaryAudio] User: ${userId}`);
    console.log(`[SummaryAudio] Voice: ${voice}, Speed: ${speed}x`);
    console.log(`[SummaryAudio] Text length: ${text.length} characters`);

    // Import and use the summary service
    const summaryService = await import('../services/meetingSummaryService');
    
    const audioBuffer = await summaryService.textToSpeech(text, voice as any, speed);

    console.log(`[SummaryAudio] ====== TTS GENERATED ======`);
    console.log(`[SummaryAudio] Audio size: ${audioBuffer.length} bytes`);

    // Set response headers for audio
    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Length': audioBuffer.length,
      'Content-Disposition': 'attachment; filename="summary.mp3"'
    });

    return res.send(audioBuffer);
  } catch (error: any) {
    console.error('[SummaryAudio] Error generating TTS:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate audio',
    });
  }
};

/**
 * Save AI narrative summary to database
 * Stores the generated summary in the MeetingSummary table
 * POST /transcripts/save-ai-summary
 * Body: {
 *   meetingId: string,
 *   narrative: string,
 *   briefSummary: string,
 *   tone: string,
 *   objectives: string[],
 *   keyDiscussions: string[],
 *   takeaways: string[],
 *   audioUrl?: string,
 *   audioVoice?: string,
 *   audioDuration?: number
 * }
 */
export const saveAISummary = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { 
      meetingId,
      narrative,
      briefSummary,
      tone,
      objectives,
      keyDiscussions,
      takeaways,
      audioUrl,
      audioVoice,
      audioDuration
    } = req.body;

    if (!meetingId) {
      return res.status(400).json({
        success: false,
        error: 'Meeting ID is required',
      });
    }

    if (!narrative || !briefSummary) {
      return res.status(400).json({
        success: false,
        error: 'Narrative and brief summary are required',
      });
    }

    console.log(`[SaveAISummary] ====== SAVING AI SUMMARY ======`);
    console.log(`[SaveAISummary] User: ${userId}`);
    console.log(`[SaveAISummary] Meeting: ${meetingId}`);
    console.log(`[SaveAISummary] Narrative length: ${narrative.length} characters`);
    console.log(`[SaveAISummary] Has audio: ${!!audioUrl}`);

    // Check if meeting exists (using the mobile meeting system)
    // Since we're using Firebase for meetings, we'll just save to the summary table
    // with meetingId as the key (meeting ID from iOS app)
    
    // Upsert - update if exists, create if not
    const summary = await prisma.meetingSummary.upsert({
      where: { meetingId },
      update: {
        narrative,
        briefSummary,
        tone,
        objectives: objectives || [],
        keyDiscussions: keyDiscussions || [],
        takeaways: takeaways || [],
        audioUrl,
        audioVoice,
        audioDuration,
        editedAt: new Date(),
        editedById: userId,
      },
      create: {
        meetingId,
        narrative,
        briefSummary,
        tone,
        objectives: objectives || [],
        keyDiscussions: keyDiscussions || [],
        takeaways: takeaways || [],
        audioUrl,
        audioVoice,
        audioDuration,
        generatedAt: new Date(),
      },
    });

    console.log(`[SaveAISummary] ====== AI SUMMARY SAVED ======`);
    console.log(`[SaveAISummary] Summary ID: ${summary.id}`);

    return res.json({
      success: true,
      summary: {
        id: summary.id,
        meetingId: summary.meetingId,
        narrative: summary.narrative,
        briefSummary: summary.briefSummary,
        tone: summary.tone,
        objectives: summary.objectives,
        keyDiscussions: summary.keyDiscussions,
        takeaways: summary.takeaways,
        audioUrl: summary.audioUrl,
        audioVoice: summary.audioVoice,
        audioDuration: summary.audioDuration,
        generatedAt: summary.generatedAt,
      },
    });
  } catch (error: any) {
    console.error('[SaveAISummary] Error saving AI summary:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to save AI summary',
    });
  }
};

/**
 * Get AI summary for a meeting
 * GET /transcripts/ai-summary/:meetingId
 */
export const getAISummary = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { meetingId } = req.params;

    if (!meetingId) {
      return res.status(400).json({
        success: false,
        error: 'Meeting ID is required',
      });
    }

    console.log(`[GetAISummary] Fetching summary for meeting: ${meetingId}`);

    const summary = await prisma.meetingSummary.findUnique({
      where: { meetingId },
    });

    if (!summary) {
      return res.status(404).json({
        success: false,
        error: 'No AI summary found for this meeting',
      });
    }

    return res.json({
      success: true,
      summary: {
        id: summary.id,
        meetingId: summary.meetingId,
        narrative: summary.narrative,
        briefSummary: summary.briefSummary,
        tone: summary.tone,
        objectives: summary.objectives,
        keyDiscussions: summary.keyDiscussions,
        takeaways: summary.takeaways,
        audioUrl: summary.audioUrl,
        audioVoice: summary.audioVoice,
        audioDuration: summary.audioDuration,
        generatedAt: summary.generatedAt,
      },
    });
  } catch (error: any) {
    console.error('[GetAISummary] Error fetching AI summary:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch AI summary',
    });
  }
};

/**
 * Save processed transcript to database
 * Stores both raw and AI-processed transcript
 * POST /transcripts/save-processed
 * Body: {
 *   meetingId: string,
 *   rawTranscript: string,
 *   processedTranscript: string,
 *   wordCount?: number,
 *   duration?: number
 * }
 */
export const saveProcessedTranscript = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { 
      meetingId,
      rawTranscript,
      processedTranscript,
      wordCount,
      duration
    } = req.body;

    if (!meetingId) {
      return res.status(400).json({
        success: false,
        error: 'Meeting ID is required',
      });
    }

    if (!rawTranscript && !processedTranscript) {
      return res.status(400).json({
        success: false,
        error: 'At least one transcript (raw or processed) is required',
      });
    }

    console.log(`[SaveProcessedTranscript] ====== SAVING TRANSCRIPT ======`);
    console.log(`[SaveProcessedTranscript] User: ${userId}`);
    console.log(`[SaveProcessedTranscript] Meeting: ${meetingId}`);
    console.log(`[SaveProcessedTranscript] Raw length: ${rawTranscript?.length || 0} characters`);
    console.log(`[SaveProcessedTranscript] Processed length: ${processedTranscript?.length || 0} characters`);

    // Upsert - update if exists, create if not
    const summary = await prisma.meetingSummary.upsert({
      where: { meetingId },
      update: {
        rawTranscript,
        processedTranscript,
        transcriptWordCount: wordCount,
        transcriptDuration: duration,
        transcriptSavedAt: new Date(),
        editedAt: new Date(),
        editedById: userId,
      },
      create: {
        meetingId,
        rawTranscript,
        processedTranscript,
        transcriptWordCount: wordCount,
        transcriptDuration: duration,
        transcriptSavedAt: new Date(),
        generatedAt: new Date(),
      },
    });

    console.log(`[SaveProcessedTranscript] ====== TRANSCRIPT SAVED ======`);
    console.log(`[SaveProcessedTranscript] Summary ID: ${summary.id}`);

    return res.json({
      success: true,
      transcript: {
        id: summary.id,
        meetingId: summary.meetingId,
        rawTranscript: summary.rawTranscript,
        processedTranscript: summary.processedTranscript,
        wordCount: summary.transcriptWordCount,
        duration: summary.transcriptDuration,
        savedAt: summary.transcriptSavedAt,
      },
    });
  } catch (error: any) {
    console.error('[SaveProcessedTranscript] Error saving transcript:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to save transcript',
    });
  }
};

/**
 * Get processed transcript for a meeting
 * GET /transcripts/processed/:meetingId
 */
export const getProcessedTranscript = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { meetingId } = req.params;

    if (!meetingId) {
      return res.status(400).json({
        success: false,
        error: 'Meeting ID is required',
      });
    }

    console.log(`[GetProcessedTranscript] Fetching transcript for meeting: ${meetingId}`);

    const summary = await prisma.meetingSummary.findUnique({
      where: { meetingId },
      select: {
        id: true,
        meetingId: true,
        rawTranscript: true,
        processedTranscript: true,
        transcriptWordCount: true,
        transcriptDuration: true,
        transcriptSavedAt: true,
      },
    });

    if (!summary || (!summary.rawTranscript && !summary.processedTranscript)) {
      return res.status(404).json({
        success: false,
        error: 'No transcript found for this meeting',
      });
    }

    return res.json({
      success: true,
      transcript: {
        id: summary.id,
        meetingId: summary.meetingId,
        rawTranscript: summary.rawTranscript,
        processedTranscript: summary.processedTranscript,
        wordCount: summary.transcriptWordCount,
        duration: summary.transcriptDuration,
        savedAt: summary.transcriptSavedAt,
      },
    });
  } catch (error: any) {
    console.error('[GetProcessedTranscript] Error fetching transcript:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch transcript',
    });
  }
};

/**
 * Enterprise Speaker Diarization — Pyannote + Whisper
 * POST /transcripts/diarize
 * Body: multipart/form-data with 'audio' file
 * Form fields: language?, numSpeakers?, meetingType?
 * 
 * Returns speaker-attributed transcript blocks with precise timestamps
 * using Pyannote audio-based speaker diarization and Whisper word-level
 * transcription. Falls back to Whisper+GPT if diarization service unavailable.
 */
export const diarizeAudio = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const file = req.file;
    if (!file) {
      return res.status(400).json({
        success: false,
        error: 'No audio file provided. Please upload an audio file.',
      });
    }

    const { language, numSpeakers, meetingType } = req.body;

    const fileSizeMB = (file.size / 1024 / 1024).toFixed(2);
    console.log(`[Diarization] ====== DIARIZATION REQUEST ======`);
    console.log(`[Diarization] User: ${userId}`);
    console.log(`[Diarization] File: ${file.originalname}`);
    console.log(`[Diarization] Size: ${fileSizeMB}MB (${file.size} bytes)`);
    console.log(`[Diarization] MIME: ${file.mimetype}`);
    console.log(`[Diarization] Language: ${language || 'auto'}`);
    console.log(`[Diarization] Expected speakers: ${numSpeakers || 'auto'}`);

    // Import diarization service
    const diarizationService = await import('../services/diarizationService');

    // Use diarizeWithFallback for resilience
    const result = await diarizationService.diarizeWithFallback(
      file.buffer,
      file.originalname,
      {
        language: language as string || undefined,
        numSpeakers: numSpeakers ? parseInt(numSpeakers as string, 10) : undefined,
        meetingType: meetingType as string || 'general',
      }
    );

    if (!result.success) {
      console.error('[Diarization] Failed:', result.error);
      return res.status(500).json({
        success: false,
        error: result.error || 'Diarization failed',
      });
    }

    console.log(`[Diarization] ====== DIARIZATION COMPLETE ======`);
    console.log(`[Diarization] Blocks: ${result.blocks.length}`);
    console.log(`[Diarization] Speakers: ${result.speakerCount} (${result.speakers.join(', ')})`);
    console.log(`[Diarization] Words: ${result.totalWords}`);
    console.log(`[Diarization] Duration: ${result.totalDuration}s`);
    console.log(`[Diarization] Processing: ${result.processingTimeSeconds}s`);
    console.log(`[Diarization] Fallback used: ${result.fallbackUsed || false}`);

    return res.json({
      success: true,
      blocks: result.blocks,
      speakers: result.speakers,
      speakerCount: result.speakerCount,
      totalDuration: result.totalDuration,
      totalWords: result.totalWords,
      language: result.language,
      processingTimeSeconds: result.processingTimeSeconds,
      fallbackUsed: result.fallbackUsed || false,
    });
  } catch (error: any) {
    console.error('[Diarization] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to diarize audio',
    });
  }
};
