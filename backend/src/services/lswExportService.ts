import ExcelJS from 'exceljs';
import path from 'path';
import lswService from './lswService';

const TEMPLATE_PATH = path.join(__dirname, '../../assets/templates/LSW_TEMPLATE.xlsx');

// ─── TEMPLATE ROW CAPACITIES (fixed — do NOT insert rows, ExcelJS corrupts merged cells) ───
const MAX = {
  DAILY_TASKS: 15,        // Rows 2-16
  TODO_ITEMS: 11,         // Rows 2-12
  PROJECTS: 3,            // Rows 21-23
  MEETING_RAILS: 3,       // Rows 21-23
  FOLLOW_UPS: 5,          // Rows 26-30
  KEY_RESULTS_PER_SET: 5, // Rows 27-31
  RCA_TRIGGERS: 5,        // Rows 33-37 (fixed labels)
  PERSONAL_GOALS: 5,      // Rows 33-37
};

/**
 * Generate an Excel report from the LSW template, filled with the user's data.
 * Data is capped to the template's fixed row counts. If a section has more data
 * than rows available, the last row shows an overflow note.
 */
export async function generateLswExcelReport(
  userId: string,
  organizationId: string,
  weekNumber: number,
  year: number,
  userName: string,
  weekStartDate: string
): Promise<ExcelJS.Buffer> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(TEMPLATE_PATH);

  const ws = workbook.getWorksheet('Weekly');
  if (!ws) throw new Error('Weekly sheet not found in template');

  const data = await lswService.getFullLswData(userId, organizationId, weekNumber, year);

  // Prepare data arrays
  const dailyTasks = data.dailyTasks || [];
  const todoItems = (data.todoItems || []).filter((t: any) => t.isActive !== false);
  const freqTasks = data.frequencyTasks || [];
  const projects = data.projects || [];
  const meetingRails = data.meetingRails || [];
  const followUps = (data.followUps || []).filter((f: any) => f.isActive !== false);
  const keyResultSets = data.keyResultSets || [];
  const rcaTriggers = data.rcaTriggers || [];
  const personalGoals = data.personalGoals || [];

  // ═══════════════════════════════════════════════════════════════════════════
  // FILL DATA — all sections use fixed template rows, no row insertion
  // ═══════════════════════════════════════════════════════════════════════════

  // ─── DAILY TASKS (Rows 2-16, Cols A-J) ───
  fillCapped(dailyTasks, MAX.DAILY_TASKS, (task, row) => {
    setCellValue(ws, `A${row}`, task.minutes || '');
    setCellValue(ws, `B${row}`, task.task || '');
    setCellValue(ws, `C${row}`, task.time || '');
    setCheckboxCell(ws, `D${row}`, task.monday);
    setCheckboxCell(ws, `E${row}`, task.tuesday);
    setCheckboxCell(ws, `F${row}`, task.wednesday);
    setCheckboxCell(ws, `G${row}`, task.thursday);
    setCheckboxCell(ws, `H${row}`, task.friday);
    setCheckboxCell(ws, `I${row}`, task.saturday);
    setCheckboxCell(ws, `J${row}`, task.sunday);
  }, (row) => {
    for (const c of ['A', 'B', 'C']) setCellValue(ws, `${c}${row}`, '');
    for (const c of ['D', 'E', 'F', 'G', 'H', 'I', 'J']) setCheckboxCell(ws, `${c}${row}`, false);
  }, 2, (overflow, row) => {
    setCellValue(ws, `B${row}`, `(+${overflow} more tasks)`);
  });

  // ─── TO DO ITEMS (Rows 2-12, Cols L-M) ───
  fillCapped(todoItems, MAX.TODO_ITEMS, (todo, row) => {
    setCheckboxCell(ws, `L${row}`, todo.completed);
    const cell = ws.getCell(`M${row}`);
    cell.value = todo.task || '';
    const ea = cell.alignment || {};
    cell.alignment = { ...ea, wrapText: true };
    if (todo.completed) {
      const ef = cell.font || {};
      cell.font = { ...ef, strike: true };
    }
  }, (row) => {
    setCheckboxCell(ws, `L${row}`, false);
    setCellValue(ws, `M${row}`, '');
  }, 2, (overflow, row) => {
    setCellValue(ws, `M${row}`, `(+${overflow} more items)`);
  });

  // ─── FREQUENCY TASKS (Rows 2-16, Cols O-Q) ───
  const biweekly = freqTasks.filter((t: any) => t.frequency === 'BIWEEKLY');
  const monthly = freqTasks.filter((t: any) => t.frequency === 'MONTHLY');
  const quarterly = freqTasks.filter((t: any) => t.frequency === 'QUARTERLY');
  const annually = freqTasks.filter((t: any) => t.frequency === 'ANNUALLY');
  fillFrequencyBlock(ws, biweekly, 3, 4);
  fillFrequencyBlock(ws, monthly, 6, 8);
  fillFrequencyBlock(ws, quarterly, 10, 12);
  fillFrequencyBlock(ws, annually, 14, 16);

  // ─── PROJECTS (Rows 21-23, Cols A-M) ───
  fillCapped(projects, MAX.PROJECTS, (project, row, i) => {
    setCellValue(ws, `A${row}`, `${i + 1})`);
    setCellValue(ws, `B${row}`, project.name || '');
    const latestUpdate = project.updates?.length
      ? project.updates[project.updates.length - 1]?.text || ''
      : '';
    setCellValue(ws, `G${row}`, latestUpdate);
  }, (row) => {
    setCellValue(ws, `A${row}`, '');
    setCellValue(ws, `B${row}`, '');
    setCellValue(ws, `G${row}`, '');
  }, 21, (overflow, row) => {
    setCellValue(ws, `B${row}`, `(+${overflow} more projects)`);
  });

  // ─── MEETING RAILS (Rows 21-23, Cols O-Q) ───
  fillCapped(meetingRails, MAX.MEETING_RAILS, (rail, row) => {
    setCheckboxCell(ws, `O${row}`, rail.completed);
    setCellValue(ws, `P${row}`, rail.rail || '');
    setCellNoWrap(ws, `Q${row}`, formatDate(rail.dueDate));
  }, (row) => {
    setCheckboxCell(ws, `O${row}`, false);
    setCellValue(ws, `P${row}`, '');
    setCellValue(ws, `Q${row}`, '');
  }, 21, (overflow, row) => {
    setCellValue(ws, `P${row}`, `(+${overflow} more rails)`);
  });

  // ─── FOLLOW UPS (Rows 26-30, Cols A-M) ───
  fillCapped(followUps, MAX.FOLLOW_UPS, (followUp, row) => {
    setCheckboxCell(ws, `A${row}`, followUp.completed);
    setCellValue(ws, `B${row}`, followUp.task || '');
    setCellNoWrap(ws, `C${row}`, formatDate(followUp.dueDate));
    setCellValue(ws, `F${row}`, followUp.responsibleName || '');
    setCellValue(ws, `J${row}`, followUp.comments || '');
  }, (row) => {
    setCheckboxCell(ws, `A${row}`, false);
    setCellValue(ws, `B${row}`, '');
    setCellValue(ws, `C${row}`, '');
    setCellValue(ws, `F${row}`, '');
    setCellValue(ws, `J${row}`, '');
  }, 26, (overflow, row) => {
    setCellValue(ws, `B${row}`, `(+${overflow} more follow-ups)`);
  });

  // ─── KEY RESULTS (Rows 25-31, Cols O-Q) ───
  if (keyResultSets.length > 0) {
    const firstSet = keyResultSets[0];
    const firstResults = (firstSet as any).keyResults || [];
    setCellPlain(ws, 'O26', firstSet.name || '');
    for (let i = 0; i < MAX.KEY_RESULTS_PER_SET; i++) {
      const row = 27 + i;
      const kr = firstResults[i];
      setCellPlain(ws, `O${row}`, kr
        ? `${i + 1}) ${kr.metric}${kr.value ? ': ' + kr.value : ''}`
        : '');
    }
  } else {
    setCellPlain(ws, 'O26', '');
    for (let i = 0; i < MAX.KEY_RESULTS_PER_SET; i++) setCellPlain(ws, `O${27 + i}`, '');
  }

  if (keyResultSets.length > 1) {
    const secondSet = keyResultSets[1];
    const secondResults = (secondSet as any).keyResults || [];
    setCellPlain(ws, 'Q26', secondSet.name || '');
    for (let i = 0; i < MAX.KEY_RESULTS_PER_SET; i++) {
      const row = 27 + i;
      const kr = secondResults[i];
      setCellPlain(ws, `Q${row}`, kr
        ? `${i + 1}) ${kr.metric}${kr.value ? ': ' + kr.value : ''}`
        : '');
    }
  } else {
    setCellPlain(ws, 'Q26', '');
    for (let i = 0; i < MAX.KEY_RESULTS_PER_SET; i++) setCellPlain(ws, `Q${27 + i}`, '');
  }

  // ─── RCA TRIGGERS (Rows 33-37, Cols A-M) ───
  // Template: A:B merged = RCA Event Trigger, C:F merged = Event Date, G:M merged = Comments/Notes
  fillCapped(rcaTriggers, MAX.RCA_TRIGGERS, (trigger: any, row: number) => {
    setCellValue(ws, `A${row}`, trigger.trigger || '');
    setCellNoWrap(ws, `C${row}`, formatDate(trigger.eventDate));
    setCellValue(ws, `G${row}`, trigger.comments || '');
  }, (row: number) => {
    setCellValue(ws, `A${row}`, '');
    setCellValue(ws, `C${row}`, '');
    setCellValue(ws, `G${row}`, '');
  }, 33, (overflow: number, row: number) => {
    setCellValue(ws, `A${row}`, `(+${overflow} more triggers)`);
  });

  // ─── PERSONAL GOALS (Rows 33-37, Cols O-Q) ───
  fillCapped(personalGoals, MAX.PERSONAL_GOALS, (goal, row) => {
    setCheckboxCell(ws, `O${row}`, (goal as any).progress >= 100);
    setCellValue(ws, `P${row}`, (goal as any).objective || '');
    setCellNoWrap(ws, `Q${row}`, formatDate((goal as any).dueDate));
  }, (row) => {
    setCheckboxCell(ws, `O${row}`, false);
    setCellValue(ws, `P${row}`, '');
    setCellValue(ws, `Q${row}`, '');
  }, 33, (overflow, row) => {
    setCellValue(ws, `P${row}`, `(+${overflow} more goals)`);
  });

  // ─── AUTO ROW HEIGHT for all data sections ───
  // Remove fixed row heights so Excel auto-fits based on wrapText content
  const dataRowRanges = [
    { start: 2, end: 16 },   // Daily Tasks + To Do + Frequency Tasks
    { start: 21, end: 23 },  // Projects + Meeting Rails
    { start: 26, end: 31 },  // Follow Ups + Key Results
    { start: 33, end: 37 },  // RCA Triggers + Personal Goals
  ];
  for (const range of dataRowRanges) {
    for (let r = range.start; r <= range.end; r++) {
      const row = ws.getRow(r);
      // Clear fixed height — Excel will auto-calculate on open with wrapText
      row.height = undefined as any;
    }
  }

  // Write to buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Fill a capped section. If data exceeds maxRows, the last row shows an overflow note.
 */
