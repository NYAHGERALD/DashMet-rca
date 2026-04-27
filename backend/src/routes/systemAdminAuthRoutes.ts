/**
 * Public System Admin Authentication Routes
 * These routes do NOT require authentication - they are used to verify
 * credentials before login
 */
import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { authenticator } from 'otplib';
import { hashToken, setAuthCookies } from '../utils/sessionCookies';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requireAjaxRequest, requireCsrf } from '../middleware/csrf';
import { sendEmailNotification } from '../services/notificationService';
import { decrypt, encrypt } from '../utils/encryption';
import { getIdleTimeoutMsForRole } from '../utils/sessionPolicy';

const router = Router();
const prisma = new PrismaClient();
const isProduction = process.env.NODE_ENV === 'production';

const AUTHENTICATION_FAILED_MESSAGE = 'Authentication failed';
const AUTHENTICATION_RATE_LIMIT_MESSAGE = 'Too many authentication attempts. Please try again later.';
const AUTHENTICATION_UNAVAILABLE_MESSAGE = 'Authentication unavailable';
const MFA_REQUIRED_TOTP_MESSAGE = 'Enter the verification code from your authenticator app.';
const MFA_REQUIRED_EMAIL_OTP_MESSAGE = 'Enter the verification code sent to your email.';
const MFA_ENROLLMENT_REQUIRED_MESSAGE =
  'Authenticator setup is required before login can be completed.';
