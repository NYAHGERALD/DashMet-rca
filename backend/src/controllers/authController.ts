import { Response } from 'express';
import { Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { prisma } from '../utils/prisma';
import { AuthRequest } from '../middleware/auth';
import { ValidationError, AuthenticationError, NotFoundError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { logAuditEvent, logAuditFromRequest, getClientIp } from '../services/auditService';
import { sendEmailNotification } from '../services/notificationService';
import { sendVerificationEmail } from '../services/emailService';
import { decrypt, encryptPhone } from '../utils/encryption';
import {
  clearAuthCookies,
  clearTrustedDeviceCookie,
  getAccessTokenFromRequest,
  getCookie,
  getRefreshTokenFromRequest,
  hashToken,
  setAuthCookies,
  setTrustedDeviceCookie,
  TRUSTED_DEVICE_COOKIE_NAME,
} from '../utils/sessionCookies';
import { assertPasswordPolicy } from '../utils/passwordPolicy';
import {
  getIdleTimeoutMsForRole,
  isSessionAbsoluteExpired,
} from '../utils/sessionPolicy';
const INVALID_CREDENTIALS_MESSAGE = 'Invalid email or password';
const AUTH_REQUIRED_MESSAGE = 'Authentication required';
const PASSWORD_UPDATE_FAILED_MESSAGE = 'Unable to update password';
const PASSWORD_RESET_FAILED_MESSAGE = 'Unable to reset password';

// Used to normalize password-check timing for missing users/passwords.
const DUMMY_PASSWORD_HASH = '$2a$12$qk36th7I0zIx.lSK3J5rKOMSrtHgc5TRZkXoqTk4elwOSkhzIjWcq';
const parsePositiveInt = (value: string | undefined, fallback: number): number => {
  const parsed = Number.parseInt(String(value || ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const MAX_LOGIN_ATTEMPTS = parsePositiveInt(process.env.MAX_LOGIN_ATTEMPTS, 5);
const BASE_LOCKOUT_DURATION_MS = parsePositiveInt(process.env.LOCKOUT_DURATION, 15 * 60 * 1000);
const LOCKOUT_ESCALATION_THRESHOLD = Math.max(
  parsePositiveInt(process.env.LOCKOUT_ESCALATION_THRESHOLD, 10),
  MAX_LOGIN_ATTEMPTS
);
const ESCALATED_LOCKOUT_DURATION_MS = Math.max(
  parsePositiveInt(process.env.LOCKOUT_ESCALATION_DURATION, 60 * 60 * 1000),
  BASE_LOCKOUT_DURATION_MS
);
const LOGIN_MFA_EMAIL_SCOPE_SUFFIX = '::org_login_mfa';
const LOGIN_MFA_REQUIRED_EMAIL_OTP_MESSAGE = 'Enter the verification code sent to your email.';
const AUTH_UNAVAILABLE_MESSAGE = 'Authentication unavailable';
const LOGIN_MFA_CODE_TTL_MS = parsePositiveInt(process.env.ORG_LOGIN_MFA_CODE_TTL_MS, 10 * 60 * 1000);
const LOGIN_MFA_MAX_ATTEMPTS = Math.max(
  parsePositiveInt(process.env.ORG_LOGIN_MFA_MAX_ATTEMPTS, 5),
  1
);
const ORG_LOGIN_MFA_CHALLENGE_WINDOW_MINUTES = parsePositiveInt(
  process.env.ORG_LOGIN_MFA_CHALLENGE_WINDOW_MINUTES,
  15
);
const ORG_LOGIN_MFA_CHALLENGE_MAX = parsePositiveInt(
  process.env.ORG_LOGIN_MFA_CHALLENGE_MAX,
  3
);
const ORG_LOGIN_MFA_SCOPE_RAW = String(process.env.ORG_LOGIN_MFA_SCOPE || 'all_users')
  .trim()
  .toLowerCase();
const ORG_LOGIN_MFA_SCOPE: 'off' | 'admin_only' | 'all_users' =
  ORG_LOGIN_MFA_SCOPE_RAW === 'off'
    ? 'off'
    : ORG_LOGIN_MFA_SCOPE_RAW === 'admin_only'
      ? 'admin_only'
      : 'all_users';
const ORG_LOGIN_TRUSTED_DEVICE_DAYS = parsePositiveInt(
  process.env.ORG_LOGIN_TRUSTED_DEVICE_DAYS,
  30
);
const ORG_LOGIN_TRUSTED_DEVICE_MAX_PER_USER = Math.max(
  parsePositiveInt(process.env.ORG_LOGIN_TRUSTED_DEVICE_MAX_PER_USER, 10),
  1
);
const TRUSTED_DEVICE_COOKIE_MAX_AGE_SECONDS = ORG_LOGIN_TRUSTED_DEVICE_DAYS * 24 * 60 * 60;
const TRUSTED_DEVICE_TOKEN_BYTES = 32;
const TRUSTED_DEVICE_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TRUSTED_DEVICE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,}$/;

// Generate JWT tokens
const generateTokens = (userId: string) => {
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
};

type LoginAuditResult = 'success' | 'failed';
type LockoutTier = 'standard' | 'elevated';
type RefreshReuseContext = {
  userId: string;
  organizationId?: string | null;
};
type TrustedDeviceVerification = {
  trusted: boolean;
  deviceId?: string;
};

type RememberedTrustedDevice = {
  deviceId: string;
  trustedDeviceToken: string;
};

type FailedLoginAttemptState = {
  loginAttempts: number;
  lockoutDurationMs: number;
  lockoutTier: LockoutTier | null;
  shouldLockAccount: boolean;
  nextLockedUntil: Date | null;
};

const resolveLockoutDurationMs = (attemptCount: number): number => {
  if (attemptCount < MAX_LOGIN_ATTEMPTS) {
    return 0;
  }

  if (attemptCount >= LOCKOUT_ESCALATION_THRESHOLD) {
    return ESCALATED_LOCKOUT_DURATION_MS;
  }

  return BASE_LOCKOUT_DURATION_MS;
};

const resolveLockoutTier = (attemptCount: number): LockoutTier | null => {
  if (attemptCount < MAX_LOGIN_ATTEMPTS) {
    return null;
  }

  return attemptCount >= LOCKOUT_ESCALATION_THRESHOLD ? 'elevated' : 'standard';
};

const formatLockoutDuration = (durationMs: number): string => {
  const totalMinutes = Math.max(Math.ceil(durationMs / 60000), 1);
  if (totalMinutes % 60 === 0) {
    const hours = totalMinutes / 60;
    return `${hours} hour${hours === 1 ? '' : 's'}`;
  }
  return `${totalMinutes} minute${totalMinutes === 1 ? '' : 's'}`;
};

const toOrgLoginMfaChallengeEmail = (email: string): string =>
  `${email.toLowerCase()}${LOGIN_MFA_EMAIL_SCOPE_SUFFIX}`;

const shouldRequireOrgLoginMfa = (user: { role: string }): boolean => {
  if (user.role === 'SYSTEM_ADMIN' || ORG_LOGIN_MFA_SCOPE === 'off') {
    return false;
  }
  if (ORG_LOGIN_MFA_SCOPE === 'admin_only') {
    return user.role === 'ADMIN';
  }
  return true;
};

const parseBooleanBodyValue = (value: unknown): boolean => {
  const normalized = String(value || '').trim().toLowerCase();
  return value === true || normalized === 'true' || normalized === '1' || normalized === 'on';
};

const isMissingTrustedDeviceTableError = (error: unknown): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021';

const hashTrustedDeviceToken = (deviceId: string, token: string): string =>
  hashToken(`${deviceId}:${token}`);

const hashTrustedDeviceUserAgent = (userAgent?: string): string | null => {
  const normalized = String(userAgent || '').trim();
  return normalized ? hashToken(normalized) : null;
};

const getTrustedDeviceInfo = (req: AuthRequest): string | null => {
  const userAgent = String(req.get('user-agent') || '').trim();
  return userAgent ? userAgent.slice(0, 512) : null;
};

const parseTrustedDeviceCookie = (
  cookieValue?: string
): { deviceId: string; token: string } | null => {
  if (!cookieValue) {
    return null;
  }

  const [deviceId, token, extra] = cookieValue.split('.');
  if (
    extra !== undefined ||
    !TRUSTED_DEVICE_ID_PATTERN.test(deviceId || '') ||
    !TRUSTED_DEVICE_TOKEN_PATTERN.test(token || '')
  ) {
    return null;
  }

  return { deviceId, token };
};

const isMobileTrustedDeviceClient = (req: AuthRequest): boolean =>
  String(req.get('x-dashmet-mobile-app') || '').trim().toLowerCase() === 'rca-mobile';

const buildMobileSessionPayload = (
  req: AuthRequest,
  accessToken: string,
  refreshToken: string
) =>
  isMobileTrustedDeviceClient(req)
    ? {
        accessToken,
        refreshToken,
      }
    : {};

const getMobileTrustedDeviceToken = (req: AuthRequest): string | undefined => {
  const headerToken = String(req.get('x-dashmet-trusted-device') || '').trim();
  const bodyToken = String(req.body?.trustedDeviceToken || '').trim();
  return headerToken || bodyToken || undefined;
};

const parseTrustedDeviceCredential = (
  value?: string
): { deviceId: string; token: string } | null => {
  if (!value) {
    return null;
  }

  try {
    const decoded = value.includes('%') ? decodeURIComponent(value) : value;
    return parseTrustedDeviceCookie(decoded);
  } catch {
    return null;
  }
};

const safeTokenHashEquals = (storedHash: string, candidateHash: string): boolean => {
  const storedBuffer = Buffer.from(storedHash, 'hex');
  const candidateBuffer = Buffer.from(candidateHash, 'hex');
  return (
    storedBuffer.length === candidateBuffer.length &&
    crypto.timingSafeEqual(storedBuffer, candidateBuffer)
  );
};

const verifyLoginTrustedDevice = async (
  req: AuthRequest,
  res: Response,
  user: { id: string },
  now: Date
): Promise<TrustedDeviceVerification> => {
  const rawTrustedCookie = getCookie(req, TRUSTED_DEVICE_COOKIE_NAME);
  const parsedCookie = parseTrustedDeviceCookie(rawTrustedCookie);
  const parsedMobileCredential = isMobileTrustedDeviceClient(req)
    ? parseTrustedDeviceCredential(getMobileTrustedDeviceToken(req))
    : null;
  const parsedCredential = parsedCookie || parsedMobileCredential;

  if (!parsedCredential) {
    return { trusted: false };
  }

  try {
    const trustedDevice = await prisma.loginTrustedDevice.findFirst({
      where: {
        id: parsedCredential.deviceId,
        userId: user.id,
        revokedAt: null,
        expiresAt: { gt: now },
      },
    });

    if (!trustedDevice) {
      if (parsedCookie) {
        clearTrustedDeviceCookie(res);
      }
      return { trusted: false };
    }

    const candidateHash = hashTrustedDeviceToken(parsedCredential.deviceId, parsedCredential.token);
    const userAgentHash = hashTrustedDeviceUserAgent(req.get('user-agent'));
    const tokenMatches = safeTokenHashEquals(trustedDevice.tokenHash, candidateHash);
    const userAgentMatches =
      !trustedDevice.userAgentHash || trustedDevice.userAgentHash === userAgentHash;

    if (!tokenMatches || !userAgentMatches) {
      await prisma.loginTrustedDevice.update({
        where: { id: trustedDevice.id },
        data: { revokedAt: now },
      });
      if (parsedCookie) {
        clearTrustedDeviceCookie(res);
      }
      return { trusted: false };
    }

    await prisma.loginTrustedDevice.update({
      where: { id: trustedDevice.id },
      data: {
        lastUsedAt: now,
        ipAddress: req.ip,
        deviceInfo: getTrustedDeviceInfo(req),
      },
    });

    return { trusted: true, deviceId: trustedDevice.id };
  } catch (error) {
    if (isMissingTrustedDeviceTableError(error)) {
      logger.warn('Trusted-device table unavailable; requiring email verification', {
        userId: user.id,
      });
      return { trusted: false };
    }

    logger.warn('Trusted-device check failed; requiring email verification', {
      userId: user.id,
      error: error instanceof Error ? error.message : String(error),
    });
    return { trusted: false };
  }
};

const rememberLoginTrustedDevice = async (
  req: AuthRequest,
  res: Response,
  user: { id: string }
): Promise<RememberedTrustedDevice | undefined> => {
  const now = new Date();
  const deviceId = uuidv4();
  const token = crypto.randomBytes(TRUSTED_DEVICE_TOKEN_BYTES).toString('base64url');
  const trustedDeviceToken = `${deviceId}.${token}`;
  const expiresAt = new Date(now.getTime() + TRUSTED_DEVICE_COOKIE_MAX_AGE_SECONDS * 1000);
  const isMobileClient = isMobileTrustedDeviceClient(req);

  try {
    await prisma.loginTrustedDevice.create({
      data: {
        id: deviceId,
        userId: user.id,
        tokenHash: hashTrustedDeviceToken(deviceId, token),
        userAgentHash: isMobileClient ? null : hashTrustedDeviceUserAgent(req.get('user-agent')),
        deviceInfo: getTrustedDeviceInfo(req),
        ipAddress: req.ip,
        lastUsedAt: now,
        expiresAt,
      },
    });

    const trustedDeviceCount = await prisma.loginTrustedDevice.count({
      where: {
        userId: user.id,
        revokedAt: null,
        expiresAt: { gt: now },
      },
    });

    if (trustedDeviceCount > ORG_LOGIN_TRUSTED_DEVICE_MAX_PER_USER) {
      const devicesToRevoke = await prisma.loginTrustedDevice.findMany({
        where: {
          userId: user.id,
          revokedAt: null,
          expiresAt: { gt: now },
          id: { not: deviceId },
        },
        orderBy: [{ lastUsedAt: 'asc' }, { createdAt: 'asc' }],
        take: trustedDeviceCount - ORG_LOGIN_TRUSTED_DEVICE_MAX_PER_USER,
        select: { id: true },
      });

      if (devicesToRevoke.length > 0) {
        await prisma.loginTrustedDevice.updateMany({
          where: { id: { in: devicesToRevoke.map((device) => device.id) } },
          data: { revokedAt: now },
        });
      }
    }

    setTrustedDeviceCookie(
      res,
      trustedDeviceToken,
      TRUSTED_DEVICE_COOKIE_MAX_AGE_SECONDS
    );

    return { deviceId, trustedDeviceToken };
  } catch (error) {
    logger.warn('Unable to remember trusted device; login will continue without device trust', {
      userId: user.id,
      error: error instanceof Error ? error.message : String(error),
    });
    return undefined;
  }
};

const revokeLoginTrustedDevices = async (userId: string, revokedAt = new Date()): Promise<void> => {
  try {
    await prisma.loginTrustedDevice.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: { revokedAt },
    });
  } catch (error) {
    logger.warn('Unable to revoke trusted devices', {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

const issueFailedLoginAttempt = async (
  user: { id: string; loginAttempts: number }
): Promise<FailedLoginAttemptState> => {
  const loginAttempts = user.loginAttempts + 1;
  const lockoutDurationMs = resolveLockoutDurationMs(loginAttempts);
  const lockoutTier = resolveLockoutTier(loginAttempts);
  const shouldLockAccount = lockoutDurationMs > 0;
  const nextLockedUntil = shouldLockAccount
    ? new Date(Date.now() + lockoutDurationMs)
    : null;

  await prisma.user.update({
    where: { id: user.id },
    data: {
      loginAttempts,
      ...(shouldLockAccount ? { lockedUntil: nextLockedUntil } : {}),
    },
  });

  return {
    loginAttempts,
    lockoutDurationMs,
    lockoutTier,
    shouldLockAccount,
    nextLockedUntil,
  };
};

const isOrgLoginMfaChallengeRateLimited = async (
  user: { id: string; email: string }
): Promise<boolean> => {
  const windowStart = new Date(Date.now() - ORG_LOGIN_MFA_CHALLENGE_WINDOW_MINUTES * 60 * 1000);
  const recentChallenges = await prisma.mobileVerification.count({
    where: {
      userId: user.id,
      email: toOrgLoginMfaChallengeEmail(user.email),
      createdAt: { gte: windowStart },
    },
  });
  return recentChallenges >= ORG_LOGIN_MFA_CHALLENGE_MAX;
};

const sendOrgLoginMfaChallenge = async (
  user: { id: string; email: string; firstName?: string | null }
): Promise<boolean> => {
  const challengeEmail = toOrgLoginMfaChallengeEmail(user.email);
  await prisma.mobileVerification.updateMany({
    where: {
      userId: user.id,
      email: challengeEmail,
      used: false,
    },
    data: { used: true },
  });

  const code = crypto.randomInt(100000, 999999).toString();
  const codeHash = crypto.createHash('sha256').update(code).digest('hex');
  await prisma.mobileVerification.create({
    data: {
      id: uuidv4(),
      userId: user.id,
      email: challengeEmail,
      codeHash,
      expiresAt: new Date(Date.now() + LOGIN_MFA_CODE_TTL_MS),
    },
  });

  const greetingName = user.firstName || 'there';
  const emailResult = await sendEmailNotification({
    to: user.email,
    subject: `${code} — Your DashMet Verification Code`,
    body: `Hi ${greetingName}, your DashMet verification code is ${code}. It expires in 10 minutes.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px;">
        <h2 style="margin: 0 0 8px; color: #111827;">DashMet Sign-In Verification</h2>
        <p style="color: #374151;">Hi ${greetingName},</p>
        <p style="color: #374151;">Use this verification code to complete your sign in:</p>
        <div style="margin: 20px 0; text-align: center;">
          <span style="display: inline-block; background: #F3F4F6; border: 1px solid #E5E7EB; border-radius: 10px; padding: 12px 22px; font-size: 30px; font-weight: 700; letter-spacing: 5px; color: #111827;">
            ${code}
          </span>
        </div>
        <p style="color: #6B7280; margin-bottom: 0;">This code expires in 10 minutes. If you did not request this, secure your account immediately.</p>
      </div>
    `,
  });

  return Boolean(emailResult?.success);
};

const verifyOrgLoginMfaCode = async (
  user: { id: string; email: string },
  providedCode: string
): Promise<{ valid: boolean; attemptsRemaining: number }> => {
  const challengeEmail = toOrgLoginMfaChallengeEmail(user.email);
  const challenge = await prisma.mobileVerification.findFirst({
    where: {
      userId: user.id,
      email: challengeEmail,
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
      data: {
        attempts,
        used: attempts >= LOGIN_MFA_MAX_ATTEMPTS,
      },
    });
    return { valid: false, attemptsRemaining: Math.max(0, LOGIN_MFA_MAX_ATTEMPTS - attempts) };
  }

  await prisma.mobileVerification.update({
    where: { id: challenge.id },
    data: { used: true },
  });

  return { valid: true, attemptsRemaining: 0 };
};

async function sendAccountLockoutNotification(
  user: { email: string; firstName?: string | null },
  lockoutDurationMs: number
) {
  const readableDuration = formatLockoutDuration(lockoutDurationMs);
  const greetingName = user.firstName ? user.firstName : 'there';

  try {
    await sendEmailNotification({
      to: user.email,
      subject: 'DashMet account security alert',
      body: `Hi ${greetingName}, your DashMet account has been temporarily locked after repeated unsuccessful login attempts. The lock expires in approximately ${readableDuration}. If this was not you, reset your password immediately.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #1a1a2e;">Account Security Alert</h2>
          <p>Hi ${greetingName},</p>
          <p>Your DashMet account has been temporarily locked after repeated unsuccessful login attempts.</p>
          <p><strong>Lock duration:</strong> approximately ${readableDuration}</p>
          <p>If this was not you, we strongly recommend resetting your password immediately.</p>
        </div>
      `,
    });
  } catch (error) {
    logger.error('Failed to send lockout notification email', {
      email: user.email,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function handleSuspectedRefreshTokenReuse(
  req: AuthRequest,
  res: Response,
  context: RefreshReuseContext
) {
  await prisma.session.deleteMany({
    where: { userId: context.userId },
  });

  await revokeLoginTrustedDevices(context.userId);

  clearAuthCookies(res);
  clearTrustedDeviceCookie(res);

  logger.warn('Refresh token reuse suspected: revoked all sessions for user', {
    userId: context.userId,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });

  if (context.organizationId) {
    await logAuditEvent({
      action: 'UPDATE',
      entity: 'Session',
      entityId: context.userId,
      userId: context.userId,
      organizationId: context.organizationId,
      changes: {
        event: 'refresh_token_reuse_detected',
        actionTaken: 'all_sessions_revoked',
      },
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'],
    });
  }
}

async function logLoginAuditEvent(
  req: AuthRequest,
  user: { id: string; organizationId?: string | null },
  result: LoginAuditResult,
  options: {
    reason?: string;
    attemptCount?: number;
    maxAttempts?: number;
    lockedUntil?: Date | null;
    lockoutTier?: LockoutTier | null;
    lockoutDurationMs?: number;
    remainingLockoutSeconds?: number;
    mfaSatisfiedBy?: 'not_required' | 'email_otp' | 'trusted_device';
    trustedDeviceId?: string;
  } = {}
) {
  if (!user.organizationId) {
    return;
  }

  await logAuditEvent({
    action: 'LOGIN',
    entity: 'Session',
    entityId: user.id,
    userId: user.id,
    organizationId: user.organizationId,
    changes: {
      loginMethod: 'email_password',
      result,
      ...(options.reason ? { reason: options.reason } : {}),
      ...(typeof options.attemptCount === 'number' ? { attemptCount: options.attemptCount } : {}),
      ...(typeof options.maxAttempts === 'number' ? { maxAttempts: options.maxAttempts } : {}),
      ...(options.lockedUntil ? { lockedUntil: options.lockedUntil.toISOString() } : {}),
      ...(options.lockoutTier ? { lockoutTier: options.lockoutTier } : {}),
      ...(typeof options.lockoutDurationMs === 'number' ? { lockoutDurationMs: options.lockoutDurationMs } : {}),
      ...(typeof options.remainingLockoutSeconds === 'number'
        ? { remainingLockoutSeconds: options.remainingLockoutSeconds }
        : {}),
      ...(options.mfaSatisfiedBy ? { mfaSatisfiedBy: options.mfaSatisfiedBy } : {}),
      ...(options.trustedDeviceId ? { trustedDeviceId: options.trustedDeviceId } : {}),
    },
    ipAddress: getClientIp(req),
    userAgent: req.headers['user-agent'],
  });
}

// Phase 1.1: User Registration (with access code validation for admin roles)
export const register = async (req: AuthRequest, res: Response) => {
  const { email, password, firstName, lastName, organizationId, facilityId, role, accessCode } = req.body;

  // Validate required fields
  if (!email || !password || !firstName || !lastName || !organizationId || !role) {
    throw new ValidationError('Missing required fields');
  }

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    throw new ValidationError('Email already registered');
  }

  // Validate access code for admin roles
  if (role === 'ADMIN' || role === 'SYSTEM_ADMIN') {
    if (!accessCode) {
      throw new ValidationError('Access code is required for admin roles');
    }

    const validAccessCode = await prisma.accessCode.findFirst({
      where: {
        code: accessCode,
        role: role,
        isActive: true,
      },
    });

    if (!validAccessCode) {
      throw new ValidationError('Invalid access code for this role');
    }

    // Check if access code has reached max uses
    if (validAccessCode.usedCount >= validAccessCode.maxUses) {
      throw new ValidationError('Access code has reached maximum uses');
    }

    // Increment usage count
    await prisma.accessCode.update({
      where: { id: validAccessCode.id },
      data: { usedCount: { increment: 1 } },
    });
  }

  // Hash password
  const passwordPolicyError = assertPasswordPolicy(password, [email, firstName, lastName]);
  if (passwordPolicyError) {
    throw new ValidationError(passwordPolicyError);
  }

  const hashedPassword = await bcrypt.hash(
    password,
    parseInt(process.env.BCRYPT_ROUNDS || '12')
  );

  // Create user
  const user = await prisma.user.create({
    data: {
      id: uuidv4(),
      updatedAt: new Date(),
      email,
      password: hashedPassword,
      firstName,
      lastName,
      organizationId,
      role,
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      organizationId: true,
      theme: true,
      language: true,
      timezone: true,
    },
  });

  // Generate tokens
  const { accessToken, refreshToken } = generateTokens(user.id);

  // Create session
  await prisma.session.create({
    data: {
      id: uuidv4(),
      userId: user.id,
      token: accessToken,
      refreshToken,
      expiresAt: new Date(Date.now() + getIdleTimeoutMsForRole(user.role)),
      ipAddress: req.ip,
      deviceInfo: req.get('user-agent'),
    },
  });

  // Update last login
  await prisma.user.update({
    where: { id: user.id },
    data: {
      lastLoginAt: new Date(),
      lastLoginIp: req.ip,
    },
  });

  logger.info(`User registered: ${email}`);

  res.status(201).json({
    success: true,
    data: {
      user,
      token: accessToken,
      refreshToken,
    },
  });
};

// Phase 1.1: Email/Password Login
export const login = async (req: AuthRequest, res: Response) => {
  const email = String(req.body.email || '').toLowerCase().trim();
  const { password } = req.body;
  const mfaCode = String(req.body.mfaCode || '').trim();
  const rememberDevice = parseBooleanBodyValue(req.body.rememberDevice);
  const now = new Date();

  // Find user
  const user = await prisma.user.findUnique({
    where: { email },
  });

  const passwordHash = user?.password || DUMMY_PASSWORD_HASH;
  const isPasswordValid = await bcrypt.compare(password, passwordHash);

  if (!user || !user.password) {
    logger.warn('Login rejected: unknown or passwordless account', { email, ip: req.ip });
    throw new AuthenticationError(INVALID_CREDENTIALS_MESSAGE);
  }

  // SECURITY: System Admins must use the dedicated System Admin portal.
  if (user.role === 'SYSTEM_ADMIN') {
    logger.warn(`System Admin login attempt blocked on regular login: ${email}`);
    await logLoginAuditEvent(req, user, 'failed', {
      reason: 'system_admin_portal_required',
    });
    throw new AuthenticationError(INVALID_CREDENTIALS_MESSAGE);
  }

  // Check if account is locked
  if (user.lockedUntil && user.lockedUntil > now) {
    const remainingLockoutSeconds = Math.max(
      Math.ceil((user.lockedUntil.getTime() - now.getTime()) / 1000),
      0
    );
    logger.warn(`Locked account login attempt: ${email}`);
    await logLoginAuditEvent(req, user, 'failed', {
      reason: 'account_locked',
      attemptCount: user.loginAttempts,
      maxAttempts: MAX_LOGIN_ATTEMPTS,
      lockedUntil: user.lockedUntil,
      lockoutTier: resolveLockoutTier(user.loginAttempts),
      remainingLockoutSeconds,
    });
    throw new AuthenticationError(INVALID_CREDENTIALS_MESSAGE);
  }

  if (user.lockedUntil && user.lockedUntil <= now) {
    await prisma.user.update({
      where: { id: user.id },
      data: { lockedUntil: null },
    });

    if (user.organizationId) {
      await logAuditEvent({
        action: 'UPDATE',
        entity: 'User',
        entityId: user.id,
        userId: user.id,
        organizationId: user.organizationId,
        changes: {
          event: 'account_unlocked',
          trigger: 'cooldown_expired',
          loginAttempts: user.loginAttempts,
        },
        ipAddress: getClientIp(req),
        userAgent: req.headers['user-agent'],
      });
    }
  }

  // Check if account is active
  if (!user.isActive) {
    logger.warn(`Inactive account login attempt: ${email}`);
    await logLoginAuditEvent(req, user, 'failed', {
      reason: 'account_inactive',
    });
    throw new AuthenticationError(INVALID_CREDENTIALS_MESSAGE);
  }

  if (!isPasswordValid) {
    const failedAttempt = await issueFailedLoginAttempt(user);

    await logLoginAuditEvent(req, user, 'failed', {
      reason: failedAttempt.shouldLockAccount
        ? failedAttempt.lockoutTier === 'elevated'
          ? 'account_locked_escalated'
          : 'account_locked'
        : 'invalid_password',
      attemptCount: failedAttempt.loginAttempts,
      maxAttempts: MAX_LOGIN_ATTEMPTS,
      lockedUntil: failedAttempt.nextLockedUntil,
      lockoutTier: failedAttempt.lockoutTier,
      lockoutDurationMs: failedAttempt.lockoutDurationMs,
    });

    if (failedAttempt.shouldLockAccount) {
      logger.warn('Account lockout applied', {
        userId: user.id,
        email,
        loginAttempts: failedAttempt.loginAttempts,
        lockoutTier: failedAttempt.lockoutTier,
        lockoutDurationMs: failedAttempt.lockoutDurationMs,
        lockedUntil: failedAttempt.nextLockedUntil?.toISOString(),
      });

      void sendAccountLockoutNotification(
        { email: user.email, firstName: user.firstName },
        failedAttempt.lockoutDurationMs
      );
    }

    throw new AuthenticationError(INVALID_CREDENTIALS_MESSAGE);
  }

  const mfaRequired = shouldRequireOrgLoginMfa(user);
  const trustedDevice: TrustedDeviceVerification = mfaRequired
    ? await verifyLoginTrustedDevice(req, res, { id: user.id }, now)
    : { trusted: false };

  if (mfaRequired && !trustedDevice.trusted) {
    if (!mfaCode) {
      if (await isOrgLoginMfaChallengeRateLimited({ id: user.id, email: user.email })) {
        await logLoginAuditEvent(req, user, 'failed', {
          reason: 'mfa_challenge_rate_limited',
          attemptCount: user.loginAttempts,
          maxAttempts: MAX_LOGIN_ATTEMPTS,
        });
        res.status(429).json({
          success: false,
          error: 'Too many verification requests. Please try again later.',
          requiresMfa: true,
          mfaMethod: 'email_otp',
          rateLimited: true,
        });
        return;
      }

      const challengeSent = await sendOrgLoginMfaChallenge({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
      });

      if (!challengeSent) {
        logger.error('Failed to send org-login MFA challenge', { userId: user.id, email: user.email });
        await logLoginAuditEvent(req, user, 'failed', {
          reason: 'mfa_challenge_send_failed',
        });
        res.status(500).json({
          success: false,
          error: AUTH_UNAVAILABLE_MESSAGE,
        });
        return;
      }

      await logLoginAuditEvent(req, user, 'failed', {
        reason: 'mfa_challenge_issued',
      });

      res.status(200).json({
        success: false,
        requiresMfa: true,
        mfaMethod: 'email_otp',
        message: LOGIN_MFA_REQUIRED_EMAIL_OTP_MESSAGE,
      });
      return;
    }

    const verification = await verifyOrgLoginMfaCode(
      { id: user.id, email: user.email },
      mfaCode
    );

    if (!verification.valid) {
      const failedAttempt = await issueFailedLoginAttempt(user);
      await logLoginAuditEvent(req, user, 'failed', {
        reason: failedAttempt.shouldLockAccount
          ? failedAttempt.lockoutTier === 'elevated'
            ? 'mfa_code_invalid_account_locked_escalated'
            : 'mfa_code_invalid_account_locked'
          : 'mfa_code_invalid',
        attemptCount: failedAttempt.loginAttempts,
        maxAttempts: MAX_LOGIN_ATTEMPTS,
        lockedUntil: failedAttempt.nextLockedUntil,
        lockoutTier: failedAttempt.lockoutTier,
        lockoutDurationMs: failedAttempt.lockoutDurationMs,
      });

      if (failedAttempt.shouldLockAccount) {
        void sendAccountLockoutNotification(
          { email: user.email, firstName: user.firstName },
          failedAttempt.lockoutDurationMs
        );
      }

      res.status(401).json({
        success: false,
        error: 'Invalid verification code',
        requiresMfa: true,
        mfaMethod: 'email_otp',
        mfaAttemptsRemaining: verification.attemptsRemaining,
        locked: failedAttempt.shouldLockAccount,
        remainingMinutes: failedAttempt.shouldLockAccount
          ? Math.max(Math.ceil(failedAttempt.lockoutDurationMs / 60000), 1)
          : undefined,
      });
      return;
    }
  }

  // Reset login attempts
  await prisma.user.update({
    where: { id: user.id },
    data: {
      loginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
      lastLoginIp: req.ip,
    },
  });

  // Generate tokens
  const { accessToken, refreshToken } = generateTokens(user.id);

  // Create session
  await prisma.session.create({
    data: {
      id: uuidv4(),
      userId: user.id,
      token: hashToken(accessToken),
      refreshToken: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + getIdleTimeoutMsForRole(user.role)),
      ipAddress: req.ip,
      deviceInfo: req.get('user-agent'),
    },
  });

  logger.info(`User logged in: ${email}`);

  setAuthCookies(res, accessToken, refreshToken);

  const rememberedDevice =
    mfaRequired && !trustedDevice.trusted && rememberDevice
      ? await rememberLoginTrustedDevice(req, res, { id: user.id })
      : undefined;

  await logLoginAuditEvent(req, user, 'success', {
    mfaSatisfiedBy: !mfaRequired
      ? 'not_required'
      : trustedDevice.trusted
        ? 'trusted_device'
        : 'email_otp',
    trustedDeviceId: trustedDevice.deviceId || rememberedDevice?.deviceId,
  });

  res.json({
    success: true,
    requiresMfa: false,
    trustedDeviceUsed: trustedDevice.trusted,
    trustedDeviceRemembered: Boolean(rememberedDevice?.deviceId),
    data: {
      ...buildMobileSessionPayload(req, accessToken, refreshToken),
      trustedDeviceToken:
        rememberedDevice && isMobileTrustedDeviceClient(req)
          ? rememberedDevice.trustedDeviceToken
          : undefined,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        organizationId: user.organizationId,
        theme: user.theme,
        language: user.language,
        timezone: user.timezone,
      },
    },
  });
};

// Phase 1.1: Get Current User
export const getCurrentUser = async (req: AuthRequest, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      organizationId: true,
      profilePicture: true,
      phone: true,
      phoneChangeVerified: true,
      theme: true,
      language: true,
      timezone: true,
      defaultSiteId: true,
      defaultLineId: true,
      lastLoginAt: true,
      Organization: {
        select: { id: true, name: true },
      },
    },
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  let decryptedPhone: string | null = null;
  if (user.phone) {
    try {
      decryptedPhone = decrypt(user.phone);
    } catch {
      decryptedPhone = null;
    }
  }

  res.json({
    success: true,
    data: {
      user: {
        ...user,
        phone: decryptedPhone,
        organizationName: user.Organization?.name || null,
      },
    },
  });
};

// Update phone number with email OTP verification.
export const updatePhone = async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const userEmail = req.user!.email;
  const normalizedUserEmail = userEmail.toLowerCase().trim();
  const { phone, countryCode, verificationCode } = req.body;

  if (!phone || String(phone).trim() === '') {
    await prisma.user.update({
      where: { id: userId },
      data: { phone: null, phoneHash: null },
    });

    res.json({ success: true, data: { phone: null } });
    return;
  }

  const digits = String(phone).replace(/\D/g, '');
  const cc = String(countryCode || '1').replace(/\D/g, '');
  const e164Phone = `+${cc}${digits}`;

  if (digits.length < 10 || digits.length > 15) {
    throw new ValidationError('Phone number must be between 10 and 15 digits');
  }

  if (!verificationCode) {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentCount = await prisma.mobileVerification.count({
      where: { userId, email: normalizedUserEmail, createdAt: { gte: oneHourAgo } },
    });

    if (recentCount >= 3) {
      res.status(429).json({
        success: false,
        error: 'Too many verification requests. Please try again later.',
      });
      return;
    }

    await prisma.mobileVerification.updateMany({
      where: { userId, email: normalizedUserEmail, used: false },
      data: { used: true },
    });

    const code = crypto.randomInt(100000, 999999).toString();
    const codeHash = crypto.createHash('sha256').update(code).digest('hex');

    await prisma.mobileVerification.create({
      data: {
        id: uuidv4(),
        userId,
        email: normalizedUserEmail,
        codeHash,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    const sent = await sendVerificationEmail(userEmail, code, req.user!.firstName || 'there');
    if (!sent) {
      res.status(500).json({
        success: false,
        error: 'Failed to send verification email. Please try again.',
      });
      return;
    }

    res.json({
      success: true,
      data: { requiresVerification: true, message: 'Verification code sent to your email' },
    });
    return;
  }

  const codeHash = crypto.createHash('sha256').update(String(verificationCode)).digest('hex');
  const verification = await prisma.mobileVerification.findFirst({
    where: {
      userId,
      email: normalizedUserEmail,
      codeHash,
      used: false,
      expiresAt: { gt: new Date() },
    },
  });

  if (!verification) {
    const latest = await prisma.mobileVerification.findFirst({
      where: { userId, email: normalizedUserEmail, used: false },
      orderBy: { createdAt: 'desc' },
    });

    if (latest) {
      const newAttempts = latest.attempts + 1;
      await prisma.mobileVerification.update({
        where: { id: latest.id },
        data: { used: newAttempts >= 5, attempts: newAttempts },
      });

      if (newAttempts >= 5) {
        throw new ValidationError('Too many failed attempts. Please request a new code.');
      }
    }

    throw new ValidationError('Invalid or expired verification code');
  }

  await prisma.mobileVerification.update({
    where: { id: verification.id },
    data: { used: true },
  });

  const { encryptedPhone, phoneHash } = encryptPhone(digits, cc);
  const existing = await prisma.user.findFirst({
    where: { phoneHash, id: { not: userId } },
  });

  if (existing) {
    res.status(409).json({
      success: false,
      error: 'This phone number already belongs to another account. Please use a different phone number.',
    });
    return;
  }

  const currentUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { phoneHash: true, initialPhoneHash: true },
  });

  const isPhoneChanged = Boolean(currentUser?.initialPhoneHash && currentUser.initialPhoneHash !== phoneHash);

  await prisma.user.update({
    where: { id: userId },
    data: {
      phone: encryptedPhone,
      phoneHash,
      ...(!currentUser?.initialPhoneHash ? { initialPhoneHash: phoneHash } : {}),
      ...(isPhoneChanged ? { phoneChangeVerified: false } : {}),
    },
  });

  res.json({ success: true, data: { phone: e164Phone } });
};

// Phase 1.1: Logout
export const logout = async (req: AuthRequest, res: Response) => {
  const token = getAccessTokenFromRequest(req);

  if (token) {
    // Delete session
    await prisma.session.deleteMany({
      where: { token: hashToken(token) },
    });
  }

  clearAuthCookies(res);

  // Audit log: User logout
  await logAuditFromRequest(req, 'LOGOUT', 'Session', req.user!.id);

  logger.info(`User logged out: ${req.user!.email}`);

  res.json({
    success: true,
    message: 'Logged out successfully',
  });
};

// Phase 1.1: Refresh Token
export const refreshToken = async (req: AuthRequest, res: Response) => {
  const oldRefreshToken = getRefreshTokenFromRequest(req);

  if (!oldRefreshToken) {
    logger.warn('Refresh token request rejected: missing token', { ip: req.ip });
    throw new AuthenticationError(AUTH_REQUIRED_MESSAGE);
  }

  // Verify refresh token
  let decoded: any;
  try {
    decoded = jwt.verify(oldRefreshToken, process.env.JWT_REFRESH_SECRET!);
  } catch (error) {
    logger.warn('Refresh token request rejected: invalid token signature', { ip: req.ip });
    throw new AuthenticationError(AUTH_REQUIRED_MESSAGE);
  }

  // Find session
  const session = await prisma.session.findFirst({
    where: {
      refreshToken: hashToken(oldRefreshToken),
      userId: decoded.userId,
    },
  });

  const now = new Date();

  if (!session) {
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        organizationId: true,
      },
    });

    if (user) {
      await handleSuspectedRefreshTokenReuse(req, res, {
        userId: user.id,
        organizationId: user.organizationId,
      });
    }

    clearAuthCookies(res);

    logger.warn('Refresh token request rejected: session not found for token hash', {
      ip: req.ip,
      userId: decoded?.userId,
    });
    throw new AuthenticationError(AUTH_REQUIRED_MESSAGE);
  }

  if (session.expiresAt < now) {
    await prisma.session.deleteMany({
      where: { id: session.id },
    });

    logger.warn('Refresh token request rejected: session missing/expired', {
      ip: req.ip,
      userId: decoded?.userId,
    });
    clearAuthCookies(res);
    throw new AuthenticationError(AUTH_REQUIRED_MESSAGE);
  }

  const user = await prisma.user.findUnique({
    where: { id: decoded.userId },
    select: {
      id: true,
      role: true,
      isActive: true,
    },
  });

  if (!user || !user.isActive) {
    await prisma.session.deleteMany({
      where: { id: session.id },
    });
    clearAuthCookies(res);
    throw new AuthenticationError(AUTH_REQUIRED_MESSAGE);
  }

  if (isSessionAbsoluteExpired(session.createdAt, user.role, now)) {
    await prisma.session.deleteMany({
      where: { id: session.id },
    });
    clearAuthCookies(res);
    logger.warn('Refresh token request rejected: session absolute lifetime reached', {
      ip: req.ip,
      userId: decoded?.userId,
      role: user.role,
    });
    throw new AuthenticationError(AUTH_REQUIRED_MESSAGE);
  }

  // Generate new tokens
  const { accessToken, refreshToken: newRefreshToken } = generateTokens(decoded.userId);

  // Update session
  await prisma.session.update({
    where: { id: session.id },
    data: {
      token: hashToken(accessToken),
      refreshToken: hashToken(newRefreshToken),
      expiresAt: new Date(Date.now() + getIdleTimeoutMsForRole(user.role)),
    },
  });

  setAuthCookies(res, accessToken, newRefreshToken);

  res.json({
    success: true,
    data: buildMobileSessionPayload(req, accessToken, newRefreshToken),
  });
};

// Phase 1.1: Forgot Password
export const forgotPassword = async (req: AuthRequest, res: Response) => {
  const email = String(req.body.email || '').toLowerCase().trim();

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    // Don't reveal if user exists
    res.json({
      success: true,
      message: 'If the email exists, a password reset link will be sent.',
    });
    return;
  }

  // Generate reset token. Store only its hash so a database leak does not
  // expose usable reset links.
  const resetToken = crypto.randomBytes(32).toString('hex');
  const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordResetToken: hashToken(resetToken),
      passwordResetExpires: resetExpires,
    },
  });

  const frontendUrl = process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3000';
  const resetLink = `${frontendUrl}/reset-password?token=${encodeURIComponent(resetToken)}`;

  try {
    await sendEmailNotification({
      to: user.email,
      subject: 'Reset your DashMet password',
      body: `A password reset was requested for your DashMet account. Reset your password here: ${resetLink}. This link expires in 1 hour. If you did not request this, you can ignore this email.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #1a1a2e;">Reset your DashMet password</h2>
          <p>A password reset was requested for your account.</p>
          <p>Click the button below to choose a new password. This link expires in <strong>1 hour</strong>.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetLink}" style="background-color: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold;">
              Reset Password
            </a>
          </div>
          <p style="color: #666; font-size: 14px;">If you did not request this, you can safely ignore this email.</p>
        </div>
      `,
    });
  } catch (error) {
    logger.error('Password reset email dispatch failed', {
      email,
      error: error instanceof Error ? error.message : String(error),
    });
    // Keep response generic and successful to avoid account enumeration signals.
  }
  
  logger.info(`Password reset requested for: ${email}`);

  res.json({
    success: true,
    message: 'If the email exists, a password reset link will be sent.',
    ...(process.env.NODE_ENV === 'development' && { resetToken }),
  });
};

