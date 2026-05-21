import { Router, Response } from 'express';
import { Prisma } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requireAdmin } from '../middleware/rbac';
import { prisma } from '../utils/prisma';
import {
  autosaveProductionEosNotes,
  calculateProductionEosReport,
  getProductionEosReferenceData,
  getProductionEosReferenceSources,
  getProductionEosDashboard,
  getProductionEosReportAuditTrail,
  getProductionEosReportById,
  getProductionEosTemplate,
  listProductionEosReports,
  saveProductionEosReport,
  searchProductionEosItems,
} from '../services/productionEosService';

const router = Router();

router.use(authenticate);

function handleError(res: Response, error: any, fallback = 'Production EOS request failed') {
  console.error(fallback, error);
  res.status(error?.statusCode || 500).json({
    success: false,
    error: error?.message || fallback,
  });
}

function decimalOrNull(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(String(value).replace(/,/g, '').trim());
  if (!Number.isFinite(parsed)) {
    const error: any = new Error('Numeric reference fields must contain valid numbers.');
    error.statusCode = 400;
    throw error;
  }
  return new Prisma.Decimal(parsed);
}

function integerOrNull(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(String(value).replace(/,/g, '').trim());
  if (!Number.isInteger(parsed)) {
    const error: any = new Error('Source row must be a whole number.');
    error.statusCode = 400;
    throw error;
  }
  return parsed;
}

router.get('/template', async (req: AuthRequest, res: Response) => {
  try {
    const template = await getProductionEosTemplate(req.user!);
    res.json({ success: true, template });
  } catch (error: any) {
    handleError(res, error, 'Failed to load Production EOS template');
  }
});

router.get('/items', async (req: AuthRequest, res: Response) => {
  try {
    const items = await searchProductionEosItems(req.user!, String(req.query.query || ''));
    res.json({ success: true, items });
  } catch (error: any) {
    handleError(res, error, 'Failed to search Production EOS items');
  }
});

router.post('/calculate', async (req: AuthRequest, res: Response) => {
  try {
    const calculation = await calculateProductionEosReport(req.user!, req.body);
    res.json({ success: true, calculation });
  } catch (error: any) {
    handleError(res, error, 'Failed to calculate Production EOS report');
  }
});

router.get('/dashboard', async (req: AuthRequest, res: Response) => {
  try {
    const dashboard = await getProductionEosDashboard(req.user!, {
      endDate: req.query.endDate as string | undefined,
      shiftId: req.query.shiftId as string | undefined,
      days: req.query.days as string | undefined,
    });
    res.json({ success: true, dashboard });
  } catch (error: any) {
    handleError(res, error, 'Failed to load Production EOS dashboard');
  }
});

router.get('/reports', async (req: AuthRequest, res: Response) => {
  try {
    const reports = await listProductionEosReports(req.user!, {
      date: req.query.date as string | undefined,
      shiftId: req.query.shiftId as string | undefined,
      status: req.query.status as string | undefined,
    });
    res.json({ success: true, reports });
  } catch (error: any) {
    handleError(res, error, 'Failed to list Production EOS reports');
  }
});

router.get('/reports/:id', async (req: AuthRequest, res: Response) => {
  try {
    const report = await getProductionEosReportById(req.user!, req.params.id);
    if (!report) {
      return res.status(404).json({ success: false, error: 'Production EOS report not found' });
    }
    res.json({ success: true, report });
  } catch (error: any) {
    handleError(res, error, 'Failed to load Production EOS report');
  }
});

router.get('/reports/:id/audit-trail', async (req: AuthRequest, res: Response) => {
  try {
    const auditTrail = await getProductionEosReportAuditTrail(req.user!, req.params.id);
    if (!auditTrail) {
      return res.status(404).json({ success: false, error: 'Production EOS report not found' });
    }
    res.json({ success: true, auditTrail });
  } catch (error: any) {
    handleError(res, error, 'Failed to load Production EOS audit trail');
  }
});

