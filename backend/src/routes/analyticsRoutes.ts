/**
 * Phase 12: Analytics & Intelligence Routes
 * API endpoints for trend analysis, predictive insights, and cost tracking
 */

import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requireRoles, requireMinimumRole } from '../middleware/rbac';
import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';
import aiService from '../services/aiService';

const router = Router();

// Apply authentication to all routes
router.use(authenticate);

// ============================================================================
// Phase 12.1: Trend Dashboards
// ============================================================================

/**
 * GET /api/analytics/trends/incidents
 * Get incident trend analysis
 */
router.get('/trends/incidents', requireRoles('CI_MANAGER', 'ADMIN', 'SYSTEM_ADMIN', 'QA_FOOD_SAFETY'), async (req: AuthRequest, res: Response) => {
  try {
    const { 
      period = '90',
      facilityId,
      groupBy = 'week',
    } = req.query;

    const periodDays = parseInt(period as string);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - periodDays);

    // Get incidents with trends
    const incidents = await prisma.incident.findMany({
      where: {
        createdAt: { gte: startDate },
        ...(facilityId && { facilityId: facilityId as string }),
      },
      select: {
        id: true,
        type: true,
        severity: true,
        status: true,
        categoryId: true,
        facilityId: true,
        departmentId: true,
        lineId: true,
        shiftId: true,
        createdAt: true,
        resolvedAt: true,
        occurredAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    // Group by time period
    const trendData = groupByPeriod(incidents, groupBy as string, 'createdAt');

    // Calculate statistics
    const totalIncidents = incidents.length;
    const resolvedIncidents = incidents.filter(i => i.resolvedAt).length;
    const avgResolutionTime = calculateAverageResolutionTime(incidents);

    // Type breakdown
    const byType = countGroupBy(incidents, 'type');
    const bySeverity = countGroupBy(incidents, 'severity');
    const byFacility = countGroupBy(incidents, 'facilityId');
    const byCategory = countGroupBy(incidents, 'categoryId');

    // Calculate trends (week over week change)
    const trendSummary = calculateTrendChange(trendData);

    res.json({
      success: true,
      data: {
        period: {
          days: periodDays,
          start: startDate.toISOString(),
          end: new Date().toISOString(),
          groupBy,
        },
        summary: {
          totalIncidents,
          resolvedIncidents,
          resolutionRate: totalIncidents > 0 ? ((resolvedIncidents / totalIncidents) * 100).toFixed(1) + '%' : '0%',
          avgResolutionTimeHours: avgResolutionTime,
          trendDirection: trendSummary.direction,
          trendPercentage: trendSummary.percentage,
        },
        trends: trendData,
        breakdowns: {
          byType,
          bySeverity,
          byFacility,
          byCategory,
        },
      },
    });

  } catch (error: any) {
    logger.error('Error generating incident trends:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate incident trends',
    });
  }
});

// ============================================================================
// Phase 12.2: Downtime Analytics
// ============================================================================

/**
 * GET /api/analytics/downtime
 * Get machine downtime analytics
 */
router.get('/downtime', requireRoles('MAINTENANCE_ENGINEERING', 'CI_MANAGER', 'ADMIN', 'SYSTEM_ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { 
      period = '30',
      facilityId,
      lineId,
    } = req.query;

    const periodDays = parseInt(period as string);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - periodDays);

    // Get machine breakdown incidents
    const breakdowns = await prisma.incident.findMany({
      where: {
        type: 'MACHINE_EQUIPMENT',
        createdAt: { gte: startDate },
        ...(facilityId && { facilityId: facilityId as string }),
        ...(lineId && { lineId: lineId as string }),
      },
      include: {
        Facility: { select: { name: true } },
        Line: { select: { name: true } },
        Department: { select: { name: true } },
        Category: { select: { name: true } },
        RCAAnalysis: {
          select: {
            rootCauseStatement: true,
            method: true,
            isValidated: true,
          },
        },
      },
      orderBy: { occurredAt: 'desc' },
    });

    // Calculate downtime metrics
    const totalDowntimeEvents = breakdowns.length;
    const machineBreakdownsByLine = groupAndCount(breakdowns, (b: any) => b.Line?.name || 'Unknown');
    const machineBreakdownsByCategory = groupAndCount(breakdowns, (b: any) => b.Category.name);
    const machineBreakdownsByFacility = groupAndCount(breakdowns, (b: any) => b.Facility.name);

    // Calculate estimated downtime hours (based on resolution time)
    let totalDowntimeHours = 0;
    for (const breakdown of breakdowns) {
      if (breakdown.resolvedAt) {
        const hours = (breakdown.resolvedAt.getTime() - breakdown.occurredAt.getTime()) / (1000 * 60 * 60);
        totalDowntimeHours += hours;
      }
    }

    // Top failure modes (from root causes)
    const failureModes: Record<string, number> = {};
    for (const breakdown of breakdowns) {
      if (breakdown.RCAAnalysis.length > 0 && breakdown.RCAAnalysis[0].rootCauseStatement) {
        const rootCause = breakdown.RCAAnalysis[0].rootCauseStatement.substring(0, 50);
        failureModes[rootCause] = (failureModes[rootCause] || 0) + 1;
      }
    }

    // Sort by frequency
    const topFailureModes = Object.entries(failureModes)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([mode, count]) => ({ mode, count }));

    // Trend over time
    const downtimeTrend = groupByPeriod(breakdowns, 'week', 'occurredAt');

    res.json({
      success: true,
      data: {
        period: {
          days: periodDays,
          start: startDate.toISOString(),
          end: new Date().toISOString(),
        },
        summary: {
          totalDowntimeEvents,
          totalDowntimeHours: totalDowntimeHours.toFixed(1),
          avgDowntimePerEvent: totalDowntimeEvents > 0 
            ? (totalDowntimeHours / totalDowntimeEvents).toFixed(1) 
            : '0',
          mtbf: calculateMTBF(breakdowns, periodDays), // Mean Time Between Failures
        },
        breakdowns: {
          byLine: machineBreakdownsByLine,
          byCategory: machineBreakdownsByCategory,
          byFacility: machineBreakdownsByFacility,
        },
        topFailureModes,
        trend: downtimeTrend,
      },
    });

  } catch (error: any) {
    logger.error('Error generating downtime analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate downtime analytics',
    });
  }
});

