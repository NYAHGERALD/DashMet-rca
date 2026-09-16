/**
 * How the week under each pair of bars is written.
 *
 * The axis used to have exactly one voice — `W40` over `[ 27 - 31 ]` — which is
 * the right shorthand for somebody who lives in this dashboard and no use at all
 * on a slide, in a printed pack, or to anyone who does not already know which
 * month is being discussed. A day range of `27 - 31` is genuinely ambiguous the
 * moment it leaves the screen it was read on.
 *
 * Formatting only. Nothing here changes which days a bar covers — the range is
 * already clipped to the selected period upstream, and these functions are handed
 * the result.
 */

export type WeekNumberStyle = 'short' | 'full' | 'number' | 'weekOf';
export type DayRangeStyle = 'brackets' | 'plain' | 'monthShort' | 'monthFull' | 'numeric';

export const WEEK_NUMBER_STYLES: Array<{ id: WeekNumberStyle; label: string; sample: string }> = [
  { id: 'short', label: 'Short', sample: 'W40' },
  { id: 'full', label: 'Full', sample: 'Week 40' },
  { id: 'number', label: 'Number only', sample: '40' },
  { id: 'weekOf', label: 'Week beginning', sample: 'Week of Jul 27' }
];

export const DAY_RANGE_STYLES: Array<{ id: DayRangeStyle; label: string; sample: string }> = [
  { id: 'brackets', label: 'Brackets', sample: '[ 27 - 31 ]' },
  { id: 'plain', label: 'Plain', sample: '27 - 31' },
  { id: 'monthShort', label: 'With month', sample: 'Jul 27 - 31' },
  { id: 'monthFull', label: 'Full month', sample: 'July 27 - 31' },
  { id: 'numeric', label: 'Numeric dates', sample: '07/27 - 07/31' }
];

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_FULL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export interface WeekLabelParts {
  /** Day of month the range starts on, already clipped to the selected period. */
  dayStart: number;
  dayEnd: number;
  /** `YYYY-MM-DD` for each end of the clipped range. */
  startIso: string;
  endIso: string;
  /** The business week number, or null where no calendar year is configured. */
  weekNumber: number | null;
  /** What the chart called this week before any of this existed. */
  fallbackLabel: string;
}

/**
 * Read as UTC, deliberately.
 *
 * The ISO strings are produced from UTC dates upstream. Parsing them back in
 * local time would shift a date across midnight for anybody west of Greenwich,
 * and a week labelled "Jul 26" when it starts on the 27th is the kind of error
 * nobody reports because it looks like a rounding decision.
 */
function monthIndex(iso: string): number {
  const month = Number(iso.slice(5, 7));

  return Number.isFinite(month) && month >= 1 && month <= 12 ? month - 1 : 0;
}

export function formatWeekNumber(style: WeekNumberStyle, parts: WeekLabelParts): string {
  // No configured calendar year means no week number to dress up. The chart's
  // own label stands rather than inventing one.
  if (parts.weekNumber == null) {
    return parts.fallbackLabel;
  }

  if (style === 'full') {
    return `Week ${parts.weekNumber}`;
  }

  if (style === 'number') {
    return String(parts.weekNumber);
  }

  if (style === 'weekOf') {
    return `Week of ${MONTHS_SHORT[monthIndex(parts.startIso)]} ${parts.dayStart}`;
  }

  return `W${parts.weekNumber}`;
}

export function formatDayRange(style: DayRangeStyle, parts: WeekLabelParts): string {
  const startMonth = monthIndex(parts.startIso);
  const endMonth = monthIndex(parts.endIso);
  const spansMonths = startMonth !== endMonth;

  if (style === 'plain') {
    return `${parts.dayStart} - ${parts.dayEnd}`;
  }

  if (style === 'monthShort' || style === 'monthFull') {
    const names = style === 'monthFull' ? MONTHS_FULL : MONTHS_SHORT;

    /*
     * The closing month is named only when the range crosses one. Repeating it
     * for a week inside a single month — "Jul 27 - Jul 31" — is noise on an axis
     * that has five of these side by side.
     */
    return spansMonths
      ? `${names[startMonth]} ${parts.dayStart} - ${names[endMonth]} ${parts.dayEnd}`
      : `${names[startMonth]} ${parts.dayStart} - ${parts.dayEnd}`;
  }

  if (style === 'numeric') {
    const pad = (value: number) => String(value).padStart(2, '0');

    return `${pad(startMonth + 1)}/${pad(parts.dayStart)} - ${pad(endMonth + 1)}/${pad(parts.dayEnd)}`;
  }

  return `[${parts.dayStart} - ${parts.dayEnd}]`;
}

/**
 * Whether this style draws its own brackets.
 *
 * The axis paints the two square brackets as separate, larger glyphs either side
 * of the numbers, which is what gives the default its look. Every other style
 * wants one plain run of text instead, and a bracket pair left standing around
 * "July 27 - 31" reads as a mistake.
 */
export function dayRangeUsesBrackets(style: DayRangeStyle): boolean {
  return style === 'brackets';
}