// Phase 1.1: Reset Password
export const resetPassword = async (req: AuthRequest, res: Response) => {
  const { token, newPassword } = req.body;
  const resetTokenHash = token ? hashToken(String(token)) : '';

  const user = await prisma.user.findFirst({
    where: {
      passwordResetToken: resetTokenHash,
      passwordResetExpires: {
        gt: new Date(),
      },
    },
  });

  if (!user) {
    logger.warn('Password reset rejected: invalid or expired token', {
      ip: req.ip,
    });
    throw new ValidationError(PASSWORD_RESET_FAILED_MESSAGE);
  }

  const passwordPolicyError = assertPasswordPolicy(newPassword, [
    user.email,
    user.firstName,
    user.lastName,
  ]);
  if (passwordPolicyError) {
    throw new ValidationError(passwordPolicyError);
  }

  // Hash new password
  const hashedPassword = await bcrypt.hash(
    newPassword,
    parseInt(process.env.BCRYPT_ROUNDS || '12')
  );

  // Update password and clear reset token
  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: hashedPassword,
      passwordResetToken: null,
      passwordResetExpires: null,
      loginAttempts: 0,
      lockedUntil: null,
    },
  });

  // Invalidate all sessions
  await prisma.session.deleteMany({
    where: { userId: user.id },
  });

  await revokeLoginTrustedDevices(user.id);

  clearTrustedDeviceCookie(res);

  logger.info(`Password reset completed for: ${user.email}`);

  res.json({
    success: true,
    message: 'Password reset successfully. Please login with your new password.',
  });
};

