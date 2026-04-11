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
import crypto from 'crypto';
import { registerDeviceToken, unregisterDeviceToken } from '../services/pushNotificationService';
import { encryptPhone, phoneHashVariants, decrypt } from '../utils/encryption';
import { sendVerificationEmail } from '../services/emailService';
import { adminAuth } from '../config/firebase-admin';

const router = Router();

// ============================================================================
// POST /api/mobile/check-phone
// Check if phone number exists in database
// Returns: { exists: boolean }
// ============================================================================
router.post('/check-phone', async (req: Request, res: Response) => {
  try {
    const { phone, countryCode } = req.body;

    if (!phone) {
      return res.status(400).json({
        success: false,
        error: 'Phone number is required',
      });
    }

    // Normalize phone: remove spaces, dashes, parentheses
    let normalizedPhone = phone.replace(/[\s\-\(\)]/g, '').trim();
    
    // Build HMAC hash variants for matching against phoneHash column
    const hashes = phoneHashVariants(normalizedPhone, countryCode);
    console.log(`📱 check-phone: searching ${hashes.length} hash variants`);

    // Check if user exists with any of these phone hash variants
    const user = await prisma.user.findFirst({
      where: {
        phoneHash: { in: hashes },
      },
      select: {
        id: true,
      },
    });

    if (user) {
      return res.json({
        success: true,
        exists: true,
      });
    }

    return res.json({
      success: true,
      exists: false,
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
// Returns: { exists: boolean }
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
      },
    });

    return res.json({
      success: true,
      exists: !!user,
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
// Register a new user OR update existing user's phone from mobile app
// Cases:
//   1. Email exists in DB → Just add/update phone number for existing user
//   2. Email doesn't exist → Create new user with all provided info
// Expects: { firstName, lastName, email, phone, accessCodeId, facilityId?, firebaseUid? }
// ============================================================================
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { firstName, lastName, email, phone, accessCodeId, facilityId, firebaseUid } = req.body;

    // Validate required fields
    if (!email || !phone) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: email, phone',
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const normalizedPhone = phone.replace(/\s+/g, '').trim();

    // Check if email already exists in database
    const existingUser = await prisma.user.findFirst({
      where: { email: normalizedEmail },
    });

    // Access code validation — only required for NEW user creation
    let accessCode: any = null;
    if (accessCodeId) {
      accessCode = await prisma.organizationAccessCode.findFirst({
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
    } else if (!existingUser) {
      // No access code AND no existing user — can't create new user without access code
      return res.status(400).json({
        success: false,
        error: 'Access code is required for new user registration',
      });
    }

    // If facilityId provided, verify it belongs to the organization
    if (facilityId && accessCode) {
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

    // Encrypt the phone number
    const countryCodeDigits = (req.body.countryCode || '1').replace(/\D/g, '');
    let phoneDigits = normalizedPhone.replace(/\D/g, '');
    // If phone was sent in E.164 format (e.g., "+15551234567"), the digits
    // already include the country code. Strip it to avoid double-encoding.
    if (normalizedPhone.startsWith('+') && phoneDigits.startsWith(countryCodeDigits)) {
      phoneDigits = phoneDigits.substring(countryCodeDigits.length);
    }
    const { encryptedPhone, phoneHash } = encryptPhone(phoneDigits, countryCodeDigits);

    let user;

    if (existingUser) {
      // CASE 1: Email exists - Update existing user's phone number
      // Check if phone is already used by a DIFFERENT user
      const phoneInUse = await prisma.user.findFirst({
        where: { 
          phoneHash,
          id: { not: existingUser.id }
        },
      });

      if (phoneInUse) {
        return res.status(400).json({
          success: false,
          error: 'Phone number already registered to another user',
        });
      }

      // Update existing user with phone number (and firebaseUid if provided)
      user = await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          phone: encryptedPhone,
          phoneHash,
          firebaseUid: firebaseUid || existingUser.firebaseUid,
          updatedAt: new Date(),
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

      return res.status(200).json({
        success: true,
        isExistingUser: true,
        message: 'Phone number linked to existing account',
        user: {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phone: user.phone ? decrypt(user.phone) : null,
          role: user.role,
          organizationId: user.organizationId,
          facilityId: facilityId || null,
        },
      });

    } else {
      // CASE 2: Email doesn't exist - Create new user
      // Validate that first and last name are provided for new users
      if (!firstName || !lastName) {
        return res.status(400).json({
          success: false,
          error: 'First name and last name are required for new users',
        });
      }

      // Check if phone already exists via hash
      const existingPhoneUser = await prisma.user.findFirst({
        where: { phoneHash },
      });

      if (existingPhoneUser) {
        return res.status(400).json({
          success: false,
          error: 'Phone number already registered',
        });
      }

      // Create new user
      user = await prisma.user.create({
        data: {
          id: uuidv4(),
          updatedAt: new Date(),
          email: normalizedEmail,
          phone: encryptedPhone,
          phoneHash,
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

      // Increment access code usage count (only for new users)
      await prisma.organizationAccessCode.update({
        where: { id: accessCode.id },
        data: { usedCount: { increment: 1 } },
      });

      return res.status(201).json({
        success: true,
        isExistingUser: false,
        message: 'New account created successfully',
        user: {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phone: user.phone ? decrypt(user.phone) : null,
          role: user.role,
          organizationId: user.organizationId,
          facilityId: facilityId || null,
        },
      });
    }
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
    const { phone, firebaseUid, countryCode } = req.body;

    if (!phone || !firebaseUid) {
      return res.status(400).json({
        success: false,
        error: 'Phone and firebaseUid are required',
      });
    }

    // Verify Firebase ID token — caller must prove they own this firebaseUid
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Authorization token required',
      });
    }

    const idToken = authHeader.replace('Bearer ', '');
    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(idToken, true);
    } catch {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired token',
      });
    }

    // Ensure the verified token UID matches the claimed firebaseUid
    if (decodedToken.uid !== firebaseUid) {
      return res.status(403).json({
        success: false,
        error: 'Token UID does not match',
      });
    }

    console.log(`📱 link-firebase called for verified UID: ${decodedToken.uid}`);

    // Normalize phone: remove spaces, dashes, parentheses
    let normalizedPhone = phone.replace(/[\s\-\(\)]/g, '').trim();
    
    // Use phoneHash for matching (consistent with check-phone)
    const hashes = phoneHashVariants(normalizedPhone, countryCode);
    console.log(`📱 link-firebase: searching ${hashes.length} hash variants`);

    // Find user by phoneHash (supports encrypted phone storage)
    const user = await prisma.user.findFirst({
      where: { 
        phoneHash: { in: hashes }
      },
    });
    
    console.log(`📱 Found user:`, user ? { id: user.id, email: user.email } : 'null');

    if (!user) {
      console.log(`❌ link-firebase: No user found for phone variants`);
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
      console.log(`⚠️ link-firebase: Firebase UID already linked to user ${existingFirebaseUser.id}`);
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
        email: true,
        role: true,
        organizationId: true,
        defaultSiteId: true,
      },
    });
    
    console.log(`✅ link-firebase: Updated user ${updatedUser.id} with new Firebase UID`);

    return res.json({
      success: true,
      user: {
        id: updatedUser.id,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        email: updatedUser.email,
        role: updatedUser.role,
        organizationId: updatedUser.organizationId,
        facilityId: updatedUser.defaultSiteId,
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

// ============================================================================
// POST /api/mobile/device-token
// Register a device token for push notifications
// Body: { userId, token, platform?, deviceId?, appVersion? }
// ============================================================================
router.post('/device-token', async (req: Request, res: Response) => {
  try {
    // Verify Firebase ID token — only authenticated users can register tokens
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Authorization token required',
      });
    }

    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(authHeader.replace('Bearer ', ''), true);
    } catch {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired token',
      });
    }

    // Look up the authenticated user by Firebase UID
    const user = await prisma.user.findFirst({
      where: { firebaseUid: decodedToken.uid, isActive: true },
      select: { id: true },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    const userId = user.id;
    const { token, platform, deviceId, appVersion } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'token is required',
      });
    }

    // Register the device token
    const success = await registerDeviceToken(
      user.id,
      token,
      platform || 'IOS',
      deviceId,
      appVersion
    );

    if (success) {
      console.log(`✅ Device token registered for user ${user.id}`);
      return res.json({
        success: true,
        message: 'Device token registered successfully',
      });
    } else {
      return res.status(500).json({
        success: false,
        error: 'Failed to register device token',
      });
    }
  } catch (error: any) {
    console.error('Device token registration error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to register device token',
    });
  }
});

