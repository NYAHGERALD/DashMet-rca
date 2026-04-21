/**
 * Issue Document Ingestion Service
 * ----------------------------------
 * Accepts a user-uploaded document (image, PDF, DOCX, XLSX) describing ONE
 * or more machine/quality issues and uses AI to extract + map the content
 * to our `MachineIssue` schema + related lookup tables.
 *
 * Returns:
 *  - a shared "context" object (Department / Area / Line / Shift / Week /
 *    Day) that applies to all issues in the document
 *  - an `issues` array where each entry owns its own
 *    title/description/priority/equipment/component/start-time/minutes-lost
 */

import OpenAI from 'openai';
import { prisma } from '../utils/prisma';
import mammoth from 'mammoth';
import ExcelJS from 'exceljs';

// ─── OpenAI client ──────────────────────────────────────────────────────────
let openaiClient: OpenAI | null = null;
function getOpenAI(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) return null;
  if (openaiClient) return openaiClient;
  openaiClient = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    timeout: 180000,
    maxRetries: 2,
  });
  return openaiClient;
}

// ─── Types ──────────────────────────────────────────────────────────────────
export interface SharedContext {
  departmentId: string | null;
  areaId: string | null;
  lineId: string | null;
  shiftId: string | null;
  weekNumber: number | null;
  dayOfWeekId: string | null;
  documentDate?: string | null;
  resolved?: {
    departmentName?: string | null;
    areaName?: string | null;
    lineName?: string | null;
    shiftName?: string | null;
    dayName?: string | null;
  };
}

export interface ExtractedIssueItem {
  type: 'MACHINE' | 'QUALITY' | null;
  title: string | null;
  description: string | null;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | null;
  equipmentId: string | null;
  componentId: string | null;
  startTime: string | null; // HH:MM
  totalMinutesLost: number | null;
  resolved?: {
    equipmentName?: string | null;
    componentName?: string | null;
  };
}

export interface ExtractionResult {
  context: SharedContext;
  issues: ExtractedIssueItem[];
  notes?: string | null;
  confidence?: number | null;
}

// ─── File-type detection ───────────────────────────────────────────────────
function detectKind(mimetype: string, originalName: string): 'image' | 'pdf' | 'docx' | 'xlsx' | 'unknown' {
  const mt = (mimetype || '').toLowerCase();
  const ext = (originalName.split('.').pop() || '').toLowerCase();
  if (mt.startsWith('image/') || ['jpg', 'jpeg', 'png'].includes(ext)) return 'image';
  if (mt === 'application/pdf' || ext === 'pdf') return 'pdf';
  if (mt === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || ext === 'docx') return 'docx';
  if (mt === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || ext === 'xlsx') return 'xlsx';
  return 'unknown';
}

// ─── Content extraction ────────────────────────────────────────────────────
async function extractPdfText(buffer: Buffer): Promise<string> {
  try {
    // Lazy-load pdf-parse v1 legacy entrypoint to avoid pdfjs-dist's DOMMatrix dep.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const pdfParse: any = require('pdf-parse/lib/pdf-parse.js');
    const result = await pdfParse(buffer);
    return (result.text || '').trim();
  } catch (err) {
    console.error('[issueDocumentIngestion] PDF parse failed:', (err as Error).message);
    return '';
  }
}

async function extractDocxText(buffer: Buffer): Promise<string> {
  try {
    const result = await mammoth.extractRawText({ buffer });
    return (result.value || '').trim();
  } catch {
    return '';
  }
}

async function extractXlsxText(buffer: Buffer): Promise<string> {
  try {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as any);
    const chunks: string[] = [];
    wb.worksheets.forEach((ws) => {
      chunks.push(`### Sheet: ${ws.name}`);
      ws.eachRow({ includeEmpty: false }, (row) => {
        const values = Array.isArray(row.values) ? row.values.slice(1) : [];
        chunks.push(values.map((v) => (v == null ? '' : String(v))).join(' | '));
      });
    });
    return chunks.join('\n').trim();
  } catch {
    return '';
  }
}

