import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  BorderStyle,
  ImageRun,
  TableLayoutType,
} from 'docx';
import { saveAs } from 'file-saver';

interface DocxOptions {
  actionType: string;
  documentData: Record<string, any>;
  sections: { id: string; title: string; content: string }[];
  docEdits: { sectionId: string; newContent: string }[];
  employee: { name?: string; role?: string; department?: string; employeeFileNo?: string } | null;
  caseNumber: string;
  department: string;
  location: string;
  incidentDate: Date;
  todayDate: Date;
  companyLogoUrl: string | null;
}

const B = { style: BorderStyle.SINGLE, size: 1, color: '000000' };
const PAGE_BORDERS = {
  pageBorderTop: { ...B, space: 10 },
  pageBorderBottom: { ...B, space: 10 },
  pageBorderLeft: { ...B, space: 10 },
  pageBorderRight: { ...B, space: 10 },
};
const FONT = 'Times New Roman';
const SZ = 22; // 11pt
const SZ_SM = 18; // 9pt

function dayOfWeek(dt: Date): string {
  return ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][dt.getDay()];
}

function fmt(v: any): string {
  if (!v) return '';
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return v.map(item => typeof item === 'object' ? (item.area ? `${item.area}: ${item.description || ''}` : item.section ? `${item.section}: ${item.relevance || ''}` : JSON.stringify(item)) : String(item)).join('\n');
  if (typeof v === 'object') return Object.entries(v).map(([k, val]) => `${k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}: ${typeof val === 'object' ? JSON.stringify(val) : val}`).join('\n');
  return String(v);
}

async function fetchLogoImageData(url: string): Promise<{ data: ArrayBuffer; width: number; height: number } | null> {
  try {
    if (url.startsWith('data:')) {
      const base64 = url.split(',')[1];
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes]);
      const data = await blob.arrayBuffer();
      const img = new Image();
      const dims = await new Promise<{ width: number; height: number }>((resolve) => {
        img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
        img.onerror = () => resolve({ width: 150, height: 60 });
        img.src = url;
      });
      return { data, ...dims };
    }
    const response = await fetch(url);
    const data = await response.arrayBuffer();
    return { data, width: 150, height: 60 };
  } catch { return null; }
}

/** Small table for multi-column rows (employee info, signatures) */
function gridTable(rowDefs: { width: number; content: Paragraph[] }[][]): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    rows: rowDefs.map(cells => new TableRow({
      children: cells.map(c => new TableCell({
        borders: { top: B, bottom: B, left: B, right: B },
        width: { size: c.width, type: WidthType.PERCENTAGE },
        children: c.content,
      })),
    })),
  });
}

/** Section header paragraph — bold label with top border separator */
function hdr(runs: TextRun[], alignment: (typeof AlignmentType)[keyof typeof AlignmentType] = AlignmentType.LEFT): Paragraph {
  return new Paragraph({ alignment, spacing: { before: 100, after: 40 }, border: { top: B }, children: runs });
}

/** Body text paragraph */
function p(runs: TextRun[], alignment: (typeof AlignmentType)[keyof typeof AlignmentType] = AlignmentType.LEFT, spacing?: { before?: number; after?: number }): Paragraph {
  return new Paragraph({ alignment, spacing: spacing || { before: 20, after: 20 }, children: runs });
}

function t(text: string, opts?: { bold?: boolean; italic?: boolean; underline?: boolean; size?: number; color?: string }): TextRun {
  return new TextRun({
    text,
    font: FONT,
    size: opts?.size || SZ,
    bold: opts?.bold,
    italics: opts?.italic,
    underline: opts?.underline ? {} : undefined,
    color: opts?.color,
  });
}

/** Horizontal divider line */
function hr(): Paragraph {
  return new Paragraph({ spacing: { before: 40, after: 40 }, border: { bottom: B } });
}

// ─── WARNING NOTICE ──────────────────────────────────────────

