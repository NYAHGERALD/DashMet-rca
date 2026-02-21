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

import OpenAI from 'openai';
import { Response } from 'express';
import * as lswService from './lswService';
import { prisma } from '../utils/prisma';

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

// ─── System Prompt (computed fresh per-request for accurate date/week) ─

function getSystemPrompt(): string {
  const now = new Date();
  const todayStr = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const { weekNumber, year } = getISOWeekNumber(now);

  return `You are DashMet AI, a friendly colleague at DashMet. Talk like a real person in a real conversation.

Rules:
- Keep answers to 1-3 sentences. Only go longer when explaining something complex.
- Never use bullet points, numbered lists, markdown, or formatting. Just talk.
- Write exactly how people speak out loud. Use contractions, casual phrasing.
- If someone says hi, say hi back naturally. Don't list your capabilities.
- Reference conversation context naturally, not formally.
- Be warm, helpful, and direct. No filler phrases like "Great question!" or "Absolutely!"
- You help with workplace tasks, planning, problem-solving, and general knowledge.
- Your words are spoken aloud via voice — never output anything that sounds weird read aloud.
- When you're unsure about facts, dates, people, events, statistics, or anything that needs accuracy, use the search_web tool to look it up. Always prefer verified information over guessing.
- After searching, weave the information naturally into your spoken answer. Never say "according to my search" — just share the facts conversationally.
- When the user asks about their personal tasks, to-do items, meetings, follow-ups, goals, projects, schedule, what they have today or this week, or anything remotely about their Leaders Standard Work — ALWAYS use the get_my_tasks tool. This is the ONLY way to get the user's real data. You have NO knowledge of the user's tasks without calling this tool. Never say "you have nothing" or "no tasks" without first calling get_my_tasks.
- Today's date is ${todayStr}. The current ISO week number is ${weekNumber} of ${year}.`;
}

const MAX_CONTEXT_MESSAGES = 20;
const CHAT_MODEL = process.env.AI_MODEL || 'gpt-5.2';
const TTS_VOICE = 'nova';

// ─── Web Search Tool Definition ──────────────────────────

const AI_TOOLS: OpenAI.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'search_web',
      description:
        'Search the internet for factual, current, or verified information. Use when you are unsure about facts, dates, people, events, statistics, history, science, geography, or anything that requires accuracy. Uses Wikipedia and other reliable sources.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The search query to look up on the internet',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_my_tasks',
      description:
        'Fetch the current user\'s personal Leaders Standard Work (LSW) data including daily tasks, to-do items, scheduled meetings, follow-up items, improvement projects, personal goals, frequency tasks, and key results. Use this whenever the user asks about their own tasks, todos, meetings, schedule, goals, follow-ups, projects, what they have to do today/this week, or anything related to their work plan. The scope parameter lets you fetch specific categories or everything at once.',
      parameters: {
        type: 'object',
        properties: {
          scope: {
            type: 'string',
            enum: ['all', 'daily_tasks', 'todos', 'meetings', 'follow_ups', 'projects', 'goals', 'frequency_tasks'],
            description: 'What data to fetch. Use "all" when the user asks a general question like "what do I have today". Use specific scopes for targeted questions like "show me my todos" or "what meetings do I have".',
          },
        },
        required: ['scope'],
      },
    },
  },
];

// ─── Web Search via Wikipedia ────────────────────────────

