import { Router } from 'express';
import asyncHandler from 'express-async-handler';
import { authenticate } from '../middleware/auth';
import { authRateLimiter } from '../middleware/rateLimiter';
import { validateLogin, validateRegister } from '../middleware/validators';
import { validationResult } from 'express-validator';
import { ValidationError } from '../middleware/errorHandler';
import * as authController from '../controllers/authController';

const router = Router();

// Validation middleware
const validate = (req: any, res: any, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }
  next();
};

// Phase 1.1: Authentication Routes

// POST /api/auth/register - Register new user
router.post(
  '/register',
  authRateLimiter,
  validateRegister,
  validate,
  asyncHandler(authController.register)
);

// POST /api/auth/login - Email/Password login
router.post(
  '/login',
  authRateLimiter,
  validateLogin,
  validate,
  asyncHandler(authController.login)
);

// GET /api/auth/me - Get current user
router.get(
  '/me',
  authenticate,
  asyncHandler(authController.getCurrentUser)
);

// POST /api/auth/logout - Logout
router.post(
  '/logout',
  authenticate,
  asyncHandler(authController.logout)
);

// POST /api/auth/refresh - Refresh access token
router.post(
  '/refresh',
  asyncHandler(authController.refreshToken)
);

// POST /api/auth/forgot-password - Request password reset
router.post(
  '/forgot-password',
  authRateLimiter,
  asyncHandler(authController.forgotPassword)
);

// POST /api/auth/reset-password - Reset password with token
router.post(
  '/reset-password',
  authRateLimiter,
  asyncHandler(authController.resetPassword)
);

// POST /api/auth/change-password - Change password (authenticated)
router.post(
  '/change-password',
  authenticate,
  asyncHandler(authController.changePassword)
);

// GET /api/auth/sessions - Get active sessions
router.get(
  '/sessions',
  authenticate,
  asyncHandler(authController.getActiveSessions)
);

// DELETE /api/auth/sessions/:sessionId - Revoke specific session
router.delete(
  '/sessions/:sessionId',
  authenticate,
  asyncHandler(authController.revokeSession)
);

// DELETE /api/auth/sessions - Revoke all other sessions
router.delete(
  '/sessions',
  authenticate,
  asyncHandler(authController.revokeAllOtherSessions)
);

export default router;
