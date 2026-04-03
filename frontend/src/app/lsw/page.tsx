'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { useWebSocket } from '@/lib/websocket';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import Link from 'next/link';
import {
  fetchLswData, updateLswBoard,
  createLswDailyTask, updateLswDailyTask, deleteLswDailyTask, updateLswDailyTaskCompletion,
  createLswTodoItem, updateLswTodoItem, deleteLswTodoItem,
  createLswFrequencyTask, updateLswFrequencyTask, deleteLswFrequencyTask,
  createLswProject, updateLswProject, deleteLswProject,
  addLswProjectUpdate, updateLswProjectUpdate, deleteLswProjectUpdate,
  createLswMeetingRail, updateLswMeetingRail, deleteLswMeetingRail,
  createLswFollowUp, updateLswFollowUp, deleteLswFollowUp,
  createLswPersonalGoal, updateLswPersonalGoal, deleteLswPersonalGoal,
  createLswRcaTrigger, updateLswRcaTrigger, deleteLswRcaTrigger,
  updateLswWorkDaysPerWeek,
  createLswEarlyCompletionLog, getLswEarlyCompletionLogs, deleteLswEarlyCompletionLog,
  type LswDailyTask, type LswTodoItem, type LswFrequencyTask, type LswEarlyCompletionLog,
  type LswProject, type LswProjectUpdate, type LswMeetingRail,
  type LswFollowUp, type LswKeyResultSet, type LswKeyResult,
  type LswPersonalGoal, type LswRcaTrigger, type LswDepartment,
  type LswCalendarConfig,
} from '@/lib/lswApi';

// Types (mapped from DB models for UI convenience)
interface DailyTask {
  id: string;
  task: string;
  minutes: number;
  time: string;
  days: { M: boolean; T: boolean; W: boolean; H: boolean; F: boolean; S1: boolean; S2: boolean };
}

interface ToDoItem {
  id: string;
  task: string;
  completed: boolean;
  dueDate?: string;
}

interface FrequencyTask {
  id: string;
  task: string;
  minutes: number;
  dueDate: string;
  frequency: 'biweekly' | 'monthly' | 'quarterly' | 'annually';
}

interface UpdateItem {
  id?: string;
  text: string;
  fontColor?: string;
  fontItalic?: boolean;
  cellColor?: string;
  cellColorIntensity?: number;
}

interface Project {
  id: string;
  name: string;
  updates: UpdateItem[];
  fontColor?: string;
  fontFamily?: string;
  fontBold?: boolean;
  fontItalic?: boolean;
  cellColor?: string;
  cellColorIntensity?: number;
  defaultUpdateFontColor?: string;
  defaultUpdateFontItalic?: boolean;
  defaultUpdateCellColor?: string;
  defaultUpdateCellColorIntensity?: number;
}

interface MeetingRail {
  id: string;
  rail: string;
  dueDate: string;
  completed: boolean;
}

interface FollowUp {
  id: string;
  task: string;
  dueDate: string;
  responsible: string;
  comments: string;
}

interface KeyResult {
  id?: string;
  metric: string;
  value: string;
  target?: string;
  trend?: 'up' | 'down' | 'stable';
}

interface KeyResultGroup {
  id: string;
  name: string;
  scope: string;
  description?: string;
  icon?: string;
  keyResults: KeyResult[];
}

interface PersonalGoal {
  id: string;
  objective: string;
  dueDate: string;
  progress: number;
}

interface RCATrigger {
  id: string;
  trigger: string;
  eventDate: string;
  comments: string;
}

// ─── DB → UI Mappers ─────────────────────────────────────────────────────────
const FREQ_DB_TO_UI: Record<string, 'biweekly' | 'monthly' | 'quarterly' | 'annually'> = {
  BIWEEKLY: 'biweekly', MONTHLY: 'monthly', QUARTERLY: 'quarterly', ANNUALLY: 'annually',
};
const FREQ_UI_TO_DB: Record<string, 'BIWEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY'> = {
  biweekly: 'BIWEEKLY', monthly: 'MONTHLY', quarterly: 'QUARTERLY', annually: 'ANNUALLY',
};
const TREND_DB_TO_UI: Record<string, 'up' | 'down' | 'stable'> = {
  UP: 'up', DOWN: 'down', STABLE: 'stable',
};

function mapDailyTaskFromDb(t: LswDailyTask): DailyTask {
  return {
    id: t.id,
    task: t.task,
    minutes: t.minutes,
    time: t.time,
    days: { M: t.monday, T: t.tuesday, W: t.wednesday, H: t.thursday, F: t.friday, S1: t.saturday, S2: t.sunday },
  };
}

const DAY_KEY_TO_DB: Record<string, string> = { M: 'monday', T: 'tuesday', W: 'wednesday', H: 'thursday', F: 'friday', S1: 'saturday', S2: 'sunday' };

function mapFreqTaskFromDb(t: LswFrequencyTask): FrequencyTask {
  return { id: t.id, task: t.task, minutes: t.minutes, dueDate: t.dueDate.split('T')[0], frequency: FREQ_DB_TO_UI[t.frequency] || 'monthly' };
}

function mapProjectFromDb(p: LswProject): Project {
  return {
    id: p.id, name: p.name,
    updates: p.updates.map((u: LswProjectUpdate) => ({ id: u.id, text: u.text, fontColor: u.fontColor ?? undefined, fontItalic: u.fontItalic || undefined, cellColor: u.cellColor ?? undefined, cellColorIntensity: u.cellColorIntensity ?? undefined })),
    fontColor: p.fontColor ?? undefined, fontFamily: p.fontFamily ?? undefined,
    fontBold: p.fontBold || undefined, fontItalic: p.fontItalic || undefined,
    cellColor: p.cellColor ?? undefined, cellColorIntensity: p.cellColorIntensity ?? undefined,
    defaultUpdateFontColor: p.defaultUpdateFontColor ?? undefined, defaultUpdateFontItalic: p.defaultUpdateFontItalic || undefined,
    defaultUpdateCellColor: p.defaultUpdateCellColor ?? undefined, defaultUpdateCellColorIntensity: p.defaultUpdateCellColorIntensity ?? undefined,
  };
}

function mapMeetingRailFromDb(r: LswMeetingRail): MeetingRail {
  return { id: r.id, rail: r.rail, dueDate: r.dueDate.split('T')[0], completed: r.completed };
}

function mapFollowUpFromDb(f: LswFollowUp): FollowUp {
  const name = f.responsibleName || (f.responsibleUser ? `${f.responsibleUser.firstName} ${f.responsibleUser.lastName}` : '');
  return { id: f.id, task: f.task, dueDate: f.dueDate.split('T')[0], responsible: name, comments: f.comments || '' };
}

function mapKeyResultSetFromDb(s: LswKeyResultSet): KeyResultGroup {
  return {
    id: s.id, name: s.name, scope: s.scope, description: s.description ?? undefined, icon: s.icon ?? undefined,
    keyResults: s.keyResults.map((kr: LswKeyResult) => ({ id: kr.id, metric: kr.metric, value: kr.value, target: kr.target ?? undefined, trend: kr.trend ? TREND_DB_TO_UI[kr.trend] : undefined })),
  };
}

function mapGoalFromDb(g: LswPersonalGoal): PersonalGoal {
  return { id: g.id, objective: g.objective, dueDate: g.dueDate.split('T')[0], progress: g.progress };
}

function mapTriggerFromDb(t: LswRcaTrigger): RCATrigger {
  return { id: t.id, trigger: t.trigger, eventDate: t.eventDate ? t.eventDate.split('T')[0] : '', comments: t.comments || '' };
}

function mapTodoFromDb(t: LswTodoItem): ToDoItem {
  return { id: t.id, task: t.task, completed: t.completed, dueDate: t.dueDate ?? undefined };
}

function mapDepartmentFromDb(d: LswDepartment): { id: string; name: string } {
  return { id: d.id, name: d.name };
}

// ─── Org-Aware Week Calculation ────────────────────────────────────────────
// Computes the org-relative "year start" for a given reference date
function getOrgYearStart(config: LswCalendarConfig, refDate: Date): Date {
  const { calendarYearStartMonth: m, calendarYearStartDay: d } = config;
  let yearCandidate = refDate.getFullYear();
  const candidate = new Date(yearCandidate, m - 1, d);
  if (refDate < candidate) {
    yearCandidate -= 1;
  }
  return new Date(yearCandidate, m - 1, d);
}

// Get week number relative to the org calendar year start
function getWeekNumber(date: Date, config?: LswCalendarConfig): number {
  if (!config || (config.calendarYearStartMonth === 1 && config.calendarYearStartDay === 1)) {
    // Default: ISO week calculation
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  }
  const start = getOrgYearStart(config, date);
  const diffMs = date.getTime() - start.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  return Math.floor(diffDays / 7) + 1;
}

// Get the org-relative year label (the year of the cycle start)
function getOrgYear(date: Date, config?: LswCalendarConfig): number {
  if (!config || (config.calendarYearStartMonth === 1 && config.calendarYearStartDay === 1)) {
    return date.getFullYear();
  }
  return getOrgYearStart(config, date).getFullYear();
}

// Helper to get day of week
function getDayOfWeek(): string {
  const days = ['S2', 'M', 'T', 'W', 'H', 'F', 'S1'];
  return days[new Date().getDay()];
}

// Helper to get week start and end dates (org-calendar-aware)
function getWeekDates(weekNumber: number, year: number, config?: LswCalendarConfig): { start: Date; end: Date } {
  if (!config || (config.calendarYearStartMonth === 1 && config.calendarYearStartDay === 1)) {
    // Default: ISO-style calculation
    const simple = new Date(year, 0, 1 + (weekNumber - 1) * 7);
    const dow = simple.getDay();
    const start = new Date(simple);
    if (dow <= 4) {
      start.setDate(simple.getDate() - simple.getDay() + 1);
    } else {
      start.setDate(simple.getDate() + 8 - simple.getDay());
    }
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { start, end };
  }
  // Org calendar: year here is the cycle start year
  const cycleStart = new Date(year, config.calendarYearStartMonth - 1, config.calendarYearStartDay);
  const start = new Date(cycleStart);
  start.setDate(cycleStart.getDate() + (weekNumber - 1) * 7);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start, end };
}

// Format date as "Feb 17, 2026"
function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Get today's display string like "Wednesday, 18"
function getTodayDisplay(): string {
  const now = new Date();
  const dayName = now.toLocaleDateString('en-US', { weekday: 'long' });
  const dayNum = now.getDate();
  return `${dayName}, ${dayNum}`;
}

// Get week offset text (e.g., "Last week", "2 weeks ago", "Next week", etc.)
function getWeekOffsetText(selectedWeek: number, selectedYear: number, config?: LswCalendarConfig): { text: string; type: 'past' | 'future' | 'current' } | null {
  const now = new Date();
  const currentWeekNum = getWeekNumber(now, config);
  const currentYearNum = config ? getOrgYear(now, config) : now.getFullYear();
  
  // Calculate total week difference
  const yearDiff = currentYearNum - selectedYear;
  const weekDiff = (yearDiff * 52) + (currentWeekNum - selectedWeek);
  
  if (weekDiff === 0) {
    return null; // Current week, no badge needed
  } else if (weekDiff === 1) {
    return { text: 'Last week', type: 'past' };
  } else if (weekDiff === 2) {
    return { text: '2 weeks ago', type: 'past' };
  } else if (weekDiff === 3) {
    return { text: '3 weeks ago', type: 'past' };
  } else if (weekDiff > 3) {
    return { text: `${weekDiff} weeks ago`, type: 'past' };
  } else if (weekDiff === -1) {
    return { text: 'Next week', type: 'future' };
  } else if (weekDiff === -2) {
    return { text: 'In 2 weeks', type: 'future' };
  } else if (weekDiff < -2) {
    return { text: `In ${Math.abs(weekDiff)} weeks`, type: 'future' };
  }
  return null;
}

// Departments loaded from the database (see useEffect below)

