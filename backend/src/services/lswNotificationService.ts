/**
 * LSW Notification Service
 * 
 * Handles email + in-app notifications for Leader Standard Work:
 * - Past-due items (daily tasks, todos, meetings, follow-ups, frequency tasks)
 * - Upcoming event reminders (configurable timing)
 * - Digest batching (realtime, hourly, daily, weekly)
 * - Duplicate prevention via LswNotificationLog
 */

import { prisma } from '../utils/prisma';
import { Resend } from 'resend';
import { v4 as uuidv4 } from 'uuid';
import type { LswNotificationPreference, User } from '@prisma/client';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface LswAlertItem {
  entityType: 'dailyTask' | 'todoItem' | 'meetingRail' | 'followUp' | 'frequencyTask';
  entityId: string;
  taskName: string;
  dueAt: Date;          // When it was/is due
  notificationType: string; // overdue, reminder_15min, reminder_1day, etc.
}

interface UserWithPrefs {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  prefs: LswNotificationPreference;
}

// ─────────────────────────────────────────────────────────────────────────────
// Resend Client
// ─────────────────────────────────────────────────────────────────────────────

const getResendClient = (): Resend | null => {
  if (!process.env.RESEND_API_KEY) return null;
  return new Resend(process.env.RESEND_API_KEY);
};

const FROM_EMAIL = process.env.EMAIL_FROM || 'DashMet <noreply@dashmet.com>';

// ─────────────────────────────────────────────────────────────────────────────
// Preferences CRUD
// ─────────────────────────────────────────────────────────────────────────────

export async function getNotificationPreferences(userId: string) {
  let prefs = await prisma.lswNotificationPreference.findUnique({
    where: { userId },
  });

  // Auto-create with defaults if not found
  if (!prefs) {
    prefs = await prisma.lswNotificationPreference.create({
      data: { userId },
    });
  }

  return prefs;
}

