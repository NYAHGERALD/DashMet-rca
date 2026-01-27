/**
 * Public System Admin Authentication Routes
 * These routes do NOT require authentication - they are used to verify
 * credentials before login
 */
import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { adminAuth } from '../config/firebase-admin';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

const router = Router();
const prisma = new PrismaClient();

// In-memory lockout tracking (in production, use Redis)
const loginAttempts: Map<string, { count: number; lastAttempt: Date; lockedUntil?: Date }> = new Map();
const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_DURATION_MINUTES = 15;

// Helper to check if account is locked
function isAccountLocked(identifier: string): { locked: boolean; remainingMinutes?: number } {
  const attempts = loginAttempts.get(identifier);
  if (!attempts || !attempts.lockedUntil) return { locked: false };
  
  const now = new Date();
  if (now >= attempts.lockedUntil) {
    loginAttempts.delete(identifier);
    return { locked: false };
  }
  
  const remainingMs = attempts.lockedUntil.getTime() - now.getTime();
  return { locked: true, remainingMinutes: Math.ceil(remainingMs / 60000) };
}

// Helper to record failed attempt
function recordFailedAttempt(identifier: string): { isNowLocked: boolean; attemptsRemaining: number } {
  const attempts = loginAttempts.get(identifier) || { count: 0, lastAttempt: new Date() };
  attempts.count += 1;
  attempts.lastAttempt = new Date();
  
  if (attempts.count >= LOCKOUT_THRESHOLD) {
    attempts.lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MINUTES * 60 * 1000);
    loginAttempts.set(identifier, attempts);
    return { isNowLocked: true, attemptsRemaining: 0 };
  }
  
  loginAttempts.set(identifier, attempts);
  return { isNowLocked: false, attemptsRemaining: LOCKOUT_THRESHOLD - attempts.count };
}

