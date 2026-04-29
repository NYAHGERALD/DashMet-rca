import path from 'path';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';
import { adminStorage } from '../config/firebase-admin';
import {
  FALLBACK_EMAIL_LOGO_URL,
  FALLBACK_LOGIN_BACKGROUND_URL,
  readPlatformBrandingConfig,
  writePlatformBrandingConfig,
} from '../services/platformBrandingService';

const router = Router();
const prisma = new PrismaClient();

const MAX_BRANDING_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

type BrandingAssetType = 'loginBackground' | 'emailLogo';

const brandingUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_BRANDING_FILE_SIZE_BYTES,
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
      return;
    }

    cb(new Error('Only image files are allowed.'));
  },
});

const isBrandingAssetType = (value: unknown): value is BrandingAssetType =>
  value === 'loginBackground' || value === 'emailLogo';

const sanitizeOptionalUrl = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const extractBucketFilePath = (url: string, bucketName: string): string | null => {
  if (!url || !bucketName) return null;
  const marker = `${bucketName}/`;
  const markerIndex = url.indexOf(marker);
  if (markerIndex === -1) return null;

  const rawPath = url.slice(markerIndex + marker.length).split('?')[0];
  if (!rawPath) return null;

  try {
    return decodeURIComponent(rawPath);
  } catch {
    return rawPath;
  }
};

const formatBrandingResponse = (
  branding: { loginBackgroundUrl: string | null; emailLogoUrl: string | null; updatedAt: string | null } | null
) => ({
  loginBackgroundUrl: branding?.loginBackgroundUrl || null,
  emailLogoUrl: branding?.emailLogoUrl || null,
  fallbackLoginBackgroundUrl: FALLBACK_LOGIN_BACKGROUND_URL,
  fallbackEmailLogoUrl: FALLBACK_EMAIL_LOGO_URL,
  updatedAt: branding?.updatedAt || null,
});

const requireSystemAdminAccess = (req: AuthRequest, res: Response): boolean => {
  const currentUser = req.user;
  if (!currentUser || currentUser.role !== 'SYSTEM_ADMIN') {
    res.status(403).json({
      success: false,
      error: 'Access denied. System Administrator access required.',
    });
    return false;
  }

  return true;
};

const deleteFirebaseAssetIfManaged = async (url: string | null | undefined, bucketName: string): Promise<void> => {
  if (!url || !bucketName) return;

  const filePath = extractBucketFilePath(url, bucketName);
  if (!filePath) return;

  try {
    await adminStorage.bucket().file(filePath).delete();
  } catch {
    // Best-effort cleanup only.
  }
};

router.post('/verify-master-key', (_req, res) => {
  res.status(410).json({
    success: false,
    error: 'This endpoint has moved to /api/system-admin-auth/verify-master-key.',
  });
});

router.post('/authenticate', (_req, res) => {
  res.status(410).json({
    success: false,
    error: 'This endpoint has moved to /api/system-admin-auth/authenticate.',
  });
});

// Public branding endpoint for login/landing pages.
router.get('/branding/public', async (_req, res: Response) => {
  try {
    const branding = await readPlatformBrandingConfig();

    res.json({
      success: true,
      data: formatBrandingResponse(branding),
    });
  } catch (error) {
    console.error('Error fetching public branding settings:', error);
    res.json({
      success: true,
      data: formatBrandingResponse(null),
    });
  }
});

// Get branding settings (SYSTEM_ADMIN only)
router.get('/branding', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    if (!requireSystemAdminAccess(req, res)) return;

    const branding = await readPlatformBrandingConfig();

    res.json({
      success: true,
      data: formatBrandingResponse(branding),
    });
  } catch (error) {
    console.error('Error fetching branding settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch branding settings',
    });
  }
});

// Upload branding image (SYSTEM_ADMIN only)
router.post(
  '/branding/upload',
  authenticate,
  brandingUpload.single('file'),
  async (req: AuthRequest, res: Response) => {
    try {
      if (!requireSystemAdminAccess(req, res)) return;

      if (!req.file) {
        res.status(400).json({
          success: false,
          error: 'No image file provided.',
        });
        return;
      }

      const assetType = req.body?.assetType;
      if (!isBrandingAssetType(assetType)) {
        res.status(400).json({
          success: false,
          error: 'assetType must be "loginBackground" or "emailLogo".',
        });
        return;
      }

      const bucket = adminStorage.bucket();
      const extension = path.extname(req.file.originalname || '').toLowerCase();
      const safeExtension = extension && extension.length <= 10 ? extension : '.jpg';
      const storagePath = `platform-branding/${assetType}/${Date.now()}-${uuidv4()}${safeExtension}`;
      const firebaseFile = bucket.file(storagePath);

      await firebaseFile.save(req.file.buffer, {
        metadata: {
          contentType: req.file.mimetype,
          metadata: {
            uploadedBy: req.user!.id,
            assetType,
            uploadedAt: new Date().toISOString(),
          },
        },
      });

      await firebaseFile.makePublic();
      const publicUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;

      res.json({
        success: true,
        data: {
          assetType,
          url: publicUrl,
        },
      });
    } catch (error: any) {
      console.error('Error uploading branding image:', error);
      res.status(500).json({
        success: false,
        error: error?.message || 'Failed to upload branding image',
      });
    }
  }
);

