import { Request, Response, NextFunction } from 'express';
import { adminAuth } from '../config/firebase-admin';
import { AuthenticationError, AuthorizationError } from './errorHandler';
import { prisma } from '../utils/prisma';
import { phoneHashVariants } from '../utils/encryption';

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
      throw new AuthenticationError('No token provided');
    }

    // Verify Firebase ID token only (check revocation) - don't look up in PostgreSQL
    const decodedToken = await adminAuth.verifyIdToken(token, true);

    req.firebaseUser = {
      firebaseUid: decodedToken.uid,
      email: decodedToken.email || '',
    };
    
    next();
  } catch (error: any) {
    if (error.code === 'auth/id-token-expired') {
      next(new AuthenticationError('Token expired'));
    } else if (error.code === 'auth/id-token-revoked') {
      next(new AuthenticationError('Token revoked'));
    } else if (error.code === 'auth/argument-error') {
      next(new AuthenticationError('Invalid token format'));
    } else {
      next(new AuthenticationError('Authentication failed'));
    }
  }
};

// Phase 1.1: Firebase Authentication Middleware (requires user in DB)
export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      throw new AuthenticationError('No token provided');
    }

    // Verify Firebase ID token (with revocation check)
    const decodedToken = await adminAuth.verifyIdToken(token, true);

    // Look up user in PostgreSQL by Firebase UID first
    let user = await prisma.user.findFirst({
      where: {
        firebaseUid: decodedToken.uid,
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

    // If not found by firebaseUid, try to find by email (handles cross-platform auth)
    // This supports users who registered on mobile (phone auth) and login on web (email/Google auth)
    if (!user && decodedToken.email) {
      user = await prisma.user.findFirst({
        where: {
          email: decodedToken.email.toLowerCase(),
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

      // If found by email, link this Firebase UID to the existing account
      if (user) {
        console.log('Linking Firebase UID to existing user account');
        await prisma.user.update({
          where: { id: user.id },
          data: { firebaseUid: decodedToken.uid },
        });
        user.firebaseUid = decodedToken.uid;
      }
    }

    // If still not found, try phone number (handles phone auth where UID changed)
    if (!user && decodedToken.phone_number) {
      const hashes = phoneHashVariants(decodedToken.phone_number);
      user = await prisma.user.findFirst({
        where: {
          phoneHash: { in: hashes },
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

      // If found by phone, link this Firebase UID to the existing account
      if (user) {
        console.log(`Linking Firebase UID to user ${user.id} via phone match`);
        await prisma.user.update({
          where: { id: user.id },
          data: { firebaseUid: decodedToken.uid },
        });
        user.firebaseUid = decodedToken.uid;
      }
    }

    if (!user) {
      throw new AuthenticationError('User not found in database');
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
      throw new AuthorizationError(
        'Account locked due to suspicious activity. Reset your password to regain access.'
      );
    }

    req.user = user as any;
    next();
  } catch (error: any) {
    if (error.code === 'auth/id-token-expired') {
      next(new AuthenticationError('Token expired'));
    } else if (error.code === 'auth/argument-error') {
      next(new AuthenticationError('Invalid token format'));
    } else if (error.code === 'auth/id-token-revoked') {
      next(new AuthenticationError('Token revoked'));
    } else if (error.message === 'User not found in database') {
      next(new AuthenticationError('User not found'));
    } else if (!req.headers.authorization) {
      next(new AuthenticationError('No authentication token provided'));
    } else {
      next(new AuthenticationError('Authentication failed'));
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
      return next(
        new AuthorizationError(
          `Access denied. Required roles: ${allowedRoles.join(', ')}`
        )
      );
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
      throw new AuthorizationError('Access to this organization is denied');
    }

    next();
  } catch (error) {
    next(error);
  }
};
