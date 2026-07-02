import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../utils/prisma';
import { adminAuth } from '../config/firebase-admin';
import { encrypt, hmacHash, phoneHashVariants } from '../utils/encryption';
import { hashToken, setAuthCookies } from '../utils/sessionCookies';
import { getIdleTimeoutMsForRole } from '../utils/sessionPolicy';
import { sendVerificationEmail } from '../services/emailService';
import { getClientIp, logAuditEvent } from '../services/auditService';
import { logger } from '../utils/logger';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const OTP_RATE_LIMIT_COUNT = 3;
const MAX_OTP_ATTEMPTS = 5;
const WEB_HANDOFF_TTL_MS = 2 * 60 * 1000;

type FirebaseIdentity = {
  uid: string;
  phoneNumber: string | null;
  email: string | null;
};

type MobileSessionUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  organizationId: string | null;
  theme: string;
  language: string;
  timezone: string;
  firebaseUid: string | null;
  phoneHash: string | null;
  isActive: boolean;
  loginAttempts: number;
  lockedUntil: Date | null;
};

const genericEmailVerificationMessage =
  'If the email belongs to an active DashMet account, a verification code has been sent.';

const normalizeEmail = (email: unknown): string =>
  String(email || '').trim().toLowerCase();

const normalizeFirebasePhone = (phoneNumber: string | null | undefined): string | null => {
  const normalized = String(phoneNumber || '').replace(/[\s\-()]/g, '').trim();
  if (!normalized) return null;
  return normalized.startsWith('+') ? normalized : `+${normalized}`;
};

const sha256 = (value: string): string =>
  crypto.createHash('sha256').update(value).digest('hex');

const constantTimeHashEquals = (left: string, right: string): boolean => {
  const leftBuffer = Buffer.from(left, 'hex');
  const rightBuffer = Buffer.from(right, 'hex');
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
};

const smallEnumerationDelay = () =>
  new Promise((resolve) => setTimeout(resolve, 200 + Math.floor(Math.random() * 300)));

const getBearerToken = (req: Request): string | null => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  const token = header.slice('Bearer '.length).trim();
  return token || null;
};

const verifyFirebaseIdentity = async (req: Request): Promise<FirebaseIdentity | null> => {
  const token = getBearerToken(req);
  if (!token) return null;

  const decodedToken = await adminAuth.verifyIdToken(token, true);
  return {
    uid: decodedToken.uid,
    phoneNumber: normalizeFirebasePhone(decodedToken.phone_number),
    email: normalizeEmail(decodedToken.email) || null,
  };
};

const selectMobileSessionUser = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  role: true,
  organizationId: true,
  theme: true,
  language: true,
  timezone: true,
  firebaseUid: true,
  phoneHash: true,
  isActive: true,
  loginAttempts: true,
  lockedUntil: true,
};

const findUserForFirebaseIdentity = async (
  identity: FirebaseIdentity
): Promise<MobileSessionUser | null> => {
  const linkedUser = await prisma.user.findFirst({
    where: {
      firebaseUid: identity.uid,
      isActive: true,
    },
    select: selectMobileSessionUser,
  });

  if (linkedUser) return linkedUser;

  if (!identity.phoneNumber) return null;

  return prisma.user.findFirst({
    where: {
      phoneHash: { in: phoneHashVariants(identity.phoneNumber) },
      isActive: true,
    },
    select: selectMobileSessionUser,
  });
};

const assertAccountCanStartMobileSession = (user: MobileSessionUser): string | null => {
  if (!user.isActive) return 'Account is inactive';
  if (user.loginAttempts >= 5 && user.lockedUntil && user.lockedUntil > new Date()) {
    return 'Account is temporarily locked';
  }
  return null;
};

const assertFirebaseUidCanAttach = async (userId: string, firebaseUid: string): Promise<boolean> => {
  const existingFirebaseUser = await prisma.user.findFirst({
    where: {
      firebaseUid,
      id: { not: userId },
    },
    select: { id: true },
  });

  return !existingFirebaseUser;
};

const assertPhoneCanAttach = async (
  userId: string,
  phoneHash: string
): Promise<boolean> => {
  const existingPhoneUser = await prisma.user.findFirst({
    where: {
      phoneHash,
      id: { not: userId },
    },
    select: { id: true },
  });

  return !existingPhoneUser;
};

