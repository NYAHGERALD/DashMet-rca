// Phase 4.4: Notification Service
// Handles in-app notifications and email notifications

import { prisma } from '../utils/prisma';
import { NotificationType } from '@prisma/client';
import nodemailer from 'nodemailer';
import { v4 as uuidv4 } from 'uuid';

interface NotificationData {
  type: NotificationType;
  title: string;
  message: string;
  userId: string;
  incidentId?: string;
}

interface EmailNotification {
  to: string;
  subject: string;
  body: string;
  html?: string;
}

// Email transporter configuration (use environment variables in production)
const createEmailTransporter = () => {
  // Check if email is configured
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
    return null;
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
};

/**
 * Create an in-app notification
 */
export async function createNotification(data: NotificationData) {
  return prisma.notification.create({
    data: {
      id: uuidv4(),
      type: data.type,
      title: data.title,
      message: data.message,
      userId: data.userId,
      incidentId: data.incidentId,
    },
  });
}

/**
 * Create multiple notifications at once
 */
export async function createBulkNotifications(notifications: NotificationData[]) {
  return prisma.notification.createMany({
    data: notifications.map(n => ({
      id: uuidv4(),
      type: n.type,
      title: n.title,
      message: n.message,
      userId: n.userId,
      incidentId: n.incidentId,
    })),
  });
}

/**
 * Get notifications for a user
 */
export async function getUserNotifications(
  userId: string,
  options: { unreadOnly?: boolean; limit?: number; skip?: number } = {}
) {
  const { unreadOnly = false, limit = 20, skip = 0 } = options;

  const where: any = { userId };
  if (unreadOnly) {
    where.isRead = false;
  }

  const [notifications, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip,
      include: {
        Incident: {
          select: {
            id: true,
            incidentNumber: true,
            type: true,
            severity: true,
          },
        },
      },
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { userId, isRead: false } }),
  ]);

  return {
    notifications,
    total,
    unreadCount,
  };
}

/**
 * Mark notification as read
 */
export async function markNotificationRead(notificationId: string, userId: string) {
  return prisma.notification.updateMany({
    where: {
      id: notificationId,
      userId, // Security: ensure user owns the notification
    },
    data: { isRead: true },
  });
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllNotificationsRead(userId: string) {
  return prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  });
}

/**
 * Delete a notification
 */
export async function deleteNotification(notificationId: string, userId: string) {
  return prisma.notification.deleteMany({
    where: {
      id: notificationId,
      userId,
    },
  });
}

/**
 * Send email notification
 */
export async function sendEmailNotification(email: EmailNotification) {
  const transporter = createEmailTransporter();
  
  if (!transporter) {
    console.log('Email not configured - skipping email notification');
    return { success: false, reason: 'Email not configured' };
  }

  try {
    const result = await transporter.sendMail({
      from: process.env.SMTP_FROM || 'noreply@dashmet-rca.com',
      to: email.to,
      subject: email.subject,
      text: email.body,
      html: email.html,
    });

    return { success: true, messageId: result.messageId };
  } catch (error: any) {
    console.error('Failed to send email:', error.message);
    return { success: false, reason: error.message };
  }
}

/**
 * Notify user about incident assignment
 */
export async function notifyIncidentAssignment(
  incidentId: string,
  assignedToId: string,
  assignedByName: string
) {
  const incident = await prisma.incident.findUnique({
    where: { id: incidentId },
    select: {
      incidentNumber: true,
      type: true,
      severity: true,
      description: true,
      User_Incident_assignedToIdToUser: {
        select: { email: true, firstName: true },
      },
    },
  });

  if (!incident) return;

  // Create in-app notification
  await createNotification({
    type: 'INCIDENT_ASSIGNED',
    title: 'New Incident Assigned',
    message: `You have been assigned incident ${incident.incidentNumber} (${incident.type}, ${incident.severity || 'No severity'}) by ${assignedByName}`,
    userId: assignedToId,
    incidentId,
  });

  // Send email notification
  if (incident.User_Incident_assignedToIdToUser?.email) {
    await sendEmailNotification({
      to: incident.User_Incident_assignedToIdToUser.email,
      subject: `[RCA] New Incident Assigned: ${incident.incidentNumber}`,
      body: `
Hello ${incident.User_Incident_assignedToIdToUser.firstName},

You have been assigned a new incident that requires your attention.

Incident Number: ${incident.incidentNumber}
Type: ${incident.type === 'FOOD_SAFETY' ? 'Food Safety' : 'Machine & Equipment'}
Severity: ${incident.severity || 'Not set'}

Description:
${incident.description.substring(0, 500)}${incident.description.length > 500 ? '...' : ''}

Please log in to the RCA system to review and respond to this incident.

Best regards,
RCA Engine System
      `.trim(),
      html: `
<h2>New Incident Assigned</h2>
<p>Hello ${incident.User_Incident_assignedToIdToUser.firstName},</p>
<p>You have been assigned a new incident that requires your attention.</p>
<table style="border-collapse: collapse; margin: 20px 0;">
  <tr><td style="padding: 8px; font-weight: bold;">Incident Number:</td><td style="padding: 8px;">${incident.incidentNumber}</td></tr>
  <tr><td style="padding: 8px; font-weight: bold;">Type:</td><td style="padding: 8px;">${incident.type === 'FOOD_SAFETY' ? 'Food Safety' : 'Machine & Equipment'}</td></tr>
  <tr><td style="padding: 8px; font-weight: bold;">Severity:</td><td style="padding: 8px; color: ${incident.severity === 'CRITICAL' ? 'red' : incident.severity === 'HIGH' ? 'orange' : 'inherit'};">${incident.severity || 'Not set'}</td></tr>
</table>
<p><strong>Description:</strong></p>
<p style="background: #f5f5f5; padding: 10px; border-radius: 4px;">${incident.description.substring(0, 500)}${incident.description.length > 500 ? '...' : ''}</p>
<p>Please log in to the RCA system to review and respond to this incident.</p>
      `.trim(),
    });
  }
}

