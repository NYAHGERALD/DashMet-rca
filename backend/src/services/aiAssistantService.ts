/**
 * AI Assistant Service
 * 
 * Provides real-time conversational AI with persistent memory.
 * - Stores conversation history in PostgreSQL via Prisma
 * - Uses OpenAI GPT-4o-mini for fast, natural responses
 * - SSE streaming with sentence-chunked TTS for near-instant voice
 * - Cross-conversation memory search
 * - Auto-generates conversation titles and summaries
 */

import { PrismaClient } from '@prisma/client';
import OpenAI from 'openai';
import { Response } from 'express';

const prisma = new PrismaClient();

// ─── OpenAI Client (Lazy Singleton) ──────────────────────

let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable is not set');
  }
  if (openaiClient) return openaiClient;
  openaiClient = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    timeout: 30000,
    maxRetries: 1,
  });
  return openaiClient;
}

// ─── System Prompt (optimized for natural spoken conversation) ─

const SYSTEM_PROMPT = `You are DashMet AI, a friendly colleague at DashMet. Talk like a real person in a real conversation.

Rules:
- Keep answers to 1-3 sentences. Only go longer when explaining something complex.
- Never use bullet points, numbered lists, markdown, or formatting. Just talk.
- Write exactly how people speak out loud. Use contractions, casual phrasing.
- If someone says hi, say hi back naturally. Don't list your capabilities.
- Reference conversation context naturally, not formally.
- Be warm, helpful, and direct. No filler phrases like "Great question!" or "Absolutely!"
- If you don't know something, just say so simply.
- You help with workplace tasks, planning, problem-solving, and general knowledge.
- Your words are spoken aloud via voice — never output anything that sounds weird read aloud.`;

const MAX_CONTEXT_MESSAGES = 20;
const CHAT_MODEL = process.env.AI_MODEL || 'gpt-5.2';
const TTS_VOICE = 'nova';

// ─── Conversation Management ─────────────────────────────

export async function createConversation(
  userId: string,
  organizationId?: string | null,
  title?: string
) {
  return prisma.aiAssistantConversation.create({
    data: {
      userId,
      organizationId: organizationId || null,
      title: title || 'New Conversation',
    },
    include: { messages: true },
  });
}

export async function getConversations(
  userId: string,
  limit = 50,
  offset = 0
) {
  const conversations = await prisma.aiAssistantConversation.findMany({
    where: { userId, isActive: true },
    include: {
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { content: true, role: true, createdAt: true },
      },
      _count: { select: { messages: true } },
    },
    orderBy: { updatedAt: 'desc' },
    take: limit,
    skip: offset,
  });

  return conversations.map((c) => ({
    id: c.id,
    title: c.title,
    summary: c.summary,
    messageCount: c._count.messages,
    lastMessage: c.messages[0] || null,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  }));
}

export async function getConversation(conversationId: string) {
  return prisma.aiAssistantConversation.findUnique({
    where: { id: conversationId },
    include: {
      messages: { orderBy: { createdAt: 'asc' } },
    },
  });
}

export async function deleteConversation(conversationId: string) {
  return prisma.aiAssistantConversation.update({
    where: { id: conversationId },
    data: { isActive: false },
  });
}

// ─── Build Messages Array (shared between streaming and non-streaming) ─

async function buildMessagesArray(
  conversation: any,
  userMessage: string
): Promise<OpenAI.ChatCompletionMessageParam[]> {
  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: 'system', content: SYSTEM_PROMPT },
  ];

  // Include conversation summary for long-term context
  if (conversation.summary) {
    messages.push({
      role: 'system',
      content: `Earlier context: ${conversation.summary}`,
    });
  }

  // Add recent messages from this conversation
  for (const msg of conversation.messages) {
    messages.push({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    });
  }

  // Add the new user message
  messages.push({ role: 'user', content: userMessage });

  return messages;
}

// ─── Send Message & Get AI Response (legacy non-streaming) ─

