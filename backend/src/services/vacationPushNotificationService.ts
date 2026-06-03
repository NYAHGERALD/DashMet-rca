import type { UserRole } from '@prisma/client';
import { hasPrivilege } from '../middleware/rbac';
import { prisma } from '../utils/prisma';
import { sendPushNotificationToUser } from './pushNotificationService';

type VacationPushEvent = 'created' | 'approved' | 'denied' | 'cancelled' | 'deleted';
type ScheduledVacationEvent = 'pending_reminder' | 'start_day' | 'return_reminder';

type VacationPreference = {
  mobilePushEnabled: boolean;
  mobileSoundEnabled: boolean;
  vacationMobilePushEnabled: boolean;
  vacationRequestCreatedPushEnabled: boolean;
  vacationRequestApprovedPushEnabled: boolean;
  vacationRequestDeniedPushEnabled: boolean;
  vacationRequestCancelledPushEnabled: boolean;
  vacationRequestDeletedPushEnabled: boolean;
  vacationPendingReminderPushEnabled: boolean;
  vacationPendingReminderDaysBefore: number;
  vacationStartDayPushEnabled: boolean;
  vacationReturnReminderPushEnabled: boolean;
  vacationReturnReminderDaysBefore: number;
};

type VacationPreferenceField =
  | 'vacationRequestCreatedPushEnabled'
  | 'vacationRequestApprovedPushEnabled'
  | 'vacationRequestDeniedPushEnabled'
  | 'vacationRequestCancelledPushEnabled'
  | 'vacationRequestDeletedPushEnabled'
  | 'vacationPendingReminderPushEnabled'
  | 'vacationStartDayPushEnabled'
  | 'vacationReturnReminderPushEnabled';

type VacationForPush = {
  id: number;
  employeeId: number;
  requestedByUserId?: string | null;
  leaveType: string;
  status: string;
  startDate: Date;
  endDate: Date;
  returnToWork?: Date | null;
  organizationId?: string | null;
  Employee: {
    firstName: string;
    lastName: string;
    userId?: string | null;
  };
};

type VacationPushRecipient = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: UserRole;
  organizationId: string | null;
  VacationEmployees: Array<{ id: number }>;
  LswNotificationPreference: VacationPreference | null;
};

type PushTotals = {
  successCount: number;
  failureCount: number;
  recipientCount: number;
};

const VACATION_PREF_SELECT = {
  mobilePushEnabled: true,
  mobileSoundEnabled: true,
  vacationMobilePushEnabled: true,
  vacationRequestCreatedPushEnabled: true,
  vacationRequestApprovedPushEnabled: true,
  vacationRequestDeniedPushEnabled: true,
  vacationRequestCancelledPushEnabled: true,
  vacationRequestDeletedPushEnabled: true,
  vacationPendingReminderPushEnabled: true,
  vacationPendingReminderDaysBefore: true,
  vacationStartDayPushEnabled: true,
  vacationReturnReminderPushEnabled: true,
  vacationReturnReminderDaysBefore: true,
};

const EVENT_TO_PREFERENCE_FIELD: Record<VacationPushEvent, VacationPreferenceField> = {
  created: 'vacationRequestCreatedPushEnabled',
  approved: 'vacationRequestApprovedPushEnabled',
  denied: 'vacationRequestDeniedPushEnabled',
  cancelled: 'vacationRequestCancelledPushEnabled',
  deleted: 'vacationRequestDeletedPushEnabled',
};

const SCHEDULED_TO_PREFERENCE_FIELD: Record<ScheduledVacationEvent, VacationPreferenceField> = {
  pending_reminder: 'vacationPendingReminderPushEnabled',
  start_day: 'vacationStartDayPushEnabled',
  return_reminder: 'vacationReturnReminderPushEnabled',
};

const EVENT_TO_PUSH_TYPE: Record<VacationPushEvent, string> = {
  created: 'VACATION_REQUEST_CREATED',
  approved: 'VACATION_REQUEST_APPROVED',
  denied: 'VACATION_REQUEST_DENIED',
  cancelled: 'VACATION_REQUEST_CANCELLED',
  deleted: 'VACATION_REQUEST_DELETED',
};

