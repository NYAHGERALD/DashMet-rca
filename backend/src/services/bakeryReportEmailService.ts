/**
 * Bakery Metrics Report Email Service
 * - Generates professional PDF reports from bakery metrics data
 * - Sends branded emails with PDF attachments via Resend
 */

import { Resend } from 'resend';
import { prisma } from '../utils/prisma';
import puppeteer from 'puppeteer';
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
function fmt(val: number | null | undefined, suffix = '%', decimals = 1): string {
  if (val === null || val === undefined) return '—';
  if (suffix === ' lbs') return `${Math.round(val).toLocaleString()} lbs`;
  return `${val.toFixed(decimals)}${suffix}`;
}

function statusBadge(status: string): string {
  const colors: Record<string, { bg: string; text: string }> = {
    'TARGET MET': { bg: '#dcfce7', text: '#166534' },
    'ON TARGET': { bg: '#dcfce7', text: '#166534' },
    'ABOVE TARGET': { bg: '#dcfce7', text: '#166534' },
    'BELOW TARGET': { bg: '#fef2f2', text: '#991b1b' },
    'GOOD': { bg: '#dcfce7', text: '#166534' },
    'FAIR': { bg: '#fef9c3', text: '#854d0e' },
    'POOR': { bg: '#fef2f2', text: '#991b1b' },
    'No Data': { bg: '#f3f4f6', text: '#6b7280' },
  };
  const c = colors[status] || { bg: '#f3f4f6', text: '#6b7280' };
  return `<span style="display:inline-block;padding:4px 12px;border-radius:20px;font-size:11px;font-weight:700;letter-spacing:0.5px;background:${c.bg};color:${c.text};">${status}</span>`;
}

function metricColor(val: number, target: number, isWaste = false): string {
  if (isWaste) return val <= target ? '#166534' : '#dc2626';
  return val >= target ? '#166534' : '#dc2626';
}

function kpiRow(
  metric: string,
  subMetric: string,
  target: string,
  first: string,
  firstColor: string,
  second: string,
  secondColor: string,
  both: string,
  bothColor: string,
  status: string
): string {
  return `
    <tr>
      <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;font-weight:600;color:#1e293b;">${metric}</td>
      <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;color:#64748b;">${subMetric}<br/><span style="font-size:11px;color:#94a3b8;">${target}</span></td>
      <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;text-align:center;font-weight:600;color:${firstColor};">${first}</td>
      <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;text-align:center;font-weight:600;color:${secondColor};">${second}</td>
      <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;text-align:center;font-weight:700;color:${bothColor};">${both}</td>
      <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;text-align:center;">${statusBadge(status)}</td>
    </tr>`;
}

