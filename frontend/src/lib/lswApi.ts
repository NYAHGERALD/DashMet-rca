/**
 * LSW (Leader Standard Work) API Service
 * All CRUD operations for LSW page sections - no hardcoded data.
 */
import api from './api';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface LswDailyTask {
  id: string;
  task: string;
  minutes: number;
  time: string;
  monday: boolean;
  tuesday: boolean;
  wednesday: boolean;
  thursday: boolean;
  friday: boolean;
  saturday: boolean;
  sunday: boolean;
  sortOrder: number;
}

export interface LswTodoItem {
  id: string;
  task: string;
  completed: boolean;
  completedAt: string | null;
  dueDate: string | null;
  weekNumber: number | null;
  year: number | null;
  sortOrder: number;
}

export interface LswFrequencyTask {
  id: string;
  task: string;
  minutes: number;
  dueDate: string;
  frequency: 'BIWEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY';
  periodKey: string | null;
  sortOrder: number;
}

export interface LswProjectUpdate {
  id: string;
  text: string;
  fontColor: string | null;
  fontItalic: boolean;
  cellColor: string | null;
  cellColorIntensity: number | null;
  sortOrder: number;
}

export interface LswProject {
  id: string;
  name: string;
  updates: LswProjectUpdate[];
  fontColor: string | null;
  fontFamily: string | null;
  fontBold: boolean;
  fontItalic: boolean;
  cellColor: string | null;
  cellColorIntensity: number | null;
  defaultUpdateFontColor: string | null;
  defaultUpdateFontItalic: boolean;
  defaultUpdateCellColor: string | null;
  defaultUpdateCellColorIntensity: number | null;
  sortOrder: number;
}

export interface LswMeetingRail {
  id: string;
  rail: string;
  dueDate: string;
  completed: boolean;
  completedAt: string | null;
  sortOrder: number;
}

export interface LswFollowUp {
  id: string;
  task: string;
  dueDate: string;
  responsibleUserId: string | null;
  responsibleName: string | null;
  responsibleUser: { id: string; firstName: string; lastName: string; email: string } | null;
  comments: string | null;
  completed: boolean;
  sortOrder: number;
}

export interface LswKeyResult {
  id: string;
  metric: string;
  value: string;
  target: string | null;
  trend: 'UP' | 'DOWN' | 'STABLE' | null;
  sortOrder: number;
}

export interface LswKeyResultSet {
  id: string;
  name: string;
  scope: 'PLANT' | 'CORPORATE' | 'DEPARTMENT' | 'CUSTOM';
  description: string | null;
  icon: string | null;
  keyResults: LswKeyResult[];
  sortOrder: number;
}

export interface LswPersonalGoal {
  id: string;
  objective: string;
  dueDate: string;
  progress: number;
  sortOrder: number;
}

export interface LswRcaTrigger {
  id: string;
  trigger: string;
  eventDate: string | null;
  comments: string | null;
  sortOrder: number;
}

export interface LswDepartment {
  id: string;
  name: string;
  description: string | null;
  facilityId: string;
}

export interface LswBoard {
  id: string;
  weekNumber: number;
  year: number;
  todoTab: string | null;
}

export interface LswStylePreset {
  id: string;
  name: string;
  category: string;
  context: string;
  values: any;
  isDefault: boolean;
}

export interface LswCalendarConfig {
  calendarYearStartMonth: number; // 1-12
  calendarYearStartDay: number;   // 1-31
}

export interface LswUserPreferences {
  workDaysPerWeek: number; // 5, 6, or 7
}

export interface LswFullData {
  board: LswBoard;
  calendarConfig: LswCalendarConfig;
  userPreferences: LswUserPreferences;
  departments: LswDepartment[];
  dailyTasks: LswDailyTask[];
  todoItems: LswTodoItem[];
  frequencyTasks: LswFrequencyTask[];
  projects: LswProject[];
  meetingRails: LswMeetingRail[];
  followUps: LswFollowUp[];
  keyResultSets: LswKeyResultSet[];
  personalGoals: LswPersonalGoal[];
  rcaTriggers: LswRcaTrigger[];
  stylePresets: LswStylePreset[];
}

// ─── API Calls ────────────────────────────────────────────────────────────────

/** Bulk fetch all LSW data for a given week */
export async function fetchLswData(weekNumber: number, year: number): Promise<LswFullData> {
  const res = await api.get('/lsw/data', {
    params: { weekNumber, year, _: Date.now() },
  });
  return res.data.data;
}

// Board
export async function updateLswBoard(weekNumber: number, year: number, data: Partial<LswBoard>) {
  const res = await api.put('/lsw/board', { weekNumber, year, ...data });
  return res.data.data;
}

// User Preferences
export async function updateLswWorkDaysPerWeek(workDaysPerWeek: number) {
  const res = await api.put('/lsw/preferences/work-days', { workDaysPerWeek });
  return res.data.data;
}

