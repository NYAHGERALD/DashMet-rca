import { Router, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { requireMinimumRole } from '../middleware/rbac';
import { UserRole } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { v4 as uuidv4 } from 'uuid';
import { upload, handleMulterError } from '../middleware/upload';
import { adminStorage } from '../config/firebase-admin';
import { logAuditEvent } from '../services/auditService';
import path from 'path';

const router = Router();
router.use(authenticate);

// ─── Helpers ────────────────────────────────────────────────────────────────────

const getOrgFilter = (req: any) => {
  if (req.user.role === 'SYSTEM_ADMIN') return {};
  return { organizationId: req.user.organizationId };
};

/** Generate issue number like OPS-000001 */
const generateIssueNumber = async (): Promise<string> => {
  const last = await prisma.machineIssue.findFirst({
    orderBy: { createdAt: 'desc' },
    select: { issueNumber: true },
  });
  const num = last ? parseInt(last.issueNumber.replace('OPS-', ''), 10) + 1 : 1;
  return `OPS-${String(num).padStart(6, '0')}`;
};

// ─── GET /operations/issues — List all issues with filters ──────────────────────

router.get('/issues', async (req: any, res: Response, next: NextFunction) => {
  try {
    const { departmentId, areaId, lineId, shiftId, type, status, priority, search, equipmentId, componentId } = req.query;

    const where: any = { ...getOrgFilter(req) };
    if (departmentId) where.departmentId = departmentId;
    if (areaId) where.areaId = areaId;
    if (lineId) where.lineId = lineId;
    if (shiftId) where.shiftId = shiftId;
    if (equipmentId) where.equipmentId = equipmentId;
    if (componentId) where.componentId = componentId;
    if (type) where.type = type;
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (search) {
      where.OR = [
        { title: { contains: search as string, mode: 'insensitive' } },
        { description: { contains: search as string, mode: 'insensitive' } },
        { issueNumber: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    const issues = await prisma.machineIssue.findMany({
      where,
      include: {
        Department: { select: { id: true, name: true } },
        Area: { select: { id: true, name: true } },
        Line: { select: { id: true, name: true, lineNumber: true } },
        Shift: { select: { id: true, name: true, startTime: true, endTime: true } },
        Equipment: { select: { id: true, name: true, assetTag: true } },
        Component: { select: { id: true, name: true, partNumber: true } },
        DayOfWeek: { select: { id: true, dayName: true, dayOrder: true } },
        ReportedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        ResolvedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: issues });
  } catch (err) {
    next(err);
  }
});

// ─── GET /operations/issues/audit-logs — Activity log for issues section ────────
// NOTE: Must be declared BEFORE `/issues/:id` so the literal path wins.

router.get('/issues/audit-logs', async (req: any, res: Response, next: NextFunction) => {
  try {
    const limit = Math.min(parseInt((req.query.limit as string) || '200', 10) || 200, 500);
    const where: any = { entity: 'MachineIssue' };
    if (req.user.role !== 'SYSTEM_ADMIN') where.organizationId = req.user.organizationId;

    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        User: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    res.json({
      success: true,
      data: logs.map((l) => ({
        id: l.id,
        action: l.action,
        entityId: l.entityId,
        createdAt: l.createdAt,
        changes: l.changes,
        ipAddress: l.ipAddress,
        user: l.User
          ? { id: l.User.id, name: `${l.User.firstName ?? ''} ${l.User.lastName ?? ''}`.trim() || l.User.email, email: l.User.email }
          : null,
      })),
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /operations/issues/:id — Get single issue ──────────────────────────────

router.get('/issues/:id', async (req: any, res: Response, next: NextFunction) => {
  try {
    const issue = await prisma.machineIssue.findUnique({
      where: { id: req.params.id },
      include: {
        Department: { select: { id: true, name: true } },
        Area: { select: { id: true, name: true } },
        Line: { select: { id: true, name: true, lineNumber: true } },
        Shift: { select: { id: true, name: true, startTime: true, endTime: true } },
        Equipment: { select: { id: true, name: true, assetTag: true, manufacturer: true, model: true, photos: true } },
        Component: { select: { id: true, name: true, partNumber: true, manufacturer: true, photos: true } },
        DayOfWeek: { select: { id: true, dayName: true, dayOrder: true } },
        ReportedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        ResolvedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });
    if (!issue) return res.status(404).json({ success: false, error: 'Issue not found' });
    res.json({ success: true, data: issue });
  } catch (err) {
    next(err);
  }
});

// ─── POST /operations/issues — Create a new issue ───────────────────────────────

router.post('/issues', async (req: any, res: Response, next: NextFunction) => {
  try {
    const { type, title, description, priority, departmentId, areaId, lineId, shiftId, equipmentId, componentId, weekNumber, dayOfWeekId, startTime, totalMinutesLost } = req.body;

    if (!type || !title || !description || !departmentId) {
      return res.status(400).json({ success: false, error: 'type, title, description, and departmentId are required' });
    }

    const issueNumber = await generateIssueNumber();

    const issue = await prisma.machineIssue.create({
      data: {
        issueNumber,
        type,
        title,
        description,
        priority: priority || 'MEDIUM',
        departmentId,
        areaId: areaId || null,
        lineId: lineId || null,
        shiftId: shiftId || null,
        equipmentId: equipmentId || null,
        componentId: componentId || null,
        weekNumber: weekNumber != null ? parseInt(weekNumber, 10) : null,
        dayOfWeekId: dayOfWeekId || null,
        startTime: startTime || null,
        totalMinutesLost: totalMinutesLost != null ? parseInt(totalMinutesLost, 10) : null,
        reportedById: req.user.id,
        organizationId: req.user.organizationId,
      },
      include: {
        Department: { select: { id: true, name: true } },
        Area: { select: { id: true, name: true } },
        Line: { select: { id: true, name: true, lineNumber: true } },
        Shift: { select: { id: true, name: true } },
        Equipment: { select: { id: true, name: true, assetTag: true } },
        Component: { select: { id: true, name: true, partNumber: true } },
        DayOfWeek: { select: { id: true, dayName: true, dayOrder: true } },
        ReportedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    res.status(201).json({ success: true, data: issue, message: 'Issue reported successfully' });

    // Fire-and-forget audit trail
    logAuditEvent({
      action: 'CREATE',
      entity: 'MachineIssue',
      entityId: issue.id,
      userId: req.user.id,
      organizationId: req.user.organizationId,
      changes: {
        issueNumber: issue.issueNumber,
        title: issue.title,
        type: issue.type,
        priority: issue.priority,
        departmentName: issue.Department?.name || null,
        lineName: issue.Line?.name || null,
      },
      ipAddress: (req.ip || req.headers['x-forwarded-for']) as string | undefined,
      userAgent: req.headers['user-agent'] as string | undefined,
    }).catch(() => {});
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /operations/issues/:id — Update issue ────────────────────────────────

router.patch('/issues/:id', async (req: any, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.machineIssue.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ success: false, error: 'Issue not found' });

    const { title, description, type, priority, status, departmentId, areaId, lineId, shiftId, equipmentId, componentId, resolution, weekNumber, dayOfWeekId, startTime, totalMinutesLost } = req.body;

    const data: any = {};
    if (title !== undefined) data.title = title;
    if (description !== undefined) data.description = description;
    if (type !== undefined) data.type = type;
    if (priority !== undefined) data.priority = priority;
    if (departmentId !== undefined) data.departmentId = departmentId;
    if (areaId !== undefined) data.areaId = areaId || null;
    if (lineId !== undefined) data.lineId = lineId || null;
    if (shiftId !== undefined) data.shiftId = shiftId || null;
    if (equipmentId !== undefined) data.equipmentId = equipmentId || null;
    if (componentId !== undefined) data.componentId = componentId || null;
    if (resolution !== undefined) data.resolution = resolution;
    if (weekNumber !== undefined) data.weekNumber = weekNumber != null ? parseInt(weekNumber, 10) : null;
    if (dayOfWeekId !== undefined) data.dayOfWeekId = dayOfWeekId || null;
    if (startTime !== undefined) data.startTime = startTime || null;
    if (totalMinutesLost !== undefined) data.totalMinutesLost = totalMinutesLost != null ? parseInt(totalMinutesLost, 10) : null;

    if (status !== undefined) {
      data.status = status;
      if (status === 'RESOLVED' || status === 'CLOSED') {
        data.resolvedAt = new Date();
        data.resolvedById = req.user.id;
      }
    }

    const updated = await prisma.machineIssue.update({
      where: { id: req.params.id },
      data,
      include: {
        Department: { select: { id: true, name: true } },
        Area: { select: { id: true, name: true } },
        Line: { select: { id: true, name: true, lineNumber: true } },
        Shift: { select: { id: true, name: true } },
        Equipment: { select: { id: true, name: true, assetTag: true } },
        Component: { select: { id: true, name: true, partNumber: true } },
        DayOfWeek: { select: { id: true, dayName: true, dayOrder: true } },
        ReportedBy: { select: { id: true, firstName: true, lastName: true } },
        ResolvedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    res.json({ success: true, data: updated, message: 'Issue updated successfully' });

    // Diff only changed fields for audit trail
    const diff: Record<string, { before: any; after: any }> = {};
    for (const key of Object.keys(data)) {
      const before = (existing as any)[key];
      const after = (data as any)[key];
      const bNorm = before instanceof Date ? before.toISOString() : before;
      const aNorm = after instanceof Date ? after.toISOString() : after;
      if (bNorm !== aNorm) diff[key] = { before: bNorm ?? null, after: aNorm ?? null };
    }
    if (Object.keys(diff).length > 0) {
      logAuditEvent({
        action: 'UPDATE',
        entity: 'MachineIssue',
        entityId: updated.id,
        userId: req.user.id,
        organizationId: req.user.organizationId,
        changes: { issueNumber: updated.issueNumber, diff },
        ipAddress: (req.ip || req.headers['x-forwarded-for']) as string | undefined,
        userAgent: req.headers['user-agent'] as string | undefined,
      }).catch(() => {});
    }
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /operations/issues/:id — Delete issue ───────────────────────────────

router.delete('/issues/:id', requireMinimumRole(UserRole.ADMIN), async (req: any, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.machineIssue.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ success: false, error: 'Issue not found' });

    // Delete photos from Firebase
    const photos = (existing.photos as { url: string; name: string }[]) || [];
    if (photos.length > 0) {
      const bucket = adminStorage.bucket();
      for (const photo of photos) {
        try {
          const filePath = photo.url.split(`${bucket.name}/`)[1];
          if (filePath) await bucket.file(filePath).delete();
        } catch { /* silent */ }
      }
    }

    await prisma.machineIssue.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Issue deleted' });

    logAuditEvent({
      action: 'DELETE',
      entity: 'MachineIssue',
      entityId: existing.id,
      userId: req.user.id,
      organizationId: req.user.organizationId,
      changes: {
        issueNumber: existing.issueNumber,
        title: existing.title,
        type: existing.type,
        priority: existing.priority,
        status: existing.status,
      },
      ipAddress: (req.ip || req.headers['x-forwarded-for']) as string | undefined,
      userAgent: req.headers['user-agent'] as string | undefined,
    }).catch(() => {});
  } catch (err) {
    next(err);
  }
});

// ─── POST /operations/issues/:id/photos — Upload photos ────────────────────────

router.post(
  '/issues/:id/photos',
  upload.array('photos', 15),
  handleMulterError,
  async (req: any, res: Response, next: NextFunction) => {
    try {
      const issue = await prisma.machineIssue.findUnique({ where: { id: req.params.id } });
      if (!issue) return res.status(404).json({ success: false, error: 'Issue not found' });

      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        return res.status(400).json({ success: false, error: 'No files provided' });
      }

      const bucket = adminStorage.bucket();
      const existingPhotos = (issue.photos as { url: string; name: string }[]) || [];
      const uploadedPhotos: { url: string; name: string }[] = [];

      for (const file of files) {
        const ext = path.extname(file.originalname);
        const customName = req.body[`name_${files.indexOf(file)}`] || file.originalname;
        const fileName = `operations/${req.params.id}/${uuidv4()}${ext}`;
        const firebaseFile = bucket.file(fileName);

        await firebaseFile.save(file.buffer, {
          metadata: {
            contentType: file.mimetype,
            metadata: { originalName: customName, uploadedBy: req.user.id },
          },
        });

        await firebaseFile.makePublic();
        const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
        uploadedPhotos.push({ url: publicUrl, name: customName });
      }

      const updated = await prisma.machineIssue.update({
        where: { id: req.params.id },
        data: { photos: [...existingPhotos, ...uploadedPhotos] },
      });

      res.json({ success: true, data: { photos: updated.photos }, message: `${uploadedPhotos.length} photo(s) uploaded` });
    } catch (err) {
      next(err);
    }
  }
);

// ─── DELETE /operations/issues/:id/photos — Delete photo(s) ──────────────────────

router.delete('/issues/:id/photos', async (req: any, res: Response, next: NextFunction) => {
  try {
    const issue = await prisma.machineIssue.findUnique({ where: { id: req.params.id } });
    if (!issue) return res.status(404).json({ success: false, error: 'Issue not found' });

    const { photoUrl, photoUrls } = req.body;
    const urlsToDelete: string[] = photoUrls || (photoUrl ? [photoUrl] : []);
    if (urlsToDelete.length === 0) return res.status(400).json({ success: false, error: 'photoUrl or photoUrls is required' });

    // Delete from Firebase
    const bucket = adminStorage.bucket();
    for (const url of urlsToDelete) {
      try {
        const filePath = url.split(`${bucket.name}/`)[1];
        if (filePath) await bucket.file(filePath).delete();
      } catch { /* silent */ }
    }

    const photos = (issue.photos as { url: string; name: string }[]) || [];
    const deleteSet = new Set(urlsToDelete);
    const updated = await prisma.machineIssue.update({
      where: { id: req.params.id },
      data: { photos: photos.filter(p => !deleteSet.has(p.url)) },
    });

    res.json({ success: true, data: { photos: updated.photos }, message: `${urlsToDelete.length} photo(s) deleted` });
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /operations/issues/:id/photos/rename — Rename a photo ────────────────
router.patch('/issues/:id/photos/rename', async (req, res, next) => {
  try {
    const issue = await prisma.machineIssue.findUnique({ where: { id: req.params.id } });
    if (!issue) return res.status(404).json({ success: false, error: 'Issue not found' });

    const { photoUrl, newName } = req.body;
    if (!photoUrl || !newName) return res.status(400).json({ success: false, error: 'photoUrl and newName are required' });

    const photos = (issue.photos as { url: string; name: string }[]) || [];
    const updatedPhotos = photos.map(p => p.url === photoUrl ? { ...p, name: newName } : p);

    const updated = await prisma.machineIssue.update({
      where: { id: req.params.id },
      data: { photos: updatedPhotos },
    });

    res.json({ success: true, data: { photos: updated.photos }, message: 'Photo renamed' });
  } catch (err) {
    next(err);
  }
});

// ─── GET /operations/stats — Dashboard stats ────────────────────────────────────

router.get('/stats', async (req: any, res: Response, next: NextFunction) => {
  try {
    const orgFilter = getOrgFilter(req);
    const [total, open, inProgress, resolved, byType, byPriority] = await Promise.all([
      prisma.machineIssue.count({ where: orgFilter }),
      prisma.machineIssue.count({ where: { ...orgFilter, status: 'OPEN' } }),
      prisma.machineIssue.count({ where: { ...orgFilter, status: 'IN_PROGRESS' } }),
      prisma.machineIssue.count({ where: { ...orgFilter, status: { in: ['RESOLVED', 'CLOSED'] } } }),
      prisma.machineIssue.groupBy({ by: ['type'], where: orgFilter, _count: true }),
      prisma.machineIssue.groupBy({ by: ['priority'], where: orgFilter, _count: true }),
    ]);

    res.json({
      success: true,
      data: { total, open, inProgress, resolved, byType, byPriority },
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /operations/days-of-week — List active days for organization ───────────

router.get('/days-of-week', async (req: any, res: Response, next: NextFunction) => {
  try {
    const days = await prisma.dayOfWeek.findMany({
      where: {
        organizationId: req.user.organizationId,
        isActive: true,
      },
      orderBy: { dayOrder: 'asc' },
      select: { id: true, dayName: true, dayOrder: true, isActive: true },
    });

    res.json({ success: true, data: days });
  } catch (err) {
    next(err);
  }
});

// ─── GET /operations/weeks — List weeks from database (BakeryWeeklySheet) ───────

router.get('/weeks', async (req: any, res: Response, next: NextFunction) => {
  try {
    // Get org calendar year start settings
    const org = await prisma.organization.findUnique({
      where: { id: req.user.organizationId },
      select: { calendarYearStartMonth: true, calendarYearStartDay: true },
    });

    const startMonth = org?.calendarYearStartMonth || 1;
    const startDay = org?.calendarYearStartDay || 1;
    const now = new Date();
    const currentYear = now.getFullYear();

    // Determine current calendar year start date
    let yearStart = new Date(currentYear, startMonth - 1, startDay);
    if (yearStart > now) {
      yearStart = new Date(currentYear - 1, startMonth - 1, startDay);
    }

    // Filter DB weeks: only those within the current calendar year
    const dbWeeks = await prisma.bakeryWeeklySheet.findMany({
      where: {
        isActive: true,
        weekStart: { gte: yearStart },
      },
      orderBy: { weekStart: 'asc' },
    });

    // Sequential numbering: week 1, 2, 3... based on chronological order
    const weeksAsc = dbWeeks.map((w, index) => {
      const weekStart = new Date(w.weekStart);
      const weekEnd = new Date(w.weekEnd);
      const endPlusOne = new Date(weekEnd.getTime() + 24 * 60 * 60 * 1000);
      const isCurrent = now >= weekStart && now < endPlusOne;
      const weekNumber = index + 1;

      return {
        weekNumber,
        label: w.sheetName,
        startDate: weekStart.toISOString().split('T')[0],
        endDate: weekEnd.toISOString().split('T')[0],
        isCurrent,
      };
    });

    // Return newest first for the dropdown
    const weeks = weeksAsc.reverse();

    const currentWeekEntry = weeks.find(w => w.isCurrent);
    const currentWeek = currentWeekEntry?.weekNumber || (weeks.length > 0 ? weeks[0].weekNumber : 1);

    res.json({ success: true, data: weeks, currentWeek });
  } catch (err) {
    next(err);
  }
});

// ─── POST /operations/issues/extract-from-document ──────────────────────────────
// Accepts a single file (image/pdf/docx/xlsx) and returns an AI-extracted
// issue payload ready to be reviewed/edited by the user before submission.

router.post(
  '/issues/extract-from-document',
  upload.single('file'),
  handleMulterError,
  async (req: any, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, error: 'No file uploaded.' });
      }
      const { extractIssuesFromDocument } = await import('../services/issueDocumentIngestionService');
      const result = await extractIssuesFromDocument({
        buffer: req.file.buffer,
        mimetype: req.file.mimetype,
        originalName: req.file.originalname,
        organizationId: req.user?.organizationId || null,
      });
      if (!result.success) {
        return res.status(400).json({ success: false, error: result.error });
      }
      res.json({ success: true, data: result.data, rawTextPreview: result.rawText });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
