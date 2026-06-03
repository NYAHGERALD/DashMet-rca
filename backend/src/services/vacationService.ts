import { prisma } from '../utils/prisma';
import {
  notifyVacationRequestPushSubscribers,
  notifyVacationSnapshotPushSubscribers,
} from './vacationPushNotificationService';

// ─────────────────────────────────────────────────────────────────────────────
// Helper: calculate business days between two dates
// ─────────────────────────────────────────────────────────────────────────────
const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const DEFAULT_LEAVE_TYPES = ['vacation', 'bereavement', 'sick', 'emergency', 'unpaid', 'personal'];
const DEFAULT_VACATION_HOURS_PER_DAY = 8;
const PUT_BACK_STATUSES = ['pending', 'approved', 'denied'] as const;
type PutBackStatus = typeof PUT_BACK_STATUSES[number];

function queueVacationPush(promise: Promise<unknown>) {
  promise.catch((error) => {
    console.error('[VacationPush] Failed to queue vacation push notification:', error);
  });
}

function normalizePutBackStatus(input?: string | null): PutBackStatus | null {
  const value = String(input || '').trim().toLowerCase();
  return PUT_BACK_STATUSES.includes(value as PutBackStatus) ? (value as PutBackStatus) : null;
}

function getStatusHistoryArray(statusHistory: unknown): Array<Record<string, any>> {
  return Array.isArray(statusHistory)
    ? statusHistory.filter((entry): entry is Record<string, any> => Boolean(entry && typeof entry === 'object'))
    : [];
}

function appendVacationStatusHistory(
  statusHistory: unknown,
  entry: Record<string, any>,
): Array<Record<string, any>> {
  return [...getStatusHistoryArray(statusHistory), entry];
}

function getCancelledFromStatus(vacation: { statusHistory?: unknown; decisionReason?: string | null }): PutBackStatus | null {
  const history = getStatusHistoryArray(vacation.statusHistory);
  const latestCancellation = [...history]
    .reverse()
    .find((entry) => String(entry.status || '').toLowerCase() === 'cancelled');
  const previousFromHistory = normalizePutBackStatus(
    latestCancellation?.previousStatus || latestCancellation?.fromStatus || latestCancellation?.cancelledFrom,
  );
  if (previousFromHistory) return previousFromHistory;

  const reasonMatch = String(vacation.decisionReason || '').match(/from\s+(pending|approved|denied)\s+status/i);
  const previousFromReason = normalizePutBackStatus(reasonMatch?.[1]);
  if (previousFromReason) return previousFromReason;

  return [...history]
    .reverse()
    .map((entry) => normalizePutBackStatus(entry.status))
    .find(Boolean) || null;
}

function normalizeLeaveTypeName(input?: string | null): string {
  return (input || '').trim().replace(/\s+/g, ' ');
}

function leaveTypeKey(input?: string | null): string {
  return normalizeLeaveTypeName(input).toLowerCase();
}

function normalizeLeaveTypes(types?: string[] | null): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const type of types || []) {
    const name = normalizeLeaveTypeName(type);
    const key = leaveTypeKey(name);
    if (!name || seen.has(key)) continue;
    seen.add(key);
    normalized.push(name);
  }

  return normalized.length > 0 ? normalized : DEFAULT_LEAVE_TYPES;
}

function resolveConfiguredLeaveType(input: string, configuredTypes?: string[] | null): string {
  const requestedKey = leaveTypeKey(input);
  const leaveTypes = normalizeLeaveTypes(configuredTypes);
  const match = leaveTypes.find(type => leaveTypeKey(type) === requestedKey);

  if (!match) {
    throw new Error(`Invalid leave type. Must be one of: ${leaveTypes.join(', ')}`);
  }

  return match;
}

function normalizeVacationHoursPerDay(input?: number | null): number {
  const value = Number(input);
  return Number.isFinite(value) && value > 0 ? Math.round(value) : DEFAULT_VACATION_HOURS_PER_DAY;
}

async function recalculateVacationDurationHours(organizationId: string | undefined, hoursPerDay: number) {
  if (organizationId) {
    await prisma.$executeRaw`
      UPDATE "vacations"
      SET "durationHours" = "durationDays" * ${hoursPerDay}
      WHERE "organizationId" = ${organizationId}
    `;
    return;
  }

  await prisma.$executeRaw`
    UPDATE "vacations"
    SET "durationHours" = "durationDays" * ${hoursPerDay}
  `;
}

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

function parseVacationDateInput(input: string, endOfDay = false): Date {
  if (DATE_ONLY_REGEX.test(input)) {
    const [year, month, day] = input.split('-').map(Number);
    return endOfDay
      ? new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999))
      : new Date(Date.UTC(year, month - 1, day));
  }

  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Invalid date value');
  }

  return endOfDay ? endOfUtcDay(parsed) : startOfUtcDay(parsed);
}

function formatVacationDate(date: Date, options: Intl.DateTimeFormatOptions): string {
  return date.toLocaleDateString('en-US', { ...options, timeZone: 'UTC' });
}

