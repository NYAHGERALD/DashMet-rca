import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bakeryMetricsService from '../services/bakeryMetricsService';
import bakeryAdminService from '../services/bakeryAdminService';
import { generateAiInsights, getCachedInsight, saveInsight, logInsightAction, getInsightLogs } from '../services/bakeryAiInsightsService';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requireAdmin } from '../middleware/rbac';

const router = Router();
const prisma = new PrismaClient();

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/bakery-metrics/week-options
// Returns unique week names for the filter dropdown
// ─────────────────────────────────────────────────────────────────────────────
router.get('/week-options', async (req: Request, res: Response) => {
  try {
    const data = await bakeryMetricsService.getWeekOptions();
    res.json({ success: true, ...data });
  } catch (error: any) {
    console.error('Error fetching week options:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/bakery-metrics/weekly-sheets
// Returns all weekly sheet definitions
// ─────────────────────────────────────────────────────────────────────────────
router.get('/weekly-sheets', async (req: Request, res: Response) => {
  try {
    const sheets = await bakeryMetricsService.getWeeklySheets();
    res.json({ success: true, sheets });
  } catch (error: any) {
    console.error('Error fetching weekly sheets:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/bakery-metrics/records
// Returns all submissions (with shift data) — for record selector dropdown
// ─────────────────────────────────────────────────────────────────────────────
router.get('/records', async (req: Request, res: Response) => {
  try {
    const records = await bakeryMetricsService.getRecords({
      week: req.query.week as string,
      day: req.query.day as string,
    });
    res.json({ success: true, records });
  } catch (error: any) {
    console.error('Error fetching records:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/bakery-metrics/both-shifts-records
// Returns flattened records for the metrics table (main report endpoint)
// Query params: ?week=10-28-2024_11-01-2024&day=Monday
// ─────────────────────────────────────────────────────────────────────────────
router.get('/both-shifts-records', async (req: Request, res: Response) => {
  try {
    const records = await bakeryMetricsService.getBothShiftsRecords({
      week: req.query.week as string,
      day: req.query.day as string,
    });
    res.json({ success: true, records });
  } catch (error: any) {
    console.error('Error fetching both-shifts records:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/bakery-metrics/both-shifts-records/:id
// Returns a single record by ID
// ─────────────────────────────────────────────────────────────────────────────
router.get('/both-shifts-records/:id', async (req: Request, res: Response) => {
  try {
    const record = await bakeryMetricsService.getRecordById(req.params.id);
    if (!record) {
      return res.status(404).json({ success: false, error: 'Record not found' });
    }
    res.json({ success: true, record });
  } catch (error: any) {
    console.error('Error fetching record:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/bakery-metrics/missing-data
// Analyses all weeks for missing days, shifts, and metrics
// ─────────────────────────────────────────────────────────────────────────────
router.get('/missing-data', async (req: Request, res: Response) => {
  try {
    const analysis = await bakeryMetricsService.getMissingDataAnalysis();
    res.json({ success: true, ...analysis });
  } catch (error: any) {
    console.error('Error analysing missing data:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/bakery-metrics/recent-submissions
// Returns last 5 submissions with time-ago formatting
// ─────────────────────────────────────────────────────────────────────────────
router.get('/recent-submissions', async (req: Request, res: Response) => {
  try {
    const submissions = await bakeryMetricsService.getRecentSubmissions();
    res.json({ success: true, submissions });
  } catch (error: any) {
    console.error('Error fetching recent submissions:', error);
    res.status(500).json({ success: false, submissions: [] });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/bakery-metrics/all-submissions
// Returns all submissions with detailed shift breakdowns
// ─────────────────────────────────────────────────────────────────────────────
router.get('/all-submissions', async (req: Request, res: Response) => {
  try {
    const submissions = await bakeryMetricsService.getAllSubmissions();
    res.json({ success: true, submissions, total_count: submissions.length });
  } catch (error: any) {
    console.error('Error fetching all submissions:', error);
    res.status(500).json({ success: false, submissions: [], total_count: 0 });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/bakery-metrics/resolutions
// Returns all missing data resolutions
// ─────────────────────────────────────────────────────────────────────────────
router.get('/resolutions', async (req: Request, res: Response) => {
  try {
    const resolutions = await bakeryMetricsService.getResolutions();
    res.json({ success: true, resolutions });
  } catch (error: any) {
    console.error('Error fetching resolutions:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/bakery-metrics/resolutions
// Save a resolution for a missing day
// ─────────────────────────────────────────────────────────────────────────────
router.post('/resolutions', async (req: Request, res: Response) => {
  try {
    const { week_name, day_of_week, reason, resolved_by } = req.body;
    if (!week_name || !day_of_week || !reason || !resolved_by) {
      return res.status(400).json({ success: false, error: 'week_name, day_of_week, reason, and resolved_by are required' });
    }
    const resolution = await bakeryMetricsService.saveResolution(week_name, day_of_week, reason, resolved_by);
    // Log activity
    await bakeryMetricsService.logActivity({
      action: 'RESOLVED',
      weekName: week_name,
      dayOfWeek: day_of_week,
      performedBy: resolved_by,
      reason,
      details: { resolution_id: resolution.id },
      ipAddress: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || undefined,
      userAgent: req.headers['user-agent'] || undefined,
    }).catch(err => console.error('Failed to log resolve activity:', err));
    res.json({ success: true, resolution, message: 'Resolution saved successfully' });
  } catch (error: any) {
    console.error('Error saving resolution:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/bakery-metrics/resolutions
// Remove a resolution (e.g. to unresolve)
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/resolutions', async (req: Request, res: Response) => {
  try {
    const { week_name, day_of_week, performed_by } = req.body;
    if (!week_name || !day_of_week) {
      return res.status(400).json({ success: false, error: 'week_name and day_of_week are required' });
    }
    await bakeryMetricsService.deleteResolution(week_name, day_of_week);
    // Log activity
    await bakeryMetricsService.logActivity({
      action: 'UNRESOLVED',
      weekName: week_name,
      dayOfWeek: day_of_week,
      performedBy: performed_by || 'Unknown',
      details: { action_description: 'Put back to outstanding — resolution removed' },
      ipAddress: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || undefined,
      userAgent: req.headers['user-agent'] || undefined,
    }).catch(err => console.error('Failed to log unresolve activity:', err));
    res.json({ success: true, message: 'Resolution removed' });
  } catch (error: any) {
    console.error('Error deleting resolution:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/bakery-metrics/activity-log
// Log a tracker activity (e.g. Fill Now click)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/activity-log', async (req: Request, res: Response) => {
  try {
    const { action, week_name, day_of_week, performed_by, reason, details } = req.body;
    if (!action || !week_name || !day_of_week || !performed_by) {
      return res.status(400).json({ success: false, error: 'action, week_name, day_of_week, and performed_by are required' });
    }
    const log = await bakeryMetricsService.logActivity({
      action,
      weekName: week_name,
      dayOfWeek: day_of_week,
      performedBy: performed_by,
      reason,
      details,
      ipAddress: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || undefined,
      userAgent: req.headers['user-agent'] || undefined,
    });
    res.json({ success: true, log });
  } catch (error: any) {
    console.error('Error logging activity:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/bakery-metrics/activity-logs
// Returns activity logs with optional filters
// ─────────────────────────────────────────────────────────────────────────────
router.get('/activity-logs', async (req: Request, res: Response) => {
  try {
    const { action, performed_by, week_name, start_date, end_date, limit, offset } = req.query;
    const result = await bakeryMetricsService.getActivityLogs({
      action: action as string,
      performedBy: performed_by as string,
      weekName: week_name as string,
      startDate: start_date as string,
      endDate: end_date as string,
      limit: limit ? parseInt(limit as string) : 100,
      offset: offset ? parseInt(offset as string) : 0,
    });
    res.json({ success: true, ...result });
  } catch (error: any) {
    console.error('Error fetching activity logs:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/bakery-metrics/kpi-targets
// Returns structured KPI targets
// ─────────────────────────────────────────────────────────────────────────────
router.get('/kpi-targets', async (req: Request, res: Response) => {
  try {
    const targets = await bakeryMetricsService.getKpiTargets();
    res.json({ success: true, targets });
  } catch (error: any) {
    console.error('Error fetching KPI targets:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/bakery-metrics/report-dashboard-metrics
// Returns summary card data for the 4 performance cards
// Query params: ?week=...&day=...
// ─────────────────────────────────────────────────────────────────────────────
router.get('/report-dashboard-metrics', async (req: Request, res: Response) => {
  try {
    const data = await bakeryMetricsService.getDashboardMetrics({
      week: req.query.week as string,
      day: req.query.day as string,
    });
    res.json({ success: true, data });
  } catch (error: any) {
    console.error('Error fetching dashboard metrics:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/bakery-metrics/week-average
// Returns weekly averages for all metrics
// Query param: ?week=10-28-2024_11-01-2024
// ─────────────────────────────────────────────────────────────────────────────
router.get('/week-average', async (req: Request, res: Response) => {
  try {
    const weekName = req.query.week as string;
    if (!weekName) {
      return res.status(400).json({ success: false, error: 'week parameter is required' });
    }
    const data = await bakeryMetricsService.getWeekAverage(weekName);
    if (!data) {
      return res.status(404).json({ success: false, error: 'No data found for this week' });
    }
    res.json({ success: true, ...data });
  } catch (error: any) {
    console.error('Error calculating week average:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/bakery-metrics/ai-insights
// Returns AI-generated insights based on current data
// Query params: ?week=...&day=...
// ─────────────────────────────────────────────────────────────────────────────
router.get('/ai-insights', async (req: Request, res: Response) => {
  try {
    const data = await bakeryMetricsService.getAiInsights({
      week: req.query.week as string,
      day: req.query.day as string,
    });
    res.json({ success: true, data });
  } catch (error: any) {
    console.error('Error generating AI insights:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/bakery-metrics/ai-insights-v2
// Returns CACHED insight from DB if available; otherwise signals "not found".
// Query params: ?week=... (optional, defaults to latest week)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/ai-insights-v2', async (req: Request, res: Response) => {
  try {
    const week = req.query.week as string | undefined;

    // Resolve the actual week name if not provided
    let weekName = week;
    if (!weekName || weekName === 'latest') {
      const latest = await prisma.bakeryWeeklySheet.findFirst({
        orderBy: { weekStart: 'desc' },
        select: { sheetName: true },
      });
      weekName = latest?.sheetName || undefined;
    }

    if (!weekName) {
      res.json({ success: false, error: 'No weeks available', cached: false });
      return;
    }

    // Check cache
    const cached = await getCachedInsight(weekName);
    if (cached) {
      // Log cache hit (fire & forget)
      logInsightAction({
        weekName,
        action: 'CACHE_HIT',
        userName: 'system',
        success: true,
      });
      res.json(cached);
      return;
    }

    // No cached result
    res.json({ success: false, cached: false, weekName, message: 'No cached analysis found. Click Re-analyze to generate.' });
  } catch (error: any) {
    console.error('Error fetching AI insights v2:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/bakery-metrics/ai-insights-v2/analyze
// Force-generate (or regenerate) AI insights, save to DB, log the action.
// Requires authentication.
// Body: { week?: string }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/ai-insights-v2/analyze', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const week = (req.body.week || req.query.week) as string | undefined;
    const user = req.user;
    const userName = user ? `${user.firstName} ${user.lastName}` : 'Unknown';
    const userId = user?.id;
    const ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || undefined;
    const userAgent = req.headers['user-agent'] || undefined;

    // Check if cached already exists (to decide GENERATED vs REGENERATED)
    let weekName = week;
    if (!weekName || weekName === 'latest') {
      const latest = await prisma.bakeryWeeklySheet.findFirst({
        orderBy: { weekStart: 'desc' },
        select: { sheetName: true },
      });
      weekName = latest?.sheetName || undefined;
    }

    const existingCache = weekName ? await getCachedInsight(weekName) : null;
    const action = existingCache ? 'REGENERATED' : 'GENERATED';

    // Generate fresh insights via GPT
    const result = await generateAiInsights(week);

    if (result.success && result.data) {
      const resolvedWeek = result.data._meta?.weekName || weekName || 'unknown';
      const model = result.data._meta?.model || 'unknown';

      // Save to DB
      await saveInsight(resolvedWeek, result, userName, userId, result.tokenUsage, model);

      // Log the action
      await logInsightAction({
        weekName: resolvedWeek,
        action,
        userName,
        userId,
        aiModel: model,
        tokenUsage: result.tokenUsage,
        durationMs: result.durationMs,
        success: true,
        ipAddress,
        userAgent,
      });

      res.json({ ...result, cached: false, action });
    } else {
      // Log the failure
      const resolvedWeek = weekName || 'unknown';
      await logInsightAction({
        weekName: resolvedWeek,
        action,
        userName,
        userId,
        durationMs: result.durationMs,
        success: false,
        errorMsg: result.error,
        ipAddress,
        userAgent,
      });

      res.json(result);
    }
  } catch (error: any) {
    console.error('Error generating AI insights v2:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/bakery-metrics/ai-insights-v2/logs
// Fetch AI insight generation/regeneration logs.
// Query: ?week=... (optional), ?limit=50 (optional)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/ai-insights-v2/logs', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const week = req.query.week as string | undefined;
    const limit = parseInt(req.query.limit as string) || 50;
    const logs = await getInsightLogs(week, limit);
    res.json({ success: true, data: logs });
  } catch (error: any) {
    console.error('Error fetching AI insight logs:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/bakery-metrics/check-existing
// Check if a record already exists for a given week + day combination
// ─────────────────────────────────────────────────────────────────────────────
router.get('/check-existing', async (req: Request, res: Response) => {
  try {
    const week = req.query.week as string;
    const day = req.query.day as string;

    if (!week || !day) {
      res.json({ success: true, exists: false });
      return;
    }

    const existing = await prisma.bakeryWeekSubmission.findFirst({
      where: {
        weekName: week,
        dayOfWeek: day,
      },
    });

    res.json({ success: true, exists: !!existing });
  } catch (error: any) {
    console.error('Error checking existing record:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/bakery-metrics/submit
// Submit new bakery metrics (accepts flat form fields from frontend)
// Frontend sends: week_name, day_of_week, submitted_by, shift_type?,
//   first_die_cut1_oee_pct, first_die_cut2_oee_pct, first_die_cut1_pounds,
//   first_die_cut2_pounds, first_die_cut1_waste_lbs, first_die_cut2_waste_lbs,
//   (same with second_ prefix)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/submit', async (req: Request, res: Response) => {
  try {
    const body = req.body;
    console.log('[POST /bakery-metrics/submit] Raw body:', JSON.stringify(body));

    // --- Parse week_name into weekStart / weekEnd ---
    // week_name format: "03-16-2026_03-20-2026"
    const weekName: string = body.week_name || body.weekName || '';
    let weekStart = '';
    let weekEnd = '';
    if (weekName.includes('_')) {
      const [startStr, endStr] = weekName.split('_');
      // Convert MM-DD-YYYY to YYYY-MM-DD for Date parsing
      const toISO = (s: string) => {
        const [m, d, y] = s.split('-');
        return `${y}-${m}-${d}`;
      };
      weekStart = toISO(startStr);
      weekEnd = toISO(endStr);
    } else {
      // Fallback: use today
      const today = new Date().toISOString().slice(0, 10);
      weekStart = body.weekStart || today;
      weekEnd = body.weekEnd || today;
    }

    const dayOfWeek: string = body.day_of_week || body.dayOfWeek || '';
    const submittedBy: string = body.submitted_by || body.submittedBy || '';
    const shiftType: string | undefined = body.shift_type; // 'first', 'second', or undefined (both)

    // --- Build shift objects from flat fields ---
    const buildShift = (prefix: string) => {
      const oee1 = parseFloat(body[`${prefix}_die_cut1_oee_pct`]);
      const oee2 = parseFloat(body[`${prefix}_die_cut2_oee_pct`]);
      const lbs1 = parseFloat(body[`${prefix}_die_cut1_pounds`]);
      const lbs2 = parseFloat(body[`${prefix}_die_cut2_pounds`]);
      const waste1 = parseFloat(body[`${prefix}_die_cut1_waste_lbs`]);
      const waste2 = parseFloat(body[`${prefix}_die_cut2_waste_lbs`]);

      // If all values are NaN, shift was not filled in
      if ([oee1, oee2, lbs1, lbs2, waste1, waste2].every(v => isNaN(v))) {
        return undefined;
      }

      return {
        dieCut1OeePct: oee1 || 0,
        dieCut2OeePct: oee2 || 0,
        dieCut1Lbs: lbs1 || 0,
        dieCut2Lbs: lbs2 || 0,
        dieCut1WasteLb: waste1 || 0,
        dieCut2WasteLb: waste2 || 0,
        submittedBy,
      };
    };

    let firstShift = undefined;
    let secondShift = undefined;

    if (shiftType === 'first') {
      firstShift = buildShift('first');
    } else if (shiftType === 'second') {
      secondShift = buildShift('second');
    } else {
      // Both shifts
      firstShift = buildShift('first');
      secondShift = buildShift('second');
    }

    // Also support pre-structured payloads (if body already has firstShift/secondShift objects)
    if (body.firstShift && typeof body.firstShift === 'object') firstShift = body.firstShift;
    if (body.secondShift && typeof body.secondShift === 'object') secondShift = body.secondShift;

    if (!firstShift && !secondShift) {
      res.status(400).json({ success: false, error: 'No shift data provided. Please fill in at least one shift.' });
      return;
    }

    console.log('[POST /bakery-metrics/submit] Parsed → weekName=%s, day=%s, shiftType=%s, hasFirst=%s, hasSecond=%s',
      weekName, dayOfWeek, shiftType || 'both', !!firstShift, !!secondShift);

    const submission = await bakeryMetricsService.submitMetrics({
      weekName,
      weekStart,
      weekEnd,
      dayOfWeek,
      submittedBy,
      firstShift,
      secondShift,
    });

    res.status(201).json({ success: true, submission });
  } catch (error: any) {
    console.error('Error submitting metrics:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// ADMIN ENDPOINTS — require authentication + ADMIN role
// Matches Flask: /api/weeks, /api/kpi-targets, /api/kpi-targets/history
// ═════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/bakery-metrics/weeks
// Returns all active weekly sheets (matches Flask GET /api/weeks)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/weeks', async (req: Request, res: Response) => {
  try {
    const weeks = await bakeryAdminService.getActiveWeeks();
    res.json({ success: true, weeks });
  } catch (error: any) {
    console.error('Error fetching active weeks:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/bakery-metrics/weeks
// Create a new weekly sheet (Admin only — matches Flask POST /api/weeks)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/weeks', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const week = await bakeryAdminService.addWeek(req.body);
    res.status(201).json({ success: true, week, message: 'Week created successfully' });
  } catch (error: any) {
    console.error('Error adding week:', error);
    const status = error.message.includes('overlap') || error.message.includes('already exists') ? 409 : 500;
    res.status(status).json({ success: false, error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/bakery-metrics/weeks/:id
// Soft-delete a weekly sheet (Admin only — matches Flask DELETE /api/weeks/:id)
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/weeks/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const result = await bakeryAdminService.deleteWeek(req.params.id);
    res.json({ success: true, ...result });
  } catch (error: any) {
    console.error('Error deleting week:', error);
    const status = error.message.includes('not found') ? 404
      : error.message.includes('Cannot delete') ? 409
      : 500;
    res.status(status).json({ success: false, error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/bakery-metrics/kpi-targets/detailed
// Returns KPI targets with full metadata (unit, comparison_type)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/kpi-targets/detailed', async (req: Request, res: Response) => {
  try {
    const targets = await bakeryAdminService.getKpiTargetsDetailed();
    res.json({ success: true, targets });
  } catch (error: any) {
    console.error('Error fetching detailed KPI targets:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/bakery-metrics/kpi-targets
// Update all KPI targets (Admin only — matches Flask PUT /api/kpi-targets)
// ─────────────────────────────────────────────────────────────────────────────
router.put('/kpi-targets', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const updatedBy = `${user.firstName} ${user.lastName}`.trim() || user.email;
    const result = await bakeryAdminService.saveKpiTargets(req.body, updatedBy);
    res.json({ success: true, ...result });
  } catch (error: any) {
    console.error('Error saving KPI targets:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/bakery-metrics/kpi-targets/history
// Returns KPI target change history (matches Flask GET /api/kpi-targets/history)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/kpi-targets/history', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const history = await bakeryAdminService.getKpiTargetHistory(limit);
    res.json({ success: true, history });
  } catch (error: any) {
    console.error('Error fetching KPI target history:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/bakery-metrics/auto-week
// Returns auto-week generation setting
// ─────────────────────────────────────────────────────────────────────────────
router.get('/auto-week', async (req: Request, res: Response) => {
  try {
    const setting = await bakeryAdminService.getAutoWeekSetting();
    res.json({ success: true, setting });
  } catch (error: any) {
    console.error('Error fetching auto-week setting:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/bakery-metrics/auto-week
// Toggle auto-week generation on/off (Admin only)
// ─────────────────────────────────────────────────────────────────────────────
router.put('/auto-week', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { enabled } = req.body;
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ success: false, error: 'enabled (boolean) is required' });
    }
    const userName = req.user ? `${req.user.firstName} ${req.user.lastName}` : 'Unknown';
    const setting = await bakeryAdminService.toggleAutoWeek(enabled, userName);
    res.json({ success: true, setting, message: `Auto-week generation ${enabled ? 'enabled' : 'disabled'}` });
  } catch (error: any) {
    console.error('Error toggling auto-week:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/bakery-metrics/submission-deadline
// Returns the admin-configured submission deadline
// ─────────────────────────────────────────────────────────────────────────────
router.get('/submission-deadline', async (req: Request, res: Response) => {
  try {
    const setting = await bakeryAdminService.getSubmissionDeadline();
    res.json({ success: true, ...setting });
  } catch (error: any) {
    console.error('Error fetching submission deadline:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/bakery-metrics/submission-deadline
// Update submission deadline (Admin only)
// ─────────────────────────────────────────────────────────────────────────────
router.put('/submission-deadline', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { deadline } = req.body;
    if (!deadline || typeof deadline !== 'string') {
      return res.status(400).json({ success: false, error: 'deadline (string) is required' });
    }
    const userName = req.user ? `${req.user.firstName} ${req.user.lastName}` : 'Unknown';
    const setting = await bakeryAdminService.saveSubmissionDeadline(deadline.trim(), userName);
    res.json({ success: true, ...setting, message: `Deadline updated to "${setting.deadline}"` });
  } catch (error: any) {
    console.error('Error saving submission deadline:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/bakery-metrics/tips-guidelines
// Returns active tips & guidelines for the Submit Metrics form
// ─────────────────────────────────────────────────────────────────────────────
router.get('/tips-guidelines', async (req: Request, res: Response) => {
  try {
    const tips = await bakeryAdminService.getTipsGuidelines(true);
    res.json({ success: true, tips });
  } catch (error: any) {
    console.error('Error fetching tips/guidelines:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/bakery-metrics/tips-guidelines/all
// Returns ALL tips (including inactive) for admin management
// ─────────────────────────────────────────────────────────────────────────────
router.get('/tips-guidelines/all', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const tips = await bakeryAdminService.getTipsGuidelines(false);
    res.json({ success: true, tips });
  } catch (error: any) {
    console.error('Error fetching all tips/guidelines:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/bakery-metrics/tips-guidelines
// Save all tips & guidelines (Admin only)
// ─────────────────────────────────────────────────────────────────────────────
router.put('/tips-guidelines', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { tips } = req.body;
    if (!Array.isArray(tips)) {
      return res.status(400).json({ success: false, error: 'tips (array) is required' });
    }
    const userName = req.user ? `${req.user.firstName} ${req.user.lastName}` : 'Unknown';
    const count = await bakeryAdminService.saveTipsGuidelines(tips, userName);
    res.json({ success: true, saved: count, message: `${count} tip(s) saved successfully` });
  } catch (error: any) {
    console.error('Error saving tips/guidelines:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/bakery-metrics/weekly-chart-metrics
// Returns per-day OEE/Waste arrays for dashboard charts (combined + per-shift)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/weekly-chart-metrics', async (req: Request, res: Response) => {
  try {
    const week = (req.query.week as string) || 'latest';
    const data = await bakeryMetricsService.getWeeklyChartMetrics(week);
    res.json({ success: true, ...data });
  } catch (error: any) {
    console.error('Error fetching weekly chart metrics:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/bakery-metrics/dashboard-kpis
// Returns KPI cards data with trends (current vs previous week)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/dashboard-kpis', async (req: Request, res: Response) => {
  try {
    const data = await bakeryMetricsService.getDashboardKpis();
    res.json({ success: true, ...data });
  } catch (error: any) {
    console.error('Error fetching dashboard KPIs:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/bakery-metrics/period-oee-comparison
// Returns weekly avg Die Cut 1 & 2 OEE for a date range (max 4 business weeks)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/period-oee-comparison', async (req: Request, res: Response) => {
  try {
    const start = req.query.start as string;
    const end = req.query.end as string;
    if (!start || !end) {
      return res.status(400).json({ success: false, error: 'start and end query parameters are required' });
    }
    const data = await bakeryMetricsService.getPeriodOeeComparison(start, end);
    res.json({ success: true, ...data });
  } catch (error: any) {
    console.error('Error fetching period OEE comparison:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/bakery-metrics/four-month-avg-ytd
// Returns 4-4-4-4 month average OEE breakdown for the current business YTD
// ─────────────────────────────────────────────────────────────────────────────
router.get('/four-month-avg-ytd', async (req: Request, res: Response) => {
  try {
    const data = await bakeryMetricsService.getFourMonthAvgYtd();
    res.json({ success: true, ...data });
  } catch (error: any) {
    console.error('Error fetching four-month average YTD:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
