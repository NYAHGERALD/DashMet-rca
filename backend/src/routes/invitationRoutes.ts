/**
 * Invitation Routes — Invitation-Only Registration System
 *
 * Flow:
 *   1. System Admin creates Organization → invites first ADMIN
 *   2. ADMIN invites employees with specific roles to their organization
 *   3. Invitee receives email with secure link containing token
 *   4. Invitee clicks link → registers with Firebase → calls /create-profile with token
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
import crypto from 'crypto';
import { prisma } from '../utils/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requireMinimumRole } from '../middleware/rbac';
import { UserRole } from '@prisma/client';
import { ValidationError } from '../middleware/errorHandler';
import { sendEmailNotification } from '../services/notificationService';
import { v4 as uuidv4 } from 'uuid';

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
      <h2 style="color: #1a1a2e;">You've Been Invited to DashMet RCA</h2>
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
      <p style="color: #999; font-size: 12px;">DashMet RCA — Enterprise Food Safety & Root Cause Analysis</p>
    </div>
  `;
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/invitations — Send invitation
// ADMIN can invite to own org. SYSTEM_ADMIN can invite to any org.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/', authenticate, requireMinimumRole(UserRole.ADMIN), async (req: AuthRequest, res: Response) => {
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
    subject: `You've been invited to join ${org.name} on DashMet RCA`,
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
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/invitations — List invitations for caller's organization
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', authenticate, requireMinimumRole(UserRole.ADMIN), async (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const { status } = req.query;

  const where: any = {};

  if (user.role === 'SYSTEM_ADMIN') {
    // System admin can see all invitations, optionally filtered by orgId
    if (req.query.organizationId) {
      where.organizationId = req.query.organizationId;
    }
  } else {
    // ADMIN sees only their organization's invitations
    where.organizationId = user.organizationId;
  }

  if (status) {
    where.status = status;
  }

  // Auto-expire stale invitations
  await prisma.invitation.updateMany({
    where: {
      status: 'PENDING',
      expiresAt: { lt: new Date() },
    },
    data: { status: 'EXPIRED' },
  });

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
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/invitations/:token/validate — Validate invitation token (PUBLIC)
// Called by frontend when user lands on /accept-invite?token=xxx
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:token/validate', async (req: Request, res: Response) => {
  const { token } = req.params;

  if (!token || token.length !== 64) {
    throw new ValidationError('Invalid invitation token');
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

  res.json({
    success: true,
    data: {
      email: invitation.email,
      role: invitation.role,
      organizationName: invitation.Organization.name,
      organizationId: invitation.organizationId,
      facilityId: invitation.facilityId,
      expiresAt: invitation.expiresAt,
    },
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/invitations/:id/revoke — Revoke a pending invitation
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/:id/revoke', authenticate, requireMinimumRole(UserRole.ADMIN), async (req: AuthRequest, res: Response) => {
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

  if (invitation.status !== 'PENDING') {
    throw new ValidationError(`Cannot revoke an invitation that is already ${invitation.status.toLowerCase()}`);
  }

  const updated = await prisma.invitation.update({
    where: { id },
    data: { status: 'REVOKED', revokedAt: new Date() },
  });

  res.json({ success: true, data: updated });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/invitations/resend/:id — Resend invitation email
// ─────────────────────────────────────────────────────────────────────────────
router.post('/resend/:id', authenticate, requireMinimumRole(UserRole.ADMIN), async (req: AuthRequest, res: Response) => {
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
    subject: `Reminder: You've been invited to join ${invitation.Organization.name} on DashMet RCA`,
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
});

export default router;