// ============================================================================
// Phase 12.3: Food Safety Risk Trends
// ============================================================================

/**
 * GET /api/analytics/food-safety
 * Get food safety risk trend analysis
 */
router.get('/food-safety', requireRoles('QA_FOOD_SAFETY', 'CI_MANAGER', 'ADMIN', 'SYSTEM_ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { 
      period = '90',
      facilityId,
    } = req.query;

    const periodDays = parseInt(period as string);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - periodDays);

    // Get food safety incidents
    const incidents = await prisma.incident.findMany({
      where: {
        type: 'FOOD_SAFETY',
        createdAt: { gte: startDate },
        ...(facilityId && { facilityId: facilityId as string }),
      },
      include: {
        Facility: { select: { name: true } },
        Category: { select: { name: true, parentId: true } },
        Department: { select: { name: true } },
        Line: { select: { name: true } },
        RCAAnalysis: {
          select: {
            rootCauseStatement: true,
            isValidated: true,
            CAPAction: {
              select: {
                status: true,
                regulatoryTags: true,
              },
            },
          },
        },
      },
      orderBy: { occurredAt: 'desc' },
    });

    // Calculate risk metrics
    const totalFSIncidents = incidents.length;
    const criticalIncidents = incidents.filter(i => i.severity === 'CRITICAL').length;
    const highIncidents = incidents.filter(i => i.severity === 'HIGH').length;
    
    // By category (foreign material, micro, allergen, etc.)
    const byCategory = groupAndCount(incidents, (i: any) => i.Category.name);
    
    // By facility
    const byFacility = groupAndCount(incidents, (i: any) => i.Facility.name);

    // By line
    const byLine = groupAndCount(incidents, (i: any) => i.Line?.name || 'Unknown');

    // Regulatory tag analysis
    const regulatoryTags: Record<string, number> = {};
    for (const incident of incidents) {
      for (const rca of incident.RCAAnalysis) {
        for (const action of rca.CAPAction) {
          if (action.regulatoryTags) {
            for (const tag of action.regulatoryTags) {
              if (tag) { // Ensure tag is not null or undefined
                regulatoryTags[tag] = (regulatoryTags[tag] || 0) + 1;
              }
            }
          }
        }
      }
    }

    // Trend over time
    const fsTrend = groupByPeriod(incidents, 'week', 'occurredAt');

    // Calculate risk score (weighted)
    const riskScore = calculateFoodSafetyRiskScore(incidents);

    // Root cause patterns
    const rootCausePatterns: Record<string, number> = {};
    for (const incident of incidents) {
      if (incident.RCAAnalysis.length > 0 && incident.RCAAnalysis[0].rootCauseStatement) {
        const pattern = categorizeRootCause(incident.RCAAnalysis[0].rootCauseStatement);
        rootCausePatterns[pattern] = (rootCausePatterns[pattern] || 0) + 1;
      }
    }

    res.json({
      success: true,
      data: {
        period: {
          days: periodDays,
          start: startDate.toISOString(),
          end: new Date().toISOString(),
        },
        summary: {
          totalIncidents: totalFSIncidents,
          criticalIncidents,
          highIncidents,
          riskScore: riskScore.toFixed(1),
          riskLevel: getRiskLevel(riskScore),
        },
        breakdowns: {
          byCategory,
          byFacility,
          byLine,
          byRegulatoryTag: regulatoryTags,
          byRootCausePattern: rootCausePatterns,
        },
        trend: fsTrend,
        recommendations: generateFoodSafetyRecommendations(incidents, byCategory),
      },
    });

  } catch (error: any) {
    logger.error('Error generating food safety analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate food safety analytics',
    });
  }
});

