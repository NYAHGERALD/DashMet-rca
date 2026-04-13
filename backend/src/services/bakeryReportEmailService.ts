/**
 * Bakery Metrics Report Email Service
 * - Generates professional PDF reports from bakery metrics data
 * - Sends branded emails with PDF attachments via Resend
 */

import { Resend } from 'resend';
import { prisma } from '../utils/prisma';
import PDFDocument from 'pdfkit';
import path from 'path';
import fs from 'fs';

// ─── Logo as base64 for embedding ───────────────────────────────────────────
const LOGO_PATH = path.join(__dirname, '../../../frontend/public/images/logo.png');
let logoBase64 = '';
try {
  const logoBuffer = fs.readFileSync(LOGO_PATH);
  logoBase64 = `data:image/png;base64,${logoBuffer.toString('base64')}`;
} catch {
  console.warn('[BakeryReportEmail] Logo not found at', LOGO_PATH);
}

// ─── Resend Client ──────────────────────────────────────────────────────────
function getResendClient(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  return new Resend(process.env.RESEND_API_KEY);
}

// ─── Types ──────────────────────────────────────────────────────────────────
interface BakeryReportData {
  weekName: string;
  dayOfWeek: string;
  submittedBy: string;
  submittedAt: string;
  organizationName: string;
  facilityName: string;
  targets: {
    oee: { die_cut_1: number; die_cut_2: number; total: number };
    volume: { die_cut_1: number; die_cut_2: number; total: number };
    waste: { die_cut_1: number; die_cut_2: number; total: number };
  };
  // Shift data
  firstShift: ShiftData | null;
  secondShift: ShiftData | null;
  bothShifts: ShiftData | null;
  // Summary
  summary: {
    oeeValue: number;
    oeeStatus: string;
    wasteValue: number;
    wasteStatus: string;
    productionValue: number;
    productionStatus: string;
    efficiencyScore: number;
    efficiencyStatus: string;
  };
}