async function searchWeb(query: string): Promise<string> {
  try {
    console.log(`🌐 Web search: "${query}"`);

    // Search Wikipedia for matching articles
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
      query
    )}&format=json&srlimit=3&origin=*`;
    const searchRes = await fetch(searchUrl);
    const searchData = (await searchRes.json()) as any;

    if (!searchData.query?.search?.length) {
      return `No Wikipedia results found for "${query}". Answer based on your general knowledge and be transparent about uncertainty.`;
    }

    // Fetch summaries of top results
    const results: string[] = [];
    for (const hit of searchData.query.search.slice(0, 2)) {
      try {
        const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(
          hit.title
        )}`;
        const summaryRes = await fetch(summaryUrl);
        const summaryData = (await summaryRes.json()) as any;
        if (summaryData.extract) {
          results.push(
            `${summaryData.title}: ${summaryData.extract.substring(0, 600)}`
          );
        }
      } catch {
        // Skip failed summary fetch
      }
    }

    if (results.length === 0) {
      return `Search returned results but summaries could not be loaded. Answer based on your general knowledge.`;
    }

    console.log(`🌐 Search returned ${results.length} result(s)`);
    return `Wikipedia search results for "${query}":\n\n${results.join('\n\n')}`;
  } catch (error: any) {
    console.error('🌐 Web search error:', error.message);
    return `Web search failed: ${error.message}. Answer based on your general knowledge and mention you couldn't verify.`;
  }
}

// ─── LSW Data Fetch for AI ──────────────────────────────

/**
 * Compute ISO 8601 week number — MUST match the frontend getWeekNumber() exactly.
 * Uses UTC to avoid timezone drift issues on the server.
 */
function getISOWeekNumber(date: Date): { weekNumber: number; year: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7; // Sunday = 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum); // Nearest Thursday
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNumber = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return { weekNumber, year: d.getUTCFullYear() };
}

/**
 * Compute org-relative week number if org has a custom calendar year start.
 * Mirrors the frontend's getWeekNumber(date, config) logic exactly.
 */
function getOrgWeekNumber(date: Date, calendarYearStartMonth: number, calendarYearStartDay: number): { weekNumber: number; year: number } {
  // Default ISO if org uses standard calendar
  if (calendarYearStartMonth === 1 && calendarYearStartDay === 1) {
    return getISOWeekNumber(date);
  }

  // Find the org cycle start that this date belongs to
  const month = calendarYearStartMonth - 1; // 0-indexed
  const day = calendarYearStartDay;

  let cycleStart = new Date(date.getFullYear(), month, day);
  if (cycleStart > date) {
    cycleStart = new Date(date.getFullYear() - 1, month, day);
  }

  const diffMs = date.getTime() - cycleStart.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  const weekNumber = Math.floor(diffDays / 7) + 1;
  return { weekNumber, year: cycleStart.getFullYear() };
}

/**
 * Resolve the user's organizationId — falls back to the user's record if not on the conversation.
 */
async function resolveOrganizationId(userId: string, conversationOrgId: string | null | undefined): Promise<string> {
  if (conversationOrgId) return conversationOrgId;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { organizationId: true },
  });
  return user?.organizationId || '';
}

