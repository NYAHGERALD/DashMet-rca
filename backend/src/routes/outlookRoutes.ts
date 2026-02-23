/**
 * Outlook Calendar Routes
 * Handles Microsoft OAuth2 consent flow and calendar event syncing
 * for the LSW "Connect Outlook" feature.
 */
import { Router, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { authenticate } from '../middleware/auth';
import outlookService from '../services/outlookService';
import crypto from 'crypto';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/outlook/status
// Check if the user has connected their Outlook account
// ─────────────────────────────────────────────────────────────────────────────
router.get('/status', async (req: AuthRequest, res: Response) => {
  try {
    const status = await outlookService.getOutlookStatus(req.user!.id);
    res.json({ success: true, data: status });
  } catch (error: any) {
    console.error('Error checking Outlook status:', error);
    res.status(500).json({ success: false, error: 'Failed to check Outlook status' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/outlook/auth-url
// Generate and return the Microsoft OAuth2 authorization URL.
// The frontend will redirect the user to this URL.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/auth-url', async (req: AuthRequest, res: Response) => {
  try {
    // State parameter: encode userId for the callback to verify
    const state = Buffer.from(JSON.stringify({
      userId: req.user!.id,
      nonce: crypto.randomBytes(16).toString('hex'),
    })).toString('base64url');

    const url = outlookService.getAuthorizationUrl(state);
    res.json({ success: true, data: { url, state } });
  } catch (error: any) {
    console.error('Error generating Outlook auth URL:', error);
    res.status(500).json({ success: false, error: 'Failed to generate authorization URL' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/outlook/callback
// Exchange the authorization code for tokens and save them.
// Called by the frontend after the Microsoft OAuth redirect.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/callback', async (req: AuthRequest, res: Response) => {
  try {
    const { code, state } = req.body;
    if (!code) {
      return res.status(400).json({ success: false, error: 'Authorization code is required' });
    }

    // Verify state matches the authenticated user
    if (state) {
      try {
        const decoded = JSON.parse(Buffer.from(state, 'base64url').toString());
        if (decoded.userId !== req.user!.id) {
          return res.status(403).json({ success: false, error: 'State mismatch — user ID does not match' });
        }
      } catch {
        // State parse failed — proceed anyway since user is authenticated
      }
    }

    // Exchange code for tokens
    const tokens = await outlookService.exchangeCodeForTokens(code);

    // Decode the ID token to get the Microsoft email (basic JWT decode, no verification needed here)
    let microsoftEmail: string | undefined;
    if (tokens.id_token) {
      try {
        const payload = JSON.parse(Buffer.from(tokens.id_token.split('.')[1], 'base64').toString());
        microsoftEmail = payload.preferred_username || payload.email;
      } catch { /* ignore decode errors */ }
    }

    // Save tokens
    await outlookService.saveTokens(
      req.user!.id,
      tokens.access_token,
      tokens.refresh_token,
      tokens.expires_in,
      tokens.scope,
      microsoftEmail
    );

    res.json({
      success: true,
      data: { connected: true, email: microsoftEmail },
    });
  } catch (error: any) {
    console.error('Error in Outlook OAuth callback:', error.response?.data || error.message);
    res.status(500).json({ success: false, error: 'Failed to connect Outlook account. Please try again.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/outlook/disconnect
// Remove stored tokens and disconnect Outlook
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/disconnect', async (req: AuthRequest, res: Response) => {
  try {
    await outlookService.disconnectOutlook(req.user!.id);
    res.json({ success: true, data: { connected: false } });
  } catch (error: any) {
    console.error('Error disconnecting Outlook:', error);
    res.status(500).json({ success: false, error: 'Failed to disconnect Outlook' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/outlook/calendar?weekNumber=8&year=2026
// Fetch Outlook calendar events for the given week
// ─────────────────────────────────────────────────────────────────────────────
router.get('/calendar', async (req: AuthRequest, res: Response) => {
  try {
    const weekNumber = parseInt(req.query.weekNumber as string);
    const year = parseInt(req.query.year as string);

    if (isNaN(weekNumber) || isNaN(year)) {
      return res.status(400).json({ success: false, error: 'weekNumber and year are required' });
    }

    const { startDate, endDate } = outlookService.getWeekDateRange(weekNumber, year);
    const events = await outlookService.fetchCalendarEvents(req.user!.id, startDate, endDate);

    res.json({
      success: true,
      data: {
        events,
        weekRange: { startDate, endDate },
      },
    });
  } catch (error: any) {
    console.error('Error fetching Outlook calendar:', error.message);
    const status = error.message.includes('not connected') || error.message.includes('expired') ? 401 : 500;
    res.status(status).json({ success: false, error: error.message || 'Failed to fetch calendar events' });
  }
});

export default router;