const MFA_CODE_TTL_MS = 10 * 60 * 1000;
const DUMMY_PASSWORD_HASH = '$2a$12$qk36th7I0zIx.lSK3J5rKOMSrtHgc5TRZkXoqTk4elwOSkhzIjWcq';
const parsePositiveInt = (value: string | undefined, fallback: number): number => {
  const parsed = Number.parseInt(String(value || ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const LOCKOUT_THRESHOLD = parsePositiveInt(process.env.SYSTEM_ADMIN_LOCKOUT_THRESHOLD, 5);
const LOCKOUT_DURATION_MINUTES = parsePositiveInt(process.env.SYSTEM_ADMIN_LOCKOUT_DURATION_MINUTES, 15);
const LOCKOUT_ESCALATION_THRESHOLD = Math.max(
  parsePositiveInt(process.env.SYSTEM_ADMIN_LOCKOUT_ESCALATION_THRESHOLD, 10),
  LOCKOUT_THRESHOLD
);
const LOCKOUT_ESCALATED_DURATION_MINUTES = Math.max(
  parsePositiveInt(process.env.SYSTEM_ADMIN_LOCKOUT_ESCALATION_DURATION_MINUTES, 60),
  LOCKOUT_DURATION_MINUTES
);
const SYSTEM_ADMIN_RATE_LIMIT_WINDOW_MINUTES = parsePositiveInt(
  process.env.SYSTEM_ADMIN_RATE_LIMIT_WINDOW_MINUTES,
  15
);
const SYSTEM_ADMIN_IP_FAILURE_LIMIT = parsePositiveInt(process.env.SYSTEM_ADMIN_IP_FAILURE_LIMIT, 20);
const SYSTEM_ADMIN_EMAIL_FAILURE_LIMIT = parsePositiveInt(process.env.SYSTEM_ADMIN_EMAIL_FAILURE_LIMIT, 8);
const SYSTEM_ADMIN_MFA_CHALLENGE_WINDOW_MINUTES = parsePositiveInt(
  process.env.SYSTEM_ADMIN_MFA_CHALLENGE_WINDOW_MINUTES,
  15
);
const SYSTEM_ADMIN_MFA_CHALLENGE_MAX = parsePositiveInt(process.env.SYSTEM_ADMIN_MFA_CHALLENGE_MAX, 3);
const SYSTEM_ADMIN_MFA_MODE_RAW = String(process.env.SYSTEM_ADMIN_MFA_MODE || 'totp_or_email')
  .trim()
  .toLowerCase();
const SYSTEM_ADMIN_MFA_MODE: 'email_otp' | 'totp_or_email' | 'totp_only' =
  SYSTEM_ADMIN_MFA_MODE_RAW === 'email_otp'
    ? 'email_otp'
    : SYSTEM_ADMIN_MFA_MODE_RAW === 'totp_only'
      ? 'totp_only'
      : 'totp_or_email';
const SYSTEM_ADMIN_TOTP_ISSUER = String(
  process.env.SYSTEM_ADMIN_TOTP_ISSUER || 'DASHMET Control Center'
).trim();
const SYSTEM_ADMIN_TOTP_WINDOW = Math.max(
  parsePositiveInt(process.env.SYSTEM_ADMIN_TOTP_WINDOW, 1),
  1
);
const ENFORCE_SYSTEM_ADMIN_EMAIL_ALLOWLIST =
  String(process.env.SYSTEM_ADMIN_EMAIL_ALLOWLIST_ENFORCE || 'true').toLowerCase() !== 'false';
const LEGACY_SYSTEM_ADMIN_EMAIL = String(process.env.SYSTEM_ADMIN_EMAIL || '').trim().toLowerCase();
const SYSTEM_ADMIN_EMAIL_ALLOWLIST = new Set(
  [
    ...String(process.env.SYSTEM_ADMIN_EMAIL_ALLOWLIST || '')
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
    ...(LEGACY_SYSTEM_ADMIN_EMAIL ? [LEGACY_SYSTEM_ADMIN_EMAIL] : []),
  ]
);

authenticator.options = {
  step: 30,
  window: SYSTEM_ADMIN_TOTP_WINDOW,
};

type UserWithSecurityFields = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
  isActive: boolean;
  password: string | null;
  loginAttempts: number;
  lockedUntil: Date | null;
  mfaEnabled: boolean;
  mfaSecret: string | null;
};

type ResolvedMfaMethod = 'email_otp' | 'totp' | 'totp_enrollment_required';

type LockoutStatus = {
  locked: boolean;
  remainingMinutes?: number;
};

type FailedAttemptResult = {
  isNowLocked: boolean;
  attemptsRemaining: number;
  remainingMinutes?: number;
  lockoutTier?: 'standard' | 'elevated' | null;
};

const resolveLockoutDurationMinutes = (attemptCount: number): number => {
  if (attemptCount < LOCKOUT_THRESHOLD) return 0;
  if (attemptCount >= LOCKOUT_ESCALATION_THRESHOLD) {
    return LOCKOUT_ESCALATED_DURATION_MINUTES;
  }
  return LOCKOUT_DURATION_MINUTES;
};

const resolveLockoutTier = (attemptCount: number): 'standard' | 'elevated' | null => {
  if (attemptCount < LOCKOUT_THRESHOLD) return null;
  return attemptCount >= LOCKOUT_ESCALATION_THRESHOLD ? 'elevated' : 'standard';
};

async function getAccountLockStatus(user: UserWithSecurityFields): Promise<LockoutStatus> {
  if (!user.lockedUntil) return { locked: false };

  const now = new Date();
  if (now >= user.lockedUntil) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        lockedUntil: null,
        loginAttempts: 0,
      },
    });
    return { locked: false };
  }

  const remainingMs = user.lockedUntil.getTime() - now.getTime();
  return { locked: true, remainingMinutes: Math.ceil(remainingMs / 60000) };
}

async function recordFailedAttempt(user: UserWithSecurityFields): Promise<FailedAttemptResult> {
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      loginAttempts: { increment: 1 },
    },
    select: {
      loginAttempts: true,
    },
  });

  const attempts = updated.loginAttempts;
  const lockoutDurationMinutes = resolveLockoutDurationMinutes(attempts);
  const lockoutTier = resolveLockoutTier(attempts);
  if (lockoutDurationMinutes > 0) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        lockedUntil: new Date(Date.now() + lockoutDurationMinutes * 60 * 1000),
      },
    });

    return {
      isNowLocked: true,
      attemptsRemaining: 0,
      remainingMinutes: lockoutDurationMinutes,
      lockoutTier,
    };
  }

  return {
    isNowLocked: false,
    attemptsRemaining: Math.max(0, LOCKOUT_THRESHOLD - attempts),
    lockoutTier,
  };
}

async function clearAttempts(userId: string, ipAddress?: string | null): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      loginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
      lastLoginIp: ipAddress || null,
    },
  });
}

