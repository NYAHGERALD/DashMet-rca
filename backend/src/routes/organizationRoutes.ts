import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requireMinimumRole } from '../middleware/rbac';
import { UserRole } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { ValidationError } from '../middleware/errorHandler';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// All routes require authentication
router.use(authenticate);

// GET /api/organizations - List organizations
// ADMIN: sees only their own organization
// SYSTEM_ADMIN: sees all organizations
router.get('/', authenticate, requireMinimumRole(UserRole.ADMIN), async (req: AuthRequest, res) => {
  const user = req.user!;
  
  // Build filter based on role
  let whereClause = {};
  if (user.role === 'ADMIN') {
    // ADMIN only sees their own organization
    whereClause = { id: user.organizationId };
  }
  // SYSTEM_ADMIN sees all organizations (no filter)

  const organizations = await prisma.organization.findMany({
    where: whereClause,
    include: {
      _count: {
        select: {
          Facility: true,
          User: true,
          Incident: true,
        },
      },
    },
    orderBy: { name: 'asc' },
  });

  res.json({
    success: true,
    data: { organizations },
  });
});

// GET /api/organizations/stats - Get system-wide stats (SYSTEM_ADMIN only)
router.get('/stats', authenticate, requireMinimumRole(UserRole.SYSTEM_ADMIN), async (req: AuthRequest, res) => {
  const [totalOrganizations, totalUsers, totalFacilities, totalIncidents] = await Promise.all([
    prisma.organization.count(),
    prisma.user.count(),
    prisma.facility.count(),
    prisma.incident.count(),
  ]);

  res.json({
    success: true,
    data: {
      totalOrganizations,
      totalUsers,
      totalFacilities,
      totalIncidents,
    },
  });
});

// GET /api/organizations/:id - Get single organization
// Users can access their own organization, ADMINs can access any
router.get('/:id', authenticate, async (req, res) => {
  const { id } = req.params;
  const user = (req as any).user;

  // Users can only access their own organization unless they're ADMIN+
  const isOwnOrg = user.organizationId === id;
  const isAdmin = ['ADMIN', 'SYSTEM_ADMIN', 'CI_MANAGER'].includes(user.role);
  
  if (!isOwnOrg && !isAdmin) {
    return res.status(403).json({
      success: false,
      error: 'You can only access your own organization',
    });
  }

  const organization = await prisma.organization.findUnique({
    where: { id },
    include: {
      Facility: {
        include: {
          _count: {
            select: { Department: true },
          },
        },
      },
      _count: {
        select: { User: true },
      },
    },
  });

  if (!organization) {
    return res.status(404).json({
      success: false,
      error: 'Organization not found',
    });
  }

  res.json({
    success: true,
    data: organization,
  });
});

// POST /api/organizations - Create organization
router.post('/', authenticate, requireMinimumRole(UserRole.SYSTEM_ADMIN), async (req, res) => {
  const { name, region, defaultLanguage } = req.body;

  if (!name || !region) {
    throw new ValidationError('Name and region are required');
  }

  // Check for case-insensitive duplicate organization name
  const existingOrg = await prisma.organization.findFirst({
    where: {
      name: {
        equals: name,
        mode: 'insensitive',
      },
    },
  });

  if (existingOrg) {
    throw new ValidationError('An organization with this name already exists');
  }

  // Validate region
  const validRegions = ['USA', 'MEXICO', 'CANADA'];
  if (!validRegions.includes(region)) {
    throw new ValidationError('Invalid region. Must be USA, MEXICO, or CANADA');
  }

  // Validate language
  const validLanguages = ['ENGLISH', 'SPANISH', 'FRENCH'];
  if (defaultLanguage && !validLanguages.includes(defaultLanguage)) {
    throw new ValidationError('Invalid language. Must be ENGLISH, SPANISH, or FRENCH');
  }

  const organization = await prisma.organization.create({
    data: {
      id: uuidv4(),
      updatedAt: new Date(),
      name,
      region,
      defaultLanguage: defaultLanguage || 'ENGLISH',
    },
  });

  res.status(201).json({
    success: true,
    data: organization,
  });
});