// ============================================================================
// DELETE /api/mobile/device-token
// Unregister a device token (e.g., on logout)
// Body: { userId, token }
// ============================================================================
router.delete('/device-token', async (req: Request, res: Response) => {
  try {
    // Verify Firebase ID token — only authenticated users can unregister tokens
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Authorization token required',
      });
    }

    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(authHeader.replace('Bearer ', ''), true);
    } catch {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired token',
      });
    }

    // Look up the authenticated user by Firebase UID
    const user = await prisma.user.findFirst({
      where: { firebaseUid: decodedToken.uid, isActive: true },
      select: { id: true },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'token is required',
      });
    }

    // Unregister the device token using authenticated userId
    const success = await unregisterDeviceToken(user.id, token);

    if (success) {
      console.log(`✅ Device token unregistered for user ${user.id}`);
      return res.json({
        success: true,
        message: 'Device token unregistered successfully',
      });
    } else {
      return res.status(500).json({
        success: false,
        error: 'Failed to unregister device token',
      });
    }
  } catch (error: any) {
    console.error('Device token unregistration error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to unregister device token',
    });
  }
});

// ============================================================================
// POST /api/mobile/send-verification
// Send a 6-digit OTP to the user's email for mobile phone verification
// Body: { userId, email }
// Security: cryptographically random OTP, hashed (SHA-256) in DB,
//   10-min TTL, max 5 attempts, rate-limited (3 per email/hour)
// ============================================================================
router.post('/send-verification', async (req: Request, res: Response) => {
  try {
    const { userId, email } = req.body;

    if (!userId || !email) {
      return res.status(400).json({
        success: false,
        error: 'userId and email are required',
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Verify user exists and email matches
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, firstName: true, phoneVerified: true },
    });

    if (!user || user.email.toLowerCase() !== normalizedEmail) {
      // Normalize timing — don't reveal whether user exists
      await new Promise(r => setTimeout(r, 200 + Math.random() * 300));
      return res.status(400).json({
        success: false,
        error: 'Invalid request',
      });
    }

    // Rate limit: max 3 OTPs per email per hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentCount = await prisma.mobileVerification.count({
      where: {
        email: normalizedEmail,
        createdAt: { gte: oneHourAgo },
      },
    });

    if (recentCount >= 3) {
      return res.status(429).json({
        success: false,
        error: 'Too many verification requests. Please try again later.',
      });
    }

    // Invalidate all previous unused OTPs for this user (replay prevention)
    await prisma.mobileVerification.updateMany({
      where: {
        userId,
        used: false,
      },
      data: { used: true },
    });

    // Generate cryptographically random 6-digit OTP
    const code = crypto.randomInt(100000, 999999).toString();
    const codeHash = crypto.createHash('sha256').update(code).digest('hex');

    // Store hashed OTP with 10-minute expiry
    await prisma.mobileVerification.create({
      data: {
        id: uuidv4(),
        userId,
        email: normalizedEmail,
        codeHash,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
      },
    });

    // Send email via Resend
    const sent = await sendVerificationEmail(normalizedEmail, code, user.firstName);

    if (!sent) {
      return res.status(500).json({
        success: false,
        error: 'Failed to send verification email. Please try again.',
      });
    }

    return res.json({
      success: true,
      message: 'Verification code sent to your email',
    });
  } catch (error: any) {
    console.error('Send verification error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to send verification code',
    });
  }
});

