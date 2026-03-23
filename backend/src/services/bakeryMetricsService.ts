import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ─── Types ──────────────────────────────────────────────────────────────────────
interface ShiftMetricsInput {
  weekSubmissionId: string;
  dieCut1OeePct: number;
  dieCut2OeePct: number;
  oeeAvgPct?: number;
  dieCut1Lbs: number;
  dieCut2Lbs: number;
  poundsTotal?: number;
  dieCut1WasteLb: number;
  dieCut2WasteLb: number;
  dieCut1WastePct?: number;
  dieCut2WastePct?: number;
  wasteAvgPct?: number;
  submittedBy: string;
}

const bakeryMetricsService = {

  // ═══════════════════════════════════════════════════════════════════════════
  // WEEK OPTIONS — unique week names from submissions
  // ═══════════════════════════════════════════════════════════════════════════
  async getWeekOptions() {
    const weeks = await prisma.bakeryWeekSubmission.findMany({
      select: { weekName: true },
      distinct: ['weekName'],
      orderBy: { createdAt: 'desc' },
    });

    const weekNames = weeks.map(w => w.weekName);
    return {
      weeks: weekNames,
      default_week: weekNames[0] || null,
    };
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // WEEKLY SHEETS
  // ═══════════════════════════════════════════════════════════════════════════
  async getWeeklySheets() {
    return prisma.bakeryWeeklySheet.findMany({
      orderBy: { weekStart: 'desc' },
    });
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // RECORDS — all week submissions with their shift metrics
  // ═══════════════════════════════════════════════════════════════════════════
  async getRecords(filters?: { week?: string; day?: string }) {
    const where: any = {};
    if (filters?.week) where.weekName = filters.week;
    if (filters?.day) where.dayOfWeek = filters.day;

    return prisma.bakeryWeekSubmission.findMany({
      where,
      include: {
        firstShiftMetrics: true,
        secondShiftMetrics: true,
        bothShiftsMetrics: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // BOTH-SHIFTS RECORDS — flattened for report table
  // ═══════════════════════════════════════════════════════════════════════════
  async getBothShiftsRecords(filters?: { week?: string; day?: string }) {
    const where: any = {};
    if (filters?.week) where.weekName = filters.week;
    if (filters?.day) where.dayOfWeek = filters.day;

    const submissions = await prisma.bakeryWeekSubmission.findMany({
      where,
      include: {
        firstShiftMetrics: true,
        secondShiftMetrics: true,
        bothShiftsMetrics: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Helper: compute total waste % from lbs when wasteAvgPct is null
    const computeWasteAvg = (shift: any): number | null => {
      if (!shift) return null;
      const avg = Number(shift.wasteAvgPct);
      if (avg && avg !== 0) return avg;
      // Derive from die-cut waste lbs / total lbs
      const totalLbs = Number(shift.dieCut1Lbs || 0) + Number(shift.dieCut2Lbs || 0);
      const totalWaste = Number(shift.dieCut1WasteLb || 0) + Number(shift.dieCut2WasteLb || 0);
      if (totalLbs > 0) return (totalWaste / totalLbs) * 100;
      return null;
    };

    // Flatten to the shape the frontend expects
    return submissions.map(s => {
      const fs = s.firstShiftMetrics;
      const ss = s.secondShiftMetrics;
      const bs = s.bothShiftsMetrics;

      // --- First shift values ---
      const fsOee1 = fs ? Number(fs.dieCut1OeePct) : null;
      const fsOee2 = fs ? Number(fs.dieCut2OeePct) : null;
      const fsOeeAvg = fs ? Number(fs.oeeAvgPct) : null;
      const fsLbs1 = fs ? Number(fs.dieCut1Lbs) : null;
      const fsLbs2 = fs ? Number(fs.dieCut2Lbs) : null;
      const fsProd = fs ? Number(fs.poundsTotal) : null;
      const fsWaste1 = fs ? Number(fs.dieCut1WastePct) : null;
      const fsWaste2 = fs ? Number(fs.dieCut2WastePct) : null;
      const fsWasteAvg = fs ? computeWasteAvg(fs) : null;

      // --- Second shift values ---
      const ssOee1 = ss ? Number(ss.dieCut1OeePct) : null;
      const ssOee2 = ss ? Number(ss.dieCut2OeePct) : null;
      const ssOeeAvg = ss ? Number(ss.oeeAvgPct) : null;
      const ssLbs1 = ss ? Number(ss.dieCut1Lbs) : null;
      const ssLbs2 = ss ? Number(ss.dieCut2Lbs) : null;
      const ssProd = ss ? Number(ss.poundsTotal) : null;
      const ssWaste1 = ss ? Number(ss.dieCut1WastePct) : null;
      const ssWaste2 = ss ? Number(ss.dieCut2WastePct) : null;
      const ssWasteAvg = ss ? computeWasteAvg(ss) : null;

      // --- Both shifts: use actual record if present, else fallback to whichever shift exists ---
      // When only one shift is submitted, show that shift's data in the "Both" column
      const bsOee1 = bs ? Number(bs.dieCut1OeePct) : (fsOee1 ?? ssOee1);
      const bsOee2 = bs ? Number(bs.dieCut2OeePct) : (fsOee2 ?? ssOee2);
      const bsOeeAvg = bs ? Number(bs.oeeAvgPct) : (fsOeeAvg ?? ssOeeAvg);
      const bsLbs1 = bs ? Number(bs.dieCut1Lbs) : (fsLbs1 ?? ssLbs1);
      const bsLbs2 = bs ? Number(bs.dieCut2Lbs) : (fsLbs2 ?? ssLbs2);
      const bsProd = bs ? Number(bs.poundsTotal) : (fsProd ?? ssProd);
      const bsWaste1 = bs ? Number(bs.dieCut1WastePct) : (fsWaste1 ?? ssWaste1);
      const bsWaste2 = bs ? Number(bs.dieCut2WastePct) : (fsWaste2 ?? ssWaste2);
      const bsWasteAvg = bs ? computeWasteAvg(bs) : (fsWasteAvg ?? ssWasteAvg);

      return {
        id: s.id,
        submission_date: s.createdAt,
        week_name: s.weekName,
        day_of_week: s.dayOfWeek,
        submitted_by: s.submittedBy,

        // First shift
        first_shift_die_cut1_oee: fsOee1,
        first_shift_die_cut2_oee: fsOee2,
        first_shift_oee: fsOeeAvg,
        first_shift_die_cut1_lbs: fsLbs1,
        first_shift_die_cut2_lbs: fsLbs2,
        first_shift_production: fsProd,
        first_shift_die_cut1_waste_pct: fsWaste1,
        first_shift_die_cut2_waste_pct: fsWaste2,
        first_shift_waste_percent: fsWasteAvg,

        // Second shift
        second_shift_die_cut1_oee: ssOee1,
        second_shift_die_cut2_oee: ssOee2,
        second_shift_oee: ssOeeAvg,
        second_shift_die_cut1_lbs: ssLbs1,
        second_shift_die_cut2_lbs: ssLbs2,
        second_shift_production: ssProd,
        second_shift_die_cut1_waste_pct: ssWaste1,
        second_shift_die_cut2_waste_pct: ssWaste2,
        second_shift_waste_percent: ssWasteAvg,

        // Both shifts (with fallback to available shift)
        both_shift_die_cut1_oee: bsOee1,
        both_shift_die_cut2_oee: bsOee2,
        total_oee: bsOeeAvg,
        both_shift_die_cut1_lbs: bsLbs1,
        both_shift_die_cut2_lbs: bsLbs2,
        total_production: bsProd,
        both_shift_die_cut1_waste_pct: bsWaste1,
        both_shift_die_cut2_waste_pct: bsWaste2,
        total_waste_percent: bsWasteAvg,

        // Flags so frontend knows which shifts have submitted data
        has_first_shift: !!fs,
        has_second_shift: !!ss,
      };
    });
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // SINGLE RECORD
  // ═══════════════════════════════════════════════════════════════════════════
  async getRecordById(id: string) {
    const s = await prisma.bakeryWeekSubmission.findUnique({
      where: { id },
      include: {
        firstShiftMetrics: true,
        secondShiftMetrics: true,
        bothShiftsMetrics: true,
      },
    });
    if (!s) return null;

    const fs = s.firstShiftMetrics;
    const ss = s.secondShiftMetrics;
    const bs = s.bothShiftsMetrics;

    return {
      id: s.id,
      submission_date: s.createdAt,
      week_name: s.weekName,
      day_of_week: s.dayOfWeek,
      submitted_by: s.submittedBy,
      first_shift_die_cut1_oee: fs ? Number(fs.dieCut1OeePct) : null,
      first_shift_die_cut2_oee: fs ? Number(fs.dieCut2OeePct) : null,
      first_shift_oee: fs ? Number(fs.oeeAvgPct) : null,
      first_shift_die_cut1_lbs: fs ? Number(fs.dieCut1Lbs) : null,
      first_shift_die_cut2_lbs: fs ? Number(fs.dieCut2Lbs) : null,
      first_shift_production: fs ? Number(fs.poundsTotal) : null,
      first_shift_die_cut1_waste_pct: fs ? Number(fs.dieCut1WastePct) : null,
      first_shift_die_cut2_waste_pct: fs ? Number(fs.dieCut2WastePct) : null,
      first_shift_waste_percent: fs ? Number(fs.wasteAvgPct) : null,
      second_shift_die_cut1_oee: ss ? Number(ss.dieCut1OeePct) : null,
      second_shift_die_cut2_oee: ss ? Number(ss.dieCut2OeePct) : null,
      second_shift_oee: ss ? Number(ss.oeeAvgPct) : null,
      second_shift_die_cut1_lbs: ss ? Number(ss.dieCut1Lbs) : null,
      second_shift_die_cut2_lbs: ss ? Number(ss.dieCut2Lbs) : null,
      second_shift_production: ss ? Number(ss.poundsTotal) : null,
      second_shift_die_cut1_waste_pct: ss ? Number(ss.dieCut1WastePct) : null,
      second_shift_die_cut2_waste_pct: ss ? Number(ss.dieCut2WastePct) : null,
      second_shift_waste_percent: ss ? Number(ss.wasteAvgPct) : null,
      both_shift_die_cut1_oee: bs ? Number(bs.dieCut1OeePct) : null,
      both_shift_die_cut2_oee: bs ? Number(bs.dieCut2OeePct) : null,
      total_oee: bs ? Number(bs.oeeAvgPct) : null,
      both_shift_die_cut1_lbs: bs ? Number(bs.dieCut1Lbs) : null,
      both_shift_die_cut2_lbs: bs ? Number(bs.dieCut2Lbs) : null,
      total_production: bs ? Number(bs.poundsTotal) : null,
      both_shift_die_cut1_waste_pct: bs ? Number(bs.dieCut1WastePct) : null,
      both_shift_die_cut2_waste_pct: bs ? Number(bs.dieCut2WastePct) : null,
      total_waste_percent: bs ? Number(bs.wasteAvgPct) : null,
    };
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // KPI TARGETS
  // ═══════════════════════════════════════════════════════════════════════════
  async getKpiTargets() {
    const targets = await prisma.bakeryKpiTarget.findMany();

    // Build the structured targets object the frontend expects
    const result: any = {
      oee: { die_cut_1: 70, die_cut_2: 70, total: 70 },
      volume: { die_cut_1: 6000, die_cut_2: 6000, total: 12000 },
      waste: { die_cut_1: 3, die_cut_2: 3, total: 3 },
    };

    for (const t of targets) {
      if (result[t.metricType] && t.metricName in result[t.metricType]) {
        result[t.metricType][t.metricName] = Number(t.targetValue);
      }
    }

    return result;
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // DASHBOARD METRICS — summary cards data
  // ═══════════════════════════════════════════════════════════════════════════
  async getDashboardMetrics(filters?: { week?: string; day?: string }) {
    const records = await this.getBothShiftsRecords(filters);
    if (records.length === 0) {
      return {
        oeeCurrentValue: 0,
        oeeStatus: 'No Data',
        oeeChange: 'N/A',
        oeeVsTarget: 'No data available',
        wasteCurrentValue: 0,
        wasteStatus: 'No Data',
        wasteChange: 'N/A',
        wasteVsTarget: 'No data available',
        productionCurrentValue: 0,
        productionStatus: 'No Data',
        productionChange: 'N/A',
        productionDailyOutput: 'No data available',
        efficiencyCurrentValue: 0,
        efficiencyStatus: 'No Data',
        efficiencyChange: 'N/A',
        efficiencyPerformanceIndex: 'No data available',
      };
    }

    const latest = records[0];
    const targets = await this.getKpiTargets();

    const oeeVal = latest.total_oee || 0;
    const wasteVal = latest.total_waste_percent || 0;
    const prodVal = latest.total_production || 0;

    // Calculate efficiency score (composite: OEE weight + waste weight + volume weight)
    const oeeScore = Math.min((oeeVal / targets.oee.total) * 10, 10);
    const wasteScore = Math.min((targets.waste.total / Math.max(wasteVal, 0.01)) * 10, 10);
    const volScore = Math.min((prodVal / targets.volume.total) * 10, 10);
    const effScore = (oeeScore * 0.4 + wasteScore * 0.3 + volScore * 0.3);

    return {
      oeeCurrentValue: oeeVal,
      oeeStatus: oeeVal >= targets.oee.total ? 'Target Met' : 'Below Target',
      oeeChange: `${oeeVal >= targets.oee.total ? '+' : ''}${(oeeVal - targets.oee.total).toFixed(1)}%`,
      oeeVsTarget: `vs target (${targets.oee.total}%)`,
      wasteCurrentValue: wasteVal,
      wasteStatus: wasteVal <= targets.waste.total ? 'Below Target' : 'Above Target',
      wasteChange: `${wasteVal <= targets.waste.total ? '-' : '+'}${Math.abs(wasteVal - targets.waste.total).toFixed(2)}%`,
      wasteVsTarget: `vs target (${targets.waste.total}%)`,
      productionCurrentValue: prodVal,
      productionStatus: prodVal >= targets.volume.total ? 'Above Target' : 'Below Target',
      productionChange: `${prodVal >= targets.volume.total ? '+' : '-'}${Math.abs(prodVal - targets.volume.total).toLocaleString()} lbs`,
      productionDailyOutput: 'daily output',
      efficiencyCurrentValue: parseFloat(effScore.toFixed(1)),
      efficiencyStatus: effScore >= 7 ? 'Good' : effScore >= 5 ? 'Fair' : 'Poor',
      efficiencyChange: 'Calculated',
      efficiencyPerformanceIndex: 'composite index',
    };
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // WEEK AVERAGE — calculate averages for all days in a week
  // ═══════════════════════════════════════════════════════════════════════════
  async getWeekAverage(weekName: string) {
    const records = await this.getBothShiftsRecords({ week: weekName });
    if (records.length === 0) return null;

    const avg = (arr: (number | null)[]) => {
      const valid = arr.filter((v): v is number => v !== null && v !== 0);
      if (valid.length === 0) return null;
      return valid.reduce((a, b) => a + b, 0) / valid.length;
    };

    return {
      period: weekName,
      days_count: records.length,
      averages: {
        oee: {
          die_cut_1: {
            first_shift: avg(records.map(r => r.first_shift_die_cut1_oee)),
            second_shift: avg(records.map(r => r.second_shift_die_cut1_oee)),
            both_shifts: avg(records.map(r => r.both_shift_die_cut1_oee)),
          },
          die_cut_2: {
            first_shift: avg(records.map(r => r.first_shift_die_cut2_oee)),
            second_shift: avg(records.map(r => r.second_shift_die_cut2_oee)),
            both_shifts: avg(records.map(r => r.both_shift_die_cut2_oee)),
          },
          total: {
            first_shift: avg(records.map(r => r.first_shift_oee)),
            second_shift: avg(records.map(r => r.second_shift_oee)),
            both_shifts: avg(records.map(r => r.total_oee)),
          },
        },
        volume: {
          die_cut_1: {
            first_shift: avg(records.map(r => r.first_shift_die_cut1_lbs)),
            second_shift: avg(records.map(r => r.second_shift_die_cut1_lbs)),
            both_shifts: avg(records.map(r => r.both_shift_die_cut1_lbs)),
          },
          die_cut_2: {
            first_shift: avg(records.map(r => r.first_shift_die_cut2_lbs)),
            second_shift: avg(records.map(r => r.second_shift_die_cut2_lbs)),
            both_shifts: avg(records.map(r => r.both_shift_die_cut2_lbs)),
          },
          total: {
            first_shift: avg(records.map(r => r.first_shift_production)),
            second_shift: avg(records.map(r => r.second_shift_production)),
            both_shifts: avg(records.map(r => r.total_production)),
          },
        },
        waste: {
          percentage: {
            die_cut_1: {
              first_shift: avg(records.map(r => r.first_shift_die_cut1_waste_pct)),
              second_shift: avg(records.map(r => r.second_shift_die_cut1_waste_pct)),
              both_shifts: avg(records.map(r => r.both_shift_die_cut1_waste_pct)),
            },
            die_cut_2: {
              first_shift: avg(records.map(r => r.first_shift_die_cut2_waste_pct)),
              second_shift: avg(records.map(r => r.second_shift_die_cut2_waste_pct)),
              both_shifts: avg(records.map(r => r.both_shift_die_cut2_waste_pct)),
            },
            total: {
              first_shift: avg(records.map(r => r.first_shift_waste_percent)),
              second_shift: avg(records.map(r => r.second_shift_waste_percent)),
              both_shifts: avg(records.map(r => r.total_waste_percent)),
            },
          },
        },
      },
    };
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // AI INSIGHTS (simple rule-based for now; can add OpenAI later)
  // ═══════════════════════════════════════════════════════════════════════════
  async getAiInsights(filters?: { week?: string; day?: string }) {
    const records = await this.getBothShiftsRecords(filters);
    const targets = await this.getKpiTargets();

    if (records.length === 0) {
      return {
        key_insights: [{ type: 'info', title: 'No Data Available', description: 'Submit metrics to see insights.' }],
        recommendations: [],
        action_items: [{ id: 'submit_data', title: 'Submit Metrics', description: 'Start by submitting bakery metrics for analysis.', priority: 'High', due: 'Today' }],
      };
    }

    const latest = records[0];
    const keyInsights: any[] = [];
    const recommendations: any[] = [];
    const actionItems: any[] = [];

    // OEE Analysis
    const oee = latest.total_oee || 0;
    if (oee >= targets.oee.total) {
      keyInsights.push({ type: 'success', title: 'OEE On Target', description: `Total OEE of ${oee.toFixed(1)}% meets the ${targets.oee.total}% target. Excellent equipment utilization.` });
    } else {
      keyInsights.push({ type: 'warning', title: 'OEE Below Target', description: `Total OEE of ${oee.toFixed(1)}% is ${(targets.oee.total - oee).toFixed(1)}% below the ${targets.oee.total}% target.` });
      recommendations.push({ type: 'high', title: 'Improve OEE', description: 'Review equipment downtime causes and implement preventive maintenance.', action: 'Start Analysis' });
      actionItems.push({ id: 'oee_review', title: 'Review OEE Root Causes', description: `Analyze why OEE is at ${oee.toFixed(1)}% and identify improvement areas.`, priority: 'High', due: 'This Week' });
    }

    // Die Cut comparison
    const dc1Oee = latest.both_shift_die_cut1_oee || 0;
    const dc2Oee = latest.both_shift_die_cut2_oee || 0;
    if (Math.abs(dc1Oee - dc2Oee) > 10) {
      const lower = dc1Oee < dc2Oee ? 'Die Cut 1' : 'Die Cut 2';
      const lowerVal = Math.min(dc1Oee, dc2Oee);
      keyInsights.push({ type: 'warning', title: 'OEE Imbalance Detected', description: `${lower} OEE (${lowerVal.toFixed(1)}%) is significantly lower than the other machine. Consider investigating.` });
    }

    // Waste Analysis
    const waste = latest.total_waste_percent || 0;
    if (waste <= targets.waste.total) {
      keyInsights.push({ type: 'success', title: 'Waste Under Control', description: `Waste of ${waste.toFixed(2)}% is within the ${targets.waste.total}% target. Good material management.` });
    } else {
      keyInsights.push({ type: 'error', title: 'Waste Exceeds Target', description: `Waste at ${waste.toFixed(2)}% exceeds the ${targets.waste.total}% target by ${(waste - targets.waste.total).toFixed(2)}%.` });
      recommendations.push({ type: 'high', title: 'Reduce Waste', description: 'Identify top waste contributors and implement corrective actions.', action: 'View Details' });
      actionItems.push({ id: 'waste_reduction', title: 'Waste Reduction Plan', description: `Develop plan to reduce waste from ${waste.toFixed(2)}% to under ${targets.waste.total}%.`, priority: 'High', due: 'This Week' });
    }

    // Volume Analysis
    const prod = latest.total_production || 0;
    if (prod >= targets.volume.total) {
      keyInsights.push({ type: 'success', title: 'Production Target Met', description: `Total production of ${prod.toLocaleString()} lbs meets the ${targets.volume.total.toLocaleString()} lbs target.` });
    } else {
      keyInsights.push({ type: 'warning', title: 'Production Below Target', description: `Production of ${prod.toLocaleString()} lbs is ${(targets.volume.total - prod).toLocaleString()} lbs below target.` });
      recommendations.push({ type: 'medium', title: 'Boost Production', description: 'Review line speeds and downtime to increase output.', action: 'Review Lines' });
    }

    // Shift comparison
    const fsOee = latest.first_shift_oee || 0;
    const ssOee = latest.second_shift_oee || 0;
    if (Math.abs(fsOee - ssOee) > 15) {
      const weaker = fsOee < ssOee ? 'First' : 'Second';
      recommendations.push({ type: 'medium', title: `${weaker} Shift Needs Attention`, description: `${weaker} Shift OEE (${Math.min(fsOee, ssOee).toFixed(1)}%) is significantly lower. Consider training or process review.` });
    }

    // Always add a maintenance action item
    actionItems.push({ id: 'daily_check', title: 'Complete Daily Equipment Check', description: 'Ensure all die cut machines are properly calibrated and maintained.', priority: 'Medium', due: 'Daily' });

    return { key_insights: keyInsights, recommendations, action_items: actionItems };
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // SUBMIT METRICS — create new submission
  // ═══════════════════════════════════════════════════════════════════════════
  async submitMetrics(data: {
    weekName: string;
    weekStart: string;
    weekEnd: string;
    dayOfWeek: string;
    submittedBy: string;
    firstShift?: ShiftMetricsInput;
    secondShift?: ShiftMetricsInput;
  }) {
    // Create week submission + shift metrics in a transaction
    return prisma.$transaction(async (tx) => {
      // Create week submission
      const submission = await tx.bakeryWeekSubmission.create({
        data: {
          weekName: data.weekName,
          weekStart: new Date(data.weekStart),
          weekEnd: new Date(data.weekEnd),
          dayOfWeek: data.dayOfWeek,
          submittedBy: data.submittedBy,
        },
      });

      // First shift metrics (if provided)
      if (data.firstShift) {
        const fs = data.firstShift;
        await tx.bakeryFirstShiftMetrics.create({
          data: {
            weekSubmissionId: submission.id,
            dieCut1OeePct: fs.dieCut1OeePct,
            dieCut2OeePct: fs.dieCut2OeePct,
            oeeAvgPct: fs.oeeAvgPct ?? (fs.dieCut1OeePct + fs.dieCut2OeePct) / 2,
            dieCut1Lbs: fs.dieCut1Lbs,
            dieCut2Lbs: fs.dieCut2Lbs,
            poundsTotal: fs.poundsTotal ?? fs.dieCut1Lbs + fs.dieCut2Lbs,
            dieCut1WasteLb: fs.dieCut1WasteLb,
            dieCut2WasteLb: fs.dieCut2WasteLb,
            dieCut1WastePct: fs.dieCut1WastePct ?? (fs.dieCut1Lbs > 0 ? (fs.dieCut1WasteLb / fs.dieCut1Lbs) * 100 : 0),
            dieCut2WastePct: fs.dieCut2WastePct ?? (fs.dieCut2Lbs > 0 ? (fs.dieCut2WasteLb / fs.dieCut2Lbs) * 100 : 0),
            wasteAvgPct: fs.wasteAvgPct ?? ((fs.dieCut1Lbs + fs.dieCut2Lbs) > 0 ? ((fs.dieCut1WasteLb + fs.dieCut2WasteLb) / (fs.dieCut1Lbs + fs.dieCut2Lbs)) * 100 : 0),
            submittedBy: data.submittedBy,
          },
        });
      }

      // Second shift metrics (if provided)
      if (data.secondShift) {
        const ss = data.secondShift;
        await tx.bakerySecondShiftMetrics.create({
          data: {
            weekSubmissionId: submission.id,
            dieCut1OeePct: ss.dieCut1OeePct,
            dieCut2OeePct: ss.dieCut2OeePct,
            oeeAvgPct: ss.oeeAvgPct ?? (ss.dieCut1OeePct + ss.dieCut2OeePct) / 2,
            dieCut1Lbs: ss.dieCut1Lbs,
            dieCut2Lbs: ss.dieCut2Lbs,
            poundsTotal: ss.poundsTotal ?? ss.dieCut1Lbs + ss.dieCut2Lbs,
            dieCut1WasteLb: ss.dieCut1WasteLb,
            dieCut2WasteLb: ss.dieCut2WasteLb,
            dieCut1WastePct: ss.dieCut1WastePct ?? (ss.dieCut1Lbs > 0 ? (ss.dieCut1WasteLb / ss.dieCut1Lbs) * 100 : 0),
            dieCut2WastePct: ss.dieCut2WastePct ?? (ss.dieCut2Lbs > 0 ? (ss.dieCut2WasteLb / ss.dieCut2Lbs) * 100 : 0),
            wasteAvgPct: ss.wasteAvgPct ?? ((ss.dieCut1Lbs + ss.dieCut2Lbs) > 0 ? ((ss.dieCut1WasteLb + ss.dieCut2WasteLb) / (ss.dieCut1Lbs + ss.dieCut2Lbs)) * 100 : 0),
            submittedBy: data.submittedBy,
          },
        });
      }

      // Both-shifts combined (only when BOTH shifts are provided)
      if (data.firstShift && data.secondShift) {
        const fs = data.firstShift;
        const ss = data.secondShift;
        const bothOee1 = (fs.dieCut1OeePct + ss.dieCut1OeePct) / 2;
        const bothOee2 = (fs.dieCut2OeePct + ss.dieCut2OeePct) / 2;
        const bothLbs1 = fs.dieCut1Lbs + ss.dieCut1Lbs;
        const bothLbs2 = fs.dieCut2Lbs + ss.dieCut2Lbs;
        const bothWaste1 = fs.dieCut1WasteLb + ss.dieCut1WasteLb;
        const bothWaste2 = fs.dieCut2WasteLb + ss.dieCut2WasteLb;

        await tx.bakeryBothShiftsMetrics.create({
          data: {
            weekSubmissionId: submission.id,
            dieCut1OeePct: bothOee1,
            dieCut2OeePct: bothOee2,
            oeeAvgPct: (bothOee1 + bothOee2) / 2,
            dieCut1Lbs: bothLbs1,
            dieCut2Lbs: bothLbs2,
            poundsTotal: bothLbs1 + bothLbs2,
            dieCut1WasteLb: bothWaste1,
            dieCut2WasteLb: bothWaste2,
            dieCut1WastePct: bothLbs1 > 0 ? (bothWaste1 / bothLbs1) * 100 : 0,
            dieCut2WastePct: bothLbs2 > 0 ? (bothWaste2 / bothLbs2) * 100 : 0,
            wasteAvgPct: (bothLbs1 + bothLbs2) > 0 ? ((bothWaste1 + bothWaste2) / (bothLbs1 + bothLbs2)) * 100 : 0,
            submittedBy: data.submittedBy,
          },
        });
      }

      return submission;
    });
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // MISSING DATA ANALYSIS — scan all weeks for missing days/shifts/metrics
  // ═══════════════════════════════════════════════════════════════════════════
  async getMissingDataAnalysis() {
    const expectedDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

    // Get all active weekly sheets
    const sheets = await prisma.bakeryWeeklySheet.findMany({
      where: { isActive: true },
      orderBy: { weekStart: 'desc' },
    });

    // Get all submissions with their shift metrics
    const submissions = await prisma.bakeryWeekSubmission.findMany({
      include: {
        firstShiftMetrics: true,
        secondShiftMetrics: true,
        bothShiftsMetrics: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Group submissions by week
    const subsByWeek: Record<string, typeof submissions> = {};
    for (const sub of submissions) {
      if (!subsByWeek[sub.weekName]) subsByWeek[sub.weekName] = [];
      subsByWeek[sub.weekName].push(sub);
    }

    const weekAnalysis: any[] = [];

    for (const sheet of sheets) {
      const weekName = sheet.sheetName;
      const weekSubs = subsByWeek[weekName] || [];
      const submittedDays = weekSubs.map(s => s.dayOfWeek);
      const missingDays = expectedDays.filter(d => !submittedDays.includes(d));

      const dayDetails: any[] = [];
      let totalIssues = 0;

      // Check each expected day
      for (const day of expectedDays) {
        const sub = weekSubs.find(s => s.dayOfWeek === day);
        if (!sub) {
          dayDetails.push({
            day,
            status: 'missing',
            message: `No submission for ${day}`,
            issues: ['No data submitted for this day'],
            submitted_by: null,
            submitted_at: null,
          });
          totalIssues++;
          continue;
        }

        const issues: string[] = [];
        const fs = sub.firstShiftMetrics;
        const ss = sub.secondShiftMetrics;

        // Check first shift
        if (!fs) {
          issues.push('First shift data is completely missing');
        } else {
          if (Number(fs.dieCut1OeePct) === 0 && Number(fs.dieCut2OeePct) === 0) issues.push('First shift: Both OEE values are 0%');
          if (Number(fs.dieCut1Lbs) === 0 && Number(fs.dieCut2Lbs) === 0) issues.push('First shift: Both production volumes are 0 lbs');
        }

        // Check second shift
        if (!ss) {
          issues.push('Second shift data is completely missing');
        } else {
          if (Number(ss.dieCut1OeePct) === 0 && Number(ss.dieCut2OeePct) === 0) issues.push('Second shift: Both OEE values are 0%');
          if (Number(ss.dieCut1Lbs) === 0 && Number(ss.dieCut2Lbs) === 0) issues.push('Second shift: Both production volumes are 0 lbs');
        }

        totalIssues += issues.length;

        dayDetails.push({
          day,
          status: issues.length > 0 ? 'incomplete' : 'complete',
          message: issues.length > 0 ? `${issues.length} issue(s) found` : 'All data complete',
          issues,
          submitted_by: sub.submittedBy,
          submitted_at: sub.createdAt,
        });
      }

      const completedDays = expectedDays.length - missingDays.length;
      const completionPct = Math.round((completedDays / expectedDays.length) * 100);

      weekAnalysis.push({
        week_name: weekName,
        week_start: sheet.weekStart,
        week_end: sheet.weekEnd,
        total_expected: expectedDays.length,
        total_submitted: completedDays,
        missing_days: missingDays,
        completion_pct: completionPct,
        total_issues: totalIssues,
        days: dayDetails,
      });
    }

    return {
      total_weeks: weekAnalysis.length,
      weeks: weekAnalysis,
    };
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // RECENT SUBMISSIONS — last 5 submissions with time-ago formatting
  // ═══════════════════════════════════════════════════════════════════════════
  async getRecentSubmissions() {
    const submissions = await prisma.bakeryWeekSubmission.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        bothShiftsMetrics: { select: { id: true } },
      },
    });

    return submissions.map(sub => {
      const now = new Date();
      const diff = now.getTime() - sub.createdAt.getTime();
      const mins = Math.floor(diff / 60000);
      const hrs = Math.floor(diff / 3600000);
      const days = Math.floor(diff / 86400000);

      let time_ago = 'Just now';
      if (days > 0) time_ago = `${days} day${days !== 1 ? 's' : ''} ago`;
      else if (hrs > 0) time_ago = `${hrs} hour${hrs !== 1 ? 's' : ''} ago`;
      else if (mins > 0) time_ago = `${mins} minute${mins !== 1 ? 's' : ''} ago`;

      return {
        title: `${sub.dayOfWeek} Metrics`,
        time_ago,
        status: sub.bothShiftsMetrics ? 'Completed' : 'Submitted',
        day_of_week: sub.dayOfWeek,
        week_name: sub.weekName,
      };
    });
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ALL SUBMISSIONS — detailed list with shift breakdown
  // ═══════════════════════════════════════════════════════════════════════════
  async getAllSubmissions() {
    const submissions = await prisma.bakeryWeekSubmission.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        firstShiftMetrics: true,
        secondShiftMetrics: true,
        bothShiftsMetrics: true,
      },
    });

    return submissions.map(sub => ({
      id: sub.id,
      week_name: sub.weekName,
      day_of_week: sub.dayOfWeek,
      submitted_by: sub.submittedBy,
      submitted_at: sub.createdAt.toISOString(),
      status: sub.bothShiftsMetrics ? 'Completed' : 'Submitted',
      first_shift: sub.firstShiftMetrics ? {
        die_cut1_oee: `${Number(sub.firstShiftMetrics.dieCut1OeePct).toFixed(1)}%`,
        die_cut2_oee: `${Number(sub.firstShiftMetrics.dieCut2OeePct).toFixed(1)}%`,
        die_cut1_lbs: `${Number(sub.firstShiftMetrics.dieCut1Lbs).toFixed(1)} lbs`,
        die_cut2_lbs: `${Number(sub.firstShiftMetrics.dieCut2Lbs).toFixed(1)} lbs`,
        avg_oee: sub.firstShiftMetrics.oeeAvgPct ? `${Number(sub.firstShiftMetrics.oeeAvgPct).toFixed(1)}%` : 'N/A',
        avg_waste: sub.firstShiftMetrics.wasteAvgPct ? `${Number(sub.firstShiftMetrics.wasteAvgPct).toFixed(2)}%` : 'N/A',
      } : null,
      second_shift: sub.secondShiftMetrics ? {
        die_cut1_oee: `${Number(sub.secondShiftMetrics.dieCut1OeePct).toFixed(1)}%`,
        die_cut2_oee: `${Number(sub.secondShiftMetrics.dieCut2OeePct).toFixed(1)}%`,
        die_cut1_lbs: `${Number(sub.secondShiftMetrics.dieCut1Lbs).toFixed(1)} lbs`,
        die_cut2_lbs: `${Number(sub.secondShiftMetrics.dieCut2Lbs).toFixed(1)} lbs`,
        avg_oee: sub.secondShiftMetrics.oeeAvgPct ? `${Number(sub.secondShiftMetrics.oeeAvgPct).toFixed(1)}%` : 'N/A',
        avg_waste: sub.secondShiftMetrics.wasteAvgPct ? `${Number(sub.secondShiftMetrics.wasteAvgPct).toFixed(2)}%` : 'N/A',
      } : null,
      totals: sub.bothShiftsMetrics ? {
        avg_oee: sub.bothShiftsMetrics.oeeAvgPct ? `${Number(sub.bothShiftsMetrics.oeeAvgPct).toFixed(1)}%` : 'N/A',
        avg_waste: sub.bothShiftsMetrics.wasteAvgPct ? `${Number(sub.bothShiftsMetrics.wasteAvgPct).toFixed(2)}%` : 'N/A',
        total_production: sub.bothShiftsMetrics.poundsTotal ? `${Number(sub.bothShiftsMetrics.poundsTotal).toFixed(1)} lbs` : 'N/A',
      } : null,
    }));
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // MISSING DATA RESOLUTIONS
  // ═══════════════════════════════════════════════════════════════════════════
  async getResolutions() {
    return prisma.bakeryMissingDataResolution.findMany({
      orderBy: { resolvedAt: 'desc' },
    });
  },

  async saveResolution(weekName: string, dayOfWeek: string, reason: string, resolvedBy: string, shiftType: string = 'day') {
    return prisma.bakeryMissingDataResolution.upsert({
      where: { weekName_dayOfWeek_shiftType: { weekName, dayOfWeek, shiftType } },
      update: { reason, resolvedBy, resolvedAt: new Date() },
      create: { weekName, dayOfWeek, shiftType, reason, resolvedBy },
    });
  },

  async deleteResolution(weekName: string, dayOfWeek: string, shiftType?: string) {
    const where: any = { weekName, dayOfWeek };
    if (shiftType) where.shiftType = shiftType;
    return prisma.bakeryMissingDataResolution.deleteMany({ where });
  },

  // ─── Activity Log ───────────────────────────────────────────────────────
  async logActivity(data: {
    action: string;
    weekName: string;
    dayOfWeek: string;
    performedBy: string;
    reason?: string;
    details?: Record<string, any>;
    ipAddress?: string;
    userAgent?: string;
  }) {
    return prisma.bakeryTrackerActivityLog.create({
      data: {
        action: data.action,
        weekName: data.weekName,
        dayOfWeek: data.dayOfWeek,
        performedBy: data.performedBy,
        reason: data.reason || null,
        details: data.details ? JSON.stringify(data.details) : null,
        ipAddress: data.ipAddress || null,
        userAgent: data.userAgent || null,
      },
    });
  },

  async getActivityLogs(filters?: {
    action?: string;
    performedBy?: string;
    weekName?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
  }) {
    const where: any = {};
    if (filters?.action) where.action = filters.action;
    if (filters?.performedBy) where.performedBy = { contains: filters.performedBy, mode: 'insensitive' };
    if (filters?.weekName) where.weekName = filters.weekName;
    if (filters?.startDate || filters?.endDate) {
      where.createdAt = {};
      if (filters?.startDate) where.createdAt.gte = new Date(filters.startDate);
      if (filters?.endDate) {
        const end = new Date(filters.endDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    const [logs, totalCount] = await Promise.all([
      prisma.bakeryTrackerActivityLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: filters?.limit || 100,
        skip: filters?.offset || 0,
      }),
      prisma.bakeryTrackerActivityLog.count({ where }),
    ]);

    return { logs, totalCount };
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // DASHBOARD: Weekly Chart Metrics — per-day arrays for OEE/Waste charts
  // Mirrors Flask GET /api/weekly-metrics
  // ═══════════════════════════════════════════════════════════════════════════
  async getWeeklyChartMetrics(weekParam?: string) {
    // Determine the week name
    let weekName = weekParam;
    if (!weekName || weekName === 'latest') {
      const latestSheet = await prisma.bakeryWeeklySheet.findFirst({
        where: { isActive: true },
        orderBy: { weekStart: 'desc' },
      });
      weekName = latestSheet?.sheetName || null as any;
    }
    if (!weekName) {
      return {
        week: 'No Week',
        oee: [0, 0, 0, 0, 0],
        waste: [0, 0, 0, 0, 0],
        oeeAvg: 0,
        wasteAvg: 0,
        oeeFirstShift: [0, 0, 0, 0, 0],
        wasteFirstShift: [0, 0, 0, 0, 0],
        oeeSecondShift: [0, 0, 0, 0, 0],
        wasteSecondShift: [0, 0, 0, 0, 0],
        downtimeRatio: 0,
        productionRate: 0,
        totalProduction: 0,
      };
    }

    const submissions = await prisma.bakeryWeekSubmission.findMany({
      where: { weekName },
      include: {
        firstShiftMetrics: true,
        secondShiftMetrics: true,
        bothShiftsMetrics: true,
      },
    });

    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const oee = [0, 0, 0, 0, 0];
    const waste = [0, 0, 0, 0, 0];
    const oeeFirstShift = [0, 0, 0, 0, 0];
    const wasteFirstShift = [0, 0, 0, 0, 0];
    const oeeSecondShift = [0, 0, 0, 0, 0];
    const wasteSecondShift = [0, 0, 0, 0, 0];
    const poundsFirstShift = [0, 0, 0, 0, 0];
    const poundsSecondShift = [0, 0, 0, 0, 0];

    for (const sub of submissions) {
      const idx = days.indexOf(sub.dayOfWeek);
      if (idx === -1) continue;

      const fs = sub.firstShiftMetrics;
      const ss = sub.secondShiftMetrics;
      const bs = sub.bothShiftsMetrics;

      // Combined OEE
      if (bs?.oeeAvgPct != null) {
        oee[idx] = Number(bs.oeeAvgPct);
      } else {
        const fAvg = fs ? (Number(fs.dieCut1OeePct) + Number(fs.dieCut2OeePct)) / 2 : 0;
        const sAvg = ss ? (Number(ss.dieCut1OeePct) + Number(ss.dieCut2OeePct)) / 2 : 0;
        oee[idx] = fAvg && sAvg ? (fAvg + sAvg) / 2 : fAvg || sAvg;
      }

      // Combined Waste
      if (bs?.wasteAvgPct != null) {
        waste[idx] = Number(bs.wasteAvgPct);
      } else {
        const fPounds = fs ? Number(fs.dieCut1Lbs) + Number(fs.dieCut2Lbs) : 0;
        const sPounds = ss ? Number(ss.dieCut1Lbs) + Number(ss.dieCut2Lbs) : 0;
        const fWaste = fs ? Number(fs.dieCut1WasteLb) + Number(fs.dieCut2WasteLb) : 0;
        const sWaste = ss ? Number(ss.dieCut1WasteLb) + Number(ss.dieCut2WasteLb) : 0;
        const fPct = fPounds > 0 ? (fWaste / fPounds) * 100 : 0;
        const sPct = sPounds > 0 ? (sWaste / sPounds) * 100 : 0;
        waste[idx] = fPct && sPct ? (fPct + sPct) / 2 : fPct || sPct;
      }

      // First shift OEE
      if (fs) {
        const f1 = Number(fs.dieCut1OeePct) || 0;
        const f2 = Number(fs.dieCut2OeePct) || 0;
        oeeFirstShift[idx] = f1 && f2 ? (f1 + f2) / 2 : f1 || f2;
        poundsFirstShift[idx] = Number(fs.dieCut1Lbs || 0) + Number(fs.dieCut2Lbs || 0);
        // First shift waste %
        const fp = poundsFirstShift[idx];
        const fw = Number(fs.dieCut1WasteLb || 0) + Number(fs.dieCut2WasteLb || 0);
        wasteFirstShift[idx] = fp > 0 ? (fw / fp) * 100 : 0;
      }

      // Second shift OEE
      if (ss) {
        const s1 = Number(ss.dieCut1OeePct) || 0;
        const s2 = Number(ss.dieCut2OeePct) || 0;
        oeeSecondShift[idx] = s1 && s2 ? (s1 + s2) / 2 : s1 || s2;
        poundsSecondShift[idx] = Number(ss.dieCut1Lbs || 0) + Number(ss.dieCut2Lbs || 0);
        // Second shift waste %
        const sp = poundsSecondShift[idx];
        const sw = Number(ss.dieCut1WasteLb || 0) + Number(ss.dieCut2WasteLb || 0);
        wasteSecondShift[idx] = sp > 0 ? (sw / sp) * 100 : 0;
      }
    }

    // Averages excluding zero days
    const calcAvg = (arr: number[]) => {
      const nonZero = arr.filter(v => v !== 0);
      return nonZero.length ? Math.round((nonZero.reduce((a, b) => a + b, 0) / nonZero.length) * 10) / 10 : 0;
    };
    const avgOee = calcAvg(oee);
    const avgWaste = calcAvg(waste);
    const totalProd = poundsFirstShift.reduce((a, b) => a + b, 0) + poundsSecondShift.reduce((a, b) => a + b, 0);

    return {
      week: weekName,
      oee: oee.map(v => Math.round(v * 10) / 10),
      waste: waste.map(v => Math.round(v * 100) / 100),
      oeeAvg: avgOee,
      wasteAvg: avgWaste,
      oeeFirstShift: oeeFirstShift.map(v => Math.round(v * 10) / 10),
      wasteFirstShift: wasteFirstShift.map(v => Math.round(v * 100) / 100),
      oeeSecondShift: oeeSecondShift.map(v => Math.round(v * 10) / 10),
      wasteSecondShift: wasteSecondShift.map(v => Math.round(v * 100) / 100),
      downtimeRatio: avgOee > 0 ? Math.round((100 - avgOee * 0.948) * 10) / 10 : 0,
      productionRate: avgOee > 0 ? Math.round(Math.min(avgOee * 1.03, 100) * 10) / 10 : 0,
      totalProduction: Math.round(totalProd * 10) / 10,
    };
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // DASHBOARD: KPI cards with trend comparison (current vs previous week)
  // Mirrors Flask GET /api/dashboard-kpis
  // ═══════════════════════════════════════════════════════════════════════════
  async getDashboardKpis() {
    // Get last 2 active weeks
    const weeks = await prisma.bakeryWeeklySheet.findMany({
      where: { isActive: true },
      orderBy: { weekStart: 'desc' },
      take: 2,
    });

    const currentWeek = weeks[0]?.sheetName || null;
    const previousWeek = weeks[1]?.sheetName || null;

    const getWeekAverages = async (wk: string | null) => {
      if (!wk) return { avgOee: 0, avgWaste: 0, totalProduction: 0 };
      const subs = await prisma.bakeryWeekSubmission.findMany({
        where: { weekName: wk },
        include: { bothShiftsMetrics: true },
      });
      const withData = subs.filter(s => s.bothShiftsMetrics?.oeeAvgPct != null);
      if (!withData.length) return { avgOee: 0, avgWaste: 0, totalProduction: 0 };

      let totalOee = 0, totalWaste = 0, totalProd = 0;
      for (const s of withData) {
        totalOee += Number(s.bothShiftsMetrics!.oeeAvgPct || 0);
        totalWaste += Number(s.bothShiftsMetrics!.wasteAvgPct || 0);
        totalProd += Number(s.bothShiftsMetrics!.poundsTotal || 0);
      }
      return {
        avgOee: totalOee / withData.length,
        avgWaste: totalWaste / withData.length,
        totalProduction: totalProd,
      };
    };

    const [current, previous, kpiTargets] = await Promise.all([
      getWeekAverages(currentWeek),
      getWeekAverages(previousWeek),
      this.getKpiTargets(),
    ]);

    const calcTrend = (cur: number, prev: number) => {
      if (prev === 0) return cur === 0 ? 0 : 100;
      return Math.round(((cur - prev) / prev) * 100 * 10) / 10;
    };

    const avgOee = current.avgOee;
    const avgWaste = current.avgWaste;
    const totalProd = current.totalProduction;

    // Derived KPIs (same formulas as Flask)
    const availability = avgWaste > 0 ? Math.max(100 - avgWaste * 2.5, 0) : 0;
    const downtimeRatio = availability > 0 ? Math.max(100 - availability, 0) : 0;
    const productionRate = avgOee > 0 ? Math.min(avgOee * 1.03, 100) : 0;

    const prevAvailability = previous.avgWaste > 0 ? Math.max(100 - previous.avgWaste * 2.5, 0) : 0;
    const prevDowntime = prevAvailability > 0 ? Math.max(100 - prevAvailability, 0) : 0;
    const prevProdRate = previous.avgOee > 0 ? Math.min(previous.avgOee * 1.03, 100) : 0;

    // Uptime = 100 - downtime
    const uptimeValue = Math.round((100 - downtimeRatio) * 10) / 10;

    return {
      currentWeek: currentWeek || 'No Week',
      avgOEE: Math.round(avgOee * 10) / 10,
      avgWaste: Math.round(avgWaste * 10) / 10,
      totalWaste: avgWaste && totalProd ? Math.round((totalProd * avgWaste / 100) * 10) / 10 : 0,
      downtimeRatio: Math.round(downtimeRatio * 10) / 10,
      productionRate: Math.round(productionRate * 10) / 10,
      uptimeValue,
      totalProduction: Math.round(totalProd * 10) / 10,
      targets: {
        oee: kpiTargets.oee.total,
        waste: kpiTargets.waste.total,
        uptime: 90, // default uptime target
      },
      trends: {
        oee: {
          value: calcTrend(avgOee, previous.avgOee),
          direction: avgOee > previous.avgOee ? 'up' : avgOee < previous.avgOee ? 'down' : 'stable',
        },
        waste: {
          value: calcTrend(avgWaste, previous.avgWaste),
          direction: avgWaste < previous.avgWaste ? 'down' : avgWaste > previous.avgWaste ? 'up' : 'stable',
        },
        downtime: {
          value: calcTrend(downtimeRatio, prevDowntime),
          direction: downtimeRatio > prevDowntime ? 'up' : downtimeRatio < prevDowntime ? 'down' : 'stable',
        },
        production: {
          value: calcTrend(productionRate, prevProdRate),
          direction: productionRate > prevProdRate ? 'up' : productionRate < prevProdRate ? 'down' : 'stable',
        },
      },
    };
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // PERIOD OEE COMPARISON — weekly avg Die Cut 1 & 2 OEE across a date range
  // ═══════════════════════════════════════════════════════════════════════════
  async getPeriodOeeComparison(startDate: string, endDate: string) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    // Get OEE target
    const targets = await this.getKpiTargets();
    const oeeTarget = targets.oee?.total ?? 70;
    const wasteTarget = targets.waste?.total ?? 3;

    // Fetch all weekly sheets that overlap with the date range
    const sheets = await prisma.bakeryWeeklySheet.findMany({
      where: {
        weekStart: { gte: start },
        weekEnd: { lte: end },
      },
      orderBy: { weekStart: 'asc' },
    });

    if (sheets.length === 0) {
      return { weeks: [], oeeTarget, wasteTarget };
    }

    const weeks: {
      weekName: string;
      weekStart: string;
      weekEnd: string;
      weekLabel: string;
      dieCut1Oee: number;
      dieCut2Oee: number;
      avgOee: number;
      dieCut1Waste: number;
      dieCut2Waste: number;
      avgWaste: number;
    }[] = [];

    for (const sheet of sheets) {
      const submissions = await prisma.bakeryWeekSubmission.findMany({
        where: { weekName: sheet.sheetName },
        include: { bothShiftsMetrics: true },
      });

      if (submissions.length === 0) continue;

      // Calculate average Die Cut 1 & 2 OEE and Waste across all days in the week
      const dc1Vals: number[] = [];
      const dc2Vals: number[] = [];
      const dc1WasteVals: number[] = [];
      const dc2WasteVals: number[] = [];

      for (const sub of submissions) {
        const bs = sub.bothShiftsMetrics;
        if (bs) {
          const dc1 = Number(bs.dieCut1OeePct);
          const dc2 = Number(bs.dieCut2OeePct);
          if (dc1 > 0) dc1Vals.push(dc1);
          if (dc2 > 0) dc2Vals.push(dc2);
          const dc1w = Number(bs.dieCut1WastePct ?? 0);
          const dc2w = Number(bs.dieCut2WastePct ?? 0);
          if (dc1w > 0) dc1WasteVals.push(dc1w);
          if (dc2w > 0) dc2WasteVals.push(dc2w);
        }
      }

      const avg = (arr: number[]) => arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : 0;
      const dc1Avg = avg(dc1Vals);
      const dc2Avg = avg(dc2Vals);
      const dc1WasteAvg = avg(dc1WasteVals);
      const dc2WasteAvg = avg(dc2WasteVals);

      // Format week label: "Mar 16 – Mar 20"
      const ws = sheet.weekStart;
      const we = sheet.weekEnd;
      const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
      const yearStr = we.getUTCFullYear().toString();
      const weekLabel = `${fmt(ws)} – ${fmt(we)}, ${yearStr}`;

      weeks.push({
        weekName: sheet.sheetName,
        weekStart: ws.toISOString().split('T')[0],
        weekEnd: we.toISOString().split('T')[0],
        weekLabel,
        dieCut1Oee: dc1Avg,
        dieCut2Oee: dc2Avg,
        avgOee: dc1Avg && dc2Avg ? Math.round(((dc1Avg + dc2Avg) / 2) * 10) / 10 : dc1Avg || dc2Avg,
        dieCut1Waste: dc1WasteAvg,
        dieCut2Waste: dc2WasteAvg,
        avgWaste: dc1WasteAvg && dc2WasteAvg ? Math.round(((dc1WasteAvg + dc2WasteAvg) / 2) * 10) / 10 : dc1WasteAvg || dc2WasteAvg,
      });
    }

    return { weeks, oeeTarget, wasteTarget };
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 4-4-4-4 MONTHS AVERAGE YTD
  // Divides the business year into 3 periods of 4 months each + YTD total
  // ═══════════════════════════════════════════════════════════════════════════
  async getFourMonthAvgYtd() {
    // Get org calendar config
    const org = await prisma.organization.findFirst({
      select: { calendarYearStartMonth: true, calendarYearStartDay: true },
    });
    const calStartMonth = org?.calendarYearStartMonth ?? 1; // 1-12
    const calStartDay = org?.calendarYearStartDay ?? 1;     // 1-31

    // Get OEE target
    const targets = await this.getKpiTargets();
    const oeeTarget = targets.oee?.total ?? 70;

    const now = new Date();
    const currentYear = now.getUTCFullYear();

    // Calculate business year start (the most recent one <= now)
    let bizYearStart = new Date(Date.UTC(currentYear, calStartMonth - 1, calStartDay));
    if (bizYearStart > now) {
      bizYearStart = new Date(Date.UTC(currentYear - 1, calStartMonth - 1, calStartDay));
    }

    // Build 3 periods of 4 months each
    const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const periods: { label: string; start: Date; end: Date }[] = [];

    for (let p = 0; p < 3; p++) {
      const pStart = new Date(bizYearStart);
      pStart.setUTCMonth(pStart.getUTCMonth() + p * 4);

      const pEnd = new Date(pStart);
      pEnd.setUTCMonth(pEnd.getUTCMonth() + 4);
      pEnd.setUTCDate(pEnd.getUTCDate() - 1); // last day of the 4th month

      const startLabel = MONTH_NAMES[pStart.getUTCMonth()];
      const endMonth = new Date(pEnd);
      const endLabel = MONTH_NAMES[endMonth.getUTCMonth()];

      periods.push({
        label: `${startLabel} – ${endLabel}`,
        start: pStart,
        end: pEnd,
      });
    }

    // For each period, fetch weekly sheets and compute DC1/DC2 averages
    const periodResults: {
      periodLabel: string;
      periodNum: number;
      dieCut1Oee: number;
      dieCut2Oee: number;
      avgOee: number;
      weekCount: number;
      hasData: boolean;
      startDate: string;
      endDate: string;
    }[] = [];

    // Also collect all values for YTD average
    const ytdDc1Vals: number[] = [];
    const ytdDc2Vals: number[] = [];

    for (let i = 0; i < periods.length; i++) {
      const period = periods[i];
      // Only process periods that have started (period start <= now)
      if (period.start > now) {
        periodResults.push({
          periodLabel: period.label,
          periodNum: i + 1,
          dieCut1Oee: 0,
          dieCut2Oee: 0,
          avgOee: 0,
          weekCount: 0,
          hasData: false,
          startDate: period.start.toISOString().split('T')[0],
          endDate: period.end.toISOString().split('T')[0],
        });
        continue;
      }

      // Clip end to today if period hasn't ended yet
      const effectiveEnd = period.end > now ? now : period.end;

      const sheets = await prisma.bakeryWeeklySheet.findMany({
        where: {
          weekStart: { gte: period.start },
          weekEnd: { lte: effectiveEnd },
        },
        orderBy: { weekStart: 'asc' },
      });

      const dc1Vals: number[] = [];
      const dc2Vals: number[] = [];

      for (const sheet of sheets) {
        const submissions = await prisma.bakeryWeekSubmission.findMany({
          where: { weekName: sheet.sheetName },
          include: { bothShiftsMetrics: true },
        });

        for (const sub of submissions) {
          const bs = sub.bothShiftsMetrics;
          if (bs) {
            const dc1 = Number(bs.dieCut1OeePct);
            const dc2 = Number(bs.dieCut2OeePct);
            if (dc1 > 0) { dc1Vals.push(dc1); ytdDc1Vals.push(dc1); }
            if (dc2 > 0) { dc2Vals.push(dc2); ytdDc2Vals.push(dc2); }
          }
        }
      }

      const avg = (arr: number[]) => arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : 0;
      const dc1Avg = avg(dc1Vals);
      const dc2Avg = avg(dc2Vals);

      periodResults.push({
        periodLabel: period.label,
        periodNum: i + 1,
        dieCut1Oee: dc1Avg,
        dieCut2Oee: dc2Avg,
        avgOee: dc1Avg && dc2Avg ? Math.round(((dc1Avg + dc2Avg) / 2) * 10) / 10 : dc1Avg || dc2Avg,
        weekCount: sheets.length,
        hasData: dc1Vals.length > 0 || dc2Vals.length > 0,
        startDate: period.start.toISOString().split('T')[0],
        endDate: effectiveEnd.toISOString().split('T')[0],
      });
    }

    // Calculate YTD overall averages
    const avg = (arr: number[]) => arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : 0;
    const ytdDc1 = avg(ytdDc1Vals);
    const ytdDc2 = avg(ytdDc2Vals);

    return {
      periods: periodResults,
      ytd: {
        dieCut1Oee: ytdDc1,
        dieCut2Oee: ytdDc2,
        avgOee: ytdDc1 && ytdDc2 ? Math.round(((ytdDc1 + ytdDc2) / 2) * 10) / 10 : ytdDc1 || ytdDc2,
        totalDays: ytdDc1Vals.length + ytdDc2Vals.length,
      },
      oeeTarget,
      businessYearStart: bizYearStart.toISOString().split('T')[0],
      calendarConfig: { month: calStartMonth, day: calStartDay },
    };
  },
};

export default bakeryMetricsService;