export async function sendMessage(
  conversationId: string,
  userMessage: string
) {
  const openai = getOpenAIClient();

  const conversation = await prisma.aiAssistantConversation.findUnique({
    where: { id: conversationId },
    include: {
      messages: {
        orderBy: { createdAt: 'asc' },
        take: MAX_CONTEXT_MESSAGES,
      },
    },
  });

  if (!conversation) throw new Error('Conversation not found');

  // Save user message + build messages in parallel
  const [savedUserMsg, messages] = await Promise.all([
    prisma.aiAssistantMessage.create({
      data: { conversationId, role: 'user', content: userMessage },
    }),
    buildMessagesArray(conversation, userMessage),
  ]);

  // Fire memory search in background (non-blocking for speed)
  searchUserMemory(conversation.userId, userMessage, conversationId)
    .then((ctx) => {
      if (ctx) {
        // Memory context will be available for future messages
        console.log('📝 Memory context found for future reference');
      }
    })
    .catch(() => {});

  const completion = await openai.chat.completions.create({
    model: CHAT_MODEL,
    messages,
    temperature: 0.8,
    max_completion_tokens: 200,
    presence_penalty: 0.3,
    frequency_penalty: 0.2,
  });

  const aiResponse =
    completion.choices[0]?.message?.content ||
    "Sorry, I didn't catch that. Could you say it again?";

  const savedAiMsg = await prisma.aiAssistantMessage.create({
    data: {
      conversationId,
      role: 'assistant',
      content: aiResponse,
      metadata: { model: completion.model },
    },
  });

  // Fire-and-forget: title generation & conversation update
  if (conversation.messages.length === 0) {
    generateTitle(userMessage, aiResponse)
      .then((title) =>
        prisma.aiAssistantConversation.update({
          where: { id: conversationId },
          data: { title, updatedAt: new Date() },
        })
      )
      .catch(console.error);
  } else {
    prisma.aiAssistantConversation
      .update({ where: { id: conversationId }, data: { updatedAt: new Date() } })
      .catch(console.error);
  }

  // Auto-summarize every 30 messages (fire-and-forget)
  const totalMessages = conversation.messages.length + 2;
  if (totalMessages > 0 && totalMessages % 30 === 0) {
    summarizeConversation(conversationId).catch(console.error);
  }

  return { userMessage: savedUserMsg, aiMessage: savedAiMsg };
}

// ─── Streaming Message (SSE with sentence-chunked TTS) ───

/**
 * Streams AI response via SSE with interleaved TTS audio chunks.
 * 
 * SSE Events:
 *   event: token     data: {"t":"word "}       — text token
 *   event: audio     data: {"a":"<base64>","i":0}  — TTS audio for sentence chunk
 *   event: done      data: {"id":"msg-id","text":"full text"}
 *   event: error     data: {"error":"message"}
 */
