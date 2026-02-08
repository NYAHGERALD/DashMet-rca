import { Router, Request, Response } from 'express';

const router = Router();

interface FrameData {
  base64: string;
  timestamp: string;
}

interface AnalyzeRequest {
  frames: FrameData[];
  question: string;
  systemPrompt: string;
}

interface TTSRequest {
  text: string;
  voice?: string;
  speed?: number;
}

/**
 * POST /api/ai-vision/analyze
 * Analyze frames with GPT-4 Vision
 */
router.post('/analyze', async (req: Request, res: Response) => {
  try {
    const { frames, question, systemPrompt } = req.body as AnalyzeRequest;
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

    // Build image content for OpenAI
    const imageContent = frames.map((frame) => ({
      type: 'image_url',
      image_url: {
        url: `data:image/jpeg;base64,${frame.base64}`,
        detail: 'high',
      },
    }));

    // Build user message content
    const userContent = [
      {
        type: 'text',
        text: `I have captured ${frames.length} sequential frames over approximately 2 seconds. These frames represent movement over time and should be analyzed as a sequence.\n\nMy question is: ${question}\n\nPlease analyze these frames in order and provide your expert assessment.`,
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
        max_tokens: 1500,
        temperature: 0.7,
      }),
    });

    if (!openaiResponse.ok) {
      const errorData = await openaiResponse.json();
      console.error('OpenAI API error:', errorData);
      return res.status(openaiResponse.status).json({
        error: errorData.error?.message || 'Failed to analyze frames',
      });
    }

    const data = await openaiResponse.json();
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
    const { text, voice = 'onyx', speed = 0.95 } = req.body as TTSRequest;
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
      const errorData = await openaiResponse.json();
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

export default router;