const SCHEDULED_TO_PUSH_TYPE: Record<ScheduledVacationEvent, string> = {
  pending_reminder: 'VACATION_PENDING_REMINDER',
  start_day: 'VACATION_START_DAY',
  return_reminder: 'VACATION_RETURN_REMINDER',
};

function startOfUtcDay(input: Date): Date {
  return new Date(Date.UTC(input.getUTCFullYear(), input.getUTCMonth(), input.getUTCDate()));
}

function endOfUtcDay(input: Date): Date {
  return new Date(Date.UTC(input.getUTCFullYear(), input.getUTCMonth(), input.getUTCDate(), 23, 59, 59, 999));
}

function addUtcDays(input: Date, days: number): Date {
  const next = new Date(input);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function clampReminderDays(input: unknown, fallback: number) {
  const value = Number(input ?? fallback);
  if (!Number.isFinite(value)) return fallback;
  return Math.min(60, Math.max(0, Math.round(value)));
}

function compact(value: string, maxLength = 178) {
  const cleaned = value.replace(/\s+/g, ' ').trim();
  return cleaned.length > maxLength ? `${cleaned.slice(0, maxLength - 1).trim()}...` : cleaned;
}

function getFirstName(user: Pick<VacationPushRecipient, 'email' | 'firstName'>) {
  return user.firstName?.trim() || user.email.split('@')[0] || 'there';
}

function getEmployeeName(vacation: VacationForPush) {
  return `${vacation.Employee.firstName || ''} ${vacation.Employee.lastName || ''}`.trim() || 'An employee';
}

function formatVacationDate(date: Date, options: Intl.DateTimeFormatOptions = {}) {
  return date.toLocaleDateString('en-US', { ...options, timeZone: 'UTC' });
}

function formatDateKey(date: Date) {
  return startOfUtcDay(date).toISOString().slice(0, 10);
}

function getDateRange(vacation: VacationForPush) {
  const start = formatVacationDate(vacation.startDate, { month: 'short', day: 'numeric' });
  const end = formatVacationDate(vacation.endDate, { month: 'short', day: 'numeric', year: 'numeric' });
  return `${start} - ${end}`;
}

function getReturnDate(vacation: VacationForPush) {
  return vacation.returnToWork ? startOfUtcDay(vacation.returnToWork) : addUtcDays(startOfUtcDay(vacation.endDate), 1);
}

function getSound(preference?: Pick<VacationPreference, 'mobileSoundEnabled'> | null) {
  return preference?.mobileSoundEnabled === false ? null : 'default';
}

function isPreferenceEnabled(preference: VacationPreference | null | undefined, field: VacationPreferenceField) {
  if (!preference) return true;
  return Boolean(preference.mobilePushEnabled && preference.vacationMobilePushEnabled && preference[field]);
}

function getReminderDays(preference: VacationPreference | null | undefined, field: keyof VacationPreference, fallback: number) {
  return clampReminderDays(preference?.[field], fallback);
}

function dateWhere(date: Date) {
  return { gte: startOfUtcDay(date), lte: endOfUtcDay(date) };
}

function buildInstantCopy(event: VacationPushEvent, vacation: VacationForPush) {
  const employeeName = getEmployeeName(vacation);
  const range = getDateRange(vacation);

  switch (event) {
    case 'created':
      return {
        title: 'Vacation request submitted',
        body: `${employeeName} requested ${vacation.leaveType} for ${range}. Tap to review Vacation Management.`,
      };
    case 'approved':
      return {
        title: 'Vacation request approved',
        body: `${employeeName}'s ${vacation.leaveType} request for ${range} was approved.`,
      };
    case 'denied':
      return {
        title: 'Vacation request denied',
        body: `${employeeName}'s ${vacation.leaveType} request for ${range} was denied.`,
      };
    case 'cancelled':
      return {
        title: 'Vacation request cancelled',
        body: `${employeeName}'s ${vacation.leaveType} request for ${range} was cancelled.`,
      };
    case 'deleted':
      return {
        title: 'Vacation request deleted',
        body: `A cancelled ${vacation.leaveType} request for ${employeeName} covering ${range} was deleted.`,
      };
  }
}

function buildScheduledCopy(
  event: ScheduledVacationEvent,
  vacation: VacationForPush,
  options: { daysAhead?: number; returnDate?: Date } = {},
) {
  const employeeName = getEmployeeName(vacation);
  const startDay = formatVacationDate(vacation.startDate, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const returnDate = options.returnDate || getReturnDate(vacation);
  const returnDay = formatVacationDate(returnDate, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const daysAhead = options.daysAhead ?? 0;

  switch (event) {
    case 'pending_reminder':
      return {
        title: 'Pending vacation approval',
        body: `${employeeName}'s vacation starts on ${startDay}, and the request is still pending ${daysAhead} day${daysAhead === 1 ? '' : 's'} before the vacation date.`,
      };
    case 'start_day':
      return {
        title: 'Vacation starts today',
        body: `${employeeName} is going on vacation today, ${startDay}.`,
      };
    case 'return_reminder':
      return {
        title: 'Vacation return reminder',
        body: `${employeeName} will be returning back from vacation on ${returnDay}.`,
      };
  }
}

function buildPushData(type: string, vacation: VacationForPush, extra: Record<string, string> = {}) {
  return {
    type,
    screen: 'dashboard',
    vacationId: String(vacation.id),
    vacationStatus: vacation.status,
    employeeId: String(vacation.employeeId),
    employeeName: getEmployeeName(vacation),
    startDate: formatDateKey(vacation.startDate),
    endDate: formatDateKey(vacation.endDate),
    returnToWork: formatDateKey(getReturnDate(vacation)),
    channelId: 'dashmet_alerts',
    ...extra,
  };
}

async function loadVacation(vacationId: number): Promise<VacationForPush | null> {
  return prisma.vacation.findUnique({
    where: { id: vacationId },
    include: {
      Employee: { select: { firstName: true, lastName: true, userId: true } },
    },
  }) as Promise<VacationForPush | null>;
}

async function userCanReceiveVacation(vacation: VacationForPush, user: VacationPushRecipient) {
  const isLinkedEmployee = user.VacationEmployees.some((employee) => employee.id === vacation.employeeId);
  const isRequester = Boolean(vacation.requestedByUserId && user.id === vacation.requestedByUserId);
  const isEmployeeUser = Boolean(vacation.Employee.userId && user.id === vacation.Employee.userId);

  if (isLinkedEmployee || isRequester || isEmployeeUser) return true;
  if (!vacation.organizationId || !user.organizationId) return false;

  return hasPrivilege(user.organizationId, user.role, 'nav.vacation', user.id);
}

async function getVacationRecipients(vacation: VacationForPush, preferenceField: VacationPreferenceField) {
  const userWhere = vacation.organizationId
    ? { organizationId: vacation.organizationId, isActive: true }
    : {
        isActive: true,
        OR: [
          vacation.requestedByUserId ? { id: vacation.requestedByUserId } : undefined,
          vacation.Employee.userId ? { id: vacation.Employee.userId } : undefined,
          { VacationEmployees: { some: { id: vacation.employeeId } } },
        ].filter(Boolean),
      };

  const candidates = (await prisma.user.findMany({
    where: userWhere as any,
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      organizationId: true,
      VacationEmployees: { select: { id: true } },
      LswNotificationPreference: { select: VACATION_PREF_SELECT },
    },
  })) as VacationPushRecipient[];

  const allowed = await Promise.all(
    candidates.map(async (candidate) => {
      if (!isPreferenceEnabled(candidate.LswNotificationPreference, preferenceField)) return null;
      return (await userCanReceiveVacation(vacation, candidate)) ? candidate : null;
    }),
  );

  return allowed.filter((user): user is VacationPushRecipient => Boolean(user));
}

async function sendToRecipients(
  recipients: VacationPushRecipient[],
  buildPayload: (recipient: VacationPushRecipient) => Parameters<typeof sendPushNotificationToUser>[1],
): Promise<PushTotals> {
  const results = await Promise.allSettled(
    recipients.map((recipient) => sendPushNotificationToUser(recipient.id, buildPayload(recipient))),
  );

  return results.reduce(
    (totals, result) => {
      if (result.status === 'fulfilled') {
        totals.successCount += result.value.successCount;
        totals.failureCount += result.value.failureCount;
      } else {
        totals.failureCount += 1;
        console.error('[VacationPush] Failed to send vacation push:', result.reason);
      }
      return totals;
    },
    { successCount: 0, failureCount: 0, recipientCount: recipients.length },
  );
}

export async function notifyVacationRequestPushSubscribers(options: {
  event: VacationPushEvent;
  vacationId: number;
}) {
  try {
    const vacation = await loadVacation(options.vacationId);
    if (!vacation) return { successCount: 0, failureCount: 0, recipientCount: 0 };

    return notifyVacationSnapshotPushSubscribers({
      event: options.event,
      vacation,
    });
  } catch (error) {
    console.error('[VacationPush] Instant vacation fan-out failed:', error);
    return { successCount: 0, failureCount: 1, recipientCount: 0 };
  }
}

export async function notifyVacationSnapshotPushSubscribers(options: {
  event: VacationPushEvent;
  vacation: VacationForPush;
}) {
  try {
    const preferenceField = EVENT_TO_PREFERENCE_FIELD[options.event];
    const recipients = await getVacationRecipients(options.vacation, preferenceField);
    const copy = buildInstantCopy(options.event, options.vacation);

    return sendToRecipients(recipients, (recipient) => ({
      title: copy.title,
      body: compact(`Hi, ${getFirstName(recipient)}. ${copy.body}`),
      sound: getSound(recipient.LswNotificationPreference),
      interruptionLevel: 'time-sensitive',
      ttl: 3600,
      data: buildPushData(EVENT_TO_PUSH_TYPE[options.event], options.vacation, {
        vacationEvent: options.event,
      }),
    }));
  } catch (error) {
    console.error('[VacationPush] Snapshot vacation fan-out failed:', error);
    return { successCount: 0, failureCount: 1, recipientCount: 0 };
  }
}

async function hasVacationReminderBeenSent(userId: string, vacationId: number, notificationType: string) {
  const existing = await prisma.lswNotificationLog.findFirst({
    where: {
      userId,
      entityType: 'vacation',
      entityId: String(vacationId),
      notificationType,
      channel: 'mobile_push',
    },
    select: { id: true },
  });

  return Boolean(existing);
}

async function logVacationReminderSent(userId: string, vacationId: number, notificationType: string) {
  await prisma.lswNotificationLog.createMany({
    data: [
      {
        userId,
        entityType: 'vacation',
        entityId: String(vacationId),
        notificationType,
        channel: 'mobile_push',
      },
    ],
    skipDuplicates: true,
  });
}

async function sendScheduledVacationPushToUser(options: {
  user: VacationPushRecipient;
  vacation: VacationForPush;
  event: ScheduledVacationEvent;
  notificationType: string;
  daysAhead?: number;
  returnDate?: Date;
}) {
  const { user, vacation, event, notificationType } = options;
  if (await hasVacationReminderBeenSent(user.id, vacation.id, notificationType)) return 0;

  const copy = buildScheduledCopy(event, vacation, {
    daysAhead: options.daysAhead,
    returnDate: options.returnDate,
  });

  const result = await sendPushNotificationToUser(user.id, {
    title: copy.title,
    body: compact(`Hi, ${getFirstName(user)}. ${copy.body}`),
    sound: getSound(user.LswNotificationPreference),
    interruptionLevel: 'time-sensitive',
    ttl: 3600,
    data: buildPushData(SCHEDULED_TO_PUSH_TYPE[event], vacation, {
      vacationReminderType: event,
      notificationType,
      daysAhead: String(options.daysAhead ?? 0),
    }),
  });

  if (result.successCount > 0) {
    await logVacationReminderSent(user.id, vacation.id, notificationType);
  }

  return result.successCount;
}

async function getAccessibleVacationWhere(user: VacationPushRecipient, canViewVacationManagement: boolean) {
  if (canViewVacationManagement && user.organizationId) {
    return { organizationId: user.organizationId };
  }

  const employeeIds = user.VacationEmployees.map((employee) => employee.id);
  if (!employeeIds.length) return null;

  return { employeeId: { in: employeeIds } };
}

async function userHasVacationManagementAccess(user: VacationPushRecipient) {
  if (!user.organizationId) return false;
  return hasPrivilege(user.organizationId, user.role, 'nav.vacation', user.id);
}

export async function processVacationPushReminders(): Promise<{ usersProcessed: number; totalSent: number }> {
  const today = startOfUtcDay(new Date());

  const users = (await prisma.user.findMany({
    where: {
      isActive: true,
      DeviceTokens: { some: { isActive: true } },
      OR: [{ organizationId: { not: null } }, { VacationEmployees: { some: {} } }],
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      organizationId: true,
      VacationEmployees: { select: { id: true } },
      LswNotificationPreference: { select: VACATION_PREF_SELECT },
    },
  })) as VacationPushRecipient[];

  let totalSent = 0;
  let usersProcessed = 0;

  for (const user of users) {
    const preference = user.LswNotificationPreference;
    if (
      !isPreferenceEnabled(preference, SCHEDULED_TO_PREFERENCE_FIELD.pending_reminder) &&
      !isPreferenceEnabled(preference, SCHEDULED_TO_PREFERENCE_FIELD.start_day) &&
      !isPreferenceEnabled(preference, SCHEDULED_TO_PREFERENCE_FIELD.return_reminder)
    ) {
      continue;
    }

    const canViewVacationManagement = await userHasVacationManagementAccess(user);
    const accessWhere = await getAccessibleVacationWhere(user, canViewVacationManagement);
    if (!accessWhere) continue;

    usersProcessed += 1;

    if (isPreferenceEnabled(preference, 'vacationPendingReminderPushEnabled')) {
      const daysAhead = getReminderDays(preference, 'vacationPendingReminderDaysBefore', 3);
      const targetDate = addUtcDays(today, daysAhead);
      const vacations = (await prisma.vacation.findMany({
        where: {
          ...accessWhere,
          status: 'pending',
          startDate: dateWhere(targetDate),
        },
        include: { Employee: { select: { firstName: true, lastName: true, userId: true } } },
      })) as VacationForPush[];

      for (const vacation of vacations) {
        totalSent += await sendScheduledVacationPushToUser({
          user,
          vacation,
          event: 'pending_reminder',
          notificationType: `vacation_pending_${daysAhead}d_${formatDateKey(vacation.startDate)}`,
          daysAhead,
        });
      }
    }

    if (isPreferenceEnabled(preference, 'vacationStartDayPushEnabled')) {
      const vacations = (await prisma.vacation.findMany({
        where: {
          ...accessWhere,
          status: 'approved',
          startDate: dateWhere(today),
        },
        include: { Employee: { select: { firstName: true, lastName: true, userId: true } } },
      })) as VacationForPush[];

      for (const vacation of vacations) {
        totalSent += await sendScheduledVacationPushToUser({
          user,
          vacation,
          event: 'start_day',
          notificationType: `vacation_start_${formatDateKey(vacation.startDate)}`,
        });
      }
    }

    if (isPreferenceEnabled(preference, 'vacationReturnReminderPushEnabled')) {
      const daysAhead = getReminderDays(preference, 'vacationReturnReminderDaysBefore', 1);
      const returnDate = addUtcDays(today, daysAhead);
      const fallbackEndDate = addUtcDays(returnDate, -1);
      const vacations = (await prisma.vacation.findMany({
        where: {
          ...accessWhere,
          status: 'approved',
          OR: [
            { returnToWork: dateWhere(returnDate) },
            { returnToWork: null, endDate: dateWhere(fallbackEndDate) },
          ],
        },
        include: { Employee: { select: { firstName: true, lastName: true, userId: true } } },
      })) as VacationForPush[];

      for (const vacation of vacations) {
        const resolvedReturnDate = getReturnDate(vacation);
        totalSent += await sendScheduledVacationPushToUser({
          user,
          vacation,
          event: 'return_reminder',
          notificationType: `vacation_return_${daysAhead}d_${formatDateKey(resolvedReturnDate)}`,
          daysAhead,
          returnDate: resolvedReturnDate,
        });
      }
    }
  }

  return { usersProcessed, totalSent };
}