// ============================================================================
// POST /api/mobile/verify-code
// Verify the 6-digit OTP code for mobile phone login
// Body: { userId, code, deviceModel?, osVersion? }
// On success: marks phoneVerified = true, returns user profile
// ============================================================================
router.post('/verify-code', async (req: Request, res: Response) => {
  try {
    const { userId, code, deviceModel, osVersion } = req.body;

    if (!userId || !code) {
      return res.status(400).json({
        success: false,
        error: 'userId and code are required',
      });
    }

    const codeHash = crypto.createHash('sha256').update(code.trim()).digest('hex');

    // Find the most recent unused, non-expired verification for this user
    const verification = await prisma.mobileVerification.findFirst({
      where: {
        userId,
        used: false,
        expiresAt: { gte: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!verification) {
      return res.status(400).json({
        success: false,
        error: 'No active verification code. Please request a new one.',
      });
    }

    // Brute-force protection: max 5 attempts per code
    if (verification.attempts >= 5) {
      // Burn the code
      await prisma.mobileVerification.update({
        where: { id: verification.id },
        data: { used: true },
      });
      return res.status(429).json({
        success: false,
        error: 'Too many attempts. Please request a new verification code.',
      });
    }

    // Increment attempt count
    await prisma.mobileVerification.update({
      where: { id: verification.id },
      data: { attempts: { increment: 1 } },
    });

    // Constant-time comparison to prevent timing attacks
    const isValid = crypto.timingSafeEqual(
      Buffer.from(codeHash, 'hex'),
      Buffer.from(verification.codeHash, 'hex')
    );

    if (!isValid) {
      const remaining = 5 - (verification.attempts + 1);
      return res.status(400).json({
        success: false,
        error: remaining > 0
          ? `Invalid code. ${remaining} attempt(s) remaining.`
          : 'Invalid code. Please request a new verification code.',
      });
    }

    // Mark OTP as used (single-use)
    await prisma.mobileVerification.update({
      where: { id: verification.id },
      data: { used: true },
    });

    // Mark user's phone as verified
    const user = await prisma.user.update({
      where: { id: userId },
      data: { phoneVerified: true },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        organizationId: true,
        phone: true,
        phoneVerified: true,
        profilePicture: true,
      },
    });

    console.log(`✅ Mobile verification complete for user ${userId}`);

    return res.json({
      success: true,
      message: 'Account verified successfully',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        organizationId: user.organizationId,
        phone: user.phone ? decrypt(user.phone) : null,
        phoneVerified: user.phoneVerified,
        profilePicture: user.profilePicture,
      },
    });
  } catch (error: any) {
    console.error('Verify code error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to verify code',
    });
  }
});

export default router;
