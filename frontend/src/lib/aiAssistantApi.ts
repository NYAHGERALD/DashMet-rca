/**
 * AI Assistant API Library
 * 
 * Frontend client for the Workplace AI Assistant.
 * Handles conversations, messages, memory search, and TTS.
 */

import api from './api';

// ─── TypeScript Interfaces ───────────────────────────────

export interface AiMessage {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: {
    model?: string;
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  createdAt: string;
}

export interface AiConversation {
  id: string;
  userId: string;
  organizationId?: string;
  title: string;
  summary?: string;
  isActive: boolean;
  messages: AiMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface AiConversationListItem {
  id: string;
  title: string;
  summary?: string;
  messageCount: number;
  lastMessage: {
    content: string;
    role: string;
    createdAt: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface SendMessageResponse {
  userMessage: AiMessage;
  aiMessage: AiMessage;
}

export interface MemorySearchResult {
  conversationId: string;
  conversationTitle: string;
  role: string;
  content: string;
  createdAt: string;
}

// ─── API Functions ───────────────────────────────────────

/**
 * List all conversations for a user
 */
export async function getConversations(
  userId: string,
  limit = 50,
  offset = 0
): Promise<AiConversationListItem[]> {
  const response = await api.get('/ai-assistant/conversations', {
    params: { userId, limit, offset },
  });
  return response.data.data;
}

/**
 * Create a new conversation
 */
export async function createConversation(
  userId: string,
  organizationId?: string,
  title?: string
): Promise<AiConversation> {
  const response = await api.post('/ai-assistant/conversations', {
    userId,
    organizationId,
    title,
  });
  return response.data.data;
}

/**
 * Get a conversation with all messages
 */
export async function getConversation(
  conversationId: string
): Promise<AiConversation> {
  const response = await api.get(
    `/ai-assistant/conversations/${conversationId}`
  );
  return response.data.data;
}

/**
 * Delete (soft) a conversation
 */
export async function deleteConversation(
  conversationId: string
): Promise<void> {
  await api.delete(`/ai-assistant/conversations/${conversationId}`);
}

/**
 * Send a message and get AI response with memory context
 */
export async function sendMessage(
  conversationId: string,
  content: string
): Promise<SendMessageResponse> {
  const response = await api.post(
    `/ai-assistant/conversations/${conversationId}/messages`,
    { content },
    { timeout: 120000 }
  );
  return response.data.data;
}

/**
 * Convert text to speech audio (returns MP3 Blob)
 */
export async function textToSpeech(
  text: string,
  voice = 'nova'
): Promise<Blob> {
  const response = await api.post(
    '/ai-assistant/tts',
    { text, voice },
    { responseType: 'blob', timeout: 60000 }
  );
  return response.data;
}

/**
 * Summarize a conversation for long-term memory
 */
export async function summarizeConversation(
  conversationId: string
): Promise<string> {
  const response = await api.post(
    `/ai-assistant/conversations/${conversationId}/summarize`
  );
  return response.data.data.summary;
}

/**
 * Search across all conversations for relevant context
 */
export async function searchMemory(
  userId: string,
  query: string
): Promise<MemorySearchResult[]> {
  const response = await api.post('/ai-assistant/memory/search', {
    userId,
    query,
  });
  return response.data.data;
}

// ─── Utility Functions ───────────────────────────────────

/**
 * Format a date for display
 */
export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHrs = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHrs < 24) return `${diffHrs}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

/**
 * Truncate text with ellipsis
 */
export function truncateText(text: string, maxLength = 60): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + '...';
}
