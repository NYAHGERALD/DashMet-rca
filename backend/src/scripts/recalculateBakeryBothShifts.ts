/**
 * Recalculates the stored "both shifts" rows, and each shift's own OEE average, from the shift numbers they were made
 * from (Gerald, 2026-10-19; src/services/bakeryShiftCombine.ts).
 *
 * Every row was saved as (1st + 2nd) / 2, so a line that did not run one shift (0) showed half its OEE: Die Cut 2 at
 * 38.1% on a day it ran at 76.2%. Some rows were also left behind when a missing value was filled in later. The
 * dashboard cards, reports, emails and AI insights read these rows; the charts now work from the shifts themselves.
 *
 * Changes only a value that differs from what its own shift numbers give. Shift numbers themselves are never changed.
 * A dry run is the default and writes nothing. `--apply` writes, one save at a time, each in a transaction.
 *
 * Usage, from backend/:
 *   node --env-file=.env --import tsx src/scripts/recalculateBakeryBothShifts.ts
 *   node --env-file=.env --import tsx src/scripts/recalculateBakeryBothShifts.ts --apply
 */
import { Prisma, PrismaClient } from '@prisma/client';
import { averageOfRan, combineShifts, type CombinedShifts } from '../services/bakeryShiftCombine';

const prisma = new PrismaClient();
const isApply = process.argv.includes('--apply');
const FIELDS: Array<keyof CombinedShifts> = [
  'dieCut1OeePct', 'dieCut2OeePct', 'oeeAvgPct', 'dieCut1Lbs', 'dieCut2Lbs', 'poundsTotal',
  'dieCut1WasteLb', 'dieCut2WasteLb', 'dieCut1WastePct', 'dieCut2WastePct', 'wasteAvgPct',
];

/** Stored to two decimals (three for pounds): a difference smaller than that is not a difference. */
const differs = (stored: unknown, next: number, places = 2) => Math.abs(Number(stored ?? 0) - next) >= 0.5 / 10 ** places;
const placesOf = (field: string) => (/Lbs|WasteLb|poundsTotal/.test(field) ? 3 : 2);
const fmt = (value: unknown) => (value === null || value === undefined ? '-' : Number(value).toFixed(1));

async function main(): Promise<void> {
  const saves = await prisma.bakeryWeekSubmission.findMany({
    include: { firstShiftMetrics: true, secondShiftMetrics: true, bothShiftsMetrics: true },
    orderBy: { createdAt: 'asc' },
  });
  let bothChanged = 0;
  let bothCreated = 0;
  let shiftAveragesChanged = 0;
  const examples: string[] = [];

  console.log(`${isApply ? 'APPLYING' : 'DRY RUN (nothing written)'}: ${saves.length} saved days\n`);

  for (const save of saves) {
    const first = save.firstShiftMetrics;
    const second = save.secondShiftMetrics;
    const both = save.bothShiftsMetrics;
    const writes: Array<(tx: Prisma.TransactionClient) => Promise<unknown>> = [];

    // Each shift's own average of its two lines, leaving out a line at 0.
    for (const [shift, table] of [[first, 'first'], [second, 'second']] as const) {
      if (!shift) continue;

      const next = averageOfRan([shift.dieCut1OeePct, shift.dieCut2OeePct]);

      if (differs(shift.oeeAvgPct, next)) {
        shiftAveragesChanged += 1;
        writes.push((tx) => (table === 'first'
          ? tx.bakeryFirstShiftMetrics.update({ where: { id: shift.id }, data: { oeeAvgPct: next } })
          : tx.bakerySecondShiftMetrics.update({ where: { id: shift.id }, data: { oeeAvgPct: next } })));
      }
    }

    // The both-shifts row, only for a save that holds both shifts (as it was made).
    if (first && second) {
      const next = combineShifts([first, second]);

      if (!both) {
        bothCreated += 1;
        writes.push((tx) => tx.bakeryBothShiftsMetrics.create({ data: { weekSubmissionId: save.id, ...next, submittedBy: save.submittedBy } }));
        if (examples.length < 25) examples.push(`  ${save.weekName} ${save.dayOfWeek}: no both-shifts row -> DC1 ${fmt(next.dieCut1OeePct)} / DC2 ${fmt(next.dieCut2OeePct)}`);
      } else if (FIELDS.some((field) => differs(both[field], next[field], placesOf(field)))) {
        bothChanged += 1;
        writes.push((tx) => tx.bakeryBothShiftsMetrics.update({ where: { id: both.id }, data: next }));
        if (examples.length < 25) {
          examples.push(`  ${save.weekName} ${save.dayOfWeek}: DC1 ${fmt(both.dieCut1OeePct)} -> ${fmt(next.dieCut1OeePct)}, DC2 ${fmt(both.dieCut2OeePct)} -> ${fmt(next.dieCut2OeePct)}, both lines ${fmt(both.oeeAvgPct)} -> ${fmt(next.oeeAvgPct)}`);
        }
      }
    }

    if (isApply && writes.length) {
      await prisma.$transaction(async (tx) => {
        for (const write of writes) await write(tx);
      });
    }
  }

  console.log(examples.join('\n'));
  if (bothChanged + bothCreated > examples.length) console.log(`  … and ${bothChanged + bothCreated - examples.length} more`);
  console.log(`\n${isApply ? 'Changed' : 'Would change'}: ${bothChanged} both-shifts rows, ${bothCreated} created, ${shiftAveragesChanged} shift averages.`);
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
