/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * OPERATIONAL DAILY REPORT SERVICE — AI-Powered Daily Operations Analysis
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Generates comprehensive daily operational reports that include:
 *   - OEE metrics for Die Cut 1, Die Cut 2, and combined (1st/2nd/both shifts)
 *   - Waste analysis per machine and per shift
 *   - Current day issues with photo evidence analysis
 *   - Previous day carry-over issues
 *   - Equipment correlation and root cause analysis
 *   - Actionable recommendations for management
 *
 * Security: All user inputs are validated against strict allowlists.
 * No raw user content is injected into AI prompts.
 */

import OpenAI from 'openai';
import { PrismaClient } from '@prisma/client';
import { sanitizeForPrompt as centralSanitize } from '../utils/promptSanitizer';

const prisma = new PrismaClient();

// ─── OpenAI Client (reuse singleton) ────────────────────────────────────────
let openaiClient: OpenAI | null = null;

function getOpenAI(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) return null;
  if (openaiClient) return openaiClient;
  openaiClient = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    timeout: 300000,
    maxRetries: 2,
  });
  return openaiClient;
}

// ─── Validation: Strict allowlists (anti-injection) ─────────────────────────
const VALID_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const WEEK_NAME_PATTERN = /^[A-Za-z0-9\s\-_()]{1,100}$/;

function validateWeekName(weekName: string): boolean {
  return WEEK_NAME_PATTERN.test(weekName) && weekName.length <= 100;
}

function validateDayOfWeek(day: string): boolean {
  return VALID_DAYS.includes(day);
}

// ─── Day ordering helper ────────────────────────────────────────────────────
function getPreviousDay(day: string): string | null {
  const idx = VALID_DAYS.indexOf(day);
  if (idx <= 0) return null; // Monday has no previous workday
  return VALID_DAYS[idx - 1];
}

// ─── Data Collection ────────────────────────────────────────────────────────

interface ShiftMetrics {
  dieCut1OeePct: number;
  dieCut2OeePct: number;
  oeeAvgPct: number;
  dieCut1Lbs: number;
  dieCut2Lbs: number;
  poundsTotal: number;
  dieCut1WasteLb: number;
  dieCut2WasteLb: number;
  dieCut1WastePct: number;
  dieCut2WastePct: number;
  wasteAvgPct: number;
}

interface IssueData {
  issueNumber: string;
  type: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  startTime: string | null;
  totalMinutesLost: number | null;
  equipment: string | null;
  equipmentAssetTag: string | null;
  component: string | null;
  line: string | null;
  shift: string | null;
  department: string | null;
  photoCount: number;
  photoDescriptions: string[];
  reportedBy: string;
  createdAt: string;
}

function parseShiftMetrics(raw: any): ShiftMetrics | null {
  if (!raw) return null;
  return {
    dieCut1OeePct: Number(raw.dieCut1OeePct ?? 0),
    dieCut2OeePct: Number(raw.dieCut2OeePct ?? 0),
    oeeAvgPct: Number(raw.oeeAvgPct ?? 0),
    dieCut1Lbs: Number(raw.dieCut1Lbs ?? 0),
    dieCut2Lbs: Number(raw.dieCut2Lbs ?? 0),
    poundsTotal: Number(raw.poundsTotal ?? 0),
    dieCut1WasteLb: Number(raw.dieCut1WasteLb ?? 0),
    dieCut2WasteLb: Number(raw.dieCut2WasteLb ?? 0),
    dieCut1WastePct: Number(raw.dieCut1WastePct ?? 0),
    dieCut2WastePct: Number(raw.dieCut2WastePct ?? 0),
    wasteAvgPct: Number(raw.wasteAvgPct ?? 0),
  };
}

