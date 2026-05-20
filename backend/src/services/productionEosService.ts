import { Prisma, UserRole } from '@prisma/client';
import { prisma } from '../utils/prisma';

export const PRODUCTION_EOS_CALC_VERSION = 'excel-2026-05-15-v2';

const DAY_OPTIONS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAY_NAMES_BY_JS_DAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export type ProductionEosSection = 'PRODUCTION' | 'CHANGEOVER' | 'REWORK';

export interface ProductionEosLineInput {
  rowKey: string;
  section: ProductionEosSection;
  sortOrder: number;
  location: string;
  productionLineId?: string | null;
  locationUnavailable?: boolean;
  locationHint?: string | null;
  lineGroup?: string | null;
  stationType?: string | null;
  pairedAssemblyRowKey?: string | null;
  itemNo?: string | null;
  casesScheduled?: number | string | null;
  casesProduced?: number | string | null;
  actualStartTime?: string | null;
  actualEndTime?: string | null;
  scheduledStartTime?: string | null;
  scheduledStartTimes?: Array<{ shiftId: string; scheduledStartTime: string }> | null;
  downMinutes?: number | string | null;
  downtimeComment?: string | null;
  wasteLbs?: number | string | null;
  actualHeadcount?: number | string | null;
}

export interface ProductionEosReportPayload {
  reportDate: string;
  dayOfWeek?: string;
  shiftId?: string | null;
  shiftName?: string | null;
  reportedByUserId?: string | null;
  reportedByName?: string | null;
  safetyConcerns?: string | null;
  qualityIssues?: string | null;
  lines: ProductionEosLineInput[];
  notes?: Array<{ lineGroup: string; notes?: string | null; sortOrder?: number }>;
}

type SaveProductionEosReportOptions = {
  targetReportId?: string | null;
  editSubmitted?: boolean;
};

type AuthUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  organizationId: string;
};

type RateReferenceRow = {
  id: string;
  organizationId: string | null;
  sourceRowNumber: number | null;
  itemNo: string;
  description: string;
  totalAssemblyHeadcount: Prisma.Decimal | number | string | null;
  totalPackHeadcount: Prisma.Decimal | number | string | null;
  temporaryAssemblyHeadcount: Prisma.Decimal | number | string | null;
  temporaryPackHeadcount: Prisma.Decimal | number | string | null;
  weightPerCaseLb: Prisma.Decimal | number | string | null;
  isActive: boolean;
  updatedAt?: Date;
};

const PRODUCTION_EOS_SECTIONS: ProductionEosSection[] = ['PRODUCTION', 'CHANGEOVER', 'REWORK'];

const REPORT_AUDIT_ENTITY = 'ProductionEosReport';

const REPORT_AUDIT_FIELDS = [
  ['reportDate', 'Report date'],
  ['shiftNameSnapshot', 'Shift'],
  ['reportedByName', 'Reported by'],
  ['status', 'Status'],
  ['safetyConcerns', 'Safety concerns/incidents'],
  ['qualityIssues', 'Quality issues/holds'],
] as const;

const LINE_AUDIT_FIELDS = [
  ['itemNo', 'Item number'],
  ['casesScheduled', 'Cases scheduled'],
  ['casesProduced', 'Cases produced'],
  ['actualStartTime', 'Actual start'],
  ['actualEndTime', 'Actual end'],
  ['downMinutes', 'Downtime minutes'],
  ['downtimeComment', 'Downtime comment'],
  ['wasteLbs', 'Waste lbs'],
  ['actualHeadcount', 'Actual headcount'],
] as const;

const NOTE_AUDIT_FIELDS = [
  ['notes', 'Notes'],
] as const;

const DEFAULT_ROW_TEMPLATE = [
  { suffix: 'kitchen', sortOrder: 10, location: 'Kitchen', lineGroup: 'Kitchen', stationType: 'KITCHEN', expectedArea: 'kitchen' },
  { suffix: 'line1_assembly', sortOrder: 20, location: 'Line 1: Assembly', lineGroup: 'Line 1', stationType: 'ASSEMBLY', lineNumber: '1', expectedArea: 'assembly' },
  { suffix: 'line1_packoff', sortOrder: 30, location: 'Line 1: Pack Off', lineGroup: 'Line 1', stationType: 'PACK_OFF', lineNumber: '1', expectedArea: 'pack', pairedAssemblySuffix: 'line1_assembly' },
  { suffix: 'line2_assembly', sortOrder: 40, location: 'Line 2: Assembly', lineGroup: 'Line 2', stationType: 'ASSEMBLY', lineNumber: '2', expectedArea: 'assembly' },
  { suffix: 'line2_packoff', sortOrder: 50, location: 'Line 2: Pack Off', lineGroup: 'Line 2', stationType: 'PACK_OFF', lineNumber: '2', expectedArea: 'pack', pairedAssemblySuffix: 'line2_assembly' },
  { suffix: 'line3_assembly', sortOrder: 60, location: 'Line 3: Assembly', lineGroup: 'Line 3', stationType: 'ASSEMBLY', lineNumber: '3', expectedArea: 'assembly' },
  { suffix: 'line3_packoff', sortOrder: 70, location: 'Line 3: Pack Off', lineGroup: 'Line 3', stationType: 'PACK_OFF', lineNumber: '3', expectedArea: 'pack', pairedAssemblySuffix: 'line3_assembly' },
  { suffix: 'line5_assembly', sortOrder: 80, location: 'Line 5: Assembly', lineGroup: 'Line 5', stationType: 'ASSEMBLY', lineNumber: '5', expectedArea: 'assembly' },
  { suffix: 'line5_packoff', sortOrder: 90, location: 'Line 5: Pack Off', lineGroup: 'Line 5', stationType: 'PACK_OFF', lineNumber: '5', expectedArea: 'pack', pairedAssemblySuffix: 'line5_assembly' },
];

