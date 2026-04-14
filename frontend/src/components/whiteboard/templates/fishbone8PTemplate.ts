import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/types';

/* ────────────────────────────────────────────────────────────────────────────
 * Fishbone 8P — Marketing & Service Operations RCA
 *
 * Enterprise-grade Ishikawa variant based on the 8P marketing framework:
 *   Product • Price • Place • Promotion (top)
 *   People • Process • Physical Evidence • Productivity (bottom)
 *
 * Features:
 *   - 8 primary categories (4 top, 4 bottom)
 *   - 3 sub-causes per category (24 total)
 *   - Wider canvas for 8-category layout
 *   - Category numbering for systematic analysis
 *   - Metrics tracking box per category
 *   - Clean professional geometry (roughness: 0)
 * ──────────────────────────────────────────────────────────────────────────── */

let _id = 0;
const uid = () => `f8p_${Date.now()}_${++_id}`;
const seed = () => Math.floor(Math.random() * 1e6);

const COL: Record<string, string> = {
  blue:    '#1971c2', red:    '#e03131', green:   '#2f9e44',
  orange:  '#e8590c', violet: '#7048e8', teal:    '#0c8599',
  pink:    '#d6336c', cyan:   '#1098ad', black:   '#1e1e1e',
  gray:    '#868e96', darkGray: '#495057',
};
const BG: Record<string, string> = {
  blue:    '#d0ebff', red:    '#ffe3e3', green:   '#d3f9d8',
  orange:  '#ffe8cc', violet: '#e5dbff', teal:    '#c3fae8',
  pink:    '#ffe0f0', cyan:   '#c3fae8', lightGray: '#f8f9fa',
};

interface Cat {
  name: string;
  num: number;
  color: string;
  attachX: number;
  side: 'top' | 'bottom';
  kpi: string;
  subs: string[];
}

const CATS: Cat[] = [
  {
    name: 'Product', num: 1, color: 'blue', attachX: 360, side: 'top',
    kpi: 'KPI: Quality Score',
    subs: ['Feature gaps', 'Defect rate', 'Usability issues'],
  },
  {
    name: 'Price', num: 2, color: 'green', attachX: 720, side: 'top',
    kpi: 'KPI: Price Elasticity',
    subs: ['Price positioning', 'Margin erosion', 'Discount overuse'],
  },
  {
    name: 'Place', num: 3, color: 'violet', attachX: 1080, side: 'top',
    kpi: 'KPI: Distribution %',
    subs: ['Channel coverage', 'Availability gaps', 'Logistics delays'],
  },
  {
    name: 'Promotion', num: 4, color: 'pink', attachX: 1440, side: 'top',
    kpi: 'KPI: Conversion Rate',
    subs: ['Message clarity', 'Channel ROI', 'Campaign timing'],
  },
  {
    name: 'People', num: 5, color: 'teal', attachX: 360, side: 'bottom',
    kpi: 'KPI: CSAT Score',
    subs: ['Skill gaps', 'Staffing levels', 'Turnover rate'],
  },
  {
    name: 'Process', num: 6, color: 'orange', attachX: 720, side: 'bottom',
    kpi: 'KPI: Cycle Time',
    subs: ['Bottlenecks', 'Handoff failures', 'SOP compliance'],
  },
  {
    name: 'Physical Evid.', num: 7, color: 'cyan', attachX: 1080, side: 'bottom',
    kpi: 'KPI: Brand Perception',
    subs: ['Environment quality', 'Digital experience', 'Collateral gaps'],
  },
  {
    name: 'Productivity', num: 8, color: 'red', attachX: 1440, side: 'bottom',
    kpi: 'KPI: Output / Hour',
    subs: ['Resource waste', 'Automation gaps', 'Throughput limits'],
  },
];

// Layout — wider canvas for 8 categories
const SY  = 520;
const SX0 = 80;
const SX1 = 1820;
const EX  = 1840;
const EW  = 260, EH = 85;

// Rib geometry
const RIB_DX = 200, RIB_DY = 210;
const CAT_W = 150, CAT_H = 42;
const SUB_DX = 50, SUB_DY = 42;
const KPI_W = 130, KPI_H = 22;

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

