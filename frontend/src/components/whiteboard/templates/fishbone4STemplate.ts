import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/types';

/* ────────────────────────────────────────────────────────────────────────────
 * Fishbone 4S — Service Industry Root Cause Analysis
 *
 * Enterprise-grade Ishikawa variant for service/hospitality/healthcare:
 *   Surroundings • Suppliers • Systems • Skills
 *
 * Features:
 *   - 4 primary categories (2 top, 2 bottom)
 *   - 5 detailed sub-causes per category (20 total)
 *   - Severity-coded sub-cause labels (High / Med / Low)
 *   - Legend panel with color-coded severity indicators
 *   - Department ownership annotation boxes per category
 *   - Clean professional geometry (roughness: 0)
 * ──────────────────────────────────────────────────────────────────────────── */

let _id = 0;
const uid = () => `f4s_${Date.now()}_${++_id}`;
const seed = () => Math.floor(Math.random() * 1e6);

const COL: Record<string, string> = {
  indigo:  '#4263eb', amber: '#f59f00', emerald: '#2f9e44',
  rose:    '#e8590c', black: '#1e1e1e', gray: '#868e96',
  darkGray:'#495057', red: '#e03131', orange: '#e8590c',
};
const BG: Record<string, string> = {
  indigo:  '#dbe4ff', amber: '#fff3bf', emerald: '#d3f9d8',
  rose:    '#ffe8cc', red: '#ffe3e3', white: '#ffffff',
  lightGray: '#f8f9fa',
};

interface Cat {
  name: string;
  color: string;
  attachX: number;
  side: 'top' | 'bottom';
  owner: string;
  subs: { label: string; severity: 'high' | 'med' | 'low' }[];
}

const CATS: Cat[] = [
  {
    name: 'Surroundings',
    color: 'indigo',
    attachX: 460,
    side: 'top',
    owner: 'Facilities Dept.',
    subs: [
      { label: 'Facility layout', severity: 'high' },
      { label: 'Ambient conditions', severity: 'med' },
      { label: 'Signage & wayfinding', severity: 'low' },
      { label: 'Cleanliness standards', severity: 'med' },
      { label: 'Safety compliance', severity: 'high' },
    ],
  },
  {
    name: 'Suppliers',
    color: 'amber',
    attachX: 960,
    side: 'top',
    owner: 'Procurement Dept.',
    subs: [
      { label: 'Vendor SLA adherence', severity: 'high' },
      { label: 'Material quality', severity: 'high' },
      { label: 'Delivery timeliness', severity: 'med' },
      { label: 'Contract compliance', severity: 'med' },
      { label: 'Backup sourcing', severity: 'low' },
    ],
  },
  {
    name: 'Systems',
    color: 'emerald',
    attachX: 460,
    side: 'bottom',
    owner: 'IT / Operations Dept.',
    subs: [
      { label: 'Software reliability', severity: 'high' },
      { label: 'Data integrity', severity: 'high' },
      { label: 'Integration gaps', severity: 'med' },
      { label: 'Access controls', severity: 'med' },
      { label: 'Monitoring & alerts', severity: 'low' },
    ],
  },
  {
    name: 'Skills',
    color: 'rose',
    attachX: 960,
    side: 'bottom',
    owner: 'HR / Training Dept.',
    subs: [
      { label: 'Training adequacy', severity: 'high' },
      { label: 'Certification gaps', severity: 'med' },
      { label: 'Experience level', severity: 'med' },
      { label: 'Cross-training depth', severity: 'low' },
      { label: 'Knowledge retention', severity: 'low' },
    ],
  },
];

// Layout constants
const SY  = 520;
const SX0 = 100;
const SX1 = 1500;
const EX  = 1520;
const EW  = 240, EH = 80;

// Rib geometry
const RIB_DX = 280, RIB_DY = 230;
const CAT_W = 170, CAT_H = 44;
const SUB_DX = 50, SUB_DY = 36;
const OWNER_W = 150, OWNER_H = 28;

// Severity colors
const SEV_COL: Record<string, string> = {
  high: '#e03131',
  med:  '#f59f00',
  low:  '#868e96',
};
const SEV_BG: Record<string, string> = {
  high: '#ffe3e3',
  med:  '#fff3bf',
  low:  '#f8f9fa',
};

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