async function generateWarningDocx(opts: DocxOptions, logoImage: Awaited<ReturnType<typeof fetchLogoImageData>>): Promise<Document> {
  const { documentData: d, employee, incidentDate, todayDate, sections, docEdits } = opts;
  const empName = d.employeeNames?.join(', ') || employee?.name || '—';
  const warningLevel = (d.warningLevel || '').toLowerCase();

  const children: (Paragraph | Table)[] = [];

  // ── Logo ──
  if (logoImage) {
    const scale = Math.min(200 / logoImage.width, 90 / logoImage.height, 1);
    children.push(p([new ImageRun({ data: logoImage.data, transformation: { width: Math.round(logoImage.width * scale), height: Math.round(logoImage.height * scale) }, type: 'jpg' })], AlignmentType.CENTER));
  }

  // ── Title ──
  children.push(p([t('WARNING NOTICE / AVISO DISCIPLINARIO', { bold: true, size: 26 })], AlignmentType.CENTER, { before: 40, after: 60 }));

  // ── Intention ──
  children.push(p([
    t('The intention of this action is to enable the employee to understand what is expected. It is meant to be a pro-active step to clarify a situation and avoid further occurrences. '),
    t('La intención de esta acción es hacerle entender al empleado lo que se espera de él/ella. Esta acción es un paso pro-activo para clarificar situaciones y evitar ocurrencias futuras.', { italic: true }),
  ], AlignmentType.LEFT, { before: 20, after: 40 }));
  children.push(hr());

  // ── Date ──
  children.push(p([
    t("Today's Date: ", { bold: true }), t(todayDate.toLocaleDateString('en-US'), { underline: true }),
    t('  Day: ', { bold: true }), t(dayOfWeek(todayDate), { underline: true }),
    t('  Incident Date: ', { bold: true }), t(incidentDate.toLocaleDateString('en-US'), { underline: true }),
    t('  Day: ', { bold: true }), t(dayOfWeek(incidentDate), { underline: true }),
  ], AlignmentType.LEFT, { before: 40, after: 40 }));

  // ── Warning Type ──
  const types = ['Verbal', 'Written', 'Suspension', 'Termination', 'Other'];
  children.push(p(types.flatMap(typ => {
    const checked = warningLevel.includes(typ.toLowerCase());
    return [t(checked ? `${typ} xxx  ` : `${typ} ____  `, { bold: checked })];
  }), AlignmentType.LEFT, { before: 20, after: 40 }));

  // ── Employee Info ──
  children.push(gridTable([
    [
      { width: 50, content: [p([t('Name: '), t(empName.toUpperCase(), { bold: true })])] },
      { width: 50, content: [p([t('Prior Warnings: _______ (V,W,S)  _______ (V,W,S)')])] },
    ],
  ]));
  children.push(p([
    t('Title: '), t(employee?.role || 'N/A', { bold: true }),
    t('          Dept: '), t(employee?.department || opts.department || 'N/A', { underline: true }),
    t('          File No. '), t(employee?.employeeFileNo || '________', { underline: true }),
  ], AlignmentType.LEFT, { before: 40, after: 40 }));

  // ── Content Sections ──
  const getContent = (sectionId: string, fallback: string) => {
    const edit = docEdits.find(e => e.sectionId === sectionId);
    return edit ? edit.newContent : fallback;
  };

  const rulesContent = getContent('policyViolated', fmt(d.companyRulesViolated || d.policyViolations || ''));
  if (rulesContent) {
    children.push(hdr([t('Company rules violated / ', { bold: true }), t('Reglas violadas', { italic: true })]));
    rulesContent.split('\n').forEach(line => children.push(p([t(line)])));
  }

  const detailContent = getContent('description', fmt(d.describeInDetail || d.incidentDescription || ''));
  if (detailContent) {
    children.push(hdr([t('Describe in detail / ', { bold: true }), t('Describa en detalle lo ocurrido', { italic: true })]));
    detailContent.split('\n').forEach(line => children.push(p([t(line)])));
  }

  const conductContent = getContent('conductDeficiency', fmt(d.conductDeficiency || ''));
  if (conductContent) {
    children.push(hdr([t('Violación de la política:', { bold: true })]));
    conductContent.split('\n').forEach(line => children.push(p([t(line)])));
  }

  const consequencesContent = getContent('consequences', fmt(d.consequencesOfNotPerforming || d.consequences || ''));
  if (consequencesContent) {
    children.push(hdr([t('Consecuencias:', { bold: true })]));
    consequencesContent.split('\n').forEach(line => children.push(p([t(line)])));
  }

  const correctiveContent = getContent('correctiveAction', fmt(d.requiredCorrectiveAction || d.improvementRequired || ''));
  if (correctiveContent) {
    children.push(hdr([t('Acción Correctiva:', { bold: true })]));
    correctiveContent.split('\n').forEach(line => children.push(p([t(line)])));
  }

  // ── Dynamic sections ──
  const knownKeys = new Set([
    'companyRulesViolated','policyViolations','describeInDetail','incidentDescription',
    'conductDeficiency','consequencesOfNotPerforming','consequences','requiredCorrectiveAction',
    'improvementRequired','warningLevel','priorActions','employeeNames','title','documentDate',
    'reviewDate','signatureSection',
    'description','policyViolated','correctiveAction','correctiveActionRequired',
  ]);
  for (const section of sections) {
    if (knownKeys.has(section.id)) continue;
    const content = docEdits.find(e => e.sectionId === section.id)?.newContent || section.content;
    if (!content) continue;
    children.push(hdr([t(`${section.title}:`, { bold: true })]));
    content.split('\n').forEach(line => children.push(p([t(line)])));
  }

  children.push(hr());

  // ── Signatures ──
  children.push(gridTable([
    [
      { width: 25, content: [p([t('____________________')], AlignmentType.LEFT, { before: 80 }), p([t('Supervisor', { size: SZ_SM })])] },
      { width: 25, content: [p([t('____________')], AlignmentType.LEFT, { before: 80 }), p([t('Date', { size: SZ_SM })])] },
      { width: 25, content: [p([t('____________________')], AlignmentType.LEFT, { before: 80 }), p([t('Manager', { size: SZ_SM })])] },
      { width: 25, content: [p([t('____________')], AlignmentType.LEFT, { before: 80 }), p([t('Date', { size: SZ_SM })])] },
    ],
    [
      { width: 25, content: [p([t('____________________')], AlignmentType.LEFT, { before: 80 }), p([t('H.R. Department', { size: SZ_SM })])] },
      { width: 25, content: [p([t('____________')], AlignmentType.LEFT, { before: 80 }), p([t('Date', { size: SZ_SM })])] },
      { width: 25, content: [p([t('____________________')], AlignmentType.LEFT, { before: 80 }), p([t('Employee Signature', { size: SZ_SM })])] },
      { width: 25, content: [p([t('____________')], AlignmentType.LEFT, { before: 80 }), p([t('Date', { size: SZ_SM })])] },
    ],
  ]));

  // ── Certification ──
  children.push(p([
    t('I, the undersigned, hereby certify that the situation has been explained to me. I understand the consequences if the infraction is not remedied. I certify that I have received a copy of this notice. ', { bold: true }),
    t('Yo doy a conocer que se me ha explicado la situación presente. Yo entiendo las consecuencias futuras si no cumplo con las reglas. Yo certifico que he recibido una copia de este documento siempre y cuando la firme.', { italic: true }),
  ], AlignmentType.LEFT, { before: 60, after: 40 }));

  return new Document({
    sections: [{ properties: { page: { margin: { top: 400, right: 500, bottom: 400, left: 500 }, borders: PAGE_BORDERS } }, children }],
  });
}

