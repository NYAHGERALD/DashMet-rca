import { Router } from 'express';
import asyncHandler from 'express-async-handler';
import { authenticate } from '../middleware/auth';
import {
  forgotPasswordIpRateLimiter,
  forgotPasswordRateLimiter,
  loginIpRateLimiter,
  loginRateLimiter,
  passwordResetRateLimiter,
  refreshRateLimiter,
} from '../middleware/rateLimiter';
import { requireAjaxRequest, requireCsrf } from '../middleware/csrf';
import { validateLogin, validateRegister } from '../middleware/validators';
import { validationResult } from 'express-validator';
import { ValidationError } from '../middleware/errorHandler';
import * as authController from '../controllers/authController';
import { setCsrfCookie } from '../utils/sessionCookies';

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

// POST /api/auth/register - DISABLED: Registration is now invitation-only via invitation acceptance
// The legacy self-registration endpoint has been disabled for security.
// Users must be invited by an organization admin and register through the invitation flow.
router.post(
  '/register',
  (_req: any, res: any) => {
    res.status(410).json({
      success: false,
      error: 'Self-registration is disabled. Please register through an invitation link from your organization administrator.',
    });
  }
);

// POST /api/auth/login - Email/Password login
router.post(
  '/login',
  requireAjaxRequest,
  loginIpRateLimiter,
  loginRateLimiter,
  validateLogin,
  validate,
  asyncHandler(authController.login)
);

// GET /api/auth/csrf - Issue a fresh CSRF token for same-session API retries
router.get('/csrf', (_req, res) => {
  const csrfToken = setCsrfCookie(res);
  res.set('Cache-Control', 'no-store');
  res.json({ success: true, data: { csrfToken } });
});

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
  requireCsrf,
  asyncHandler(authController.logout)
);

// POST /api/auth/refresh - Refresh access token
router.post(
  '/refresh',
  refreshRateLimiter,
  requireCsrf,
  asyncHandler(authController.refreshToken)
);

// POST /api/auth/forgot-password - Request password reset
router.post(
  '/forgot-password',
  requireAjaxRequest,
  forgotPasswordIpRateLimiter,
  forgotPasswordRateLimiter,
  asyncHandler(authController.forgotPassword)
);

// POST /api/auth/reset-password - Reset password with token
router.post(
  '/reset-password',
  requireAjaxRequest,
  passwordResetRateLimiter,
  asyncHandler(authController.resetPassword)
);

// POST /api/auth/change-password - Change password (authenticated)
router.post(
  '/change-password',
  authenticate,
  requireCsrf,
  asyncHandler(authController.changePassword)
);

// PATCH /api/auth/update-phone - Update phone with email OTP verification
router.patch(
  '/update-phone',
  authenticate,
  requireCsrf,
  asyncHandler(authController.updatePhone)
);

// POST /api/auth/verify-password - Verify password for secure actions (authenticated)
router.post(
  '/verify-password',
  authenticate,
  requireCsrf,
  asyncHandler(authController.verifyPassword)
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
  requireCsrf,
  asyncHandler(authController.revokeSession)
);

// DELETE /api/auth/sessions - Revoke all other sessions
router.delete(
  '/sessions',
  authenticate,
  requireCsrf,
  asyncHandler(authController.revokeAllOtherSessions)
);

export default router;