export function applyFishbone4STemplate(api: ExcalidrawImperativeAPI) {
  _id = 0;
  const elems: any[] = [];

  // ── Title ──
  elems.push(el({
    type: 'text', x: SX0, y: SY - RIB_DY - 190, width: 580, height: 36,
    text: 'Fishbone 4S — Service Industry RCA',
    originalText: 'Fishbone 4S — Service Industry RCA',
    fontSize: 28, fontFamily: 3, textAlign: 'left', verticalAlign: 'top',
    strokeColor: COL.black, autoResize: true, lineHeight: 1.25,
  }));

  // ── Subtitle ──
  elems.push(el({
    type: 'text', x: SX0, y: SY - RIB_DY - 150, width: 600, height: 22,
    text: 'ISO 9001 / Service Excellence Framework — Surroundings · Suppliers · Systems · Skills',
    originalText: 'ISO 9001 / Service Excellence Framework — Surroundings · Suppliers · Systems · Skills',
    fontSize: 14, fontFamily: 3, textAlign: 'left', verticalAlign: 'top',
    strokeColor: COL.gray, autoResize: true, lineHeight: 1.25,
  }));

  // ── Severity Legend ──
  const lgX = SX0 + 720, lgY = SY - RIB_DY - 195;
  elems.push(el({
    type: 'rectangle', x: lgX, y: lgY, width: 280, height: 70,
    strokeColor: COL.gray, backgroundColor: BG.lightGray,
    roundness: { type: 3 }, strokeWidth: 1,
  }));
  elems.push(el({
    type: 'text', x: lgX + 10, y: lgY + 6, width: 260, height: 16,
    text: 'SEVERITY LEGEND', originalText: 'SEVERITY LEGEND',
    fontSize: 11, fontFamily: 3, textAlign: 'center', verticalAlign: 'top',
    strokeColor: COL.darkGray, autoResize: true, lineHeight: 1.25,
  }));
  const sevLabels = [
    { label: '● High Impact', color: SEV_COL.high, dx: 10 },
    { label: '● Medium Impact', color: SEV_COL.med, dx: 100 },
    { label: '● Low Impact', color: SEV_COL.low, dx: 200 },
  ];
  for (const sv of sevLabels) {
    elems.push(el({
      type: 'text', x: lgX + sv.dx, y: lgY + 36, width: 90, height: 16,
      text: sv.label, originalText: sv.label,
      fontSize: 11, fontFamily: 3, textAlign: 'left', verticalAlign: 'top',
      strokeColor: sv.color, autoResize: true, lineHeight: 1.25,
    }));
  }

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
    strokeColor: '#c92a2a', backgroundColor: BG.red, strokeWidth: 2,
    roundness: { type: 3 },
  }));
  elems.push(el({
    type: 'text', x: EX + 20, y: SY - 24, width: EW - 40, height: 48,
    text: 'SERVICE\nDEFECT', originalText: 'SERVICE\nDEFECT',
    fontSize: 18, fontFamily: 3, textAlign: 'center', verticalAlign: 'middle',
    strokeColor: '#c92a2a', autoResize: true, lineHeight: 1.25,
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
    const by = top ? ribY0 - CAT_H - 12 : ribY0 + 12;
    elems.push(el({
      type: 'rectangle', x: bx, y: by, width: CAT_W, height: CAT_H,
      strokeColor: color, backgroundColor: bg,
      roundness: { type: 3 }, strokeWidth: 2,
    }));
    elems.push(el({
      type: 'text', x: bx + 8, y: by + 10, width: CAT_W - 16, height: 24,
      text: cat.name.toUpperCase(), originalText: cat.name.toUpperCase(),
      fontSize: 16, fontFamily: 3, textAlign: 'center', verticalAlign: 'middle',
      strokeColor: color, autoResize: true, lineHeight: 1.25,
    }));

    // Owner annotation
    const ownerY = top ? by - OWNER_H - 4 : by + CAT_H + 4;
    elems.push(el({
      type: 'rectangle', x: bx + (CAT_W - OWNER_W) / 2, y: ownerY,
      width: OWNER_W, height: OWNER_H,
      strokeColor: COL.gray, backgroundColor: BG.lightGray,
      roundness: { type: 3 }, strokeWidth: 1, strokeStyle: 'dashed',
    }));
    elems.push(el({
      type: 'text', x: bx + (CAT_W - OWNER_W) / 2 + 6, y: ownerY + 5,
      width: OWNER_W - 12, height: 16,
      text: cat.owner, originalText: cat.owner,
      fontSize: 11, fontFamily: 3, textAlign: 'center', verticalAlign: 'top',
      strokeColor: COL.gray, autoResize: true, lineHeight: 1.25,
    }));

    // Sub-cause branches (5 per rib)
    for (let i = 0; i < cat.subs.length; i++) {
      const sub = cat.subs[i];
      const t = 0.15 + i * 0.16;
      const mx = ribX0 + t * (ribX1 - ribX0);
      const my = ribY0 + t * (ribY1 - ribY0);
      const ex = mx - SUB_DX;
      const ey = my - dir * SUB_DY;
      const sevColor = SEV_COL[sub.severity];

      // Sub-cause line
      elems.push(el({
        type: 'line', x: ex, y: ey,
        width: mx - ex, height: my - ey,
        strokeColor: color, strokeWidth: 1,
        points: [[0, 0], [mx - ex, my - ey]],
      }));

      // Severity indicator dot
      elems.push(el({
        type: 'ellipse', x: ex - 7, y: ey - 4, width: 6, height: 6,
        strokeColor: sevColor, backgroundColor: sevColor, strokeWidth: 1,
      }));

      // Sub-cause label
      elems.push(el({
        type: 'text', x: ex - 100, y: top ? ey - 18 : ey + 4,
        width: 90, height: 14,
        text: sub.label, originalText: sub.label,
        fontSize: 12, fontFamily: 3, textAlign: 'right', verticalAlign: 'top',
        strokeColor: color, autoResize: true, lineHeight: 1.25,
      }));
    }
  }

  // ── Instruction ──
  elems.push(el({
    type: 'text', x: SX0, y: SY + RIB_DY + 120, width: 700, height: 18,
    text: 'Double-click any text to edit  ·  Drag shapes to rearrange  ·  Color-coded severity: ● High  ● Med  ● Low',
    originalText: 'Double-click any text to edit  ·  Drag shapes to rearrange  ·  Color-coded severity: ● High  ● Med  ● Low',
    fontSize: 13, fontFamily: 3, textAlign: 'left', verticalAlign: 'top',
    strokeColor: COL.gray, autoResize: true, lineHeight: 1.25,
  }));

  api.updateScene({ elements: elems });
  api.scrollToContent(undefined, { fitToViewport: true, animate: true });
}
