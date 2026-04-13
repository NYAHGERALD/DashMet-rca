/**
 * Bakery Metrics Report Email Service
 * - Generates professional 2-page PDF reports (PDFKit)
 * - Page 1: Daily KPI breakdown + summary cards
 * - Page 2: Week summary averages per shift
 * - Sends branded emails with PDF attachments via Resend
 */

import { Resend } from 'resend';
import { prisma } from '../utils/prisma';
import PDFDocument from 'pdfkit';
import bakeryMetricsService from './bakeryMetricsService';
import path from 'path';
import fs from 'fs';

// ─── Logo ───────────────────────────────────────────────────────────────────
const LOGO_PATH = path.join(__dirname, '../assets/logo.png');
let logoBuffer: Buffer | null = null;
let logoBase64 = '';
try {
  logoBuffer = fs.readFileSync(LOGO_PATH);
  logoBase64 = logoBuffer.toString('base64');
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
  firstShift: ShiftData | null;
  secondShift: ShiftData | null;
  bothShifts: ShiftData | null;
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
  weekAverages: WeekAverages | null;
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

interface WeekAverages {
  days_count: number;
  averages: {
    oee: {
      die_cut_1: { first_shift: number | null; second_shift: number | null; both_shifts: number | null };
      die_cut_2: { first_shift: number | null; second_shift: number | null; both_shifts: number | null };
      total: { first_shift: number | null; second_shift: number | null; both_shifts: number | null };
    };
    volume: {
      die_cut_1: { first_shift: number | null; second_shift: number | null; both_shifts: number | null };
      die_cut_2: { first_shift: number | null; second_shift: number | null; both_shifts: number | null };
      total: { first_shift: number | null; second_shift: number | null; both_shifts: number | null };
    };
    waste: {
      percentage: {
        die_cut_1: { first_shift: number | null; second_shift: number | null; both_shifts: number | null };
        die_cut_2: { first_shift: number | null; second_shift: number | null; both_shifts: number | null };
        total: { first_shift: number | null; second_shift: number | null; both_shifts: number | null };
      };
    };
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function fmtVal(val: number | null | undefined, suffix = '%', decimals = 1): string {
  if (val === null || val === undefined) return '-';
  if (suffix === ' lbs') return `${Math.round(val).toLocaleString()} lbs`;
  return `${val.toFixed(decimals)}${suffix}`;
}

function isMetGood(val: number, target: number, isWaste = false): boolean {
  return isWaste ? val <= target : val >= target;
}

function formatWeekDisplay(weekName: string): string {
  if (!weekName.includes('_')) return weekName;
  const [startStr, endStr] = weekName.split('_');
  const fmtDate = (s: string) => {
    const [m, d, y] = s.split('-');
    return new Date(parseInt(y), parseInt(m) - 1, parseInt(d))
      .toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };
  return `${fmtDate(startStr)} - ${fmtDate(endStr)}`;
}

// ─── PDF Colors ─────────────────────────────────────────────────────────────
const C = {
  primary: '#1e3a5f',
  accent: '#1e40af',
  green: '#15803d',
  red: '#dc2626',
  amber: '#b45309',
  gray: '#64748b',
  lightGray: '#e2e8f0',
  veryLightGray: '#f8fafc',
  dark: '#0f172a',
  white: '#ffffff',
  greenBg: '#dcfce7',
  redBg: '#fee2e2',
  amberBg: '#fef3c7',
  blueBg: '#dbeafe',
  headerBg: '#1e3a5f',
};

// ═══════════════════════════════════════════════════════════════════════════
// GENERATE 2-PAGE PDF
// ═══════════════════════════════════════════════════════════════════════════
export async function generateBakeryReportPdf(data: BakeryReportData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        layout: 'landscape',
        margin: 36,
        bufferPages: true,
        info: {
          Title: `Bakery Production Report - ${data.dayOfWeek}`,
          Author: 'DashMet RCA',
          Subject: `KPI Report for ${data.organizationName}`,
        },
      });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const MG = 36;
      const PW = 841.89 - MG * 2;
      const PH = 595.28 - MG * 2;
      const weekDisplay = formatWeekDisplay(data.weekName);
      const generatedAt = new Date().toLocaleString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
      });

      const fsd = data.firstShift;
      const ssd = data.secondShift;
      const bsd = data.bothShifts;
      const t = data.targets;

      // ─── Draw header on any page ──────────────────────────────────
      const drawHeader = (subtitle: string) => {
        doc.rect(MG, MG, PW, 50).fill(C.headerBg);
        if (logoBuffer && fs.existsSync(LOGO_PATH)) {
          doc.image(LOGO_PATH, MG + 12, MG + 9, { height: 32 });
        }
        doc.font('Helvetica-Bold').fontSize(16).fillColor(C.white)
          .text('Bakery Production Report', MG + 56, MG + 10, { continued: false });
        doc.font('Helvetica').fontSize(8.5).fillColor('#93c5fd')
          .text(subtitle, MG + 56, MG + 30);
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor(C.white)
          .text(data.organizationName, MG, MG + 10, { width: PW - 12, align: 'right' });
        doc.font('Helvetica').fontSize(7.5).fillColor('#93c5fd')
          .text(`${data.facilityName}  |  ${weekDisplay}  |  ${data.dayOfWeek}`, MG, MG + 23, { width: PW - 12, align: 'right' })
          .text(`Submitted by ${data.submittedBy}`, MG, MG + 34, { width: PW - 12, align: 'right' });
        return MG + 58;
      };

      // ─── Draw footer on any page ──────────────────────────────────
      const drawFooter = (pageNum: number, totalPages: number) => {
        const fy = MG + PH - 16;
        doc.moveTo(MG, fy).lineTo(MG + PW, fy).strokeColor(C.lightGray).lineWidth(0.5).stroke();
        doc.font('Helvetica').fontSize(6.5).fillColor(C.gray)
          .text(`Generated by DashMet RCA  |  ${data.organizationName}  |  ${generatedAt}`, MG, fy + 4, { width: PW * 0.7, align: 'left' })
          .text(`Confidential  |  Page ${pageNum} of ${totalPages}`, MG, fy + 4, { width: PW, align: 'right' });
      };

      // ─── Draw KPI table ───────────────────────────────────────────
      interface TableRow {
        kpi: string; target: string;
        first: string; second: string; both: string;
        status: string; good: boolean;
        fg?: boolean; sg?: boolean; bg?: boolean;
        isHeader?: boolean;
      }

      const drawKpiTable = (startY: number, title: string, rows: TableRow[]): number => {
        doc.font('Helvetica-Bold').fontSize(11).fillColor(C.dark)
          .text(title, MG, startY);
        const lineY = startY + 15;
        doc.moveTo(MG, lineY).lineTo(MG + PW, lineY).strokeColor(C.accent).lineWidth(1.5).stroke();

        const tY = lineY + 4;
        const cols = [130, 105, 115, 115, 115, 100];
        const cX = [MG];
        for (let i = 1; i <= 5; i++) cX.push(cX[i - 1] + cols[i - 1]);
        const rH = 24;

        doc.rect(MG, tY, PW, rH).fill(C.headerBg);
        const hdrs = ['KPI METRIC', 'TARGET', 'FIRST SHIFT', 'SECOND SHIFT', 'BOTH SHIFTS', 'STATUS'];
        doc.font('Helvetica-Bold').fontSize(7).fillColor(C.white);
        hdrs.forEach((h, i) => {
          doc.text(h, cX[i] + 6, tY + 8, { width: cols[i] - 12, align: i >= 2 ? 'center' : 'left' });
        });

        rows.forEach((row, idx) => {
          const ry = tY + rH + idx * rH;
          if (row.isHeader) {
            doc.rect(MG, ry, PW, rH).fill(C.blueBg);
          } else if (idx % 2 === 1) {
            doc.rect(MG, ry, PW, rH).fill(C.veryLightGray);
          }
          doc.moveTo(MG, ry + rH).lineTo(MG + PW, ry + rH).strokeColor(C.lightGray).lineWidth(0.3).stroke();
          const ty = ry + 7;

          if (row.isHeader) {
            doc.font('Helvetica-Bold').fontSize(8).fillColor(C.accent)
              .text(row.kpi, cX[0] + 6, ty);
          } else {
            doc.font('Helvetica').fontSize(7.5).fillColor(C.dark)
              .text(row.kpi, cX[0] + 6, ty, { width: cols[0] - 12 });
            doc.font('Helvetica').fontSize(7).fillColor(C.gray)
              .text(row.target, cX[1] + 6, ty, { width: cols[1] - 12 });

            const drawVal = (val: string, ci: number, good?: boolean) => {
              const clr = good === undefined ? C.dark : good ? C.green : C.red;
              doc.font('Helvetica-Bold').fontSize(7.5).fillColor(clr)
                .text(val, cX[ci] + 6, ty, { width: cols[ci] - 12, align: 'center' });
            };
            drawVal(row.first, 2, row.fg);
            drawVal(row.second, 3, row.sg);
            drawVal(row.both, 4, row.bg);

            const sBg = row.good ? C.greenBg : C.redBg;
            const sClr = row.good ? C.green : C.red;
            doc.font('Helvetica-Bold').fontSize(6);
            const bW = Math.min(doc.widthOfString(row.status) + 12, cols[5] - 8);
            const bX = cX[5] + (cols[5] - bW) / 2;
            doc.roundedRect(bX, ry + 5, bW, 14, 7).fill(sBg);
            doc.font('Helvetica-Bold').fontSize(5.5).fillColor(sClr)
              .text(row.status, cX[5] + 4, ty + 1, { width: cols[5] - 8, align: 'center' });
          }
        });

        const tH = rH + rows.length * rH;
        doc.rect(MG, tY, PW, tH).strokeColor(C.lightGray).lineWidth(0.8).stroke();
        for (let i = 1; i < 6; i++) {
          doc.moveTo(cX[i], tY).lineTo(cX[i], tY + tH).strokeColor(C.lightGray).lineWidth(0.3).stroke();
        }
        return tY + tH;
      };

      // ─── Draw summary cards ───────────────────────────────────────
      const drawSummaryCards = (startY: number) => {
        doc.font('Helvetica-Bold').fontSize(10).fillColor(C.dark)
          .text('Performance Summary', MG, startY);
        doc.moveTo(MG, startY + 14).lineTo(MG + PW, startY + 14).strokeColor(C.accent).lineWidth(1).stroke();

        const cardW = (PW - 36) / 4;
        const cY = startY + 20;
        const cH = 65;

        const cards = [
          { label: 'Overall OEE', value: `${data.summary.oeeValue.toFixed(1)}%`, status: data.summary.oeeStatus, sub: `Target: ${t.oee.total}%` },
          { label: 'Waste Rate', value: `${data.summary.wasteValue.toFixed(2)}%`, status: data.summary.wasteStatus, sub: `Target: ${t.waste.total}%` },
          { label: 'Production', value: `${Math.round(data.summary.productionValue).toLocaleString()} lbs`, status: data.summary.productionStatus, sub: 'Daily Output' },
          { label: 'Efficiency', value: `${data.summary.efficiencyScore}/10`, status: data.summary.efficiencyStatus, sub: 'Composite Index' },
        ];

        cards.forEach((card, i) => {
          const cx = MG + i * (cardW + 12);
          doc.roundedRect(cx, cY, cardW, cH, 6).strokeColor(C.lightGray).lineWidth(0.8).stroke();

          const isWaste = card.label === 'Waste Rate';
          const goodStat = isWaste
            ? card.status === 'BELOW TARGET'
            : ['TARGET MET', 'ON TARGET', 'ABOVE TARGET', 'GOOD'].includes(card.status);
          const sBg = goodStat ? C.greenBg : (card.status === 'FAIR' ? C.amberBg : C.redBg);
          const sClr = goodStat ? C.green : (card.status === 'FAIR' ? C.amber : C.red);

          doc.font('Helvetica-Bold').fontSize(5.5);
          const sw = Math.min(doc.widthOfString(card.status) + 10, cardW - 16);
          doc.roundedRect(cx + (cardW - sw) / 2, cY + 5, sw, 11, 5.5).fill(sBg);
          doc.font('Helvetica-Bold').fontSize(5.5).fillColor(sClr)
            .text(card.status, cx, cY + 7.5, { width: cardW, align: 'center' });

          doc.font('Helvetica').fontSize(7).fillColor(C.gray)
            .text(card.label, cx, cY + 20, { width: cardW, align: 'center' });
          doc.font('Helvetica-Bold').fontSize(15).fillColor(C.dark)
            .text(card.value, cx, cY + 31, { width: cardW, align: 'center' });
          doc.font('Helvetica').fontSize(6).fillColor(C.gray)
            .text(card.sub, cx, cY + 52, { width: cardW, align: 'center' });
        });
        return cY + cH;
      };

      // ═════════════════════════════════════════════════════════════════
      // PAGE 1: Daily KPI Performance
      // ═════════════════════════════════════════════════════════════════
      let yPos = drawHeader(`Daily KPI Performance — ${data.dayOfWeek}`);

      const dailyRows: TableRow[] = [
        { kpi: 'OEE (Overall Equipment Effectiveness)', target: '', first: '', second: '', both: '', status: '', good: true, isHeader: true },
        {
          kpi: '   Die Cut 1', target: `>= ${t.oee.die_cut_1}%`,
          first: fmtVal(fsd?.dieCut1Oee), second: fmtVal(ssd?.dieCut1Oee), both: fmtVal(bsd?.dieCut1Oee),
          status: isMetGood(bsd?.dieCut1Oee ?? 0, t.oee.die_cut_1) ? 'TARGET MET' : 'BELOW TARGET',
          good: isMetGood(bsd?.dieCut1Oee ?? 0, t.oee.die_cut_1),
          fg: fsd ? isMetGood(fsd.dieCut1Oee, t.oee.die_cut_1) : undefined,
          sg: ssd ? isMetGood(ssd.dieCut1Oee, t.oee.die_cut_1) : undefined,
          bg: bsd ? isMetGood(bsd.dieCut1Oee, t.oee.die_cut_1) : undefined,
        },
        {
          kpi: '   Die Cut 2', target: `>= ${t.oee.die_cut_2}%`,
          first: fmtVal(fsd?.dieCut2Oee), second: fmtVal(ssd?.dieCut2Oee), both: fmtVal(bsd?.dieCut2Oee),
          status: isMetGood(bsd?.dieCut2Oee ?? 0, t.oee.die_cut_2) ? 'TARGET MET' : 'BELOW TARGET',
          good: isMetGood(bsd?.dieCut2Oee ?? 0, t.oee.die_cut_2),
          fg: fsd ? isMetGood(fsd.dieCut2Oee, t.oee.die_cut_2) : undefined,
          sg: ssd ? isMetGood(ssd.dieCut2Oee, t.oee.die_cut_2) : undefined,
          bg: bsd ? isMetGood(bsd.dieCut2Oee, t.oee.die_cut_2) : undefined,
        },
        {
          kpi: '   Total OEE', target: `>= ${t.oee.total}%`,
          first: fmtVal(fsd?.totalOee), second: fmtVal(ssd?.totalOee), both: fmtVal(bsd?.totalOee),
          status: isMetGood(bsd?.totalOee ?? 0, t.oee.total) ? 'TARGET MET' : 'BELOW TARGET',
          good: isMetGood(bsd?.totalOee ?? 0, t.oee.total),
          fg: fsd ? isMetGood(fsd.totalOee, t.oee.total) : undefined,
          sg: ssd ? isMetGood(ssd.totalOee, t.oee.total) : undefined,
          bg: bsd ? isMetGood(bsd.totalOee, t.oee.total) : undefined,
        },
        { kpi: 'Production Volume (lbs)', target: '', first: '', second: '', both: '', status: '', good: true, isHeader: true },
        {
          kpi: '   Die Cut 1', target: `>= ${t.volume.die_cut_1.toLocaleString()}`,
          first: fmtVal(fsd?.dieCut1Lbs, ' lbs'), second: fmtVal(ssd?.dieCut1Lbs, ' lbs'), both: fmtVal(bsd?.dieCut1Lbs, ' lbs'),
          status: isMetGood(bsd?.dieCut1Lbs ?? 0, t.volume.die_cut_1) ? 'ON TARGET' : 'BELOW TARGET',
          good: isMetGood(bsd?.dieCut1Lbs ?? 0, t.volume.die_cut_1),
          bg: bsd ? isMetGood(bsd.dieCut1Lbs, t.volume.die_cut_1) : undefined,
        },
        {
          kpi: '   Die Cut 2', target: `>= ${t.volume.die_cut_2.toLocaleString()}`,
          first: fmtVal(fsd?.dieCut2Lbs, ' lbs'), second: fmtVal(ssd?.dieCut2Lbs, ' lbs'), both: fmtVal(bsd?.dieCut2Lbs, ' lbs'),
          status: isMetGood(bsd?.dieCut2Lbs ?? 0, t.volume.die_cut_2) ? 'ON TARGET' : 'BELOW TARGET',
          good: isMetGood(bsd?.dieCut2Lbs ?? 0, t.volume.die_cut_2),
          bg: bsd ? isMetGood(bsd.dieCut2Lbs, t.volume.die_cut_2) : undefined,
        },
        {
          kpi: '   Total Volume', target: `>= ${t.volume.total.toLocaleString()}`,
          first: fmtVal(fsd?.totalLbs, ' lbs'), second: fmtVal(ssd?.totalLbs, ' lbs'), both: fmtVal(bsd?.totalLbs, ' lbs'),
          status: isMetGood(bsd?.totalLbs ?? 0, t.volume.total) ? 'ON TARGET' : 'BELOW TARGET',
          good: isMetGood(bsd?.totalLbs ?? 0, t.volume.total),
          bg: bsd ? isMetGood(bsd.totalLbs, t.volume.total) : undefined,
        },
        { kpi: 'Waste Percentage', target: '', first: '', second: '', both: '', status: '', good: true, isHeader: true },
        {
          kpi: '   Die Cut 1', target: `<= ${t.waste.die_cut_1}%`,
          first: fmtVal(fsd?.dieCut1WastePct), second: fmtVal(ssd?.dieCut1WastePct), both: fmtVal(bsd?.dieCut1WastePct),
          status: isMetGood(bsd?.dieCut1WastePct ?? 0, t.waste.die_cut_1, true) ? 'BELOW TARGET' : 'ABOVE TARGET',
          good: isMetGood(bsd?.dieCut1WastePct ?? 0, t.waste.die_cut_1, true),
          fg: fsd ? isMetGood(fsd.dieCut1WastePct, t.waste.die_cut_1, true) : undefined,
          sg: ssd ? isMetGood(ssd.dieCut1WastePct, t.waste.die_cut_1, true) : undefined,
          bg: bsd ? isMetGood(bsd.dieCut1WastePct, t.waste.die_cut_1, true) : undefined,
        },
        {
          kpi: '   Die Cut 2', target: `<= ${t.waste.die_cut_2}%`,
          first: fmtVal(fsd?.dieCut2WastePct), second: fmtVal(ssd?.dieCut2WastePct), both: fmtVal(bsd?.dieCut2WastePct),
          status: isMetGood(bsd?.dieCut2WastePct ?? 0, t.waste.die_cut_2, true) ? 'BELOW TARGET' : 'ABOVE TARGET',
          good: isMetGood(bsd?.dieCut2WastePct ?? 0, t.waste.die_cut_2, true),
          fg: fsd ? isMetGood(fsd.dieCut2WastePct, t.waste.die_cut_2, true) : undefined,
          sg: ssd ? isMetGood(ssd.dieCut2WastePct, t.waste.die_cut_2, true) : undefined,
          bg: bsd ? isMetGood(bsd.dieCut2WastePct, t.waste.die_cut_2, true) : undefined,
        },
        {
          kpi: '   Total Waste', target: `<= ${t.waste.total}%`,
          first: fmtVal(fsd?.totalWastePct), second: fmtVal(ssd?.totalWastePct), both: fmtVal(bsd?.totalWastePct),
          status: isMetGood(bsd?.totalWastePct ?? 0, t.waste.total, true) ? 'BELOW TARGET' : 'ABOVE TARGET',
          good: isMetGood(bsd?.totalWastePct ?? 0, t.waste.total, true),
          fg: fsd ? isMetGood(fsd.totalWastePct, t.waste.total, true) : undefined,
          sg: ssd ? isMetGood(ssd.totalWastePct, t.waste.total, true) : undefined,
          bg: bsd ? isMetGood(bsd.totalWastePct, t.waste.total, true) : undefined,
        },
      ];

      const tableBottom = drawKpiTable(yPos, `Daily KPI Breakdown — ${data.dayOfWeek}`, dailyRows);
      drawSummaryCards(tableBottom + 10);
      drawFooter(1, 2);

      // ═════════════════════════════════════════════════════════════════
      // PAGE 2: Week Summary Averages
      // ═════════════════════════════════════════════════════════════════
      doc.addPage();
      yPos = drawHeader(`Weekly Summary Averages — ${weekDisplay}`);

      const wa = data.weekAverages?.averages;

      if (wa) {
        doc.roundedRect(MG, yPos, PW, 22, 4).fill(C.blueBg);
        doc.font('Helvetica-Bold').fontSize(7.5).fillColor(C.accent)
          .text(`Week: ${weekDisplay}  |  Days with data: ${data.weekAverages?.days_count ?? 0}  |  Values shown are averages across all submitted days`, MG + 10, yPos + 6);
        yPos += 28;

        const weekRows: TableRow[] = [
          { kpi: 'OEE (Overall Equipment Effectiveness)', target: '', first: '', second: '', both: '', status: '', good: true, isHeader: true },
          {
            kpi: '   Die Cut 1', target: `>= ${t.oee.die_cut_1}%`,
            first: fmtVal(wa.oee.die_cut_1.first_shift), second: fmtVal(wa.oee.die_cut_1.second_shift), both: fmtVal(wa.oee.die_cut_1.both_shifts),
            status: isMetGood(wa.oee.die_cut_1.both_shifts ?? 0, t.oee.die_cut_1) ? 'TARGET MET' : 'BELOW TARGET',
            good: isMetGood(wa.oee.die_cut_1.both_shifts ?? 0, t.oee.die_cut_1),
            fg: wa.oee.die_cut_1.first_shift != null ? isMetGood(wa.oee.die_cut_1.first_shift, t.oee.die_cut_1) : undefined,
            sg: wa.oee.die_cut_1.second_shift != null ? isMetGood(wa.oee.die_cut_1.second_shift, t.oee.die_cut_1) : undefined,
            bg: wa.oee.die_cut_1.both_shifts != null ? isMetGood(wa.oee.die_cut_1.both_shifts, t.oee.die_cut_1) : undefined,
          },
          {
            kpi: '   Die Cut 2', target: `>= ${t.oee.die_cut_2}%`,
            first: fmtVal(wa.oee.die_cut_2.first_shift), second: fmtVal(wa.oee.die_cut_2.second_shift), both: fmtVal(wa.oee.die_cut_2.both_shifts),
            status: isMetGood(wa.oee.die_cut_2.both_shifts ?? 0, t.oee.die_cut_2) ? 'TARGET MET' : 'BELOW TARGET',
            good: isMetGood(wa.oee.die_cut_2.both_shifts ?? 0, t.oee.die_cut_2),
            fg: wa.oee.die_cut_2.first_shift != null ? isMetGood(wa.oee.die_cut_2.first_shift, t.oee.die_cut_2) : undefined,
            sg: wa.oee.die_cut_2.second_shift != null ? isMetGood(wa.oee.die_cut_2.second_shift, t.oee.die_cut_2) : undefined,
            bg: wa.oee.die_cut_2.both_shifts != null ? isMetGood(wa.oee.die_cut_2.both_shifts, t.oee.die_cut_2) : undefined,
          },
          {
            kpi: '   Total OEE (Avg)', target: `>= ${t.oee.total}%`,
            first: fmtVal(wa.oee.total.first_shift), second: fmtVal(wa.oee.total.second_shift), both: fmtVal(wa.oee.total.both_shifts),
            status: isMetGood(wa.oee.total.both_shifts ?? 0, t.oee.total) ? 'TARGET MET' : 'BELOW TARGET',
            good: isMetGood(wa.oee.total.both_shifts ?? 0, t.oee.total),
            fg: wa.oee.total.first_shift != null ? isMetGood(wa.oee.total.first_shift, t.oee.total) : undefined,
            sg: wa.oee.total.second_shift != null ? isMetGood(wa.oee.total.second_shift, t.oee.total) : undefined,
            bg: wa.oee.total.both_shifts != null ? isMetGood(wa.oee.total.both_shifts, t.oee.total) : undefined,
          },
          { kpi: 'Production Volume (lbs)', target: '', first: '', second: '', both: '', status: '', good: true, isHeader: true },
          {
            kpi: '   Die Cut 1', target: `>= ${t.volume.die_cut_1.toLocaleString()}`,
            first: fmtVal(wa.volume.die_cut_1.first_shift, ' lbs'), second: fmtVal(wa.volume.die_cut_1.second_shift, ' lbs'), both: fmtVal(wa.volume.die_cut_1.both_shifts, ' lbs'),
            status: isMetGood(wa.volume.die_cut_1.both_shifts ?? 0, t.volume.die_cut_1) ? 'ON TARGET' : 'BELOW TARGET',
            good: isMetGood(wa.volume.die_cut_1.both_shifts ?? 0, t.volume.die_cut_1),
            bg: wa.volume.die_cut_1.both_shifts != null ? isMetGood(wa.volume.die_cut_1.both_shifts, t.volume.die_cut_1) : undefined,
          },
          {
            kpi: '   Die Cut 2', target: `>= ${t.volume.die_cut_2.toLocaleString()}`,
            first: fmtVal(wa.volume.die_cut_2.first_shift, ' lbs'), second: fmtVal(wa.volume.die_cut_2.second_shift, ' lbs'), both: fmtVal(wa.volume.die_cut_2.both_shifts, ' lbs'),
            status: isMetGood(wa.volume.die_cut_2.both_shifts ?? 0, t.volume.die_cut_2) ? 'ON TARGET' : 'BELOW TARGET',
            good: isMetGood(wa.volume.die_cut_2.both_shifts ?? 0, t.volume.die_cut_2),
            bg: wa.volume.die_cut_2.both_shifts != null ? isMetGood(wa.volume.die_cut_2.both_shifts, t.volume.die_cut_2) : undefined,
          },
          {
            kpi: '   Total Volume (Avg)', target: `>= ${t.volume.total.toLocaleString()}`,
            first: fmtVal(wa.volume.total.first_shift, ' lbs'), second: fmtVal(wa.volume.total.second_shift, ' lbs'), both: fmtVal(wa.volume.total.both_shifts, ' lbs'),
            status: isMetGood(wa.volume.total.both_shifts ?? 0, t.volume.total) ? 'ON TARGET' : 'BELOW TARGET',
            good: isMetGood(wa.volume.total.both_shifts ?? 0, t.volume.total),
            bg: wa.volume.total.both_shifts != null ? isMetGood(wa.volume.total.both_shifts, t.volume.total) : undefined,
          },
          { kpi: 'Waste Percentage', target: '', first: '', second: '', both: '', status: '', good: true, isHeader: true },
          {
            kpi: '   Die Cut 1', target: `<= ${t.waste.die_cut_1}%`,
            first: fmtVal(wa.waste.percentage.die_cut_1.first_shift), second: fmtVal(wa.waste.percentage.die_cut_1.second_shift), both: fmtVal(wa.waste.percentage.die_cut_1.both_shifts),
            status: isMetGood(wa.waste.percentage.die_cut_1.both_shifts ?? 0, t.waste.die_cut_1, true) ? 'BELOW TARGET' : 'ABOVE TARGET',
            good: isMetGood(wa.waste.percentage.die_cut_1.both_shifts ?? 0, t.waste.die_cut_1, true),
            fg: wa.waste.percentage.die_cut_1.first_shift != null ? isMetGood(wa.waste.percentage.die_cut_1.first_shift, t.waste.die_cut_1, true) : undefined,
            sg: wa.waste.percentage.die_cut_1.second_shift != null ? isMetGood(wa.waste.percentage.die_cut_1.second_shift, t.waste.die_cut_1, true) : undefined,
            bg: wa.waste.percentage.die_cut_1.both_shifts != null ? isMetGood(wa.waste.percentage.die_cut_1.both_shifts, t.waste.die_cut_1, true) : undefined,
          },
          {
            kpi: '   Die Cut 2', target: `<= ${t.waste.die_cut_2}%`,
            first: fmtVal(wa.waste.percentage.die_cut_2.first_shift), second: fmtVal(wa.waste.percentage.die_cut_2.second_shift), both: fmtVal(wa.waste.percentage.die_cut_2.both_shifts),
            status: isMetGood(wa.waste.percentage.die_cut_2.both_shifts ?? 0, t.waste.die_cut_2, true) ? 'BELOW TARGET' : 'ABOVE TARGET',
            good: isMetGood(wa.waste.percentage.die_cut_2.both_shifts ?? 0, t.waste.die_cut_2, true),
            fg: wa.waste.percentage.die_cut_2.first_shift != null ? isMetGood(wa.waste.percentage.die_cut_2.first_shift, t.waste.die_cut_2, true) : undefined,
            sg: wa.waste.percentage.die_cut_2.second_shift != null ? isMetGood(wa.waste.percentage.die_cut_2.second_shift, t.waste.die_cut_2, true) : undefined,
            bg: wa.waste.percentage.die_cut_2.both_shifts != null ? isMetGood(wa.waste.percentage.die_cut_2.both_shifts, t.waste.die_cut_2, true) : undefined,
          },
          {
            kpi: '   Total Waste (Avg)', target: `<= ${t.waste.total}%`,
            first: fmtVal(wa.waste.percentage.total.first_shift), second: fmtVal(wa.waste.percentage.total.second_shift), both: fmtVal(wa.waste.percentage.total.both_shifts),
            status: isMetGood(wa.waste.percentage.total.both_shifts ?? 0, t.waste.total, true) ? 'BELOW TARGET' : 'ABOVE TARGET',
            good: isMetGood(wa.waste.percentage.total.both_shifts ?? 0, t.waste.total, true),
            fg: wa.waste.percentage.total.first_shift != null ? isMetGood(wa.waste.percentage.total.first_shift, t.waste.total, true) : undefined,
            sg: wa.waste.percentage.total.second_shift != null ? isMetGood(wa.waste.percentage.total.second_shift, t.waste.total, true) : undefined,
            bg: wa.waste.percentage.total.both_shifts != null ? isMetGood(wa.waste.percentage.total.both_shifts, t.waste.total, true) : undefined,
          },
        ];

        drawKpiTable(yPos, `Weekly Average KPI Summary — ${weekDisplay}`, weekRows);
      } else {
        doc.font('Helvetica').fontSize(12).fillColor(C.gray)
          .text('No weekly summary data available for this week.', MG, yPos + 40, { width: PW, align: 'center' });
      }

      drawFooter(2, 2);
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

  const [org, facility, targetRows, weekAvgResult] = await Promise.all([
    prisma.organization.findUnique({ where: { id: organizationId }, select: { name: true } }),
    prisma.facility.findFirst({ where: { organizationId }, select: { name: true } }),
    prisma.bakeryKpiTarget.findMany(),
    bakeryMetricsService.getWeekAverage(weekName),
  ]);

  const targets = {
    oee: { die_cut_1: 74.6, die_cut_2: 74.6, total: 74.6 },
    volume: { die_cut_1: 6000, die_cut_2: 6000, total: 12000 },
    waste: { die_cut_1: 3, die_cut_2: 3, total: 3 },
  };
  for (const tgt of targetRows) {
    const metric = tgt.metricType as keyof typeof targets;
    const name = tgt.metricName as string;
    if (targets[metric] && name in targets[metric]) {
      (targets[metric] as any)[name] = Number(tgt.targetValue);
    }
  }

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
  if (!bsData) bsData = fsData || ssData;

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
    weekAverages: weekAvgResult ? { days_count: weekAvgResult.days_count, averages: weekAvgResult.averages } : null,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// SEND EMAIL with PDF attachment
