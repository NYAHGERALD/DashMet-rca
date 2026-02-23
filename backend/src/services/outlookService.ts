/**
 * Outlook Calendar Service
 * Handles Microsoft OAuth2 token management and Microsoft Graph API
 * calendar operations for the LSW "Connect Outlook" feature.
 */
import { prisma } from '../utils/prisma';
import axios from 'axios';

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────
const MICROSOFT_CLIENT_ID = process.env.MICROSOFT_CLIENT_ID || '';
const MICROSOFT_CLIENT_SECRET = process.env.MICROSOFT_CLIENT_SECRET || '';
const MICROSOFT_REDIRECT_URI = process.env.MICROSOFT_REDIRECT_URI || 'http://localhost:3000/lsw/outlook-callback';
const MICROSOFT_TENANT = process.env.MICROSOFT_TENANT_ID || 'common';

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';
const AUTH_BASE = `https://login.microsoftonline.com/${MICROSOFT_TENANT}/oauth2/v2.0`;
const SCOPES = 'openid profile email offline_access Calendars.Read';

// ─────────────────────────────────────────────────────────────────────────────
// OAuth2 Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build the Microsoft OAuth2 authorization URL for the consent flow.
 */
export function getAuthorizationUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: MICROSOFT_CLIENT_ID,
    response_type: 'code',
    redirect_uri: MICROSOFT_REDIRECT_URI,
    scope: SCOPES,
    response_mode: 'query',
    state,
    prompt: 'consent', // Always show consent so user can choose account
  });
  return `${AUTH_BASE}/authorize?${params.toString()}`;
}

/**
 * Exchange the authorization code for tokens.
 */
export async function exchangeCodeForTokens(code: string) {
  const response = await axios.post(
    `${AUTH_BASE}/token`,
    new URLSearchParams({
      client_id: MICROSOFT_CLIENT_ID,
      client_secret: MICROSOFT_CLIENT_SECRET,
      code,
      redirect_uri: MICROSOFT_REDIRECT_URI,
      grant_type: 'authorization_code',
      scope: SCOPES,
    }).toString(),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );
  return response.data as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    scope: string;
    id_token?: string;
  };
}

/**
 * Refresh the access token using the stored refresh token.
 */