export function applyFishbone8PTemplate(api: ExcalidrawImperativeAPI) {
  _id = 0;
  const elems: any[] = [];

  // ── Title ──
  elems.push(el({
    type: 'text', x: SX0, y: SY - RIB_DY - 200, width: 620, height: 36,
    text: 'Fishbone 8P — Marketing & Service RCA',
    originalText: 'Fishbone 8P — Marketing & Service RCA',
    fontSize: 28, fontFamily: 3, textAlign: 'left', verticalAlign: 'top',
    strokeColor: COL.black, autoResize: true, lineHeight: 1.25,
  }));

  // ── Subtitle ──
  elems.push(el({
    type: 'text', x: SX0, y: SY - RIB_DY - 160, width: 800, height: 22,
    text: 'Extended Marketing Mix Framework — Product · Price · Place · Promotion · People · Process · Physical Evidence · Productivity',
    originalText: 'Extended Marketing Mix Framework — Product · Price · Place · Promotion · People · Process · Physical Evidence · Productivity',
    fontSize: 14, fontFamily: 3, textAlign: 'left', verticalAlign: 'top',
    strokeColor: COL.gray, autoResize: true, lineHeight: 1.25,
  }));

  // ── Analysis metadata box ──
  const metaX = SX0 + 900, metaY = SY - RIB_DY - 210;
  elems.push(el({
    type: 'rectangle', x: metaX, y: metaY, width: 320, height: 80,
    strokeColor: COL.gray, backgroundColor: BG.lightGray,
    roundness: { type: 3 }, strokeWidth: 1,
  }));
  elems.push(el({
    type: 'text', x: metaX + 12, y: metaY + 8, width: 300, height: 64,
    text: 'Analysis Date: ___________\nAnalyst: ___________\nProblem ID: ___________',
    originalText: 'Analysis Date: ___________\nAnalyst: ___________\nProblem ID: ___________',
    fontSize: 12, fontFamily: 3, textAlign: 'left', verticalAlign: 'top',
    strokeColor: COL.darkGray, autoResize: true, lineHeight: 1.25,
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
    strokeColor: '#c92a2a', backgroundColor: BG.red, strokeWidth: 2,
    roundness: { type: 3 },
  }));
  elems.push(el({
    type: 'text', x: EX + 20, y: SY - 30, width: EW - 40, height: 60,
    text: 'MARKET\nPERFORMANCE\nGAP', originalText: 'MARKET\nPERFORMANCE\nGAP',
    fontSize: 16, fontFamily: 3, textAlign: 'center', verticalAlign: 'middle',
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

    // Category rounded box with number badge
    const bx = ribX0 - CAT_W / 2;
    const by = top ? ribY0 - CAT_H - 10 : ribY0 + 10;
    elems.push(el({
      type: 'rectangle', x: bx, y: by, width: CAT_W, height: CAT_H,
      strokeColor: color, backgroundColor: bg,
      roundness: { type: 3 }, strokeWidth: 2,
    }));

    // Number badge (circle)
    const badgeR = 12;
    const badgeX = bx - badgeR - 2;
    const badgeY = by + (CAT_H - badgeR * 2) / 2;
    elems.push(el({
      type: 'ellipse', x: badgeX, y: badgeY, width: badgeR * 2, height: badgeR * 2,
      strokeColor: color, backgroundColor: color, strokeWidth: 1,
    }));
    elems.push(el({
      type: 'text', x: badgeX + 4, y: badgeY + 3, width: badgeR * 2 - 8, height: 18,
      text: `${cat.num}`, originalText: `${cat.num}`,
      fontSize: 13, fontFamily: 3, textAlign: 'center', verticalAlign: 'middle',
      strokeColor: '#ffffff', autoResize: true, lineHeight: 1.25,
    }));

    // Category label
    elems.push(el({
      type: 'text', x: bx + 8, y: by + 10, width: CAT_W - 16, height: 22,
      text: cat.name.toUpperCase(), originalText: cat.name.toUpperCase(),
      fontSize: 14, fontFamily: 3, textAlign: 'center', verticalAlign: 'middle',
      strokeColor: color, autoResize: true, lineHeight: 1.25,
    }));

    // KPI annotation below/above the category
    const kpiY = top ? by - KPI_H - 4 : by + CAT_H + 4;
    elems.push(el({
      type: 'text', x: bx + (CAT_W - KPI_W) / 2, y: kpiY,
      width: KPI_W, height: KPI_H,
      text: cat.kpi, originalText: cat.kpi,
      fontSize: 10, fontFamily: 3, textAlign: 'center', verticalAlign: 'top',
      strokeColor: COL.gray, autoResize: true, lineHeight: 1.25,
    }));

    // Sub-cause branches (3 per rib)
    for (let i = 0; i < cat.subs.length; i++) {
      const t = 0.22 + i * 0.24;
      const mx = ribX0 + t * (ribX1 - ribX0);
      const my = ribY0 + t * (ribY1 - ribY0);
      const ex = mx - SUB_DX;
      const ey = my - dir * SUB_DY;

      // Sub-cause line
      elems.push(el({
        type: 'line', x: ex, y: ey,
        width: mx - ex, height: my - ey,
        strokeColor: color, strokeWidth: 1,
        points: [[0, 0], [mx - ex, my - ey]],
      }));

      // Sub-cause label
      elems.push(el({
        type: 'text', x: ex - 80, y: top ? ey - 18 : ey + 4,
        width: 80, height: 14,
        text: cat.subs[i], originalText: cat.subs[i],
        fontSize: 12, fontFamily: 3, textAlign: 'right', verticalAlign: 'top',
        strokeColor: color, autoResize: true, lineHeight: 1.25,
      }));
    }
  }

  // ── Instruction ──
  elems.push(el({
    type: 'text', x: SX0, y: SY + RIB_DY + 120, width: 800, height: 18,
    text: 'Double-click any text to edit  ·  8P categories numbered for systematic analysis  ·  Each category includes a KPI target',
    originalText: 'Double-click any text to edit  ·  8P categories numbered for systematic analysis  ·  Each category includes a KPI target',
    fontSize: 13, fontFamily: 3, textAlign: 'left', verticalAlign: 'top',
    strokeColor: COL.gray, autoResize: true, lineHeight: 1.25,
  }));

  api.updateScene({ elements: elems });
  api.scrollToContent(undefined, { fitToViewport: true, animate: true });
}
