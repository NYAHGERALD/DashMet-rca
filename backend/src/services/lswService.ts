import { prisma } from '../utils/prisma';
import { LswFrequency, LswTrend, LswKeyResultScope, LswDayOfWeek } from '@prisma/client';

// ─────────────────────────────────────────────────────────────────────────────
// LSW Board (page-level settings per user per week)
// ─────────────────────────────────────────────────────────────────────────────
export async function getOrCreateBoard(userId: string, organizationId: string, weekNumber: number, year: number) {
  let board = await prisma.lswBoard.findUnique({
    where: { userId_weekNumber_year: { userId, weekNumber, year } },
  });
  if (!board) {
    board = await prisma.lswBoard.create({
      data: { userId, organizationId, weekNumber, year },
    });
  }
  return board;
}

export async function updateBoard(userId: string, weekNumber: number, year: number, data: { selectedDay?: LswDayOfWeek; todoTab?: string; facilityId?: string | null; departmentId?: string | null }) {
  return prisma.lswBoard.update({
    where: { userId_weekNumber_year: { userId, weekNumber, year } },
    data,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Departments – reads from the real Department table (linked via Facility → Organization)
// ─────────────────────────────────────────────────────────────────────────────
export async function getDepartments(organizationId: string, facilityId?: string) {
  return prisma.department.findMany({
    where: {
      Facility: { organizationId },
      ...(facilityId ? { facilityId } : {}),
    },
    orderBy: { name: 'asc' },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Daily Tasks
// ─────────────────────────────────────────────────────────────────────────────
export async function getDailyTasks(userId: string, weekNumber?: number, year?: number) {
  const tasks = await prisma.lswDailyTask.findMany({
    where: { userId, isActive: true },
    include: {
      completions: weekNumber !== undefined && year !== undefined
        ? { where: { weekNumber, year } }
        : false,
    },
    orderBy: [{ sortOrder: 'asc' }, { time: 'asc' }],
  });

  // Merge completion data into the task's day fields for the requested week
  return tasks.map(task => {
    const completion = (task as any).completions?.[0];
    return {
      id: task.id,
      userId: task.userId,
      facilityId: task.facilityId,
      departmentId: task.departmentId,
      task: task.task,
      minutes: task.minutes,
      time: task.time,
      monday: completion?.monday ?? false,
      tuesday: completion?.tuesday ?? false,
      wednesday: completion?.wednesday ?? false,
      thursday: completion?.thursday ?? false,
      friday: completion?.friday ?? false,
      saturday: completion?.saturday ?? false,
      sunday: completion?.sunday ?? false,
      sortOrder: task.sortOrder,
      isActive: task.isActive,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
    };
  });
}

export async function createDailyTask(data: {
  userId: string; facilityId?: string; departmentId?: string;
  task: string; minutes?: number; time: string;
  monday?: boolean; tuesday?: boolean; wednesday?: boolean;
  thursday?: boolean; friday?: boolean; saturday?: boolean; sunday?: boolean;
  sortOrder?: number;
}) {
  return prisma.lswDailyTask.create({ data });
}

export async function updateDailyTask(id: string, userId: string, data: Partial<{
  task: string; minutes: number; time: string;
  monday: boolean; tuesday: boolean; wednesday: boolean;
  thursday: boolean; friday: boolean; saturday: boolean; sunday: boolean;
  sortOrder: number; isActive: boolean;
}>) {
  const existing = await prisma.lswDailyTask.findFirst({ where: { id, userId } });
  if (!existing) throw new Error('Daily task not found or access denied');
  return prisma.lswDailyTask.update({ where: { id }, data });
}

export async function deleteDailyTask(id: string, userId: string) {
  const existing = await prisma.lswDailyTask.findFirst({ where: { id, userId } });
  if (!existing) throw new Error('Daily task not found or access denied');
  return prisma.lswDailyTask.update({ where: { id }, data: { isActive: false } });
}

export async function upsertDailyTaskCompletion(
  dailyTaskId: string,
  weekNumber: number,
  year: number,
  day: string,
  value: boolean
) {
  const dayField = day as 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
  return prisma.lswDailyTaskCompletion.upsert({
    where: { dailyTaskId_weekNumber_year: { dailyTaskId, weekNumber, year } },
    create: { dailyTaskId, weekNumber, year, [dayField]: value },
    update: { [dayField]: value },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Todo Items
// ─────────────────────────────────────────────────────────────────────────────
export async function getTodoItems(userId: string, weekNumber?: number, year?: number) {
  return prisma.lswTodoItem.findMany({
    where: {
      userId,
      isActive: true,
      ...(weekNumber !== undefined && year !== undefined ? { weekNumber, year } : {}),
    },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });
}

export async function createTodoItem(data: {
  userId: string; departmentId?: string;
  task: string; dueDate?: string;
  note?: string; priority?: string; category?: string;
  tags?: string; isFlagged?: boolean;
  reminderDate?: string; recurrence?: string;
  weekNumber?: number; year?: number; sortOrder?: number;
}) {
  const createData: any = { ...data };
  if (data.reminderDate) createData.reminderDate = new Date(data.reminderDate);
  return prisma.lswTodoItem.create({ data: createData });
}

export async function updateTodoItem(id: string, userId: string, data: Partial<{
  task: string; completed: boolean; completedAt: Date | null; dueDate: string;
  note: string; priority: string; category: string;
  tags: string; isFlagged: boolean;
  reminderDate: string | null; recurrence: string;
  sortOrder: number; isActive: boolean;
}>) {
  const existing = await prisma.lswTodoItem.findFirst({ where: { id, userId } });
  if (!existing) throw new Error('Todo item not found or access denied');
  // Auto-set completedAt when toggling completed
  if (data.completed === true && !data.completedAt) {
    data.completedAt = new Date();
  } else if (data.completed === false) {
    data.completedAt = null;
  }
  const updateData: any = { ...data };
  if (data.reminderDate) updateData.reminderDate = new Date(data.reminderDate);
  else if (data.reminderDate === null) updateData.reminderDate = null;
  return prisma.lswTodoItem.update({ where: { id }, data: updateData });
}

export async function deleteTodoItem(id: string, userId: string) {
  const existing = await prisma.lswTodoItem.findFirst({ where: { id, userId } });
  if (!existing) throw new Error('Todo item not found or access denied');
  return prisma.lswTodoItem.update({ where: { id }, data: { isActive: false } });
}

// ─────────────────────────────────────────────────────────────────────────────
// Frequency Tasks (Scheduled Tasks/Meetings) — Period-based storage
// ─────────────────────────────────────────────────────────────────────────────

// Utility: Get the Monday date of a given ISO week
function getDateFromWeekNumber(weekNumber: number, year: number): Date {
  const jan4 = new Date(year, 0, 4);
  const dayOfWeek = jan4.getDay() || 7; // Sunday = 7
  const mondayOfWeek1 = new Date(jan4);
  mondayOfWeek1.setDate(jan4.getDate() - dayOfWeek + 1);
  const targetDate = new Date(mondayOfWeek1);
  targetDate.setDate(mondayOfWeek1.getDate() + (weekNumber - 1) * 7);
  return targetDate;
}

// Compute the period key for a given frequency + week/year context
export function computePeriodKey(frequency: string, weekNumber: number, year: number): string {
  switch (frequency) {
    case 'BIWEEKLY': {
      const period = Math.ceil(weekNumber / 2);
      return `BW-${period}-${year}`;
    }
    case 'MONTHLY': {
      const date = getDateFromWeekNumber(weekNumber, year);
      const month = date.getMonth() + 1;
      return `M-${month}-${year}`;
    }
    case 'QUARTERLY': {
      const date = getDateFromWeekNumber(weekNumber, year);
      const month = date.getMonth() + 1;
      const quarter = Math.ceil(month / 3);
      return `Q-${quarter}-${year}`;
    }
    case 'ANNUALLY':
      return `A-${year}`;
    default:
      return `A-${year}`;
  }
}

export async function getFrequencyTasks(userId: string, weekNumber?: number, year?: number) {
  const allTasks = await prisma.lswFrequencyTask.findMany({
    where: { userId, isActive: true },
    orderBy: [{ frequency: 'asc' }, { dueDate: 'asc' }],
  });

  // If no week/year provided, return all (backward compat)
  if (!weekNumber || !year) return allTasks;

  // Filter by period key — each task's frequency determines its period
  return allTasks.filter((task: any) => {
    if (!task.periodKey) return true; // Legacy tasks without periodKey show always
    const expectedKey = computePeriodKey(task.frequency, weekNumber, year);
    return task.periodKey === expectedKey;
  });
}

export async function createFrequencyTask(data: {
  userId: string; facilityId?: string;
  task: string; minutes?: number; dueDate: string;
  frequency: LswFrequency; sortOrder?: number;
  weekNumber?: number; year?: number;
}) {
  const { weekNumber, year, ...createData } = data;
  const periodKey = weekNumber && year
    ? computePeriodKey(data.frequency, weekNumber, year)
    : undefined;

  return prisma.lswFrequencyTask.create({
    data: {
      ...createData,
      dueDate: new Date(data.dueDate),
      ...(periodKey ? { periodKey } : {}),
    },
  });
}

export async function updateFrequencyTask(id: string, userId: string, data: Partial<{
  task: string; minutes: number; dueDate: string;
  frequency: LswFrequency; sortOrder: number; isActive: boolean;
}>) {
  const existing = await prisma.lswFrequencyTask.findFirst({ where: { id, userId } });
  if (!existing) throw new Error('Frequency task not found or access denied');
  const updateData: any = { ...data };
  if (data.dueDate) updateData.dueDate = new Date(data.dueDate);
  return prisma.lswFrequencyTask.update({ where: { id }, data: updateData });
}

export async function deleteFrequencyTask(id: string, userId: string) {
  const existing = await prisma.lswFrequencyTask.findFirst({ where: { id, userId } });
  if (!existing) throw new Error('Frequency task not found or access denied');
  return prisma.lswFrequencyTask.update({ where: { id }, data: { isActive: false } });
}

// ─────────────────────────────────────────────────────────────────────────────
// Projects & Updates
// ─────────────────────────────────────────────────────────────────────────────
export async function getProjects(userId: string) {
  return prisma.lswProject.findMany({
    where: { userId, isActive: true },
    include: { updates: { orderBy: { sortOrder: 'asc' } } },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });
}

export async function createProject(data: {
  userId: string; facilityId?: string; name: string;
  fontColor?: string; fontFamily?: string; fontBold?: boolean; fontItalic?: boolean;
  cellColor?: string; cellColorIntensity?: number;
  defaultUpdateFontColor?: string; defaultUpdateFontItalic?: boolean;
  defaultUpdateCellColor?: string; defaultUpdateCellColorIntensity?: number;
  initialUpdateText?: string;
}) {
  const { initialUpdateText, ...projectData } = data;
  return prisma.lswProject.create({
    data: {
      ...projectData,
      updates: {
        create: [{
          text: initialUpdateText || '',
          fontColor: data.defaultUpdateFontColor,
          fontItalic: data.defaultUpdateFontItalic,
          cellColor: data.defaultUpdateCellColor,
          cellColorIntensity: data.defaultUpdateCellColorIntensity,
          sortOrder: 0,
        }],
      },
    },
    include: { updates: { orderBy: { sortOrder: 'asc' } } },
  });
}

export async function updateProject(id: string, userId: string, data: Partial<{
  name: string; fontColor: string; fontFamily: string; fontBold: boolean; fontItalic: boolean;
  cellColor: string; cellColorIntensity: number;
  defaultUpdateFontColor: string; defaultUpdateFontItalic: boolean;
  defaultUpdateCellColor: string; defaultUpdateCellColorIntensity: number;
  sortOrder: number; isActive: boolean;
}>) {
  const existing = await prisma.lswProject.findFirst({ where: { id, userId } });
  if (!existing) throw new Error('Project not found or access denied');
  return prisma.lswProject.update({
    where: { id },
    data,
    include: { updates: { orderBy: { sortOrder: 'asc' } } },
  });
}

export async function deleteProject(id: string, userId: string) {
  const existing = await prisma.lswProject.findFirst({ where: { id, userId } });
  if (!existing) throw new Error('Project not found or access denied');
  return prisma.lswProject.update({
    where: { id },
    data: { isActive: false },
  });
}

// Project Updates
export async function addProjectUpdate(projectId: string, data: {
  text?: string; fontColor?: string; fontItalic?: boolean;
  cellColor?: string; cellColorIntensity?: number; sortOrder?: number;
}) {
  // Get current max sortOrder
  const existing = await prisma.lswProjectUpdate.findMany({
    where: { projectId },
    orderBy: { sortOrder: 'desc' },
    take: 1,
  });
  const nextSort = existing.length > 0 ? existing[0].sortOrder + 1 : 0;
  return prisma.lswProjectUpdate.create({
    data: { projectId, text: data.text || '', sortOrder: data.sortOrder ?? nextSort, ...data },
  });
}

export async function updateProjectUpdate(id: string, data: Partial<{
  text: string; fontColor: string; fontItalic: boolean;
  cellColor: string; cellColorIntensity: number; sortOrder: number;
}>) {
  return prisma.lswProjectUpdate.update({ where: { id }, data });
}

export async function deleteProjectUpdate(id: string) {
  return prisma.lswProjectUpdate.delete({ where: { id } });
}

// ─────────────────────────────────────────────────────────────────────────────
// Meeting Rails — Per-week storage
// ─────────────────────────────────────────────────────────────────────────────
export async function getMeetingRails(userId: string, weekNumber?: number, year?: number) {
  const where: any = { userId, isActive: true };
  if (weekNumber !== undefined && year !== undefined) {
    where.weekNumber = weekNumber;
    where.year = year;
  }
  return prisma.lswMeetingRail.findMany({
    where,
    orderBy: [{ sortOrder: 'asc' }, { dueDate: 'asc' }],
  });
}

export async function createMeetingRail(data: {
  userId: string; facilityId?: string;
  rail: string; dueDate: string;
  weekNumber?: number; year?: number; sortOrder?: number;
}) {
  return prisma.lswMeetingRail.create({
    data: { ...data, dueDate: new Date(data.dueDate) },
  });
}

export async function updateMeetingRail(id: string, userId: string, data: Partial<{
  rail: string; dueDate: string; completed: boolean; completedAt: Date | null;
  sortOrder: number; isActive: boolean;
}>) {
  const existing = await prisma.lswMeetingRail.findFirst({ where: { id, userId } });
  if (!existing) throw new Error('Meeting rail not found or access denied');
  const updateData: any = { ...data };
  if (data.dueDate) updateData.dueDate = new Date(data.dueDate);
  if (data.completed === true && !data.completedAt) {
    updateData.completedAt = new Date();
  } else if (data.completed === false) {
    updateData.completedAt = null;
  }
  return prisma.lswMeetingRail.update({ where: { id }, data: updateData });
}

export async function deleteMeetingRail(id: string, userId: string) {
  const existing = await prisma.lswMeetingRail.findFirst({ where: { id, userId } });
  if (!existing) throw new Error('Meeting rail not found or access denied');
  return prisma.lswMeetingRail.update({ where: { id }, data: { isActive: false } });
}

// ─────────────────────────────────────────────────────────────────────────────
// Follow Ups
// ─────────────────────────────────────────────────────────────────────────────
export async function getFollowUps(userId: string) {
  return prisma.lswFollowUp.findMany({
    where: { userId, isActive: true },
    include: { responsibleUser: { select: { id: true, firstName: true, lastName: true, email: true } } },
    orderBy: [{ sortOrder: 'asc' }, { dueDate: 'asc' }],
  });
}

export async function createFollowUp(data: {
  userId: string; facilityId?: string;
  task: string; dueDate: string;
  responsibleUserId?: string; responsibleName?: string;
  comments?: string; sortOrder?: number;
}) {
  return prisma.lswFollowUp.create({
    data: { ...data, dueDate: new Date(data.dueDate) },
    include: { responsibleUser: { select: { id: true, firstName: true, lastName: true, email: true } } },
  });
}

export async function updateFollowUp(id: string, userId: string, data: Partial<{
  task: string; dueDate: string; responsibleUserId: string | null; responsibleName: string | null;
  comments: string; completed: boolean; completedAt: Date | null;
  sortOrder: number; isActive: boolean;
}>) {
  const existing = await prisma.lswFollowUp.findFirst({ where: { id, userId } });
  if (!existing) throw new Error('Follow-up not found or access denied');
  const updateData: any = { ...data };
  if (data.dueDate) updateData.dueDate = new Date(data.dueDate);
  if (data.completed === true && !data.completedAt) {
    updateData.completedAt = new Date();
  } else if (data.completed === false) {
    updateData.completedAt = null;
  }
  return prisma.lswFollowUp.update({
    where: { id },
    data: updateData,
    include: { responsibleUser: { select: { id: true, firstName: true, lastName: true, email: true } } },
  });
}

export async function deleteFollowUp(id: string, userId: string) {
  const existing = await prisma.lswFollowUp.findFirst({ where: { id, userId } });
  if (!existing) throw new Error('Follow-up not found or access denied');
  return prisma.lswFollowUp.update({ where: { id }, data: { isActive: false } });
}

// ─────────────────────────────────────────────────────────────────────────────
// Key Results (Sets + individual metrics)
// ─────────────────────────────────────────────────────────────────────────────
export async function getKeyResultSets(userId: string, organizationId: string) {
  return prisma.lswKeyResultSet.findMany({
    where: { organizationId, isActive: true },
    include: { keyResults: { orderBy: { sortOrder: 'asc' } } },
    orderBy: [{ sortOrder: 'asc' }],
  });
}

export async function createKeyResultSet(data: {
  userId: string; organizationId: string; facilityId?: string;
  name: string; scope?: LswKeyResultScope; description?: string; icon?: string;
  sortOrder?: number;
}) {
  return prisma.lswKeyResultSet.create({
    data,
    include: { keyResults: true },
  });
}

export async function updateKeyResultSet(id: string, data: Partial<{
  name: string; scope: LswKeyResultScope; description: string; icon: string;
  sortOrder: number; isActive: boolean;
}>) {
  return prisma.lswKeyResultSet.update({
    where: { id },
    data,
    include: { keyResults: { orderBy: { sortOrder: 'asc' } } },
  });
}

export async function deleteKeyResultSet(id: string) {
  return prisma.lswKeyResultSet.update({ where: { id }, data: { isActive: false } });
}

// Key Results (individual metrics)
export async function createKeyResult(data: {
  keyResultSetId: string; metric: string; value: string;
  target?: string; trend?: LswTrend; sortOrder?: number;
}) {
  return prisma.lswKeyResult.create({ data });
}

export async function updateKeyResult(id: string, data: Partial<{
  metric: string; value: string; target: string;
  trend: LswTrend; sortOrder: number;
}>) {
  return prisma.lswKeyResult.update({ where: { id }, data });
}

export async function deleteKeyResult(id: string) {
  return prisma.lswKeyResult.delete({ where: { id } });
}

// ─────────────────────────────────────────────────────────────────────────────
// Personal Goals
// ─────────────────────────────────────────────────────────────────────────────
export async function getPersonalGoals(userId: string) {
  return prisma.lswPersonalGoal.findMany({
    where: { userId, isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { dueDate: 'asc' }],
  });
}

export async function createPersonalGoal(data: {
  userId: string; facilityId?: string;
  objective: string; dueDate: string; progress?: number; sortOrder?: number;
}) {
  return prisma.lswPersonalGoal.create({
    data: { ...data, dueDate: new Date(data.dueDate) },
  });
}

export async function updatePersonalGoal(id: string, userId: string, data: Partial<{
  objective: string; dueDate: string; progress: number;
  sortOrder: number; isActive: boolean;
}>) {
  const existing = await prisma.lswPersonalGoal.findFirst({ where: { id, userId } });
  if (!existing) throw new Error('Personal goal not found or access denied');
  const updateData: any = { ...data };
  if (data.dueDate) updateData.dueDate = new Date(data.dueDate);
  return prisma.lswPersonalGoal.update({ where: { id }, data: updateData });
}

export async function deletePersonalGoal(id: string, userId: string) {
  const existing = await prisma.lswPersonalGoal.findFirst({ where: { id, userId } });
  if (!existing) throw new Error('Personal goal not found or access denied');
  return prisma.lswPersonalGoal.update({ where: { id }, data: { isActive: false } });
}

// ─────────────────────────────────────────────────────────────────────────────
// RCA Triggers
// ─────────────────────────────────────────────────────────────────────────────
export async function getRcaTriggers(userId: string, organizationId: string) {
  return prisma.lswRcaTrigger.findMany({
    where: { userId, organizationId, isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });
}

export async function createRcaTrigger(data: {
  userId: string; organizationId: string; facilityId?: string;
  trigger: string; eventDate?: string; comments?: string; sortOrder?: number;
}) {
  return prisma.lswRcaTrigger.create({
    data: {
      ...data,
      eventDate: data.eventDate ? new Date(data.eventDate) : null,
    },
  });
}

export async function updateRcaTrigger(id: string, userId: string, data: Partial<{
  trigger: string; eventDate: string | null; comments: string;
  sortOrder: number; isActive: boolean;
}>) {
  const existing = await prisma.lswRcaTrigger.findFirst({ where: { id, userId } });
  if (!existing) throw new Error('RCA trigger not found or access denied');
  const updateData: any = { ...data };
  if (data.eventDate !== undefined) {
    updateData.eventDate = data.eventDate ? new Date(data.eventDate) : null;
  }
  return prisma.lswRcaTrigger.update({ where: { id }, data: updateData });
}

export async function deleteRcaTrigger(id: string, userId: string) {
  const existing = await prisma.lswRcaTrigger.findFirst({ where: { id, userId } });
  if (!existing) throw new Error('RCA trigger not found or access denied');
  return prisma.lswRcaTrigger.update({ where: { id }, data: { isActive: false } });
}

// ─────────────────────────────────────────────────────────────────────────────
// Style Presets
// ─────────────────────────────────────────────────────────────────────────────
export async function getStylePresets(organizationId: string) {
  return prisma.lswStylePreset.findMany({
    where: { organizationId, isActive: true },
    orderBy: [{ category: 'asc' }, { context: 'asc' }, { sortOrder: 'asc' }],
  });
}

export async function upsertStylePreset(data: {
  organizationId: string; name: string; category: string;
  context: string; values: any; isDefault?: boolean; sortOrder?: number;
}) {
  return prisma.lswStylePreset.upsert({
    where: {
      organizationId_name_category_context: {
        organizationId: data.organizationId,
        name: data.name,
        category: data.category,
        context: data.context,
      },
    },
    update: { values: data.values, isDefault: data.isDefault, sortOrder: data.sortOrder },
    create: data,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Bulk fetch: Get ALL LSW data for a user in one call (page load)
// ─────────────────────────────────────────────────────────────────────────────
export async function getFullLswData(userId: string, organizationId: string, weekNumber: number, year: number) {
  const [
    board,
    calendarConfig,
    userPrefs,
    departments,
    dailyTasks,
    todoItems,
    frequencyTasks,
    projects,
    meetingRails,
    followUps,
    keyResultSets,
    personalGoals,
    rcaTriggers,
    stylePresets,
  ] = await Promise.all([
    getOrCreateBoard(userId, organizationId, weekNumber, year),
    prisma.organization.findUnique({
      where: { id: organizationId },
      select: { calendarYearStartMonth: true, calendarYearStartDay: true },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { lswWorkDaysPerWeek: true },
    }),
    getDepartments(organizationId),
    getDailyTasks(userId, weekNumber, year),
    getTodoItems(userId, weekNumber, year),
    getFrequencyTasks(userId, weekNumber, year),
    getProjects(userId),
    getMeetingRails(userId, weekNumber, year),
    getFollowUps(userId),
    getKeyResultSets(userId, organizationId),
    getPersonalGoals(userId),
    getRcaTriggers(userId, organizationId),
    getStylePresets(organizationId),
  ]);

  return {
    board,
    calendarConfig: calendarConfig ?? { calendarYearStartMonth: 1, calendarYearStartDay: 1 },
    userPreferences: { workDaysPerWeek: userPrefs?.lswWorkDaysPerWeek ?? 5 },
    departments,
    dailyTasks,
    todoItems,
    frequencyTasks,
    projects,
    meetingRails,
    followUps,
    keyResultSets,
    personalGoals,
    rcaTriggers,
    stylePresets,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// User LSW Preferences
// ─────────────────────────────────────────────────────────────────────────────
export async function updateWorkDaysPerWeek(userId: string, workDaysPerWeek: number) {
  const clamped = Math.max(5, Math.min(7, workDaysPerWeek));
  return prisma.user.update({
    where: { id: userId },
    data: { lswWorkDaysPerWeek: clamped },
    select: { lswWorkDaysPerWeek: true },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Early Completion Logs
// ─────────────────────────────────────────────────────────────────────────────
export async function createEarlyCompletionLog(data: {
  userId: string;
  organizationId: string;
  dailyTaskId: string;
  taskName: string;
  taskTime: string;
  dayKey: string;
  dayLabel: string;
  weekNumber: number;
  year: number;
  scheduledDate: string; // ISO date string
}) {
  return prisma.lswEarlyCompletionLog.create({
    data: {
      userId: data.userId,
      organizationId: data.organizationId,
      dailyTaskId: data.dailyTaskId,
      taskName: data.taskName,
      taskTime: data.taskTime,
      dayKey: data.dayKey,
      dayLabel: data.dayLabel,
      weekNumber: data.weekNumber,
      year: data.year,
      scheduledDate: new Date(data.scheduledDate),
    },
  });
}

export async function getEarlyCompletionLogs(userId: string, weekNumber?: number, year?: number) {
  const where: any = { userId };
  if (weekNumber !== undefined && year !== undefined) {
    where.weekNumber = weekNumber;
    where.year = year;
  }
  return prisma.lswEarlyCompletionLog.findMany({
    where,
    orderBy: { completedAt: 'desc' },
    take: 500,
  });
}

export async function deleteEarlyCompletionLog(userId: string, dailyTaskId: string, dayKey: string, weekNumber: number, year: number) {
  return prisma.lswEarlyCompletionLog.deleteMany({
    where: { userId, dailyTaskId, dayKey, weekNumber, year },
  });
}

export default {
  getOrCreateBoard, updateBoard,
  getDepartments,
  getDailyTasks, createDailyTask, updateDailyTask, deleteDailyTask, upsertDailyTaskCompletion,
  getTodoItems, createTodoItem, updateTodoItem, deleteTodoItem,
  getFrequencyTasks, createFrequencyTask, updateFrequencyTask, deleteFrequencyTask, computePeriodKey,
  getProjects, createProject, updateProject, deleteProject,
  addProjectUpdate, updateProjectUpdate, deleteProjectUpdate,
  getMeetingRails, createMeetingRail, updateMeetingRail, deleteMeetingRail,
  getFollowUps, createFollowUp, updateFollowUp, deleteFollowUp,
  getKeyResultSets, createKeyResultSet, updateKeyResultSet, deleteKeyResultSet,
  createKeyResult, updateKeyResult, deleteKeyResult,
  getPersonalGoals, createPersonalGoal, updatePersonalGoal, deletePersonalGoal,
  getRcaTriggers, createRcaTrigger, updateRcaTrigger, deleteRcaTrigger,
  getStylePresets, upsertStylePreset,
  getFullLswData,
  updateWorkDaysPerWeek,
  createEarlyCompletionLog, getEarlyCompletionLogs, deleteEarlyCompletionLog,
};
