import ExcelJS from 'exceljs';
import path from 'path';
import lswService from './lswService';

const TEMPLATE_PATH = path.join(__dirname, '../../assets/templates/LSW_TEMPLATE.xlsx');

interface LswExportIncludePastDue {
  followUps?: boolean;
  triggers?: boolean;
  frequencyTasks?: boolean;
  rails?: boolean;
  goals?: boolean;
}

// ─── BASE TEMPLATE ROW COUNTS PER BLOCK ────────────────────────────────────
// Blocks have side-by-side sections that share row ranges. When data exceeds
// the base capacity we insert additional rows via duplicateRow (preserves
// styles + merged cells) BEFORE writing values.
//
// Template layout (rows):
//   Row 1        — Block 1 header
//   Rows 2-16    — Block 1 data (Daily Tasks, To-Do, Frequency)
//   Row 18       — Block 2 title
//   Row 19       — Block 2 sub-headers
//   Rows 20-22   — Block 2 data (Projects, Meeting Rails)
//   Row 24       — Block 3 title
//   Row 25       — Block 3 sub-headers (incl. KR set names "MegaMex"/"Don Miguel")
//   Rows 26-32   — Block 3 data (Follow-Ups, Key Results)
//   Row 33-34    — Block 4 titles + sub-headers
//   Rows 35-39   — Block 4 data (RCA Triggers, Personal Goals)
const BASE = {
  DAILY_TASKS: 15,        // Rows 2-16 (cols A-J)
  TODO_ITEMS: 11,         // Rows 2-12 (cols L-M)
  PROJECTS: 3,            // Rows 20-22 (cols A-M)
  MEETING_RAILS: 3,       // Rows 20-22 (cols O-Q)
  FOLLOW_UPS: 7,          // Rows 26-32 (cols A-M)
  KEY_RESULTS_PER_SET: 5, // Rows 26-30 (cols P, Q); O is "#" / blank
  RCA_TRIGGERS: 5,        // Rows 35-39 (cols A-M)
  PERSONAL_GOALS: 5,      // Rows 35-39 (cols O-Q)
  FREQ_BIWEEKLY: 2,       // Rows 3-4
  FREQ_MONTHLY: 3,        // Rows 6-8
  FREQ_QUARTERLY: 3,      // Rows 10-12
  FREQ_ANNUALLY: 3,       // Rows 14-16
};

/**
 * Generate an Excel report from the LSW template, filled with the user's data.
 * Dynamically expands rows within each block as data grows, preserving the
 * template's styling and merged cells.
 */
