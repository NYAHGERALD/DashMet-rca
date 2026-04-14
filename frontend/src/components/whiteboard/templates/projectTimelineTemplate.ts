import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/types';

/* ────────────────────────────────────────────────────────────────────────────
 * Project Timeline Template — Horizontal milestone timeline with phases,
 * deliverables, and status indicators. Professional Gantt-style layout.
 * ──────────────────────────────────────────────────────────────────────────── */

let _id = 0;
const uid = () => `pt_${Date.now()}_${++_id}`;
const seed = () => Math.floor(Math.random() * 1e6);

const C = {
  navy: '#1e3a5f', blue: '#1971c2', sky: '#0ea5e9',
  green: '#2f9e44', emerald: '#059669', teal: '#0d9488',
  amber: '#d97706', orange: '#ea580c', red: '#dc2626',
  purple: '#7c3aed', gray: '#6b7280', slate: '#475569',
  black: '#1e1e1e', lightGray: '#94a3b8',
};
const BG = {
  navy: '#1e3a5f', blue: '#dbeafe', sky: '#e0f2fe',
  green: '#d1fae5', emerald: '#d1fae5', teal: '#ccfbf1',
  amber: '#fef3c7', orange: '#ffedd5', red: '#fee2e2',
  purple: '#ede9fe', slate: '#f1f5f9', white: '#ffffff',
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

export function applyProjectTimelineTemplate(api: ExcalidrawImperativeAPI) {
  _id = 0;
  const e: any[] = [];

  const LEFT = 60;
  const TOP = 40;
  const PHASE_W = 220;
  const PHASE_H = 280;
  const PHASE_GAP = 15;
  const HEADER_H = 40;
  const TASK_H = 32;
  const TASK_GAP = 10;
  const TASK_PAD = 15;

  const phases = [
    { name: 'Phase 1: Discovery', color: C.blue, bg: BG.blue, tasks: ['Stakeholder interviews', 'Requirements gathering', 'Market research', 'Define success metrics'] },
    { name: 'Phase 2: Design', color: C.purple, bg: BG.purple, tasks: ['Wireframing', 'UI/UX mockups', 'Architecture design', 'Design review'] },
    { name: 'Phase 3: Build', color: C.emerald, bg: BG.emerald, tasks: ['Sprint 1 — Core', 'Sprint 2 — Features', 'Sprint 3 — Integration', 'QA & Testing'] },
    { name: 'Phase 4: Launch', color: C.amber, bg: BG.amber, tasks: ['UAT sign-off', 'Deployment prep', 'Go-live', 'Post-launch review'] },
  ];

  // ── Title ──
  e.push(el({
    type: 'text', x: LEFT, y: TOP, width: 600, height: 36,
    text: 'Project Timeline', originalText: 'Project Timeline',
    fontSize: 30, fontFamily: 3, textAlign: 'left', verticalAlign: 'top',
    strokeColor: C.navy, autoResize: true, lineHeight: 1.25,
  }));

  // ── Subtitle ──
  e.push(el({
    type: 'text', x: LEFT, y: TOP + 38, width: 600, height: 20,
    text: 'Q1 2026  ·  Project Name  ·  Status: On Track', originalText: 'Q1 2026  ·  Project Name  ·  Status: On Track',
    fontSize: 14, fontFamily: 3, textAlign: 'left', verticalAlign: 'top',
    strokeColor: C.lightGray, autoResize: true, lineHeight: 1.25,
  }));

  const phaseY = TOP + 80;

  // ── Horizontal timeline arrow ──
  const arrowStartX = LEFT - 10;
  const arrowEndX = LEFT + phases.length * (PHASE_W + PHASE_GAP) + 10;
  e.push(el({
    type: 'arrow', x: arrowStartX, y: phaseY + HEADER_H / 2,
    width: arrowEndX - arrowStartX, height: 0,
    strokeColor: C.slate, strokeWidth: 2.5,
    points: [[0, 0], [arrowEndX - arrowStartX, 0]],
    startArrowhead: null, endArrowhead: 'triangle',
  }));

  phases.forEach((phase, pi) => {
    const px = LEFT + pi * (PHASE_W + PHASE_GAP);

    // Phase header (rounded rect)
    e.push(el({
      type: 'rectangle', x: px, y: phaseY, width: PHASE_W, height: HEADER_H,
      strokeColor: phase.color, backgroundColor: phase.bg,
      roundness: { type: 3 },
    }));
    e.push(el({
      type: 'text', x: px + 12, y: phaseY + 10, width: PHASE_W - 24, height: 20,
      text: phase.name, originalText: phase.name,
      fontSize: 14, fontFamily: 3, textAlign: 'center', verticalAlign: 'middle',
      strokeColor: phase.color, autoResize: true, lineHeight: 1.25,
    }));

    // Milestone diamond on the timeline
    const diamondSize = 14;
    e.push(el({
      type: 'diamond', x: px + PHASE_W / 2 - diamondSize / 2, y: phaseY + HEADER_H / 2 - diamondSize / 2,
      width: diamondSize, height: diamondSize,
      strokeColor: phase.color, backgroundColor: phase.color,
      strokeWidth: 1,
    }));

    // Phase body container
    const bodyY = phaseY + HEADER_H + 8;
    const bodyH = PHASE_H - HEADER_H - 8;
    e.push(el({
      type: 'rectangle', x: px, y: bodyY, width: PHASE_W, height: bodyH,
      strokeColor: phase.color, backgroundColor: 'transparent',
      strokeWidth: 1, strokeStyle: 'dashed', roundness: { type: 3 },
      opacity: 40,
    }));

    // Tasks inside phase
    phase.tasks.forEach((task, ti) => {
      const ty = bodyY + TASK_PAD + ti * (TASK_H + TASK_GAP);
      // Task bar
      e.push(el({
        type: 'rectangle', x: px + 12, y: ty, width: PHASE_W - 24, height: TASK_H,
        strokeColor: phase.color, backgroundColor: BG.white,
        roundness: { type: 3 }, strokeWidth: 1,
      }));
      // Status indicator circle
      e.push(el({
        type: 'ellipse', x: px + 20, y: ty + TASK_H / 2 - 5, width: 10, height: 10,
        strokeColor: pi === 0 ? C.green : C.lightGray,
        backgroundColor: pi === 0 ? BG.green : BG.slate,
        strokeWidth: 1,
      }));
      // Task text
      e.push(el({
        type: 'text', x: px + 36, y: ty + 8, width: PHASE_W - 60, height: 16,
        text: task, originalText: task,
        fontSize: 12, fontFamily: 3, textAlign: 'left', verticalAlign: 'middle',
        strokeColor: C.slate, autoResize: true, lineHeight: 1.25,
      }));
    });

    // Connecting arrow between phases
    if (pi < phases.length - 1) {
      const nextX = LEFT + (pi + 1) * (PHASE_W + PHASE_GAP);
      e.push(el({
        type: 'arrow', x: px + PHASE_W, y: phaseY + HEADER_H + bodyH / 2,
        width: PHASE_GAP, height: 0,
        strokeColor: C.lightGray, strokeWidth: 1.5, strokeStyle: 'dashed',
        points: [[0, 0], [PHASE_GAP, 0]],
        startArrowhead: null, endArrowhead: 'triangle',
      }));
    }
  });

  // ── Legend ──
  const legendY = phaseY + PHASE_H + 30;
  e.push(el({
    type: 'text', x: LEFT, y: legendY, width: 400, height: 16,
    text: '● Completed    ○ Pending    ◇ Milestone    - - → Dependency',
    originalText: '● Completed    ○ Pending    ◇ Milestone    - - → Dependency',
    fontSize: 11, fontFamily: 3, textAlign: 'left', verticalAlign: 'top',
    strokeColor: C.lightGray, autoResize: true, lineHeight: 1.25,
  }));

  // ── Instruction ──
  e.push(el({
    type: 'text', x: LEFT, y: legendY + 25, width: 700, height: 16,
    text: 'Double-click to edit text  ·  Drag to rearrange  ·  Add tasks by duplicating boxes  ·  Change colors in the toolbar',
    originalText: 'Double-click to edit text  ·  Drag to rearrange  ·  Add tasks by duplicating boxes  ·  Change colors in the toolbar',
    fontSize: 11, fontFamily: 3, textAlign: 'left', verticalAlign: 'top',
    strokeColor: C.lightGray, autoResize: true, lineHeight: 1.25,
  }));

  api.updateScene({ elements: e });
  api.scrollToContent(undefined, { fitToViewport: true, animate: true });
}