// ─── Lookup data loading ───────────────────────────────────────────────────
interface WeekLookup {
  weekNumber: number;
  label: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
}
interface LookupTables {
  departments: { id: string; name: string }[];
  areas: { id: string; name: string; departmentId: string | null }[];
  lines: { id: string; name: string; lineNumber: string | null; areaId: string }[];
  shifts: { id: string; name: string; startTime: string; endTime: string }[];
  equipment: { id: string; name: string; assetTag: string | null; lineId: string }[];
  components: { id: string; name: string; partNumber: string | null; equipmentId: string }[];
  daysOfWeek: { id: string; dayName: string; dayOrder: number }[];
  weeks: WeekLookup[];
}

async function loadLookupTables(organizationId: string | null): Promise<LookupTables> {
  const departmentWhere = organizationId ? { Facility: { organizationId } } : {};
  const dayWhere = organizationId ? { organizationId } : {};
  const [departments, areas, lines, shifts, equipment, components, daysOfWeek, org, dbWeeks] = await Promise.all([
    prisma.department.findMany({ where: departmentWhere as any, select: { id: true, name: true } }),
    prisma.area.findMany({ select: { id: true, name: true, departmentId: true } }),
    prisma.line.findMany({ select: { id: true, name: true, lineNumber: true, areaId: true } }),
    prisma.shift.findMany({ select: { id: true, name: true, startTime: true, endTime: true } }),
    prisma.equipment.findMany({ select: { id: true, name: true, assetTag: true, lineId: true } }),
    prisma.equipmentComponent.findMany({ select: { id: true, name: true, partNumber: true, equipmentId: true } }),
    prisma.dayOfWeek.findMany({ where: dayWhere as any, select: { id: true, dayName: true, dayOrder: true }, orderBy: { dayOrder: 'asc' } }),
    organizationId
      ? prisma.organization.findUnique({ where: { id: organizationId }, select: { calendarYearStartMonth: true, calendarYearStartDay: true } })
      : Promise.resolve(null),
    organizationId
      ? (async () => {
          const o = await prisma.organization.findUnique({ where: { id: organizationId }, select: { calendarYearStartMonth: true, calendarYearStartDay: true } });
          const startMonth = o?.calendarYearStartMonth || 1;
          const startDay = o?.calendarYearStartDay || 1;
          const now = new Date();
          let yearStart = new Date(now.getFullYear(), startMonth - 1, startDay);
          if (yearStart > now) yearStart = new Date(now.getFullYear() - 1, startMonth - 1, startDay);
          return prisma.bakeryWeeklySheet.findMany({
            where: { isActive: true, weekStart: { gte: yearStart } },
            orderBy: { weekStart: 'asc' },
            select: { sheetName: true, weekStart: true, weekEnd: true },
          });
        })()
      : Promise.resolve([] as any[]),
  ]);
  void org;
  const weeks: WeekLookup[] = (dbWeeks as any[]).map((w, index) => ({
    weekNumber: index + 1,
    label: w.sheetName,
    startDate: new Date(w.weekStart).toISOString().slice(0, 10),
    endDate: new Date(w.weekEnd).toISOString().slice(0, 10),
  }));
  return { departments, areas, lines, shifts, equipment, components, daysOfWeek, weeks };
}

