/**
 * Dashboard Routes for Meeting Intelligence Mobile App
 * 
 * Aggregates data from meetings, tasks, conflict cases, and user activity
 * to provide comprehensive dashboard statistics
 * 
 * Endpoints:
 * - GET /api/mobile/dashboard/stats      - Get dashboard statistics
 * - GET /api/mobile/dashboard/activity   - Get recent activity feed
 * - GET /api/mobile/dashboard/insights   - Get AI-powered insights
 */

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

/**
 * GET /api/mobile/dashboard/stats
 * Get comprehensive dashboard statistics for a user
 * 
 * Query params:
 * - userId: User ID
 * - organizationId: Organization ID
 * - facilityId: (optional) Facility ID filter
 * - period: (optional) 'today' | 'week' | 'month' | 'all' (default: 'week')
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const { userId, organizationId, facilityId, period = 'week' } = req.query;

    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'User ID is required',
      });
    }

    if (!organizationId || typeof organizationId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Organization ID is required',
      });
    }

    // Calculate date range based on period
    const now = new Date();
    let startDate: Date;
    
    switch (period) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'all':
        startDate = new Date(0); // Beginning of time
        break;
      case 'week':
      default:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
    }

    // Calculate previous period for comparison
    const periodDuration = now.getTime() - startDate.getTime();
    const prevStartDate = new Date(startDate.getTime() - periodDuration);
    const prevEndDate = startDate;

    // Build base where clause
    const baseWhere: any = {
      organizationId,
    };

    if (facilityId && typeof facilityId === 'string') {
      baseWhere.facilityId = facilityId;
    }

    // ========== MEETINGS STATS ==========
    
    // Current period meetings
    const currentMeetings = await prisma.meeting.findMany({
      where: {
        ...baseWhere,
        creatorId: userId,
        createdAt: { gte: startDate },
      },
      select: {
        id: true,
        status: true,
        duration: true,
        meetingType: true,
        createdAt: true,
        title: true,
        _count: {
          select: { actionItems: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Previous period meetings count for trend
    const prevMeetingsCount = await prisma.meeting.count({
      where: {
        ...baseWhere,
        creatorId: userId,
        createdAt: { gte: prevStartDate, lt: prevEndDate },
      },
    });

    // Calculate meetings trend
    const currentMeetingsCount = currentMeetings.length;
    const meetingsTrend = prevMeetingsCount > 0 
      ? Math.round(((currentMeetingsCount - prevMeetingsCount) / prevMeetingsCount) * 100)
      : currentMeetingsCount > 0 ? 100 : 0;

    // Total recording duration this period (in seconds)
    const totalDuration = currentMeetings.reduce((sum, m) => sum + (m.duration || 0), 0);

    // Previous period duration for trend
    const prevDurationResult = await prisma.meeting.aggregate({
      where: {
        ...baseWhere,
        creatorId: userId,
        createdAt: { gte: prevStartDate, lt: prevEndDate },
      },
      _sum: { duration: true },
    });
    const prevDuration = prevDurationResult._sum.duration || 0;
    const durationTrend = prevDuration > 0 
      ? Math.round(((totalDuration - prevDuration) / prevDuration) * 100)
      : totalDuration > 0 ? 100 : 0;

    // Meetings by type
    const meetingsByType: { [key: string]: number } = {};
    for (const meeting of currentMeetings) {
      meetingsByType[meeting.meetingType] = (meetingsByType[meeting.meetingType] || 0) + 1;
    }

    // Meetings by status
    const meetingsByStatus: { [key: string]: number } = {};
    for (const meeting of currentMeetings) {
      meetingsByStatus[meeting.status] = (meetingsByStatus[meeting.status] || 0) + 1;
    }

    // ========== TASKS STATS ==========

    // Current period tasks (owned or assigned)
    const currentTasks = await prisma.task.findMany({
      where: {
        ...baseWhere,
        OR: [
          { ownerId: userId },
          { assigneeId: userId },
          { assignees: { some: { userId } } },
        ],
        createdAt: { gte: startDate },
      },
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        dueDate: true,
        completedAt: true,
        isAiExtracted: true,
        owner: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // All tasks for user (for pending count)
    const allUserTasks = await prisma.task.findMany({
      where: {
        ...baseWhere,
        OR: [
          { ownerId: userId },
          { assigneeId: userId },
          { assignees: { some: { userId } } },
        ],
      },
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        dueDate: true,
        completedAt: true,
        createdAt: true,
        meetingId: true,
        isAiExtracted: true,
        owner: {
          select: { id: true, firstName: true, lastName: true },
        },
        meeting: {
          select: { id: true, title: true },
        },
      },
      orderBy: [
        { priority: 'desc' },
        { dueDate: 'asc' },
        { createdAt: 'desc' },
      ],
    });

    // Task counts
    const pendingTasks = allUserTasks.filter(t => t.status !== 'COMPLETED');
    const completedTasks = allUserTasks.filter(t => t.status === 'COMPLETED');
    const overdueTasks = pendingTasks.filter(t => t.dueDate && new Date(t.dueDate) < now);
    const aiExtractedTasks = allUserTasks.filter(t => t.isAiExtracted);

    // Previous period completed tasks for trend
    const prevCompletedCount = await prisma.task.count({
      where: {
        ...baseWhere,
        OR: [
          { ownerId: userId },
          { assigneeId: userId },
          { assignees: { some: { userId } } },
        ],
        status: 'COMPLETED',
        completedAt: { gte: prevStartDate, lt: prevEndDate },
      },
    });

    const currentCompletedCount = currentTasks.filter(t => t.status === 'COMPLETED').length;
    const completedTrend = prevCompletedCount > 0
      ? Math.round(((currentCompletedCount - prevCompletedCount) / prevCompletedCount) * 100)
      : currentCompletedCount > 0 ? 100 : 0;

    // Previous period pending for trend
    const currentPendingCount = currentTasks.filter(t => t.status !== 'COMPLETED').length;
    const prevPendingCount = await prisma.task.count({
      where: {
        ...baseWhere,
        OR: [
          { ownerId: userId },
          { assigneeId: userId },
          { assignees: { some: { userId } } },
        ],
        status: { not: 'COMPLETED' },
        createdAt: { gte: prevStartDate, lt: prevEndDate },
      },
    });
    const pendingTrend = prevPendingCount > 0
      ? Math.round(((currentPendingCount - prevPendingCount) / prevPendingCount) * 100)
      : currentPendingCount > 0 ? 100 : 0;

    // Tasks by priority
    const tasksByPriority: { [key: string]: number } = {};
    for (const task of pendingTasks) {
      tasksByPriority[task.priority] = (tasksByPriority[task.priority] || 0) + 1;
    }

    // ========== CONFLICT CASES STATS ==========

    const conflictCases = await prisma.conflictCase.findMany({
      where: {
        organizationId,
        ...(facilityId ? { facilityId: facilityId as string } : {}),
      },
      select: {
        id: true,
        caseNumber: true,
        status: true,
        type: true,
        createdAt: true,
        closedAt: true,
        isLocked: true,
        selectedAction: true,
      },
    });

    const activeCases = conflictCases.filter(c => 
      ['DRAFT', 'IN_PROGRESS', 'PENDING_REVIEW', 'AWAITING_ACTION'].includes(c.status)
    );
    const closedCases = conflictCases.filter(c => c.status === 'CLOSED');
    const escalatedCases = conflictCases.filter(c => c.status === 'ESCALATED');

    // Cases by type
    const casesByType: { [key: string]: number } = {};
    for (const c of conflictCases) {
      casesByType[c.type] = (casesByType[c.type] || 0) + 1;
    }

    // ========== USER INFO ==========

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        profilePicture: true,
        lastLoginAt: true,
      },
    });

    // ========== RECENT MEETINGS (for display) ==========

    const recentMeetings = await prisma.meeting.findMany({
      where: {
        ...baseWhere,
        creatorId: userId,
      },
      select: {
        id: true,
        title: true,
        meetingType: true,
        status: true,
        duration: true,
        createdAt: true,
        recordedAt: true,
        processingCompletedAt: true,
        _count: {
          select: { 
            actionItems: true,
            participants: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    // ========== BUILD RESPONSE ==========

    const dashboardStats = {
      user: user ? {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        profilePicture: user.profilePicture,
      } : null,

      period: {
        type: period,
        startDate: startDate.toISOString(),
        endDate: now.toISOString(),
      },

      meetings: {
        total: currentMeetingsCount,
        trend: meetingsTrend,
        trendDirection: meetingsTrend >= 0 ? 'up' : 'down',
        totalDurationSeconds: totalDuration,
        totalDurationFormatted: formatDuration(totalDuration),
        durationTrend,
        durationTrendDirection: durationTrend >= 0 ? 'up' : 'down',
        byType: Object.entries(meetingsByType).map(([type, count]) => ({ type, count })),
        byStatus: Object.entries(meetingsByStatus).map(([status, count]) => ({ status, count })),
        recentMeetings: recentMeetings.map(m => ({
          id: m.id,
          title: m.title || 'Untitled Meeting',
          meetingType: m.meetingType,
          status: m.status,
          duration: m.duration,
          durationFormatted: m.duration ? formatDuration(m.duration) : null,
          createdAt: m.createdAt.toISOString(),
          actionItemsCount: m._count.actionItems,
          participantsCount: m._count.participants,
        })),
      },

      tasks: {
        total: allUserTasks.length,
        pending: pendingTasks.length,
        pendingTrend,
        pendingTrendDirection: pendingTrend <= 0 ? 'up' : 'down', // Fewer pending is better
        completed: completedTasks.length,
        completedTrend,
        completedTrendDirection: completedTrend >= 0 ? 'up' : 'down',
        overdue: overdueTasks.length,
        aiExtracted: aiExtractedTasks.length,
        byPriority: Object.entries(tasksByPriority).map(([priority, count]) => ({ priority, count })),
        pendingItems: pendingTasks.slice(0, 10).map(t => ({
          id: t.id,
          title: t.title,
          status: t.status,
          priority: t.priority,
          dueDate: t.dueDate?.toISOString() || null,
          isOverdue: t.dueDate ? new Date(t.dueDate) < now : false,
          isAiExtracted: t.isAiExtracted,
          meetingId: t.meetingId,
          meetingTitle: t.meeting?.title || null,
        })),
      },

      conflictResolution: {
        totalCases: conflictCases.length,
        activeCases: activeCases.length,
        closedCases: closedCases.length,
        escalatedCases: escalatedCases.length,
        byType: Object.entries(casesByType).map(([type, count]) => ({ type, count })),
        resolutionRate: conflictCases.length > 0 
          ? Math.round((closedCases.length / conflictCases.length) * 100) 
          : 0,
      },

      productivity: {
        completionRate: allUserTasks.length > 0 
          ? Math.round((completedTasks.length / allUserTasks.length) * 100) 
          : 0,
        avgMeetingDuration: currentMeetingsCount > 0 
          ? Math.round(totalDuration / currentMeetingsCount) 
          : 0,
        avgMeetingDurationFormatted: currentMeetingsCount > 0 
          ? formatDuration(Math.round(totalDuration / currentMeetingsCount)) 
          : '0m',
        actionItemsPerMeeting: currentMeetingsCount > 0 
          ? Math.round((aiExtractedTasks.length / currentMeetingsCount) * 10) / 10 
          : 0,
      },

      generatedAt: new Date().toISOString(),
    };

    res.json({
      success: true,
      data: dashboardStats,
    });
  } catch (error: any) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard statistics',
      details: error.message,
    });
  }
});

/**
 * GET /api/mobile/dashboard/activity
 * Get recent activity feed for the user
 */