async function normalizeFailureTiming(password: string): Promise<void> {
  await bcrypt.compare(String(password || ''), DUMMY_PASSWORD_HASH);
}

const normalizeCount = (value: unknown): number => {
  if (typeof value === 'bigint') return Number(value);
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

async function getRecentAuthFailureCounts(
  email: string,
  ipAddress: string
): Promise<{ ipFailures: number; emailFailures: number }> {
  const windowStart = new Date(
    Date.now() - SYSTEM_ADMIN_RATE_LIMIT_WINDOW_MINUTES * 60 * 1000
  );

  type CountRow = { count: bigint | number | string };

  const [ipRows, emailRows] = await Promise.all([
    prisma.$queryRaw<CountRow[]>`
      SELECT COUNT(*) AS count
      FROM "AuditLog"
      WHERE "entity" = 'SYSTEM_ADMIN_AUTH'
        AND "createdAt" >= ${windowStart}
        AND COALESCE("changes"->>'success', 'false') = 'false'
        AND COALESCE("changes"->>'eventType', '') <> 'AUTH_RATE_LIMITED'
        AND COALESCE("changes"->>'ipAddress', '') = ${ipAddress}
    `,
    prisma.$queryRaw<CountRow[]>`
      SELECT COUNT(*) AS count
      FROM "AuditLog"
      WHERE "entity" = 'SYSTEM_ADMIN_AUTH'
        AND "createdAt" >= ${windowStart}
        AND COALESCE("changes"->>'success', 'false') = 'false'
        AND COALESCE("changes"->>'eventType', '') <> 'AUTH_RATE_LIMITED'
        AND COALESCE(LOWER("changes"->>'email'), '') = ${email.toLowerCase()}
    `,
  ]);

  return {
    ipFailures: normalizeCount(ipRows[0]?.count),
    emailFailures: normalizeCount(emailRows[0]?.count),
  };
}

async function isMfaChallengeRateLimited(user: { id: string; email: string }): Promise<boolean> {
  const windowStart = new Date(
    Date.now() - SYSTEM_ADMIN_MFA_CHALLENGE_WINDOW_MINUTES * 60 * 1000
  );

  const recentChallenges = await prisma.mobileVerification.count({
    where: {
      userId: user.id,
      email: user.email,
      createdAt: { gte: windowStart },
    },
  });

  return recentChallenges >= SYSTEM_ADMIN_MFA_CHALLENGE_MAX;
}

function isSystemAdminEmailAllowlisted(email: string): boolean {
  if (!ENFORCE_SYSTEM_ADMIN_EMAIL_ALLOWLIST) {
    return true;
  }
  return SYSTEM_ADMIN_EMAIL_ALLOWLIST.has(email.toLowerCase());
}

const isTotpConfigured = (user: { mfaEnabled: boolean; mfaSecret: string | null }): boolean =>
  Boolean(user.mfaEnabled && user.mfaSecret);

function resolveMfaMethod(user: { mfaEnabled: boolean; mfaSecret: string | null }): ResolvedMfaMethod {
  if (SYSTEM_ADMIN_MFA_MODE === 'email_otp') return 'email_otp';
  if (isTotpConfigured(user)) return 'totp';
  return SYSTEM_ADMIN_MFA_MODE === 'totp_only' ? 'totp_enrollment_required' : 'email_otp';
}

function getDecryptedTotpSecret(secretValue: string | null): string | null {
  if (!secretValue) return null;
  const decrypted = decrypt(secretValue);
  return decrypted || null;
}

function verifyTotpCode(secret: string, providedCode: string): boolean {
  const normalizedCode = String(providedCode || '')
    .replace(/\s+/g, '')
    .trim();
  if (!/^\d{6,8}$/.test(normalizedCode)) {
    return false;
  }
  try {
    return authenticator.verify({
      token: normalizedCode,
      secret,
    });
  } catch {
    return false;
  }
}

function generateTokens(userId: string) {
  const accessToken = jwt.sign(
    { userId },
    process.env.JWT_SECRET as string,
    { expiresIn: process.env.ACCESS_TOKEN_EXPIRE || '15m' } as jwt.SignOptions
  );

  const refreshToken = jwt.sign(
    { userId },
    process.env.JWT_REFRESH_SECRET as string,
    { expiresIn: process.env.REFRESH_TOKEN_EXPIRE || process.env.JWT_REFRESH_EXPIRE || '7d' } as jwt.SignOptions
  );

  return { accessToken, refreshToken };
}

async function sendSystemAdminMfaChallenge(
  user: { id: string; email: string; firstName: string | null }
): Promise<boolean> {
  await prisma.mobileVerification.updateMany({
    where: { userId: user.id, used: false },
    data: { used: true },
  });

  const code = crypto.randomInt(100000, 999999).toString();
  const codeHash = crypto.createHash('sha256').update(code).digest('hex');

  await prisma.mobileVerification.create({
    data: {
      id: uuidv4(),
      userId: user.id,
      email: user.email,
      codeHash,
      expiresAt: new Date(Date.now() + MFA_CODE_TTL_MS),
    },
  });

  const firstName = user.firstName || 'there';
  const emailResult = await sendEmailNotification({
    to: user.email,
    subject: `${code} — DashMet System Admin Verification Code`,
    body: `Hi ${firstName}, your DashMet System Admin verification code is ${code}. It expires in 10 minutes.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px;">
        <h2 style="margin: 0 0 8px; color: #111827;">System Admin Verification</h2>
        <p style="color: #374151;">Hi ${firstName},</p>
        <p style="color: #374151;">Use this verification code to complete your DashMet System Admin sign in:</p>
        <div style="margin: 20px 0; text-align: center;">
          <span style="display: inline-block; background: #F3F4F6; border: 1px solid #E5E7EB; border-radius: 10px; padding: 12px 22px; font-size: 30px; font-weight: 700; letter-spacing: 5px; color: #111827;">
            ${code}
          </span>
        </div>
        <p style="color: #6B7280; margin-bottom: 0;">This code expires in 10 minutes. If you did not request this, secure your credentials immediately.</p>
      </div>
    `,
  });

  return Boolean(emailResult?.success);
}

async function verifySystemAdminMfaCode(
  user: { id: string; email: string },
  providedCode: string
): Promise<{ valid: boolean; attemptsRemaining: number }> {
  const challenge = await prisma.mobileVerification.findFirst({
    where: {
      userId: user.id,
      email: user.email,
      used: false,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!challenge) {
    return { valid: false, attemptsRemaining: 0 };
  }

  const providedHash = crypto.createHash('sha256').update(providedCode).digest('hex');
  const challengeBuffer = Buffer.from(challenge.codeHash, 'hex');
  const providedBuffer = Buffer.from(providedHash, 'hex');
  const isValid =
    challengeBuffer.length === providedBuffer.length &&
    crypto.timingSafeEqual(challengeBuffer, providedBuffer);

  if (!isValid) {
    const attempts = challenge.attempts + 1;
    await prisma.mobileVerification.update({
      where: { id: challenge.id },
      data: { attempts, used: attempts >= 5 },
    });
    return { valid: false, attemptsRemaining: Math.max(0, 5 - attempts) };
  }

  await prisma.mobileVerification.update({
    where: { id: challenge.id },
    data: { used: true },
  });

  return { valid: true, attemptsRemaining: 0 };
}

// Helper to log security events
async function logSecurityEvent(
  eventType: string,
  email: string,
  success: boolean,
  ipAddress: string,
  userAgent: string,
  details?: Record<string, any>
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        id: uuidv4(),
        action: success ? 'VIEW' : 'UPDATE',
        entity: 'SYSTEM_ADMIN_AUTH',
        entityId: 'system-admin-portal',
        changes: {
          eventType,
          email,
          success,
          ipAddress,
          userAgent,
          timestamp: new Date().toISOString(),
          ...details,
        },
      },
    });
  } catch (error) {
    console.error('Failed to log security event:', error);
  }
}

