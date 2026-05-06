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
import { sendPushNotificationToUser } from './pushNotificationService';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface LswAlertItem {
  entityType: 'dailyTask' | 'todoItem' | 'meetingRail' | 'followUp' | 'frequencyTask';
  entityId: string;     // Notification identity. Daily tasks include week/day to avoid false dedupe.
  sourceEntityId?: string;
  taskName: string;
  dueAt: Date;          // When it was/is due
  notificationType: string; // overdue, reminder_15min, reminder_1day, etc.
  displayDueAt?: string;
  weekNumber?: number;
  year?: number;
  dayKey?: string;
}

interface UserWithPrefs {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  prefs: LswNotificationPreference;
}

type DayColumn = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

interface LswCalendarConfig {
  calendarYearStartMonth: number;
  calendarYearStartDay: number;
}

interface ZonedDateParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekdayIndex: number; // 0=Sunday, 1=Monday, ...
}

interface DailyTaskScheduleContext {
  timeZone: string;
  localNow: ZonedDateParts;
  localToday: Date;
  todayDayColumn: DayColumn;
  currentWeek: number;
  orgYear: number;
  weekStartLocal: Date;
  visibleDays: DayColumn[];
}

const DEFAULT_TIME_ZONE = 'America/Chicago';
const DAY_COLUMNS_SUNDAY_FIRST: DayColumn[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const LSW_VISIBLE_DAY_COLUMNS: DayColumn[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const DAY_LABELS: Record<DayColumn, string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
};
const DAY_SHORT_LABELS: Record<DayColumn, string> = {
  monday: 'Mon',
  tuesday: 'Tue',
  wednesday: 'Wed',
  thursday: 'Thu',
  friday: 'Fri',
  saturday: 'Sat',
  sunday: 'Sun',
};
const DAY_UI_KEYS: Record<DayColumn, string> = {
  monday: 'M',
  tuesday: 'T',
  wednesday: 'W',
  thursday: 'H',
  friday: 'F',
  saturday: 'S1',
  sunday: 'S2',
};

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
  const preferenceData = data as Record<string, any>;

  // Upsert: create if not exists, update if exists
  return prisma.lswNotificationPreference.upsert({
    where: { userId },
    create: { userId, ...preferenceData },
    update: preferenceData,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Overdue Detection
// ─────────────────────────────────────────────────────────────────────────────

function getSafeTimeZone(timeZone?: string | null): string {
  if (!timeZone) return DEFAULT_TIME_ZONE;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format(new Date());
    return timeZone;
  } catch {
    return DEFAULT_TIME_ZONE;
  }
}

function getZonedParts(date: Date, timeZone: string): ZonedDateParts {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    weekday: 'short',
    hourCycle: 'h23',
  }).formatToParts(date);

  const value = (type: string) => parts.find((part) => part.type === type)?.value || '';
  const weekdayIndex = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(value('weekday'));

  return {
    year: Number(value('year')),
    month: Number(value('month')),
    day: Number(value('day')),
    hour: Number(value('hour')),
    minute: Number(value('minute')),
    second: Number(value('second')),
    weekdayIndex: weekdayIndex >= 0 ? weekdayIndex : 0,
  };
}

function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  const parts = getZonedParts(date, timeZone);
  const utcFromParts = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return utcFromParts - date.getTime();
}

function zonedDateTimeToUtc(
  local: { year: number; month: number; day: number; hour: number; minute: number },
  timeZone: string,
): Date {
  let utcMs = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute, 0, 0);

  // Iterate once or twice to handle DST offsets without adding a date library.
  for (let i = 0; i < 3; i += 1) {
    const offsetMs = getTimeZoneOffsetMs(new Date(utcMs), timeZone);
    const nextUtcMs = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute, 0, 0) - offsetMs;
    if (Math.abs(nextUtcMs - utcMs) < 1000) break;
    utcMs = nextUtcMs;
  }

  return new Date(utcMs);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function isDefaultCalendarConfig(config: LswCalendarConfig): boolean {
  return config.calendarYearStartMonth === 1 && config.calendarYearStartDay === 1;
}

