import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireMinimumRole } from '../middleware/rbac';
import { UserRole } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { ValidationError } from '../middleware/errorHandler';

const router = Router();

// All routes require authentication
router.use(authenticate);

// GET /api/facilities/departments - List all departments
router.get('/facilities/departments', async (req, res) => {
  const { facilityId } = req.query;

  const departments = await prisma.department.findMany({
    where: {
      ...(facilityId && { facilityId: String(facilityId) }),
    },
    include: {
      Facility: {
        select: { id: true, name: true },
      },
      _count: {
        select: {
          Area: true,
        },
      },
    },
    orderBy: { name: 'asc' },
  });

  res.json({
    success: true,
    data: {
      departments,
    },
  });
});

// GET /api/facilities/departments/:id - Get single department
router.get('/facilities/departments/:id', async (req, res) => {
  const { id } = req.params;

  const department = await prisma.department.findUnique({
    where: { id },
    include: {
      Facility: true,
      Area: true,
      _count: {
        select: {
          Area: true,
        },
      },
    },
  });

  if (!department) {
    throw new ValidationError('Department not found');
  }

  res.json({
    success: true,
    data: department,
  });
});

// POST /api/facilities/departments - Create department
router.post('/facilities/departments', requireMinimumRole(UserRole.ADMIN), async (req, res) => {
  const { name, description, facilityId } = req.body;

  if (!name || !facilityId) {
    throw new ValidationError('Name and facility ID are required');
  }

  const department = await prisma.department.create({
    data: {
      name,
      description,
      facilityId,
    },
    include: {
      Facility: {
        select: { id: true, name: true },
      },
    },
  });

  res.json({
    success: true,
    data: department,
    message: 'Department created successfully',
  });
});

// PATCH /api/facilities/departments/:id - Update department
router.patch('/facilities/departments/:id', requireMinimumRole(UserRole.ADMIN), async (req, res) => {
  const { id } = req.params;
  const { name, description, facilityId } = req.body;

  const department = await prisma.department.update({
    where: { id },
    data: {
      ...(name && { name }),
      ...(description !== undefined && { description }),
      ...(facilityId && { facilityId }),
    },
    include: {
      Facility: {
        select: { id: true, name: true },
      },
    },
  });

  res.json({
    success: true,
    data: department,
    message: 'Department updated successfully',
  });
});

// DELETE /api/facilities/departments/:id - Delete department
router.delete('/facilities/departments/:id', requireMinimumRole(UserRole.ADMIN), async (req, res) => {
  const { id } = req.params;
  const { cascade } = req.query;

  // Get department details
  const department = await prisma.department.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      _count: {
        select: {
          Area: true,
        },
      },
    },
  });

  if (!department) {
    throw new ValidationError('Department not found');
  }

  const areaCount = department._count.Area;

  // Check if department has areas
  if (areaCount > 0) {
    if (cascade === 'true') {
      // Get line count from areas
      const lineCount = await prisma.line.count({
        where: {
          Area: {
            departmentId: id,
          },
        },
      });

      // Cascade delete: Delete all related data
      await prisma.$transaction(async (tx: any) => {
        // Delete lines first (they depend on areas)
        await tx.line.deleteMany({
          where: {
            Area: {
              departmentId: id,
            },
          },
        });

        // Delete areas
        await tx.area.deleteMany({
          where: { departmentId: id },
        });

        // Finally delete the department
        await tx.department.delete({
          where: { id },
        });
      });

      res.json({
        success: true,
        message: `Department "${department.name}" and all related data deleted successfully`,
        deleted: {
          department: 1,
          Area: areaCount,
          Line: lineCount,
        },
      });
    } else {
      // Return error with cascade option
      return res.status(400).json({
        success: false,
        error: `Cannot delete department with existing areas`,
        canCascade: true,
        details: {
          department: department.name,
          Area: areaCount,
        },
        message: `This department has ${areaCount} area(s). To delete it along with all related data, use ?cascade=true`,
      });
    }
  } else {
    // No related data, safe to delete
    await prisma.department.delete({
      where: { id },
    });

    res.json({
      success: true,
      message: 'Department deleted successfully',
    });
  }
});

export default router;
