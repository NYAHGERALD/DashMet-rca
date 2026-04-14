import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/types';

/* ────────────────────────────────────────────────────────────────────────────
 * Affinity Diagram Template — Excalidraw 0.18+
 *
 * Also known as KJ Method. Used in RCA to organize brainstormed causes into
 * themed clusters. Color-coded groups with header cards, idea sticky notes,
 * and a central problem statement.
 * ──────────────────────────────────────────────────────────────────────────── */

let _id = 0;
const uid = () => `aff_${Date.now()}_${++_id}`;
const seed = () => Math.floor(Math.random() * 1e6);

const COL = {
  navy: '#1e3a5f', red: '#e03131', orange: '#e8590c',
  amber: '#d97706', green: '#2f9e44', blue: '#1971c2',
  violet: '#7048e8', gray: '#868e96', slate: '#475569',
  teal: '#0c8599', pink: '#c2255c',
};
const BG = {
  red: '#fee2e2', orange: '#ffedd5', amber: '#fef3c7',
  green: '#d1fae5', blue: '#dbeafe', violet: '#ede9fe',
  slate: '#f1f5f9', navy: '#e0e7ff', teal: '#ccfbf1',
  pink: '#fce7f3',
};

function el(overrides: Partial<ExcalidrawElement> & { type: string }): any {
  return {
    id: uid(), fillStyle: 'solid', strokeWidth: 2, roughness: 0,
    opacity: 100, angle: 0, groupIds: [], boundElements: null,
    updated: Date.now(), link: null, locked: false, seed: seed(),
    version: 1, versionNonce: seed(), isDeleted: false,
    x: 0, y: 0, width: 100, height: 40,
    strokeColor: '#1e1e1e', backgroundColor: 'transparent',
    fontSize: 20, fontFamily: 1, textAlign: 'center',
    verticalAlign: 'middle', baseline: 0,
    containerId: null, originalText: '', lineHeight: 1.25,
    ...overrides,
  };
}

/* ── Group definitions ────────────────────────────────────────────────────── */
interface AffinityGroup {
  title: string;
  color: string;
  bg: string;
  notes: string[];
}

const GROUPS: AffinityGroup[] = [
  {
    title: '🔧 Process Issues',
    color: COL.blue, bg: BG.blue,
    notes: ['No standardized workflow', 'Missing checkpoints', 'Handoff gaps between teams', 'Outdated procedures'],
  },
  {
    title: '👥 People & Training',
    color: COL.violet, bg: BG.violet,
    notes: ['Insufficient onboarding', 'Skill gaps in new tools', 'High turnover rate', 'No mentorship program'],
  },
  {
    title: '🖥️ Technology & Tools',
    color: COL.teal, bg: BG.teal,
    notes: ['Legacy system limitations', 'Poor tool integration', 'Lack of automation', 'Data silos'],
  },
  {
    title: '📊 Measurement & Data',
    color: COL.orange, bg: BG.orange,
    notes: ['No leading indicators', 'Delayed reporting', 'Inconsistent metrics', 'Missing baselines'],
  },
  {
    title: '🏢 Organization & Culture',
    color: COL.pink, bg: BG.pink,
    notes: ['Blame culture', 'Siloed departments', 'Unclear ownership', 'Resistance to change'],
  },
  {
    title: '📋 Materials & Resources',
    color: COL.green, bg: BG.green,
    notes: ['Budget constraints', 'Supplier quality issues', 'Insufficient staffing', 'Resource contention'],
  },
];

/* ── Layout constants ─────────────────────────────────────────────────────── */
const COL_COUNT = 3;
const GROUP_W = 310, GROUP_HEADER_H = 42;
const NOTE_W = 270, NOTE_H = 38;
const NOTE_GAP = 10;
const COL_GAP = 40, ROW_GAP = 50;

