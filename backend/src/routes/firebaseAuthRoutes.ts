// Phase 1.1: Firebase Authentication Routes
import { Router } from 'express';
import { prisma } from '../utils/prisma';
import { authenticate, authenticateFirebaseOnly, AuthRequest, FirebaseAuthRequest } from '../middleware/auth';
import { ValidationError } from '../middleware/errorHandler';
import { adminAuth } from '../config/firebase-admin';
import { websocketService } from '../services/websocketService';
import { logAuditEvent, getClientIp } from '../services/auditService';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// ==================== BRUTE-FORCE PROTECTION ====================
// Threshold: after this many failed attempts, lock the account
const FAILED_ATTEMPT_THRESHOLD = 5;
// How long the account stays locked (30 minutes)
const LOCKOUT_DURATION_MS = 30 * 60 * 1000;

// Normalize response timing to prevent timing-based information leakage
// Ensures all responses take at least a minimum time regardless of code path
const normalizeResponseTime = async (startTime: number, minMs: number = 300) => {
  const elapsed = Date.now() - startTime;
  if (elapsed < minMs) {
    await new Promise(r => setTimeout(r, minMs - elapsed + Math.random() * 100));
  }
};

// Check if user exists in Firebase and database by email
// Rate-limited by enumerationRateLimiter in routes/index.ts
router.post('/check-user', async (req, res) => {
  const startTime = Date.now();
  const { email } = req.body;

  if (!email) {
    // Normalize response timing to prevent timing-based enumeration
    await normalizeResponseTime(startTime);
    throw new ValidationError('Email is required');
  }

  let existsInFirebase = false;
  let firebaseUser = null;

  // Check if user exists in Firebase
  try {
    firebaseUser = await adminAuth.getUserByEmail(email);
    existsInFirebase = true;
  } catch (error: any) {
    // User doesn't exist in Firebase - this is expected for new users
    if (error.code !== 'auth/user-not-found') {
      console.error('Firebase error:', error);
    }
    existsInFirebase = false;
  }

  // Check if user exists in database
  const dbUser = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      organizationId: true,
      firebaseUid: true,
    },
  });

  // SECURITY: System Admins must use the dedicated System Admin portal with Master Key
  if (dbUser && dbUser.role === 'SYSTEM_ADMIN') {
    await normalizeResponseTime(startTime);
    return res.status(403).json({
      success: false,
      error: 'Access denied. Please use the appropriate portal.',
    });
  }

  const existsInDatabase = !!dbUser;
  const hasProfile = existsInDatabase && !!dbUser.firstName && !!dbUser.lastName;

  // Normalize response timing to prevent timing-based enumeration
  await normalizeResponseTime(startTime);

  res.json({
    success: true,
    data: {
      exists: existsInFirebase && existsInDatabase,
      existsInFirebase,
      existsInDatabase,
      hasProfile,
      user: dbUser || null,
    },
  });
});

// ==================== BRUTE-FORCE PROTECTION ENDPOINTS ====================

// Report a failed login attempt — tracks in DB, locks account + revokes tokens after threshold
router.post('/report-failed-login', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ success: false, error: 'Email is required' });
  }

  const normalizedEmail = email.toLowerCase().trim();

  const user = await prisma.user.findFirst({
    where: { email: normalizedEmail },
    select: { id: true, loginAttempts: true, organizationId: true, firebaseUid: true },
  });

  if (user) {
    const newAttempts = (user.loginAttempts || 0) + 1;

    await prisma.user.update({
      where: { id: user.id },
      data: {
        loginAttempts: newAttempts,
        ...(newAttempts >= FAILED_ATTEMPT_THRESHOLD && {
          lockedUntil: new Date(Date.now() + LOCKOUT_DURATION_MS),
        }),
      },
    });

    // When threshold is reached:
    // 1. Revoke ALL Firebase refresh tokens (invalidate active sessions)
    // 2. DISABLE the account at the Firebase identity provider level
    //    A disabled account CANNOT authenticate — no token, no login, nothing.
    //    This is the most secure lockout: enforced at the infrastructure level.
    if (newAttempts >= FAILED_ATTEMPT_THRESHOLD && user.firebaseUid) {
      try {
        await adminAuth.revokeRefreshTokens(user.firebaseUid);
      } catch (err) {
        console.error('Failed to revoke refresh tokens');
      }

      try {
        await adminAuth.updateUser(user.firebaseUid, { disabled: true });
      } catch (err) {
        console.error('Failed to disable Firebase account');
      }
    }

    await logAuditEvent({
      action: 'LOGIN',
      entity: 'Session',
      entityId: user.id,
      userId: user.id,
      organizationId: user.organizationId || undefined,
      changes: {
        loginMethod: 'email',
        result: 'failed',
        attemptCount: newAttempts,
        accountLocked: newAttempts >= FAILED_ATTEMPT_THRESHOLD,
      },
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'] as string,
    });
  }

  // Always return success to prevent user enumeration
  res.json({ success: true });
});