/**
 * Notify about incident status change
 */
export async function notifyIncidentStatusChange(
  incidentId: string,
  oldStatus: string,
  newStatus: string,
  changedByName: string
) {
  const incident = await prisma.incident.findUnique({
    where: { id: incidentId },
    select: {
      incidentNumber: true,
      createdById: true,
      assignedToId: true,
    },
  });

  if (!incident) return;

  // Notify creator and assignee (if different)
  const notifyUserIds = new Set<string>();
  notifyUserIds.add(incident.createdById);
  if (incident.assignedToId && incident.assignedToId !== incident.createdById) {
    notifyUserIds.add(incident.assignedToId);
  }

  const notifications: NotificationData[] = Array.from(notifyUserIds).map(userId => ({
    type: 'INCIDENT_STATUS_CHANGED' as NotificationType,
    title: 'Incident Status Updated',
    message: `Incident ${incident.incidentNumber} status changed from ${oldStatus} to ${newStatus} by ${changedByName}`,
    userId,
    incidentId,
  }));

  await createBulkNotifications(notifications);
}

/**
 * Notify about SLA warnings (approaching deadline)
 */
export async function checkAndNotifySLAWarnings() {
  const warningHours = 2; // Warn 2 hours before breach
  const warningTime = new Date(Date.now() + warningHours * 60 * 60 * 1000);

  // Find incidents approaching response deadline
  const responseWarnings = await prisma.incident.findMany({
    where: {
      slaResponseDeadline: {
        gt: new Date(),
        lt: warningTime,
      },
      slaResponseBreached: false,
      respondedAt: null,
      status: { in: ['SUBMITTED', 'IN_TRIAGE', 'ASSIGNED'] },
    },
    select: {
      id: true,
      incidentNumber: true,
      assignedToId: true,
      slaResponseDeadline: true,
    },
  });

  // Find incidents approaching resolution deadline
  const resolutionWarnings = await prisma.incident.findMany({
    where: {
      slaResolutionDeadline: {
        gt: new Date(),
        lt: warningTime,
      },
      slaResolutionBreached: false,
      resolvedAt: null,
      status: { notIn: ['CLOSED', 'REJECTED', 'DRAFT'] },
    },
    select: {
      id: true,
      incidentNumber: true,
      assignedToId: true,
      slaResolutionDeadline: true,
    },
  });

  // Create warning notifications
  for (const incident of responseWarnings) {
    if (incident.assignedToId) {
      await createNotification({
        type: 'SLA_RESPONSE_WARNING',
        title: 'SLA Response Deadline Approaching',
        message: `Incident ${incident.incidentNumber} response deadline is in less than ${warningHours} hours`,
        userId: incident.assignedToId,
        incidentId: incident.id,
      });
    }
  }

  for (const incident of resolutionWarnings) {
    if (incident.assignedToId) {
      await createNotification({
        type: 'SLA_RESOLUTION_WARNING',
        title: 'SLA Resolution Deadline Approaching',
        message: `Incident ${incident.incidentNumber} resolution deadline is in less than ${warningHours} hours`,
        userId: incident.assignedToId,
        incidentId: incident.id,
      });
    }
  }

  return {
    responseWarnings: responseWarnings.length,
    resolutionWarnings: resolutionWarnings.length,
  };
}

/**
 * Notify about new incident submission
 */
export async function notifyIncidentSubmitted(incidentId: string) {
  const incident = await prisma.incident.findUnique({
    where: { id: incidentId },
    select: {
      incidentNumber: true,
      type: true,
      severity: true,
      organizationId: true,
      facilityId: true,
      User_Incident_createdByIdToUser: {
        select: { firstName: true, lastName: true },
      },
    },
  });

  if (!incident) return;

  // Find CI/Managers and Admins in the organization to notify
  const managersAndAdmins = await prisma.user.findMany({
    where: {
      organizationId: incident.organizationId,
      role: { in: ['CI_MANAGER', 'ADMIN', 'SYSTEM_ADMIN'] },
      isActive: true,
    },
    select: { id: true },
  });

  if (managersAndAdmins.length === 0) return;

  const notifications: NotificationData[] = managersAndAdmins.map(user => ({
    type: 'INCIDENT_SUBMITTED' as NotificationType,
    title: 'New Incident Submitted',
    message: `${incident.User_Incident_createdByIdToUser?.firstName} ${incident.User_Incident_createdByIdToUser?.lastName} submitted incident ${incident.incidentNumber} (${incident.type}, ${incident.severity || 'No severity'})`,
    userId: user.id,
    incidentId,
  }));

  await createBulkNotifications(notifications);
}

export default {
  createNotification,
  createBulkNotifications,
  getUserNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  sendEmailNotification,
  notifyIncidentAssignment,
  notifyIncidentStatusChange,
  checkAndNotifySLAWarnings,
  notifyIncidentSubmitted,
};
