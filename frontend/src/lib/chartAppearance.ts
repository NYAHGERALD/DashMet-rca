/**
 * Who paints what on the Die Cut comparison charts.
 *
 * The colours used to be 66 inline hex literals and 13 Tailwind classes spread
 * across BakeryPeriodOeeChart.tsx, with the OEE chart and the Waste chart each
 * holding their own hand-copied set. Every value here is the literal that file
 * shipped with, so loading the defaults repaints both charts exactly as before.
 *
 * Four colours per production line, not three. The trend line is a different
 * colour from the bar in the shipped design (#3b82f6 against a #2563eb bar), and
 * it paints 21 places: the line itself, its points, its active point, its legend
 * key and its tooltip swatch. Deriving it from the bar looked tempting and is
 * wrong — a user who set Die Cut 2 to orange would have got orange bars with a
 * green trend line, a green legend key and a green tooltip square, and a chart
 * that contradicts itself is worse than one nobody recoloured.
 */

export interface SeriesColours {
  /** Top of the bar's vertical gradient. */
  barTop: string;
  /** Bottom of the bar's vertical gradient. */
  barBottom: string;
  /** Trend line, its dots, its active dot, its legend key and its tooltip swatch. */
  line: string;
  /** The DC1/DC2 caption under the bar and the percentage label above it. */
  label: string;
}

/**
 * How a bar outside its target is marked.
 *
 * `fill` **adds** a filled bar to the outline; it never replaces it. That is not
 * a style preference, it is what keeps the warning honest: the blinking outline
 * is the only part of the signal that does not depend on telling two colours
 * apart, so a mode that dropped it would leave hue as the sole channel — and an
 * alert colour picked close to a bar colour would then make a failing bar and a
 * healthy one identical. The alarm can be restyled. It cannot be hidden.
 */
export type OffTargetStyle = 'outline' | 'fill';

export interface ChartPalette {
  dc1: SeriesColours;
  dc2: SeriesColours;
  /** Everything that says "outside target": outline, dot, dashed trend segment. */
  alert: string;
  offTargetStyle: OffTargetStyle;
  /** The outline pulses. Off for anyone who finds movement on a wall screen distracting. */
  blink: boolean;
  oeeTargetLine: string;
  wasteTargetLine: string;
}

/** Exactly what BakeryPeriodOeeChart.tsx painted before any of this existed. */
export const DEFAULT_CHART_PALETTE: ChartPalette = {
  dc1: { barTop: '#60a5fa', barBottom: '#2563eb', line: '#3b82f6', label: '#1e40af' },
  dc2: { barTop: '#34d399', barBottom: '#059669', line: '#10b981', label: '#047857' },
  alert: '#ef4444',
  offTargetStyle: 'outline',
  blink: true,
  oeeTargetLine: '#6366f1',
  wasteTargetLine: '#f59e0b'
};

export type ChartPresetId = 'dashmet' | 'colourBlindSafe' | 'highContrast' | 'print';

/**
 * Whole palettes, never partial ones.
 *
 * Typed as a complete `ChartPalette` on purpose: a preset that set only the bar
 * colours would leave the trend lines on whatever they were, which is how the
 * colour-blind palette would have quietly kept the green it exists to remove.
 * The compiler now refuses a preset that forgets a field.
 */
export const CHART_PRESETS: Record<ChartPresetId, { label: string; hint: string; palette: ChartPalette }> = {
  dashmet: {
    label: 'DashMet default',
    hint: 'The blue and green this dashboard ships with.',
    palette: DEFAULT_CHART_PALETTE
  },
  colourBlindSafe: {
    label: 'Colour-blind safe',
    hint: 'Blue and orange, with a magenta alert. Red and green are the pair most people cannot separate.',
    palette: {
      dc1: { barTop: '#56a7dc', barBottom: '#0072b2', line: '#0072b2', label: '#00476e' },
      dc2: { barTop: '#f2c25c', barBottom: '#e69f00', line: '#e69f00', label: '#8a6000' },
      alert: '#cc79a7',
      offTargetStyle: 'outline',
      blink: true,
      oeeTargetLine: '#5d3a9b',
      wasteTargetLine: '#8a6000'
    }
  },
  highContrast: {
    label: 'High contrast',
    hint: 'Heavier colours for a screen viewed across the floor.',
    palette: {
      dc1: { barTop: '#2563eb', barBottom: '#1e3a8a', line: '#1d4ed8', label: '#1e3a8a' },
      dc2: { barTop: '#047857', barBottom: '#064e3b', line: '#047857', label: '#064e3b' },
      alert: '#dc2626',
      offTargetStyle: 'fill',
      blink: true,
      oeeTargetLine: '#4338ca',
      wasteTargetLine: '#b45309'
    }
  },
  print: {
    label: 'Greyscale',
    hint: 'For reports that get photocopied. The alert keeps its colour so it survives.',
    palette: {
      dc1: { barTop: '#9ca3af', barBottom: '#4b5563', line: '#4b5563', label: '#1f2937' },
      dc2: { barTop: '#d1d5db', barBottom: '#9ca3af', line: '#9ca3af', label: '#374151' },
      alert: '#111827',
      offTargetStyle: 'outline',
      blink: false,
      oeeTargetLine: '#6b7280',
      wasteTargetLine: '#6b7280'
    }
  }
};

