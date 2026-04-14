import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/types';

/* ────────────────────────────────────────────────────────────────────────────
 * Fault Tree Analysis (FTA) Template — Excalidraw 0.18+
 *
 * Top-down logic tree: Top Event → Intermediate Events → Basic Events
 * with AND/OR gate symbols, color-coded tiers, and connector lines.
 * ──────────────────────────────────────────────────────────────────────────── */

let _id = 0;
const uid = () => `fta_${Date.now()}_${++_id}`;
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

/* ── Layout ───────────────────────────────────────────────────────────────── */
const CX = 800;
const BOX_W = 220, BOX_H = 56;
const GATE_SIZE = 48;
const TIER_GAP = 140;

function eventBox(
  x: number, y: number, label: string, sublabel: string,
  stroke: string, bg: string, els: any[]
) {
  els.push(el({
    type: 'rectangle', x, y, width: BOX_W, height: BOX_H,
    strokeColor: stroke, backgroundColor: bg,
    roundness: { type: 3, value: 10 },
  }));
  els.push(el({
    type: 'text', x: x + 8, y: y + 6, width: BOX_W - 16, height: 20,
    text: label, fontSize: 13, fontFamily: 1,
    textAlign: 'center', strokeColor: stroke,
  }));
  els.push(el({
    type: 'text', x: x + 8, y: y + 28, width: BOX_W - 16, height: 22,
    text: sublabel, fontSize: 12, fontFamily: 1,
    textAlign: 'center', strokeColor: COL.slate,
  }));
}

function basicEvent(
  cx: number, cy: number, label: string,
  stroke: string, bg: string, els: any[]
) {
  const r = 42;
  els.push(el({
    type: 'ellipse', x: cx - r, y: cy - r, width: r * 2, height: r * 2,
    strokeColor: stroke, backgroundColor: bg,
  }));
  els.push(el({
    type: 'text', x: cx - r + 6, y: cy - 12, width: r * 2 - 12, height: 24,
    text: label, fontSize: 11, fontFamily: 1,
    textAlign: 'center', strokeColor: stroke,
  }));
}

function gateSymbol(
  cx: number, cy: number, gateType: 'OR' | 'AND', els: any[]
) {
  const g = GATE_SIZE;
  if (gateType === 'OR') {
    // OR gate — curved bottom (simplified as ellipse)
    els.push(el({
      type: 'ellipse', x: cx - g / 2, y: cy - g / 2, width: g, height: g,
      strokeColor: COL.blue, backgroundColor: BG.blue,
    }));
    els.push(el({
      type: 'text', x: cx - g / 2, y: cy - g / 2, width: g, height: g,
      text: 'OR', fontSize: 14, fontFamily: 1,
      textAlign: 'center', verticalAlign: 'middle', strokeColor: COL.blue,
    }));
  } else {
    // AND gate — flat bottom (simplified as rectangle)
    els.push(el({
      type: 'rectangle', x: cx - g / 2, y: cy - g / 2, width: g, height: g,
      strokeColor: COL.violet, backgroundColor: BG.violet,
      roundness: { type: 3, value: 6 },
    }));
    els.push(el({
      type: 'text', x: cx - g / 2, y: cy - g / 2, width: g, height: g,
      text: 'AND', fontSize: 13, fontFamily: 1,
      textAlign: 'center', verticalAlign: 'middle', strokeColor: COL.violet,
    }));
  }
}

function connector(x1: number, y1: number, x2: number, y2: number, els: any[], dashed = false) {
  els.push(el({
    type: 'arrow', x: x1, y: y1,
    width: x2 - x1, height: y2 - y1,
    points: [[0, 0], [x2 - x1, y2 - y1]],
    strokeColor: COL.gray, strokeWidth: 1.5,
    startArrowhead: null, endArrowhead: 'arrow',
    ...(dashed ? { strokeStyle: 'dashed' } : {}),
  }));
}

