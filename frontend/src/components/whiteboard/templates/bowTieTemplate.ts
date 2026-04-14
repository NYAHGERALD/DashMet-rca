import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/types';

/* ────────────────────────────────────────────────────────────────────────────
 * Bow-Tie Analysis Template — Excalidraw 0.18+
 *
 * Threat sources on the left → preventive barriers → central hazard event →
 * mitigating barriers → consequences on the right. Professional layout with
 * color-coded zones and barrier cards.
 * ──────────────────────────────────────────────────────────────────────────── */

let _id = 0;
const uid = () => `bt_${Date.now()}_${++_id}`;
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
const CX = 900, CY = 420;
const EVENT_W = 160, EVENT_H = 100;
const THREAT_W = 200, THREAT_H = 56;
const CONS_W = 200, CONS_H = 56;
const BARRIER_W = 30, BARRIER_H = 120;
const BARRIER_GAP = 50;

const THREATS = [
  { label: 'Equipment Failure', detail: 'Mechanical / electrical' },
  { label: 'Human Error', detail: 'Procedural deviation' },
  { label: 'External Factor', detail: 'Weather / supply chain' },
  { label: 'Design Flaw', detail: 'Engineering oversight' },
];

const CONSEQUENCES = [
  { label: 'Production Loss', detail: 'Downtime & delays' },
  { label: 'Safety Incident', detail: 'Injury / exposure' },
  { label: 'Financial Impact', detail: 'Cost overruns' },
  { label: 'Reputation Damage', detail: 'Stakeholder trust' },
];

const PREV_BARRIERS = ['Inspection', 'Training', 'Procedures', 'Redundancy'];
const MIT_BARRIERS = ['Emergency Plan', 'PPE / Safety', 'Containment', 'Recovery'];

