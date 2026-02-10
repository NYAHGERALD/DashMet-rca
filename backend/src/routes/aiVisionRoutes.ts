import { Router, Request, Response } from 'express';
import { adminFirestore } from '../config/firebase-admin';

const router = Router();

// Firestore collections
const SESSIONS_COLLECTION = 'vision_sessions';

interface FrameData {
  base64: string;
  timestamp: string;
}

interface AnalyzeRequest {
  frames: FrameData[];
  question: string;
  topic: string;
}

interface TTSRequest {
  text: string;
  voice?: string;
  speed?: number;
}

// Generate conversational system prompt with STRICT scope enforcement
function getSystemPrompt(topic: string): string {
  const topicExpertise: Record<string, string> = {
    'Workplace Safety': 'workplace safety, hazard identification, OSHA compliance, accident prevention, and safety protocols',
    'Food Safety & Hygiene': 'food safety, FDA regulations, contamination prevention, hygiene practices, and temperature control',
    'Quality Control': 'quality assurance, defect detection, process improvement, and quality standards',
    'Warehouse & Logistics': 'warehouse operations, logistics efficiency, inventory management, and material handling',
    'Maintenance & Equipment': 'equipment maintenance, preventive maintenance, troubleshooting, and machinery diagnostics',
    'Operations & Efficiency': 'operational efficiency, workflow optimization, bottleneck identification, and process improvement',
    'Manufacturing Process': 'manufacturing processes, production optimization, lean principles, and assembly operations',
    'Human Resources': 'workplace dynamics, team interactions, employee engagement, and organizational culture',
    'Ergonomics & Wellness': 'ergonomics, workplace wellness, posture assessment, and repetitive strain prevention',
    'Environmental Compliance': 'environmental regulations, sustainability, waste management, and pollution prevention',
    'Electrical Safety': 'electrical safety, wiring hazards, electrical code compliance, and shock prevention',
    'Fire Safety': 'fire safety, fire hazards, emergency exits, fire suppression systems, and prevention',
    'Chemical Handling': 'chemical safety, MSDS compliance, proper storage, handling procedures, and PPE requirements',
    'PPE Compliance': 'personal protective equipment requirements, proper usage, and compliance verification',
    'Sanitation & Cleanliness': 'sanitation standards, cleaning protocols, contamination prevention, and hygiene',
    'Pest Control': 'pest identification, infestation signs, prevention measures, and pest management',
    'Storage & Organization': 'storage systems, organization methods, space optimization, and proper stacking',
    'Shipping & Receiving': 'shipping procedures, receiving protocols, packaging, and logistics documentation',
    'Marketing & Branding': 'brand presentation, visual merchandising, marketing displays, and customer experience',
    'Finance & Assets': 'asset management, equipment valuation, cost efficiency, and financial optimization',
    'Nursing & Healthcare': 'patient safety, infection control, medical protocols, and healthcare standards',
    'Pharmacy & Medication': 'medication storage, dispensing protocols, pharmaceutical compliance, and drug safety',
    'Construction Safety': 'construction site safety, OSHA compliance, fall protection, and scaffolding safety',
    'Automotive & Fleet': 'vehicle maintenance, fleet management, automotive diagnostics, and transportation safety',
    'Retail Operations': 'retail operations, store layout, inventory management, and customer experience',
    'Hospitality & Service': 'hospitality standards, guest experience, service quality, and presentation',
    'Agriculture & Farming': 'farming operations, crop health, agricultural equipment, and farm safety',
    'General Assessment': 'general observation, safety, efficiency, and practical improvements',
  };

  const expertise = topicExpertise[topic] || topicExpertise['General Assessment'];

  return `You are a friendly AI assistant specialized in "${topic}". You're having a real conversation while helping the user analyze what they're looking at through their camera.

CURRENT SESSION TOPIC: ${topic}
YOUR EXPERTISE SCOPE: ${expertise}

IMPORTANT - SCOPE ENFORCEMENT (DO THIS FIRST):
Before responding, check if the user's message relates to: ${expertise}

If the message is CLEARLY OFF-TOPIC (personal questions, unrelated subjects like fashion, movies, relationships, general knowledge not related to ${topic.toLowerCase()}):
→ Respond: "That's outside our ${topic.toLowerCase()} focus for this session. If you'd like to discuss something else, you can change the topic from the menu at the top. Otherwise, I'm here to help with any ${topic.toLowerCase()} questions about what you're seeing!"

WHAT IS IN-SCOPE:
- Questions about the scene related to ${topic.toLowerCase()}
- Follow-up questions about previous ${topic.toLowerCase()} observations
- Asking for clarification on ${topic.toLowerCase()} advice
- Appreciation messages (thank you, thanks, etc.) - respond warmly
- Asking what you can help with - explain your ${topic.toLowerCase()} expertise

WHAT IS OUT-OF-SCOPE (redirect politely):
- Personal topics (fashion, preferences, hobbies, relationships)
- General knowledge questions unrelated to ${topic.toLowerCase()}
- Questions about completely different industries/topics
- Entertainment, sports, news, etc.

CONVERSATION STYLE:
- Be warm, friendly, and conversational
- Never use "Based on the frames" or robotic language
- Never use numbered lists or bullet points
- Keep responses concise (2-4 sentences for questions, 1-2 for small talk)
- Reference what you see naturally when answering in-scope questions

SPECIAL RESPONSES:
- "Thank you" / appreciation → "You're welcome! Let me know if you have any other ${topic.toLowerCase()} questions about what you're seeing."
- Frustration / negative → Acknowledge, offer to help better with specific questions
- "What can you do?" → Explain you can analyze the scene for ${topic.toLowerCase()} concerns

Remember: You are a ${topic} specialist. Stay helpful but stay on topic!`;
}

