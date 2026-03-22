import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ─── Types ──────────────────────────────────────────────────────────────────────
interface AddWeekInput {
  start_date: string;  // MM-DD-YYYY format
  end_date: string;    // MM-DD-YYYY format
  week_name: string;   // Auto-generated: MM-DD-YYYY_MM-DD-YYYY
}

interface SaveKpiTargetsInput {
  oee_die_cut_1: number;
  oee_die_cut_2: number;
  oee_total: number;
  volume_die_cut_1: number;
  volume_die_cut_2: number;
  volume_total: number;
  waste_die_cut_1: number;
  waste_die_cut_2: number;
  waste_total: number;
}

const bakeryAdminService = {

  // ═══════════════════════════════════════════════════════════════════════════
  // GET ACTIVE WEEKS — returns all active weekly sheets
  // Matches Flask: GET /api/weeks
  // ═══════════════════════════════════════════════════════════════════════════
  async getActiveWeeks() {
    const weeks = await prisma.bakeryWeeklySheet.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    return weeks.map(w => ({
      id: w.id,
      sheet_name: w.sheetName,
      week_start: w.weekStart,
      week_end: w.weekEnd,
      is_active: w.isActive,
      created_at: w.createdAt,
      updated_at: w.updatedAt,
    }));
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ADD WEEK — create a new weekly sheet
  // Matches Flask: POST /api/weeks
  // ═══════════════════════════════════════════════════════════════════════════
  async addWeek(data: AddWeekInput) {
    // Parse dates (MM-DD-YYYY → Date)
    const parseDate = (s: string) => {
      const [m, d, y] = s.split('-');
      return new Date(`${y}-${m}-${d}T00:00:00.000Z`);
    };

    const weekStart = parseDate(data.start_date);
    const weekEnd = parseDate(data.end_date);

    // Validate
    if (weekEnd <= weekStart) {
      throw new Error('End date must be after start date');
    }

    // Check for overlapping weeks
    const existing = await prisma.bakeryWeeklySheet.findMany({
      where: { isActive: true },
    });

    for (const w of existing) {
      const existStart = new Date(w.weekStart);
      const existEnd = new Date(w.weekEnd);
      if (weekStart <= existEnd && weekEnd >= existStart) {
        throw new Error(`Week overlaps with existing week: ${w.sheetName}`);
      }
    }

    // Check for duplicate name
    const duplicate = await prisma.bakeryWeeklySheet.findFirst({
      where: { sheetName: data.week_name, isActive: true },
    });
    if (duplicate) {
      throw new Error(`A week with the name "${data.week_name}" already exists`);
    }

    const week = await prisma.bakeryWeeklySheet.create({
      data: {
        sheetName: data.week_name,
        weekStart,
        weekEnd,
        isActive: true,
      },
    });

    return {
      id: week.id,
      sheet_name: week.sheetName,
      week_start: week.weekStart,
      week_end: week.weekEnd,
      is_active: week.isActive,
      created_at: week.createdAt,
      updated_at: week.updatedAt,
    };
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // DELETE WEEK — soft delete (set isActive = false)
  // Matches Flask: DELETE /api/weeks/:id
  // ═══════════════════════════════════════════════════════════════════════════
  async deleteWeek(weekId: string) {
    // Check if week exists
    const week = await prisma.bakeryWeeklySheet.findUnique({
      where: { id: weekId },
    });
    if (!week) {
      throw new Error('Week not found');
    }
    if (!week.isActive) {
      throw new Error('Week is already deleted');
    }

    // Check for existing submissions referencing this week
    const submissions = await prisma.bakeryWeekSubmission.count({
      where: { weekName: week.sheetName },
    });
    if (submissions > 0) {
      throw new Error(`Cannot delete week with ${submissions} existing submission(s). Remove submissions first.`);
    }

    // Soft delete
    await prisma.bakeryWeeklySheet.update({
      where: { id: weekId },
      data: { isActive: false },
    });

    return { message: 'Week deleted successfully' };
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // GET KPI TARGETS (detailed) — returns all targets with metadata
  // Matches Flask: GET /api/kpi-targets (detailed version)
  // ═══════════════════════════════════════════════════════════════════════════
  async getKpiTargetsDetailed() {
    const targets = await prisma.bakeryKpiTarget.findMany({
      orderBy: { id: 'asc' },
    });

    // Build structured response matching Flask format
    const defaults: any = {
      oee: {
        die_cut_1: { value: 70, unit: '%', comparison_type: 'gte' },
        die_cut_2: { value: 70, unit: '%', comparison_type: 'gte' },
        total: { value: 70, unit: '%', comparison_type: 'gte' },
      },
      volume: {
        die_cut_1: { value: 6000, unit: 'lbs', comparison_type: 'gte' },
        die_cut_2: { value: 6000, unit: 'lbs', comparison_type: 'gte' },
        total: { value: 12000, unit: 'lbs', comparison_type: 'gte' },
      },
      waste: {
        die_cut_1: { value: 3.75, unit: '%', comparison_type: 'lte' },
        die_cut_2: { value: 3.75, unit: '%', comparison_type: 'lte' },
        total: { value: 3.75, unit: '%', comparison_type: 'lte' },
      },
    };

    for (const t of targets) {
      if (defaults[t.metricType] && defaults[t.metricType][t.metricName]) {
        defaults[t.metricType][t.metricName] = {
          value: Number(t.targetValue),
          unit: t.unit,
          comparison_type: t.comparisonType,
        };
      }
    }

    return defaults;
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // SAVE KPI TARGETS — upsert all 9 targets, log changes to history
  // Matches Flask: PUT /api/kpi-targets
  // ═══════════════════════════════════════════════════════════════════════════
  async saveKpiTargets(data: SaveKpiTargetsInput, updatedBy: string) {
    const targetMap = [
      { metricType: 'oee', metricName: 'die_cut_1', value: data.oee_die_cut_1, unit: '%', comparisonType: 'gte' },
      { metricType: 'oee', metricName: 'die_cut_2', value: data.oee_die_cut_2, unit: '%', comparisonType: 'gte' },
      { metricType: 'oee', metricName: 'total', value: data.oee_total, unit: '%', comparisonType: 'gte' },
      { metricType: 'volume', metricName: 'die_cut_1', value: data.volume_die_cut_1, unit: 'lbs', comparisonType: 'gte' },
      { metricType: 'volume', metricName: 'die_cut_2', value: data.volume_die_cut_2, unit: 'lbs', comparisonType: 'gte' },
      { metricType: 'volume', metricName: 'total', value: data.volume_total, unit: 'lbs', comparisonType: 'gte' },
      { metricType: 'waste', metricName: 'die_cut_1', value: data.waste_die_cut_1, unit: '%', comparisonType: 'lte' },
      { metricType: 'waste', metricName: 'die_cut_2', value: data.waste_die_cut_2, unit: '%', comparisonType: 'lte' },
      { metricType: 'waste', metricName: 'total', value: data.waste_total, unit: '%', comparisonType: 'lte' },
    ];

    const changesLogged: any[] = [];

    await prisma.$transaction(async (tx) => {
      for (const t of targetMap) {
        // Get current value
        const existing = await tx.bakeryKpiTarget.findUnique({
          where: {
            metricType_metricName: {
              metricType: t.metricType,
              metricName: t.metricName,
            },
          },
        });

        const oldValue = existing ? Number(existing.targetValue) : null;
        const newValue = t.value;

        // Upsert the target
        await tx.bakeryKpiTarget.upsert({
          where: {
            metricType_metricName: {
              metricType: t.metricType,
              metricName: t.metricName,
            },
          },
          update: {
            targetValue: newValue,
            unit: t.unit,
            comparisonType: t.comparisonType,
            updatedBy,
            updatedAt: new Date(),
          },
          create: {
            metricType: t.metricType,
            metricName: t.metricName,
            targetValue: newValue,
            unit: t.unit,
            comparisonType: t.comparisonType,
            updatedBy,
            updatedAt: new Date(),
          },
        });

        // Log change to history if value actually changed
        if (oldValue !== newValue) {
          await tx.bakeryKpiTargetHistory.create({
            data: {
              metricType: t.metricType,
              metricName: t.metricName,
              oldValue: oldValue,
              newValue: newValue,
              changedBy: updatedBy,
            },
          });
          changesLogged.push({
            metric_type: t.metricType,
            metric_name: t.metricName,
            old_value: oldValue,
            new_value: newValue,
          });
        }
      }
    });

    return {
      message: 'KPI targets saved successfully',
      changes: changesLogged,
      total_changes: changesLogged.length,
    };
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // GET KPI TARGET HISTORY — recent changes log
  // Matches Flask: GET /api/kpi-targets/history
  // ═══════════════════════════════════════════════════════════════════════════
  async getKpiTargetHistory(limit: number = 20) {
    const history = await prisma.bakeryKpiTargetHistory.findMany({
      orderBy: { changedAt: 'desc' },
      take: limit,
    });

    return history.map(h => ({
      id: h.id,
      metric_type: h.metricType,
      metric_name: h.metricName,
      old_value: h.oldValue ? Number(h.oldValue) : null,
      new_value: Number(h.newValue),
      changed_by: h.changedBy,
      changed_at: h.changedAt,
    }));
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // GET AUTO-WEEK SETTING — returns current on/off state
  // ═══════════════════════════════════════════════════════════════════════════
  async getAutoWeekSetting() {
    let setting = await prisma.bakeryAutoWeekSetting.findUnique({ where: { id: 1 } });
    if (!setting) {
      // First time — create default (disabled)
      setting = await prisma.bakeryAutoWeekSetting.create({
        data: { id: 1, enabled: false },
      });
    }
    return {
      enabled: setting.enabled,
      enabled_by: setting.enabledBy,
      enabled_at: setting.enabledAt,
      updated_at: setting.updatedAt,
    };
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // TOGGLE AUTO-WEEK SETTING — enable or disable auto-week generation
  // ═══════════════════════════════════════════════════════════════════════════
  async toggleAutoWeek(enabled: boolean, userName: string) {
    const setting = await prisma.bakeryAutoWeekSetting.upsert({
      where: { id: 1 },
      update: {
        enabled,
        enabledBy: userName,
        enabledAt: new Date(),
      },
      create: {
        id: 1,
        enabled,
        enabledBy: userName,
        enabledAt: new Date(),
      },
    });

    return {
      enabled: setting.enabled,
      enabled_by: setting.enabledBy,
      enabled_at: setting.enabledAt,
      updated_at: setting.updatedAt,
    };
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // GET SUBMISSION DEADLINE — returns configured deadline text
  // ═══════════════════════════════════════════════════════════════════════════
  async getSubmissionDeadline() {
    const row = await prisma.bakerySubmissionDeadline.findUnique({ where: { id: 1 } });
    return {
      deadline: row?.deadline ?? 'End of Day',
      updated_by: row?.updatedBy ?? null,
      updated_at: row?.updatedAt ?? null,
    };
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // SAVE SUBMISSION DEADLINE — update the deadline text (admin only)
  // ═══════════════════════════════════════════════════════════════════════════
  async saveSubmissionDeadline(deadline: string, updatedBy: string) {
    const setting = await prisma.bakerySubmissionDeadline.upsert({
      where: { id: 1 },
      update: { deadline, updatedBy, },
      create: { id: 1, deadline, updatedBy, },
    });
    return {
      deadline: setting.deadline,
      updated_by: setting.updatedBy,
      updated_at: setting.updatedAt,
    };
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // GET TIPS & GUIDELINES — returns all active tips ordered by sortOrder
  // ═══════════════════════════════════════════════════════════════════════════
  async getTipsGuidelines(activeOnly = true) {
    const where = activeOnly ? { isActive: true } : {};
    const tips = await prisma.bakeryTipGuideline.findMany({
      where,
      orderBy: { sortOrder: 'asc' },
    });
    return tips.map(t => ({
      id: t.id,
      title: t.title,
      description: t.description,
      color: t.color,
      icon: t.icon,
      sort_order: t.sortOrder,
      is_active: t.isActive,
      updated_by: t.updatedBy,
      updated_at: t.updatedAt,
    }));
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // SAVE TIPS & GUIDELINES — bulk upsert (replace all tips)
  // ═══════════════════════════════════════════════════════════════════════════
  async saveTipsGuidelines(tips: { id?: number; title: string; description: string; color: string; icon: string; sort_order: number; is_active: boolean }[], updatedBy: string) {
    // Delete tips that are no longer in the list
    const incomingIds = tips.filter(t => t.id).map(t => t.id as number);
    await prisma.bakeryTipGuideline.deleteMany({
      where: incomingIds.length > 0 ? { id: { notIn: incomingIds } } : {},
    });

    const results = [];
    for (const tip of tips) {
      if (tip.id) {
        // Update existing
        const updated = await prisma.bakeryTipGuideline.update({
          where: { id: tip.id },
          data: {
            title: tip.title,
            description: tip.description,
            color: tip.color,
            icon: tip.icon,
            sortOrder: tip.sort_order,
            isActive: tip.is_active,
            updatedBy,
          },
        });
        results.push(updated);
      } else {
        // Create new
        const created = await prisma.bakeryTipGuideline.create({
          data: {
            title: tip.title,
            description: tip.description,
            color: tip.color,
            icon: tip.icon,
            sortOrder: tip.sort_order,
            isActive: tip.is_active,
            updatedBy,
          },
        });
        results.push(created);
      }
    }
    return results.length;
  },
};

export default bakeryAdminService;
