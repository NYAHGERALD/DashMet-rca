import { Router, Response, Request } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';
import { auth } from '../config/firebase-admin';
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
    // Lockout expired, reset
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
        action: success ? 'VIEW' : 'UPDATE', // Reuse existing AuditAction enum
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

// Verify master key matches environment variable
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

// Full System Admin authentication
router.post('/authenticate', async (req: Request, res: Response) => {
  try {
    const { firebaseToken, masterKey } = req.body;
    const ipAddress = req.headers['x-forwarded-for']?.toString() || req.socket.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

    if (!firebaseToken || !masterKey) {
      return res.status(400).json({
        success: false,
        error: 'Missing required authentication credentials',
      });
    }

    // Verify Firebase token first
    let decodedToken;
    try {
      decodedToken = await auth.verifyIdToken(firebaseToken);
    } catch (error) {
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

    if (!user) {
      await logSecurityEvent('AUTH_NOT_SYSTEM_ADMIN', email || 'unknown', false, ipAddress, userAgent);
      return res.status(403).json({
        success: false,
        error: 'Access denied. This portal is restricted to System Administrators.',
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
      data: { lastLogin: new Date() },
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

// Get recent access logs (protected, SYSTEM_ADMIN only)
router.get('/access-logs', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const currentUser = req.user!;
    
    if (currentUser.role !== 'SYSTEM_ADMIN') {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
      });
    }

    const logs = await prisma.auditLog.findMany({
      where: {
        entity: 'SYSTEM_ADMIN_AUTH',
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 100,
    });

    res.json({
      success: true,
      data: logs,
    });
  } catch (error) {
    console.error('Error fetching access logs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch access logs',
    });
  }
});

// System Admin Dashboard Stats - SYSTEM_ADMIN only
router.get('/dashboard/stats', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const currentUser = req.user!;
    
    // Only SYSTEM_ADMIN can access this endpoint
    if (currentUser.role !== 'SYSTEM_ADMIN') {
      return res.status(403).json({
        success: false,
        error: 'Access denied. System Administrator access required.',
      });
    }

    // Get date ranges
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    // Fetch all stats in parallel
    const [
      totalOrganizations,
      activeOrganizations,
      totalUsers,
      activeUsers,
      newUsersThisMonth,
      openSupportRequests,
      totalSupportRequests,
      totalAccessCodes,
      usedAccessCodes,
      usersByRole,
      supportByCategory,
    ] = await Promise.all([
      // Total organizations
      prisma.organization.count(),
      
      // Active organizations (has at least one user)
      prisma.organization.count({
        where: {
          User: {
            some: {},
          },
        },
      }),
      
      // Total users
      prisma.user.count(),
      
      // Active users (logged in within last 30 days - approximate by checking recent incidents or just count all for now)
      prisma.user.count({
        where: {
          isActive: true,
        },
      }),
      
      // New users this month
      prisma.user.count({
        where: {
          createdAt: {
            gte: startOfMonth,
          },
        },
      }),
      
      // Open support requests
      prisma.supportRequest.count({
        where: {
          status: 'OPEN',
        },
      }),
      
      // Total support requests
      prisma.supportRequest.count(),
      
      // Total access codes
      prisma.accessCode.count(),
      
      // Used access codes
      prisma.accessCode.count({
        where: {
          usedCount: {
            gt: 0,
          },
        },
      }),
      
      // Users grouped by role
      prisma.user.groupBy({
        by: ['role'],
        _count: {
          id: true,
        },
      }),
      
      // Support requests by category
      prisma.supportRequest.groupBy({
        by: ['category'],
        _count: {
          id: true,
        },
      }),
    ]);

    // Generate user growth trend (last 6 months)
    const userGrowth = [];
    for (let i = 5; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      const monthName = monthStart.toLocaleString('default', { month: 'short' });
      
      const [usersCount, orgsCount] = await Promise.all([
        prisma.user.count({
          where: {
            createdAt: {
              lte: monthEnd,
            },
          },
        }),
        prisma.organization.count({
          where: {
            createdAt: {
              lte: monthEnd,
            },
          },
        }),
      ]);
      
      userGrowth.push({
        name: monthName,
        users: usersCount,
        orgs: orgsCount,
      });
    }

    // Format users by role for pie chart
    const usersByRoleFormatted = usersByRole.map(item => ({
      name: item.role.replace(/_/g, ' '),
      value: item._count.id,
    }));

    // Format support by category for bar chart
    const supportRequestsByCategory = supportByCategory.map(item => ({
      name: item.category || 'Other',
      value: item._count.id,
    }));

    // Organizations by status (using user count as proxy for active)
    const organizationsByStatus = [
      { name: 'Active', value: activeOrganizations },
      { name: 'Inactive', value: totalOrganizations - activeOrganizations },
    ].filter(item => item.value > 0);

    const stats = {
      // Platform overview
      totalOrganizations,
      activeOrganizations,
      totalUsers,
      activeUsers,
      newUsersThisMonth,
      
      // Support
      openSupportRequests,
      totalSupportRequests,
      avgResponseTime: 0, // Would need more complex calculation
      
      // Access codes
      totalAccessCodes,
      usedAccessCodes,
      
      // Trends
      userGrowth,
      organizationsByStatus,
      supportRequestsByCategory,
      usersByRole: usersByRoleFormatted,
    };

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Error fetching system admin dashboard stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch system admin dashboard stats',
    });
  }
});

export default router;