function getOrgYearStart(config: LswCalendarConfig, refDate: Date): Date {
  let yearCandidate = refDate.getFullYear();
  const candidate = new Date(yearCandidate, config.calendarYearStartMonth - 1, config.calendarYearStartDay);
  if (refDate < candidate) {
    yearCandidate -= 1;
  }
  return new Date(yearCandidate, config.calendarYearStartMonth - 1, config.calendarYearStartDay);
}

function getOrgWeekNumber(date: Date, config: LswCalendarConfig): number {
  if (isDefaultCalendarConfig(config)) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  }

  const start = getOrgYearStart(config, date);
  const diffDays = Math.floor((date.getTime() - start.getTime()) / 86400000);
  return Math.floor(diffDays / 7) + 1;
}

function getOrgYear(date: Date, config: LswCalendarConfig): number {
  if (isDefaultCalendarConfig(config)) {
    return date.getFullYear();
  }
  return getOrgYearStart(config, date).getFullYear();
}

function getWeekStartDate(weekNumber: number, year: number, config: LswCalendarConfig): Date {
  if (isDefaultCalendarConfig(config)) {
    const simple = new Date(year, 0, 1 + (weekNumber - 1) * 7);
    const dow = simple.getDay();
    const start = new Date(simple);
    if (dow <= 4) {
      start.setDate(simple.getDate() - simple.getDay() + 1);
    } else {
      start.setDate(simple.getDate() + 8 - simple.getDay());
    }
    return start;
  }

  return addDays(new Date(year, config.calendarYearStartMonth - 1, config.calendarYearStartDay), (weekNumber - 1) * 7);
}

function buildDailyTaskNotificationEntityId(
  taskId: string,
  weekNumber: number,
  year: number,
  dayColumn: DayColumn,
): string {
  return `${taskId}:${year}:W${weekNumber}:${dayColumn}`;
}

async function getDailyTaskScheduleContext(
  userId: string,
  prefs: LswNotificationPreference,
  now: Date,
): Promise<DailyTaskScheduleContext | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      timezone: true,
      lswWorkDaysPerWeek: true,
      Organization: {
        select: {
          calendarYearStartMonth: true,
          calendarYearStartDay: true,
        },
      },
    },
  });

  if (!user) return null;

  const timeZone = getSafeTimeZone(prefs.timezone || user.timezone);
  const localNow = getZonedParts(now, timeZone);
  const localToday = new Date(localNow.year, localNow.month - 1, localNow.day);
  const calendarConfig = user.Organization ?? { calendarYearStartMonth: 1, calendarYearStartDay: 1 };
  const currentWeek = getOrgWeekNumber(localToday, calendarConfig);
  const orgYear = getOrgYear(localToday, calendarConfig);
  const weekStartLocal = getWeekStartDate(currentWeek, orgYear, calendarConfig);
  const workDaysPerWeek = Math.max(5, Math.min(7, user.lswWorkDaysPerWeek || 5));
  const todayDayColumn = DAY_COLUMNS_SUNDAY_FIRST[localNow.weekdayIndex];

  return {
    timeZone,
    localNow,
    localToday,
    todayDayColumn,
    currentWeek,
    orgYear,
    weekStartLocal,
    visibleDays: LSW_VISIBLE_DAY_COLUMNS.slice(0, workDaysPerWeek),
  };
}

