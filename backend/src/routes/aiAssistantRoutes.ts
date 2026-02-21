/**
 * AI Assistant Routes
 * 
 * REST API for the Workplace AI Assistant.
 * Provides conversational AI with persistent memory and TTS.
 */

import { Router, Request, Response } from 'express';
import * as aiService from '../services/aiAssistantService';

const router = Router();

// ─── GET /conversations ──────────────────────────────────
// List all conversations for a user
router.get('/conversations', async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId as string;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId query parameter is required',
      });
    }

    const conversations = await aiService.getConversations(userId, limit, offset);

    return res.json({
      success: true,
      data: conversations,
    });
  } catch (error: any) {
    console.error('Error fetching conversations:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch conversations',
    });
  }
});

// ─── POST /conversations ─────────────────────────────────
// Create a new conversation
router.post('/conversations', async (req: Request, res: Response) => {
  try {
    const { userId, organizationId, title } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId is required',
      });
    }

    const conversation = await aiService.createConversation(
      userId,
      organizationId,
      title
    );

    return res.status(201).json({
      success: true,
      data: conversation,
    });
  } catch (error: any) {
    console.error('Error creating conversation:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to create conversation',
    });
  }
});

// ─── GET /conversations/:id ──────────────────────────────
// Get a conversation with all messages
router.get('/conversations/:id', async (req: Request, res: Response) => {
  try {
    const conversation = await aiService.getConversation(req.params.id);

    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found',
      });
    }

    return res.json({
      success: true,
      data: conversation,
    });
  } catch (error: any) {
    console.error('Error fetching conversation:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch conversation',
    });
  }
});

// ─── DELETE /conversations/:id ───────────────────────────
// Soft-delete a conversation
router.delete('/conversations/:id', async (req: Request, res: Response) => {
  try {
    await aiService.deleteConversation(req.params.id);

    return res.json({
      success: true,
      message: 'Conversation deleted',
    });
  } catch (error: any) {
    console.error('Error deleting conversation:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete conversation',
    });
  }
});

// ─── POST /conversations/:id/messages ────────────────────
// Send a message and get AI response (with memory context)
router.post('/conversations/:id/messages', async (req: Request, res: Response) => {
  try {
    const { content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Message content is required',
      });
    }

    const result = await aiService.sendMessage(req.params.id, content.trim());

    return res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('Error sending message:', error);

    if (error.message === 'Conversation not found') {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found',
      });
    }

    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to send message',
    });
  }
});

// ─── POST /tts ───────────────────────────────────────────
// Convert text to speech audio (returns MP3 binary)
router.post('/tts', async (req: Request, res: Response) => {
  try {
    const { text, voice } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Text is required',
      });
    }

    // Limit text length for TTS
    const trimmedText = text.trim().substring(0, 4096);

    const audioBuffer = await aiService.textToSpeech(trimmedText, voice);

    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Length': audioBuffer.length.toString(),
      'Cache-Control': 'no-cache',
    });

    return res.send(audioBuffer);
  } catch (error: any) {
    console.error('Error generating TTS:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate speech',
    });
  }
});

// ─── POST /conversations/:id/summarize ───────────────────
// Generate a summary for a conversation (for long-term memory)
router.post('/conversations/:id/summarize', async (req: Request, res: Response) => {
  try {
    const summary = await aiService.summarizeConversation(req.params.id);

    return res.json({
      success: true,
      data: { summary },
    });
  } catch (error: any) {
    console.error('Error summarizing conversation:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to summarize conversation',
    });
  }
});

// ─── POST /memory/search ─────────────────────────────────
// Search across all conversations for relevant context
router.post('/memory/search', async (req: Request, res: Response) => {
  try {
    const { userId, query } = req.body;

    if (!userId || !query) {
      return res.status(400).json({
        success: false,
        error: 'userId and query are required',
      });
    }

    const results = await aiService.searchMemory(userId, query);

    return res.json({
      success: true,
      data: results,
    });
  } catch (error: any) {
    console.error('Error searching memory:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to search memory',
    });
  }
});

export default router;