async function collectDailyData(weekName: string, dayOfWeek: string, organizationId: string) {
  // 1. Get metrics submission for selected day
  const submission = await prisma.bakeryWeekSubmission.findFirst({
    where: { weekName, dayOfWeek },
    include: {
      firstShiftMetrics: true,
      secondShiftMetrics: true,
      bothShiftsMetrics: true,
    },
  });

  const firstShift = parseShiftMetrics(submission?.firstShiftMetrics);
  const secondShift = parseShiftMetrics(submission?.secondShiftMetrics);
  const bothShifts = parseShiftMetrics(submission?.bothShiftsMetrics);

  // 2. Get previous day metrics for comparison
  const prevDay = getPreviousDay(dayOfWeek);
  let prevDayMetrics: { firstShift: ShiftMetrics | null; secondShift: ShiftMetrics | null; bothShifts: ShiftMetrics | null } | null = null;

  if (prevDay) {
    const prevSubmission = await prisma.bakeryWeekSubmission.findFirst({
      where: { weekName, dayOfWeek: prevDay },
      include: {
        firstShiftMetrics: true,
        secondShiftMetrics: true,
        bothShiftsMetrics: true,
      },
    });
    if (prevSubmission) {
      prevDayMetrics = {
        firstShift: parseShiftMetrics(prevSubmission.firstShiftMetrics),
        secondShift: parseShiftMetrics(prevSubmission.secondShiftMetrics),
        bothShifts: parseShiftMetrics(prevSubmission.bothShiftsMetrics),
      };
    }
  }

  // 3. Get current day issues
  const dayMapping: Record<string, number> = { Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6, Sunday: 7 };
  const dayOrder = dayMapping[dayOfWeek] || 0;

  // Find DayOfWeek records matching the day
  const dayOfWeekRecords = await prisma.dayOfWeek.findMany({
    where: { organizationId, dayOrder, isActive: true },
    select: { id: true },
  });
  const dayOfWeekIds = dayOfWeekRecords.map(d => d.id);

  // Get week number from the sequential position of BakeryWeeklySheet in the calendar year
  // This mirrors the Operations page logic: weeks ordered by weekStart asc, index+1 = weekNumber
  const targetSheet = await prisma.bakeryWeeklySheet.findFirst({
    where: { sheetName: weekName },
  });

  let weekNumber: number | null = null;
  if (targetSheet) {
    // Get the organization's calendar year start
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { calendarYearStartMonth: true, calendarYearStartDay: true },
    });
    const startMonth = org?.calendarYearStartMonth ?? 1;
    const startDay = org?.calendarYearStartDay ?? 1;
    const sheetStart = new Date(targetSheet.weekStart);
    const currentYear = sheetStart.getFullYear();

    let yearStart = new Date(currentYear, startMonth - 1, startDay);
    if (yearStart > sheetStart) {
      yearStart = new Date(currentYear - 1, startMonth - 1, startDay);
    }

    // Count how many sheets come before this one (same logic as operations/weeks endpoint)
    const sheetsBeforeCount = await prisma.bakeryWeeklySheet.count({
      where: {
        isActive: true,
        weekStart: { gte: yearStart, lt: targetSheet.weekStart },
      },
    });
    weekNumber = sheetsBeforeCount + 1;
  }

  // Current day issues: match by weekNumber + dayOfWeekId, or by creation date range
  const currentDayIssues = await prisma.machineIssue.findMany({
    where: {
      organizationId,
      ...(weekNumber && dayOfWeekIds.length > 0
        ? { weekNumber, dayOfWeekId: { in: dayOfWeekIds } }
        : {}),
    },
    include: {
      Equipment: { select: { id: true, name: true, assetTag: true, manufacturer: true, model: true, photos: true } },
      Component: { select: { id: true, name: true, partNumber: true, manufacturer: true } },
      Line: { select: { id: true, name: true, lineNumber: true } },
      Shift: { select: { id: true, name: true } },
      Department: { select: { id: true, name: true } },
      ReportedBy: { select: { firstName: true, lastName: true } },
      DayOfWeek: { select: { dayName: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  // 4. Previous day issues (carry-over: issues from previous day that are still OPEN or IN_PROGRESS)
  const prevDayOfWeekIds = prevDay
    ? (await prisma.dayOfWeek.findMany({
        where: { organizationId, dayOrder: dayMapping[prevDay] || 0, isActive: true },
        select: { id: true },
      })).map(d => d.id)
    : [];

  const previousDayIssues = weekNumber && prevDayOfWeekIds.length > 0
    ? await prisma.machineIssue.findMany({
        where: {
          organizationId,
          weekNumber,
          dayOfWeekId: { in: prevDayOfWeekIds },
          status: { in: ['OPEN', 'IN_PROGRESS'] },
        },
        include: {
          Equipment: { select: { id: true, name: true, assetTag: true, manufacturer: true, model: true, photos: true } },
          Component: { select: { id: true, name: true, partNumber: true, manufacturer: true } },
          Line: { select: { id: true, name: true, lineNumber: true } },
          Shift: { select: { id: true, name: true } },
          Department: { select: { id: true, name: true } },
          ReportedBy: { select: { firstName: true, lastName: true } },
          DayOfWeek: { select: { dayName: true } },
        },
        orderBy: { createdAt: 'desc' },
      })
    : [];

  // 5. Format issues for AI prompt (no raw user text in prompt — only sanitized structured data)
  const formatIssue = (issue: any): IssueData => {
    const photos = (issue.photos as { url: string; name: string }[]) || [];
    return {
      issueNumber: issue.issueNumber,
      type: issue.type,
      title: sanitizeForPrompt(issue.title),
      description: sanitizeForPrompt(issue.description),
      priority: issue.priority,
      status: issue.status,
      startTime: issue.startTime || null,
      totalMinutesLost: issue.totalMinutesLost,
      equipment: issue.Equipment?.name || null,
      equipmentAssetTag: issue.Equipment?.assetTag || null,
      component: issue.Component?.name || null,
      line: issue.Line?.name || null,
      shift: issue.Shift?.name || null,
      department: issue.Department?.name || null,
      photoCount: photos.length,
      photoDescriptions: photos.map((p: any) => sanitizeForPrompt(p.name || 'photo')),
      reportedBy: `${issue.ReportedBy?.firstName || ''} ${issue.ReportedBy?.lastName || ''}`.trim(),
      createdAt: issue.createdAt.toISOString(),
    };
  };

  // 6. Get equipment data for machines mentioned in issues
  const equipmentIds = [...new Set([
    ...currentDayIssues.filter(i => i.equipmentId).map(i => i.equipmentId!),
    ...previousDayIssues.filter(i => i.equipmentId).map(i => i.equipmentId!),
  ])];

  const equipmentDetails = equipmentIds.length > 0
    ? await prisma.equipment.findMany({
        where: { id: { in: equipmentIds } },
        select: {
          id: true, name: true, assetTag: true, manufacturer: true, model: true,
          photos: true, status: true,
          Line: { select: { name: true, lineNumber: true } },
        },
      })
    : [];

  // 7. Get KPI targets
  const targetRows = await prisma.bakeryKpiTarget.findMany();
  const targets: Record<string, Record<string, number>> = {};
  for (const t of targetRows) {
    if (!targets[t.metricType]) targets[t.metricType] = {};
    targets[t.metricType][t.metricName] = Number(t.targetValue);
  }

  return {
    weekName,
    dayOfWeek,
    previousDay: prevDay,
    metrics: { firstShift, secondShift, bothShifts },
    previousDayMetrics: prevDayMetrics,
    currentDayIssues: currentDayIssues.map(formatIssue),
    previousDayCarryOverIssues: previousDayIssues.map(formatIssue),
    equipmentDetails: equipmentDetails.map(eq => ({
      name: eq.name,
      assetTag: eq.assetTag,
      manufacturer: eq.manufacturer,
      model: eq.model,
      status: eq.status,
      line: eq.Line?.name,
      photoCount: ((eq.photos as any[]) || []).length,
    })),
    targets,
    hasData: !!submission,
  };
}

// ─── Sanitization (strip injection attempts) ────────────────────────────────
function sanitizeForPrompt(text: string): string {
  if (!text) return '';
  // Remove any attempt at prompt injection patterns
  return text
    .replace(/```/g, '')
    .replace(/\{system\}/gi, '')
    .replace(/\{user\}/gi, '')
    .replace(/\{assistant\}/gi, '')
    .replace(/ignore previous instructions/gi, '')
    .replace(/ignore all previous/gi, '')
    .replace(/you are now/gi, '')
    .replace(/act as/gi, '')
    .replace(/pretend to be/gi, '')
    .replace(/new instructions:/gi, '')
    .replace(/system prompt:/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, 500); // Cap field length
}

// ─── Prompt Builder ─────────────────────────────────────────────────────────
function buildDailyReportPrompt(data: Awaited<ReturnType<typeof collectDailyData>>): string {
  const { metrics, previousDayMetrics, currentDayIssues, previousDayCarryOverIssues, equipmentDetails, targets } = data;

  const oeeTarget = targets['oee']?.['total'] || 85;
  const wasteTarget = targets['waste']?.['total'] || 3;

  let prompt = `You are the Director of Operations preparing a formal daily production report for a Level 3 organizational review meeting. This report will be presented to the VP of Operations, Plant Manager, Quality Manager, Maintenance Manager, and Production Supervisors.

Write with authority and precision. Present the data like an experienced operations leader — confident, thorough, and actionable. Every section should demonstrate command of the numbers, identify root causes, and provide clear direction. Use specific percentages, exact pound figures, and concrete comparisons. Do NOT use filler phrases, hedging language, or generic observations. Every sentence must add value.

═══ FACILITY: BAKERY PRODUCTION OPERATIONS ═══
Report Period: ${data.dayOfWeek}, Week ${data.weekName}
KPI Targets: OEE ≥ ${oeeTarget}% | Waste ≤ ${wasteTarget}%

═══ ${data.dayOfWeek.toUpperCase()} — PRODUCTION METRICS ═══
`;

  if (metrics.firstShift) {
    const fs = metrics.firstShift;
    prompt += `
FIRST SHIFT (Shift A):
  Die Cut 1: OEE ${fs.dieCut1OeePct}% | Production ${fs.dieCut1Lbs.toLocaleString()} lbs | Waste ${fs.dieCut1WasteLb.toLocaleString()} lbs (${fs.dieCut1WastePct}%)
  Die Cut 2: OEE ${fs.dieCut2OeePct}% | Production ${fs.dieCut2Lbs.toLocaleString()} lbs | Waste ${fs.dieCut2WasteLb.toLocaleString()} lbs (${fs.dieCut2WastePct}%)
  Combined:  OEE ${fs.oeeAvgPct}% | Production ${fs.poundsTotal.toLocaleString()} lbs | Waste Avg ${fs.wasteAvgPct}%
`;
  } else {
    prompt += `\nFIRST SHIFT: No data submitted\n`;
  }

  if (metrics.secondShift) {
    const ss = metrics.secondShift;
    prompt += `
SECOND SHIFT (Shift B):
  Die Cut 1: OEE ${ss.dieCut1OeePct}% | Production ${ss.dieCut1Lbs.toLocaleString()} lbs | Waste ${ss.dieCut1WasteLb.toLocaleString()} lbs (${ss.dieCut1WastePct}%)
  Die Cut 2: OEE ${ss.dieCut2OeePct}% | Production ${ss.dieCut2Lbs.toLocaleString()} lbs | Waste ${ss.dieCut2WasteLb.toLocaleString()} lbs (${ss.dieCut2WastePct}%)
  Combined:  OEE ${ss.oeeAvgPct}% | Production ${ss.poundsTotal.toLocaleString()} lbs | Waste Avg ${ss.wasteAvgPct}%
`;
  } else {
    prompt += `\nSECOND SHIFT: No data submitted\n`;
  }

  if (metrics.bothShifts) {
    const bs = metrics.bothShifts;
    prompt += `
BOTH SHIFTS COMBINED (Full Day):
  Die Cut 1: OEE ${bs.dieCut1OeePct}% | Production ${bs.dieCut1Lbs.toLocaleString()} lbs | Waste ${bs.dieCut1WasteLb.toLocaleString()} lbs (${bs.dieCut1WastePct}%)
  Die Cut 2: OEE ${bs.dieCut2OeePct}% | Production ${bs.dieCut2Lbs.toLocaleString()} lbs | Waste ${bs.dieCut2WasteLb.toLocaleString()} lbs (${bs.dieCut2WastePct}%)
  Combined:  OEE ${bs.oeeAvgPct}% | Production ${bs.poundsTotal.toLocaleString()} lbs | Waste Avg ${bs.wasteAvgPct}%
`;
  }

  // Previous day comparison
  if (previousDayMetrics) {
    prompt += `\n═══ PREVIOUS DAY (${data.previousDay}) — BASELINE FOR COMPARISON ═══\n`;
    if (previousDayMetrics.firstShift) {
      const pf = previousDayMetrics.firstShift;
      prompt += `  1st Shift: OEE ${pf.oeeAvgPct}% | Production ${pf.poundsTotal.toLocaleString()} lbs | Waste ${pf.wasteAvgPct}%\n`;
    }
    if (previousDayMetrics.secondShift) {
      const ps = previousDayMetrics.secondShift;
      prompt += `  2nd Shift: OEE ${ps.oeeAvgPct}% | Production ${ps.poundsTotal.toLocaleString()} lbs | Waste ${ps.wasteAvgPct}%\n`;
    }
    if (previousDayMetrics.bothShifts) {
      const pb = previousDayMetrics.bothShifts;
      prompt += `  Combined:  OEE ${pb.oeeAvgPct}% | Production ${pb.poundsTotal.toLocaleString()} lbs | Waste ${pb.wasteAvgPct}%\n`;
    }
  }

  // Current day issues
  if (currentDayIssues.length > 0) {
    prompt += `\n═══ ISSUES REPORTED TODAY (${currentDayIssues.length}) ═══\n`;
    currentDayIssues.forEach((issue, i) => {
      prompt += `
Issue ${i + 1}: [${issue.issueNumber}] ${issue.title}
  Type: ${issue.type} | Priority: ${issue.priority} | Status: ${issue.status}
  Description: ${issue.description}
  Equipment: ${issue.equipment || 'N/A'}${issue.equipmentAssetTag ? ` [${issue.equipmentAssetTag}]` : ''} | Component: ${issue.component || 'N/A'}
  Line: ${issue.line || 'N/A'} | Shift: ${issue.shift || 'N/A'} | Dept: ${issue.department || 'N/A'}
  Start Time: ${issue.startTime || 'N/A'} | Minutes Lost: ${issue.totalMinutesLost ?? 'N/A'}
  Photos: ${issue.photoCount} attached${issue.photoDescriptions.length > 0 ? ` (${issue.photoDescriptions.join(', ')})` : ''}
  Reported by: ${issue.reportedBy} at ${issue.createdAt}
`;
    });
  } else {
    prompt += `\n═══ NO ISSUES REPORTED TODAY ═══\n`;
  }

  // Previous day carry-over issues
  if (previousDayCarryOverIssues.length > 0) {
    prompt += `\n═══ CARRY-OVER ISSUES FROM ${(data.previousDay || 'PREVIOUS DAY').toUpperCase()} (${previousDayCarryOverIssues.length}) ═══\n`;
    previousDayCarryOverIssues.forEach((issue, i) => {
      prompt += `
Carry-Over ${i + 1}: [${issue.issueNumber}] ${issue.title}
  Type: ${issue.type} | Priority: ${issue.priority} | Status: ${issue.status}
  Description: ${issue.description}
  Equipment: ${issue.equipment || 'N/A'} | Component: ${issue.component || 'N/A'}
  Minutes Lost: ${issue.totalMinutesLost ?? 'N/A'}
`;
    });
  }

  // Equipment context
  if (equipmentDetails.length > 0) {
    prompt += `\n═══ EQUIPMENT DATABASE CONTEXT ═══\n`;
    equipmentDetails.forEach(eq => {
      prompt += `  ${eq.name}${eq.assetTag ? ` [${eq.assetTag}]` : ''} — ${eq.manufacturer || 'Unknown'} ${eq.model || ''} | Status: ${eq.status} | Line: ${eq.line || 'N/A'} | ${eq.photoCount} reference photos\n`;
    });
  }

  prompt += `
═══ RESPONSE FORMAT ═══
Respond with ONLY valid JSON (no markdown, no code fences). The report must follow a formal management presentation structure — the kind presented at a Level 3 organizational review. Each section must be thorough, data-driven, and provide actionable insight.

{
  "reportTitle": "Operational Daily Report — ${data.dayOfWeek}, ${data.weekName}",
  "executiveSummary": {
    "opening": "<1-2 sentence high-level overview of the day's performance>",
    "keyMetrics": "<2-3 sentences covering OEE, production output, and waste vs targets with exact numbers>",
    "issueHighlight": "<1-2 sentences on issues/downtime impact, or confirm clean operations>",
    "outlook": "<1 sentence forward-looking statement>"
  },
  "oeeAnalysis": {
    "overallStatus": "<on_target|below_target|critical>",
    "narrative": "<3-5 sentence thorough analysis of OEE performance. Compare to target (${oeeTarget}%), explain what drove performance up or down, identify which machine/shift was the bottleneck, and what specifically needs attention. Write like a plant manager explaining to executives.>",
    "dieCut1": {
      "firstShift": <number or null>,
      "secondShift": <number or null>,
      "combined": <number or null>,
      "assessment": "<2-3 sentences with specific analysis>"
    },
    "dieCut2": {
      "firstShift": <number or null>,
      "secondShift": <number or null>,
      "combined": <number or null>,
      "assessment": "<2-3 sentences with specific analysis>"
    },
    "overall": {
      "firstShift": <number or null>,
      "secondShift": <number or null>,
      "combined": <number or null>
    },
    "target": ${oeeTarget},
    "gapAnalysis": "<2 sentences explaining the gap to target, or how much above target>"
  },
  "wasteAnalysis": {
    "overallStatus": "<on_target|below_target|critical>",
    "narrative": "<3-5 sentence thorough analysis. Compare waste % to target (${wasteTarget}%), explain contributing factors per machine, identify shift-level differences, recommend specific corrective actions.>",
    "dieCut1": {
      "firstShift": { "wastePct": <number>, "wasteLbs": <number> },
      "secondShift": { "wastePct": <number>, "wasteLbs": <number> },
      "combined": { "wastePct": <number>, "wasteLbs": <number> },
      "assessment": "<2-3 sentences>"
    },
    "dieCut2": {
      "firstShift": { "wastePct": <number>, "wasteLbs": <number> },
      "secondShift": { "wastePct": <number>, "wasteLbs": <number> },
      "combined": { "wastePct": <number>, "wasteLbs": <number> },
      "assessment": "<2-3 sentences>"
    },
    "totalWasteLbs": <number>,
    "totalWastePct": <number>,
    "target": ${wasteTarget}
  },
  "productionOutput": {
    "narrative": "<3-4 sentences covering total output, machine-level contribution, shift-level breakdown, and comparison to previous day with exact numbers and % change>",
    "totalPounds": <number>,
    "dieCut1": { "firstShift": <number>, "secondShift": <number>, "total": <number> },
    "dieCut2": { "firstShift": <number>, "secondShift": <number>, "total": <number> },
    "previousDayTotal": <number or null>,
    "dayOverDayChange": "<+X.XX% | -X.XX% | N/A>",
    "comparisonToPreviousDay": "<improved|declined|stable|no_data>"
  },
  "shiftPerformance": {
    "narrative": "<3-4 sentences providing a thorough shift-by-shift comparison. Cover OEE, production, waste. Identify which shift performed better and why. Provide specific numbers.>",
    "firstShift": {
      "oee": <number or null>,
      "production": <number>,
      "wastePct": <number>,
      "strengths": "<1-2 specific strengths>",
      "concerns": "<1-2 specific concerns or 'None identified'>"
    },
    "secondShift": {
      "oee": <number or null>,
      "production": <number>,
      "wastePct": <number>,
      "strengths": "<1-2 specific strengths>",
      "concerns": "<1-2 specific concerns or 'None identified'>"
    },
    "betterShift": "<first|second|equal>",
    "shiftGap": "<describe the performance gap between shifts>"
  },
  "issueAnalysis": {
    "totalIssuesToday": <number>,
    "carryOverCount": <number>,
    "resolvedCount": <number>,
    "totalMinutesLost": <number>,
    "narrative": "<3-5 sentences providing a thorough analysis of the day's issue landscape. Cover severity distribution, downtime impact on OEE, equipment patterns, and whether carry-overs are being addressed.>",
    "criticalIssues": [
      {
        "issueNumber": "<string>",
        "title": "<string>",
        "priority": "<string>",
        "status": "<string>",
        "equipment": "<string or null>",
        "minutesLost": <number or null>,
        "rootCauseAssessment": "<2-3 sentence root cause analysis>",
        "productionImpact": "<specific impact on production metrics>",
        "recommendedAction": "<specific, actionable corrective action>",
        "timeframe": "<immediate|today|this_week>"
      }
    ],
    "equipmentCorrelation": "<2-3 sentences identifying equipment failure patterns and reliability concerns>",
    "downtimeImpact": "<1-2 sentences quantifying how downtime affected OEE and production>"
  },
  "previousDayComparison": {
    "narrative": "<3-4 sentences providing a thorough day-over-day comparison covering all key metrics with exact delta values>",
    "oeeChange": { "direction": "<up|down|flat|no_data>", "delta": <number or null>, "detail": "<string>" },
    "wasteChange": { "direction": "<up|down|flat|no_data>", "delta": <number or null>, "detail": "<string>" },
    "productionChange": { "direction": "<up|down|flat|no_data>", "delta": <number or null>, "detail": "<string>" }
  },
  "recommendations": [
    {
      "priority": "<high|medium|low>",
      "category": "<oee|waste|equipment|process|staffing|quality>",
      "title": "<short, action-oriented title>",
      "description": "<2-3 sentences with specific, actionable steps — no vague advice>",
      "expectedImpact": "<quantified expected improvement>",
      "owner": "<Maintenance|Production|Quality|Engineering|Management>",
      "timeframe": "<immediate|today|this_week|this_month>"
    }
  ],
  "overallAssessment": {
    "grade": "<A|B|C|D|F>",
    "gradeLabel": "<Excellent|Good|Satisfactory|Needs Improvement|Critical>",
    "scoreBreakdown": {
      "oeeScore": <1-10>,
      "wasteScore": <1-10>,
      "productionScore": <1-10>,
      "issueManagementScore": <1-10>
    },
    "closingStatement": "<3-4 sentence closing summary written as a plant manager would deliver it at a daily standup. Acknowledge what went well, call out what needs immediate attention, and set expectations for the next shift/day.>"
  }
}

IMPORTANT:
- Populate ALL number fields from the actual data. Do not make up numbers.
- Each "narrative" field must be thorough — 3-5 sentences minimum with specific data points.
- If waste data is per-shift, extract from the shift metrics. If not available for a shift, use null.
- For waste data: use the actual submitted values (dieCut1WastePct, dieCut2WastePct, dieCut1WasteLb, dieCut2WasteLb).
- For recommendations, provide at least 3 and at most 6, each owned by a specific department.
- The report should read like it was written by an experienced operations director, not an AI.`;

  return prompt;
}

// ─── Main Generator ─────────────────────────────────────────────────────────
export async function generateOperationalDailyReport(
  weekName: string,
  dayOfWeek: string,
  organizationId: string
) {
  // Strict input validation
  if (!validateWeekName(weekName)) {
    return { success: false, error: 'Invalid week name format.' };
  }
  if (!validateDayOfWeek(dayOfWeek)) {
    return { success: false, error: 'Invalid day. Must be Monday through Sunday.' };
  }

  // Verify week exists in database
  const weekExists = await prisma.bakeryWeeklySheet.findFirst({
    where: { sheetName: weekName },
  });
  if (!weekExists) {
    return { success: false, error: 'Selected week not found in the system.' };
  }

  const client = getOpenAI();
  if (!client) {
    return { success: false, error: 'AI service is not configured. Contact your administrator.' };
  }

  // Collect all data
  const data = await collectDailyData(weekName, dayOfWeek, organizationId);

  if (!data.hasData && data.currentDayIssues.length === 0 && data.previousDayCarryOverIssues.length === 0) {
    return {
      success: false,
      error: `No production data or issues found for ${dayOfWeek} (${weekName}). Please submit metrics first.`,
    };
  }

  const prompt = buildDailyReportPrompt(data);
  const startTime = Date.now();

  try {
    const model = process.env.AI_MODEL || 'gpt-4o';
    console.log(`[OpsDailyReport] Generating report for ${dayOfWeek} (${weekName}) using ${model}...`);

    const response = await client.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: 'You are a senior Director of Operations at a bakery manufacturing facility. You write daily production reports for Level 3 organizational reviews attended by VPs and plant leadership. Your writing is authoritative, data-driven, and actionable. You never use filler phrases like "it is important to note", "as we can see", or "moving forward". You speak with the confidence of someone who has managed production floors for 20 years. Always respond with valid JSON only. No markdown. No code fences.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 6000,
      response_format: { type: 'json_object' },
    });

    const content = response.choices?.[0]?.message?.content;
    if (!content) throw new Error('Empty AI response');

    const parsed = JSON.parse(content);
    const durationMs = Date.now() - startTime;
    const tokenUsage = response.usage?.total_tokens || null;

    return {
      success: true,
      durationMs,
      tokenUsage,
      data: {
        ...parsed,
        _meta: {
          weekName,
          dayOfWeek,
          previousDay: data.previousDay,
          generatedAt: new Date().toISOString(),
          model,
          hasMetrics: data.hasData,
          currentIssueCount: data.currentDayIssues.length,
          carryOverIssueCount: data.previousDayCarryOverIssues.length,
        },
        _rawMetrics: {
          firstShift: data.metrics.firstShift,
          secondShift: data.metrics.secondShift,
          bothShifts: data.metrics.bothShifts,
        },
      },
    };
  } catch (err: any) {
    const durationMs = Date.now() - startTime;
    console.error('[OpsDailyReport] Error:', err.message);
    return {
      success: false,
      error: 'Failed to generate report. Please try again.',
      durationMs,
    };
  }
}

// ─── Get Saved Report from DB ───────────────────────────────────────────────
export async function getSavedDailyReport(
  weekName: string,
  dayOfWeek: string,
  organizationId: string,
) {
  if (!validateWeekName(weekName) || !validateDayOfWeek(dayOfWeek) || !organizationId) {
    return null;
  }

  const saved = await prisma.bakeryDailyReport.findUnique({
    where: {
      weekName_dayOfWeek: { weekName, dayOfWeek },
    },
  });

  if (!saved) return null;

  return {
    success: true,
    source: 'database' as const,
    data: {
      ...(saved.reportData as Record<string, unknown>),
      _meta: saved.metaData as Record<string, unknown>,
      _rawMetrics: saved.rawMetrics as Record<string, unknown>,
    },
    savedAt: saved.updatedAt.toISOString(),
    generatedBy: saved.generatedBy,
  };
}

// ─── Save Report to DB ──────────────────────────────────────────────────────
export async function saveDailyReport(
  weekName: string,
  dayOfWeek: string,
  organizationId: string,
  reportData: Record<string, unknown>,
  userId: string,
  userName: string,
  tokenUsage?: number | null,
  durationMs?: number | null,
) {
  const { _meta, _rawMetrics, ...coreReport } = reportData;

  const saved = await prisma.bakeryDailyReport.upsert({
    where: {
      weekName_dayOfWeek: { weekName, dayOfWeek },
    },
    create: {
      weekName,
      dayOfWeek,
      reportData: coreReport,
      rawMetrics: (_rawMetrics as Record<string, unknown>) || null,
      metaData: (_meta as Record<string, unknown>) || null,
      aiModel: ((_meta as Record<string, unknown>)?.model as string) || process.env.AI_MODEL || 'gpt-4o',
      tokenUsage: tokenUsage || null,
      durationMs: durationMs || null,
      generatedBy: userName,
      generatedByUserId: userId,
    },
    update: {
      reportData: coreReport,
      rawMetrics: (_rawMetrics as Record<string, unknown>) || null,
      metaData: (_meta as Record<string, unknown>) || null,
      aiModel: ((_meta as Record<string, unknown>)?.model as string) || process.env.AI_MODEL || 'gpt-4o',
      tokenUsage: tokenUsage || null,
      durationMs: durationMs || null,
      generatedBy: userName,
      generatedByUserId: userId,
    },
  });

  console.log(`[OpsDailyReport] Report saved for ${dayOfWeek} (${weekName}) by ${userName}`);
  return saved;
}
