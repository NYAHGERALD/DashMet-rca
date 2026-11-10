import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { planShiftSave, ShiftAlreadyInError, shiftsAlreadyInMessage } from '../src/services/bakeryShiftFill';

/*
 * Gerald, 2026-11-10: Monday Oct 19 had First Shift in and Second Shift missing, and the Submit Daily Metrics window
 * said "A record already exists" and would not go on. It should say what is missing and let people send it.
 */

const read = (...path: string[]) => readFileSync(resolve(__dirname, '..', ...path), 'utf8');

test('a day with no record gets a new one', () => {
  assert.deepEqual(planShiftSave(null, { first: true, second: false }), { kind: 'new' });
  assert.deepEqual(planShiftSave(null, { first: true, second: true }), { kind: 'new' });
});

test('Monday Oct 19: Second Shift is added to the record that has First Shift, and the day is then combined', () => {
  assert.deepEqual(planShiftSave({ id: 'mon', first: true, second: false }, { first: false, second: true }), {
    kind: 'add',
    submissionId: 'mon',
    combine: true,
  });
  assert.deepEqual(planShiftSave({ id: 'tue', first: false, second: true }, { first: true, second: false }), {
    kind: 'add',
    submissionId: 'tue',
    combine: true,
  });
});

test('a record with no shifts takes what is sent, and is combined only once it has both', () => {
  assert.deepEqual(planShiftSave({ id: 'x', first: false, second: false }, { first: true, second: false }), {
    kind: 'add',
    submissionId: 'x',
    combine: false,
  });
  assert.deepEqual(planShiftSave({ id: 'x', first: false, second: false }, { first: true, second: true }), {
    kind: 'add',
    submissionId: 'x',
    combine: true,
  });
});

test('a shift that is already in is refused, so nothing is overwritten or doubled', () => {
  assert.deepEqual(planShiftSave({ id: 'mon', first: true, second: false }, { first: true, second: false }), {
    kind: 'taken',
    shifts: ['first'],
  });
  assert.deepEqual(planShiftSave({ id: 'mon', first: true, second: true }, { first: true, second: true }), {
    kind: 'taken',
    shifts: ['first', 'second'],
  });
  // Sending both to a day with First Shift in would overwrite First Shift: refused.
  assert.deepEqual(planShiftSave({ id: 'mon', first: true, second: false }, { first: true, second: true }), {
    kind: 'taken',
    shifts: ['first'],
  });
  assert.equal(shiftsAlreadyInMessage(['second'], 'Monday'), 'Second Shift records for Monday are already in.');
  assert.equal(shiftsAlreadyInMessage(['first', 'second'], 'Friday'), 'First and Second Shift records for Friday are already in.');

  const error = new ShiftAlreadyInError(['first'], 'Monday');

  assert.equal(error.status, 409);
  assert.equal(error.message, 'First Shift records for Monday are already in.');
});

test('the save adds to the day\'s newest record and the route answers 409; the check says which shifts are in', () => {
  const service = read('src', 'services', 'bakeryMetricsService.ts');
  const routes = read('src', 'routes', 'bakeryMetricsRoutes.ts');

  assert.match(service, /if \(plan\.kind === 'taken'\) throw new ShiftAlreadyInError\(plan\.shifts, data\.dayOfWeek\);/);
  assert.match(service, /const submission = existing \?\? await tx\.bakeryWeekSubmission\.create\(/);
  assert.match(service, /const first = data\.firstShift \?\? existing\?\.firstShiftMetrics;/);
  assert.match(service, /await tx\.bakeryBothShiftsMetrics\.upsert\(/);
  assert.match(routes, /if \(error instanceof ShiftAlreadyInError\) \{\s*\/\/[^\n]*\n\s*res\.status\(409\)/);
  assert.match(routes, /has_first_shift: !!existing\?\.firstShiftMetrics,\s*has_second_shift: !!existing\?\.secondShiftMetrics,/);
});