// ─── Fuzzy post-processing ─────────────────────────────────────────────────
function norm(s: string | null | undefined): string {
  return (s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function fuzzyFindId<T extends { id: string; name: string }>(rows: T[], needle: string | null | undefined): T | null {
  if (!needle) return null;
  const n = norm(needle);
  if (!n) return null;
  const exact = rows.find((r) => norm(r.name) === n);
  if (exact) return exact;
  const partial = rows.find((r) => norm(r.name).includes(n) || n.includes(norm(r.name)));
  return partial || null;
}

// ─── Date helpers ──────────────────────────────────────────────────────────
/** ISO-8601 week number (1-53) for a given date. */
function isoWeekNumber(d: Date): number {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  // Thursday in current week decides the year
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/** ISO weekday Monday=1..Sunday=7 */
function isoWeekday(d: Date): number {
  const wd = d.getUTCDay();
  return wd === 0 ? 7 : wd;
}

/** Convert ISO weekday (1..7, Mon..Sun) to dayName used in DB. */
function weekdayToDayName(wd: number): string {
  return ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][wd - 1] || '';
}

/**
 * Best-effort parse of a date token from a document. Accepts:
 *   - 2026-04-17 / 2026/04/17
 *   - 04/17/2026, 4/17/26, 04-17-2026
 *   - 04/17 (assumes current year)
 *   - 17 April 2026, April 17, 2026, Apr 17
 * Returns null if nothing looks like a valid date.
 */
function parseDocumentDate(input: string | null | undefined, today: Date): Date | null {
  if (!input) return null;
  const s = String(input).trim();
  if (!s) return null;
  const year = today.getUTCFullYear();

  // ISO-ish: YYYY-MM-DD or YYYY/MM/DD
  let m = s.match(/\b(\d{4})[-/](\d{1,2})[-/](\d{1,2})\b/);
  if (m) {
    const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    return isNaN(d.getTime()) ? null : d;
  }

  // US-style with year: MM/DD/YYYY or MM-DD-YYYY (also 2-digit year)
  m = s.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b/);
  if (m) {
    let yy = +m[3];
    if (yy < 100) yy += yy >= 70 ? 1900 : 2000;
    const d = new Date(Date.UTC(yy, +m[1] - 1, +m[2]));
    return isNaN(d.getTime()) ? null : d;
  }

  // MM/DD with no year → assume current year
  m = s.match(/\b(\d{1,2})[/-](\d{1,2})\b/);
  if (m) {
    const d = new Date(Date.UTC(year, +m[1] - 1, +m[2]));
    return isNaN(d.getTime()) ? null : d;
  }

  // "April 17, 2026" / "Apr 17 2026" / "17 April 2026" / "April 17"
  const months = ['january','february','march','april','may','june','july','august','september','october','november','december'];
  const mo = s.toLowerCase().match(/\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:[ ,]+(\d{2,4}))?/);
  if (mo) {
    const monIdx = months.findIndex((mm) => mm.startsWith(mo[1].slice(0, 3)));
    if (monIdx >= 0) {
      let yy = mo[3] ? +mo[3] : year;
      if (yy < 100) yy += yy >= 70 ? 1900 : 2000;
      const d = new Date(Date.UTC(yy, monIdx, +mo[2]));
      return isNaN(d.getTime()) ? null : d;
    }
  }
  const mo2 = s.toLowerCase().match(/\b(\d{1,2})\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)(?:[ ,]+(\d{2,4}))?/);
  if (mo2) {
    const monIdx = months.findIndex((mm) => mm.startsWith(mo2[2].slice(0, 3)));
    if (monIdx >= 0) {
      let yy = mo2[3] ? +mo2[3] : year;
      if (yy < 100) yy += yy >= 70 ? 1900 : 2000;
      const d = new Date(Date.UTC(yy, monIdx, +mo2[1]));
      return isNaN(d.getTime()) ? null : d;
    }
  }
  return null;
}