interface ShiftData {
  dieCut1Oee: number;
  dieCut2Oee: number;
  totalOee: number;
  dieCut1Lbs: number;
  dieCut2Lbs: number;
  totalLbs: number;
  dieCut1WastePct: number;
  dieCut2WastePct: number;
  totalWastePct: number;
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function fmtVal(val: number | null | undefined, suffix = '%', decimals = 1): string {
  if (val === null || val === undefined) return '—';
  if (suffix === ' lbs') return `${Math.round(val).toLocaleString()} lbs`;
  return `${val.toFixed(decimals)}${suffix}`;
}

function isGood(val: number, target: number, isWaste = false): boolean {
  return isWaste ? val <= target : val >= target;
}

// ═══════════════════════════════════════════════════════════════════════════
// GENERATE PDF with PDFKit (no Chrome required)
// ═══════════════════════════════════════════════════════════════════════════

// Colors
const COLORS = {
  primary: '#1e3a5f',
  accent: '#1e40af',
  green: '#166534',
  red: '#dc2626',
  gray: '#64748b',
  lightGray: '#e5e7eb',
  darkText: '#1e293b',
  greenBg: '#dcfce7',
  redBg: '#fef2f2',
  yellowBg: '#fef9c3',
  headerBg: '#1e3a5f',
  rowAlt: '#f8fafc',
};

export async function generateBakeryReportPdf(data: BakeryReportData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 40 });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const fsd = data.firstShift;
      const ssd = data.secondShift;
      const bsd = data.bothShifts;
      const t = data.targets;
      const pageW = 841.89 - 80; // A4 landscape minus margins

      // Format week display
      let weekDisplay = data.weekName;
      if (data.weekName.includes('_')) {
        const [startStr, endStr] = data.weekName.split('_');
        const fmtDate = (s: string) => {
          const [m, d, y] = s.split('-');
          const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
          return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        };
        weekDisplay = `${fmtDate(startStr)} - ${fmtDate(endStr)}`;
      }

      const generatedAt = new Date().toLocaleString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
      });

      // ─── Header ──────────────────────────────────────────────────────
      // Logo
      if (fs.existsSync(LOGO_PATH)) {
        doc.image(LOGO_PATH, 40, 30, { height: 36 });
      }

      // Title
      doc.font('Helvetica-Bold').fontSize(18).fillColor(COLORS.accent)
        .text('Bakery Production Report', 90, 35);
      doc.font('Helvetica').fontSize(9).fillColor(COLORS.gray)
        .text('Daily KPI Performance Summary', 90, 56);

      // Right side info
      const rightX = pageW - 160;
      doc.font('Helvetica-Bold').fontSize(9).fillColor(COLORS.darkText)
        .text(data.organizationName, rightX, 30, { width: 200, align: 'right' });
      doc.font('Helvetica').fontSize(8).fillColor(COLORS.gray)
        .text(data.facilityName, rightX, 42, { width: 200, align: 'right' })
        .text(`Week: ${weekDisplay}`, rightX, 53, { width: 200, align: 'right' })
        .text(`Day: ${data.dayOfWeek}`, rightX, 64, { width: 200, align: 'right' })
        .text(`Submitted by: ${data.submittedBy}`, rightX, 75, { width: 200, align: 'right' });

      // Header line
      doc.moveTo(40, 90).lineTo(pageW + 40, 90).strokeColor(COLORS.accent).lineWidth(2).stroke();

      // ─── KPI Table ────────────────────────────────────────────────────
      doc.font('Helvetica-Bold').fontSize(12).fillColor(COLORS.darkText)
        .text('KPI Performance Breakdown', 40, 100);
      doc.moveTo(40, 116).lineTo(pageW + 40, 116).strokeColor(COLORS.lightGray).lineWidth(1).stroke();

      const tableTop = 124;
      const colWidths = [120, 110, 110, 110, 110, 100]; // KPI, Target, 1st, 2nd, Both, Status
      const colX = [40];
      for (let i = 1; i <= 5; i++) colX.push(colX[i - 1] + colWidths[i - 1]);
      const rowH = 28;

      // Table header
      doc.rect(40, tableTop, pageW, rowH).fill(COLORS.headerBg);
      const headers = ['KPI Metric', 'Target', 'First Shift', 'Second Shift', 'Both Shifts', 'Status'];
      doc.font('Helvetica-Bold').fontSize(8).fillColor('#ffffff');
      headers.forEach((h, i) => {
        doc.text(h, colX[i] + 8, tableTop + 9, { width: colWidths[i] - 16, align: i >= 2 ? 'center' : 'left' });
      });

      // Table rows
      interface RowDef {
        kpi: string;
        target: string;
        first: string;
        second: string;
        both: string;
        status: string;
        statusGood: boolean;
        firstGood?: boolean;
        secondGood?: boolean;
        bothGood?: boolean;
        isSectionHeader?: boolean;
      }

      const rows: RowDef[] = [
        // OEE section
        { kpi: 'OEE', target: '', first: '', second: '', both: '', status: '', statusGood: true, isSectionHeader: true },
        {
          kpi: '  Die Cut 1', target: `>= ${t.oee.die_cut_1}%`,
          first: fmtVal(fsd?.dieCut1Oee), second: fmtVal(ssd?.dieCut1Oee), both: fmtVal(bsd?.dieCut1Oee),
          status: isGood(bsd?.dieCut1Oee ?? 0, t.oee.die_cut_1) ? 'TARGET MET' : 'BELOW TARGET',
          statusGood: isGood(bsd?.dieCut1Oee ?? 0, t.oee.die_cut_1),
          firstGood: fsd ? isGood(fsd.dieCut1Oee, t.oee.die_cut_1) : undefined,
          secondGood: ssd ? isGood(ssd.dieCut1Oee, t.oee.die_cut_1) : undefined,
          bothGood: bsd ? isGood(bsd.dieCut1Oee, t.oee.die_cut_1) : undefined,
        },
        {
          kpi: '  Die Cut 2', target: `>= ${t.oee.die_cut_2}%`,
          first: fmtVal(fsd?.dieCut2Oee), second: fmtVal(ssd?.dieCut2Oee), both: fmtVal(bsd?.dieCut2Oee),
          status: isGood(bsd?.dieCut2Oee ?? 0, t.oee.die_cut_2) ? 'TARGET MET' : 'BELOW TARGET',
          statusGood: isGood(bsd?.dieCut2Oee ?? 0, t.oee.die_cut_2),
          firstGood: fsd ? isGood(fsd.dieCut2Oee, t.oee.die_cut_2) : undefined,
          secondGood: ssd ? isGood(ssd.dieCut2Oee, t.oee.die_cut_2) : undefined,
          bothGood: bsd ? isGood(bsd.dieCut2Oee, t.oee.die_cut_2) : undefined,
        },
        {
          kpi: '  Total OEE', target: `>= ${t.oee.total}%`,
          first: fmtVal(fsd?.totalOee), second: fmtVal(ssd?.totalOee), both: fmtVal(bsd?.totalOee),
          status: isGood(bsd?.totalOee ?? 0, t.oee.total) ? 'TARGET MET' : 'BELOW TARGET',
          statusGood: isGood(bsd?.totalOee ?? 0, t.oee.total),
          firstGood: fsd ? isGood(fsd.totalOee, t.oee.total) : undefined,
          secondGood: ssd ? isGood(ssd.totalOee, t.oee.total) : undefined,
          bothGood: bsd ? isGood(bsd.totalOee, t.oee.total) : undefined,
        },
        // Volume section
        { kpi: 'VOLUME', target: '', first: '', second: '', both: '', status: '', statusGood: true, isSectionHeader: true },
        {
          kpi: '  Die Cut 1', target: `>= ${t.volume.die_cut_1.toLocaleString()} lbs`,
          first: fmtVal(fsd?.dieCut1Lbs, ' lbs'), second: fmtVal(ssd?.dieCut1Lbs, ' lbs'), both: fmtVal(bsd?.dieCut1Lbs, ' lbs'),
          status: isGood(bsd?.dieCut1Lbs ?? 0, t.volume.die_cut_1) ? 'ON TARGET' : 'BELOW TARGET',
          statusGood: isGood(bsd?.dieCut1Lbs ?? 0, t.volume.die_cut_1),
          bothGood: bsd ? isGood(bsd.dieCut1Lbs, t.volume.die_cut_1) : undefined,
        },
        {
          kpi: '  Die Cut 2', target: `>= ${t.volume.die_cut_2.toLocaleString()} lbs`,
          first: fmtVal(fsd?.dieCut2Lbs, ' lbs'), second: fmtVal(ssd?.dieCut2Lbs, ' lbs'), both: fmtVal(bsd?.dieCut2Lbs, ' lbs'),
          status: isGood(bsd?.dieCut2Lbs ?? 0, t.volume.die_cut_2) ? 'ON TARGET' : 'BELOW TARGET',
          statusGood: isGood(bsd?.dieCut2Lbs ?? 0, t.volume.die_cut_2),
          bothGood: bsd ? isGood(bsd.dieCut2Lbs, t.volume.die_cut_2) : undefined,
        },
        {
          kpi: '  Total Volume', target: `>= ${t.volume.total.toLocaleString()} lbs`,
          first: fmtVal(fsd?.totalLbs, ' lbs'), second: fmtVal(ssd?.totalLbs, ' lbs'), both: fmtVal(bsd?.totalLbs, ' lbs'),
          status: isGood(bsd?.totalLbs ?? 0, t.volume.total) ? 'ON TARGET' : 'BELOW TARGET',
          statusGood: isGood(bsd?.totalLbs ?? 0, t.volume.total),
          bothGood: bsd ? isGood(bsd.totalLbs, t.volume.total) : undefined,
        },
        // Waste section
        { kpi: 'WASTE', target: '', first: '', second: '', both: '', status: '', statusGood: true, isSectionHeader: true },
        {
          kpi: '  Die Cut 1', target: `<= ${t.waste.die_cut_1}%`,
          first: fmtVal(fsd?.dieCut1WastePct), second: fmtVal(ssd?.dieCut1WastePct), both: fmtVal(bsd?.dieCut1WastePct),
          status: isGood(bsd?.dieCut1WastePct ?? 0, t.waste.die_cut_1, true) ? 'BELOW TARGET' : 'ABOVE TARGET',
          statusGood: isGood(bsd?.dieCut1WastePct ?? 0, t.waste.die_cut_1, true),
          firstGood: fsd ? isGood(fsd.dieCut1WastePct, t.waste.die_cut_1, true) : undefined,
          secondGood: ssd ? isGood(ssd.dieCut1WastePct, t.waste.die_cut_1, true) : undefined,
          bothGood: bsd ? isGood(bsd.dieCut1WastePct, t.waste.die_cut_1, true) : undefined,
        },
        {
          kpi: '  Die Cut 2', target: `<= ${t.waste.die_cut_2}%`,
          first: fmtVal(fsd?.dieCut2WastePct), second: fmtVal(ssd?.dieCut2WastePct), both: fmtVal(bsd?.dieCut2WastePct),
          status: isGood(bsd?.dieCut2WastePct ?? 0, t.waste.die_cut_2, true) ? 'BELOW TARGET' : 'ABOVE TARGET',
          statusGood: isGood(bsd?.dieCut2WastePct ?? 0, t.waste.die_cut_2, true),
          firstGood: fsd ? isGood(fsd.dieCut2WastePct, t.waste.die_cut_2, true) : undefined,
          secondGood: ssd ? isGood(ssd.dieCut2WastePct, t.waste.die_cut_2, true) : undefined,
          bothGood: bsd ? isGood(bsd.dieCut2WastePct, t.waste.die_cut_2, true) : undefined,
        },
        {
          kpi: '  Total Waste', target: `<= ${t.waste.total}%`,
          first: fmtVal(fsd?.totalWastePct), second: fmtVal(ssd?.totalWastePct), both: fmtVal(bsd?.totalWastePct),
          status: isGood(bsd?.totalWastePct ?? 0, t.waste.total, true) ? 'BELOW TARGET' : 'ABOVE TARGET',
          statusGood: isGood(bsd?.totalWastePct ?? 0, t.waste.total, true),
          firstGood: fsd ? isGood(fsd.totalWastePct, t.waste.total, true) : undefined,
          secondGood: ssd ? isGood(ssd.totalWastePct, t.waste.total, true) : undefined,
          bothGood: bsd ? isGood(bsd.totalWastePct, t.waste.total, true) : undefined,
        },
      ];

      rows.forEach((row, idx) => {
        const y = tableTop + rowH + idx * rowH;

        // Alternate row background
        if (row.isSectionHeader) {
          doc.rect(40, y, pageW, rowH).fill('#eef2ff');
        } else if (idx % 2 === 0) {
          doc.rect(40, y, pageW, rowH).fill(COLORS.rowAlt);
        }

        // Row border
        doc.moveTo(40, y + rowH).lineTo(pageW + 40, y + rowH).strokeColor(COLORS.lightGray).lineWidth(0.5).stroke();

        const textY = y + 9;

        if (row.isSectionHeader) {
          // Section header row
          doc.font('Helvetica-Bold').fontSize(9).fillColor(COLORS.accent)
            .text(row.kpi, colX[0] + 8, textY, { width: colWidths[0] - 16 });
        } else {
          // KPI name
          doc.font('Helvetica').fontSize(8).fillColor(COLORS.darkText)
            .text(row.kpi, colX[0] + 8, textY, { width: colWidths[0] - 16 });

          // Target
          doc.font('Helvetica').fontSize(7.5).fillColor(COLORS.gray)
            .text(row.target, colX[1] + 8, textY, { width: colWidths[1] - 16 });

          // Value cells with color coding
          const drawValueCell = (val: string, x: number, w: number, isGoodVal?: boolean) => {
            const color = isGoodVal === undefined ? COLORS.darkText : isGoodVal ? COLORS.green : COLORS.red;
            doc.font('Helvetica-Bold').fontSize(8).fillColor(color)
              .text(val, x + 8, textY, { width: w - 16, align: 'center' });
          };

          drawValueCell(row.first, colX[2], colWidths[2], row.firstGood);
          drawValueCell(row.second, colX[3], colWidths[3], row.secondGood);
          drawValueCell(row.both, colX[4], colWidths[4], row.bothGood);

          // Status badge
          const badgeBg = row.statusGood ? COLORS.greenBg : COLORS.redBg;
          const badgeText = row.statusGood ? COLORS.green : COLORS.red;
          doc.font('Helvetica-Bold').fontSize(6);
          const badgeW = Math.min(doc.widthOfString(row.status) + 14, colWidths[5] - 10);
          const badgeX = colX[5] + (colWidths[5] - badgeW) / 2;
          doc.roundedRect(badgeX, y + 7, badgeW, 14, 7).fill(badgeBg);
          doc.font('Helvetica-Bold').fontSize(6).fillColor(badgeText)
            .text(row.status, colX[5] + 4, textY + 1, { width: colWidths[5] - 8, align: 'center' });
        }
      });

      // Table border
      const tableH = rowH + rows.length * rowH;
      doc.rect(40, tableTop, pageW, tableH).strokeColor(COLORS.lightGray).lineWidth(1).stroke();

      // ─── Summary Cards ────────────────────────────────────────────────
      const cardsY = tableTop + tableH + 20;
      doc.font('Helvetica-Bold').fontSize(12).fillColor(COLORS.darkText)
        .text('Performance Summary', 40, cardsY);
      doc.moveTo(40, cardsY + 16).lineTo(pageW + 40, cardsY + 16).strokeColor(COLORS.lightGray).lineWidth(1).stroke();

      const cardW = (pageW - 30) / 4;
      const cardTop = cardsY + 24;
      const cardH = 70;
      const summaryCards = [
        { label: 'OEE', value: `${data.summary.oeeValue.toFixed(1)}%`, status: data.summary.oeeStatus, target: `vs target (${t.oee.total}%)` },
        { label: 'Waste', value: `${data.summary.wasteValue.toFixed(2)}%`, status: data.summary.wasteStatus, target: `vs target (${t.waste.total}%)` },
        { label: 'Production', value: `${Math.round(data.summary.productionValue).toLocaleString()} lbs`, status: data.summary.productionStatus, target: 'daily output' },
        { label: 'Efficiency', value: `${data.summary.efficiencyScore}/10`, status: data.summary.efficiencyStatus, target: 'composite index' },
      ];

      summaryCards.forEach((card, i) => {
        const x = 40 + i * (cardW + 10);
        doc.roundedRect(x, cardTop, cardW, cardH, 6).strokeColor(COLORS.lightGray).lineWidth(1).stroke();

        // Status badge
        const goodStatus = card.label === 'Waste'
          ? card.status === 'BELOW TARGET'
          : ['TARGET MET', 'ON TARGET', 'ABOVE TARGET', 'GOOD'].includes(card.status);
        const sBg = goodStatus ? COLORS.greenBg : (['FAIR'].includes(card.status) ? COLORS.yellowBg : COLORS.redBg);
        const sColor = goodStatus ? COLORS.green : (['FAIR'].includes(card.status) ? '#854d0e' : COLORS.red);

        doc.font('Helvetica-Bold').fontSize(5.5);
        const statusW = Math.min(doc.widthOfString(card.status) + 12, cardW - 20);
        doc.roundedRect(x + (cardW - statusW) / 2, cardTop + 6, statusW, 12, 6).fill(sBg);
        doc.font('Helvetica-Bold').fontSize(5.5).fillColor(sColor)
          .text(card.status, x + 5, cardTop + 9, { width: cardW - 10, align: 'center' });

        // Label
        doc.font('Helvetica').fontSize(7).fillColor(COLORS.gray)
          .text(card.label, x + 5, cardTop + 22, { width: cardW - 10, align: 'center' });

        // Value
        doc.font('Helvetica-Bold').fontSize(16).fillColor(COLORS.darkText)
          .text(card.value, x + 5, cardTop + 33, { width: cardW - 10, align: 'center' });

        // Target text
        doc.font('Helvetica').fontSize(6.5).fillColor(COLORS.gray)
          .text(card.target, x + 5, cardTop + 55, { width: cardW - 10, align: 'center' });
      });

      // ─── Footer ──────────────────────────────────────────────────────
      const footerY = cardTop + cardH + 20;
      doc.moveTo(40, footerY).lineTo(pageW + 40, footerY).strokeColor(COLORS.lightGray).lineWidth(0.5).stroke();
      doc.font('Helvetica').fontSize(7).fillColor(COLORS.gray)
        .text(`Generated by DashMet RCA  |  ${data.organizationName}  |  ${generatedAt}`, 40, footerY + 6, { width: pageW, align: 'center' })
        .text('Confidential - For internal use only', 40, footerY + 16, { width: pageW, align: 'center' });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// BUILD REPORT DATA from database
