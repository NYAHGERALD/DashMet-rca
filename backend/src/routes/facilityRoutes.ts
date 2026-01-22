import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireMinimumRole } from '../middleware/rbac';
import { UserRole } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { ValidationError } from '../middleware/errorHandler';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Helper to get organization filter based on user role
const getOrgFilter = (req: any) => {
  const user = req.user;
  // SYSTEM_ADMIN can see all (for organization management), others see only their org
  if (user.role === 'SYSTEM_ADMIN') {
    return {}; // No filter for system admin
  }
  return { organizationId: user.organizationId };
};

// ============= FACILITIES =============

// GET /api/facilities - List facilities (filtered by user's organization)
// Accessible to all authenticated users (needed for incident creation)
router.get('/facilities', async (req: any, res) => {
  const user = req.user;
  
  // Users can only see facilities from their own organization
  // SYSTEM_ADMIN can see all facilities (for organization management)
  const orgFilter = getOrgFilter(req);

  const facilities = await prisma.facility.findMany({
    where: orgFilter,
    include: {
      Organization: {
        select: { id: true, name: true },
      },
      Department: {
        include: {
          _count: {
            select: { Area: true },
          },
          Area: {
            include: {
              _count: {
                select: { Line: true },
              },
            },
          },
        },
      },
    },
    orderBy: { name: 'asc' },
  });

  // Calculate aggregated counts
  const facilitiesWithCounts = facilities.map((facility: any) => {
    const departmentCount = facility.Department.length;
    const areaCount = facility.Department.reduce((sum: number, dept: any) => sum + dept._count.Area, 0);
    const lineCount = facility.Department.reduce((sum: number, dept: any) => 
      sum + dept.Area.reduce((areaSum: number, area: any) => areaSum + area._count.lines, 0), 0
    );

    const { departments, ...facilityData } = facility;
    return {
      ...facilityData,
      _count: {
        Department: departmentCount,
        Area: areaCount,
        Line: lineCount,
      },
    };
  });

  res.json({
    success: true,
    data: { Facility: facilitiesWithCounts },
  });
});

// ============= AREAS =============
// NOTE: Areas routes MUST come before /facilities/:id to avoid path conflicts

// GET /api/facilities/areas - List areas (filtered by user's organization)
router.get('/facilities/areas', async (req: any, res) => {
  const { facilityId, departmentId } = req.query;
  const user = req.user;
  
  // Build filter based on user's organization
  const orgFilter = user.role === 'SYSTEM_ADMIN' 
    ? {} 
    : { Department: { Facility: { organizationId: user.organizationId } } };

  const areas = await prisma.area.findMany({
    where: {
      ...orgFilter,
      ...(facilityId ? { Department: { facilityId: String(facilityId) } } : {}),
      ...(departmentId ? { departmentId: String(departmentId) } : {}),
    },
    include: {
      Department: {
        select: { 
          id: true, 
          name: true,
          Facility: {
            select: { id: true, name: true },
          },
        },
      },
      _count: {
        select: { Line: true },
      },
    },
    orderBy: { name: 'asc' },
  });

  res.json({
    success: true,
    data: { areas },
  });
});

// NOTE: Facilities/:id routes moved to end of file to avoid path conflicts with sub-resources

// GET /api/facilities/areas/:id - Get single area with lines
router.get('/facilities/areas/:id', async (req, res) => {
  const { id } = req.params;

  const area = await prisma.area.findUnique({
    where: { id },
    include: {
      Department: {
        select: {
          id: true,
          name: true,
          Facility: {
            select: { id: true, name: true },
          },
        },
      },
      Line: true,
    },
  });

  if (!area) {
    return res.status(404).json({
      success: false,
      error: 'Area not found',
    });
  }

  res.json({
    success: true,
    data: area,
  });
});