// ─── Prompt construction ───────────────────────────────────────────────────
function buildPrompt(docText: string, lookups: LookupTables): string {
  const dump = (rows: { id: string; name: string }[], extra?: (r: any) => string) =>
    rows
      .slice(0, 200)
      .map((r) => `- id=${r.id} name="${r.name}"${extra ? ' ' + extra(r) : ''}`)
      .join('\n') || '(none)';

  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);
  const todayYear = today.getUTCFullYear();
  const todayWeek = isoWeekNumber(today);
  const todayDayName = weekdayToDayName(isoWeekday(today));

  return `You are an expert manufacturing operations assistant. Read the attached document and extract ONE OR MORE distinct issue reports. Each issue is typically tied to a specific equipment breakdown or quality defect with its OWN downtime (minutes lost) and must become a SEPARATE row in the database.

=== TODAY ===
Date: ${todayIso} (ISO). Year: ${todayYear}. ISO week: ${todayWeek}. Day: ${todayDayName}.
Use this ONLY as a fallback when the document omits a year or is ambiguous — NEVER as a replacement for a date that actually appears in the document.

=== DOCUMENT CONTENT ===
${docText.slice(0, 20000)}

=== LOOKUP TABLES (pick IDs ONLY from these lists) ===

Departments:
${dump(lookups.departments)}

Areas (scoped to Departments):
${dump(lookups.areas, (r) => `departmentId=${r.departmentId ?? 'null'}`)}

Lines (scoped to Areas):
${dump(lookups.lines, (r) => `areaId=${r.areaId} lineNumber="${r.lineNumber ?? ''}"`)}

Shifts:
${dump(lookups.shifts, (r) => `start=${r.startTime} end=${r.endTime}`)}

Equipment (scoped to Lines):
${dump(lookups.equipment, (r) => `lineId=${r.lineId} assetTag="${r.assetTag ?? ''}"`)}

Components (scoped to Equipment):
${dump(lookups.components, (r) => `equipmentId=${r.equipmentId} partNumber="${r.partNumber ?? ''}"`)}

Days of Week:
${dump(lookups.daysOfWeek)}

Weeks (pick weekNumber whose date range CONTAINS the document date):
${lookups.weeks.length
  ? lookups.weeks.map((w) => `- weekNumber=${w.weekNumber} start=${w.startDate} end=${w.endDate} label="${w.label}"`).join('\n')
  : '(none — return null for weekNumber)'}

=== RULES ===
1. Return a "context" object with the SHARED fields that apply to ALL issues in the document (departmentId, areaId, lineId, shiftId, weekNumber, dayOfWeekId). If the document describes different departments/lines for different issues, pick the most common one for context and note the variance in top-level "notes".
2. Return an "issues" array. Each entry is a DISTINCT incident with its own equipment/component/start time/minutes lost. Split the document into multiple issues whenever you see separate downtime events, different root causes, or different equipment failures. Do NOT merge unrelated incidents into one.
3. For each issue, write a concise professional "title" (<= 90 chars) and a clean "description" (2-4 sentences) capturing what happened, on what equipment/component, and any root-cause clues.
4. Pick priority from LOW/MEDIUM/HIGH/CRITICAL based on severity cues (minutes lost, words like "critical/urgent/down/stopped", safety implications).
5. Match lookups to the BEST matching ID. Respect the hierarchy (area.departmentId, line.areaId, equipment.lineId, component.equipmentId). If uncertain, return null — do NOT guess.
6. Parse each startTime as "HH:MM" (24-hour). Parse totalMinutesLost as an integer.
7. DATES, WEEKS AND DAYS — BE SMART, DO NOT ASSUME:
   a. Scan the document for ANY date: headers, footers, "Date:", "Report for:", meeting dates, shift dates, timestamps on photos, file-name dates, etc. Accept ALL common formats: 2026-04-17, 04/17/2026, 4/17/26, 04-17-2026, 17 Apr 2026, April 17 2026, and short forms like 04/17 or 4/17 where the year is missing.
   b. If the year is missing, assume TODAY's year (${todayYear}). If the resulting date would be more than 60 days in the future, step back one year instead.
   c. Put the detected date in context.documentDate as "YYYY-MM-DD". If several dates appear, pick the one most clearly tied to when the reported incidents happened (not a print-date or revision-date).
   d. WEEK MATCHING — VERY IMPORTANT: Look at the "Weeks" lookup list above. Each entry has a concrete start and end date. Pick the weekNumber whose [start..end] range CONTAINS the document date (inclusive). DO NOT use the ISO-8601 week number and DO NOT guess based on the month. If the document date falls outside every listed range, set weekNumber to null and explain in "notes".
   e. Compute the weekday name (Monday..Sunday) from the document date and pick the matching "dayOfWeekId" from the Days of Week lookup. Put the day name in resolved.dayName.
   f. Only leave weekNumber / dayOfWeekId null if NO date of any kind can be found anywhere in the document, or the date is outside every listed week range.
   g. If the document explicitly states a week (e.g. "Week 16"), cross-check it against the date you found. If they disagree, TRUST THE DATE and mention the mismatch in "notes".
8. Return a "resolved" object for context (departmentName/areaName/lineName/shiftName/dayName) and one per issue (equipmentName/componentName) so the UI can display friendly labels.
9. Include a top-level "confidence" between 0 and 1.
10. "notes" is a short, natural, human-sounding HEADS-UP for the person reviewing the extraction. Write it ONLY when it genuinely helps — otherwise return null. Good uses: flagging a missing/assumed year, a date that doesn't match the stated week, an ambiguous department, a field you had to guess, or a suggestion to double-check something specific. Bad uses: repeating what's already visible in the form, restating defaults, generic disclaimers. Keep it to one or two sentences in plain simple English, speak directly to the user (e.g. "Heads up — the document only shows 04/17, so I assumed this year. Please confirm the year is right.").

Respond with STRICT JSON ONLY using this exact shape:
{
  "context": {
    "departmentId": string | null,
    "areaId": string | null,
    "lineId": string | null,
    "shiftId": string | null,
    "weekNumber": number | null,
    "dayOfWeekId": string | null,
    "documentDate": string | null,
    "resolved": {
      "departmentName": string | null,
      "areaName": string | null,
      "lineName": string | null,
      "shiftName": string | null,
      "dayName": string | null
    }
  },
  "issues": [
    {
      "type": "MACHINE" | "QUALITY" | null,
      "title": string | null,
      "description": string | null,
      "priority": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | null,
      "equipmentId": string | null,
      "componentId": string | null,
      "startTime": string | null,
      "totalMinutesLost": number | null,
      "resolved": {
        "equipmentName": string | null,
        "componentName": string | null
      }
    }
  ],
  "notes": string | null,
  "confidence": number | null
}`;
}