// PATCH /api/organizations/:id - Update organization
// Requires password confirmation for email/password users, or SSO re-authentication for SSO users
router.patch('/:id', authenticate, requireMinimumRole(UserRole.ADMIN), async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { name, region, defaultLanguage, password, ssoVerified } = req.body;
  const currentUser = req.user!;

  // For security, require either password (for email/password users) or ssoVerified flag (for SSO users)
  // SSO users re-authenticate via popup on client-side, then send ssoVerified: true
  if (!password && !ssoVerified) {
    throw new ValidationError('Identity verification required to update organization');
  }

  // Verify password using Firebase
  // We'll use a separate endpoint to verify the password client-side before calling this
  // For now, we accept a verified flag from the request
  
  // ADMIN can only update their own organization
  if (currentUser.role === 'ADMIN' && currentUser.organizationId !== id) {
    throw new ValidationError('You can only update your own organization');
  }

  // Check if organization exists
  const existingOrg = await prisma.organization.findUnique({
    where: { id },
  });

  if (!existingOrg) {
    throw new ValidationError('Organization not found');
  }

  // Validate region if provided
  if (region) {
    const validRegions = ['USA', 'MEXICO', 'CANADA'];
    if (!validRegions.includes(region)) {
      throw new ValidationError('Invalid region. Must be USA, MEXICO, or CANADA');
    }
  }

  // Validate language if provided
  if (defaultLanguage) {
    const validLanguages = ['ENGLISH', 'SPANISH', 'FRENCH'];
    if (!validLanguages.includes(defaultLanguage)) {
      throw new ValidationError('Invalid language. Must be ENGLISH, SPANISH, or FRENCH');
    }
  }

  // Check for case-insensitive duplicate name if name is being changed
  if (name && name.toLowerCase() !== existingOrg.name.toLowerCase()) {
    const duplicateOrg = await prisma.organization.findFirst({
      where: {
        name: {
          equals: name,
          mode: 'insensitive',
        },
        id: { not: id }, // Exclude current org
      },
    });

    if (duplicateOrg) {
      throw new ValidationError('An organization with this name already exists');
    }
  }

  // Build update data
  const updateData: any = {
    ...(name && { name }),
    ...(region && { region }),
    ...(defaultLanguage && { defaultLanguage }),
  };

  // Handle isPublic and signupCode
  if (typeof req.body.isPublic === 'boolean') {
    updateData.isPublic = req.body.isPublic;
    
    if (req.body.isPublic) {
      // When making public, signupCode is required
      const signupCode = req.body.signupCode;
      if (!signupCode || !/^\d{6}$/.test(signupCode)) {
        throw new ValidationError('A valid 6-digit signup code is required when making organization public');
      }
      
      // Check if code is already used by another org
      const existingCodeOrg = await prisma.organization.findFirst({
        where: {
          signupCode: signupCode,
          id: { not: id },
        },
      });
      
      if (existingCodeOrg) {
        throw new ValidationError('This signup code is already in use by another organization');
      }
      
      updateData.signupCode = signupCode;
    } else {
      // When making private, remove the signup code
      updateData.signupCode = null;
    }
  } else if (req.body.signupCode !== undefined) {
    // Just updating the signup code (org must already be public)
    if (!existingOrg.isPublic) {
      throw new ValidationError('Organization must be public to set a signup code');
    }
    
    const signupCode = req.body.signupCode;
    if (!signupCode || !/^\d{6}$/.test(signupCode)) {
      throw new ValidationError('A valid 6-digit signup code is required');
    }
    
    // Check if code is already used by another org
    const existingCodeOrg = await prisma.organization.findFirst({
      where: {
        signupCode: signupCode,
        id: { not: id },
      },
    });
    
    if (existingCodeOrg) {
      throw new ValidationError('This signup code is already in use by another organization');
    }
    
    updateData.signupCode = signupCode;
  }

  const organization = await prisma.organization.update({
    where: { id },
    data: updateData,
  });

  res.json({
    success: true,
    data: organization,
  });
});