// Change Password (for authenticated users)
export const changePassword = async (req: AuthRequest, res: Response) => {
  const { currentPassword, newPassword, confirmPassword } = req.body;
  const userId = req.user?.id;

  if (!userId) {
    throw new AuthenticationError(AUTH_REQUIRED_MESSAGE);
  }

  // Validate required fields
  if (!currentPassword || !newPassword || !confirmPassword) {
    throw new ValidationError('All fields are required');
  }

  // Validate password confirmation
  if (newPassword !== confirmPassword) {
    throw new ValidationError('New passwords do not match');
  }

  // Get user with current password
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user || !user.password) {
    logger.warn('Change password rejected: authenticated user missing password record', {
      userId,
      ip: req.ip,
    });
    throw new ValidationError(PASSWORD_UPDATE_FAILED_MESSAGE);
  }

  // Verify current password
  const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);

  if (!isCurrentPasswordValid) {
    logger.warn('Change password rejected: current password mismatch', {
      userId,
      ip: req.ip,
    });
    throw new ValidationError(PASSWORD_UPDATE_FAILED_MESSAGE);
  }

  const passwordPolicyError = assertPasswordPolicy(newPassword, [
    user.email,
    user.firstName,
    user.lastName,
  ]);
  if (passwordPolicyError) {
    throw new ValidationError(passwordPolicyError);
  }

  // Check if new password is same as current
  const isSamePassword = await bcrypt.compare(newPassword, user.password);
  if (isSamePassword) {
    throw new ValidationError('New password must be different from current password');
  }

  // Hash new password
  const hashedPassword = await bcrypt.hash(
    newPassword,
    parseInt(process.env.BCRYPT_ROUNDS || '12')
  );

  // Update password
  await prisma.user.update({
    where: { id: userId },
    data: {
      password: hashedPassword,
      loginAttempts: 0,
      lockedUntil: null,
    },
  });

  const currentToken = getAccessTokenFromRequest(req);
  const currentTokenHash = currentToken ? hashToken(currentToken) : null;

  await prisma.session.deleteMany({
    where: {
      userId,
      ...(currentTokenHash ? { token: { not: currentTokenHash } } : {}),
    },
  });

  await revokeLoginTrustedDevices(userId);

  clearTrustedDeviceCookie(res);

  logger.info(`Password changed for user: ${user.email}`);

  res.json({
    success: true,
    message: 'Password changed successfully',
  });
};