function LSWContent() {
  const { user } = useAuth();
  const { onLswCompletionChanged } = useWebSocket();
  const [calendarConfig, setCalendarConfig] = useState<LswCalendarConfig>({ calendarYearStartMonth: 1, calendarYearStartDay: 1 });
  const [workDaysPerWeek, setWorkDaysPerWeek] = useState<number>(5);
  const [currentWeek, setCurrentWeek] = useState(getWeekNumber(new Date()));
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [configReady, setConfigReady] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [editingWeek, setEditingWeek] = useState(false);
  const [weekInputValue, setWeekInputValue] = useState('');
  const weekInputRef = useRef<HTMLInputElement>(null);
  const [showOverdueModal, setShowOverdueModal] = useState(false);
  const [showFutureBlockModal, setShowFutureBlockModal] = useState(false);
  const [futureBlockContext, setFutureBlockContext] = useState<{ taskId: string; taskName: string; taskTime: string; day: keyof DailyTask['days']; dayLabel: string; scheduledDate: string } | null>(null);
  const [earlyCompletionLogs, setEarlyCompletionLogs] = useState<LswEarlyCompletionLog[]>([]);
  const [showUncheckModal, setShowUncheckModal] = useState(false);
  const [uncheckContext, setUncheckContext] = useState<{ taskId: string; taskName: string; day: keyof DailyTask['days']; dayLabel: string; isEarlyCompleted: boolean } | null>(null);
  const [showEarlyLogModal, setShowEarlyLogModal] = useState(false);
  // Early Log modal filter/sort state
  const [earlyLogFilters, setEarlyLogFilters] = useState<{ field: string; value: string }[]>([]);
  const [earlyLogSort, setEarlyLogSort] = useState<{ field: string; dir: 'asc' | 'desc' }>({ field: 'completedAt', dir: 'desc' });
  const [earlyLogContextMenu, setEarlyLogContextMenu] = useState<{ x: number; y: number; field: string; value?: string } | null>(null);
  const [earlyLogShowFilterRow, setEarlyLogShowFilterRow] = useState(false);
  const [earlyLogNewFilter, setEarlyLogNewFilter] = useState<{ field: string; value: string }>({ field: 'taskName', value: '' });
  const [earlyLogFilterPanelOpen, setEarlyLogFilterPanelOpen] = useState(false);
  const [earlyLogDuplicateMsg, setEarlyLogDuplicateMsg] = useState<string | null>(null);
  const today = getDayOfWeek();
  
  // Data loading state
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  
  // Get week start and end dates
  const weekDates = getWeekDates(currentWeek, currentYear, calendarConfig);
  
  // Get week offset indicator
  const weekOffset = getWeekOffsetText(currentWeek, currentYear, calendarConfig);

  // Modal states
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ projectId: string; updateIndex: number } | null>(null);
  const [showAddProjectModal, setShowAddProjectModal] = useState(false);
  const [todoTab, setTodoTab] = useState<'today' | 'thisWeek'>('today');
  
  // Context menu states
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    type: 'project' | 'update';
    projectId: string;
    updateIndex?: number;
  } | null>(null);
  const [showFormatProjectModal, setShowFormatProjectModal] = useState(false);
  const [showFormatUpdateModal, setShowFormatUpdateModal] = useState(false);
  const [showDeleteProjectModal, setShowDeleteProjectModal] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedUpdateIndex, setSelectedUpdateIndex] = useState<number | null>(null);
  const [showAddFollowUpModal, setShowAddFollowUpModal] = useState(false);
  const [newFollowUp, setNewFollowUp] = useState({
    task: '',
    dueDate: new Date().toISOString().split('T')[0],
    responsible: '',
    comments: ''
  });
  const [showAddTriggerModal, setShowAddTriggerModal] = useState(false);
  const [newTrigger, setNewTrigger] = useState({
    trigger: '',
    eventDate: '',
    comments: ''
  });
  const [showAddTodoModal, setShowAddTodoModal] = useState(false);
  const [newTodoItem, setNewTodoItem] = useState({
    task: '',
    dueDate: ''
  });
  const [showAddMeetingRailModal, setShowAddMeetingRailModal] = useState(false);
  const [newMeetingRail, setNewMeetingRail] = useState({
    rail: '',
    dueDate: new Date().toISOString().split('T')[0]
  });
  const [showAddScheduledTaskModal, setShowAddScheduledTaskModal] = useState(false);
  const [newScheduledTask, setNewScheduledTask] = useState({
    task: '',
    minutes: 60,
    dueDate: new Date().toISOString().split('T')[0],
    frequency: 'biweekly' as 'biweekly' | 'monthly' | 'quarterly' | 'annually'
  });
  const [showAddGoalModal, setShowAddGoalModal] = useState(false);
  const [newGoal, setNewGoal] = useState({
    objective: '',
    dueDate: '',
    progress: 0
  });
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  
  // Live clock state
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Update clock every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);
  
  const [newProject, setNewProject] = useState({
    name: '',
    update: '',
    fontColor: '#1f2937',
    fontFamily: 'Inter',
    fontBold: false,
    fontItalic: false,
    cellColor: '#3b82f6',
    cellColorIntensity: 20,
    // Update column styling
    updateFontColor: '#4b5563',
    updateFontItalic: false,
    updateCellColor: '#10b981',
    updateCellColorIntensity: 10
  });
  const [newTask, setNewTask] = useState({
    task: '',
    minutes: 15,
    time: '08:00',
    days: { M: true, T: true, W: true, H: true, F: true, S1: false, S2: false }
  });

  // Add task handler
  const handleAddTask = async () => {
    if (!newTask.task.trim()) return;
    try {
      const created = await createLswDailyTask({
        task: newTask.task,
        minutes: newTask.minutes,
        time: newTask.time,
        monday: newTask.days.M,
        tuesday: newTask.days.T,
        wednesday: newTask.days.W,
        thursday: newTask.days.H,
        friday: newTask.days.F,
        saturday: newTask.days.S1,
        sunday: newTask.days.S2,
      });
      setDailyTasks(prev => [...prev, mapDailyTaskFromDb(created)]);
      setNewTask({ task: '', minutes: 15, time: '08:00', days: { M: true, T: true, W: true, H: true, F: true, S1: false, S2: false } });
      setShowAddTaskModal(false);
    } catch (e) { console.error('Failed to add daily task:', e); }
  };

  // Add project handler
  const handleAddProject = async () => {
    if (!newProject.name.trim()) return;
    try {
      const created = await createLswProject({
        name: newProject.name,
        initialUpdateText: newProject.update.trim() || '',
        fontColor: newProject.fontColor,
        fontFamily: newProject.fontFamily,
        fontBold: newProject.fontBold,
        fontItalic: newProject.fontItalic,
        cellColor: newProject.cellColor,
        cellColorIntensity: newProject.cellColorIntensity,
        defaultUpdateFontColor: newProject.updateFontColor,
        defaultUpdateFontItalic: newProject.updateFontItalic,
        defaultUpdateCellColor: newProject.updateCellColor,
        defaultUpdateCellColorIntensity: newProject.updateCellColorIntensity,
      });
      setProjects(prev => [...prev, mapProjectFromDb(created)]);
      setNewProject({ 
        name: '', 
        update: '', 
        fontColor: '#1f2937', 
        fontFamily: 'Inter', 
        fontBold: false, 
        fontItalic: false, 
        cellColor: '#3b82f6', 
        cellColorIntensity: 20,
        updateFontColor: '#4b5563',
        updateFontItalic: false,
        updateCellColor: '#10b981',
        updateCellColorIntensity: 10
      });
      setShowAddProjectModal(false);
    } catch (e) { console.error('Failed to add project:', e); }
  };

  // State for all sections (populated from database via useEffect)
  const [dailyTasks, setDailyTasks] = useState<DailyTask[]>([]);
  const [todoItems, setTodoItems] = useState<ToDoItem[]>([]);
  const [frequencyTasks, setFrequencyTasks] = useState<FrequencyTask[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);

  const addProjectUpdate = async (projectId: string) => {
    try {
      const project = projects.find(p => p.id === projectId);
      const created = await addLswProjectUpdate(projectId, {
        text: '',
        fontColor: project?.defaultUpdateFontColor,
        fontItalic: project?.defaultUpdateFontItalic,
        cellColor: project?.defaultUpdateCellColor,
        cellColorIntensity: project?.defaultUpdateCellColorIntensity,
      });
      setProjects(prev => prev.map(p => 
        p.id === projectId 
          ? { ...p, updates: [...p.updates, { id: created.id, text: created.text, fontColor: created.fontColor ?? undefined, fontItalic: created.fontItalic || undefined, cellColor: created.cellColor ?? undefined, cellColorIntensity: created.cellColorIntensity ?? undefined }] }
          : p
      ));
    } catch (e) { console.error('Failed to add project update:', e); }
  };

  const updateProjectUpdate = async (projectId: string, updateIndex: number, value: string) => {
    const project = projects.find(p => p.id === projectId);
    const update = project?.updates[updateIndex];
    // Optimistic update
    setProjects(prev => prev.map(p => 
      p.id === projectId 
        ? { ...p, updates: p.updates.map((u, i) => i === updateIndex ? { ...u, text: value } : u) }
        : p
    ));
    if (update?.id) {
      try { await updateLswProjectUpdate(update.id, { text: value }); } catch (e) { console.error('Failed to update project update:', e); }
    }
  };

  const removeProjectUpdate = async (projectId: string, updateIndex: number) => {
    const project = projects.find(p => p.id === projectId);
    const update = project?.updates[updateIndex];
    setProjects(prev => prev.map(p => 
      p.id === projectId 
        ? { ...p, updates: p.updates.filter((_, i) => i !== updateIndex) }
        : p
    ));
    setShowDeleteModal(false);
    setDeleteTarget(null);
    if (update?.id) {
      try { await deleteLswProjectUpdate(update.id); } catch (e) { console.error('Failed to delete project update:', e); }
    }
  };

  const handleDeleteClick = (projectId: string, updateIndex: number) => {
    // Find the project and check if the update is empty
    const project = projects.find(p => p.id === projectId);
    if (project && project.updates[updateIndex].text === '') {
      // Empty field - delete directly without warning
      removeProjectUpdate(projectId, updateIndex);
    } else {
      // Has content - show warning modal
      setDeleteTarget({ projectId, updateIndex });
      setShowDeleteModal(true);
    }
  };

  // Context menu handlers
  const handleProjectContextMenu = (e: React.MouseEvent, projectId: string) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      type: 'project',
      projectId
    });
  };

  const handleUpdateContextMenu = (e: React.MouseEvent, projectId: string, updateIndex: number) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      type: 'update',
      projectId,
      updateIndex
    });
  };

  const closeContextMenu = () => {
    setContextMenu(null);
  };

  const handleFormatProject = () => {
    if (contextMenu) {
      setSelectedProjectId(contextMenu.projectId);
      setShowFormatProjectModal(true);
    }
    closeContextMenu();
  };

  const handleFormatUpdate = () => {
    if (contextMenu) {
      setSelectedProjectId(contextMenu.projectId);
      setSelectedUpdateIndex(contextMenu.updateIndex ?? 0);
      setShowFormatUpdateModal(true);
    }
    closeContextMenu();
  };

  const handleDeleteProjectClick = () => {
    if (contextMenu) {
      setSelectedProjectId(contextMenu.projectId);
      setShowDeleteProjectModal(true);
    }
    closeContextMenu();
  };

  const deleteProject = async () => {
    if (selectedProjectId) {
      setProjects(prev => prev.filter(p => p.id !== selectedProjectId));
      try { await deleteLswProject(selectedProjectId); } catch (e) { console.error('Failed to delete project:', e); }
    }
    setShowDeleteProjectModal(false);
    setSelectedProjectId(null);
  };

  const updateProjectStyle = async (projectId: string, updates: Partial<Project>) => {
    setProjects(prev => prev.map(p => 
      p.id === projectId ? { ...p, ...updates } : p
    ));
    try { await updateLswProject(projectId, updates as any); } catch (e) { console.error('Failed to update project style:', e); }
  };

  const updateIndividualUpdateStyle = async (projectId: string, updateIndex: number, styleUpdates: Partial<UpdateItem>) => {
    const project = projects.find(p => p.id === projectId);
    const update = project?.updates[updateIndex];
    setProjects(prev => prev.map(p => 
      p.id === projectId 
        ? { ...p, updates: p.updates.map((u, i) => i === updateIndex ? { ...u, ...styleUpdates } : u) }
        : p
    ));
    if (update?.id) {
      try { await updateLswProjectUpdate(update.id, styleUpdates as any); } catch (e) { console.error('Failed to update style:', e); }
    }
  };

  const [meetingRails, setMeetingRails] = useState<MeetingRail[]>([]);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [keyResultGroups, setKeyResultGroups] = useState<KeyResultGroup[]>([]);
  const [personalGoals, setPersonalGoals] = useState<PersonalGoal[]>([]);
  const [rcaTriggers, setRcaTriggers] = useState<RCATrigger[]>([]);

  // ─── Data Loading ──────────────────────────────────────────────────────────
  const initialLoad = useRef(true);
  const loadLswData = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await fetchLswData(currentWeek, currentYear);

      // Apply calendar config from org
      if (data.calendarConfig) {
        setCalendarConfig(data.calendarConfig);
        // On first load, recalculate week/year if config is non-default
        if (initialLoad.current) {
          initialLoad.current = false;
          const cfg = data.calendarConfig;
          if (cfg.calendarYearStartMonth !== 1 || cfg.calendarYearStartDay !== 1) {
            const now = new Date();
            const orgWeek = getWeekNumber(now, cfg);
            const orgYear = getOrgYear(now, cfg);
            if (orgWeek !== currentWeek || orgYear !== currentYear) {
              setCurrentWeek(orgWeek);
              setCurrentYear(orgYear);
              setConfigReady(true);
              setIsLoading(false);
              return; // Will re-trigger loadLswData via useEffect
            }
          }
          setConfigReady(true);
        }
      } else if (initialLoad.current) {
        initialLoad.current = false;
        setConfigReady(true);
      }

      // Restore work days per week preference
      if (data.userPreferences?.workDaysPerWeek) {
        setWorkDaysPerWeek(data.userPreferences.workDaysPerWeek);
      }

      setDepartments([{ id: 'all', name: 'All Departments' }, ...data.departments.map(mapDepartmentFromDb)]);
      setDailyTasks(data.dailyTasks.map(mapDailyTaskFromDb));
      setTodoItems(data.todoItems.map(mapTodoFromDb));
      setFrequencyTasks(data.frequencyTasks.map(mapFreqTaskFromDb));
      setProjects(data.projects.map(mapProjectFromDb));
      setMeetingRails(data.meetingRails.map(mapMeetingRailFromDb));
      setFollowUps(data.followUps.map(mapFollowUpFromDb));
      setKeyResultGroups(data.keyResultSets.map(mapKeyResultSetFromDb));
      setPersonalGoals(data.personalGoals.map(mapGoalFromDb));
      setRcaTriggers(data.rcaTriggers.map(mapTriggerFromDb));

      // Load ALL early completion logs (filtering is done in the UI)
      try {
        const logs = await getLswEarlyCompletionLogs();
        setEarlyCompletionLogs(logs);
      } catch (logErr) {
        console.error('Failed to load early completion logs:', logErr);
      }
    } catch (err: any) {
      console.error('Failed to load LSW data:', err);
      setLoadError(err.message || 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  }, [currentWeek, currentYear]);

  useEffect(() => {
    if (user) {
      loadLswData();
    }
  }, [user, loadLswData]);

  // Real-time sync: re-fetch data when another device/tab changes completion state
  useEffect(() => {
    const unsub = onLswCompletionChanged((data: { weekNumber: number; year: number }) => {
      if (data.weekNumber === currentWeek && data.year === currentYear) {
        loadLswData();
      }
    });
    return unsub;
  }, [onLswCompletionChanged, currentWeek, currentYear, loadLswData]);

  // Toggle todo item - API-backed
  const toggleTodo = async (id: string) => {
    const item = todoItems.find(t => t.id === id);
    if (!item) return;
    const newCompleted = !item.completed;
    setTodoItems(items =>
      items.map(it => it.id === id ? { ...it, completed: newCompleted } : it)
    );
    try { await updateLswTodoItem(id, { completed: newCompleted } as any); } catch (e) { console.error('Failed to toggle todo:', e); }
  };

  // Toggle meeting rail - API-backed
  const toggleMeetingRail = async (id: string) => {
    const rail = meetingRails.find(r => r.id === id);
    if (!rail) return;
    const newCompleted = !rail.completed;
    setMeetingRails(rails =>
      rails.map(r => r.id === id ? { ...r, completed: newCompleted } : r)
    );
    try { await updateLswMeetingRail(id, { completed: newCompleted } as any); } catch (e) { console.error('Failed to toggle meeting rail:', e); }
  };

  // Get the visible days based on workDaysPerWeek setting
  const getVisibleDays = (): Array<keyof DailyTask['days']> => {
    const allDays: Array<keyof DailyTask['days']> = ['M', 'T', 'W', 'H', 'F', 'S1', 'S2'];
    return allDays.slice(0, workDaysPerWeek);
  };

  // Day header labels for display
  const dayHeaderMap: Record<string, string> = { M: 'M', T: 'T', W: 'W', H: 'H', F: 'F', S1: 'S', S2: 'S' };
  const dayLabelMap: Record<string, string> = { M: 'Mon', T: 'Tue', W: 'Wed', H: 'Thu', F: 'Fri', S1: 'Sat', S2: 'Sun' };

  // Calculate daily completion percentage (based on actual checkboxes for visible days only)
  const getDailyCompletion = () => {
    if (dailyTasks.length === 0) return 0;
    const visibleDays = getVisibleDays();
    const totalChecks = dailyTasks.length * visibleDays.length;
    if (totalChecks === 0) return 0;
    let completedCount = 0;
    dailyTasks.forEach(task => {
      visibleDays.forEach(day => {
        if (task.days[day]) completedCount++;
      });
    });
    return Math.round((completedCount / totalChecks) * 100);
  };

  // Detect overdue unchecked tasks across all past visible days of the current week
  const getOverdueTasks = () => {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const visibleDays = getVisibleDays();
    const todayIndex = visibleDays.indexOf(today as keyof DailyTask['days']);

    let totalCount = 0;
    const tasks: { taskId: string; task: string; time: string; overdueDays: string[] }[] = [];

    dailyTasks.forEach(task => {
      const [h, m] = task.time.split(':').map(Number);
      const taskMinutes = h * 60 + (m || 0);
      const overdueDays: string[] = [];

      visibleDays.forEach((day, idx) => {
        if (task.days[day]) return; // Already checked
        if (idx < todayIndex) {
          overdueDays.push(dayLabelMap[day]); // Past day this week
        } else if (idx === todayIndex && taskMinutes < currentMinutes) {
          overdueDays.push(dayLabelMap[day]); // Today but time passed
        }
      });

      if (overdueDays.length > 0) {
        totalCount += overdueDays.length;
        tasks.push({ taskId: task.id, task: task.task, time: task.time, overdueDays });
      }
    });

    return { totalCount, tasks };
  };

  // Helper: get the actual Date for a given day key in the current week
  const getDateForDayKey = (dayKey: keyof DailyTask['days']): Date => {
    const dayOrder: Array<keyof DailyTask['days']> = ['M', 'T', 'W', 'H', 'F', 'S1', 'S2'];
    const dayOffset = dayOrder.indexOf(dayKey);
    const d = new Date(weekDates.start);
    d.setDate(d.getDate() + dayOffset);
    return d;
  };

  // Check if a day+time is in the future (cannot be checked off)
  const isDayInFuture = (dayKey: keyof DailyTask['days'], taskTime: string): boolean => {
    const now = new Date();
    const visibleDays = getVisibleDays();
    const todayIndex = visibleDays.indexOf(today as keyof DailyTask['days']);
    const dayIndex = visibleDays.indexOf(dayKey);

    // If viewing a past week, nothing is in the future
    const currentWeekNum = getWeekNumber(now, calendarConfig);
    const currentYearNum = calendarConfig ? getOrgYear(now, calendarConfig) : now.getFullYear();
    if (currentYear < currentYearNum || (currentYear === currentYearNum && currentWeek < currentWeekNum)) {
      return false;
    }
    // If viewing a future week, everything is in the future
    if (currentYear > currentYearNum || (currentYear === currentYearNum && currentWeek > currentWeekNum)) {
      return true;
    }

    // Same week: compare day index and time
    if (dayIndex > todayIndex) return true; // Future day
    if (dayIndex < todayIndex) return false; // Past day
    // Same day: check time
    const [h, m] = taskTime.split(':').map(Number);
    const taskMinutes = h * 60 + (m || 0);
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    return taskMinutes > currentMinutes;
  };

  // Check if a task+day is early-completed
  const isEarlyCompleted = (taskId: string, dayKey: string): boolean => {
    return earlyCompletionLogs.some(log => log.dailyTaskId === taskId && log.dayKey === dayKey && log.weekNumber === currentWeek && log.year === currentYear);
  };

  // Handle checkbox click with future detection
  const handleDayCheckboxClick = (task: DailyTask, day: keyof DailyTask['days']) => {
    const isChecked = task.days[day];
    const earlyDone = isEarlyCompleted(task.id, day as string);

    // If unchecking (already checked or early-completed), show confirmation modal
    if (isChecked || earlyDone) {
      const fullDayNames: Record<string, string> = { M: 'Monday', T: 'Tuesday', W: 'Wednesday', H: 'Thursday', F: 'Friday', S1: 'Saturday', S2: 'Sunday' };
      setUncheckContext({
        taskId: task.id,
        taskName: task.task,
        day,
        dayLabel: fullDayNames[day] || day,
        isEarlyCompleted: earlyDone,
      });
      setShowUncheckModal(true);
      return;
    }

    // If checking and day is in the future, block it
    if (isDayInFuture(day, task.time)) {
      const scheduledDate = getDateForDayKey(day);
      setFutureBlockContext({
        taskId: task.id,
        taskName: task.task,
        taskTime: task.time,
        day,
        dayLabel: dayLabelMap[day],
        scheduledDate: scheduledDate.toISOString(),
      });
      setShowFutureBlockModal(true);
      return;
    }

    // Normal check
    setDailyTasks(tasks =>
      tasks.map(t => t.id === task.id ? { ...t, days: { ...t.days, [day]: true } } : t)
    );
    updateLswDailyTaskCompletion(task.id, currentWeek, currentYear, DAY_KEY_TO_DB[day], true)
      .catch(e => console.error('Failed to update day completion:', e));
  };

  // Handle confirmed uncheck
  const handleConfirmUncheck = () => {
    if (!uncheckContext) return;
    const { taskId, day, isEarlyCompleted: wasEarly } = uncheckContext;
    setDailyTasks(tasks =>
      tasks.map(t => t.id === taskId ? { ...t, days: { ...t.days, [day]: false } } : t)
    );
    updateLswDailyTaskCompletion(taskId, currentWeek, currentYear, DAY_KEY_TO_DB[day], false)
      .catch(e => console.error('Failed to update day completion:', e));
    // If it was early completed, remove from local logs AND database
    if (wasEarly) {
      setEarlyCompletionLogs(prev => prev.filter(log => !(log.dailyTaskId === taskId && log.dayKey === day && log.weekNumber === currentWeek && log.year === currentYear)));
      deleteLswEarlyCompletionLog(taskId, day, currentWeek, currentYear)
        .catch(e => console.error('Failed to delete early completion log:', e));
    }
    setShowUncheckModal(false);
    setUncheckContext(null);
  };

  // Handle early completion
  const handleEarlyComplete = async () => {
    if (!futureBlockContext) return;
    const { taskId, taskName, taskTime, day, dayLabel, scheduledDate } = futureBlockContext;
    // Save to database FIRST — only proceed if successful
    try {
      const log = await createLswEarlyCompletionLog({
        dailyTaskId: taskId,
        taskName,
        taskTime,
        dayKey: day,
        dayLabel,
        weekNumber: currentWeek,
        year: currentYear,
        scheduledDate,
      });
      // DB save succeeded — now check the box and update local state
      setDailyTasks(tasks =>
        tasks.map(t => t.id === taskId ? { ...t, days: { ...t.days, [day]: true } } : t)
      );
      updateLswDailyTaskCompletion(taskId, currentWeek, currentYear, DAY_KEY_TO_DB[day], true)
        .catch(e => console.error('Failed to update day completion:', e));
      setEarlyCompletionLogs(prev => [log, ...prev]);
    } catch (e) {
      console.error('Failed to log early completion:', e);
      alert('Failed to save early completion. Please check your connection and try again.');
      // Do NOT check the box — nothing was saved
    }
    setShowFutureBlockModal(false);
    setFutureBlockContext(null);
  };

  // Calculate todo completion
  const getTodoCompletion = () => {
    if (todoItems.length === 0) return 0;
    const completed = todoItems.filter(item => item.completed).length;
    return Math.round((completed / todoItems.length) * 100);
  };

  if (!user) return null;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 dark:from-gray-900 dark:to-gray-800">
        <div className="flex flex-col items-center justify-center">
          <div className="relative mb-8">
            <div className="absolute inset-0 w-20 h-20 rounded-full border-4 border-purple-200 dark:border-purple-900/50" />
            <div className="w-20 h-20 rounded-full border-4 border-transparent border-t-purple-600 border-r-purple-600 animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <svg className="w-8 h-8 text-purple-600 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
          </div>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Hang tight!</h3>
          <p className="text-gray-500 dark:text-gray-400 text-center max-w-sm">Loading Leader Standard Work...</p>
          <div className="flex items-center gap-1.5 mt-6">
            <div className="w-2 h-2 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-gray-950 dark:via-slate-900 dark:to-indigo-950">
        <div className="text-center max-w-md">
          <div className="text-red-500 text-4xl mb-4">!</div>
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-2">Failed to Load Data</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">{loadError}</p>
          <button onClick={loadLswData} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-gray-950 dark:via-slate-900 dark:to-indigo-950">
      {/* Print styles for landscape orientation */}
      <style jsx global>{`
        @media print {
          @page {
            size: landscape;
            margin: 0.5in;
          }
        }
      `}</style>
      {/* Header - Department & Week Selection */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-white/80 dark:bg-gray-900/80 border-b border-gray-200/50 dark:border-gray-700/50 shadow-sm">
        <div className="px-4 py-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            {/* Left: Department + Today Display */}
            <div className="flex items-center gap-6">
              {/* Department Selector */}
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Department:</label>
                <select
                  value={selectedDepartment}
                  onChange={(e) => setSelectedDepartment(e.target.value)}
                  className="px-4 py-2 text-sm font-medium bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent cursor-pointer min-w-[180px]"
                >
                  {departments.map(dept => (
                    <option key={dept.id} value={dept.id}>{dept.name}</option>
                  ))}
                </select>
              </div>
              
              {/* Today Display */}
              <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500/10 to-indigo-500/10 dark:from-blue-500/20 dark:to-indigo-500/20 rounded-lg border border-blue-200/50 dark:border-blue-500/30">
                <span className="text-lg">📅</span>
                <div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">Today is:</span>
                  <p className="text-sm font-bold text-blue-600 dark:text-blue-400">{getTodayDisplay()}</p>
                </div>
              </div>
              
              {/* Print Report Button */}
              <button
                onClick={() => window.print()}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Print Report
              </button>

              {/* Early Completion Log Button */}
              <button
                onClick={() => setShowEarlyLogModal(true)}
                className="relative flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                title={earlyCompletionLogs.length > 0 ? `${earlyCompletionLogs.length} early completion(s)` : 'Early Completion Log'}
              >
                <svg className="w-5 h-5 text-amber-500 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">Early Completion Log</span>
                {earlyCompletionLogs.length > 0 && (
                  <span className="min-w-[18px] h-[18px] flex items-center justify-center px-1 text-[10px] font-bold text-white bg-amber-500 rounded-full shadow-sm">
                    {earlyCompletionLogs.length}
                  </span>
                )}
              </button>

              {/* Notification Bell */}
              {(() => {
                const overdue = getOverdueTasks();
                return (
                  <button
                    onClick={() => setShowOverdueModal(true)}
                    className="relative p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    title={overdue.totalCount > 0 ? `${overdue.totalCount} overdue task(s)` : 'No overdue tasks'}
                  >
                    <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                    {overdue.totalCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center px-1 text-[10px] font-bold text-white bg-red-500 rounded-full shadow-sm animate-pulse">
                        {overdue.totalCount}
                      </span>
                    )}
                  </button>
                );
              })()}
            </div>
            
            {/* Week Selection with Dates */}
            <div className="flex items-center gap-4">
              {/* Week Navigator */}
              <div className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
                <button
                  onClick={() => {
                    if (currentWeek === 1) {
                      setCurrentYear(y => y - 1);
                      setCurrentWeek(52);
                    } else {
                      setCurrentWeek(w => w - 1);
                    }
                  }}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                {editingWeek ? (
                  <input
                    ref={weekInputRef}
                    type="number"
                    min={1}
                    max={52}
                    value={weekInputValue}
                    onChange={(e) => setWeekInputValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const val = parseInt(weekInputValue);
                        if (val >= 1 && val <= 52) {
                          setCurrentWeek(val);
                        }
                        setEditingWeek(false);
                      } else if (e.key === 'Escape') {
                        setEditingWeek(false);
                      }
                    }}
                    onBlur={() => {
                      const val = parseInt(weekInputValue);
                      if (val >= 1 && val <= 52) {
                        setCurrentWeek(val);
                      }
                      setEditingWeek(false);
                    }}
                    className="w-16 text-sm font-bold text-emerald-600 dark:text-emerald-400 text-center bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-300 dark:border-emerald-700 rounded px-1 py-0.5 outline-none focus:ring-2 focus:ring-emerald-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    autoFocus
                  />
                ) : (
                  <button
                    onClick={() => {
                      setWeekInputValue(String(currentWeek));
                      setEditingWeek(true);
                      setTimeout(() => weekInputRef.current?.select(), 0);
                    }}
                    title="Click to type a week number"
                    className="text-sm font-bold text-emerald-600 dark:text-emerald-400 px-2 min-w-[80px] text-center hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded cursor-pointer transition-colors"
                  >
                    Week {currentWeek}
                  </button>
                )}
                <button
                  onClick={() => {
                    if (currentWeek === 52) {
                      setCurrentYear(y => y + 1);
                      setCurrentWeek(1);
                    } else {
                      setCurrentWeek(w => w + 1);
                    }
                  }}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
              
              {/* Week Beginning */}
              <div className="flex flex-col">
                <span className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Week Beginning</span>
                <span className="text-sm font-semibold text-gray-800 dark:text-white">{formatDate(weekDates.start)}</span>
              </div>
              
              <div className="text-gray-400 dark:text-gray-600">—</div>
              
              {/* Week Ending */}
              <div className="flex flex-col">
                <span className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Week Ending</span>
                <span className="text-sm font-semibold text-gray-800 dark:text-white">{formatDate(weekDates.end)}</span>
              </div>
              
              {/* Week Offset Badge & Current Week Button */}
              {weekOffset ? (
                <>
                  <div className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                    weekOffset.type === 'past' 
                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200 dark:border-amber-700/50'
                      : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-700/50'
                  }`}>
                    {weekOffset.type === 'past' ? '⏪' : '⏩'} {weekOffset.text}
                  </div>
                  <button
                    onClick={() => {
                      const now = new Date();
                      setCurrentWeek(getWeekNumber(now, calendarConfig));
                      setCurrentYear(calendarConfig ? getOrgYear(now, calendarConfig) : now.getFullYear());
                    }}
                    className="px-3 py-1.5 text-xs font-medium bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors shadow-sm"
                  >
                    Current Week
                  </button>
                </>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-4 lg:p-6">
        {/* Main Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Daily & Weekly Standard Tasks */}
            <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl border border-white/50 dark:border-gray-700/50 shadow-lg overflow-hidden">
              <div className="px-5 py-4 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 dark:from-emerald-500/20 dark:to-teal-500/20 border-b border-gray-200/50 dark:border-gray-700/50 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-800 dark:text-white flex items-center gap-2">
                  <span className="text-xl">📅</span>
                  Daily & Weekly Standard Tasks/Meetings
                </h2>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 dark:text-gray-400">Days/week:</span>
                  <select
                    value={workDaysPerWeek}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      setWorkDaysPerWeek(val);
                      updateLswWorkDaysPerWeek(val).catch(err => console.error('Failed to save work days preference:', err));
                    }}
                    className="text-xs px-2 py-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 cursor-pointer"
                  >
                    <option value={5}>5 (Mon–Fri)</option>
                    <option value={6}>6 (Mon–Sat)</option>
                    <option value={7}>7 (All days)</option>
                  </select>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-blue-100 dark:bg-blue-900/30">
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wide w-16">Min</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wide">Task/Meeting</th>
                      <th className="px-4 py-3 text-center text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wide w-16">Time</th>
                      {getVisibleDays().map((day) => (
                        <th
                          key={day}
                          className={`px-2 py-3 text-center text-xs font-bold uppercase tracking-wide w-10 ${
                            today === day
                              ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-200 dark:bg-emerald-700/40'
                              : 'text-gray-600 dark:text-gray-300'
                          }`}
                        >
                          {dayHeaderMap[day]}
                        </th>
                      ))}
                      <th className="w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {dailyTasks.map((task) => (
                      <tr key={task.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group">
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{task.minutes}</td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-800 dark:text-white">{task.task}</td>
                        <td className="px-4 py-3 text-sm text-center text-gray-600 dark:text-gray-300">{task.time}</td>
                        {getVisibleDays().map((day) => {
                          const earlyDone = isEarlyCompleted(task.id, day);
                          return (
                            <td key={day} className="px-2 py-3 text-center">
                              <div className="relative inline-flex items-center justify-center group/check">
                                {earlyDone ? (
                                  /* Custom yellow checkbox for early-completed tasks */
                                  <button
                                    type="button"
                                    onClick={() => handleDayCheckboxClick(task, day)}
                                    className="w-5 h-5 rounded border-2 border-yellow-400 bg-yellow-400 dark:border-yellow-500 dark:bg-yellow-500 flex items-center justify-center cursor-pointer focus:outline-none focus:ring-2 focus:ring-yellow-300 transition-colors"
                                  >
                                    <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                  </button>
                                ) : (
                                  /* Standard checkbox for normal tasks */
                                  <input
                                    type="checkbox"
                                    checked={task.days[day]}
                                    onChange={() => handleDayCheckboxClick(task, day)}
                                    className="w-5 h-5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 dark:border-gray-600 dark:bg-gray-700 cursor-pointer"
                                  />
                                )}
                                {earlyDone && (
                                  <>
                                    {/* Blinking green dot */}
                                    <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
                                    </span>
                                    {/* Hover tooltip */}
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 text-xs font-medium text-white bg-gray-900 dark:bg-gray-700 rounded shadow-lg whitespace-nowrap opacity-0 group-hover/check:opacity-100 transition-opacity pointer-events-none z-50">
                                      Early Completed
                                      <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-gray-900 dark:border-t-gray-700"></div>
                                    </div>
                                  </>
                                )}
                              </div>
                            </td>
                          );
                        })}
                        <td className="px-2 py-3 text-center">
                          <button
                            onClick={() => { setDailyTasks(tasks => tasks.filter(t => t.id !== task.id)); deleteLswDailyTask(task.id).catch(e => console.error('Failed to delete task:', e)); }}
                            className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                            title="Delete task"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    ))}

                  </tbody>
                </table>
              </div>
              <div className="px-5 py-3 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200/50 dark:border-gray-700/50">
                <button 
                  onClick={() => setShowAddTaskModal(true)}
                  className="text-sm text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 font-medium flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Task
                </button>
              </div>
            </div>

            {/* Improvement Projects & Updates */}
            <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl border border-white/50 dark:border-gray-700/50 shadow-lg overflow-hidden">
              <div className="px-5 py-4 bg-gradient-to-r from-blue-500/10 to-indigo-500/10 dark:from-blue-500/20 dark:to-indigo-500/20 border-b border-gray-200/50 dark:border-gray-700/50">
                <h2 className="text-lg font-semibold text-gray-800 dark:text-white flex items-center gap-2">
                  <span className="text-xl">🚀</span>
                  Improvement Projects and Updates
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-blue-100 dark:bg-blue-900/30">
                      <th className="w-10"></th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wide w-12">#</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wide border-r border-blue-300 dark:border-blue-600">Project</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wide">Update</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {projects.map((project, index) => {
                      // Helper to convert hex to rgba with intensity
                      const hexToRgba = (hex: string, intensity: number) => {
                        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
                        if (!result) return 'transparent';
                        const r = parseInt(result[1], 16);
                        const g = parseInt(result[2], 16);
                        const b = parseInt(result[3], 16);
                        return `rgba(${r}, ${g}, ${b}, ${intensity / 100})`;
                      };
                      const cellBg = project.cellColor && typeof project.cellColorIntensity === 'number'
                        ? hexToRgba(project.cellColor, project.cellColorIntensity) 
                        : undefined;
                      return (
                      <tr 
                        key={project.id} 
                        className="transition-colors align-top"
                      >
                        <td className="pl-2 py-3">
                          <button
                            onClick={() => { setProjects(prev => prev.filter(p => p.id !== project.id)); deleteLswProject(project.id).catch(e => console.error('Failed to delete project:', e)); }}
                            className="w-6 h-6 flex items-center justify-center rounded-full text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                            title="Delete project"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xs">
                            {index + 1}
                          </div>
                        </td>
                        <td 
                          className="px-4 py-3 text-sm border-r border-gray-300 dark:border-gray-600 cursor-context-menu"
                          style={{ 
                            backgroundColor: cellBg,
                            color: project.fontColor || '#1f2937', 
                            fontFamily: project.fontFamily || 'Inter',
                            fontWeight: project.fontBold ? 'bold' : 'normal',
                            fontStyle: project.fontItalic ? 'italic' : 'normal'
                          }}
                          onContextMenu={(e) => handleProjectContextMenu(e, project.id)}
                        >
                          {project.name}
                        </td>
                        <td className="p-0">
                          <div className="divide-y divide-gray-200 dark:divide-gray-600">
                            {project.updates.map((update, updateIdx) => (
                              <div 
                                key={updateIdx} 
                                className="flex items-start gap-2 py-3 px-4 cursor-context-menu"
                                style={{
                                  backgroundColor: update.cellColor && typeof update.cellColorIntensity === 'number'
                                    ? hexToRgba(update.cellColor, update.cellColorIntensity) 
                                    : undefined
                                }}
                                onContextMenu={(e) => handleUpdateContextMenu(e, project.id, updateIdx)}
                              >
                                <textarea
                                  value={update.text}
                                  onChange={(e) => {
                                    updateProjectUpdate(project.id, updateIdx, e.target.value);
                                    e.target.style.height = 'auto';
                                    e.target.style.height = e.target.scrollHeight + 'px';
                                  }}
                                  placeholder="Enter update..."
                                  rows={1}
                                  className="flex-1 text-sm bg-transparent focus:outline-none py-1 transition-colors resize-none overflow-hidden"
                                  style={{
                                    color: update.fontColor || '#4b5563',
                                    fontStyle: update.fontItalic ? 'italic' : 'normal'
                                  }}
                                />
                                <div className="flex items-center gap-1 flex-shrink-0">
                                  <button
                                    onClick={() => addProjectUpdate(project.id)}
                                    className="p-1 text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                                    title="Add update"
                                  >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                    </svg>
                                  </button>
                                  {project.updates.length > 1 && (
                                    <button
                                      onClick={() => handleDeleteClick(project.id, updateIdx)}
                                      className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                                      title="Remove update"
                                    >
                                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                      </svg>
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="px-5 py-3 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200/50 dark:border-gray-700/50">
                <button
                  onClick={() => setShowAddProjectModal(true)}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Project
                </button>
              </div>
            </div>

            {/* Follow Ups */}
            <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl border border-white/50 dark:border-gray-700/50 shadow-lg overflow-hidden">
              <div className="px-5 py-4 bg-gradient-to-r from-amber-500/10 to-orange-500/10 dark:from-amber-500/20 dark:to-orange-500/20 border-b border-gray-200/50 dark:border-gray-700/50">
                <h2 className="text-lg font-semibold text-gray-800 dark:text-white flex items-center gap-2">
                  <span className="text-xl">🔔</span>
                  Follow Ups
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-blue-100 dark:bg-blue-900/30">
                      <th className="w-10"></th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wide border-r border-gray-300 dark:border-gray-600">Follow Up</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wide w-28 border-r border-gray-300 dark:border-gray-600">Due Date</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wide w-36 border-r border-gray-300 dark:border-gray-600">Responsible</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wide border-l border-gray-300 dark:border-gray-600">Comment/Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {followUps.map((followUp) => (
                      <tr key={followUp.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group">
                        <td className="pl-2 py-3">
                          <button
                            onClick={() => { setFollowUps(ups => ups.filter(u => u.id !== followUp.id)); deleteLswFollowUp(followUp.id).catch(e => console.error('Failed to delete follow-up:', e)); }}
                            className="w-6 h-6 flex items-center justify-center rounded-full text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                            title="Delete follow up"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-800 dark:text-white border-r border-gray-300 dark:border-gray-600">{followUp.task}</td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 border-r border-gray-300 dark:border-gray-600">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            new Date(followUp.dueDate) < new Date()
                              ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                              : new Date(followUp.dueDate) < new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
                              ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                              : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                          }`}>
                            {new Date(followUp.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 border-r border-gray-300 dark:border-gray-600">{followUp.responsible}</td>
                        <td className="px-4 py-2 border-l border-gray-300 dark:border-gray-600">
                          <textarea
                            value={followUp.comments}
                            onChange={(e) => {
                              const val = e.target.value;
                              setFollowUps(ups =>
                                ups.map(u =>
                                  u.id === followUp.id ? { ...u, comments: val } : u
                                )
                              );
                            }}
                            onBlur={() => {
                              updateLswFollowUp(followUp.id, { comments: followUp.comments } as any).catch(e => console.error('Failed to update comment:', e));
                            }}
                            placeholder="Add comment..."
                            rows={1}
                            className="w-full min-w-[200px] px-2 py-1 text-sm text-gray-600 dark:text-gray-300 bg-transparent border border-transparent hover:border-gray-300 dark:hover:border-gray-600 focus:border-amber-400 dark:focus:border-amber-500 focus:ring-1 focus:ring-amber-400 dark:focus:ring-amber-500 rounded resize-none overflow-hidden transition-colors"
                            style={{ whiteSpace: 'pre-wrap', wordWrap: 'break-word' }}
                            onInput={(e) => {
                              const target = e.target as HTMLTextAreaElement;
                              target.style.height = 'auto';
                              target.style.height = target.scrollHeight + 'px';
                            }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-5 py-3 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200/50 dark:border-gray-700/50">
                <button 
                  onClick={() => setShowAddFollowUpModal(true)}
                  className="text-sm text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 font-medium flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Follow Up
                </button>
              </div>
            </div>

            {/* RCA Triggers */}
            <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl border border-white/50 dark:border-gray-700/50 shadow-lg overflow-hidden">
              <div className="px-5 py-4 bg-gradient-to-r from-red-500/10 to-rose-500/10 dark:from-red-500/20 dark:to-rose-500/20 border-b border-gray-200/50 dark:border-gray-700/50">
                <h2 className="text-lg font-semibold text-gray-800 dark:text-white flex items-center gap-2">
                  <span className="text-xl">⚠️</span>
                  Plant Specific Cause RCA Triggers
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-blue-100 dark:bg-blue-900/30">
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wide">RCA Event Trigger</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wide w-32">Event Date</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wide">Comments/Notes</th>
                      <th className="px-4 py-3 text-center text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wide w-16">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {rcaTriggers.map((trigger) => (
                      <tr key={trigger.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                        <td className="px-4 py-3">
                          <span className="text-sm font-medium text-gray-800 dark:text-white">{trigger.trigger}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            {trigger.eventDate 
                              ? new Date(trigger.eventDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                              : '—'
                            }
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            {trigger.comments || '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => { setRcaTriggers(prev => prev.filter(t => t.id !== trigger.id)); deleteLswRcaTrigger(trigger.id).catch(e => console.error('Failed to delete trigger:', e)); }}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                            title="Delete trigger"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-5 py-3 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200/50 dark:border-gray-700/50">
                <button 
                  onClick={() => setShowAddTriggerModal(true)}
                  className="text-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 font-medium flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Trigger
                </button>
              </div>
            </div>

            {/* Tasks by Frequency */}
            <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl border border-white/50 dark:border-gray-700/50 shadow-lg overflow-hidden">
              <div className="px-5 py-4 bg-gradient-to-r from-violet-500/10 to-purple-500/10 dark:from-violet-500/20 dark:to-purple-500/20 border-b border-gray-200/50 dark:border-gray-700/50 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-800 dark:text-white flex items-center gap-2">
                  <span className="text-xl">📆</span>
                  Scheduled Tasks/Meetings
                </h2>
                <button
                  onClick={() => setShowAddScheduledTaskModal(true)}
                  className="px-3 py-1.5 text-sm font-medium text-white bg-violet-500 hover:bg-violet-600 rounded-lg transition-colors flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add
                </button>
              </div>
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {/* Bi-Weekly */}
                <div className="py-3">
                  <h3 className="text-xs font-semibold text-blue-800 dark:text-blue-200 uppercase tracking-wide mb-0 px-4 py-2 bg-blue-100 dark:bg-blue-900/50">Bi-Weekly (Standard Tasks/Meetings)</h3>
                  <table className="w-full">
                    <thead>
                      <tr className="text-xs text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30">
                        <th className="px-4 py-1.5 text-left w-12 border-r border-gray-300 dark:border-gray-600">Min</th>
                        <th className="px-1 py-1.5 text-left">Task/Meeting</th>
                        <th className="px-4 py-1.5 text-right whitespace-nowrap w-20 border-l border-gray-300 dark:border-gray-600">Due Date</th>
                        <th className="w-8"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {frequencyTasks.filter(t => t.frequency === 'biweekly').map(task => (
                        <tr key={task.id} className="text-sm hover:bg-gray-50 dark:hover:bg-gray-700/30 border-b border-gray-300 dark:border-gray-600">
                          <td className="px-1 py-2 text-gray-500 dark:text-gray-400 border-r border-gray-300 dark:border-gray-600">{task.minutes}</td>
                          <td className="px-1 py-2 text-gray-700 dark:text-gray-300">{task.task}</td>
                          <td className="px-1 py-2 text-right text-gray-500 dark:text-gray-400 text-xs w-20 border-l border-gray-300 dark:border-gray-600">
                            {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </td>
                          <td className="px-1 py-2 text-center">
                            <button
                              onClick={() => { setFrequencyTasks(prev => prev.filter(t => t.id !== task.id)); deleteLswFrequencyTask(task.id).catch(e => console.error('Failed to delete freq task:', e)); }}
                              className="text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                              title="Delete task"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {/* Monthly */}
                <div className="py-3">
                  <h3 className="text-xs font-semibold text-blue-800 dark:text-blue-200 uppercase tracking-wide mb-0 px-4 py-2 bg-blue-100 dark:bg-blue-900/50">Monthly (Standard Tasks/Meetings)</h3>
                  <table className="w-full">
                    <thead>
                      <tr className="text-xs text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30">
                        <th className="px-4 py-1.5 text-left w-12 border-r border-gray-300 dark:border-gray-600">Min</th>
                        <th className="px-1 py-1.5 text-left">Task/Meeting</th>
                        <th className="px-4 py-1.5 text-right whitespace-nowrap w-20 border-l border-gray-300 dark:border-gray-600">Due Date</th>
                        <th className="w-8"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {frequencyTasks.filter(t => t.frequency === 'monthly').map(task => (
                        <tr key={task.id} className="text-sm hover:bg-gray-50 dark:hover:bg-gray-700/30 border-b border-gray-300 dark:border-gray-600">
                          <td className="px-1 py-2 text-gray-500 dark:text-gray-400 border-r border-gray-300 dark:border-gray-600">{task.minutes}</td>
                          <td className="px-1 py-2 text-gray-700 dark:text-gray-300">{task.task}</td>
                          <td className="px-1 py-2 text-right text-gray-500 dark:text-gray-400 text-xs w-20 border-l border-gray-300 dark:border-gray-600">
                            {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </td>
                          <td className="px-1 py-2 text-center">
                            <button
                              onClick={() => { setFrequencyTasks(prev => prev.filter(t => t.id !== task.id)); deleteLswFrequencyTask(task.id).catch(e => console.error('Failed to delete freq task:', e)); }}
                              className="text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                              title="Delete task"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {/* Quarterly */}
                <div className="py-3">
                  <h3 className="text-xs font-semibold text-blue-800 dark:text-blue-200 uppercase tracking-wide mb-0 px-4 py-2 bg-blue-100 dark:bg-blue-900/50">Quarterly (Standard Tasks/Meetings)</h3>
                  <table className="w-full">
                    <thead>
                      <tr className="text-xs text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30">
                        <th className="px-4 py-1.5 text-left w-12 border-r border-gray-300 dark:border-gray-600">Min</th>
                        <th className="px-1 py-1.5 text-left">Task/Meeting</th>
                        <th className="px-4 py-1.5 text-right whitespace-nowrap w-20 border-l border-gray-300 dark:border-gray-600">Due Date</th>
                        <th className="w-8"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {frequencyTasks.filter(t => t.frequency === 'quarterly').map(task => (
                        <tr key={task.id} className="text-sm hover:bg-gray-50 dark:hover:bg-gray-700/30 border-b border-gray-300 dark:border-gray-600">
                          <td className="px-1 py-2 text-gray-500 dark:text-gray-400 border-r border-gray-300 dark:border-gray-600">{task.minutes}</td>
                          <td className="px-1 py-2 text-gray-700 dark:text-gray-300">{task.task}</td>
                          <td className="px-1 py-2 text-right text-gray-500 dark:text-gray-400 text-xs w-20 border-l border-gray-300 dark:border-gray-600">
                            {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </td>
                          <td className="px-1 py-2 text-center">
                            <button
                              onClick={() => { setFrequencyTasks(prev => prev.filter(t => t.id !== task.id)); deleteLswFrequencyTask(task.id).catch(e => console.error('Failed to delete freq task:', e)); }}
                              className="text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                              title="Delete task"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {/* Annually */}
                <div className="py-3">
                  <h3 className="text-xs font-semibold text-blue-800 dark:text-blue-200 uppercase tracking-wide mb-0 px-4 py-2 bg-blue-100 dark:bg-blue-900/50">Annually (Standard Tasks/Meetings)</h3>
                  <table className="w-full">
                    <thead>
                      <tr className="text-xs text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30">
                        <th className="px-4 py-1.5 text-left w-12 border-r border-gray-300 dark:border-gray-600">Min</th>
                        <th className="px-1 py-1.5 text-left">Task/Meeting</th>
                        <th className="px-4 py-1.5 text-right whitespace-nowrap w-20 border-l border-gray-300 dark:border-gray-600">Due Date</th>
                        <th className="w-8"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {frequencyTasks.filter(t => t.frequency === 'annually').map(task => (
                        <tr key={task.id} className="text-sm hover:bg-gray-50 dark:hover:bg-gray-700/30 border-b border-gray-300 dark:border-gray-600">
                          <td className="px-1 py-2 text-gray-500 dark:text-gray-400 border-r border-gray-300 dark:border-gray-600">{task.minutes}</td>
                          <td className="px-1 py-2 text-gray-700 dark:text-gray-300">{task.task}</td>
                          <td className="px-1 py-2 text-right text-gray-500 dark:text-gray-400 text-xs w-20 border-l border-gray-300 dark:border-gray-600">
                            {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </td>
                          <td className="px-1 py-2 text-center">
                            <button
                              onClick={() => { setFrequencyTasks(prev => prev.filter(t => t.id !== task.id)); deleteLswFrequencyTask(task.id).catch(e => console.error('Failed to delete freq task:', e)); }}
                              className="text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                              title="Delete task"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* To Do Today & This Week */}
            <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl border border-white/50 dark:border-gray-700/50 shadow-lg overflow-hidden">
              <div className="px-5 py-4 bg-gradient-to-r from-blue-500/10 to-cyan-500/10 dark:from-blue-500/20 dark:to-cyan-500/20 border-b border-gray-200/50 dark:border-gray-700/50">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-800 dark:text-white flex items-center gap-2">
                    <span className="text-xl">✅</span>
                    To Do Today & This Week
                  </h2>
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                      {currentTime.toLocaleDateString('en-US', { weekday: 'long' })}, {currentTime.getDate()}
                    </span>
                    <span className="text-sm font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-3 py-1 rounded-lg font-mono">
                      {currentTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true })}
                    </span>
                  </div>
                </div>
              </div>
              <div className="divide-y divide-gray-200 dark:divide-gray-700 max-h-[400px] overflow-y-auto">
                {[...todoItems]
                  .sort((a, b) => {
                    // Items without time go to the end
                    if (!a.dueDate && !b.dueDate) return 0;
                    if (!a.dueDate) return 1;
                    if (!b.dueDate) return -1;
                    // Sort by time (earlier first)
                    const [aHours, aMinutes] = a.dueDate.split(':').map(Number);
                    const [bHours, bMinutes] = b.dueDate.split(':').map(Number);
                    const aTime = aHours * 60 + aMinutes;
                    const bTime = bHours * 60 + bMinutes;
                    return aTime - bTime;
                  })
                  .map((item) => {
                    const isPastDue = item.dueDate && !item.completed && (() => {
                      const [hours, minutes] = item.dueDate.split(':').map(Number);
                      const dueTime = new Date();
                      dueTime.setHours(hours, minutes, 0, 0);
                      return currentTime > dueTime;
                    })();
                    const isUpcoming = item.dueDate && !item.completed && !isPastDue;
                    
                    return (
                  <div
                    key={item.id}
                    className={`px-5 py-3 transition-colors cursor-pointer ${
                      item.completed
                        ? 'bg-gray-50 dark:bg-gray-800/30 hover:bg-gray-100 dark:hover:bg-gray-800/50'
                        : isPastDue
                          ? 'bg-yellow-50 dark:bg-yellow-900/20 hover:bg-yellow-100 dark:hover:bg-yellow-900/30'
                          : isUpcoming
                            ? 'bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30'
                            : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                    }`}
                    onClick={() => toggleTodo(item.id)}
                  >
                    <div className="flex items-start gap-3">
                      {/* Checkbox - fixed width */}
                      <div className={`flex-shrink-0 w-5 h-5 mt-0.5 rounded-full border-2 flex items-center justify-center transition-colors ${
                        item.completed
                          ? 'bg-emerald-500 border-emerald-500'
                          : 'border-gray-300 dark:border-gray-600'
                      }`}>
                        {item.completed && (
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      {/* Task text - flexible, wraps */}
                      <div className="flex-1 min-w-0 relative">
                        <span className={`text-sm break-words ${
                          item.completed
                            ? 'text-gray-300 dark:text-gray-600 line-through'
                            : 'text-gray-800 dark:text-white'
                        }`}>
                          {item.task}
                        </span>
                        {item.completed && (
                          <span className="absolute inset-0 flex items-center justify-center">
                            <span className="bg-emerald-500 text-white text-xs px-3 py-1 rounded-full font-medium shadow-md">
                              ✓ Great, Item is Completed! • {currentTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                            </span>
                          </span>
                        )}
                      </div>
                      {/* Badges and delete - fixed, no shrink */}
                      <div className="flex-shrink-0 flex items-center gap-2">
                        {isPastDue && (
                          <span className="text-xs px-2 py-1 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 font-medium whitespace-nowrap">
                            ⚠️ Past Due
                          </span>
                        )}
                        {item.dueDate && (
                          <span className={`text-xs px-2 py-1 rounded-lg whitespace-nowrap ${
                            item.completed
                              ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500'
                              : 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                          }`}>
                            🕐 {(() => {
                              const [hours, minutes] = item.dueDate.split(':').map(Number);
                              const period = hours >= 12 ? 'PM' : 'AM';
                              const hour12 = hours % 12 || 12;
                              return `${hour12}:${minutes.toString().padStart(2, '0')} ${period}`;
                            })()}
                          </span>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setTodoItems(prev => prev.filter(t => t.id !== item.id));
                            deleteLswTodoItem(item.id).catch(e => console.error('Failed to delete todo:', e));
                          }}
                          className="flex-shrink-0 p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-full transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                    );
                  })}
              </div>
              <div className="px-5 py-3 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200/50 dark:border-gray-700/50">
                <button 
                  onClick={() => setShowAddTodoModal(true)}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Item
                </button>
              </div>
            </div>

            {/* Meeting Rails */}
            <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl border border-white/50 dark:border-gray-700/50 shadow-lg overflow-hidden">
              <div className="px-5 py-4 bg-gradient-to-r from-purple-500/10 to-pink-500/10 dark:from-purple-500/20 dark:to-pink-500/20 border-b border-gray-200/50 dark:border-gray-700/50">
                <h2 className="text-lg font-semibold text-gray-800 dark:text-white flex items-center gap-2">
                  <span className="text-xl">🚂</span>
                  Level 1, 2 & 3 Meeting Rails
                </h2>
              </div>
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {meetingRails.map((rail) => (
                  <div
                    key={rail.id}
                    className="px-5 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer"
                    onClick={() => toggleMeetingRail(rail.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                          rail.completed
                            ? 'bg-purple-500 border-purple-500'
                            : 'border-gray-300 dark:border-gray-600'
                        }`}>
                          {rail.completed && (
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <span className={`text-sm ${
                          rail.completed ? 'text-gray-400 dark:text-gray-500 line-through' : 'text-gray-800 dark:text-white'
                        }`}>
                          {rail.rail}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {new Date(rail.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setMeetingRails(prev => prev.filter(r => r.id !== rail.id));
                            deleteLswMeetingRail(rail.id).catch(e => console.error('Failed to delete rail:', e));
                          }}
                          className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-full transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="px-5 py-3 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200/50 dark:border-gray-700/50">
                <button 
                  onClick={() => setShowAddMeetingRailModal(true)}
                  className="text-sm text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 font-medium flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Meeting Rail
                </button>
              </div>
            </div>

            {/* Key Results */}
            <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl border border-white/50 dark:border-gray-700/50 shadow-lg overflow-hidden">
              <div className="px-5 py-4 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 dark:from-cyan-500/20 dark:to-blue-500/20 border-b border-gray-200/50 dark:border-gray-700/50">
                <h2 className="text-lg font-semibold text-gray-800 dark:text-white flex items-center gap-2">
                  <span className="text-xl">📊</span>
                  Key Results
                </h2>
              </div>
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {keyResultGroups.length === 0 ? (
                  <div className="px-5 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                    No key result sets configured yet.
                  </div>
                ) : (
                  keyResultGroups.map((group) => (
                    <div key={group.id} className="px-5 py-4">
                      <h3 className="text-xs font-semibold text-cyan-600 dark:text-cyan-400 uppercase tracking-wide mb-3">{group.name}</h3>
                      <div className="space-y-3">
                        {group.keyResults.map((kr, i) => (
                          <div key={kr.id || i} className="flex items-center justify-between">
                            <span className="text-sm text-gray-600 dark:text-gray-400">{kr.metric}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-gray-800 dark:text-white">{kr.value}</span>
                              {kr.trend && (
                                <span className={`text-xs ${
                                  kr.trend === 'up' ? 'text-emerald-500' :
                                  kr.trend === 'down' ? 'text-red-500' : 'text-gray-400'
                                }`}>
                                  {kr.trend === 'up' ? '↑' : kr.trend === 'down' ? '↓' : '→'}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Personal Objectives/Goals */}
            <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl border border-white/50 dark:border-gray-700/50 shadow-lg overflow-hidden">
              <div className="px-5 py-4 bg-gradient-to-r from-rose-500/10 to-pink-500/10 dark:from-rose-500/20 dark:to-pink-500/20 border-b border-gray-200/50 dark:border-gray-700/50">
                <h2 className="text-lg font-semibold text-gray-800 dark:text-white flex items-center gap-2">
                  <span className="text-xl">🎯</span>
                  Personal Objectives/Goals
                </h2>
              </div>
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {personalGoals.map((goal) => (
                  <div 
                    key={goal.id} 
                    className="px-5 py-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                    onClick={() => setEditingGoalId(editingGoalId === goal.id ? null : goal.id)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <span className="text-sm font-medium text-gray-800 dark:text-white">{goal.objective}</span>
                      <div className="flex items-center gap-2 ml-2">
                        <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                          {new Date(goal.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setPersonalGoals(prev => prev.filter(g => g.id !== goal.id));
                            deleteLswPersonalGoal(goal.id).catch(e => console.error('Failed to delete goal:', e));
                          }}
                          className="w-5 h-5 flex items-center justify-center rounded-full text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                          title="Delete goal"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-rose-500 to-pink-500 rounded-full transition-all duration-500"
                          style={{ width: `${goal.progress}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium text-gray-600 dark:text-gray-400">{goal.progress}%</span>
                    </div>
                    {editingGoalId === goal.id && (
                      <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700" onClick={(e) => e.stopPropagation()}>
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                          Adjust Progress
                        </label>
                        <div className="flex items-center gap-3">
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={goal.progress}
                            onChange={(e) => {
                              const newProgress = parseInt(e.target.value);
                              setPersonalGoals(prev => prev.map(g => 
                                g.id === goal.id ? { ...g, progress: newProgress } : g
                              ));
                            }}
                            onMouseUp={() => {
                              updateLswPersonalGoal(goal.id, { progress: goal.progress } as any).catch(e => console.error('Failed to update progress:', e));
                            }}
                            onTouchEnd={() => {
                              updateLswPersonalGoal(goal.id, { progress: goal.progress } as any).catch(e => console.error('Failed to update progress:', e));
                            }}
                            className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-rose-500"
                          />
                          <span className="text-sm font-semibold text-rose-600 dark:text-rose-400 w-10 text-right">{goal.progress}%</span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="px-5 py-3 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200/50 dark:border-gray-700/50">
                <button
                  onClick={() => setShowAddGoalModal(true)}
                  className="text-sm text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 font-medium flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Goal
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Add Task Modal */}
      {showAddTaskModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={() => setShowAddTaskModal(false)}
          />
          
          {/* Modal */}
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative w-full max-w-xl max-h-[90vh] flex flex-col transform overflow-hidden rounded-2xl bg-white dark:bg-gray-800 shadow-2xl transition-all">
              {/* Header */}
              <div className="relative bg-gradient-to-r from-emerald-500 to-teal-600 px-6 py-5">
                <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMtOS45NDEgMC0xOCA4LjA1OS0xOCAxOHM4LjA1OSAxOCAxOCAxOCAxOC04LjA1OSAxOC0xOC04LjA1OS0xOC0xOC0xOHptMCAzMmMtNy43MzIgMC0xNC02LjI2OC0xNC0xNHM2LjI2OC0xNCAxNC0xNCAxNCA2LjI2OCAxNCAxNC02LjI2OCAxNC0xNCAxNHoiIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iLjA1Ii8+PC9nPjwvc3ZnPg==')] opacity-30" />
                <div className="relative">
                  <h3 className="text-xl font-bold text-white flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                    </div>
                    Add Daily Task
                  </h3>
                  <p className="text-emerald-100 text-sm mt-1">Schedule a new recurring task or meeting</p>
                </div>
                <button
                  onClick={() => setShowAddTaskModal(false)}
                  className="absolute top-4 right-4 p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                >
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              {/* Content */}
              <div className="px-6 py-5 space-y-5 overflow-y-auto flex-1">
                {/* Task Name */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Task / Meeting Name <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={newTask.task}
                    onChange={(e) => {
                      setNewTask(prev => ({ ...prev, task: e.target.value }));
                      e.target.style.height = 'auto';
                      e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px';
                    }}
                    placeholder="e.g., Morning Production Review"
                    rows={1}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all resize-none overflow-y-auto max-h-[200px]"
                  />
                </div>

                {/* Time and Duration Row */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      Start Time <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="time"
                      value={newTask.time}
                      onChange={(e) => setNewTask(prev => ({ ...prev, time: e.target.value }))}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      Duration (minutes) <span className="text-red-500">*</span>
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min="1"
                        max="480"
                        value={newTask.minutes}
                        onChange={(e) => setNewTask(prev => ({ ...prev, minutes: Math.max(1, parseInt(e.target.value) || 1) }))}
                        className="w-20 px-3 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-white text-center focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                      />
                      <select
                        value={[15, 30, 45, 60].includes(newTask.minutes) ? newTask.minutes : ''}
                        onChange={(e) => e.target.value && setNewTask(prev => ({ ...prev, minutes: parseInt(e.target.value) }))}
                        className="flex-1 px-3 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                      >
                        <option value="">Quick select...</option>
                        <option value="15">15 min</option>
                        <option value="30">30 min</option>
                        <option value="45">45 min</option>
                        <option value="60">1 hour</option>
                      </select>
                    </div>
                  </div>
                </div>

              </div>
              
              {/* Footer */}
              <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700 flex items-center justify-end gap-3">
                <button
                  onClick={() => setShowAddTaskModal(false)}
                  className="px-5 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddTask}
                  disabled={!newTask.task.trim()}
                  className="px-5 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 rounded-xl shadow-lg shadow-emerald-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Task
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && deleteTarget && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={() => {
              setShowDeleteModal(false);
              setDeleteTarget(null);
            }}
          />
          
          {/* Modal */}
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative w-full max-w-md transform overflow-hidden rounded-2xl bg-white dark:bg-gray-800 shadow-2xl transition-all">
              {/* Header */}
              <div className="relative bg-gradient-to-r from-red-500 to-rose-600 px-6 py-5">
                <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMtOS45NDEgMC0xOCA4LjA1OS0xOCAxOHM4LjA1OSAxOCAxOCAxOCAxOC04LjA1OSAxOC0xOC04LjA1OS0xOC0xOC0xOHptMCAzMmMtNy43MzIgMC0xNC02LjI2OC0xNC0xNHM2LjI2OC0xNCAxNC0xNCAxNCA2LjI2OCAxNCAxNC02LjI2OCAxNC0xNCAxNHoiIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iLjA1Ii8+PC9nPjwvc3ZnPg==')] opacity-30" />
                <div className="relative flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">Delete Update</h3>
                    <p className="text-red-100 text-sm mt-0.5">This action cannot be undone</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setDeleteTarget(null);
                  }}
                  className="absolute top-4 right-4 p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                >
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              {/* Content */}
              <div className="px-6 py-6">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                    <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-gray-700 dark:text-gray-200 font-medium">Are you sure you want to delete this update?</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                      This update will be permanently removed from the project. You will not be able to recover it.
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Footer */}
              <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700 flex items-center justify-end gap-3">
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setDeleteTarget(null);
                  }}
                  className="px-5 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => removeProjectUpdate(deleteTarget.projectId, deleteTarget.updateIndex)}
                  className="px-5 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 rounded-xl shadow-lg shadow-red-500/25 transition-all flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Confirm Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Project Modal */}
      {showAddProjectModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={() => setShowAddProjectModal(false)}
          />
          
          {/* Modal */}
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative w-full max-w-3xl max-h-[80vh] flex flex-col transform overflow-hidden rounded-2xl bg-white dark:bg-gray-800 shadow-2xl transition-all">
              {/* Header */}
              <div className="relative bg-gradient-to-r from-blue-500 to-indigo-600 px-6 py-4">
                <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMtOS45NDEgMC0xOCA4LjA1OS0xOCAxOHM4LjA1OSAxOCAxOCAxOCAxOC04LjA1OSAxOC0xOC04LjA1OS0xOC0xOC0xOHptMCAzMmMtNy43MzIgMC0xNC02LjI2OC0xNC0xNHM2LjI2OC0xNCAxNC0xNCAxNCA2LjI2OCAxNCAxNC02LjI2OCAxNC0xNCAxNHoiIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iLjA1Ii8+PC9nPjwvc3ZnPg==')] opacity-30" />
                <div className="relative">
                  <h3 className="text-xl font-bold text-white flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                    </div>
                    Add New Project
                  </h3>
                  <p className="text-blue-100 text-sm mt-1">Create a new improvement project to track</p>
                </div>
                <button
                  onClick={() => setShowAddProjectModal(false)}
                  className="absolute top-4 right-4 p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                >
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              {/* Content */}
              <div className="px-6 py-4 space-y-4 overflow-y-auto flex-1">
                {/* Project Title */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                    Project Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newProject.name}
                    onChange={(e) => setNewProject(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., Line Efficiency Improvement"
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    style={{ color: newProject.fontColor, fontFamily: newProject.fontFamily }}
                  />
                </div>

                {/* Initial Update (Optional) */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                    Initial Update <span className="text-gray-400 font-normal">(Optional)</span>
                  </label>
                  <textarea
                    value={newProject.update}
                    onChange={(e) => {
                      setNewProject(prev => ({ ...prev, update: e.target.value }));
                      e.target.style.height = 'auto';
                      e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px';
                    }}
                    placeholder="e.g., Phase 1 kickoff meeting scheduled"
                    rows={1}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none overflow-y-auto max-h-[100px]"
                  />
                </div>

                {/* Two Column Layout for Style Sections */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Project Display Style */}
                  <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600">
                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                      </svg>
                      Project Column Style
                    </h4>
                    
                    <div className="space-y-3">
                      {/* Font Color */}
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                          Font Color
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={newProject.fontColor}
                            onChange={(e) => setNewProject(prev => ({ ...prev, fontColor: e.target.value }))}
                            className="w-8 h-8 rounded-lg border border-gray-300 dark:border-gray-500 cursor-pointer bg-transparent"
                          />
                          <div className="flex-1 flex flex-wrap gap-1">
                            {['#1f2937', '#dc2626', '#16a34a', '#2563eb', '#7c3aed'].map(color => (
                              <button
                                key={color}
                                onClick={() => setNewProject(prev => ({ ...prev, fontColor: color }))}
                                className={`w-5 h-5 rounded-full border-2 transition-all ${newProject.fontColor === color ? 'border-blue-500 scale-110' : 'border-transparent hover:scale-105'}`}
                                style={{ backgroundColor: color }}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                      
                      {/* Font Style */}
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                          Font Style
                        </label>
                        <div className="flex gap-2">
                          <select
                            value={newProject.fontFamily}
                            onChange={(e) => setNewProject(prev => ({ ...prev, fontFamily: e.target.value }))}
                            className="flex-1 px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-600 text-gray-700 dark:text-gray-200 text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            style={{ fontFamily: newProject.fontFamily }}
                          >
                            <option value="Inter">Inter</option>
                            <option value="Arial, sans-serif">Arial</option>
                            <option value="Georgia, serif">Georgia</option>
                            <option value="Verdana, sans-serif">Verdana</option>
                          </select>
                          <button
                            type="button"
                            onClick={() => setNewProject(prev => ({ ...prev, fontBold: !prev.fontBold }))}
                            className={`w-8 h-8 rounded-lg border-2 flex items-center justify-center text-sm transition-all ${
                              newProject.fontBold ? 'bg-blue-500 border-blue-500 text-white' : 'border-gray-300 dark:border-gray-500 text-gray-600 dark:text-gray-300'
                            }`}
                          >
                            <span className="font-bold">B</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setNewProject(prev => ({ ...prev, fontItalic: !prev.fontItalic }))}
                            className={`w-8 h-8 rounded-lg border-2 flex items-center justify-center text-sm transition-all ${
                              newProject.fontItalic ? 'bg-blue-500 border-blue-500 text-white' : 'border-gray-300 dark:border-gray-500 text-gray-600 dark:text-gray-300'
                            }`}
                          >
                            <span className="italic">I</span>
                          </button>
                        </div>
                      </div>

                      {/* Cell Color */}
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                          Cell Background
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={newProject.cellColor}
                            onChange={(e) => setNewProject(prev => ({ ...prev, cellColor: e.target.value }))}
                            className="w-8 h-8 rounded-lg border border-gray-300 dark:border-gray-500 cursor-pointer bg-transparent"
                          />
                          <div className="flex-1 flex flex-wrap gap-1">
                            {['#3b82f6', '#22c55e', '#eab308', '#ef4444', '#a855f7'].map(color => (
                              <button
                                key={color}
                                onClick={() => setNewProject(prev => ({ ...prev, cellColor: color }))}
                                className={`w-5 h-5 rounded-full border-2 transition-all ${newProject.cellColor === color ? 'border-blue-500 scale-110' : 'border-transparent hover:scale-105'}`}
                                style={{ backgroundColor: color }}
                              />
                            ))}
                          </div>
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          <span className="text-[10px] text-gray-400">Light</span>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={newProject.cellColorIntensity}
                            onChange={(e) => setNewProject(prev => ({ ...prev, cellColorIntensity: parseInt(e.target.value) }))}
                            className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer"
                            style={{ background: `linear-gradient(to right, transparent 0%, ${newProject.cellColor} 100%)` }}
                          />
                          <span className="text-[10px] text-gray-400">{newProject.cellColorIntensity}%</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Update Column Styling */}
                  <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700">
                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Update Column Style
                    </h4>
                    
                    <div className="space-y-3">
                      {/* Font Color & Italic */}
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                          Font Color
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={newProject.updateFontColor}
                            onChange={(e) => setNewProject(prev => ({ ...prev, updateFontColor: e.target.value }))}
                            className="w-8 h-8 rounded-lg border border-gray-300 dark:border-gray-500 cursor-pointer bg-transparent"
                          />
                          <div className="flex-1 flex flex-wrap gap-1">
                            {['#4b5563', '#dc2626', '#16a34a', '#2563eb', '#7c3aed'].map(color => (
                              <button
                                key={color}
                                onClick={() => setNewProject(prev => ({ ...prev, updateFontColor: color }))}
                                className={`w-5 h-5 rounded-full border-2 transition-all ${newProject.updateFontColor === color ? 'border-emerald-500 scale-110' : 'border-transparent hover:scale-105'}`}
                                style={{ backgroundColor: color }}
                              />
                            ))}
                          </div>
                          <button
                            type="button"
                            onClick={() => setNewProject(prev => ({ ...prev, updateFontItalic: !prev.updateFontItalic }))}
                            className={`w-8 h-8 rounded-lg border-2 flex items-center justify-center text-sm transition-all flex-shrink-0 ${
                              newProject.updateFontItalic ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-gray-300 dark:border-gray-500 text-gray-600 dark:text-gray-300'
                            }`}
                          >
                            <span className="italic">I</span>
                          </button>
                        </div>
                      </div>

                      {/* Cell Color */}
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                          Cell Background
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={newProject.updateCellColor}
                            onChange={(e) => setNewProject(prev => ({ ...prev, updateCellColor: e.target.value }))}
                            className="w-8 h-8 rounded-lg border border-gray-300 dark:border-gray-500 cursor-pointer bg-transparent"
                          />
                          <div className="flex-1 flex flex-wrap gap-1">
                            {['#10b981', '#3b82f6', '#eab308', '#ef4444', '#a855f7'].map(color => (
                              <button
                                key={color}
                                onClick={() => setNewProject(prev => ({ ...prev, updateCellColor: color }))}
                                className={`w-5 h-5 rounded-full border-2 transition-all ${newProject.updateCellColor === color ? 'border-emerald-500 scale-110' : 'border-transparent hover:scale-105'}`}
                                style={{ backgroundColor: color }}
                              />
                            ))}
                          </div>
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          <span className="text-[10px] text-gray-400">Light</span>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={newProject.updateCellColorIntensity}
                            onChange={(e) => setNewProject(prev => ({ ...prev, updateCellColorIntensity: parseInt(e.target.value) }))}
                            className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer"
                            style={{ background: `linear-gradient(to right, transparent 0%, ${newProject.updateCellColor} 100%)` }}
                          />
                          <span className="text-[10px] text-gray-400">{newProject.updateCellColorIntensity}%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                  
                {/* Preview */}
                <div className="pt-3 border-t border-gray-200 dark:border-gray-600">
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Preview</label>
                  <div className="flex rounded-lg border border-gray-200 dark:border-gray-500 overflow-hidden text-sm">
                    <div 
                      className="px-3 py-2 flex-1 border-r border-gray-200 dark:border-gray-500"
                      style={{ 
                        color: newProject.fontColor, 
                        fontFamily: newProject.fontFamily,
                        fontWeight: newProject.fontBold ? 'bold' : 'normal',
                        fontStyle: newProject.fontItalic ? 'italic' : 'normal',
                        backgroundColor: `${newProject.cellColor}${Math.round(newProject.cellColorIntensity * 2.55).toString(16).padStart(2, '0')}`
                      }}
                    >
                      {newProject.name || 'Project Title'}
                    </div>
                    <div 
                      className="px-3 py-2 flex-1"
                      style={{ 
                        color: newProject.updateFontColor,
                        fontStyle: newProject.updateFontItalic ? 'italic' : 'normal',
                        backgroundColor: `${newProject.updateCellColor}${Math.round(newProject.updateCellColorIntensity * 2.55).toString(16).padStart(2, '0')}`
                      }}
                    >
                      {newProject.update || 'Update Preview'}
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Footer */}
              <div className="px-6 py-3 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700 flex items-center justify-end gap-3">
                <button
                  onClick={() => setShowAddProjectModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddProject}
                  disabled={!newProject.name.trim()}
                  className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed rounded-xl shadow-lg shadow-blue-500/25 transition-all flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Project
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <div 
          className="fixed z-50"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <div 
            className="bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 py-1 min-w-[140px]"
            onClick={(e) => e.stopPropagation()}
          >
            {contextMenu.type === 'project' && (
              <>
                <button
                  onClick={handleDeleteProjectClick}
                  className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Delete
                </button>
                <div className="border-t border-gray-200 dark:border-gray-700 my-1"></div>
              </>
            )}
            <button
              onClick={contextMenu.type === 'project' ? handleFormatProject : handleFormatUpdate}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
              </svg>
              Format Cell
            </button>
          </div>
        </div>
      )}

      {/* Click outside to close context menu */}
      {contextMenu && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={closeContextMenu}
        />
      )}

      {/* Delete Project Confirmation Modal */}
      {showDeleteProjectModal && selectedProjectId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowDeleteProjectModal(false)} />
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md mx-4">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <span className="text-red-500">⚠️</span>
                Delete Project
              </h3>
            </div>
            <div className="px-6 py-4">
              <p className="text-gray-600 dark:text-gray-300">
                Are you sure you want to delete this project? This will also delete all related updates. This action cannot be undone.
              </p>
              <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                <p className="text-sm font-medium text-red-700 dark:text-red-400">
                  Project: {projects.find(p => p.id === selectedProjectId)?.name}
                </p>
                <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                  Updates: {projects.find(p => p.id === selectedProjectId)?.updates.filter(u => u.text.trim()).length || 0} will be deleted
                </p>
              </div>
            </div>
            <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 rounded-b-2xl flex items-center justify-end gap-3">
              <button
                onClick={() => setShowDeleteProjectModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={deleteProject}
                className="px-4 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-xl shadow-lg shadow-red-500/25 transition-all flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Delete Project
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Format Project Modal */}
      {showFormatProjectModal && selectedProjectId && (() => {
        const project = projects.find(p => p.id === selectedProjectId);
        if (!project) return null;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowFormatProjectModal(false)} />
            <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md mx-4">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                  </svg>
                  Format Project Cell
                </h3>
              </div>
              <div className="px-6 py-4 space-y-4 max-h-[60vh] overflow-y-auto">
                {/* Font Color */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Font Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={project.fontColor || '#1f2937'}
                      onChange={(e) => updateProjectStyle(selectedProjectId, { fontColor: e.target.value })}
                      className="w-8 h-8 rounded cursor-pointer border border-gray-300"
                    />
                    {['#1f2937', '#dc2626', '#2563eb', '#16a34a', '#9333ea'].map(color => (
                      <button
                        key={color}
                        onClick={() => updateProjectStyle(selectedProjectId, { fontColor: color })}
                        className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${project.fontColor === color ? 'border-gray-800 dark:border-white scale-110' : 'border-transparent'}`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>

                {/* Font Family */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Font</label>
                  <select
                    value={project.fontFamily || 'Inter'}
                    onChange={(e) => updateProjectStyle(selectedProjectId, { fontFamily: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="Inter">Inter</option>
                    <option value="Arial">Arial</option>
                    <option value="Georgia">Georgia</option>
                    <option value="Times New Roman">Times New Roman</option>
                    <option value="Courier New">Courier New</option>
                  </select>
                </div>

                {/* Bold & Italic */}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => updateProjectStyle(selectedProjectId, { fontBold: !project.fontBold })}
                    className={`flex-1 px-3 py-2 text-sm font-bold border rounded-lg transition-colors ${project.fontBold ? 'bg-blue-100 dark:bg-blue-900/30 border-blue-400 text-blue-700 dark:text-blue-300' : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                  >
                    B
                  </button>
                  <button
                    type="button"
                    onClick={() => updateProjectStyle(selectedProjectId, { fontItalic: !project.fontItalic })}
                    className={`flex-1 px-3 py-2 text-sm italic border rounded-lg transition-colors ${project.fontItalic ? 'bg-blue-100 dark:bg-blue-900/30 border-blue-400 text-blue-700 dark:text-blue-300' : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                  >
                    I
                  </button>
                </div>

                {/* Cell Background */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Cell Background</label>
                  <div className="flex items-center gap-2 mb-2">
                    <input
                      type="color"
                      value={project.cellColor || '#3b82f6'}
                      onChange={(e) => updateProjectStyle(selectedProjectId, { 
                        cellColor: e.target.value,
                        cellColorIntensity: project.cellColorIntensity ?? 20
                      })}
                      className="w-8 h-8 rounded cursor-pointer border border-gray-300"
                    />
                    {['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'].map(color => (
                      <button
                        key={color}
                        onClick={() => updateProjectStyle(selectedProjectId, { 
                          cellColor: color,
                          cellColorIntensity: project.cellColorIntensity ?? 20
                        })}
                        className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${project.cellColor === color ? 'border-gray-800 dark:border-white scale-110' : 'border-transparent'}`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">0%</span>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={project.cellColorIntensity ?? 20}
                      onChange={(e) => updateProjectStyle(selectedProjectId, { 
                        cellColorIntensity: Number(e.target.value),
                        cellColor: project.cellColor || '#3b82f6'
                      })}
                      className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                    />
                    <span className="text-xs text-gray-500">{project.cellColorIntensity ?? 20}%</span>
                  </div>
                </div>

                {/* Preview */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Preview</label>
                  <div 
                    className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600"
                    style={{
                      color: project.fontColor || '#1f2937',
                      fontFamily: project.fontFamily || 'Inter',
                      fontWeight: project.fontBold ? 'bold' : 'normal',
                      fontStyle: project.fontItalic ? 'italic' : 'normal',
                      backgroundColor: `${project.cellColor || '#3b82f6'}${Math.round((project.cellColorIntensity ?? 20) * 2.55).toString(16).padStart(2, '0')}`
                    }}
                  >
                    {project.name}
                  </div>
                </div>
              </div>
              <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 rounded-b-2xl flex items-center justify-end">
                <button
                  onClick={() => setShowFormatProjectModal(false)}
                  className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 rounded-xl shadow-lg shadow-blue-500/25 transition-all"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Format Update Modal */}
      {showFormatUpdateModal && selectedProjectId && selectedUpdateIndex !== null && (() => {
        const project = projects.find(p => p.id === selectedProjectId);
        if (!project || !project.updates[selectedUpdateIndex]) return null;
        const update = project.updates[selectedUpdateIndex];
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => { setShowFormatUpdateModal(false); setSelectedUpdateIndex(null); }} />
            <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md mx-4">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                  </svg>
                  Format Update Row
                </h3>
              </div>
              <div className="px-6 py-4 space-y-4 max-h-[60vh] overflow-y-auto">
                {/* Font Color */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Font Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={update.fontColor || '#4b5563'}
                      onChange={(e) => updateIndividualUpdateStyle(selectedProjectId, selectedUpdateIndex, { fontColor: e.target.value })}
                      className="w-8 h-8 rounded cursor-pointer border border-gray-300"
                    />
                    {['#4b5563', '#dc2626', '#2563eb', '#16a34a', '#9333ea'].map(color => (
                      <button
                        key={color}
                        onClick={() => updateIndividualUpdateStyle(selectedProjectId, selectedUpdateIndex, { fontColor: color })}
                        className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${update.fontColor === color ? 'border-gray-800 dark:border-white scale-110' : 'border-transparent'}`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>

                {/* Italic */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Style</label>
                  <button
                    type="button"
                    onClick={() => updateIndividualUpdateStyle(selectedProjectId, selectedUpdateIndex, { fontItalic: !update.fontItalic })}
                    className={`px-4 py-2 text-sm italic border rounded-lg transition-colors ${update.fontItalic ? 'bg-emerald-100 dark:bg-emerald-900/30 border-emerald-400 text-emerald-700 dark:text-emerald-300' : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                  >
                    Italic
                  </button>
                </div>

                {/* Cell Background */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Cell Background</label>
                  <div className="flex items-center gap-2 mb-2">
                    <input
                      type="color"
                      value={update.cellColor || '#10b981'}
                      onChange={(e) => updateIndividualUpdateStyle(selectedProjectId, selectedUpdateIndex, { 
                        cellColor: e.target.value,
                        cellColorIntensity: update.cellColorIntensity ?? 10
                      })}
                      className="w-8 h-8 rounded cursor-pointer border border-gray-300"
                    />
                    {['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'].map(color => (
                      <button
                        key={color}
                        onClick={() => updateIndividualUpdateStyle(selectedProjectId, selectedUpdateIndex, { 
                          cellColor: color,
                          cellColorIntensity: update.cellColorIntensity ?? 10
                        })}
                        className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${update.cellColor === color ? 'border-gray-800 dark:border-white scale-110' : 'border-transparent'}`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">0%</span>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={update.cellColorIntensity ?? 10}
                      onChange={(e) => updateIndividualUpdateStyle(selectedProjectId, selectedUpdateIndex, { 
                        cellColorIntensity: Number(e.target.value),
                        cellColor: update.cellColor || '#10b981'
                      })}
                      className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                    />
                    <span className="text-xs text-gray-500">{update.cellColorIntensity ?? 10}%</span>
                  </div>
                </div>

                {/* Preview */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Preview</label>
                  <div 
                    className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600"
                    style={{
                      color: update.fontColor || '#4b5563',
                      fontStyle: update.fontItalic ? 'italic' : 'normal',
                      backgroundColor: `${update.cellColor || '#10b981'}${Math.round((update.cellColorIntensity ?? 10) * 2.55).toString(16).padStart(2, '0')}`
                    }}
                  >
                    {update.text || 'Update Preview'}
                  </div>
                </div>
              </div>
              <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 rounded-b-2xl flex items-center justify-end">
                <button
                  onClick={() => { setShowFormatUpdateModal(false); setSelectedUpdateIndex(null); }}
                  className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 rounded-xl shadow-lg shadow-emerald-500/25 transition-all"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Add Follow Up Modal */}
      {showAddFollowUpModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={() => setShowAddFollowUpModal(false)}
          />
          
          {/* Modal */}
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative w-full max-w-md transform overflow-hidden rounded-2xl bg-white dark:bg-gray-800 shadow-2xl transition-all">
              {/* Header */}
              <div className="relative bg-gradient-to-r from-amber-500 to-orange-600 px-6 py-4">
                <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMtOS45NDEgMC0xOCA4LjA1OS0xOCAxOHM4LjA1OSAxOCAxOCAxOCAxOC04LjA1OSAxOC0xOC04LjA1OS0xOC0xOC0xOHptMCAzMmMtNy43MzIgMC0xNC02LjI2OC0xNC0xNHM2LjI2OC0xNCAxNC0xNCAxNCA2LjI2OCAxNCAxNC02LjI2OCAxNC0xNCAxNHoiIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iLjA1Ii8+PC9nPjwvc3ZnPg==')] opacity-30" />
                <div className="relative">
                  <h3 className="text-xl font-bold text-white flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                      <span className="text-xl">🔔</span>
                    </div>
                    Add Follow Up
                  </h3>
                  <p className="text-amber-100 text-sm mt-1">Create a new follow up item to track</p>
                </div>
                <button
                  onClick={() => setShowAddFollowUpModal(false)}
                  className="absolute top-4 right-4 p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                >
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              {/* Content */}
              <div className="px-6 py-5 space-y-4">
                {/* Follow Up Task */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                    Follow Up <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newFollowUp.task}
                    onChange={(e) => setNewFollowUp(prev => ({ ...prev, task: e.target.value }))}
                    placeholder="e.g., Review safety documentation"
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
                  />
                </div>

                {/* Due Date and Responsible - Two columns */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                      Due Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={newFollowUp.dueDate}
                      onChange={(e) => setNewFollowUp(prev => ({ ...prev, dueDate: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-white focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                      Responsible <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={newFollowUp.responsible}
                      onChange={(e) => setNewFollowUp(prev => ({ ...prev, responsible: e.target.value }))}
                      placeholder="e.g., John Smith"
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
                    />
                  </div>
                </div>

                {/* Comments */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                    Comments <span className="text-gray-400 font-normal">(Optional)</span>
                  </label>
                  <textarea
                    value={newFollowUp.comments}
                    onChange={(e) => setNewFollowUp(prev => ({ ...prev, comments: e.target.value }))}
                    placeholder="Add any notes or context..."
                    rows={3}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all resize-none"
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 flex items-center justify-end gap-3">
                <button
                  onClick={() => {
                    setShowAddFollowUpModal(false);
                    setNewFollowUp({ task: '', dueDate: new Date().toISOString().split('T')[0], responsible: '', comments: '' });
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (!newFollowUp.task.trim() || !newFollowUp.dueDate || !newFollowUp.responsible.trim()) return;
                    try {
                      const created = await createLswFollowUp({
                        task: newFollowUp.task,
                        dueDate: newFollowUp.dueDate,
                        responsibleName: newFollowUp.responsible,
                        comments: newFollowUp.comments,
                      });
                      setFollowUps(prev => [...prev, mapFollowUpFromDb(created)]);
                      setNewFollowUp({ task: '', dueDate: new Date().toISOString().split('T')[0], responsible: '', comments: '' });
                      setShowAddFollowUpModal(false);
                    } catch (e) { console.error('Failed to add follow-up:', e); }
                  }}
                  disabled={!newFollowUp.task.trim() || !newFollowUp.dueDate || !newFollowUp.responsible.trim()}
                  className="px-5 py-2 text-sm font-medium text-white bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed rounded-xl shadow-lg shadow-amber-500/25 disabled:shadow-none transition-all"
                >
                  Add Follow Up
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Trigger Modal */}
      {showAddTriggerModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={() => setShowAddTriggerModal(false)}
          />
          
          {/* Modal */}
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative w-full max-w-md transform overflow-hidden rounded-2xl bg-white dark:bg-gray-800 shadow-2xl transition-all">
              {/* Header */}
              <div className="relative bg-gradient-to-r from-red-500 to-rose-600 px-6 py-4">
                <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMtOS45NDEgMC0xOCA4LjA1OS0xOCAxOHM4LjA1OSAxOCAxOCAxOCAxOC04LjA1OSAxOC0xOC04LjA1OS0xOC0xOC0xOHptMCAzMmMtNy43MzIgMC0xNC02LjI2OC0xNC0xNHM2LjI2OC0xNCAxNC0xNCAxNCA2LjI2OCAxNCAxNC02LjI2OCAxNC0xNCAxNHoiIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iLjA1Ii8+PC9nPjwvc3ZnPg==')] opacity-30" />
                <div className="relative">
                  <h3 className="text-xl font-bold text-white flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                      <span className="text-xl">⚠️</span>
                    </div>
                    Add RCA Trigger
                  </h3>
                  <p className="text-red-100 text-sm mt-1">Add a new RCA event trigger</p>
                </div>
                <button
                  onClick={() => setShowAddTriggerModal(false)}
                  className="absolute top-4 right-4 p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                >
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              {/* Content */}
              <div className="px-6 py-5 space-y-4">
                {/* RCA Event Trigger */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                    RCA Event Trigger <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={newTrigger.trigger}
                    onChange={(e) => {
                      setNewTrigger(prev => ({ ...prev, trigger: e.target.value }));
                      e.target.style.height = 'auto';
                      const maxHeight = 120;
                      if (e.target.scrollHeight > maxHeight) {
                        e.target.style.height = maxHeight + 'px';
                        e.target.style.overflowY = 'auto';
                      } else {
                        e.target.style.height = e.target.scrollHeight + 'px';
                        e.target.style.overflowY = 'hidden';
                      }
                    }}
                    placeholder="e.g., People Safety - OSHA recordable"
                    rows={1}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all resize-none"
                  />
                </div>

                {/* Event Date */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                    Event Date <span className="text-gray-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="date"
                    value={newTrigger.eventDate}
                    onChange={(e) => setNewTrigger(prev => ({ ...prev, eventDate: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
                  />
                </div>

                {/* Comments */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                    Comments/Notes <span className="text-gray-400 font-normal">(Optional)</span>
                  </label>
                  <textarea
                    value={newTrigger.comments}
                    onChange={(e) => setNewTrigger(prev => ({ ...prev, comments: e.target.value }))}
                    placeholder="Add any notes or context..."
                    rows={3}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all resize-none"
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 flex items-center justify-end gap-3">
                <button
                  onClick={() => {
                    setShowAddTriggerModal(false);
                    setNewTrigger({ trigger: '', eventDate: '', comments: '' });
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (!newTrigger.trigger.trim()) return;
                    try {
                      const created = await createLswRcaTrigger({
                        trigger: newTrigger.trigger,
                        eventDate: newTrigger.eventDate || undefined,
                        comments: newTrigger.comments || undefined,
                      });
                      setRcaTriggers(prev => [...prev, mapTriggerFromDb(created)]);
                      setNewTrigger({ trigger: '', eventDate: '', comments: '' });
                      setShowAddTriggerModal(false);
                    } catch (e) { console.error('Failed to add trigger:', e); }
                  }}
                  disabled={!newTrigger.trigger.trim()}
                  className="px-5 py-2 text-sm font-medium text-white bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed rounded-xl shadow-lg shadow-red-500/25 disabled:shadow-none transition-all"
                >
                  Add Trigger
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Todo Item Modal */}
      {/* Add Meeting Rail Modal */}
      {showAddMeetingRailModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={() => setShowAddMeetingRailModal(false)}
          />
          
          {/* Modal */}
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative w-full max-w-md transform overflow-hidden rounded-2xl bg-white dark:bg-gray-800 shadow-2xl transition-all">
              {/* Header */}
              <div className="relative bg-gradient-to-r from-purple-500 to-pink-600 px-6 py-4">
                <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMtOS45NDEgMC0xOCA4LjA1OS0xOCAxOHM4LjA1OSAxOCAxOCAxOCAxOC04LjA1OSAxOC0xOC04LjA1OS0xOC0xOC0xOHptMCAzMmMtNy43MzIgMC0xNC02LjI2OC0xNC0xNHM2LjI2OC0xNCAxNC0xNCAxNCA2LjI2OCAxNCAxNC02LjI2OCAxNC0xNCAxNHoiIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iLjA1Ii8+PC9nPjwvc3ZnPg==')] opacity-30" />
                <div className="relative">
                  <h3 className="text-xl font-bold text-white flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                      <span className="text-xl">🚂</span>
                    </div>
                    Add Meeting Rail
                  </h3>
                  <p className="text-purple-100 text-sm mt-1">Add a new meeting rail to track</p>
                </div>
                <button
                  onClick={() => setShowAddMeetingRailModal(false)}
                  className="absolute top-4 right-4 p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                >
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              {/* Content */}
              <div className="px-6 py-5 space-y-4">
                {/* Meeting Rail Name */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                    Meeting Rail <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newMeetingRail.rail}
                    onChange={(e) => setNewMeetingRail(prev => ({ ...prev, rail: e.target.value }))}
                    placeholder="e.g., Level 1 - Daily Stand-up"
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                  />
                </div>

                {/* Due Date */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                    Due Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={newMeetingRail.dueDate}
                    onChange={(e) => setNewMeetingRail(prev => ({ ...prev, dueDate: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 flex items-center justify-end gap-3">
                <button
                  onClick={() => {
                    setShowAddMeetingRailModal(false);
                    setNewMeetingRail({ rail: '', dueDate: new Date().toISOString().split('T')[0] });
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (!newMeetingRail.rail.trim()) return;
                    try {
                      const created = await createLswMeetingRail({
                        rail: newMeetingRail.rail,
                        dueDate: newMeetingRail.dueDate,
                        weekNumber: currentWeek,
                        year: currentYear,
                      });
                      setMeetingRails(prev => [...prev, mapMeetingRailFromDb(created)]);
                      setNewMeetingRail({ rail: '', dueDate: new Date().toISOString().split('T')[0] });
                      setShowAddMeetingRailModal(false);
                    } catch (e) { console.error('Failed to add meeting rail:', e); }
                  }}
                  disabled={!newMeetingRail.rail.trim()}
                  className="px-5 py-2 text-sm font-medium text-white bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed rounded-xl shadow-lg shadow-purple-500/25 disabled:shadow-none transition-all"
                >
                  Add Rail
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAddTodoModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={() => setShowAddTodoModal(false)}
          />
          
          {/* Modal */}
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative w-full max-w-md transform overflow-hidden rounded-2xl bg-white dark:bg-gray-800 shadow-2xl transition-all">
              {/* Header */}
              <div className="relative bg-gradient-to-r from-blue-500 to-cyan-600 px-6 py-4">
                <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMtOS45NDEgMC0xOCA4LjA1OS0xOCAxOHM4LjA1OSAxOCAxOCAxOCAxOC04LjA1OSAxOC0xOC04LjA1OS0xOC0xOC0xOHptMCAzMmMtNy43MzIgMC0xNC02LjI2OC0xNC0xNHM2LjI2OC0xNCAxNC0xNCAxNCA2LjI2OCAxNCAxNC02LjI2OCAxNC0xNCAxNHoiIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iLjA1Ii8+PC9nPjwvc3ZnPg==')] opacity-30" />
                <div className="relative">
                  <h3 className="text-xl font-bold text-white flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                      <span className="text-xl">✅</span>
                    </div>
                    Add Todo Item
                  </h3>
                  <p className="text-blue-100 text-sm mt-1">Add a new task to your todo list</p>
                </div>
                <button
                  onClick={() => setShowAddTodoModal(false)}
                  className="absolute top-4 right-4 p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                >
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              {/* Content */}
              <div className="px-6 py-5 space-y-4">
                {/* Task */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                    Task <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newTodoItem.task}
                    onChange={(e) => setNewTodoItem(prev => ({ ...prev, task: e.target.value }))}
                    placeholder="e.g., Complete safety training documentation"
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                </div>

                {/* Time */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                    Time <span className="text-gray-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="time"
                    value={newTodoItem.dueDate}
                    onChange={(e) => setNewTodoItem(prev => ({ ...prev, dueDate: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 flex items-center justify-end gap-3">
                <button
                  onClick={() => {
                    setShowAddTodoModal(false);
                    setNewTodoItem({ task: '', dueDate: '' });
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (!newTodoItem.task.trim()) return;
                    try {
                      const created = await createLswTodoItem({
                        task: newTodoItem.task,
                        dueDate: newTodoItem.dueDate || undefined,
                        weekNumber: currentWeek,
                        year: currentYear,
                      });
                      setTodoItems(prev => [...prev, mapTodoFromDb(created)]);
                      setNewTodoItem({ task: '', dueDate: '' });
                      setShowAddTodoModal(false);
                    } catch (e) { console.error('Failed to add todo:', e); }
                  }}
                  disabled={!newTodoItem.task.trim()}
                  className="px-5 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed rounded-xl shadow-lg shadow-blue-500/25 disabled:shadow-none transition-all"
                >
                  Add Item
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Add Scheduled Task Modal */}
      {showAddScheduledTaskModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={() => setShowAddScheduledTaskModal(false)}
          />
          
          {/* Modal */}
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative w-full max-w-md transform overflow-hidden rounded-2xl bg-white dark:bg-gray-800 shadow-2xl transition-all">
              {/* Header */}
              <div className="relative bg-gradient-to-r from-violet-500 to-purple-600 px-6 py-4">
                <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMtOS45NDEgMC0xOCA4LjA1OS0xOCAxOHM4LjA1OSAxOCAxOCAxOCAxOC04LjA1OSAxOC0xOC04LjA1OS0xOC0xOC0xOHptMCAzMmMtNy43MzIgMC0xNC02LjI2OC0xNC0xNHM2LjI2OC0xNCAxNC0xNCAxNCA2LjI2OCAxNCAxNC02LjI2OCAxNC0xNCAxNHoiIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iLjA1Ii8+PC9nPjwvc3ZnPg==')] opacity-30" />
                <div className="relative">
                  <h3 className="text-xl font-bold text-white flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                      <span className="text-xl">📆</span>
                    </div>
                    Add Scheduled Task
                  </h3>
                  <p className="text-violet-100 text-sm mt-1">Add a new scheduled task or meeting</p>
                </div>
                <button
                  onClick={() => setShowAddScheduledTaskModal(false)}
                  className="absolute top-4 right-4 p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                >
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              {/* Content */}
              <div className="px-6 py-5 space-y-4">
                {/* Task/Meeting */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                    Task/Meeting <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={newScheduledTask.task}
                    onChange={(e) => setNewScheduledTask(prev => ({ ...prev, task: e.target.value }))}
                    placeholder="e.g., Safety Committee Meeting"
                    rows={3}
                    wrap="soft"
                    style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflowWrap: 'break-word' }}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all resize-none overflow-y-auto"
                  />
                </div>

                {/* Frequency */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                    Frequency <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={newScheduledTask.frequency}
                    onChange={(e) => setNewScheduledTask(prev => ({ ...prev, frequency: e.target.value as 'biweekly' | 'monthly' | 'quarterly' | 'annually' }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-white focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
                  >
                    <option value="biweekly">Bi-Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="annually">Annually</option>
                  </select>
                </div>

                {/* Minutes */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                    Duration (Minutes) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={newScheduledTask.minutes}
                    onChange={(e) => setNewScheduledTask(prev => ({ ...prev, minutes: parseInt(e.target.value) || 0 }))}
                    min="1"
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-white focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
                  />
                </div>

                {/* Due Date */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                    Due Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={newScheduledTask.dueDate}
                    onChange={(e) => setNewScheduledTask(prev => ({ ...prev, dueDate: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-white focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
                  />
                </div>
              </div>
              
              {/* Footer */}
              <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
                <button
                  onClick={() => setShowAddScheduledTaskModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (!newScheduledTask.task.trim() || !newScheduledTask.dueDate || newScheduledTask.minutes <= 0) return;
                    try {
                      const created = await createLswFrequencyTask({
                        task: newScheduledTask.task,
                        minutes: newScheduledTask.minutes,
                        dueDate: newScheduledTask.dueDate,
                        frequency: FREQ_UI_TO_DB[newScheduledTask.frequency],
                        weekNumber: currentWeek,
                        year: currentYear,
                      });
                      setFrequencyTasks(prev => [...prev, mapFreqTaskFromDb(created)]);
                      setNewScheduledTask({ task: '', minutes: 60, dueDate: new Date().toISOString().split('T')[0], frequency: 'biweekly' });
                      setShowAddScheduledTaskModal(false);
                    } catch (e) { console.error('Failed to add scheduled task:', e); }
                  }}
                  disabled={!newScheduledTask.task.trim() || !newScheduledTask.dueDate || newScheduledTask.minutes <= 0}
                  className="px-5 py-2 text-sm font-medium text-white bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed rounded-xl shadow-lg shadow-violet-500/25 disabled:shadow-none transition-all"
                >
                  Add Task
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Goal Modal */}
      {showAddGoalModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={() => setShowAddGoalModal(false)}
          />
          
          {/* Modal */}
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative w-full max-w-md transform overflow-hidden rounded-2xl bg-white dark:bg-gray-800 shadow-2xl transition-all">
              {/* Header */}
              <div className="relative bg-gradient-to-r from-rose-500 to-pink-600 px-6 py-4">
                <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMtOS45NDEgMC0xOCA4LjA1OS0xOCAxOHM4LjA1OSAxOCAxOCAxOCAxOC04LjA1OSAxOC0xOC04LjA1OS0xOC0xOC0xOHptMCAzMmMtNy43MzIgMC0xNC02LjI2OC0xNC0xNHM2LjI2OC0xNCAxNC0xNCAxNCA2LjI2OCAxNCAxNC02LjI2OCAxNC0xNCAxNHoiIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iLjA1Ii8+PC9nPjwvc3ZnPg==')] opacity-30" />
                <div className="relative">
                  <h3 className="text-xl font-bold text-white flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                      <span className="text-xl">🎯</span>
                    </div>
                    Add Personal Goal
                  </h3>
                  <p className="text-rose-100 text-sm mt-1">Set a new personal objective to track</p>
                </div>
                <button
                  onClick={() => setShowAddGoalModal(false)}
                  className="absolute top-4 right-4 p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                  title="Close"
                >
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              {/* Content */}
              <div className="px-6 py-5 space-y-4">
                {/* Objective */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                    Objective <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={newGoal.objective}
                    onChange={(e) => {
                      setNewGoal(prev => ({ ...prev, objective: e.target.value }));
                      e.target.style.height = 'auto';
                      const maxHeight = 120;
                      if (e.target.scrollHeight > maxHeight) {
                        e.target.style.height = maxHeight + 'px';
                        e.target.style.overflowY = 'auto';
                      } else {
                        e.target.style.height = e.target.scrollHeight + 'px';
                        e.target.style.overflowY = 'hidden';
                      }
                    }}
                    placeholder="e.g., Complete Lean Six Sigma Certification"
                    rows={1}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-rose-500 focus:border-transparent transition-all resize-none"
                  />
                </div>

                {/* Due Date */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                    Due Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={newGoal.dueDate}
                    onChange={(e) => setNewGoal(prev => ({ ...prev, dueDate: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-white focus:ring-2 focus:ring-rose-500 focus:border-transparent transition-all"
                  />
                </div>

                {/* Progress */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                    Initial Progress <span className="text-gray-400 font-normal">({newGoal.progress}%)</span>
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={newGoal.progress}
                    onChange={(e) => setNewGoal(prev => ({ ...prev, progress: parseInt(e.target.value) }))}
                    className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-rose-500"
                  />
                  <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>0%</span>
                    <span>50%</span>
                    <span>100%</span>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 flex items-center justify-end gap-3">
                <button
                  onClick={() => {
                    setShowAddGoalModal(false);
                    setNewGoal({ objective: '', dueDate: '', progress: 0 });
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (!newGoal.objective.trim() || !newGoal.dueDate) return;
                    try {
                      const created = await createLswPersonalGoal({
                        objective: newGoal.objective,
                        dueDate: newGoal.dueDate,
                        progress: newGoal.progress,
                      });
                      setPersonalGoals(prev => [...prev, mapGoalFromDb(created)]);
                      setNewGoal({ objective: '', dueDate: '', progress: 0 });
                      setShowAddGoalModal(false);
                    } catch (e) { console.error('Failed to add goal:', e); }
                  }}
                  disabled={!newGoal.objective.trim() || !newGoal.dueDate}
                  className="px-5 py-2 text-sm font-medium text-white bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed rounded-xl shadow-lg shadow-rose-500/25 disabled:shadow-none transition-all"
                >
                  Add Goal
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ──── Early Completion Log Modal ──── */}
      {showEarlyLogModal && (() => {
        const EARLY_LOG_FIELDS: { key: string; label: string; align: string }[] = [
          { key: 'taskName', label: 'Task', align: 'left' },
          { key: 'taskTime', label: 'Time', align: 'center' },
          { key: 'dayLabel', label: 'Day', align: 'center' },
          { key: 'scheduledDate', label: 'Scheduled Date', align: 'center' },
          { key: 'completedAt', label: 'Completed At', align: 'center' },
        ];

        // Apply filters
        let filtered = [...earlyCompletionLogs];
        for (const f of earlyLogFilters) {
          filtered = filtered.filter(log => {
            const val = f.field === 'scheduledDate'
              ? (log.scheduledDate ? new Date(log.scheduledDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '')
              : f.field === 'completedAt'
              ? new Date(log.completedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })
              : (log as any)[f.field] || '';
            return String(val).toLowerCase().includes(f.value.toLowerCase());
          });
        }

        // Apply sort
        filtered.sort((a, b) => {
          const field = earlyLogSort.field;
          let aVal: any, bVal: any;
          if (field === 'scheduledDate' || field === 'completedAt') {
            aVal = new Date((a as any)[field]).getTime();
            bVal = new Date((b as any)[field]).getTime();
          } else {
            aVal = ((a as any)[field] || '').toLowerCase();
            bVal = ((b as any)[field] || '').toLowerCase();
          }
          if (aVal < bVal) return earlyLogSort.dir === 'asc' ? -1 : 1;
          if (aVal > bVal) return earlyLogSort.dir === 'asc' ? 1 : -1;
          return 0;
        });

        const toggleSort = (field: string) => {
          setEarlyLogSort(prev => prev.field === field
            ? { field, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
            : { field, dir: 'asc' }
          );
        };

        const handleColumnContextMenu = (e: React.MouseEvent, field: string, value?: string) => {
          e.preventDefault();
          setEarlyLogContextMenu({ x: e.clientX, y: e.clientY, field, value });
        };

        const getCellDisplayValue = (log: LswEarlyCompletionLog, field: string): string => {
          if (field === 'scheduledDate') return log.scheduledDate ? new Date(log.scheduledDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
          if (field === 'completedAt') return new Date(log.completedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
          return (log as any)[field] || '';
        };

        const tryAddFilter = (field: string, value?: string) => {
          // Check for duplicate
          const alreadyExists = earlyLogFilters.some(f => f.field === field);
          if (alreadyExists) {
            const label = EARLY_LOG_FIELDS.find(c => c.key === field)?.label || field;
            setEarlyLogDuplicateMsg(`A filter for "${label}" already exists.`);
            setTimeout(() => setEarlyLogDuplicateMsg(null), 30000);
            return;
          }
          setEarlyLogDuplicateMsg(null);
          setEarlyLogFilters(prev => [...prev, { field, value: value || '' }]);
          if (!earlyLogFilterPanelOpen) setEarlyLogFilterPanelOpen(true);
          setEarlyLogContextMenu(null);
        };

        const removeFilter = (idx: number) => {
          setEarlyLogFilters(prev => {
            const next = prev.filter((_, i) => i !== idx);
            if (next.length === 0) setEarlyLogFilterPanelOpen(false);
            return next;
          });
        };

        const clearAllFilters = () => {
          setEarlyLogFilters([]);
          setEarlyLogFilterPanelOpen(false);
          setEarlyLogDuplicateMsg(null);
        };

        const updateFilter = (idx: number, key: 'field' | 'value', val: string) => {
          if (key === 'field') {
            // Check if changing to a field that already exists
            const alreadyExists = earlyLogFilters.some((f, i) => i !== idx && f.field === val);
            if (alreadyExists) {
              const label = EARLY_LOG_FIELDS.find(c => c.key === val)?.label || val;
              setEarlyLogDuplicateMsg(`A filter for "${label}" already exists.`);
              setTimeout(() => setEarlyLogDuplicateMsg(null), 30000);
              return;
            }
            setEarlyLogDuplicateMsg(null);
          }
          setEarlyLogFilters(prev => prev.map((f, i) => i === idx ? { ...f, [key]: val } : f));
        };

        const panelOpen = earlyLogFilterPanelOpen;

        return (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setEarlyLogContextMenu(null)}>
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => { setShowEarlyLogModal(false); setEarlyLogContextMenu(null); clearAllFilters(); }} />

          {/* Container: Side Panel + Modal */}
          <div className="relative flex items-stretch max-h-[85vh]">

            {/* ─── Side Filter Panel ─── */}
            <div
              className={`bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 border-r-0 rounded-l-2xl shadow-2xl flex flex-col overflow-hidden transition-all duration-300 ease-in-out ${
                panelOpen ? 'w-72 opacity-100 translate-x-0' : 'w-0 opacity-0 -translate-x-4 pointer-events-none'
              }`}
            >
              {/* Panel Header */}
              <div className="flex items-center justify-between px-4 py-4 bg-gradient-to-b from-gray-50 to-white dark:from-gray-750 dark:to-gray-800 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                  </svg>
                  <h4 className="text-sm font-bold text-gray-800 dark:text-gray-200">Filters</h4>
                  {earlyLogFilters.length > 0 && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">
                      {earlyLogFilters.length}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setEarlyLogFilterPanelOpen(false)}
                  className="p-1 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  title="Close filter panel"
                >
                  <svg className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
              </div>

              {/* Duplicate Warning */}
              {earlyLogDuplicateMsg && (
                <div className="mx-3 mt-3 px-3 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700/50 rounded-lg flex items-start gap-2 animate-fade-in">
                  <svg className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  <div className="flex-1">
                    <p className="text-xs font-medium text-red-700 dark:text-red-300">{earlyLogDuplicateMsg}</p>
                    <button onClick={() => setEarlyLogDuplicateMsg(null)} className="text-[10px] text-red-500 hover:text-red-700 mt-0.5 underline">Dismiss</button>
                  </div>
                </div>
              )}

              {/* Filter List */}
              <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
                {earlyLogFilters.map((f, idx) => (
                  <div key={idx} className="bg-gray-50 dark:bg-gray-750 rounded-xl p-3 border border-gray-200 dark:border-gray-600 space-y-2 animate-fade-in">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Filter {idx + 1}</span>
                      <button
                        onClick={() => removeFilter(idx)}
                        className="p-0.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
                        title="Remove filter"
                      >
                        <svg className="w-3.5 h-3.5 text-gray-400 hover:text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <select
                      value={f.field}
                      onChange={(e) => updateFilter(idx, 'field', e.target.value)}
                      className="w-full text-xs py-1.5 px-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-1 focus:ring-amber-400 text-gray-700 dark:text-gray-300 font-medium cursor-pointer"
                    >
                      {EARLY_LOG_FIELDS.map(col => (
                        <option key={col.key} value={col.key}>{col.label}</option>
                      ))}
                    </select>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-gray-400 font-medium">contains</span>
                    </div>
                    <input
                      type="text"
                      value={f.value}
                      onChange={(e) => updateFilter(idx, 'value', e.target.value)}
                      placeholder="type to filter..."
                      className="w-full text-xs py-1.5 px-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-1 focus:ring-amber-400 text-gray-700 dark:text-gray-300 placeholder-gray-400"
                      autoFocus={idx === earlyLogFilters.length - 1}
                    />
                  </div>
                ))}

                {earlyLogFilters.length === 0 && (
                  <div className="text-center py-6">
                    <svg className="w-8 h-8 mx-auto text-gray-300 dark:text-gray-600 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                    </svg>
                    <p className="text-xs text-gray-400 dark:text-gray-500">No active filters</p>
                  </div>
                )}
              </div>

              {/* Panel Footer */}
              <div className="px-3 py-3 border-t border-gray-200 dark:border-gray-700 flex-shrink-0 space-y-2">
                <button
                  onClick={() => tryAddFilter('taskName')}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/40 rounded-lg transition-colors border border-amber-200 dark:border-amber-700/50"
                  title="Add a new filter"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Filter
                </button>
                {earlyLogFilters.length > 0 && (
                  <button
                    onClick={clearAllFilters}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors border border-red-200 dark:border-red-700/30"
                    title="Clear all filters"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Clear All
                  </button>
                )}
              </div>
            </div>

            {/* ─── Main Modal ─── */}
            <div className={`relative w-[90vw] max-w-5xl bg-white dark:bg-gray-800 shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden animate-fade-in max-h-[85vh] flex flex-col ${
              panelOpen ? 'rounded-r-2xl' : 'rounded-2xl'
            }`}>
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-900/30 dark:to-yellow-900/30 border-b border-amber-200 dark:border-amber-700/50 flex-shrink-0">
                <div className="flex items-center gap-2">
                  {/* Toggle Filter Panel Button */}
                  <button
                    onClick={() => {
                      if (panelOpen) {
                        setEarlyLogFilterPanelOpen(false);
                      } else {
                        setEarlyLogFilterPanelOpen(true);
                      }
                    }}
                    className={`p-1.5 rounded-lg transition-all duration-200 ${
                      panelOpen
                        ? 'bg-amber-200 dark:bg-amber-700/50 text-amber-800 dark:text-amber-200'
                        : 'hover:bg-amber-200/50 dark:hover:bg-amber-800/50 text-amber-600 dark:text-amber-400'
                    }`}
                    title={panelOpen ? 'Close filter panel' : 'Open filter panel'}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                    </svg>
                  </button>
                  <span className="text-xl">⚡</span>
                  <h3 className="text-base font-bold text-amber-800 dark:text-amber-200">Early Completion Log</h3>
                  {earlyCompletionLogs.length > 0 && (
                    <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">
                      {filtered.length}{filtered.length !== earlyCompletionLogs.length ? ` / ${earlyCompletionLogs.length}` : ''}
                    </span>
                  )}
                  {earlyLogFilters.length > 0 && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300">
                      {earlyLogFilters.length} filter{earlyLogFilters.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => { setShowEarlyLogModal(false); setEarlyLogContextMenu(null); clearAllFilters(); }}
                  className="p-1.5 rounded-lg hover:bg-amber-200/50 dark:hover:bg-amber-800/50 transition-colors"
                  title="Close"
                >
                  <svg className="w-4 h-4 text-amber-700 dark:text-amber-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Body */}
              <div className="overflow-auto flex-1">
                {earlyCompletionLogs.length > 0 ? (
                  <table className="w-full">
                    <thead>
                      <tr className="bg-amber-50 dark:bg-amber-900/20 sticky top-0 z-10">
                        {EARLY_LOG_FIELDS.map(col => (
                          <th
                            key={col.key}
                            className={`px-4 py-3 text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wide cursor-pointer select-none hover:bg-amber-100 dark:hover:bg-amber-800/30 transition-colors ${col.align === 'left' ? 'text-left' : 'text-center'} ${col.key === 'taskName' ? '' : col.key === 'completedAt' || col.key === 'scheduledDate' ? 'w-44' : 'w-24'}`}
                            onClick={() => toggleSort(col.key)}
                            onContextMenu={(e) => handleColumnContextMenu(e, col.key)}
                          >
                            <div className={`flex items-center gap-1 ${col.align === 'center' ? 'justify-center' : ''}`}>
                              {col.label}
                              {earlyLogSort.field === col.key && (
                                <svg className="w-3 h-3 text-amber-600 dark:text-amber-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  {earlyLogSort.dir === 'asc'
                                    ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                    : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                  }
                                </svg>
                              )}
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {filtered.length > 0 ? filtered.map((log) => (
                        <tr key={log.id} className="hover:bg-amber-50/50 dark:hover:bg-amber-900/10 transition-colors">
                          <td className="px-4 py-3 text-sm font-medium text-gray-800 dark:text-white cursor-context-menu" onContextMenu={(e) => handleColumnContextMenu(e, 'taskName', log.taskName)}>{log.taskName}</td>
                          <td className="px-4 py-3 text-sm text-center text-gray-600 dark:text-gray-300 cursor-context-menu" onContextMenu={(e) => handleColumnContextMenu(e, 'taskTime', log.taskTime || '')}>{log.taskTime || '—'}</td>
                          <td className="px-4 py-3 text-center cursor-context-menu" onContextMenu={(e) => handleColumnContextMenu(e, 'dayLabel', log.dayLabel)}>
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">
                              {log.dayLabel}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-center text-gray-600 dark:text-gray-300 cursor-context-menu" onContextMenu={(e) => handleColumnContextMenu(e, 'scheduledDate', getCellDisplayValue(log, 'scheduledDate'))}>
                            {log.scheduledDate ? new Date(log.scheduledDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                          </td>
                          <td className="px-4 py-3 text-sm text-center text-gray-500 dark:text-gray-400 cursor-context-menu" onContextMenu={(e) => handleColumnContextMenu(e, 'completedAt', getCellDisplayValue(log, 'completedAt'))}>
                            {new Date(log.completedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}
                          </td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                            No results match your filters
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                ) : (
                  <div className="px-5 py-10 text-center">
                    <span className="text-4xl block mb-3">📋</span>
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">No early completions this week</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Tasks marked as early completed will appear here</p>
                  </div>
                )}
              </div>

              {/* Footer */}
              {filtered.length > 0 && (
                <div className="px-6 py-2.5 bg-gray-50 dark:bg-gray-750 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Showing {filtered.length} of {earlyCompletionLogs.length} entries
                    {earlyLogSort.field && (
                      <> · Sorted by <span className="font-medium">{EARLY_LOG_FIELDS.find(c => c.key === earlyLogSort.field)?.label}</span> ({earlyLogSort.dir === 'asc' ? '↑ Ascending' : '↓ Descending'})</>
                    )}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Right-click Context Menu */}
          {earlyLogContextMenu && (
            <div
              className="fixed z-[60] bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 py-1.5 w-48 animate-fade-in"
              style={{ top: earlyLogContextMenu.y, left: earlyLogContextMenu.x }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => { setEarlyLogSort({ field: earlyLogContextMenu.field, dir: 'asc' }); setEarlyLogContextMenu(null); }}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2.5 transition-colors"
              >
                <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
                Sort Ascending
              </button>
              <button
                onClick={() => { setEarlyLogSort({ field: earlyLogContextMenu.field, dir: 'desc' }); setEarlyLogContextMenu(null); }}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2.5 transition-colors"
              >
                <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
                Sort Descending
              </button>
              <div className="mx-3 my-1 border-t border-gray-200 dark:border-gray-700" />
              {earlyLogContextMenu.value ? (
                <button
                  onClick={() => {
                    const field = earlyLogContextMenu.field;
                    const value = earlyLogContextMenu.value || '';
                    // Replace existing filter for this field, or add new
                    const existingIdx = earlyLogFilters.findIndex(f => f.field === field);
                    if (existingIdx >= 0) {
                      setEarlyLogFilters(prev => prev.map((f, i) => i === existingIdx ? { ...f, value } : f));
                    } else {
                      setEarlyLogFilters(prev => [...prev, { field, value }]);
                    }
                    if (!earlyLogFilterPanelOpen) setEarlyLogFilterPanelOpen(true);
                    setEarlyLogContextMenu(null);
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2.5 transition-colors"
                >
                  <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                  </svg>
                  <span className="truncate">Filter: <strong className="text-amber-600 dark:text-amber-400">{earlyLogContextMenu.value.length > 20 ? earlyLogContextMenu.value.slice(0, 20) + '…' : earlyLogContextMenu.value}</strong></span>
                </button>
              ) : (
                <>
                  <button
                    onClick={() => tryAddFilter(earlyLogContextMenu.field)}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2.5 transition-colors"
                  >
                    <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                    </svg>
                    Filter This Column
                  </button>
                  <button
                    onClick={() => tryAddFilter(earlyLogContextMenu.field)}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2.5 transition-colors"
                  >
                    <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add to Filters
                  </button>
                </>
              )}
            </div>
          )}
        </div>
        );
      })()}

      {/* ──── Uncheck Confirmation Modal ──── */}
      {showUncheckModal && uncheckContext && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => { setShowUncheckModal(false); setUncheckContext(null); }} />
          {/* Modal */}
          <div className="relative w-full max-w-sm mx-4 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden animate-fade-in">
            {/* Header */}
            <div className={`flex items-center justify-between px-5 py-4 border-b ${
              uncheckContext.isEarlyCompleted
                ? 'bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-900/30 dark:to-amber-900/30 border-yellow-200 dark:border-yellow-700/50'
                : 'bg-gradient-to-r from-gray-50 to-slate-50 dark:from-gray-700/50 dark:to-slate-700/50 border-gray-200 dark:border-gray-600/50'
            }`}>
              <div className="flex items-center gap-2">
                <span className="text-xl">{uncheckContext.isEarlyCompleted ? '⚡' : '☑️'}</span>
                <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200">Confirm Uncheck</h3>
              </div>
              <button
                onClick={() => { setShowUncheckModal(false); setUncheckContext(null); }}
                className="p-1.5 rounded-lg hover:bg-gray-200/50 dark:hover:bg-gray-600/50 transition-colors"
              >
                <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {/* Body */}
            <div className="px-5 py-4">
              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                Are you sure you want to uncheck{' '}
                <span className="font-semibold text-gray-900 dark:text-white">{uncheckContext.taskName}</span>{' '}
                on <span className="font-bold text-black dark:text-white">{uncheckContext.dayLabel}</span>{' '}
                as {uncheckContext.isEarlyCompleted ? 'early completed' : 'completed'}?
              </p>
              {/* Actions */}
              <div className="flex items-center gap-3 mt-5">
                <button
                  onClick={() => { setShowUncheckModal(false); setUncheckContext(null); }}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmUncheck}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-xl shadow-md hover:shadow-lg transition-all"
                >
                  OK, Uncheck
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ──── Future Task Block Modal ──── */}
      {showFutureBlockModal && futureBlockContext && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowFutureBlockModal(false)} />
          {/* Modal */}
          <div className="relative w-full max-w-md mx-4 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-900/30 dark:to-orange-900/30 border-b border-red-200 dark:border-red-700/50">
              <div className="flex items-center gap-2">
                <span className="text-xl">🚫</span>
                <h3 className="text-sm font-bold text-red-800 dark:text-red-200">Future Task</h3>
              </div>
              <button
                onClick={() => setShowFutureBlockModal(false)}
                className="p-1.5 rounded-lg hover:bg-red-200/50 dark:hover:bg-red-800/50 transition-colors"
              >
                <svg className="w-4 h-4 text-red-700 dark:text-red-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {/* Body */}
            <div className="px-5 py-4">
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700/50 rounded-xl p-4 mb-4">
                <p className="text-sm text-red-800 dark:text-red-200 leading-relaxed">
                  Sorry, you cannot check off this task as completed because it is still in the future. You are allowed to check off your task if you forget to do so, but not a task or meeting that is yet to be completed.
                </p>
                <p className="text-sm text-red-800 dark:text-red-200 leading-relaxed mt-3">
                  If you think this task or meeting was completed at an earlier time prior, please click the <strong>Early Completed</strong> button.
                </p>
              </div>
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 rounded-lg p-3 mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm">⚠️</span>
                  <p className="text-xs text-amber-700 dark:text-amber-300 font-medium">
                    Note: This task will be marked as early complete and logged for audit purposes.
                  </p>
                </div>
              </div>
              {/* Task details */}
              <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-5">
                <span className="font-semibold text-gray-700 dark:text-gray-300">{futureBlockContext.taskName}</span>
                <span>•</span>
                <span>{futureBlockContext.taskTime}</span>
                <span>•</span>
                <span>{dayLabelMap[futureBlockContext.day as keyof typeof dayLabelMap] || futureBlockContext.day}</span>
              </div>
              {/* Actions */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowFutureBlockModal(false)}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleEarlyComplete}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 rounded-xl shadow-md hover:shadow-lg transition-all"
                >
                  ⚡ Early Completed
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ──── Overdue Tasks Notification Modal ──── */}
      {showOverdueModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowOverdueModal(false)} />
          {/* Modal */}
          <div className="relative w-full max-w-lg mx-4 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/30 dark:to-orange-900/30 border-b border-amber-200 dark:border-amber-700/50">
              <div className="flex items-center gap-2">
                <span className="text-xl">🔔</span>
                <h3 className="text-sm font-bold text-amber-800 dark:text-amber-200">Task Notifications</h3>
              </div>
              <button
                onClick={() => setShowOverdueModal(false)}
                className="p-1.5 rounded-lg hover:bg-amber-200/50 dark:hover:bg-amber-800/50 transition-colors"
              >
                <svg className="w-4 h-4 text-amber-700 dark:text-amber-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {/* Body */}
            <div className="px-5 py-4 max-h-[60vh] overflow-y-auto">
              {(() => {
                const overdue = getOverdueTasks();
                if (overdue.totalCount === 0) {
                  return (
                    <div className="text-center py-8">
                      <span className="text-4xl block mb-3">✅</span>
                      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">All caught up!</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">No overdue tasks or meetings.</p>
                    </div>
                  );
                }
                return (
                  <>
                    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 rounded-xl p-3 mb-4">
                      <p className="text-xs font-semibold text-amber-800 dark:text-amber-200">
                        ⚠️ You have {overdue.totalCount} unchecked task/meeting{overdue.totalCount !== 1 ? 's' : ''} past their scheduled time
                      </p>
                      <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-1">
                        Please check your tasks/meetings if they were already completed. If not, try to complete all your tasks and attend your meetings on time.
                      </p>
                    </div>
                    <div className="space-y-2">
                      {overdue.tasks.map(task => (
                        <div key={task.taskId} className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-600/50">
                          <span className="text-lg flex-shrink-0">🕐</span>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">{task.task}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs text-gray-500 dark:text-gray-400">Scheduled: {task.time}</span>
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 font-medium">
                                {task.overdueDays.join(', ')}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function LSWPage() {
  return (
    <ProtectedRoute>
      <LSWContent />
    </ProtectedRoute>
  );
}