// Update branding URLs (SYSTEM_ADMIN only)
router.put('/branding', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    if (!requireSystemAdminAccess(req, res)) return;

    const existing = await readPlatformBrandingConfig();

    const hasLoginBackgroundField = Object.prototype.hasOwnProperty.call(req.body || {}, 'loginBackgroundUrl');
    const hasEmailLogoField = Object.prototype.hasOwnProperty.call(req.body || {}, 'emailLogoUrl');

    if (!hasLoginBackgroundField && !hasEmailLogoField) {
      res.status(400).json({
        success: false,
        error: 'At least one branding field is required.',
      });
      return;
    }

    const nextLoginBackgroundUrl = hasLoginBackgroundField
      ? sanitizeOptionalUrl(req.body?.loginBackgroundUrl)
      : existing?.loginBackgroundUrl || null;
    const nextEmailLogoUrl = hasEmailLogoField
      ? sanitizeOptionalUrl(req.body?.emailLogoUrl)
      : existing?.emailLogoUrl || null;

    const updated = await writePlatformBrandingConfig({
      loginBackgroundUrl: nextLoginBackgroundUrl,
      emailLogoUrl: nextEmailLogoUrl,
      updatedById: req.user!.id,
    });

    const bucketName = adminStorage.bucket().name;

    // Best-effort cleanup of replaced Firebase-hosted assets.
    if (
      hasLoginBackgroundField &&
      existing?.loginBackgroundUrl &&
      existing.loginBackgroundUrl !== nextLoginBackgroundUrl
    ) {
      await deleteFirebaseAssetIfManaged(existing.loginBackgroundUrl, bucketName);
    }
    if (
      hasEmailLogoField &&
      existing?.emailLogoUrl &&
      existing.emailLogoUrl !== nextEmailLogoUrl
    ) {
      await deleteFirebaseAssetIfManaged(existing.emailLogoUrl, bucketName);
    }

    res.json({
      success: true,
      data: formatBrandingResponse(updated),
      message: 'Branding updated successfully.',
    });
  } catch (error) {
    console.error('Error updating branding settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update branding settings',
    });
  }
});

// Get recent access logs (protected, SYSTEM_ADMIN only)
router.get('/access-logs', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    if (!requireSystemAdminAccess(req, res)) return;

    const logs = await prisma.auditLog.findMany({
      where: {
        entity: 'SYSTEM_ADMIN_AUTH',
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 100,
    });

    res.json({
      success: true,
      data: logs,
    });
  } catch (error) {
    console.error('Error fetching access logs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch access logs',
    });
  }
});

// System Admin Dashboard Stats - SYSTEM_ADMIN only
router.get('/dashboard/stats', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    if (!requireSystemAdminAccess(req, res)) return;

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalOrganizations,
      activeOrganizations,
      totalUsers,
      activeUsers,
      newUsersThisMonth,
      openSupportRequests,
      totalSupportRequests,
      totalAccessCodes,
      usedAccessCodes,
      usersByRole,
      supportByCategory,
    ] = await Promise.all([
      prisma.organization.count(),
      prisma.organization.count({
        where: {
          User: {
            some: {},
          },
        },
      }),
      prisma.user.count(),
      prisma.user.count({
        where: {
          isActive: true,
        },
      }),
      prisma.user.count({
        where: {
          createdAt: {
            gte: startOfMonth,
          },
        },
      }),
      prisma.supportRequest.count({
        where: {
          status: 'OPEN',
        },
      }),
      prisma.supportRequest.count(),
      prisma.accessCode.count(),
      prisma.accessCode.count({
        where: {
          usedCount: {
            gt: 0,
          },
        },
      }),
      prisma.user.groupBy({
        by: ['role'],
        _count: {
          id: true,
        },
      }),
      prisma.supportRequest.groupBy({
        by: ['category'],
        _count: {
          id: true,
        },
      }),
    ]);

    const userGrowth = [];
    for (let i = 5; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      const monthName = monthStart.toLocaleString('default', { month: 'short' });

      const [usersCount, orgsCount] = await Promise.all([
        prisma.user.count({
          where: {
            createdAt: {
              lte: monthEnd,
            },
          },
        }),
        prisma.organization.count({
          where: {
            createdAt: {
              lte: monthEnd,
            },
          },
        }),
      ]);

      userGrowth.push({
        name: monthName,
        users: usersCount,
        orgs: orgsCount,
      });
    }

    const usersByRoleFormatted = usersByRole.map((item) => ({
      name: item.role.replace(/_/g, ' '),
      value: item._count.id,
    }));

    const supportRequestsByCategory = supportByCategory.map((item) => ({
      name: item.category || 'Other',
      value: item._count.id,
    }));

    const organizationsByStatus = [
      { name: 'Active', value: activeOrganizations },
      { name: 'Inactive', value: totalOrganizations - activeOrganizations },
    ].filter((item) => item.value > 0);

    const stats = {
      totalOrganizations,
      activeOrganizations,
      totalUsers,
      activeUsers,
      newUsersThisMonth,
      openSupportRequests,
      totalSupportRequests,
      avgResponseTime: 0,
      totalAccessCodes,
      usedAccessCodes,
      userGrowth,
      organizationsByStatus,
      supportRequestsByCategory,
      usersByRole: usersByRoleFormatted,
    };

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Error fetching system admin dashboard stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch system admin dashboard stats',
    });
  }
});

export default router;