export async function sendMessageStream(
  conversationId: string,
  userMessage: string,
  res: Response,
  voice: string = TTS_VOICE
) {
  const openai = getOpenAIClient();

  const conversation = await prisma.aiAssistantConversation.findUnique({
    where: { id: conversationId },
    include: {
      messages: {
        orderBy: { createdAt: 'asc' },
        take: MAX_CONTEXT_MESSAGES,
      },
    },
  });

  if (!conversation) {
    res.write(`event: error\ndata: ${JSON.stringify({ error: 'Conversation not found' })}\n\n`);
    res.end();
    return;
  }

  // Save user message + build messages array in parallel
  const [savedUserMsg, messages] = await Promise.all([
    prisma.aiAssistantMessage.create({
      data: { conversationId, role: 'user', content: userMessage },
    }),
    buildMessagesArray(conversation, userMessage),
  ]);

  // Send saved user message ID
  res.write(`event: user_msg\ndata: ${JSON.stringify({ id: savedUserMsg.id })}\n\n`);

  // Start GPT streaming
  const stream = await openai.chat.completions.create({
    model: CHAT_MODEL,
    messages,
    temperature: 0.8,
    max_completion_tokens: 200,
    presence_penalty: 0.3,
    frequency_penalty: 0.2,
    stream: true,
  });

  let fullText = '';
  let sentenceBuffer = '';
  let sentenceIndex = 0;
  const ttsPromises: Promise<void>[] = [];

  // Process tokens from the stream
  for await (const chunk of stream) {
    const token = chunk.choices[0]?.delta?.content;
    if (!token) continue;

    fullText += token;
    sentenceBuffer += token;

    // Send token immediately for live text display
    res.write(`event: token\ndata: ${JSON.stringify({ t: token })}\n\n`);

    // Detect sentence boundaries and fire TTS
    const boundary = detectSentenceBoundary(sentenceBuffer);
    if (boundary) {
      const sentenceText = boundary.sentence.trim();
      sentenceBuffer = boundary.remaining;

      if (sentenceText.length > 0) {
        const idx = sentenceIndex++;
        // Fire TTS for this sentence in background, send audio when ready
        const ttsPromise = generateAndSendTTS(openai, sentenceText, voice, idx, res);
        ttsPromises.push(ttsPromise);
      }
    }
  }

  // Handle any remaining text in the buffer
  const remainingSentence = sentenceBuffer.trim();
  if (remainingSentence.length > 0) {
    const idx = sentenceIndex++;
    const ttsPromise = generateAndSendTTS(openai, remainingSentence, voice, idx, res);
    ttsPromises.push(ttsPromise);
  }

  // Wait for all TTS chunks to be sent
  await Promise.all(ttsPromises);

  // Save AI response to database
  const savedAiMsg = await prisma.aiAssistantMessage.create({
    data: {
      conversationId,
      role: 'assistant',
      content: fullText,
      metadata: { model: CHAT_MODEL },
    },
  });

  // Send done event
  res.write(`event: done\ndata: ${JSON.stringify({ id: savedAiMsg.id, text: fullText })}\n\n`);
  res.end();

  // Fire-and-forget: title, timestamp, summarization
  if (conversation.messages.length === 0) {
    generateTitle(userMessage, fullText)
      .then((title) =>
        prisma.aiAssistantConversation.update({
          where: { id: conversationId },
          data: { title, updatedAt: new Date() },
        })
      )
      .catch(console.error);
  } else {
    prisma.aiAssistantConversation
      .update({ where: { id: conversationId }, data: { updatedAt: new Date() } })
      .catch(console.error);
  }

  const totalMessages = conversation.messages.length + 2;
  if (totalMessages > 0 && totalMessages % 30 === 0) {
    summarizeConversation(conversationId).catch(console.error);
  }
}

// ─── Sentence Boundary Detection ─────────────────────────

function detectSentenceBoundary(
  buffer: string
): { sentence: string; remaining: string } | null {
  // Match sentence-ending punctuation followed by a space or end-of-text
  // Handles: "." "!" "?" "..." and combinations
  const match = buffer.match(/^(.*?[.!?]+)\s+(.*)$/s);
  if (match) {
    return { sentence: match[1], remaining: match[2] };
  }
  // Also split on long pauses (comma + enough text after)
  if (buffer.length > 80) {
    const commaMatch = buffer.match(/^(.{40,}?,)\s+(.*)$/s);
    if (commaMatch) {
      return { sentence: commaMatch[1], remaining: commaMatch[2] };
    }
  }
  return null;
}

// ─── Generate TTS and write to SSE stream ────────────────

async function generateAndSendTTS(
  openai: OpenAI,
  text: string,
  voice: string,
  index: number,
  res: Response
): Promise<void> {
  try {
    const validVoices = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];
    const selectedVoice = validVoices.includes(voice) ? voice : 'nova';

    const ttsResponse = await openai.audio.speech.create({
      model: 'tts-1',
      voice: selectedVoice as any,
      input: text,
      response_format: 'mp3',
      speed: 1.05,
    });

    const arrayBuffer = await ttsResponse.arrayBuffer();
    const base64Audio = Buffer.from(arrayBuffer).toString('base64');

    res.write(`event: audio\ndata: ${JSON.stringify({ a: base64Audio, i: index })}\n\n`);
  } catch (error) {
    console.error(`TTS error for sentence ${index}:`, error);
    // Non-fatal — text was already sent, speech just won't play for this sentence
  }
}

// ─── Text-to-Speech ──────────────────────────────────────

