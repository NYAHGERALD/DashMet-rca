/**
 * SMS Notification Service — Twilio API
 *
 * Sends text message notifications via Twilio.
 * Uses Twilio Verify API for phone number OTP verification.
 * Used for bakery metrics submission alerts and other critical notifications.
 *
 * Required environment variables:
 *   TWILIO_ACCOUNT_SID          — Twilio Account SID
 *   TWILIO_AUTH_TOKEN            — Twilio Auth Token
 *   TWILIO_PHONE_NUMBER          — Twilio phone number (E.164, e.g. "+14155551234")
 *   TWILIO_VERIFY_SERVICE_SID    — Twilio Verify Service SID (starts with "VA")
 */

import { prisma } from '../utils/prisma';
import { decrypt } from '../utils/encryption';
import twilio from 'twilio';

// ─── Twilio Client ──────────────────────────────────────────────────────────

let _twilioClient: twilio.Twilio | null = null;

function getTwilioClient(): twilio.Twilio | null {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) {
    return null;
  }
  if (!_twilioClient) {
    _twilioClient = twilio(accountSid, authToken);
  }
  return _twilioClient;
}

function getSenderNumber(): string {
  return process.env.TWILIO_PHONE_NUMBER || '';
}

// ─── Core SMS Function ──────────────────────────────────────────────────────

interface SendSmsResult {
  success: boolean;
  messageSid?: string;
  error?: string;
}

export async function sendSms(to: string, message: string): Promise<SendSmsResult> {
  const client = getTwilioClient();
  const from = getSenderNumber();

  if (!client) {
    console.warn('[SMS] Twilio not configured — TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN missing');
    return { success: false, error: 'Twilio not configured' };
  }
  if (!from) {
    console.warn('[SMS] TWILIO_PHONE_NUMBER not set');
    return { success: false, error: 'Sender number not configured' };
  }
  if (!to) {
    return { success: false, error: 'Recipient number is empty' };
  }

  try {
    const msg = await client.messages.create({
      from,
      to,
      body: message,
    });

    console.log(`[SMS] Sent to ${to.slice(0, 4)}***${to.slice(-2)} — SID: ${msg.sid}`);
    return { success: true, messageSid: msg.sid };
  } catch (err: any) {
    console.error(`[SMS] Failed to send to ${to.slice(0, 4)}***${to.slice(-2)}:`, err.message);
    return { success: false, error: err.message };
  }
}

// ─── Bulk SMS to Multiple Numbers ───────────────────────────────────────────

export async function sendBulkSms(
  numbers: string[],
  message: string
): Promise<{ sent: number; failed: number; errors: string[] }> {
  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const num of numbers) {
    const result = await sendSms(num, message);
    if (result.success) {
      sent++;
    } else {
      failed++;
      errors.push(`${num.slice(0, 4)}***: ${result.error}`);
    }
  }

  return { sent, failed, errors };
}

// ─── Get Org Users' Decrypted Phone Numbers ─────────────────────────────────

export async function getOrgUserPhoneNumbers(organizationId: string): Promise<string[]> {
  const users = await prisma.user.findMany({
    where: {
      organizationId,
      isActive: true,
      phone: { not: null },
      phoneVerified: true,
    },
    select: { phone: true },
  });

  const phones: string[] = [];
  for (const u of users) {
    if (!u.phone) continue;
    try {
      const decrypted = decrypt(u.phone);
      if (decrypted && decrypted.startsWith('+')) {
        phones.push(decrypted);
      }
    } catch {
      // Skip users with unreadable phone numbers
    }
  }
  return phones;
}

// ─── Bakery Metrics SMS Alert ───────────────────────────────────────────────

export async function notifyBakeryMetricsSubmitted(
  weekName: string,
  dayOfWeek: string,
  submittedBy: string,
  organizationId: string,
): Promise<{ sent: number; failed: number; errors: string[] }> {
  const phones = await getOrgUserPhoneNumbers(organizationId);
  if (phones.length === 0) {
    console.log('[SMS] No verified phone numbers found for org — skipping SMS');
    return { sent: 0, failed: 0, errors: [] };
  }

  // Format a clean, concise SMS
  const weekDisplay = weekName.replace('_', ' to ');
  const message =
    `DashMet Bakery Alert: New metrics submitted for ${dayOfWeek} (Week: ${weekDisplay}) by ${submittedBy}. ` +
    `Log in to review the report.`;

  console.log(`[SMS] Sending bakery metrics alert to ${phones.length} number(s)`);
  return sendBulkSms(phones, message);
}

// ─── Twilio Verify API (OTP Verification) ───────────────────────────────────

function getVerifyServiceSid(): string {
  return process.env.TWILIO_VERIFY_SERVICE_SID || '';
}

/**
 * Send a verification code to a phone number via Twilio Verify.
 * Twilio handles code generation, delivery, expiry, and rate limiting.
 */
export async function sendVerificationCode(to: string): Promise<{ success: boolean; error?: string }> {
  const client = getTwilioClient();
  const serviceSid = getVerifyServiceSid();

  if (!client) {
    console.warn('[Verify] Twilio not configured');
    return { success: false, error: 'Twilio not configured' };
  }
  if (!serviceSid) {
    console.warn('[Verify] TWILIO_VERIFY_SERVICE_SID not set');
    return { success: false, error: 'Verify service not configured' };
  }
  if (!to) {
    return { success: false, error: 'Phone number is empty' };
  }

  try {
    const verification = await client.verify.v2
      .services(serviceSid)
      .verifications.create({ to, channel: 'sms' });

    console.log(`[Verify] Code sent to ${to.slice(0, 4)}***${to.slice(-2)} — status: ${verification.status}`);
    return { success: true };
  } catch (err: any) {
    console.error(`[Verify] Failed to send to ${to.slice(0, 4)}***${to.slice(-2)}:`, err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Check a verification code entered by the user.
 * Returns approved=true if the code is correct and not expired.
 */
export async function checkVerificationCode(
  to: string,
  code: string
): Promise<{ success: boolean; approved: boolean; error?: string }> {
  const client = getTwilioClient();
  const serviceSid = getVerifyServiceSid();

  if (!client || !serviceSid) {
    return { success: false, approved: false, error: 'Twilio Verify not configured' };
  }

  try {
    const check = await client.verify.v2
      .services(serviceSid)
      .verificationChecks.create({ to, code });

    console.log(`[Verify] Check for ${to.slice(0, 4)}***${to.slice(-2)} — status: ${check.status}`);
    return { success: true, approved: check.status === 'approved' };
  } catch (err: any) {
    console.error(`[Verify] Check failed for ${to.slice(0, 4)}***${to.slice(-2)}:`, err.message);
    return { success: false, approved: false, error: err.message };
  }
}
