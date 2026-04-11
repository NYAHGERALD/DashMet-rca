import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const verifySid = process.env.TWILIO_VERIFY_SERVICE_SID;

let client: twilio.Twilio | null = null;

function getClient(): twilio.Twilio {
  if (!client) {
    if (!accountSid || !authToken) {
      throw new Error('Twilio credentials not configured (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)');
    }
    client = twilio(accountSid, authToken);
  }
  return client;
}

function getVerifySid(): string {
  if (!verifySid) {
    throw new Error('TWILIO_VERIFY_SERVICE_SID not configured');
  }
  return verifySid;
}

/**
 * Send an SMS verification code to a phone number using Twilio Verify.
 * Twilio generates, stores, and rate-limits the code automatically.
 * @param phoneNumber E.164 format, e.g. "+15551234567"
 */
export async function sendPhoneVerification(phoneNumber: string): Promise<void> {
  const twilioClient = getClient();
  const sid = getVerifySid();

  await twilioClient.verify.v2
    .services(sid)
    .verifications.create({
      to: phoneNumber,
      channel: 'sms',
    });
}

/**
 * Verify an SMS code entered by the user.
 * @returns true if the code is valid, false otherwise
 */
export async function checkPhoneVerification(phoneNumber: string, code: string): Promise<boolean> {
  const twilioClient = getClient();
  const sid = getVerifySid();

  const check = await twilioClient.verify.v2
    .services(sid)
    .verificationChecks.create({
      to: phoneNumber,
      code,
    });

  return check.status === 'approved';
}