async function getSystemAdminSecurityUser(userId: string): Promise<UserWithSecurityFields | null> {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      isActive: true,
      password: true,
      loginAttempts: true,
      lockedUntil: true,
      mfaEnabled: true,
      mfaSecret: true,
    },
  });
}

// Retired legacy endpoint - PUBLIC endpoint
router.post('/verify-master-key', requireAjaxRequest, async (req: Request, res: Response) => {
  return res.status(410).json({
    success: false,
    error: 'This endpoint is retired. Use /authenticate.',
  });
});

// Full System Admin authentication - PUBLIC endpoint
router.post('/authenticate', requireAjaxRequest, async (req: Request, res: Response) => {
  try {
    const email = String(req.body.email || '').toLowerCase().trim();
    const password = String(req.body.password || '');
    const mfaCode = String(req.body.mfaCode || '').trim();
    const ipAddress = req.headers['x-forwarded-for']?.toString() || req.socket.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

    if (!email || !password) {
      await logSecurityEvent('AUTH_MISSING_CREDENTIALS', email || 'unknown', false, ipAddress, userAgent);
      return res.status(400).json({
        success: false,
        error: AUTHENTICATION_FAILED_MESSAGE,
      });
    }

    if (
      ENFORCE_SYSTEM_ADMIN_EMAIL_ALLOWLIST &&
      SYSTEM_ADMIN_EMAIL_ALLOWLIST.size === 0 &&
      isProduction
    ) {
      await logSecurityEvent(
        'AUTH_ALLOWLIST_MISCONFIGURED',
        email || 'unknown',
        false,
        ipAddress,
        userAgent
      );
      return res.status(503).json({
        success: false,
        error: AUTHENTICATION_UNAVAILABLE_MESSAGE,
      });
    }

    const failureCounts = await getRecentAuthFailureCounts(email, String(ipAddress));
    if (
      failureCounts.ipFailures >= SYSTEM_ADMIN_IP_FAILURE_LIMIT ||
      failureCounts.emailFailures >= SYSTEM_ADMIN_EMAIL_FAILURE_LIMIT
    ) {
      await logSecurityEvent('AUTH_RATE_LIMITED', email || 'unknown', false, ipAddress, userAgent, {
        windowMinutes: SYSTEM_ADMIN_RATE_LIMIT_WINDOW_MINUTES,
        ipFailures: failureCounts.ipFailures,
        ipLimit: SYSTEM_ADMIN_IP_FAILURE_LIMIT,
        emailFailures: failureCounts.emailFailures,
        emailLimit: SYSTEM_ADMIN_EMAIL_FAILURE_LIMIT,
      });
      return res.status(429).json({
        success: false,
        error: AUTHENTICATION_RATE_LIMIT_MESSAGE,
        locked: true,
        rateLimited: true,
      });
    }

    // Check user exists and role posture before credential checks.
    const user = await prisma.user.findUnique({
      where: {
        email,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        password: true,
        loginAttempts: true,
        lockedUntil: true,
        mfaEnabled: true,
        mfaSecret: true,
      },
    });

    if (user?.role === 'SYSTEM_ADMIN') {
      const lockoutStatus = await getAccountLockStatus(user);
      if (lockoutStatus.locked) {
        await logSecurityEvent('AUTH_LOCKED', email || 'unknown', false, ipAddress, userAgent, {
          remainingMinutes: lockoutStatus.remainingMinutes,
        });
        return res.status(429).json({
          success: false,
          error: AUTHENTICATION_RATE_LIMIT_MESSAGE,
          locked: true,
          remainingMinutes: lockoutStatus.remainingMinutes,
        });
      }
    }

    if (!isSystemAdminEmailAllowlisted(email)) {
      await normalizeFailureTiming(password);
      await logSecurityEvent('AUTH_EMAIL_NOT_ALLOWLISTED', email || 'unknown', false, ipAddress, userAgent);
      return res.status(401).json({
        success: false,
        error: AUTHENTICATION_FAILED_MESSAGE,
        locked: false,
      });
    }

    if (!user || user.role !== 'SYSTEM_ADMIN' || !user.isActive || !user.password) {
      await normalizeFailureTiming(password);
      const attemptResult = user?.role === 'SYSTEM_ADMIN'
        ? await recordFailedAttempt(user)
        : { isNowLocked: false, attemptsRemaining: LOCKOUT_THRESHOLD };
      await logSecurityEvent('AUTH_NOT_SYSTEM_ADMIN', email || 'unknown', false, ipAddress, userAgent);
      return res.status(401).json({
        success: false,
        error: AUTHENTICATION_FAILED_MESSAGE,
        locked: attemptResult.isNowLocked,
        remainingMinutes: attemptResult.remainingMinutes,
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      const attemptResult = await recordFailedAttempt(user);
      await logSecurityEvent('AUTH_INVALID_PASSWORD', email || 'unknown', false, ipAddress, userAgent, {
        loginAttempts: user.loginAttempts + 1,
        lockoutTier: attemptResult.lockoutTier,
        lockApplied: attemptResult.isNowLocked,
      });
      return res.status(401).json({
        success: false,
        error: AUTHENTICATION_FAILED_MESSAGE,
        locked: attemptResult.isNowLocked,
        remainingMinutes: attemptResult.remainingMinutes,
      });
    }

    // Enterprise posture: MFA is mandatory for every System Admin login.
    const mfaMethod = resolveMfaMethod(user);
    if (mfaMethod === 'totp_enrollment_required') {
      await logSecurityEvent('AUTH_MFA_ENROLLMENT_REQUIRED', email || 'unknown', false, ipAddress, userAgent, {
        mode: SYSTEM_ADMIN_MFA_MODE,
      });
      return res.status(403).json({
        success: false,
        error: MFA_ENROLLMENT_REQUIRED_MESSAGE,
        mfaEnrollmentRequired: true,
      });
    }

    if (!mfaCode) {
      if (mfaMethod === 'totp') {
        await logSecurityEvent('AUTH_MFA_TOTP_REQUIRED', email || 'unknown', true, ipAddress, userAgent, {
          mode: SYSTEM_ADMIN_MFA_MODE,
        });
        return res.status(200).json({
          success: false,
          requiresMfa: true,
          mfaMethod: 'totp',
          message: MFA_REQUIRED_TOTP_MESSAGE,
        });
      }

      if (await isMfaChallengeRateLimited({ id: user.id, email: user.email })) {
        await logSecurityEvent('AUTH_MFA_CHALLENGE_RATE_LIMITED', email || 'unknown', false, ipAddress, userAgent, {
          windowMinutes: SYSTEM_ADMIN_MFA_CHALLENGE_WINDOW_MINUTES,
          maxChallenges: SYSTEM_ADMIN_MFA_CHALLENGE_MAX,
        });
        return res.status(429).json({
          success: false,
          error: AUTHENTICATION_RATE_LIMIT_MESSAGE,
          requiresMfa: true,
          mfaMethod: 'email_otp',
          rateLimited: true,
        });
      }

      const challengeSent = await sendSystemAdminMfaChallenge({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
      });

      await logSecurityEvent(
        challengeSent ? 'AUTH_MFA_CHALLENGE_SENT' : 'AUTH_MFA_CHALLENGE_SEND_FAILED',
        email || 'unknown',
        challengeSent,
        ipAddress,
        userAgent
      );

      if (!challengeSent) {
        return res.status(500).json({
          success: false,
          error: AUTHENTICATION_UNAVAILABLE_MESSAGE,
        });
      }

      return res.status(200).json({
        success: false,
        requiresMfa: true,
        mfaMethod: 'email_otp',
        message: MFA_REQUIRED_EMAIL_OTP_MESSAGE,
      });
    }

    if (mfaMethod === 'totp') {
      const totpSecret = getDecryptedTotpSecret(user.mfaSecret);
      const isTotpValid = totpSecret ? verifyTotpCode(totpSecret, mfaCode) : false;

      if (!isTotpValid) {
        const attemptResult = await recordFailedAttempt(user);
        await logSecurityEvent('AUTH_MFA_TOTP_INVALID', email || 'unknown', false, ipAddress, userAgent, {
          lockoutTier: attemptResult.lockoutTier,
          lockApplied: attemptResult.isNowLocked,
        });
        return res.status(401).json({
          success: false,
          error: AUTHENTICATION_FAILED_MESSAGE,
          locked: attemptResult.isNowLocked,
          remainingMinutes: attemptResult.remainingMinutes,
          requiresMfa: true,
          mfaMethod: 'totp',
        });
      }

      await logSecurityEvent('AUTH_MFA_TOTP_VERIFIED', email || 'unknown', true, ipAddress, userAgent, {
        userId: user.id,
      });
    } else {
      const mfaVerification = await verifySystemAdminMfaCode(
        { id: user.id, email: user.email },
        mfaCode
      );

      if (!mfaVerification.valid) {
        const attemptResult = await recordFailedAttempt(user);
        await logSecurityEvent('AUTH_MFA_INVALID', email || 'unknown', false, ipAddress, userAgent, {
          mfaAttemptsRemaining: mfaVerification.attemptsRemaining,
          lockoutTier: attemptResult.lockoutTier,
          lockApplied: attemptResult.isNowLocked,
        });
        return res.status(401).json({
          success: false,
          error: AUTHENTICATION_FAILED_MESSAGE,
          locked: attemptResult.isNowLocked,
          remainingMinutes: attemptResult.remainingMinutes,
          requiresMfa: true,
          mfaMethod: 'email_otp',
        });
      }

      await logSecurityEvent('AUTH_MFA_VERIFIED', email || 'unknown', true, ipAddress, userAgent, {
        userId: user.id,
      });
    }

    // Success! Clear attempts and update account login metadata.
    await clearAttempts(user.id, String(ipAddress));
    await logSecurityEvent('AUTH_SUCCESS', email || 'unknown', true, ipAddress, userAgent, {
      userId: user.id,
    });

    const { accessToken, refreshToken } = generateTokens(user.id);
    await prisma.session.create({
      data: {
        id: uuidv4(),
        userId: user.id,
        token: hashToken(accessToken),
        refreshToken: hashToken(refreshToken),
        expiresAt: new Date(Date.now() + getIdleTimeoutMsForRole('SYSTEM_ADMIN')),
        ipAddress: String(ipAddress),
        deviceInfo: String(userAgent),
      },
    });

    setAuthCookies(res, accessToken, refreshToken);

    res.json({
      success: true,
      requiresMfa: false,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Error in system admin authentication:', error);
    res.status(500).json({
      success: false,
      error: AUTHENTICATION_UNAVAILABLE_MESSAGE,
    });
  }
});

// Get SYSTEM_ADMIN MFA posture (authenticated)
router.get('/mfa/status', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'SYSTEM_ADMIN') {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
      });
    }

    const user = await getSystemAdminSecurityUser(req.user.id);
    if (!user || user.role !== 'SYSTEM_ADMIN' || !user.isActive) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    const mfaMethod = resolveMfaMethod(user);
    return res.json({
      success: true,
      data: {
        mode: SYSTEM_ADMIN_MFA_MODE,
        method: mfaMethod === 'totp_enrollment_required' ? 'totp' : mfaMethod,
        totpConfigured: isTotpConfigured(user),
        enrollmentRequired: mfaMethod === 'totp_enrollment_required',
      },
    });
  } catch (error) {
    console.error('Error retrieving SYSTEM_ADMIN MFA status:', error);
    return res.status(500).json({
      success: false,
      error: AUTHENTICATION_UNAVAILABLE_MESSAGE,
    });
  }
});