// ═══════════════════════════════════════════════════════════════════════════
// GENERATE PDF
// ═══════════════════════════════════════════════════════════════════════════
export async function generateBakeryReportPdf(data: BakeryReportData): Promise<Buffer> {
  const fs = data.firstShift;
  const ss = data.secondShift;
  const bs = data.bothShifts;
  const t = data.targets;

  // Format week dates from weekName "04-06-2026_04-10-2026"
  let weekDisplay = data.weekName;
  if (data.weekName.includes('_')) {
    const [startStr, endStr] = data.weekName.split('_');
    const fmtDate = (s: string) => {
      const [m, d, y] = s.split('-');
      const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };
    weekDisplay = `${fmtDate(startStr)} – ${fmtDate(endStr)}`;
  }

  const generatedAt = new Date().toLocaleString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
  });

  // Determine statuses
  const oeeStatus = bs && bs.totalOee >= t.oee.total ? 'TARGET MET' : 'BELOW TARGET';
  const wasteStatus = bs && bs.totalWastePct <= t.waste.total ? 'BELOW TARGET' : 'ABOVE TARGET';
  const prodStatus = bs && bs.totalLbs >= t.volume.total ? 'ON TARGET' : 'BELOW TARGET';

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1e293b; background: #fff; }
    .page { padding: 40px; max-width: 900px; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; border-bottom: 3px solid #1e40af; padding-bottom: 20px; }
    .header-left { display: flex; align-items: center; gap: 16px; }
    .header-left img { height: 48px; }
    .header-title { font-size: 22px; font-weight: 800; color: #1e40af; }
    .header-subtitle { font-size: 13px; color: #64748b; margin-top: 2px; }
    .header-right { text-align: right; font-size: 12px; color: #64748b; line-height: 1.8; }
    .header-right strong { color: #1e293b; }
    .section-title { font-size: 16px; font-weight: 700; color: #1e293b; margin: 28px 0 12px; padding-bottom: 6px; border-bottom: 2px solid #e5e7eb; }
    .kpi-table { width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; }
    .kpi-table th { padding: 10px 16px; background: #1e3a5f; color: #fff; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; text-align: center; }
    .kpi-table th:first-child, .kpi-table th:nth-child(2) { text-align: left; }
    .metric-label { display: flex; align-items: center; gap: 8px; }
    .metric-icon { width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 14px; }
    .summary-cards { display: flex; gap: 16px; margin-top: 24px; }
    .summary-card { flex: 1; padding: 20px; border-radius: 12px; border: 1px solid #e5e7eb; text-align: center; }
    .summary-card .value { font-size: 28px; font-weight: 800; color: #1e293b; margin: 8px 0 4px; }
    .summary-card .unit { font-size: 14px; color: #64748b; }
    .summary-card .label { font-size: 12px; color: #64748b; margin-top: 4px; }
    .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 11px; color: #94a3b8; }
    .badge { display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 10px; font-weight: 700; }
  </style>
</head>
<body>
  <div class="page">
    <!-- Header -->
    <div class="header">
      <div class="header-left">
        ${logoBase64 ? `<img src="${logoBase64}" alt="DashMet" />` : '<div style="font-size:24px;font-weight:900;color:#1e40af;">DASHMET</div>'}
        <div>
          <div class="header-title">Bakery Production Report</div>
          <div class="header-subtitle">Daily KPI Performance Summary</div>
        </div>
      </div>
      <div class="header-right">
        <strong>${data.organizationName}</strong><br/>
        ${data.facilityName}<br/>
        <strong>Week:</strong> ${weekDisplay}<br/>
        <strong>Day:</strong> ${data.dayOfWeek}<br/>
        <strong>Submitted by:</strong> ${data.submittedBy}<br/>
        <strong>Generated:</strong> ${generatedAt}
      </div>
    </div>

    <!-- KPI Table -->
    <div class="section-title">KPI Performance Breakdown</div>
    <table class="kpi-table">
      <thead>
        <tr>
          <th>KPI Metric</th>
          <th>Target</th>
          <th style="color:#f59e0b;">First Shift</th>
          <th style="color:#8b5cf6;">Second Shift</th>
          <th style="color:#10b981;">Both Shifts</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        <!-- OEE -->
        ${kpiRow('', 'Die Cut 1', `≥ ${t.oee.die_cut_1}%`,
          fmt(fs?.dieCut1Oee), metricColor(fs?.dieCut1Oee ?? 0, t.oee.die_cut_1),
          fmt(ss?.dieCut1Oee), metricColor(ss?.dieCut1Oee ?? 0, t.oee.die_cut_1),
          fmt(bs?.dieCut1Oee), metricColor(bs?.dieCut1Oee ?? 0, t.oee.die_cut_1),
          (bs?.dieCut1Oee ?? 0) >= t.oee.die_cut_1 ? 'TARGET MET' : 'BELOW TARGET'
        )}
        ${kpiRow('', 'Die Cut 2', `≥ ${t.oee.die_cut_2}%`,
          fmt(fs?.dieCut2Oee), metricColor(fs?.dieCut2Oee ?? 0, t.oee.die_cut_2),
          fmt(ss?.dieCut2Oee), metricColor(ss?.dieCut2Oee ?? 0, t.oee.die_cut_2),
          fmt(bs?.dieCut2Oee), metricColor(bs?.dieCut2Oee ?? 0, t.oee.die_cut_2),
          (bs?.dieCut2Oee ?? 0) >= t.oee.die_cut_2 ? 'TARGET MET' : 'BELOW TARGET'
        )}
        ${kpiRow('<div class="metric-label"><div class="metric-icon" style="background:#eff6ff;color:#1e40af;">⚙</div><div><strong>OEE</strong><br/><span style="font-size:11px;color:#64748b;">Overall Equipment Effectiveness</span></div></div>', 
          'Total', `≥ ${t.oee.total}%`,
          fmt(fs?.totalOee), metricColor(fs?.totalOee ?? 0, t.oee.total),
          fmt(ss?.totalOee), metricColor(ss?.totalOee ?? 0, t.oee.total),
          fmt(bs?.totalOee), metricColor(bs?.totalOee ?? 0, t.oee.total),
          oeeStatus
        )}
        
        <!-- Volume -->
        ${kpiRow('', 'Die Cut 1', `≥ ${t.volume.die_cut_1.toLocaleString()} lbs`,
          fmt(fs?.dieCut1Lbs, ' lbs'), '#1e293b',
          fmt(ss?.dieCut1Lbs, ' lbs'), '#1e293b',
          fmt(bs?.dieCut1Lbs, ' lbs'), (bs?.dieCut1Lbs ?? 0) >= t.volume.die_cut_1 ? '#166534' : '#dc2626',
          (bs?.dieCut1Lbs ?? 0) >= t.volume.die_cut_1 ? 'ON TARGET' : 'BELOW TARGET'
        )}
        ${kpiRow('', 'Die Cut 2', `≥ ${t.volume.die_cut_2.toLocaleString()} lbs`,
          fmt(fs?.dieCut2Lbs, ' lbs'), '#1e293b',
          fmt(ss?.dieCut2Lbs, ' lbs'), '#1e293b',
          fmt(bs?.dieCut2Lbs, ' lbs'), (bs?.dieCut2Lbs ?? 0) >= t.volume.die_cut_2 ? '#166534' : '#dc2626',
          (bs?.dieCut2Lbs ?? 0) >= t.volume.die_cut_2 ? 'ON TARGET' : 'BELOW TARGET'
        )}
        ${kpiRow('<div class="metric-label"><div class="metric-icon" style="background:#ecfdf5;color:#166534;">📦</div><div><strong>VOLUME</strong><br/><span style="font-size:11px;color:#64748b;">Production Output (lbs)</span></div></div>',
          'Total', `≥ ${t.volume.total.toLocaleString()} lbs`,
          fmt(fs?.totalLbs, ' lbs'), '#1e293b',
          fmt(ss?.totalLbs, ' lbs'), '#1e293b',
          fmt(bs?.totalLbs, ' lbs'), (bs?.totalLbs ?? 0) >= t.volume.total ? '#166534' : '#dc2626',
          (bs?.totalLbs ?? 0) >= t.volume.total ? 'ON TARGET' : 'BELOW TARGET'
        )}
        
        <!-- Waste -->
        ${kpiRow('', 'Die Cut 1', `≤ ${t.waste.die_cut_1}%`,
          fmt(fs?.dieCut1WastePct), metricColor(fs?.dieCut1WastePct ?? 0, t.waste.die_cut_1, true),
          fmt(ss?.dieCut1WastePct), metricColor(ss?.dieCut1WastePct ?? 0, t.waste.die_cut_1, true),
          fmt(bs?.dieCut1WastePct), metricColor(bs?.dieCut1WastePct ?? 0, t.waste.die_cut_1, true),
          (bs?.dieCut1WastePct ?? 0) <= t.waste.die_cut_1 ? 'BELOW TARGET' : 'ABOVE TARGET'
        )}
        ${kpiRow('', 'Die Cut 2', `≤ ${t.waste.die_cut_2}%`,
          fmt(fs?.dieCut2WastePct), metricColor(fs?.dieCut2WastePct ?? 0, t.waste.die_cut_2, true),
          fmt(ss?.dieCut2WastePct), metricColor(ss?.dieCut2WastePct ?? 0, t.waste.die_cut_2, true),
          fmt(bs?.dieCut2WastePct), metricColor(bs?.dieCut2WastePct ?? 0, t.waste.die_cut_2, true),
          (bs?.dieCut2WastePct ?? 0) <= t.waste.die_cut_2 ? 'BELOW TARGET' : 'ABOVE TARGET'
        )}
        ${kpiRow('<div class="metric-label"><div class="metric-icon" style="background:#fef2f2;color:#dc2626;">🗑</div><div><strong>WASTE</strong><br/><span style="font-size:11px;color:#64748b;">Material Waste Percentage</span></div></div>',
          'Total', `≤ ${t.waste.total}%`,
          fmt(fs?.totalWastePct), metricColor(fs?.totalWastePct ?? 0, t.waste.total, true),
          fmt(ss?.totalWastePct), metricColor(ss?.totalWastePct ?? 0, t.waste.total, true),
          fmt(bs?.totalWastePct), metricColor(bs?.totalWastePct ?? 0, t.waste.total, true),
          wasteStatus
        )}
      </tbody>
    </table>

    <!-- Summary Cards -->
    <div class="section-title">Performance Summary</div>
    <div class="summary-cards">
      <div class="summary-card">
        ${statusBadge(data.summary.oeeStatus)}
        <div style="font-size:12px;color:#64748b;margin-top:8px;">Overall Equipment Effectiveness</div>
        <div class="value">${data.summary.oeeValue.toFixed(1)} <span class="unit">%</span></div>
        <div class="label">vs target (${t.oee.total}%)</div>
      </div>
      <div class="summary-card">
        ${statusBadge(data.summary.wasteStatus)}
        <div style="font-size:12px;color:#64748b;margin-top:8px;">Waste Percentage</div>
        <div class="value">${data.summary.wasteValue.toFixed(2)} <span class="unit">%</span></div>
        <div class="label">vs target (${t.waste.total}%)</div>
      </div>
      <div class="summary-card">
        ${statusBadge(data.summary.productionStatus)}
        <div style="font-size:12px;color:#64748b;margin-top:8px;">Production Volume</div>
        <div class="value">${Math.round(data.summary.productionValue).toLocaleString()} <span class="unit">lbs</span></div>
        <div class="label">daily output</div>
      </div>
      <div class="summary-card">
        ${statusBadge(data.summary.efficiencyStatus)}
        <div style="font-size:12px;color:#64748b;margin-top:8px;">Efficiency Score</div>
        <div class="value">${data.summary.efficiencyScore.toFixed(1)} <span class="unit">/10</span></div>
        <div class="label">composite index</div>
      </div>
    </div>

    <!-- Footer -->
    <div class="footer">
      <p>This report was generated by <strong>DashMet RCA</strong> — ${data.organizationName}</p>
      <p style="margin-top:4px;">Confidential — For internal use only</p>
    </div>
  </div>
</body>
</html>`;

  // Render HTML to PDF via Puppeteer
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({
      format: 'A4',
      landscape: true,
      printBackground: true,
      margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' },
    });
    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
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
