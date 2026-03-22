/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * BAKERY AI INSIGHTS SERVICE — GPT-5 Powered Analytics Engine
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Collects comprehensive bakery metrics data from the database and sends it to
 * OpenAI GPT for deep, professional analysis. Returns structured JSON that the
 * frontend renders into an interactive insights dashboard.
 *
 * Data collected:
 *   - Current week metrics (all days, both shifts, per-machine)
 *   - Previous 4 weeks for trend analysis
 *   - Same week last year for YoY comparison
 *   - KPI targets from admin settings
 *   - Shift-level breakdowns (1st vs 2nd)
 *   - Machine-level breakdowns (DC1 vs DC2)
 */

import OpenAI from 'openai';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ─── OpenAI Client (lazy init) ──────────────────────────────────────────────
let openaiClient: OpenAI | null = null;

function getOpenAI(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) return null;
  if (openaiClient) return openaiClient;
  openaiClient = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    timeout: 300000, // 5 minutes for GPT-5 reasoning models
    maxRetries: 2,
  });
  return openaiClient;
}

// ─── Types ──────────────────────────────────────────────────────────────────
interface DayMetrics {
  day: string;
  oeeAvg: number;
  wasteAvg: number;
  dc1Oee: number;
  dc2Oee: number;
  dc1Waste: number;
  dc2Waste: number;
  production: number;
  firstShiftOee: number;
  secondShiftOee: number;
  firstShiftWaste: number;
  secondShiftWaste: number;
}

interface WeekSummary {
  weekName: string;
  weekStart: string;
  weekEnd: string;
  days: DayMetrics[];
  avgOee: number;
  avgWaste: number;
  avgProduction: number;
  dc1AvgOee: number;
  dc2AvgOee: number;
  dc1AvgWaste: number;
  dc2AvgWaste: number;
  firstShiftAvgOee: number;
  secondShiftAvgOee: number;
  daysWithData: number;
}

// ─── Data Collector ─────────────────────────────────────────────────────────
async function collectWeekData(weekName: string): Promise<WeekSummary | null> {
  const sheet = await prisma.bakeryWeeklySheet.findFirst({
    where: { sheetName: weekName },
  });
  if (!sheet) return null;

  const submissions = await prisma.bakeryWeekSubmission.findMany({
    where: { weekName },
    include: {
      firstShiftMetrics: true,
      secondShiftMetrics: true,
      bothShiftsMetrics: true,
    },
  });

  if (submissions.length === 0) return null;

  const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  const days: DayMetrics[] = [];

  for (const sub of submissions) {
    const bs = sub.bothShiftsMetrics;
    const fs = sub.firstShiftMetrics;
    const ss = sub.secondShiftMetrics;

    days.push({
      day: sub.dayOfWeek,
      oeeAvg: Number(bs?.oeeAvgPct ?? 0),
      wasteAvg: Number(bs?.wasteAvgPct ?? 0),
      dc1Oee: Number(bs?.dieCut1OeePct ?? 0),
      dc2Oee: Number(bs?.dieCut2OeePct ?? 0),
      dc1Waste: Number(bs?.dieCut1WastePct ?? 0),
      dc2Waste: Number(bs?.dieCut2WastePct ?? 0),
      production: Number(bs?.poundsTotal ?? 0),
      firstShiftOee: Number(fs?.oeeAvgPct ?? 0),
      secondShiftOee: Number(ss?.oeeAvgPct ?? 0),
      firstShiftWaste: Number(fs?.wasteAvgPct ?? 0),
      secondShiftWaste: Number(ss?.wasteAvgPct ?? 0),
    });
  }

  // Sort by day order
  days.sort((a, b) => dayOrder.indexOf(a.day) - dayOrder.indexOf(b.day));

  const withData = days.filter(d => d.oeeAvg > 0 || d.wasteAvg > 0);
  const avg = (arr: number[]) => {
    const valid = arr.filter(v => v > 0);
    return valid.length ? Math.round((valid.reduce((s, v) => s + v, 0) / valid.length) * 100) / 100 : 0;
  };

  return {
    weekName,
    weekStart: sheet.weekStart.toISOString().split('T')[0],
    weekEnd: sheet.weekEnd.toISOString().split('T')[0],
    days,
    avgOee: avg(days.map(d => d.oeeAvg)),
    avgWaste: avg(days.map(d => d.wasteAvg)),
    avgProduction: avg(days.map(d => d.production)),
    dc1AvgOee: avg(days.map(d => d.dc1Oee)),
    dc2AvgOee: avg(days.map(d => d.dc2Oee)),
    dc1AvgWaste: avg(days.map(d => d.dc1Waste)),
    dc2AvgWaste: avg(days.map(d => d.dc2Waste)),
    firstShiftAvgOee: avg(days.map(d => d.firstShiftOee)),
    secondShiftAvgOee: avg(days.map(d => d.secondShiftOee)),
    daysWithData: withData.length,
  };
}

