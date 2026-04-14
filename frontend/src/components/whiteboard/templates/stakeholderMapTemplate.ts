import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/types';

/* ────────────────────────────────────────────────────────────────────────────
 * Stakeholder Map Template — Power/Interest quadrant matrix for stakeholder
 * analysis. Professional strategy planning tool.
 * ──────────────────────────────────────────────────────────────────────────── */

let _id = 0;
const uid = () => `sm_${Date.now()}_${++_id}`;
const seed = () => Math.floor(Math.random() * 1e6);

const C = {
  navy: '#1e3a5f', blue: '#1971c2', sky: '#0ea5e9',
  green: '#059669', emerald: '#10b981',
  amber: '#d97706', red: '#dc2626',
  purple: '#7c3aed', slate: '#475569', gray: '#94a3b8', black: '#1e1e1e',
};
const BG = {
  blue: '#dbeafe', green: '#d1fae5', amber: '#fef3c7',
  red: '#fee2e2', purple: '#ede9fe', slate: '#f1f5f9', white: '#ffffff',
};

function el(o: Partial<ExcalidrawElement> & { type: string }): any {
  return {
    id: uid(), fillStyle: 'solid', strokeWidth: 2, strokeStyle: 'solid',
    roughness: 0, opacity: 100, angle: 0,
    strokeColor: C.black, backgroundColor: 'transparent',
    width: 0, height: 0, seed: seed(),
    groupIds: [], frameId: null, boundElements: null,
    updated: Date.now(), link: null, locked: false, isDeleted: false,
    version: 1, versionNonce: seed(), ...o,
  };
}

function stakeholderBubble(x: number, y: number, name: string, role: string, color: string, bg: string, e: any[]) {
  const w = 110;
  const h = 50;
  e.push(el({
    type: 'rectangle', x, y, width: w, height: h,
    strokeColor: color, backgroundColor: bg,
    roundness: { type: 3 }, strokeWidth: 1.5,
  }));
  e.push(el({
    type: 'text', x: x + 6, y: y + 8, width: w - 12, height: 16,
    text: name, originalText: name,
    fontSize: 12, fontFamily: 3, textAlign: 'center', verticalAlign: 'middle',
    strokeColor: color, autoResize: true, lineHeight: 1.25,
  }));
  e.push(el({
    type: 'text', x: x + 6, y: y + 28, width: w - 12, height: 14,
    text: role, originalText: role,
    fontSize: 9, fontFamily: 3, textAlign: 'center', verticalAlign: 'middle',
    strokeColor: C.gray, autoResize: true, lineHeight: 1.25,
  }));
}