// ─── Main entry point ──────────────────────────────────────────────────────
export async function extractIssuesFromDocument(params: {
  buffer: Buffer;
  mimetype: string;
  originalName: string;
  organizationId: string | null;
}): Promise<{ success: boolean; data?: ExtractionResult; rawText?: string; error?: string }> {
  const client = getOpenAI();
  if (!client) {
    return { success: false, error: 'AI service is not configured. Contact your administrator.' };
  }

  const kind = detectKind(params.mimetype, params.originalName);
  if (kind === 'unknown') {
    return { success: false, error: 'Unsupported file type. Use JPEG, PNG, PDF, DOCX or XLSX.' };
  }

  let docText = '';
  let imageBase64: string | null = null;
  let imageMime = params.mimetype;

  if (kind === 'image') {
    imageBase64 = params.buffer.toString('base64');
    if (!imageMime.startsWith('image/')) imageMime = 'image/png';
  } else if (kind === 'pdf') {
    docText = await extractPdfText(params.buffer);
    if (!docText) {
      return { success: false, error: 'Could not extract text from this PDF. If it is a scanned document, please upload it as an image instead.' };
    }
  } else if (kind === 'docx') {
    docText = await extractDocxText(params.buffer);
    if (!docText) return { success: false, error: 'Could not read this DOCX file.' };
  } else if (kind === 'xlsx') {
    docText = await extractXlsxText(params.buffer);
    if (!docText) return { success: false, error: 'Could not read this XLSX file.' };
  }

  const lookups = await loadLookupTables(params.organizationId);
  const model = process.env.AI_MODEL || 'gpt-4o';
  const systemMsg = 'You are a meticulous manufacturing operations data-extraction assistant. You ONLY return valid JSON.';

  let response;
  try {
    if (kind === 'image' && imageBase64) {
      const textPart = buildPrompt('(see attached image for document content)', lookups);
      response = await client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: systemMsg },
          {
            role: 'user',
            content: [
              { type: 'text', text: textPart },
              { type: 'image_url', image_url: { url: `data:${imageMime};base64,${imageBase64}` } },
            ] as any,
          },
        ],
        temperature: 0.15,
        max_tokens: 4000,
        response_format: { type: 'json_object' },
      });
    } else {
      response = await client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: systemMsg },
          { role: 'user', content: buildPrompt(docText, lookups) },
        ],
        temperature: 0.15,
        max_tokens: 4000,
        response_format: { type: 'json_object' },
      });
    }
  } catch (err: any) {
    return { success: false, error: `AI extraction failed: ${err?.message || 'unknown error'}` };
  }

  const content = response.choices?.[0]?.message?.content;
  if (!content) return { success: false, error: 'AI returned empty response.' };

  let parsed: ExtractionResult;
  try {
    parsed = JSON.parse(content);
  } catch {
    return { success: false, error: 'AI returned invalid JSON.' };
  }

  // Shape safety
  if (!parsed.context) {
    parsed.context = { departmentId: null, areaId: null, lineId: null, shiftId: null, weekNumber: null, dayOfWeekId: null, resolved: {} };
  }
  if (!Array.isArray(parsed.issues)) parsed.issues = [];

  // Fuzzy fill for context
  const ctx = parsed.context;
  if (!ctx.resolved) ctx.resolved = {};
  const tryFillCtx = (field: keyof SharedContext, nameField: string, rows: { id: string; name: string }[]) => {
    if ((ctx as any)[field]) return;
    const nameGuess = (ctx.resolved as any)?.[nameField];
    const found = fuzzyFindId(rows, nameGuess);
    if (found) {
      (ctx as any)[field] = found.id;
      (ctx.resolved as any)[nameField] = found.name;
    }
  };
  tryFillCtx('departmentId', 'departmentName', lookups.departments);
  tryFillCtx('areaId', 'areaName', lookups.areas);
  tryFillCtx('lineId', 'lineName', lookups.lines);
  tryFillCtx('shiftId', 'shiftName', lookups.shifts);

  // Safety net: derive week + day-of-week AUTHORITATIVELY from the document
  // date. The AI's weekNumber is often wrong (it tends to emit ISO week), so
  // whenever we have a concrete date, we overwrite with a date-range match.
  const today = new Date();
  let derivedDate: Date | null = parseDocumentDate((ctx as any).documentDate, today);
  if (!derivedDate && docText) {
    const scan = docText.slice(0, 4000);
    const candidates = scan.match(/\b\d{4}[-/]\d{1,2}[-/]\d{1,2}\b|\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b|\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2}(?:[ ,]+\d{2,4})?\b/gi) || [];
    for (const c of candidates) {
      derivedDate = parseDocumentDate(c, today);
      if (derivedDate) break;
    }
  }
  if (derivedDate) {
    (ctx as any).documentDate = derivedDate.toISOString().slice(0, 10);

    // Day-of-week — derive from date, overwrite AI guess
    const dayName = weekdayToDayName(isoWeekday(derivedDate));
    const dayMatch = lookups.daysOfWeek.find((d) => d.dayName.toLowerCase() === dayName.toLowerCase());
    if (dayMatch) {
      ctx.dayOfWeekId = dayMatch.id;
      if (ctx.resolved) ctx.resolved.dayName = dayMatch.dayName;
    }

    // Week — match against org-defined week date ranges
    if (lookups.weeks.length > 0) {
      const dateStr = derivedDate.toISOString().slice(0, 10);
      const weekMatch = lookups.weeks.find((w) => dateStr >= w.startDate && dateStr <= w.endDate);
      if (weekMatch) {
        ctx.weekNumber = weekMatch.weekNumber;
      } else {
        // Document date is outside every configured week — clear any AI guess
        // so the UI doesn't show a misleading selection.
        ctx.weekNumber = null;
      }
    }
  }

  // Per-issue defaults + fuzzy fill
  for (const it of parsed.issues) {
    if (!it.type) it.type = 'MACHINE';
    if (!it.priority) it.priority = 'MEDIUM';
    if (!it.resolved) it.resolved = {};
    if (!it.equipmentId) {
      const found = fuzzyFindId(lookups.equipment, it.resolved.equipmentName);
      if (found) {
        it.equipmentId = found.id;
        it.resolved.equipmentName = found.name;
      }
    }
    if (!it.componentId) {
      const found = fuzzyFindId(lookups.components, it.resolved.componentName);
      if (found) {
        it.componentId = found.id;
        it.resolved.componentName = found.name;
      }
    }
  }

  return { success: true, data: parsed, rawText: docText.slice(0, 2000) };
}