export async function generateLswExcelReport(
  userId: string,
  organizationId: string,
  weekNumber: number,
  year: number,
  userName: string,
  weekStartDate: string,
  department?: string,
  includePastDue: LswExportIncludePastDue = {}
): Promise<ExcelJS.Buffer> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(TEMPLATE_PATH);

  const ws = workbook.getWorksheet('Weekly');
  if (!ws) throw new Error('Weekly sheet not found in template');

  const data = await lswService.getFullLswData(userId, organizationId, weekNumber, year);

  // Prepare data arrays
  const dailyTasks = data.dailyTasks || [];
  const todoItems = (data.todoItems || []).filter((t: any) => t.isActive !== false);
  const freqTasks = filterBySelectedWeek(data.frequencyTasks || [], 'dueDate', weekStartDate, !!includePastDue.frequencyTasks);
  const projects = data.projects || [];
  const meetingRails = filterBySelectedWeek(data.meetingRails || [], 'dueDate', weekStartDate, !!includePastDue.rails);
  const followUps = filterBySelectedWeek(
    (data.followUps || []).filter((f: any) => f.isActive !== false),
    'dueDate',
    weekStartDate,
    !!includePastDue.followUps
  );
  const keyResultSets = data.keyResultSets || [];
  const rcaTriggers = filterBySelectedWeek(data.rcaTriggers || [], 'eventDate', weekStartDate, !!includePastDue.triggers);
  const personalGoals = filterBySelectedWeek(data.personalGoals || [], 'dueDate', weekStartDate, !!includePastDue.goals);

  const biweekly = freqTasks.filter((t: any) => t.frequency === 'BIWEEKLY');
  const monthly = freqTasks.filter((t: any) => t.frequency === 'MONTHLY');
  const quarterly = freqTasks.filter((t: any) => t.frequency === 'QUARTERLY');
  const annually = freqTasks.filter((t: any) => t.frequency === 'ANNUALLY');

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 1 — Compute extra rows needed per block
  // ═══════════════════════════════════════════════════════════════════════════
  // Note: Block 1 (rows 2-16) is shared by Daily Tasks, To-Do, and Frequency
  // sub-blocks. Frequency has fixed header rows, so we only grow the ANNUALLY
  // sub-block (its end row = 16 = block 1 boundary). Biweekly/Monthly/Quarterly
  // stay capped (overflow shown via "+N more").
  const extraAnnually = Math.max(0, annually.length - BASE.FREQ_ANNUALLY);
  const extra1 = Math.max(
    0,
    dailyTasks.length - BASE.DAILY_TASKS,
    todoItems.length - BASE.TODO_ITEMS,
    extraAnnually
  );
  const extra2 = Math.max(
    0,
    projects.length - BASE.PROJECTS,
    meetingRails.length - BASE.MEETING_RAILS
  );
  const extra3 = Math.max(0, followUps.length - BASE.FOLLOW_UPS);
  const extra4 = Math.max(
    0,
    rcaTriggers.length - BASE.RCA_TRIGGERS,
    personalGoals.length - BASE.PERSONAL_GOALS
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 2 — Insert extra rows BOTTOM-UP (keeps upstream row numbers stable).
  // ExcelJS does not reliably shift merged cells when rows are duplicated. We
  // clear the template merges first, duplicate the styled rows, then rebuild the
  // exact merge layout for every shifted/expanded section.
  // ═══════════════════════════════════════════════════════════════════════════
  clearWorksheetMerges(ws);
  if (extra4 > 0) ws.duplicateRow(39, extra4, true);
  if (extra3 > 0) ws.duplicateRow(32, extra3, true);
  if (extra2 > 0) ws.duplicateRow(22, extra2, true);
  if (extra1 > 0) ws.duplicateRow(16, extra1, true);

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 3 — Compute post-expansion row ranges
  // ═══════════════════════════════════════════════════════════════════════════
  const R = {
    // Block 1
    daily: { start: 2, end: 16 + extra1 },       // A-J
    todo: { start: 2, end: 12 + extra1 },        // L-M (band extended via block1 expansion)
    freq: {
      biweekly: { start: 3, end: 4 },
      monthly: { start: 6, end: 8 },
      quarterly: { start: 10, end: 12 },
      annually: { start: 14, end: 16 + extra1 }, // annually absorbs block1 expansion
    },
    // Block 2 — Projects (A-M) + Meeting Rails (O-Q), rows 20-22
    projects: { start: 20 + extra1, end: 22 + extra1 + extra2 },
    rails: { start: 20 + extra1, end: 22 + extra1 + extra2 },
    // Block 3 — Follow-Ups (A-M) + Key Results (P/Q), rows 26-32
    // KR headers (MegaMex/Don Miguel) are pre-filled in row 25 of the template.
    followUps: { start: 26 + extra1 + extra2, end: 32 + extra1 + extra2 + extra3 },
    krFirstRow: 26 + extra1 + extra2,            // KR1..5 at krFirstRow..krFirstRow+4
    // Block 4 — RCA (A-M) + Personal Goals (O-Q), rows 35-39
    rca: { start: 35 + extra1 + extra2 + extra3, end: 39 + extra1 + extra2 + extra3 + extra4 },
    goals: { start: 35 + extra1 + extra2 + extra3, end: 39 + extra1 + extra2 + extra3 + extra4 },
  };

  applyLswTemplateMerges(ws, extra1, extra2, extra3, extra4);

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 4 — Fill sections (no caps; all rows are available)
  // ═══════════════════════════════════════════════════════════════════════════

  // ─── DAILY TASKS (cols A-J) ───
  fillRange(R.daily.start, R.daily.end, dailyTasks, (task, row) => {
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
  });

  // ─── TO-DO ITEMS (cols L-M) ───
  fillRange(R.todo.start, R.todo.end, todoItems, (todo, row) => {
    setCheckboxCell(ws, `L${row}`, todo.completed);
    setCellValue(ws, `M${row}`, todo.task || '');
    setCellStrike(ws, `M${row}`, !!todo.completed);
  }, (row) => {
    setCheckboxCell(ws, `L${row}`, false);
    setCellValue(ws, `M${row}`, '');
    setCellStrike(ws, `M${row}`, false);
  });

  // ─── FREQUENCY TASKS (cols O-Q) ───
  // Fixed sub-blocks, with ANNUALLY absorbing any block1 expansion.
  fillFrequencyBlock(ws, biweekly, R.freq.biweekly.start, R.freq.biweekly.end);
  fillFrequencyBlock(ws, monthly, R.freq.monthly.start, R.freq.monthly.end);
  fillFrequencyBlock(ws, quarterly, R.freq.quarterly.start, R.freq.quarterly.end);
  fillFrequencyBlock(ws, annually, R.freq.annually.start, R.freq.annually.end);

  // ─── PROJECTS (cols A-M) ───
  // Column A is left blank — template has "#" header but we no longer number rows.
  fillRange(R.projects.start, R.projects.end, projects, (project, row) => {
    setCellValue(ws, `A${row}`, '');
    setCellValue(ws, `B${row}`, project.name || '');
    const latestUpdate = project.updates?.length
      ? project.updates[project.updates.length - 1]?.text || ''
      : '';
    setCellValue(ws, `G${row}`, latestUpdate);
  }, (row) => {
    setCellValue(ws, `A${row}`, '');
    setCellValue(ws, `B${row}`, '');
    setCellValue(ws, `G${row}`, '');
  });

  // ─── MEETING RAILS (cols O-Q) ───
  fillRange(R.rails.start, R.rails.end, meetingRails, (rail, row) => {
    setCheckboxCell(ws, `O${row}`, rail.completed);
    setCellValue(ws, `P${row}`, rail.rail || '');
    setCellNoWrap(ws, `Q${row}`, formatDate(rail.dueDate));
    setCellStrike(ws, `P${row}`, !!rail.completed);
    setCellStrike(ws, `Q${row}`, !!rail.completed);
  }, (row) => {
    setCheckboxCell(ws, `O${row}`, false);
    setCellValue(ws, `P${row}`, '');
    setCellValue(ws, `Q${row}`, '');
    setCellStrike(ws, `P${row}`, false);
    setCellStrike(ws, `Q${row}`, false);
  });

  // ─── FOLLOW-UPS (cols A-M) ───
  fillRange(R.followUps.start, R.followUps.end, followUps, (followUp, row) => {
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
  });

  // ─── KEY RESULTS (cols P, Q) ───
  // Template row 25 pre-fills headers: O25="#", P25="MegaMex", Q25="Don Miguel".
  // Set 1 data goes in column P, Set 2 in column Q.
  // Column O (numbering) is left blank.
  // KRs occupy rows 26..30 (5 rows). Any remaining rows in the follow-up band
  // (due to base capacity of 7 or dynamic expansion) get blank O/P/Q cells.
  const krRows = 5;
  for (let i = 0; i < krRows; i++) {
    const row = R.krFirstRow + i;
    const kr1 = (keyResultSets[0] as any)?.keyResults?.[i];
    const kr2 = (keyResultSets[1] as any)?.keyResults?.[i];
    setCellPlain(ws, `O${row}`, '');
    setCellPlain(ws, `P${row}`, kr1 ? `${kr1.metric}${kr1.value ? ': ' + kr1.value : ''}` : '');
    setCellPlain(ws, `Q${row}`, kr2 ? `${kr2.metric}${kr2.value ? ': ' + kr2.value : ''}` : '');
  }
  // Clear any rows below the KR range that still sit inside the follow-up band.
  for (let r = R.krFirstRow + krRows; r <= R.followUps.end; r++) {
    setCellPlain(ws, `O${r}`, '');
    setCellPlain(ws, `P${r}`, '');
    setCellPlain(ws, `Q${r}`, '');
  }

  // ─── RCA TRIGGERS (cols A-M) ───
  fillRange(R.rca.start, R.rca.end, rcaTriggers, (trigger: any, row: number) => {
    setCheckboxCell(ws, `A${row}`, false);
    setCellValue(ws, `B${row}`, trigger.trigger || '');
    setCellNoWrap(ws, `C${row}`, formatDate(trigger.eventDate));
    setCellValue(ws, `G${row}`, trigger.comments || '');
  }, (row: number) => {
    setCheckboxCell(ws, `A${row}`, false);
    setCellValue(ws, `B${row}`, '');
    setCellValue(ws, `C${row}`, '');
    setCellValue(ws, `G${row}`, '');
  });

  // ─── PERSONAL GOALS (cols O-Q) ───
  fillRange(R.goals.start, R.goals.end, personalGoals, (goal, row) => {
    setCheckboxCell(ws, `O${row}`, (goal as any).progress >= 100);
    setCellValue(ws, `P${row}`, (goal as any).objective || '');
    setCellNoWrap(ws, `Q${row}`, formatDate((goal as any).dueDate));
  }, (row) => {
    setCheckboxCell(ws, `O${row}`, false);
    setCellValue(ws, `P${row}`, '');
    setCellValue(ws, `Q${row}`, '');
  });

  // ─── INFO BLOCK (Department / Name / Week) ───
  // Template rows 43-45 (value cells at G43/G44/G45 — merged G:M).
  // Shift down by the sum of all extra rows inserted above.
  const rowShift = extra1 + extra2 + extra3 + extra4;
  const deptRow = 43 + rowShift;
  const nameRow = 44 + rowShift;
  const weekRow = 45 + rowShift;
  const deptDisplay = !department || department === 'all' || department === ''
    ? 'All Departments'
    : department;
  setCellValue(ws, `G${deptRow}`, deptDisplay);
  setCellValue(ws, `G${nameRow}`, userName || '');
  setCellValue(ws, `G${weekRow}`, `Week ${weekNumber}`);

  // ─── TEXT WRAP on every cell ───
  // Enable wrapText on every cell in the sheet and clear any stored row
  // height / customHeight so Excel auto-sizes rows to the wrapped content
  // on open.
  ws.eachRow({ includeEmpty: true }, (row) => {
    row.eachCell({ includeEmpty: true }, (cell) => {
      const ea = cell.alignment || {};
      cell.alignment = { ...ea, wrapText: true };
    });
    row.height = undefined as any;
    const model = (row as any).model;
    if (model) {
      delete model.height;
      model.customHeight = false;
    }
  });

  // ─── NORMALIZE BORDER WEIGHTS ───
  // Rewrite every existing border edge with a single uniform style so all
  // visible lines share the same weight/color across the whole sheet.
  normalizeBorders(ws);
  applyLswSectionGridBorders(ws, R);

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function toDateKey(value: any): string {
  if (!value) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
  }
  const parsed = new Date(value);
  return isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(0, 10);
}