type ProductionLineReference = {
  id: string;
  name: string;
  lineNumber: string | number | null;
  scheduledStartTime: string | null;
  LineScheduledStartTime?: Array<{
    shiftId: string;
    scheduledStartTime: string;
    Shift?: {
      id: string;
      name: string;
      startTime: string;
      endTime: string;
    } | null;
  }>;
  Area?: {
    name: string;
  } | null;
};

async function getProductionLineReferences(user: AuthUser): Promise<ProductionLineReference[]> {
  return prisma.line.findMany({
    where: {
      Area: {
        Department: {
          name: { equals: 'Production', mode: 'insensitive' },
          ...(user.role === 'SYSTEM_ADMIN' ? {} : { Facility: { organizationId: user.organizationId } }),
        },
      },
    },
    select: {
      id: true,
      name: true,
      lineNumber: true,
      scheduledStartTime: true,
      LineScheduledStartTime: {
        select: {
          shiftId: true,
          scheduledStartTime: true,
          Shift: {
            select: {
              id: true,
              name: true,
              startTime: true,
              endTime: true,
            },
          },
        },
      },
      Area: {
        select: {
          name: true,
        },
      },
    },
    orderBy: [{ lineNumber: 'asc' }, { name: 'asc' }],
  });
}

const SUPERVISOR_PLUS = new Set([
  'SUPERVISOR',
  'QA_FOOD_SAFETY',
  'QUALITY_CONTROL_MANAGER',
  'MAINTENANCE_ENGINEERING',
  'SAFETY_SECURITY_MANAGER',
  'CI_MANAGER',
  'ADMIN',
  'SYSTEM_ADMIN',
]);

function normalizeShiftKey(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, '_');
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const parsed = Number(String(value).replace(/,/g, '').trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function toStringOrNull(value: unknown) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length ? text : null;
}

function normalizeLookupText(value: unknown) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function safeDiv(numerator: number | null, denominator: number | null) {
  if (numerator === null || denominator === null || denominator === 0) return null;
  return numerator / denominator;
}

function calculateTotals(calculatedLines: any[]) {
  return {
    casesScheduled: round(sum(calculatedLines.map((line) => line.casesScheduled)), 3),
    casesProduced: round(sum(calculatedLines.map((line) => line.casesProduced)), 3),
    lbsScheduled: round(sum(calculatedLines.map((line) => line.lbsScheduled)), 3),
    lbsProduced: round(sum(calculatedLines.map((line) => line.lbsProduced)), 3),
    attainmentPct: round(average(calculatedLines.map((line) => line.attainmentPct))),
    totalMinutes: round(sum(calculatedLines.map((line) => line.totalMinutes)), 3),
    lateStartMinutes: round(sum(calculatedLines.map((line) => line.lateStartMinutes)), 3),
    wasteLbs: round(sum(calculatedLines.map((line) => line.wasteLbs)), 3),
    wastePct: round(safeDiv(sum(calculatedLines.map((line) => line.wasteLbs)), sum(calculatedLines.map((line) => line.lbsProduced)))),
    standardHeadcount: round(sum(calculatedLines.map((line) => line.standardHeadcount)), 3),
    actualHeadcount: round(sum(calculatedLines.map((line) => line.actualHeadcount)), 3),
    headcountPct: round(safeDiv(sum(calculatedLines.map((line) => line.actualHeadcount)), sum(calculatedLines.map((line) => line.standardHeadcount)))),
  };
}

function round(value: number | null, decimals = 4) {
  if (value === null || !Number.isFinite(value)) return null;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function decimal(value: number | null | undefined) {
  return value === null || value === undefined || Number.isNaN(value) ? null : new Prisma.Decimal(value);
}

function parseTimeToMinutes(value?: string | null) {
  const text = toStringOrNull(value);
  if (!text) return null;
  const trimmed = text.toUpperCase();
  const match = trimmed.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2] || 0);
  const meridiem = match[3];
  if (minute < 0 || minute > 59) return null;
  if (meridiem) {
    if (hour < 1 || hour > 12) return null;
    if (meridiem === 'PM' && hour !== 12) hour += 12;
    if (meridiem === 'AM' && hour === 12) hour = 0;
  }
  if (hour < 0 || hour > 23) return null;
  return hour * 60 + minute;
}

function minutesBetween(start?: string | null, end?: string | null, signed = false) {
  const startMinutes = parseTimeToMinutes(start);
  const endMinutes = parseTimeToMinutes(end);
  if (startMinutes === null || endMinutes === null) return null;
  let diff = endMinutes - startMinutes;
  if (signed) {
    if (diff < -720) diff += 1440;
    if (diff > 720) diff -= 1440;
    return diff;
  }
  if (diff < 0) diff += 1440;
  return diff;
}

function dayNameFromDate(reportDate: string) {
  const date = new Date(`${reportDate}T12:00:00`);
  if (Number.isNaN(date.getTime())) return '';
  return DAY_NAMES_BY_JS_DAY[date.getDay()];
}

function orgRateReferenceWhere(organizationId: string, itemNos?: string[]) {
  return {
    isActive: true,
    OR: [{ organizationId }, { organizationId: null }],
    ...(itemNos ? { itemNo: { in: itemNos } } : {}),
  };
}

function buildRateReferenceMap(rows: RateReferenceRow[]) {
  const map = new Map<string, RateReferenceRow>();
  rows
    .filter((row) => row.itemNo)
    .sort((a, b) => Number(a.organizationId ? 0 : 1) - Number(b.organizationId ? 0 : 1) || (a.sourceRowNumber || 0) - (b.sourceRowNumber || 0))
    .forEach((row) => {
      const key = String(row.itemNo);
      if (!map.has(key)) map.set(key, row);
    });
  return map;
}

