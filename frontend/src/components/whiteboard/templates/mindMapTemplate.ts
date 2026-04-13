import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/types';

/* ────────────────────────────────────────────────────────────────────────────
 * Mind Map Template — central idea with radiating branches
 * ──────────────────────────────────────────────────────────────────────────── */

let _id = 0;
const uid = () => `mm_${Date.now()}_${++_id}`;
const seed = () => Math.floor(Math.random() * 1e6);

const C = {
  blue: '#1971c2', red: '#e03131', green: '#2f9e44',
  orange: '#e8590c', violet: '#7048e8', teal: '#0c8599',
  black: '#1e1e1e', gray: '#868e96',
};
const BG = {
  blue: '#d0ebff', red: '#ffe3e3', green: '#d3f9d8',
  orange: '#ffe8cc', violet: '#e5dbff', teal: '#c3fae8',
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

function arrow(from: [number, number], to: [number, number], color: string): any {
  return el({
    type: 'arrow',
    x: from[0], y: from[1],
    width: to[0] - from[0], height: to[1] - from[1],
    strokeColor: color, strokeWidth: 2,
    points: [[0, 0], [to[0] - from[0], to[1] - from[1]]],
    startArrowhead: null, endArrowhead: 'arrow',
    roundness: { type: 2 },
  });
}

export function applyMindMapTemplate(api: ExcalidrawImperativeAPI) {
  _id = 0;
  const e: any[] = [];

  const CX = 500, CY = 400;
  const CW = 200, CH = 60;

  // Title
  e.push(el({
    type: 'text', x: CX - 200, y: 40, width: 400, height: 30,
    text: 'Mind Map', originalText: 'Mind Map',
    fontSize: 26, fontFamily: 3, textAlign: 'center', verticalAlign: 'top',
    strokeColor: C.black, autoResize: true, lineHeight: 1.25,
  }));

  // Central node (ellipse)
  e.push(el({
    type: 'ellipse',
    x: CX - CW / 2, y: CY - CH / 2, width: CW, height: CH,
    strokeColor: C.blue, backgroundColor: BG.blue,
    strokeWidth: 3, roundness: { type: 2 },
  }));
  e.push(el({
    type: 'text',
    x: CX - CW / 2 + 10, y: CY - 10, width: CW - 20, height: 20,
    text: 'Central Idea', originalText: 'Central Idea',
    fontSize: 18, fontFamily: 3, textAlign: 'center', verticalAlign: 'middle',
    strokeColor: C.blue, autoResize: true, lineHeight: 1.25,
  }));

  // Branches: positioned around the center
  const branches = [
    { label: 'Topic A', color: C.red, bg: BG.red, x: CX - 380, y: CY - 200, subs: ['Sub A-1', 'Sub A-2'] },
    { label: 'Topic B', color: C.green, bg: BG.green, x: CX + 180, y: CY - 200, subs: ['Sub B-1', 'Sub B-2'] },
    { label: 'Topic C', color: C.orange, bg: BG.orange, x: CX - 380, y: CY + 140, subs: ['Sub C-1', 'Sub C-2'] },
    { label: 'Topic D', color: C.violet, bg: BG.violet, x: CX + 180, y: CY + 140, subs: ['Sub D-1', 'Sub D-2'] },
    { label: 'Topic E', color: C.teal, bg: BG.teal, x: CX - 100, y: CY - 260, subs: ['Sub E-1', 'Sub E-2'] },
    { label: 'Topic F', color: C.red, bg: BG.red, x: CX - 100, y: CY + 220, subs: ['Sub F-1', 'Sub F-2'] },
  ];

  const BW = 150, BH = 40;
  const SW = 120, SH = 28;

  for (const b of branches) {
    const bx = b.x, by = b.y;
    const bcx = bx + BW / 2, bcy = by + BH / 2;

    // Arrow from center to branch
    e.push(arrow([CX, CY], [bcx, bcy], b.color));

    // Branch node (rounded rect)
    e.push(el({
      type: 'rectangle',
      x: bx, y: by, width: BW, height: BH,
      strokeColor: b.color, backgroundColor: b.bg,
      roundness: { type: 3 }, strokeWidth: 2,
    }));
    e.push(el({
      type: 'text',
      x: bx + 10, y: by + 10, width: BW - 20, height: 20,
      text: b.label, originalText: b.label,
      fontSize: 15, fontFamily: 3, textAlign: 'center', verticalAlign: 'middle',
      strokeColor: b.color, autoResize: true, lineHeight: 1.25,
    }));

    // Sub-branches
    for (let i = 0; i < b.subs.length; i++) {
      const dir = bx < CX ? -1 : 1;
      const sx = bx + (dir < 0 ? -SW - 20 : BW + 20);
      const sy = by - 20 + i * (SH + 12);

      // Sub arrow
      const fromX = bx + (dir < 0 ? 0 : BW);
      const fromY = by + BH / 2;
      e.push(arrow([fromX, fromY], [sx + (dir < 0 ? SW : 0), sy + SH / 2], b.color));

      // Sub node
      e.push(el({
        type: 'rectangle',
        x: sx, y: sy, width: SW, height: SH,
        strokeColor: b.color, backgroundColor: 'transparent',
        roundness: { type: 3 }, strokeWidth: 1,
      }));
      e.push(el({
        type: 'text',
        x: sx + 8, y: sy + 5, width: SW - 16, height: 18,
        text: b.subs[i], originalText: b.subs[i],
        fontSize: 13, fontFamily: 3, textAlign: 'center', verticalAlign: 'middle',
        strokeColor: b.color, autoResize: true, lineHeight: 1.25,
      }));
    }
  }

  // Instruction
  e.push(el({
    type: 'text', x: CX - 200, y: CY + 340, width: 400, height: 16,
    text: 'Double-click any text to edit · Drag nodes to rearrange',
    originalText: 'Double-click any text to edit · Drag nodes to rearrange',
    fontSize: 12, fontFamily: 3, textAlign: 'center', verticalAlign: 'top',
    strokeColor: C.gray, autoResize: true, lineHeight: 1.25,
  }));

  api.updateScene({ elements: e });
  api.scrollToContent(undefined, { fitToViewport: true, animate: true });
}
