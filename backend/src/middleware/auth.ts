import { Request, Response, NextFunction } from 'express';
import { adminAuth } from '../config/firebase-admin';
import { AuthenticationError, AuthorizationError } from './errorHandler';
import { prisma } from '../utils/prisma';
import jwt from 'jsonwebtoken';
import { getAccessTokenFromRequest, hashToken } from '../utils/sessionCookies';
import { logger } from '../utils/logger';
import {
  getIdleTimeoutMsForRole,
  isSessionAbsoluteExpired,
} from '../utils/sessionPolicy';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    organizationId: string;
    firebaseUid: string;
  };
}

// Extended request for Firebase-only auth (used during profile creation)
export interface FirebaseAuthRequest extends Request {
  firebaseUser?: {
    firebaseUid: string;
    email: string;
  };
}

// Firebase-only authentication (for profile creation - user doesn't exist in DB yet)
export const authenticateFirebaseOnly = async (
  req: FirebaseAuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      logger.warn('Firebase-only authentication failed: missing token', { ip: req.ip });
      throw new AuthenticationError();
    }

    // Verify Firebase ID token only (check revocation) - don't look up in PostgreSQL
    const decodedToken = await adminAuth.verifyIdToken(token, true);

    req.firebaseUser = {
      firebaseUid: decodedToken.uid,
      email: decodedToken.email || '',
    };
    
    next();
  } catch (error: any) {
    logger.warn('Firebase-only authentication rejected', {
      ip: req.ip,
      code: error?.code || 'unknown',
      reason: error?.message || 'unknown',
    });
    next(new AuthenticationError());
  }
};

// Phase 1.1: Firebase Authentication Middleware (requires user in DB)
export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = getAccessTokenFromRequest(req);

    if (!token) {
      logger.warn('Authentication failed: missing token', { ip: req.ip });
      throw new AuthenticationError();
    }

    let decodedToken: any;
    try {
      decodedToken = jwt.verify(token, process.env.JWT_SECRET!);
    } catch (error) {
      logger.warn('Authentication failed: invalid JWT', { ip: req.ip });
      throw new AuthenticationError();
    }

    if (!decodedToken?.userId) {
      logger.warn('Authentication failed: JWT missing userId', { ip: req.ip });
      throw new AuthenticationError();
    }

    const session = await prisma.session.findFirst({
      where: {
        userId: decodedToken.userId,
        token: hashToken(token),
      },
      select: {
        id: true,
        expiresAt: true,
        createdAt: true,
      },
    });

    if (!session) {
      logger.warn('Authentication failed: session missing/expired', {
        ip: req.ip,
        userId: decodedToken.userId,
      });
      throw new AuthenticationError();
    }

    const user = await prisma.user.findFirst({
      where: {
        id: decodedToken.userId,
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        organizationId: true,
        firebaseUid: true,
        isActive: true,
        profilePicture: true,
        loginAttempts: true,
        lockedUntil: true,
      },
    });

    if (!user) {
      logger.warn('Authentication failed: user missing or inactive', {
        ip: req.ip,
        userId: decodedToken.userId,
      });
      throw new AuthenticationError();
    }

    const now = new Date();
    if (session.expiresAt <= now) {
      await prisma.session.delete({
        where: { id: session.id },
      });
      logger.warn('Authentication failed: idle timeout reached', {
        ip: req.ip,
        userId: decodedToken.userId,
        role: user.role,
      });
      throw new AuthenticationError();
    }

    if (isSessionAbsoluteExpired(session.createdAt, user.role, now)) {
      await prisma.session.delete({
        where: { id: session.id },
      });
      logger.warn('Authentication failed: absolute session timeout reached', {
        ip: req.ip,
        userId: decodedToken.userId,
        role: user.role,
      });
      throw new AuthenticationError();
    }

    const idleTimeoutMs = getIdleTimeoutMsForRole(user.role);
    const idleTimeRemainingMs = session.expiresAt.getTime() - now.getTime();
    if (idleTimeRemainingMs < Math.floor(idleTimeoutMs / 2)) {
      await prisma.session.update({
        where: { id: session.id },
        data: {
          expiresAt: new Date(now.getTime() + idleTimeoutMs),
        },
      });
    }

    // SERVER-SIDE LOCKOUT ENFORCEMENT
    // If account has too many failed login attempts and is locked,
    // reject ALL API requests until password is reset and lockout cleared.
    // This prevents attackers who brute-forced the password from accessing data.
    const FAILED_ATTEMPT_THRESHOLD = 5;
    if (
      user.loginAttempts >= FAILED_ATTEMPT_THRESHOLD &&
      user.lockedUntil &&
      new Date(user.lockedUntil) > new Date()
    ) {
      logger.warn('Authorization denied: locked account access attempt', {
        ip: req.ip,
        userId: user.id,
        lockedUntil: user.lockedUntil,
      });
      throw new AuthorizationError();
    }

    req.user = user as any;
    next();
  } catch (error: any) {
    if (error instanceof AuthenticationError) {
      next(new AuthenticationError());
    } else if (error instanceof AuthorizationError) {
      next(new AuthorizationError());
    } else {
      logger.error('Unexpected authentication middleware error', {
        ip: req.ip,
        error: error?.message || error,
      });
      next(new AuthenticationError());
    }
  }
};

// Phase 1.2: Role-Based Access Control
export const authorize = (...allowedRoles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AuthenticationError());
    }

    if (!allowedRoles.includes(req.user.role)) {
      logger.warn('Authorization denied: role mismatch', {
        userId: req.user.id,
        userRole: req.user.role,
        requiredRoles: allowedRoles,
      });
      return next(new AuthorizationError());
    }

    next();
  };
};

export const requireSystemAdmin = authorize('SYSTEM_ADMIN');

// Phase 2: Multi-tenant organization isolation
export const verifyOrganization = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { organizationId } = req.params;

    if (!organizationId) {
      return next();
    }

    if (req.user?.organizationId !== organizationId) {
      logger.warn('Authorization denied: organization mismatch', {
        userId: req.user?.id,
        userOrganizationId: req.user?.organizationId,
        requestedOrganizationId: organizationId,
      });
      throw new AuthorizationError();
    }

    next();
  } catch (error) {
    next(error);
  }
};
