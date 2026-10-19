import assert from 'node:assert/strict';
import { test } from 'node:test';
import { averageOfRan, combineShifts, shiftsByDay } from '../src/services/bakeryShiftCombine';

test('a shift at 0 did not run: the other shift is the average (Gerald: 86% and 0% is 86%)', () => {
  assert.equal(averageOfRan([86, 0]), 86);
  assert.equal(averageOfRan([0, 86]), 86);
  assert.equal(averageOfRan([86, 70]), 78);
  assert.equal(averageOfRan([0, 0]), 0);
  assert.equal(averageOfRan([null, undefined, '75.5']), 75.5);
  assert.equal(averageOfRan([{ toString: () => '80' }, 'not a number']), 80);
});

test('Monday Aug 31: Die Cut 2 ran only on 1st shift, so it stays at 76.2%, not 38.1%', () => {
  const both = combineShifts([
    { dieCut1OeePct: 99.2, dieCut2OeePct: 76.2 },
    { dieCut1OeePct: 100, dieCut2OeePct: 0 },
  ]);

  assert.equal(both.dieCut1OeePct, 99.6);
  assert.equal(both.dieCut2OeePct, 76.2);
  assert.equal(both.oeeAvgPct, (99.6 + 76.2) / 2);
});

test('Tuesday Sep 8: Die Cut 1 ran only on 1st shift, so it stays at 80.7%', () => {
  const both = combineShifts([
    { dieCut1OeePct: 80.7, dieCut2OeePct: 81.2 },
    { dieCut1OeePct: 0, dieCut2OeePct: 75.3 },
  ]);

  assert.equal(both.dieCut1OeePct, 80.7);
  assert.ok(Math.abs(both.dieCut2OeePct - 78.25) < 1e-9);
});

test('a line that did not run all day is 0, and the day\'s average is the other line alone', () => {
  const both = combineShifts([{ dieCut1OeePct: 90, dieCut2OeePct: 0 }, { dieCut1OeePct: 80, dieCut2OeePct: 0 }]);

  assert.equal(both.dieCut2OeePct, 0);
  assert.equal(both.oeeAvgPct, 85);
});

test('pounds add up and waste % is waste over pounds, as before', () => {
  const both = combineShifts([
    { dieCut1Lbs: 1000, dieCut1WasteLb: 20, dieCut2Lbs: 500, dieCut2WasteLb: 10 },
    { dieCut1Lbs: 1000, dieCut1WasteLb: 40, dieCut2Lbs: 0, dieCut2WasteLb: 0 },
  ]);

  assert.equal(both.dieCut1Lbs, 2000);
  assert.equal(both.poundsTotal, 2500);
  assert.equal(both.dieCut1WastePct, 3);
  assert.equal(both.dieCut2WastePct, 2, 'the shift that did not run adds nothing');
  assert.equal(both.wasteAvgPct, (70 / 2500) * 100);
});

test('one shift saved: its own numbers', () => {
  const both = combineShifts([{ dieCut1OeePct: 70, dieCut2OeePct: 60 }, null]);

  assert.equal(both.dieCut1OeePct, 70);
  assert.equal(both.oeeAvgPct, 65);
});

test('a day saved one shift at a time is one day; a shift saved again counts once, the latest', () => {
  const days = shiftsByDay([
    { createdAt: '2026-09-01T10:00:00Z', dayOfWeek: 'Monday', firstShiftMetrics: { dieCut1OeePct: 50 } },
    { createdAt: '2026-09-01T22:00:00Z', dayOfWeek: 'Monday', secondShiftMetrics: { dieCut1OeePct: 90 } },
    { createdAt: '2026-09-01T23:00:00Z', dayOfWeek: 'Monday', firstShiftMetrics: { dieCut1OeePct: 80 } },
    { createdAt: '2026-09-02T10:00:00Z', dayOfWeek: 'Tuesday', firstShiftMetrics: { dieCut1OeePct: 70 }, secondShiftMetrics: { dieCut1OeePct: 0 } },
  ]);

  assert.equal(days.length, 2);
  assert.equal(combineShifts([days[0].first, days[0].second]).dieCut1OeePct, 85);
  assert.equal(combineShifts([days[1].first, days[1].second]).dieCut1OeePct, 70);
});
