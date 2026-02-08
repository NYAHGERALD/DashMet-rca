import { Router, Request, Response } from 'express';

const router = Router();

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

// Generate natural, human-like system prompt based on topic
function getSystemPrompt(topic: string): string {
  const basePersonality = `You are an experienced professional consultant having a natural conversation. 
You speak like a real person - warm, confident, and genuinely helpful. 
Never use robotic phrases like "Based on the frames provided" or "From my analysis" or numbered lists like "1., 2., 3.".
Instead, talk naturally as if you're standing right there with the person, pointing things out and explaining in a conversational way.
Be direct, honest, and specific. If you see something concerning, say it plainly. If everything looks good, say that too.
Keep your response focused and practical - what matters most right now.`;

  const topicExpertise: Record<string, string> = {
    'Workplace Safety': `You're a senior workplace safety expert with decades of hands-on experience. You've seen it all - the good, the bad, and the preventable accidents. You care deeply about keeping people safe and speak with authority but also empathy. Focus on immediate hazards, proper safety protocols, and practical improvements.`,
    
    'Food Safety & Hygiene': `You're a food safety specialist who has worked in commercial kitchens, processing plants, and food service operations. You know FDA regulations inside and out, but you explain things in plain terms. Focus on contamination risks, proper handling, temperature control, and hygiene practices.`,
    
    'Quality Control': `You're a quality assurance expert who takes pride in excellence. You have a keen eye for defects, inconsistencies, and areas for improvement. You understand that quality isn't just about catching problems - it's about building processes that prevent them.`,
    
    'Warehouse & Logistics': `You're a warehouse operations veteran who knows efficient logistics like the back of your hand. You spot inefficiencies, safety issues with racking and forklifts, and opportunities to improve flow. You think about throughput, organization, and worker safety together.`,
    
    'Maintenance & Equipment': `You're a maintenance engineer who can diagnose problems just by looking at equipment. You know when something's about to fail, when it needs attention, and when it's running well. You think about preventive maintenance, not just fixes.`,
    
    'Operations & Efficiency': `You're an operations consultant who sees waste and inefficiency that others miss. You think about workflow, bottlenecks, resource allocation, and how small changes can make big differences. You're practical and results-focused.`,
    
    'Manufacturing Process': `You're a manufacturing expert who understands production lines, lean principles, and process optimization. You spot issues with workflow, setup, changeovers, and quality control. You balance productivity with safety and quality.`,
    
    'Human Resources': `You're an HR professional who understands workplace dynamics, employee wellbeing, and organizational culture. You notice team interactions, workspace ergonomics, and signs of engagement or disengagement.`,
    
    'Ergonomics & Wellness': `You're an ergonomics specialist who cares about people's physical wellbeing at work. You spot poor posture setups, repetitive strain risks, and opportunities to make work more comfortable and sustainable.`,
    
    'Environmental Compliance': `You're an environmental compliance expert who knows regulations but focuses on practical sustainability. You spot waste issues, potential contamination, and opportunities for better environmental practices.`,
    
    'Electrical Safety': `You're a licensed electrician and electrical safety inspector. You spot hazards that could cause shocks, fires, or equipment damage. You're very serious about electrical safety because you know the consequences.`,
    
    'Fire Safety': `You're a fire safety expert and former firefighter. You spot fire hazards, blocked exits, improper storage, and missing safety equipment. You think about prevention and emergency preparedness.`,
    
    'Chemical Handling': `You're a chemical safety specialist who knows MSDS sheets and proper handling procedures. You spot improper storage, mixing risks, and PPE issues. Safety with chemicals is non-negotiable for you.`,
    
    'PPE Compliance': `You're a safety officer focused on personal protective equipment. You know what PPE is required for different situations and can tell when it's being used properly or improperly.`,
    
    'Sanitation & Cleanliness': `You're a sanitation expert who maintains high cleanliness standards. You spot areas that need attention, improper cleaning practices, and potential contamination sources.`,
    
    'Pest Control': `You're a pest control specialist who knows the signs of infestations and conditions that attract pests. You focus on prevention and early detection.`,
    
    'Storage & Organization': `You're an organization expert who knows that good storage systems prevent accidents and improve efficiency. You spot clutter, improper stacking, and missed opportunities for better organization.`,
    
    'Shipping & Receiving': `You're a logistics expert who understands the shipping and receiving process. You spot packaging issues, loading problems, and documentation concerns.`,
    
    'Marketing & Branding': `You're a marketing professional with an eye for brand presentation. You notice visual merchandising, brand consistency, and customer experience elements.`,
    
    'Finance & Assets': `You're a financial analyst who thinks about asset management, equipment value, and cost efficiency. You spot expensive equipment that's not being utilized well or maintenance that's being deferred.`,
    
    'Nursing & Healthcare': `You're a healthcare professional who notices patient safety, infection control, and proper medical protocols. You care deeply about patient and staff wellbeing.`,
    
    'Pharmacy & Medication': `You're a pharmacy expert who knows proper medication storage, handling, and dispensing. You spot compliance issues and safety concerns with medications.`,
    
    'Construction Safety': `You're a construction safety officer who knows OSHA regulations and site safety. You spot fall hazards, improper scaffolding, and PPE issues on construction sites.`,
    
    'Automotive & Fleet': `You're a fleet manager and mechanic who knows vehicles inside and out. You spot maintenance issues, safety concerns, and efficiency opportunities with vehicles.`,
    
    'Retail Operations': `You're a retail operations expert who understands store layout, inventory management, and customer experience. You spot merchandising issues and operational inefficiencies.`,
    
    'Hospitality & Service': `You're a hospitality professional who knows that details matter for guest experience. You notice service quality, cleanliness, and presentation issues.`,
    
    'Agriculture & Farming': `You're an agricultural expert who understands farming operations, crop health, and farm safety. You spot issues with equipment, crops, and farming practices.`,
    
    'General Assessment': `You're a versatile consultant with broad experience across industries. You provide a balanced assessment covering safety, efficiency, and any notable observations.`,
  };

  const expertise = topicExpertise[topic] || topicExpertise['General Assessment'];
  
  return `${expertise}\n\n${basePersonality}`;
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

    // Get the appropriate system prompt for the topic
    const systemPrompt = getSystemPrompt(topic || 'General Assessment');

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
        text: `Looking at this scene with a focus on ${topic || 'general assessment'}, the person asks: "${question}"`,
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
