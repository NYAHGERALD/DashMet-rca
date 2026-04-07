import { Router, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { requireMinimumRole } from '../middleware/rbac';
import { UserRole } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { v4 as uuidv4 } from 'uuid';
import { upload, handleMulterError } from '../middleware/upload';
import { adminStorage } from '../config/firebase-admin';
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

// ─── GET /operations/weeks — List weeks for current calendar year ───────────────

router.get('/weeks', async (req: any, res: Response, next: NextFunction) => {
  try {
    const org = await prisma.organization.findUnique({
      where: { id: req.user.organizationId },
      select: { calendarYearStartMonth: true, calendarYearStartDay: true },
    });

    const startMonth = org?.calendarYearStartMonth || 1;
    const startDay = org?.calendarYearStartDay || 1;
    const now = new Date();
    const currentYear = now.getFullYear();

    // Determine calendar year start date
    let yearStart = new Date(currentYear, startMonth - 1, startDay);
    if (yearStart > now) {
      yearStart = new Date(currentYear - 1, startMonth - 1, startDay);
    }

    // Calculate total weeks from yearStart to now + a few weeks ahead
    const msPerWeek = 7 * 24 * 60 * 60 * 1000;
    const elapsed = now.getTime() - yearStart.getTime();
    const currentWeek = Math.ceil(elapsed / msPerWeek) || 1;
    const totalWeeks = Math.min(currentWeek + 2, 53); // show up to 2 weeks ahead

    const weeks = [];
    for (let w = 1; w <= totalWeeks; w++) {
      const weekStart = new Date(yearStart.getTime() + (w - 1) * msPerWeek);
      const weekEnd = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000);
      weeks.push({
        weekNumber: w,
        label: `Week ${w}`,
        startDate: weekStart.toISOString().split('T')[0],
        endDate: weekEnd.toISOString().split('T')[0],
        isCurrent: w === currentWeek,
      });
    }

    res.json({ success: true, data: weeks, currentWeek });
  } catch (err) {
    next(err);
  }
});

export default router;
