/**
 * Task Routes for Meeting Intelligence Mobile App
 * 
 * Endpoints:
 * - POST   /api/mobile/tasks                    - Create a new task
 * - POST   /api/mobile/tasks/manual             - Create a manual task (grouped under "Manual")
 * - GET    /api/mobile/tasks                    - Get tasks for user (owned or assigned)
 * - GET    /api/mobile/tasks/:id                - Get single task by ID
 * - PATCH  /api/mobile/tasks/:id                - Update task (status, assignment, etc.)
 * - DELETE /api/mobile/tasks/:id                - Delete a task
 * - GET    /api/mobile/tasks/meeting/:meetingId - Get tasks for a specific meeting
 * - POST   /api/mobile/tasks/:id/comments       - Add comment to task
 * - GET    /api/mobile/tasks/:id/comments       - Get comments for task
 * - DELETE /api/mobile/tasks/comments/:commentId - Delete a comment
 * - POST   /api/mobile/tasks/:id/evidence       - Add evidence to task
 * - GET    /api/mobile/tasks/:id/evidence       - Get evidence for task
 * - DELETE /api/mobile/tasks/evidence/:evidenceId - Delete evidence
 * - POST   /api/mobile/tasks/extract-from-transcript - AI extract action items from transcript
 * - GET    /api/mobile/tasks/users/organization/:organizationId - Get users in an organization
 * - POST   /api/mobile/tasks/:taskId/assignees  - Add assignees to a task
 * - DELETE /api/mobile/tasks/:taskId/assignees/:userId - Remove an assignee
 * - PUT    /api/mobile/tasks/:taskId/assignees  - Replace all assignees
 * - GET    /api/mobile/tasks/:taskId/assignees  - Get all assignees for a task
 * - GET    /api/mobile/tasks/:taskId/activity-logs - Get activity logs for a task
 */

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import OpenAI from 'openai';
import { sendTaskActivityNotification } from '../services/pushNotificationService';

const router = Router();
const prisma = new PrismaClient();

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ============================================================================
// ACTIVITY LOG HELPER
// ============================================================================

interface ActivityLogParams {
  taskId: string;
  userId: string;
  action: string;
  field?: string;
  previousValue?: string | null;
  newValue?: string | null;
  metadata?: Record<string, any>;
}

async function createActivityLog({
  taskId,
  userId,
  action,
  field,
  previousValue,
  newValue,
  metadata,
}: ActivityLogParams): Promise<void> {
  try {
    // Create the activity log
    await prisma.taskActivityLog.create({
      data: {
        taskId,
        userId,
        action,
        field: field || null,
        previousValue: previousValue || null,
        newValue: newValue || null,
        metadata: metadata || null,
      },
    });

    // Send push notifications asynchronously (don't await - fire and forget)
    // This ensures the main operation is not blocked by notification delivery
    (async () => {
      try {
        // Get task title and user info for the notification
        const [task, actor] = await Promise.all([
          prisma.task.findUnique({
            where: { id: taskId },
            select: { title: true },
          }),
          prisma.user.findUnique({
            where: { id: userId },
            select: { firstName: true, lastName: true },
          }),
        ]);

        if (task && actor) {
          await sendTaskActivityNotification({
            taskId,
            taskTitle: task.title,
            action,
            actorName: `${actor.firstName} ${actor.lastName}`,
            actorId: userId,
            field: field || undefined,
            previousValue: previousValue || undefined,
            newValue: newValue || undefined,
            metadata: metadata || undefined,
          });
        }
      } catch (notifError) {
        console.error('Failed to send push notification:', notifError);
        // Don't throw - notification failure should not affect the main operation
      }
    })();
  } catch (error) {
    console.error('Failed to create activity log:', error);
    // Don't throw - activity logging should not break the main operation
  }
}

// Include relations for tasks
const taskInclude = {
  owner: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      profilePicture: true,
    },
  },
  assignee: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      profilePicture: true,
    },
  },
  assignees: {
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          profilePicture: true,
        },
      },
      assigner: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
    orderBy: { assignedAt: 'desc' as const },
  },
  comments: {
    include: {
      author: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' as const },
    take: 5,
  },
  evidence: {
    include: {
      uploader: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' as const },
  },
  meeting: {
    select: {
      id: true,
      title: true,
      meetingType: true,
      scheduledAt: true,
      createdAt: true,
    },
  },
  completedBy: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
    },
  },
  lockedBy: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
    },
  },
  _count: {
    select: {
      comments: true,
      evidence: true,
    },
  },
};

