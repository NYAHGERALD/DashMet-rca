import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/types';

/* ────────────────────────────────────────────────────────────────────────────
 * 5 Whys Analysis Template — Excalidraw 0.18+
 *
 * Cascading drill-down from Problem Statement through 5 "Why?" levels
 * to a Root Cause box, with numbered step badges, connector arrows,
 * and answer text placeholders.
 * ──────────────────────────────────────────────────────────────────────────── */

let _id = 0;
const uid = () => `5w_${Date.now()}_${++_id}`;
const seed = () => Math.floor(Math.random() * 1e6);

const COL = {
  navy: '#1e3a5f', red: '#e03131', orange: '#e8590c',
  amber: '#d97706', green: '#2f9e44', blue: '#1971c2',
  violet: '#7048e8', gray: '#868e96', slate: '#475569',
};
const BG = {
  red: '#fee2e2', orange: '#ffedd5', amber: '#fef3c7',
  green: '#d1fae5', blue: '#dbeafe', violet: '#ede9fe',
  slate: '#f1f5f9', navy: '#e0e7ff',
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
const CX = 700;           // center X for answer/why columns
const PW = 520, PH = 80;  // problem statement box
const WHY_W = 440, WHY_H = 64;
const ANS_W = 440, ANS_H = 52;
const BADGE_R = 22;
const GAP_Y = 32;         // vertical gap between rows
const ARROW_LEN = 28;

const STEP_COLORS = [
  { stroke: COL.blue,   bg: BG.blue,   label: '1st Why' },
  { stroke: COL.orange, bg: BG.orange,  label: '2nd Why' },
  { stroke: COL.amber,  bg: BG.amber,   label: '3rd Why' },
  { stroke: COL.violet, bg: BG.violet,  label: '4th Why' },
  { stroke: COL.red,    bg: BG.red,     label: '5th Why' },
];

export function applyFiveWhysTemplate(api: ExcalidrawImperativeAPI) {
  _id = 0;
  const els: any[] = [];

  /* ── Title ────────────────────────────────────────────────────────────── */
  els.push(el({
    type: 'text', x: CX - 200, y: 20, width: 400, height: 40,
    text: '5 Whys Root Cause Analysis', fontSize: 28, fontFamily: 1,
    textAlign: 'center', strokeColor: COL.navy,
  }));

  /* ── Problem Statement ────────────────────────────────────────────────── */
  const py = 90;
  els.push(el({
    type: 'rectangle', x: CX - PW / 2, y: py, width: PW, height: PH,
    strokeColor: COL.navy, backgroundColor: BG.navy, roundness: { type: 3, value: 12 },
  }));
  els.push(el({
    type: 'text', x: CX - PW / 2 + 10, y: py + 4, width: PW - 20, height: 22,
    text: 'PROBLEM STATEMENT', fontSize: 13, fontFamily: 1,
    textAlign: 'center', strokeColor: COL.navy,
  }));
  els.push(el({
    type: 'text', x: CX - PW / 2 + 20, y: py + 28, width: PW - 40, height: 44,
    text: 'Describe the observed problem or undesirable effect here…',
    fontSize: 16, fontFamily: 1, textAlign: 'center', strokeColor: COL.slate,
  }));

  /* ── Arrow from Problem to first Why ──────────────────────────────────── */
  let curY = py + PH;
  els.push(el({
    type: 'arrow', x: CX, y: curY, width: 0, height: ARROW_LEN,
    points: [[0, 0], [0, ARROW_LEN]],
    strokeColor: COL.gray, strokeWidth: 2,
    startArrowhead: null, endArrowhead: 'arrow',
  }));
  curY += ARROW_LEN;

  /* ── 5 Why levels ─────────────────────────────────────────────────────── */
  for (let i = 0; i < 5; i++) {
    const sc = STEP_COLORS[i];
    const whyY = curY + GAP_Y / 2;

    // Number badge
    els.push(el({
      type: 'ellipse', x: CX - WHY_W / 2 - BADGE_R * 2 - 14, y: whyY + WHY_H / 2 - BADGE_R,
      width: BADGE_R * 2, height: BADGE_R * 2,
      strokeColor: sc.stroke, backgroundColor: sc.bg, roundness: { type: 2 },
    }));
    els.push(el({
      type: 'text',
      x: CX - WHY_W / 2 - BADGE_R * 2 - 14, y: whyY + WHY_H / 2 - BADGE_R,
      width: BADGE_R * 2, height: BADGE_R * 2,
      text: `${i + 1}`, fontSize: 18, fontFamily: 1,
      textAlign: 'center', verticalAlign: 'middle', strokeColor: sc.stroke,
    }));

    // Why box
    els.push(el({
      type: 'rectangle', x: CX - WHY_W / 2, y: whyY, width: WHY_W, height: WHY_H,
      strokeColor: sc.stroke, backgroundColor: sc.bg,
      roundness: { type: 3, value: 10 },
    }));
    // Why label
    els.push(el({
      type: 'text', x: CX - WHY_W / 2 + 10, y: whyY + 4, width: 100, height: 18,
      text: sc.label, fontSize: 11, fontFamily: 1,
      textAlign: 'left', strokeColor: sc.stroke,
    }));
    // Placeholder
    els.push(el({
      type: 'text', x: CX - WHY_W / 2 + 15, y: whyY + 24, width: WHY_W - 30, height: 32,
      text: `Why did this happen? →  Enter cause ${i + 1}…`,
      fontSize: 15, fontFamily: 1, textAlign: 'left', strokeColor: COL.slate,
    }));

    curY = whyY + WHY_H;

    // Arrow to next
    els.push(el({
      type: 'arrow', x: CX, y: curY, width: 0, height: ARROW_LEN,
      points: [[0, 0], [0, ARROW_LEN]],
      strokeColor: COL.gray, strokeWidth: 2,
      startArrowhead: null, endArrowhead: 'arrow',
    }));
    curY += ARROW_LEN;
  }

  /* ── Root Cause box ───────────────────────────────────────────────────── */
  const rcY = curY + GAP_Y / 2;
  const RC_W = 520, RC_H = 80;
  els.push(el({
    type: 'rectangle', x: CX - RC_W / 2, y: rcY, width: RC_W, height: RC_H,
    strokeColor: COL.green, backgroundColor: BG.green,
    roundness: { type: 3, value: 12 }, strokeWidth: 3,
  }));
  els.push(el({
    type: 'text', x: CX - RC_W / 2 + 10, y: rcY + 4, width: RC_W - 20, height: 22,
    text: '✅  ROOT CAUSE IDENTIFIED', fontSize: 14, fontFamily: 1,
    textAlign: 'center', strokeColor: COL.green,
  }));
  els.push(el({
    type: 'text', x: CX - RC_W / 2 + 20, y: rcY + 30, width: RC_W - 40, height: 40,
    text: 'State the verified root cause and recommended corrective action…',
    fontSize: 15, fontFamily: 1, textAlign: 'center', strokeColor: COL.slate,
  }));

  /* ── Side annotation ──────────────────────────────────────────────────── */
  els.push(el({
    type: 'text', x: CX + WHY_W / 2 + 30, y: 200, width: 180, height: 300,
    text: 'TIP\n\nKeep asking\n"Why?" until\nyou reach a\ncause you can\nactually fix.\n\nAvoid blame —\nfocus on\nprocess &\nsystems.',
    fontSize: 13, fontFamily: 1, textAlign: 'left', strokeColor: COL.gray,
  }));

  api.updateScene({ elements: [...api.getSceneElements(), ...els] });
  api.scrollToContent(els as any, { fitToViewport: true, viewportZoomFactor: 0.9 });
}
