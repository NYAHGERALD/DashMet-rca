import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/types';

/* ────────────────────────────────────────────────────────────────────────────
 * Pareto Chart Template — Excalidraw 0.18+
 *
 * 80/20 horizontal bar chart with ranked cause categories, percentage labels,
 * cumulative line, and the 80% threshold marker. Professional RCA layout.
 * ──────────────────────────────────────────────────────────────────────────── */

let _id = 0;
const uid = () => `par_${Date.now()}_${++_id}`;
const seed = () => Math.floor(Math.random() * 1e6);

const COL = {
  navy: '#1e3a5f', red: '#e03131', orange: '#e8590c',
  amber: '#d97706', green: '#2f9e44', blue: '#1971c2',
  violet: '#7048e8', gray: '#868e96', slate: '#475569',
  teal: '#0c8599',
};
const BG = {
  red: '#fee2e2', orange: '#ffedd5', amber: '#fef3c7',
  green: '#d1fae5', blue: '#dbeafe', violet: '#ede9fe',
  slate: '#f1f5f9', navy: '#e0e7ff', teal: '#ccfbf1',
};

function el(overrides: Partial<ExcalidrawElement> & { type: string }): any {
  return {
    id: uid(), fillStyle: 'solid', strokeWidth: 2, roughness: 0,
    opacity: 100, angle: 0, groupIds: [], boundElements: null,
    updated: Date.now(), link: null, locked: false, seed: seed(),
    version: 1, versionNonce: seed(), isDeleted: false,
    x: 0, y: 0, width: 100, height: 40,
    strokeColor: '#1e1e1e', backgroundColor: 'transparent',
    fontSize: 20, fontFamily: 1, textAlign: 'center',
    verticalAlign: 'middle', baseline: 0,
    containerId: null, originalText: '', lineHeight: 1.25,
    ...overrides,
  };
}

/* ── Data for the chart ───────────────────────────────────────────────────── */
const CAUSES = [
  { label: 'Process Deviation',  pct: 35, color: COL.red,    bg: BG.red },
  { label: 'Equipment Failure',  pct: 25, color: COL.orange, bg: BG.orange },
  { label: 'Training Gap',       pct: 15, color: COL.amber,  bg: BG.amber },
  { label: 'Material Defect',    pct: 10, color: COL.blue,   bg: BG.blue },
  { label: 'Environment',        pct: 8,  color: COL.teal,   bg: BG.teal },
  { label: 'Documentation',      pct: 4,  color: COL.violet, bg: BG.violet },
  { label: 'Other',              pct: 3,  color: COL.gray,   bg: BG.slate },
];

/* ── Layout constants ─────────────────────────────────────────────────────── */
const CHART_X = 260;      // left edge of bars
const CHART_Y = 140;      // top of chart area
const CHART_W = 750;      // max bar width (100%)
const BAR_H = 54;
const BAR_GAP = 14;
const LABEL_W = 200;

