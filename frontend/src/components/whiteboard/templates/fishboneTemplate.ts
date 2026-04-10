import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/types';

/* ────────────────────────────────────────────────────────────────────────────
 * Fishbone (Ishikawa) Diagram Template — Excalidraw version
 *
 * Professional 6M layout:
 *   Man · Machine · Method (top)
 *   Material · Measurement · Environment (bottom)
 * ──────────────────────────────────────────────────────────────────────────── */

// ─── Layout constants ────────────────────────────────────────────────────────
const SPINE_Y   = 500;
const SPINE_X0  = 100;
const SPINE_X1  = 1500;
const EFFECT_X  = 1520;
const EFFECT_W  = 220;
const EFFECT_H  = 80;

const RIB_DX    = 200;
const RIB_DY    = 200;
const CAT_W     = 150;
const CAT_H     = 40;

const SUB_DX    = 50;
const SUB_DY    = 50;

let _idCounter = 0;
function genId(): string {
  _idCounter += 1;
  return `fishbone_${Date.now()}_${_idCounter}`;
}

// ─── Color mapping ───────────────────────────────────────────────────────────
const COLORS: Record<string, string> = {
  blue:    '#3b82f6',
  red:     '#ef4444',
  green:   '#22c55e',
  orange:  '#f97316',
  violet:  '#7c3aed',
  yellow:  '#eab308',
  black:   '#1e1e1e',
  grey:    '#9ca3af',
};

const BG_COLORS: Record<string, string> = {
  blue:    '#dbeafe',
  red:     '#fee2e2',
  green:   '#dcfce7',
  orange:  '#ffedd5',
  violet:  '#ede9fe',
  yellow:  '#fef9c3',
};

// ─── Category definitions ────────────────────────────────────────────────────
interface Category {
  name: string;
  color: string;
  ribAttachX: number;
  side: 'top' | 'bottom';
}

const CATEGORIES: Category[] = [
  { name: 'Man',         color: 'blue',    ribAttachX: 350,  side: 'top' },
  { name: 'Machine',     color: 'red',     ribAttachX: 700,  side: 'top' },
  { name: 'Method',      color: 'green',   ribAttachX: 1050, side: 'top' },
  { name: 'Material',    color: 'orange',  ribAttachX: 350,  side: 'bottom' },
  { name: 'Measurement', color: 'violet',  ribAttachX: 700,  side: 'bottom' },
  { name: 'Environment', color: 'yellow',  ribAttachX: 1050, side: 'bottom' },
];

function makeBase(overrides: Partial<ExcalidrawElement> & { type: string }): any {
  return {
    id: genId(),
    fillStyle: 'solid',
    strokeWidth: 2,
    strokeStyle: 'solid',
    roughness: 0,
    opacity: 100,
    angle: 0,
    strokeColor: '#1e1e1e',
    backgroundColor: 'transparent',
    width: 0,
    height: 0,
    seed: Math.floor(Math.random() * 100000),
    groupIds: [],
    frameId: null,
    boundElements: null,
    updated: Date.now(),
    link: null,
    locked: false,
    isDeleted: false,
    version: 1,
    versionNonce: Math.floor(Math.random() * 100000),
    ...overrides,
  };
}