// Provision a new TOTP secret for SYSTEM_ADMIN authenticator app enrollment.
router.post('/mfa/totp/provision', authenticate, requireCsrf, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'SYSTEM_ADMIN') {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
      });
    }

    const password = String(req.body.password || '');
    if (!password) {
      return res.status(400).json({
        success: false,
        error: AUTHENTICATION_FAILED_MESSAGE,
      });
    }

    const user = await getSystemAdminSecurityUser(req.user.id);
    if (!user || user.role !== 'SYSTEM_ADMIN' || !user.isActive || !user.password) {
      return res.status(401).json({
        success: false,
        error: AUTHENTICATION_FAILED_MESSAGE,
      });
    }

    const passwordValid = await bcrypt.compare(password, user.password);
    if (!passwordValid) {
      return res.status(401).json({
        success: false,
        error: AUTHENTICATION_FAILED_MESSAGE,
      });
    }

    const secret = authenticator.generateSecret();
    const otpauthUri = authenticator.keyuri(user.email, SYSTEM_ADMIN_TOTP_ISSUER, secret);

    await logSecurityEvent('AUTH_MFA_TOTP_PROVISIONED', user.email, true, req.ip || 'unknown', req.headers['user-agent'] || 'unknown', {
      userId: user.id,
    });

    return res.status(200).json({
      success: true,
      data: {
        secret,
        otpauthUri,
        issuer: SYSTEM_ADMIN_TOTP_ISSUER,
        accountName: user.email,
        digits: 6,
        periodSeconds: 30,
      },
    });
  } catch (error) {
    console.error('Error provisioning SYSTEM_ADMIN TOTP:', error);
    return res.status(500).json({
      success: false,
      error: AUTHENTICATION_UNAVAILABLE_MESSAGE,
    });
  }
});

