import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/types';

/* ────────────────────────────────────────────────────────────────────────────
 * Current Reality Tree (CRT) Template — Excalidraw 0.18+
 *
 * Theory of Constraints (TOC) thinking-process tool. Bottom-up cause-effect
 * chain: root causes → intermediate effects → undesirable effects (UDEs).
 * Arrows show causal "if…then" relationships. Color-coded tiers.
 * ──────────────────────────────────────────────────────────────────────────── */

let _id = 0;
const uid = () => `crt_${Date.now()}_${++_id}`;
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

/* ── Layout constants ─────────────────────────────────────────────────────── */
const CX = 750;
const BOX_W = 240, BOX_H = 56;
const TIER_GAP = 120;

interface CRTNode {
  label: string;
  sublabel: string;
  x: number;
  y: number;
  stroke: string;
  bg: string;
}

function crtBox(node: CRTNode, els: any[]) {
  els.push(el({
    type: 'rectangle', x: node.x, y: node.y, width: BOX_W, height: BOX_H,
    strokeColor: node.stroke, backgroundColor: node.bg,
    roundness: { type: 3, value: 10 },
  }));
  els.push(el({
    type: 'text', x: node.x + 8, y: node.y + 6, width: BOX_W - 16, height: 22,
    text: node.label, fontSize: 13, fontFamily: 1,
    textAlign: 'center', strokeColor: node.stroke,
  }));
  els.push(el({
    type: 'text', x: node.x + 8, y: node.y + 30, width: BOX_W - 16, height: 18,
    text: node.sublabel, fontSize: 11, fontFamily: 1,
    textAlign: 'center', strokeColor: COL.slate,
  }));
}

function causalArrow(
  fromX: number, fromY: number,
  toX: number, toY: number,
  els: any[], dashed = false
) {
  els.push(el({
    type: 'arrow', x: fromX, y: fromY,
    width: toX - fromX, height: toY - fromY,
    points: [[0, 0], [toX - fromX, toY - fromY]],
    strokeColor: COL.gray, strokeWidth: 1.5,
    startArrowhead: null, endArrowhead: 'arrow',
    ...(dashed ? { strokeStyle: 'dashed' } : {}),
  }));
}

