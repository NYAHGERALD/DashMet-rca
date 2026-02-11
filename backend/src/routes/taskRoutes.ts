/**
 * Task Routes for Meeting Intelligence Mobile App
 * 
 * Endpoints:
 * - POST   /api/mobile/tasks                    - Create a new task
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
 */

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import OpenAI from 'openai';

const router = Router();
const prisma = new PrismaClient();

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Include relations for tasks
const taskInclude = {
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
  assignees: {
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
// Expects: { title?, description?, status?, priority?, dueDate?, assigneeId?, progress? }
// ============================================================================
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { title, description, status, priority, dueDate, assigneeId, progress } = req.body;

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
        updateData.progress = 100; // Auto-set progress to 100%
      } else if (existingTask.status === 'COMPLETED' && status !== 'COMPLETED') {
        // If changing from COMPLETED to another status, clear completedAt
        updateData.completedAt = null;
      }
    }
    if (priority !== undefined) updateData.priority = priority;
    if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null;
    if (assigneeId !== undefined) updateData.assigneeId = assigneeId;
    if (progress !== undefined) {
      updateData.progress = Math.max(0, Math.min(100, progress)); // Clamp 0-100
      // Auto-complete if progress hits 100
      if (progress >= 100 && existingTask.status !== 'COMPLETED') {
        updateData.status = 'COMPLETED';
        updateData.completedAt = new Date();
      }
    }

    const task = await prisma.task.update({
      where: { id },
      data: updateData,
      include: taskInclude,
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

    const existingComment = await prisma.taskComment.findUnique({ where: { id: commentId } });
    if (!existingComment) {
      return res.status(404).json({
        success: false,
        error: 'Comment not found',
      });
    }

    // Delete replies first, then the comment
    await prisma.taskComment.deleteMany({ where: { parentId: commentId } });
    await prisma.taskComment.delete({ where: { id: commentId } });

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

    const existingEvidence = await prisma.taskEvidence.findUnique({ where: { id: evidenceId } });
    if (!existingEvidence) {
      return res.status(404).json({
        success: false,
        error: 'Evidence not found',
      });
    }

    await prisma.taskEvidence.delete({ where: { id: evidenceId } });

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

    // Verify the assignee exists
    const assignee = await prisma.taskAssignee.findUnique({
      where: {
        taskId_userId: { taskId, userId },
      },
    });

    if (!assignee) {
      return res.status(404).json({
        success: false,
        error: 'Assignee not found',
      });
    }

    await prisma.taskAssignee.delete({
      where: {
        taskId_userId: { taskId, userId },
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

export default router;