// Check if account is locked and requires password reset before login
router.post('/check-login-security', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ success: false, error: 'Email is required' });
  }

  const normalizedEmail = email.toLowerCase().trim();

  const user = await prisma.user.findFirst({
    where: { email: normalizedEmail },
    select: { id: true, loginAttempts: true, lockedUntil: true },
  });

  if (!user) {
    return res.json({ success: true, data: { accountLocked: false } });
  }

  // Check both DB lockout AND Firebase account disabled status
  let firebaseDisabled = false;
  try {
    const firebaseUser = await adminAuth.getUserByEmail(normalizedEmail);
    firebaseDisabled = firebaseUser.disabled;
  } catch {
    // If Firebase lookup fails, rely on DB state only
  }

  const dbLocked =
    user.loginAttempts >= FAILED_ATTEMPT_THRESHOLD &&
    user.lockedUntil &&
    new Date(user.lockedUntil) > new Date();

  const accountLocked = firebaseDisabled || !!dbLocked;

  res.json({
    success: true,
    data: {
      accountLocked,
      message: accountLocked
        ? 'Your account has been locked due to multiple failed login attempts. You must reset your password to regain access.'
        : undefined,
    },
  });
});

// Securely reset password for disabled (locked) accounts using server-side Admin SDK.
// Firebase client SDK blocks confirmPasswordReset() for disabled accounts, so this endpoint
// handles the entire flow server-side using Admin SDK which bypasses that restriction.
//
// SECURITY MODEL:
// - Requires a valid Firebase oobCode (one-time code sent to the user's email)
// - oobCode is verified server-side via Firebase REST API — proves email ownership
// - oobCodes cannot be forged, guessed, or reused (cryptographically random, single-use, time-limited)
// - No attacker can call this endpoint without access to the victim's email inbox
// - Password is set + account re-enabled + lockout cleared in a single transaction
router.post('/server-reset-password', async (req, res) => {
  const { oobCode, newPassword } = req.body;

  if (!oobCode || !newPassword) {
    return res.status(400).json({ success: false, error: 'Reset code and new password are required' });
  }

  // Server-side password strength validation
  if (newPassword.length < 8 || !/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
    return res.status(400).json({ success: false, error: 'Password must be at least 8 characters with uppercase, lowercase, and a number' });
  }

  const apiKey = process.env.FIREBASE_WEB_API_KEY;
  if (!apiKey) {
    console.error('FIREBASE_WEB_API_KEY not configured — cannot verify oobCode server-side');
    return res.status(500).json({ success: false, error: 'Server configuration error. Contact administrator.' });
  }

  try {
    // Step 1: Verify the oobCode via Firebase REST API to get the associated email.
    // This proves the caller has a valid reset code (sent only to the account owner's email).
    // This call does NOT consume the code or change the password.
    const verifyRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:resetPassword?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oobCode }),
      }
    );

    if (!verifyRes.ok) {
      return res.status(400).json({ success: false, error: 'Invalid or expired reset link. Please request a new one.' });
    }

    const verifyData: any = await verifyRes.json();
    const email = verifyData.email;

    if (!email) {
      return res.status(400).json({ success: false, error: 'Could not determine account email from reset code.' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Step 2: Look up the Firebase user
    const firebaseUser = await adminAuth.getUserByEmail(normalizedEmail);

    // Step 3: Update password AND re-enable the account via Admin SDK.
    // Admin SDK has full control — bypasses the "disabled" restriction.
    await adminAuth.updateUser(firebaseUser.uid, {
      password: newPassword,
      disabled: false,
    });

    // Step 4: Revoke all existing refresh tokens (old sessions are invalid)
    await adminAuth.revokeRefreshTokens(firebaseUser.uid);

    // Step 5: Clear DB lockout
    const user = await prisma.user.findFirst({
      where: { email: normalizedEmail },
      select: { id: true, organizationId: true },
    });

    if (user) {
      await prisma.user.update({
        where: { id: user.id },
        data: { loginAttempts: 0, lockedUntil: null },
      });

      await logAuditEvent({
        action: 'LOGIN',
        entity: 'Session',
        entityId: user.id,
        userId: user.id,
        organizationId: user.organizationId || undefined,
        changes: {
          loginMethod: 'email',
          result: 'password_reset_server_side_account_unlocked',
        },
        ipAddress: getClientIp(req),
        userAgent: req.headers['user-agent'] as string,
      });
    }

    res.json({ success: true, message: 'Password reset and account unlocked successfully.' });
  } catch (error) {
    console.error('Server-side password reset failed');
    res.status(500).json({ success: false, error: 'Failed to reset password. Please try again.' });
  }
});

