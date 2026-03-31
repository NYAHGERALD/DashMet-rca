import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { requireMinimumRole } from '../middleware/rbac';
import { UserRole } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { v4 as uuidv4 } from 'uuid';
import { upload, handleMulterError } from '../middleware/upload';
import { adminStorage } from '../config/firebase-admin';
import path from 'path';

const router = Router();
router.use(authenticate);

// ─── Helpers ────────────────────────────────────────────────────────────────────

/** Organization filter based on user role (multi-tenancy) */
const getOrgFilter = (req: any) => {
  if (req.user.role === 'SYSTEM_ADMIN') return {};
  return {
    Line: {
      Area: {
        Department: {
          Facility: { organizationId: req.user.organizationId },
        },
      },
    },
  };
};

// ─── Equipment CRUD ─────────────────────────────────────────────────────────────

/**
 * GET /api/equipment
 * List all equipment for the user's organization.
 * Optional query params: ?lineId=&status=&search=
 */
router.get('/', async (req: any, res: Response, next: NextFunction) => {
  try {
    const { lineId, status, search } = req.query;

    const where: any = {
      ...getOrgFilter(req),
      ...(lineId ? { lineId: String(lineId) } : {}),
      ...(status ? { status: String(status) } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: String(search), mode: 'insensitive' } },
              { assetTag: { contains: String(search), mode: 'insensitive' } },
              { manufacturer: { contains: String(search), mode: 'insensitive' } },
              { Components: { some: { name: { contains: String(search), mode: 'insensitive' } } } },
            ],
          }
        : {}),
    };

    const equipment = await prisma.equipment.findMany({
      where,
      include: {
        Line: {
          select: {
            id: true,
            name: true,
            lineNumber: true,
            Area: {
              select: {
                id: true,
                name: true,
                Department: {
                  select: {
                    id: true,
                    name: true,
                    Facility: {
                      select: { id: true, name: true },
                    },
                  },
                },
              },
            },
          },
        },
        _count: { select: { Components: true } },
        ...(search ? { Components: { orderBy: [{ name: 'asc' as const }] } } : {}),
      },
      orderBy: [{ name: 'asc' }],
    });

    res.json({ success: true, data: { equipment } });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/equipment/:id
 * Get a single equipment record with its components.
 */