const linkFirebaseIdentityToUser = async (
  user: MobileSessionUser,
  identity: FirebaseIdentity
) => {
  if (user.firebaseUid && user.firebaseUid !== identity.uid) {
    throw new Error('Firebase identity is linked to another account');
  }

  const canAttachFirebaseUid = await assertFirebaseUidCanAttach(user.id, identity.uid);
  if (!canAttachFirebaseUid) {
    throw new Error('Firebase identity is linked to another account');
  }

  const updateData: Record<string, unknown> = {
    firebaseUid: identity.uid,
    lastLoginAt: new Date(),
  };

  if (identity.phoneNumber) {
    const phoneHash = hmacHash(identity.phoneNumber);
    const canAttachPhone = await assertPhoneCanAttach(user.id, phoneHash);
    if (!canAttachPhone) {
      throw new Error('Phone number is linked to another account');
    }

    updateData.phone = encrypt(identity.phoneNumber);
    updateData.phoneHash = phoneHash;
    updateData.phoneVerified = true;
    updateData.phoneChangeVerified = true;
    if (!user.phoneHash) {
      updateData.initialPhoneHash = phoneHash;
    }
  }

  return prisma.user.update({
    where: { id: user.id },
    data: updateData,
    select: selectMobileSessionUser,
  });
};

const generateSessionTokens = (userId: string) => {
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

const createMobileSession = async (req: Request, user: MobileSessionUser) => {
  const { accessToken, refreshToken } = generateSessionTokens(user.id);

  await prisma.session.create({
    data: {
      id: uuidv4(),
      userId: user.id,
      token: hashToken(accessToken),
      refreshToken: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + getIdleTimeoutMsForRole(user.role)),
      ipAddress: req.ip,
      deviceInfo: String(req.get('user-agent') || 'DashMet native mobile').slice(0, 512),
    },
  });

  await prisma.user.update({
    where: { id: user.id },
    data: {
      loginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
      lastLoginIp: req.ip,
    },
  });

  await logAuditEvent({
    action: 'LOGIN',
    entity: 'Session',
    entityId: user.id,
    userId: user.id,
    organizationId: user.organizationId || undefined,
    changes: {
      loginMethod: 'firebase_phone',
      result: 'success',
    },
    ipAddress: getClientIp(req),
    userAgent: req.headers['user-agent'],
  });

  return {
    accessToken,
    refreshToken,
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
  };
};

router.post('/firebase', async (req: Request, res: Response) => {
  try {
    const identity = await verifyFirebaseIdentity(req);
    if (!identity) {
      return res.status(401).json({ success: false, error: 'Firebase authentication required' });
    }

    const user = await findUserForFirebaseIdentity(identity);
    if (!user) {
      await smallEnumerationDelay();
      return res.status(202).json({
        success: true,
        requiresEmailVerification: true,
        message: 'Verify your DashMet account email to link this phone.',
      });
    }

    const accountBlockReason = assertAccountCanStartMobileSession(user);
    if (accountBlockReason) {
      return res.status(403).json({ success: false, error: accountBlockReason });
    }

    const linkedUser = await linkFirebaseIdentityToUser(user, identity);
    const session = await createMobileSession(req, linkedUser);

    return res.json({
      success: true,
      requiresEmailVerification: false,
      data: session,
    });
  } catch (error: any) {
    logger.warn('Mobile Firebase session failed', {
      code: error?.code || 'unknown',
      message: error?.message || 'unknown',
      ip: req.ip,
    });
    return res.status(401).json({ success: false, error: 'Unable to start mobile session' });
  }
});