// ─── COUNSELING ──────────────────────────────────────────────

async function generateCounselingDocx(opts: DocxOptions, logoImage: Awaited<ReturnType<typeof fetchLogoImageData>>): Promise<Document> {
  const { documentData: d, sections, docEdits, employee, caseNumber, incidentDate, todayDate } = opts;
  const empName = d.employeeNames?.join(', ') || employee?.name || '—';
  const children: (Paragraph | Table)[] = [];

  if (logoImage) {
    const scale = Math.min(200 / logoImage.width, 90 / logoImage.height, 1);
    children.push(p([new ImageRun({ data: logoImage.data, transformation: { width: Math.round(logoImage.width * scale), height: Math.round(logoImage.height * scale) }, type: 'jpg' })], AlignmentType.CENTER));
  }

  children.push(p([t('DOCUMENTED COUNSELING', { bold: true, size: 26 })], AlignmentType.CENTER, { before: 40, after: 20 }));
  children.push(p([t('CONSEJERÍA DOCUMENTADA', { italic: true, color: '666666' })], AlignmentType.CENTER, { after: 40 }));
  children.push(p([t('This document serves as a formal record of a counseling discussion regarding workplace conduct, performance, or policy compliance.')], AlignmentType.LEFT, { after: 40 }));
  children.push(p([
    t('Date: ', { bold: true }), t(todayDate.toLocaleDateString('en-US'), { underline: true }),
    t('   Case: ', { bold: true }), t(caseNumber, { underline: true }),
    t('   Incident: ', { bold: true }), t(incidentDate.toLocaleDateString('en-US'), { underline: true }),
  ], AlignmentType.LEFT, { before: 20, after: 40 }));

  children.push(gridTable([
    [
      { width: 50, content: [p([t('Name: '), t(empName, { bold: true })])] },
      { width: 50, content: [p([t('Employee ID: '), t(employee?.employeeFileNo || 'N/A', { bold: true })])] },
    ],
    [
      { width: 50, content: [p([t('Position: '), t(employee?.role || 'N/A', { bold: true })])] },
      { width: 50, content: [p([t('Department: '), t(employee?.department || opts.department || 'N/A', { bold: true })])] },
    ],
  ]));

  for (const section of sections) {
    const content = docEdits.find(e => e.sectionId === section.id)?.newContent || section.content;
    children.push(hdr([t(`${section.title}:`, { bold: true })]));
    content.split('\n').forEach(line => children.push(p([t(line)])));
  }

  children.push(hr());
  children.push(p([
    t('Employee Acknowledgment: ', { bold: true }),
    t('I acknowledge that I have received and reviewed this documented counseling. My signature indicates that I understand the expectations described above.'),
  ], AlignmentType.LEFT, { before: 40, after: 40 }));

  children.push(gridTable(
    ['Employee', 'Supervisor', 'Manager'].map(role => [
      { width: 50, content: [p([t('____________________')], AlignmentType.LEFT, { before: 80 }), p([t(role, { size: SZ_SM })])] },
      { width: 50, content: [p([t('____________')], AlignmentType.LEFT, { before: 80 }), p([t('Date', { size: SZ_SM })])] },
    ])
  ));

  return new Document({ sections: [{ properties: { page: { margin: { top: 400, right: 500, bottom: 400, left: 500 }, borders: PAGE_BORDERS } }, children }] });
}