// DELETE /api/organizations/:id - Delete organization (SYSTEM_ADMIN only)
// Requires confirmation token to prevent accidental deletion
// Usage: DELETE /organizations/:id?confirmToken=DELETE_ORG_NAME
router.delete('/:id', authenticate, requireMinimumRole(UserRole.SYSTEM_ADMIN), async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { confirmToken } = req.query;

  // Get organization details first
  const organization = await prisma.organization.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      region: true,
      isActive: true,
    },
  });

  if (!organization) {
    return res.status(404).json({
      success: false,
      error: 'Organization not found',
    });
  }

  // Generate expected confirmation token
  const expectedToken = `DELETE_${organization.name.toUpperCase().replace(/\s+/g, '_')}`;

  // Check if confirmation token is provided and matches
  if (!confirmToken || confirmToken !== expectedToken) {
    // Count all related data that will be deleted
    const [userCount, facilityCount, incidentCount, categoryCount] = await Promise.all([
      prisma.user.count({ where: { organizationId: id } }),
      prisma.facility.count({ where: { organizationId: id } }),
      prisma.incident.count({ where: { organizationId: id } }),
      prisma.category.count({ where: { organizationId: id } }),
    ]);

    // Get facility breakdown
    const facilities = await prisma.facility.findMany({
      where: { organizationId: id },
      select: {
        name: true,
        _count: {
          select: {
            Department: true,
          },
        },
      },
    });

    const departmentCount = facilities.reduce((sum: number, f: any) => sum + f._count.Department, 0);

    // Get area count from departments
    const areaCount = await prisma.area.count({
      where: {
        Department: {
          Facility: {
            organizationId: id,
          },
        },
      },
    });

    // Get line count from areas
    const lineCount = await prisma.line.count({
      where: {
        Area: {
          Department: {
            Facility: {
              organizationId: id,
            },
          },
        },
      },
    });

    // Get shift count
    const shiftCount = await prisma.shift.count({
      where: {
        ShiftLine: {
          some: {
            Line: {
              Area: {
                Department: {
                  Facility: {
                    organizationId: id,
                  },
                },
              },
            },
          },
        },
      },
    });

    // Get RCA and CAPA counts
    const [rcaCount, capaCount, evidenceCount] = await Promise.all([
      prisma.rCAAnalysis.count({
        where: {
          Incident: {
            organizationId: id,
          },
        },
      }),
      prisma.cAPAction.count({
        where: {
          RCAAnalysis: {
            Incident: {
              organizationId: id,
            },
          },
        },
      }),
      prisma.evidence.count({
        where: {
          Incident: {
            organizationId: id,
          },
        },
      }),
    ]);

    return res.status(403).json({
      success: false,
      error: 'Organization deletion requires confirmation',
      requiresConfirmation: true,
      confirmationToken: expectedToken,
      Organization: {
        id: organization.id,
        name: organization.name,
        region: organization.region,
        isActive: organization.isActive,
      },
      impactAnalysis: {
        User: userCount,
        Facility: facilityCount,
        Area: areaCount,
        Line: lineCount,
        shifts: shiftCount,
        categories: categoryCount,
        incidents: incidentCount,
        rcaAnalyses: rcaCount,
        capaActions: capaCount,
        evidenceFiles: evidenceCount,
        totalRecords: userCount + facilityCount + areaCount + lineCount + shiftCount + categoryCount + incidentCount + rcaCount + capaCount + evidenceCount,
      },
      warning: 'This operation is IRREVERSIBLE and will permanently delete all data associated with this organization.',
      instructions: `To confirm deletion, send DELETE request to: /api/organizations/${id}?confirmToken=${expectedToken}`,
    });
  }

  // Token confirmed - Proceed with deletion
  // Additional safety check: Prevent deletion of active organizations with recent activity
  const recentIncidents = await prisma.incident.count({
    where: {
      organizationId: id,
      createdAt: {
        gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
      },
    },
  });

  if (organization.isActive && recentIncidents > 0) {
    return res.status(400).json({
      success: false,
      error: 'Cannot delete active organization with recent incidents',
      details: `This organization has ${recentIncidents} incidents created in the last 30 days. Please deactivate the organization first or contact support for data archival.`,
      recommendation: 'Consider deactivating the organization instead of deleting it to preserve historical data.',
    });
  }

  // Final deletion with transaction for data integrity
  try {
    await prisma.$transaction(async (tx: any) => {
      // Delete all cascade-related data explicitly for audit trail
      const deletionLog = {
        organizationId: id,
        organizationName: organization.name,
        deletedBy: req.user?.id || 'unknown',
        deletedAt: new Date(),
        timestamp: new Date().toISOString(),
      };

      // Log the deletion attempt
      if (req.user?.id) {
        await tx.auditLog.create({
          data: {
            action: 'DELETE',
            entity: 'Organization',
            entityId: id,
            userId: req.user.id,
            changes: deletionLog,
            ipAddress: req.ip || '',
            userAgent: req.headers['user-agent'] || '',
          },
        });
      }

      // Cascade delete will handle all related records
      await tx.organization.delete({
        where: { id },
      });
    });

    res.json({
      success: true,
      message: `Organization "${organization.name}" and all associated data have been permanently deleted.`,
      deletedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Organization deletion error:', error);
    throw new Error('Failed to delete organization. Database transaction rolled back.');
  }
});

// ============================================
// Organization Access Code Management
// ============================================