function standardHeadcountForLine(rateRef: RateReferenceRow | null | undefined, line: ProductionEosLineInput) {
  if (!rateRef) return null;
  const stationType = line.stationType || null;

  if (line.lineGroup === 'Line 5') {
    const temporaryHeadcount = stationType === 'PACK_OFF'
      ? toNumber(rateRef.temporaryPackHeadcount)
      : toNumber(rateRef.temporaryAssemblyHeadcount);
    if (temporaryHeadcount !== null) return temporaryHeadcount;
  }

  if (stationType === 'PACK_OFF') return toNumber(rateRef.totalPackHeadcount);
  return toNumber(rateRef.totalAssemblyHeadcount);
}

function average(values: Array<number | null>) {
  const clean = values.filter((value): value is number => value !== null && Number.isFinite(value));
  if (!clean.length) return null;
  return clean.reduce((sum, value) => sum + value, 0) / clean.length;
}

function sum(values: Array<number | null>) {
  return values.reduce<number>((total, value) => total + (value || 0), 0);
}

function applyDerivedLineLocation(line: ProductionEosLineInput) {
  return line;
}

function productionLineMatchesArea(line: ProductionLineReference, expectedArea?: string) {
  const areaName = normalizeLookupText(line.Area?.name);
  const lineName = normalizeLookupText(line.name);
  if (expectedArea === 'kitchen') return areaName.includes('kitchen') || lineName.includes('kitchen');
  if (expectedArea === 'assembly') return areaName.includes('assembly') || lineName.includes('assembly');
  if (expectedArea === 'pack') return areaName.includes('pack') || lineName.includes('pack');
  return false;
}

function findProductionLineForTemplate(row: (typeof DEFAULT_ROW_TEMPLATE)[number], refs: ProductionLineReference[]) {
  if (row.stationType === 'KITCHEN') {
    return refs.find((line) => !toStringOrNull(line.lineNumber) && productionLineMatchesArea(line, row.expectedArea))
      || refs.find((line) => productionLineMatchesArea(line, row.expectedArea));
  }

  return refs.find((line) => (
    toStringOrNull(line.lineNumber) === row.lineNumber
    && productionLineMatchesArea(line, row.expectedArea)
  ));
}

function rowWithProductionLineReference(section: ProductionEosSection, row: (typeof DEFAULT_ROW_TEMPLATE)[number], refs: ProductionLineReference[]) {
  const prefix = section.toLowerCase();
  const productionLine = findProductionLineForTemplate(row, refs);
  const rowKey = `${prefix}_${row.suffix}`;
  const missingHint = row.stationType === 'KITCHEN'
    ? 'Production Kitchen line is missing. Contact your Admin to create it in Admin > Production Lines.'
    : `${row.lineGroup} ${row.stationType === 'PACK_OFF' ? 'Pack Off' : 'Assembly'} line is missing. Contact your Admin to create it in Admin > Production Lines.`;

  return {
    rowKey,
    section,
    sortOrder: row.sortOrder,
    location: productionLine?.name || 'Unavailable',
    productionLineId: productionLine?.id || null,
    scheduledStartTime: null,
    scheduledStartTimes: productionLine?.LineScheduledStartTime?.map((row) => ({
      shiftId: row.shiftId,
      scheduledStartTime: row.scheduledStartTime,
    })) || [],
    locationUnavailable: !productionLine,
    locationHint: productionLine ? null : missingHint,
    lineGroup: row.lineGroup,
    stationType: row.stationType,
    pairedAssemblyRowKey: row.pairedAssemblySuffix ? `${prefix}_${row.pairedAssemblySuffix}` : undefined,
  };
}

function rowsForSectionWithProductionLines(section: ProductionEosSection, refs: ProductionLineReference[]): ProductionEosLineInput[] {
  return DEFAULT_ROW_TEMPLATE.map((row) => rowWithProductionLineReference(section, row, refs));
}

function lineOptionsFromRows(rows: ProductionEosLineInput[]) {
  return rows
    .filter((row) => row.section === 'PRODUCTION' && row.stationType === 'ASSEMBLY' && row.lineGroup !== 'Kitchen')
    .map((assembly) => {
      const packOff = rows.find((row) => row.section === 'PRODUCTION' && row.pairedAssemblyRowKey === assembly.rowKey);
      return {
        assembly: assembly.location,
        packOff: packOff?.location || 'Unavailable',
        lineGroup: assembly.lineGroup || '',
      };
    });
}

export async function getProductionEosTemplate(user: AuthUser) {
  const organizationId = user.organizationId;
  const canChooseReporter = SUPERVISOR_PLUS.has(user.role);
  const reporterOptions = canChooseReporter
    ? await prisma.user.findMany({
      where: {
        organizationId,
        isActive: true,
        role: { in: Array.from(SUPERVISOR_PLUS) as UserRole[] },
      },
      select: { id: true, firstName: true, lastName: true, email: true, role: true },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    })
    : [];

  const currentReporter = {
    id: user.id,
    name: `${user.firstName} ${user.lastName}`.trim() || user.email,
    email: user.email,
    role: user.role,
  };

  const productionLines = await getProductionLineReferences(user);

  const productionLineIds = productionLines.map((line) => line.id);
  const shifts = productionLineIds.length
    ? await prisma.shift.findMany({
      where: {
        ...(user.role === 'SYSTEM_ADMIN' ? {} : { Facility: { organizationId } }),
        OR: [
          { lineId: { in: productionLineIds } },
          { ShiftLine: { some: { lineId: { in: productionLineIds } } } },
          { LineScheduledStartTime: { some: { lineId: { in: productionLineIds } } } },
        ],
      },
      select: { id: true, name: true, startTime: true, endTime: true, facilityId: true },
      orderBy: [{ name: 'asc' }],
    })
    : [];

  const rows = PRODUCTION_EOS_SECTIONS.flatMap((section) => rowsForSectionWithProductionLines(section, productionLines));

  return {
    calculationVersion: PRODUCTION_EOS_CALC_VERSION,
    rows,
    lineOptions: lineOptionsFromRows(rows),
    dayOptions: DAY_OPTIONS,
    shifts,
    reporter: {
      mode: canChooseReporter ? 'select_by_role' : 'current_user',
      current: currentReporter,
      options: reporterOptions.map((reporter) => ({
        id: reporter.id,
        name: `${reporter.firstName} ${reporter.lastName}`.trim() || reporter.email,
        email: reporter.email,
        role: reporter.role,
      })),
    },
  };
}