router.post('/email-link/start', async (req: Request, res: Response) => {
  try {
    const identity = await verifyFirebaseIdentity(req);
    if (!identity?.phoneNumber) {
      return res.status(401).json({ success: false, error: 'Verified phone authentication required' });
    }

    const email = normalizeEmail(req.body?.email);
    if (!email) {
      return res.status(400).json({ success: false, error: 'Email is required' });
    }

    const user = await prisma.user.findFirst({
      where: { email, isActive: true },
      select: {
        ...selectMobileSessionUser,
        phoneVerified: true,
      },
    });

    if (!user) {
      await smallEnumerationDelay();
      return res.json({ success: true, message: genericEmailVerificationMessage });
    }

    if (user.firebaseUid && user.firebaseUid !== identity.uid) {
      await smallEnumerationDelay();
      return res.json({ success: true, message: genericEmailVerificationMessage });
    }

    const canAttachFirebaseUid = await assertFirebaseUidCanAttach(user.id, identity.uid);
    const phoneHash = hmacHash(identity.phoneNumber);
    const canAttachPhone = await assertPhoneCanAttach(user.id, phoneHash);
    if (!canAttachFirebaseUid || !canAttachPhone) {
      await smallEnumerationDelay();
      return res.json({ success: true, message: genericEmailVerificationMessage });
    }

    const recentCount = await prisma.mobileVerification.count({
      where: {
        userId: user.id,
        createdAt: { gte: new Date(Date.now() - OTP_RATE_LIMIT_WINDOW_MS) },
      },
    });
    if (recentCount >= OTP_RATE_LIMIT_COUNT) {
      return res.status(429).json({
        success: false,
        error: 'Too many verification requests. Please try again later.',
      });
    }

    await prisma.mobileVerification.updateMany({
      where: { userId: user.id, used: false },
      data: { used: true },
    });

    const code = crypto.randomInt(100000, 999999).toString();
    await prisma.mobileVerification.create({
      data: {
        id: uuidv4(),
        userId: user.id,
        email,
        codeHash: sha256(code),
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
      },
    });

    const sent = await sendVerificationEmail(email, code, user.firstName || 'there');
    if (!sent) {
      logger.warn('Mobile email link OTP could not be sent', { userId: user.id, email });
    }

    return res.json({ success: true, message: genericEmailVerificationMessage });
  } catch (error: any) {
    logger.warn('Mobile email link start failed', {
      code: error?.code || 'unknown',
      message: error?.message || 'unknown',
      ip: req.ip,
    });
    return res.status(500).json({ success: false, error: 'Unable to start email verification' });
  }
});

router.post('/email-link/verify', async (req: Request, res: Response) => {
  try {
    const identity = await verifyFirebaseIdentity(req);
    if (!identity?.phoneNumber) {
      return res.status(401).json({ success: false, error: 'Verified phone authentication required' });
    }

    const email = normalizeEmail(req.body?.email);
    const code = String(req.body?.code || '').replace(/\D/g, '');
    if (!email || !/^\d{6}$/.test(code)) {
      return res.status(400).json({ success: false, error: 'Valid email and 6-digit code are required' });
    }

    const user = await prisma.user.findFirst({
      where: { email, isActive: true },
      select: selectMobileSessionUser,
    });
    if (!user || (user.firebaseUid && user.firebaseUid !== identity.uid)) {
      await smallEnumerationDelay();
      return res.status(400).json({ success: false, error: 'Invalid verification request' });
    }

    const verification = await prisma.mobileVerification.findFirst({
      where: {
        userId: user.id,
        email,
        used: false,
        expiresAt: { gte: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!verification) {
      return res.status(400).json({
        success: false,
        error: 'No active verification code. Please request a new one.',
      });
    }

    if (verification.attempts >= MAX_OTP_ATTEMPTS) {
      await prisma.mobileVerification.update({
        where: { id: verification.id },
        data: { used: true },
      });
      return res.status(429).json({
        success: false,
        error: 'Too many attempts. Please request a new verification code.',
      });
    }

    await prisma.mobileVerification.update({
      where: { id: verification.id },
      data: { attempts: { increment: 1 } },
    });

    if (!constantTimeHashEquals(sha256(code), verification.codeHash)) {
      return res.status(400).json({ success: false, error: 'Invalid verification code' });
    }

    await prisma.mobileVerification.update({
      where: { id: verification.id },
      data: { used: true },
    });

    const accountBlockReason = assertAccountCanStartMobileSession(user);
    if (accountBlockReason) {
      return res.status(403).json({ success: false, error: accountBlockReason });
    }

    const linkedUser = await linkFirebaseIdentityToUser(user, identity);
    const session = await createMobileSession(req, linkedUser);

    return res.json({
      success: true,
      message: 'Phone linked successfully',
      data: session,
    });
  } catch (error: any) {
    logger.warn('Mobile email link verify failed', {
      code: error?.code || 'unknown',
      message: error?.message || 'unknown',
      ip: req.ip,
    });
    return res.status(400).json({ success: false, error: 'Unable to verify email code' });
  }
});

router.post('/web-handoff', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const now = new Date();
    await prisma.mobileWebHandoff.deleteMany({
      where: {
        userId: req.user.id,
        OR: [
          { expiresAt: { lt: now } },
          { usedAt: { not: null } },
        ],
      },
    });

    const code = crypto.randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + WEB_HANDOFF_TTL_MS);

    await prisma.mobileWebHandoff.create({
      data: {
        id: uuidv4(),
        userId: req.user.id,
        codeHash: sha256(code),
        expiresAt,
        ipAddress: getClientIp(req),
        userAgent: String(req.headers['user-agent'] || 'DashMet native mobile').slice(0, 512),
      },
    });

    res.set('Cache-Control', 'no-store');
    return res.json({
      success: true,
      data: {
        code,
        expiresAt: expiresAt.toISOString(),
      },
    });
  } catch (error: any) {
    logger.warn('Mobile web handoff creation failed', {
      userId: req.user?.id,
      message: error?.message || 'unknown',
      ip: req.ip,
    });
    return res.status(500).json({ success: false, error: 'Unable to prepare mobile web session' });
  }
});

