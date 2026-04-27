import { Router, Response } from 'express';
import { AuthRequest, authenticate } from '../middleware/auth';
import * as vacationService from '../services/vacationService';

const router = Router();

// All vacation routes require authentication
router.use(authenticate);

// ─────────────────────────────────────────────────────────────────────────────
// Create vacation request
// POST /api/vacation
// ─────────────────────────────────────────────────────────────────────────────
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const organizationId = req.user!.organizationId;
    const {
      employeeId, firstName, lastName, department, shift, line, area, phone, employeeCode,
      leaveType, startDate, endDate, durationDays, returnToWork, reason, coveragePlan,
      emergencyPhone, emergencyEmail, autoApprove
    } = req.body;

    // Must have either employeeId or firstName+lastName
    if (!employeeId && (!firstName || !lastName)) {
      return res.status(400).json({ success: false, error: 'Either employeeId or firstName and lastName are required' });
    }
    if (!leaveType || !startDate || !endDate) {
      return res.status(400).json({ success: false, error: 'leaveType, startDate, and endDate are required' });
    }

    const vacation = await vacationService.createVacationRequest({
      employeeId: employeeId ? parseInt(employeeId) : undefined,
      firstName,
      lastName,
      department,
      shift,
      line,
      area,
      phone,
      employeeCode,
      requestedByUserId: userId,
      leaveType,
      startDate,
      endDate,
      durationDays: durationDays ? parseInt(durationDays) : undefined,
      returnToWork,
      reason: reason || '',
      coveragePlan,
      emergencyPhone,
      emergencyEmail,
      autoApprove: autoApprove === true || autoApprove === 'true',
      organizationId: organizationId || undefined,
    });

    res.status(201).json({ success: true, data: vacation });
  } catch (error: any) {
    console.error('Error creating vacation request:', error);
    const msg = error.message || '';
    const is400 = msg.includes('required') || msg.includes('digits') || msg.includes('exceeds') ||
      msg.includes('advance') || msg.includes('allocation') || msg.includes('blackout') ||
      msg.includes('simultaneous') || msg.includes('Invalid leave');
    const status = msg.includes('not found') ? 404 : is400 ? 400 : 500;
    res.status(status).json({ success: false, error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Form Dropdowns (Department, Shift, Line, Area)
// GET /api/vacation/dropdowns
// ─────────────────────────────────────────────────────────────────────────────
router.get('/dropdowns', async (_req: AuthRequest, res: Response) => {
  try {
    const dropdowns = await vacationService.getFormDropdowns();
    res.json({ success: true, data: dropdowns });
  } catch (error: any) {
    console.error('Error fetching form dropdowns:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Stats
// GET /api/vacation/stats
// ─────────────────────────────────────────────────────────────────────────────
router.get('/stats', async (req: AuthRequest, res: Response) => {
  try {
    const organizationId = req.user!.organizationId || undefined;
    const stats = await vacationService.getVacationStats(organizationId);
    res.json({ success: true, data: stats });
  } catch (error: any) {
    console.error('Error fetching vacation stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Upcoming
// GET /api/vacation/upcoming
// ─────────────────────────────────────────────────────────────────────────────
router.get('/upcoming', async (req: AuthRequest, res: Response) => {
  try {
    const organizationId = req.user!.organizationId || undefined;
    const vacations = await vacationService.getUpcomingVacations(organizationId);
    res.json({ success: true, data: vacations });
  } catch (error: any) {
    console.error('Error fetching upcoming vacations:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Pending
// GET /api/vacation/pending
// ─────────────────────────────────────────────────────────────────────────────
router.get('/pending', async (req: AuthRequest, res: Response) => {
  try {
    const organizationId = req.user!.organizationId || undefined;
    const vacations = await vacationService.getPendingVacations(organizationId);
    res.json({ success: true, data: vacations });
  } catch (error: any) {
    console.error('Error fetching pending vacations:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Recent
// GET /api/vacation/recent
// ─────────────────────────────────────────────────────────────────────────────
router.get('/recent', async (req: AuthRequest, res: Response) => {
  try {
    const organizationId = req.user!.organizationId || undefined;
    const vacations = await vacationService.getRecentVacations(organizationId);
    res.json({ success: true, data: vacations });
  } catch (error: any) {
    console.error('Error fetching recent vacations:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Activity Log
// GET /api/vacation/activity?type=all&limit=50&offset=0
// ─────────────────────────────────────────────────────────────────────────────
router.get('/activity', async (req: AuthRequest, res: Response) => {
  try {
    const organizationId = req.user!.organizationId || undefined;
    const { type, limit, offset } = req.query;
    const activities = await vacationService.getVacationActivityLog({
      type: type as string,
      limit: limit ? parseInt(limit as string) : 50,
      offset: offset ? parseInt(offset as string) : 0,
      organizationId,
    });
    res.json({ success: true, data: activities });
  } catch (error: any) {
    console.error('Error fetching vacation activity:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// All Requests
// GET /api/vacation/requests?status=all
// ─────────────────────────────────────────────────────────────────────────────
router.get('/requests', async (req: AuthRequest, res: Response) => {
  try {
    const organizationId = req.user!.organizationId || undefined;
    const { status } = req.query;
    const vacations = await vacationService.getVacationRequests(status as string, organizationId);
    res.json({ success: true, data: vacations });
  } catch (error: any) {
    console.error('Error fetching vacation requests:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Settings
// GET /api/vacation/settings
// PUT /api/vacation/settings
// ─────────────────────────────────────────────────────────────────────────────
router.get('/settings', async (req: AuthRequest, res: Response) => {
  try {
    const organizationId = req.user!.organizationId || undefined;
    console.log('[GET /vacation/settings] orgId=%s userId=%s', organizationId, req.user!.id);
    const settings = await vacationService.getVacationSettings(organizationId);
    console.log('[GET /vacation/settings] returning id=%d, allocation=%d, maxConsec=%d, maxSimul=%d',
      settings.id, settings.standardAllocationDays, settings.maxConsecutiveDays, settings.maxSimultaneousAbsences);
    res.json({ success: true, data: settings });
  } catch (error: any) {
    console.error('Error fetching vacation settings:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/settings', async (req: AuthRequest, res: Response) => {
  try {
    const organizationId = req.user!.organizationId || undefined;
    const { standardAllocationDays, minimumNoticeDays, maxConsecutiveDays, minTeamCoveragePercent, maxSimultaneousAbsences, criticalRoleCoverageRequired } = req.body;
    console.log('[PUT /vacation/settings] orgId=%s, body=%j', organizationId, req.body);
    const settings = await vacationService.updateVacationSettings({
      standardAllocationDays: standardAllocationDays != null ? Number(standardAllocationDays) : undefined,
      minimumNoticeDays: minimumNoticeDays != null ? Number(minimumNoticeDays) : undefined,
      maxConsecutiveDays: maxConsecutiveDays != null ? Number(maxConsecutiveDays) : undefined,
      minTeamCoveragePercent: minTeamCoveragePercent != null ? Number(minTeamCoveragePercent) : undefined,
      maxSimultaneousAbsences: maxSimultaneousAbsences != null ? Number(maxSimultaneousAbsences) : undefined,
      criticalRoleCoverageRequired,
      organizationId,
    });
    console.log('[PUT /vacation/settings] saved id=%d, allocation=%d, maxConsec=%d, maxSimul=%d',
      settings.id, settings.standardAllocationDays, settings.maxConsecutiveDays, settings.maxSimultaneousAbsences);
    res.json({ success: true, data: settings });
  } catch (error: any) {
    console.error('Error updating vacation settings:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/vacation/settings/reset — Nuke all records, create fresh with zeros
router.delete('/settings/reset', async (req: AuthRequest, res: Response) => {
  try {
    const organizationId = req.user!.organizationId || undefined;
    console.log('[DELETE /vacation/settings/reset] orgId=%s userId=%s — RESETTING ALL TO ZERO', organizationId, req.user!.id);
    const settings = await vacationService.resetVacationSettings(organizationId);
    console.log('[DELETE /vacation/settings/reset] Fresh record id=%d, all values zeroed', settings.id);
    res.json({ success: true, data: settings });
  } catch (error: any) {
    console.error('Error resetting vacation settings:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Blackout Periods
// GET /api/vacation/blackout-periods
// POST /api/vacation/blackout-periods
// PUT /api/vacation/blackout-periods/:id
// DELETE /api/vacation/blackout-periods/:id
// ─────────────────────────────────────────────────────────────────────────────
router.get('/blackout-periods', async (req: AuthRequest, res: Response) => {
  try {
    const organizationId = req.user!.organizationId || undefined;
    const periods = await vacationService.getBlackoutPeriods(organizationId);
    res.json({ success: true, data: periods });
  } catch (error: any) {
    console.error('Error fetching blackout periods:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/blackout-periods', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const organizationId = req.user!.organizationId || undefined;
    const { name, startDate, endDate, description, isActive } = req.body;

    if (!name || !startDate || !endDate) {
      return res.status(400).json({ success: false, error: 'name, startDate, and endDate are required' });
    }

    const period = await vacationService.createBlackoutPeriod({
      name, startDate, endDate, description, isActive,
      createdByUserId: userId,
      organizationId,
    });

    res.status(201).json({ success: true, data: period });
  } catch (error: any) {
    console.error('Error creating blackout period:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/blackout-periods/:id', async (req: AuthRequest, res: Response) => {
  try {
    const periodId = parseInt(req.params.id);
    const { name, startDate, endDate, description, isActive } = req.body;
    const period = await vacationService.updateBlackoutPeriod(periodId, {
      name, startDate, endDate, description, isActive,
    });
    res.json({ success: true, data: period });
  } catch (error: any) {
    console.error('Error updating blackout period:', error);
    const status = error.message === 'Blackout period not found' ? 404 : 500;
    res.status(status).json({ success: false, error: error.message });
  }
});

router.delete('/blackout-periods/:id', async (req: AuthRequest, res: Response) => {
  try {
    const periodId = parseInt(req.params.id);
    await vacationService.deleteBlackoutPeriod(periodId);
    res.json({ success: true, message: 'Blackout period deleted' });
  } catch (error: any) {
    console.error('Error deleting blackout period:', error);
    const status = error.message === 'Blackout period not found' ? 404 : 500;
    res.status(status).json({ success: false, error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Conflicts
// GET /api/vacation/conflicts
// ─────────────────────────────────────────────────────────────────────────────
router.get('/conflicts', async (req: AuthRequest, res: Response) => {
  try {
    const organizationId = req.user!.organizationId || undefined;
    const conflicts = await vacationService.getVacationConflicts(organizationId);
    res.json({ success: true, data: conflicts });
  } catch (error: any) {
    console.error('Error fetching vacation conflicts:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Notifications
// GET /api/vacation/notifications
// POST /api/vacation/notifications/:id/read
// POST /api/vacation/notifications/mark-all-read
// DELETE /api/vacation/notifications/:id
// ─────────────────────────────────────────────────────────────────────────────
router.get('/notifications', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const organizationId = req.user!.organizationId || undefined;
    const employee = await vacationService.getEmployeeByUserId(userId);
    const { limit, unread_only } = req.query;
    const result = await vacationService.getVacationNotifications({
      employeeId: employee?.id,
      userRole: req.user!.role || 'user',
      limit: limit ? parseInt(limit as string) : 20,
      unreadOnly: unread_only === 'true',
      organizationId,
    });
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Error fetching vacation notifications:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/notifications/:id/read', async (req: AuthRequest, res: Response) => {
  try {
    const notificationId = parseInt(req.params.id);
    const notification = await vacationService.markNotificationRead(notificationId);
    res.json({ success: true, data: notification });
  } catch (error: any) {
    console.error('Error marking notification read:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/notifications/mark-all-read', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const organizationId = req.user!.organizationId || undefined;
    const employee = await vacationService.getEmployeeByUserId(userId);
    const result = await vacationService.markAllNotificationsRead(employee?.id, organizationId);
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Error marking all notifications read:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/notifications/:id', async (req: AuthRequest, res: Response) => {
  try {
    const notificationId = parseInt(req.params.id);
    await vacationService.deleteNotification(notificationId);
    res.json({ success: true, message: 'Notification deleted' });
  } catch (error: any) {
    console.error('Error deleting notification:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Employee Self-Service (my-*)
// GET /api/vacation/my-stats
// GET /api/vacation/my-history
// GET /api/vacation/my-activity
// GET /api/vacation/my-upcoming
// GET /api/vacation/my-pending
// GET /api/vacation/my-recent
// GET /api/vacation/my-conflicts
// ─────────────────────────────────────────────────────────────────────────────
router.get('/my-stats', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const employee = await vacationService.getEmployeeByUserId(userId);
    if (!employee) return res.status(404).json({ success: false, error: 'Employee record not found for your user' });
    const stats = await vacationService.getMyVacationStats(employee.id);
    res.json({ success: true, data: stats });
  } catch (error: any) {
    console.error('Error fetching my vacation stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/my-history', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const employee = await vacationService.getEmployeeByUserId(userId);
    if (!employee) return res.status(404).json({ success: false, error: 'Employee record not found' });
    const history = await vacationService.getMyVacationHistory(employee.id);
    res.json({ success: true, data: history });
  } catch (error: any) {
    console.error('Error fetching my vacation history:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/my-activity', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const employee = await vacationService.getEmployeeByUserId(userId);
    if (!employee) return res.status(404).json({ success: false, error: 'Employee record not found' });
    const activity = await vacationService.getMyVacationActivity(employee.id);
    res.json({ success: true, data: activity });
  } catch (error: any) {
    console.error('Error fetching my vacation activity:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/my-upcoming', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const employee = await vacationService.getEmployeeByUserId(userId);
    if (!employee) return res.status(404).json({ success: false, error: 'Employee record not found' });
    const vacations = await vacationService.getMyUpcomingVacations(employee.id);
    res.json({ success: true, data: vacations });
  } catch (error: any) {
    console.error('Error fetching my upcoming vacations:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/my-pending', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const employee = await vacationService.getEmployeeByUserId(userId);
    if (!employee) return res.status(404).json({ success: false, error: 'Employee record not found' });
    const vacations = await vacationService.getMyPendingVacations(employee.id);
    res.json({ success: true, data: vacations });
  } catch (error: any) {
    console.error('Error fetching my pending vacations:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/my-recent', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const employee = await vacationService.getEmployeeByUserId(userId);
    if (!employee) return res.status(404).json({ success: false, error: 'Employee record not found' });
    const vacations = await vacationService.getMyRecentVacations(employee.id);
    res.json({ success: true, data: vacations });
  } catch (error: any) {
    console.error('Error fetching my recent vacations:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/my-conflicts', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const employee = await vacationService.getEmployeeByUserId(userId);
    if (!employee) return res.status(404).json({ success: false, error: 'Employee record not found' });
    const conflicts = await vacationService.getMyVacationConflicts(employee.id);
    res.json({ success: true, data: conflicts });
  } catch (error: any) {
    console.error('Error fetching my vacation conflicts:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Employee Directory
// GET /api/vacation/employees/directory?department=all&status=all
// GET /api/vacation/employees/departments
// ─────────────────────────────────────────────────────────────────────────────
router.get('/employees/directory', async (req: AuthRequest, res: Response) => {
  try {
    const organizationId = req.user!.organizationId || undefined;
    const { department, status } = req.query;
    const employees = await vacationService.getEmployeesDirectory({
      department: department as string,
      status: status as string,
      organizationId,
    });
    res.json({ success: true, data: employees });
  } catch (error: any) {
    console.error('Error fetching employees directory:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/employees/departments', async (req: AuthRequest, res: Response) => {
  try {
    const organizationId = req.user!.organizationId || undefined;
    const departments = await vacationService.getEmployeeDepartments(organizationId);
    res.json({ success: true, data: departments });
  } catch (error: any) {
    console.error('Error fetching employee departments:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Approve / Deny / Get / Update individual vacation
// POST /api/vacation/:id/approve
// POST /api/vacation/:id/deny
// POST /api/vacation/:id/cancel
// GET /api/vacation/:id
// PUT /api/vacation/:id
// DELETE /api/vacation/:id
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:id/approve', async (req: AuthRequest, res: Response) => {
  try {
    const vacationId = parseInt(req.params.id);
    const userId = req.user!.id;
    const { reason } = req.body;
    const vacation = await vacationService.approveVacation(vacationId, userId, reason);
    res.json({ success: true, data: vacation });
  } catch (error: any) {
    console.error('Error approving vacation:', error);
    const status = error.message.includes('not found') ? 404 : error.message.includes('pending') ? 400 : 500;
    res.status(status).json({ success: false, error: error.message });
  }
});

router.post('/:id/deny', async (req: AuthRequest, res: Response) => {
  try {
    const vacationId = parseInt(req.params.id);
    const userId = req.user!.id;
    const { reason } = req.body;
    const vacation = await vacationService.denyVacation(vacationId, userId, reason);
    res.json({ success: true, data: vacation });
  } catch (error: any) {
    console.error('Error denying vacation:', error);
    const status = error.message.includes('not found') ? 404 : error.message.includes('required') ? 400 : error.message.includes('pending') ? 400 : 500;
    res.status(status).json({ success: false, error: error.message });
  }
});

router.post('/:id/cancel', async (req: AuthRequest, res: Response) => {
  try {
    const vacationId = parseInt(req.params.id);
    const userId = req.user!.id;
    const { reason } = req.body;
    const vacation = await vacationService.cancelVacation(vacationId, userId, reason);
    res.json({ success: true, data: vacation });
  } catch (error: any) {
    console.error('Error cancelling vacation:', error);
    const status = error.message.includes('not found') ? 404 : error.message.includes('pending') ? 400 : 500;
    res.status(status).json({ success: false, error: error.message });
  }
});

router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const vacationId = parseInt(req.params.id);
    const vacation = await vacationService.getVacationDetails(vacationId);
    res.json({ success: true, data: vacation });
  } catch (error: any) {
    console.error('Error fetching vacation details:', error);
    const status = error.message.includes('not found') ? 404 : 500;
    res.status(status).json({ success: false, error: error.message });
  }
});

router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const vacationId = parseInt(req.params.id);
    const { startDate, endDate, leaveType, reason, durationDays } = req.body;
    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, error: 'startDate and endDate are required' });
    }
    const vacation = await vacationService.updateVacationRequest(vacationId, {
      startDate, endDate, leaveType, reason, durationDays,
    });
    res.json({ success: true, data: vacation });
  } catch (error: any) {
    console.error('Error updating vacation:', error);
    const status = error.message.includes('not found') ? 404 : error.message.includes('pending') ? 400 : 500;
    res.status(status).json({ success: false, error: error.message });
  }
});

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const vacationId = parseInt(req.params.id);
    const organizationId = req.user!.organizationId || undefined;
    await vacationService.deleteVacationRequest(vacationId, { organizationId });
    res.json({ success: true, message: 'Vacation request deleted' });
  } catch (error: any) {
    console.error('Error deleting vacation request:', error);
    const msg = String(error.message || '');
    const status = msg.includes('not found') ? 404 : msg.includes('cancelled') ? 400 : 500;
    res.status(status).json({ success: false, error: error.message });
  }
});

export default router;