// Helper to clear attempts on successful login
function clearAttempts(identifier: string): void {
  loginAttempts.delete(identifier);
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

// Verify master key matches environment variable - PUBLIC endpoint
router.post('/verify-master-key', async (req: Request, res: Response) => {
  try {
    const { masterKey, email } = req.body;
    const ipAddress = req.headers['x-forwarded-for']?.toString() || req.socket.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    const identifier = `${email}:${ipAddress}`;

    // Check lockout
    const lockoutStatus = isAccountLocked(identifier);
    if (lockoutStatus.locked) {
      await logSecurityEvent('VERIFY_MASTER_KEY_LOCKED', email, false, ipAddress, userAgent, {
        remainingMinutes: lockoutStatus.remainingMinutes,
      });
      return res.status(429).json({
        success: false,
        error: `Account temporarily locked. Try again in ${lockoutStatus.remainingMinutes} minutes.`,
        locked: true,
        remainingMinutes: lockoutStatus.remainingMinutes,
      });
    }

    const systemMasterKey = process.env.SYSTEM_ADMIN_MASTER_KEY;
    
    if (!systemMasterKey) {
      console.error('SYSTEM_ADMIN_MASTER_KEY not configured');
      return res.status(500).json({
        success: false,
        error: 'System configuration error. Contact support.',
      });
    }

    // Constant-time comparison to prevent timing attacks
    const masterKeyBuffer = Buffer.from(masterKey || '');
    const systemKeyBuffer = Buffer.from(systemMasterKey);
    
    const isValid = masterKeyBuffer.length === systemKeyBuffer.length && 
                   crypto.timingSafeEqual(masterKeyBuffer, systemKeyBuffer);

    if (!isValid) {
      const attemptResult = recordFailedAttempt(identifier);
      await logSecurityEvent('VERIFY_MASTER_KEY_FAILED', email, false, ipAddress, userAgent, {
        attemptsRemaining: attemptResult.attemptsRemaining,
        isNowLocked: attemptResult.isNowLocked,
      });
      
      return res.status(401).json({
        success: false,
        error: attemptResult.isNowLocked 
          ? `Too many failed attempts. Account locked for ${LOCKOUT_DURATION_MINUTES} minutes.`
          : `Invalid master key. ${attemptResult.attemptsRemaining} attempts remaining.`,
        locked: attemptResult.isNowLocked,
        attemptsRemaining: attemptResult.attemptsRemaining,
      });
    }

    await logSecurityEvent('VERIFY_MASTER_KEY_SUCCESS', email, true, ipAddress, userAgent);
    
    res.json({
      success: true,
      message: 'Master key verified',
    });
  } catch (error) {
    console.error('Error verifying master key:', error);
    res.status(500).json({
      success: false,
      error: 'Verification failed',
    });
  }
});

// Full System Admin authentication - PUBLIC endpoint
router.post('/authenticate', async (req: Request, res: Response) => {
  try {
    const { firebaseToken, masterKey } = req.body;
    const ipAddress = req.headers['x-forwarded-for']?.toString() || req.socket.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

    console.log('[System Admin Auth] Starting authentication...');
    console.log('[System Admin Auth] Firebase token length:', firebaseToken?.length || 0);
    console.log('[System Admin Auth] Master key length:', masterKey?.length || 0);

    if (!firebaseToken || !masterKey) {
      console.log('[System Admin Auth] Missing credentials');
      return res.status(400).json({
        success: false,
        error: 'Missing required authentication credentials',
      });
    }

    // Verify Firebase token first
    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(firebaseToken);
      console.log('[System Admin Auth] Firebase token verified for:', decodedToken.email);
    } catch (error) {
      console.log('[System Admin Auth] Firebase token verification failed:', error);
      await logSecurityEvent('AUTH_INVALID_TOKEN', 'unknown', false, ipAddress, userAgent);
      return res.status(401).json({
        success: false,
        error: 'Invalid authentication token',
      });
    }

    const email = decodedToken.email;
    const firebaseUid = decodedToken.uid;
    const identifier = `${email}:${ipAddress}`;

    // Check lockout
    const lockoutStatus = isAccountLocked(identifier);
    if (lockoutStatus.locked) {
      await logSecurityEvent('AUTH_LOCKED', email || 'unknown', false, ipAddress, userAgent, {
        remainingMinutes: lockoutStatus.remainingMinutes,
      });
      return res.status(429).json({
        success: false,
        error: `Account temporarily locked. Try again in ${lockoutStatus.remainingMinutes} minutes.`,
        locked: true,
      });
    }

    // Verify master key
    const systemMasterKey = process.env.SYSTEM_ADMIN_MASTER_KEY;
    console.log('[System Admin Auth] System master key configured:', !!systemMasterKey);
    console.log('[System Admin Auth] Provided master key length:', masterKey.length);
    console.log('[System Admin Auth] System master key length:', systemMasterKey?.length || 0);
    
    if (!systemMasterKey) {
      return res.status(500).json({
        success: false,
        error: 'System configuration error',
      });
    }

    const masterKeyBuffer = Buffer.from(masterKey);
    const systemKeyBuffer = Buffer.from(systemMasterKey);
    
    const isValidMasterKey = masterKeyBuffer.length === systemKeyBuffer.length && 
                            crypto.timingSafeEqual(masterKeyBuffer, systemKeyBuffer);

    console.log('[System Admin Auth] Master key valid:', isValidMasterKey);

    if (!isValidMasterKey) {
      const attemptResult = recordFailedAttempt(identifier);
      await logSecurityEvent('AUTH_INVALID_MASTER_KEY', email || 'unknown', false, ipAddress, userAgent);
      return res.status(401).json({
        success: false,
        error: 'Invalid master key',
        locked: attemptResult.isNowLocked,
      });
    }

    // Check user exists and is SYSTEM_ADMIN
    console.log('[System Admin Auth] Looking for user with email:', email, 'or firebaseUid:', firebaseUid);
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { firebaseUid },
          { email },
        ],
        role: 'SYSTEM_ADMIN',
        isActive: true,
      },
    });

    console.log('[System Admin Auth] User found:', !!user, user?.role);

    if (!user) {
      await logSecurityEvent('AUTH_NOT_SYSTEM_ADMIN', email || 'unknown', false, ipAddress, userAgent);
      return res.status(403).json({
        success: false,
        error: 'Access denied. This portal is restricted to System Administrators.',
      });
    }

    // Update firebaseUid if not set
    if (!user.firebaseUid && firebaseUid) {
      await prisma.user.update({
        where: { id: user.id },
        data: { firebaseUid },
      });
    }

    // Success! Clear attempts and log
    clearAttempts(identifier);
    await logSecurityEvent('AUTH_SUCCESS', email || 'unknown', true, ipAddress, userAgent, {
      userId: user.id,
    });

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    res.json({
      success: true,
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
      error: 'Authentication failed',
    });
  }
});

export default router;