router.put('/reports/notes', async (req: AuthRequest, res: Response) => {
  try {
    const report = await autosaveProductionEosNotes(req.user!, req.body);
    res.json({ success: true, report, message: report ? 'Production EOS notes saved' : 'No notes to save' });
  } catch (error: any) {
    handleError(res, error, 'Failed to save Production EOS notes');
  }
});

router.post('/reports', async (req: AuthRequest, res: Response) => {
  try {
    const report = await saveProductionEosReport(req.user!, req.body, false);
    res.json({ success: true, report, message: 'Production EOS draft saved' });
  } catch (error: any) {
    handleError(res, error, 'Failed to save Production EOS report');
  }
});

router.patch('/reports/:id', async (req: AuthRequest, res: Response) => {
  try {
    const report = await saveProductionEosReport(req.user!, req.body, true, {
      targetReportId: req.params.id,
      editSubmitted: true,
    });
    res.json({ success: true, report, message: 'Production EOS report changes saved' });
  } catch (error: any) {
    handleError(res, error, 'Failed to edit Production EOS report');
  }
});

router.post('/reports/:id/submit', async (req: AuthRequest, res: Response) => {
  try {
    const existing = await getProductionEosReportById(req.user!, req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Production EOS report not found' });
    }
    const payload = {
      reportDate: existing.reportDate.toISOString().slice(0, 10),
      dayOfWeek: existing.dayOfWeek,
      shiftId: existing.shiftId,
      shiftName: existing.shiftNameSnapshot,
      reportedByUserId: existing.reportedByUserId,
      reportedByName: existing.reportedByName,
      safetyConcerns: existing.safetyConcerns,
      qualityIssues: existing.qualityIssues,
      lines: existing.lines.map((line) => ({
        rowKey: line.rowKey,
        section: line.section as any,
        sortOrder: line.sortOrder,
        location: line.location,
        lineGroup: line.lineGroup,
        stationType: line.stationType,
        pairedAssemblyRowKey: line.pairedAssemblyRowKey,
        itemNo: line.itemNo,
        casesScheduled: line.casesScheduled?.toString(),
        casesProduced: line.casesProduced?.toString(),
        actualStartTime: line.actualStartTime,
        actualEndTime: line.actualEndTime,
        downMinutes: line.downMinutes?.toString(),
        downtimeComment: line.downtimeComment,
        wasteLbs: line.wasteLbs?.toString(),
        actualHeadcount: line.actualHeadcount?.toString(),
      })),
      notes: existing.notes.map((note) => ({
        lineGroup: note.lineGroup,
        notes: note.notes,
        sortOrder: note.sortOrder,
      })),
    };
    const report = await saveProductionEosReport(req.user!, payload, true);
    res.json({ success: true, report, message: 'Production EOS report submitted' });
  } catch (error: any) {
    handleError(res, error, 'Failed to submit Production EOS report');
  }
});

router.post('/reports/submit', async (req: AuthRequest, res: Response) => {
  try {
    const report = await saveProductionEosReport(req.user!, req.body, true);
    res.json({ success: true, report, message: 'Production EOS report submitted' });
  } catch (error: any) {
    handleError(res, error, 'Failed to submit Production EOS report');
  }
});

router.get('/admin/reference-sources', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const sources = await getProductionEosReferenceSources(req.user!);
    res.json({ success: true, sources });
  } catch (error: any) {
    handleError(res, error, 'Failed to load Production EOS reference sources');
  }
});

router.get('/admin/reference-data', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const referenceData = await getProductionEosReferenceData(req.user!, {
      query: req.query.query as string | undefined,
      active: req.query.active as string | undefined,
    });
    res.json({ success: true, referenceData });
  } catch (error: any) {
    handleError(res, error, 'Failed to load Production EOS reference data');
  }
});