// ============================================================================
// Phase 12.4: Machine Reliability Trends
// ============================================================================

/**
 * GET /api/analytics/reliability
 * Get machine reliability trends
 */
router.get('/reliability', requireRoles('MAINTENANCE_ENGINEERING', 'CI_MANAGER', 'ADMIN', 'SYSTEM_ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { 
      period = '90',
      facilityId,
      lineId,
    } = req.query;

    const periodDays = parseInt(period as string);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - periodDays);

    // Get all machine-related incidents
    const machineIncidents = await prisma.incident.findMany({
      where: {
        type: 'MACHINE_EQUIPMENT',
        createdAt: { gte: startDate },
        ...(facilityId && { facilityId: facilityId as string }),
        ...(lineId && { lineId: lineId as string }),
      },
      include: {
        Line: { select: { id: true, name: true } },
        Facility: { select: { name: true } },
        Category: { select: { name: true } },
        RCAAnalysis: {
          select: {
            rootCauseStatement: true,
            CAPAction: {
              select: {
                status: true,
                isEffective: true,
              },
            },
          },
        },
      },
      orderBy: { occurredAt: 'asc' },
    });

    // Calculate reliability metrics by line
    const lineMetrics: Record<string, any> = {};
    for (const incident of machineIncidents) {
      const lineName = incident.Line?.name || 'Unknown';
      if (!lineMetrics[lineName]) {
        lineMetrics[lineName] = {
          lineId: incident.Line?.id,
          lineName,
          failureCount: 0,
          totalDowntimeHours: 0,
          incidents: [],
        };
      }
      lineMetrics[lineName].failureCount++;
      if (incident.resolvedAt) {
        const hours = (incident.resolvedAt.getTime() - incident.occurredAt.getTime()) / (1000 * 60 * 60);
        lineMetrics[lineName].totalDowntimeHours += hours;
      }
      lineMetrics[lineName].incidents.push(incident.occurredAt);
    }

    // Calculate MTBF and MTTR for each line
    for (const line of Object.values(lineMetrics) as any[]) {
      line.mtbf = line.incidents.length > 1 
        ? calculateLineMTBF(line.incidents, periodDays)
        : periodDays * 24; // If only one failure, MTBF is the whole period
      line.mttr = line.failureCount > 0 
        ? (line.totalDowntimeHours / line.failureCount).toFixed(1)
        : '0';
      line.availability = calculateAvailability(line.totalDowntimeHours, periodDays);
      delete line.incidents; // Remove raw data
    }

    // Sort by failure count (worst performing first)
    const sortedLines = Object.values(lineMetrics)
      .sort((a: any, b: any) => b.failureCount - a.failureCount);

    // Failure category analysis
    const failureCategories = groupAndCount(machineIncidents, (i: any) => i.Category.name);

    // Overall metrics
    const totalFailures = machineIncidents.length;
    const overallDowntimeHours = Object.values(lineMetrics as Record<string, any>)
      .reduce((sum: number, line: any) => sum + line.totalDowntimeHours, 0);

    res.json({
      success: true,
      data: {
        period: {
          days: periodDays,
          start: startDate.toISOString(),
          end: new Date().toISOString(),
        },
        summary: {
          totalFailures,
          totalDowntimeHours: overallDowntimeHours.toFixed(1),
          overallMTBF: totalFailures > 0 
            ? ((periodDays * 24) / totalFailures).toFixed(1) + ' hours'
            : 'N/A',
          overallMTTR: totalFailures > 0 
            ? (overallDowntimeHours / totalFailures).toFixed(1) + ' hours'
            : 'N/A',
        },
        lineMetrics: sortedLines,
        failureCategories,
        trend: groupByPeriod(machineIncidents, 'week', 'occurredAt'),
      },
    });

  } catch (error: any) {
    logger.error('Error generating reliability analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate reliability analytics',
    });
  }
});

