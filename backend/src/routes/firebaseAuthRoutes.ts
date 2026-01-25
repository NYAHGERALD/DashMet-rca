// Phase 1.1: Firebase Authentication Routes
import { Router } from 'express';
import { prisma } from '../utils/prisma';
import { authenticate, authenticateFirebaseOnly, AuthRequest, FirebaseAuthRequest } from '../middleware/auth';
import { ValidationError } from '../middleware/errorHandler';
import { adminAuth } from '../config/firebase-admin';
import { websocketService } from '../services/websocketService';

const router = Router();

// Check if user exists in Firebase and database by email
// Returns: existsInFirebase, existsInDatabase, hasProfile
router.post('/check-user', async (req, res) => {
  const { email } = req.body;

  if (!email) {
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
    return res.status(403).json({
      success: false,
      error: 'System Administrators must use the dedicated Control Center portal for access.',
      isSystemAdmin: true,
    });
  }

  const existsInDatabase = !!dbUser;
  const hasProfile = existsInDatabase && !!dbUser.firstName && !!dbUser.lastName;

  res.json({
    success: true,
    data: {
      exists: existsInFirebase && existsInDatabase, // Both must exist for "existing user"
      existsInFirebase,
      existsInDatabase,
      hasProfile,
      user: dbUser || null,
    },
  });
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
          name: newOrganizationName,
          region: 'USA', // Default region
          defaultLanguage: 'ENGLISH',
          isActive: true,
        },
      });
      finalOrganizationId = newOrg.id;
      console.log(`Created new organization: ${newOrg.name} (ID: ${newOrg.id})`);

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
            name: newFacilityName,
            organizationId: newOrg.id,
            timezone: 'America/New_York', // Default timezone
          },
        });
        console.log(`Created new facility: ${newFacility.name} (ID: ${newFacility.id})`);
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
          organizationId: finalOrganizationId,
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
      console.log(`📤 New QA user ${user.email} auto-added to ${updatedReportIds.length} open FMIR reports`);
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

  // SECURITY: System Admins must use the dedicated System Admin portal with Master Key
  if (user.role === 'SYSTEM_ADMIN') {
    return res.status(403).json({
      success: false,
      error: 'System Administrators must use the dedicated Control Center portal for access.',
      isSystemAdmin: true,
    });
  }

  // Update last login timestamp
  await prisma.user.update({
    where: { id: userId },
    data: { lastLoginAt: new Date() },
  });

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

    console.log('Password reset link generated for:', email);
    
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
