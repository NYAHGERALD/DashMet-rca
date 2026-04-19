/**
 * Email Service — Resend API integration
 * Sends transactional emails (OTP verification, etc.)
 */

import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = process.env.FROM_EMAIL || 'DashMet <noreply@dashmet.com>';

/**
 * Send a 6-digit OTP verification email for mobile login
 */
export async function sendVerificationEmail(
  to: string,
  code: string,
  firstName: string
): Promise<boolean> {
  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: `${code} — Your DashMet Verification Code`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
          <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="font-size: 24px; font-weight: 700; color: #111827; margin: 0;">DashMet</h1>
            <p style="font-size: 14px; color: #6B7280; margin: 4px 0 0;">Account Verification</p>
          </div>

          <p style="font-size: 16px; color: #374151; margin-bottom: 24px;">
            Hi ${firstName},
          </p>

          <p style="font-size: 15px; color: #374151; margin-bottom: 24px;">
            Enter this code on your mobile device to verify your account:
          </p>

          <div style="text-align: center; margin: 32px 0;">
            <div style="display: inline-block; background: #F3F4F6; border: 2px solid #E5E7EB; border-radius: 12px; padding: 16px 40px;">
              <span style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #111827; font-family: 'SF Mono', Monaco, monospace;">
                ${code}
              </span>
            </div>
          </div>

          <p style="font-size: 14px; color: #6B7280; margin-bottom: 8px;">
            This code expires in <strong>10 minutes</strong>.
          </p>

          <p style="font-size: 14px; color: #6B7280; margin-bottom: 32px;">
            If you didn't request this code, you can safely ignore this email.
          </p>

          <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 24px 0;" />

          <p style="font-size: 12px; color: #9CA3AF; text-align: center;">
            DashMet RCA Engine — Food Safety & Quality Management
          </p>
        </div>
      `,
    });

    if (error) {
      console.error('📧 Resend error:', error);
      return false;
    }

    console.log(`📧 Verification email sent to ${to}`);
    return true;
  } catch (err) {
    console.error('📧 Failed to send verification email:', err);
    return false;
  }
}

/**
 * Send a 6-digit OTP verification email for re-opening a closed HR case
 */
export async function sendCaseReopenEmail(
  to: string,
  code: string,
  firstName: string,
  caseNumber: string
): Promise<boolean> {
  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: `${code} — Verify to Re-Open Case ${caseNumber}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
          <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="font-size: 24px; font-weight: 700; color: #111827; margin: 0;">DashMet</h1>
            <p style="font-size: 14px; color: #6B7280; margin: 4px 0 0;">Case Re-Open Verification</p>
          </div>

          <p style="font-size: 16px; color: #374151; margin-bottom: 24px;">
            Hi ${firstName},
          </p>

          <p style="font-size: 15px; color: #374151; margin-bottom: 24px;">
            A request was made to re-open closed case <strong>${caseNumber}</strong>. Enter this code to confirm and unlock the case:
          </p>

          <div style="text-align: center; margin: 32px 0;">
            <div style="display: inline-block; background: #FFF7ED; border: 2px solid #FED7AA; border-radius: 12px; padding: 16px 40px;">
              <span style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #111827; font-family: 'SF Mono', Monaco, monospace;">
                ${code}
              </span>
            </div>
          </div>

          <p style="font-size: 14px; color: #6B7280; margin-bottom: 8px;">
            This code expires in <strong>10 minutes</strong>.
          </p>

          <p style="font-size: 14px; color: #6B7280; margin-bottom: 32px;">
            If you didn't request this, the case will remain closed. You can safely ignore this email.
          </p>

          <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 24px 0;" />

          <p style="font-size: 12px; color: #9CA3AF; text-align: center;">
            DashMet RCA Engine — Food Safety & Quality Management
          </p>
        </div>
      `,
    });

    if (error) {
      console.error('📧 Resend error:', error);
      return false;
    }

    console.log(`📧 Case reopen verification email sent to ${to}`);
    return true;
  } catch (err) {
    console.error('📧 Failed to send case reopen email:', err);
    return false;
  }
}
