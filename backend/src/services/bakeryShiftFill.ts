/**
 * Adding a shift that is missing to a day that already has a record (Gerald, 2026-11-10: the Submit Daily Metrics
 * window "should detect that there is missing fields for second or first shift Records and say so and allow users to
 * submit missing records").
 *
 * A day is one record. When First Shift was sent and Second Shift was not, the Second Shift numbers are added to that
 * same record, and the both-shifts numbers are made once the day has both. It is never a second record for the day:
 * the report, the tracker and the charts read one record per day (the newest), so a second one would hide the shift
 * that was already in. A shift that is already in is refused, so nothing is overwritten.
 * No database here, so the rules are tested on their own.
 */

export type ShiftName = 'first' | 'second';

/** Which shifts a day's record holds, or which shifts are being sent. */
export interface DayShifts {
  first: boolean;
  second: boolean;
}

export type ShiftSavePlan =
  /** The day has no record yet: make one. */
  | { kind: 'new' }
  /** Add the shifts sent to the day's record; `combine` when the day then has both shifts. */
  | { kind: 'add'; submissionId: string; combine: boolean }
  /** These shifts are already in for the day: refuse, so nothing is overwritten. */
  | { kind: 'taken'; shifts: ShiftName[] };

const SHIFTS: readonly ShiftName[] = ['first', 'second'];

export function planShiftSave(existing: (DayShifts & { id: string }) | null, sent: DayShifts): ShiftSavePlan {
  if (!existing) return { kind: 'new' };

  const taken = SHIFTS.filter((shift) => sent[shift] && existing[shift]);

  if (taken.length) return { kind: 'taken', shifts: taken };

  return {
    kind: 'add',
    submissionId: existing.id,
    combine: (existing.first || sent.first) && (existing.second || sent.second),
  };
}

export const shiftLabel = (shift: ShiftName): string => (shift === 'first' ? 'First Shift' : 'Second Shift');

/** "Second Shift records for Monday are already in." */
export function shiftsAlreadyInMessage(shifts: readonly ShiftName[], dayOfWeek: string): string {
  const names = shifts.length === 2 ? 'First and Second Shift' : shiftLabel(shifts[0]);

  return `${names} records for ${dayOfWeek} are already in.`;
}

/** Thrown when a shift sent is already in for the day; the route answers 409 with its message. */
export class ShiftAlreadyInError extends Error {
  readonly status = 409;

  constructor(readonly shifts: readonly ShiftName[], dayOfWeek: string) {
    super(shiftsAlreadyInMessage(shifts, dayOfWeek));
    this.name = 'ShiftAlreadyInError';
  }
}