// ─── Comprehensive Data Collector ───────────────────────────────────────────
async function collectAllData(weekName?: string) {
  // Get all weeks sorted descending
  const allSheets = await prisma.bakeryWeeklySheet.findMany({
    orderBy: { weekStart: 'desc' },
  });

  if (allSheets.length === 0) {
    return { currentWeek: null, previousWeeks: [], targets: null, totalWeeksInSystem: 0 };
  }

  // Determine current week
  let currentSheetName = weekName;
  if (!currentSheetName || currentSheetName === 'latest') {
    currentSheetName = allSheets[0].sheetName;
  }

  // Find index of current week
  const currentIdx = allSheets.findIndex(s => s.sheetName === currentSheetName);
  if (currentIdx === -1) {
    currentSheetName = allSheets[0].sheetName;
  }

  // Collect current week data
  const currentWeek = await collectWeekData(currentSheetName!);

  // Collect previous 4 weeks (for trend analysis)
  const previousWeeks: WeekSummary[] = [];
  const startIdx = Math.max(0, currentIdx === -1 ? 1 : currentIdx + 1);
  for (let i = startIdx; i < Math.min(startIdx + 4, allSheets.length); i++) {
    const weekData = await collectWeekData(allSheets[i].sheetName);
    if (weekData) previousWeeks.push(weekData);
  }

  // Try to find same week last year
  let sameWeekLastYear: WeekSummary | null = null;
  if (currentWeek) {
    const currentStart = new Date(currentWeek.weekStart);
    const lastYearStart = new Date(currentStart);
    lastYearStart.setFullYear(lastYearStart.getFullYear() - 1);
    // Find closest week to last year's date
    const lastYearSheet = allSheets.find(s => {
      const diff = Math.abs(s.weekStart.getTime() - lastYearStart.getTime());
      return diff < 7 * 24 * 60 * 60 * 1000; // within 7 days
    });
    if (lastYearSheet) {
      sameWeekLastYear = await collectWeekData(lastYearSheet.sheetName);
    }
  }

  // Get KPI targets
  const targetRows = await prisma.bakeryKpiTarget.findMany();
  const targets: any = {
    oee: { die_cut_1: 70, die_cut_2: 70, total: 70 },
    volume: { die_cut_1: 6000, die_cut_2: 6000, total: 12000 },
    waste: { die_cut_1: 3, die_cut_2: 3, total: 3 },
  };
  for (const t of targetRows) {
    if (targets[t.metricType] && t.metricName in targets[t.metricType]) {
      targets[t.metricType][t.metricName] = Number(t.targetValue);
    }
  }

  return {
    currentWeek,
    previousWeeks,
    sameWeekLastYear,
    targets,
    totalWeeksInSystem: allSheets.length,
  };
}

