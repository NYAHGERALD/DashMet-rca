/**
 * Mobile Authentication Routes
 * PUBLIC endpoints for iOS Meeting Intelligence app registration
 * 
 * These routes do NOT require authentication - they are used for:
 * 1. Checking if phone number exists in database
 * 2. Validating organization access codes
 * 3. Registering new users from mobile app
 * 4. Linking Firebase UID after phone verification
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// ============================================================================
// POST /api/mobile/check-phone
// Check if phone number exists in database
// Returns: { exists: boolean, user?: { id, firstName, lastName } }
// ============================================================================
router.post('/check-phone', async (req: Request, res: Response) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({
        success: false,
        error: 'Phone number is required',
      });
    }

    // Normalize phone number (remove spaces, ensure E.164 format)
    const normalizedPhone = phone.replace(/\s+/g, '').trim();

    // Check if user exists with this phone number
    const user = await prisma.user.findFirst({
      where: {
        phone: normalizedPhone,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
      },
    });

    if (user) {
      return res.json({
        success: true,
        exists: true,
        user: {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
        },
      });
    }

    return res.json({
      success: true,
      exists: false,
      user: null,
    });
  } catch (error: any) {
    console.error('Check phone error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to check phone number',
    });
  }
});

// ============================================================================
// POST /api/mobile/check-email
// Check if email exists in database
// Returns: { exists: boolean, email?: string, firstName?: string, lastName?: string }
// ============================================================================
router.post('/check-email', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required',
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const user = await prisma.user.findFirst({
      where: {
        email: normalizedEmail,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
      },
    });

    return res.json({
      success: true,
      exists: !!user,
      email: user?.email || null,
      firstName: user?.firstName || null,
      lastName: user?.lastName || null,
      userId: user?.id || null,
    });
  } catch (error: any) {
    console.error('Check email error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to check email',
    });
  }
});

// ============================================================================
// POST /api/mobile/validate-access-code
// Validate an organization access code for mobile registration
// Returns: { valid: boolean, role?, organizationId?, organizationName?, facilities? }
// ============================================================================
router.post('/validate-access-code', async (req: Request, res: Response) => {
  try {
    const { code } = req.body;

    if (!code || !/^\d{6}$/.test(code)) {
      return res.json({
        success: true,
        valid: false,
        error: 'Invalid code format. Must be 6 digits.',
      });
    }

    // Check OrganizationAccessCode table (role-specific codes)
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
                address: true,
                timezone: true,
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
          valid: false,
          error: 'Organization is not active',
        });
      }

      // Check if code has reached max uses
      if (accessCode.usedCount >= accessCode.maxUses) {
        return res.json({
          success: true,
          valid: false,
          error: 'This access code has reached its maximum usage limit',
        });
      }

      return res.json({
        success: true,
        valid: true,
        accessCodeId: accessCode.id,
        role: accessCode.role,
        organizationId: accessCode.Organization.id,
        organizationName: accessCode.Organization.name,
        facilities: accessCode.Organization.Facility.map((f) => ({
          id: f.id,
          name: f.name,
          address: f.address || '',
          timezone: f.timezone || 'UTC',
        })),
      });
    }

    // Fallback: Check the old organization signupCode
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
            address: true,
            timezone: true,
          },
          orderBy: { name: 'asc' },
        },
      },
    });

    if (organization) {
      return res.json({
        success: true,
        valid: true,
        accessCodeId: null, // No specific access code
        role: null, // User will need to select role
        organizationId: organization.id,
        organizationName: organization.name,
        facilities: organization.Facility.map((f) => ({
          id: f.id,
          name: f.name,
          address: f.address || '',
          timezone: f.timezone || 'UTC',
        })),
      });
    }

    return res.json({
      success: true,
      valid: false,
      error: 'Invalid access code',
    });
  } catch (error: any) {
    console.error('Validate access code error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to validate access code',
    });
  }
});

// ============================================================================
// POST /api/mobile/register
// Register a new user from mobile app
// Expects: { firstName, lastName, email, phone, accessCodeId, facilityId?, firebaseUid? }
// ============================================================================
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { firstName, lastName, email, phone, accessCodeId, facilityId, firebaseUid } = req.body;

    // Validate required fields
    if (!firstName || !lastName || !email || !phone || !accessCodeId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: firstName, lastName, email, phone, accessCodeId',
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const normalizedPhone = phone.replace(/\s+/g, '').trim();

    // Check if email already exists
    const existingEmailUser = await prisma.user.findFirst({
      where: { email: normalizedEmail },
    });

    if (existingEmailUser) {
      return res.status(400).json({
        success: false,
        error: 'Email already registered',
      });
    }

    // Check if phone already exists
    const existingPhoneUser = await prisma.user.findFirst({
      where: { phone: normalizedPhone },
    });

    if (existingPhoneUser) {
      return res.status(400).json({
        success: false,
        error: 'Phone number already registered',
      });
    }

    // Validate access code and get role/organization
    const accessCode = await prisma.organizationAccessCode.findFirst({
      where: {
        id: accessCodeId,
        isActive: true,
      },
      include: {
        Organization: true,
      },
    });

    if (!accessCode) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or inactive access code',
      });
    }

    // Check max uses
    if (accessCode.usedCount >= accessCode.maxUses) {
      return res.status(400).json({
        success: false,
        error: 'Access code has reached maximum uses',
      });
    }

    // If facilityId provided, verify it belongs to the organization
    if (facilityId) {
      const facility = await prisma.facility.findFirst({
        where: {
          id: facilityId,
          organizationId: accessCode.organizationId,
        },
      });

      if (!facility) {
        return res.status(400).json({
          success: false,
          error: 'Invalid facility for this organization',
        });
      }
    }

    // Create user (facilityId is not stored on User model, organization assigns facilities differently)
    const user = await prisma.user.create({
      data: {
        id: uuidv4(),
        updatedAt: new Date(),
        email: normalizedEmail,
        phone: normalizedPhone,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        role: accessCode.role,
        organizationId: accessCode.organizationId,
        firebaseUid: firebaseUid || null,
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        phone: true,
        firstName: true,
        lastName: true,
        role: true,
        organizationId: true,
      },
    });

    // Increment access code usage count
    await prisma.organizationAccessCode.update({
      where: { id: accessCode.id },
      data: { usedCount: { increment: 1 } },
    });

    return res.status(201).json({
      success: true,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        role: user.role,
        organizationId: user.organizationId,
        facilityId: facilityId || null,
      },
    });
  } catch (error: any) {
    console.error('Register user error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to register user',
    });
  }
});

// ============================================================================
// POST /api/mobile/link-firebase
// Link Firebase UID to existing user after phone verification
// Expects: { phone, firebaseUid }
// ============================================================================
router.post('/link-firebase', async (req: Request, res: Response) => {
  try {
    const { phone, firebaseUid } = req.body;

    if (!phone || !firebaseUid) {
      return res.status(400).json({
        success: false,
        error: 'Phone and firebaseUid are required',
      });
    }

    const normalizedPhone = phone.replace(/\s+/g, '').trim();

    // Find user by phone
    const user = await prisma.user.findFirst({
      where: { phone: normalizedPhone },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found with this phone number',
      });
    }

    // Check if another user already has this Firebase UID
    const existingFirebaseUser = await prisma.user.findFirst({
      where: {
        firebaseUid,
        id: { not: user.id },
      },
    });

    if (existingFirebaseUser) {
      return res.status(400).json({
        success: false,
        error: 'Firebase UID already linked to another account',
      });
    }

    // Update user with Firebase UID
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        firebaseUid,
        lastLoginAt: new Date(),
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
      },
    });

    return res.json({
      success: true,
      user: {
        id: updatedUser.id,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
      },
    });
  } catch (error: any) {
    console.error('Link Firebase error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to link Firebase UID',
    });
  }
});

export default router;
