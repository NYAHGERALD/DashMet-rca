/**
 * Invitation Routes — Invitation-Only Registration System
 *
 * Flow:
 *   1. System Admin creates Organization → invites first ADMIN
 *   2. ADMIN invites employees with specific roles to their organization
 *   3. Invitee receives email with secure link containing token
 *   4. Invitee clicks link → accepts invite and creates backend-owned credentials
 *   5. Profile creation uses invitation to assign org, role, facility automatically
 *
 * Endpoints:
 *   POST   /api/invitations              — Send invitation (ADMIN+ for own org, SYSTEM_ADMIN for any org)
 *   GET    /api/invitations              — List invitations for caller's org (ADMIN+)
 *   GET    /api/invitations/:token/validate — Validate invitation token (PUBLIC — used by frontend signup page)
 *   PATCH  /api/invitations/:id/revoke   — Revoke a pending invitation (ADMIN+)
 *   POST   /api/invitations/resend/:id   — Resend invitation email (ADMIN+)
 */

import { Router, Request, Response } from 'express';
import asyncHandler from 'express-async-handler';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '../utils/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requireMinimumRole } from '../middleware/rbac';
import { UserRole } from '@prisma/client';
import { ValidationError } from '../middleware/errorHandler';
import { sendEmailNotification } from '../services/notificationService';
import { v4 as uuidv4 } from 'uuid';
import { authRateLimiter } from '../middleware/rateLimiter';
import { encryptPhone } from '../utils/encryption';
import { assertPasswordPolicy } from '../utils/passwordPolicy';
import { websocketService } from '../services/websocketService';

const router = Router();

const INVITATION_EXPIRY_HOURS = 48;

// All valid roles that can be invited (excludes SYSTEM_ADMIN — only seed-created)
const INVITABLE_ROLES: UserRole[] = [
  'OPERATOR',
  'SUPERVISOR',
  'QA_FOOD_SAFETY',
  'MAINTENANCE_ENGINEERING',
  'CI_MANAGER',
  'SAFETY_SECURITY_MANAGER',
  'QUALITY_CONTROL_MANAGER',
  'ADMIN',
];

type InvitationStatusKey = 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'REVOKED';

interface InvitationStatusCounts {
  pending: number;
  accepted: number;
  expired: number;
  revoked: number;
}

function emptyInvitationStatusCounts(): InvitationStatusCounts {
  return { pending: 0, accepted: 0, expired: 0, revoked: 0 };
}

function generateSecureToken(): string {
  return crypto.randomBytes(32).toString('hex'); // 64-char hex
}

function getInvitationExpiryDate(): Date {
  return new Date(Date.now() + INVITATION_EXPIRY_HOURS * 60 * 60 * 1000);
}

function buildInvitationLink(token: string): string {
  const baseUrl = process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3000';
  return `${baseUrl}/accept-invite?token=${token}`;
}