// ============================================================================
// Phase 12.5: Predictive Recurrence Detection
// ============================================================================

/**
 * GET /api/analytics/predictions
 * Get predictive analytics and recurrence risk
 */
router.get('/predictions', requireRoles('CI_MANAGER', 'ADMIN', 'SYSTEM_ADMIN', 'QA_FOOD_SAFETY'), async (req: AuthRequest, res: Response) => {
  try {
    const { facilityId } = req.query;

    // Get recent incidents with patterns
    const recentIncidents = await prisma.incident.findMany({
      where: {
        createdAt: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
        ...(facilityId && { facilityId: facilityId as string }),
      },
      include: {
        Facility: { select: { name: true } },
        Category: { select: { name: true } },
        Line: { select: { name: true } },
        Department: { select: { name: true } },
        RCAAnalysis: {
          include: {
            CAPAction: {
              select: {
                status: true,
                isEffective: true,
                recurrenceDetected: true,
              },
            },
          },
        },
      },
      orderBy: { occurredAt: 'desc' },
    });

    // Find recurring patterns
    const patterns: Record<string, {
      count: number;
      incidents: any[];
      avgTimeBetween: number;
      lastOccurred: Date;
      riskScore: number;
    }> = {};

    // Group by category + facility + line to find patterns
    for (const incident of recentIncidents) {
      const key = `${incident.categoryId}-${incident.facilityId}-${incident.lineId || 'none'}`;
      if (!patterns[key]) {
        patterns[key] = {
          count: 0,
          incidents: [],
          avgTimeBetween: 0,
          lastOccurred: incident.occurredAt,
          riskScore: 0,
        };
      }
      patterns[key].count++;
      patterns[key].incidents.push(incident);
    }

    // Calculate recurrence risk for patterns with 2+ occurrences
    const highRiskPatterns: any[] = [];
    for (const [key, pattern] of Object.entries(patterns)) {
      if (pattern.count >= 2) {
        // Calculate average time between occurrences
        const times = pattern.incidents.map(i => i.occurredAt.getTime()).sort();
        let totalGap = 0;
        for (let i = 1; i < times.length; i++) {
          totalGap += times[i] - times[i - 1];
        }
        pattern.avgTimeBetween = totalGap / (times.length - 1) / (1000 * 60 * 60 * 24); // days

        // Calculate risk score based on frequency and severity
        const severityWeight = pattern.incidents.reduce((sum: number, i: any) => {
          const weights: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
          return sum + (weights[i.severity] || 1);
        }, 0);
        
        // Check if CAPA actions were effective
        const ineffectiveActions = pattern.incidents.reduce((sum: number, i: any) => {
          return sum + i.RCAAnalysis.reduce((rSum: number, r: any) => {
            return rSum + r.CAPAction.filter((a: any) => a.isEffective === false || a.recurrenceDetected).length;
          }, 0);
        }, 0);

        pattern.riskScore = Math.min(100, (pattern.count * 10) + (severityWeight * 5) + (ineffectiveActions * 15) - (pattern.avgTimeBetween * 0.5));

        if (pattern.riskScore >= 30) {
          const sampleIncident = pattern.incidents[0];
          highRiskPatterns.push({
            patternId: key,
            category: sampleIncident.Category.name,
            facility: sampleIncident.Facility.name,
            line: sampleIncident.Line?.name || 'N/A',
            occurrenceCount: pattern.count,
            avgDaysBetween: pattern.avgTimeBetween.toFixed(1),
            lastOccurred: pattern.lastOccurred,
            riskScore: pattern.riskScore.toFixed(0),
            riskLevel: getRiskLevel(pattern.riskScore),
            daysSinceLast: Math.floor((Date.now() - pattern.lastOccurred.getTime()) / (1000 * 60 * 60 * 24)),
            predictedNextOccurrence: new Date(pattern.lastOccurred.getTime() + pattern.avgTimeBetween * 24 * 60 * 60 * 1000).toISOString(),
          });
        }
      }
    }

    // Sort by risk score
    highRiskPatterns.sort((a, b) => parseFloat(b.riskScore) - parseFloat(a.riskScore));

    // Get actions with recurrence detected
    const actionsWithRecurrence = await prisma.cAPAction.findMany({
      where: {
        recurrenceDetected: true,
      },
      include: {
        RCAAnalysis: {
          include: {
            Incident: {
              select: {
                incidentNumber: true,
                Facility: { select: { name: true } },
                Category: { select: { name: true } },
              },
            },
          },
        },
        User: { select: { firstName: true, lastName: true } },
      },
      take: 20,
      orderBy: { updatedAt: 'desc' },
    });

    res.json({
      success: true,
      data: {
        highRiskPatterns: highRiskPatterns.slice(0, 10),
        recurrenceAlerts: actionsWithRecurrence
          .filter(a => a.RCAAnalysis?.Incident)
          .map(a => ({
            actionId: a.id,
            incidentNumber: a.RCAAnalysis!.Incident.incidentNumber,
            facility: a.RCAAnalysis!.Incident.Facility?.name || 'Unknown',
            category: a.RCAAnalysis!.Incident.Category?.name || 'Unknown',
            actionTitle: a.title,
            owner: a.User ? `${a.User.firstName} ${a.User.lastName}` : 'Unassigned',
            status: a.status,
          })),
        summary: {
          totalPatternsAnalyzed: Object.keys(patterns).length,
          highRiskPatterns: highRiskPatterns.length,
          activeRecurrenceAlerts: actionsWithRecurrence.length,
        },
      },
    });

  } catch (error: any) {
    logger.error('Error generating predictions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate predictions',
    });
  }
});