export async function searchProductionEosItems(user: AuthUser, query = '') {
  const q = query.trim();
  const where: any = {
    isActive: true,
    OR: [{ organizationId: user.organizationId }, { organizationId: null }],
  };
  if (q) {
    where.AND = [{
      OR: [
        { itemNo: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
      ],
    }];
  }

  const rows = await prisma.productionEosRateReference.findMany({
    where,
    select: { id: true, itemNo: true, description: true, sourceRowNumber: true, organizationId: true },
    orderBy: [{ itemNo: 'asc' }, { sourceRowNumber: 'asc' }],
    take: 30,
  });

  const seen = new Set<string>();
  return rows
    .filter((row) => {
      if (!row.itemNo || seen.has(row.itemNo)) return false;
      seen.add(row.itemNo);
      return true;
    })
    .map((row) => ({
      id: row.id,
      itemNo: row.itemNo,
      description: row.description,
    }));
}

export async function calculateProductionEosReport(user: AuthUser, payload: ProductionEosReportPayload) {
  const organizationId = user.organizationId;
  const reportDate = payload.reportDate;
  const derivedDayOfWeek = dayNameFromDate(reportDate);
  const dayOfWeek = payload.dayOfWeek || derivedDayOfWeek;
  const warnings: string[] = [];

  if (payload.dayOfWeek && derivedDayOfWeek && payload.dayOfWeek !== derivedDayOfWeek) {
    warnings.push(`Selected day (${payload.dayOfWeek}) does not match report date (${derivedDayOfWeek}).`);
  }

  const productionLineReferences = await getProductionLineReferences(user);
  const templateLineByRowKey = new Map(
    PRODUCTION_EOS_SECTIONS
      .flatMap((section) => rowsForSectionWithProductionLines(section, productionLineReferences))
      .map((line) => [line.rowKey, line]),
  );
  const normalizedLines = payload.lines
    .map(applyDerivedLineLocation)
    .map((line) => {
      if (line.productionLineId) return line;
      const templateLine = templateLineByRowKey.get(line.rowKey);
      if (!templateLine?.productionLineId) return line;
      return {
        ...line,
        productionLineId: templateLine.productionLineId,
        scheduledStartTimes: templateLine.scheduledStartTimes || line.scheduledStartTimes,
      };
    });
  const productionLineIds = Array.from(new Set(normalizedLines.map((line) => toStringOrNull(line.productionLineId)).filter((value): value is string => Boolean(value))));
  const productionShiftRelationWhere = productionLineIds.length
    ? {
      OR: [
        { lineId: { in: productionLineIds } },
        { ShiftLine: { some: { lineId: { in: productionLineIds } } } },
        { LineScheduledStartTime: { some: { lineId: { in: productionLineIds } } } },
      ],
    }
    : { id: '__no_production_line_shift__' };

  const shift = payload.shiftId
    ? await prisma.shift.findFirst({
      where: {
        id: payload.shiftId,
        ...(user.role === 'SYSTEM_ADMIN' ? {} : { Facility: { organizationId } }),
        ...productionShiftRelationWhere,
      },
      select: { id: true, name: true, startTime: true, endTime: true },
    })
    : null;

  if (payload.shiftId && !shift) {
    const error: any = new Error('Select a Production shift before saving Production EOS.');
    error.statusCode = 400;
    throw error;
  }

  const shiftName = shift?.name || payload.shiftName || 'Unassigned Shift';
  const shiftKey = normalizeShiftKey(shiftName);
  const selectedShiftStarts = payload.shiftId && productionLineIds.length
    ? await prisma.lineScheduledStartTime.findMany({
      where: {
        shiftId: payload.shiftId,
        lineId: { in: productionLineIds },
      },
      select: {
        lineId: true,
        scheduledStartTime: true,
      },
    })
    : [];
  const selectedShiftStartByLineId = new Map(selectedShiftStarts.map((row) => [row.lineId, row.scheduledStartTime]));
  const itemNos = Array.from(new Set(normalizedLines.map((line) => toStringOrNull(line.itemNo)).filter((value): value is string => Boolean(value))));

  const rateRefs = itemNos.length
    ? await prisma.productionEosRateReference.findMany({
      where: orgRateReferenceWhere(organizationId, itemNos),
      orderBy: [{ sourceRowNumber: 'asc' }],
    })
    : [];

  const rateMap = buildRateReferenceMap(rateRefs as RateReferenceRow[]);
  const byRowKey = new Map(normalizedLines.map((line) => [line.rowKey, line]));

  const calculatedLines = normalizedLines.map((line) => {
    const parent = line.pairedAssemblyRowKey ? byRowKey.get(line.pairedAssemblyRowKey) : null;
    const effectiveItemNo = toStringOrNull(line.itemNo) || toStringOrNull(parent?.itemNo);
    const rateRef = effectiveItemNo ? rateMap.get(effectiveItemNo) : null;
    const lineWarnings: string[] = [];
    const stationType = line.stationType || null;
    const isAssembly = stationType === 'ASSEMBLY' || stationType === 'KITCHEN';

    if (effectiveItemNo && !rateRef) {
      lineWarnings.push(`No Rates reference found for item ${effectiveItemNo}.`);
    }

    const casesScheduled = toNumber(line.casesScheduled);
    const casesProduced = toNumber(line.casesProduced);
    const parentCasesProduced = toNumber(parent?.casesProduced);
    const downMinutes = toNumber(line.downMinutes) || 0;
    const wasteLbs = toNumber(line.wasteLbs) || 0;
    const actualHeadcount = toNumber(line.actualHeadcount);
    const poundsPerCase = toNumber(rateRef?.weightPerCaseLb);
    const standardHeadcount = standardHeadcountForLine(rateRef, line);
    const description = effectiveItemNo ? rateRef?.description || null : null;

    const parentRef = parent?.itemNo ? rateMap.get(String(parent.itemNo)) : null;
    const parentPoundsPerCase = toNumber(parentRef?.weightPerCaseLb);
    const parentLbsProduced = parentPoundsPerCase !== null && parentCasesProduced !== null
      ? parentPoundsPerCase * parentCasesProduced
      : null;

    const lbsScheduled = isAssembly && poundsPerCase !== null && casesScheduled !== null ? poundsPerCase * casesScheduled : null;
    const lbsProduced = isAssembly && poundsPerCase !== null && casesProduced !== null ? poundsPerCase * casesProduced : null;
    const totalMinutes = minutesBetween(line.actualStartTime, line.actualEndTime);
    const scheduledStartTime = line.productionLineId
      ? selectedShiftStartByLineId.get(line.productionLineId) || null
      : null;
    const lateStartMinutes = scheduledStartTime ? minutesBetween(scheduledStartTime, line.actualStartTime, true) : null;
    const wasteBase = stationType === 'PACK_OFF' ? parentLbsProduced : lbsProduced;
    const wastePct = safeDiv(wasteLbs, wasteBase);
    const attainmentPct = line.lineGroup === 'Line 2' && isAssembly
      ? safeDiv(casesProduced, casesScheduled)
      : safeDiv(lbsProduced, lbsScheduled);
    const headcountPct = safeDiv(actualHeadcount, standardHeadcount);

    return {
      ...line,
      itemNo: effectiveItemNo,
      itemDescriptionSnapshot: description,
      casesScheduled,
      casesProduced,
      downMinutes,
      wasteLbs,
      actualHeadcount,
      scheduledStartTime,
      lbsScheduled: round(lbsScheduled, 3),
      lbsProduced: round(lbsProduced, 3),
      attainmentPct: round(attainmentPct),
      totalMinutes: round(totalMinutes, 3),
      lateStartMinutes: round(lateStartMinutes, 3),
      wastePct: round(wastePct),
      standardHeadcount: round(standardHeadcount, 3),
      headcountPct: round(headcountPct),
      calculatedValues: {
        effectiveItemNo,
        rateReferenceId: rateRef?.id || null,
        calculationVersion: PRODUCTION_EOS_CALC_VERSION,
      },
      validationWarnings: lineWarnings,
    };
  });

  const totals = calculateTotals(calculatedLines);
  const totalsBySection = PRODUCTION_EOS_SECTIONS.reduce((acc, section) => {
    acc[section] = calculateTotals(calculatedLines.filter((line) => line.section === section));
    return acc;
  }, {} as Record<ProductionEosSection, ReturnType<typeof calculateTotals>>);

  return {
    reportDate,
    dayOfWeek,
    derivedDayOfWeek,
    shift: shift ? { id: shift.id, name: shift.name, startTime: shift.startTime, endTime: shift.endTime } : null,
    shiftKey,
    shiftName,
    reportedByName: payload.reportedByName || `${user.firstName} ${user.lastName}`.trim() || user.email,
    lines: calculatedLines,
    totals,
    totalsBySection,
    validationWarnings: warnings,
  };
}

function lineDataForSave(line: any) {
  return {
    section: line.section,
    rowKey: line.rowKey,
    sortOrder: line.sortOrder,
    location: line.location,
    lineGroup: line.lineGroup || null,
    stationType: line.stationType || null,
    pairedAssemblyRowKey: line.pairedAssemblyRowKey || null,
    itemNo: line.itemNo || null,
    itemDescriptionSnapshot: line.itemDescriptionSnapshot || null,
    casesScheduled: decimal(line.casesScheduled),
    casesProduced: decimal(line.casesProduced),
    actualStartTime: line.actualStartTime || null,
    actualEndTime: line.actualEndTime || null,
    downMinutes: decimal(line.downMinutes),
    downtimeComment: line.downtimeComment || null,
    wasteLbs: decimal(line.wasteLbs),
    actualHeadcount: decimal(line.actualHeadcount),
    scheduledStartTime: line.scheduledStartTime || null,
    lbsScheduled: decimal(line.lbsScheduled),
    lbsProduced: decimal(line.lbsProduced),
    attainmentPct: decimal(line.attainmentPct),
    totalMinutes: decimal(line.totalMinutes),
    lateStartMinutes: decimal(line.lateStartMinutes),
    wastePct: decimal(line.wastePct),
    standardHeadcount: decimal(line.standardHeadcount),
    headcountPct: decimal(line.headcountPct),
    calculatedValues: line.calculatedValues || {},
    validationWarnings: line.validationWarnings || [],
  };
}

function auditUserName(user: AuthUser) {
  return `${user.firstName} ${user.lastName}`.trim() || user.email;
}

function auditValue(value: any): any {
  if (value === undefined) return null;
  if (value === null) return null;
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Prisma.Decimal) return value.toString();
  if (Array.isArray(value)) return value.map(auditValue);
  if (typeof value === 'object') {
    if (typeof value.toString === 'function' && value.constructor?.name === 'Decimal') return value.toString();
    return Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        acc[key] = auditValue(value[key]);
        return acc;
      }, {} as Record<string, any>);
  }
  return value;
}