// Verify and enable TOTP for SYSTEM_ADMIN.
router.post('/mfa/totp/enable', authenticate, requireCsrf, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'SYSTEM_ADMIN') {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
      });
    }

    const password = String(req.body.password || '');
    const secret = String(req.body.secret || '').trim();
    const code = String(req.body.code || '').trim();
    if (!password || !secret || !code) {
      return res.status(400).json({
        success: false,
        error: AUTHENTICATION_FAILED_MESSAGE,
      });
    }

    const user = await getSystemAdminSecurityUser(req.user.id);
    if (!user || user.role !== 'SYSTEM_ADMIN' || !user.isActive || !user.password) {
      return res.status(401).json({
        success: false,
        error: AUTHENTICATION_FAILED_MESSAGE,
      });
    }

    const passwordValid = await bcrypt.compare(password, user.password);
    if (!passwordValid || !verifyTotpCode(secret, code)) {
      return res.status(401).json({
        success: false,
        error: AUTHENTICATION_FAILED_MESSAGE,
      });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        mfaEnabled: true,
        mfaSecret: encrypt(secret),
      },
    });

    await logSecurityEvent('AUTH_MFA_TOTP_ENABLED', user.email, true, req.ip || 'unknown', req.headers['user-agent'] || 'unknown', {
      userId: user.id,
    });

    return res.status(200).json({
      success: true,
      message: 'Authenticator MFA enabled.',
    });
  } catch (error) {
    console.error('Error enabling SYSTEM_ADMIN TOTP:', error);
    return res.status(500).json({
      success: false,
      error: AUTHENTICATION_UNAVAILABLE_MESSAGE,
    });
  }
});