function buildInvitationEmailHtml(inviterName: string, orgName: string, role: string, link: string, expiryHours: number): string {
  const roleDisplay = role.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #1a1a2e;">You've Been Invited to DashMet Operations Intelligence</h2>
      <p><strong>${inviterName}</strong> has invited you to join <strong>${orgName}</strong> as a <strong>${roleDisplay}</strong>.</p>
      <p>Click the button below to accept the invitation and create your account:</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${link}" style="background-color: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold;">
          Accept Invitation
        </a>
      </div>
      <p style="color: #666; font-size: 14px;">This invitation expires in ${expiryHours} hours.</p>
      <p style="color: #666; font-size: 14px;">If you didn't expect this invitation, you can safely ignore this email.</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
      <p style="color: #999; font-size: 12px;">DashMet Operations Intelligence — Enterprise Food Safety & Operations Management</p>
    </div>
  `;
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/invitations — Send invitation
// ADMIN can invite to own org. SYSTEM_ADMIN can invite to any org.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/', authenticate, requireMinimumRole(UserRole.ADMIN), asyncHandler(async (req: AuthRequest, res: Response) => {
  const { email, role, organizationId, facilityId } = req.body;
  const user = req.user!;

  // Validate required fields
  if (!email || !role) {
    throw new ValidationError('Email and role are required');
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new ValidationError('Invalid email address');
  }

  // Validate role is invitable
  if (!INVITABLE_ROLES.includes(role as UserRole)) {
    throw new ValidationError(`Invalid role. Allowed roles: ${INVITABLE_ROLES.join(', ')}`);
  }

  if (user.role === 'SYSTEM_ADMIN' && role !== 'ADMIN') {
    throw new ValidationError('System Admin can only invite organization admins');
  }

  // Determine target organization
  let targetOrgId: string;
  if (user.role === 'SYSTEM_ADMIN') {
    // System admin must specify organizationId
    if (!organizationId) {
      throw new ValidationError('Organization ID is required for System Admin invitations');
    }
    targetOrgId = organizationId;
  } else {
    // ADMIN can only invite to their own org
    if (organizationId && organizationId !== user.organizationId) {
      throw new ValidationError('You can only invite users to your own organization');
    }
    targetOrgId = user.organizationId;
  }

  // Verify organization exists and is active
  const org = await prisma.organization.findFirst({
    where: { id: targetOrgId, isActive: true },
  });
  if (!org) {
    throw new ValidationError('Organization not found or inactive');
  }

  // Verify facility exists if provided
  if (facilityId) {
    const facility = await prisma.facility.findFirst({
      where: { id: facilityId, organizationId: targetOrgId },
    });
    if (!facility) {
      throw new ValidationError('Facility not found in this organization');
    }
  }

  // Check if email is already registered in this organization
  const existingUser = await prisma.user.findFirst({
    where: { email: email.toLowerCase(), organizationId: targetOrgId, isActive: true },
  });
  if (existingUser) {
    throw new ValidationError('This email is already a member of this organization');
  }

  // Check for existing pending invitation for this email + org
  const existingInvite = await prisma.invitation.findFirst({
    where: {
      email: email.toLowerCase(),
      organizationId: targetOrgId,
      status: 'PENDING',
      expiresAt: { gt: new Date() },
    },
  });
  if (existingInvite) {
    throw new ValidationError('A pending invitation already exists for this email. Revoke it first or wait for it to expire.');
  }

  // Generate secure token and create invitation
  const token = generateSecureToken();
  const expiresAt = getInvitationExpiryDate();

  const invitation = await prisma.invitation.create({
    data: {
      id: uuidv4(),
      token,
      email: email.toLowerCase(),
      role: role as UserRole,
      organizationId: targetOrgId,
      facilityId: facilityId || null,
      expiresAt,
      invitedById: user.id,
    },
    include: {
      Organization: { select: { name: true } },
    },
  });

  // Build invitation link and send email
  const invitationLink = buildInvitationLink(token);
  const inviterName = `${user.firstName} ${user.lastName}`;

  const emailResult = await sendEmailNotification({
    to: email.toLowerCase(),
    subject: `You've been invited to join ${org.name} on DashMet Operations Intelligence`,
    body: `${inviterName} has invited you to join ${org.name} as a ${role.replace(/_/g, ' ')}. Accept your invitation here: ${invitationLink}`,
    html: buildInvitationEmailHtml(inviterName, org.name, role, invitationLink, INVITATION_EXPIRY_HOURS),
  });

  res.status(201).json({
    success: true,
    data: {
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      organizationName: org.name,
      expiresAt: invitation.expiresAt,
      invitationLink, // Included so admin can also share link manually
      emailSent: emailResult.success,
    },
  });
}));

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/invitations — List invitations for caller's organization
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', authenticate, requireMinimumRole(UserRole.ADMIN), asyncHandler(async (req: AuthRequest, res: Response) => {
  const user = req.user!;

  // Auto-expire stale invitations
  await prisma.invitation.updateMany({
    where: {
      status: 'PENDING',
      expiresAt: { lt: new Date() },
    },
    data: { status: 'EXPIRED' },
  });

  if (user.role === 'SYSTEM_ADMIN') {
    const organizationIdFilter = typeof req.query.organizationId === 'string'
      ? req.query.organizationId
      : undefined;

    const [organizations, groupedInvitations] = await Promise.all([
      prisma.organization.findMany({
        where: organizationIdFilter ? { id: organizationIdFilter } : {},
        select: {
          id: true,
          name: true,
          region: true,
          createdAt: true,
          _count: {
            select: {
              User: true,
              Facility: true,
              Invitations: true,
            },
          },
        },
        orderBy: { name: 'asc' },
      }),
      prisma.invitation.groupBy({
        by: ['organizationId', 'status'],
        ...(organizationIdFilter ? { where: { organizationId: organizationIdFilter } } : {}),
        _count: { _all: true },
      }),
    ]);

    const countsByOrganization = new Map<string, InvitationStatusCounts>();
    for (const group of groupedInvitations) {
      const statusCounts = countsByOrganization.get(group.organizationId) || emptyInvitationStatusCounts();
      const count = group._count._all;
      const status = group.status as InvitationStatusKey;
      if (status === 'PENDING') statusCounts.pending = count;
      if (status === 'ACCEPTED') statusCounts.accepted = count;
      if (status === 'EXPIRED') statusCounts.expired = count;
      if (status === 'REVOKED') statusCounts.revoked = count;
      countsByOrganization.set(group.organizationId, statusCounts);
    }

    const organizationSummaries = organizations.map((org) => {
      const invitationCounts = countsByOrganization.get(org.id) || emptyInvitationStatusCounts();
      return {
        organizationName: org.name,
        region: org.region,
        createdAt: org.createdAt,
        userCount: org._count.User,
        facilityCount: org._count.Facility,
        invitationCounts: {
          total: org._count.Invitations,
          pending: invitationCounts.pending,
          accepted: invitationCounts.accepted,
          expired: invitationCounts.expired,
          revoked: invitationCounts.revoked,
        },
      };
    });

    res.json({
      success: true,
      data: {
        mode: 'ORGANIZATION_SUMMARY',
        organizations: organizationSummaries,
      },
    });
    return;
  }

  const where: any = {
    organizationId: user.organizationId,
  };

  if (typeof req.query.status === 'string' && req.query.status) {
    where.status = req.query.status;
  }

  const invitations = await prisma.invitation.findMany({
    where,
    include: {
      Organization: { select: { name: true } },
      InvitedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      AcceptedUser: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  res.json({ success: true, data: invitations });
}));

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/invitations/:token/validate — Validate invitation token (PUBLIC)
// Called by frontend when user lands on /accept-invite?token=xxx
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:token/validate', asyncHandler(async (req: Request, res: Response) => {
  const { token } = req.params;

  if (!token || token.length !== 64) {
    throw new ValidationError('Invalid invitation token');
  }

  const invitation = await prisma.invitation.findUnique({
    where: { token },
    include: {
      Organization: { select: { name: true } },
      InvitedBy: { select: { firstName: true, lastName: true } },
    },
  });

  if (!invitation) {
    throw new ValidationError('Invitation not found');
  }

  // Check expiry
  if (invitation.expiresAt < new Date()) {
    if (invitation.status === 'PENDING') {
      await prisma.invitation.update({
        where: { id: invitation.id },
        data: { status: 'EXPIRED' },
      });
    }
    throw new ValidationError('This invitation has expired');
  }

  if (invitation.status !== 'PENDING') {
    throw new ValidationError(`This invitation has already been ${invitation.status.toLowerCase()}`);
  }

  const facility = invitation.facilityId
    ? await prisma.facility.findFirst({
        where: {
          id: invitation.facilityId,
          organizationId: invitation.organizationId,
        },
        select: { name: true },
      })
    : null;

  res.json({
    success: true,
    data: {
      email: invitation.email,
      role: invitation.role,
      organizationName: invitation.Organization.name,
      organizationId: invitation.organizationId,
      facilityId: invitation.facilityId,
      facilityName: facility?.name || null,
      invitedBy: `${invitation.InvitedBy.firstName} ${invitation.InvitedBy.lastName}`,
      expiresAt: invitation.expiresAt,
    },
  });
}));

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/invitations/:token/accept — Accept invitation and create DB account
// This replaces the old Firebase Auth account creation step.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:token/accept', authRateLimiter, asyncHandler(async (req: Request, res: Response) => {
  const { token } = req.params;
  const { firstName, lastName, password, phone, countryCode } = req.body;

  if (!token || token.length !== 64) {
    throw new ValidationError('Invalid invitation token');
  }

  if (!firstName || !lastName || !password) {
    throw new ValidationError('First name, last name, and password are required');
  }

  const invitation = await prisma.invitation.findUnique({
    where: { token },
    include: {
      Organization: { select: { name: true } },
    },
  });

  if (!invitation) {
    throw new ValidationError('Invitation not found');
  }

  if (invitation.expiresAt < new Date()) {
    if (invitation.status === 'PENDING') {
      await prisma.invitation.update({
        where: { id: invitation.id },
        data: { status: 'EXPIRED' },
      });
    }
    throw new ValidationError('This invitation has expired');
  }

  if (invitation.status !== 'PENDING') {
    throw new ValidationError(`This invitation has already been ${invitation.status.toLowerCase()}`);
  }

  const passwordPolicyError = assertPasswordPolicy(password, [
    invitation.email,
    firstName,
    lastName,
  ]);
  if (passwordPolicyError) {
    throw new ValidationError(passwordPolicyError);
  }

  const existingUserByEmail = await prisma.user.findUnique({
    where: { email: invitation.email },
    select: { id: true },
  });

  if (existingUserByEmail) {
    throw new ValidationError('This email is already registered. Please sign in or ask your administrator for help.');
  }

  let phoneData: { phone?: string; phoneHash?: string; phoneVerified?: boolean; initialPhoneHash?: string } = {};
  if (phone && countryCode) {
    const digits = String(phone).replace(/\D/g, '');
    if (digits.length < 10 || digits.length > 15) {
      throw new ValidationError('Phone number must be between 10 and 15 digits');
    }

    const { encryptedPhone, phoneHash } = encryptPhone(digits, String(countryCode));
    const existingPhone = await prisma.user.findUnique({ where: { phoneHash } });
    if (existingPhone) {
      throw new ValidationError('This phone number is already registered to another account');
    }

    phoneData = {
      phone: encryptedPhone,
      phoneHash,
      phoneVerified: true,
      initialPhoneHash: phoneHash,
    };
  }

  const hashedPassword = await bcrypt.hash(
    password,
    parseInt(process.env.BCRYPT_ROUNDS || '12', 10)
  );

  const user = await prisma.$transaction(async (tx) => {
    const createdUser = await tx.user.create({
      data: {
        id: uuidv4(),
        updatedAt: new Date(),
        email: invitation.email,
        password: hashedPassword,
        firstName: String(firstName).trim(),
        lastName: String(lastName).trim(),
        role: invitation.role,
        organizationId: invitation.organizationId,
        defaultSiteId: invitation.facilityId || null,
        emailVerified: true,
        ...phoneData,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        organizationId: true,
        defaultSiteId: true,
        theme: true,
        language: true,
        profilePicture: true,
      },
    });

    await tx.invitation.update({
      where: { id: invitation.id },
      data: {
        status: 'ACCEPTED',
        acceptedAt: new Date(),
        acceptedUserId: createdUser.id,
      },
    });

    return createdUser;
  });

  if (
    (invitation.role === 'QA_FOOD_SAFETY' || invitation.role === 'QUALITY_CONTROL_MANAGER') &&
    invitation.organizationId
  ) {
    const openReports = await prisma.foreignMaterialIncident.findMany({
      where: {
        organizationId: invitation.organizationId,
        status: { not: 'CLOSED' },
      },
      select: {
        id: true,
        collaboratorIds: true,
        createdById: true,
      },
    });

    const updatedReportIds: string[] = [];
    for (const report of openReports) {
      const existingIds = report.collaboratorIds || [];
      if (report.createdById !== user.id && !existingIds.includes(user.id)) {
        await prisma.foreignMaterialIncident.update({
          where: { id: report.id },
          data: { collaboratorIds: [...existingIds, user.id] },
        });
        updatedReportIds.push(report.id);
      }
    }

    if (updatedReportIds.length > 0) {
      websocketService.emitToOrganization(invitation.organizationId, 'fmir:collaborator-added', {
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
    }
  }

  res.status(201).json({
    success: true,
    data: { user },
  });
}));

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/invitations/:id/revoke — Revoke a pending invitation
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/:id/revoke', authenticate, requireMinimumRole(UserRole.ADMIN), asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const user = req.user!;

  const invitation = await prisma.invitation.findUnique({
    where: { id },
  });

  if (!invitation) {
    throw new ValidationError('Invitation not found');
  }

  // ADMIN can only revoke invitations for their own org
  if (user.role !== 'SYSTEM_ADMIN' && invitation.organizationId !== user.organizationId) {
    throw new ValidationError('You can only revoke invitations for your own organization');
  }

  if (user.role === 'SYSTEM_ADMIN' && invitation.role !== 'ADMIN') {
    throw new ValidationError('System Admin can only manage organization admin invitations');
  }

  if (invitation.status !== 'PENDING') {
    throw new ValidationError(`Cannot revoke an invitation that is already ${invitation.status.toLowerCase()}`);
  }

  const updated = await prisma.invitation.update({
    where: { id },
    data: { status: 'REVOKED', revokedAt: new Date() },
  });

  res.json({ success: true, data: updated });
}));

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/invitations/resend/:id — Resend invitation email
// ─────────────────────────────────────────────────────────────────────────────
router.post('/resend/:id', authenticate, requireMinimumRole(UserRole.ADMIN), asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const user = req.user!;

  const invitation = await prisma.invitation.findUnique({
    where: { id },
    include: { Organization: { select: { name: true } } },
  });

  if (!invitation) {
    throw new ValidationError('Invitation not found');
  }

  if (user.role !== 'SYSTEM_ADMIN' && invitation.organizationId !== user.organizationId) {
    throw new ValidationError('Access denied');
  }

  if (user.role === 'SYSTEM_ADMIN' && invitation.role !== 'ADMIN') {
    throw new ValidationError('System Admin can only manage organization admin invitations');
  }

  if (invitation.status !== 'PENDING') {
    throw new ValidationError('Can only resend pending invitations');
  }

  // If expired, generate a new token and extend expiry
  let token = invitation.token;
  if (invitation.expiresAt < new Date()) {
    token = generateSecureToken();
    await prisma.invitation.update({
      where: { id },
      data: {
        token,
        expiresAt: getInvitationExpiryDate(),
      },
    });
  }

  const invitationLink = buildInvitationLink(token);
  const inviterName = `${user.firstName} ${user.lastName}`;

  const emailResult = await sendEmailNotification({
    to: invitation.email,
    subject: `Reminder: You've been invited to join ${invitation.Organization.name} on DashMet Operations Intelligence`,
    body: `${inviterName} is reminding you to accept your invitation to join ${invitation.Organization.name}. Accept here: ${invitationLink}`,
    html: buildInvitationEmailHtml(inviterName, invitation.Organization.name, invitation.role, invitationLink, INVITATION_EXPIRY_HOURS),
  });

  res.json({
    success: true,
    data: {
      emailSent: emailResult.success,
      invitationLink,
    },
  });
}));

export default router;