function fillCapped<T>(
  items: T[],
  maxRows: number,
  fillItem: (item: T, row: number, index: number) => void,
  clearRow: (row: number) => void,
  startRow: number,
  overflowNote: (overflow: number, row: number) => void
): void {
  const overflow = items.length > maxRows ? items.length - maxRows + 1 : 0;
  const displayCount = overflow > 0 ? maxRows - 1 : Math.min(items.length, maxRows);

  for (let i = 0; i < maxRows; i++) {
    const row = startRow + i;
    if (i < displayCount) {
      fillItem(items[i], row, i);
    } else if (i === displayCount && overflow > 0) {
      clearRow(row);
      overflowNote(overflow, row);
    } else {
      clearRow(row);
    }
  }
}

/**
 * Set a cell value. Enables text wrap for non-empty strings.
 */
function setCellValue(ws: ExcelJS.Worksheet, cellRef: string, value: any): void {
  const cell = ws.getCell(cellRef);
  cell.value = value;
  if (typeof value === 'string' && value.length > 0) {
    const existingAlignment = cell.alignment || {};
    cell.alignment = { ...existingAlignment, wrapText: true };
  }
}

/**
 * Set a cell value without text wrap (for dates, short values).
 */
function setCellNoWrap(ws: ExcelJS.Worksheet, cellRef: string, value: any): void {
  const cell = ws.getCell(cellRef);
  cell.value = value;
}