function buildDailyTaskDueAt(ctx: DailyTaskScheduleContext, dayColumn: DayColumn, timeHHMM: string): Date | null {
  const [hour, minute] = timeHHMM.split(':').map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;

  const dayIndex = LSW_VISIBLE_DAY_COLUMNS.indexOf(dayColumn);
  if (dayIndex < 0) return null;

  const localDueDate = addDays(ctx.weekStartLocal, dayIndex);
  return zonedDateTimeToUtc({
    year: localDueDate.getFullYear(),
    month: localDueDate.getMonth() + 1,
    day: localDueDate.getDate(),
    hour,
    minute,
  }, ctx.timeZone);
}

function formatAlertTime(item: LswAlertItem): string {
  return item.displayDueAt || formatTime(item.dueAt);
}

function formatDailyTaskDueLabel(ctx: DailyTaskScheduleContext, dueAt: Date, dayColumn: DayColumn): string {
  return `${DAY_SHORT_LABELS[dayColumn]}, ${dueAt.toLocaleString('en-US', {
    timeZone: ctx.timeZone,
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })}`;
}

function getRecipientName(user: { firstName?: string | null; email?: string | null }): string {
  const firstName = user.firstName?.trim();
  if (firstName) return firstName;
  return user.email?.split('@')[0] || 'there';
}

function compactForPush(value: string, maxLength = 82): string {
  const compacted = value.replace(/\s+/g, ' ').trim();
  if (compacted.length <= maxLength) return compacted;
  return `${compacted.slice(0, maxLength - 1).trim()}…`;
}

/**
 * Find all overdue items for a specific user
 */
