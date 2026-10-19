/**
 * How a day's two shifts are put together for each Die Cut line (Gerald, 2026-10-19).
 *
 * A 0, or no value, means the line did not run that shift, or it was a holiday. It is left out, never averaged in:
 * 86% on 1st shift and 0% on 2nd is 86%, not 43%. Before this, every "both shifts" OEE was (1st + 2nd) / 2, so a line
 * that ran one shift showed half its real OEE, and the period chart drew Die Cut 2 at about 40% when it ran near 80%.
 *
 * Pounds and waste pounds add up, and waste % is waste pounds over pounds, so a shift that did not run (0 lb)
 * already counts for nothing there and waste was never halved. A shift with pounds but 0 waste has not had its waste
 * entered (the report shows "Missing Data?"), so its pounds are left out of the waste %, rather than thinning it.
 * No database here, so the rules are tested on their own.
 */

/** Anything a stored value can be: a number, a Prisma Decimal, a string, or nothing. */
type Stored = unknown;

const numberOf = (value: Stored): number => {
  if (value === null || value === undefined) return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

/** The average of the values that ran: 0 and missing values are left out. 0 when none ran. */
export function averageOfRan(values: readonly Stored[]): number {
  const ran = values.map(numberOf).filter((value) => value > 0);

  return ran.length ? ran.reduce((sum, value) => sum + value, 0) / ran.length : 0;
}

/** One shift's numbers for the two lines, as stored or as sent. */
export interface ShiftLines {
  dieCut1OeePct?: Stored;
  dieCut2OeePct?: Stored;
  dieCut1Lbs?: Stored;
  dieCut2Lbs?: Stored;
  dieCut1WasteLb?: Stored;
  dieCut2WasteLb?: Stored;
}

export interface CombinedShifts {
  dieCut1OeePct: number;
  dieCut2OeePct: number;
  /** Die Cut 1 and Die Cut 2 together, leaving out a line that did not run at all. */
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

const sumOf = (values: readonly Stored[]): number => values.reduce<number>((sum, value) => sum + numberOf(value), 0);
const percentOf = (part: number, whole: number): number => (whole > 0 ? (part / whole) * 100 : 0);

/** Waste over pounds, from the shifts where a line has both: a 0 on either side was not entered. */
const wastePercentOf = (pairs: ReadonlyArray<{ lbs: Stored; waste: Stored }>): number => {
  const entered = pairs.filter((pair) => numberOf(pair.lbs) > 0 && numberOf(pair.waste) > 0);

  return percentOf(sumOf(entered.map((pair) => pair.waste)), sumOf(entered.map((pair) => pair.lbs)));
};

/** The "both shifts" numbers for a day, from whichever of its shifts were saved. */
export function combineShifts(shifts: ReadonlyArray<ShiftLines | null | undefined>): CombinedShifts {
  const saved = shifts.filter((shift): shift is ShiftLines => Boolean(shift));
  const dieCut1OeePct = averageOfRan(saved.map((shift) => shift.dieCut1OeePct));
  const dieCut2OeePct = averageOfRan(saved.map((shift) => shift.dieCut2OeePct));
  const dieCut1Lbs = sumOf(saved.map((shift) => shift.dieCut1Lbs));
  const dieCut2Lbs = sumOf(saved.map((shift) => shift.dieCut2Lbs));
  const dieCut1WasteLb = sumOf(saved.map((shift) => shift.dieCut1WasteLb));
  const dieCut2WasteLb = sumOf(saved.map((shift) => shift.dieCut2WasteLb));
  const line1 = saved.map((shift) => ({ lbs: shift.dieCut1Lbs, waste: shift.dieCut1WasteLb }));
  const line2 = saved.map((shift) => ({ lbs: shift.dieCut2Lbs, waste: shift.dieCut2WasteLb }));

  return {
    dieCut1OeePct,
    dieCut2OeePct,
    oeeAvgPct: averageOfRan([dieCut1OeePct, dieCut2OeePct]),
    dieCut1Lbs,
    dieCut2Lbs,
    poundsTotal: dieCut1Lbs + dieCut2Lbs,
    dieCut1WasteLb,
    dieCut2WasteLb,
    dieCut1WastePct: wastePercentOf(line1),
    dieCut2WastePct: wastePercentOf(line2),
    wasteAvgPct: wastePercentOf([...line1, ...line2]),
  };
}

/** A saved day, as the charts read it: one save may hold one shift or both. */
export interface DaySave {
  dayOfWeek: string;
  createdAt?: Date | string | null;
  firstShiftMetrics?: ShiftLines | null;
  secondShiftMetrics?: ShiftLines | null;
}

/**
 * The days of one week, each with its 1st and 2nd shift. A day saved as two separate shifts is one day, not two; if
 * a shift was saved more than once, the latest save is the one that counts.
 */
export function shiftsByDay(saves: readonly DaySave[]): Array<{ day: string; first: ShiftLines | null; second: ShiftLines | null }> {
  const time = (save: DaySave) => (save.createdAt ? new Date(save.createdAt).getTime() || 0 : 0);
  const days = new Map<string, { day: string; first: ShiftLines | null; second: ShiftLines | null }>();

  for (const save of [...saves].sort((a, b) => time(a) - time(b))) {
    const entry = days.get(save.dayOfWeek) || { day: save.dayOfWeek, first: null, second: null };

    if (save.firstShiftMetrics) entry.first = save.firstShiftMetrics;
    if (save.secondShiftMetrics) entry.second = save.secondShiftMetrics;
    days.set(save.dayOfWeek, entry);
  }

  return [...days.values()];
}
