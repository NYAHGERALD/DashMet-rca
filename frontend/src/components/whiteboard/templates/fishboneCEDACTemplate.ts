import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/types';

/* ────────────────────────────────────────────────────────────────────────────
 * Fishbone CEDAC — Cause & Effect Diagram with Addition of Cards
 *
 * Enterprise-grade Dr. Ryuji Fukuda CEDAC variant:
 *   People • Process • Equipment • Materials • Standards
 *
 * Features:
 *   - 5 primary categories (3 top, 2 bottom)
 *   - 3 sub-causes per category (15 total)
 *   - Each sub-cause has a dual "Fact" + "Idea" card attachment
 *   - Structured for Kaizen continuous-improvement workshops
 *   - Color-coded Fact (blue) and Idea (green) card system
 *   - Card legend panel
 *   - Clean professional geometry (roughness: 0)
 * ──────────────────────────────────────────────────────────────────────────── */

let _id = 0;
const uid = () => `fce_${Date.now()}_${++_id}`;
const seed = () => Math.floor(Math.random() * 1e6);

const COL: Record<string, string> = {
  blue:    '#1971c2', red:    '#e03131', green:   '#2f9e44',
  orange:  '#e8590c', violet: '#7048e8', teal:    '#0c8599',
  black:   '#1e1e1e', gray:   '#868e96', darkGray:'#495057',
};
const BG: Record<string, string> = {
  blue:    '#d0ebff', red:    '#ffe3e3', green:   '#d3f9d8',
  orange:  '#ffe8cc', violet: '#e5dbff', teal:    '#c3fae8',
  factBlue:'#dbe4ff', ideaGreen:'#d3f9d8', lightGray:'#f8f9fa',
};

interface Cat {
  name: string;
  color: string;
  attachX: number;
  side: 'top' | 'bottom';
  subs: string[];
}

const CATS: Cat[] = [
  {
    name: 'People',
    color: 'blue',
    attachX: 410,
    side: 'top',
    subs: ['Competency gaps', 'Workload distribution', 'Communication'],
  },
  {
    name: 'Process',
    color: 'green',
    attachX: 790,
    side: 'top',
    subs: ['Standard procedures', 'Handoff failures', 'Cycle time variance'],
  },
  {
    name: 'Equipment',
    color: 'violet',
    attachX: 1170,
    side: 'top',
    subs: ['Downtime frequency', 'Calibration drift', 'Maintenance gaps'],
  },
  {
    name: 'Materials',
    color: 'orange',
    attachX: 510,
    side: 'bottom',
    subs: ['Spec compliance', 'Supplier variance', 'Storage conditions'],
  },
  {
    name: 'Standards',
    color: 'teal',
    attachX: 980,
    side: 'bottom',
    subs: ['Regulatory changes', 'Audit non-conformance', 'Documentation gaps'],
  },
];

// Layout
const SY  = 560;
const SX0 = 100;
const SX1 = 1520;
const EX  = 1540;
const EW  = 240, EH = 85;

// Rib geometry
const RIB_DX = 240, RIB_DY = 240;
const CAT_W = 160, CAT_H = 44;
const SUB_DX = 60, SUB_DY = 50;

// Card dimensions
const CARD_W = 70, CARD_H = 38;
const CARD_GAP = 4;

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

