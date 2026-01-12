// Phase 4.4: Notification Routes
// Routes for managing user notifications

import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { prisma } from '../utils/prisma';
import {
  getUserNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  checkAndNotifySLAWarnings,
} from '../services/notificationService';
import { requireMinimumRole } from '../middleware/rbac';
import { UserRole } from '@prisma/client';

const router = Router();

// All routes require authentication
router.use(authenticate);

// GET /api/notifications - Get user's notifications
router.get('/', async (req, res) => {
  const user = (req as any).user;
  const { unreadOnly, limit, skip } = req.query;

  const result = await getUserNotifications(user.id, {
    unreadOnly: unreadOnly === 'true',
    limit: limit ? parseInt(limit as string) : 20,
    skip: skip ? parseInt(skip as string) : 0,
  });

  res.json({
    success: true,
    data: result,
  });
});

// GET /api/notifications/unread-count - Get unread notification count
router.get('/unread-count', async (req, res) => {
  const user = (req as any).user;

  const count = await prisma.notification.count({
    where: {
      userId: user.id,
      isRead: false,
    },
  });

  res.json({
    success: true,
    data: { count },
  });
});

// PATCH /api/notifications/:id/read - Mark notification as read
router.patch('/:id/read', async (req, res) => {
  const user = (req as any).user;
  const { id } = req.params;

  await markNotificationRead(id, user.id);

  res.json({
    success: true,
    message: 'Notification marked as read',
  });
});

// POST /api/notifications/mark-all-read - Mark all notifications as read
router.post('/mark-all-read', async (req, res) => {
  const user = (req as any).user;

  const result = await markAllNotificationsRead(user.id);

  res.json({
    success: true,
    message: `${result.count} notifications marked as read`,
  });
});

// DELETE /api/notifications/:id - Delete a notification
router.delete('/:id', async (req, res) => {
  const user = (req as any).user;
  const { id } = req.params;

  await deleteNotification(id, user.id);

  res.json({
    success: true,
    message: 'Notification deleted',
  });
});

// POST /api/notifications/check-sla-warnings - Check and send SLA warning notifications (admin only)
router.post('/check-sla-warnings', requireMinimumRole(UserRole.ADMIN), async (req, res) => {
  const result = await checkAndNotifySLAWarnings();

  res.json({
    success: true,
    data: result,
    message: `Sent ${result.responseWarnings} response warnings and ${result.resolutionWarnings} resolution warnings`,
  });
});

export default router;