// ─── GPT-5 Prompt Builder ───────────────────────────────────────────────────
function buildPrompt(data: Awaited<ReturnType<typeof collectAllData>>): string {
  const { currentWeek, previousWeeks, sameWeekLastYear, targets } = data;

  let prompt = `You are an expert bakery production analyst and industrial engineering consultant. You have deep expertise in OEE (Overall Equipment Effectiveness), waste management, die-cut machine optimization, and shift performance analysis.

Analyze the following bakery production data and provide a comprehensive, professional analysis. Be specific with numbers, percentages, and comparisons. Reference actual data points. Provide actionable, detailed recommendations.

═══ KPI TARGETS (from admin settings) ═══
• OEE Target: ${targets.oee.total}% (DC1: ${targets.oee.die_cut_1}%, DC2: ${targets.oee.die_cut_2}%)
• Waste Target: ≤${targets.waste.total}% (DC1: ≤${targets.waste.die_cut_1}%, DC2: ≤${targets.waste.die_cut_2}%)
• Volume Target: ${targets.volume.total.toLocaleString()} lbs total (DC1: ${targets.volume.die_cut_1.toLocaleString()} lbs, DC2: ${targets.volume.die_cut_2.toLocaleString()} lbs)
• For OEE: higher is better (≥ target = good)
• For Waste: lower is better (≤ target = good)

═══ CURRENT WEEK: ${currentWeek?.weekName || 'N/A'} (${currentWeek?.weekStart} to ${currentWeek?.weekEnd}) ═══
${currentWeek ? `Days with data: ${currentWeek.daysWithData}/5
Overall Averages: OEE=${currentWeek.avgOee}%, Waste=${currentWeek.avgWaste}%, Production=${currentWeek.avgProduction.toLocaleString()} lbs/day
Machine Breakdown: DC1 OEE=${currentWeek.dc1AvgOee}%, DC2 OEE=${currentWeek.dc2AvgOee}%
Machine Waste: DC1 Waste=${currentWeek.dc1AvgWaste}%, DC2 Waste=${currentWeek.dc2AvgWaste}%
Shift Breakdown: 1st Shift OEE=${currentWeek.firstShiftAvgOee}%, 2nd Shift OEE=${currentWeek.secondShiftAvgOee}%

Day-by-day breakdown:
${currentWeek.days.map(d => `  ${d.day}: OEE=${d.oeeAvg}%, Waste=${d.wasteAvg}%, Prod=${d.production.toLocaleString()} lbs | DC1 OEE=${d.dc1Oee}% DC2 OEE=${d.dc2Oee}% | DC1 Waste=${d.dc1Waste}% DC2 Waste=${d.dc2Waste}% | 1st Shift OEE=${d.firstShiftOee}% 2nd Shift OEE=${d.secondShiftOee}% | 1st Waste=${d.firstShiftWaste}% 2nd Waste=${d.secondShiftWaste}%`).join('\n')}` : 'No data for current week.'}

═══ PREVIOUS WEEKS (trend data, most recent first) ═══
${previousWeeks.length > 0 ? previousWeeks.map(w =>
    `${w.weekName} (${w.weekStart} to ${w.weekEnd}): OEE=${w.avgOee}%, Waste=${w.avgWaste}%, Prod=${w.avgProduction.toLocaleString()} lbs/day, DC1 OEE=${w.dc1AvgOee}%, DC2 OEE=${w.dc2AvgOee}%, DC1 Waste=${w.dc1AvgWaste}%, DC2 Waste=${w.dc2AvgWaste}%, 1st Shift=${w.firstShiftAvgOee}%, 2nd Shift=${w.secondShiftAvgOee}%, ${w.daysWithData}/5 days`
  ).join('\n') : 'No previous week data available.'}

${sameWeekLastYear ? `═══ SAME WEEK LAST YEAR ═══
${sameWeekLastYear.weekName}: OEE=${sameWeekLastYear.avgOee}%, Waste=${sameWeekLastYear.avgWaste}%, Prod=${sameWeekLastYear.avgProduction.toLocaleString()} lbs/day` : ''}

═══ RESPONSE FORMAT ═══
Respond with ONLY valid JSON (no markdown, no code fences). Use this exact structure:

{
  "healthScore": <number 0-100 representing overall plant health>,
  "healthLabel": "<one of: Excellent|Good|Fair|Needs Attention|Critical>",
  "executiveSummary": "<2-3 sentence high-level summary of plant performance this week, referencing key numbers>",
  "oeeAnalysis": {
    "status": "<on_target|below_target|critical>",
    "summary": "<1-2 sentences about OEE performance with specific numbers>",
    "trend": "<improving|stable|declining>",
    "trendDetail": "<1 sentence explaining the trend vs previous weeks>"
  },
  "wasteAnalysis": {
    "status": "<on_target|above_target|critical>",
    "summary": "<1-2 sentences about waste performance with specific numbers>",
    "trend": "<improving|stable|declining>",
    "trendDetail": "<1 sentence explaining the trend>"
  },
  "machineAnalysis": {
    "dc1Status": "<strong|average|weak>",
    "dc2Status": "<strong|average|weak>",
    "summary": "<2 sentences comparing DC1 vs DC2 performance, identifying the weaker machine and why>",
    "imbalanceDetected": <boolean>,
    "imbalanceDetail": "<if imbalance, explain which machine and metric>"
  },
  "shiftAnalysis": {
    "firstShiftStatus": "<strong|average|weak>",
    "secondShiftStatus": "<strong|average|weak>",
    "summary": "<2 sentences comparing shift performance>",
    "gapDetected": <boolean>,
    "gapDetail": "<if gap, explain the difference>"
  },
  "keyInsights": [
    {
      "severity": "<critical|warning|positive|info>",
      "category": "<oee|waste|production|machine|shift|general>",
      "title": "<short title>",
      "description": "<detailed 2-3 sentence insight with specific numbers>",
      "impact": "<what this means for the operation>"
    }
  ],
  "recommendations": [
    {
      "priority": "<high|medium|low>",
      "category": "<maintenance|process|training|quality|scheduling>",
      "title": "<short actionable title>",
      "description": "<detailed 2-3 sentence recommendation>",
      "expectedImpact": "<what improvement to expect if implemented>",
      "timeframe": "<immediate|this_week|this_month>"
    }
  ],
  "followUps": [
    {
      "title": "<follow-up item title>",
      "description": "<what needs to be checked or done>",
      "dueDate": "<today|tomorrow|this_week|next_week>",
      "assignTo": "<production_manager|shift_lead|maintenance|quality>"
    }
  ],
  "weeklyComparison": {
    "oeeChange": <number, percentage change from last week>,
    "wasteChange": <number, percentage change from last week>,
    "productionChange": <number, percentage change from last week>,
    "summary": "<1-2 sentences comparing this week vs last week>"
  },
  "yearOverYear": ${sameWeekLastYear ? `{
    "available": true,
    "oeeChange": <number>,
    "wasteChange": <number>,
    "summary": "<1-2 sentences comparing to same week last year>"
  }` : `{
    "available": false,
    "summary": "Year-over-year data not yet available."
  }`},
  "dailyHighlights": {
    "bestDay": "<which day performed best and why>",
    "worstDay": "<which day performed worst and why>",
    "pattern": "<any daily pattern detected, e.g. Monday dip, end-of-week fatigue>"
  },
  "wasteReduction": {
    "currentLevel": <number, current avg waste %>,
    "targetLevel": <number, target waste %>,
    "topContributor": "<which machine/shift contributes most waste>",
    "rootCauseHypothesis": "<data-driven hypothesis for high waste>",
    "savingsEstimate": "<estimated savings if waste reduced to target>"
  }
}

Be thorough, data-driven, and professional. Reference ACTUAL numbers from the data provided. Do NOT fabricate data points. If data is missing for a metric, note it honestly. Provide at least 4-6 key insights and 3-5 recommendations.`;

  return prompt;
}