// ─── COACHING ────────────────────────────────────────────────

async function generateCoachingDocx(opts: DocxOptions, logoImage: Awaited<ReturnType<typeof fetchLogoImageData>>): Promise<Document> {
  const { documentData: d, sections, docEdits, employee, caseNumber, todayDate } = opts;
  const empName = d.employeeNames?.join(', ') || employee?.name || '—';
  const children: (Paragraph | Table)[] = [];

  if (logoImage) {
    const scale = Math.min(200 / logoImage.width, 90 / logoImage.height, 1);
    children.push(p([new ImageRun({ data: logoImage.data, transformation: { width: Math.round(logoImage.width * scale), height: Math.round(logoImage.height * scale) }, type: 'jpg' })], AlignmentType.CENTER));
  }

  children.push(p([t('COACHING SESSION GUIDE', { bold: true, size: 26 })], AlignmentType.CENTER, { before: 40, after: 20 }));
  children.push(p([t('GUÍA DE SESIÓN DE COACHING', { italic: true, color: '666666' })], AlignmentType.CENTER, { after: 40 }));
  children.push(p([t('This coaching session guide is designed to support a constructive conversation focused on growth, development, and maintaining positive workplace standards.')], AlignmentType.LEFT, { after: 40 }));
  children.push(p([
    t('Date: ', { bold: true }), t(todayDate.toLocaleDateString('en-US'), { underline: true }),
    t('   Case: ', { bold: true }), t(caseNumber, { underline: true }),
  ], AlignmentType.LEFT, { before: 20, after: 40 }));

  children.push(gridTable([[
    { width: 25, content: [p([t('Name: '), t(empName, { bold: true })])] },
    { width: 25, content: [p([t('File No: '), t(employee?.employeeFileNo || 'N/A', { bold: true })])] },
    { width: 25, content: [p([t('Position: '), t(employee?.role || 'N/A', { bold: true })])] },
    { width: 25, content: [p([t('Dept: '), t(employee?.department || opts.department || 'N/A', { bold: true })])] },
  ]]));

  for (const section of sections) {
    const content = docEdits.find(e => e.sectionId === section.id)?.newContent || section.content;
    children.push(hdr([t(`${section.title}:`, { bold: true })]));
    content.split('\n').forEach(line => children.push(p([t(line)])));
  }

  children.push(p([t('Session Notes: ___________________________________________________________________________')], AlignmentType.LEFT, { before: 60 }));

  children.push(gridTable(
    ['Supervisor', 'Employee'].map(role => [
      { width: 50, content: [p([t('____________________')], AlignmentType.LEFT, { before: 80 }), p([t(role, { size: SZ_SM })])] },
      { width: 50, content: [p([t('____________')], AlignmentType.LEFT, { before: 80 }), p([t('Date', { size: SZ_SM })])] },
    ])
  ));

  return new Document({ sections: [{ properties: { page: { margin: { top: 400, right: 500, bottom: 400, left: 500 }, borders: PAGE_BORDERS } }, children }] });
}

// ─── ESCALATION ──────────────────────────────────────────────