function filterBySelectedWeek<T extends Record<string, any>>(
  items: T[],
  dateField: keyof T,
  weekStartDate: string,
  includePastDue: boolean
): T[] {
  if (includePastDue || !weekStartDate) return items;

  return items.filter((item) => {
    const dateKey = toDateKey(item[dateField]);
    return !dateKey || dateKey >= weekStartDate;
  });
}

function colLetter(index: number): string {
  let n = index;
  let result = '';
  while (n > 0) {
    const remainder = (n - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    n = Math.floor((n - 1) / 26);
  }
  return result;
}

function mergeRef(top: number, left: number, bottom: number, right: number): string {
  return `${colLetter(left)}${top}:${colLetter(right)}${bottom}`;
}

function getWorksheetMergeRefs(ws: ExcelJS.Worksheet): string[] {
  const merges = ((ws as any)._merges || {}) as Record<string, { top: number; left: number; bottom: number; right: number }>;
  return Object.values(merges).map((merge) => mergeRef(merge.top, merge.left, merge.bottom, merge.right));
}

function clearWorksheetMerges(ws: ExcelJS.Worksheet): void {
  for (const ref of getWorksheetMergeRefs(ws)) {
    ws.unMergeCells(ref);
  }
}

function mergeCells(ws: ExcelJS.Worksheet, startCell: string, endCell: string): void {
  if (startCell === endCell) return;
  ws.mergeCells(`${startCell}:${endCell}`);
}

function mergeRowSegments(ws: ExcelJS.Worksheet, row: number, segments: Array<[string, string]>): void {
  for (const [startCol, endCol] of segments) {
    mergeCells(ws, `${startCol}${row}`, `${endCol}${row}`);
  }
}

function mergeRowRangeSegments(
  ws: ExcelJS.Worksheet,
  startRow: number,
  endRow: number,
  segments: Array<[string, string]>
): void {
  for (let row = startRow; row <= endRow; row++) {
    mergeRowSegments(ws, row, segments);
  }
}

function applyLswTemplateMerges(
  ws: ExcelJS.Worksheet,
  extra1: number,
  extra2: number,
  extra3: number,
  extra4: number
): void {
  const block2Shift = extra1;
  const block3Shift = extra1 + extra2;
  const block4Shift = extra1 + extra2 + extra3;
  const totalShift = extra1 + extra2 + extra3 + extra4;

  // Block 1: daily / to-do / frequency
  mergeCells(ws, 'K1', `K${16 + extra1}`);
  mergeCells(ws, 'L1', 'M1');
  mergeCells(ws, 'N1', `N${16 + extra1}`);
  for (const row of [2, 5, 9, 13]) {
    mergeRowSegments(ws, row, [['O', 'Q']]);
  }

  // Block 2: projects and meeting rails
  mergeRowSegments(ws, 17 + block2Shift, [['A', 'Q']]);
  mergeRowSegments(ws, 18 + block2Shift, [['B', 'M'], ['P', 'Q']]);
  mergeRowSegments(ws, 19 + block2Shift, [['B', 'F'], ['G', 'M']]);
  mergeRowRangeSegments(ws, 20 + block2Shift, 22 + block2Shift + extra2, [['B', 'F'], ['G', 'M']]);
  mergeRowSegments(ws, 23 + block3Shift, [['A', 'M'], ['O', 'Q']]);

  // Block 3: follow-ups and key results
  mergeRowSegments(ws, 24 + block3Shift, [['B', 'M'], ['P', 'Q']]);
  mergeRowSegments(ws, 25 + block3Shift, [['C', 'E'], ['F', 'I'], ['J', 'M']]);
  mergeRowRangeSegments(ws, 26 + block3Shift, 32 + block3Shift + extra3, [['C', 'E'], ['F', 'I'], ['J', 'M']]);

  // Block 4: RCA triggers and personal goals
  mergeRowSegments(ws, 33 + block4Shift, [['B', 'M'], ['P', 'Q']]);
  mergeRowSegments(ws, 34 + block4Shift, [['C', 'F'], ['G', 'M']]);
  mergeRowRangeSegments(ws, 35 + block4Shift, 39 + block4Shift + extra4, [['C', 'F'], ['G', 'M']]);

  // Center divider for blocks 2-4.
  mergeCells(ws, `N${18 + block2Shift}`, `N${39 + totalShift}`);

  // Info block
  for (const row of [43 + totalShift, 44 + totalShift, 45 + totalShift]) {
    mergeRowSegments(ws, row, [['C', 'F'], ['G', 'M']]);
  }
}

/**
 * Fill a row range with items. All items are written (no cap). Any rows
 * beyond the data length are cleared.
 */
function fillRange<T>(
  startRow: number,
  endRow: number,
  items: T[],
  fillItem: (item: T, row: number, index: number) => void,
  clearRow: (row: number) => void
): void {
  const totalRows = endRow - startRow + 1;
  for (let i = 0; i < totalRows; i++) {
    const row = startRow + i;
    if (i < items.length) {
      fillItem(items[i], row, i);
    } else {
      clearRow(row);
    }
  }
}

/**
 * Strip bold from a cell's font while preserving size/name/color, and
 * normalize font size to a single body default so wrapped rows size
 * consistently regardless of inherited template styling.
 */
function unboldCell(cell: ExcelJS.Cell): void {
  const existingFont = cell.font || {};
  cell.font = { ...existingFont, bold: false, size: 11 };
}

/** Collapse embedded newlines so Excel doesn't pad rows with forced breaks. */
function sanitizeText(value: any): any {
  if (typeof value !== 'string') return value;
  return value.replace(/\r?\n+/g, ' ').replace(/\s{2,}/g, ' ').trim();
}

function setCellValue(ws: ExcelJS.Worksheet, cellRef: string, value: any): void {
  const cell = ws.getCell(cellRef);
  const v = sanitizeText(value);
  cell.value = v;
  unboldCell(cell);
  // Enable text wrapping for text data so long strings wrap within the
  // column width and the row grows only when wrapping actually happens.
  if (typeof v === 'string') {
    const ea = cell.alignment || {};
    cell.alignment = { ...ea, wrapText: true };
  }
}

function setCellNoWrap(ws: ExcelJS.Worksheet, cellRef: string, value: any): void {
  const cell = ws.getCell(cellRef);
  cell.value = sanitizeText(value);
  unboldCell(cell);
  const ea = cell.alignment || {};
  cell.alignment = { ...ea, wrapText: false };
}

function setCellStrike(ws: ExcelJS.Worksheet, cellRef: string, strike: boolean): void {
  const cell = ws.getCell(cellRef);
  const existingFont = cell.font || {};
  if (strike) {
    const value = cell.value;
    const text = value == null
      ? ''
      : typeof value === 'object' && (value as any).richText
      ? (value as any).richText.map((part: any) => part.text).join('')
      : String(value);
    cell.value = {
      richText: [
        {
          text,
          font: { ...existingFont, strike: true, bold: false, size: 11 },
        },
      ],
    };
    return;
  }

  cell.font = { ...existingFont, strike: false, bold: false, size: 11 };
}

function setCellPlain(ws: ExcelJS.Worksheet, cellRef: string, value: any): void {
  const cell = ws.getCell(cellRef);
  const v = sanitizeText(value);
  cell.value = v;
  const existingFont = cell.font || {};
  cell.font = { ...existingFont, strike: false, bold: false, size: 11 };
  if (typeof v === 'string') {
    const ea = cell.alignment || {};
    cell.alignment = { ...ea, wrapText: true };
  }
}

/**
 * Fill a frequency task sub-block. If tasks exceed rows, the last row shows
 * an overflow note.
 */
function fillFrequencyBlock(
  ws: ExcelJS.Worksheet,
  tasks: any[],
  startRow: number,
  endRow: number
): void {
  const maxRows = endRow - startRow + 1;
  const overflow = tasks.length > maxRows ? tasks.length - maxRows + 1 : 0;
  const displayCount = overflow > 0 ? maxRows - 1 : Math.min(tasks.length, maxRows);

  for (let i = 0; i < maxRows; i++) {
    const row = startRow + i;
    if (i < displayCount) {
      const task = tasks[i];
      setCellValue(ws, `P${row}`, task.task || '');
      setCellNoWrap(ws, `Q${row}`, formatDate(task.dueDate));
    } else if (i === displayCount && overflow > 0) {
      setCellValue(ws, `P${row}`, `(+${overflow} more)`);
      setCellValue(ws, `Q${row}`, '');
    } else {
      setCellValue(ws, `P${row}`, '');
      setCellValue(ws, `Q${row}`, '');
    }
  }
}

/**
 * Set a cell as an editable checkbox using a data-validation dropdown.
 */
function setCheckboxCell(ws: ExcelJS.Worksheet, cellRef: string, value: any): void {
  const cell = ws.getCell(cellRef);
  cell.value = value ? '☑' : '☐';
  cell.dataValidation = {
    type: 'list',
    allowBlank: false,
    formulae: ['"☑,☐"'],
  } as ExcelJS.DataValidation;
  const ea = cell.alignment || {};
  cell.alignment = { ...ea, horizontal: 'center', vertical: 'middle' };
  unboldCell(cell);
}

function formatDate(date: any): string {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Column letter → 0-based index.
 */
function colLetterToIndex(letter: string): number {
  let n = 0;
  for (let i = 0; i < letter.length; i++) {
    n = n * 26 + (letter.charCodeAt(i) - 64);
  }
  return n; // 1-based for ExcelJS getColumn
}

/**
 * Resolve the effective printable width (in Excel column-width units) for a
 * cell, accounting for horizontal merges. If the cell is the top-left of a
 * merged range spanning multiple columns, sum the widths of those columns.
 */
function getEffectiveWidth(ws: ExcelJS.Worksheet, row: number, colLetter: string): number {
  const col = colLetterToIndex(colLetter);
  const defaultWidth = 10;

  // Detect horizontal merge starting at this cell.
  const merges: any = (ws as any)._merges || {};
  let span = 1;
  for (const key of Object.keys(merges)) {
    const m = merges[key];
    // m has top/left/bottom/right (1-based)
    if (m && m.top === row && m.left === col) {
      span = m.right - m.left + 1;
      break;
    }
    // Some versions expose tl/br
    if (m && m.tl && m.br) {
      const tl = m.tl; const br = m.br;
      if (tl.row === row && tl.col === col) {
        span = br.col - tl.col + 1;
        break;
      }
    }
  }

  let total = 0;
  for (let c = col; c < col + span; c++) {
    const column = ws.getColumn(c);
    const w = (column && (column.width as number)) || defaultWidth;
    total += w;
  }
  return total;
}

/**
 * Estimate the number of wrapped lines a string will occupy in a cell of the
 * given Excel column-width. Excel column-width unit ≈ width of one digit in
 * the default font. We deliberately under-estimate chars-per-line so that
 * borderline cases wrap safely instead of clipping.
 */
function estimateWrappedLines(text: string, widthUnits: number): number {
  if (!text) return 1;
  // Subtract padding and be conservative: ~0.85 average chars per width-unit
  // (accounting for uppercase letters, punctuation, bold inflation).
  const usable = Math.max(widthUnits - 2, 4);
  const charsPerLine = Math.max(Math.floor(usable * 0.9), 4);

  // Split on any hard newlines first, then wrap each segment.
  const segments = text.split(/\r?\n/);
  let totalLines = 0;
  for (const seg of segments) {
    if (!seg) { totalLines += 1; continue; }
    const words = seg.split(/\s+/);
    let line = '';
    let lines = 1;
    for (const w of words) {
      if (!w) continue;
      if (line.length === 0) {
        if (w.length > charsPerLine) {
          lines += Math.ceil(w.length / charsPerLine) - 1;
          line = '';
        } else {
          line = w;
        }
      } else if (line.length + 1 + w.length <= charsPerLine) {
        line += ' ' + w;
      } else {
        lines += 1;
        if (w.length > charsPerLine) {
          lines += Math.ceil(w.length / charsPerLine) - 1;
          line = '';
        } else {
          line = w;
        }
      }
    }
    totalLines += lines;
  }
  return Math.max(totalLines, 1);
}

/**
 * Compute and set the required row height based on the wrapped text content
 * of the declared wrap-columns. Takes the MAX required across those cells
 * (since Excel rows share a single height). Non-wrap columns on the same row
 * simply ride along at that height — which is the correct Excel behavior.
 */
function autoSizeRowHeight(ws: ExcelJS.Worksheet, rowNum: number, wrapCols: string[]): void {
  const LINE_HEIGHT_POINTS = 16; // 11pt Calibri → ~15pt; add 1 for safety
  const MIN_HEIGHT = 18;
  const VERTICAL_PADDING = 4;

  let maxLines = 1;
  for (const col of wrapCols) {
    const cell = ws.getCell(`${col}${rowNum}`);
    const raw = cell.value;
    const text = raw == null ? '' : String(
      typeof raw === 'object' && (raw as any).richText
        ? (raw as any).richText.map((t: any) => t.text).join('')
        : raw
    );
    if (!text) continue;
    const width = getEffectiveWidth(ws, rowNum, col);
    const lines = estimateWrappedLines(text, width);
    if (lines > maxLines) maxLines = lines;

    // Ensure wrapText on so Excel actually wraps on open.
    const ea = cell.alignment || {};
    cell.alignment = { ...ea, wrapText: true, vertical: ea.vertical || 'top' };
  }

  const row = ws.getRow(rowNum);
  const computed = maxLines * LINE_HEIGHT_POINTS + VERTICAL_PADDING;
  const finalHeight = Math.max(computed, MIN_HEIGHT);
  row.height = finalHeight;
  // Force Excel to honor this explicit height instead of auto-recalculating
  // (which it often does incorrectly when customHeight is false).
  const model = (row as any).model;
  if (model) {
    model.height = finalHeight;
    model.customHeight = true;
  }
}

const LSW_GRID_BORDER: Partial<ExcelJS.Border> = {
  style: 'thin',
  color: { argb: 'FF000000' },
};

function setCellBorderEdges(ws: ExcelJS.Worksheet, cellRef: string, edges: Array<keyof ExcelJS.Borders>): void {
  const cell = ws.getCell(cellRef);
  const border: Partial<ExcelJS.Borders> = { ...(cell.border || {}) };
  for (const edge of edges) {
    if (edge === 'diagonal') continue;
    border[edge] = { ...LSW_GRID_BORDER } as ExcelJS.Border;
  }
  cell.border = border as ExcelJS.Borders;
}

function applyLogicalSegmentBorder(ws: ExcelJS.Worksheet, row: number, startCol: string, endCol: string): void {
  const start = colLetterToIndex(startCol);
  const end = colLetterToIndex(endCol);

  for (let col = start; col <= end; col++) {
    const letter = colLetter(col);
    const edges: Array<keyof ExcelJS.Borders> = ['top', 'bottom'];
    if (col === start) edges.push('left');
    if (col === end) edges.push('right');
    setCellBorderEdges(ws, `${letter}${row}`, edges);
  }
}

function applySegmentGridBorders(
  ws: ExcelJS.Worksheet,
  startRow: number,
  endRow: number,
  segments: Array<[string, string]>
): void {
  for (let row = startRow; row <= endRow; row++) {
    for (const [startCol, endCol] of segments) {
      applyLogicalSegmentBorder(ws, row, startCol, endCol);
    }
  }
}

function applyLswSectionGridBorders(ws: ExcelJS.Worksheet, ranges: {
  projects: { start: number; end: number };
  rails: { start: number; end: number };
  followUps: { start: number; end: number };
  rca: { start: number; end: number };
  goals: { start: number; end: number };
}): void {
  applySegmentGridBorders(ws, ranges.projects.start - 1, ranges.projects.end, [['A', 'A'], ['B', 'F'], ['G', 'M']]);
  applySegmentGridBorders(ws, ranges.rails.start - 1, ranges.rails.end, [['O', 'O'], ['P', 'P'], ['Q', 'Q']]);
  applySegmentGridBorders(ws, ranges.followUps.start - 1, ranges.followUps.end, [['A', 'A'], ['B', 'B'], ['C', 'E'], ['F', 'I'], ['J', 'M']]);
  applySegmentGridBorders(ws, ranges.rca.start - 1, ranges.rca.end, [['A', 'A'], ['B', 'B'], ['C', 'F'], ['G', 'M']]);
  applySegmentGridBorders(ws, ranges.goals.start - 1, ranges.goals.end, [['O', 'O'], ['P', 'P'], ['Q', 'Q']]);
}

/**
 * Normalize every border edge on the worksheet to a single uniform style/color.
 * Preserves WHICH edges exist (so section dividers stay) but forces every
 * edge to the same line weight so the whole sheet reads as one consistent grid.
 */
function normalizeBorders(ws: ExcelJS.Worksheet): void {
  const UNIFORM: Partial<ExcelJS.Border> = {
    style: 'thin',
    color: { argb: 'FF000000' },
  };

  ws.eachRow({ includeEmpty: true }, (row) => {
    row.eachCell({ includeEmpty: true }, (cell) => {
      const b = cell.border;
      if (!b) return;
      const next: Partial<ExcelJS.Borders> = {};
      if (b.top && b.top.style) next.top = { ...UNIFORM };
      if (b.bottom && b.bottom.style) next.bottom = { ...UNIFORM };
      if (b.left && b.left.style) next.left = { ...UNIFORM };
      if (b.right && b.right.style) next.right = { ...UNIFORM };
      if (b.diagonal && b.diagonal.style) {
        next.diagonal = { ...UNIFORM, up: b.diagonal.up, down: b.diagonal.down };
      }
      cell.border = next as ExcelJS.Borders;
    });
  });
}

export default { generateLswExcelReport };