/**
 * POST /api/analytics/ai-insights
 * Generate AI-powered insights from analytics data
 */
router.post('/ai-insights', requireRoles('CI_MANAGER', 'ADMIN', 'SYSTEM_ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { analysisType, data } = req.body;

    if (!analysisType || !data) {
      return res.status(400).json({
        success: false,
        error: 'analysisType and data are required',
      });
    }

    // For now, generate structured insights without AI (AI integration can be added later)
    const insights = generateStructuredInsights(analysisType, data);

    res.json({
      success: true,
      data: {
        analysisType,
        insights,
        generatedAt: new Date().toISOString(),
      },
    });

  } catch (error: any) {
    logger.error('Error generating AI insights:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate AI insights',
    });
  }
});

// ============================================================================
// Helper Functions
// ============================================================================

function groupByPeriod(items: any[], groupBy: string, dateField: string): any[] {
  const groups = new Map<string, { date: string; count: number; items: any[] }>();

  for (const item of items) {
    const dateKey = getDateKey(item[dateField], groupBy);
    if (!groups.has(dateKey)) {
      groups.set(dateKey, { date: dateKey, count: 0, items: [] });
    }
    const group = groups.get(dateKey)!;
    group.count++;
    group.items.push(item);
  }

  return Array.from(groups.values())
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

function getDateKey(date: Date, groupBy: string): string {
  const d = new Date(date);
  switch (groupBy) {
    case 'week':
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      d.setDate(diff);
      return d.toISOString().split('T')[0];
    case 'month':
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
    default:
      return d.toISOString().split('T')[0];
  }
}

function countGroupBy(items: any[], field: string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    const value = item[field] || 'Unknown';
    counts[value] = (counts[value] || 0) + 1;
  }
  return counts;
}