export async function updateNotificationPreferences(
  userId: string,
  data: Partial<Omit<LswNotificationPreference, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>
) {
  // Upsert: create if not exists, update if exists
  return prisma.lswNotificationPreference.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Overdue Detection
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get the current day-of-week key matching the Prisma LswDailyTask columns
 */
function getDayColumn(date: Date): string {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return days[date.getDay()];
}

/**
 * Find all overdue items for a specific user
 */
async function findOverdueItems(userId: string, prefs: LswNotificationPreference, now: Date): Promise<LswAlertItem[]> {
  const alerts: LswAlertItem[] = [];
  const dayCol = getDayColumn(now);
  const currentTimeHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  // 1. Daily Tasks — check if task is scheduled for today and time has passed
  if (prefs.notifyTaskOverdue) {
    const dailyTasks = await prisma.lswDailyTask.findMany({
      where: {
        userId,
        isActive: true,
        [dayCol]: true,  // Scheduled for today
        time: { lt: currentTimeHHMM }, // Past due time
      },
      select: { id: true, task: true, time: true },
    });

    for (const task of dailyTasks) {
      const [h, m] = task.time.split(':').map(Number);
      const dueAt = new Date(now);
      dueAt.setHours(h, m, 0, 0);

      alerts.push({
        entityType: 'dailyTask',
        entityId: task.id,
        taskName: task.task,
        dueAt,
        notificationType: 'overdue',
      });
    }
  }

  // 2. Todo Items — check dueDate field (stored as HH:MM or date string)
  if (prefs.notifyTodoOverdue) {
    const todos = await prisma.lswTodoItem.findMany({
      where: {
        userId,
        isActive: true,
        completed: false,
        dueDate: { not: null },
      },
      select: { id: true, task: true, dueDate: true },
    });

    for (const todo of todos) {
      if (!todo.dueDate) continue;

      // dueDate can be HH:MM (time) or a full date string
      let dueAt: Date;
      if (/^\d{2}:\d{2}$/.test(todo.dueDate)) {
        const [h, m] = todo.dueDate.split(':').map(Number);
        dueAt = new Date(now);
        dueAt.setHours(h, m, 0, 0);
      } else {
        dueAt = new Date(todo.dueDate);
      }

      if (dueAt < now) {
        alerts.push({
          entityType: 'todoItem',
          entityId: todo.id,
          taskName: todo.task,
          dueAt,
          notificationType: 'overdue',
        });
      }
    }
  }

  // 3. Meeting Rails — check dueDate
  if (prefs.notifyMeetingOverdue) {
    const meetings = await prisma.lswMeetingRail.findMany({
      where: {
        userId,
        isActive: true,
        completed: false,
        dueDate: { lt: now },
      },
      select: { id: true, rail: true, dueDate: true },
    });

    for (const meeting of meetings) {
      alerts.push({
        entityType: 'meetingRail',
        entityId: meeting.id,
        taskName: meeting.rail,
        dueAt: meeting.dueDate,
        notificationType: 'overdue',
      });
    }
  }

  // 4. Follow-Ups — check dueDate
  if (prefs.notifyFollowUpOverdue) {
    const followUps = await prisma.lswFollowUp.findMany({
      where: {
        userId,
        isActive: true,
        completed: false,
        dueDate: { lt: now },
      },
      select: { id: true, task: true, dueDate: true },
    });

    for (const fu of followUps) {
      alerts.push({
        entityType: 'followUp',
        entityId: fu.id,
        taskName: fu.task,
        dueAt: fu.dueDate,
        notificationType: 'overdue',
      });
    }
  }

  // 5. Frequency Tasks — check dueDate
  if (prefs.notifyFreqTaskOverdue) {
    const freqTasks = await prisma.lswFrequencyTask.findMany({
      where: {
        userId,
        isActive: true,
        dueDate: { lt: now },
      },
      select: { id: true, task: true, dueDate: true, frequency: true },
    });

    for (const ft of freqTasks) {
      alerts.push({
        entityType: 'frequencyTask',
        entityId: ft.id,
        taskName: `${ft.task} (${ft.frequency})`,
        dueAt: ft.dueDate,
        notificationType: 'overdue',
      });
    }
  }

  return alerts;
}

// ─────────────────────────────────────────────────────────────────────────────
// Upcoming Reminder Detection
// ─────────────────────────────────────────────────────────────────────────────

async function findUpcomingItems(userId: string, prefs: LswNotificationPreference, now: Date): Promise<LswAlertItem[]> {
  if (!prefs.upcomingReminderEnabled) return [];

  const alerts: LswAlertItem[] = [];

  // Calculate reminder windows
  const minutesWindow = new Date(now.getTime() + prefs.reminderMinutesBefore * 60 * 1000);
  const daysWindow = new Date(now.getTime() + prefs.reminderDaysBefore * 24 * 60 * 60 * 1000);
  const weeksWindow = prefs.reminderWeeksBefore > 0
    ? new Date(now.getTime() + prefs.reminderWeeksBefore * 7 * 24 * 60 * 60 * 1000)
    : null;
  const monthsWindow = prefs.reminderMonthsBefore > 0
    ? new Date(now.getTime() + prefs.reminderMonthsBefore * 30 * 24 * 60 * 60 * 1000)
    : null;

  // The farthest look-ahead window
  const maxWindow = [minutesWindow, daysWindow, weeksWindow, monthsWindow]
    .filter(Boolean)
    .reduce((max, d) => (d! > max ? d! : max), now);

  // Meeting Rails upcoming
  const upcomingMeetings = await prisma.lswMeetingRail.findMany({
    where: {
      userId,
      isActive: true,
      completed: false,
      dueDate: { gte: now, lte: maxWindow },
    },
    select: { id: true, rail: true, dueDate: true },
  });

  for (const meeting of upcomingMeetings) {
    const timeUntil = meeting.dueDate.getTime() - now.getTime();
    const reminderType = getReminderType(timeUntil, prefs);
    if (reminderType) {
      alerts.push({
        entityType: 'meetingRail',
        entityId: meeting.id,
        taskName: meeting.rail,
        dueAt: meeting.dueDate,
        notificationType: reminderType,
      });
    }
  }

  // Follow-Ups upcoming
  const upcomingFollowUps = await prisma.lswFollowUp.findMany({
    where: {
      userId,
      isActive: true,
      completed: false,
      dueDate: { gte: now, lte: maxWindow },
    },
    select: { id: true, task: true, dueDate: true },
  });

  for (const fu of upcomingFollowUps) {
    const timeUntil = fu.dueDate.getTime() - now.getTime();
    const reminderType = getReminderType(timeUntil, prefs);
    if (reminderType) {
      alerts.push({
        entityType: 'followUp',
        entityId: fu.id,
        taskName: fu.task,
        dueAt: fu.dueDate,
        notificationType: reminderType,
      });
    }
  }

  // Frequency Tasks upcoming
  const upcomingFreqTasks = await prisma.lswFrequencyTask.findMany({
    where: {
      userId,
      isActive: true,
      dueDate: { gte: now, lte: maxWindow },
    },
    select: { id: true, task: true, dueDate: true, frequency: true },
  });

  for (const ft of upcomingFreqTasks) {
    const timeUntil = ft.dueDate.getTime() - now.getTime();
    const reminderType = getReminderType(timeUntil, prefs);
    if (reminderType) {
      alerts.push({
        entityType: 'frequencyTask',
        entityId: ft.id,
        taskName: `${ft.task} (${ft.frequency})`,
        dueAt: ft.dueDate,
        notificationType: reminderType,
      });
    }
  }

  return alerts;
}

/**
 * Determine which reminder bucket an upcoming event falls into
 */
function getReminderType(timeUntilMs: number, prefs: LswNotificationPreference): string | null {
  const mins = timeUntilMs / (60 * 1000);
  const days = timeUntilMs / (24 * 60 * 60 * 1000);
  const weeks = days / 7;
  const months = days / 30;

  // Check from most specific to least
  if (prefs.reminderMinutesBefore > 0 && mins <= prefs.reminderMinutesBefore && mins > 0) {
    return `reminder_${prefs.reminderMinutesBefore}min`;
  }
  if (prefs.reminderDaysBefore > 0 && days <= prefs.reminderDaysBefore && days > 0) {
    return `reminder_${prefs.reminderDaysBefore}day`;
  }
  if (prefs.reminderWeeksBefore > 0 && weeks <= prefs.reminderWeeksBefore && weeks > 0) {
    return `reminder_${prefs.reminderWeeksBefore}week`;
  }
  if (prefs.reminderMonthsBefore > 0 && months <= prefs.reminderMonthsBefore && months > 0) {
    return `reminder_${prefs.reminderMonthsBefore}month`;
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Duplicate Prevention
// ─────────────────────────────────────────────────────────────────────────────

async function filterAlreadySent(userId: string, alerts: LswAlertItem[]): Promise<LswAlertItem[]> {
  if (alerts.length === 0) return [];

  const existing = await prisma.lswNotificationLog.findMany({
    where: {
      userId,
      OR: alerts.map((a) => ({
        entityType: a.entityType,
        entityId: a.entityId,
        notificationType: a.notificationType,
      })),
    },
    select: { entityType: true, entityId: true, notificationType: true },
  });

  const sentKeys = new Set(
    existing.map((e) => `${e.entityType}:${e.entityId}:${e.notificationType}`)
  );

  return alerts.filter(
    (a) => !sentKeys.has(`${a.entityType}:${a.entityId}:${a.notificationType}`)
  );
}

async function logSentNotifications(userId: string, alerts: LswAlertItem[], channel: string) {
  if (alerts.length === 0) return;

  await prisma.lswNotificationLog.createMany({
    data: alerts.map((a) => ({
      userId,
      entityType: a.entityType,
      entityId: a.entityId,
      notificationType: a.notificationType,
      channel,
    })),
    skipDuplicates: true,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Quiet Hours Check
// ─────────────────────────────────────────────────────────────────────────────

function isInQuietHours(prefs: LswNotificationPreference, now: Date): boolean {
  // Check DND schedule first (more comprehensive)
  if ((prefs as any).dndEnabled) {
    const dndDays: string[] = typeof (prefs as any).dndDays === 'string'
      ? JSON.parse((prefs as any).dndDays)
      : ((prefs as any).dndDays || []);
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const currentDay = dayNames[now.getDay()];

    if ((prefs as any).dndMode === 'custom' && (prefs as any).dndCustomSlots) {
      // Custom slots: check each { day, startTime, endTime }
      const slots = typeof (prefs as any).dndCustomSlots === 'string'
        ? JSON.parse((prefs as any).dndCustomSlots)
        : (prefs as any).dndCustomSlots;
      for (const slot of (slots || [])) {
        if (slot.day === currentDay) {
          if (isTimeInWindow(now, slot.startTime, slot.endTime)) return true;
        }
      }
    } else {
      // Scheduled mode
      if (dndDays.includes(currentDay)) {
        if ((prefs as any).dndAllDay) return true;
        const start = (prefs as any).dndStartTime;
        const end = (prefs as any).dndEndTime;
        if (start && end && isTimeInWindow(now, start, end)) return true;
      }
    }
  }

  // Legacy quiet hours check
  if (!prefs.quietHoursStart || !prefs.quietHoursEnd) return false;
  return isTimeInWindow(now, prefs.quietHoursStart, prefs.quietHoursEnd);
}

function isTimeInWindow(now: Date, startHHMM: string, endHHMM: string): boolean {
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const [startH, startM] = startHHMM.split(':').map(Number);
  const [endH, endM] = endHHMM.split(':').map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  // Handle overnight windows (e.g., 22:00 - 07:00)
  if (startMinutes > endMinutes) {
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  }

  return currentMinutes >= startMinutes && currentMinutes < endMinutes;
}

// ─────────────────────────────────────────────────────────────────────────────
// Email Templates
// ─────────────────────────────────────────────────────────────────────────────

function buildOverdueEmailHtml(firstName: string, items: LswAlertItem[]): string {
  const rows = items
    .map(
      (item) => `
      <tr>
        <td style="padding: 8px 12px; border-bottom: 1px solid #E5E7EB; font-size: 14px; color: #374151;">
          ${escapeHtml(item.taskName)}
        </td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #E5E7EB; font-size: 14px; color: #6B7280;">
          ${formatEntityType(item.entityType)}
        </td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #E5E7EB; font-size: 14px; color: #EF4444; font-weight: 600;">
          ${formatTime(item.dueAt)}
        </td>
      </tr>
    `
    )
    .join('');

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px 24px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="font-size: 22px; font-weight: 700; color: #111827; margin: 0;">DashMet</h1>
        <p style="font-size: 13px; color: #6B7280; margin: 4px 0 0;">Leader Standard Work — Overdue Items</p>
      </div>

      <p style="font-size: 15px; color: #374151; margin-bottom: 16px;">
        Hi ${escapeHtml(firstName)},
      </p>

      <p style="font-size: 14px; color: #374151; margin-bottom: 20px;">
        You have <strong style="color: #EF4444;">${items.length}</strong> overdue item${items.length > 1 ? 's' : ''} on your Leader Standard Work page:
      </p>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; border: 1px solid #E5E7EB; border-radius: 8px;">
        <thead>
          <tr style="background: #F9FAFB;">
            <th style="padding: 10px 12px; text-align: left; font-size: 12px; font-weight: 600; color: #6B7280; text-transform: uppercase; letter-spacing: 0.05em;">Task</th>
            <th style="padding: 10px 12px; text-align: left; font-size: 12px; font-weight: 600; color: #6B7280; text-transform: uppercase; letter-spacing: 0.05em;">Type</th>
            <th style="padding: 10px 12px; text-align: left; font-size: 12px; font-weight: 600; color: #6B7280; text-transform: uppercase; letter-spacing: 0.05em;">Due</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>

      <div style="text-align: center; margin-bottom: 24px;">
        <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/lsw"
           style="display: inline-block; padding: 10px 24px; background: #2563EB; color: white; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 600;">
          View LSW Page
        </a>
      </div>

      <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 24px 0;" />
      <p style="font-size: 12px; color: #9CA3AF; text-align: center;">
        You can manage notification preferences in Settings → Notifications.<br/>
        DashMet RCA Engine — Food Safety & Quality Management
      </p>
    </div>
  `;
}

function buildReminderEmailHtml(firstName: string, items: LswAlertItem[]): string {
  const rows = items
    .map(
      (item) => `
      <tr>
        <td style="padding: 8px 12px; border-bottom: 1px solid #E5E7EB; font-size: 14px; color: #374151;">
          ${escapeHtml(item.taskName)}
        </td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #E5E7EB; font-size: 14px; color: #6B7280;">
          ${formatEntityType(item.entityType)}
        </td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #E5E7EB; font-size: 14px; color: #F59E0B; font-weight: 600;">
          ${formatTime(item.dueAt)}
        </td>
      </tr>
    `
    )
    .join('');

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px 24px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="font-size: 22px; font-weight: 700; color: #111827; margin: 0;">DashMet</h1>
        <p style="font-size: 13px; color: #6B7280; margin: 4px 0 0;">Leader Standard Work — Upcoming Reminders</p>
      </div>

      <p style="font-size: 15px; color: #374151; margin-bottom: 16px;">
        Hi ${escapeHtml(firstName)},
      </p>

      <p style="font-size: 14px; color: #374151; margin-bottom: 20px;">
        You have <strong style="color: #F59E0B;">${items.length}</strong> upcoming item${items.length > 1 ? 's' : ''} on your LSW schedule:
      </p>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; border: 1px solid #E5E7EB; border-radius: 8px;">
        <thead>
          <tr style="background: #F9FAFB;">
            <th style="padding: 10px 12px; text-align: left; font-size: 12px; font-weight: 600; color: #6B7280; text-transform: uppercase;">Task</th>
            <th style="padding: 10px 12px; text-align: left; font-size: 12px; font-weight: 600; color: #6B7280; text-transform: uppercase;">Type</th>
            <th style="padding: 10px 12px; text-align: left; font-size: 12px; font-weight: 600; color: #6B7280; text-transform: uppercase;">Due At</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>

      <div style="text-align: center; margin-bottom: 24px;">
        <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/lsw"
           style="display: inline-block; padding: 10px 24px; background: #2563EB; color: white; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 600;">
          View LSW Page
        </a>
      </div>

      <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 24px 0;" />
      <p style="font-size: 12px; color: #9CA3AF; text-align: center;">
        Manage notification preferences in Settings → Notifications.<br/>
        DashMet RCA Engine — Food Safety & Quality Management
      </p>
    </div>
  `;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatEntityType(type: string): string {
  const map: Record<string, string> = {
    dailyTask: 'Daily Task',
    todoItem: 'To-Do',
    meetingRail: 'Meeting Rail',
    followUp: 'Follow-Up',
    frequencyTask: 'Scheduled Task',
  };
  return map[type] || type;
}

function formatTime(date: Date): string {
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Notification Processing
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Process LSW notifications for a single user.
 * Called by the cron job or on-demand check.
 * Returns the number of notifications sent.
 */
export async function processUserLswNotifications(userId: string): Promise<number> {
  const now = new Date();

  // Load user + preferences
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      LswNotificationPreference: true,
    },
  });

  if (!user) return 0;

  const prefs = user.LswNotificationPreference;
  if (!prefs) return 0;
  if (!prefs.emailEnabled && !prefs.browserEnabled) return 0;

  // Respect quiet hours
  if (isInQuietHours(prefs, now)) return 0;

  // Check digest frequency throttle
  if (!shouldSendNow(prefs, now)) return 0;

  // Collect alerts
  const [overdueAlerts, reminderAlerts] = await Promise.all([
    findOverdueItems(userId, prefs, now),
    findUpcomingItems(userId, prefs, now),
  ]);

  // Filter already sent
  const [newOverdue, newReminders] = await Promise.all([
    filterAlreadySent(userId, overdueAlerts),
    filterAlreadySent(userId, reminderAlerts),
  ]);

  let sentCount = 0;

  // Send overdue notifications
  if (newOverdue.length > 0) {
    if (prefs.emailEnabled) {
      await sendOverdueEmail(user, newOverdue);
    }

    // Create in-app notifications for each overdue item
    for (const item of newOverdue) {
      await prisma.notification.create({
        data: {
          id: uuidv4(),
          type: 'LSW_TASK_OVERDUE',
          title: `Overdue: ${item.taskName}`,
          message: `Your ${formatEntityType(item.entityType).toLowerCase()} "${item.taskName}" was due at ${formatTime(item.dueAt)}`,
          userId,
        },
      });
    }

    await logSentNotifications(userId, newOverdue, prefs.emailEnabled ? 'email' : 'browser');
    sentCount += newOverdue.length;
  }

  // Send reminder notifications
  if (newReminders.length > 0) {
    if (prefs.emailEnabled) {
      await sendReminderEmail(user, newReminders);
    }

    for (const item of newReminders) {
      await prisma.notification.create({
        data: {
          id: uuidv4(),
          type: 'LSW_UPCOMING_REMINDER',
          title: `Upcoming: ${item.taskName}`,
          message: `Your ${formatEntityType(item.entityType).toLowerCase()} "${item.taskName}" is due at ${formatTime(item.dueAt)}`,
          userId,
        },
      });
    }

    await logSentNotifications(userId, newReminders, prefs.emailEnabled ? 'email' : 'browser');
    sentCount += newReminders.length;
  }

  // Update last check timestamps
  await prisma.lswNotificationPreference.update({
    where: { userId },
    data: {
      lastOverdueCheckAt: now,
      lastReminderCheckAt: now,
      ...(sentCount > 0 ? { lastDigestSentAt: now } : {}),
    },
  });

  return sentCount;
}

/**
 * Process notifications for ALL users who have LSW notifications enabled.
 * Called by the scheduled cron job.
 */
export async function processAllLswNotifications(): Promise<{ usersProcessed: number; totalSent: number }> {
  const usersWithPrefs = await prisma.lswNotificationPreference.findMany({
    where: {
      OR: [{ emailEnabled: true }, { browserEnabled: true }],
    },
    select: { userId: true },
  });

  let totalSent = 0;
  for (const { userId } of usersWithPrefs) {
    try {
      const count = await processUserLswNotifications(userId);
      totalSent += count;
    } catch (err) {
      console.error(`[LSW Notifications] Error processing user ${userId}:`, err);
    }
  }

  return { usersProcessed: usersWithPrefs.length, totalSent };
}

/**
 * Get pending browser notifications for a user (called by frontend polling).
 * Returns in-app notification items that haven't been delivered via browser yet.
 */
export async function getPendingBrowserNotifications(userId: string) {
  const prefs = await prisma.lswNotificationPreference.findUnique({
    where: { userId },
  });

  // Build the list of notification types to fetch based on prefs
  const types: string[] = [];

  // LSW browser notifications (gated by browserEnabled)
  if (prefs?.browserEnabled) {
    types.push(
      'LSW_TASK_OVERDUE',
      'LSW_TODO_OVERDUE',
      'LSW_MEETING_OVERDUE',
      'LSW_FOLLOWUP_OVERDUE',
      'LSW_UPCOMING_REMINDER',
      'LSW_FREQUENCY_TASK_DUE',
    );
  }

  // Bakery browser notifications (gated by bakeryBrowserEnabled, default true)
  if (!prefs || prefs.bakeryBrowserEnabled) {
    types.push('BAKERY_METRICS_SUBMITTED');
  }

  if (types.length === 0) return { notifications: [], soundPrefs: null };

  // Check DND
  const now = new Date();
  if (prefs && isInQuietHours(prefs, now)) return { notifications: [], soundPrefs: null };

  // Return recent unread notifications
  const notifications = await prisma.notification.findMany({
    where: {
      userId,
      isRead: false,
      type: { in: types as any },
      createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }, // Last 24 hours
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  // Return sound preferences alongside notifications
  const soundPrefs = prefs ? {
    soundEnabled: (prefs as any).soundEnabled ?? true,
    soundVolume: (prefs as any).soundVolume ?? 80,
    soundType: (prefs as any).soundType ?? 'chime',
    repeatSoundForOverdue: (prefs as any).repeatSoundForOverdue ?? true,
    repeatSoundInterval: (prefs as any).repeatSoundInterval ?? 5,
  } : null;

  return { notifications, soundPrefs };
}

// ─────────────────────────────────────────────────────────────────────────────
// Digest Frequency Check
// ─────────────────────────────────────────────────────────────────────────────

function shouldSendNow(prefs: LswNotificationPreference, now: Date): boolean {
  if (prefs.digestFrequency === 'realtime') return true;

  const lastSent = prefs.lastDigestSentAt;
  if (!lastSent) return true;

  const elapsed = now.getTime() - lastSent.getTime();

  switch (prefs.digestFrequency) {
    case 'hourly':
      return elapsed >= 60 * 60 * 1000;
    case 'daily':
      return elapsed >= 24 * 60 * 60 * 1000;
    case 'weekly':
      return elapsed >= 7 * 24 * 60 * 60 * 1000;
    default:
      return true;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Email Sending
// ─────────────────────────────────────────────────────────────────────────────

async function sendOverdueEmail(
  user: { email: string; firstName: string },
  items: LswAlertItem[]
) {
  const resend = getResendClient();
  if (!resend) {
    console.log('[LSW Notifications] Resend not configured — skipping email');
    return;
  }

  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: user.email,
      subject: `⚠️ ${items.length} Overdue LSW Item${items.length > 1 ? 's' : ''} — DashMet`,
      html: buildOverdueEmailHtml(user.firstName, items),
    });

    if (error) {
      console.error('[LSW Notifications] Resend error (overdue):', error);
    } else {
      console.log(`[LSW Notifications] Overdue email sent to ${user.email} (${items.length} items)`);
    }
  } catch (err) {
    console.error('[LSW Notifications] Failed to send overdue email:', err);
  }
}

async function sendReminderEmail(
  user: { email: string; firstName: string },
  items: LswAlertItem[]
) {
  const resend = getResendClient();
  if (!resend) {
    console.log('[LSW Notifications] Resend not configured — skipping email');
    return;
  }

  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: user.email,
      subject: `🔔 ${items.length} Upcoming LSW Reminder${items.length > 1 ? 's' : ''} — DashMet`,
      html: buildReminderEmailHtml(user.firstName, items),
    });

    if (error) {
      console.error('[LSW Notifications] Resend error (reminder):', error);
    } else {
      console.log(`[LSW Notifications] Reminder email sent to ${user.email} (${items.length} items)`);
    }
  } catch (err) {
    console.error('[LSW Notifications] Failed to send reminder email:', err);
  }
}

/**
 * Clear notification logs older than 30 days to prevent table bloat
 */
export async function cleanupOldNotificationLogs(): Promise<number> {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const { count } = await prisma.lswNotificationLog.deleteMany({
    where: { sentAt: { lt: cutoff } },
  });
  return count;
}