function auditValuesEqual(a: any, b: any) {
  return JSON.stringify(auditValue(a)) === JSON.stringify(auditValue(b));
}

const NUMERIC_AUDIT_FIELDS = new Set([
  'casesScheduled',
  'casesProduced',
  'downMinutes',
  'wasteLbs',
  'actualHeadcount',
]);

function blankNormalized(value: any) {
  return value === undefined || value === null || value === '' ? null : value;
}

function dateOnlyForAudit(value: any) {
  const normalized = blankNormalized(value);
  if (normalized === null) return null;
  if (normalized instanceof Date) return normalized.toISOString().slice(0, 10);
  const text = String(normalized);
  return text.includes('T') ? text.slice(0, 10) : text;
}

function auditFieldValuesEqual(field: string, a: any, b: any) {
  const left = blankNormalized(a);
  const right = blankNormalized(b);
  if (left === null && right === null) return true;

  if (field === 'reportDate') {
    return dateOnlyForAudit(left) === dateOnlyForAudit(right);
  }

  if (NUMERIC_AUDIT_FIELDS.has(field)) {
    const leftNumber = Number(left);
    const rightNumber = Number(right);
    if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
      return Math.abs(leftNumber - rightNumber) < 0.0005;
    }
  }

  return auditValuesEqual(left, right);
}