export function applyFishboneCEDACTemplate(api: ExcalidrawImperativeAPI) {
  _id = 0;
  const elems: any[] = [];

  // ── Title ──
  elems.push(el({
    type: 'text', x: SX0, y: SY - RIB_DY - 230, width: 660, height: 36,
    text: 'CEDAC — Cause & Effect Diagram with Addition of Cards',
    originalText: 'CEDAC — Cause & Effect Diagram with Addition of Cards',
    fontSize: 26, fontFamily: 3, textAlign: 'left', verticalAlign: 'top',
    strokeColor: COL.black, autoResize: true, lineHeight: 1.25,
  }));

  // ── Subtitle ──
  elems.push(el({
    type: 'text', x: SX0, y: SY - RIB_DY - 190, width: 700, height: 22,
    text: 'Dr. Ryuji Fukuda Method — Kaizen Workshop Format — People · Process · Equipment · Materials · Standards',
    originalText: 'Dr. Ryuji Fukuda Method — Kaizen Workshop Format — People · Process · Equipment · Materials · Standards',
    fontSize: 14, fontFamily: 3, textAlign: 'left', verticalAlign: 'top',
    strokeColor: COL.gray, autoResize: true, lineHeight: 1.25,
  }));

  // ── Card Legend ──
  const lgX = SX0 + 780, lgY = SY - RIB_DY - 240;
  elems.push(el({
    type: 'rectangle', x: lgX, y: lgY, width: 310, height: 90,
    strokeColor: COL.gray, backgroundColor: BG.lightGray,
    roundness: { type: 3 }, strokeWidth: 1,
  }));
  elems.push(el({
    type: 'text', x: lgX + 10, y: lgY + 6, width: 290, height: 16,
    text: 'CEDAC CARD SYSTEM', originalText: 'CEDAC CARD SYSTEM',
    fontSize: 12, fontFamily: 3, textAlign: 'center', verticalAlign: 'top',
    strokeColor: COL.darkGray, autoResize: true, lineHeight: 1.25,
  }));

  // Fact card sample
  elems.push(el({
    type: 'rectangle', x: lgX + 15, y: lgY + 32, width: 55, height: 24,
    strokeColor: COL.blue, backgroundColor: BG.factBlue,
    roundness: { type: 3 }, strokeWidth: 1,
  }));
  elems.push(el({
    type: 'text', x: lgX + 20, y: lgY + 36, width: 45, height: 16,
    text: 'FACT', originalText: 'FACT',
    fontSize: 10, fontFamily: 3, textAlign: 'center', verticalAlign: 'top',
    strokeColor: COL.blue, autoResize: true, lineHeight: 1.25,
  }));
  elems.push(el({
    type: 'text', x: lgX + 80, y: lgY + 36, width: 220, height: 16,
    text: '= Observable data / evidence (blue cards)',
    originalText: '= Observable data / evidence (blue cards)',
    fontSize: 10, fontFamily: 3, textAlign: 'left', verticalAlign: 'top',
    strokeColor: COL.darkGray, autoResize: true, lineHeight: 1.25,
  }));

  // Idea card sample
  elems.push(el({
    type: 'rectangle', x: lgX + 15, y: lgY + 60, width: 55, height: 24,
    strokeColor: COL.green, backgroundColor: BG.ideaGreen,
    roundness: { type: 3 }, strokeWidth: 1,
  }));
  elems.push(el({
    type: 'text', x: lgX + 20, y: lgY + 64, width: 45, height: 16,
    text: 'IDEA', originalText: 'IDEA',
    fontSize: 10, fontFamily: 3, textAlign: 'center', verticalAlign: 'top',
    strokeColor: COL.green, autoResize: true, lineHeight: 1.25,
  }));
  elems.push(el({
    type: 'text', x: lgX + 80, y: lgY + 64, width: 220, height: 16,
    text: '= Improvement suggestion / countermeasure (green cards)',
    originalText: '= Improvement suggestion / countermeasure (green cards)',
    fontSize: 10, fontFamily: 3, textAlign: 'left', verticalAlign: 'top',
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
    text: 'QUALITY\nOBJECTIVE\nGAP', originalText: 'QUALITY\nOBJECTIVE\nGAP',
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

    // Sub-cause branches with CEDAC cards
    for (let i = 0; i < cat.subs.length; i++) {
      const t = 0.20 + i * 0.26;
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
        type: 'text', x: ex - 100, y: top ? ey - 18 : ey + 4,
        width: 95, height: 14,
        text: cat.subs[i], originalText: cat.subs[i],
        fontSize: 12, fontFamily: 3, textAlign: 'right', verticalAlign: 'top',
        strokeColor: color, autoResize: true, lineHeight: 1.25,
      }));

      // ── CEDAC Fact Card (blue) ──
      const factX = ex - 100 - CARD_W - 8;
      const factY = top ? ey - CARD_H - CARD_GAP : ey + 18 + CARD_GAP;
      elems.push(el({
        type: 'rectangle', x: factX, y: factY, width: CARD_W, height: CARD_H,
        strokeColor: COL.blue, backgroundColor: BG.factBlue,
        roundness: { type: 3 }, strokeWidth: 1,
      }));
      elems.push(el({
        type: 'text', x: factX + 4, y: factY + 3, width: CARD_W - 8, height: 12,
        text: 'FACT', originalText: 'FACT',
        fontSize: 9, fontFamily: 3, textAlign: 'center', verticalAlign: 'top',
        strokeColor: COL.blue, autoResize: true, lineHeight: 1.25,
      }));
      elems.push(el({
        type: 'text', x: factX + 4, y: factY + 16, width: CARD_W - 8, height: 18,
        text: '(add data)', originalText: '(add data)',
        fontSize: 10, fontFamily: 3, textAlign: 'center', verticalAlign: 'top',
        strokeColor: COL.gray, autoResize: true, lineHeight: 1.25,
      }));

      // ── CEDAC Idea Card (green) ──
      const ideaX = factX + CARD_W + CARD_GAP;
      const ideaY = factY;
      elems.push(el({
        type: 'rectangle', x: ideaX, y: ideaY, width: CARD_W, height: CARD_H,
        strokeColor: COL.green, backgroundColor: BG.ideaGreen,
        roundness: { type: 3 }, strokeWidth: 1,
      }));
      elems.push(el({
        type: 'text', x: ideaX + 4, y: ideaY + 3, width: CARD_W - 8, height: 12,
        text: 'IDEA', originalText: 'IDEA',
        fontSize: 9, fontFamily: 3, textAlign: 'center', verticalAlign: 'top',
        strokeColor: COL.green, autoResize: true, lineHeight: 1.25,
      }));
      elems.push(el({
        type: 'text', x: ideaX + 4, y: ideaY + 16, width: CARD_W - 8, height: 18,
        text: '(add fix)', originalText: '(add fix)',
        fontSize: 10, fontFamily: 3, textAlign: 'center', verticalAlign: 'top',
        strokeColor: COL.gray, autoResize: true, lineHeight: 1.25,
      }));
    }
  }

  // ── Instruction ──
  elems.push(el({
    type: 'text', x: SX0, y: SY + RIB_DY + 130, width: 780, height: 18,
    text: 'Double-click any text to edit  ·  Blue FACT cards = evidence & data  ·  Green IDEA cards = countermeasures  ·  Add more cards as needed',
    originalText: 'Double-click any text to edit  ·  Blue FACT cards = evidence & data  ·  Green IDEA cards = countermeasures  ·  Add more cards as needed',
    fontSize: 13, fontFamily: 3, textAlign: 'left', verticalAlign: 'top',
    strokeColor: COL.gray, autoResize: true, lineHeight: 1.25,
  }));

  api.updateScene({ elements: elems });
  api.scrollToContent(undefined, { fitToViewport: true, animate: true });
}