// Verify Password (for secure actions like submission)
export const verifyPassword = async (req: AuthRequest, res: Response) => {
  const { password } = req.body;
  const userId = req.user?.id;

  if (!userId) {
    throw new AuthenticationError(AUTH_REQUIRED_MESSAGE);
  }

  if (!password) {
    throw new ValidationError('Password is required');
  }

  // Get user with current password
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user || !user.password) {
    logger.warn('Verify password rejected: user missing password record', {
      userId,
      ip: req.ip,
    });
    throw new AuthenticationError(AUTH_REQUIRED_MESSAGE);
  }

  // Verify password
  const isPasswordValid = await bcrypt.compare(password, user.password);

  if (!isPasswordValid) {
    logger.warn(`Password verification failed for user: ${user.email}`);
    res.status(401).json({
      success: false,
      error: 'Unable to verify credentials',
    });
    return;
  }

  logger.info(`Password verified for user: ${user.email}`);

  res.json({
    success: true,
    message: 'Password verified successfully',
  });
};

// Get Active Sessions
export const getActiveSessions = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const currentToken = getAccessTokenFromRequest(req);
  const currentTokenHash = currentToken ? hashToken(currentToken) : undefined;

  if (!userId) {
    throw new AuthenticationError(AUTH_REQUIRED_MESSAGE);
  }

  const sessions = await prisma.session.findMany({
    where: {
      userId,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      deviceInfo: true,
      ipAddress: true,
      createdAt: true,
      expiresAt: true,
      token: true,
    },
  });

  // Mark current session
  const sessionsWithCurrent = sessions.map((session) => ({
    id: session.id,
    deviceInfo: session.deviceInfo,
    ipAddress: session.ipAddress,
    createdAt: session.createdAt,
    expiresAt: session.expiresAt,
    isCurrent: session.token === currentTokenHash,
  }));

  res.json({
    success: true,
    data: { sessions: sessionsWithCurrent },
  });
};