export function applyCurrentRealityTreeTemplate(api: ExcalidrawImperativeAPI) {
  _id = 0;
  const els: any[] = [];

  /* ── Title ────────────────────────────────────────────────────────────── */
  els.push(el({
    type: 'text', x: CX - 260, y: 20, width: 520, height: 40,
    text: 'Current Reality Tree (CRT)', fontSize: 28, fontFamily: 1,
    textAlign: 'center', strokeColor: COL.navy,
  }));
  els.push(el({
    type: 'text', x: CX - 260, y: 62, width: 520, height: 22,
    text: 'Theory of Constraints — Identify core conflicts driving undesirable effects',
    fontSize: 13, fontFamily: 1, textAlign: 'center', strokeColor: COL.slate,
  }));

  /* ── Tier labels (right side) ─────────────────────────────────────────── */
  const tierLabelX = CX + 380;

  /* ── TIER 0 (top): Undesirable Effects (UDEs) ─────────────────────────── */
  const t0y = 110;
  els.push(el({
    type: 'text', x: tierLabelX, y: t0y + 10, width: 180, height: 40,
    text: 'UNDESIRABLE\nEFFECTS (UDEs)', fontSize: 13, fontFamily: 1,
    textAlign: 'left', strokeColor: COL.red,
  }));

  const ude1: CRTNode = { label: 'UDE 1', sublabel: 'Revenue declining quarter-over-quarter', x: CX - BOX_W - 60, y: t0y, stroke: COL.red, bg: BG.red };
  const ude2: CRTNode = { label: 'UDE 2', sublabel: 'Customer churn increasing to 15%', x: CX + 60, y: t0y, stroke: COL.red, bg: BG.red };
  const ude3: CRTNode = { label: 'UDE 3', sublabel: 'Employee burnout & attrition rising', x: CX - BOX_W / 2, y: t0y + BOX_H + 30, stroke: COL.red, bg: BG.red };
  crtBox(ude1, els);
  crtBox(ude2, els);
  crtBox(ude3, els);

  /* ── TIER 1: Intermediate Effects ─────────────────────────────────────── */
  const t1y = t0y + BOX_H * 2 + 30 + TIER_GAP;
  els.push(el({
    type: 'text', x: tierLabelX, y: t1y + 10, width: 180, height: 40,
    text: 'INTERMEDIATE\nEFFECTS', fontSize: 13, fontFamily: 1,
    textAlign: 'left', strokeColor: COL.orange,
  }));

  const ie1: CRTNode = { label: 'Effect A', sublabel: 'Product quality inconsistent', x: CX - BOX_W * 1.5 - 30, y: t1y, stroke: COL.orange, bg: BG.orange };
  const ie2: CRTNode = { label: 'Effect B', sublabel: 'Support response time too slow', x: CX - BOX_W / 2, y: t1y, stroke: COL.orange, bg: BG.orange };
  const ie3: CRTNode = { label: 'Effect C', sublabel: 'Market positioning unclear', x: CX + BOX_W / 2 + 30, y: t1y, stroke: COL.amber, bg: BG.amber };
  crtBox(ie1, els);
  crtBox(ie2, els);
  crtBox(ie3, els);

  // Causal arrows: intermediate → UDEs
  causalArrow(ie1.x + BOX_W / 2, ie1.y, ude1.x + BOX_W / 2, ude1.y + BOX_H, els);
  causalArrow(ie2.x + BOX_W / 2, ie2.y, ude3.x + BOX_W / 2, ude3.y + BOX_H, els);
  causalArrow(ie2.x + BOX_W, ie2.y + 10, ude2.x + BOX_W / 2, ude2.y + BOX_H, els);
  causalArrow(ie3.x + BOX_W / 2, ie3.y, ude2.x + BOX_W / 2, ude2.y + BOX_H, els);
  causalArrow(ie1.x + BOX_W, ie1.y + 10, ude3.x, ude3.y + BOX_H, els);

  /* ── "AND" ellipse between converging arrows ─────────────────────────── */
  const andY = (ie2.y + ude3.y + BOX_H) / 2;
  els.push(el({
    type: 'ellipse', x: CX - 18, y: andY - 14, width: 36, height: 28,
    strokeColor: COL.violet, backgroundColor: BG.violet,
  }));
  els.push(el({
    type: 'text', x: CX - 18, y: andY - 14, width: 36, height: 28,
    text: 'AND', fontSize: 9, fontFamily: 1,
    textAlign: 'center', verticalAlign: 'middle', strokeColor: COL.violet,
  }));

  /* ── TIER 2: Contributing Causes ──────────────────────────────────────── */
  const t2y = t1y + TIER_GAP + BOX_H;
  els.push(el({
    type: 'text', x: tierLabelX, y: t2y + 10, width: 180, height: 40,
    text: 'CONTRIBUTING\nCAUSES', fontSize: 13, fontFamily: 1,
    textAlign: 'left', strokeColor: COL.blue,
  }));

  const cc1: CRTNode = { label: 'Cause 1', sublabel: 'No standardized QA process', x: CX - BOX_W * 2 - 10, y: t2y, stroke: COL.blue, bg: BG.blue };
  const cc2: CRTNode = { label: 'Cause 2', sublabel: 'Understaffed support team', x: CX - BOX_W / 2, y: t2y, stroke: COL.blue, bg: BG.blue };
  const cc3: CRTNode = { label: 'Cause 3', sublabel: 'Unclear target market', x: CX + BOX_W + 10, y: t2y, stroke: COL.teal, bg: BG.teal };
  crtBox(cc1, els);
  crtBox(cc2, els);
  crtBox(cc3, els);

  causalArrow(cc1.x + BOX_W / 2, cc1.y, ie1.x + BOX_W / 2, ie1.y + BOX_H, els);
  causalArrow(cc2.x + BOX_W / 2, cc2.y, ie2.x + BOX_W / 2, ie2.y + BOX_H, els);
  causalArrow(cc3.x + BOX_W / 2, cc3.y, ie3.x + BOX_W / 2, ie3.y + BOX_H, els);
  causalArrow(cc1.x + BOX_W, cc1.y + 10, ie2.x, ie2.y + BOX_H, els, true);

  /* ── TIER 3: Root Causes (bottom) ─────────────────────────────────────── */
  const t3y = t2y + TIER_GAP + BOX_H;
  els.push(el({
    type: 'text', x: tierLabelX, y: t3y + 10, width: 180, height: 40,
    text: '🔍 ROOT\nCAUSES', fontSize: 13, fontFamily: 1,
    textAlign: 'left', strokeColor: COL.green,
  }));

  const rc1: CRTNode = { label: '🔴 Root Cause 1', sublabel: 'Rapid scaling without process maturity', x: CX - BOX_W - 40, y: t3y, stroke: COL.green, bg: BG.green };
  const rc2: CRTNode = { label: '🔴 Root Cause 2', sublabel: 'Lack of strategic planning discipline', x: CX + 40, y: t3y, stroke: COL.green, bg: BG.green };
  crtBox(rc1, els);
  crtBox(rc2, els);

  causalArrow(rc1.x + BOX_W / 2, rc1.y, cc1.x + BOX_W / 2, cc1.y + BOX_H, els);
  causalArrow(rc1.x + BOX_W, rc1.y + 10, cc2.x, cc2.y + BOX_H, els);
  causalArrow(rc2.x + BOX_W / 2, rc2.y, cc3.x + BOX_W / 2, cc3.y + BOX_H, els);
  causalArrow(rc2.x, rc2.y + 10, cc2.x + BOX_W, cc2.y + BOX_H, els, true);

  /* ── Reading direction arrow ──────────────────────────────────────────── */
  els.push(el({
    type: 'text', x: 60, y: (t0y + t3y + BOX_H) / 2 - 60, width: 120, height: 120,
    text: 'READ\n↑\nBottom\nto\nTop\n\n"If… Then…"',
    fontSize: 12, fontFamily: 1, textAlign: 'center', strokeColor: COL.gray,
  }));

  api.updateScene({ elements: [...api.getSceneElements(), ...els] });
  api.scrollToContent(els as any, { fitToViewport: true, viewportZoomFactor: 0.85 });
}