// POST /api/facilities/areas - Create area
// Requires ADMIN role
router.post('/facilities/areas', requireMinimumRole(UserRole.ADMIN), async (req, res) => {
  const { name, departmentId, description } = req.body;

  if (!name || !departmentId) {
    throw new ValidationError('Name and department ID are required');
  }

  const area = await prisma.area.create({
    data: {
      name,
      departmentId,
      description,
    },
    include: {
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
  });

  res.status(201).json({
    success: true,
    data: area,
  });
});

// PATCH /api/facilities/areas/:id - Update area
// Requires ADMIN role
router.patch('/facilities/areas/:id', requireMinimumRole(UserRole.ADMIN), async (req, res) => {
  const { id } = req.params;
  const { name, departmentId, description } = req.body;

  const area = await prisma.area.update({
    where: { id },
    data: {
      ...(name && { name }),
      ...(departmentId && { departmentId }),
      ...(description !== undefined && { description }),
    },
  });

  res.json({
    success: true,
    data: area,
  });
});

// DELETE /api/facilities/areas/:id - Delete area
// Requires ADMIN role
router.delete('/facilities/areas/:id', requireMinimumRole(UserRole.ADMIN), async (req, res) => {
  const { id } = req.params;

  // Check if area has lines
  const lineCount = await prisma.line.count({
    where: { areaId: id },
  });

  if (lineCount > 0) {
    throw new ValidationError('Cannot delete area with existing lines');
  }

  await prisma.area.delete({
    where: { id },
  });

  res.json({
    success: true,
    message: 'Area deleted successfully',
  });
});

// ============= LINES =============
// NOTE: Lines routes MUST come before /facilities/:id to avoid path conflicts

// GET /api/facilities/lines - List lines (filtered by user's organization)
router.get('/facilities/lines', async (req: any, res) => {
  const { areaId } = req.query;
  const user = req.user;
  
  // Build filter based on user's organization
  const orgFilter = user.role === 'SYSTEM_ADMIN' 
    ? {} 
    : { Area: { Department: { Facility: { organizationId: user.organizationId } } } };

  const lines = await prisma.line.findMany({
    where: {
      ...orgFilter,
      ...(areaId ? { areaId: String(areaId) } : {}),
    },
    select: {
      id: true,
      name: true,
      lineNumber: true,
      description: true,
      areaId: true,
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
    orderBy: { name: 'asc' },
  });

  res.json({
    success: true,
    data: { lines },
  });
});

// GET /api/facilities/lines/:id - Get single line
router.get('/facilities/lines/:id', async (req, res) => {
  const { id } = req.params;

  const line = await prisma.line.findUnique({
    where: { id },
    include: {
      Area: {
        include: {
          Facility: true,
        },
      },
    },
  });

  if (!line) {
    throw new ValidationError('Line not found');
  }

  res.json({
    success: true,
    data: line,
  });
});

// POST /api/facilities/lines - Create line
// Requires ADMIN role
router.post('/facilities/lines', requireMinimumRole(UserRole.ADMIN), async (req, res) => {
  const { name, lineNumber, areaId, description } = req.body;

  if (!name || !areaId) {
    throw new ValidationError('Name and area ID are required');
  }

  const line = await prisma.line.create({
    data: {
      name,
      lineNumber,
      areaId,
      description,
    },
    include: {
      Area: {
        select: {
          id: true,
          name: true,
          Facility: {
            select: { id: true, name: true },
          },
        },
      },
    },
  });

  res.status(201).json({
    success: true,
    data: line,
  });
});

// PATCH /api/facilities/lines/:id - Update line
// Requires ADMIN role
router.patch('/facilities/lines/:id', requireMinimumRole(UserRole.ADMIN), async (req, res) => {
  const { id } = req.params;
  const { name, lineNumber, description } = req.body;

  const line = await prisma.line.update({
    where: { id },
    data: {
      ...(name && { name }),
      ...(lineNumber !== undefined && { lineNumber }),
      ...(description !== undefined && { description }),
    },
  });

  res.json({
    success: true,
    data: line,
  });
});

// DELETE /api/facilities/lines/:id - Delete line
// Requires ADMIN role
router.delete('/facilities/lines/:id', requireMinimumRole(UserRole.ADMIN), async (req, res) => {
  const { id } = req.params;

  await prisma.line.delete({
    where: { id },
  });

  res.json({
    success: true,
    message: 'Line deleted successfully',
  });
});

// ============= SHIFTS =============
// NOTE: Shifts routes MUST come before /facilities/:id to avoid path conflicts

// GET /api/facilities/shifts - List shifts (filtered by user's organization)
router.get('/facilities/shifts', async (req: any, res) => {
  const { facilityId, lineId } = req.query;
  const user = req.user;
  
  // Build filter based on user's organization
  const orgFilter = user.role === 'SYSTEM_ADMIN' 
    ? {} 
    : { Facility: { organizationId: user.organizationId } };

  const shifts = await prisma.shift.findMany({
    where: {
      ...orgFilter,
      ...(facilityId && { facilityId: String(facilityId) }),
      ...(lineId && { ShiftLine: { some: { lineId: String(lineId) } } }),
    },
    include: {
      Facility: {
        select: { id: true, name: true },
      },
      ShiftLine: {
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
        },
      },
    },
    orderBy: { name: 'asc' },
  });

  // Calculate unique area count for each shift
  const shiftsWithCounts = shifts.map((shift: any) => {
    const uniqueAreaIds = new Set(
      shift.ShiftLine
        .filter((sl: any) => sl.Line?.Area?.id)
        .map((sl: any) => sl.Line.Area.id)
    );
    
    return {
      ...shift,
      _count: {
        lines: shift.ShiftLine.length,
        areas: uniqueAreaIds.size,
      },
    };
  });

  res.json({
    success: true,
    data: { shifts: shiftsWithCounts },
  });
});

// GET /api/facilities/shifts/:id - Get single shift
router.get('/facilities/shifts/:id', async (req, res) => {
  const { id } = req.params;

  const shift = await prisma.shift.findUnique({
    where: { id },
    include: {
      Facility: {
        select: { id: true, name: true },
      },
      ShiftLine: {
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
        },
      },
    },
  });

  if (!shift) {
    return res.status(404).json({
      success: false,
      error: 'Shift not found',
    });
  }

  res.json({
    success: true,
    data: shift,
  });
});

