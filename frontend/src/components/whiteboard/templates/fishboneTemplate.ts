import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/types';

/* ────────────────────────────────────────────────────────────────────────────
 * Fishbone (Ishikawa) 6M Diagram Template — Excalidraw 0.18+
 *
 * Professional layout with clean geometry (roughness: 0),
 * rounded category boxes, labeled sub-cause branches, and
 * a prominent effect box.
 * ──────────────────────────────────────────────────────────────────────────── */

let _id = 0;
const uid = () => `fb_${Date.now()}_${++_id}`;
const seed = () => Math.floor(Math.random() * 1e6);

const COL: Record<string, string> = {
  blue: '#1971c2', red: '#e03131', green: '#2f9e44',
  orange: '#e8590c', violet: '#7048e8', teal: '#0c8599',
  black: '#1e1e1e', gray: '#868e96',
};
const BG: Record<string, string> = {
  blue: '#d0ebff', red: '#ffe3e3', green: '#d3f9d8',
  orange: '#ffe8cc', violet: '#e5dbff', teal: '#c3fae8',
  pink: '#ffe0f0',
};

interface Cat { name: string; color: string; attachX: number; side: 'top' | 'bottom' }

const CATS: Cat[] = [
  { name: 'Man',         color: 'blue',   attachX: 380,  side: 'top' },
  { name: 'Machine',     color: 'red',    attachX: 720,  side: 'top' },
  { name: 'Method',      color: 'green',  attachX: 1060, side: 'top' },
  { name: 'Material',    color: 'orange', attachX: 380,  side: 'bottom' },
  { name: 'Measurement', color: 'violet', attachX: 720,  side: 'bottom' },
  { name: 'Environment', color: 'teal',   attachX: 1060, side: 'bottom' },
];

// Spine layout
const SY  = 480;          // spine Y
const SX0 = 120;          // spine start X
const SX1 = 1420;         // spine end X (arrow tip)
const EX  = 1440;         // effect box X
const EW  = 200, EH = 70; // effect box size

// Rib geometry
const RIB_DX = 180, RIB_DY = 195;
const CAT_W = 140, CAT_H = 38;
const SUB_DX = 55, SUB_DY = 48;

function el(overrides: Partial<ExcalidrawElement> & { type: string }): any {
  return {
    id: uid(), fillStyle: 'solid', strokeWidth: 2, strokeStyle: 'solid',
    roughness: 0, opacity: 100, angle: 0,
    strokeColor: COL.black, backgroundColor: 'transparent',
    width: 0, height: 0, seed: seed(),
    groupIds: [], frameId: null, boundElements: null,
    updated: Date.now(), link: null, locked: false, isDeleted: false,
    version: 1, versionNonce: seed(),
    ...overrides,
  };
}

export function applyFishboneTemplate(api: ExcalidrawImperativeAPI) {
  _id = 0;
  const elems: any[] = [];

  // ── Title ──
  elems.push(el({
    type: 'text', x: SX0, y: SY - RIB_DY - 140, width: 480, height: 36,
    text: 'Fishbone (Ishikawa) Diagram', originalText: 'Fishbone (Ishikawa) Diagram',
    fontSize: 28, fontFamily: 3, textAlign: 'left', verticalAlign: 'top',
    strokeColor: COL.black, autoResize: true, lineHeight: 1.25,
  }));

  // ── Spine arrow ──
  elems.push(el({
    type: 'arrow', x: SX0, y: SY,
    width: SX1 - SX0, height: 0,
    strokeColor: COL.black, strokeWidth: 3,
    points: [[0, 0], [SX1 - SX0, 0]],
    startArrowhead: null, endArrowhead: 'triangle',
  }));

  // ── Effect box ──
  elems.push(el({
    type: 'rectangle', x: EX, y: SY - EH / 2, width: EW, height: EH,
    strokeColor: COL.red, backgroundColor: BG.red, strokeWidth: 2,
    roundness: { type: 3 },
  }));
  elems.push(el({
    type: 'text', x: EX + 30, y: SY - 18, width: EW - 60, height: 36,
    text: 'EFFECT\n(Problem)', originalText: 'EFFECT\n(Problem)',
    fontSize: 16, fontFamily: 3, textAlign: 'center', verticalAlign: 'middle',
    strokeColor: COL.red, autoResize: true, lineHeight: 1.25,
  }));

  // ── Categories ──
  for (const cat of CATS) {
    const top = cat.side === 'top';
    const dir = top ? -1 : 1;
    const color = COL[cat.color] || COL.black;
    const bg = BG[cat.color] || 'transparent';

    const ribX0 = cat.attachX - RIB_DX;
    const ribY0 = SY + dir * RIB_DY;
    const ribX1 = cat.attachX;
    const ribY1 = SY;

    // Diagonal rib
    elems.push(el({
      type: 'line', x: ribX0, y: ribY0,
      width: ribX1 - ribX0, height: ribY1 - ribY0,
      strokeColor: color, strokeWidth: 2,
      points: [[0, 0], [ribX1 - ribX0, ribY1 - ribY0]],
    }));

    // Category rounded box
    const bx = ribX0 - CAT_W / 2;
    const by = top ? ribY0 - CAT_H - 10 : ribY0 + 10;
    elems.push(el({
      type: 'rectangle', x: bx, y: by, width: CAT_W, height: CAT_H,
      strokeColor: color, backgroundColor: bg,
      roundness: { type: 3 }, strokeWidth: 1.5,
    }));
    elems.push(el({
      type: 'text', x: bx + 8, y: by + 8, width: CAT_W - 16, height: 22,
      text: cat.name, originalText: cat.name,
      fontSize: 16, fontFamily: 3, textAlign: 'center', verticalAlign: 'middle',
      strokeColor: color, autoResize: true, lineHeight: 1.25,
    }));

    // Sub-cause branches (3 per rib)
    for (let i = 0; i < 3; i++) {
      const t = 0.25 + i * 0.22;
      const mx = ribX0 + t * (ribX1 - ribX0);
      const my = ribY0 + t * (ribY1 - ribY0);
      const ex = mx - SUB_DX;
      const ey = my - dir * SUB_DY;

      elems.push(el({
        type: 'line', x: ex, y: ey,
        width: mx - ex, height: my - ey,
        strokeColor: color, strokeWidth: 1,
        points: [[0, 0], [mx - ex, my - ey]],
      }));
      elems.push(el({
        type: 'text', x: ex - 35, y: top ? ey - 20 : ey + 4,
        width: 80, height: 16,
        text: `Cause ${i + 1}`, originalText: `Cause ${i + 1}`,
        fontSize: 13, fontFamily: 3, textAlign: 'center', verticalAlign: 'top',
        strokeColor: color, autoResize: true, lineHeight: 1.25,
      }));
    }
  }

  // ── Instruction ──
  elems.push(el({
    type: 'text', x: SX0, y: SY + RIB_DY + 100, width: 700, height: 18,
    text: 'Double-click any text to edit  ·  Drag shapes to rearrange  ·  Add more causes with the arrow or line tool',
    originalText: 'Double-click any text to edit  ·  Drag shapes to rearrange  ·  Add more causes with the arrow or line tool',
    fontSize: 13, fontFamily: 3, textAlign: 'left', verticalAlign: 'top',
    strokeColor: COL.gray, autoResize: true, lineHeight: 1.25,
  }));

  api.updateScene({ elements: elems });
  api.scrollToContent(undefined, { fitToViewport: true, animate: true });
}