// ─── Main Analysis Function ─────────────────────────────────────────────────
export async function generateAiInsights(weekName?: string) {
  const data = await collectAllData(weekName);

  if (!data.currentWeek) {
    return {
      success: false,
      error: 'No data available for the selected week.',
      fallback: true,
      data: getEmptyResponse(),
    };
  }

  const client = getOpenAI();
  if (!client) {
    return {
      success: false,
      error: 'OpenAI API key not configured.',
      fallback: true,
      data: getEmptyResponse(),
    };
  }

  const prompt = buildPrompt(data);
  const startTime = Date.now();

  try {
    const model = process.env.AI_MODEL || 'gpt-4o';
    console.log(`[BakeryAI] Generating insights for ${data.currentWeek.weekName} using ${model}...`);

    const response = await client.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: 'You are a bakery production analytics AI. You analyze OEE, waste, machine performance, and shift data. Always respond with valid JSON only. No markdown. No code fences. Be specific, data-driven, and professional.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 4000,
      response_format: { type: 'json_object' },
    });

    const content = response.choices?.[0]?.message?.content;
    if (!content) throw new Error('Empty AI response');

    const parsed = JSON.parse(content);
    const durationMs = Date.now() - startTime;
    const tokenUsage = response.usage?.total_tokens || null;

    const metaData = {
      weekName: data.currentWeek.weekName,
      weekStart: data.currentWeek.weekStart,
      weekEnd: data.currentWeek.weekEnd,
      daysWithData: data.currentWeek.daysWithData,
      totalWeeksInSystem: data.totalWeeksInSystem,
      generatedAt: new Date().toISOString(),
      model,
    };

    const chartDataPayload = {
      currentWeek: data.currentWeek,
      previousWeeks: data.previousWeeks,
      targets: data.targets,
    };

    // Attach raw data for frontend charts
    return {
      success: true,
      durationMs,
      tokenUsage,
      data: {
        ...parsed,
        _meta: metaData,
        _chartData: chartDataPayload,
      },
    };
  } catch (err: any) {
    console.error('[BakeryAI] Error:', err.message);
    return {
      success: false,
      error: err.message,
      fallback: true,
      durationMs: Date.now() - startTime,
      data: getEmptyResponse(),
    };
  }
}

