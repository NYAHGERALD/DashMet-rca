import { Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../utils/prisma';
import { AuthRequest } from '../middleware/auth';
import { ValidationError, AuthenticationError, NotFoundError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

// Generate JWT tokens
const generateTokens = (userId: string) => {
  const accessToken = jwt.sign(
    { userId },
    process.env.JWT_SECRET as string,
    { expiresIn: process.env.JWT_EXPIRE || '7d' } as jwt.SignOptions
  );

  const refreshToken = jwt.sign(
    { userId },
    process.env.JWT_REFRESH_SECRET as string,
    { expiresIn: process.env.JWT_REFRESH_EXPIRE || '30d' } as jwt.SignOptions
  );

  return { accessToken, refreshToken };
};

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
  const hashedPassword = await bcrypt.hash(
    password,
    parseInt(process.env.BCRYPT_ROUNDS || '12')
  );

  // Create user
  const user = await prisma.user.create({
    data: {
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
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
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
  const { email, password } = req.body;

  // Find user
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    throw new AuthenticationError('Invalid email or password');
  }

  // SECURITY: System Admins must use the dedicated System Admin portal with Master Key
  if (user.role === 'SYSTEM_ADMIN') {
    logger.warn(`System Admin login attempt blocked on regular login: ${email}`);
    throw new AuthenticationError('System Administrators must use the dedicated Control Center portal for access.');
  }

  // Check if account is locked
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const remainingTime = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 1000 / 60);
    throw new AuthenticationError(
      `Account locked. Try again in ${remainingTime} minutes.`
    );
  }

  // Check if account is active
  if (!user.isActive) {
    throw new AuthenticationError('Account is inactive. Contact administrator.');
  }

  // Verify password
  const isPasswordValid = await bcrypt.compare(password, user.password!);

  if (!isPasswordValid) {
    // Increment login attempts
    const loginAttempts = user.loginAttempts + 1;
    const maxAttempts = parseInt(process.env.MAX_LOGIN_ATTEMPTS || '5');

    await prisma.user.update({
      where: { id: user.id },
      data: {
        loginAttempts,
        ...(loginAttempts >= maxAttempts && {
          lockedUntil: new Date(
            Date.now() + parseInt(process.env.LOCKOUT_DURATION || '900000')
          ),
        }),
      },
    });

    throw new AuthenticationError('Invalid email or password');
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
      token: accessToken,
      refreshToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      ipAddress: req.ip,
      deviceInfo: req.get('user-agent'),
    },
  });

  logger.info(`User logged in: ${email}`);

  res.json({
    success: true,
    data: {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        organizationId: user.organizationId,
        theme: user.theme,
        language: user.language,
      },
      token: accessToken,
      refreshToken,
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
      theme: true,
      language: true,
      defaultSiteId: true,
      defaultLineId: true,
    },
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  res.json({
    success: true,
    data: { user },
  });
};

// Phase 1.1: Logout
export const logout = async (req: AuthRequest, res: Response) => {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (token) {
    // Delete session
    await prisma.session.deleteMany({
      where: { token },
    });
  }

  logger.info(`User logged out: ${req.user!.email}`);

  res.json({
    success: true,
    message: 'Logged out successfully',
  });
};

// Phase 1.1: Refresh Token
export const refreshToken = async (req: AuthRequest, res: Response) => {
  const { refreshToken: oldRefreshToken } = req.body;

  if (!oldRefreshToken) {
    throw new ValidationError('Refresh token is required');
  }

  // Verify refresh token
  let decoded: any;
  try {
    decoded = jwt.verify(oldRefreshToken, process.env.JWT_REFRESH_SECRET!);
  } catch (error) {
    throw new AuthenticationError('Invalid refresh token');
  }

  // Find session
  const session = await prisma.session.findFirst({
    where: {
      refreshToken: oldRefreshToken,
      userId: decoded.userId,
    },
  });

  if (!session || session.expiresAt < new Date()) {
    throw new AuthenticationError('Session expired. Please login again.');
  }

  // Generate new tokens
  const { accessToken, refreshToken: newRefreshToken } = generateTokens(decoded.userId);

  // Update session
  await prisma.session.update({
    where: { id: session.id },
    data: {
      token: accessToken,
      refreshToken: newRefreshToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  res.json({
    success: true,
    data: {
      token: accessToken,
      refreshToken: newRefreshToken,
    },
  });
};

// Phase 1.1: Forgot Password
export const forgotPassword = async (req: AuthRequest, res: Response) => {
  const { email } = req.body;

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

  // Generate reset token
  const resetToken = uuidv4();
  const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordResetToken: resetToken,
      passwordResetExpires: resetExpires,
    },
  });

  // TODO: Send email with reset link
  // In production, send email: ${process.env.FRONTEND_URL}/reset-password?token=${resetToken}
  
  logger.info(`Password reset requested for: ${email}`);

  res.json({
    success: true,
    message: 'If the email exists, a password reset link will be sent.',
    ...(process.env.NODE_ENV === 'development' && { resetToken }), // Only in dev
  });
};

// Phase 1.1: Reset Password
export const resetPassword = async (req: AuthRequest, res: Response) => {
  const { token, newPassword } = req.body;

  const user = await prisma.user.findFirst({
    where: {
      passwordResetToken: token,
      passwordResetExpires: {
        gt: new Date(),
      },
    },
  });

  if (!user) {
    throw new ValidationError('Invalid or expired reset token');
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
    throw new AuthenticationError('User not authenticated');
  }

  // Validate required fields
  if (!currentPassword || !newPassword || !confirmPassword) {
    throw new ValidationError('All fields are required');
  }

  // Validate new password length
  if (newPassword.length < 8) {
    throw new ValidationError('New password must be at least 8 characters long');
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
    throw new NotFoundError('User not found');
  }

  // Verify current password
  const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);

  if (!isCurrentPasswordValid) {
    throw new ValidationError('Current password is incorrect');
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
    throw new AuthenticationError('User not authenticated');
  }

  if (!password) {
    throw new ValidationError('Password is required');
  }

  // Get user with current password
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user || !user.password) {
    throw new NotFoundError('User not found');
  }

  // Verify password
  const isPasswordValid = await bcrypt.compare(password, user.password);

  if (!isPasswordValid) {
    logger.warn(`Password verification failed for user: ${user.email}`);
    res.status(401).json({
      success: false,
      error: 'Incorrect password',
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
  const currentToken = req.headers.authorization?.replace('Bearer ', '');

  if (!userId) {
    throw new AuthenticationError('User not authenticated');
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
    isCurrent: session.token === currentToken,
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
  const currentToken = req.headers.authorization?.replace('Bearer ', '');

  if (!userId) {
    throw new AuthenticationError('User not authenticated');
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
  if (session.token === currentToken) {
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
  const currentToken = req.headers.authorization?.replace('Bearer ', '');

  if (!userId) {
    throw new AuthenticationError('User not authenticated');
  }

  // Delete all sessions except current
  const result = await prisma.session.deleteMany({
    where: {
      userId,
      token: { not: currentToken },
    },
  });

  logger.info(`All other sessions revoked for user: ${req.user?.email}, count: ${result.count}`);

  res.json({
    success: true,
    message: `${result.count} session(s) revoked successfully`,
    data: { revokedCount: result.count },
  });
};