router.post('/admin/reference-data', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const {
      sourceRowNumber,
      itemNo,
      description,
      totalAssemblyHeadcount,
      totalPackHeadcount,
      temporaryAssemblyHeadcount,
      temporaryPackHeadcount,
      weightPerCaseLb,
      isActive = true,
    } = req.body;
    if (!itemNo || !description) {
      return res.status(400).json({ success: false, error: 'Item number and description are required' });
    }
    const created = await prisma.productionEosRateReference.create({
      data: {
        organizationId: user.organizationId,
        sourceRowNumber: integerOrNull(sourceRowNumber),
        itemNo: String(itemNo).trim(),
        description: String(description).trim(),
        totalAssemblyHeadcount: decimalOrNull(totalAssemblyHeadcount),
        totalPackHeadcount: decimalOrNull(totalPackHeadcount),
        temporaryAssemblyHeadcount: decimalOrNull(temporaryAssemblyHeadcount),
        temporaryPackHeadcount: decimalOrNull(temporaryPackHeadcount),
        weightPerCaseLb: decimalOrNull(weightPerCaseLb),
        isActive: Boolean(isActive),
        createdByUserId: user.id,
        updatedByUserId: user.id,
      },
    });
    res.status(201).json({ success: true, reference: created });
  } catch (error: any) {
    handleError(res, error, 'Failed to create Production EOS reference data');
  }
});

router.patch('/admin/reference-data/:id', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const existing = await prisma.productionEosRateReference.findFirst({
      where: {
        id: req.params.id,
        ...(user.role === 'SYSTEM_ADMIN' ? {} : { organizationId: user.organizationId }),
      },
    });
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Reference row not found' });
    }
    const {
      sourceRowNumber,
      itemNo,
      description,
      totalAssemblyHeadcount,
      totalPackHeadcount,
      temporaryAssemblyHeadcount,
      temporaryPackHeadcount,
      weightPerCaseLb,
      isActive,
    } = req.body;
    const updated = await prisma.productionEosRateReference.update({
      where: { id: req.params.id },
      data: {
        ...(sourceRowNumber !== undefined ? { sourceRowNumber: integerOrNull(sourceRowNumber) } : {}),
        ...(itemNo !== undefined ? { itemNo: String(itemNo).trim() } : {}),
        ...(description !== undefined ? { description: String(description).trim() } : {}),
        ...(totalAssemblyHeadcount !== undefined ? { totalAssemblyHeadcount: decimalOrNull(totalAssemblyHeadcount) } : {}),
        ...(totalPackHeadcount !== undefined ? { totalPackHeadcount: decimalOrNull(totalPackHeadcount) } : {}),
        ...(temporaryAssemblyHeadcount !== undefined ? { temporaryAssemblyHeadcount: decimalOrNull(temporaryAssemblyHeadcount) } : {}),
        ...(temporaryPackHeadcount !== undefined ? { temporaryPackHeadcount: decimalOrNull(temporaryPackHeadcount) } : {}),
        ...(weightPerCaseLb !== undefined ? { weightPerCaseLb: decimalOrNull(weightPerCaseLb) } : {}),
        ...(isActive !== undefined ? { isActive: Boolean(isActive) } : {}),
        updatedByUserId: user.id,
      },
    });
    res.json({ success: true, reference: updated });
  } catch (error: any) {
    handleError(res, error, 'Failed to update Production EOS reference data');
  }
});

router.delete('/admin/reference-data/:id', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const existing = await prisma.productionEosRateReference.findFirst({
      where: {
        id: req.params.id,
        ...(user.role === 'SYSTEM_ADMIN' ? {} : { organizationId: user.organizationId }),
      },
    });
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Reference row not found' });
    }
    await prisma.productionEosRateReference.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Reference row deleted' });
  } catch (error: any) {
    handleError(res, error, 'Failed to delete Production EOS reference data');
  }
});

export default router;
