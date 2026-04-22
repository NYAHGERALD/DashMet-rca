/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * STANDUP MEETING REPORT SERVICE
 * ═══════════════════════════════════════════════════════════════════════════════
 * Generates a conversational, supervisor-style daily production briefing for
 * the bakery team's standup meeting. Uses the previous production day's data:
 *   - Mon  → previous Friday's data (prior week sheet)
 *   - Tue-Fri → previous day's data (same week sheet)
 *
 * Report is saved (per weekName + dayOfWeek) with supervisor comments.
 */

import OpenAI from 'openai';
import { PrismaClient } from '@prisma/client';
import bakeryMetricsService from './bakeryMetricsService';

const prisma = new PrismaClient();

// ─── OpenAI Client (singleton) ──────────────────────────────────────────────
let openaiClient: OpenAI | null = null;
function getOpenAI(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) return null;
  if (openaiClient) return openaiClient;
  openaiClient = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    timeout: 180000,
    maxRetries: 2,
  });
  return openaiClient;
}

// ─── Constants ──────────────────────────────────────────────────────────────
const VALID_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const WEEK_NAME_PATTERN = /^[A-Za-z0-9\s\-_()]{1,100}$/;

// ─── Date helpers ───────────────────────────────────────────────────────────
function fmtDate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${m}-${day}-${d.getFullYear()}`;
}

function getMonday(d: Date): Date {
  const date = new Date(d);
  const dow = date.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function getFriday(d: Date): Date {
  const monday = getMonday(d);
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  friday.setHours(0, 0, 0, 0);
  return friday;
}

/**
 * Compute the target production day given "today".
 *   - Monday → previous Friday (previous week)
 *   - Tuesday–Friday → previous weekday (same week)
 *   - Saturday → Friday (same week)
 *   - Sunday → Friday (previous week)
 */
export function computeTargetDay(today: Date = new Date()): {
  targetDate: Date;
  dayOfWeek: string;
  weekName: string;
  weekStart: Date;
  weekEnd: Date;
} {
  const dow = today.getDay(); // 0=Sun … 6=Sat
  const target = new Date(today);
  target.setHours(0, 0, 0, 0);

  if (dow === 1) {
    // Monday → previous Friday (3 days back)
    target.setDate(target.getDate() - 3);
  } else if (dow === 0) {
    // Sunday → previous Friday (2 days back)
    target.setDate(target.getDate() - 2);
  } else if (dow === 6) {
    // Saturday → Friday (1 day back)
    target.setDate(target.getDate() - 1);
  } else {
    // Tue-Fri → previous day
    target.setDate(target.getDate() - 1);
  }

  const dayOfWeek = VALID_DAYS[(target.getDay() + 6) % 7]; // Mon-index list
  const monday = getMonday(target);
  const friday = getFriday(target);
  const weekName = `${fmtDate(monday)}_${fmtDate(friday)}`;

  return {
    targetDate: target,
    dayOfWeek,
    weekName,
    weekStart: monday,
    weekEnd: friday,
  };
}

// ─── Data Collection ────────────────────────────────────────────────────────
// NOTE: Numbers MUST come from the same source that the Bakery Metrics table
// shows in its "Both Shifts" column — `bakeryMetricsService.getBothShiftsRecords`.
// This already includes the single-shift fallback (when only 1st or 2nd shift
// was submitted, its values flow into the Both-Shifts column). The AI must
// NEVER recompute averages — it just speaks the numbers it is given.
function numOrNull(n: any): number | null {
  if (n === null || n === undefined) return null;
  const v = Number(n);
  return Number.isFinite(v) ? v : null;
}

function sanitizeText(text: string): string {
  if (!text) return '';
  return text
    .replace(/```/g, '')
    .replace(/\{system\}|\{user\}|\{assistant\}/gi, '')
    .replace(/ignore (previous|all previous) instructions?/gi, '')
    .replace(/system prompt:/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, 500);
}

