import { Request, Response, NextFunction } from 'express';
import { adminAuth } from '../config/firebase-admin';
import { AuthenticationError, AuthorizationError } from './errorHandler';
import { prisma } from '../utils/prisma';

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

    // Verify Firebase ID token only - don't look up in PostgreSQL
    const decodedToken = await adminAuth.verifyIdToken(token);

    req.firebaseUser = {
      firebaseUid: decodedToken.uid,
      email: decodedToken.email || '',
    };
    
    next();
  } catch (error: any) {
    console.log('Firebase auth error:', error.code, error.message);
    
    if (error.code === 'auth/id-token-expired') {
      next(new AuthenticationError('Token expired'));
    } else if (error.code === 'auth/argument-error') {
      next(new AuthenticationError('Invalid token format'));
    } else {
      next(new AuthenticationError(`Firebase authentication failed: ${error.message}`));
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

    // Verify Firebase ID token
    const decodedToken = await adminAuth.verifyIdToken(token);

    // Look up user in PostgreSQL by Firebase UID
    const user = await prisma.user.findFirst({
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
      },
    });

    if (!user) {
      throw new AuthenticationError('User not found in database');
    }

    req.user = user as any;
    next();
  } catch (error: any) {
    console.log('Authentication error details:', {
      code: error.code,
      message: error.message,
      hasToken: !!req.headers.authorization
    });

    if (error.code === 'auth/id-token-expired') {
      next(new AuthenticationError('Token expired'));
    } else if (error.code === 'auth/argument-error') {
      next(new AuthenticationError('Invalid token format'));
    } else if (error.code === 'auth/id-token-revoked') {
      next(new AuthenticationError('Token revoked'));
    } else if (error.code === 'auth/user-not-found') {
      next(new AuthenticationError('Firebase user not found'));
    } else if (error.message === 'User not found in database') {
      next(new AuthenticationError('User not found in database'));
    } else if (!req.headers.authorization) {
      next(new AuthenticationError('No authentication token provided'));
    } else {
      next(new AuthenticationError(`Authentication failed: ${error.message || 'Unknown error'}`));
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
