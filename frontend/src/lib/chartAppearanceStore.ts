import {
  DEFAULT_CHART_PALETTE,
  normalizeChartPalette,
  type ChartPalette
} from './chartAppearance';

/**
 * Where a person's chart colours are kept.
 *
 * `localStorage`, the way `bakeryFormDraft` and `bakeryShiftSubmitReady` already
 * are in this folder. These are one person's preferences about one screen on one
 * machine — nothing here belongs in the database, and a colour choice that
 * needed a round trip would be a colour choice nobody made twice.
 *
 * The key carries a version and the user id. The version is the way out if the
 * shape ever changes; the user id is because a shared plant terminal is the
 * normal case here, not the exception, and one supervisor's greyscale should not
 * greet the next one.
 */

const KEY_PREFIX = 'dashmet.chartPalette.v1';

function storageKey(userId: string | null | undefined): string {
  return userId ? `${KEY_PREFIX}:${userId}` : KEY_PREFIX;
}

/**
 * Reads the saved palette, or the defaults.
 *
 * Every failure returns the defaults rather than throwing. Storage can be
 * unavailable — private windows, a browser set to block site data — and a
 * dashboard that will not draw because it could not read a colour preference
 * would be a poor trade.
 */
export function readChartPalette(userId: string | null | undefined): ChartPalette {
  if (typeof window === 'undefined') {
    return DEFAULT_CHART_PALETTE;
  }

  try {
    const raw = window.localStorage.getItem(storageKey(userId));

    return raw ? normalizeChartPalette(JSON.parse(raw)) : DEFAULT_CHART_PALETTE;
  } catch {
    return DEFAULT_CHART_PALETTE;
  }
}

export function writeChartPalette(
  userId: string | null | undefined,
  palette: ChartPalette
): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify(palette));
  } catch {
    // Saving is a convenience. The colours are already applied on screen, and
    // failing to remember them must not interrupt what somebody is looking at.
  }
}

export function clearChartPalette(userId: string | null | undefined): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.removeItem(storageKey(userId));
  } catch {
    // As above.
  }
}