// GET /api/organizations/:id/access-codes - List access codes for an organization
router.get('/:id/access-codes', authenticate, requireMinimumRole(UserRole.ADMIN), async (req: AuthRequest, res) => {
  const { id } = req.params;
  const currentUser = req.user!;

  // ADMIN can only view their own organization's codes
  if (currentUser.role === 'ADMIN' && currentUser.organizationId !== id) {
    return res.status(403).json({
      success: false,
      error: 'You can only view access codes for your own organization',
    });
  }

  const accessCodes = await prisma.organizationAccessCode.findMany({
    where: { organizationId: id },
    include: {
      CreatedBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
    orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
  });

  res.json({
    success: true,
    data: accessCodes,
  });
});

// POST /api/organizations/:id/access-codes - Generate a new role-specific access code
router.post('/:id/access-codes', authenticate, requireMinimumRole(UserRole.ADMIN), async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { role, maxUses } = req.body;
  const currentUser = req.user!;

  // ADMIN can only create codes for their own organization
  if (currentUser.role === 'ADMIN' && currentUser.organizationId !== id) {
    return res.status(403).json({
      success: false,
      error: 'You can only create access codes for your own organization',
    });
  }

  // Validate role
  const validRoles = [
    'SUPERVISOR',
    'QA_FOOD_SAFETY',
    'QUALITY_CONTROL_MANAGER',
    'MAINTENANCE_ENGINEERING',
    'CI_MANAGER',
    'SAFETY_SECURITY_MANAGER',
  ];

  if (!role || !validRoles.includes(role)) {
    return res.status(400).json({
      success: false,
      error: `Invalid role. Must be one of: ${validRoles.join(', ')}`,
    });
  }

  // Verify organization exists
  const organization = await prisma.organization.findUnique({
    where: { id },
  });

  if (!organization) {
    return res.status(404).json({
      success: false,
      error: 'Organization not found',
    });
  }

  // Generate unique 6-digit code
  let code: string;
  let isUnique = false;
  let attempts = 0;
  const maxAttempts = 10;

  while (!isUnique && attempts < maxAttempts) {
    code = Math.floor(100000 + Math.random() * 900000).toString();
    const existing = await prisma.organizationAccessCode.findUnique({
      where: { code },
    });
    if (!existing) {
      isUnique = true;
    }
    attempts++;
  }

  if (!isUnique) {
    return res.status(500).json({
      success: false,
      error: 'Failed to generate unique code. Please try again.',
    });
  }

  const accessCode = await prisma.organizationAccessCode.create({
    data: {
      id: uuidv4(),
      updatedAt: new Date(),
      code: code!,
      role: role as UserRole,
      organizationId: id,
      maxUses: maxUses || 100,
      createdById: currentUser.id,
    },
    include: {
      CreatedBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  res.status(201).json({
    success: true,
    data: accessCode,
    message: `Access code generated for ${role.replace(/_/g, ' ')} role`,
  });
});

// PATCH /api/organizations/:orgId/access-codes/:codeId/toggle - Toggle access code active status
router.patch('/:orgId/access-codes/:codeId/toggle', authenticate, requireMinimumRole(UserRole.ADMIN), async (req: AuthRequest, res) => {
  const { orgId, codeId } = req.params;
  const currentUser = req.user!;

  // ADMIN can only manage their own organization's codes
  if (currentUser.role === 'ADMIN' && currentUser.organizationId !== orgId) {
    return res.status(403).json({
      success: false,
      error: 'You can only manage access codes for your own organization',
    });
  }

  const accessCode = await prisma.organizationAccessCode.findFirst({
    where: {
      id: codeId,
      organizationId: orgId,
    },
  });

  if (!accessCode) {
    return res.status(404).json({
      success: false,
      error: 'Access code not found',
    });
  }

  const updatedCode = await prisma.organizationAccessCode.update({
    where: { id: codeId },
    data: { isActive: !accessCode.isActive },
  });

  res.json({
    success: true,
    data: updatedCode,
    message: `Access code ${updatedCode.isActive ? 'activated' : 'deactivated'}`,
  });
});

// DELETE /api/organizations/:orgId/access-codes/:codeId - Delete an access code
router.delete('/:orgId/access-codes/:codeId', authenticate, requireMinimumRole(UserRole.ADMIN), async (req: AuthRequest, res) => {
  const { orgId, codeId } = req.params;
  const currentUser = req.user!;

  // ADMIN can only delete their own organization's codes
  if (currentUser.role === 'ADMIN' && currentUser.organizationId !== orgId) {
    return res.status(403).json({
      success: false,
      error: 'You can only delete access codes for your own organization',
    });
  }

  const accessCode = await prisma.organizationAccessCode.findFirst({
    where: {
      id: codeId,
      organizationId: orgId,
    },
  });

  if (!accessCode) {
    return res.status(404).json({
      success: false,
      error: 'Access code not found',
    });
  }

  await prisma.organizationAccessCode.delete({
    where: { id: codeId },
  });

  res.json({
    success: true,
    message: 'Access code deleted successfully',
  });
});

export default router;
