/**
 * Task Routes for Meeting Intelligence Mobile App
 * 
 * Endpoints:
 * - POST   /api/mobile/tasks          - Create a new task
 * - GET    /api/mobile/tasks          - Get tasks for user (owned or assigned)
 * - GET    /api/mobile/tasks/:id      - Get single task by ID
 * - PATCH  /api/mobile/tasks/:id      - Update task (status, assignment, etc.)
 * - DELETE /api/mobile/tasks/:id      - Delete a task
 */

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// ============================================================================
// POST /api/mobile/tasks
// Create a new task
// Expects: { title, description?, dueDate?, priority?, assigneeId?, ownerId, organizationId, facilityId? }
// ============================================================================
router.post('/', async (req: Request, res: Response) => {
  try {
    const { 
      title, 
      description, 
      dueDate, 
      priority, 
      assigneeId, 
      ownerId, 
      organizationId, 
      facilityId,
      meetingId 
    } = req.body;

    // Validate required fields
    if (!title || !ownerId || !organizationId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: title, ownerId, organizationId',
      });
    }

    // Validate owner exists
    const owner = await prisma.user.findUnique({
      where: { id: ownerId },
    });

    if (!owner) {
      return res.status(404).json({
        success: false,
        error: 'Owner not found',
      });
    }

    // Validate assignee exists if provided
    if (assigneeId) {
      const assignee = await prisma.user.findUnique({
        where: { id: assigneeId },
      });

      if (!assignee) {
        return res.status(404).json({
          success: false,
          error: 'Assignee not found',
        });
      }
    }

    // Create task
    const task = await prisma.task.create({
      data: {
        title: title.trim(),
        description: description?.trim() || null,
        dueDate: dueDate ? new Date(dueDate) : null,
        priority: priority || 'MEDIUM',
        ownerId,
        assigneeId: assigneeId || null,
        organizationId,
        facilityId: facilityId || null,
        meetingId: meetingId || null,
      },
      include: {
        owner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        assignee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    return res.status(201).json({
      success: true,
      task,
    });
  } catch (error: any) {
    console.error('Create task error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create task',
    });
  }
});

// ============================================================================
// GET /api/mobile/tasks
// Get tasks for a user (owned by them OR assigned to them)
// Query params: userId (required), status?, filter (owned|assigned|all)
// ============================================================================
router.get('/', async (req: Request, res: Response) => {
  try {
    const { userId, status, filter = 'all' } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId is required',
      });
    }

    // Build where clause based on filter
    let whereClause: any = {};
    
    if (filter === 'owned') {
      whereClause.ownerId = userId as string;
    } else if (filter === 'assigned') {
      whereClause.assigneeId = userId as string;
    } else {
      // 'all' - tasks where user is owner OR assignee
      whereClause.OR = [
        { ownerId: userId as string },
        { assigneeId: userId as string },
      ];
    }

    // Add status filter if provided
    if (status) {
      whereClause.status = status as string;
    }

    const tasks = await prisma.task.findMany({
      where: whereClause,
      include: {
        owner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        assignee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: [
        { status: 'asc' }, // PENDING first, then IN_PROGRESS, then COMPLETED
        { dueDate: 'asc' }, // Earliest due date first
        { createdAt: 'desc' }, // Most recent first
      ],
    });

    return res.json({
      success: true,
      tasks,
      count: tasks.length,
    });
  } catch (error: any) {
    console.error('Get tasks error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch tasks',
    });
  }
});

// ============================================================================
// GET /api/mobile/tasks/:id
// Get a single task by ID
// ============================================================================
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        owner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        assignee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    if (!task) {
      return res.status(404).json({
        success: false,
        error: 'Task not found',
      });
    }

    return res.json({
      success: true,
      task,
    });
  } catch (error: any) {
    console.error('Get task error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch task',
    });
  }
});

// ============================================================================
// PATCH /api/mobile/tasks/:id
// Update a task (status, assignment, details)
// Expects: { title?, description?, status?, priority?, dueDate?, assigneeId? }
// ============================================================================
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { title, description, status, priority, dueDate, assigneeId } = req.body;

    // Check task exists
    const existingTask = await prisma.task.findUnique({
      where: { id },
    });

    if (!existingTask) {
      return res.status(404).json({
        success: false,
        error: 'Task not found',
      });
    }

    // Validate assignee if provided
    if (assigneeId !== undefined && assigneeId !== null) {
      const assignee = await prisma.user.findUnique({
        where: { id: assigneeId },
      });

      if (!assignee) {
        return res.status(404).json({
          success: false,
          error: 'Assignee not found',
        });
      }
    }

    // Build update data
    const updateData: any = {};
    
    if (title !== undefined) updateData.title = title.trim();
    if (description !== undefined) updateData.description = description?.trim() || null;
    if (status !== undefined) {
      updateData.status = status;
      // Set completedAt when task is completed
      if (status === 'COMPLETED') {
        updateData.completedAt = new Date();
      } else if (existingTask.status === 'COMPLETED' && status !== 'COMPLETED') {
        // If changing from COMPLETED to another status, clear completedAt
        updateData.completedAt = null;
      }
    }
    if (priority !== undefined) updateData.priority = priority;
    if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null;
    if (assigneeId !== undefined) updateData.assigneeId = assigneeId;

    const task = await prisma.task.update({
      where: { id },
      data: updateData,
      include: {
        owner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        assignee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    return res.json({
      success: true,
      task,
    });
  } catch (error: any) {
    console.error('Update task error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update task',
    });
  }
});

// ============================================================================
// DELETE /api/mobile/tasks/:id
// Delete a task
// ============================================================================
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check task exists
    const existingTask = await prisma.task.findUnique({
      where: { id },
    });

    if (!existingTask) {
      return res.status(404).json({
        success: false,
        error: 'Task not found',
      });
    }

    await prisma.task.delete({
      where: { id },
    });

    return res.json({
      success: true,
      message: 'Task deleted successfully',
    });
  } catch (error: any) {
    console.error('Delete task error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete task',
    });
  }
});

export default router;