// ═══════════════════════════════════════════════════════════════════════════
export async function buildBakeryReportData(
  weekName: string,
  dayOfWeek: string,
  organizationId: string
): Promise<BakeryReportData | null> {
  // Find the submission
  const submission = await prisma.bakeryWeekSubmission.findFirst({
    where: { weekName, dayOfWeek },
    include: {
      firstShiftMetrics: true,
      secondShiftMetrics: true,
      bothShiftsMetrics: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!submission) return null;

  // Get org + facility info
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { name: true },
  });
  const facility = await prisma.facility.findFirst({
    where: { organizationId },
    select: { name: true },
  });

  // Get KPI targets
  const targetRows = await prisma.bakeryKpiTarget.findMany();
  const targets = {
    oee: { die_cut_1: 74.6, die_cut_2: 74.6, total: 74.6 },
    volume: { die_cut_1: 6000, die_cut_2: 6000, total: 12000 },
    waste: { die_cut_1: 3, die_cut_2: 3, total: 3 },
  };
  for (const t of targetRows) {
    const metric = t.metricType as keyof typeof targets;
    const name = t.metricName as string;
    if (targets[metric] && name in targets[metric]) {
      (targets[metric] as any)[name] = Number(t.targetValue);
    }
  }

  // Map shift data
  const mapShift = (s: any): ShiftData | null => {
    if (!s) return null;
    const totalLbs = Number(s.dieCut1Lbs || 0) + Number(s.dieCut2Lbs || 0);
    const totalWasteLb = Number(s.dieCut1WasteLb || 0) + Number(s.dieCut2WasteLb || 0);
    return {
      dieCut1Oee: Number(s.dieCut1OeePct),
      dieCut2Oee: Number(s.dieCut2OeePct),
      totalOee: Number(s.oeeAvgPct) || (Number(s.dieCut1OeePct) + Number(s.dieCut2OeePct)) / 2,
      dieCut1Lbs: Number(s.dieCut1Lbs),
      dieCut2Lbs: Number(s.dieCut2Lbs),
      totalLbs: Number(s.poundsTotal) || totalLbs,
      dieCut1WastePct: Number(s.dieCut1WastePct) || (Number(s.dieCut1Lbs) > 0 ? (Number(s.dieCut1WasteLb) / Number(s.dieCut1Lbs)) * 100 : 0),
      dieCut2WastePct: Number(s.dieCut2WastePct) || (Number(s.dieCut2Lbs) > 0 ? (Number(s.dieCut2WasteLb) / Number(s.dieCut2Lbs)) * 100 : 0),
      totalWastePct: Number(s.wasteAvgPct) || (totalLbs > 0 ? (totalWasteLb / totalLbs) * 100 : 0),
    };
  };

  const fsData = mapShift(submission.firstShiftMetrics);
  const ssData = mapShift(submission.secondShiftMetrics);
  let bsData = mapShift(submission.bothShiftsMetrics);
  // Fallback: if no bothShifts record, use whichever shift exists
  if (!bsData) bsData = fsData || ssData;

  // Compute summary
  const oeeVal = bsData?.totalOee ?? 0;
  const wasteVal = bsData?.totalWastePct ?? 0;
  const prodVal = bsData?.totalLbs ?? 0;

  const oeeScore = Math.min((oeeVal / targets.oee.total) * 10, 10);
  const wasteScore = Math.min((targets.waste.total / Math.max(wasteVal, 0.01)) * 10, 10);
  const volScore = Math.min((prodVal / targets.volume.total) * 10, 10);
  const effScore = oeeScore * 0.4 + wasteScore * 0.3 + volScore * 0.3;

  return {
    weekName,
    dayOfWeek,
    submittedBy: submission.submittedBy,
    submittedAt: submission.createdAt.toISOString(),
    organizationName: org?.name || 'Organization',
    facilityName: facility?.name || 'Bakery Production Facility',
    targets,
    firstShift: fsData,
    secondShift: ssData,
    bothShifts: bsData,
    summary: {
      oeeValue: oeeVal,
      oeeStatus: oeeVal >= targets.oee.total ? 'TARGET MET' : 'BELOW TARGET',
      wasteValue: wasteVal,
      wasteStatus: wasteVal <= targets.waste.total ? 'BELOW TARGET' : 'ABOVE TARGET',
      productionValue: prodVal,
      productionStatus: prodVal >= targets.volume.total ? 'ABOVE TARGET' : 'BELOW TARGET',
      efficiencyScore: parseFloat(effScore.toFixed(1)),
      efficiencyStatus: effScore >= 7 ? 'GOOD' : effScore >= 5 ? 'FAIR' : 'POOR',
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// SEND EMAIL with PDF attachment
// ═══════════════════════════════════════════════════════════════════════════
export async function sendBakeryReportEmail(
  recipientEmail: string,
  recipientName: string,
  reportData: BakeryReportData,
  pdfBuffer: Buffer
): Promise<{ success: boolean; reason?: string; messageId?: string }> {
  const resend = getResendClient();
  if (!resend) {
    return { success: false, reason: 'Email not configured — set RESEND_API_KEY' };
  }

  // Format filename
  const safeWeek = reportData.weekName.replace(/[^a-zA-Z0-9_-]/g, '');
  const filename = `Bakery_Report_${safeWeek}_${reportData.dayOfWeek}.pdf`;

  const { data, error } = await resend.emails.send({
    from: process.env.EMAIL_FROM || 'DashMet <noreply@dashmet.com>',
    to: recipientEmail,
    subject: `📊 Bakery Production Report — ${reportData.dayOfWeek}, ${reportData.weekName.replace('_', ' to ')}`,
    html: buildEmailHtml(recipientName, reportData),
    attachments: [
      {
        filename,
        content: pdfBuffer.toString('base64'),
        contentType: 'application/pdf',
      },
    ],
  });

  if (error) {
    console.error('[BakeryReportEmail] Failed:', error.message);
    return { success: false, reason: error.message };
  }

  return { success: true, messageId: data?.id };
}

// ═══════════════════════════════════════════════════════════════════════════
// EMAIL HTML
// ═══════════════════════════════════════════════════════════════════════════
function buildEmailHtml(recipientName: string, data: BakeryReportData): string {
  const oeeIcon = data.summary.oeeStatus === 'TARGET MET' ? '✅' : '⚠️';
  const wasteIcon = data.summary.wasteStatus === 'BELOW TARGET' ? '✅' : '🔴';
  const prodIcon = data.summary.productionStatus === 'ABOVE TARGET' ? '✅' : '📉';

  let weekDisplay = data.weekName;
  if (data.weekName.includes('_')) {
    const [s, e] = data.weekName.split('_');
    const fmtD = (str: string) => {
      const [m, d, y] = str.split('-');
      return new Date(parseInt(y), parseInt(m) - 1, parseInt(d)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };
    weekDisplay = `${fmtD(s)} – ${fmtD(e)}`;
  }

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:640px;margin:0 auto;background:#ffffff;">
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#1e3a5f 0%,#1e40af 100%);padding:32px 40px;text-align:center;">
      ${logoBase64 ? `<img src="${logoBase64}" alt="DashMet" style="height:40px;margin-bottom:12px;" />` : '<div style="font-size:24px;font-weight:900;color:#fff;margin-bottom:8px;">DASHMET</div>'}
      <h1 style="color:#ffffff;font-size:20px;font-weight:700;margin:0;">Bakery Production Report</h1>
      <p style="color:#93c5fd;font-size:13px;margin:6px 0 0;">${data.dayOfWeek} • ${weekDisplay}</p>
    </div>

    <!-- Body -->
    <div style="padding:32px 40px;">
      <p style="font-size:15px;color:#334155;line-height:1.6;margin:0 0 20px;">
        Hello ${recipientName},
      </p>
      <p style="font-size:14px;color:#475569;line-height:1.6;margin:0 0 24px;">
        A new bakery production report has been submitted by <strong>${data.submittedBy}</strong> for <strong>${data.dayOfWeek}</strong>. 
        Please find the detailed KPI report attached as a PDF.
      </p>

      <!-- Quick Summary -->
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:24px;margin-bottom:24px;">
        <h3 style="font-size:14px;color:#1e293b;margin:0 0 16px;font-weight:700;">📋 Performance Snapshot</h3>
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:8px 0;font-size:13px;color:#64748b;">OEE (Overall)</td>
            <td style="padding:8px 0;font-size:14px;font-weight:700;text-align:right;">${oeeIcon} ${data.summary.oeeValue.toFixed(1)}%</td>
          </tr>
          <tr>
            <td style="padding:8px 0;font-size:13px;color:#64748b;border-top:1px solid #e2e8f0;">Waste</td>
            <td style="padding:8px 0;font-size:14px;font-weight:700;text-align:right;border-top:1px solid #e2e8f0;">${wasteIcon} ${data.summary.wasteValue.toFixed(2)}%</td>
          </tr>
          <tr>
            <td style="padding:8px 0;font-size:13px;color:#64748b;border-top:1px solid #e2e8f0;">Production</td>
            <td style="padding:8px 0;font-size:14px;font-weight:700;text-align:right;border-top:1px solid #e2e8f0;">${prodIcon} ${Math.round(data.summary.productionValue).toLocaleString()} lbs</td>
          </tr>
          <tr>
            <td style="padding:8px 0;font-size:13px;color:#64748b;border-top:1px solid #e2e8f0;">Efficiency Score</td>
            <td style="padding:8px 0;font-size:14px;font-weight:700;text-align:right;border-top:1px solid #e2e8f0;">⭐ ${data.summary.efficiencyScore}/10</td>
          </tr>
        </table>
      </div>

      <p style="font-size:13px;color:#64748b;line-height:1.6;margin:0 0 8px;">
        The full detailed report with per-shift breakdowns is attached as a PDF for your records.
      </p>

      <p style="font-size:14px;color:#475569;line-height:1.6;margin:24px 0 0;">
        Best regards,<br/>
        <strong>DashMet RCA</strong><br/>
        <span style="font-size:12px;color:#94a3b8;">${data.organizationName} • ${data.facilityName}</span>
      </p>
    </div>

    <!-- Footer -->
    <div style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 40px;text-align:center;">
      <p style="font-size:11px;color:#94a3b8;margin:0;">
        This is an automated notification from DashMet RCA. Please do not reply to this email.
      </p>
      <p style="font-size:11px;color:#94a3b8;margin:4px 0 0;">
        © ${new Date().getFullYear()} DashMet — Confidential
      </p>
    </div>
  </div>
</body>
</html>`;
}

// ═══════════════════════════════════════════════════════════════════════════
// GET ORG USERS  
// ═══════════════════════════════════════════════════════════════════════════
export async function getOrgUsersForBakeryReport(organizationId: string) {
  return prisma.user.findMany({
    where: {
      organizationId,
      isActive: true,
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
    },
    orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// SEND REPORT TO MULTIPLE USERS
// ═══════════════════════════════════════════════════════════════════════════
export async function sendBakeryReportToUsers(
  userIds: string[],
  weekName: string,
  dayOfWeek: string,
  organizationId: string
): Promise<{ sent: number; failed: number; errors: string[] }> {
  // Build report data
  const reportData = await buildBakeryReportData(weekName, dayOfWeek, organizationId);
  if (!reportData) {
    return { sent: 0, failed: 0, errors: [`No record found for ${dayOfWeek} in week ${weekName}`] };
  }

  // Generate PDF once
  const pdfBuffer = await generateBakeryReportPdf(reportData);

  // Get selected users
  const users = await prisma.user.findMany({
    where: { id: { in: userIds }, isActive: true },
    select: { id: true, email: true, firstName: true, lastName: true },
  });

  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  // Send to each user
  for (const user of users) {
    try {
      const result = await sendBakeryReportEmail(
        user.email,
        user.firstName,
        reportData,
        pdfBuffer
      );
      if (result.success) {
        sent++;
      } else {
        failed++;
        errors.push(`${user.email}: ${result.reason}`);
      }
    } catch (err: any) {
      failed++;
      errors.push(`${user.email}: ${err.message}`);
    }
  }

  return { sent, failed, errors };
}

export default {
  generateBakeryReportPdf,
  buildBakeryReportData,
  sendBakeryReportEmail,
  sendBakeryReportToUsers,
  getOrgUsersForBakeryReport,
};