router.post('/web-handoff/redeem', async (req: Request, res: Response) => {
  try {
    const appHeader = String(req.header('x-dashmet-mobile-app') || '').trim().toLowerCase();
    if (appHeader !== 'rca-mobile') {
      return res.status(400).json({ success: false, error: 'Invalid mobile handoff request' });
    }

    const code = String(req.body?.code || '').trim();
    if (!/^[A-Za-z0-9_-]{32,}$/.test(code)) {
      return res.status(400).json({ success: false, error: 'Invalid mobile handoff code' });
    }

    const now = new Date();
    const codeHash = sha256(code);

    const result = await prisma.$transaction(async (tx) => {
      const handoff = await tx.mobileWebHandoff.findUnique({
        where: { codeHash },
        select: {
          id: true,
          expiresAt: true,
          usedAt: true,
          user: {
            select: selectMobileSessionUser,
          },
        },
      });

      if (!handoff || handoff.usedAt || handoff.expiresAt <= now) {
        throw new Error('INVALID_HANDOFF');
      }

      const accountBlockReason = assertAccountCanStartMobileSession(handoff.user);
      if (accountBlockReason) {
        throw new Error(accountBlockReason);
      }

      const consumed = await tx.mobileWebHandoff.updateMany({
        where: {
          id: handoff.id,
          usedAt: null,
          expiresAt: { gt: now },
        },
        data: { usedAt: now },
      });

      if (consumed.count !== 1) {
        throw new Error('INVALID_HANDOFF');
      }

      const { accessToken, refreshToken } = generateSessionTokens(handoff.user.id);
      await tx.session.create({
        data: {
          id: uuidv4(),
          userId: handoff.user.id,
          token: hashToken(accessToken),
          refreshToken: hashToken(refreshToken),
          expiresAt: new Date(Date.now() + getIdleTimeoutMsForRole(handoff.user.role)),
          ipAddress: req.ip,
          deviceInfo: String(req.get('user-agent') || 'DashMet native web handoff').slice(0, 512),
        },
      });

      await tx.user.update({
        where: { id: handoff.user.id },
        data: {
          loginAttempts: 0,
          lockedUntil: null,
          lastLoginAt: new Date(),
          lastLoginIp: req.ip,
        },
      });

      return {
        accessToken,
        refreshToken,
        user: handoff.user,
      };
    });

    await logAuditEvent({
      action: 'LOGIN',
      entity: 'Session',
      entityId: result.user.id,
      userId: result.user.id,
      organizationId: result.user.organizationId || undefined,
      changes: {
        loginMethod: 'native_mobile_web_handoff',
        result: 'success',
      },
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'],
    });

    setAuthCookies(res, result.accessToken, result.refreshToken);
    res.set('Cache-Control', 'no-store');
    return res.json({
      success: true,
      data: {
        user: {
          id: result.user.id,
          email: result.user.email,
          firstName: result.user.firstName,
          lastName: result.user.lastName,
          role: result.user.role,
          organizationId: result.user.organizationId,
          theme: result.user.theme,
          language: result.user.language,
          timezone: result.user.timezone,
        },
      },
    });
  } catch (error: any) {
    logger.warn('Mobile web handoff redemption failed', {
      code: error?.message || 'unknown',
      ip: req.ip,
    });
    return res.status(401).json({
      success: false,
      error: 'Mobile handoff expired or already used. Please sign in again.',
    });
  }
});

export default router;
