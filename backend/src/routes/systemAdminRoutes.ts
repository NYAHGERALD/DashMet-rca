import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// System Admin Dashboard Stats - SYSTEM_ADMIN only
router.get('/dashboard/stats', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const currentUser = req.user!;
    
    // Only SYSTEM_ADMIN can access this endpoint
    if (currentUser.role !== 'SYSTEM_ADMIN') {
      return res.status(403).json({
        success: false,
        error: 'Access denied. System Administrator access required.',
      });
    }

    // Get date ranges
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    // Fetch all stats in parallel
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
      // Total organizations
      prisma.organization.count(),
      
      // Active organizations (has at least one user)
      prisma.organization.count({
        where: {
          User: {
            some: {},
          },
        },
      }),
      
      // Total users
      prisma.user.count(),
      
      // Active users (logged in within last 30 days - approximate by checking recent incidents or just count all for now)
      prisma.user.count({
        where: {
          isActive: true,
        },
      }),
      
      // New users this month
      prisma.user.count({
        where: {
          createdAt: {
            gte: startOfMonth,
          },
        },
      }),
      
      // Open support requests
      prisma.supportRequest.count({
        where: {
          status: 'OPEN',
        },
      }),
      
      // Total support requests
      prisma.supportRequest.count(),
      
      // Total access codes
      prisma.accessCode.count(),
      
      // Used access codes
      prisma.accessCode.count({
        where: {
          usedCount: {
            gt: 0,
          },
        },
      }),
      
      // Users grouped by role
      prisma.user.groupBy({
        by: ['role'],
        _count: {
          id: true,
        },
      }),
      
      // Support requests by category
      prisma.supportRequest.groupBy({
        by: ['category'],
        _count: {
          id: true,
        },
      }),
    ]);

    // Generate user growth trend (last 6 months)
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

    // Format users by role for pie chart
    const usersByRoleFormatted = usersByRole.map(item => ({
      name: item.role.replace(/_/g, ' '),
      value: item._count.id,
    }));

    // Format support by category for bar chart
    const supportRequestsByCategory = supportByCategory.map(item => ({
      name: item.category || 'Other',
      value: item._count.id,
    }));

    // Organizations by status (using user count as proxy for active)
    const organizationsByStatus = [
      { name: 'Active', value: activeOrganizations },
      { name: 'Inactive', value: totalOrganizations - activeOrganizations },
    ].filter(item => item.value > 0);

    const stats = {
      // Platform overview
      totalOrganizations,
      activeOrganizations,
      totalUsers,
      activeUsers,
      newUsersThisMonth,
      
      // Support
      openSupportRequests,
      totalSupportRequests,
      avgResponseTime: 0, // Would need more complex calculation
      
      // Access codes
      totalAccessCodes,
      usedAccessCodes,
      
      // Trends
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