export function applyParetoTemplate(api: ExcalidrawImperativeAPI) {
  _id = 0;
  const els: any[] = [];

  /* ── Title ────────────────────────────────────────────────────────────── */
  els.push(el({
    type: 'text', x: CHART_X + CHART_W / 2 - 200, y: 30, width: 400, height: 40,
    text: 'Pareto Analysis — Root Cause Ranking', fontSize: 28, fontFamily: 1,
    textAlign: 'center', strokeColor: COL.navy,
  }));
  els.push(el({
    type: 'text', x: CHART_X + CHART_W / 2 - 220, y: 72, width: 440, height: 24,
    text: 'Focus on the vital few causes that drive 80% of the problem',
    fontSize: 14, fontFamily: 1, textAlign: 'center', strokeColor: COL.slate,
  }));

  /* ── Axis line ────────────────────────────────────────────────────────── */
  els.push(el({
    type: 'line', x: CHART_X, y: CHART_Y - 10,
    width: 0, height: CAUSES.length * (BAR_H + BAR_GAP) + 30,
    points: [[0, 0], [0, CAUSES.length * (BAR_H + BAR_GAP) + 30]],
    strokeColor: COL.slate, strokeWidth: 2,
  }));

  /* ── Bars & labels ────────────────────────────────────────────────────── */
  let cumPct = 0;
  const cumPoints: [number, number][] = [];
  const threshold80Y: number[] = [];

  CAUSES.forEach((c, i) => {
    const by = CHART_Y + i * (BAR_H + BAR_GAP);
    const bw = (c.pct / 100) * CHART_W;
    cumPct += c.pct;

    // Category label (left)
    els.push(el({
      type: 'text', x: CHART_X - LABEL_W - 10, y: by + BAR_H / 2 - 12,
      width: LABEL_W, height: 22,
      text: c.label, fontSize: 14, fontFamily: 1,
      textAlign: 'right', strokeColor: COL.navy,
    }));

    // Bar
    els.push(el({
      type: 'rectangle', x: CHART_X + 2, y: by, width: bw, height: BAR_H,
      strokeColor: c.color, backgroundColor: c.bg,
      roundness: { type: 3, value: 6 },
    }));

    // Percentage inside bar
    els.push(el({
      type: 'text', x: CHART_X + bw / 2 - 25, y: by + BAR_H / 2 - 12,
      width: 50, height: 22,
      text: `${c.pct}%`, fontSize: 16, fontFamily: 1,
      textAlign: 'center', strokeColor: c.color,
    }));

    // Cumulative marker
    const cumX = CHART_X + (cumPct / 100) * CHART_W;
    const cumY = by + BAR_H / 2;
    cumPoints.push([cumX, cumY]);

    // Cumulative percentage label
    els.push(el({
      type: 'text', x: cumX + 8, y: cumY - 10, width: 50, height: 18,
      text: `${cumPct}%`, fontSize: 11, fontFamily: 1,
      textAlign: 'left', strokeColor: COL.amber,
    }));

    // Track where 80% line should go
    if (cumPct >= 80 && threshold80Y.length === 0) {
      threshold80Y.push(by + BAR_H);
    }
  });

  /* ── Cumulative line ──────────────────────────────────────────────────── */
  if (cumPoints.length >= 2) {
    const lineX0 = cumPoints[0][0];
    const lineY0 = cumPoints[0][1];
    const relPoints = cumPoints.map(([px, py]) => [px - lineX0, py - lineY0] as [number, number]);
    els.push(el({
      type: 'line', x: lineX0, y: lineY0,
      width: relPoints[relPoints.length - 1][0],
      height: relPoints[relPoints.length - 1][1],
      points: relPoints,
      strokeColor: COL.amber, strokeWidth: 2.5,
    }));
    // Dots on cumulative line
    cumPoints.forEach(([px, py]) => {
      els.push(el({
        type: 'ellipse', x: px - 5, y: py - 5, width: 10, height: 10,
        strokeColor: COL.amber, backgroundColor: BG.amber,
      }));
    });
  }

  /* ── 80% threshold line ───────────────────────────────────────────────── */
  const thr80x = CHART_X + 0.8 * CHART_W;
  els.push(el({
    type: 'line', x: thr80x, y: CHART_Y - 20,
    width: 0, height: CAUSES.length * (BAR_H + BAR_GAP) + 40,
    points: [[0, 0], [0, CAUSES.length * (BAR_H + BAR_GAP) + 40]],
    strokeColor: COL.red, strokeWidth: 2, strokeStyle: 'dashed',
  }));
  els.push(el({
    type: 'text', x: thr80x - 50, y: CHART_Y - 40, width: 100, height: 18,
    text: '80% Line', fontSize: 13, fontFamily: 1,
    textAlign: 'center', strokeColor: COL.red,
  }));

  /* ── Vital Few / Useful Many annotation ───────────────────────────────── */
  const annY = CHART_Y + CAUSES.length * (BAR_H + BAR_GAP) + 40;
  // Vital few bracket
  els.push(el({
    type: 'rectangle', x: CHART_X, y: annY, width: thr80x - CHART_X, height: 50,
    strokeColor: COL.red, backgroundColor: BG.red, strokeWidth: 1,
    roundness: { type: 3, value: 8 }, opacity: 60,
  }));
  els.push(el({
    type: 'text', x: CHART_X, y: annY + 5, width: thr80x - CHART_X, height: 40,
    text: 'VITAL FEW (~20% of causes → 80% of impact)\nFocus corrective actions here',
    fontSize: 13, fontFamily: 1, textAlign: 'center', strokeColor: COL.red,
  }));
  // Useful many
  els.push(el({
    type: 'rectangle', x: thr80x + 4, y: annY, width: CHART_W - (thr80x - CHART_X), height: 50,
    strokeColor: COL.gray, backgroundColor: BG.slate, strokeWidth: 1,
    roundness: { type: 3, value: 8 }, opacity: 60,
  }));
  els.push(el({
    type: 'text', x: thr80x + 4, y: annY + 5, width: CHART_W - (thr80x - CHART_X), height: 40,
    text: 'USEFUL MANY\nLower priority',
    fontSize: 12, fontFamily: 1, textAlign: 'center', strokeColor: COL.gray,
  }));

  /* ── Percentage scale at top ──────────────────────────────────────────── */
  for (let p = 0; p <= 100; p += 20) {
    const sx = CHART_X + (p / 100) * CHART_W;
    els.push(el({
      type: 'text', x: sx - 18, y: CHART_Y - 30, width: 36, height: 16,
      text: `${p}%`, fontSize: 10, fontFamily: 1,
      textAlign: 'center', strokeColor: COL.gray,
    }));
    if (p > 0 && p < 100) {
      els.push(el({
        type: 'line', x: sx, y: CHART_Y - 12, width: 0, height: 8,
        points: [[0, 0], [0, 8]], strokeColor: COL.gray, strokeWidth: 1,
      }));
    }
  }

  api.updateScene({ elements: [...api.getSceneElements(), ...els] });
  api.scrollToContent(els as any, { fitToViewport: true, viewportZoomFactor: 0.9 });
}