/**
 * POST /api/ai-vision/analyze
 * Analyze frames with GPT-4 Vision
 */
router.post('/analyze', async (req: Request, res: Response) => {
  try {
    const { frames, question, topic } = req.body as AnalyzeRequest;
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: 'OpenAI API key not configured' });
    }

    if (!frames || frames.length === 0) {
      return res.status(400).json({ error: 'No frames provided' });
    }

    if (!question) {
      return res.status(400).json({ error: 'No question provided' });
    }

    // Get the conversational system prompt with topic context
    const systemPrompt = getSystemPrompt(topic || 'General Assessment');

    // Build image content for OpenAI
    const imageContent = frames.map((frame) => ({
      type: 'image_url',
      image_url: {
        url: `data:image/jpeg;base64,${frame.base64}`,
        detail: 'high',
      },
    }));

    // Build user message - just pass what the user said directly
    const userContent = [
      {
        type: 'text',
        text: question,  // Pass the user's words directly, no wrapper
      },
      ...imageContent,
    ];

    // Call GPT-4 Vision via fetch
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: userContent,
          },
        ],
        max_tokens: 1000,
        temperature: 0.8,
      }),
    });

    if (!openaiResponse.ok) {
      const errorData = await openaiResponse.json() as { error?: { message?: string } };
      console.error('OpenAI API error:', errorData);
      return res.status(openaiResponse.status).json({
        error: errorData.error?.message || 'Failed to analyze frames',
      });
    }

    const data = await openaiResponse.json() as { choices?: { message?: { content?: string } }[] };
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return res.status(500).json({ error: 'No response from AI' });
    }

    return res.json({ response: content });
  } catch (error: any) {
    console.error('AI Vision analyze error:', error);
    return res.status(500).json({
      error: error.message || 'Failed to analyze frames',
    });
  }
});

/**
 * POST /api/ai-vision/tts
 * Convert text to speech using OpenAI TTS
 */
router.post('/tts', async (req: Request, res: Response) => {
  try {
    const { text, voice = 'nova', speed = 1.0 } = req.body as TTSRequest;
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: 'OpenAI API key not configured' });
    }

    if (!text) {
      return res.status(400).json({ error: 'No text provided' });
    }

    // Truncate text if too long
    const truncatedText = text.substring(0, 4000);

    // Call OpenAI TTS via fetch
    const openaiResponse = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'tts-1-hd',
        voice: voice,
        input: truncatedText,
        speed: speed,
      }),
    });

    if (!openaiResponse.ok) {
      const errorData = await openaiResponse.json() as { error?: { message?: string } };
      console.error('TTS API error:', errorData);
      return res.status(openaiResponse.status).json({
        error: errorData.error?.message || 'Failed to generate speech',
      });
    }

    // Get audio data as buffer
    const audioBuffer = Buffer.from(await openaiResponse.arrayBuffer());

    // Send audio as response
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', audioBuffer.length);
    return res.send(audioBuffer);
  } catch (error: any) {
    console.error('TTS error:', error);
    return res.status(500).json({
      error: error.message || 'Failed to generate speech',
    });
  }
});

