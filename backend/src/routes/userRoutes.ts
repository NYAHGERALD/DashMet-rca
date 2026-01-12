import { Router } from 'express';
import asyncHandler from 'express-async-handler';
import { authenticate } from '../middleware/auth';
import { requireAdmin, requireSystemAdmin, requireMinimumRole } from '../middleware/rbac';
import { prisma } from '../utils/prisma';
import { AuthRequest } from '../middleware/auth';
import { adminStorage } from '../config/firebase-admin';
import multer from 'multer';

const router = Router();

// Configure multer for memory storage (we'll upload directly to Firebase)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept images only
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

// POST /api/users/profile-picture - Upload profile picture
router.post(
  '/profile-picture',
  authenticate,
  upload.single('profilePicture'),
  asyncHandler(async (req: AuthRequest, res): Promise<void> => {
    if (!req.file) {
      res.status(400).json({
        success: false,
        error: 'No image file provided',
      });
      return;
    }

    const userId = req.user!.id;
    const bucket = adminStorage.bucket();
    
    // Generate unique filename
    const timestamp = Date.now();
    const filename = `profile-pictures/${userId}/${timestamp}.jpg`;
    
    // Create file reference
    const file = bucket.file(filename);
    
    try {
      // Upload the buffer to Firebase Storage
      await file.save(req.file.buffer, {
        metadata: {
          contentType: req.file.mimetype,
          metadata: {
            userId: userId,
            uploadedAt: new Date().toISOString(),
          },
        },
      });

      // Make the file publicly accessible
      await file.makePublic();

      // Get the public URL
      const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filename}`;

      // Delete old profile picture if exists
      const existingUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { profilePicture: true },
      });

      if (existingUser?.profilePicture) {
        try {
          // Extract old filename from URL and delete
          const oldFilename = existingUser.profilePicture.split(`${bucket.name}/`)[1];
          if (oldFilename) {
            await bucket.file(oldFilename).delete().catch(() => {
              // Ignore errors when deleting old file
            });
          }
        } catch (e) {
          // Ignore cleanup errors
        }
      }

      // Update user record with new profile picture URL
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: { profilePicture: publicUrl },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          profilePicture: true,
        },
      });

      res.json({
        success: true,
        data: {
          profilePicture: publicUrl,
          user: updatedUser,
        },
        message: 'Profile picture updated successfully',
      });
    } catch (error) {
      console.error('Error uploading profile picture:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to upload profile picture',
      });
    }
  })
);

// DELETE /api/users/profile-picture - Remove profile picture
router.delete(
  '/profile-picture',
  authenticate,
  asyncHandler(async (req: AuthRequest, res): Promise<void> => {
    const userId = req.user!.id;
    
    // Get current profile picture
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { profilePicture: true },
    });

    if (user?.profilePicture) {
      try {
        const bucket = adminStorage.bucket();
        const filename = user.profilePicture.split(`${bucket.name}/`)[1];
        if (filename) {
          await bucket.file(filename).delete().catch(() => {
            // Ignore errors when deleting
          });
        }
      } catch (e) {
        // Ignore cleanup errors
      }
    }

    // Update user record to remove profile picture
    await prisma.user.update({
      where: { id: userId },
      data: { profilePicture: null },
    });

    res.json({
      success: true,
      message: 'Profile picture removed successfully',
    });
  })
);

// GET /api/users/me - Get current user profile
router.get(
  '/me',
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        profilePicture: true,
        organizationId: true,
        createdAt: true,
        lastLoginAt: true,
      },
    });

    if (!user) {
      res.status(404).json({
        success: false,
        error: 'User not found',
      });
      return;
    }

    res.json({
      success: true,
      data: { user },
    });
  })
);

// Phase 1.2: RBAC Test Routes

// GET /api/users - List users (Admin+ only)
router.get(
  '/',
  authenticate,
  requireAdmin,
  asyncHandler(async (req: AuthRequest, res) => {
    // SECURITY: All admins (including SYSTEM_ADMIN) only see users in their own organization
    // SYSTEM_ADMIN manages organizations, not individual users of other orgs
    const users = await prisma.user.findMany({
      where: { organizationId: req.user!.organizationId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        organizationId: true,
        createdAt: true,
        lastLoginAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      data: { users, count: users.length },
    });
  })
);

// GET /api/users/organization - Get all users in the same organization (for sharing)
router.get(
  '/organization',
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    const users = await prisma.user.findMany({
      where: {
        organizationId: req.user!.organizationId,
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        profilePicture: true,
      },
      orderBy: [
        { firstName: 'asc' },
        { lastName: 'asc' },
      ],
    });

    res.json({
      success: true,
      data: { users },
    });
  })
);

// GET /api/users/stats - User statistics (Supervisor+ only)
router.get(
  '/stats',
  authenticate,
  requireMinimumRole('SUPERVISOR'),
  asyncHandler(async (req: AuthRequest, res) => {
    // SECURITY: All users only see stats for their own organization
    const filter = { organizationId: req.user!.organizationId };

    const [total, active, byRole] = await Promise.all([
      prisma.user.count({ where: filter }),
      prisma.user.count({ where: { ...filter, isActive: true } }),
      prisma.user.groupBy({
        by: ['role'],
        where: filter,
        _count: true,
      }),
    ]);

    res.json({
      success: true,
      data: {
        total,
        active,
        inactive: total - active,
        byRole: byRole.map(r => ({ role: r.role, count: r._count })),
      },
    });
  })
);

// PATCH /api/users/:id/activate - Activate/deactivate user (Admin only)
router.patch(
  '/:id/activate',
  authenticate,
  requireAdmin,
  asyncHandler(async (req: AuthRequest, res): Promise<void> => {
    const { id } = req.params;
    const { isActive } = req.body;

    // Get target user
    const targetUser = await prisma.user.findUnique({
      where: { id },
      select: { organizationId: true, role: true },
    });

    if (!targetUser) {
      res.status(404).json({
        success: false,
        error: 'User not found',
      });
      return;
    }

    // Non-system-admins can only manage users in their org
    if (req.user!.role !== 'SYSTEM_ADMIN' && targetUser.organizationId !== req.user!.organizationId) {
      res.status(403).json({
        success: false,
        error: 'Cannot manage users from another organization',
      });
      return;
    }

    // Cannot deactivate yourself
    if (id === req.user!.id) {
      res.status(400).json({
        success: false,
        error: 'Cannot modify your own account status',
      });
      return;
    }

    const user = await prisma.user.update({
      where: { id },
      data: { isActive },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
      },
    });

    res.json({
      success: true,
      data: { user },
      message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
    });
  })
);

// PATCH /api/users/:id/role - Change user role (Admin only)
router.patch(
  '/:id/role',
  authenticate,
  requireAdmin,
  asyncHandler(async (req: AuthRequest, res): Promise<void> => {
    const { id } = req.params;
    const { role } = req.body;

    // Valid roles
    const validRoles = ['SUPERVISOR', 'QA_FOOD_SAFETY', 'MAINTENANCE_ENGINEERING', 'CI_MANAGER', 'SAFETY_SECURITY_MANAGER', 'ADMIN', 'SYSTEM_ADMIN'];
    
    if (!role || !validRoles.includes(role)) {
      res.status(400).json({
        success: false,
        error: `Invalid role. Must be one of: ${validRoles.join(', ')}`,
      });
      return;
    }

    // Get target user
    const targetUser = await prisma.user.findUnique({
      where: { id },
      select: { organizationId: true, role: true },
    });

    if (!targetUser) {
      res.status(404).json({
        success: false,
        error: 'User not found',
      });
      return;
    }

    // Non-system-admins can only manage users in their org
    if (req.user!.role !== 'SYSTEM_ADMIN' && targetUser.organizationId !== req.user!.organizationId) {
      res.status(403).json({
        success: false,
        error: 'Cannot manage users from another organization',
      });
      return;
    }

    // Cannot change your own role
    if (id === req.user!.id) {
      res.status(400).json({
        success: false,
        error: 'Cannot change your own role',
      });
      return;
    }

    // Only SYSTEM_ADMIN can assign SYSTEM_ADMIN role
    if (role === 'SYSTEM_ADMIN' && req.user!.role !== 'SYSTEM_ADMIN') {
      res.status(403).json({
        success: false,
        error: 'Only System Admins can assign the System Admin role',
      });
      return;
    }

    // Only SYSTEM_ADMIN can change a SYSTEM_ADMIN's role
    if (targetUser.role === 'SYSTEM_ADMIN' && req.user!.role !== 'SYSTEM_ADMIN') {
      res.status(403).json({
        success: false,
        error: 'Only System Admins can change a System Admin\'s role',
      });
      return;
    }

    const user = await prisma.user.update({
      where: { id },
      data: { role },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
      },
    });

    res.json({
      success: true,
      data: { user },
      message: `User role changed to ${role} successfully`,
    });
  })
);

// DELETE /api/users/:id - Delete user (System Admin only)
router.delete(
  '/:id',
  authenticate,
  requireSystemAdmin,
  asyncHandler(async (req: AuthRequest, res): Promise<void> => {
    const { id } = req.params;

    // Cannot delete yourself
    if (id === req.user!.id) {
      res.status(400).json({
        success: false,
        error: 'Cannot delete your own account',
      });
      return;
    }

    await prisma.user.delete({
      where: { id },
    });

    res.json({
      success: true,
      message: 'User deleted successfully',
    });
  })
);

export default router;