export function applyStakeholderMapTemplate(api: ExcalidrawImperativeAPI) {
  _id = 0;
  const e: any[] = [];

  const LEFT = 100;
  const TOP = 40;
  const GRID_W = 600;
  const GRID_H = 500;
  const HALF_W = GRID_W / 2;
  const HALF_H = GRID_H / 2;
  const GRID_X = LEFT + 40; // offset for Y axis label
  const GRID_Y = TOP + 80;

  // ── Title ──
  e.push(el({
    type: 'text', x: LEFT, y: TOP, width: 500, height: 32,
    text: 'Stakeholder Analysis Map', originalText: 'Stakeholder Analysis Map',
    fontSize: 28, fontFamily: 3, textAlign: 'left', verticalAlign: 'top',
    strokeColor: C.navy, autoResize: true, lineHeight: 1.25,
  }));
  e.push(el({
    type: 'text', x: LEFT, y: TOP + 36, width: 500, height: 18,
    text: 'Power vs. Interest Matrix  ·  Project Name',
    originalText: 'Power vs. Interest Matrix  ·  Project Name',
    fontSize: 12, fontFamily: 3, textAlign: 'left', verticalAlign: 'top',
    strokeColor: C.gray, autoResize: true, lineHeight: 1.25,
  }));

  // ── Quadrant backgrounds ──
  // Top-left: Keep Satisfied (High Power, Low Interest)
  e.push(el({
    type: 'rectangle', x: GRID_X, y: GRID_Y, width: HALF_W, height: HALF_H,
    strokeColor: '#e2e8f0', backgroundColor: BG.amber,
    strokeWidth: 1, opacity: 50,
  }));
  // Top-right: Manage Closely (High Power, High Interest)
  e.push(el({
    type: 'rectangle', x: GRID_X + HALF_W, y: GRID_Y, width: HALF_W, height: HALF_H,
    strokeColor: '#e2e8f0', backgroundColor: BG.red,
    strokeWidth: 1, opacity: 50,
  }));
  // Bottom-left: Monitor (Low Power, Low Interest)
  e.push(el({
    type: 'rectangle', x: GRID_X, y: GRID_Y + HALF_H, width: HALF_W, height: HALF_H,
    strokeColor: '#e2e8f0', backgroundColor: BG.slate,
    strokeWidth: 1, opacity: 50,
  }));
  // Bottom-right: Keep Informed (Low Power, High Interest)
  e.push(el({
    type: 'rectangle', x: GRID_X + HALF_W, y: GRID_Y + HALF_H, width: HALF_W, height: HALF_H,
    strokeColor: '#e2e8f0', backgroundColor: BG.blue,
    strokeWidth: 1, opacity: 50,
  }));

  // ── Quadrant labels (strategy) ──
  const labelPad = 15;
  const quadrants = [
    { x: GRID_X + labelPad, y: GRID_Y + labelPad, text: 'Keep Satisfied', sub: 'High Power · Low Interest', color: C.amber },
    { x: GRID_X + HALF_W + labelPad, y: GRID_Y + labelPad, text: 'Manage Closely', sub: 'High Power · High Interest', color: C.red },
    { x: GRID_X + labelPad, y: GRID_Y + HALF_H + labelPad, text: 'Monitor', sub: 'Low Power · Low Interest', color: C.slate },
    { x: GRID_X + HALF_W + labelPad, y: GRID_Y + HALF_H + labelPad, text: 'Keep Informed', sub: 'Low Power · High Interest', color: C.blue },
  ];
  quadrants.forEach(q => {
    e.push(el({
      type: 'text', x: q.x, y: q.y, width: HALF_W - 30, height: 20,
      text: q.text, originalText: q.text,
      fontSize: 16, fontFamily: 3, textAlign: 'left', verticalAlign: 'top',
      strokeColor: q.color, autoResize: true, lineHeight: 1.25,
    }));
    e.push(el({
      type: 'text', x: q.x, y: q.y + 22, width: HALF_W - 30, height: 14,
      text: q.sub, originalText: q.sub,
      fontSize: 10, fontFamily: 3, textAlign: 'left', verticalAlign: 'top',
      strokeColor: C.gray, autoResize: true, lineHeight: 1.25,
    }));
  });

  // ── Axis lines ──
  // Y axis (Power)
  e.push(el({
    type: 'arrow', x: GRID_X, y: GRID_Y + GRID_H, width: 0, height: -GRID_H,
    strokeColor: C.slate, strokeWidth: 2.5,
    points: [[0, 0], [0, -GRID_H]],
    startArrowhead: null, endArrowhead: 'triangle',
  }));
  // X axis (Interest)
  e.push(el({
    type: 'arrow', x: GRID_X, y: GRID_Y + GRID_H, width: GRID_W, height: 0,
    strokeColor: C.slate, strokeWidth: 2.5,
    points: [[0, 0], [GRID_W, 0]],
    startArrowhead: null, endArrowhead: 'triangle',
  }));

  // ── Axis labels ──
  e.push(el({
    type: 'text', x: GRID_X + GRID_W / 2 - 50, y: GRID_Y + GRID_H + 15, width: 100, height: 20,
    text: 'INTEREST →', originalText: 'INTEREST →',
    fontSize: 13, fontFamily: 3, textAlign: 'center', verticalAlign: 'top',
    strokeColor: C.slate, autoResize: true, lineHeight: 1.25,
  }));
  e.push(el({
    type: 'text', x: GRID_X - 70, y: GRID_Y + GRID_H / 2 - 10, width: 60, height: 20,
    text: '↑ POWER', originalText: '↑ POWER',
    fontSize: 13, fontFamily: 3, textAlign: 'center', verticalAlign: 'middle',
    strokeColor: C.slate, autoResize: true, lineHeight: 1.25,
  }));

  // Low/High labels on axes
  e.push(el({
    type: 'text', x: GRID_X + 5, y: GRID_Y + GRID_H + 4, width: 30, height: 14,
    text: 'Low', originalText: 'Low',
    fontSize: 10, fontFamily: 3, textAlign: 'left', verticalAlign: 'top',
    strokeColor: C.gray, autoResize: true, lineHeight: 1.25,
  }));
  e.push(el({
    type: 'text', x: GRID_X + GRID_W - 35, y: GRID_Y + GRID_H + 4, width: 35, height: 14,
    text: 'High', originalText: 'High',
    fontSize: 10, fontFamily: 3, textAlign: 'right', verticalAlign: 'top',
    strokeColor: C.gray, autoResize: true, lineHeight: 1.25,
  }));

  // ── Stakeholder bubbles ──
  // Keep Satisfied (top-left)
  stakeholderBubble(GRID_X + 40, GRID_Y + 80, 'Board of Directors', 'Governance', C.amber, BG.amber, e);
  stakeholderBubble(GRID_X + 160, GRID_Y + 150, 'Legal / Compliance', 'Advisory', C.amber, BG.amber, e);

  // Manage Closely (top-right)
  stakeholderBubble(GRID_X + HALF_W + 30, GRID_Y + 60, 'Executive Sponsor', 'Decision Maker', C.red, BG.red, e);
  stakeholderBubble(GRID_X + HALF_W + 160, GRID_Y + 100, 'Product Owner', 'Vision & Priority', C.red, BG.red, e);
  stakeholderBubble(GRID_X + HALF_W + 80, GRID_Y + 160, 'Key Customer', 'Requirements', C.red, BG.red, e);

  // Monitor (bottom-left)
  stakeholderBubble(GRID_X + 50, GRID_Y + HALF_H + 80, 'General Staff', 'End Users', C.slate, BG.slate, e);
  stakeholderBubble(GRID_X + 170, GRID_Y + HALF_H + 130, 'Suppliers', 'Support', C.slate, BG.slate, e);

  // Keep Informed (bottom-right)
  stakeholderBubble(GRID_X + HALF_W + 40, GRID_Y + HALF_H + 70, 'Dev Team', 'Builders', C.blue, BG.blue, e);
  stakeholderBubble(GRID_X + HALF_W + 160, GRID_Y + HALF_H + 120, 'QA Team', 'Quality', C.blue, BG.blue, e);

  // ── Instruction ──
  e.push(el({
    type: 'text', x: GRID_X, y: GRID_Y + GRID_H + 45, width: 700, height: 16,
    text: 'Drag stakeholder cards to reposition  ·  Double-click to edit  ·  Duplicate to add more stakeholders',
    originalText: 'Drag stakeholder cards to reposition  ·  Double-click to edit  ·  Duplicate to add more stakeholders',
    fontSize: 11, fontFamily: 3, textAlign: 'left', verticalAlign: 'top',
    strokeColor: C.gray, autoResize: true, lineHeight: 1.25,
  }));

  api.updateScene({ elements: e });
  api.scrollToContent(undefined, { fitToViewport: true, animate: true });
}