// Revoke a specific session
export const revokeSession = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const { sessionId } = req.params;
  const currentToken = getAccessTokenFromRequest(req);
  const currentTokenHash = currentToken ? hashToken(currentToken) : undefined;

  if (!userId) {
    throw new AuthenticationError(AUTH_REQUIRED_MESSAGE);
  }

  // Find the session
  const session = await prisma.session.findFirst({
    where: {
      id: sessionId,
      userId,
    },
  });

  if (!session) {
    throw new NotFoundError('Session not found');
  }

  // Prevent revoking current session
  if (session.token === currentTokenHash) {
    throw new ValidationError('Cannot revoke current session. Use logout instead.');
  }

  // Delete the session
  await prisma.session.delete({
    where: { id: sessionId },
  });

  logger.info(`Session revoked for user: ${req.user?.email}, session: ${sessionId}`);

  res.json({
    success: true,
    message: 'Session revoked successfully',
  });
};

// Revoke all other sessions
export const revokeAllOtherSessions = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const currentToken = getAccessTokenFromRequest(req);
  const currentTokenHash = currentToken ? hashToken(currentToken) : '';

  if (!userId) {
    throw new AuthenticationError(AUTH_REQUIRED_MESSAGE);
  }

  // Delete all sessions except current
  const result = await prisma.session.deleteMany({
    where: {
      userId,
      token: { not: currentTokenHash },
    },
  });

  logger.info(`All other sessions revoked for user: ${req.user?.email}, count: ${result.count}`);

  res.json({
    success: true,
    message: `${result.count} session(s) revoked successfully`,
    data: { revokedCount: result.count },
  });
};