async function findOverdueItems(userId: string, prefs: LswNotificationPreference, now: Date): Promise<LswAlertItem[]> {
  const alerts: LswAlertItem[] = [];

  // 1. Daily Tasks — these are scheduled by the user's visible LSW days.
  // Completion is stored per task/week/year in LswDailyTaskCompletion, not in
  // the legacy weekday booleans on LswDailyTask.
  if (prefs.notifyTaskOverdue) {
    const ctx = await getDailyTaskScheduleContext(userId, prefs, now);
    if (!ctx) return alerts;

    const dailyTasks = await prisma.lswDailyTask.findMany({
      where: {
        userId,
        isActive: true,
      },
      include: {
        completions: {
          where: {
            weekNumber: ctx.currentWeek,
            year: ctx.orgYear,
          },
          take: 1,
        },
      },
      orderBy: [{ sortOrder: 'asc' }, { time: 'asc' }],
    });

    for (const task of dailyTasks) {
      const completion = task.completions[0] as Record<DayColumn, boolean> | undefined;

      for (const dayColumn of ctx.visibleDays) {
        if (completion?.[dayColumn]) continue;

        const dueAt = buildDailyTaskDueAt(ctx, dayColumn, task.time);
        if (!dueAt || dueAt > now) continue;

        alerts.push({
          entityType: 'dailyTask',
          entityId: buildDailyTaskNotificationEntityId(task.id, ctx.currentWeek, ctx.orgYear, dayColumn),
          sourceEntityId: task.id,
          taskName: `${task.task} (${DAY_LABELS[dayColumn]})`,
          dueAt,
          notificationType: 'overdue',
          displayDueAt: formatDailyTaskDueLabel(ctx, dueAt, dayColumn),
          weekNumber: ctx.currentWeek,
          year: ctx.orgYear,
          dayKey: DAY_UI_KEYS[dayColumn],
        });
      }
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

  // Also check custom reminder minutes if set
  const customMinutesWindow = (prefs as any).customReminderMinutes > 0
    ? new Date(now.getTime() + (prefs as any).customReminderMinutes * 60 * 1000)
    : null;

  // The farthest look-ahead window
  const reminderWindows = [minutesWindow, daysWindow, weeksWindow, monthsWindow, customMinutesWindow]
    .filter((date): date is Date => date instanceof Date);
  const maxWindow = reminderWindows.reduce((max, date) => (date > max ? date : max), now);

  // ── Daily Tasks upcoming ──
  // Daily tasks use HH:MM + the user's visible LSW days. Only today's unchecked
  // tasks are eligible for "upcoming" alerts. Day/week/month reminder buckets
  // are for dated LSW items; daily tasks use the minutes-before setting so they
  // do not all fire as generic same-day reminders.
  const ctx = await getDailyTaskScheduleContext(userId, prefs, now);
  const customReminderMinutes = (prefs as any).customReminderMinutes || 0;
  const dailyReminderMinutes = Math.max(prefs.reminderMinutesBefore || 0, customReminderMinutes);
  const dailyMaxWindow = new Date(now.getTime() + dailyReminderMinutes * 60 * 1000);

  if (ctx && dailyReminderMinutes > 0 && ctx.visibleDays.includes(ctx.todayDayColumn)) {
    const upcomingDailyTasks = await prisma.lswDailyTask.findMany({
      where: {
        userId,
        isActive: true,
      },
      include: {
        completions: {
          where: {
            weekNumber: ctx.currentWeek,
            year: ctx.orgYear,
          },
          take: 1,
        },
      },
      orderBy: [{ sortOrder: 'asc' }, { time: 'asc' }],
    });

    for (const task of upcomingDailyTasks) {
      const completion = task.completions[0] as Record<DayColumn, boolean> | undefined;
      if (completion?.[ctx.todayDayColumn]) continue;

      const dueAt = buildDailyTaskDueAt(ctx, ctx.todayDayColumn, task.time);
      if (!dueAt || dueAt <= now || dueAt > dailyMaxWindow) continue;

      const timeUntil = dueAt.getTime() - now.getTime();
      const reminderType = getMinuteReminderType(timeUntil, prefs);
      if (reminderType) {
        alerts.push({
          entityType: 'dailyTask',
          entityId: buildDailyTaskNotificationEntityId(task.id, ctx.currentWeek, ctx.orgYear, ctx.todayDayColumn),
          sourceEntityId: task.id,
          taskName: `${task.task} (${DAY_LABELS[ctx.todayDayColumn]})`,
          dueAt,
          notificationType: reminderType,
          displayDueAt: formatDailyTaskDueLabel(ctx, dueAt, ctx.todayDayColumn),
          weekNumber: ctx.currentWeek,
          year: ctx.orgYear,
          dayKey: DAY_UI_KEYS[ctx.todayDayColumn],
        });
      }
    }
  }

  // ── Todo Items upcoming ──
  const upcomingTodos = await prisma.lswTodoItem.findMany({
    where: {
      userId,
      isActive: true,
      completed: false,
      dueDate: { not: null },
    },
    select: { id: true, task: true, dueDate: true },
  });

  for (const todo of upcomingTodos) {
    if (!todo.dueDate) continue;
    let dueAt: Date;
    if (/^\d{2}:\d{2}$/.test(todo.dueDate)) {
      const [h, m] = todo.dueDate.split(':').map(Number);
      dueAt = new Date(now);
      dueAt.setHours(h, m, 0, 0);
    } else {
      dueAt = new Date(todo.dueDate);
    }
    // Only upcoming (not already past)
    if (dueAt <= now || dueAt > maxWindow) continue;
    const timeUntil = dueAt.getTime() - now.getTime();
    const reminderType = getReminderType(timeUntil, prefs);
    if (reminderType) {
      alerts.push({
        entityType: 'todoItem',
        entityId: todo.id,
        taskName: todo.task,
        dueAt,
        notificationType: reminderType,
      });
    }
  }

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
function getMinuteReminderType(timeUntilMs: number, prefs: LswNotificationPreference): string | null {
  const mins = timeUntilMs / (60 * 1000);

  // Check custom minutes first (most specific user-defined window)
  const customMins = (prefs as any).customReminderMinutes;
  if (customMins > 0 && mins <= customMins && mins > 0) {
    return `reminder_${customMins}min`;
  }

  // Check from most specific to least
  if (prefs.reminderMinutesBefore > 0 && mins <= prefs.reminderMinutesBefore && mins > 0) {
    return `reminder_${prefs.reminderMinutesBefore}min`;
  }

  return null;
}

function getReminderType(timeUntilMs: number, prefs: LswNotificationPreference): string | null {
  const minuteReminder = getMinuteReminderType(timeUntilMs, prefs);
  if (minuteReminder) return minuteReminder;

  const days = timeUntilMs / (24 * 60 * 60 * 1000);
  const weeks = days / 7;
  const months = days / 30;

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

async function findEscalationAlerts(
  userId: string,
  prefs: LswNotificationPreference,
  overdueAlerts: LswAlertItem[],
  now: Date
): Promise<LswAlertItem[]> {
  if (!prefs.escalationEnabled || overdueAlerts.length === 0) return [];

  const escalationMinutes = Math.max(5, prefs.escalationMinutes || 30);
  const escalationType = `escalation_${escalationMinutes}min`;
  const candidates = overdueAlerts.filter(
    (alert) => now.getTime() - alert.dueAt.getTime() >= escalationMinutes * 60 * 1000,
  );

  if (!candidates.length) return [];

  const existing = await prisma.lswNotificationLog.findMany({
    where: {
      userId,
      notificationType: { in: ['overdue', escalationType] },
      OR: candidates.map((alert) => ({
        entityType: alert.entityType,
        entityId: alert.entityId,
      })),
    },
    select: { entityType: true, entityId: true, notificationType: true },
  });

  const initialOverdueSent = new Set(
    existing
      .filter((entry) => entry.notificationType === 'overdue')
      .map((entry) => `${entry.entityType}:${entry.entityId}`),
  );
  const escalationSent = new Set(
    existing
      .filter((entry) => entry.notificationType === escalationType)
      .map((entry) => `${entry.entityType}:${entry.entityId}`),
  );

  return candidates
    .filter((alert) => {
      const key = `${alert.entityType}:${alert.entityId}`;
      return initialOverdueSent.has(key) && !escalationSent.has(key);
    })
    .map((alert) => ({
      ...alert,
      notificationType: escalationType,
    }));
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
  const localNow = getZonedParts(now, getSafeTimeZone(prefs.timezone));
  const currentDay = DAY_COLUMNS_SUNDAY_FIRST[localNow.weekdayIndex];
  const currentMinutes = localNow.hour * 60 + localNow.minute;

  // Check DND schedule first (more comprehensive)
  if ((prefs as any).dndEnabled) {
    const dndDays: string[] = typeof (prefs as any).dndDays === 'string'
      ? JSON.parse((prefs as any).dndDays)
      : ((prefs as any).dndDays || []);

    if ((prefs as any).dndMode === 'custom' && (prefs as any).dndCustomSlots) {
      // Custom slots: check each { day, startTime, endTime }
      const slots = typeof (prefs as any).dndCustomSlots === 'string'
        ? JSON.parse((prefs as any).dndCustomSlots)
        : (prefs as any).dndCustomSlots;
      for (const slot of (slots || [])) {
        if (slot.day === currentDay) {
          if (isTimeInWindow(currentMinutes, slot.startTime, slot.endTime)) return true;
        }
      }
    } else {
      // Scheduled mode
      if (dndDays.includes(currentDay)) {
        if ((prefs as any).dndAllDay) return true;
        const start = (prefs as any).dndStartTime;
        const end = (prefs as any).dndEndTime;
        if (start && end && isTimeInWindow(currentMinutes, start, end)) return true;
      }
    }
  }

  // Legacy quiet hours check
  if (!prefs.quietHoursStart || !prefs.quietHoursEnd) return false;
  return isTimeInWindow(currentMinutes, prefs.quietHoursStart, prefs.quietHoursEnd);
}

function isTimeInWindow(currentMinutes: number, startHHMM: string, endHHMM: string): boolean {
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
          ${formatAlertTime(item)}
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
        DashMet Operations Intelligence — Food Safety & Quality Management
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
          ${formatAlertTime(item)}
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
        DashMet Operations Intelligence — Food Safety & Quality Management
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

function getMobileScreenForAlert(item: LswAlertItem): string {
  const map: Record<LswAlertItem['entityType'], string> = {
    dailyTask: 'daily-standard-work',
    todoItem: 'todos',
    meetingRail: 'meeting-rails',
    followUp: 'follow-ups',
    frequencyTask: 'scheduled-tasks',
  };

  return map[item.entityType];
}

function getMobileSectionName(item: LswAlertItem): string {
  const map: Record<LswAlertItem['entityType'], string> = {
    dailyTask: 'Daily Tasks',
    todoItem: 'To-Dos',
    meetingRail: 'Meeting Rails',
    followUp: 'Follow Ups',
    frequencyTask: 'Scheduled Tasks',
  };

  return map[item.entityType];
}

function buildMobilePushCopy(
  user: { firstName?: string | null; email?: string | null },
  item: LswAlertItem,
  mode: 'overdue' | 'reminder' | 'escalation',
) {
  const name = getRecipientName(user);
  const dueText = formatAlertTime(item);
  const taskName = compactForPush(item.taskName);
  const sectionName = getMobileSectionName(item);

  if (mode === 'escalation') {
    return {
      title: 'DashMet reminder',
      body: `Hi, ${name}. This still needs attention: ${taskName} was due at ${dueText}. Tap to open ${sectionName}.`,
    };
  }

  if (mode === 'overdue') {
    return {
      title: 'DashMet task alert',
      body: `Hi, ${name}. Quick reminder: ${taskName} was due at ${dueText}. Tap to open ${sectionName}.`,
    };
  }

  return {
    title: 'DashMet upcoming reminder',
    body: `Hi, ${name}. ${taskName} is coming up at ${dueText}. Tap to open ${sectionName}.`,
  };
}

function getDeliveryChannelLabel(emailOk: boolean, browserOk: boolean, pushOk: boolean): string {
  return [
    emailOk ? 'email' : '',
    browserOk ? 'browser' : '',
    pushOk ? 'mobile_push' : '',
  ].filter(Boolean).join('+') || 'none';
}

async function sendMobilePushAlerts(
  user: { id: string; firstName?: string | null; email?: string | null },
  prefs: LswNotificationPreference,
  items: LswAlertItem[],
  mode: 'overdue' | 'reminder' | 'escalation'
): Promise<LswAlertItem[]> {
  if (!prefs.mobilePushEnabled || items.length === 0) return [];

  const delivered: LswAlertItem[] = [];

  for (const item of items) {
    try {
      const isOverdue = mode === 'overdue';
      const isEscalation = mode === 'escalation';
      const copy = buildMobilePushCopy(user, item, mode);
      const pushData: Record<string, string> = {
        type: isEscalation ? 'LSW_ESCALATION' : isOverdue ? 'LSW_TASK_OVERDUE' : 'LSW_UPCOMING_REMINDER',
        screen: getMobileScreenForAlert(item),
        entityType: item.entityType,
        entityId: item.sourceEntityId || item.entityId,
        notificationEntityId: item.entityId,
        notificationType: item.notificationType,
        dueAt: item.dueAt.toISOString(),
        channelId: 'dashmet_alerts',
      };
      if (item.weekNumber) pushData.weekNumber = String(item.weekNumber);
      if (item.year) pushData.year = String(item.year);
      if (item.dayKey) pushData.dayKey = item.dayKey;

      const result = await sendPushNotificationToUser(user.id, {
        title: copy.title,
        body: copy.body,
        sound: prefs.mobileSoundEnabled ? 'default' : null,
        badge: 1,
        interruptionLevel: 'time-sensitive',
        ttl: 3600,
        data: pushData,
      });

      if (result.successCount > 0) {
        delivered.push(item);
      }
    } catch (error) {
      console.error(`[LSW MobilePush] Failed for ${item.entityType}:${item.entityId}:`, error);
    }
  }

  return delivered;
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
  if (!prefs) { console.log(`[LSW] User ${userId}: no prefs, skipping`); return 0; }
  if (!prefs.emailEnabled && !prefs.browserEnabled && !prefs.mobilePushEnabled) {
    console.log(`[LSW] User ${user.email}: email+browser+mobile push disabled, skipping`);
    return 0;
  }

  // Respect quiet hours
  if (isInQuietHours(prefs, now)) { console.log(`[LSW] User ${user.email}: in quiet hours, skipping`); return 0; }

  // Digest throttle only applies to overdue batch notifications, NOT upcoming reminders
  const digestThrottled = !shouldSendNow(prefs, now);
  if (digestThrottled) {
    console.log(`[LSW] User ${user.email}: digest throttled (${prefs.digestFrequency}) — will still check upcoming reminders`);
  }

  console.log(`[LSW] Processing user ${user.email} — upcomingEnabled=${prefs.upcomingReminderEnabled}, minutesBefore=${prefs.reminderMinutesBefore}`);

  // Collect alerts — always check upcoming, only check overdue if not throttled
  const [overdueAlerts, reminderAlerts] = await Promise.all([
    digestThrottled ? Promise.resolve([]) : findOverdueItems(userId, prefs, now),
    findUpcomingItems(userId, prefs, now),
  ]);

  console.log(`[LSW] User ${user.email}: ${overdueAlerts.length} overdue, ${reminderAlerts.length} upcoming found`);

  // Filter already sent
  const [newOverdue, newReminders, newEscalations] = await Promise.all([
    filterAlreadySent(userId, overdueAlerts),
    filterAlreadySent(userId, reminderAlerts),
    findEscalationAlerts(userId, prefs, overdueAlerts, now),
  ]);

  console.log(`[LSW] User ${user.email}: ${newOverdue.length} new overdue, ${newReminders.length} new reminders, ${newEscalations.length} escalations after dedup`);

  let sentCount = 0;

  // Send overdue notifications
  if (newOverdue.length > 0) {
    let emailOk = false;
    if (prefs.emailEnabled) {
      emailOk = await sendOverdueEmail(user, newOverdue);
    }
    const mobileDelivered = await sendMobilePushAlerts(user, prefs, newOverdue, 'overdue');

    // Create in-app notifications for each overdue item
    for (const item of newOverdue) {
      await prisma.notification.create({
        data: {
          id: uuidv4(),
          type: 'LSW_TASK_OVERDUE',
          title: `Overdue: ${item.taskName}`,
          message: `Your ${formatEntityType(item.entityType).toLowerCase()} "${item.taskName}" was due at ${formatAlertTime(item)}`,
          userId,
        },
      });
    }

    // Only record "sent" when at least one channel actually delivered.
    // This prevents a failed email / unconfigured Resend from permanently
    // blocking retries via the dedup log.
    const deliveredAlerts = emailOk || prefs.browserEnabled ? newOverdue : mobileDelivered;
    if (deliveredAlerts.length > 0) {
      await logSentNotifications(
        userId,
        deliveredAlerts,
        getDeliveryChannelLabel(emailOk, prefs.browserEnabled, mobileDelivered.length > 0),
      );
      sentCount += deliveredAlerts.length;
    } else {
      console.log('[LSW] Overdue: nothing delivered (email failed, browser/mobile disabled or failed) — will retry next run');
    }
  }

  // Send escalation notifications for items that stayed overdue after the configured grace period.
  if (newEscalations.length > 0) {
    const escalationAction = prefs.escalationAction || 'sound_repeat';
    const shouldSendEmail = prefs.emailEnabled && ['email_resend', 'both'].includes(escalationAction);
    const shouldSendPush = prefs.mobilePushEnabled && ['sound_repeat', 'both'].includes(escalationAction);

    let emailOk = false;
    if (shouldSendEmail) {
      emailOk = await sendOverdueEmail(user, newEscalations);
    }
    const mobileDelivered = shouldSendPush
      ? await sendMobilePushAlerts(user, prefs, newEscalations, 'escalation')
      : [];

    for (const item of newEscalations) {
      await prisma.notification.create({
        data: {
          id: uuidv4(),
          type: 'LSW_TASK_OVERDUE',
          title: `Still overdue: ${item.taskName}`,
          message: `Your ${formatEntityType(item.entityType).toLowerCase()} "${item.taskName}" is still open after its due time: ${formatAlertTime(item)}`,
          userId,
        },
      });
    }

    const deliveredAlerts = emailOk || prefs.browserEnabled ? newEscalations : mobileDelivered;
    if (deliveredAlerts.length > 0) {
      await logSentNotifications(
        userId,
        deliveredAlerts,
        getDeliveryChannelLabel(emailOk, prefs.browserEnabled, mobileDelivered.length > 0),
      );
      sentCount += deliveredAlerts.length;
    } else {
      console.log('[LSW] Escalation: nothing delivered — will retry next run');
    }
  }

  // Send reminder notifications
  if (newReminders.length > 0) {
    let emailOk = false;
    if (prefs.emailEnabled) {
      emailOk = await sendReminderEmail(user, newReminders);
    }
    const mobileDelivered = await sendMobilePushAlerts(user, prefs, newReminders, 'reminder');

    for (const item of newReminders) {
      await prisma.notification.create({
        data: {
          id: uuidv4(),
          type: 'LSW_UPCOMING_REMINDER',
          title: `Upcoming: ${item.taskName}`,
          message: `Your ${formatEntityType(item.entityType).toLowerCase()} "${item.taskName}" is due at ${formatAlertTime(item)}`,
          userId,
        },
      });
    }

    const deliveredAlerts = emailOk || prefs.browserEnabled ? newReminders : mobileDelivered;
    if (deliveredAlerts.length > 0) {
      await logSentNotifications(
        userId,
        deliveredAlerts,
        getDeliveryChannelLabel(emailOk, prefs.browserEnabled, mobileDelivered.length > 0),
      );
      sentCount += deliveredAlerts.length;
    } else {
      console.log('[LSW] Reminder: nothing delivered (email failed, browser/mobile disabled or failed) — will retry next run');
    }
  }

  // Update last check timestamps
  // Only update lastDigestSentAt when overdue items were sent (not for reminders)
  await prisma.lswNotificationPreference.update({
    where: { userId },
    data: {
      lastOverdueCheckAt: now,
      lastReminderCheckAt: now,
      ...(newOverdue.length > 0 ? { lastDigestSentAt: now } : {}),
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
      OR: [{ emailEnabled: true }, { browserEnabled: true }, { mobilePushEnabled: true }],
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
): Promise<boolean> {
  const resend = getResendClient();
  if (!resend) {
    console.log('[LSW Notifications] Resend not configured — skipping email');
    return false;
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
      return false;
    }
    console.log(`[LSW Notifications] Overdue email sent to ${user.email} (${items.length} items)`);
    return true;
  } catch (err) {
    console.error('[LSW Notifications] Failed to send overdue email:', err);
    return false;
  }
}

async function sendReminderEmail(
  user: { email: string; firstName: string },
  items: LswAlertItem[]
): Promise<boolean> {
  const resend = getResendClient();
  if (!resend) {
    console.log('[LSW Notifications] Resend not configured — skipping email');
    return false;
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
      return false;
    }
    console.log(`[LSW Notifications] Reminder email sent to ${user.email} (${items.length} items)`);
    return true;
  } catch (err) {
    console.error('[LSW Notifications] Failed to send reminder email:', err);
    return false;
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
