import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/types';

/* ────────────────────────────────────────────────────────────────────────────
 * SWOT Analysis Template — 2×2 quadrant grid
 * Strengths · Weaknesses · Opportunities · Threats
 * ──────────────────────────────────────────────────────────────────────────── */

let _id = 0;
const uid = () => `sw_${Date.now()}_${++_id}`;
const seed = () => Math.floor(Math.random() * 1e6);

const C = {
  green: '#2f9e44', red: '#e03131', blue: '#1971c2',
  amber: '#e8590c', black: '#1e1e1e', gray: '#868e96',
};
const BG = {
  green: '#d3f9d8', red: '#ffe3e3', blue: '#d0ebff', amber: '#ffe8cc',
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

export function applySwotTemplate(api: ExcalidrawImperativeAPI) {
  _id = 0;
  const e: any[] = [];

  const QW = 320, QH = 250, GAP = 8;
  const OX = 120, OY = 100;
  const HEADER = 42;

  // Title
  e.push(el({
    type: 'text', x: OX, y: OY - 50, width: QW * 2 + GAP, height: 30,
    text: 'SWOT Analysis', originalText: 'SWOT Analysis',
    fontSize: 26, fontFamily: 3, textAlign: 'center', verticalAlign: 'top',
    strokeColor: C.black, autoResize: true, lineHeight: 1.25,
  }));

  const quads = [
    { label: 'Strengths', color: C.green, bg: BG.green, col: 0, row: 0, items: ['Internal advantage 1', 'Internal advantage 2', 'Internal advantage 3'] },
    { label: 'Weaknesses', color: C.red, bg: BG.red, col: 1, row: 0, items: ['Internal weakness 1', 'Internal weakness 2', 'Internal weakness 3'] },
    { label: 'Opportunities', color: C.blue, bg: BG.blue, col: 0, row: 1, items: ['External opportunity 1', 'External opportunity 2', 'External opportunity 3'] },
    { label: 'Threats', color: C.amber, bg: BG.amber, col: 1, row: 1, items: ['External threat 1', 'External threat 2', 'External threat 3'] },
  ];

  for (const q of quads) {
    const x = OX + q.col * (QW + GAP);
    const y = OY + q.row * (QH + GAP);

    // Quadrant box
    e.push(el({
      type: 'rectangle', x, y, width: QW, height: QH,
      strokeColor: q.color, backgroundColor: 'transparent',
      roundness: { type: 3 }, strokeWidth: 2,
    }));

    // Header bar
    e.push(el({
      type: 'rectangle', x, y, width: QW, height: HEADER,
      strokeColor: q.color, backgroundColor: q.bg,
      roundness: { type: 3 }, strokeWidth: 0,
    }));

    // Header text
    e.push(el({
      type: 'text', x: x + 12, y: y + 10, width: QW - 24, height: 22,
      text: q.label, originalText: q.label,
      fontSize: 18, fontFamily: 3, textAlign: 'center', verticalAlign: 'middle',
      strokeColor: q.color, autoResize: true, lineHeight: 1.25,
    }));

    // Bullet items
    for (let i = 0; i < q.items.length; i++) {
      e.push(el({
        type: 'text',
        x: x + 20, y: y + HEADER + 16 + i * 30,
        width: QW - 40, height: 18,
        text: `• ${q.items[i]}`, originalText: `• ${q.items[i]}`,
        fontSize: 14, fontFamily: 3, textAlign: 'left', verticalAlign: 'top',
        strokeColor: C.black, autoResize: true, lineHeight: 1.25,
      }));
    }
  }

  // Labels
  e.push(el({
    type: 'text', x: OX, y: OY + (QH + GAP) * 2 + 10, width: QW * 2 + GAP, height: 16,
    text: 'Top row = Internal factors  ·  Bottom row = External factors  ·  Double-click to edit',
    originalText: 'Top row = Internal factors  ·  Bottom row = External factors  ·  Double-click to edit',
    fontSize: 12, fontFamily: 3, textAlign: 'center', verticalAlign: 'top',
    strokeColor: C.gray, autoResize: true, lineHeight: 1.25,
  }));

  api.updateScene({ elements: e });
  api.scrollToContent(undefined, { fitToViewport: true, animate: true });
}