/**
 * POST /api/ai-vision/transcribe
 * Transcribe audio using OpenAI Whisper API
 */
router.post('/transcribe', async (req: Request, res: Response) => {
  try {
    const { audio } = req.body as { audio: string }; // base64 encoded audio
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: 'OpenAI API key not configured' });
    }

    if (!audio) {
      return res.status(400).json({ error: 'No audio provided' });
    }

    // Decode base64 audio to buffer
    const audioBuffer = Buffer.from(audio, 'base64');

    // Create form data for Whisper API
    const formData = new FormData();
    const audioBlob = new Blob([audioBuffer], { type: 'audio/m4a' });
    formData.append('file', audioBlob, 'audio.m4a');
    formData.append('model', 'whisper-1');
    formData.append('language', 'en');
    formData.append('response_format', 'json');

    // Call OpenAI Whisper API
    const openaiResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      body: formData,
    });

    if (!openaiResponse.ok) {
      const errorData = await openaiResponse.json() as { error?: { message?: string } };
      console.error('Whisper API error:', errorData);
      return res.status(openaiResponse.status).json({
        error: errorData.error?.message || 'Failed to transcribe audio',
      });
    }

    const data = await openaiResponse.json() as { text?: string };
    const transcription = data.text?.trim() || '';

    return res.json({ transcription });
  } catch (error: any) {
    console.error('Transcription error:', error);
    return res.status(500).json({
      error: error.message || 'Failed to transcribe audio',
    });
  }
});

// ============================================
// VISION SESSION ENDPOINTS (Database Storage)
// ============================================

interface VisionMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface VisionSession {
  id: string;
  userId: string;
  topic: string;
  topicIcon: string;
  messages: VisionMessage[];
  createdAt: string;
  updatedAt: string;
  summary?: string;
}

/**
 * POST /api/ai-vision/sessions
 * Save a new vision session to the database
 */
router.post('/sessions', async (req: Request, res: Response) => {
  try {
    const { userId, session } = req.body as { userId: string; session: VisionSession };

    if (!userId || !session) {
      return res.status(400).json({ error: 'userId and session are required' });
    }

    // Create session document
    const sessionDoc = {
      ...session,
      userId,
      savedAt: new Date().toISOString(),
    };

    // Save to Firestore
    await adminFirestore
      .collection(SESSIONS_COLLECTION)
      .doc(session.id)
      .set(sessionDoc);

    console.log(`✅ Vision session saved: ${session.id} for user ${userId}`);

    return res.status(201).json({
      success: true,
      message: 'Session saved successfully',
      sessionId: session.id,
    });
  } catch (error: any) {
    console.error('Error saving vision session:', error);
    return res.status(500).json({
      error: error.message || 'Failed to save session',
    });
  }
});

/**
 * GET /api/ai-vision/sessions/:userId
 * Get all vision sessions for a user
 */
router.get('/sessions/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    // Query sessions for this user, ordered by creation date
    const snapshot = await adminFirestore
      .collection(SESSIONS_COLLECTION)
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .get();

    const sessions: VisionSession[] = [];
    snapshot.forEach((doc) => {
      sessions.push(doc.data() as VisionSession);
    });

    return res.json({ sessions });
  } catch (error: any) {
    console.error('Error fetching vision sessions:', error);
    return res.status(500).json({
      error: error.message || 'Failed to fetch sessions',
    });
  }
});

/**
 * GET /api/ai-vision/sessions/:userId/:sessionId
 * Get a specific vision session
 */
router.get('/sessions/:userId/:sessionId', async (req: Request, res: Response) => {
  try {
    const { userId, sessionId } = req.params;

    if (!userId || !sessionId) {
      return res.status(400).json({ error: 'userId and sessionId are required' });
    }

    const doc = await adminFirestore
      .collection(SESSIONS_COLLECTION)
      .doc(sessionId)
      .get();

    if (!doc.exists) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const session = doc.data() as VisionSession;

    // Verify ownership
    if (session.userId !== userId) {
      return res.status(403).json({ error: 'Not authorized to access this session' });
    }

    return res.json({ session });
  } catch (error: any) {
    console.error('Error fetching vision session:', error);
    return res.status(500).json({
      error: error.message || 'Failed to fetch session',
    });
  }
});

