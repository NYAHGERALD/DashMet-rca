import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/types';

/* ────────────────────────────────────────────────────────────────────────────
 * Customer Journey Map Template — End-to-end customer experience mapping
 * with stages, touchpoints, emotions, pain points, and opportunities.
 * ──────────────────────────────────────────────────────────────────────────── */

let _id = 0;
const uid = () => `cj_${Date.now()}_${++_id}`;
const seed = () => Math.floor(Math.random() * 1e6);

const C = {
  navy: '#1e3a5f', blue: '#1971c2', sky: '#0ea5e9',
  green: '#059669', emerald: '#10b981',
  amber: '#d97706', orange: '#ea580c', red: '#dc2626',
  purple: '#7c3aed', pink: '#db2777',
  slate: '#475569', gray: '#94a3b8', black: '#1e1e1e',
};
const BG = {
  blue: '#dbeafe', sky: '#e0f2fe', green: '#d1fae5',
  amber: '#fef3c7', orange: '#ffedd5', red: '#fee2e2',
  purple: '#ede9fe', pink: '#fce7f3', slate: '#f1f5f9', white: '#ffffff',
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

export function applyCustomerJourneyTemplate(api: ExcalidrawImperativeAPI) {
  _id = 0;
  const elems: any[] = [];

  const LEFT = 60;
  const TOP = 40;
  const LABEL_W = 140;
  const STAGE_W = 180;
  const STAGE_GAP = 10;
  const ROW_H = 70;
  const HEADER_H = 50;

  const stages = [
    { name: 'Awareness', icon: '💡', color: C.blue, bg: BG.blue },
    { name: 'Consideration', icon: '🔍', color: C.purple, bg: BG.purple },
    { name: 'Purchase', icon: '🛒', color: C.green, bg: BG.green },
    { name: 'Onboarding', icon: '🚀', color: C.amber, bg: BG.amber },
    { name: 'Retention', icon: '❤️', color: C.pink, bg: BG.pink },
  ];

  const rows = [
    {
      label: 'Touchpoints',
      icon: '📱',
      color: C.sky,
      data: ['Social media ads\nBlog posts', 'Product page\nReviews & demos', 'Checkout flow\nPayment', 'Welcome email\nSetup wizard', 'Support chat\nNewsletter'],
    },
    {
      label: 'Actions',
      icon: '👤',
      color: C.slate,
      data: ['Clicks ad, reads blog', 'Compares features,\nreads reviews', 'Creates account,\nenters payment', 'Configures settings,\ninvites team', 'Uses daily,\ncontacts support'],
    },
    {
      label: 'Emotions',
      icon: '😊',
      color: C.amber,
      data: ['Curious 🤔', 'Hopeful 😊', 'Anxious → Relieved 😅', 'Excited 🎉', 'Satisfied 😌'],
    },
    {
      label: 'Pain Points',
      icon: '⚡',
      color: C.red,
      data: ['Too many options', 'Unclear pricing', 'Complex checkout', 'Steep learning curve', 'Slow response times'],
    },
    {
      label: 'Opportunities',
      icon: '✨',
      color: C.green,
      data: ['Targeted content', 'Comparison tool', 'One-click purchase', 'Interactive tutorial', 'Proactive outreach'],
    },
  ];

  const TOTAL_W = LABEL_W + stages.length * (STAGE_W + STAGE_GAP);

  // ── Title ──
  elems.push(el({
    type: 'text', x: LEFT, y: TOP, width: 600, height: 36,
    text: 'Customer Journey Map', originalText: 'Customer Journey Map',
    fontSize: 30, fontFamily: 3, textAlign: 'left', verticalAlign: 'top',
    strokeColor: C.navy, autoResize: true, lineHeight: 1.25,
  }));
  elems.push(el({
    type: 'text', x: LEFT, y: TOP + 38, width: 600, height: 18,
    text: 'Persona: [Customer Name]  ·  Scenario: [Primary Goal]',
    originalText: 'Persona: [Customer Name]  ·  Scenario: [Primary Goal]',
    fontSize: 12, fontFamily: 3, textAlign: 'left', verticalAlign: 'top',
    strokeColor: C.gray, autoResize: true, lineHeight: 1.25,
  }));

  const gridY = TOP + 80;

  // ── Stage headers ──
  stages.forEach((stage, si) => {
    const sx = LEFT + LABEL_W + si * (STAGE_W + STAGE_GAP);
    // Header card
    elems.push(el({
      type: 'rectangle', x: sx, y: gridY, width: STAGE_W, height: HEADER_H,
      strokeColor: stage.color, backgroundColor: stage.bg,
      roundness: { type: 3 }, strokeWidth: 1.5,
    }));
    elems.push(el({
      type: 'text', x: sx + 10, y: gridY + 8, width: STAGE_W - 20, height: 16,
      text: stage.icon, originalText: stage.icon,
      fontSize: 16, fontFamily: 3, textAlign: 'center', verticalAlign: 'top',
      strokeColor: stage.color, autoResize: true, lineHeight: 1.25,
    }));
    elems.push(el({
      type: 'text', x: sx + 10, y: gridY + 28, width: STAGE_W - 20, height: 16,
      text: stage.name, originalText: stage.name,
      fontSize: 13, fontFamily: 3, textAlign: 'center', verticalAlign: 'middle',
      strokeColor: stage.color, autoResize: true, lineHeight: 1.25,
    }));

    // Arrow connector between stages
    if (si < stages.length - 1) {
      elems.push(el({
        type: 'arrow', x: sx + STAGE_W, y: gridY + HEADER_H / 2,
        width: STAGE_GAP, height: 0,
        strokeColor: C.gray, strokeWidth: 1.5,
        points: [[0, 0], [STAGE_GAP, 0]],
        startArrowhead: null, endArrowhead: 'triangle',
      }));
    }
  });

  // ── Emotion curve line (connecting dots across stages) ──
  const emotionRowIdx = 2; // Emotions row
  const curveY = gridY + HEADER_H + 15 + emotionRowIdx * (ROW_H + 8) + ROW_H / 2;
  const emotionHeights = [-10, 5, -15, 20, 8]; // relative offsets for curve
  const emotionPoints: [number, number][] = stages.map((_, si) => {
    const sx = LEFT + LABEL_W + si * (STAGE_W + STAGE_GAP) + STAGE_W / 2;
    return [sx - (LEFT + LABEL_W + STAGE_W / 2), emotionHeights[si]];
  });
  elems.push(el({
    type: 'line',
    x: LEFT + LABEL_W + STAGE_W / 2,
    y: curveY,
    width: emotionPoints[emotionPoints.length - 1][0],
    height: 40,
    strokeColor: C.amber, strokeWidth: 2.5, strokeStyle: 'dashed',
    points: emotionPoints,
  }));

  // ── Row labels + data cells ──
  rows.forEach((row, ri) => {
    const ry = gridY + HEADER_H + 15 + ri * (ROW_H + 8);

    // Row label
    elems.push(el({
      type: 'rectangle', x: LEFT, y: ry, width: LABEL_W - 10, height: ROW_H,
      strokeColor: row.color, backgroundColor: BG.white,
      roundness: { type: 3 }, strokeWidth: 1,
    }));
    elems.push(el({
      type: 'text', x: LEFT + 8, y: ry + ROW_H / 2 - 10, width: LABEL_W - 26, height: 20,
      text: `${row.icon} ${row.label}`, originalText: `${row.icon} ${row.label}`,
      fontSize: 12, fontFamily: 3, textAlign: 'left', verticalAlign: 'middle',
      strokeColor: row.color, autoResize: true, lineHeight: 1.25,
    }));

    // Data cells per stage
    stages.forEach((stage, si) => {
      const sx = LEFT + LABEL_W + si * (STAGE_W + STAGE_GAP);
      // Cell background
      elems.push(el({
        type: 'rectangle', x: sx, y: ry, width: STAGE_W, height: ROW_H,
        strokeColor: '#e2e8f0', backgroundColor: ri % 2 === 0 ? BG.white : BG.slate,
        roundness: { type: 3 }, strokeWidth: 1, opacity: 60,
      }));
      // Cell text
      elems.push(el({
        type: 'text', x: sx + 10, y: ry + 10, width: STAGE_W - 20, height: ROW_H - 20,
        text: row.data[si], originalText: row.data[si],
        fontSize: 10, fontFamily: 3, textAlign: 'left', verticalAlign: 'top',
        strokeColor: C.slate, autoResize: true, lineHeight: 1.4,
      }));
    });
  });

  // ── Instruction ──
  const bottomY = gridY + HEADER_H + 15 + rows.length * (ROW_H + 8) + 20;
  elems.push(el({
    type: 'text', x: LEFT, y: bottomY, width: 900, height: 16,
    text: 'Double-click to edit  ·  Add sticky notes for detailed observations  ·  Drag emotion curve dots to adjust  ·  Duplicate columns to add stages',
    originalText: 'Double-click to edit  ·  Add sticky notes for detailed observations  ·  Drag emotion curve dots to adjust  ·  Duplicate columns to add stages',
    fontSize: 11, fontFamily: 3, textAlign: 'left', verticalAlign: 'top',
    strokeColor: C.gray, autoResize: true, lineHeight: 1.25,
  }));

  api.updateScene({ elements: elems });
  api.scrollToContent(undefined, { fitToViewport: true, animate: true });
}