/**
 * Set a cell value with strikethrough explicitly cleared and text wrap enabled.
 */
function setCellPlain(ws: ExcelJS.Worksheet, cellRef: string, value: any): void {
  const cell = ws.getCell(cellRef);
  cell.value = value;
  const existingFont = cell.font || {};
  cell.font = { ...existingFont, strike: false };
  if (typeof value === 'string' && value.length > 0) {
    const existingAlignment = cell.alignment || {};
    cell.alignment = { ...existingAlignment, wrapText: true };
  }
}

/**
 * Fill frequency task block. Tasks go in column P, due dates in Q.
 */
function fillFrequencyBlock(
  ws: ExcelJS.Worksheet,
  tasks: any[],
  startRow: number,
  endRow: number
): void {
  const maxRows = endRow - startRow + 1;
  for (let i = 0; i < maxRows; i++) {
    const row = startRow + i;
    const task = tasks[i];
    if (task) {
      setCellValue(ws, `P${row}`, task.task || '');
      setCellNoWrap(ws, `Q${row}`, formatDate(task.dueDate));
    } else {
      setCellValue(ws, `P${row}`, '');
      setCellValue(ws, `Q${row}`, '');
    }
  }
}

function checkbox(value: any): string {
  return value ? '☑' : '☐';
}

/**
 * Set a cell as an editable checkbox using data validation dropdown.
 * User can click the cell and pick ☑ or ☐ from a dropdown list.
 */
function setCheckboxCell(ws: ExcelJS.Worksheet, cellRef: string, value: any): void {
  const cell = ws.getCell(cellRef);
  cell.value = value ? '☑' : '☐';
  cell.dataValidation = {
    type: 'list',
    allowBlank: false,
    formulae: ['"☑,☐"'],
    showDropDown: false,
  };
  const ea = cell.alignment || {};
  cell.alignment = { ...ea, horizontal: 'center', vertical: 'middle' };
}

function formatDate(date: any): string {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default { generateLswExcelReport };