async function collectStandupData(weekName: string, dayOfWeek: string, organizationId: string) {
  // Pull the exact flattened row the UI table renders
  const flattenedRows = await bakeryMetricsService.getBothShiftsRecords({ week: weekName, day: dayOfWeek });
  const row: any = flattenedRows?.[0] ?? null;

  // ─── Compute Both-Shifts values the EXACT SAME WAY the UI table does ───
  // The table's "Both Shifts" column does NOT read from the stored
  // `bothShiftsMetrics` record. Instead, it combines 1st + 2nd shift values
  // per-line with these rules:
  //   - A value of 0 (or null/undefined) is treated as "did not run"
  //   - If one shift did not run on a line, use the other shift's value alone
  //   - Otherwise average (for %) or sum (for lbs)
  // We replicate that rule here so the standup numbers ALWAYS match the table.
  const isMissing = (v: any) => v === null || v === undefined || Number(v) === 0;

  const combineByLine = (
    fsVal: any,
    ssVal: any,
    fsDidNotRun: boolean,
    ssDidNotRun: boolean,
    mode: 'avg' | 'sum',
  ): number | null => {
    if (fsDidNotRun && ssDidNotRun) return null;
    if (fsDidNotRun) return isMissing(ssVal) ? null : Number(ssVal);
    if (ssDidNotRun) return isMissing(fsVal) ? null : Number(fsVal);
    if (isMissing(fsVal) || isMissing(ssVal)) return null;
    return mode === 'sum' ? Number(fsVal) + Number(ssVal) : (Number(fsVal) + Number(ssVal)) / 2;
  };

  const avg2 = (a: number | null, b: number | null): number | null => {
    if (a === null && b === null) return null;
    if (a === null) return b;
    if (b === null) return a;
    return (a + b) / 2;
  };
  const sum2 = (a: number | null, b: number | null): number | null => {
    if (a === null && b === null) return null;
    return (a ?? 0) + (b ?? 0);
  };

  let bothShifts: any = null;
  if (row) {
    // First-shift line states (0/null → missing; if all 3 KPIs missing → didNotRun)
    const fsL1DidNotRun =
      isMissing(row.first_shift_die_cut1_oee) &&
      isMissing(row.first_shift_die_cut1_lbs) &&
      isMissing(row.first_shift_die_cut1_waste_pct);
    const fsL2DidNotRun =
      isMissing(row.first_shift_die_cut2_oee) &&
      isMissing(row.first_shift_die_cut2_lbs) &&
      isMissing(row.first_shift_die_cut2_waste_pct);
    const ssL1DidNotRun =
      isMissing(row.second_shift_die_cut1_oee) &&
      isMissing(row.second_shift_die_cut1_lbs) &&
      isMissing(row.second_shift_die_cut1_waste_pct);
    const ssL2DidNotRun =
      isMissing(row.second_shift_die_cut2_oee) &&
      isMissing(row.second_shift_die_cut2_lbs) &&
      isMissing(row.second_shift_die_cut2_waste_pct);

    const bsL1Oee   = combineByLine(row.first_shift_die_cut1_oee,         row.second_shift_die_cut1_oee,         fsL1DidNotRun, ssL1DidNotRun, 'avg');
    const bsL2Oee   = combineByLine(row.first_shift_die_cut2_oee,         row.second_shift_die_cut2_oee,         fsL2DidNotRun, ssL2DidNotRun, 'avg');
    const bsL1Lbs   = combineByLine(row.first_shift_die_cut1_lbs,         row.second_shift_die_cut1_lbs,         fsL1DidNotRun, ssL1DidNotRun, 'sum');
    const bsL2Lbs   = combineByLine(row.first_shift_die_cut2_lbs,         row.second_shift_die_cut2_lbs,         fsL2DidNotRun, ssL2DidNotRun, 'sum');
    const bsL1Waste = combineByLine(row.first_shift_die_cut1_waste_pct,   row.second_shift_die_cut1_waste_pct,   fsL1DidNotRun, ssL1DidNotRun, 'avg');
    const bsL2Waste = combineByLine(row.first_shift_die_cut2_waste_pct,   row.second_shift_die_cut2_waste_pct,   fsL2DidNotRun, ssL2DidNotRun, 'avg');

    bothShifts = {
      dieCut1Oee: bsL1Oee,
      dieCut2Oee: bsL2Oee,
      oeeAvg: avg2(bsL1Oee, bsL2Oee),
      dieCut1Lbs: bsL1Lbs,
      dieCut2Lbs: bsL2Lbs,
      lbsTotal: sum2(bsL1Lbs, bsL2Lbs),
      dieCut1Waste: bsL1Waste,
      dieCut2Waste: bsL2Waste,
      wasteAvg: avg2(bsL1Waste, bsL2Waste),
      hasFirstShift: !!row.has_first_shift,
      hasSecondShift: !!row.has_second_shift,
    };
  }

  // Resolve dayOfWeek id & week number for issue lookup
  const dayMapping: Record<string, number> = { Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6, Sunday: 7 };
  const dayOrder = dayMapping[dayOfWeek] || 0;

  const dayOfWeekRecords = await prisma.dayOfWeek.findMany({
    where: { organizationId, dayOrder, isActive: true },
    select: { id: true },
  });
  const dayOfWeekIds = dayOfWeekRecords.map((d) => d.id);

  const targetSheet = await prisma.bakeryWeeklySheet.findFirst({
    where: { sheetName: weekName },
  });

  let weekNumber: number | null = null;
  if (targetSheet) {
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

    const sheetsBeforeCount = await prisma.bakeryWeeklySheet.count({
      where: {
        isActive: true,
        weekStart: { gte: yearStart, lt: targetSheet.weekStart },
      },
    });
    weekNumber = sheetsBeforeCount + 1;
  }

  // Issues for the target (production review) day
  const issues = weekNumber && dayOfWeekIds.length > 0
    ? await prisma.machineIssue.findMany({
        where: { organizationId, weekNumber, dayOfWeekId: { in: dayOfWeekIds } },
        include: {
          Equipment: { select: { name: true, assetTag: true } },
          Line: { select: { name: true } },
          Shift: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
      })
    : [];

  // ─── TODAY's startup issues (the day the standup is being held) ─────────
  // The standup runs TODAY (e.g. Tuesday) and reviews YESTERDAY's production
  // (e.g. Monday). "Today's Startup Indicators" MUST reflect issues filed for
  // today — not the production-review day.
  const today = new Date();
  const todayDowIndex = today.getDay() === 0 ? 7 : today.getDay(); // Sun=7, Mon=1…
  const todayDayName = VALID_DAYS[(todayDowIndex - 1) % 7];
  let todayIssues: any[] = [];
  if (todayDayName !== dayOfWeek) {
    const todayDowRecords = await prisma.dayOfWeek.findMany({
      where: { organizationId, dayOrder: todayDowIndex, isActive: true },
      select: { id: true },
    });
    const todayDowIds = todayDowRecords.map((d) => d.id);

    // Determine the week sheet that contains "today" (may differ from target week)
    const todayMidnight = new Date(today);
    todayMidnight.setHours(0, 0, 0, 0);
    const todaySheet = await prisma.bakeryWeeklySheet.findFirst({
      where: { weekStart: { lte: todayMidnight }, weekEnd: { gte: todayMidnight } },
    });

    let todayWeekNumber: number | null = null;
    if (todaySheet) {
      const org = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: { calendarYearStartMonth: true, calendarYearStartDay: true },
      });
      const startMonth = org?.calendarYearStartMonth ?? 1;
      const startDay = org?.calendarYearStartDay ?? 1;
      const sheetStart = new Date(todaySheet.weekStart);
      const currentYear = sheetStart.getFullYear();
      let yearStart = new Date(currentYear, startMonth - 1, startDay);
      if (yearStart > sheetStart) {
        yearStart = new Date(currentYear - 1, startMonth - 1, startDay);
      }
      const sheetsBeforeCount = await prisma.bakeryWeeklySheet.count({
        where: { isActive: true, weekStart: { gte: yearStart, lt: todaySheet.weekStart } },
      });
      todayWeekNumber = sheetsBeforeCount + 1;
    }

    if (todayWeekNumber && todayDowIds.length > 0) {
      todayIssues = await prisma.machineIssue.findMany({
        where: { organizationId, weekNumber: todayWeekNumber, dayOfWeekId: { in: todayDowIds } },
        include: {
          Equipment: { select: { name: true, assetTag: true } },
          Line: { select: { name: true } },
          Shift: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
    }
  }

  // KPI targets
  const targetRows = await prisma.bakeryKpiTarget.findMany();
  const targets: Record<string, Record<string, number>> = {};
  for (const t of targetRows) {
    if (!targets[t.metricType]) targets[t.metricType] = {};
    targets[t.metricType][t.metricName] = Number(t.targetValue);
  }

  const oeeTarget = targets['oee']?.['total'] ?? 74.6;
  const wasteTarget = targets['waste']?.['total'] ?? 3.0;
  const volumeTarget = targets['volume']?.['total'] ?? 12000;

  return {
    weekName,
    dayOfWeek,
    todayDayName,
    hasData: !!row,
    metrics: { bothShifts },
    issues: issues.map((i) => ({
      issueNumber: i.issueNumber,
      title: sanitizeText(i.title),
      description: sanitizeText(i.description),
      priority: i.priority,
      status: i.status,
      type: i.type,
      equipment: i.Equipment?.name || null,
      line: i.Line?.name || null,
      shift: i.Shift?.name || null,
      minutesLost: i.totalMinutesLost ?? null,
    })),
    todayIssues: todayIssues.map((i) => ({
      issueNumber: i.issueNumber,
      title: sanitizeText(i.title),
      description: sanitizeText(i.description),
      priority: i.priority,
      status: i.status,
      type: i.type,
      equipment: i.Equipment?.name || null,
      line: i.Line?.name || null,
      shift: i.Shift?.name || null,
      minutesLost: i.totalMinutesLost ?? null,
    })),
    targets: { oee: oeeTarget, waste: wasteTarget, volume: volumeTarget },
  };
}

// ─── Prompt Builder ─────────────────────────────────────────────────────────
function buildStandupPrompt(data: Awaited<ReturnType<typeof collectStandupData>>): string {
  const { metrics, issues, todayIssues, todayDayName, targets, dayOfWeek, weekName } = data;
  const bs = metrics.bothShifts;

  // Which shifts contributed to the Both-Shifts column (for the AI's context)
  let shiftNote = '';
  if (bs) {
    if (bs.hasFirstShift && bs.hasSecondShift) shiftNote = 'Both 1st and 2nd shift were submitted.';
    else if (bs.hasFirstShift) shiftNote = 'Only 1st shift was submitted — the numbers below reflect 1st shift only.';
    else if (bs.hasSecondShift) shiftNote = 'Only 2nd shift was submitted — the numbers below reflect 2nd shift only.';
    else shiftNote = 'No shift submissions yet.';
  }

  let prompt = `You are a bakery production supervisor delivering the morning standup meeting briefing to your team and management. Your tone is warm but professional — like a seasoned supervisor who knows the floor. Speak naturally, as if addressing the team in person. Be confident, conversational, and specific with the numbers.

═══ PRODUCTION DAY BRIEFING ═══
Day: ${dayOfWeek}
Week: ${weekName}
${shiftNote ? `Context: ${shiftNote}\n` : ''}
KPI TARGETS (fiscal year):
  OEE ≥ ${targets.oee}%
  Waste ≤ ${targets.waste}%
  Volume ≥ ${targets.volume.toLocaleString()} lbs

`;

  if (bs) {
    prompt += `═══ BOTH SHIFTS (AUTHORITATIVE — use these exact numbers) ═══
  OEE
    Die Cut 1: ${bs.dieCut1Oee ?? 'N/A'}%
    Die Cut 2: ${bs.dieCut2Oee ?? 'N/A'}%
    Average:   ${bs.oeeAvg ?? 'N/A'}%

  VOLUME (lbs)
    Die Cut 1: ${bs.dieCut1Lbs != null ? bs.dieCut1Lbs.toLocaleString() : 'N/A'} lbs
    Die Cut 2: ${bs.dieCut2Lbs != null ? bs.dieCut2Lbs.toLocaleString() : 'N/A'} lbs
    Total:     ${bs.lbsTotal != null ? bs.lbsTotal.toLocaleString() : 'N/A'} lbs

  WASTE
    Die Cut 1: ${bs.dieCut1Waste ?? 'N/A'}%
    Die Cut 2: ${bs.dieCut2Waste ?? 'N/A'}%
    Average:   ${bs.wasteAvg ?? 'N/A'}%
`;
  } else {
    prompt += `═══ COMBINED METRICS: No submitted data for ${dayOfWeek} ═══\n`;
  }

  if (issues.length > 0) {
    prompt += `\n═══ ISSUES REPORTED FOR ${dayOfWeek.toUpperCase()} (PRODUCTION DAY REVIEW) — ${issues.length} ═══\n`;
    issues.forEach((i, idx) => {
      prompt += `${idx + 1}. [${i.issueNumber}] ${i.title}
   Priority: ${i.priority} | Status: ${i.status} | Type: ${i.type}
   Line: ${i.line || 'N/A'} | Equipment: ${i.equipment || 'N/A'} | Shift: ${i.shift || 'N/A'}
   Minutes Lost: ${i.minutesLost ?? 'N/A'}
   Description: ${i.description}
`;
    });
  } else {
    prompt += `\n═══ ISSUES REPORTED FOR ${dayOfWeek.toUpperCase()}: None ═══\n`;
  }

  // Today's startup issues — distinct from production-day issues above.
  if (todayDayName && todayDayName !== dayOfWeek) {
    if (todayIssues.length > 0) {
      prompt += `\n═══ TODAY'S STARTUP ISSUES (${todayDayName.toUpperCase()} — ${todayIssues.length}) ═══\n`;
      prompt += `These were reported for TODAY (${todayDayName}) — use them for the "startupSection". They are NOT part of yesterday's production review.\n`;
      todayIssues.forEach((i, idx) => {
        prompt += `${idx + 1}. [${i.issueNumber}] ${i.title}
   Priority: ${i.priority} | Status: ${i.status} | Type: ${i.type}
   Line: ${i.line || 'N/A'} | Equipment: ${i.equipment || 'N/A'} | Shift: ${i.shift || 'N/A'}
   Minutes Lost: ${i.minutesLost ?? 'N/A'}
   Description: ${i.description}
`;
      });
    } else {
      prompt += `\n═══ TODAY'S STARTUP ISSUES (${todayDayName.toUpperCase()}): None ═══\n`;
    }
  }

  prompt += `
═══ STYLE & TONE REQUIREMENTS ═══
Write the report like a real supervisor speaking at a morning standup. Use natural, human phrasing. Examples of phrasing you can adapt (DO NOT copy verbatim):
  - "Let's dive into the performance for yesterday in the bakery."
  - "Great performance right there — we are well above target."
  - "This line did not perform as expected and had some challenges that we'll discuss shortly."
  - "Despite the challenges on Die Cut 2, we were able to recover with the strong performance from Die Cut 1."
  - "This is a good number, but not where we ultimately want to be."
  - "Our goal remains to push waste as low as possible."
  - "Looking at today's startup indicators: no major issues were reported at startup on both lines."

Adapt your tone to the actual numbers:
  - Strong performance → positive reinforcement, energetic
  - Weak performance → analytical and constructive, never harsh
  - Mixed → honest acknowledgment with a forward-looking angle

═══ OUTPUT FORMAT (strict JSON — no markdown, no code fences) ═══
{
  "opening": "<2-3 sentence friendly greeting that sets the stage for yesterday's review. Example style: 'Good morning team. Let's dive into the performance for yesterday...'>",
  "oeeSection": {
    "narrative": "<4-6 sentences walking through OEE. Start by stating the target (${targets.oee}%). Report Die Cut 1 with a quick assessment (above/below target, how strong). Report Die Cut 2 with its assessment. Close with the overall average and a comment that frames the day. Be specific with numbers.>",
    "dieCut1": ${bs?.dieCut1Oee ?? 'null'},
    "dieCut2": ${bs?.dieCut2Oee ?? 'null'},
    "average": ${bs?.oeeAvg ?? 'null'},
    "target": ${targets.oee},
    "tone": "<strong|mixed|weak>"
  },
  "volumeSection": {
    "narrative": "<3-5 sentences covering total production. Call out Die Cut 1 and Die Cut 2 individually in lbs, then the total. Compare to the volume target (${targets.volume.toLocaleString()} lbs). End with a short comment on what this means for the week.>",
    "dieCut1Lbs": ${bs?.dieCut1Lbs ?? 'null'},
    "dieCut2Lbs": ${bs?.dieCut2Lbs ?? 'null'},
    "totalLbs": ${bs?.lbsTotal ?? 'null'},
    "target": ${targets.volume},
    "tone": "<strong|mixed|weak>"
  },
  "wasteSection": {
    "narrative": "<3-5 sentences. State the average waste vs the target (${targets.waste}%). Comment on whether we're below or above, then per-line if there's a notable difference. Close with something forward-looking — our goal to keep pushing waste down.>",
    "averagePct": ${bs?.wasteAvg ?? 'null'},
    "dieCut1Pct": ${bs?.dieCut1Waste ?? 'null'},
    "dieCut2Pct": ${bs?.dieCut2Waste ?? 'null'},
    "target": ${targets.waste},
    "tone": "<strong|mixed|weak>"
  },
  "issuesSection": {
    "narrative": "<2-4 sentences transitioning into the issues. If there are no issues, say so warmly. If there are issues, acknowledge them and indicate we'll discuss as a team.>",
    "items": [
      {
        "title": "<short label — pull from issue title>",
        "summary": "<1-2 sentence plain-English description of the issue, its impact, and status. No raw jargon.>",
        "line": "<line name or null>",
        "priority": "<priority>",
        "minutesLost": <number or null>
      }
    ]
  },
  "startupSection": {
    "narrative": "<2-3 sentences about TODAY's startup indicators. If the 'TODAY'S STARTUP ISSUES' block above lists issues, you MUST acknowledge them here — name the line/equipment and a brief description. If it says 'None', affirm that both lines are running cleanly at startup today.>",
    "items": [
      {
        "line": "<line name or 'Both Lines'>",
        "note": "<short startup note — if today's startup issues exist, reference them here>"
      }
    ]
  },
  "closing": "<2-3 sentence closing — appreciative, team-focused, forward-looking. Invite the team to discuss action items.>",
  "overallSentiment": "<positive|mixed|cautious|concerned>"
}

CRITICAL:
  - Populate number fields from the actual data above. If a value is missing, use null.
  - DATA FIDELITY RULE: You MUST use the EXACT numbers provided in the "BOTH SHIFTS (AUTHORITATIVE)" block above — do NOT compute, average, round, or re-derive any value yourself. The numeric JSON fields (dieCut1, dieCut2, average, dieCut1Lbs, dieCut2Lbs, totalLbs, averagePct, dieCut1Pct, dieCut2Pct) must match those numbers byte-for-byte. Any number you speak in a narrative must also match the data block exactly.
  - Every narrative MUST sound like a human supervisor — NOT an AI. Contractions welcome ("we're", "that's", "let's"). No bullet-like stiffness in narratives.
  - DO NOT copy the example phrasing verbatim. Use it as tonal reference only.
  - Respond with ONLY the JSON object. No preface, no trailing text.`;

  return prompt;
}

// ─── Main Generator ─────────────────────────────────────────────────────────
export async function generateStandupReport(
  weekName: string,
  dayOfWeek: string,
  organizationId: string,
) {
  if (!WEEK_NAME_PATTERN.test(weekName)) {
    return { success: false as const, error: 'Invalid week name format.' };
  }
  if (!VALID_DAYS.includes(dayOfWeek)) {
    return { success: false as const, error: 'Invalid day of week.' };
  }

  const client = getOpenAI();
  if (!client) {
    return { success: false as const, error: 'AI service is not configured. Contact your administrator.' };
  }

  const data = await collectStandupData(weekName, dayOfWeek, organizationId);

  if (!data.hasData && data.issues.length === 0) {
    return {
      success: false as const,
      error: `No production data or issues found for ${dayOfWeek} (${weekName}). Nothing to summarize yet.`,
    };
  }

  const prompt = buildStandupPrompt(data);
  const startTime = Date.now();

  // Log the authoritative numbers so we can verify what the AI was given
  console.log('[StandupReport] Authoritative Both-Shifts data:', JSON.stringify(data.metrics.bothShifts, null, 2));
  console.log(`[StandupReport] Production-day issues (${data.dayOfWeek}): ${data.issues.length}`);
  console.log(`[StandupReport] Today's startup issues (${data.todayDayName}): ${data.todayIssues.length}`);
  if (data.todayIssues.length > 0) {
    console.log('[StandupReport] Today issues:', data.todayIssues.map((i) => `[${i.issueNumber}] ${i.title} (${i.line || '?'})`).join(', '));
  }

  try {
    const model = process.env.AI_MODEL || 'gpt-4o-mini';
    console.log(`[StandupReport] Generating for ${dayOfWeek} (${weekName}) using model ${model}...`);

    const response = await client.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content:
            'You are an experienced bakery production supervisor delivering a daily morning standup briefing. You speak naturally, like a real human on the production floor — warm, confident, specific with numbers, never robotic. You adapt your tone to the performance: positive when the team did well, analytical and constructive when there were misses. Always respond with valid JSON only, no markdown fences.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.55,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    });

    const content = response.choices?.[0]?.message?.content;
    if (!content) throw new Error('Empty AI response');

    const parsed = JSON.parse(content);
    const durationMs = Date.now() - startTime;
    const tokenUsage = response.usage?.total_tokens ?? null;
    console.log(`[StandupReport] Completed in ${durationMs}ms (${tokenUsage} tokens)`);

    // ─── POST-VALIDATION: Overwrite AI numeric fields with source of truth ───
    // The AI is only responsible for narrative text. Numbers ALWAYS come from
    // the Both-Shifts data block — never trust the model to echo them.
    const bs = data.metrics.bothShifts;
    if (bs) {
      if (parsed.oeeSection) {
        parsed.oeeSection.dieCut1 = bs.dieCut1Oee;
        parsed.oeeSection.dieCut2 = bs.dieCut2Oee;
        parsed.oeeSection.average = bs.oeeAvg;
        parsed.oeeSection.target = data.targets.oee;
      }
      if (parsed.volumeSection) {
        parsed.volumeSection.dieCut1Lbs = bs.dieCut1Lbs;
        parsed.volumeSection.dieCut2Lbs = bs.dieCut2Lbs;
        parsed.volumeSection.totalLbs = bs.lbsTotal;
        parsed.volumeSection.target = data.targets.volume;
      }
      if (parsed.wasteSection) {
        parsed.wasteSection.dieCut1Pct = bs.dieCut1Waste;
        parsed.wasteSection.dieCut2Pct = bs.dieCut2Waste;
        parsed.wasteSection.averagePct = bs.wasteAvg;
        parsed.wasteSection.target = data.targets.waste;
      }
    }

    console.log('[StandupReport] Final numeric fields (after override):', JSON.stringify({
      oee: { d1: parsed.oeeSection?.dieCut1, d2: parsed.oeeSection?.dieCut2, avg: parsed.oeeSection?.average },
      volume: { d1: parsed.volumeSection?.dieCut1Lbs, d2: parsed.volumeSection?.dieCut2Lbs, tot: parsed.volumeSection?.totalLbs },
      waste: { d1: parsed.wasteSection?.dieCut1Pct, d2: parsed.wasteSection?.dieCut2Pct, avg: parsed.wasteSection?.averagePct },
    }));

    return {
      success: true as const,
      durationMs,
      tokenUsage,
      data: {
        ...parsed,
        _meta: {
          weekName,
          dayOfWeek,
          generatedAt: new Date().toISOString(),
          model,
        },
        _rawMetrics: data.metrics,
      },
    };
  } catch (err: any) {
    const durationMs = Date.now() - startTime;
    console.error('[StandupReport] Error:', err.message);
    return {
      success: false as const,
      error: 'Failed to generate standup report. Please try again.',
      durationMs,
    };
  }
}

// ─── Read saved ─────────────────────────────────────────────────────────────
export async function getSavedStandupReport(weekName: string, dayOfWeek: string) {
  if (!WEEK_NAME_PATTERN.test(weekName) || !VALID_DAYS.includes(dayOfWeek)) return null;

  const saved = await prisma.bakeryStandupReport.findUnique({
    where: { weekName_dayOfWeek: { weekName, dayOfWeek } },
  });
  if (!saved) return null;

  // Always re-fetch live Both-Shifts data (same source the UI table uses) and
  // override saved numeric fields. This guarantees the report values ALWAYS
  // match the Bakery Metrics "Both Shifts" column — even for reports saved
  // before the override logic existed, or if shift data was edited afterward.
  const core = { ...(saved.reportData as Record<string, any>) };
  try {
    const liveRows = await bakeryMetricsService.getBothShiftsRecords({ week: weekName, day: dayOfWeek });
    const liveRow: any = liveRows?.[0] ?? null;

    // Replicate the UI table's Both-Shifts rule: 0 = "did not run",
    // fall back to the running shift if the other didn't run.
    const isMissing = (v: any) => v === null || v === undefined || Number(v) === 0;
    const combineByLine = (
      fsVal: any, ssVal: any, fsDnr: boolean, ssDnr: boolean, mode: 'avg' | 'sum',
    ): number | null => {
      if (fsDnr && ssDnr) return null;
      if (fsDnr) return isMissing(ssVal) ? null : Number(ssVal);
      if (ssDnr) return isMissing(fsVal) ? null : Number(fsVal);
      if (isMissing(fsVal) || isMissing(ssVal)) return null;
      return mode === 'sum' ? Number(fsVal) + Number(ssVal) : (Number(fsVal) + Number(ssVal)) / 2;
    };
    const avg2 = (a: number | null, b: number | null): number | null => {
      if (a === null && b === null) return null;
      if (a === null) return b; if (b === null) return a; return (a + b) / 2;
    };
    const sum2 = (a: number | null, b: number | null): number | null => {
      if (a === null && b === null) return null;
      return (a ?? 0) + (b ?? 0);
    };

    let liveBs: any = null;
    if (liveRow) {
      const r = liveRow;
      const fsL1Dnr = isMissing(r.first_shift_die_cut1_oee) && isMissing(r.first_shift_die_cut1_lbs) && isMissing(r.first_shift_die_cut1_waste_pct);
      const fsL2Dnr = isMissing(r.first_shift_die_cut2_oee) && isMissing(r.first_shift_die_cut2_lbs) && isMissing(r.first_shift_die_cut2_waste_pct);
      const ssL1Dnr = isMissing(r.second_shift_die_cut1_oee) && isMissing(r.second_shift_die_cut1_lbs) && isMissing(r.second_shift_die_cut1_waste_pct);
      const ssL2Dnr = isMissing(r.second_shift_die_cut2_oee) && isMissing(r.second_shift_die_cut2_lbs) && isMissing(r.second_shift_die_cut2_waste_pct);

      const l1Oee   = combineByLine(r.first_shift_die_cut1_oee,       r.second_shift_die_cut1_oee,       fsL1Dnr, ssL1Dnr, 'avg');
      const l2Oee   = combineByLine(r.first_shift_die_cut2_oee,       r.second_shift_die_cut2_oee,       fsL2Dnr, ssL2Dnr, 'avg');
      const l1Lbs   = combineByLine(r.first_shift_die_cut1_lbs,       r.second_shift_die_cut1_lbs,       fsL1Dnr, ssL1Dnr, 'sum');
      const l2Lbs   = combineByLine(r.first_shift_die_cut2_lbs,       r.second_shift_die_cut2_lbs,       fsL2Dnr, ssL2Dnr, 'sum');
      const l1Waste = combineByLine(r.first_shift_die_cut1_waste_pct, r.second_shift_die_cut1_waste_pct, fsL1Dnr, ssL1Dnr, 'avg');
      const l2Waste = combineByLine(r.first_shift_die_cut2_waste_pct, r.second_shift_die_cut2_waste_pct, fsL2Dnr, ssL2Dnr, 'avg');

      liveBs = {
        dieCut1Oee: l1Oee,
        dieCut2Oee: l2Oee,
        oeeAvg: avg2(l1Oee, l2Oee),
        dieCut1Lbs: l1Lbs,
        dieCut2Lbs: l2Lbs,
        lbsTotal: sum2(l1Lbs, l2Lbs),
        dieCut1Waste: l1Waste,
        dieCut2Waste: l2Waste,
        wasteAvg: avg2(l1Waste, l2Waste),
      };
    }

    console.log('[StandupReport][READ] Live Both-Shifts (UI rule) for override:', JSON.stringify(liveBs));

    if (liveBs) {
      if (core.oeeSection) {
        core.oeeSection = {
          ...core.oeeSection,
          dieCut1: liveBs.dieCut1Oee,
          dieCut2: liveBs.dieCut2Oee,
          average: liveBs.oeeAvg,
        };
      }
      if (core.volumeSection) {
        core.volumeSection = {
          ...core.volumeSection,
          dieCut1Lbs: liveBs.dieCut1Lbs,
          dieCut2Lbs: liveBs.dieCut2Lbs,
          totalLbs: liveBs.lbsTotal,
        };
      }
      if (core.wasteSection) {
        core.wasteSection = {
          ...core.wasteSection,
          dieCut1Pct: liveBs.dieCut1Waste,
          dieCut2Pct: liveBs.dieCut2Waste,
          averagePct: liveBs.wasteAvg,
        };
      }
    }
  } catch (err: any) {
    console.error('[StandupReport][READ] Failed to fetch live Both-Shifts for override:', err?.message);
  }

  return {
    success: true as const,
    source: 'database' as const,
    data: {
      ...core,
      _meta: saved.metaData as Record<string, unknown>,
      _rawMetrics: saved.rawMetrics as Record<string, unknown>,
    },
    supervisorComments: saved.supervisorComments ?? '',
    commentsUpdatedBy: saved.commentsUpdatedBy ?? null,
    commentsUpdatedAt: saved.commentsUpdatedAt?.toISOString() ?? null,
    savedAt: saved.updatedAt.toISOString(),
    generatedBy: saved.generatedBy,
    reportId: saved.id,
  };
}

// ─── Save report ────────────────────────────────────────────────────────────
export async function saveStandupReport(
  weekName: string,
  dayOfWeek: string,
  reportDate: Date,
  reportData: Record<string, unknown>,
  userId: string,
  userName: string,
  tokenUsage?: number | null,
  durationMs?: number | null,
) {
  const { _meta, _rawMetrics, ...core } = reportData;

  return prisma.bakeryStandupReport.upsert({
    where: { weekName_dayOfWeek: { weekName, dayOfWeek } },
    create: {
      weekName,
      dayOfWeek,
      reportDate,
      reportData: core,
      rawMetrics: (_rawMetrics as any) || null,
      metaData: (_meta as any) || null,
      aiModel: ((_meta as any)?.model as string) || process.env.AI_MODEL || 'gpt-4o',
      tokenUsage: tokenUsage ?? null,
      durationMs: durationMs ?? null,
      generatedBy: userName,
      generatedByUserId: userId,
    },
    update: {
      reportData: core,
      rawMetrics: (_rawMetrics as any) || null,
      metaData: (_meta as any) || null,
      aiModel: ((_meta as any)?.model as string) || process.env.AI_MODEL || 'gpt-4o',
      tokenUsage: tokenUsage ?? null,
      durationMs: durationMs ?? null,
      generatedBy: userName,
      generatedByUserId: userId,
    },
  });
}

// ─── Save supervisor comments ───────────────────────────────────────────────
export async function updateStandupComments(
  weekName: string,
  dayOfWeek: string,
  comments: string,
  userName: string,
) {
  if (!WEEK_NAME_PATTERN.test(weekName) || !VALID_DAYS.includes(dayOfWeek)) {
    return { success: false as const, error: 'Invalid week or day.' };
  }
  const trimmed = (comments || '').slice(0, 5000);

  const existing = await prisma.bakeryStandupReport.findUnique({
    where: { weekName_dayOfWeek: { weekName, dayOfWeek } },
  });
  if (!existing) {
    return { success: false as const, error: 'No standup report found for this day yet.' };
  }

  const updated = await prisma.bakeryStandupReport.update({
    where: { id: existing.id },
    data: {
      supervisorComments: trimmed,
      commentsUpdatedBy: userName,
      commentsUpdatedAt: new Date(),
    },
  });

  return {
    success: true as const,
    supervisorComments: updated.supervisorComments ?? '',
    commentsUpdatedBy: updated.commentsUpdatedBy,
    commentsUpdatedAt: updated.commentsUpdatedAt?.toISOString() ?? null,
  };
}

// ─── Delete a saved standup report ──────────────────────────────────────────
export async function deleteStandupReport(weekName: string, dayOfWeek: string) {
  if (!WEEK_NAME_PATTERN.test(weekName) || !VALID_DAYS.includes(dayOfWeek)) {
    return { success: false as const, error: 'Invalid week or day.' };
  }
  const existing = await prisma.bakeryStandupReport.findUnique({
    where: { weekName_dayOfWeek: { weekName, dayOfWeek } },
  });
  if (!existing) {
    return { success: false as const, error: 'No standup report found to delete.' };
  }
  await prisma.bakeryStandupReport.delete({ where: { id: existing.id } });
  return { success: true as const, deletedId: existing.id };
}