router.get('/:id', async (req: any, res: Response, next: NextFunction) => {
  try {
    const equipment = await prisma.equipment.findUnique({
      where: { id: req.params.id },
      include: {
        Line: {
          select: {
            id: true,
            name: true,
            lineNumber: true,
            Area: {
              select: {
                id: true,
                name: true,
                Department: {
                  select: {
                    id: true,
                    name: true,
                    Facility: { select: { id: true, name: true } },
                  },
                },
              },
            },
          },
        },
        Components: {
          orderBy: { name: 'asc' },
        },
      },
    });

    if (!equipment) {
      return res.status(404).json({ success: false, error: 'Equipment not found' });
    }

    res.json({ success: true, data: equipment });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/equipment
 * Create a new equipment record. Requires ADMIN+.
 */
router.post(
  '/',
  requireMinimumRole(UserRole.ADMIN),
  async (req: any, res: Response, next: NextFunction) => {
    try {
      const { name, description, assetTag, manufacturer, model, serialNumber, lineId } = req.body;

      if (!name || !lineId) {
        return res.status(400).json({ success: false, error: 'Name and Line are required' });
      }

      // Verify the line exists and belongs to user's org
      const line = await prisma.line.findFirst({
        where: {
          id: lineId,
          ...(req.user.role !== 'SYSTEM_ADMIN'
            ? { Area: { Department: { Facility: { organizationId: req.user.organizationId } } } }
            : {}),
        },
      });

      if (!line) {
        return res.status(404).json({ success: false, error: 'Line not found or access denied' });
      }

      const equipment = await prisma.equipment.create({
        data: {
          id: uuidv4(),
          name: name.trim(),
          description: description?.trim() || null,
          assetTag: assetTag?.trim() || null,
          manufacturer: manufacturer?.trim() || null,
          model: model?.trim() || null,
          serialNumber: serialNumber?.trim() || null,
          lineId,
          createdBy: req.user.id,
        },
        include: {
          Line: {
            select: {
              id: true,
              name: true,
              Area: {
                select: {
                  id: true,
                  name: true,
                  Department: {
                    select: {
                      id: true,
                      name: true,
                      Facility: { select: { id: true, name: true } },
                    },
                  },
                },
              },
            },
          },
          _count: { select: { Components: true } },
        },
      });

      res.status(201).json({ success: true, data: equipment, message: 'Equipment created successfully' });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PATCH /api/equipment/:id
 * Update an equipment record. Requires ADMIN+.
 */
router.patch(
  '/:id',
  requireMinimumRole(UserRole.ADMIN),
  async (req: any, res: Response, next: NextFunction) => {
    try {
      const { name, description, assetTag, manufacturer, model, serialNumber, lineId, status } = req.body;

      const existing = await prisma.equipment.findUnique({ where: { id: req.params.id } });
      if (!existing) {
        return res.status(404).json({ success: false, error: 'Equipment not found' });
      }

      // If changing lineId, verify new line belongs to user's org
      if (lineId && lineId !== existing.lineId) {
        const line = await prisma.line.findFirst({
          where: {
            id: lineId,
            ...(req.user.role !== 'SYSTEM_ADMIN'
              ? { Area: { Department: { Facility: { organizationId: req.user.organizationId } } } }
              : {}),
          },
        });
        if (!line) {
          return res.status(404).json({ success: false, error: 'Line not found or access denied' });
        }
      }

      const equipment = await prisma.equipment.update({
        where: { id: req.params.id },
        data: {
          ...(name !== undefined && { name: name.trim() }),
          ...(description !== undefined && { description: description?.trim() || null }),
          ...(assetTag !== undefined && { assetTag: assetTag?.trim() || null }),
          ...(manufacturer !== undefined && { manufacturer: manufacturer?.trim() || null }),
          ...(model !== undefined && { model: model?.trim() || null }),
          ...(serialNumber !== undefined && { serialNumber: serialNumber?.trim() || null }),
          ...(lineId && { lineId }),
          ...(status && { status }),
        },
        include: {
          Line: {
            select: {
              id: true,
              name: true,
              Area: {
                select: {
                  id: true,
                  name: true,
                  Department: {
                    select: {
                      id: true,
                      name: true,
                      Facility: { select: { id: true, name: true } },
                    },
                  },
                },
              },
            },
          },
          _count: { select: { Components: true } },
        },
      });

      res.json({ success: true, data: equipment, message: 'Equipment updated successfully' });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * DELETE /api/equipment/:id
 * Delete (or archive) an equipment record. Requires ADMIN+.
 */
router.delete(
  '/:id',
  requireMinimumRole(UserRole.ADMIN),
  async (req: any, res: Response, next: NextFunction) => {
    try {
      const { archive } = req.query;

      if (archive === 'true') {
        await prisma.equipment.update({
          where: { id: req.params.id },
          data: { status: 'RETIRED' },
        });
        return res.json({ success: true, message: 'Equipment archived' });
      }

      await prisma.equipment.delete({ where: { id: req.params.id } });
      res.json({ success: true, message: 'Equipment deleted' });
    } catch (err) {
      next(err);
    }
  }
);

// ─── Component CRUD ─────────────────────────────────────────────────────────────

/**
 * GET /api/equipment/components/all
 * List all components across all equipment.
 */
router.get('/components/all', async (req: any, res: Response, next: NextFunction) => {
  try {
    const components = await prisma.equipmentComponent.findMany({
      orderBy: [{ name: 'asc' }],
      include: { equipment: { select: { id: true, name: true } } },
    });
    res.json({ success: true, data: { components } });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/equipment/:equipmentId/components
 * List components for a specific equipment.
 */
router.get('/:equipmentId/components', async (req: any, res: Response, next: NextFunction) => {
  try {
    const components = await prisma.equipmentComponent.findMany({
      where: { equipmentId: req.params.equipmentId },
      orderBy: [{ isCritical: 'desc' }, { name: 'asc' }],
    });

    res.json({ success: true, data: { components } });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/equipment/:equipmentId/components
 * Add a component to equipment. Requires ADMIN+.
 */
router.post(
  '/:equipmentId/components',
  requireMinimumRole(UserRole.ADMIN),
  async (req: any, res: Response, next: NextFunction) => {
    try {
      const { name, description, partNumber, manufacturer, isCritical } = req.body;

      if (!name) {
        return res.status(400).json({ success: false, error: 'Component name is required' });
      }

      // Verify equipment exists
      const equipment = await prisma.equipment.findUnique({
        where: { id: req.params.equipmentId },
      });
      if (!equipment) {
        return res.status(404).json({ success: false, error: 'Equipment not found' });
      }

      const component = await prisma.equipmentComponent.create({
        data: {
          id: uuidv4(),
          name: name.trim(),
          description: description?.trim() || null,
          partNumber: partNumber?.trim() || null,
          manufacturer: manufacturer?.trim() || null,
          isCritical: isCritical === true,
          equipmentId: req.params.equipmentId,
        },
      });

      res.status(201).json({ success: true, data: component, message: 'Component added' });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PATCH /api/equipment/:equipmentId/components/:componentId
 * Update a component. Requires ADMIN+.
 */
router.patch(
  '/:equipmentId/components/:componentId',
  requireMinimumRole(UserRole.ADMIN),
  async (req: any, res: Response, next: NextFunction) => {
    try {
      const { name, description, partNumber, manufacturer, isCritical, status } = req.body;

      const component = await prisma.equipmentComponent.update({
        where: { id: req.params.componentId },
        data: {
          ...(name !== undefined && { name: name.trim() }),
          ...(description !== undefined && { description: description?.trim() || null }),
          ...(partNumber !== undefined && { partNumber: partNumber?.trim() || null }),
          ...(manufacturer !== undefined && { manufacturer: manufacturer?.trim() || null }),
          ...(isCritical !== undefined && { isCritical }),
          ...(status && { status }),
        },
      });

      res.json({ success: true, data: component, message: 'Component updated' });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * DELETE /api/equipment/:equipmentId/components/:componentId
 * Delete a component. Requires ADMIN+.
 */
router.delete(
  '/:equipmentId/components/:componentId',
  requireMinimumRole(UserRole.ADMIN),
  async (req: any, res: Response, next: NextFunction) => {
    try {
      await prisma.equipmentComponent.delete({
        where: { id: req.params.componentId },
      });
      res.json({ success: true, message: 'Component deleted' });
    } catch (err) {
      next(err);
    }
  }
);

// ─── Component Photo Upload ────────────────────────────────────────────────────

/**
 * POST /api/equipment/:equipmentId/components/:componentId/photos
 * Upload photos for a component. Requires ADMIN+.
 */
router.post(
  '/:equipmentId/components/:componentId/photos',
  requireMinimumRole(UserRole.ADMIN),
  upload.array('photos', 10),
  handleMulterError,
  async (req: any, res: Response, next: NextFunction) => {
    try {
      const component = await prisma.equipmentComponent.findUnique({ where: { id: req.params.componentId } });
      if (!component) {
        return res.status(404).json({ success: false, error: 'Component not found' });
      }

      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        return res.status(400).json({ success: false, error: 'No files provided' });
      }

      const bucket = adminStorage.bucket();
      const existingPhotos = (component.photos as { url: string; name: string }[]) || [];
      const uploadedPhotos: { url: string; name: string }[] = [];

      for (const file of files) {
        const ext = path.extname(file.originalname);
        const fileName = `equipment/${req.params.equipmentId}/components/${req.params.componentId}/${uuidv4()}${ext}`;
        const firebaseFile = bucket.file(fileName);

        await firebaseFile.save(file.buffer, {
          metadata: {
            contentType: file.mimetype,
            metadata: {
              originalName: file.originalname,
              uploadedBy: req.user.id,
            },
          },
        });

        await firebaseFile.makePublic();
        const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
        uploadedPhotos.push({ url: publicUrl, name: file.originalname });
      }

      const updated = await prisma.equipmentComponent.update({
        where: { id: req.params.componentId },
        data: {
          photos: [...existingPhotos, ...uploadedPhotos],
        },
      });

      res.json({ success: true, data: { photos: updated.photos }, message: `${uploadedPhotos.length} photo(s) uploaded` });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * DELETE /api/equipment/:equipmentId/components/:componentId/photos
 * Remove a photo from a component. Requires ADMIN+.
 */
router.delete(
  '/:equipmentId/components/:componentId/photos',
  requireMinimumRole(UserRole.ADMIN),
  async (req: any, res: Response, next: NextFunction) => {
    try {
      const { url } = req.body;
      if (!url) {
        return res.status(400).json({ success: false, error: 'Photo URL is required' });
      }

      const component = await prisma.equipmentComponent.findUnique({ where: { id: req.params.componentId } });
      if (!component) {
        return res.status(404).json({ success: false, error: 'Component not found' });
      }

      try {
        const bucket = adminStorage.bucket();
        const filePath = url.split(`${bucket.name}/`)[1];
        if (filePath) {
          await bucket.file(filePath).delete();
        }
      } catch (storageErr) {
        console.warn('Failed to delete file from storage:', storageErr);
      }

      const existingPhotos = (component.photos as { url: string; name: string }[]) || [];
      const updated = await prisma.equipmentComponent.update({
        where: { id: req.params.componentId },
        data: {
          photos: existingPhotos.filter((p) => p.url !== url),
        },
      });

      res.json({ success: true, data: { photos: updated.photos }, message: 'Photo removed' });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PATCH /api/equipment/:equipmentId/components/:componentId/photos/rename
 * Rename a component photo. Requires ADMIN+.
 */
router.patch(
  '/:equipmentId/components/:componentId/photos/rename',
  requireMinimumRole(UserRole.ADMIN),
  async (req: any, res: Response, next: NextFunction) => {
    try {
      const { url, name } = req.body;
      if (!url || !name) {
        return res.status(400).json({ success: false, error: 'Photo URL and new name are required' });
      }

      const component = await prisma.equipmentComponent.findUnique({ where: { id: req.params.componentId } });
      if (!component) {
        return res.status(404).json({ success: false, error: 'Component not found' });
      }

      const existingPhotos = (component.photos as { url: string; name: string }[]) || [];
      const updated = await prisma.equipmentComponent.update({
        where: { id: req.params.componentId },
        data: {
          photos: existingPhotos.map((p) => p.url === url ? { ...p, name } : p),
        },
      });

      res.json({ success: true, data: { photos: updated.photos }, message: 'Photo renamed' });
    } catch (err) {
      next(err);
    }
  }
);

// ─── Equipment Photo Upload ─────────────────────────────────────────────────

/**
 * POST /api/equipment/:id/photos
 * Upload photos for an equipment record. Requires ADMIN+.
 */
router.post(
  '/:id/photos',
  requireMinimumRole(UserRole.ADMIN),
  upload.array('photos', 10),
  handleMulterError,
  async (req: any, res: Response, next: NextFunction) => {
    try {
      const equipment = await prisma.equipment.findUnique({ where: { id: req.params.id } });
      if (!equipment) {
        return res.status(404).json({ success: false, error: 'Equipment not found' });
      }

      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        return res.status(400).json({ success: false, error: 'No files provided' });
      }

      const bucket = adminStorage.bucket();
      const existingPhotos = (equipment.photos as { url: string; name: string }[]) || [];
      const uploadedPhotos: { url: string; name: string }[] = [];

      for (const file of files) {
        const ext = path.extname(file.originalname);
        const fileName = `equipment/${req.params.id}/${uuidv4()}${ext}`;
        const firebaseFile = bucket.file(fileName);

        await firebaseFile.save(file.buffer, {
          metadata: {
            contentType: file.mimetype,
            metadata: {
              originalName: file.originalname,
              uploadedBy: req.user.id,
            },
          },
        });

        await firebaseFile.makePublic();
        const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
        uploadedPhotos.push({ url: publicUrl, name: file.originalname });
      }

      const updated = await prisma.equipment.update({
        where: { id: req.params.id },
        data: {
          photos: [...existingPhotos, ...uploadedPhotos],
        },
      });

      res.json({ success: true, data: { photos: updated.photos }, message: `${uploadedPhotos.length} photo(s) uploaded` });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * DELETE /api/equipment/:id/photos
 * Remove a photo URL from an equipment record. Requires ADMIN+.
 */
router.delete(
  '/:id/photos',
  requireMinimumRole(UserRole.ADMIN),
  async (req: any, res: Response, next: NextFunction) => {
    try {
      const { url } = req.body;
      if (!url) {
        return res.status(400).json({ success: false, error: 'Photo URL is required' });
      }

      const equipment = await prisma.equipment.findUnique({ where: { id: req.params.id } });
      if (!equipment) {
        return res.status(404).json({ success: false, error: 'Equipment not found' });
      }

      // Remove from Firebase Storage
      try {
        const bucket = adminStorage.bucket();
        const filePath = url.split(`${bucket.name}/`)[1];
        if (filePath) {
          await bucket.file(filePath).delete();
        }
      } catch (storageErr) {
        console.warn('Failed to delete file from storage:', storageErr);
      }

      const existingPhotos = (equipment.photos as { url: string; name: string }[]) || [];
      const updated = await prisma.equipment.update({
        where: { id: req.params.id },
        data: {
          photos: existingPhotos.filter((p) => p.url !== url),
        },
      });

      res.json({ success: true, data: { photos: updated.photos }, message: 'Photo removed' });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PATCH /api/equipment/:id/photos/rename
 * Rename an equipment photo. Requires ADMIN+.
 */
router.patch(
  '/:id/photos/rename',
  requireMinimumRole(UserRole.ADMIN),
  async (req: any, res: Response, next: NextFunction) => {
    try {
      const { url, name } = req.body;
      if (!url || !name) {
        return res.status(400).json({ success: false, error: 'Photo URL and new name are required' });
      }

      const equipment = await prisma.equipment.findUnique({ where: { id: req.params.id } });
      if (!equipment) {
        return res.status(404).json({ success: false, error: 'Equipment not found' });
      }

      const existingPhotos = (equipment.photos as { url: string; name: string }[]) || [];
      const updated = await prisma.equipment.update({
        where: { id: req.params.id },
        data: {
          photos: existingPhotos.map((p) => p.url === url ? { ...p, name } : p),
        },
      });

      res.json({ success: true, data: { photos: updated.photos }, message: 'Photo renamed' });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