router.get('/activity', async (req: Request, res: Response) => {
  try {
    const { userId, organizationId, limit = '20' } = req.query;

    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'User ID is required',
      });
    }

    if (!organizationId || typeof organizationId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Organization ID is required',
      });
    }

    const limitNum = parseInt(limit as string, 10) || 20;

    // Get recent meetings
    const recentMeetings = await prisma.meeting.findMany({
      where: {
        organizationId,
        creatorId: userId,
      },
      select: {
        id: true,
        title: true,
        meetingType: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: 'desc' },
      take: limitNum,
    });

    // Get recent tasks
    const recentTasks = await prisma.task.findMany({
      where: {
        organizationId,
        OR: [
          { ownerId: userId },
          { assigneeId: userId },
        ],
      },
      select: {
        id: true,
        title: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        completedAt: true,
      },
      orderBy: { updatedAt: 'desc' },
      take: limitNum,
    });

    // Get recent conflict cases
    const recentCases = await prisma.conflictCase.findMany({
      where: {
        organizationId,
      },
      select: {
        id: true,
        caseNumber: true,
        status: true,
        type: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: 'desc' },
      take: limitNum,
    });

    // Combine and sort by date
    const activities: any[] = [];

    for (const meeting of recentMeetings) {
      activities.push({
        id: `meeting-${meeting.id}`,
        type: 'MEETING',
        entityId: meeting.id,
        title: meeting.title || 'Untitled Meeting',
        subtitle: `${meeting.meetingType} meeting`,
        status: meeting.status,
        timestamp: meeting.updatedAt.toISOString(),
        icon: 'video.fill',
        color: '#7C3AED',
      });
    }

    for (const task of recentTasks) {
      activities.push({
        id: `task-${task.id}`,
        type: 'TASK',
        entityId: task.id,
        title: task.title,
        subtitle: task.completedAt ? 'Task completed' : 'Action item',
        status: task.status,
        timestamp: task.updatedAt.toISOString(),
        icon: task.status === 'COMPLETED' ? 'checkmark.circle.fill' : 'checklist',
        color: task.status === 'COMPLETED' ? '#10B981' : '#F59E0B',
      });
    }

    for (const caseItem of recentCases) {
      activities.push({
        id: `case-${caseItem.id}`,
        type: 'CONFLICT_CASE',
        entityId: caseItem.id,
        title: `Case ${caseItem.caseNumber}`,
        subtitle: `${caseItem.type} case`,
        status: caseItem.status,
        timestamp: caseItem.updatedAt.toISOString(),
        icon: 'folder.fill',
        color: '#3B82F6',
      });
    }

    // Sort by timestamp descending
    activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    res.json({
      success: true,
      data: activities.slice(0, limitNum),
    });
  } catch (error: any) {
    console.error('Error fetching activity feed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch activity feed',
      details: error.message,
    });
  }
});

// Helper function to format duration in seconds to human readable
function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  return `${minutes}m`;
}

export default router;