// Report successful login — resets attempt counter
router.post('/report-successful-login', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ success: false, error: 'Email is required' });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const user = await prisma.user.findFirst({
    where: { email: normalizedEmail },
    select: { id: true, loginAttempts: true },
  });

  if (user && user.loginAttempts > 0) {
    await prisma.user.update({
      where: { id: user.id },
      data: { loginAttempts: 0, lockedUntil: null },
    });
  }

  res.json({ success: true });
});

// Validate access code for admin roles (no auth required - for profile setup form)
router.post('/validate-access-code', async (req, res) => {
  const { code, role } = req.body;

  if (!code || !role) {
    throw new ValidationError('Access code and role are required');
  }

  if (role !== 'ADMIN' && role !== 'SYSTEM_ADMIN') {
    throw new ValidationError('Access codes are only valid for Admin and System Admin roles');
  }

  const validAccessCode = await prisma.accessCode.findFirst({
    where: {
      code: code,
      role: role,
      isActive: true,
    },
  });

  if (!validAccessCode) {
    res.json({
      success: true,
      data: { valid: false, message: 'Invalid access code for this role' },
    });
    return;
  }

  // Check if access code has reached max uses
  if (validAccessCode.usedCount >= validAccessCode.maxUses) {
    res.json({
      success: true,
      data: { valid: false, message: 'Access code has reached maximum uses' },
    });
    return;
  }

  res.json({
    success: true,
    data: { valid: true, message: 'Access code is valid' },
  });
});