// ============================================================================
// GET /api/mobile/tasks/users/organization/:organizationId
// Get all users in an organization (for assigning tasks)
// ============================================================================
router.get('/users/organization/:organizationId', async (req: Request, res: Response) => {
  try {
    const { organizationId } = req.params;

    const users = await prisma.user.findMany({
      where: {
        organizationId,
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

    return res.json({
      success: true,
      users,
      count: users.length,
    });
  } catch (error: any) {
    console.error('Get organization users error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch users',
    });
  }
});

// ============================================================================
// POST /api/mobile/tasks
// Create a new task
// Expects: { title, description?, dueDate?, priority?, assigneeId?, ownerId, organizationId, facilityId?, meetingId?, sourceText?, isAiExtracted? }
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
      meetingId,
      sourceText,
      isAiExtracted
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
        sourceText: sourceText || null,
        isAiExtracted: isAiExtracted || false,
      },
      include: taskInclude,
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
// POST /api/mobile/tasks/manual
// Create a manual task (not from AI extraction)
// Automatically creates/uses a "Manual" meeting group for the organization
// Expects: { title, description?, dueDate?, priority?, ownerId, organizationId, facilityId? }
// ============================================================================
router.post('/manual', async (req: Request, res: Response) => {
  try {
    const { 
      title, 
      description, 
      dueDate, 
      priority, 
      ownerId, 
      organizationId, 
      facilityId,
    } = req.body;

    console.log('Creating manual task:', { title, ownerId, organizationId, facilityId });

    // Validate required fields
    if (!title || !ownerId || !organizationId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: title, ownerId, organizationId',
      });
    }

    // Validate owner exists - try by id first, then by firebaseUid
    let owner = await prisma.user.findUnique({
      where: { id: ownerId },
    });

    if (!owner) {
      // Try finding by firebaseUid
      owner = await prisma.user.findFirst({
        where: { firebaseUid: ownerId },
      });
    }

    if (!owner) {
      console.log('Owner not found for ownerId:', ownerId);
      return res.status(404).json({
        success: false,
        error: 'Owner not found',
      });
    }

    console.log('Owner found:', owner.id, owner.email);

    // Use the actual database owner ID (in case we looked up by firebaseUid)
    const actualOwnerId = owner.id;

    // Find or create a "Manual" meeting for this organization
    // We use a unique meeting per day for Manual tasks to keep them organized
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    let manualMeeting = await prisma.meeting.findFirst({
      where: {
        organizationId,
        meetingType: 'MANUAL',
        creatorId: actualOwnerId,
        createdAt: {
          gte: today,
          lt: tomorrow,
        },
      },
    });

    // If no manual meeting exists for today, create one
    if (!manualMeeting) {
      manualMeeting = await prisma.meeting.create({
        data: {
          title: 'Manual',
          meetingType: 'MANUAL',
          status: 'COMPLETED',
          creatorId: actualOwnerId,
          organizationId,
          facilityId: facilityId || null,
        },
      });
    }

    // Create task linked to the manual meeting
    const task = await prisma.task.create({
      data: {
        title: title.trim(),
        description: description?.trim() || null,
        dueDate: dueDate ? new Date(dueDate) : null,
        priority: priority || 'MEDIUM',
        ownerId: actualOwnerId,
        organizationId,
        facilityId: facilityId || null,
        meetingId: manualMeeting.id,
        sourceText: null,
        isAiExtracted: false,
      },
      include: taskInclude,
    });

    // Create activity log
    await createActivityLog({
      taskId: task.id,
      userId: actualOwnerId,
      action: 'CREATE_MANUAL_TASK',
      newValue: title.trim(),
    });

    return res.status(201).json({
      success: true,
      task,
      manualMeetingId: manualMeeting.id,
    });
  } catch (error: any) {
    console.error('Create manual task error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create manual task',
    });
  }
});