function groupAndCount(items: any[], keyFn: (item: any) => string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    const key = keyFn(item);
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

function calculateAverageResolutionTime(incidents: any[]): string {
  const resolvedIncidents = incidents.filter(i => i.resolvedAt);
  if (resolvedIncidents.length === 0) return 'N/A';

  let totalHours = 0;
  for (const incident of resolvedIncidents) {
    const hours = (incident.resolvedAt.getTime() - incident.createdAt.getTime()) / (1000 * 60 * 60);
    totalHours += hours;
  }

  return (totalHours / resolvedIncidents.length).toFixed(1);
}

function calculateTrendChange(trendData: any[]): { direction: string; percentage: string } {
  if (trendData.length < 2) {
    return { direction: 'stable', percentage: '0%' };
  }

  const recent = trendData.slice(-2);
  const previousCount = recent[0].count;
  const currentCount = recent[1].count;

  if (previousCount === 0) {
    return { direction: currentCount > 0 ? 'up' : 'stable', percentage: currentCount > 0 ? '+100%' : '0%' };
  }

  const change = ((currentCount - previousCount) / previousCount) * 100;
  return {
    direction: change > 5 ? 'up' : change < -5 ? 'down' : 'stable',
    percentage: (change >= 0 ? '+' : '') + change.toFixed(1) + '%',
  };
}

function calculateMTBF(breakdowns: any[], periodDays: number): string {
  if (breakdowns.length <= 1) return `${periodDays * 24} hours`;
  
  const totalHours = periodDays * 24;
  const mtbf = totalHours / breakdowns.length;
  return `${mtbf.toFixed(1)} hours`;
}

function calculateLineMTBF(incidentDates: Date[], periodDays: number): string {
  if (incidentDates.length <= 1) return `${periodDays * 24}`;
  
  const sorted = incidentDates.sort((a, b) => a.getTime() - b.getTime());
  let totalGap = 0;
  for (let i = 1; i < sorted.length; i++) {
    totalGap += sorted[i].getTime() - sorted[i - 1].getTime();
  }
  
  const avgGapHours = (totalGap / (sorted.length - 1)) / (1000 * 60 * 60);
  return avgGapHours.toFixed(1);
}

function calculateAvailability(downtimeHours: number, periodDays: number): string {
  const totalHours = periodDays * 24;
  const availability = ((totalHours - downtimeHours) / totalHours) * 100;
  return availability.toFixed(2) + '%';
}

function calculateFoodSafetyRiskScore(incidents: any[]): number {
  let score = 0;
  const severityWeights: Record<string, number> = { CRITICAL: 25, HIGH: 15, MEDIUM: 8, LOW: 3 };
  
  for (const incident of incidents) {
    score += severityWeights[incident.severity || 'LOW'];
  }
  
  // Normalize to 0-100
  const maxPossibleScore = incidents.length * 25;
  return maxPossibleScore > 0 ? (score / maxPossibleScore) * 100 : 0;
}

function getRiskLevel(score: number): string {
  if (score >= 75) return 'CRITICAL';
  if (score >= 50) return 'HIGH';
  if (score >= 25) return 'MEDIUM';
  return 'LOW';
}

function categorizeRootCause(rootCause: string): string {
  const lowerCase = rootCause.toLowerCase();
  
  if (lowerCase.includes('training') || lowerCase.includes('procedure')) return 'Training/Procedure';
  if (lowerCase.includes('equipment') || lowerCase.includes('machine')) return 'Equipment';
  if (lowerCase.includes('material') || lowerCase.includes('supplier')) return 'Material/Supplier';
  if (lowerCase.includes('environment') || lowerCase.includes('temperature')) return 'Environment';
  if (lowerCase.includes('human') || lowerCase.includes('error')) return 'Human Error';
  if (lowerCase.includes('maintenance') || lowerCase.includes('wear')) return 'Maintenance';
  
  return 'Other';
}

function generateFoodSafetyRecommendations(incidents: any[], byCategory: Record<string, number>): string[] {
  const recommendations: string[] = [];
  
  // Find top category
  const topCategory = Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0];
  if (topCategory) {
    recommendations.push(`Focus on ${topCategory[0]} - accounts for ${topCategory[1]} incidents`);
  }
  
  // Check for critical incidents
  const criticalCount = incidents.filter(i => i.severity === 'CRITICAL').length;
  if (criticalCount > 0) {
    recommendations.push(`${criticalCount} critical incidents require immediate attention and regulatory review`);
  }
  
  // Check CAPA effectiveness
  let ineffectiveCount = 0;
  for (const incident of incidents) {
    for (const rca of incident.RCAAnalysis) {
      ineffectiveCount += rca.CAPAction.filter((a: any) => a.isEffective === false).length;
    }
  }
  if (ineffectiveCount > 0) {
    recommendations.push(`${ineffectiveCount} corrective actions marked ineffective - review and strengthen`);
  }
  
  return recommendations;
}