// Create user profile after Firebase registration (uses Firebase-only auth)
router.post('/create-profile', authenticateFirebaseOnly, async (req: FirebaseAuthRequest, res) => {
  const { 
    firstName, 
    lastName, 
    role, 
    organizationId, 
    facilityId, 
    accessCode,
    orgAccessCodeId,      // For role-specific organization access codes
    newOrganizationName,  // For ADMIN/SYSTEM_ADMIN to create new org
    newFacilityName       // For ADMIN/SYSTEM_ADMIN to create new facility
  } = req.body;
  const firebaseUser = req.firebaseUser!;

  // Validate required fields
  if (!firstName || !lastName || !role) {
    throw new ValidationError('First name, last name, and role are required');
  }

  const isAdminRole = role === 'ADMIN' || role === 'SYSTEM_ADMIN';

  // SECURITY: Check if this email is already registered in any organization
  // One email can only belong to ONE organization
  const existingUserByEmail = await prisma.user.findUnique({
    where: { email: firebaseUser.email },
    select: { id: true, email: true, organizationId: true, Organization: { select: { name: true } } },
  });

  if (existingUserByEmail) {
    throw new ValidationError(
      `This email is already registered with organization "${existingUserByEmail.Organization?.name || 'Unknown'}". Each email can only be associated with one organization.`
    );
  }

  // Check if user profile already exists by Firebase UID
  const existingUser = await prisma.user.findFirst({
    where: { firebaseUid: firebaseUser.firebaseUid },
  });

  if (existingUser) {
    throw new ValidationError('Profile already exists for this user');
  }

  // Validate access code for admin roles
  if (isAdminRole) {
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

  let finalOrganizationId: string | null = null;

  // For ADMIN/SYSTEM_ADMIN: Create new organization if name provided
  if (isAdminRole) {
    if (newOrganizationName) {
      // Check for case-insensitive duplicate organization name
      const existingOrg = await prisma.organization.findFirst({
        where: {
          name: {
            equals: newOrganizationName,
            mode: 'insensitive',
          },
        },
      });

      if (existingOrg) {
        throw new ValidationError('An organization with this name already exists');
      }

      const newOrg = await prisma.organization.create({
        data: {
          id: uuidv4(),
          updatedAt: new Date(),
          name: newOrganizationName,
          region: 'USA', // Default region
          defaultLanguage: 'ENGLISH',
          isActive: true,
        },
      });
      finalOrganizationId = newOrg.id;
      console.log('Created new organization');

      // Optionally create facility if name provided
      if (newFacilityName) {
        // Check for case-insensitive duplicate facility name
        const existingFacility = await prisma.facility.findFirst({
          where: {
            name: {
              equals: newFacilityName,
              mode: 'insensitive',
            },
          },
        });

        if (existingFacility) {
          throw new ValidationError('A facility with this name already exists');
        }

        const newFacility = await prisma.facility.create({
          data: {
            id: uuidv4(),
            updatedAt: new Date(),
            name: newFacilityName,
            organizationId: newOrg.id,
            timezone: 'America/New_York', // Default timezone
          },
        });
        console.log('Created new facility');
      }
    }
    // SYSTEM_ADMIN can have null organization, ADMIN requires organization
    if (role === 'ADMIN' && !finalOrganizationId) {
      throw new ValidationError('Organization is required for Admin role');
    }
  } else {
    // For non-admin roles: organizationId is required from dropdown selection
    if (!organizationId) {
      throw new ValidationError('Organization is required for this role');
    }
    finalOrganizationId = organizationId;

    // If a role-specific organization access code was used, increment its usage count
    if (orgAccessCodeId) {
      const orgAccessCode = await prisma.organizationAccessCode.findFirst({
        where: {
          id: orgAccessCodeId,
          organizationId: finalOrganizationId ?? undefined,
          role: role,
          isActive: true,
        },
      });

      if (orgAccessCode) {
        // Verify the code hasn't exceeded max uses
        if (orgAccessCode.usedCount >= orgAccessCode.maxUses) {
          throw new ValidationError('This access code has reached its maximum usage limit');
        }

        // Increment usage count
        await prisma.organizationAccessCode.update({
          where: { id: orgAccessCode.id },
          data: { usedCount: { increment: 1 } },
        });
      }
    }
  }

  // Create user profile in PostgreSQL
  const user = await prisma.user.create({
    data: {
      id: uuidv4(),
      updatedAt: new Date(),
      email: firebaseUser.email,
      firebaseUid: firebaseUser.firebaseUid,
      firstName,
      lastName,
      role,
      organizationId: finalOrganizationId,
      emailVerified: true,
      lastLoginAt: new Date(),
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
      firebaseUid: true,
      profilePicture: true,
    },
  });

  // If new user has QA_FOOD_SAFETY or QUALITY_CONTROL_MANAGER role, auto-add them to all open FMIR reports
  if ((role === 'QA_FOOD_SAFETY' || role === 'QUALITY_CONTROL_MANAGER') && finalOrganizationId) {
    // Get all open FMIR reports (not CLOSED) in the organization
    const openReports = await prisma.foreignMaterialIncident.findMany({
      where: {
        organizationId: finalOrganizationId,
        status: {
          not: 'CLOSED',
        },
      },
      select: {
        id: true,
        collaboratorIds: true,
        createdById: true,
      },
    });

    // Add the new QA user to each open report
    const updatedReportIds: string[] = [];
    for (const report of openReports) {
      const existingIds = report.collaboratorIds || [];
      // Don't add if they're the owner (unlikely for new user, but check anyway)
      if (report.createdById !== user.id) {
        await prisma.foreignMaterialIncident.update({
          where: { id: report.id },
          data: {
            collaboratorIds: [...existingIds, user.id],
          },
        });
        updatedReportIds.push(report.id);
      }
    }

    // Emit WebSocket event to notify frontends about the new collaborator
    if (updatedReportIds.length > 0) {
      websocketService.emitToOrganization(finalOrganizationId, 'fmir:collaborator-added', {
        userId: user.id,
        user: {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role,
          profilePicture: user.profilePicture,
          isQAFoodSafety: true,
        },
        reportIds: updatedReportIds,
      });
      console.log('New QA user auto-added to open FMIR reports');
    }
  }

  res.json({
    success: true,
    data: { user },
  });
});

// Get current user profile
router.get('/me', authenticate, async (req: AuthRequest, res) => {
  const userId = req.user!.id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      organizationId: true,
      profilePicture: true,
      Organization: {
        select: { id: true, name: true },
      },
      theme: true,
      language: true,
      lastLoginAt: true,
    },
  });

  if (!user) {
    throw new ValidationError('User not found');
  }

  // Update last login timestamp
  await prisma.user.update({
    where: { id: userId },
    data: { lastLoginAt: new Date() },
  });

  // Audit log: SSO login (for organization users only)
  if (user.role !== 'SYSTEM_ADMIN' && user.organizationId) {
    await logAuditEvent({
      action: 'LOGIN',
      entity: 'Session',
      entityId: userId,
      userId: userId,
      organizationId: user.organizationId,
      changes: { loginMethod: 'sso' },
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'] as string,
    });
  }

  // Flatten organization name for frontend convenience
  const userData = {
    ...user,
    organizationName: user.Organization?.name || null,
  };

  res.json({
    success: true,
    data: { user: userData },
  });
});