async function fetchUserLswData(userId: string, conversationOrgId: string | null, scope: string): Promise<string> {
  try {
    const now = new Date();
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayOfWeek = dayNames[now.getDay()];
    const dayKey = dayOfWeek.toLowerCase();

    // Resolve organizationId — fall back to user record if not on conversation
    const organizationId = await resolveOrganizationId(userId, conversationOrgId);
    console.log(`📊 LSW fetch: userId=${userId}, orgId=${organizationId}, scope=${scope}`);

    // Fetch org calendar config to compute the correct week number
    let calMonth = 1, calDay = 1;
    if (organizationId) {
      const org = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: { calendarYearStartMonth: true, calendarYearStartDay: true },
      });
      if (org) {
        calMonth = org.calendarYearStartMonth;
        calDay = org.calendarYearStartDay;
      }
    }

    const { weekNumber, year } = getOrgWeekNumber(now, calMonth, calDay);
    console.log(`📊 Org calendar: start=${calMonth}/${calDay}, computed week=${weekNumber}, year=${year}, today=${dayOfWeek}`);

    // Helper to format dates
    const fmtDate = (d: any) => {
      if (!d) return 'no date';
      const dt = new Date(d);
      return isNaN(dt.getTime()) ? String(d) : dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    };

    const sections: string[] = [];
    sections.push(`Current context: ${dayOfWeek}, Week ${weekNumber} of ${year} (today is ${now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })})`);

    // ── Daily Tasks ──────────────────────────────
    if (scope === 'all' || scope === 'daily_tasks') {
      const tasks = await lswService.getDailyTasks(userId, weekNumber, year);
      console.log(`📊 Daily tasks returned: ${tasks.length}`);
      if (tasks.length > 0) {
        const taskLines = tasks.map((t: any) => {
          // After getDailyTasks, day fields = completion status for this week
          const completedToday = t[dayKey] === true;
          const completedDays = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday']
            .filter(d => t[d] === true);
          return `- "${t.task}" (${t.minutes || '?'}min, scheduled at ${t.time || 'unset'}) — today: ${completedToday ? 'DONE' : 'NOT YET DONE'}, completed this week: ${completedDays.length > 0 ? completedDays.join(', ') : 'none yet'}`;
        });
        sections.push(`DAILY TASKS (${tasks.length} total):\n${taskLines.join('\n')}`);
      } else {
        sections.push('DAILY TASKS: None set up for this user');
      }
    }

    // ── To-Do Items (week-scoped — try current week, then fall back to all active) ──
    if (scope === 'all' || scope === 'todos') {
      let todos = await lswService.getTodoItems(userId, weekNumber, year);
      console.log(`📊 Todo items (week ${weekNumber}): ${todos.length}`);

      // Fallback: if no todos this week, fetch ALL active todos (any week)
      if (todos.length === 0) {
        todos = await lswService.getTodoItems(userId);
        console.log(`📊 Todo items (all weeks fallback): ${todos.length}`);
      }

      if (todos.length > 0) {
        const todoLines = todos.map((t: any) =>
          `- "${t.task}" ${t.dueDate ? '(due/time: ' + t.dueDate + ')' : ''} — ${t.completed ? 'DONE' : 'NOT DONE'}${t.weekNumber ? ' (week ' + t.weekNumber + ')' : ''}`
        );
        const doneCount = todos.filter((t: any) => t.completed).length;
        sections.push(`TO-DO ITEMS (${todos.length} total, ${doneCount} done, ${todos.length - doneCount} remaining):\n${todoLines.join('\n')}`);
      } else {
        sections.push('TO-DO ITEMS: None');
      }
    }

    // ── Meetings (week-scoped — try current week, then fall back to all active) ──
    if (scope === 'all' || scope === 'meetings') {
      let meetings = await lswService.getMeetingRails(userId, weekNumber, year);
      console.log(`📊 Meeting rails (week ${weekNumber}): ${meetings.length}`);

      // Fallback: fetch all active meetings if none found for this week
      if (meetings.length === 0) {
        meetings = await lswService.getMeetingRails(userId);
        console.log(`📊 Meeting rails (all weeks fallback): ${meetings.length}`);
      }

      if (meetings.length > 0) {
        const meetingLines = meetings.map((m: any) =>
          `- "${m.rail}" on ${fmtDate(m.dueDate)} — ${m.completed ? 'ATTENDED' : 'NOT YET ATTENDED'}${m.weekNumber ? ' (week ' + m.weekNumber + ')' : ''}`
        );
        sections.push(`MEETINGS (${meetings.length} total):\n${meetingLines.join('\n')}`);
      } else {
        sections.push('MEETINGS: None scheduled');
      }
    }

    // ── Follow-Ups (not week-scoped) ──
    if (scope === 'all' || scope === 'follow_ups') {
      const followUps = await lswService.getFollowUps(userId);
      console.log(`📊 Follow-ups: ${followUps.length}`);
      if (followUps.length > 0) {
        const fuLines = followUps.map((f: any) => {
          const responsible = f.responsibleUser
            ? `${f.responsibleUser.firstName} ${f.responsibleUser.lastName}`
            : f.responsibleName || 'Unassigned';
          return `- "${f.task}" (due ${fmtDate(f.dueDate)}, assigned to ${responsible}) — ${f.completed ? 'DONE' : 'OPEN'}`;
        });
        const openCount = followUps.filter((f: any) => !f.completed).length;
        sections.push(`FOLLOW-UPS (${followUps.length} total, ${openCount} open):\n${fuLines.join('\n')}`);
      } else {
        sections.push('FOLLOW-UPS: None');
      }
    }

    // ── Projects (not week-scoped) ──
    if (scope === 'all' || scope === 'projects') {
      const projects = await lswService.getProjects(userId);
      console.log(`📊 Projects: ${projects.length}`);
      if (projects.length > 0) {
        const projLines = projects.map((p: any) => {
          const latestUpdate = p.updates?.[p.updates.length - 1];
          return `- "${p.name}"${latestUpdate?.text ? ' — latest update: "' + latestUpdate.text.substring(0, 100) + '"' : ''}`;
        });
        sections.push(`IMPROVEMENT PROJECTS (${projects.length}):\n${projLines.join('\n')}`);
      } else {
        sections.push('IMPROVEMENT PROJECTS: None');
      }
    }

    // ── Personal Goals (not week-scoped) ──
    if (scope === 'all' || scope === 'goals') {
      const goals = await lswService.getPersonalGoals(userId);
      console.log(`📊 Goals: ${goals.length}`);
      if (goals.length > 0) {
        const goalLines = goals.map((g: any) =>
          `- "${g.objective}" (due ${fmtDate(g.dueDate)}, progress: ${g.progress ?? 0}%)`
        );
        sections.push(`PERSONAL GOALS (${goals.length}):\n${goalLines.join('\n')}`);
      } else {
        sections.push('PERSONAL GOALS: None set');
      }
    }

    // ── Frequency Tasks (period-scoped) ──
    if (scope === 'all' || scope === 'frequency_tasks') {
      let freqTasks = await lswService.getFrequencyTasks(userId, weekNumber, year);
      console.log(`📊 Frequency tasks (week ${weekNumber}): ${freqTasks.length}`);

      // Fallback to all if none for this period
      if (freqTasks.length === 0) {
        freqTasks = await lswService.getFrequencyTasks(userId);
        console.log(`📊 Frequency tasks (all fallback): ${freqTasks.length}`);
      }

      if (freqTasks.length > 0) {
        const ftLines = freqTasks.map((f: any) =>
          `- "${f.task}" (${f.frequency?.toLowerCase() || 'recurring'}, ${f.minutes || '?'}min, due ${fmtDate(f.dueDate)})`
        );
        sections.push(`RECURRING TASKS (${freqTasks.length}):\n${ftLines.join('\n')}`);
      } else {
        sections.push('RECURRING TASKS: None');
      }
    }

    const result = sections.join('\n\n');
    console.log(`📊 LSW data result (${result.length} chars):\n${result}`);
    return result;
  } catch (error: any) {
    console.error('📊 LSW fetch error:', error.message, error.stack);
    return `Error fetching your data: ${error.message}. Please try again.`;
  }
}

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
    { role: 'system', content: getSystemPrompt() },
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

  let completion = await openai.chat.completions.create({
    model: CHAT_MODEL,
    messages,
    temperature: 0.8,
    max_completion_tokens: 200,
    presence_penalty: 0.3,
    frequency_penalty: 0.2,
    tools: AI_TOOLS,
    tool_choice: 'auto',
  });

  // Handle tool calls (web search + LSW)
  let assistantMsg = completion.choices[0]?.message;
  if (assistantMsg?.tool_calls && assistantMsg.tool_calls.length > 0) {
    // Add assistant message with tool calls
    messages.push(assistantMsg as any);

    // Execute each tool call
    for (const toolCall of assistantMsg.tool_calls) {
      const fn = (toolCall as any).function;
      let result = 'Unknown tool';
      if (fn?.name === 'search_web') {
        const args = JSON.parse(fn.arguments);
        result = await searchWeb(args.query);
      } else if (fn?.name === 'get_my_tasks') {
        const args = JSON.parse(fn.arguments);
        result = await fetchUserLswData(conversation.userId, conversation.organizationId ?? null, args.scope || 'all');
      }
      messages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: result,
      });
    }

    // Get final response with tool results
    completion = await openai.chat.completions.create({
      model: CHAT_MODEL,
      messages,
      temperature: 0.8,
      max_completion_tokens: 400,
      presence_penalty: 0.3,
      frequency_penalty: 0.2,
    });
  }

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

  // Start GPT streaming (with tools)
  let stream = await openai.chat.completions.create({
    model: CHAT_MODEL,
    messages,
    temperature: 0.8,
    max_completion_tokens: 200,
    presence_penalty: 0.3,
    frequency_penalty: 0.2,
    stream: true,
    tools: AI_TOOLS,
    tool_choice: 'auto',
  });

  let fullText = '';
  let sentenceBuffer = '';
  let sentenceIndex = 0;
  const ttsPromises: Promise<void>[] = [];

  // Track tool calls during streaming
  let toolCallId = '';
  let toolCallName = '';
  let toolCallArgs = '';

  // Process tokens from the stream
  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta;

    // Handle content tokens
    const token = delta?.content;
    if (token) {
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
          const ttsPromise = generateAndSendTTS(openai, sentenceText, voice, idx, res);
          ttsPromises.push(ttsPromise);
        }
      }
    }

    // Handle tool calls
    if (delta?.tool_calls) {
      for (const tc of delta.tool_calls) {
        if (tc.id) toolCallId = tc.id;
        if (tc.function?.name) toolCallName = tc.function.name;
        if (tc.function?.arguments) toolCallArgs += tc.function.arguments;
      }
    }
  }

  // If model requested a tool call, execute it and stream a second round
  if (toolCallName && toolCallId) {
    console.log(`🔧 Streaming: model called tool: ${toolCallName}`);

    let toolResult = 'Unknown tool';
    if (toolCallName === 'search_web') {
      res.write(`event: token\ndata: ${JSON.stringify({ t: 'Looking that up... ' })}\n\n`);
      fullText += 'Looking that up... ';
      const args = JSON.parse(toolCallArgs);
      toolResult = await searchWeb(args.query);
    } else if (toolCallName === 'get_my_tasks') {
      res.write(`event: token\ndata: ${JSON.stringify({ t: 'Checking your schedule... ' })}\n\n`);
      fullText += 'Checking your schedule... ';
      const args = JSON.parse(toolCallArgs);
      toolResult = await fetchUserLswData(conversation.userId, conversation.organizationId ?? null, args.scope || 'all');
    }

    // Build messages with tool call and result
    messages.push({
      role: 'assistant',
      content: null,
      tool_calls: [
        {
          id: toolCallId,
          type: 'function',
          function: { name: toolCallName, arguments: toolCallArgs },
        },
      ],
    } as any);
    messages.push({
      role: 'tool',
      tool_call_id: toolCallId,
      content: toolResult,
    });

    // Clear the "looking that up" prefix from fullText — we'll rebuild
    fullText = '';
    sentenceBuffer = '';

    // Stream the final response (no tools this round to prevent loops)
    const stream2 = await openai.chat.completions.create({
      model: CHAT_MODEL,
      messages,
      temperature: 0.8,
      max_completion_tokens: 400,
      presence_penalty: 0.3,
      frequency_penalty: 0.2,
      stream: true,
    });

    for await (const chunk of stream2) {
      const token = chunk.choices[0]?.delta?.content;
      if (!token) continue;

      fullText += token;
      sentenceBuffer += token;

      res.write(`event: token\ndata: ${JSON.stringify({ t: token })}\n\n`);

      const boundary = detectSentenceBoundary(sentenceBuffer);
      if (boundary) {
        const sentenceText = boundary.sentence.trim();
        sentenceBuffer = boundary.remaining;

        if (sentenceText.length > 0) {
          const idx = sentenceIndex++;
          const ttsPromise = generateAndSendTTS(openai, sentenceText, voice, idx, res);
          ttsPromises.push(ttsPromise);
        }
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