export function applyAffinityDiagramTemplate(api: ExcalidrawImperativeAPI) {
  _id = 0;
  const els: any[] = [];

  /* ── Title ────────────────────────────────────────────────────────────── */
  const totalW = COL_COUNT * GROUP_W + (COL_COUNT - 1) * COL_GAP;
  const startX = 100;
  els.push(el({
    type: 'text', x: startX + totalW / 2 - 250, y: 20, width: 500, height: 40,
    text: 'Affinity Diagram — Cause Clustering', fontSize: 28, fontFamily: 1,
    textAlign: 'center', strokeColor: COL.navy,
  }));

  /* ── Problem Statement ────────────────────────────────────────────────── */
  const psW = 500, psH = 60;
  els.push(el({
    type: 'rectangle', x: startX + totalW / 2 - psW / 2, y: 70,
    width: psW, height: psH,
    strokeColor: COL.navy, backgroundColor: BG.navy,
    roundness: { type: 3, value: 12 }, strokeWidth: 2,
  }));
  els.push(el({
    type: 'text', x: startX + totalW / 2 - psW / 2 + 10, y: 76,
    width: psW - 20, height: 18,
    text: 'PROBLEM', fontSize: 12, fontFamily: 1,
    textAlign: 'center', strokeColor: COL.navy,
  }));
  els.push(el({
    type: 'text', x: startX + totalW / 2 - psW / 2 + 10, y: 96,
    width: psW - 20, height: 28,
    text: 'Why are we experiencing [undesired outcome]?',
    fontSize: 15, fontFamily: 1, textAlign: 'center', strokeColor: COL.slate,
  }));

  /* ── Groups ───────────────────────────────────────────────────────────── */
  const gridStartY = 160;
  GROUPS.forEach((grp, gi) => {
    const col = gi % COL_COUNT;
    const row = Math.floor(gi / COL_COUNT);
    const gx = startX + col * (GROUP_W + COL_GAP);
    const groupH = GROUP_HEADER_H + grp.notes.length * (NOTE_H + NOTE_GAP) + NOTE_GAP;
    const gy = gridStartY + row * (GROUP_HEADER_H + 4 * (NOTE_H + NOTE_GAP) + NOTE_GAP + ROW_GAP);

    // Group container
    els.push(el({
      type: 'rectangle', x: gx, y: gy, width: GROUP_W, height: groupH,
      strokeColor: grp.color, backgroundColor: 'transparent',
      roundness: { type: 3, value: 12 }, strokeWidth: 1.5, strokeStyle: 'dashed',
    }));

    // Group header
    els.push(el({
      type: 'rectangle', x: gx, y: gy, width: GROUP_W, height: GROUP_HEADER_H,
      strokeColor: grp.color, backgroundColor: grp.bg,
      roundness: { type: 3, value: 12 },
    }));
    els.push(el({
      type: 'text', x: gx + 12, y: gy + 10, width: GROUP_W - 24, height: 22,
      text: grp.title, fontSize: 15, fontFamily: 1,
      textAlign: 'center', strokeColor: grp.color,
    }));

    // Sticky notes
    grp.notes.forEach((note, ni) => {
      const ny = gy + GROUP_HEADER_H + NOTE_GAP + ni * (NOTE_H + NOTE_GAP);
      const nx = gx + (GROUP_W - NOTE_W) / 2;
      els.push(el({
        type: 'rectangle', x: nx, y: ny, width: NOTE_W, height: NOTE_H,
        strokeColor: grp.color, backgroundColor: '#ffffff',
        roundness: { type: 3, value: 6 }, strokeWidth: 1,
      }));
      // Color accent bar on left
      els.push(el({
        type: 'rectangle', x: nx, y: ny, width: 5, height: NOTE_H,
        strokeColor: grp.color, backgroundColor: grp.color,
        roundness: { type: 3, value: 3 },
      }));
      els.push(el({
        type: 'text', x: nx + 14, y: ny + 9, width: NOTE_W - 24, height: 20,
        text: note, fontSize: 12, fontFamily: 1,
        textAlign: 'left', strokeColor: COL.slate,
      }));
    });
  });

  /* ── Instructions ─────────────────────────────────────────────────────── */
  const instrY = gridStartY + 2 * (GROUP_HEADER_H + 4 * (NOTE_H + NOTE_GAP) + NOTE_GAP + ROW_GAP) + 10;
  els.push(el({
    type: 'text', x: startX, y: instrY, width: totalW, height: 50,
    text: 'HOW TO USE:  1) Brainstorm all possible causes  →  2) Write each on a sticky note  →  3) Group similar items  →  4) Name each group  →  5) Identify root cause clusters',
    fontSize: 13, fontFamily: 1, textAlign: 'center', strokeColor: COL.gray,
  }));

  api.updateScene({ elements: [...api.getSceneElements(), ...els] });
  api.scrollToContent(els as any, { fitToViewport: true, viewportZoomFactor: 0.9 });
}