function diffFields(source: Record<string, any>, target: Record<string, any>, fields: readonly (readonly [string, string])[]) {
  return fields
    .map(([field, label]) => ({
      field,
      label,
      previousValue: auditValue(source?.[field]),
      currentValue: auditValue(target?.[field]),
    }))
    .filter((change) => !auditFieldValuesEqual(change.field, source?.[change.field], target?.[change.field]));
}

function reportSnapshotFromExisting(report: any) {
  if (!report) return null;
  return {
    report: {
      reportDate: report.reportDate,
      dayOfWeek: report.dayOfWeek,
      shiftId: report.shiftId,
      shiftKey: report.shiftKey,
      shiftNameSnapshot: report.shiftNameSnapshot,
      reportedByName: report.reportedByName,
      status: report.status,
      safetyConcerns: report.safetyConcerns,
      qualityIssues: report.qualityIssues,
      totals: report.totals,
      validationWarnings: report.validationWarnings,
    },
    lines: (report.lines || []).map((line: any) => ({
      rowKey: line.rowKey,
      section: line.section,
      sortOrder: line.sortOrder,
      location: line.location,
      lineGroup: line.lineGroup,
      stationType: line.stationType,
      pairedAssemblyRowKey: line.pairedAssemblyRowKey,
      itemNo: line.itemNo,
      itemDescriptionSnapshot: line.itemDescriptionSnapshot,
      casesScheduled: line.casesScheduled,
      casesProduced: line.casesProduced,
      actualStartTime: line.actualStartTime,
      actualEndTime: line.actualEndTime,
      downMinutes: line.downMinutes,
      downtimeComment: line.downtimeComment,
      wasteLbs: line.wasteLbs,
      actualHeadcount: line.actualHeadcount,
      scheduledStartTime: line.scheduledStartTime,
      lbsScheduled: line.lbsScheduled,
      lbsProduced: line.lbsProduced,
      attainmentPct: line.attainmentPct,
      totalMinutes: line.totalMinutes,
      lateStartMinutes: line.lateStartMinutes,
      wastePct: line.wastePct,
      standardHeadcount: line.standardHeadcount,
      headcountPct: line.headcountPct,
      validationWarnings: line.validationWarnings,
    })),
    notes: (report.notes || []).map((note: any) => ({
      lineGroup: note.lineGroup,
      notes: note.notes,
      sortOrder: note.sortOrder,
    })),
  };
}

function reportSnapshotFromCalculation(calculation: any, payload: ProductionEosReportPayload, status: string, reporterName: string) {
  return {
    report: {
      reportDate: calculation.reportDate,
      dayOfWeek: calculation.dayOfWeek,
      shiftId: payload.shiftId || null,
      shiftKey: calculation.shiftKey,
      shiftNameSnapshot: calculation.shiftName,
      reportedByName: reporterName,
      status,
      safetyConcerns: payload.safetyConcerns || null,
      qualityIssues: payload.qualityIssues || null,
      totals: { ...calculation.totals, bySection: calculation.totalsBySection },
      validationWarnings: calculation.validationWarnings,
    },
    lines: calculation.lines.map((line: any) => ({
      ...lineDataForSave(line),
      rowKey: line.rowKey,
    })),
    notes: (payload.notes || []).map((note, index) => ({
      lineGroup: note.lineGroup,
      notes: note.notes || null,
      sortOrder: note.sortOrder ?? index,
    })),
  };
}