async function refreshAccessToken(refreshToken: string) {
  const response = await axios.post(
    `${AUTH_BASE}/token`,
    new URLSearchParams({
      client_id: MICROSOFT_CLIENT_ID,
      client_secret: MICROSOFT_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
      scope: SCOPES,
    }).toString(),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );
  return response.data as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    scope: string;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Token Storage
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Save or update the Microsoft tokens for a user.
 */
export async function saveTokens(
  userId: string,
  accessToken: string,
  refreshToken: string,
  expiresIn: number,
  scope: string,
  microsoftEmail?: string
) {
  const tokenExpiry = new Date(Date.now() + expiresIn * 1000);
  return prisma.microsoftOAuthToken.upsert({
    where: { userId },
    create: { userId, accessToken, refreshToken, tokenExpiry, scope, microsoftEmail },
    update: { accessToken, refreshToken, tokenExpiry, scope, microsoftEmail },
  });
}

/**
 * Get a valid access token for a user, refreshing if necessary.
 * Returns null if user has no tokens (Outlook not connected).
 */
export async function getValidAccessToken(userId: string): Promise<string | null> {
  const record = await prisma.microsoftOAuthToken.findUnique({ where: { userId } });
  if (!record) return null;

  // If token expires within 5 minutes, refresh it
  const fiveMinFromNow = new Date(Date.now() + 5 * 60 * 1000);
  if (record.tokenExpiry > fiveMinFromNow) {
    return record.accessToken;
  }

  try {
    const refreshed = await refreshAccessToken(record.refreshToken);
    await saveTokens(userId, refreshed.access_token, refreshed.refresh_token, refreshed.expires_in, refreshed.scope, record.microsoftEmail ?? undefined);
    return refreshed.access_token;
  } catch (error) {
    console.error('Failed to refresh Microsoft token for user', userId, error);
    // Token is invalid — remove it so user can re-connect
    await prisma.microsoftOAuthToken.delete({ where: { userId } }).catch(() => {});
    return null;
  }
}

/**
 * Disconnect Outlook — remove stored tokens.
 */
export async function disconnectOutlook(userId: string) {
  return prisma.microsoftOAuthToken.delete({ where: { userId } }).catch(() => null);
}

/**
 * Check if user has Outlook connected.
 */
export async function getOutlookStatus(userId: string) {
  const record = await prisma.microsoftOAuthToken.findUnique({
    where: { userId },
    select: { microsoftEmail: true, tokenExpiry: true, updatedAt: true },
  });
  return record ? { connected: true, email: record.microsoftEmail, lastSynced: record.updatedAt } : { connected: false };
}

// ─────────────────────────────────────────────────────────────────────────────
// Microsoft Graph — Calendar
// ─────────────────────────────────────────────────────────────────────────────

interface GraphCalendarEvent {
  id: string;
  subject: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  isAllDay: boolean;
  isCancelled: boolean;
  showAs: string;
  organizer?: { emailAddress?: { name?: string; address?: string } };
  recurrence?: any;
}

export interface OutlookMeeting {
  outlookEventId: string;
  subject: string;
  startTime: string;   // HH:MM
  endTime: string;      // HH:MM
  durationMinutes: number;
  dayOfWeek: string;    // 'monday' | 'tuesday' | ... | 'sunday'
  date: string;         // YYYY-MM-DD
  isAllDay: boolean;
}

const DAYS_OF_WEEK = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

/**
 * Fetch calendar events for a date range from Microsoft Graph API.
 */
export async function fetchCalendarEvents(
  userId: string,
  startDate: string, // YYYY-MM-DD
  endDate: string    // YYYY-MM-DD
): Promise<OutlookMeeting[]> {
  const accessToken = await getValidAccessToken(userId);
  if (!accessToken) {
    throw new Error('Outlook not connected. Please connect your Outlook account first.');
  }

  const startDateTime = `${startDate}T00:00:00`;
  const endDateTime = `${endDate}T23:59:59`;

  try {
    const response = await axios.get(`${GRAPH_BASE}/me/calendarView`, {
      params: {
        startDateTime,
        endDateTime,
        $select: 'id,subject,start,end,isAllDay,isCancelled,showAs,organizer,recurrence',
        $orderby: 'start/dateTime',
        $top: 100,
      },
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Prefer: 'outlook.timezone="UTC"',
      },
    });

    const events: GraphCalendarEvent[] = response.data.value || [];

    // Filter out cancelled events and convert to our format
    return events
      .filter(e => !e.isCancelled && e.showAs !== 'free')
      .map(event => {
        const start = new Date(event.start.dateTime + 'Z');
        const end = new Date(event.end.dateTime + 'Z');
        const durationMinutes = Math.round((end.getTime() - start.getTime()) / 60000);

        return {
          outlookEventId: event.id,
          subject: event.subject || 'Untitled Meeting',
          startTime: `${start.getUTCHours().toString().padStart(2, '0')}:${start.getUTCMinutes().toString().padStart(2, '0')}`,
          endTime: `${end.getUTCHours().toString().padStart(2, '0')}:${end.getUTCMinutes().toString().padStart(2, '0')}`,
          durationMinutes,
          dayOfWeek: DAYS_OF_WEEK[start.getUTCDay()],
          date: start.toISOString().split('T')[0],
          isAllDay: event.isAllDay,
        };
      });
  } catch (error: any) {
    if (error.response?.status === 401) {
      // Token expired during the request
      await prisma.microsoftOAuthToken.delete({ where: { userId } }).catch(() => {});
      throw new Error('Outlook session expired. Please reconnect your Outlook account.');
    }
    throw error;
  }
}

/**
 * Build the week date range (Mon–Sun) from a week number and year.
 */
export function getWeekDateRange(weekNumber: number, year: number): { startDate: string; endDate: string } {
  // ISO week: Jan 4 is always in week 1
  const jan4 = new Date(year, 0, 4);
  const dayOfWeek = jan4.getDay() || 7; // Convert Sunday=0 to 7
  const mondayOfWeek1 = new Date(jan4);
  mondayOfWeek1.setDate(jan4.getDate() - dayOfWeek + 1);

  const mondayOfTarget = new Date(mondayOfWeek1);
  mondayOfTarget.setDate(mondayOfWeek1.getDate() + (weekNumber - 1) * 7);

  const sundayOfTarget = new Date(mondayOfTarget);
  sundayOfTarget.setDate(mondayOfTarget.getDate() + 6);

  const format = (d: Date) => d.toISOString().split('T')[0];
  return { startDate: format(mondayOfTarget), endDate: format(sundayOfTarget) };
}

// Default export as object (matches lswService pattern)
export default {
  getAuthorizationUrl,
  exchangeCodeForTokens,
  saveTokens,
  getValidAccessToken,
  disconnectOutlook,
  getOutlookStatus,
  fetchCalendarEvents,
  getWeekDateRange,
};