// Disable TOTP for SYSTEM_ADMIN (requires password + current authenticator code).
router.post('/mfa/totp/disable', authenticate, requireCsrf, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'SYSTEM_ADMIN') {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
      });
    }

    if (SYSTEM_ADMIN_MFA_MODE === 'totp_only') {
      return res.status(409).json({
        success: false,
        error: 'TOTP is enforced by policy and cannot be disabled.',
      });
    }

    const password = String(req.body.password || '');
    const code = String(req.body.code || '').trim();
    if (!password || !code) {
      return res.status(400).json({
        success: false,
        error: AUTHENTICATION_FAILED_MESSAGE,
      });
    }

    const user = await getSystemAdminSecurityUser(req.user.id);
    if (!user || user.role !== 'SYSTEM_ADMIN' || !user.isActive || !user.password) {
      return res.status(401).json({
        success: false,
        error: AUTHENTICATION_FAILED_MESSAGE,
      });
    }

    if (!isTotpConfigured(user)) {
      return res.status(400).json({
        success: false,
        error: 'Authenticator MFA is not enabled.',
      });
    }

    const passwordValid = await bcrypt.compare(password, user.password);
    const totpSecret = getDecryptedTotpSecret(user.mfaSecret);
    const codeValid = totpSecret ? verifyTotpCode(totpSecret, code) : false;

    if (!passwordValid || !codeValid) {
      return res.status(401).json({
        success: false,
        error: AUTHENTICATION_FAILED_MESSAGE,
      });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        mfaEnabled: false,
        mfaSecret: null,
      },
    });

    await logSecurityEvent('AUTH_MFA_TOTP_DISABLED', user.email, true, req.ip || 'unknown', req.headers['user-agent'] || 'unknown', {
      userId: user.id,
    });

    return res.status(200).json({
      success: true,
      message: 'Authenticator MFA disabled.',
    });
  } catch (error) {
    console.error('Error disabling SYSTEM_ADMIN TOTP:', error);
    return res.status(500).json({
      success: false,
      error: AUTHENTICATION_UNAVAILABLE_MESSAGE,
    });
  }
});

export default router;