const HEX = /^#[0-9a-fA-F]{6}$/;

function readHex(value: unknown, fallback: string): string {
  return typeof value === 'string' && HEX.test(value) ? value : fallback;
}

function readSeries(value: unknown, fallback: SeriesColours): SeriesColours {
  const raw = (value || {}) as Partial<SeriesColours>;

  return {
    barTop: readHex(raw.barTop, fallback.barTop),
    barBottom: readHex(raw.barBottom, fallback.barBottom),
    line: readHex(raw.line, fallback.line),
    label: readHex(raw.label, fallback.label)
  };
}

/**
 * Builds a usable palette out of whatever was in storage.
 *
 * Merged field by field over the defaults rather than trusted wholesale. A blob
 * written by an older version, half-edited by hand, or truncated would otherwise
 * put `undefined` into a `fill=` attribute, and a bar with no fill is an
 * invisible bar — a colour setting should never be able to empty the chart.
 */
export function normalizeChartPalette(value: unknown): ChartPalette {
  const raw = (value || {}) as Partial<ChartPalette>;

  return {
    dc1: readSeries(raw.dc1, DEFAULT_CHART_PALETTE.dc1),
    dc2: readSeries(raw.dc2, DEFAULT_CHART_PALETTE.dc2),
    alert: readHex(raw.alert, DEFAULT_CHART_PALETTE.alert),
    offTargetStyle: raw.offTargetStyle === 'fill' ? 'fill' : 'outline',
    blink: typeof raw.blink === 'boolean' ? raw.blink : DEFAULT_CHART_PALETTE.blink,
    oeeTargetLine: readHex(raw.oeeTargetLine, DEFAULT_CHART_PALETTE.oeeTargetLine),
    wasteTargetLine: readHex(raw.wasteTargetLine, DEFAULT_CHART_PALETTE.wasteTargetLine)
  };
}

// ── Telling the alarm apart from the bars ────────────────────────────────────

function toRgb(hex: string): { b: number; g: number; r: number } {
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16)
  };
}

/**
 * Straight-line distance in RGB. Crude next to a proper perceptual metric, and
 * enough for the only question being asked: could somebody glance at these two
 * and think they were the same colour.
 */
function colourDistance(a: string, b: string): number {
  const x = toRgb(a);
  const y = toRgb(b);

  return Math.sqrt((x.r - y.r) ** 2 + (x.g - y.g) ** 2 + (x.b - y.b) ** 2);
}

/** Below this, two colours are close enough to be mistaken for each other. */
const ALERT_DISTANCE_FLOOR = 90;

/**
 * Every colour the alert has to be distinguishable from.
 *
 * The bar stops are the obvious ones. The trend colours matter just as much and
 * are easy to forget: the passing dot and the failing dot are the same circle at
 * the same radius with the same white ring, drawn on the same line — hue is the
 * only thing separating them, so an alert close to a line colour erases that
 * distinction completely.
 */
export function findAlertColourClashes(palette: ChartPalette): string[] {
  const candidates: Array<[string, string]> = [
    ['the Die Cut 1 bars', palette.dc1.barBottom],
    ['the Die Cut 1 bars', palette.dc1.barTop],
    ['the Die Cut 1 trend line', palette.dc1.line],
    ['the Die Cut 2 bars', palette.dc2.barBottom],
    ['the Die Cut 2 bars', palette.dc2.barTop],
    ['the Die Cut 2 trend line', palette.dc2.line]
  ];

  return [...new Set(
    candidates
      .filter(([, colour]) => colourDistance(palette.alert, colour) < ALERT_DISTANCE_FLOOR)
      .map(([name]) => name)
  )];
}

/**
 * Whether filling the whole bar may be offered.
 *
 * Withheld while the alert is too close to something it has to be told apart
 * from. The outline survives either way, so the warning never disappears; this
 * only stops the louder option being used to make it harder to see.
 */
export function canFillOffTargetBars(palette: ChartPalette): boolean {
  return findAlertColourClashes(palette).length === 0;
}

/** The palette actually used for rendering, with any unsafe combination softened. */
export function resolveChartPalette(palette: ChartPalette): ChartPalette {
  return canFillOffTargetBars(palette)
    ? palette
    : { ...palette, offTargetStyle: 'outline' };
}