function diffRows(beforeRows: any[], afterRows: any[], keyField: string, fields: readonly (readonly [string, string])[]) {
  const beforeMap = new Map(beforeRows.map((row) => [row[keyField], row]));
  const afterMap = new Map(afterRows.map((row) => [row[keyField], row]));
  const keys = Array.from(new Set([...beforeMap.keys(), ...afterMap.keys()])).sort((a, b) => String(a).localeCompare(String(b)));

  return keys.flatMap((key) => {
    const before = beforeMap.get(key);
    const after = afterMap.get(key);
    if (!before && after) {
      return [{
        key,
        changeType: 'ADDED',
        section: after.section || null,
        location: after.location || after.lineGroup || key,
        fields: fields.map(([field, label]) => ({
          field,
          label,
          previousValue: null,
          currentValue: auditValue(after[field]),
        })).filter((change) => change.currentValue !== null && change.currentValue !== ''),
      }];
    }
    if (before && !after) {
      return [{
        key,
        changeType: 'REMOVED',
        section: before.section || null,
        location: before.location || before.lineGroup || key,
        fields: fields.map(([field, label]) => ({
          field,
          label,
          previousValue: auditValue(before[field]),
          currentValue: null,
        })).filter((change) => change.previousValue !== null && change.previousValue !== ''),
      }];
    }

    const fieldChanges = diffFields(before, after, fields);
    return fieldChanges.length
      ? [{
        key,
        changeType: 'UPDATED',
        section: after.section || before.section || null,
        location: after.location || before.location || after.lineGroup || before.lineGroup || key,
        fields: fieldChanges,
      }]
      : [];
  });
}

function buildProductionEosAuditChanges(args: {
  user: AuthUser;
  eventType: string;
  eventLabel: string;
  before: ReturnType<typeof reportSnapshotFromExisting> | null;
  after: ReturnType<typeof reportSnapshotFromCalculation>;
}) {
  const reportChanges = args.before ? diffFields(args.before.report, args.after.report, REPORT_AUDIT_FIELDS) : [];
  const lineChanges = args.before ? diffRows(args.before.lines, args.after.lines, 'rowKey', LINE_AUDIT_FIELDS) : [];
  const noteChanges = args.before ? diffRows(args.before.notes, args.after.notes, 'lineGroup', NOTE_AUDIT_FIELDS) : [];
  const lineFieldChangeCount = lineChanges.reduce((total, row) => total + row.fields.length, 0);
  const noteFieldChangeCount = noteChanges.reduce((total, row) => total + row.fields.length, 0);

  return {
    eventType: args.eventType,
    eventLabel: args.eventLabel,
    actor: {
      id: args.user.id,
      name: auditUserName(args.user),
      email: args.user.email,
      role: args.user.role,
    },
    reportContext: {
      reportDate: auditValue(args.after.report.reportDate),
      dayOfWeek: args.after.report.dayOfWeek,
      shiftId: args.after.report.shiftId,
      shiftName: args.after.report.shiftNameSnapshot,
      statusBefore: args.before?.report.status || null,
      statusAfter: args.after.report.status,
    },
    summary: {
      reportFieldChanges: reportChanges.length,
      lineRowsChanged: lineChanges.length,
      lineFieldChanges: lineFieldChangeCount,
      noteRowsChanged: noteChanges.length,
      noteFieldChanges: noteFieldChangeCount,
      totalFieldChanges: reportChanges.length + lineFieldChangeCount + noteFieldChangeCount,
    },
    reportChanges,
    lineChanges,
    noteChanges,
  };
}

