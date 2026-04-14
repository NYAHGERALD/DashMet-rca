import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/types';

/* ────────────────────────────────────────────────────────────────────────────
 * Kanban Board Template — Professional 4-column kanban with WIP limits,
 * priority-coded task cards, and assignee initials.
 * ──────────────────────────────────────────────────────────────────────────── */

let _id = 0;
const uid = () => `kb_${Date.now()}_${++_id}`;
const seed = () => Math.floor(Math.random() * 1e6);

const C = {
  navy: '#1e3a5f', blue: '#1971c2', sky: '#0ea5e9',
  green: '#059669', emerald: '#10b981',
  amber: '#d97706', orange: '#ea580c', red: '#dc2626',
  purple: '#7c3aed', slate: '#475569', gray: '#94a3b8', black: '#1e1e1e',
};
const BG = {
  blue: '#dbeafe', sky: '#e0f2fe', green: '#d1fae5',
  amber: '#fef3c7', red: '#fee2e2', purple: '#ede9fe',
  slate: '#f8fafc', white: '#ffffff', cardGray: '#f9fafb',
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

interface TaskCard {
  title: string;
  tag: string;
  tagColor: string;
  tagBg: string;
  assignee: string;
}

function taskCard(x: number, y: number, task: TaskCard, e: any[], w = 210) {
  const h = 70;
  // Card
  e.push(el({
    type: 'rectangle', x, y, width: w, height: h,
    strokeColor: '#e2e8f0', backgroundColor: BG.white,
    roundness: { type: 3 }, strokeWidth: 1,
  }));
  // Priority tag
  e.push(el({
    type: 'rectangle', x: x + 10, y: y + 10, width: 50, height: 16,
    strokeColor: 'transparent', backgroundColor: task.tagBg,
    roundness: { type: 3 }, strokeWidth: 0,
  }));
  e.push(el({
    type: 'text', x: x + 12, y: y + 11, width: 46, height: 14,
    text: task.tag, originalText: task.tag,
    fontSize: 9, fontFamily: 3, textAlign: 'center', verticalAlign: 'middle',
    strokeColor: task.tagColor, autoResize: true, lineHeight: 1.25,
  }));
  // Task title
  e.push(el({
    type: 'text', x: x + 10, y: y + 32, width: w - 20, height: 16,
    text: task.title, originalText: task.title,
    fontSize: 12, fontFamily: 3, textAlign: 'left', verticalAlign: 'middle',
    strokeColor: C.slate, autoResize: true, lineHeight: 1.25,
  }));
  // Assignee avatar
  e.push(el({
    type: 'ellipse', x: x + w - 34, y: y + 10, width: 22, height: 22,
    strokeColor: C.blue, backgroundColor: BG.blue, strokeWidth: 1,
  }));
  e.push(el({
    type: 'text', x: x + w - 32, y: y + 14, width: 18, height: 14,
    text: task.assignee, originalText: task.assignee,
    fontSize: 9, fontFamily: 3, textAlign: 'center', verticalAlign: 'middle',
    strokeColor: C.blue, autoResize: true, lineHeight: 1.25,
  }));
  // Subtask indicator
  e.push(el({
    type: 'text', x: x + 10, y: y + 50, width: 60, height: 12,
    text: '☐ 0/3 subtasks', originalText: '☐ 0/3 subtasks',
    fontSize: 9, fontFamily: 3, textAlign: 'left', verticalAlign: 'middle',
    strokeColor: C.gray, autoResize: true, lineHeight: 1.25,
  }));

  return h;
}

export function applyKanbanTemplate(api: ExcalidrawImperativeAPI) {
  _id = 0;
  const e: any[] = [];

  const LEFT = 60;
  const TOP = 40;
  const COL_W = 240;
  const COL_GAP = 20;
  const CARD_W = 210;
  const CARD_GAP = 12;
  const HEADER_H = 50;

  const columns = [
    {
      name: 'Backlog', count: '4', color: C.slate, bg: BG.slate,
      tasks: [
        { title: 'Research competitors', tag: 'Low', tagColor: C.blue, tagBg: BG.blue, assignee: 'JD' },
        { title: 'Write documentation', tag: 'Medium', tagColor: C.amber, tagBg: BG.amber, assignee: 'AK' },
        { title: 'API rate limiting', tag: 'High', tagColor: C.red, tagBg: BG.red, assignee: 'SM' },
      ],
    },
    {
      name: 'To Do', count: '3', color: C.blue, bg: BG.blue,
      tasks: [
        { title: 'Design login flow', tag: 'High', tagColor: C.red, tagBg: BG.red, assignee: 'MG' },
        { title: 'Set up CI/CD pipeline', tag: 'Medium', tagColor: C.amber, tagBg: BG.amber, assignee: 'JD' },
      ],
    },
    {
      name: 'In Progress', count: '2', color: C.amber, bg: BG.amber,
      tasks: [
        { title: 'Build dashboard UI', tag: 'High', tagColor: C.red, tagBg: BG.red, assignee: 'SM' },
        { title: 'Implement auth service', tag: 'Critical', tagColor: '#991b1b', tagBg: '#fecaca', assignee: 'AK' },
      ],
    },
    {
      name: 'Done', count: '3', color: C.green, bg: BG.green,
      tasks: [
        { title: 'Project kickoff meeting', tag: 'Done', tagColor: C.green, tagBg: BG.green, assignee: 'MG' },
        { title: 'Database schema design', tag: 'Done', tagColor: C.green, tagBg: BG.green, assignee: 'JD' },
      ],
    },
  ];

  // ── Title ──
  e.push(el({
    type: 'text', x: LEFT, y: TOP, width: 400, height: 32,
    text: 'Sprint Board', originalText: 'Sprint Board',
    fontSize: 28, fontFamily: 3, textAlign: 'left', verticalAlign: 'top',
    strokeColor: C.navy, autoResize: true, lineHeight: 1.25,
  }));
  e.push(el({
    type: 'text', x: LEFT, y: TOP + 35, width: 400, height: 18,
    text: 'Sprint 4  ·  Apr 7 – Apr 21, 2026  ·  Team Alpha',
    originalText: 'Sprint 4  ·  Apr 7 – Apr 21, 2026  ·  Team Alpha',
    fontSize: 12, fontFamily: 3, textAlign: 'left', verticalAlign: 'top',
    strokeColor: C.gray, autoResize: true, lineHeight: 1.25,
  }));

  const colY = TOP + 70;

  columns.forEach((col, ci) => {
    const cx = LEFT + ci * (COL_W + COL_GAP);

    // Column background
    const colHeight = HEADER_H + col.tasks.length * (70 + CARD_GAP) + 40;
    e.push(el({
      type: 'rectangle', x: cx, y: colY, width: COL_W, height: colHeight,
      strokeColor: '#e2e8f0', backgroundColor: BG.slate,
      roundness: { type: 3 }, strokeWidth: 1,
    }));

    // Column header
    e.push(el({
      type: 'text', x: cx + 15, y: colY + 14, width: COL_W - 60, height: 20,
      text: col.name, originalText: col.name,
      fontSize: 15, fontFamily: 3, textAlign: 'left', verticalAlign: 'middle',
      strokeColor: C.slate, autoResize: true, lineHeight: 1.25,
    }));

    // Count badge
    e.push(el({
      type: 'ellipse', x: cx + COL_W - 40, y: colY + 12, width: 24, height: 24,
      strokeColor: col.color, backgroundColor: col.bg, strokeWidth: 1,
    }));
    e.push(el({
      type: 'text', x: cx + COL_W - 38, y: colY + 17, width: 20, height: 14,
      text: String(col.tasks.length), originalText: String(col.tasks.length),
      fontSize: 11, fontFamily: 3, textAlign: 'center', verticalAlign: 'middle',
      strokeColor: col.color, autoResize: true, lineHeight: 1.25,
    }));

    // Divider line
    e.push(el({
      type: 'line', x: cx + 10, y: colY + HEADER_H - 4,
      width: COL_W - 20, height: 0,
      strokeColor: '#e2e8f0', strokeWidth: 1,
      points: [[0, 0], [COL_W - 20, 0]],
    }));

    // Task cards
    col.tasks.forEach((task, ti) => {
      const ty = colY + HEADER_H + 8 + ti * (70 + CARD_GAP);
      taskCard(cx + 15, ty, task, e, CARD_W);
    });
  });

  // ── Instruction ──
  const bottomY = colY + HEADER_H + 3 * (70 + CARD_GAP) + 80;
  e.push(el({
    type: 'text', x: LEFT, y: bottomY, width: 800, height: 16,
    text: 'Double-click to edit  ·  Drag cards between columns  ·  Duplicate cards to add tasks  ·  Color-code priorities',
    originalText: 'Double-click to edit  ·  Drag cards between columns  ·  Duplicate cards to add tasks  ·  Color-code priorities',
    fontSize: 11, fontFamily: 3, textAlign: 'left', verticalAlign: 'top',
    strokeColor: C.gray, autoResize: true, lineHeight: 1.25,
  }));

  api.updateScene({ elements: e });
  api.scrollToContent(undefined, { fitToViewport: true, animate: true });
}