async function generateEscalationDocx(opts: DocxOptions, logoImage: Awaited<ReturnType<typeof fetchLogoImageData>>): Promise<Document> {
  const { documentData: d, sections, docEdits, todayDate } = opts;
  const children: (Paragraph | Table)[] = [];

  if (logoImage) {
    const scale = Math.min(200 / logoImage.width, 90 / logoImage.height, 1);
    children.push(p([new ImageRun({ data: logoImage.data, transformation: { width: Math.round(logoImage.width * scale), height: Math.round(logoImage.height * scale) }, type: 'jpg' })], AlignmentType.CENTER));
  }

  children.push(p([t('HR ESCALATION REQUEST', { bold: true, size: 26 })], AlignmentType.CENTER, { before: 40, after: 20 }));
  children.push(p([t('SOLICITUD DE ESCALACIÓN A RRHH', { italic: true, color: '666666' })], AlignmentType.CENTER, { after: 20 }));
  children.push(p([t('CONFIDENTIAL', { bold: true })], AlignmentType.CENTER, { after: 40 }));

  children.push(gridTable([
    [
      { width: 50, content: [p([t('Date Submitted: '), t(todayDate.toLocaleDateString('en-US'), { bold: true, underline: true })])] },
      { width: 50, content: [p([t('Submitted By: '), t(d.preparedBy || 'Supervisor', { bold: true, underline: true })])] },
    ],
    [
      { width: 50, content: [p([t('Department: '), t(opts.department || 'N/A', { bold: true, underline: true })])] },
      { width: 50, content: [p([t('Location: '), t(opts.location || 'N/A', { bold: true, underline: true })])] },
    ],
  ]));

  if (d.caseSummary) {
    children.push(hdr([t('Case Summary:', { bold: true })]));
    fmt(d.caseSummary).split('\n').forEach(line => children.push(p([t(line)])));
  }

  for (const section of sections.filter(s => s.id !== 'caseSummary')) {
    const content = docEdits.find(e => e.sectionId === section.id)?.newContent || section.content;
    children.push(hdr([t(`${section.title}:`, { bold: true })]));
    content.split('\n').forEach(line => children.push(p([t(line)])));
  }

  if (d.urgencyLevel) {
    const urgencyText = ['Standard', 'High', 'Critical']
      .map(lvl => `[${d.urgencyLevel?.toLowerCase().includes(lvl.toLowerCase()) ? 'X' : '  '}] ${lvl}`)
      .join('     ');
    children.push(p([t('Urgency: ', { bold: true }), t(urgencyText)], AlignmentType.LEFT, { before: 60 }));
  }

  children.push(hr());
  children.push(p([t('Approval:', { bold: true })], AlignmentType.LEFT, { before: 40 }));
  children.push(gridTable([[
    { width: 50, content: [p([t('____________________')], AlignmentType.LEFT, { before: 80 }), p([t('Supervisor Signature', { size: SZ_SM })])] },
    { width: 50, content: [p([t('____________')], AlignmentType.LEFT, { before: 80 }), p([t('Date', { size: SZ_SM })])] },
  ]]));

  children.push(hdr([t('HR Response:', { bold: true })]));
  children.push(p([t('Received By: __________________  Date Received: __________________  Priority: __________________')]));

  return new Document({ sections: [{ properties: { page: { margin: { top: 400, right: 500, bottom: 400, left: 500 }, borders: PAGE_BORDERS } }, children }] });
}

export async function downloadDocx(opts: DocxOptions): Promise<void> {
  const logoImage = opts.companyLogoUrl ? await fetchLogoImageData(opts.companyLogoUrl) : null;
  const at = opts.actionType.toLowerCase();

  let doc: Document;
  switch (at) {
    case 'warning':
      doc = await generateWarningDocx(opts, logoImage);
      break;
    case 'counseling':
      doc = await generateCounselingDocx(opts, logoImage);
      break;
    case 'coaching':
      doc = await generateCoachingDocx(opts, logoImage);
      break;
    case 'escalate':
      doc = await generateEscalationDocx(opts, logoImage);
      break;
    default:
      doc = await generateWarningDocx(opts, logoImage);
  }

  const typeLabels: Record<string, string> = {
    warning: 'Warning_Notice',
    counseling: 'Documented_Counseling',
    coaching: 'Coaching_Session',
    escalate: 'HR_Escalation',
  };

  const empName = (opts.documentData.employeeNames?.join('_') || opts.employee?.name || 'Employee').replace(/\s+/g, '_');
  const fileName = `${typeLabels[at] || 'Document'}_${empName}_${opts.caseNumber}.docx`;

  const blob = await Packer.toBlob(doc);
  saveAs(blob, fileName);
}