function generateStructuredInsights(analysisType: string, data: any): any {
  const insights: any = {
    keyFindings: [],
    riskAreas: [],
    recommendations: [],
    predictedTrends: [],
  };

  // Analyze based on type
  if (analysisType === 'incidents' || analysisType === 'trends') {
    if (data.totalIncidents > 10) {
      insights.keyFindings.push(`${data.totalIncidents} incidents recorded in the analysis period`);
    }
    if (data.criticalCount > 0) {
      insights.riskAreas.push(`${data.criticalCount} critical severity incidents require immediate attention`);
    }
    if (data.resolutionRate && parseFloat(data.resolutionRate) < 80) {
      insights.recommendations.push('Improve incident resolution rate - currently below 80%');
    }
  }

  if (analysisType === 'downtime') {
    if (data.totalDowntimeHours > 100) {
      insights.keyFindings.push(`Significant downtime: ${data.totalDowntimeHours} hours recorded`);
      insights.recommendations.push('Consider preventive maintenance program to reduce unplanned downtime');
    }
  }

  if (analysisType === 'food-safety') {
    if (data.riskScore > 50) {
      insights.riskAreas.push('Food safety risk score is elevated - review HACCP controls');
    }
    insights.recommendations.push('Continue regular food safety audits and training');
  }

  if (analysisType === 'reliability') {
    insights.keyFindings.push('Reliability analysis completed');
    insights.recommendations.push('Focus on worst-performing lines for maintenance improvement');
  }

  // Add default insight if none generated
  if (insights.keyFindings.length === 0) {
    insights.keyFindings.push('Analysis completed - data within normal parameters');
  }

  return insights;
}

export default router;