// ─── Get cached insight from database ───────────────────────────────────────
export async function getCachedInsight(weekName: string) {
  try {
    const cached = await prisma.bakeryAiInsight.findUnique({
      where: { weekName },
    });
    if (!cached) return null;

    return {
      success: true,
      cached: true,
      data: {
        ...(cached.insightData as any),
        _meta: {
          ...(cached.metaData as any),
          cachedAt: cached.updatedAt.toISOString(),
          generatedBy: cached.generatedBy,
        },
        _chartData: cached.chartData,
      },
    };
  } catch (err: any) {
    console.error('[BakeryAI] Cache lookup error:', err.message);
    return null;
  }
}

// ─── Save insight to database ───────────────────────────────────────────────
export async function saveInsight(
  weekName: string,
  result: any,
  userName: string,
  userId?: string,
  tokenUsage?: number | null,
  model?: string,
) {
  try {
    const { _meta, _chartData, ...insightData } = result.data;

    await prisma.bakeryAiInsight.upsert({
      where: { weekName },
      create: {
        weekName,
        insightData,
        chartData: _chartData || {},
        metaData: _meta || {},
        aiModel: model || _meta?.model || 'unknown',
        generatedBy: userName,
        generatedByUserId: userId || null,
        tokenUsage: tokenUsage || null,
      },
      update: {
        insightData,
        chartData: _chartData || {},
        metaData: _meta || {},
        aiModel: model || _meta?.model || 'unknown',
        generatedBy: userName,
        generatedByUserId: userId || null,
        tokenUsage: tokenUsage || null,
      },
    });
  } catch (err: any) {
    console.error('[BakeryAI] Save insight error:', err.message);
  }
}

// ─── Log insight action ─────────────────────────────────────────────────────
export async function logInsightAction(params: {
  weekName: string;
  action: 'GENERATED' | 'REGENERATED' | 'CACHE_HIT';
  userName: string;
  userId?: string;
  aiModel?: string;
  tokenUsage?: number | null;
  durationMs?: number | null;
  success?: boolean;
  errorMsg?: string;
  ipAddress?: string;
  userAgent?: string;
}) {
  try {
    await prisma.bakeryAiInsightLog.create({
      data: {
        weekName: params.weekName,
        action: params.action,
        userName: params.userName,
        userId: params.userId || null,
        aiModel: params.aiModel || null,
        tokenUsage: params.tokenUsage || null,
        durationMs: params.durationMs || null,
        success: params.success ?? true,
        errorMsg: params.errorMsg || null,
        ipAddress: params.ipAddress || null,
        userAgent: params.userAgent || null,
      },
    });
  } catch (err: any) {
    console.error('[BakeryAI] Log error:', err.message);
  }
}

// ─── Get insight logs ───────────────────────────────────────────────────────
export async function getInsightLogs(weekName?: string, limit = 50) {
  try {
    const where = weekName ? { weekName } : {};
    return await prisma.bakeryAiInsightLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  } catch (err: any) {
    console.error('[BakeryAI] Logs fetch error:', err.message);
    return [];
  }
}

function getEmptyResponse() {
  return {
    healthScore: 0,
    healthLabel: 'No Data',
    executiveSummary: 'Unable to generate insights. Please ensure data is available and the AI service is configured.',
    keyInsights: [],
    recommendations: [],
    followUps: [],
    _meta: { generatedAt: new Date().toISOString() },
  };
}

export default { generateAiInsights, getCachedInsight, saveInsight, logInsightAction, getInsightLogs };