export function applyFaultTreeTemplate(api: ExcalidrawImperativeAPI) {
  _id = 0;
  const els: any[] = [];

  /* ── Title ────────────────────────────────────────────────────────────── */
  els.push(el({
    type: 'text', x: CX - 250, y: 20, width: 500, height: 40,
    text: 'Fault Tree Analysis (FTA)', fontSize: 28, fontFamily: 1,
    textAlign: 'center', strokeColor: COL.navy,
  }));

  /* ── TIER 0: Top Event ────────────────────────────────────────────────── */
  const t0y = 90;
  eventBox(CX - BOX_W / 2, t0y, 'TOP EVENT', 'System failure / undesired outcome', COL.red, BG.red, els);

  /* ── Connector to OR gate ─────────────────────────────────────────────── */
  const g1y = t0y + BOX_H + 55;
  connector(CX, t0y + BOX_H, CX, g1y - GATE_SIZE / 2, els);
  gateSymbol(CX, g1y, 'OR', els);

  /* ── TIER 1: Intermediate Events ──────────────────────────────────────── */
  const t1y = g1y + GATE_SIZE / 2 + 50;
  const t1Positions = [CX - 320, CX - BOX_W / 2, CX + 320 - BOX_W];

  // Left intermediate
  connector(CX - GATE_SIZE / 2, g1y, t1Positions[0] + BOX_W / 2, t1y, els);
  eventBox(t1Positions[0], t1y, 'INTERMEDIATE A', 'Sub-system failure mode', COL.orange, BG.orange, els);

  // Center intermediate
  connector(CX, g1y + GATE_SIZE / 2, CX, t1y, els);
  eventBox(t1Positions[1], t1y, 'INTERMEDIATE B', 'Process breakdown', COL.amber, BG.amber, els);

  // Right intermediate
  connector(CX + GATE_SIZE / 2, g1y, t1Positions[2] + BOX_W / 2, t1y, els);
  eventBox(t1Positions[2], t1y, 'INTERMEDIATE C', 'Human/environmental factor', COL.teal, BG.teal, els);

  /* ── AND gates under A and B ──────────────────────────────────────────── */
  const g2y = t1y + BOX_H + 55;
  const gAx = t1Positions[0] + BOX_W / 2;
  const gBx = t1Positions[1] + BOX_W / 2;

  connector(gAx, t1y + BOX_H, gAx, g2y - GATE_SIZE / 2, els);
  gateSymbol(gAx, g2y, 'AND', els);

  connector(gBx, t1y + BOX_H, gBx, g2y - GATE_SIZE / 2, els);
  gateSymbol(gBx, g2y, 'OR', els);

  /* ── TIER 2: Basic Events (leaves) ────────────────────────────────────── */
  const t2y = g2y + GATE_SIZE / 2 + 65;

  // Under AND gate A
  const aL = gAx - 90, aR = gAx + 90;
  connector(gAx - GATE_SIZE / 4, g2y + GATE_SIZE / 2, aL, t2y - 42, els);
  connector(gAx + GATE_SIZE / 4, g2y + GATE_SIZE / 2, aR, t2y - 42, els);
  basicEvent(aL, t2y, 'Basic\nEvent 1', COL.green, BG.green, els);
  basicEvent(aR, t2y, 'Basic\nEvent 2', COL.green, BG.green, els);

  // Under OR gate B
  const bL = gBx - 90, bR = gBx + 90;
  connector(gBx - GATE_SIZE / 4, g2y + GATE_SIZE / 2, bL, t2y - 42, els);
  connector(gBx + GATE_SIZE / 4, g2y + GATE_SIZE / 2, bR, t2y - 42, els);
  basicEvent(bL, t2y, 'Basic\nEvent 3', COL.blue, BG.blue, els);
  basicEvent(bR, t2y, 'Basic\nEvent 4', COL.blue, BG.blue, els);

  // Under C (direct basic events)
  const cX = t1Positions[2] + BOX_W / 2;
  const cL = cX - 80, cR = cX + 80;
  connector(cX - 30, t1y + BOX_H, cL, t2y - 42, els, true);
  connector(cX + 30, t1y + BOX_H, cR, t2y - 42, els, true);
  basicEvent(cL, t2y, 'Basic\nEvent 5', COL.teal, BG.teal, els);
  basicEvent(cR, t2y, 'Basic\nEvent 6', COL.teal, BG.teal, els);

  /* ── Legend ───────────────────────────────────────────────────────────── */
  const lx = 60, ly = t2y + 80;
  els.push(el({
    type: 'text', x: lx, y: ly, width: 300, height: 20,
    text: 'LEGEND', fontSize: 14, fontFamily: 1,
    textAlign: 'left', strokeColor: COL.navy,
  }));
  // OR
  els.push(el({
    type: 'ellipse', x: lx, y: ly + 28, width: 24, height: 24,
    strokeColor: COL.blue, backgroundColor: BG.blue,
  }));
  els.push(el({
    type: 'text', x: lx, y: ly + 28, width: 24, height: 24,
    text: 'OR', fontSize: 8, textAlign: 'center', verticalAlign: 'middle',
    strokeColor: COL.blue, fontFamily: 1,
  }));
  els.push(el({
    type: 'text', x: lx + 32, y: ly + 30, width: 200, height: 20,
    text: 'OR Gate — any input causes output', fontSize: 12, fontFamily: 1,
    textAlign: 'left', strokeColor: COL.slate,
  }));
  // AND
  els.push(el({
    type: 'rectangle', x: lx, y: ly + 58, width: 24, height: 24,
    strokeColor: COL.violet, backgroundColor: BG.violet,
    roundness: { type: 3, value: 4 },
  }));
  els.push(el({
    type: 'text', x: lx, y: ly + 58, width: 24, height: 24,
    text: 'AND', fontSize: 7, textAlign: 'center', verticalAlign: 'middle',
    strokeColor: COL.violet, fontFamily: 1,
  }));
  els.push(el({
    type: 'text', x: lx + 32, y: ly + 60, width: 250, height: 20,
    text: 'AND Gate — all inputs required for output', fontSize: 12, fontFamily: 1,
    textAlign: 'left', strokeColor: COL.slate,
  }));
  // Basic Event
  els.push(el({
    type: 'ellipse', x: lx, y: ly + 88, width: 24, height: 24,
    strokeColor: COL.green, backgroundColor: BG.green,
  }));
  els.push(el({
    type: 'text', x: lx + 32, y: ly + 90, width: 250, height: 20,
    text: 'Basic Event — root-level cause (leaf)', fontSize: 12, fontFamily: 1,
    textAlign: 'left', strokeColor: COL.slate,
  }));

  api.updateScene({ elements: [...api.getSceneElements(), ...els] });
  api.scrollToContent(els as any, { fitToViewport: true, viewportZoomFactor: 0.85 });
}