function calcBusinessDays(start: Date, end: Date): number {
  let count = 0;
  const cur = startOfUtcDay(start);
  const last = startOfUtcDay(end);
  while (cur <= last) {
    const day = cur.getUTCDay();
    if (day !== 0 && day !== 6) count++;
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return Math.max(count, 1);
}

// ─────────────────────────────────────────────────────────────────────────────
// Vacation Requests – CRUD
// ─────────────────────────────────────────────────────────────────────────────

export async function createVacationRequest(data: {
  employeeId?: number;
  // Employee info for find-or-create
  firstName?: string;
  lastName?: string;
  department?: string;
  shift?: string;
  line?: string;
  area?: string;
  phone?: string;
  employeeCode?: string;
  // Vacation fields
  requestedByUserId?: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  durationDays?: number;
  durationHours?: number;
  returnToWork?: string | null;
  reason: string;
  coveragePlan?: string | null;
  emergencyPhone?: string | null;
  emergencyEmail?: string | null;
  autoApprove?: boolean;
  organizationId?: string;
}) {
  let employeeId = data.employeeId;
  let employee: any;

  if (employeeId) {
    // Existing employee
    employee = await prisma.vacationEmployee.findUnique({ where: { id: employeeId } });
    if (!employee) throw new Error('Employee not found');
  } else {
    // Create employee from form data
    if (!data.firstName || !data.lastName) {
      throw new Error('First name and last name are required to create an employee');
    }
    // Validate employeeCode if provided (must be exactly 5 digits)
    if (data.employeeCode && !/^\d{5}$/.test(data.employeeCode)) {
      throw new Error('Employee ID must be exactly 5 digits');
    }

    // Check if employee with same name + department already exists
    const existing = await prisma.vacationEmployee.findFirst({
      where: {
        firstName: data.firstName,
        lastName: data.lastName,
        department: data.department || null,
        ...(data.organizationId ? { organizationId: data.organizationId } : {}),
      },
    });

    if (existing) {
      // Update existing employee with any new info
      employee = await prisma.vacationEmployee.update({
        where: { id: existing.id },
        data: {
          shift: data.shift || existing.shift,
          workline: data.line || existing.workline,
          workarea: data.area || existing.workarea,
          phone: data.phone || existing.phone,
          employeeCode: data.employeeCode || existing.employeeCode,
        },
      });
    } else {
      employee = await prisma.vacationEmployee.create({
        data: {
          firstName: data.firstName,
          lastName: data.lastName,
          department: data.department || null,
          shift: data.shift || null,
          workline: data.line || null,
          workarea: data.area || null,
          phone: data.phone || null,
          employeeCode: data.employeeCode || null,
          organizationId: data.organizationId || null,
        },
      });
    }
    employeeId = employee.id;
  }

  // ── Constraint enforcement ──────────────────────────────────────────────
  const constraintSettings = await getVacationSettings(data.organizationId);
  const leaveType = resolveConfiguredLeaveType(data.leaveType, constraintSettings.leaveTypes);
  const vacationHoursPerDay = normalizeVacationHoursPerDay(constraintSettings.vacationHoursPerDay);

  const startDate = parseVacationDateInput(data.startDate);
  const endDate = parseVacationDateInput(data.endDate);
  const durationDays = data.durationDays && data.durationDays > 0 ? data.durationDays : calcBusinessDays(startDate, endDate);
  const durationHours = durationDays * vacationHoursPerDay;

  // 1. Max consecutive days
  if (durationDays > constraintSettings.maxConsecutiveDays) {
    throw new Error(`Request exceeds maximum consecutive days (${constraintSettings.maxConsecutiveDays} days). Requested: ${durationDays} days.`);
  }

  // 2. Minimum notice period
  const today = startOfUtcDay(new Date());
  const noticeDate = addUtcDays(today, constraintSettings.minimumNoticeDays);
  if (startDate < noticeDate) {
    throw new Error(`Vacation must be requested at least ${constraintSettings.minimumNoticeDays} days in advance.`);
  }

  // 3. Standard allocation check — prevent exceeding annual days
  const yearStart = new Date(Date.UTC(today.getUTCFullYear(), 0, 1));
  const yearEnd = new Date(Date.UTC(today.getUTCFullYear(), 11, 31, 23, 59, 59, 999));
  const usedThisYear = await prisma.vacation.aggregate({
    where: {
      employeeId: employeeId!,
      status: { in: ['approved', 'pending'] },
      startDate: { gte: yearStart, lte: yearEnd },
    },
    _sum: { durationDays: true },
  });
  const alreadyUsed = usedThisYear._sum.durationDays || 0;
  if (alreadyUsed + durationDays > constraintSettings.standardAllocationDays) {
    throw new Error(`This request would exceed the annual allocation of ${constraintSettings.standardAllocationDays} days. Already used/pending: ${alreadyUsed} days, requesting: ${durationDays} days.`);
  }

  // 4. Blackout period check
  const blackouts = await getBlackoutPeriods(data.organizationId);
  for (const bp of blackouts) {
    const bpStart = startOfUtcDay(new Date(bp.startDate));
    const bpEnd = endOfUtcDay(new Date(bp.endDate));
    // Check if requested range overlaps with blackout
    if (startDate <= bpEnd && endDate >= bpStart) {
      throw new Error(`Requested dates overlap with blackout period "${bp.name}" (${formatVacationDate(bpStart, { month: 'short', day: 'numeric' })} - ${formatVacationDate(bpEnd, { month: 'short', day: 'numeric', year: 'numeric' })}).`);
    }
  }

  // 5. Max simultaneous absences check
  const overlapping = await prisma.vacation.count({
    where: {
      status: { in: ['approved', 'pending'] },
      startDate: { lte: endDate },
      endDate: { gte: startDate },
      ...(data.organizationId ? { organizationId: data.organizationId } : {}),
    },
  });
  if (overlapping >= constraintSettings.maxSimultaneousAbsences) {
    throw new Error(`Maximum simultaneous absences reached (${constraintSettings.maxSimultaneousAbsences}). There are already ${overlapping} overlapping requests for this period.`);
  }
  // ── End constraint enforcement ──────────────────────────────────────────

  const statusHistory = [{
    status: 'pending',
    timestamp: new Date().toISOString(),
    changed_by: data.requestedByUserId || null,
    reason: 'Request created',
  }];

  const vacation = await prisma.vacation.create({
    data: {
      employeeId: employeeId!,
      requestedByUserId: data.requestedByUserId || null,
      leaveType,
      startDate,
      endDate,
      durationDays,
      durationHours,
      returnToWork: data.returnToWork ? parseVacationDateInput(data.returnToWork) : null,
      reason: data.reason,
      coveragePlan: data.coveragePlan || null,
      emergencyPhone: data.emergencyPhone || null,
      emergencyEmail: data.emergencyEmail || null,
      autoApprove: data.autoApprove || false,
      status: 'pending',
      departmentSnapshot: employee.department,
      roleSnapshot: employee.role,
      shiftSnapshot: employee.shift,
      worklineSnapshot: employee.workline,
      workareaSnapshot: employee.workarea,
      statusHistory: statusHistory as any,
      organizationId: data.organizationId || employee.organizationId,
    },
  });

  // Create notification
  const startStr = formatVacationDate(startDate, { month: 'short', day: 'numeric' });
  const endStr = formatVacationDate(endDate, { month: 'short', day: 'numeric', year: 'numeric' });
  await createVacationNotification({
    employeeId: employeeId!,
    notificationType: 'vacation_submitted',
    title: 'Vacation Request Submitted',
    message: `Your vacation request for ${startStr} - ${endStr} has been submitted and is pending approval.`,
    relatedVacationId: vacation.id,
    organizationId: data.organizationId || employee.organizationId || undefined,
  });

  queueVacationPush(
    notifyVacationRequestPushSubscribers({
      event: 'created',
      vacationId: vacation.id,
    }),
  );

  return vacation;
}

export async function getVacationStats(organizationId?: string) {
  const where = organizationId ? { organizationId } : {};
  const [stats, empCount] = await Promise.all([
    prisma.vacation.groupBy({
      by: ['status'],
      where,
      _count: { id: true },
      _sum: { durationDays: true },
    }),
    prisma.vacationEmployee.count({ where: organizationId ? { organizationId } : {} }),
  ]);

  const result: any = { total_requests: 0, pending: 0, approved: 0, denied: 0, cancelled: 0, days_used_ytd: 0, total_employees: empCount };
  for (const s of stats) {
    result.total_requests += s._count.id;
    if (s.status === 'pending') result.pending = s._count.id;
    if (s.status === 'approved') { result.approved = s._count.id; result.days_used_ytd = s._sum.durationDays || 0; }
    if (s.status === 'denied') result.denied = s._count.id;
    if (s.status === 'cancelled') result.cancelled = s._count.id;
  }
  return result;
}

export async function getUpcomingVacations(organizationId?: string) {
  const now = startOfUtcDay(new Date());
  const thirtyDays = addUtcDays(now, 30);

  return prisma.vacation.findMany({
    where: {
      status: 'approved',
      startDate: { gte: now, lte: thirtyDays },
      ...(organizationId ? { organizationId } : {}),
    },
    include: { Employee: { select: { firstName: true, lastName: true } } },
    orderBy: { startDate: 'asc' },
  });
}

export async function getPendingVacations(organizationId?: string) {
  return prisma.vacation.findMany({
    where: { status: 'pending', ...(organizationId ? { organizationId } : {}) },
    include: {
      Employee: { select: { firstName: true, lastName: true, allocatedVacationHours: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getRecentVacations(organizationId?: string) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  return prisma.vacation.findMany({
    where: {
      status: { in: ['approved', 'denied'] },
      decidedAt: { gte: thirtyDaysAgo },
      ...(organizationId ? { organizationId } : {}),
    },
    include: {
      Employee: { select: { firstName: true, lastName: true } },
      ApprovedByUser: { select: { firstName: true, lastName: true } },
    },
    orderBy: { decidedAt: 'desc' },
    take: 20,
  });
}

export async function approveVacation(vacationId: number, userId: string, reason?: string) {
  const vacation = await prisma.vacation.findUnique({
    where: { id: vacationId },
    include: { Employee: true },
  });
  if (!vacation) throw new Error('Vacation request not found');
  if (vacation.status !== 'pending') throw new Error('Only pending requests can be approved');

  const updated = await prisma.vacation.update({
    where: { id: vacationId },
    data: { status: 'approved', approvedByUserId: userId, decidedAt: new Date(), decisionReason: reason || null },
  });

  const startStr = formatVacationDate(vacation.startDate, { month: 'short', day: 'numeric' });
  const endStr = formatVacationDate(vacation.endDate, { month: 'short', day: 'numeric', year: 'numeric' });
  let msg = `Your vacation request for ${startStr} - ${endStr} has been approved.`;
  if (reason) msg += ` Note: ${reason}`;

  await createVacationNotification({
    employeeId: vacation.employeeId,
    notificationType: 'vacation_approved',
    title: 'Vacation Request Approved',
    message: msg,
    relatedVacationId: vacationId,
    organizationId: vacation.organizationId || undefined,
  });

  queueVacationPush(
    notifyVacationRequestPushSubscribers({
      event: 'approved',
      vacationId,
    }),
  );

  return updated;
}

export async function denyVacation(vacationId: number, userId: string, reason: string) {
  if (!reason) throw new Error('Denial reason is required');

  const vacation = await prisma.vacation.findUnique({
    where: { id: vacationId },
    include: { Employee: true },
  });
  if (!vacation) throw new Error('Vacation request not found');
  if (vacation.status !== 'pending') throw new Error('Only pending requests can be denied');

  const updated = await prisma.vacation.update({
    where: { id: vacationId },
    data: { status: 'denied', approvedByUserId: userId, decidedAt: new Date(), decisionReason: reason },
  });

  const startStr = formatVacationDate(vacation.startDate, { month: 'short', day: 'numeric' });
  const endStr = formatVacationDate(vacation.endDate, { month: 'short', day: 'numeric', year: 'numeric' });
  await createVacationNotification({
    employeeId: vacation.employeeId,
    notificationType: 'vacation_denied',
    title: 'Vacation Request Denied',
    message: `Your vacation request for ${startStr} - ${endStr} was not approved. Reason: ${reason}`,
    relatedVacationId: vacationId,
    organizationId: vacation.organizationId || undefined,
  });

  queueVacationPush(
    notifyVacationRequestPushSubscribers({
      event: 'denied',
      vacationId,
    }),
  );

  return updated;
}

export async function cancelVacation(vacationId: number, userId: string, reason?: string) {
  const vacation = await prisma.vacation.findUnique({
    where: { id: vacationId },
    include: { Employee: true },
  });
  if (!vacation) throw new Error('Vacation request not found');
  if (vacation.status === 'cancelled') throw new Error('Vacation request is already cancelled');

  const decisionReason = reason?.trim() || `Cancelled by administrator from ${vacation.status} status`;
  const statusHistory = appendVacationStatusHistory(vacation.statusHistory, {
    status: 'cancelled',
    previousStatus: vacation.status,
    timestamp: new Date().toISOString(),
    changed_by: userId,
    reason: decisionReason,
  });

  const updated = await prisma.vacation.update({
    where: { id: vacationId },
    data: {
      status: 'cancelled',
      approvedByUserId: userId,
      decidedAt: new Date(),
      decisionReason,
      statusHistory: statusHistory as any,
    },
  });

  const startStr = formatVacationDate(vacation.startDate, { month: 'short', day: 'numeric' });
  const endStr = formatVacationDate(vacation.endDate, { month: 'short', day: 'numeric', year: 'numeric' });
  await createVacationNotification({
    employeeId: vacation.employeeId,
    notificationType: 'vacation_cancelled',
    title: 'Vacation Request Cancelled',
    message: `Your vacation request for ${startStr} - ${endStr} was cancelled. ${decisionReason}`,
    relatedVacationId: vacationId,
    organizationId: vacation.organizationId || undefined,
  });

  queueVacationPush(
    notifyVacationRequestPushSubscribers({
      event: 'cancelled',
      vacationId,
    }),
  );

  return updated;
}

export async function putBackVacation(vacationId: number, userId: string) {
  const vacation = await prisma.vacation.findUnique({
    where: { id: vacationId },
    include: { Employee: true },
  });
  if (!vacation) throw new Error('Vacation request not found');
  if (vacation.status !== 'cancelled') throw new Error('Only cancelled requests can be put back');

  const restoredStatus = getCancelledFromStatus(vacation);
  if (!restoredStatus) {
    throw new Error('Unable to determine the original request status');
  }

  const now = new Date();
  const statusHistory = appendVacationStatusHistory(vacation.statusHistory, {
    status: restoredStatus,
    previousStatus: 'cancelled',
    timestamp: now.toISOString(),
    changed_by: userId,
    reason: `Put back to ${restoredStatus} from cancelled`,
  });

  const updated = await prisma.vacation.update({
    where: { id: vacationId },
    data: {
      status: restoredStatus,
      approvedByUserId: restoredStatus === 'pending' ? null : userId,
      decidedAt: restoredStatus === 'pending' ? null : now,
      decisionReason: restoredStatus === 'pending' ? null : `Put back to ${restoredStatus} from cancelled`,
      statusHistory: statusHistory as any,
    },
  });

  const startStr = formatVacationDate(vacation.startDate, { month: 'short', day: 'numeric' });
  const endStr = formatVacationDate(vacation.endDate, { month: 'short', day: 'numeric', year: 'numeric' });
  await createVacationNotification({
    employeeId: vacation.employeeId,
    notificationType: 'vacation_put_back',
    title: 'Vacation Request Put Back',
    message: `Your vacation request for ${startStr} - ${endStr} was put back to ${restoredStatus}.`,
    relatedVacationId: vacationId,
    organizationId: vacation.organizationId || undefined,
  });

  return updated;
}

export async function getVacationDetails(vacationId: number) {
  const vacation = await prisma.vacation.findUnique({
    where: { id: vacationId },
    include: {
      Employee: { select: { firstName: true, lastName: true, email: true } },
      ApprovedByUser: { select: { firstName: true, lastName: true } },
    },
  });
  if (!vacation) throw new Error('Vacation request not found');
  return vacation;
}

export async function updateVacationRequest(vacationId: number, data: {
  startDate: string;
  endDate: string;
  leaveType?: string;
  reason?: string;
  durationDays?: number;
  durationHours?: number;
}) {
  const vacation = await prisma.vacation.findUnique({ where: { id: vacationId } });
  if (!vacation) throw new Error('Vacation request not found');
  if (vacation.status !== 'pending') throw new Error('Only pending requests can be edited');

  const startDate = parseVacationDateInput(data.startDate);
  const endDate = parseVacationDateInput(data.endDate);
  if (endDate < startDate) throw new Error('End date must be after or equal to start date');

  const durationDays = data.durationDays && data.durationDays > 0 ? data.durationDays : calcBusinessDays(startDate, endDate);
  const settings = await getVacationSettings(vacation.organizationId || undefined);
  const vacationHoursPerDay = normalizeVacationHoursPerDay(settings.vacationHoursPerDay);
  const durationHours = durationDays * vacationHoursPerDay;
  const leaveType = data.leaveType
    ? resolveConfiguredLeaveType(data.leaveType, settings.leaveTypes)
    : vacation.leaveType;

  const updated = await prisma.vacation.update({
    where: { id: vacationId },
    data: {
      startDate,
      endDate,
      durationDays,
      durationHours,
      leaveType,
      reason: data.reason || vacation.reason,
    },
  });

  // Log modification
  try {
    await prisma.vacationActivityLog.create({
      data: {
        vacationId,
        employeeId: vacation.employeeId,
        activityType: 'modified',
        startDate,
        endDate,
        durationDays,
        leaveType,
        status: 'pending',
        organizationId: vacation.organizationId,
      },
    });
  } catch (e) {
    console.warn('Failed to log vacation modification:', e);
  }

  return updated;
}

export async function deleteVacationRequest(vacationId: number, options?: { organizationId?: string }) {
  const vacation = await prisma.vacation.findUnique({
    where: { id: vacationId },
    include: { Employee: { select: { firstName: true, lastName: true, userId: true } } },
  });
  if (!vacation) throw new Error('Vacation request not found');

  if (options?.organizationId && vacation.organizationId !== options.organizationId) {
    throw new Error('Vacation request not found');
  }

  if (vacation.status !== 'cancelled') {
    throw new Error('Only cancelled requests can be deleted');
  }

  queueVacationPush(
    notifyVacationSnapshotPushSubscribers({
      event: 'deleted',
      vacation,
    }),
  );

  await prisma.vacation.delete({
    where: { id: vacationId },
  });

  return { id: vacationId };
}

// ─────────────────────────────────────────────────────────────────────────────
// Activity Log
// ─────────────────────────────────────────────────────────────────────────────

export async function getVacationActivityLog(options: {
  type?: string;
  limit?: number;
  offset?: number;
  organizationId?: string;
}) {
  const { type = 'all', limit = 50, offset = 0, organizationId } = options;
  const where: any = {};
  if (organizationId) where.organizationId = organizationId;
  if (type === 'approvals') where.status = 'approved';
  else if (type === 'denials') where.status = 'denied';
  else if (type === 'new_requests') where.status = 'pending';

  const vacations = await prisma.vacation.findMany({
    where,
    include: {
      Employee: { select: { firstName: true, lastName: true } },
      ApprovedByUser: { select: { firstName: true, lastName: true } },
      RequestedByUser: { select: { firstName: true, lastName: true } },
    },
    orderBy: { updatedAt: 'desc' },
    take: limit,
    skip: offset,
  });

  return vacations.map(v => {
    let activityType = 'new_request';
    let activityTimestamp = v.createdAt;
    if (v.status === 'approved') { activityType = 'approved'; activityTimestamp = v.decidedAt || v.updatedAt; }
    else if (v.status === 'denied') { activityType = 'denied'; activityTimestamp = v.decidedAt || v.updatedAt; }
    else if (v.updatedAt.getTime() - v.createdAt.getTime() > 60000) { activityType = 'modified'; activityTimestamp = v.updatedAt; }

    return {
      ...v,
      activity_type: activityType,
      activity_timestamp: activityTimestamp,
      approved_by_username: v.ApprovedByUser ? `${v.ApprovedByUser.firstName} ${v.ApprovedByUser.lastName}` : null,
      requested_by_username: v.RequestedByUser ? `${v.RequestedByUser.firstName} ${v.RequestedByUser.lastName}` : null,
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// All Requests (with optional status filter)
// ─────────────────────────────────────────────────────────────────────────────

export async function getVacationRequests(statusFilter?: string, organizationId?: string) {
  const where: any = {};
  if (organizationId) where.organizationId = organizationId;
  if (statusFilter && statusFilter !== 'all') where.status = statusFilter;

  return prisma.vacation.findMany({
    where,
    include: {
      Employee: { select: { firstName: true, lastName: true, role: true } },
      ApprovedByUser: { select: { firstName: true, lastName: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Vacation Settings
// ─────────────────────────────────────────────────────────────────────────────

export async function getVacationSettings(organizationId?: string) {
  // Find ALL matching records to detect and clean up duplicates
  const allSettings = await prisma.vacationSettings.findMany({
    where: organizationId ? { organizationId } : {},
    orderBy: { updatedAt: 'desc' },
  });

  // If we have duplicates, delete all but the most recently updated one
  if (allSettings.length > 1) {
    console.warn('[VacationSettings] Found %d duplicate records! Cleaning up...', allSettings.length);
    const keepId = allSettings[0].id;
    const deleteIds = allSettings.slice(1).map(s => s.id);
    await prisma.vacationSettings.deleteMany({ where: { id: { in: deleteIds } } });
    console.log('[VacationSettings] Kept id=%d, deleted ids=%j', keepId, deleteIds);
    return allSettings[0];
  }

  if (allSettings.length === 1) {
    return allSettings[0];
  }

  // No record exists — create with explicit zeros (user will set their own values)
  const created = await prisma.vacationSettings.create({
    data: {
      standardAllocationDays: 0,
      minimumNoticeDays: 0,
      maxConsecutiveDays: 0,
      minTeamCoveragePercent: 0,
      maxSimultaneousAbsences: 0,
      criticalRoleCoverageRequired: false,
      leaveTypes: DEFAULT_LEAVE_TYPES,
      vacationHoursPerDay: DEFAULT_VACATION_HOURS_PER_DAY,
      organizationId: organizationId ?? null,
    },
  });
  console.log('[VacationSettings] Created new record id=%d with all zeros for org=%s', created.id, organizationId ?? 'null');
  return created;
}

export async function updateVacationSettings(data: {
  standardAllocationDays?: number;
  minimumNoticeDays?: number;
  maxConsecutiveDays?: number;
  minTeamCoveragePercent?: number;
  maxSimultaneousAbsences?: number;
  criticalRoleCoverageRequired?: boolean;
  leaveTypes?: string[];
  vacationHoursPerDay?: number;
  organizationId?: string;
}) {
  // Get (or create) the single settings record
  const existing = await getVacationSettings(data.organizationId);

  console.log('[VacationSettings] BEFORE update id=%d → allocation=%d, notice=%d, maxConsec=%d, coverage=%d, maxSimul=%d, critical=%s',
    existing.id, existing.standardAllocationDays, existing.minimumNoticeDays,
    existing.maxConsecutiveDays, existing.minTeamCoveragePercent,
    existing.maxSimultaneousAbsences, existing.criticalRoleCoverageRequired);

  console.log('[VacationSettings] Incoming data → allocation=%s, notice=%s, maxConsec=%s, coverage=%s, maxSimul=%s, critical=%s',
    data.standardAllocationDays, data.minimumNoticeDays,
    data.maxConsecutiveDays, data.minTeamCoveragePercent,
    data.maxSimultaneousAbsences, data.criticalRoleCoverageRequired);

  const nextVacationHoursPerDay = data.vacationHoursPerDay === undefined
    ? undefined
    : normalizeVacationHoursPerDay(data.vacationHoursPerDay);

  const updated = await prisma.vacationSettings.update({
    where: { id: existing.id },
    data: {
      standardAllocationDays: data.standardAllocationDays,
      minimumNoticeDays: data.minimumNoticeDays,
      maxConsecutiveDays: data.maxConsecutiveDays,
      minTeamCoveragePercent: data.minTeamCoveragePercent,
      maxSimultaneousAbsences: data.maxSimultaneousAbsences,
      criticalRoleCoverageRequired: data.criticalRoleCoverageRequired,
      leaveTypes: data.leaveTypes === undefined ? undefined : normalizeLeaveTypes(data.leaveTypes),
      vacationHoursPerDay: nextVacationHoursPerDay,
    },
  });

  if (
    nextVacationHoursPerDay !== undefined &&
    nextVacationHoursPerDay !== normalizeVacationHoursPerDay(existing.vacationHoursPerDay)
  ) {
    await recalculateVacationDurationHours(data.organizationId, nextVacationHoursPerDay);
  }

  console.log('[VacationSettings] AFTER update id=%d → allocation=%d, notice=%d, maxConsec=%d, coverage=%d, maxSimul=%d, critical=%s',
    updated.id, updated.standardAllocationDays, updated.minimumNoticeDays,
    updated.maxConsecutiveDays, updated.minTeamCoveragePercent,
    updated.maxSimultaneousAbsences, updated.criticalRoleCoverageRequired);

  return updated;
}

/**
 * Reset all vacation settings to zero. Deletes ALL existing records and creates a fresh one.
 */
export async function resetVacationSettings(organizationId?: string) {
  // Delete ALL vacation settings records (including any orphans)
  const deleted = await prisma.vacationSettings.deleteMany({});
  console.log('[VacationSettings] RESET: Deleted %d records', deleted.count);

  // Create a fresh record with all zeros
  const fresh = await prisma.vacationSettings.create({
    data: {
      standardAllocationDays: 0,
      minimumNoticeDays: 0,
      maxConsecutiveDays: 0,
      minTeamCoveragePercent: 0,
      maxSimultaneousAbsences: 0,
      criticalRoleCoverageRequired: false,
      leaveTypes: DEFAULT_LEAVE_TYPES,
      vacationHoursPerDay: DEFAULT_VACATION_HOURS_PER_DAY,
      organizationId: organizationId ?? null,
    },
  });
  await recalculateVacationDurationHours(organizationId, DEFAULT_VACATION_HOURS_PER_DAY);
  console.log('[VacationSettings] RESET: Created fresh record id=%d with all zeros', fresh.id);
  return fresh;
}

// ─────────────────────────────────────────────────────────────────────────────
// Blackout Periods
// ─────────────────────────────────────────────────────────────────────────────

export async function getBlackoutPeriods(organizationId?: string) {
  return prisma.vacationBlackoutPeriod.findMany({
    where: { isActive: true, ...(organizationId ? { organizationId } : {}) },
    orderBy: { startDate: 'asc' },
  });
}

export async function createBlackoutPeriod(data: {
  name: string;
  startDate: string;
  endDate: string;
  description?: string;
  isActive?: boolean;
  createdByUserId?: string;
  organizationId?: string;
}) {
  return prisma.vacationBlackoutPeriod.create({
    data: {
      name: data.name,
      startDate: parseVacationDateInput(data.startDate),
      endDate: parseVacationDateInput(data.endDate),
      description: data.description || null,
      isActive: data.isActive ?? true,
      createdByUserId: data.createdByUserId || null,
      organizationId: data.organizationId || null,
    },
  });
}

export async function updateBlackoutPeriod(periodId: number, data: {
  name?: string;
  startDate?: string;
  endDate?: string;
  description?: string;
  isActive?: boolean;
}) {
  const existing = await prisma.vacationBlackoutPeriod.findUnique({ where: { id: periodId } });
  if (!existing) throw new Error('Blackout period not found');

  return prisma.vacationBlackoutPeriod.update({
    where: { id: periodId },
    data: {
      name: data.name,
      startDate: data.startDate ? parseVacationDateInput(data.startDate) : undefined,
      endDate: data.endDate ? parseVacationDateInput(data.endDate) : undefined,
      description: data.description,
      isActive: data.isActive,
    },
  });
}

export async function deleteBlackoutPeriod(periodId: number) {
  const existing = await prisma.vacationBlackoutPeriod.findUnique({ where: { id: periodId } });
  if (!existing) throw new Error('Blackout period not found');
  return prisma.vacationBlackoutPeriod.delete({ where: { id: periodId } });
}

// ─────────────────────────────────────────────────────────────────────────────
// Conflicts
// ─────────────────────────────────────────────────────────────────────────────

export async function getVacationConflicts(organizationId?: string) {
  const settings = await getVacationSettings(organizationId);
  const maxSimultaneous = (settings as any).maxSimultaneousAbsences || 3;
  const conflicts: any[] = [];

  // Get all active vacations (approved + pending) in the next 90 days
  const now = startOfUtcDay(new Date());
  const ninetyDays = addUtcDays(now, 90);

  const activeVacations = await prisma.vacation.findMany({
    where: {
      status: { in: ['approved', 'pending'] },
      endDate: { gte: now },
      startDate: { lte: ninetyDays },
      ...(organizationId ? { organizationId } : {}),
    },
    include: { Employee: { select: { firstName: true, lastName: true, role: true } } },
    orderBy: { startDate: 'asc' },
  });

  // Check for overlapping vacations per day (simplified)
  const dayMap = new Map<string, any[]>();
  for (const vac of activeVacations) {
    const cur = startOfUtcDay(vac.startDate);
    const end = startOfUtcDay(vac.endDate);
    while (cur <= end) {
      const key = cur.toISOString().split('T')[0];
      if (!dayMap.has(key)) dayMap.set(key, []);
      dayMap.get(key)!.push({
        employee_name: `${vac.Employee.firstName} ${vac.Employee.lastName}`,
        start_date: vac.startDate,
        end_date: vac.endDate,
        status: vac.status,
        role: vac.Employee.role,
      });
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
  }

  // Find days exceeding max
  for (const [dateStr, employees] of dayMap.entries()) {
    if (employees.length > maxSimultaneous) {
      conflicts.push({
        severity: employees.length > maxSimultaneous + 1 ? 'critical' : 'warning',
        title: 'Too Many Simultaneous Absences',
        description: `${employees.length} employees requesting time off on ${dateStr} (maximum allowed: ${maxSimultaneous})`,
        conflicting_requests: employees.slice(0, 10),
        period: { start: dateStr, end: dateStr },
      });
    }
  }

  // Check blackout period violations
  const blackouts = await getBlackoutPeriods(organizationId);
  const pendingVacations = activeVacations.filter(v => v.status === 'pending');
  for (const vac of pendingVacations) {
    for (const bp of blackouts) {
      if (vac.startDate <= bp.endDate && vac.endDate >= bp.startDate) {
        conflicts.push({
          severity: 'critical',
          title: 'Blackout Period Violation',
          description: `Vacation request during restricted period: ${bp.name}`,
          details: {
            Employee: `${vac.Employee.firstName} ${vac.Employee.lastName}`,
            'Requested Dates': `${formatVacationDate(vac.startDate, { month: 'short', day: 'numeric' })} - ${formatVacationDate(vac.endDate, { month: 'short', day: 'numeric', year: 'numeric' })}`,
            'Blackout Period': bp.name,
          },
        });
      }
    }
  }

  return conflicts;
}

// ─────────────────────────────────────────────────────────────────────────────
// Notifications
// ─────────────────────────────────────────────────────────────────────────────

export async function createVacationNotification(data: {
  employeeId: number;
  notificationType: string;
  title: string;
  message: string;
  relatedVacationId?: number;
  organizationId?: string;
}) {
  return prisma.vacationNotification.create({
    data: {
      employeeId: data.employeeId,
      notificationType: data.notificationType,
      title: data.title,
      message: data.message,
      relatedVacationId: data.relatedVacationId || null,
      organizationId: data.organizationId || null,
    },
  });
}

export async function getVacationNotifications(options: {
  employeeId?: number;
  userRole?: string;
  limit?: number;
  unreadOnly?: boolean;
  organizationId?: string;
}) {
  const { employeeId, userRole, limit = 20, unreadOnly = false, organizationId } = options;
  const where: any = {};
  if (organizationId) where.organizationId = organizationId;
  if (unreadOnly) where.isRead = false;
  // Admins/supervisors see all; regular users see only their own
  if (userRole !== 'admin' && userRole !== 'supervisor' && employeeId) {
    where.employeeId = employeeId;
  }

  const [notifications, unreadCount] = await Promise.all([
    prisma.vacationNotification.findMany({
      where,
      include: {
        Employee: { select: { firstName: true, lastName: true } },
        RelatedVacation: { select: { startDate: true, endDate: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    }),
    prisma.vacationNotification.count({
      where: { ...where, isRead: false },
    }),
  ]);

  return { notifications, unreadCount };
}

export async function markNotificationRead(notificationId: number) {
  return prisma.vacationNotification.update({
    where: { id: notificationId },
    data: { isRead: true, readAt: new Date() },
  });
}

export async function markAllNotificationsRead(employeeId?: number, organizationId?: string) {
  const where: any = { isRead: false };
  if (employeeId) where.employeeId = employeeId;
  if (organizationId) where.organizationId = organizationId;

  return prisma.vacationNotification.updateMany({
    where,
    data: { isRead: true, readAt: new Date() },
  });
}

export async function deleteNotification(notificationId: number) {
  return prisma.vacationNotification.delete({ where: { id: notificationId } });
}

// ─────────────────────────────────────────────────────────────────────────────
// Employee Self-Service (my-*)
// ─────────────────────────────────────────────────────────────────────────────

export async function getEmployeeByUserId(userId: string) {
  return prisma.vacationEmployee.findFirst({ where: { userId } });
}

export async function getMyVacationStats(employeeId: number) {
  const employee = await prisma.vacationEmployee.findUnique({ where: { id: employeeId } });
  if (!employee) throw new Error('Employee not found');

  const settings = await getVacationSettings(employee.organizationId || undefined);
  const vacationHoursPerDay = normalizeVacationHoursPerDay(settings.vacationHoursPerDay);
  const vacationHours = employee.allocatedVacationHours || (employee.annualAllocation ? employee.annualAllocation * vacationHoursPerDay : 200);
  const totalDays = vacationHours / vacationHoursPerDay;

  const currentYear = new Date().getFullYear();
  const yearStart = new Date(currentYear, 0, 1);
  const yearEnd = new Date(currentYear, 11, 31);

  const [usedResult, approvedCount, pendingCount] = await Promise.all([
    prisma.vacation.aggregate({
      where: { employeeId, status: 'approved', startDate: { gte: yearStart, lte: yearEnd } },
      _sum: { durationDays: true },
    }),
    prisma.vacation.count({
      where: { employeeId, status: 'approved', startDate: { gte: yearStart, lte: yearEnd } },
    }),
    prisma.vacation.count({
      where: { employeeId, status: 'pending' },
    }),
  ]);

  const daysUsed = usedResult._sum.durationDays || 0;
  return {
    total_days: Math.floor(totalDays),
    days_used: daysUsed,
    days_remaining: Math.floor(totalDays) - daysUsed,
    pending: pendingCount,
    approved_count: approvedCount,
  };
}

export async function getMyVacationHistory(employeeId: number) {
  return prisma.vacation.findMany({
    where: { employeeId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
}

export async function getMyVacationActivity(employeeId: number) {
  const vacations = await prisma.vacation.findMany({
    where: { employeeId },
    orderBy: { updatedAt: 'desc' },
    take: 20,
  });

  return vacations.map(v => {
    let activityType = 'new_request';
    let activityTimestamp = v.createdAt;
    if (v.status === 'approved' && v.decidedAt) { activityType = 'approved'; activityTimestamp = v.decidedAt; }
    else if (v.status === 'denied' && v.decidedAt) { activityType = 'denied'; activityTimestamp = v.decidedAt; }
    else if (v.updatedAt.getTime() - v.createdAt.getTime() > 60000) { activityType = 'modified'; activityTimestamp = v.updatedAt; }
    return { ...v, activity_type: activityType, activity_timestamp: activityTimestamp };
  });
}

export async function getMyUpcomingVacations(employeeId: number) {
  const now = startOfUtcDay(new Date());
  const thirtyDays = addUtcDays(now, 30);

  return prisma.vacation.findMany({
    where: { employeeId, status: 'approved', startDate: { gte: now, lte: thirtyDays } },
    orderBy: { startDate: 'asc' },
  });
}

export async function getMyPendingVacations(employeeId: number) {
  return prisma.vacation.findMany({
    where: { employeeId, status: 'pending' },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getMyRecentVacations(employeeId: number) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  return prisma.vacation.findMany({
    where: { employeeId, status: { in: ['approved', 'denied'] }, decidedAt: { gte: thirtyDaysAgo } },
    orderBy: { decidedAt: 'desc' },
  });
}

export async function getMyVacationConflicts(employeeId: number) {
  const employee = await prisma.vacationEmployee.findUnique({ where: { id: employeeId } });
  if (!employee) throw new Error('Employee not found');

  const settings = await getVacationSettings(employee.organizationId || undefined);
  const maxSimultaneous = (settings as any).maxSimultaneousAbsences || 3;

  const myVacations = await prisma.vacation.findMany({
    where: { employeeId, status: { in: ['approved', 'pending'] }, endDate: { gte: startOfUtcDay(new Date()) } },
    orderBy: { startDate: 'asc' },
  });

  const conflicts: any[] = [];
  for (const vac of myVacations) {
    const overlapping = await prisma.vacation.findMany({
      where: {
        id: { not: vac.id },
        employeeId: { not: employeeId },
        status: { in: ['approved', 'pending'] },
        startDate: { lte: vac.endDate },
        endDate: { gte: vac.startDate },
      },
      include: { Employee: { select: { firstName: true, lastName: true } } },
    });

    const totalOff = overlapping.length + 1;
    if (totalOff > maxSimultaneous) {
      const startStr = formatVacationDate(vac.startDate, { month: 'short', day: 'numeric' });
      const endStr = formatVacationDate(vac.endDate, { month: 'short', day: 'numeric', year: 'numeric' });
      conflicts.push({
        severity: totalOff > maxSimultaneous + 1 ? 'critical' : 'warning',
        title: `Scheduling Conflict: ${startStr} - ${endStr}`,
        description: `${totalOff} employees requesting time off (maximum allowed: ${maxSimultaneous}). Your request may be affected.`,
        conflicting_requests: overlapping.map(o => ({
          employee_name: `${o.Employee.firstName} ${o.Employee.lastName}`,
          start_date: o.startDate,
          end_date: o.endDate,
          status: o.status,
        })).slice(0, 10),
      });
    }
  }

  return conflicts;
}

// ─────────────────────────────────────────────────────────────────────────────
// Employee Directory (for vacation context)
// ─────────────────────────────────────────────────────────────────────────────

export async function getEmployeesDirectory(options: {
  department?: string;
  status?: string;
  organizationId?: string;
}) {
  const { department, status, organizationId } = options;
  const where: any = {};
  if (organizationId) where.organizationId = organizationId;
  if (department && department !== 'all') where.role = department;

  const employees = await prisma.vacationEmployee.findMany({
    where,
    include: {
      Vacations: {
        where: { status: { in: ['approved', 'pending'] } },
        orderBy: { startDate: 'asc' },
      },
    },
    orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
  });

  const now = new Date();
  return employees.map(emp => {
    const currentVacation = emp.Vacations.find(v => v.status === 'approved' && v.startDate <= now && v.endDate >= now);
    const upcomingVacation = emp.Vacations.find(v => (v.status === 'approved' || v.status === 'pending') && v.startDate > now);

    // Compute days used this year
    const currentYear = now.getFullYear();
    const daysUsed = emp.Vacations
      .filter(v => v.status === 'approved' && v.startDate.getFullYear() === currentYear)
      .reduce((sum, v) => sum + v.durationDays, 0);

    const currentStatus = currentVacation ? 'on_vacation' : 'available';
    if (status && status !== 'all') {
      if (status === 'on-vacation' && currentStatus !== 'on_vacation') return null;
      if (status === 'available' && currentStatus !== 'available') return null;
      if (status === 'upcoming' && !upcomingVacation) return null;
    }

    return {
      id: emp.id,
      firstname: emp.firstName,
      lastname: emp.lastName,
      role: emp.role,
      department: emp.department,
      shift: emp.shift,
      workline: emp.workline,
      workarea: emp.workarea,
      phone: emp.phone,
      employeeCode: emp.employeeCode,
      vacation_balance_days: emp.annualAllocation || 25,
      vacation_days_used: daysUsed,
      current_status: currentStatus,
      return_date: currentVacation?.endDate?.toISOString().split('T')[0] || null,
      upcoming_vacation: !!upcomingVacation,
      upcoming_start: upcomingVacation?.startDate?.toISOString().split('T')[0] || null,
      upcoming_end: upcomingVacation?.endDate?.toISOString().split('T')[0] || null,
      upcoming_status: upcomingVacation?.status || null,
    };
  }).filter(Boolean);
}

export async function getEmployeeDepartments(organizationId?: string) {
  const employees = await prisma.vacationEmployee.findMany({
    where: { role: { not: null }, ...(organizationId ? { organizationId } : {}) },
    select: { role: true },
    distinct: ['role'],
    orderBy: { role: 'asc' },
  });
  return employees.map(e => e.role).filter(Boolean);
}

// ─────────────────────────────────────────────────────────────────────────────
// Form Dropdowns (Department, Shift, Line, Area from real DB tables)
// ─────────────────────────────────────────────────────────────────────────────

export async function getFormDropdowns() {
  const [departments, shifts, lines, areas, shiftLines] = await Promise.all([
    prisma.department.findMany({ select: { id: true, name: true, facilityId: true }, orderBy: { name: 'asc' } }),
    prisma.shift.findMany({ select: { id: true, name: true, startTime: true, endTime: true, facilityId: true }, orderBy: { name: 'asc' } }),
    prisma.line.findMany({ select: { id: true, name: true, lineNumber: true, areaId: true }, orderBy: { name: 'asc' } }),
    prisma.area.findMany({ select: { id: true, name: true, departmentId: true }, orderBy: { name: 'asc' } }),
    prisma.shiftLine.findMany({ select: { shiftId: true, lineId: true } }),
  ]);

  return {
    departments: departments.map(d => ({ id: d.id, name: d.name, facilityId: d.facilityId })),
    shifts: shifts.map(s => ({ id: s.id, name: s.name, startTime: s.startTime, endTime: s.endTime, facilityId: s.facilityId })),
    lines: lines.map(l => ({ id: l.id, name: l.name, lineNumber: l.lineNumber, areaId: l.areaId })),
    areas: areas.map(a => ({ id: a.id, name: a.name, departmentId: a.departmentId })),
    shiftLines: shiftLines.map(sl => ({ shiftId: sl.shiftId, lineId: sl.lineId })),
  };
}
