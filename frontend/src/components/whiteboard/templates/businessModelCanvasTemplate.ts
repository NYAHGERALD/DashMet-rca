import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/types';

/* ────────────────────────────────────────────────────────────────────────────
 * Business Model Canvas Template — Alexander Osterwalder's 9-block
 * strategic management tool for developing or documenting business models.
 * ──────────────────────────────────────────────────────────────────────────── */

let _id = 0;
const uid = () => `bmc_${Date.now()}_${++_id}`;
const seed = () => Math.floor(Math.random() * 1e6);

const C = {
  navy: '#1e3a5f', blue: '#1971c2', sky: '#0ea5e9',
  green: '#059669', emerald: '#10b981', teal: '#0d9488',
  amber: '#d97706', orange: '#ea580c', red: '#dc2626',
  purple: '#7c3aed', indigo: '#4f46e5', pink: '#db2777',
  slate: '#475569', gray: '#94a3b8', black: '#1e1e1e',
};
const BG = {
  blue: '#dbeafe', sky: '#e0f2fe', green: '#d1fae5',
  teal: '#ccfbf1', amber: '#fef3c7', orange: '#ffedd5',
  red: '#fee2e2', purple: '#ede9fe', indigo: '#e0e7ff',
  pink: '#fce7f3', slate: '#f1f5f9', white: '#ffffff',
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

function blockSection(
  x: number, y: number, w: number, h: number,
  title: string, icon: string, bullets: string[],
  color: string, bg: string, e: any[],
) {
  // Block background
  e.push(el({
    type: 'rectangle', x, y, width: w, height: h,
    strokeColor: color, backgroundColor: bg,
    roundness: { type: 3 }, strokeWidth: 1.5, opacity: 40,
  }));
  // Header accent
  e.push(el({
    type: 'rectangle', x: x + 1, y: y + 1, width: w - 2, height: 28,
    strokeColor: 'transparent', backgroundColor: color,
    roundness: { type: 3 }, strokeWidth: 0, opacity: 15,
  }));
  // Icon + title
  e.push(el({
    type: 'text', x: x + 10, y: y + 6, width: w - 20, height: 18,
    text: `${icon}  ${title}`, originalText: `${icon}  ${title}`,
    fontSize: 12, fontFamily: 3, textAlign: 'left', verticalAlign: 'middle',
    strokeColor: color, autoResize: true, lineHeight: 1.25,
  }));
  // Bullet points
  bullets.forEach((b, i) => {
    e.push(el({
      type: 'text', x: x + 14, y: y + 36 + i * 20, width: w - 28, height: 16,
      text: `• ${b}`, originalText: `• ${b}`,
      fontSize: 11, fontFamily: 3, textAlign: 'left', verticalAlign: 'top',
      strokeColor: C.slate, autoResize: true, lineHeight: 1.25,
    }));
  });
}

export function applyBusinessModelCanvasTemplate(api: ExcalidrawImperativeAPI) {
  _id = 0;
  const e: any[] = [];

  const LEFT = 60;
  const TOP = 40;

  // Canvas dimensions
  const TOTAL_W = 1100;
  const TOP_ROW_H = 260;
  const BOT_ROW_H = 140;
  const COL5_W = TOTAL_W / 5; // 5 columns

  // ── Title ──
  e.push(el({
    type: 'text', x: LEFT, y: TOP, width: 600, height: 36,
    text: 'Business Model Canvas', originalText: 'Business Model Canvas',
    fontSize: 30, fontFamily: 3, textAlign: 'left', verticalAlign: 'top',
    strokeColor: C.navy, autoResize: true, lineHeight: 1.25,
  }));
  e.push(el({
    type: 'text', x: LEFT, y: TOP + 38, width: 600, height: 18,
    text: 'Company Name  ·  Date  ·  Version 1.0',
    originalText: 'Company Name  ·  Date  ·  Version 1.0',
    fontSize: 12, fontFamily: 3, textAlign: 'left', verticalAlign: 'top',
    strokeColor: C.gray, autoResize: true, lineHeight: 1.25,
  }));

  const gridY = TOP + 75;

  // ── Outer border ──
  e.push(el({
    type: 'rectangle', x: LEFT, y: gridY, width: TOTAL_W, height: TOP_ROW_H + BOT_ROW_H,
    strokeColor: C.navy, backgroundColor: 'transparent',
    roundness: { type: 3 }, strokeWidth: 2,
  }));

  /* ─────────── TOP ROW (5 columns, middle splits vertically) ─────────── */

  // Col 1: Key Partners
  blockSection(
    LEFT, gridY, COL5_W, TOP_ROW_H,
    'Key Partners', '🤝',
    ['Strategic alliances', 'Key suppliers', 'Joint ventures', 'Buyer-supplier'],
    C.purple, BG.purple, e,
  );

  // Col 2: Key Activities (top half) + Key Resources (bottom half)
  const halfH = TOP_ROW_H / 2;
  blockSection(
    LEFT + COL5_W, gridY, COL5_W, halfH,
    'Key Activities', '⚙️',
    ['Production', 'Problem solving', 'Platform mgmt'],
    C.blue, BG.blue, e,
  );
  blockSection(
    LEFT + COL5_W, gridY + halfH, COL5_W, halfH,
    'Key Resources', '🏗️',
    ['Physical assets', 'Intellectual property', 'Human capital'],
    C.sky, BG.sky, e,
  );

  // Col 3: Value Propositions (center — wider emphasis)
  blockSection(
    LEFT + 2 * COL5_W, gridY, COL5_W, TOP_ROW_H,
    'Value Propositions', '💎',
    ['What value do we deliver?', 'Which problems do we solve?', 'What bundles of products?', 'Which needs do we satisfy?'],
    C.red, BG.red, e,
  );

  // Col 4: Customer Relationships (top) + Channels (bottom)
  blockSection(
    LEFT + 3 * COL5_W, gridY, COL5_W, halfH,
    'Customer Relations', '❤️',
    ['Personal assistance', 'Self-service', 'Communities'],
    C.pink, BG.pink, e,
  );
  blockSection(
    LEFT + 3 * COL5_W, gridY + halfH, COL5_W, halfH,
    'Channels', '📦',
    ['Direct / Indirect', 'Online / Physical', 'Partner channels'],
    C.orange, BG.orange, e,
  );

  // Col 5: Customer Segments
  blockSection(
    LEFT + 4 * COL5_W, gridY, COL5_W, TOP_ROW_H,
    'Customer Segments', '👥',
    ['Mass market', 'Niche market', 'Segmented', 'Diversified', 'Multi-sided platform'],
    C.green, BG.green, e,
  );

  /* ─────────── BOTTOM ROW (2 halves) ─────────── */

  const botY = gridY + TOP_ROW_H;
  const halfW = TOTAL_W / 2;

  // Cost Structure (left)
  blockSection(
    LEFT, botY, halfW, BOT_ROW_H,
    'Cost Structure', '💰',
    ['Fixed costs: salaries, rent, utilities', 'Variable costs: materials, commissions', 'Economies of scale / scope'],
    C.amber, BG.amber, e,
  );

  // Revenue Streams (right)
  blockSection(
    LEFT + halfW, botY, halfW, BOT_ROW_H,
    'Revenue Streams', '📈',
    ['Asset sales / Usage fees', 'Subscription / Licensing', 'Advertising / Brokerage fees'],
    C.emerald, BG.green, e,
  );

  // ── Instruction ──
  e.push(el({
    type: 'text', x: LEFT, y: botY + BOT_ROW_H + 20, width: 900, height: 16,
    text: 'Double-click to edit bullet points  ·  Add sticky notes for brainstorming  ·  Color-code for priority  ·  Based on Strategyzer\'s Business Model Canvas',
    originalText: 'Double-click to edit bullet points  ·  Add sticky notes for brainstorming  ·  Color-code for priority  ·  Based on Strategyzer\'s Business Model Canvas',
    fontSize: 11, fontFamily: 3, textAlign: 'left', verticalAlign: 'top',
    strokeColor: C.gray, autoResize: true, lineHeight: 1.25,
  }));

  api.updateScene({ elements: e });
  api.scrollToContent(undefined, { fitToViewport: true, animate: true });
}