// ═══════════════════════════════════════════════════════════════════════════
export async function sendBakeryReportEmail(
  recipientEmail: string,
  recipientName: string,
  reportData: BakeryReportData,
  pdfBuffer: Buffer,
  isAutomatic: boolean = true
): Promise<{ success: boolean; reason?: string; messageId?: string }> {
  const resend = getResendClient();
  if (!resend) {
    return { success: false, reason: 'Email not configured — set RESEND_API_KEY' };
  }

  const safeWeek = reportData.weekName.replace(/[^a-zA-Z0-9_-]/g, '');
  const filename = `Bakery_Report_${safeWeek}_${reportData.dayOfWeek}.pdf`;

  const attachments: any[] = [
    { filename, content: pdfBuffer.toString('base64'), contentType: 'application/pdf' },
  ];
  if (logoBase64) {
    attachments.push({
      filename: 'dashmet-logo.png',
      content: logoBase64,
      contentType: 'image/png',
      headers: { 'Content-ID': '<dashmet-logo>', 'Content-Disposition': 'inline' },
    });
  }

  const { data, error } = await resend.emails.send({
    from: process.env.EMAIL_FROM || 'DashMet <noreply@dashmet.com>',
    to: recipientEmail,
    subject: `📊 Bakery Production Report — ${reportData.dayOfWeek}, ${reportData.weekName.replace('_', ' to ')}`,
    html: buildEmailHtml(recipientName, reportData, isAutomatic),
    attachments,
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
function buildEmailHtml(recipientName: string, data: BakeryReportData, isAutomatic: boolean): string {
  const oeeIcon = data.summary.oeeStatus === 'TARGET MET' ? '✅' : '⚠️';
  const wasteIcon = data.summary.wasteStatus === 'BELOW TARGET' ? '✅' : '🔴';
  const prodIcon = data.summary.productionStatus === 'ABOVE TARGET' ? '✅' : '📉';
  const weekDisplay = formatWeekDisplay(data.weekName);
  const reportWord = isAutomatic ? 'A new' : 'A saved';

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:640px;margin:0 auto;background:#ffffff;">
    <div style="background:linear-gradient(135deg,#1e3a5f 0%,#1e40af 100%);padding:32px 40px;text-align:center;">
      <img src="cid:dashmet-logo" alt="DashMet" style="height:40px;margin-bottom:12px;" />
      <h1 style="color:#ffffff;font-size:20px;font-weight:700;margin:0;">Bakery Production Report</h1>
      <p style="color:#93c5fd;font-size:13px;margin:6px 0 0;">${data.dayOfWeek} &bull; ${weekDisplay}</p>
    </div>
    <div style="padding:32px 40px;">
      <p style="font-size:15px;color:#334155;line-height:1.6;margin:0 0 20px;">Hello ${recipientName},</p>
      <p style="font-size:14px;color:#475569;line-height:1.6;margin:0 0 24px;">
        ${reportWord} bakery production report has been submitted by <strong>${data.submittedBy}</strong> for <strong>${data.dayOfWeek}</strong>.
        Please find the detailed KPI report attached as a PDF.
      </p>
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
        The full detailed report with per-shift breakdowns and weekly summary is attached as a PDF.
      </p>
      <p style="font-size:14px;color:#475569;line-height:1.6;margin:24px 0 0;">
        Best regards,<br/><strong>DashMet RCA</strong><br/>
        <span style="font-size:12px;color:#94a3b8;">${data.organizationName} &bull; ${data.facilityName}</span>
      </p>
    </div>
    <div style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 40px;text-align:center;">
      <p style="font-size:11px;color:#94a3b8;margin:0;">This is an automated notification from DashMet RCA. Please do not reply to this email.</p>
      <p style="font-size:11px;color:#94a3b8;margin:4px 0 0;">&copy; ${new Date().getFullYear()} DashMet &mdash; Confidential</p>
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
    where: { organizationId, isActive: true },
    select: { id: true, email: true, firstName: true, lastName: true, role: true },
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
  organizationId: string,
  isAutomatic: boolean = true
): Promise<{ sent: number; failed: number; errors: string[] }> {
  const reportData = await buildBakeryReportData(weekName, dayOfWeek, organizationId);
  if (!reportData) {
    return { sent: 0, failed: 0, errors: [`No record found for ${dayOfWeek} in week ${weekName}`] };
  }

  const pdfBuffer = await generateBakeryReportPdf(reportData);

  const users = await prisma.user.findMany({
    where: { id: { in: userIds }, isActive: true },
    select: { id: true, email: true, firstName: true, lastName: true },
  });

  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const user of users) {
    try {
      const result = await sendBakeryReportEmail(user.email, user.firstName, reportData, pdfBuffer, isAutomatic);
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