// ─── Template builder ────────────────────────────────────────────────────────
export function applyFishboneTemplate(excalidrawAPI: ExcalidrawImperativeAPI) {
  _idCounter = 0;
  const elements: any[] = [];

  // ── 1. Title ──
  elements.push(makeBase({
    type: 'text',
    x: SPINE_X0,
    y: SPINE_Y - RIB_DY - 160,
    width: 500,
    height: 40,
    text: 'Fishbone (Ishikawa) Diagram',
    fontSize: 28,
    fontFamily: 1, // Excalidraw hand-drawn font
    textAlign: 'left',
    verticalAlign: 'top',
    strokeColor: COLORS.black,
    originalText: 'Fishbone (Ishikawa) Diagram',
    autoResize: true,
    lineHeight: 1.25,
  }));

  // ── 2. Spine (horizontal arrow) ──
  elements.push(makeBase({
    type: 'arrow',
    x: SPINE_X0,
    y: SPINE_Y,
    width: SPINE_X1 - SPINE_X0,
    height: 0,
    strokeColor: COLORS.black,
    strokeWidth: 3,
    points: [[0, 0], [SPINE_X1 - SPINE_X0, 0]],
    startArrowhead: null,
    endArrowhead: 'triangle',
  }));

  // ── 3. Effect box ──
  elements.push(makeBase({
    type: 'rectangle',
    x: EFFECT_X,
    y: SPINE_Y - EFFECT_H / 2,
    width: EFFECT_W,
    height: EFFECT_H,
    strokeColor: COLORS.red,
    backgroundColor: BG_COLORS.red,
    fillStyle: 'solid',
    strokeWidth: 2,
    roundness: { type: 3 },
  }));

  // Effect label
  elements.push(makeBase({
    type: 'text',
    x: EFFECT_X + 40,
    y: SPINE_Y - 20,
    width: 140,
    height: 40,
    text: 'EFFECT\n(Problem)',
    fontSize: 16,
    fontFamily: 1,
    textAlign: 'center',
    verticalAlign: 'middle',
    strokeColor: COLORS.red,
    originalText: 'EFFECT\n(Problem)',
    autoResize: true,
    lineHeight: 1.25,
  }));

  // ── 4. Build each category rib ──
  for (const cat of CATEGORIES) {
    const isTop = cat.side === 'top';
    const signY = isTop ? -1 : 1;

    const ribBaseX = cat.ribAttachX;
    const ribBaseY = SPINE_Y;
    const ribEndX  = ribBaseX - RIB_DX;
    const ribEndY  = ribBaseY + signY * RIB_DY;

    const color = COLORS[cat.color] || COLORS.black;
    const bgColor = BG_COLORS[cat.color] || 'transparent';

    // ── Diagonal rib line ──
    elements.push(makeBase({
      type: 'line',
      x: ribEndX,
      y: ribEndY,
      width: ribBaseX - ribEndX,
      height: ribBaseY - ribEndY,
      strokeColor: color,
      strokeWidth: 2,
      points: [[0, 0], [ribBaseX - ribEndX, ribBaseY - ribEndY]],
    }));

    // ── Category label box ──
    const boxX = ribEndX - CAT_W / 2;
    const boxY = isTop ? ribEndY - CAT_H - 8 : ribEndY + 8;

    elements.push(makeBase({
      type: 'rectangle',
      x: boxX,
      y: boxY,
      width: CAT_W,
      height: CAT_H,
      strokeColor: color,
      backgroundColor: bgColor,
      fillStyle: 'solid',
      roundness: { type: 3 },
    }));

    // Category label text
    elements.push(makeBase({
      type: 'text',
      x: boxX + 10,
      y: boxY + 8,
      width: CAT_W - 20,
      height: 24,
      text: cat.name,
      fontSize: 16,
      fontFamily: 1,
      textAlign: 'center',
      verticalAlign: 'middle',
      strokeColor: color,
      originalText: cat.name,
      autoResize: true,
      lineHeight: 1.25,
    }));

    // ── Sub-cause lines (3 per rib) ──
    for (let i = 0; i < 3; i++) {
      const t = 0.25 + i * 0.25;
      const sx = ribEndX + t * (ribBaseX - ribEndX);
      const sy = ribEndY + t * (ribBaseY - ribEndY);
      const subEndX = sx - SUB_DX;
      const subEndY = sy + signY * (-SUB_DY);

      elements.push(makeBase({
        type: 'line',
        x: subEndX,
        y: subEndY,
        width: sx - subEndX,
        height: sy - subEndY,
        strokeColor: color,
        strokeWidth: 1,
        points: [[0, 0], [sx - subEndX, sy - subEndY]],
      }));

      // Sub-cause label
      elements.push(makeBase({
        type: 'text',
        x: subEndX - 40,
        y: isTop ? subEndY - 22 : subEndY + 4,
        width: 80,
        height: 18,
        text: `Cause ${i + 1}`,
        fontSize: 14,
        fontFamily: 1,
        textAlign: 'center',
        verticalAlign: 'top',
        strokeColor: color,
        originalText: `Cause ${i + 1}`,
        autoResize: true,
        lineHeight: 1.25,
      }));
    }
  }

  // ── 5. Instruction footnote ──
  elements.push(makeBase({
    type: 'text',
    x: SPINE_X0,
    y: SPINE_Y + RIB_DY + 120,
    width: 800,
    height: 20,
    text: 'Double-click any text to edit  ·  Drag shapes to rearrange  ·  Add more causes with the arrow or line tool',
    fontSize: 14,
    fontFamily: 1,
    textAlign: 'left',
    verticalAlign: 'top',
    strokeColor: COLORS.grey,
    originalText: 'Double-click any text to edit  ·  Drag shapes to rearrange  ·  Add more causes with the arrow or line tool',
    autoResize: true,
    lineHeight: 1.25,
  }));

  // ── Apply to canvas ──
  excalidrawAPI.updateScene({ elements });
  excalidrawAPI.scrollToContent(undefined, { fitToViewport: true, animate: true });
}
