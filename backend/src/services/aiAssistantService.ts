/**
 * AI Assistant Service
 * 
 * Provides conversational AI with persistent memory.
 * - Stores conversation history in PostgreSQL via Prisma
 * - Uses OpenAI GPT-4o for intelligent responses
 * - Retrieves context from past conversations for memory
 * - Generates TTS audio via OpenAI TTS API
 * - Auto-generates conversation titles and summaries
 */

import { PrismaClient } from '@prisma/client';
import OpenAI from 'openai';

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
    timeout: 60000,
    maxRetries: 2,
  });
  return openaiClient;
}

// ─── System Prompt ───────────────────────────────────────

const SYSTEM_PROMPT = `You are DashMet AI, a professional workplace assistant integrated into the DashMet platform. You are friendly, knowledgeable, and conversational — like a trusted, helpful colleague who genuinely cares.

Guidelines for your responses:
- Be natural and conversational, never robotic or formulaic
- Keep responses concise but helpful (1-3 paragraphs maximum for most answers)
- When the user references past discussions, use the conversation history naturally
- Offer proactive suggestions when they would be genuinely useful
- Be professional but warm — use a friendly, approachable tone
- You can help with workplace tasks, questions, planning, scheduling, problem-solving, and general knowledge
- Remember and reference context from the conversation naturally
- When you don't know something, say so honestly
- Avoid bullet points unless the user explicitly asks for a list
- Speak as if you're having a real face-to-face conversation
- Your responses will be read aloud via text-to-speech, so keep them natural and spoken-word friendly
- Avoid overly long responses — aim for what you'd naturally say in a conversation`;

const MAX_CONTEXT_MESSAGES = 40;

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

// ─── Send Message & Get AI Response ──────────────────────

export async function sendMessage(
  conversationId: string,
  userMessage: string
) {
  const openai = getOpenAIClient();

  // Load the conversation with recent messages
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
    throw new Error('Conversation not found');
  }

  // Save the user's message
  const savedUserMsg = await prisma.aiAssistantMessage.create({
    data: {
      conversationId,
      role: 'user',
      content: userMessage,
    },
  });

  // Build the OpenAI messages array
  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: 'system', content: SYSTEM_PROMPT },
  ];

  // Include conversation summary for long-term context
  if (conversation.summary) {
    messages.push({
      role: 'system',
      content: `Summary of earlier discussion: ${conversation.summary}`,
    });
  }

  // Search for relevant context from other conversations (cross-conversation memory)
  const memoryContext = await searchUserMemory(
    conversation.userId,
    userMessage,
    conversationId
  );
  if (memoryContext) {
    messages.push({
      role: 'system',
      content: `Relevant context from the user's previous conversations:\n${memoryContext}`,
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

  // Get AI response
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages,
    temperature: 0.7,
    max_tokens: 800,
    presence_penalty: 0.1,
    frequency_penalty: 0.1,
  });

  const aiResponse =
    completion.choices[0]?.message?.content ||
    "I'm sorry, I wasn't able to generate a response. Could you try rephrasing?";

  // Save the AI response
  const savedAiMsg = await prisma.aiAssistantMessage.create({
    data: {
      conversationId,
      role: 'assistant',
      content: aiResponse,
      metadata: {
        model: completion.model,
        promptTokens: completion.usage?.prompt_tokens,
        completionTokens: completion.usage?.completion_tokens,
        totalTokens: completion.usage?.total_tokens,
      },
    },
  });

  // Auto-generate title after first exchange
  if (conversation.messages.length === 0) {
    const title = await generateTitle(userMessage, aiResponse);
    await prisma.aiAssistantConversation.update({
      where: { id: conversationId },
      data: { title, updatedAt: new Date() },
    });
  } else {
    await prisma.aiAssistantConversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });
  }

  // Auto-summarize when conversation gets long (every 30 messages)
  const totalMessages = conversation.messages.length + 2;
  if (totalMessages > 0 && totalMessages % 30 === 0) {
    summarizeConversation(conversationId).catch(console.error);
  }

  return {
    userMessage: savedUserMsg,
    aiMessage: savedAiMsg,
  };
}

// ─── Text-to-Speech ──────────────────────────────────────

export async function textToSpeech(
  text: string,
  voice: string = 'nova'
): Promise<Buffer> {
  const openai = getOpenAIClient();

  const validVoices = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];
  const selectedVoice = validVoices.includes(voice) ? voice : 'nova';

  const response = await openai.audio.speech.create({
    model: 'tts-1',
    voice: selectedVoice as 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer',
    input: text,
    response_format: 'mp3',
    speed: 1.0,
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