export async function saveProductionEosReport(user: AuthUser, payload: ProductionEosReportPayload, submit = false, options: SaveProductionEosReportOptions = {}) {
  const calculation = await calculateProductionEosReport(user, payload);
  const organizationId = user.organizationId;
  const reportDate = new Date(`${calculation.reportDate}T00:00:00`);

  const existing = options.targetReportId
    ? await prisma.productionEosReport.findFirst({
      where: {
        id: options.targetReportId,
        ...(user.role === 'SYSTEM_ADMIN' ? {} : { organizationId }),
      },
      include: {
        lines: { orderBy: { sortOrder: 'asc' } },
        notes: { orderBy: { sortOrder: 'asc' } },
      },
    })
    : await prisma.productionEosReport.findUnique({
      where: {
        organizationId_reportDate_shiftKey: {
          organizationId,
          reportDate,
          shiftKey: calculation.shiftKey,
        },
      },
      include: {
        lines: { orderBy: { sortOrder: 'asc' } },
        notes: { orderBy: { sortOrder: 'asc' } },
      },
    });

  if (options.targetReportId && !existing) {
    const error: any = new Error('Production EOS report not found.');
    error.statusCode = 404;
    throw error;
  }

  if (options.targetReportId && existing) {
    const existingDate = existing.reportDate.toISOString().slice(0, 10);
    if (existingDate !== calculation.reportDate || existing.shiftKey !== calculation.shiftKey) {
      const error: any = new Error('Report date and shift cannot be changed while editing a submitted report.');
      error.statusCode = 400;
      throw error;
    }
  }

  if (existing?.status === 'SUBMITTED' && !['ADMIN', 'SYSTEM_ADMIN'].includes(user.role) && !submit && !options.editSubmitted) {
    throw new Error('This Production EOS report is already submitted. Ask an admin to reopen or edit it.');
  }

  const reporterName = payload.reportedByName || calculation.reportedByName;
  const status = submit ? 'SUBMITTED' : existing?.status === 'SUBMITTED' ? 'SUBMITTED' : 'DRAFT';
  const beforeSnapshot = reportSnapshotFromExisting(existing);
  const afterSnapshot = reportSnapshotFromCalculation(calculation, payload, status, reporterName);
  const eventType = !existing
    ? (submit ? 'REPORT_CREATED_AND_SUBMITTED' : 'DRAFT_CREATED')
    : existing.status !== 'SUBMITTED' && submit
      ? 'REPORT_SUBMITTED'
      : existing.status === 'SUBMITTED'
        ? 'SUBMITTED_REPORT_EDITED'
        : 'DRAFT_UPDATED';
  const eventLabel = !existing
    ? (submit ? 'Report created and submitted' : 'Draft created')
    : existing.status !== 'SUBMITTED' && submit
      ? 'Report submitted'
      : existing.status === 'SUBMITTED'
        ? 'Submitted report edited'
        : 'Draft updated';

  const report = await prisma.$transaction(async (tx) => {
    const saved = existing
      ? await tx.productionEosReport.update({
        where: { id: existing.id },
        data: {
          dayOfWeek: calculation.dayOfWeek,
          shiftId: payload.shiftId || null,
          shiftKey: calculation.shiftKey,
          shiftNameSnapshot: calculation.shiftName,
          reportedByUserId: payload.reportedByUserId || user.id,
          reportedByName: reporterName,
          status,
          safetyConcerns: payload.safetyConcerns || null,
          qualityIssues: payload.qualityIssues || null,
          calculationVersion: PRODUCTION_EOS_CALC_VERSION,
          totals: { ...calculation.totals, bySection: calculation.totalsBySection },
          validationWarnings: calculation.validationWarnings,
          updatedByUserId: user.id,
          ...(submit ? { submittedAt: new Date(), submittedByUserId: user.id } : {}),
        },
      })
      : await tx.productionEosReport.create({
        data: {
          organizationId,
          reportDate,
          dayOfWeek: calculation.dayOfWeek,
          shiftId: payload.shiftId || null,
          shiftKey: calculation.shiftKey,
          shiftNameSnapshot: calculation.shiftName,
          reportedByUserId: payload.reportedByUserId || user.id,
          reportedByName: reporterName,
          status,
          safetyConcerns: payload.safetyConcerns || null,
          qualityIssues: payload.qualityIssues || null,
          calculationVersion: PRODUCTION_EOS_CALC_VERSION,
          totals: { ...calculation.totals, bySection: calculation.totalsBySection },
          validationWarnings: calculation.validationWarnings,
          createdByUserId: user.id,
          updatedByUserId: user.id,
          ...(submit ? { submittedAt: new Date(), submittedByUserId: user.id } : {}),
        },
      });

    await tx.productionEosReportLine.deleteMany({ where: { reportId: saved.id } });
    await tx.productionEosReportNote.deleteMany({ where: { reportId: saved.id } });

    await tx.productionEosReportLine.createMany({
      data: calculation.lines.map((line) => ({
        reportId: saved.id,
        ...lineDataForSave(line),
      })),
    });

    if (payload.notes?.length) {
      await tx.productionEosReportNote.createMany({
        data: payload.notes.map((note, index) => ({
          reportId: saved.id,
          lineGroup: note.lineGroup,
          notes: note.notes || null,
          sortOrder: note.sortOrder ?? index,
        })),
      });
    }

    const auditChanges = buildProductionEosAuditChanges({
      user,
      eventType,
      eventLabel,
      before: beforeSnapshot,
      after: afterSnapshot,
    });

    await tx.auditLog.create({
      data: {
        action: existing ? 'UPDATE' : 'CREATE',
        entity: REPORT_AUDIT_ENTITY,
        entityId: saved.id,
        userId: user.id,
        organizationId,
        changes: auditChanges,
      },
    });

    return saved;
  });

  return getProductionEosReportById(user, report.id);
}

export async function getProductionEosReportAuditTrail(user: AuthUser, reportId: string) {
  const report = await prisma.productionEosReport.findFirst({
    where: {
      id: reportId,
      ...(user.role === 'SYSTEM_ADMIN' ? {} : { organizationId: user.organizationId }),
    },
    select: { id: true, organizationId: true },
  });
  if (!report) return null;

  return prisma.auditLog.findMany({
    where: {
      entity: REPORT_AUDIT_ENTITY,
      entityId: report.id,
      ...(user.role === 'SYSTEM_ADMIN' ? {} : { organizationId: user.organizationId }),
    },
    include: {
      User: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 250,
  });
}

export async function listProductionEosReports(user: AuthUser, filters: { date?: string; shiftId?: string; status?: string } = {}) {
  return prisma.productionEosReport.findMany({
    where: {
      ...(user.role === 'SYSTEM_ADMIN' ? {} : { organizationId: user.organizationId }),
      ...(filters.date ? { reportDate: new Date(`${filters.date}T00:00:00`) } : {}),
      ...(filters.shiftId ? { shiftId: filters.shiftId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
    },
    select: {
      id: true,
      reportDate: true,
      dayOfWeek: true,
      shiftNameSnapshot: true,
      reportedByName: true,
      status: true,
      totals: true,
      updatedAt: true,
      submittedAt: true,
    },
    orderBy: [{ reportDate: 'desc' }, { updatedAt: 'desc' }],
    take: 100,
  });
}

export async function getProductionEosReportById(user: AuthUser, id: string) {
  const report = await prisma.productionEosReport.findFirst({
    where: {
      id,
      ...(user.role === 'SYSTEM_ADMIN' ? {} : { organizationId: user.organizationId }),
    },
    include: {
      lines: { orderBy: { sortOrder: 'asc' } },
      notes: { orderBy: { sortOrder: 'asc' } },
    },
  });
  if (!report) return null;
  return report;
}

export async function getProductionEosReferenceData(user: AuthUser, filters: { query?: string; active?: string }) {
  const query = filters.query?.trim();
  return prisma.productionEosRateReference.findMany({
    where: {
      ...(user.role === 'SYSTEM_ADMIN' ? {} : { OR: [{ organizationId: user.organizationId }, { organizationId: null }] }),
      ...(filters.active === 'all' ? {} : { isActive: filters.active === 'false' ? false : true }),
      ...(query ? {
        AND: [{
          OR: [
            { itemNo: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } },
          ],
        }],
      } : {}),
    },
    orderBy: [{ itemNo: 'asc' }, { sourceRowNumber: 'asc' }],
    take: 500,
  });
}

export async function getProductionEosReferenceSources(_user: AuthUser) {
  return ['Rates'];
}
