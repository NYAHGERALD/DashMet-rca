import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/types';

/* ────────────────────────────────────────────────────────────────────────────
 * RACI Matrix Template — Responsible, Accountable, Consulted, Informed
 * Professional responsibility assignment matrix with roles & tasks.
 * ──────────────────────────────────────────────────────────────────────────── */

let _id = 0;
const uid = () => `rc_${Date.now()}_${++_id}`;
const seed = () => Math.floor(Math.random() * 1e6);

const C = {
  navy: '#1e3a5f', blue: '#1971c2', green: '#059669',
  amber: '#d97706', purple: '#7c3aed', red: '#dc2626',
  slate: '#475569', gray: '#94a3b8', black: '#1e1e1e',
};
const BG = {
  blue: '#dbeafe', green: '#d1fae5', amber: '#fef3c7',
  purple: '#ede9fe', red: '#fee2e2', slate: '#f1f5f9',
  white: '#ffffff', headerDark: '#1e293b',
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

export function applyRaciTemplate(api: ExcalidrawImperativeAPI) {
  _id = 0;
  const e: any[] = [];

  const LEFT = 60;
  const TOP = 40;
  const TASK_COL_W = 220;
  const ROLE_COL_W = 120;
  const ROW_H = 50;
  const HEADER_H = 60;

  const roles = ['Project Mgr', 'Tech Lead', 'Designer', 'Developer', 'QA Lead'];
  const tasks = [
    { name: 'Define requirements', values: ['A', 'C', 'C', 'I', 'I'] },
    { name: 'Create design specs', values: ['C', 'C', 'R', 'I', 'I'] },
    { name: 'Develop solution', values: ['I', 'A', 'C', 'R', 'C'] },
    { name: 'Code review', values: ['I', 'R', 'I', 'A', 'C'] },
    { name: 'Testing & QA', values: ['I', 'C', 'I', 'C', 'R'] },
    { name: 'Deployment', values: ['A', 'R', 'I', 'C', 'C'] },
    { name: 'Stakeholder sign-off', values: ['R', 'C', 'I', 'I', 'I'] },
  ];

  const totalW = TASK_COL_W + roles.length * ROLE_COL_W;
  const totalH = HEADER_H + tasks.length * ROW_H;

  const raciColors: Record<string, { color: string; bg: string; label: string }> = {
    'R': { color: C.blue, bg: BG.blue, label: 'R' },
    'A': { color: C.red, bg: BG.red, label: 'A' },
    'C': { color: C.amber, bg: BG.amber, label: 'C' },
    'I': { color: C.gray, bg: BG.slate, label: 'I' },
  };

  // ── Title ──
  e.push(el({
    type: 'text', x: LEFT, y: TOP, width: 500, height: 32,
    text: 'RACI Responsibility Matrix', originalText: 'RACI Responsibility Matrix',
    fontSize: 28, fontFamily: 3, textAlign: 'left', verticalAlign: 'top',
    strokeColor: C.navy, autoResize: true, lineHeight: 1.25,
  }));
  e.push(el({
    type: 'text', x: LEFT, y: TOP + 36, width: 500, height: 18,
    text: 'R = Responsible   A = Accountable   C = Consulted   I = Informed',
    originalText: 'R = Responsible   A = Accountable   C = Consulted   I = Informed',
    fontSize: 12, fontFamily: 3, textAlign: 'left', verticalAlign: 'top',
    strokeColor: C.gray, autoResize: true, lineHeight: 1.25,
  }));

  const gridY = TOP + 70;

  // ── Header row background ──
  e.push(el({
    type: 'rectangle', x: LEFT, y: gridY, width: totalW, height: HEADER_H,
    strokeColor: C.navy, backgroundColor: BG.headerDark,
    roundness: { type: 3 }, strokeWidth: 1,
  }));

  // ── Header: "Task / Deliverable" ──
  e.push(el({
    type: 'text', x: LEFT + 15, y: gridY + 20, width: TASK_COL_W - 30, height: 20,
    text: 'Task / Deliverable', originalText: 'Task / Deliverable',
    fontSize: 13, fontFamily: 3, textAlign: 'left', verticalAlign: 'middle',
    strokeColor: '#e2e8f0', autoResize: true, lineHeight: 1.25,
  }));

  // ── Header: Role names ──
  roles.forEach((role, ri) => {
    const rx = LEFT + TASK_COL_W + ri * ROLE_COL_W;
    e.push(el({
      type: 'text', x: rx + 5, y: gridY + 20, width: ROLE_COL_W - 10, height: 20,
      text: role, originalText: role,
      fontSize: 11, fontFamily: 3, textAlign: 'center', verticalAlign: 'middle',
      strokeColor: '#e2e8f0', autoResize: true, lineHeight: 1.25,
    }));
    // Vertical separator
    if (ri > 0) {
      e.push(el({
        type: 'line', x: rx, y: gridY + 8, width: 0, height: HEADER_H - 16,
        strokeColor: '#475569', strokeWidth: 1, opacity: 40,
        points: [[0, 0], [0, HEADER_H - 16]],
      }));
    }
  });

  // ── Task column / role column separator ──
  e.push(el({
    type: 'line', x: LEFT + TASK_COL_W, y: gridY + 8, width: 0, height: HEADER_H - 16,
    strokeColor: '#e2e8f0', strokeWidth: 1,
    points: [[0, 0], [0, HEADER_H - 16]],
  }));

  // ── Data rows ──
  tasks.forEach((task, ti) => {
    const ry = gridY + HEADER_H + ti * ROW_H;
    const isEven = ti % 2 === 0;

    // Row background
    e.push(el({
      type: 'rectangle', x: LEFT, y: ry, width: totalW, height: ROW_H,
      strokeColor: '#e2e8f0', backgroundColor: isEven ? BG.white : BG.slate,
      strokeWidth: 1,
    }));

    // Task name
    e.push(el({
      type: 'text', x: LEFT + 15, y: ry + 16, width: TASK_COL_W - 30, height: 18,
      text: task.name, originalText: task.name,
      fontSize: 12, fontFamily: 3, textAlign: 'left', verticalAlign: 'middle',
      strokeColor: C.slate, autoResize: true, lineHeight: 1.25,
    }));

    // RACI values
    task.values.forEach((val, vi) => {
      const cx = LEFT + TASK_COL_W + vi * ROLE_COL_W + ROLE_COL_W / 2;
      const cy = ry + ROW_H / 2;
      const raci = raciColors[val];
      if (raci) {
        // Badge circle  
        e.push(el({
          type: 'ellipse', x: cx - 14, y: cy - 14, width: 28, height: 28,
          strokeColor: raci.color, backgroundColor: raci.bg, strokeWidth: 1.5,
        }));
        e.push(el({
          type: 'text', x: cx - 10, y: cy - 8, width: 20, height: 16,
          text: raci.label, originalText: raci.label,
          fontSize: 13, fontFamily: 3, textAlign: 'center', verticalAlign: 'middle',
          strokeColor: raci.color, autoResize: true, lineHeight: 1.25,
        }));
      }
    });
  });

  // ── Outer border ──
  e.push(el({
    type: 'rectangle', x: LEFT, y: gridY, width: totalW, height: totalH,
    strokeColor: C.navy, backgroundColor: 'transparent',
    roundness: { type: 3 }, strokeWidth: 2,
  }));

  // ── Legend ──
  const legendY = gridY + totalH + 25;
  const legendItems = [
    { label: 'R — Responsible (does the work)', color: C.blue, bg: BG.blue },
    { label: 'A — Accountable (owns decision)', color: C.red, bg: BG.red },
    { label: 'C — Consulted (provides input)', color: C.amber, bg: BG.amber },
    { label: 'I — Informed (kept in the loop)', color: C.gray, bg: BG.slate },
  ];
  legendItems.forEach((li, i) => {
    const lx = LEFT + i * 220;
    e.push(el({
      type: 'ellipse', x: lx, y: legendY, width: 14, height: 14,
      strokeColor: li.color, backgroundColor: li.bg, strokeWidth: 1,
    }));
    e.push(el({
      type: 'text', x: lx + 20, y: legendY, width: 190, height: 14,
      text: li.label, originalText: li.label,
      fontSize: 10, fontFamily: 3, textAlign: 'left', verticalAlign: 'middle',
      strokeColor: C.slate, autoResize: true, lineHeight: 1.25,
    }));
  });

  // ── Instruction ──
  e.push(el({
    type: 'text', x: LEFT, y: legendY + 30, width: 700, height: 16,
    text: 'Double-click to edit  ·  Change badge letters (R/A/C/I) to reassign  ·  Add rows by duplicating',
    originalText: 'Double-click to edit  ·  Change badge letters (R/A/C/I) to reassign  ·  Add rows by duplicating',
    fontSize: 11, fontFamily: 3, textAlign: 'left', verticalAlign: 'top',
    strokeColor: C.gray, autoResize: true, lineHeight: 1.25,
  }));

  api.updateScene({ elements: e });
  api.scrollToContent(undefined, { fitToViewport: true, animate: true });
}