export async function textToSpeech(
  text: string,
  voice: string = TTS_VOICE
): Promise<Buffer> {
  const openai = getOpenAIClient();

  const validVoices = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];
  const selectedVoice = validVoices.includes(voice) ? voice : 'nova';

  const response = await openai.audio.speech.create({
    model: 'tts-1',
    voice: selectedVoice as any,
    input: text,
    response_format: 'mp3',
    speed: 1.05,
  });

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// ─── Auto Title Generation ───────────────────────────────

async function generateTitle(
  userMessage: string,
  aiResponse: string
): Promise<string> {
  try {
    const openai = getOpenAIClient();
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'Generate a concise 3-5 word title for this conversation. Return ONLY the title text, nothing else. No quotes.',
        },
        { role: 'user', content: userMessage },
        { role: 'assistant', content: aiResponse },
      ],
      temperature: 0.5,
      max_tokens: 20,
    });
    return (
      completion.choices[0]?.message?.content?.trim().replace(/^["']|["']$/g, '') ||
      'New Conversation'
    );
  } catch {
    return 'New Conversation';
  }
}

// ─── Cross-Conversation Memory Search ────────────────────

async function searchUserMemory(
  userId: string,
  query: string,
  excludeConversationId?: string
): Promise<string | null> {
  // Extract meaningful keywords (>3 chars, skip common words)
  const stopWords = new Set([
    'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all',
    'can', 'had', 'her', 'was', 'one', 'our', 'out', 'has',
    'have', 'been', 'will', 'with', 'this', 'that', 'from',
    'they', 'what', 'when', 'where', 'which', 'their', 'about',
    'would', 'there', 'could', 'other', 'into', 'more', 'some',
    'than', 'them', 'then', 'these', 'just', 'also', 'should',
  ]);

  const keywords = query
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 3 && !stopWords.has(w));

  if (keywords.length === 0) return null;

  try {
    const relevantMessages = await prisma.aiAssistantMessage.findMany({
      where: {
        conversation: {
          userId,
          isActive: true,
          ...(excludeConversationId && { id: { not: excludeConversationId } }),
        },
        OR: keywords.slice(0, 5).map((keyword) => ({
          content: { contains: keyword, mode: 'insensitive' as const },
        })),
      },
      orderBy: { createdAt: 'desc' },
      take: 8,
      include: {
        conversation: { select: { title: true, createdAt: true } },
      },
    });

    if (relevantMessages.length === 0) return null;

    return relevantMessages
      .map(
        (m) =>
          `[${m.conversation.title} - ${m.role}]: ${m.content.substring(0, 250)}`
      )
      .join('\n');
  } catch (error) {
    console.error('Memory search error:', error);
    return null;
  }
}

// ─── Conversation Summarization ──────────────────────────

export async function summarizeConversation(
  conversationId: string
): Promise<string> {
  const openai = getOpenAIClient();

  const conversation = await prisma.aiAssistantConversation.findUnique({
    where: { id: conversationId },
    include: {
      messages: { orderBy: { createdAt: 'asc' } },
    },
  });

  if (!conversation || conversation.messages.length === 0) return '';

  const transcript = conversation.messages
    .map((m) => `${m.role}: ${m.content}`)
    .join('\n');

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content:
          'Summarize this conversation concisely. Capture key topics discussed, decisions made, action items, and important details the user mentioned. Keep under 200 words.',
      },
      { role: 'user', content: transcript },
    ],
    temperature: 0.3,
    max_tokens: 300,
  });

  const summary = completion.choices[0]?.message?.content || '';

  await prisma.aiAssistantConversation.update({
    where: { id: conversationId },
    data: { summary },
  });

  return summary;
}

// ─── Memory Search (User-facing) ─────────────────────────

export async function searchMemory(userId: string, query: string) {
  const keywords = query
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 2);

  if (keywords.length === 0) return [];

  const messages = await prisma.aiAssistantMessage.findMany({
    where: {
      conversation: { userId, isActive: true },
      OR: keywords.slice(0, 5).map((keyword) => ({
        content: { contains: keyword, mode: 'insensitive' as const },
      })),
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
    include: {
      conversation: { select: { id: true, title: true } },
    },
  });

  return messages.map((m) => ({
    conversationId: m.conversation.id,
    conversationTitle: m.conversation.title,
    role: m.role,
    content: m.content,
    createdAt: m.createdAt,
  }));
}