// ============================================================================
// GET /api/mobile/tasks
// Get tasks for a user (owned by them OR assigned to them)
// Query params: userId (required), status?, filter (owned|assigned|all), meetingId?
// ============================================================================
router.get('/', async (req: Request, res: Response) => {
  try {
    const { userId, status, filter = 'all', meetingId } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId is required',
      });
    }

    // Resolve userId - could be internal ID or Firebase UID (from iOS)
    let actualUserId = userId as string;
    
    // First check if it's a valid internal user ID
    let user = await prisma.user.findUnique({
      where: { id: actualUserId },
      select: { id: true },
    });
    
    // If not found by ID, try finding by firebaseUid (iOS sends Firebase UID)
    if (!user) {
      user = await prisma.user.findUnique({
        where: { firebaseUid: actualUserId },
        select: { id: true },
      });
      if (user) {
        actualUserId = user.id;
        console.log(`📱 Resolved Firebase UID ${userId} to internal ID ${actualUserId}`);
      }
    }

    // Build where clause based on filter using the resolved user ID
    let whereClause: any = {};
    
    if (filter === 'owned') {
      whereClause.ownerId = actualUserId;
    } else if (filter === 'assigned') {
      // Check both legacy assigneeId and new assignees relation
      whereClause.OR = [
        { assigneeId: actualUserId },
        { assignees: { some: { userId: actualUserId } } },
      ];
    } else {
      // 'all' - tasks where user is owner OR assignee (legacy or new)
      whereClause.OR = [
        { ownerId: actualUserId },
        { assigneeId: actualUserId },
        { assignees: { some: { userId: actualUserId } } },
      ];
    }

    // Add status filter if provided
    if (status) {
      whereClause.status = status as string;
    }

    // Add meeting filter if provided
    if (meetingId) {
      whereClause.meetingId = meetingId as string;
    }

    const tasks = await prisma.task.findMany({
      where: whereClause,
      include: taskInclude,
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
// Get a single task by ID with full details
// ============================================================================
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        ...taskInclude,
        comments: {
          include: {
            author: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
            replies: {
              include: {
                author: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                  },
                },
              },
              orderBy: { createdAt: 'asc' },
            },
          },
          where: { parentId: null }, // Only top-level comments
          orderBy: { createdAt: 'desc' },
        },
        evidence: {
          include: {
            uploader: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
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
// Update a task (status, assignment, details, progress)
// Expects: { title?, description?, status?, priority?, dueDate?, assigneeId?, progress?, userId? (for logging) }
// ============================================================================
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { title, description, status, priority, dueDate, assigneeId, progress, userId, isLocked } = req.body;

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

    // Check if task is locked - only allow locking operation if currently locked
    if (existingTask.isLocked && isLocked !== false) {
      return res.status(403).json({
        success: false,
        error: 'Task is locked and cannot be modified',
      });
    }

    // Due date can only be edited by the owner
    if (dueDate !== undefined && userId && userId !== existingTask.ownerId) {
      return res.status(403).json({
        success: false,
        error: 'Only the owner can edit the due date',
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
    
    // Handle bidirectional sync between status and progress
    // Status update triggers progress adjustment
    if (status !== undefined) {
      updateData.status = status;
      if (status === 'COMPLETED') {
        updateData.completedAt = new Date();
        updateData.completedById = userId || existingTask.ownerId; // Track who completed it
        updateData.progress = 100; // COMPLETED always means 100%
      } else if (status === 'PENDING') {
        updateData.progress = 0; // PENDING always means 0%
        if (existingTask.status === 'COMPLETED') {
          updateData.completedAt = null;
          updateData.completedById = null;
        }
      } else if (status === 'IN_PROGRESS') {
        // IN_PROGRESS: if progress was 0 or 100, set to 50; otherwise keep current
        const currentProgress = existingTask.progress;
        if (currentProgress === 0 || currentProgress === 100) {
          updateData.progress = 50;
        }
        if (existingTask.status === 'COMPLETED') {
          updateData.completedAt = null;
          updateData.completedById = null;
        }
      }
    }
    
    if (priority !== undefined) updateData.priority = priority;
    if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null;
    if (assigneeId !== undefined) updateData.assigneeId = assigneeId;
    
    // Handle direct completedAt update (for editing completion date/time)
    if (req.body.completedAt !== undefined) {
      updateData.completedAt = req.body.completedAt ? new Date(req.body.completedAt) : null;
    }
    
    // Handle lock functionality
    if (isLocked !== undefined) {
      updateData.isLocked = isLocked;
      if (isLocked) {
        updateData.lockedAt = new Date();
        updateData.lockedById = userId || existingTask.ownerId;
      } else {
        updateData.lockedAt = null;
        updateData.lockedById = null;
      }
    }
    
    // Progress update triggers status adjustment
    if (progress !== undefined) {
      const clampedProgress = Math.max(0, Math.min(100, progress));
      updateData.progress = clampedProgress;
      
      // Only auto-update status if status wasn't explicitly set in this request
      if (status === undefined) {
        if (clampedProgress === 0) {
          // 0% → PENDING
          updateData.status = 'PENDING';
          if (existingTask.status === 'COMPLETED') {
            updateData.completedAt = null;
            updateData.completedById = null;
          }
        } else if (clampedProgress === 100) {
          // 100% → COMPLETED
          if (existingTask.status !== 'COMPLETED') {
            updateData.status = 'COMPLETED';
            updateData.completedAt = new Date();
            updateData.completedById = userId || existingTask.ownerId;
          }
        } else {
          // 1-99% → IN_PROGRESS
          if (existingTask.status !== 'IN_PROGRESS') {
            updateData.status = 'IN_PROGRESS';
            if (existingTask.status === 'COMPLETED') {
              updateData.completedAt = null;
              updateData.completedById = null;
            }
          }
        }
      }
    }

    const task = await prisma.task.update({
      where: { id },
      data: updateData,
      include: taskInclude,
    });

    // Log activity for each changed field
    const logUserId = userId || existingTask.ownerId;
    
    if (title !== undefined && title.trim() !== existingTask.title) {
      await createActivityLog({
        taskId: id,
        userId: logUserId,
        action: 'UPDATE_TITLE',
        field: 'title',
        previousValue: existingTask.title,
        newValue: title.trim(),
      });
    }
    
    if (description !== undefined && (description?.trim() || null) !== existingTask.description) {
      await createActivityLog({
        taskId: id,
        userId: logUserId,
        action: 'UPDATE_DESCRIPTION',
        field: 'description',
        previousValue: existingTask.description,
        newValue: description?.trim() || null,
      });
    }
    
    if (status !== undefined && status !== existingTask.status) {
      await createActivityLog({
        taskId: id,
        userId: logUserId,
        action: 'UPDATE_STATUS',
        field: 'status',
        previousValue: existingTask.status,
        newValue: status,
      });
    }
    
    if (priority !== undefined && priority !== existingTask.priority) {
      await createActivityLog({
        taskId: id,
        userId: logUserId,
        action: 'UPDATE_PRIORITY',
        field: 'priority',
        previousValue: existingTask.priority,
        newValue: priority,
      });
    }
    
    if (progress !== undefined && progress !== existingTask.progress) {
      await createActivityLog({
        taskId: id,
        userId: logUserId,
        action: 'UPDATE_PROGRESS',
        field: 'progress',
        previousValue: String(existingTask.progress),
        newValue: String(Math.max(0, Math.min(100, progress))),
      });
    }
    
    if (dueDate !== undefined) {
      const oldDate = existingTask.dueDate ? existingTask.dueDate.toISOString() : null;
      const newDate = dueDate ? new Date(dueDate).toISOString() : null;
      if (oldDate !== newDate) {
        await createActivityLog({
          taskId: id,
          userId: logUserId,
          action: 'UPDATE_DUE_DATE',
          field: 'dueDate',
          previousValue: oldDate,
          newValue: newDate,
        });
      }
    }

    // Log lock/unlock action
    if (isLocked !== undefined && isLocked !== existingTask.isLocked) {
      await createActivityLog({
        taskId: id,
        userId: logUserId,
        action: isLocked ? 'LOCK_TASK' : 'UNLOCK_TASK',
        field: 'isLocked',
        previousValue: String(existingTask.isLocked),
        newValue: String(isLocked),
      });
    }

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

// ============================================================================
// GET /api/mobile/tasks/meeting/:meetingId
// Get all tasks for a specific meeting
// ============================================================================
router.get('/meeting/:meetingId', async (req: Request, res: Response) => {
  try {
    const { meetingId } = req.params;

    const tasks = await prisma.task.findMany({
      where: { meetingId },
      include: taskInclude,
      orderBy: [
        { status: 'asc' },
        { priority: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    return res.json({
      success: true,
      tasks,
      count: tasks.length,
    });
  } catch (error: any) {
    console.error('Get meeting tasks error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch meeting tasks',
    });
  }
});

// ============================================================================
// POST /api/mobile/tasks/extract-from-transcript
// Use AI to extract action items from a meeting transcript
// Expects: { meetingId, transcript, ownerId, organizationId }
// ============================================================================
router.post('/extract-from-transcript', async (req: Request, res: Response) => {
  try {
    const { meetingId, transcript, ownerId, organizationId, facilityId } = req.body;

    if (!meetingId || !transcript || !ownerId || !organizationId) {
      return res.status(400).json({
        success: false,
        error: 'meetingId, transcript, ownerId, and organizationId are required',
      });
    }

    // Check if OpenAI API key is configured
    if (!process.env.OPENAI_API_KEY) {
      console.error('OPENAI_API_KEY is not configured');
      return res.status(503).json({
        success: false,
        error: 'AI service not configured. Please set OPENAI_API_KEY in environment variables.',
      });
    }

    // Use OpenAI to extract action items
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are an expert meeting analyst specializing in identifying actionable opportunities from conversations. Your goal is to be PROACTIVE and THOROUGH in identifying items that need follow-up, tracking, or improvement.

## Your Mission
Analyze the meeting transcript and extract action items for ANYTHING that could benefit from tracking, follow-up, or improvement. Do NOT wait for explicitly stated tasks - be intelligent and proactive.

## What to Look For (identify ALL of these):

### Issues & Problems Discussed
- Any problems, challenges, or pain points mentioned
- Complaints or concerns raised by anyone
- Things that aren't working well or need fixing
- Bottlenecks or blockers mentioned

### Areas for Improvement
- Processes that could be optimized
- Efficiency opportunities
- Quality improvements needed
- Training or skill gaps identified

### Business & Operations
- Operational issues (staffing, scheduling, workflow)
- Cost concerns or budget discussions
- Marketing or promotion opportunities
- Sales or revenue discussions
- Customer feedback or complaints

### Safety & Compliance
- Safety concerns or incidents mentioned
- Food safety issues (if applicable)
- Compliance gaps or risks
- Audit findings or preparation needs

### People & Team
- Attendance or absenteeism issues
- Sickness or leave management
- Conflicts or team dynamics issues
- Performance concerns
- Recognition or morale opportunities
- Hiring or staffing needs

### Equipment & Resources
- Machine issues or breakdowns
- Equipment efficiency problems
- Maintenance needs
- Resource shortages
- Technology or system issues

### Follow-ups from Discussions
- Even if a solution was discussed, create an action item to TRACK the implementation
- Decisions made that need to be executed
- Ideas proposed that should be explored
- Commitments or promises made

## Output Format
For each action item, provide:
1. **title**: Action-oriented, starts with a verb (e.g., "Investigate machine downtime issue", "Follow up on attendance pattern")
2. **description**: Detailed context including what was discussed and why this needs attention
3. **priority**: Based on business impact and urgency
   - URGENT: Safety issues, critical failures, immediate revenue/customer impact
   - HIGH: Significant operational impact, recurring problems, compliance risks
   - MEDIUM: Improvement opportunities, moderate issues, process optimizations
   - LOW: Nice-to-have improvements, long-term considerations
4. **dueDate**: Suggest a reasonable deadline (null if unclear). Safety/urgent = within 24-48 hours, High = within a week, Medium = within 2 weeks
5. **sourceText**: The relevant quote or context from the transcript
6. **category**: One of: "operations", "safety", "team", "equipment", "business", "compliance", "improvement", "follow-up"

## Important Rules
- Be GENEROUS in identifying action items - it's better to have more items the user can delete than miss important ones
- If something was discussed as a problem, create an action item even if a solution was mentioned (for tracking)
- Don't ignore small issues - they often become big problems
- Think like a proactive manager who wants to ensure nothing falls through the cracks
- Include items for both immediate issues AND preventive/improvement measures

Return a JSON object with an "items" array:
{
  "items": [
    {
      "title": "Action item title",
      "description": "Detailed description with context",
      "priority": "MEDIUM",
      "dueDate": null or "2024-01-15T00:00:00.000Z",
      "sourceText": "Relevant quote from transcript",
      "category": "operations"
    }
  ]
}

If truly no actionable items can be identified, return: { "items": [] }`,
        },
        {
          role: 'user',
          content: `Analyze this meeting transcript and extract ALL action items, issues, opportunities, and follow-ups that should be tracked:\n\n${transcript}`,
        },
      ],
      temperature: 0.4,
      response_format: { type: 'json_object' },
    });

    const responseContent = completion.choices[0]?.message?.content || '{"items":[]}';
    let extractedItems: any[] = [];
    
    try {
      const parsed = JSON.parse(responseContent);
      extractedItems = parsed.items || parsed || [];
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      extractedItems = [];
    }

    if (!Array.isArray(extractedItems)) {
      extractedItems = [];
    }

    // Create tasks in database
    const createdTasks = await Promise.all(
      extractedItems.map(async (item: any) => {
        return prisma.task.create({
          data: {
            title: item.title?.trim() || 'Untitled Action Item',
            description: item.description?.trim() || null,
            priority: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'].includes(item.priority) ? item.priority : 'MEDIUM',
            dueDate: item.dueDate ? new Date(item.dueDate) : null,
            sourceText: item.sourceText || null,
            isAiExtracted: true,
            ownerId,
            organizationId,
            facilityId: facilityId || null,
            meetingId,
          },
          include: taskInclude,
        });
      })
    );

    return res.status(201).json({
      success: true,
      tasks: createdTasks,
      count: createdTasks.length,
      message: `Extracted ${createdTasks.length} action items from transcript`,
    });
  } catch (error: any) {
    console.error('Extract action items error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to extract action items',
    });
  }
});

// ============================================================================
// COMMENTS ENDPOINTS
// ============================================================================

// POST /api/mobile/tasks/:taskId/comments - Add a comment to a task
router.post('/:taskId/comments', async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const { content, authorId, parentId } = req.body;

    if (!content || !authorId) {
      return res.status(400).json({
        success: false,
        error: 'content and authorId are required',
      });
    }

    // Verify task exists
    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) {
      return res.status(404).json({
        success: false,
        error: 'Task not found',
      });
    }

    // Verify parent comment exists if replying
    if (parentId) {
      const parentComment = await prisma.taskComment.findUnique({ where: { id: parentId } });
      if (!parentComment || parentComment.taskId !== taskId) {
        return res.status(404).json({
          success: false,
          error: 'Parent comment not found',
        });
      }
    }

    const comment = await prisma.taskComment.create({
      data: {
        content: content.trim(),
        taskId,
        authorId,
        parentId: parentId || null,
      },
      include: {
        author: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    // Log the activity
    await createActivityLog({
      taskId,
      userId: authorId,
      action: 'ADD_COMMENT',
      field: 'comment',
      newValue: content.trim().substring(0, 100) + (content.length > 100 ? '...' : ''),
      metadata: {
        commentId: comment.id,
        authorName: `${comment.author.firstName} ${comment.author.lastName}`,
      },
    });

    return res.status(201).json({
      success: true,
      comment,
    });
  } catch (error: any) {
    console.error('Add comment error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to add comment',
    });
  }
});

// GET /api/mobile/tasks/:taskId/comments - Get all comments for a task
router.get('/:taskId/comments', async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;

    // Verify task exists
    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) {
      return res.status(404).json({
        success: false,
        error: 'Task not found',
      });
    }

    const comments = await prisma.taskComment.findMany({
      where: { taskId, parentId: null }, // Only top-level comments
      include: {
        author: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        replies: {
          include: {
            author: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({
      success: true,
      comments,
      count: comments.length,
    });
  } catch (error: any) {
    console.error('Get comments error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch comments',
    });
  }
});

// PATCH /api/mobile/tasks/comments/:commentId - Update a comment
router.patch('/comments/:commentId', async (req: Request, res: Response) => {
  try {
    const { commentId } = req.params;
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({
        success: false,
        error: 'content is required',
      });
    }

    const existingComment = await prisma.taskComment.findUnique({ where: { id: commentId } });
    if (!existingComment) {
      return res.status(404).json({
        success: false,
        error: 'Comment not found',
      });
    }

    const comment = await prisma.taskComment.update({
      where: { id: commentId },
      data: { content: content.trim() },
      include: {
        author: {
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
      comment,
    });
  } catch (error: any) {
    console.error('Update comment error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update comment',
    });
  }
});

// DELETE /api/mobile/tasks/comments/:commentId - Delete a comment
router.delete('/comments/:commentId', async (req: Request, res: Response) => {
  try {
    const { commentId } = req.params;
    const { userId } = req.query; // Get userId from query params for logging

    const existingComment = await prisma.taskComment.findUnique({
      where: { id: commentId },
      include: {
        author: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
    if (!existingComment) {
      return res.status(404).json({
        success: false,
        error: 'Comment not found',
      });
    }

    // Delete replies first, then the comment
    await prisma.taskComment.deleteMany({ where: { parentId: commentId } });
    await prisma.taskComment.delete({ where: { id: commentId } });

    // Log the activity
    await createActivityLog({
      taskId: existingComment.taskId,
      userId: (userId as string) || existingComment.authorId,
      action: 'DELETE_COMMENT',
      field: 'comment',
      previousValue: existingComment.content.substring(0, 100) + (existingComment.content.length > 100 ? '...' : ''),
      metadata: {
        commentId: existingComment.id,
        authorName: `${existingComment.author.firstName} ${existingComment.author.lastName}`,
      },
    });

    return res.json({
      success: true,
      message: 'Comment deleted successfully',
    });
  } catch (error: any) {
    console.error('Delete comment error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete comment',
    });
  }
});

// ============================================================================
// EVIDENCE ENDPOINTS
// ============================================================================

// POST /api/mobile/tasks/:taskId/evidence - Add evidence to a task
router.post('/:taskId/evidence', async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const { title, description, fileUrl, fileType, fileName, uploaderId } = req.body;

    if (!title || !uploaderId) {
      return res.status(400).json({
        success: false,
        error: 'title and uploaderId are required',
      });
    }

    // Verify task exists
    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) {
      return res.status(404).json({
        success: false,
        error: 'Task not found',
      });
    }

    const evidence = await prisma.taskEvidence.create({
      data: {
        title: title.trim(),
        description: description?.trim() || null,
        fileUrl: fileUrl || null,
        fileType: fileType || null,
        fileName: fileName || null,
        taskId,
        uploaderId,
      },
      include: {
        uploader: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    // Log the activity
    await createActivityLog({
      taskId,
      userId: uploaderId,
      action: 'ADD_EVIDENCE',
      field: 'evidence',
      newValue: title.trim(),
      metadata: {
        evidenceId: evidence.id,
        fileName: fileName || null,
        fileType: fileType || null,
        uploaderName: `${evidence.uploader.firstName} ${evidence.uploader.lastName}`,
      },
    });

    return res.status(201).json({
      success: true,
      evidence,
    });
  } catch (error: any) {
    console.error('Add evidence error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to add evidence',
    });
  }
});

// GET /api/mobile/tasks/:taskId/evidence - Get all evidence for a task
router.get('/:taskId/evidence', async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;

    // Verify task exists
    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) {
      return res.status(404).json({
        success: false,
        error: 'Task not found',
      });
    }

    const evidence = await prisma.taskEvidence.findMany({
      where: { taskId },
      include: {
        uploader: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({
      success: true,
      evidence,
      count: evidence.length,
    });
  } catch (error: any) {
    console.error('Get evidence error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch evidence',
    });
  }
});

// PATCH /api/mobile/tasks/evidence/:evidenceId - Update evidence
router.patch('/evidence/:evidenceId', async (req: Request, res: Response) => {
  try {
    const { evidenceId } = req.params;
    const { title, description, fileUrl, fileType, fileName } = req.body;

    const existingEvidence = await prisma.taskEvidence.findUnique({ where: { id: evidenceId } });
    if (!existingEvidence) {
      return res.status(404).json({
        success: false,
        error: 'Evidence not found',
      });
    }

    const updateData: any = {};
    if (title !== undefined) updateData.title = title.trim();
    if (description !== undefined) updateData.description = description?.trim() || null;
    if (fileUrl !== undefined) updateData.fileUrl = fileUrl;
    if (fileType !== undefined) updateData.fileType = fileType;
    if (fileName !== undefined) updateData.fileName = fileName;

    const evidence = await prisma.taskEvidence.update({
      where: { id: evidenceId },
      data: updateData,
      include: {
        uploader: {
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
      evidence,
    });
  } catch (error: any) {
    console.error('Update evidence error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update evidence',
    });
  }
});

// DELETE /api/mobile/tasks/evidence/:evidenceId - Delete evidence
router.delete('/evidence/:evidenceId', async (req: Request, res: Response) => {
  try {
    const { evidenceId } = req.params;
    const { userId } = req.query; // Get userId from query params for logging

    const existingEvidence = await prisma.taskEvidence.findUnique({
      where: { id: evidenceId },
      include: {
        uploader: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
    if (!existingEvidence) {
      return res.status(404).json({
        success: false,
        error: 'Evidence not found',
      });
    }

    await prisma.taskEvidence.delete({ where: { id: evidenceId } });

    // Log the activity
    await createActivityLog({
      taskId: existingEvidence.taskId,
      userId: (userId as string) || existingEvidence.uploaderId,
      action: 'DELETE_EVIDENCE',
      field: 'evidence',
      previousValue: existingEvidence.title,
      metadata: {
        evidenceId: existingEvidence.id,
        fileName: existingEvidence.fileName,
        fileType: existingEvidence.fileType,
        uploaderName: `${existingEvidence.uploader.firstName} ${existingEvidence.uploader.lastName}`,
      },
    });

    return res.json({
      success: true,
      message: 'Evidence deleted successfully',
    });
  } catch (error: any) {
    console.error('Delete evidence error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete evidence',
    });
  }
});

// ============================================================================
// BULK OPERATIONS
// ============================================================================

// POST /api/mobile/tasks/bulk-create - Create multiple tasks at once
router.post('/bulk-create', async (req: Request, res: Response) => {
  try {
    const { tasks: tasksData, ownerId, organizationId, facilityId, meetingId } = req.body;

    if (!Array.isArray(tasksData) || tasksData.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'tasks array is required and must not be empty',
      });
    }

    if (!ownerId || !organizationId) {
      return res.status(400).json({
        success: false,
        error: 'ownerId and organizationId are required',
      });
    }

    const createdTasks = await Promise.all(
      tasksData.map(async (taskData: any) => {
        return prisma.task.create({
          data: {
            title: taskData.title?.trim() || 'Untitled Task',
            description: taskData.description?.trim() || null,
            priority: taskData.priority || 'MEDIUM',
            dueDate: taskData.dueDate ? new Date(taskData.dueDate) : null,
            assigneeId: taskData.assigneeId || null,
            sourceText: taskData.sourceText || null,
            isAiExtracted: taskData.isAiExtracted || false,
            ownerId,
            organizationId,
            facilityId: facilityId || null,
            meetingId: meetingId || null,
          },
          include: taskInclude,
        });
      })
    );

    return res.status(201).json({
      success: true,
      tasks: createdTasks,
      count: createdTasks.length,
    });
  } catch (error: any) {
    console.error('Bulk create tasks error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create tasks',
    });
  }
});

// PATCH /api/mobile/tasks/bulk-update-status - Update status of multiple tasks
router.patch('/bulk-update-status', async (req: Request, res: Response) => {
  try {
    const { taskIds, status } = req.body;

    if (!Array.isArray(taskIds) || taskIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'taskIds array is required',
      });
    }

    if (!['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status value',
      });
    }

    const updateData: any = { status };
    if (status === 'COMPLETED') {
      updateData.completedAt = new Date();
      updateData.progress = 100;
    } else if (status === 'PENDING') {
      updateData.completedAt = null;
    }

    await prisma.task.updateMany({
      where: { id: { in: taskIds } },
      data: updateData,
    });

    const updatedTasks = await prisma.task.findMany({
      where: { id: { in: taskIds } },
      include: taskInclude,
    });

    return res.json({
      success: true,
      tasks: updatedTasks,
      count: updatedTasks.length,
    });
  } catch (error: any) {
    console.error('Bulk update status error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update tasks',
    });
  }
});

// ============================================================================
// ASSIGNEE ENDPOINTS - Multiple assignees per task
// ============================================================================

// POST /api/mobile/tasks/:taskId/assignees - Add assignees to a task
router.post('/:taskId/assignees', async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const { userIds, assignedBy } = req.body;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'userIds array is required',
      });
    }

    // Verify task exists
    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) {
      return res.status(404).json({
        success: false,
        error: 'Task not found',
      });
    }

    // Verify all users exist
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
    });

    if (users.length !== userIds.length) {
      return res.status(404).json({
        success: false,
        error: 'One or more users not found',
      });
    }

    // Create assignee records (upsert to avoid duplicates)
    const assignees = await Promise.all(
      userIds.map(async (userId: string) => {
        return prisma.taskAssignee.upsert({
          where: {
            taskId_userId: { taskId, userId },
          },
          update: {
            assignedAt: new Date(),
            assignedBy: assignedBy || null,
          },
          create: {
            taskId,
            userId,
            assignedBy: assignedBy || null,
          },
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        });
      })
    );

    // Log activity for each assignee added
    for (const assignee of assignees) {
      await createActivityLog({
        taskId,
        userId: assignedBy || task.ownerId,
        action: 'ADD_ASSIGNEE',
        field: 'assignee',
        newValue: `${assignee.user.firstName} ${assignee.user.lastName}`,
        metadata: {
          assigneeId: assignee.user.id,
          assigneeEmail: assignee.user.email,
        },
      });
    }

    // Get updated task with all assignees
    const updatedTask = await prisma.task.findUnique({
      where: { id: taskId },
      include: taskInclude,
    });

    return res.status(201).json({
      success: true,
      assignees,
      task: updatedTask,
    });
  } catch (error: any) {
    console.error('Add assignees error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to add assignees',
    });
  }
});

// DELETE /api/mobile/tasks/:taskId/assignees/:userId - Remove an assignee from a task
router.delete('/:taskId/assignees/:userId', async (req: Request, res: Response) => {
  try {
    const { taskId, userId } = req.params;
    const { removedBy } = req.query; // Who is removing the assignee

    // Verify the assignee exists with user details
    const assignee = await prisma.taskAssignee.findUnique({
      where: {
        taskId_userId: { taskId, userId },
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    if (!assignee) {
      return res.status(404).json({
        success: false,
        error: 'Assignee not found',
      });
    }

    // Get the task to find the owner for logging
    const task = await prisma.task.findUnique({ where: { id: taskId } });

    await prisma.taskAssignee.delete({
      where: {
        taskId_userId: { taskId, userId },
      },
    });

    // Log the activity
    await createActivityLog({
      taskId,
      userId: (removedBy as string) || task?.ownerId || userId,
      action: 'REMOVE_ASSIGNEE',
      field: 'assignee',
      previousValue: `${assignee.user.firstName} ${assignee.user.lastName}`,
      metadata: {
        assigneeId: assignee.user.id,
        assigneeEmail: assignee.user.email,
      },
    });

    // Get updated task
    const updatedTask = await prisma.task.findUnique({
      where: { id: taskId },
      include: taskInclude,
    });

    return res.json({
      success: true,
      message: 'Assignee removed',
      task: updatedTask,
    });
  } catch (error: any) {
    console.error('Remove assignee error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to remove assignee',
    });
  }
});

// PUT /api/mobile/tasks/:taskId/assignees - Replace all assignees for a task
router.put('/:taskId/assignees', async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const { userIds, assignedBy } = req.body;

    if (!userIds || !Array.isArray(userIds)) {
      return res.status(400).json({
        success: false,
        error: 'userIds array is required',
      });
    }

    // Verify task exists
    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) {
      return res.status(404).json({
        success: false,
        error: 'Task not found',
      });
    }

    // Delete all existing assignees
    await prisma.taskAssignee.deleteMany({
      where: { taskId },
    });

    // Create new assignees (if any)
    if (userIds.length > 0) {
      await prisma.taskAssignee.createMany({
        data: userIds.map((userId: string) => ({
          taskId,
          userId,
          assignedBy: assignedBy || null,
        })),
      });
    }

    // Get updated task with all assignees
    const updatedTask = await prisma.task.findUnique({
      where: { id: taskId },
      include: taskInclude,
    });

    return res.json({
      success: true,
      task: updatedTask,
    });
  } catch (error: any) {
    console.error('Replace assignees error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to replace assignees',
    });
  }
});

// GET /api/mobile/tasks/:taskId/assignees - Get all assignees for a task
router.get('/:taskId/assignees', async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;

    const assignees = await prisma.taskAssignee.findMany({
      where: { taskId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        assigner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { assignedAt: 'desc' },
    });

    return res.json({
      success: true,
      assignees,
      count: assignees.length,
    });
  } catch (error: any) {
    console.error('Get assignees error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get assignees',
    });
  }
});

// ============================================================================
// ACTIVITY LOG ENDPOINTS
// ============================================================================

// GET /api/mobile/tasks/:taskId/activity-logs - Get all activity logs for a task
router.get('/:taskId/activity-logs', async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const { limit = '50' } = req.query;

    // Verify task exists
    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) {
      return res.status(404).json({
        success: false,
        error: 'Task not found',
      });
    }

    const logs = await prisma.taskActivityLog.findMany({
      where: { taskId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            profilePicture: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string, 10),
    });

    return res.json({
      success: true,
      logs,
      count: logs.length,
    });
  } catch (error: any) {
    console.error('Get activity logs error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get activity logs',
    });
  }
});

export default router;