// Departments (read-only – uses real Department table)
export async function fetchLswDepartments(facilityId?: string) {
  const res = await api.get('/lsw/departments', { params: facilityId ? { facilityId } : {} });
  return res.data.data as LswDepartment[];
}

// Daily Tasks
export async function createLswDailyTask(data: {
  task: string; minutes?: number; time: string;
  monday?: boolean; tuesday?: boolean; wednesday?: boolean;
  thursday?: boolean; friday?: boolean; saturday?: boolean; sunday?: boolean;
}) {
  const res = await api.post('/lsw/daily-tasks', data);
  return res.data.data as LswDailyTask;
}

export async function updateLswDailyTask(id: string, data: Partial<LswDailyTask>) {
  const res = await api.put(`/lsw/daily-tasks/${id}`, data);
  return res.data.data as LswDailyTask;
}

export async function deleteLswDailyTask(id: string) {
  await api.delete(`/lsw/daily-tasks/${id}`);
}

export async function updateLswDailyTaskCompletion(id: string, weekNumber: number, year: number, day: string, value: boolean) {
  const res = await api.put(`/lsw/daily-tasks/${id}/completion`, { weekNumber, year, day, value });
  return res.data.data;
}

// Todo Items
export async function createLswTodoItem(data: {
  task: string; dueDate?: string; weekNumber?: number; year?: number;
}) {
  const res = await api.post('/lsw/todo-items', data);
  return res.data.data as LswTodoItem;
}

export async function updateLswTodoItem(id: string, data: Partial<LswTodoItem>) {
  const res = await api.put(`/lsw/todo-items/${id}`, data);
  return res.data.data as LswTodoItem;
}

export async function deleteLswTodoItem(id: string) {
  await api.delete(`/lsw/todo-items/${id}`);
}

// Frequency Tasks
export async function createLswFrequencyTask(data: {
  task: string; minutes?: number; dueDate: string;
  frequency: 'BIWEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY';
  weekNumber?: number; year?: number;
}) {
  const res = await api.post('/lsw/frequency-tasks', data);
  return res.data.data as LswFrequencyTask;
}

export async function updateLswFrequencyTask(id: string, data: Partial<LswFrequencyTask>) {
  const res = await api.put(`/lsw/frequency-tasks/${id}`, data);
  return res.data.data as LswFrequencyTask;
}

export async function deleteLswFrequencyTask(id: string) {
  await api.delete(`/lsw/frequency-tasks/${id}`);
}

// Projects
export async function createLswProject(data: {
  name: string;
  initialUpdateText?: string;
  fontColor?: string; fontFamily?: string; fontBold?: boolean; fontItalic?: boolean;
  cellColor?: string; cellColorIntensity?: number;
  defaultUpdateFontColor?: string; defaultUpdateFontItalic?: boolean;
  defaultUpdateCellColor?: string; defaultUpdateCellColorIntensity?: number;
}) {
  const res = await api.post('/lsw/projects', data);
  return res.data.data as LswProject;
}

export async function updateLswProject(id: string, data: Partial<LswProject>) {
  const res = await api.put(`/lsw/projects/${id}`, data);
  return res.data.data as LswProject;
}

export async function deleteLswProject(id: string) {
  await api.delete(`/lsw/projects/${id}`);
}

// Project Updates
export async function addLswProjectUpdate(projectId: string, data: {
  text?: string; fontColor?: string; fontItalic?: boolean;
  cellColor?: string; cellColorIntensity?: number;
}) {
  const res = await api.post(`/lsw/projects/${projectId}/updates`, data);
  return res.data.data as LswProjectUpdate;
}

export async function updateLswProjectUpdate(updateId: string, data: Partial<LswProjectUpdate>) {
  const res = await api.put(`/lsw/project-updates/${updateId}`, data);
  return res.data.data as LswProjectUpdate;
}

export async function deleteLswProjectUpdate(updateId: string) {
  await api.delete(`/lsw/project-updates/${updateId}`);
}

// Meeting Rails
export async function createLswMeetingRail(data: { rail: string; dueDate: string; weekNumber?: number; year?: number }) {
  const res = await api.post('/lsw/meeting-rails', data);
  return res.data.data as LswMeetingRail;
}

export async function updateLswMeetingRail(id: string, data: Partial<LswMeetingRail>) {
  const res = await api.put(`/lsw/meeting-rails/${id}`, data);
  return res.data.data as LswMeetingRail;
}

export async function deleteLswMeetingRail(id: string) {
  await api.delete(`/lsw/meeting-rails/${id}`);
}

// Follow Ups
export async function createLswFollowUp(data: {
  task: string; dueDate: string; responsibleName?: string;
  responsibleUserId?: string; comments?: string;
}) {
  const res = await api.post('/lsw/follow-ups', data);
  return res.data.data as LswFollowUp;
}

export async function updateLswFollowUp(id: string, data: Partial<LswFollowUp>) {
  const res = await api.put(`/lsw/follow-ups/${id}`, data);
  return res.data.data as LswFollowUp;
}

export async function deleteLswFollowUp(id: string) {
  await api.delete(`/lsw/follow-ups/${id}`);
}

