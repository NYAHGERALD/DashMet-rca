import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/types';

/* ────────────────────────────────────────────────────────────────────────────
 * Flowchart Template — start/end ovals, process boxes, decision diamond,
 * connected with arrows in a vertical flow.
 * ──────────────────────────────────────────────────────────────────────────── */

let _id = 0;
const uid = () => `fc_${Date.now()}_${++_id}`;
const seed = () => Math.floor(Math.random() * 1e6);

const C = {
  green: '#2f9e44', blue: '#1971c2', amber: '#e8590c',
  red: '#e03131', black: '#1e1e1e', gray: '#868e96',
};
const BG = {
  green: '#d3f9d8', blue: '#d0ebff', amber: '#ffe8cc',
  red: '#ffe3e3', lime: '#e9fac8',
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

export function applyFlowchartTemplate(api: ExcalidrawImperativeAPI) {
  _id = 0;
  const e: any[] = [];
  const cx = 400; // center X
  const W = 200, H = 50;
  const GAP = 30; // vertical gap between shapes
  const ARR_H = GAP; // arrow height

  // Title
  e.push(el({
    type: 'text', x: cx - 140, y: 40, width: 280, height: 30,
    text: 'Process Flowchart', originalText: 'Process Flowchart',
    fontSize: 26, fontFamily: 3, textAlign: 'center', verticalAlign: 'top',
    strokeColor: C.black, autoResize: true, lineHeight: 1.25,
  }));

  let y = 100;

  // ── Start (ellipse) ──
  const startW = 160, startH = 50;
  e.push(el({
    type: 'ellipse', x: cx - startW / 2, y, width: startW, height: startH,
    strokeColor: C.green, backgroundColor: BG.green, roundness: { type: 2 },
  }));
  e.push(el({
    type: 'text', x: cx - 30, y: y + 14, width: 60, height: 22,
    text: 'Start', originalText: 'Start',
    fontSize: 16, fontFamily: 3, textAlign: 'center', verticalAlign: 'middle',
    strokeColor: C.green, autoResize: true, lineHeight: 1.25,
  }));
  y += startH;

  // Arrow → Process 1
  e.push(el({
    type: 'arrow', x: cx, y, width: 0, height: ARR_H,
    strokeColor: C.black, strokeWidth: 1.5,
    points: [[0, 0], [0, ARR_H]],
    startArrowhead: null, endArrowhead: 'triangle',
  }));
  y += ARR_H;

  // ── Process 1 ──
  e.push(el({
    type: 'rectangle', x: cx - W / 2, y, width: W, height: H,
    strokeColor: C.blue, backgroundColor: BG.blue,
    roundness: { type: 3 },
  }));
  e.push(el({
    type: 'text', x: cx - W / 2 + 10, y: y + 14, width: W - 20, height: 22,
    text: 'Process Step 1', originalText: 'Process Step 1',
    fontSize: 15, fontFamily: 3, textAlign: 'center', verticalAlign: 'middle',
    strokeColor: C.blue, autoResize: true, lineHeight: 1.25,
  }));
  y += H;

  // Arrow → Decision
  e.push(el({
    type: 'arrow', x: cx, y, width: 0, height: ARR_H,
    strokeColor: C.black, strokeWidth: 1.5,
    points: [[0, 0], [0, ARR_H]],
    startArrowhead: null, endArrowhead: 'triangle',
  }));
  y += ARR_H;

  // ── Decision (diamond) ──
  const DW = 180, DH = 120;
  e.push(el({
    type: 'diamond', x: cx - DW / 2, y, width: DW, height: DH,
    strokeColor: C.amber, backgroundColor: BG.amber,
  }));
  e.push(el({
    type: 'text', x: cx - 50, y: y + DH / 2 - 10, width: 100, height: 20,
    text: 'Decision?', originalText: 'Decision?',
    fontSize: 15, fontFamily: 3, textAlign: 'center', verticalAlign: 'middle',
    strokeColor: C.amber, autoResize: true, lineHeight: 1.25,
  }));

  // "Yes" arrow → Process 2 (down)
  const decBottom = y + DH;
  e.push(el({
    type: 'arrow', x: cx, y: decBottom, width: 0, height: ARR_H,
    strokeColor: C.green, strokeWidth: 1.5,
    points: [[0, 0], [0, ARR_H]],
    startArrowhead: null, endArrowhead: 'triangle',
  }));
  e.push(el({
    type: 'text', x: cx + 6, y: decBottom + 4, width: 30, height: 16,
    text: 'Yes', originalText: 'Yes',
    fontSize: 12, fontFamily: 3, textAlign: 'left', verticalAlign: 'top',
    strokeColor: C.green, autoResize: true, lineHeight: 1.25,
  }));

  // "No" arrow → side box (right)
  const decRight = cx + DW / 2;
  const noBoxX = decRight + 80;
  e.push(el({
    type: 'arrow', x: decRight, y: y + DH / 2,
    width: noBoxX - decRight, height: 0,
    strokeColor: C.red, strokeWidth: 1.5,
    points: [[0, 0], [noBoxX - decRight, 0]],
    startArrowhead: null, endArrowhead: 'triangle',
  }));
  e.push(el({
    type: 'text', x: decRight + 10, y: y + DH / 2 - 18, width: 25, height: 14,
    text: 'No', originalText: 'No',
    fontSize: 12, fontFamily: 3, textAlign: 'left', verticalAlign: 'top',
    strokeColor: C.red, autoResize: true, lineHeight: 1.25,
  }));

  // Side box (No path)
  e.push(el({
    type: 'rectangle', x: noBoxX, y: y + DH / 2 - H / 2, width: W, height: H,
    strokeColor: C.red, backgroundColor: BG.red,
    roundness: { type: 3 },
  }));
  e.push(el({
    type: 'text', x: noBoxX + 10, y: y + DH / 2 - 11, width: W - 20, height: 22,
    text: 'Alternate Path', originalText: 'Alternate Path',
    fontSize: 15, fontFamily: 3, textAlign: 'center', verticalAlign: 'middle',
    strokeColor: C.red, autoResize: true, lineHeight: 1.25,
  }));

  y = decBottom + ARR_H;

  // ── Process 2 ──
  e.push(el({
    type: 'rectangle', x: cx - W / 2, y, width: W, height: H,
    strokeColor: C.blue, backgroundColor: BG.blue,
    roundness: { type: 3 },
  }));
  e.push(el({
    type: 'text', x: cx - W / 2 + 10, y: y + 14, width: W - 20, height: 22,
    text: 'Process Step 2', originalText: 'Process Step 2',
    fontSize: 15, fontFamily: 3, textAlign: 'center', verticalAlign: 'middle',
    strokeColor: C.blue, autoResize: true, lineHeight: 1.25,
  }));
  y += H;

  // Arrow → End
  e.push(el({
    type: 'arrow', x: cx, y, width: 0, height: ARR_H,
    strokeColor: C.black, strokeWidth: 1.5,
    points: [[0, 0], [0, ARR_H]],
    startArrowhead: null, endArrowhead: 'triangle',
  }));
  y += ARR_H;

  // ── End (ellipse) ──
  e.push(el({
    type: 'ellipse', x: cx - startW / 2, y, width: startW, height: startH,
    strokeColor: C.red, backgroundColor: BG.red, roundness: { type: 2 },
  }));
  e.push(el({
    type: 'text', x: cx - 25, y: y + 14, width: 50, height: 22,
    text: 'End', originalText: 'End',
    fontSize: 16, fontFamily: 3, textAlign: 'center', verticalAlign: 'middle',
    strokeColor: C.red, autoResize: true, lineHeight: 1.25,
  }));

  // ── Instruction ──
  e.push(el({
    type: 'text', x: cx - 300, y: y + 80, width: 600, height: 16,
    text: 'Double-click to edit text  ·  Drag shapes to rearrange  ·  Use arrows to connect more steps',
    originalText: 'Double-click to edit text  ·  Drag shapes to rearrange  ·  Use arrows to connect more steps',
    fontSize: 12, fontFamily: 3, textAlign: 'center', verticalAlign: 'top',
    strokeColor: C.gray, autoResize: true, lineHeight: 1.25,
  }));

  api.updateScene({ elements: e });
  api.scrollToContent(undefined, { fitToViewport: true, animate: true });
}
