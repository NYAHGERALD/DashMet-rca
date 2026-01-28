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