// POST /api/facilities/shifts - Create shift
// Requires ADMIN role
router.post('/facilities/shifts', requireMinimumRole(UserRole.ADMIN), async (req, res) => {
  const { name, lineIds, startTime, endTime } = req.body;

  if (!name || !lineIds || !Array.isArray(lineIds) || lineIds.length === 0 || !startTime || !endTime) {
    throw new ValidationError('Name, at least one line ID, start time, and end time are required');
  }

  // Get the facility from the first line to set facilityId on the shift
  const firstLine = await prisma.line.findUnique({
    where: { id: lineIds[0] },
    include: {
      Area: {
        include: {
          Department: {
            select: { facilityId: true },
          },
        },
      },
    },
  });

  const facilityId = firstLine?.Area?.Department?.facilityId;

  const shift = await prisma.shift.create({
    data: {
      name,
      startTime,
      endTime,
      facilityId,
      ShiftLine: {
        create: lineIds.map((lineId: string) => ({
          lineId,
        })),
      },
    },
    include: {
      ShiftLine: {
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
                },
              },
            },
          },
        },
      },
    },
  });

  res.status(201).json({
    success: true,
    data: shift,
  });
});

// PATCH /api/facilities/shifts/:id - Update shift
// Requires ADMIN role
router.patch('/facilities/shifts/:id', requireMinimumRole(UserRole.ADMIN), async (req, res) => {
  const { id } = req.params;
  const { name, startTime, endTime, lineIds } = req.body;

  // If lineIds provided, update the ShiftLine relations
  if (lineIds && Array.isArray(lineIds)) {
    // Delete existing ShiftLine records
    await prisma.shiftLine.deleteMany({
      where: { shiftId: id },
    });

    // Create new ShiftLine records
    await prisma.shiftLine.createMany({
      data: lineIds.map((lineId: string) => ({
        shiftId: id,
        lineId,
      })),
    });
  }

  const shift = await prisma.shift.update({
    where: { id },
    data: {
      ...(name && { name }),
      ...(startTime && { startTime }),
      ...(endTime && { endTime }),
    },
    include: {
      ShiftLine: {
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
                },
              },
            },
          },
        },
      },
    },
  });

  res.json({
    success: true,
    data: shift,
  });
});

// DELETE /api/facilities/shifts/:id - Delete shift
// Requires ADMIN role
router.delete('/facilities/shifts/:id', requireMinimumRole(UserRole.ADMIN), async (req, res) => {
  const { id } = req.params;

  await prisma.shift.delete({
    where: { id },
  });

  res.json({
    success: true,
    message: 'Shift deleted successfully',
  });
});

// ============= FACILITY CRUD (AFTER SUB-RESOURCES) =============