export function applyBowTieTemplate(api: ExcalidrawImperativeAPI) {
  _id = 0;
  const els: any[] = [];

  /* ── Title ────────────────────────────────────────────────────────────── */
  els.push(el({
    type: 'text', x: CX - 250, y: 30, width: 500, height: 40,
    text: 'Bow-Tie Risk Analysis', fontSize: 28, fontFamily: 1,
    textAlign: 'center', strokeColor: COL.navy,
  }));

  /* ── Zone backgrounds ─────────────────────────────────────────────────── */
  // Left zone — Threats
  els.push(el({
    type: 'rectangle', x: 50, y: 100, width: 380, height: 640,
    strokeColor: '#e2e8f0', backgroundColor: '#fef2f2', strokeWidth: 1,
    roundness: { type: 3, value: 12 }, opacity: 40,
  }));
  els.push(el({
    type: 'text', x: 60, y: 110, width: 160, height: 22,
    text: '⚠️  THREAT SOURCES', fontSize: 13, fontFamily: 1,
    textAlign: 'left', strokeColor: COL.red,
  }));

  // Center-left — Preventive
  els.push(el({
    type: 'rectangle', x: 450, y: 100, width: 220, height: 640,
    strokeColor: '#e2e8f0', backgroundColor: '#eff6ff', strokeWidth: 1,
    roundness: { type: 3, value: 12 }, opacity: 40,
  }));
  els.push(el({
    type: 'text', x: 460, y: 110, width: 200, height: 22,
    text: '🛡️  PREVENTIVE BARRIERS', fontSize: 12, fontFamily: 1,
    textAlign: 'center', strokeColor: COL.blue,
  }));

  // Center-right — Mitigating
  els.push(el({
    type: 'rectangle', x: CX + EVENT_W / 2 + 30, y: 100, width: 220, height: 640,
    strokeColor: '#e2e8f0', backgroundColor: '#f0fdf4', strokeWidth: 1,
    roundness: { type: 3, value: 12 }, opacity: 40,
  }));
  els.push(el({
    type: 'text', x: CX + EVENT_W / 2 + 40, y: 110, width: 200, height: 22,
    text: '🔧  MITIGATING BARRIERS', fontSize: 12, fontFamily: 1,
    textAlign: 'center', strokeColor: COL.green,
  }));

  // Right zone — Consequences
  els.push(el({
    type: 'rectangle', x: CX + EVENT_W / 2 + 270, y: 100, width: 380, height: 640,
    strokeColor: '#e2e8f0', backgroundColor: '#fef9ee', strokeWidth: 1,
    roundness: { type: 3, value: 12 }, opacity: 40,
  }));
  els.push(el({
    type: 'text', x: CX + EVENT_W / 2 + 280, y: 110, width: 200, height: 22,
    text: '💥  CONSEQUENCES', fontSize: 13, fontFamily: 1,
    textAlign: 'left', strokeColor: COL.orange,
  }));

  /* ── Central Hazard Event (diamond) ───────────────────────────────────── */
  els.push(el({
    type: 'diamond', x: CX - EVENT_W / 2, y: CY - EVENT_H / 2,
    width: EVENT_W, height: EVENT_H,
    strokeColor: COL.red, backgroundColor: BG.red, strokeWidth: 3,
  }));
  els.push(el({
    type: 'text', x: CX - 60, y: CY - 24, width: 120, height: 20,
    text: 'HAZARD', fontSize: 14, fontFamily: 1,
    textAlign: 'center', strokeColor: COL.red,
  }));
  els.push(el({
    type: 'text', x: CX - 55, y: CY + 0, width: 110, height: 18,
    text: 'EVENT', fontSize: 14, fontFamily: 1,
    textAlign: 'center', strokeColor: COL.red,
  }));

  /* ── Threats (left side) ──────────────────────────────────────────────── */
  const threatStartY = 160;
  const threatGap = (640 - 60 - THREATS.length * THREAT_H) / (THREATS.length + 1);
  THREATS.forEach((t, i) => {
    const ty = threatStartY + threatGap * (i + 1) + THREAT_H * i;
    const tx = 80;
    els.push(el({
      type: 'rectangle', x: tx, y: ty, width: THREAT_W, height: THREAT_H,
      strokeColor: COL.red, backgroundColor: BG.red,
      roundness: { type: 3, value: 8 },
    }));
    els.push(el({
      type: 'text', x: tx + 8, y: ty + 6, width: THREAT_W - 16, height: 20,
      text: t.label, fontSize: 13, fontFamily: 1,
      textAlign: 'center', strokeColor: COL.red,
    }));
    els.push(el({
      type: 'text', x: tx + 8, y: ty + 28, width: THREAT_W - 16, height: 18,
      text: t.detail, fontSize: 11, fontFamily: 1,
      textAlign: 'center', strokeColor: COL.slate,
    }));

    // Arrow from threat to preventive barrier zone
    els.push(el({
      type: 'arrow', x: tx + THREAT_W, y: ty + THREAT_H / 2,
      width: 160, height: 0,
      points: [[0, 0], [160, 0]],
      strokeColor: COL.gray, strokeWidth: 1.5,
      startArrowhead: null, endArrowhead: 'arrow',
    }));
  });

  /* ── Preventive Barriers ──────────────────────────────────────────────── */
  const prevX = 480;
  PREV_BARRIERS.forEach((b, i) => {
    const bx = prevX + i * (BARRIER_W + BARRIER_GAP);
    const by = CY - BARRIER_H / 2;
    els.push(el({
      type: 'rectangle', x: bx, y: by, width: BARRIER_W, height: BARRIER_H,
      strokeColor: COL.blue, backgroundColor: BG.blue, strokeWidth: 2,
      roundness: { type: 3, value: 4 },
    }));
    // Rotated label (horizontal small text above)
    els.push(el({
      type: 'text', x: bx - 20, y: by - 22, width: BARRIER_W + 40, height: 18,
      text: b, fontSize: 10, fontFamily: 1,
      textAlign: 'center', strokeColor: COL.blue,
    }));
  });

  /* ── Arrows: barriers → event ─────────────────────────────────────────── */
  const lastPrevX = prevX + (PREV_BARRIERS.length - 1) * (BARRIER_W + BARRIER_GAP) + BARRIER_W;
  els.push(el({
    type: 'arrow', x: lastPrevX + 10, y: CY,
    width: CX - EVENT_W / 2 - lastPrevX - 15, height: 0,
    points: [[0, 0], [CX - EVENT_W / 2 - lastPrevX - 15, 0]],
    strokeColor: COL.gray, strokeWidth: 1.5, strokeStyle: 'dashed',
    startArrowhead: null, endArrowhead: 'arrow',
  }));

  /* ── Mitigating Barriers ──────────────────────────────────────────────── */
  const mitX = CX + EVENT_W / 2 + 60;
  MIT_BARRIERS.forEach((b, i) => {
    const bx = mitX + i * (BARRIER_W + BARRIER_GAP);
    const by = CY - BARRIER_H / 2;
    els.push(el({
      type: 'rectangle', x: bx, y: by, width: BARRIER_W, height: BARRIER_H,
      strokeColor: COL.green, backgroundColor: BG.green, strokeWidth: 2,
      roundness: { type: 3, value: 4 },
    }));
    els.push(el({
      type: 'text', x: bx - 25, y: by - 22, width: BARRIER_W + 50, height: 18,
      text: b, fontSize: 10, fontFamily: 1,
      textAlign: 'center', strokeColor: COL.green,
    }));
  });

  /* ── Arrow: event → mitigating barriers ───────────────────────────────── */
  els.push(el({
    type: 'arrow', x: CX + EVENT_W / 2, y: CY,
    width: mitX - CX - EVENT_W / 2 - 5, height: 0,
    points: [[0, 0], [mitX - CX - EVENT_W / 2 - 5, 0]],
    strokeColor: COL.gray, strokeWidth: 1.5, strokeStyle: 'dashed',
    startArrowhead: null, endArrowhead: 'arrow',
  }));

  /* ── Consequences (right side) ────────────────────────────────────────── */
  const consStartY = 160;
  const consGap = (640 - 60 - CONSEQUENCES.length * CONS_H) / (CONSEQUENCES.length + 1);
  const lastMitX = mitX + (MIT_BARRIERS.length - 1) * (BARRIER_W + BARRIER_GAP) + BARRIER_W;
  CONSEQUENCES.forEach((c, i) => {
    const cy2 = consStartY + consGap * (i + 1) + CONS_H * i;
    const cx2 = CX + EVENT_W / 2 + 320;
    els.push(el({
      type: 'rectangle', x: cx2, y: cy2, width: CONS_W, height: CONS_H,
      strokeColor: COL.orange, backgroundColor: BG.orange,
      roundness: { type: 3, value: 8 },
    }));
    els.push(el({
      type: 'text', x: cx2 + 8, y: cy2 + 6, width: CONS_W - 16, height: 20,
      text: c.label, fontSize: 13, fontFamily: 1,
      textAlign: 'center', strokeColor: COL.orange,
    }));
    els.push(el({
      type: 'text', x: cx2 + 8, y: cy2 + 28, width: CONS_W - 16, height: 18,
      text: c.detail, fontSize: 11, fontFamily: 1,
      textAlign: 'center', strokeColor: COL.slate,
    }));

    // Arrow from barrier zone to consequence
    els.push(el({
      type: 'arrow', x: lastMitX + 10, y: cy2 + CONS_H / 2,
      width: cx2 - lastMitX - 16, height: 0,
      points: [[0, 0], [cx2 - lastMitX - 16, 0]],
      strokeColor: COL.gray, strokeWidth: 1.5,
      startArrowhead: null, endArrowhead: 'arrow',
    }));
  });

  /* ── Escalation factors (annotations) ─────────────────────────────────── */
  els.push(el({
    type: 'text', x: prevX + 20, y: CY + BARRIER_H / 2 + 20, width: 260, height: 50,
    text: '↑ Escalation factors that\nweaken preventive barriers',
    fontSize: 11, fontFamily: 1, textAlign: 'center', strokeColor: COL.gray,
  }));
  els.push(el({
    type: 'text', x: mitX + 20, y: CY + BARRIER_H / 2 + 20, width: 260, height: 50,
    text: '↑ Escalation factors that\nweaken mitigating barriers',
    fontSize: 11, fontFamily: 1, textAlign: 'center', strokeColor: COL.gray,
  }));

  api.updateScene({ elements: [...api.getSceneElements(), ...els] });
  api.scrollToContent(els as any, { fitToViewport: true, viewportZoomFactor: 0.85 });
}
