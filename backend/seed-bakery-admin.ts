/**
 * Seed file for bakery admin data (KPI targets + history)
 * Backed up from live Flask database on 2026-03-21
 * 
 * Weekly sheets are NOT seeded here — they already exist in the live dashmet_rca_db.
 * KPI targets: 9 records
 * KPI targets history: 18 records
 * 
 * Usage: npx ts-node seed-bakery-admin.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const kpiTargets = [
  { id: 1, metricType: 'oee', metricName: 'die_cut_1', targetValue: 74.00, unit: '%', comparisonType: 'gte', updatedBy: 'Admin user', updatedAt: new Date('2026-01-28T23:07:39.471Z') },
  { id: 2, metricType: 'oee', metricName: 'die_cut_2', targetValue: 74.00, unit: '%', comparisonType: 'gte', updatedBy: 'Admin user', updatedAt: new Date('2026-01-28T23:07:39.471Z') },
  { id: 3, metricType: 'oee', metricName: 'total', targetValue: 74.00, unit: '%', comparisonType: 'gte', updatedBy: 'Admin user', updatedAt: new Date('2026-01-28T23:07:39.471Z') },
  { id: 4, metricType: 'volume', metricName: 'die_cut_1', targetValue: 6000.00, unit: 'lbs', comparisonType: 'gte', updatedBy: 'Admin user', updatedAt: new Date('2026-01-28T23:07:39.471Z') },
  { id: 5, metricType: 'volume', metricName: 'die_cut_2', targetValue: 6000.00, unit: 'lbs', comparisonType: 'gte', updatedBy: 'Admin user', updatedAt: new Date('2026-01-28T23:07:39.471Z') },
  { id: 6, metricType: 'volume', metricName: 'total', targetValue: 12000.00, unit: 'lbs', comparisonType: 'gte', updatedBy: 'Admin user', updatedAt: new Date('2026-01-28T23:07:39.471Z') },
  { id: 7, metricType: 'waste', metricName: 'die_cut_1', targetValue: 3.00, unit: '%', comparisonType: 'lte', updatedBy: 'Admin user', updatedAt: new Date('2026-01-28T23:07:39.471Z') },
  { id: 8, metricType: 'waste', metricName: 'die_cut_2', targetValue: 3.00, unit: '%', comparisonType: 'lte', updatedBy: 'Admin user', updatedAt: new Date('2026-01-28T23:07:39.471Z') },
  { id: 9, metricType: 'waste', metricName: 'total', targetValue: 3.00, unit: '%', comparisonType: 'lte', updatedBy: 'Admin user', updatedAt: new Date('2026-01-28T23:07:39.471Z') },
];

const kpiTargetsHistory = [
  { id: 1, metricType: 'oee', metricName: 'die_cut_1', oldValue: 70.00, newValue: 74.00, changedBy: 'Admin user', changedAt: new Date('2026-01-28T22:33:52.865Z') },
  { id: 2, metricType: 'oee', metricName: 'die_cut_2', oldValue: 70.00, newValue: 74.00, changedBy: 'Admin user', changedAt: new Date('2026-01-28T22:33:52.865Z') },
  { id: 3, metricType: 'oee', metricName: 'total', oldValue: 70.00, newValue: 74.00, changedBy: 'Admin user', changedAt: new Date('2026-01-28T22:33:52.865Z') },
  { id: 4, metricType: 'waste', metricName: 'die_cut_1', oldValue: 3.75, newValue: 3.00, changedBy: 'Admin user', changedAt: new Date('2026-01-28T22:33:52.865Z') },
  { id: 5, metricType: 'waste', metricName: 'die_cut_2', oldValue: 3.75, newValue: 3.00, changedBy: 'Admin user', changedAt: new Date('2026-01-28T22:33:52.865Z') },
  { id: 6, metricType: 'waste', metricName: 'total', oldValue: 3.75, newValue: 3.00, changedBy: 'Admin user', changedAt: new Date('2026-01-28T22:33:52.865Z') },
  { id: 7, metricType: 'oee', metricName: 'die_cut_1', oldValue: 74.00, newValue: 60.00, changedBy: 'Admin user', changedAt: new Date('2026-01-28T23:05:13.663Z') },
  { id: 8, metricType: 'oee', metricName: 'die_cut_2', oldValue: 74.00, newValue: 60.00, changedBy: 'Admin user', changedAt: new Date('2026-01-28T23:05:13.663Z') },
  { id: 9, metricType: 'oee', metricName: 'total', oldValue: 74.00, newValue: 60.00, changedBy: 'Admin user', changedAt: new Date('2026-01-28T23:05:13.663Z') },
  { id: 10, metricType: 'waste', metricName: 'die_cut_1', oldValue: 3.00, newValue: 6.00, changedBy: 'Admin user', changedAt: new Date('2026-01-28T23:06:21.037Z') },
  { id: 11, metricType: 'waste', metricName: 'die_cut_2', oldValue: 3.00, newValue: 6.00, changedBy: 'Admin user', changedAt: new Date('2026-01-28T23:06:21.037Z') },
  { id: 12, metricType: 'waste', metricName: 'total', oldValue: 3.00, newValue: 6.00, changedBy: 'Admin user', changedAt: new Date('2026-01-28T23:06:21.037Z') },
  { id: 13, metricType: 'oee', metricName: 'die_cut_1', oldValue: 60.00, newValue: 74.00, changedBy: 'Admin user', changedAt: new Date('2026-01-28T23:07:39.471Z') },
  { id: 14, metricType: 'oee', metricName: 'die_cut_2', oldValue: 60.00, newValue: 74.00, changedBy: 'Admin user', changedAt: new Date('2026-01-28T23:07:39.471Z') },
  { id: 15, metricType: 'oee', metricName: 'total', oldValue: 60.00, newValue: 74.00, changedBy: 'Admin user', changedAt: new Date('2026-01-28T23:07:39.471Z') },
  { id: 16, metricType: 'waste', metricName: 'die_cut_1', oldValue: 6.00, newValue: 3.00, changedBy: 'Admin user', changedAt: new Date('2026-01-28T23:07:39.471Z') },
  { id: 17, metricType: 'waste', metricName: 'die_cut_2', oldValue: 6.00, newValue: 3.00, changedBy: 'Admin user', changedAt: new Date('2026-01-28T23:07:39.471Z') },
  { id: 18, metricType: 'waste', metricName: 'total', oldValue: 6.00, newValue: 3.00, changedBy: 'Admin user', changedAt: new Date('2026-01-28T23:07:39.471Z') },
];

async function seed() {
  console.log('🌱 Seeding bakery admin data...');

  // Check existing data first
  const existingTargets = await prisma.bakeryKpiTarget.count();
  const existingHistory = await prisma.bakeryKpiTargetHistory.count();

  console.log(`  Existing KPI targets: ${existingTargets}`);
  console.log(`  Existing KPI history: ${existingHistory}`);

  if (existingTargets > 0) {
    console.log('  ⚠️  KPI targets already exist — skipping to preserve live data.');
  } else {
    for (const t of kpiTargets) {
      await prisma.bakeryKpiTarget.create({
        data: {
          metricType: t.metricType,
          metricName: t.metricName,
          targetValue: t.targetValue,
          unit: t.unit,
          comparisonType: t.comparisonType,
          updatedBy: t.updatedBy,
          updatedAt: t.updatedAt,
        },
      });
    }
    console.log(`  ✅ Seeded ${kpiTargets.length} KPI targets`);
  }

  if (existingHistory > 0) {
    console.log('  ⚠️  KPI history already exists — skipping to preserve live data.');
  } else {
    for (const h of kpiTargetsHistory) {
      await prisma.bakeryKpiTargetHistory.create({
        data: {
          metricType: h.metricType,
          metricName: h.metricName,
          oldValue: h.oldValue,
          newValue: h.newValue,
          changedBy: h.changedBy,
          changedAt: h.changedAt,
        },
      });
    }
    console.log(`  ✅ Seeded ${kpiTargetsHistory.length} KPI history records`);
  }

  console.log('🌱 Done!');
}

seed()
  .catch((e) => {
    console.error('Error seeding:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