// GET /api/facilities/:id - Get single facility with areas and lines
router.get('/facilities/:id', async (req, res) => {
  const { id } = req.params;

  const facility = await prisma.facility.findUnique({
    where: { id },
    include: {
      Organization: true,
      Department: {
        include: {
          Area: {
            include: {
              Line: true,
            },
          },
        },
      },
    },
  });

  if (!facility) {
    return res.status(404).json({
      success: false,
      error: 'Facility not found',
    });
  }

  res.json({
    success: true,
    data: facility,
  });
});

// POST /api/facilities - Create facility
// Requires ADMIN role
router.post('/facilities', requireMinimumRole(UserRole.ADMIN), async (req, res) => {
  const { name, organizationId, timezone, address } = req.body;

  if (!name || !organizationId) {
    throw new ValidationError('Name and organization ID are required');
  }

  // Check for case-insensitive duplicate facility name (globally unique)
  const existingFacility = await prisma.facility.findFirst({
    where: {
      name: {
        equals: name,
        mode: 'insensitive',
      },
    },
  });

  if (existingFacility) {
    throw new ValidationError('A facility with this name already exists');
  }

  const facility = await prisma.facility.create({
    data: {
      name,
      organizationId,
      timezone: timezone || 'America/New_York',
      address,
    },
    include: {
      Organization: {
        select: { id: true, name: true },
      },
    },
  });

  res.status(201).json({
    success: true,
    data: facility,
  });
});

// PATCH /api/facilities/:id - Update facility
// Requires ADMIN role
router.patch('/facilities/:id', requireMinimumRole(UserRole.ADMIN), async (req, res) => {
  const { id } = req.params;
  const { name, timezone, address } = req.body;

  const facility = await prisma.facility.update({
    where: { id },
    data: {
      ...(name && { name }),
      ...(timezone && { timezone }),
      ...(address !== undefined && { address }),
    },
  });

  res.json({
    success: true,
    data: facility,
  });
});

// DELETE /api/facilities/:id - Delete facility
// Requires ADMIN role
// Supports cascade delete with ?cascade=true query parameter
router.delete('/facilities/:id', requireMinimumRole(UserRole.ADMIN), async (req, res) => {
  const { id } = req.params;
  const { cascade } = req.query;

  // Get facility details
  const facility = await prisma.facility.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      _count: {
        select: {
          Department: true,
        },
      },
    },
  });

  if (!facility) {
    throw new ValidationError('Facility not found');
  }

  const departmentCount = facility._count.Department;

  // Check if facility has departments
  if (departmentCount > 0) {
    if (cascade === 'true') {
      // Get counts of all nested data
      const [areaCount, lineCount] = await Promise.all([
        prisma.area.count({
          where: {
            Department: {
              facilityId: id,
            },
          },
        }),
        prisma.line.count({
          where: {
            Area: {
              Department: {
                facilityId: id,
              },
            },
          },
        }),
      ]);

      // Cascade delete: Delete all related data
      await prisma.$transaction(async (tx: any) => {
        // Delete lines first (they depend on areas)
        await tx.line.deleteMany({
          where: {
            Area: {
              Department: {
                facilityId: id,
              },
            },
          },
        });

        // Delete areas
        await tx.area.deleteMany({
          where: {
            Department: {
              facilityId: id,
            },
          },
        });

        // Delete departments
        await tx.department.deleteMany({
          where: { facilityId: id },
        });

        // Finally delete the facility
        await tx.facility.delete({
          where: { id },
        });
      });

      res.json({
        success: true,
        message: `Facility "${facility.name}" and all related data deleted successfully`,
        deleted: {
          facility: 1,
          Department: departmentCount,
          Area: areaCount,
          Line: lineCount,
        },
      });
    } else {
      // Return error with cascade option
      return res.status(400).json({
        success: false,
        error: `Cannot delete facility with existing departments`,
        canCascade: true,
        details: {
          facility: facility.name,
          Department: departmentCount,
        },
        message: `This facility has ${departmentCount} department(s). To delete it along with all related data, use ?cascade=true`,
      });
    }
  } else {
    // No related data, safe to delete
    await prisma.facility.delete({
      where: { id },
    });

    res.json({
      success: true,
      message: 'Facility deleted successfully',
    });
  }
});

export default router;
