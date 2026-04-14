import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/types';

/* ────────────────────────────────────────────────────────────────────────────
 * Org Chart Template — Professional hierarchical organizational structure
 * with CEO, VP layer, Director layer, and team members.
 * ──────────────────────────────────────────────────────────────────────────── */

let _id = 0;
const uid = () => `oc_${Date.now()}_${++_id}`;
const seed = () => Math.floor(Math.random() * 1e6);

const C = {
  navy: '#1e3a5f', blue: '#1971c2', sky: '#0ea5e9',
  green: '#059669', teal: '#0d9488',
  purple: '#7c3aed', indigo: '#4f46e5',
  amber: '#d97706', orange: '#ea580c',
  slate: '#475569', gray: '#94a3b8', black: '#1e1e1e',
};
const BG = {
  navy: '#e0e7ff', blue: '#dbeafe', sky: '#e0f2fe',
  green: '#d1fae5', teal: '#ccfbf1',
  purple: '#ede9fe', indigo: '#e0e7ff',
  amber: '#fef3c7', orange: '#ffedd5',
  slate: '#f1f5f9', white: '#ffffff',
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

function personCard(x: number, y: number, name: string, title: string, color: string, bg: string, e: any[], w = 180, h = 60) {
  // Card body
  e.push(el({
    type: 'rectangle', x, y, width: w, height: h,
    strokeColor: color, backgroundColor: BG.white, roundness: { type: 3 }, strokeWidth: 1.5,
  }));
  // Color accent bar (top)
  e.push(el({
    type: 'rectangle', x: x + 1, y: y + 1, width: w - 2, height: 6,
    strokeColor: 'transparent', backgroundColor: color, roundness: { type: 3 }, strokeWidth: 0,
  }));
  // Avatar circle
  e.push(el({
    type: 'ellipse', x: x + 12, y: y + 16, width: 30, height: 30,
    strokeColor: color, backgroundColor: bg, strokeWidth: 1,
  }));
  // Initials
  const initials = name.split(' ').map(n => n[0]).join('');
  e.push(el({
    type: 'text', x: x + 15, y: y + 24, width: 24, height: 14,
    text: initials, originalText: initials,
    fontSize: 11, fontFamily: 3, textAlign: 'center', verticalAlign: 'middle',
    strokeColor: color, autoResize: true, lineHeight: 1.25,
  }));
  // Name
  e.push(el({
    type: 'text', x: x + 48, y: y + 14, width: w - 58, height: 18,
    text: name, originalText: name,
    fontSize: 13, fontFamily: 3, textAlign: 'left', verticalAlign: 'middle',
    strokeColor: C.slate, autoResize: true, lineHeight: 1.25,
  }));
  // Title
  e.push(el({
    type: 'text', x: x + 48, y: y + 34, width: w - 58, height: 14,
    text: title, originalText: title,
    fontSize: 10, fontFamily: 3, textAlign: 'left', verticalAlign: 'middle',
    strokeColor: C.gray, autoResize: true, lineHeight: 1.25,
  }));
}

export function applyOrgChartTemplate(api: ExcalidrawImperativeAPI) {
  _id = 0;
  const e: any[] = [];

  const CX = 500; // center X
  const CARD_W = 180;
  const CARD_H = 60;

  // ── Title ──
  e.push(el({
    type: 'text', x: CX - 200, y: 20, width: 400, height: 36,
    text: 'Organization Chart', originalText: 'Organization Chart',
    fontSize: 28, fontFamily: 3, textAlign: 'center', verticalAlign: 'top',
    strokeColor: C.navy, autoResize: true, lineHeight: 1.25,
  }));
  e.push(el({
    type: 'text', x: CX - 200, y: 56, width: 400, height: 18,
    text: 'Company Name  ·  Updated April 2026', originalText: 'Company Name  ·  Updated April 2026',
    fontSize: 12, fontFamily: 3, textAlign: 'center', verticalAlign: 'top',
    strokeColor: C.gray, autoResize: true, lineHeight: 1.25,
  }));

  // ── Level 0: CEO ──
  const ceoX = CX - CARD_W / 2;
  const ceoY = 90;
  personCard(ceoX, ceoY, 'Jane Smith', 'Chief Executive Officer', C.navy, BG.navy, e);

  // ── Level 1: VPs (3) ──
  const vpY = 200;
  const vpSpacing = 240;
  const vps = [
    { name: 'Alex Johnson', title: 'VP Engineering', color: C.blue, bg: BG.blue },
    { name: 'Maria Garcia', title: 'VP Product', color: C.purple, bg: BG.purple },
    { name: 'David Lee', title: 'VP Operations', color: C.green, bg: BG.green },
  ];

  vps.forEach((vp, i) => {
    const vpX = CX - (vps.length * vpSpacing) / 2 + i * vpSpacing + (vpSpacing - CARD_W) / 2;
    personCard(vpX, vpY, vp.name, vp.title, vp.color, vp.bg, e);

    // Connector from CEO to VP
    const fromX = CX;
    const fromY = ceoY + CARD_H;
    const toX = vpX + CARD_W / 2;
    const toY = vpY;
    e.push(el({
      type: 'arrow', x: fromX, y: fromY, width: toX - fromX, height: toY - fromY,
      strokeColor: C.gray, strokeWidth: 1.5,
      points: [[0, 0], [0, (toY - fromY) / 2], [toX - fromX, (toY - fromY) / 2], [toX - fromX, toY - fromY]],
      startArrowhead: null, endArrowhead: null,
    }));
  });

  // ── Level 2: Directors (6 — 2 per VP) ──
  const dirY = 320;
  const dirSpacing = 200;
  const directors = [
    [
      { name: 'Sam Wilson', title: 'Dir. Frontend', color: C.sky, bg: BG.sky },
      { name: 'Lisa Chen', title: 'Dir. Backend', color: C.teal, bg: BG.teal },
    ],
    [
      { name: 'Tom Brown', title: 'Dir. Design', color: C.indigo, bg: BG.indigo },
      { name: 'Amy White', title: 'Dir. Strategy', color: C.purple, bg: BG.purple },
    ],
    [
      { name: 'Chris Park', title: 'Dir. Supply Chain', color: C.amber, bg: BG.amber },
      { name: 'Nadia Patel', title: 'Dir. Quality', color: C.orange, bg: BG.orange },
    ],
  ];

  directors.forEach((dirGroup, gi) => {
    const vpCenterX = CX - (vps.length * vpSpacing) / 2 + gi * vpSpacing + vpSpacing / 2;
    const groupWidth = dirGroup.length * dirSpacing;

    dirGroup.forEach((dir, di) => {
      const dirX = vpCenterX - groupWidth / 2 + di * dirSpacing + (dirSpacing - CARD_W) / 2;
      personCard(dirX, dirY, dir.name, dir.title, dir.color, dir.bg, e);

      // Connector from VP to Director
      const fromX = vpCenterX;
      const fromY = vpY + CARD_H;
      const toX = dirX + CARD_W / 2;
      const toY = dirY;
      e.push(el({
        type: 'arrow', x: fromX, y: fromY, width: toX - fromX, height: toY - fromY,
        strokeColor: C.gray, strokeWidth: 1, strokeStyle: 'dashed',
        points: [[0, 0], [0, (toY - fromY) / 2], [toX - fromX, (toY - fromY) / 2], [toX - fromX, toY - fromY]],
        startArrowhead: null, endArrowhead: null,
      }));
    });
  });

  // ── Instruction ──
  e.push(el({
    type: 'text', x: CX - 350, y: dirY + CARD_H + 40, width: 700, height: 16,
    text: 'Double-click to edit names & titles  ·  Duplicate cards to add team members  ·  Drag to rearrange hierarchy',
    originalText: 'Double-click to edit names & titles  ·  Duplicate cards to add team members  ·  Drag to rearrange hierarchy',
    fontSize: 11, fontFamily: 3, textAlign: 'center', verticalAlign: 'top',
    strokeColor: C.gray, autoResize: true, lineHeight: 1.25,
  }));

  api.updateScene({ elements: e });
  api.scrollToContent(undefined, { fitToViewport: true, animate: true });
}