// Custom password reset with branded email (uses Firebase Admin SDK)
// This generates a password reset link that points to YOUR custom page
router.post('/send-password-reset', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    throw new ValidationError('Email is required');
  }

  try {
    // Check if user exists in Firebase
    await adminAuth.getUserByEmail(email);
    
    // Generate password reset link that points to your custom page
    const actionCodeSettings = {
      // URL to redirect to after password reset (your custom reset page)
      url: process.env.FRONTEND_URL || 'http://localhost:3000/reset-password',
      handleCodeInApp: true,
    };

    const resetLink = await adminAuth.generatePasswordResetLink(email, actionCodeSettings);
    
    // TODO: Send this link via your own SMTP server for branded emails
    // For now, we'll return the link in development mode
    // In production, you would use nodemailer with your SMTP settings
    
    // Example with nodemailer (you already have it installed):
    // const transporter = nodemailer.createTransport({
    //   host: process.env.SMTP_HOST,
    //   port: parseInt(process.env.SMTP_PORT || '587'),
    //   auth: {
    //     user: process.env.SMTP_USER,
    //     pass: process.env.SMTP_PASSWORD,
    //   },
    // });
    // 
    // await transporter.sendMail({
    //   from: '"DashMet RCA" <noreply@dashmet.com>',
    //   to: email,
    //   subject: 'Reset Your Password - DashMet RCA',
    //   html: `
    //     <h1>Reset Your Password</h1>
    //     <p>Click the link below to reset your password:</p>
    //     <a href="${resetLink}">Reset Password</a>
    //   `,
    // });

    console.log('Password reset link generated');
    
    res.json({
      success: true,
      message: 'If the email exists, a password reset link will be sent.',
      // Only return the link in development for testing
      ...(process.env.NODE_ENV === 'development' && { resetLink }),
    });
  } catch (error: any) {
    if (error.code === 'auth/user-not-found') {
      // Don't reveal if user doesn't exist for security
      res.json({
        success: true,
        message: 'If the email exists, a password reset link will be sent.',
      });
    } else {
      throw error;
    }
  }
});

