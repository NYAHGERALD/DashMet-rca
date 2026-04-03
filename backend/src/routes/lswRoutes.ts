import { Router, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { authenticate } from '../middleware/auth';
import lswService from '../services/lswService';
import { websocketService } from '../services/websocketService';

const router = Router();

// All LSW routes require authentication
router.use(authenticate);

// ─────────────────────────────────────────────────────────────────────────────
// Bulk Fetch: GET /api/lsw/data?weekNumber=8&year=2026
// Returns all LSW data for the authenticated user in one call
// ─────────────────────────────────────────────────────────────────────────────
router.get('/data', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const organizationId = req.user!.organizationId;
    const weekNumber = parseInt(req.query.weekNumber as string);
    const year = parseInt(req.query.year as string);

    if (!weekNumber || !year || !organizationId) {
      return res.status(400).json({ success: false, error: 'weekNumber, year, and organizationId are required' });
    }

    const data = await lswService.getFullLswData(userId, organizationId, weekNumber, year);
    res.json({ success: true, data });
  } catch (error: any) {
    console.error('Error fetching LSW data:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Board
// ─────────────────────────────────────────────────────────────────────────────
router.put('/board', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { weekNumber, year, ...data } = req.body;
    const board = await lswService.updateBoard(userId, weekNumber, year, data);
    res.json({ success: true, data: board });
  } catch (error: any) {
    console.error('Error updating LSW board:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// User Preferences (work days per week)
// ─────────────────────────────────────────────────────────────────────────────
router.put('/preferences/work-days', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { workDaysPerWeek } = req.body;
    if (!workDaysPerWeek || workDaysPerWeek < 5 || workDaysPerWeek > 7) {
      return res.status(400).json({ success: false, error: 'workDaysPerWeek must be 5, 6, or 7' });
    }
    const result = await lswService.updateWorkDaysPerWeek(userId, workDaysPerWeek);
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Error updating work days preference:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Departments (read-only – uses real Department table)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/departments', async (req: AuthRequest, res: Response) => {
  try {
    const organizationId = req.user!.organizationId;
    const facilityId = req.query.facilityId as string | undefined;
    const departments = await lswService.getDepartments(organizationId, facilityId);
    res.json({ success: true, data: departments });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Daily Tasks
// ─────────────────────────────────────────────────────────────────────────────
router.get('/daily-tasks', async (req: AuthRequest, res: Response) => {
  try {
    const weekNumber = req.query.weekNumber ? parseInt(req.query.weekNumber as string) : undefined;
    const year = req.query.year ? parseInt(req.query.year as string) : undefined;
    const tasks = await lswService.getDailyTasks(req.user!.id, weekNumber, year);
    res.json({ success: true, data: tasks });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/daily-tasks', async (req: AuthRequest, res: Response) => {
  try {
    const task = await lswService.createDailyTask({ ...req.body, userId: req.user!.id });
    res.status(201).json({ success: true, data: task });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/daily-tasks/:id', async (req: AuthRequest, res: Response) => {
  try {
    const task = await lswService.updateDailyTask(req.params.id, req.user!.id, req.body);
    res.json({ success: true, data: task });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/daily-tasks/:id', async (req: AuthRequest, res: Response) => {
  try {
    await lswService.deleteDailyTask(req.params.id, req.user!.id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Daily Task Completion (per-week checkbox state)
router.put('/daily-tasks/:id/completion', async (req: AuthRequest, res: Response) => {
  try {
    const { weekNumber, year, day, value } = req.body;
    if (!weekNumber || !year || !day || value === undefined) {
      return res.status(400).json({ success: false, error: 'weekNumber, year, day, and value are required' });
    }
    const completion = await lswService.upsertDailyTaskCompletion(req.params.id, weekNumber, year, day, value);
    // Notify all connected clients for this user (other tabs/devices)
    websocketService.emitToUser(req.user!.id, 'lsw:completion-changed', { weekNumber, year });
    res.json({ success: true, data: completion });
  } catch (error: any) {
    console.error('Error updating daily task completion:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Todo Items
// ─────────────────────────────────────────────────────────────────────────────
router.get('/todo-items', async (req: AuthRequest, res: Response) => {
  try {
    const weekNumber = req.query.weekNumber ? parseInt(req.query.weekNumber as string) : undefined;
    const year = req.query.year ? parseInt(req.query.year as string) : undefined;
    const items = await lswService.getTodoItems(req.user!.id, weekNumber, year);
    res.json({ success: true, data: items });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/todo-items', async (req: AuthRequest, res: Response) => {
  try {
    const item = await lswService.createTodoItem({ ...req.body, userId: req.user!.id });
    res.status(201).json({ success: true, data: item });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/todo-items/:id', async (req: AuthRequest, res: Response) => {
  try {
    const item = await lswService.updateTodoItem(req.params.id, req.user!.id, req.body);
    res.json({ success: true, data: item });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/todo-items/:id', async (req: AuthRequest, res: Response) => {
  try {
    await lswService.deleteTodoItem(req.params.id, req.user!.id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Frequency Tasks (Scheduled Tasks/Meetings)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/frequency-tasks', async (req: AuthRequest, res: Response) => {
  try {
    const tasks = await lswService.getFrequencyTasks(req.user!.id);
    res.json({ success: true, data: tasks });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/frequency-tasks', async (req: AuthRequest, res: Response) => {
  try {
    const { task: taskName, minutes, dueDate, frequency, weekNumber, year } = req.body;
    const newTask = await lswService.createFrequencyTask({
      userId: req.user!.id,
      task: taskName,
      minutes,
      dueDate,
      frequency,
      weekNumber: weekNumber ? parseInt(weekNumber) : undefined,
      year: year ? parseInt(year) : undefined,
    });
    res.status(201).json({ success: true, data: newTask });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/frequency-tasks/:id', async (req: AuthRequest, res: Response) => {
  try {
    const task = await lswService.updateFrequencyTask(req.params.id, req.user!.id, req.body);
    res.json({ success: true, data: task });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/frequency-tasks/:id', async (req: AuthRequest, res: Response) => {
  try {
    await lswService.deleteFrequencyTask(req.params.id, req.user!.id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Projects
// ─────────────────────────────────────────────────────────────────────────────
router.get('/projects', async (req: AuthRequest, res: Response) => {
  try {
    const projects = await lswService.getProjects(req.user!.id);
    res.json({ success: true, data: projects });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/projects', async (req: AuthRequest, res: Response) => {
  try {
    const project = await lswService.createProject({ ...req.body, userId: req.user!.id });
    res.status(201).json({ success: true, data: project });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/projects/:id', async (req: AuthRequest, res: Response) => {
  try {
    const project = await lswService.updateProject(req.params.id, req.user!.id, req.body);
    res.json({ success: true, data: project });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/projects/:id', async (req: AuthRequest, res: Response) => {
  try {
    await lswService.deleteProject(req.params.id, req.user!.id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Project Updates
router.post('/projects/:projectId/updates', async (req: AuthRequest, res: Response) => {
  try {
    const update = await lswService.addProjectUpdate(req.params.projectId, req.body);
    res.status(201).json({ success: true, data: update });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/project-updates/:id', async (req: AuthRequest, res: Response) => {
  try {
    const update = await lswService.updateProjectUpdate(req.params.id, req.body);
    res.json({ success: true, data: update });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/project-updates/:id', async (req: AuthRequest, res: Response) => {
  try {
    await lswService.deleteProjectUpdate(req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Meeting Rails
// ─────────────────────────────────────────────────────────────────────────────
router.get('/meeting-rails', async (req: AuthRequest, res: Response) => {
  try {
    const rails = await lswService.getMeetingRails(req.user!.id);
    res.json({ success: true, data: rails });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/meeting-rails', async (req: AuthRequest, res: Response) => {
  try {
    const rail = await lswService.createMeetingRail({ ...req.body, userId: req.user!.id });
    res.status(201).json({ success: true, data: rail });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/meeting-rails/:id', async (req: AuthRequest, res: Response) => {
  try {
    const rail = await lswService.updateMeetingRail(req.params.id, req.user!.id, req.body);
    res.json({ success: true, data: rail });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/meeting-rails/:id', async (req: AuthRequest, res: Response) => {
  try {
    await lswService.deleteMeetingRail(req.params.id, req.user!.id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Follow Ups
// ─────────────────────────────────────────────────────────────────────────────
router.get('/follow-ups', async (req: AuthRequest, res: Response) => {
  try {
    const followUps = await lswService.getFollowUps(req.user!.id);
    res.json({ success: true, data: followUps });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/follow-ups', async (req: AuthRequest, res: Response) => {
  try {
    const followUp = await lswService.createFollowUp({ ...req.body, userId: req.user!.id });
    res.status(201).json({ success: true, data: followUp });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/follow-ups/:id', async (req: AuthRequest, res: Response) => {
  try {
    const followUp = await lswService.updateFollowUp(req.params.id, req.user!.id, req.body);
    res.json({ success: true, data: followUp });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/follow-ups/:id', async (req: AuthRequest, res: Response) => {
  try {
    await lswService.deleteFollowUp(req.params.id, req.user!.id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Key Result Sets & Key Results
// ─────────────────────────────────────────────────────────────────────────────
router.get('/key-result-sets', async (req: AuthRequest, res: Response) => {
  try {
    const sets = await lswService.getKeyResultSets(req.user!.id, req.user!.organizationId);
    res.json({ success: true, data: sets });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/key-result-sets', async (req: AuthRequest, res: Response) => {
  try {
    const set = await lswService.createKeyResultSet({
      ...req.body,
      userId: req.user!.id,
      organizationId: req.user!.organizationId,
    });
    res.status(201).json({ success: true, data: set });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/key-result-sets/:id', async (req: AuthRequest, res: Response) => {
  try {
    const set = await lswService.updateKeyResultSet(req.params.id, req.body);
    res.json({ success: true, data: set });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/key-result-sets/:id', async (req: AuthRequest, res: Response) => {
  try {
    await lswService.deleteKeyResultSet(req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Key Results (individual metrics)
router.post('/key-results', async (req: AuthRequest, res: Response) => {
  try {
    const result = await lswService.createKeyResult(req.body);
    res.status(201).json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/key-results/:id', async (req: AuthRequest, res: Response) => {
  try {
    const result = await lswService.updateKeyResult(req.params.id, req.body);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/key-results/:id', async (req: AuthRequest, res: Response) => {
  try {
    await lswService.deleteKeyResult(req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Personal Goals
// ─────────────────────────────────────────────────────────────────────────────
router.get('/personal-goals', async (req: AuthRequest, res: Response) => {
  try {
    const goals = await lswService.getPersonalGoals(req.user!.id);
    res.json({ success: true, data: goals });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/personal-goals', async (req: AuthRequest, res: Response) => {
  try {
    const goal = await lswService.createPersonalGoal({ ...req.body, userId: req.user!.id });
    res.status(201).json({ success: true, data: goal });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/personal-goals/:id', async (req: AuthRequest, res: Response) => {
  try {
    const goal = await lswService.updatePersonalGoal(req.params.id, req.user!.id, req.body);
    res.json({ success: true, data: goal });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/personal-goals/:id', async (req: AuthRequest, res: Response) => {
  try {
    await lswService.deletePersonalGoal(req.params.id, req.user!.id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// RCA Triggers
// ─────────────────────────────────────────────────────────────────────────────
router.get('/rca-triggers', async (req: AuthRequest, res: Response) => {
  try {
    const triggers = await lswService.getRcaTriggers(req.user!.id, req.user!.organizationId);
    res.json({ success: true, data: triggers });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/rca-triggers', async (req: AuthRequest, res: Response) => {
  try {
    const trigger = await lswService.createRcaTrigger({
      ...req.body,
      userId: req.user!.id,
      organizationId: req.user!.organizationId,
    });
    res.status(201).json({ success: true, data: trigger });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/rca-triggers/:id', async (req: AuthRequest, res: Response) => {
  try {
    const trigger = await lswService.updateRcaTrigger(req.params.id, req.user!.id, req.body);
    res.json({ success: true, data: trigger });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/rca-triggers/:id', async (req: AuthRequest, res: Response) => {
  try {
    await lswService.deleteRcaTrigger(req.params.id, req.user!.id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Style Presets
// ─────────────────────────────────────────────────────────────────────────────
router.get('/style-presets', async (req: AuthRequest, res: Response) => {
  try {
    const presets = await lswService.getStylePresets(req.user!.organizationId);
    res.json({ success: true, data: presets });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/style-presets', async (req: AuthRequest, res: Response) => {
  try {
    const preset = await lswService.upsertStylePreset({
      ...req.body,
      organizationId: req.user!.organizationId,
    });
    res.json({ success: true, data: preset });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Early Completion Logs
// ─────────────────────────────────────────────────────────────────────────────
router.post('/early-completion-logs', async (req: AuthRequest, res: Response) => {
  try {
    const log = await lswService.createEarlyCompletionLog({
      ...req.body,
      userId: req.user!.id,
      organizationId: req.user!.organizationId,
    });
    websocketService.emitToUser(req.user!.id, 'lsw:completion-changed', {
      weekNumber: req.body.weekNumber,
      year: req.body.year,
    });
    res.json({ success: true, data: log });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/early-completion-logs', async (req: AuthRequest, res: Response) => {
  try {
    const { weekNumber, year } = req.query;
    const logs = await lswService.getEarlyCompletionLogs(
      req.user!.id,
      weekNumber ? Number(weekNumber) : undefined,
      year ? Number(year) : undefined,
    );
    res.json({ success: true, data: logs });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/early-completion-logs', async (req: AuthRequest, res: Response) => {
  try {
    const { dailyTaskId, dayKey, weekNumber, year } = req.body;
    if (!dailyTaskId || !dayKey || !weekNumber || !year) {
      return res.status(400).json({ success: false, error: 'dailyTaskId, dayKey, weekNumber, and year are required' });
    }
    await lswService.deleteEarlyCompletionLog(
      req.user!.id,
      dailyTaskId,
      dayKey,
      Number(weekNumber),
      Number(year),
    );
    websocketService.emitToUser(req.user!.id, 'lsw:completion-changed', {
      weekNumber: Number(weekNumber),
      year: Number(year),
    });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
