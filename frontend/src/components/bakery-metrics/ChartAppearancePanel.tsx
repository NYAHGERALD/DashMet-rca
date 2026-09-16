'use client';

import { Lock, RotateCcw, X } from 'lucide-react';

import {
  CHART_PRESETS,
  DEFAULT_CHART_PALETTE,
  canFillOffTargetBars,
  findAlertColourClashes,
  type ChartPalette,
  type ChartPresetId,
  type SeriesColours
} from '@/lib/chartAppearance';

/**
 * Where somebody makes these charts read the way their site reads data.
 *
 * Two rules shaped everything here.
 *
 * **The targets are shown and cannot be touched.** They belong to the
 * organization, they are what the charts are judged against, and a dashboard
 * where the viewer can move the goalposts is not a dashboard. They appear as a
 * locked row so that nobody has to go looking for them, and so the number beside
 * the colours is provably the same number the bars are compared against.
 *
 * **The warning can be restyled but never hidden.** Every colour on this panel
 * is free except in one respect: an alert colour too close to a bar colour
 * withdraws the whole-bar fill, because that mode leans hardest on hue. The
 * outline and its pulse stay in every mode.
 */
export function ChartAppearancePanel({
  onChange,
  onClose,
  onReset,
  oeeTarget,
  palette,
  targetsAreDefaults,
  wasteTarget
}: {
  onChange: (next: ChartPalette) => void;
  onClose: () => void;
  onReset: () => void;
  oeeTarget: number;
  palette: ChartPalette;
  /** True when no target is stored and these are this app's fallbacks. */
  targetsAreDefaults: boolean;
  wasteTarget: number;
}) {
  const clashes = findAlertColourClashes(palette);
  const canFill = canFillOffTargetBars(palette);

  const setSeries = (key: 'dc1' | 'dc2', field: keyof SeriesColours, value: string) =>
    onChange({ ...palette, [key]: { ...palette[key], [field]: value } });

  return (
    <div
      className="period-modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="period-modal-content max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Chart appearance</h3>
            <p className="text-xs text-gray-500">
              Colours apply to both the OEE and the Waste chart, and are remembered on this device.
            </p>
          </div>
          <button
            aria-label="Close"
            className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
            onClick={onClose}
            type="button"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-6 px-6 py-5">
          {/* ── The part nobody may edit ─────────────────────────────────── */}
          <section className="rounded-xl bg-gray-50 p-4">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
              <Lock className="h-3.5 w-3.5" />
              Targets
            </div>
            <div className="flex flex-wrap gap-6">
              <div>
                <div className="text-lg font-bold text-gray-900">{oeeTarget}%</div>
                <div className="text-xs text-gray-500">OEE target</div>
              </div>
              <div>
                <div className="text-lg font-bold text-gray-900">≤{wasteTarget}%</div>
                <div className="text-xs text-gray-500">Waste target</div>
              </div>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              {targetsAreDefaults
                ? 'No target has been set for your organization, so these are the system defaults. An administrator can set them in KPI targets.'
                : 'Set by your administrator in KPI targets. They cannot be changed here.'}
            </p>
          </section>

          {/* ── Presets ──────────────────────────────────────────────────── */}
          <section>
            <h4 className="mb-2 text-sm font-semibold text-gray-900">Palette</h4>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(Object.keys(CHART_PRESETS) as ChartPresetId[]).map((id) => {
                const preset = CHART_PRESETS[id];

                return (
                  <button
                    className="rounded-xl border border-gray-200 p-3 text-left transition hover:border-blue-400 hover:bg-blue-50/40"
                    key={id}
                    onClick={() => onChange(preset.palette)}
                    title={preset.hint}
                    type="button"
                  >
                    <div className="mb-2 flex h-6 items-end gap-1">
                      <span
                        className="w-3 rounded-sm"
                        style={{
                          height: '100%',
                          background: `linear-gradient(to bottom, ${preset.palette.dc1.barTop}, ${preset.palette.dc1.barBottom})`
                        }}
                      />
                      <span
                        className="w-3 rounded-sm"
                        style={{
                          height: '70%',
                          background: `linear-gradient(to bottom, ${preset.palette.dc2.barTop}, ${preset.palette.dc2.barBottom})`
                        }}
                      />
                      <span
                        className="w-3 rounded-sm border-2"
                        style={{ height: '45%', borderColor: preset.palette.alert }}
                      />
                    </div>
                    <div className="text-xs font-semibold text-gray-800">{preset.label}</div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* ── Per line ─────────────────────────────────────────────────── */}
          {([
            ['dc1', 'Die Cut 1'],
            ['dc2', 'Die Cut 2']
          ] as Array<['dc1' | 'dc2', string]>).map(([key, name]) => (
            <section key={key}>
              <h4 className="mb-2 text-sm font-semibold text-gray-900">{name}</h4>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <ColourInput
                  label="Bar top"
                  onChange={(value) => setSeries(key, 'barTop', value)}
                  value={palette[key].barTop}
                />
                <ColourInput
                  label="Bar bottom"
                  onChange={(value) => setSeries(key, 'barBottom', value)}
                  value={palette[key].barBottom}
                />
                <ColourInput
                  hint="Line, its points and its legend key"
                  label="Trend line"
                  onChange={(value) => setSeries(key, 'line', value)}
                  value={palette[key].line}
                />
                <ColourInput
                  label="Labels"
                  onChange={(value) => setSeries(key, 'label', value)}
                  value={palette[key].label}
                />
              </div>
            </section>
          ))}

          {/* ── Conditional formatting ───────────────────────────────────── */}
          <section>
            <h4 className="mb-1 text-sm font-semibold text-gray-900">Outside target</h4>
            <p className="mb-3 text-xs text-gray-500">
              Below target on OEE, above target on Waste. One colour covers both.
            </p>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <ColourInput
                label="Alert colour"
                onChange={(value) => onChange({ ...palette, alert: value })}
                value={palette.alert}
              />
              <ColourInput
                label="OEE target line"
                onChange={(value) => onChange({ ...palette, oeeTargetLine: value })}
                value={palette.oeeTargetLine}
              />
              <ColourInput
                label="Waste target line"
                onChange={(value) => onChange({ ...palette, wasteTargetLine: value })}
                value={palette.wasteTargetLine}
              />
            </div>

            {clashes.length > 0 && (
              <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                This alert colour is close to {clashes.join(' and ')}. Filling the whole bar is
                switched off while that is true — the passing point and the failing point on a
                trend line are the same shape, so colour is the only thing separating them.
              </p>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  checked={palette.offTargetStyle === 'fill'}
                  disabled={!canFill}
                  onChange={(event) =>
                    onChange({
                      ...palette,
                      offTargetStyle: event.target.checked ? 'fill' : 'outline'
                    })
                  }
                  type="checkbox"
                />
                Fill the whole bar as well as outlining it
              </label>

              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  checked={palette.blink}
                  onChange={(event) => onChange({ ...palette, blink: event.target.checked })}
                  type="checkbox"
                />
                Pulse the outline
              </label>
            </div>

            <p className="mt-2 text-xs text-gray-400">
              The outline is always drawn. It is the part of the warning that does not rely on
              telling two colours apart.
            </p>
          </section>
        </div>

        <div className="flex items-center justify-between border-t border-gray-100 px-6 py-4">
          <button
            className="flex items-center gap-2 text-sm font-medium text-gray-500 transition hover:text-gray-800"
            onClick={onReset}
            type="button"
          >
            <RotateCcw className="h-4 w-4" />
            Reset to DashMet default
          </button>
          <button
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
            onClick={onClose}
            type="button"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function ColourInput({
  hint,
  label,
  onChange,
  value
}: {
  hint?: string;
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className="block" title={hint}>
      <span className="mb-1 block text-xs font-medium text-gray-600">{label}</span>
      <span className="flex items-center gap-2 rounded-lg border border-gray-200 px-2 py-1.5">
        <input
          aria-label={label}
          className="h-6 w-6 cursor-pointer rounded border-0 bg-transparent p-0"
          onChange={(event) => onChange(event.target.value)}
          type="color"
          value={value}
        />
        <span className="font-mono text-[11px] uppercase text-gray-500">{value}</span>
      </span>
    </label>
  );
}

/** Kept beside the panel so the reset button and the preset agree on "default". */
export const CHART_APPEARANCE_DEFAULT = DEFAULT_CHART_PALETTE;