/**
 * PUT /api/ai-vision/sessions/:sessionId
 * Update a vision session (e.g., add summary)
 */
router.put('/sessions/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const { userId, summary } = req.body as { userId: string; summary?: string };

    if (!sessionId || !userId) {
      return res.status(400).json({ error: 'sessionId and userId are required' });
    }

    // Get existing session
    const doc = await adminFirestore
      .collection(SESSIONS_COLLECTION)
      .doc(sessionId)
      .get();

    if (!doc.exists) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const session = doc.data() as VisionSession;

    // Verify ownership
    if (session.userId !== userId) {
      return res.status(403).json({ error: 'Not authorized to update this session' });
    }

    // Update session
    const updates: Partial<VisionSession> = {
      updatedAt: new Date().toISOString(),
    };

    if (summary !== undefined) {
      updates.summary = summary;
    }

    await adminFirestore
      .collection(SESSIONS_COLLECTION)
      .doc(sessionId)
      .update(updates);

    return res.json({
      success: true,
      message: 'Session updated successfully',
    });
  } catch (error: any) {
    console.error('Error updating vision session:', error);
    return res.status(500).json({
      error: error.message || 'Failed to update session',
    });
  }
});

/**
 * DELETE /api/ai-vision/sessions/:sessionId
 * Delete a vision session
 */
router.delete('/sessions/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const { userId } = req.body as { userId: string };

    if (!sessionId || !userId) {
      return res.status(400).json({ error: 'sessionId and userId are required' });
    }

    // Get existing session
    const doc = await adminFirestore
      .collection(SESSIONS_COLLECTION)
      .doc(sessionId)
      .get();

    if (!doc.exists) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const session = doc.data() as VisionSession;

    // Verify ownership
    if (session.userId !== userId) {
      return res.status(403).json({ error: 'Not authorized to delete this session' });
    }

    // Delete session
    await adminFirestore
      .collection(SESSIONS_COLLECTION)
      .doc(sessionId)
      .delete();

    console.log(`✅ Vision session deleted: ${sessionId}`);

    return res.json({
      success: true,
      message: 'Session deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting vision session:', error);
    return res.status(500).json({
      error: error.message || 'Failed to delete session',
    });
  }
});

/**
 * POST /api/ai-vision/sessions/:sessionId/summarize
 * Generate AI summary for a session
 */
router.post('/sessions/:sessionId/summarize', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const { userId } = req.body as { userId: string };
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: 'OpenAI API key not configured' });
    }

    if (!sessionId || !userId) {
      return res.status(400).json({ error: 'sessionId and userId are required' });
    }

    // Get session
    const doc = await adminFirestore
      .collection(SESSIONS_COLLECTION)
      .doc(sessionId)
      .get();

    if (!doc.exists) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const session = doc.data() as VisionSession;

    if (session.userId !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Build conversation text
    const conversationText = session.messages
      .map((m) => `${m.role === 'user' ? 'User' : 'AI'}: ${m.content}`)
      .join('\n');

    // Generate summary with GPT
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a helpful assistant that summarizes ${session.topic} analysis sessions. Create a brief, professional summary highlighting key observations, issues identified, and recommendations made. Keep it under 200 words.`,
          },
          {
            role: 'user',
            content: `Summarize this ${session.topic} analysis session:\n\n${conversationText}`,
          },
        ],
        max_tokens: 500,
        temperature: 0.7,
      }),
    });

    if (!openaiResponse.ok) {
      const errorData = await openaiResponse.json() as { error?: { message?: string } };
      console.error('OpenAI summary error:', errorData);
      return res.status(openaiResponse.status).json({
        error: errorData.error?.message || 'Failed to generate summary',
      });
    }

    const data = await openaiResponse.json() as { choices?: { message?: { content?: string } }[] };
    const summary = data.choices?.[0]?.message?.content?.trim() || 'Summary generation failed.';

    // Save summary to session
    await adminFirestore
      .collection(SESSIONS_COLLECTION)
      .doc(sessionId)
      .update({
        summary,
        updatedAt: new Date().toISOString(),
      });

    return res.json({ summary });
  } catch (error: any) {
    console.error('Error generating summary:', error);
    return res.status(500).json({
      error: error.message || 'Failed to generate summary',
    });
  }
});

export default router;