// ============= PUBLIC ROUTES FOR PROFILE SETUP =============
// These routes don't require authentication - used during user registration

// GET /api/firebase-auth/public/organizations - List organizations for profile setup
// Only returns public organizations for non-admin signup
router.get('/public/organizations', async (req, res) => {
  const organizations = await prisma.organization.findMany({
    where: {
      isPublic: true,
      isActive: true,
    },
    select: {
      id: true,
      name: true,
    },
    orderBy: { name: 'asc' },
  });

  res.json({
    success: true,
    data: organizations,
  });
});

// POST /api/firebase-auth/public/validate-org-code - Validate organization role-specific signup code
// Returns organization details, role, and facilities if code is valid
router.post('/public/validate-org-code', async (req, res) => {
  const { code } = req.body;

  if (!code || !/^\d{6}$/.test(code)) {
    return res.json({
      success: true,
      data: { valid: false, message: 'Invalid code format. Must be 6 digits.' },
    });
  }

  // First check the new OrganizationAccessCode table for role-specific codes
  const accessCode = await prisma.organizationAccessCode.findFirst({
    where: {
      code,
      isActive: true,
    },
    include: {
      Organization: {
        select: {
          id: true,
          name: true,
          isActive: true,
          Facility: {
            select: {
              id: true,
              name: true,
            },
            orderBy: { name: 'asc' },
          },
        },
      },
    },
  });

  if (accessCode) {
    // Check if organization is active
    if (!accessCode.Organization.isActive) {
      return res.json({
        success: true,
        data: { valid: false, message: 'Organization is not active' },
      });
    }

    // Check if code has reached max uses
    if (accessCode.usedCount >= accessCode.maxUses) {
      return res.json({
        success: true,
        data: { valid: false, message: 'This access code has reached its maximum usage limit' },
      });
    }

    return res.json({
      success: true,
      data: {
        valid: true,
        isRoleSpecific: true,
        role: accessCode.role,
        accessCodeId: accessCode.id,
        Organization: {
          id: accessCode.Organization.id,
          name: accessCode.Organization.name,
        },
        Facility: accessCode.Organization.Facility,
      },
    });
  }

  // Fallback: Check the old organization signupCode (for backwards compatibility)
  const organization = await prisma.organization.findFirst({
    where: {
      signupCode: code,
      isPublic: true,
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      Facility: {
        select: {
          id: true,
          name: true,
        },
        orderBy: { name: 'asc' },
      },
    },
  });

  if (!organization) {
    return res.json({
      success: true,
      data: { valid: false, message: 'Invalid organization code' },
    });
  }

  // Old-style code found - user can choose their role
  res.json({
    success: true,
    data: {
      valid: true,
      isRoleSpecific: false,
      Organization: {
        id: organization.id,
        name: organization.name,
      },
      Facility: organization.Facility,
    },
  });
});

// GET /api/firebase-auth/public/facilities - List facilities for profile setup
router.get('/public/facilities', async (req, res) => {
  const { organizationId } = req.query;

  const facilities = await prisma.facility.findMany({
    where: organizationId ? { organizationId: String(organizationId) } : undefined,
    select: {
      id: true,
      name: true,
      organizationId: true,
    },
    orderBy: { name: 'asc' },
  });

  res.json({
    success: true,
    data: facilities,
  });
});

export default router;