// Key Result Sets
export async function createLswKeyResultSet(data: {
  name: string; scope?: 'PLANT' | 'CORPORATE' | 'DEPARTMENT' | 'CUSTOM';
  description?: string; icon?: string;
}) {
  const res = await api.post('/lsw/key-result-sets', data);
  return res.data.data as LswKeyResultSet;
}

export async function updateLswKeyResultSet(id: string, data: Partial<LswKeyResultSet>) {
  const res = await api.put(`/lsw/key-result-sets/${id}`, data);
  return res.data.data as LswKeyResultSet;
}

export async function deleteLswKeyResultSet(id: string) {
  await api.delete(`/lsw/key-result-sets/${id}`);
}

// Key Results (individual metrics within a set)
export async function createLswKeyResult(data: {
  keyResultSetId: string; metric: string; value: string;
  target?: string; trend?: 'UP' | 'DOWN' | 'STABLE';
}) {
  const res = await api.post('/lsw/key-results', data);
  return res.data.data as LswKeyResult;
}

export async function updateLswKeyResult(id: string, data: Partial<LswKeyResult>) {
  const res = await api.put(`/lsw/key-results/${id}`, data);
  return res.data.data as LswKeyResult;
}

export async function deleteLswKeyResult(id: string) {
  await api.delete(`/lsw/key-results/${id}`);
}

// Personal Goals
export async function createLswPersonalGoal(data: { objective: string; dueDate: string; progress?: number }) {
  const res = await api.post('/lsw/personal-goals', data);
  return res.data.data as LswPersonalGoal;
}

export async function updateLswPersonalGoal(id: string, data: Partial<LswPersonalGoal>) {
  const res = await api.put(`/lsw/personal-goals/${id}`, data);
  return res.data.data as LswPersonalGoal;
}

export async function deleteLswPersonalGoal(id: string) {
  await api.delete(`/lsw/personal-goals/${id}`);
}

// RCA Triggers
export async function createLswRcaTrigger(data: { trigger: string; eventDate?: string; comments?: string }) {
  const res = await api.post('/lsw/rca-triggers', data);
  return res.data.data as LswRcaTrigger;
}

export async function updateLswRcaTrigger(id: string, data: Partial<LswRcaTrigger>) {
  const res = await api.put(`/lsw/rca-triggers/${id}`, data);
  return res.data.data as LswRcaTrigger;
}

export async function deleteLswRcaTrigger(id: string) {
  await api.delete(`/lsw/rca-triggers/${id}`);
}

// Style Presets
export async function fetchLswStylePresets() {
  const res = await api.get('/lsw/style-presets');
  return res.data.data as LswStylePreset[];
}

// Calendar Configuration
export async function fetchCalendarConfig(): Promise<LswCalendarConfig> {
  const res = await api.get('/organizations/calendar-config');
  return res.data.data;
}

export async function updateCalendarConfig(data: Partial<LswCalendarConfig>): Promise<LswCalendarConfig> {
  const res = await api.patch('/organizations/calendar-config', data);
  return res.data.data;
}

export async function upsertLswStylePreset(data: { name: string; category: string; context: string; values: any; isDefault?: boolean }) {
  const res = await api.post('/lsw/style-presets', data);
  return res.data.data as LswStylePreset;
}

// ─── Early Completion Logs ──────────────────────────────────────────────────
export interface LswEarlyCompletionLog {
  id: string;
  dailyTaskId: string;
  taskName: string;
  taskTime: string;
  dayKey: string;
  dayLabel: string;
  weekNumber: number;
  year: number;
  scheduledDate: string;
  completedAt: string;
  createdAt: string;
}

export async function createLswEarlyCompletionLog(data: {
  dailyTaskId: string;
  taskName: string;
  taskTime: string;
  dayKey: string;
  dayLabel: string;
  weekNumber: number;
  year: number;
  scheduledDate: string;
}): Promise<LswEarlyCompletionLog> {
  const res = await api.post('/lsw/early-completion-logs', data);
  return res.data.data;
}

export async function getLswEarlyCompletionLogs(weekNumber?: number, year?: number): Promise<LswEarlyCompletionLog[]> {
  const params = new URLSearchParams();
  if (weekNumber !== undefined) params.append('weekNumber', String(weekNumber));
  if (year !== undefined) params.append('year', String(year));
  const res = await api.get(`/lsw/early-completion-logs?${params.toString()}`);
  return res.data.data;
}

export async function deleteLswEarlyCompletionLog(dailyTaskId: string, dayKey: string, weekNumber: number, year: number): Promise<void> {
  await api.delete('/lsw/early-completion-logs', { data: { dailyTaskId, dayKey, weekNumber, year } });
}

// ─── Export ───────────────────────────────────────────────────────────────────

export async function exportLswReport(weekNumber: number, year: number, weekStart: string, department?: string): Promise<Blob> {
  const res = await api.get('/lsw/export', {
    params: { weekNumber, year, weekStart, department },
    responseType: 'blob',
  });
  return res.data;
}
