// Case Investigation Report Generator
// Generates comprehensive, professionally branded case reports as DOCX documents
// Includes embedded signatures, original complaint images, color branding, and org/facility info

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
  TableLayoutType,
  PageBreak,
  Header,
  Footer,
  ImageRun,
  ShadingType,
} from 'docx';
import { saveAs } from 'file-saver';
import type { ConflictCase, ComparisonResult, PolicyMatchResult, RecommendationResult, AuditEntry } from './hrApi';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ReportTemplate = 'comprehensive' | 'executive' | 'summary' | 'hrReview' | 'legal';
export type ConfidentialityLevel = 'CONFIDENTIAL' | 'RESTRICTED' | 'INTERNAL_ONLY' | 'HR_ONLY';

export interface ReportConfig {
  template: ReportTemplate;
  confidentialityLevel: ConfidentialityLevel;
  preparedBy: string;
  preparedFor: string;
  includeExecutiveSummary: boolean;
  includeCaseDetails: boolean;
  includeInvolvedParties: boolean;
  includeDocumentSummary: boolean;
  includeAIAnalysis: boolean;
  includePolicyMatches: boolean;
  includeRecommendations: boolean;
  includeSelectedAction: boolean;
  includeAuditTrail: boolean;
  includeSignatureBlocks: boolean;
}

export function getDefaultConfig(template: ReportTemplate = 'comprehensive'): ReportConfig {
  const base: ReportConfig = {
    template,
    confidentialityLevel: 'CONFIDENTIAL',
    preparedBy: '',
    preparedFor: '',
    includeExecutiveSummary: true,
    includeCaseDetails: true,
    includeInvolvedParties: true,
    includeDocumentSummary: true,
    includeAIAnalysis: true,
    includePolicyMatches: true,
    includeRecommendations: true,
    includeSelectedAction: true,
    includeAuditTrail: true,
    includeSignatureBlocks: true,
  };

  switch (template) {
    case 'executive':
      return { ...base, template, includeDocumentSummary: false, includeAuditTrail: false, includeSignatureBlocks: false };
    case 'summary':
      return { ...base, template, includeDocumentSummary: false, includeAIAnalysis: false, includePolicyMatches: false, includeAuditTrail: false, includeSignatureBlocks: false };
    case 'hrReview':
      return { ...base, template, confidentialityLevel: 'HR_ONLY' };
    case 'legal':
      return { ...base, template, confidentialityLevel: 'RESTRICTED' };
    default:
      return base;
  }
}

// ─── Color Scheme ─────────────────────────────────────────────────────────────

const C = {
  navy: '1B3A5C',
  blue: '2B6CB0',
  gold: 'C6963C',
  lightBlue: 'DBEAFE',
  paleBlue: 'EFF6FF',
  white: 'FFFFFF',
  darkText: '1A202C',
  grayText: '4A5568',
  muted: '718096',
  border: 'CBD5E0',
  red: 'B91C1C',
  green: '166534',
  lightGray: 'F3F4F6',
};

const FONT = 'Calibri';
const FONT_HEADING = 'Cambria';
const SZ = 22;       // 11pt
const SZ_SM = 18;    // 9pt
const SZ_LABEL = 20; // 10pt

const B_THIN = { style: BorderStyle.SINGLE, size: 1, color: C.border };
const B_NONE = { style: BorderStyle.NONE, size: 0, color: C.white };
const CELL_BORDERS = { top: B_THIN, bottom: B_THIN, left: B_THIN, right: B_THIN };
const NO_BORDERS = { top: B_NONE, bottom: B_NONE, left: B_NONE, right: B_NONE };

// ─── Image Helpers ────────────────────────────────────────────────────────────

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const raw = base64.replace(/^data:[^;]+;base64,/, '');
  const binary = atob(raw);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function fetchImageData(url: string): Promise<{ data: ArrayBuffer; width: number; height: number } | null> {
  try {
    if (url.startsWith('data:')) {
      console.log('[fetchImageData] Processing data: URL, length:', url.length);
      const data = base64ToArrayBuffer(url);
      const img = new Image();
      const dims = await new Promise<{ width: number; height: number }>((resolve) => {
        img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
        img.onerror = () => { console.error('[fetchImageData] Image.onerror for data: URL'); resolve({ width: 150, height: 60 }); };
        img.src = url;
      });
      console.log('[fetchImageData] data: URL result:', dims.width, 'x', dims.height);
      return { data, ...dims };
    }
    // Plain base64 without data: prefix (signatures are PNG, document scans are JPEG)
    // JPEG base64 starts with /9j/, PNG with iVBOR — check for base64 content, not just URL patterns
    const isBase64 = !url.startsWith('http://') && !url.startsWith('https://') && url.length > 200;
    if (isBase64) {
      console.log('[fetchImageData] Processing plain base64, length:', url.length, 'starts with:', url.substring(0, 10));
      const data = base64ToArrayBuffer(url);
      console.log('[fetchImageData] ArrayBuffer created, byteLength:', data.byteLength);
      // Detect image type from base64 header bytes
      const isPng = url.startsWith('iVBOR'); // PNG magic bytes in base64
      const mimeType = isPng ? 'image/png' : 'image/jpeg';
      const dataUrl = `data:${mimeType};base64,${url}`;
      const img = new Image();
      const dims = await new Promise<{ width: number; height: number }>((resolve) => {
        img.onload = () => { console.log('[fetchImageData] Image loaded:', img.naturalWidth, 'x', img.naturalHeight); resolve({ width: img.naturalWidth, height: img.naturalHeight }); };
        img.onerror = (e) => { console.error('[fetchImageData] Image.onerror for base64, error:', e); resolve({ width: 400, height: 500 }); };
        img.src = dataUrl;
      });
      return { data, ...dims };
    }
    console.log('[fetchImageData] Fetching HTTP URL:', url.substring(0, 80));
    const response = await fetch(url);
    const data = await response.arrayBuffer();
    return { data, width: 300, height: 200 };
  } catch (err) {
    console.error('[fetchImageData] Exception:', err);
    return null;
  }
}

// ─── Formatting Helpers ───────────────────────────────────────────────────────

function sectionHeading(text: string, sectionNum?: string): Paragraph {
  const runs: TextRun[] = [];
  if (sectionNum) {
    runs.push(new TextRun({ text: sectionNum + '  ', bold: true, size: 28, font: FONT_HEADING, color: C.gold }));
  }
  runs.push(new TextRun({ text: text.toUpperCase(), bold: true, size: 28, font: FONT_HEADING, color: C.navy }));
  return new Paragraph({
    spacing: { before: 400, after: 120 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 3, color: C.blue, space: 6 } },
    children: runs,
  });
}

function subHeading(text: string): Paragraph {
  return new Paragraph({
    spacing: { before: 240, after: 100 },
    children: [new TextRun({ text, bold: true, size: 24, font: FONT, color: C.blue })],
  });
}

function para(text: string, opts?: { bold?: boolean; italic?: boolean; size?: number; color?: string }): Paragraph {
  return new Paragraph({
    spacing: { after: 80 },
    children: [new TextRun({
      text,
      font: FONT,
      size: opts?.size ?? SZ,
      bold: opts?.bold,
      italics: opts?.italic,
      color: opts?.color ?? C.darkText,
    })],
  });
}

function bullet(text: string, color?: string): Paragraph {
  return new Paragraph({
    spacing: { after: 60 },
    bullet: { level: 0 },
    children: [new TextRun({ text, font: FONT, size: SZ, color: color ?? C.darkText })],
  });
}

function spacer(h: number = 200): Paragraph {
  return new Paragraph({ spacing: { before: h }, children: [] });
}

function coloredDivider(): Paragraph {
  return new Paragraph({
    spacing: { before: 160, after: 160 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: C.gold, space: 0 } },
    children: [],
  });
}

function headerCell(text: string, width?: number): TableCell {
  return new TableCell({
    borders: CELL_BORDERS,
    shading: { fill: C.navy, type: ShadingType.CLEAR, color: 'auto' },
    width: width ? { size: width, type: WidthType.PERCENTAGE } : undefined,
    children: [new Paragraph({
      spacing: { before: 40, after: 40 },
      children: [new TextRun({ text, bold: true, font: FONT, size: SZ_LABEL, color: C.white })],
    })],
  });
}

function dataCell(text: string, opts?: { bold?: boolean; color?: string; size?: number; shading?: string }): TableCell {
  return new TableCell({
    borders: CELL_BORDERS,
    shading: opts?.shading ? { fill: opts.shading, type: ShadingType.CLEAR, color: 'auto' } : undefined,
    children: [new Paragraph({
      spacing: { before: 30, after: 30 },
      children: [new TextRun({
        text: text || '—',
        font: FONT,
        size: opts?.size ?? SZ_LABEL,
        bold: opts?.bold,
        color: opts?.color ?? C.darkText,
      })],
    })],
  });
}

function kvRow(label: string, value: string, isAlt: boolean = false): TableRow {
  return new TableRow({
    children: [
      new TableCell({
        borders: CELL_BORDERS,
        shading: { fill: C.paleBlue, type: ShadingType.CLEAR, color: 'auto' },
        width: { size: 30, type: WidthType.PERCENTAGE },
        children: [new Paragraph({
          spacing: { before: 30, after: 30 },
          children: [new TextRun({ text: label, bold: true, font: FONT, size: SZ_LABEL, color: C.navy })],
        })],
      }),
      new TableCell({
        borders: CELL_BORDERS,
        shading: isAlt ? { fill: C.lightGray, type: ShadingType.CLEAR, color: 'auto' } : undefined,
        width: { size: 70, type: WidthType.PERCENTAGE },
        children: [new Paragraph({
          spacing: { before: 30, after: 30 },
          children: [new TextRun({ text: value || '—', font: FONT, size: SZ_LABEL, color: C.darkText })],
        })],
      }),
    ],
  });
}

function kvTable(rows: [string, string][]): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    rows: rows.map(([l, v], i) => kvRow(l, v, i % 2 === 1)),
  });
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); }
  catch { return d; }
}

function fmtDateTime(d: string | null | undefined): string {
  if (!d) return '—';
  try { return new Date(d).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); }
  catch { return d; }
}

function getStatusLabel(s: string): string {
  const map: Record<string, string> = {
    DRAFT: 'Draft', IN_PROGRESS: 'In Progress', PENDING_REVIEW: 'Pending Review',
    AWAITING_ACTION: 'Awaiting Action', CLOSED: 'Closed', ESCALATED: 'Escalated',
  };
  return map[s] || s;
}

// ─── Cover Page ───────────────────────────────────────────────────────────────

async function buildCoverPage(caseData: ConflictCase, config: ReportConfig): Promise<(Paragraph | Table)[]> {
  const elements: (Paragraph | Table)[] = [];

  // Top colored bar
  elements.push(new Paragraph({
    spacing: { before: 0, after: 0 },
    shading: { fill: C.navy, type: ShadingType.CLEAR, color: 'auto' },
    children: [new TextRun({ text: ' ', size: 16, color: C.navy })],
  }));
  elements.push(new Paragraph({
    spacing: { before: 0, after: 0 },
    shading: { fill: C.gold, type: ShadingType.CLEAR, color: 'auto' },
    children: [new TextRun({ text: ' ', size: 8, color: C.gold })],
  }));

  // Logo
  if (caseData.companyLogoUrl) {
    const logoImg = await fetchImageData(caseData.companyLogoUrl);
    if (logoImg) {
      const scale = Math.min(220 / logoImg.width, 100 / logoImg.height, 1);
      elements.push(spacer(400));
      elements.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new ImageRun({
          data: logoImg.data,
          transformation: { width: Math.round(logoImg.width * scale), height: Math.round(logoImg.height * scale) },
          type: 'png',
        })],
      }));
      elements.push(spacer(200));
    } else {
      elements.push(spacer(600));
    }
  } else {
    elements.push(spacer(600));
  }

  // Organization name
  if (caseData.organization?.name) {
    elements.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
      children: [new TextRun({ text: caseData.organization.name.toUpperCase(), bold: true, size: 32, font: FONT_HEADING, color: C.navy })],
    }));
  }

  // Facility name
  if (caseData.facility?.name) {
    elements.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 160 },
      children: [new TextRun({ text: caseData.facility.name, size: 24, font: FONT, color: C.blue })],
    }));
  }

  // Gold divider
  elements.push(coloredDivider());

  // Title
  elements.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 200, after: 100 },
    children: [new TextRun({ text: 'CASE INVESTIGATION REPORT', bold: true, size: 40, font: FONT_HEADING, color: C.navy })],
  }));

  // Confidentiality badge
  elements.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 80 },
    children: [new TextRun({
      text: `— ${config.confidentialityLevel.replace(/_/g, ' ')} —`,
      bold: true, size: 22, font: FONT, color: C.red,
    })],
  }));

  // Case number
  elements.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 300 },
    children: [new TextRun({ text: `Case #${caseData.caseNumber}`, size: 30, font: FONT_HEADING, color: C.blue })],
  }));

  // Gold divider
  elements.push(coloredDivider());

  // Info table on cover page
  const coverTable = new Table({
    width: { size: 60, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    rows: [
      ...(caseData.department ? [new TableRow({
        children: [
          new TableCell({ borders: NO_BORDERS, width: { size: 40, type: WidthType.PERCENTAGE }, children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'Department:', bold: true, size: SZ, font: FONT, color: C.navy })] })] }),
          new TableCell({ borders: NO_BORDERS, width: { size: 60, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: `  ${caseData.department}`, size: SZ, font: FONT, color: C.grayText })] })] }),
        ],
      })] : []),
      ...(caseData.location ? [new TableRow({
        children: [
          new TableCell({ borders: NO_BORDERS, width: { size: 40, type: WidthType.PERCENTAGE }, children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'Location:', bold: true, size: SZ, font: FONT, color: C.navy })] })] }),
          new TableCell({ borders: NO_BORDERS, width: { size: 60, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: `  ${caseData.location}`, size: SZ, font: FONT, color: C.grayText })] })] }),
        ],
      })] : []),
      new TableRow({
        children: [
          new TableCell({ borders: NO_BORDERS, width: { size: 40, type: WidthType.PERCENTAGE }, children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'Incident Date:', bold: true, size: SZ, font: FONT, color: C.navy })] })] }),
          new TableCell({ borders: NO_BORDERS, width: { size: 60, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: `  ${fmtDate(caseData.incidentDate)}`, size: SZ, font: FONT, color: C.grayText })] })] }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({ borders: NO_BORDERS, width: { size: 40, type: WidthType.PERCENTAGE }, children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'Status:', bold: true, size: SZ, font: FONT, color: C.navy })] })] }),
          new TableCell({ borders: NO_BORDERS, width: { size: 60, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: `  ${getStatusLabel(caseData.status)}`, size: SZ, font: FONT, color: C.grayText })] })] }),
        ],
      }),
    ],
  });

  elements.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 100 },
    children: [],
  }));
  elements.push(coverTable);

  // Prepared by / for
  elements.push(spacer(300));
  if (config.preparedBy) {
    elements.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 40 },
      children: [
        new TextRun({ text: 'Prepared By: ', bold: true, size: SZ_LABEL, font: FONT, color: C.navy }),
        new TextRun({ text: config.preparedBy, size: SZ_LABEL, font: FONT, color: C.grayText }),
      ],
    }));
  }
  if (config.preparedFor) {
    elements.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 40 },
      children: [
        new TextRun({ text: 'Prepared For: ', bold: true, size: SZ_LABEL, font: FONT, color: C.navy }),
        new TextRun({ text: config.preparedFor, size: SZ_LABEL, font: FONT, color: C.grayText }),
      ],
    }));
  }

  elements.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 200 },
    children: [new TextRun({
      text: `Report Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`,
      size: SZ_SM, font: FONT, color: C.muted, italics: true,
    })],
  }));

  // Bottom colored bar
  elements.push(coloredDivider());
  elements.push(new Paragraph({
    spacing: { before: 0, after: 0 },
    shading: { fill: C.gold, type: ShadingType.CLEAR, color: 'auto' },
    children: [new TextRun({ text: ' ', size: 8, color: C.gold })],
  }));
  elements.push(new Paragraph({
    spacing: { before: 0, after: 0 },
    shading: { fill: C.navy, type: ShadingType.CLEAR, color: 'auto' },
    children: [new TextRun({ text: ' ', size: 16, color: C.navy })],
  }));

  elements.push(new Paragraph({ children: [new PageBreak()] }));
  return elements;
}

// ─── Section Builders ─────────────────────────────────────────────────────────

function buildTOC(config: ReportConfig, caseData: ConflictCase, comparison: ComparisonResult | null, policyResult: PolicyMatchResult | null, recommendationResult: RecommendationResult | null, auditLog: AuditEntry[]): (Paragraph | Table)[] {
  const elements: (Paragraph | Table)[] = [];
  elements.push(sectionHeading('Table of Contents'));

  const toc: string[] = [];
  if (config.includeExecutiveSummary) toc.push('1. Executive Summary');
  if (config.includeCaseDetails) toc.push('2. Case Details');
  if (config.includeInvolvedParties) toc.push('3. Involved Parties');
  if (config.includeDocumentSummary) toc.push('4. Document Summary & Evidence');
  if (config.includeAIAnalysis && comparison) toc.push('5. AI-Powered Analysis');
  if (config.includePolicyMatches && policyResult) toc.push('6. Policy Matching Results');
  if (config.includeRecommendations && recommendationResult) toc.push('7. Recommendations & Actions');
  if (config.includeSelectedAction && caseData.selectedAction) toc.push('8. Selected Action Plan');
  if (config.includeAuditTrail && auditLog?.length) toc.push('9. Audit Trail');
  if (config.includeSignatureBlocks) toc.push('10. Signatures & Approvals');

  toc.forEach((item, i) => {
    elements.push(new Paragraph({
      spacing: { after: 60 },
      indent: { left: 400 },
      children: [new TextRun({
        text: item,
        font: FONT,
        size: SZ,
        color: i % 2 === 0 ? C.navy : C.blue,
      })],
    }));
  });

  elements.push(new Paragraph({ children: [new PageBreak()] }));
  return elements;
}

function deduplicateEmployees(employees: ConflictCase['involvedEmployees']): NonNullable<ConflictCase['involvedEmployees']> {
  if (!employees?.length) return [];
  const seen = new Set<string>();
  return employees.filter(e => {
    const key = e.employeeFileNo || `${e.name}-${e.role}-${e.department}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildExecutiveSummary(caseData: ConflictCase, comparison: ComparisonResult | null): (Paragraph | Table)[] {
  const sections: (Paragraph | Table)[] = [sectionHeading('Executive Summary', '1.')];
  const employees = deduplicateEmployees(caseData.involvedEmployees);
  const docs = caseData.documents || [];

  // Summary box with light blue background
  sections.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [new TableRow({
      children: [new TableCell({
        borders: { top: { style: BorderStyle.SINGLE, size: 3, color: C.blue }, bottom: B_THIN, left: B_THIN, right: B_THIN },
        shading: { fill: C.paleBlue, type: ShadingType.CLEAR, color: 'auto' },
        children: [
          new Paragraph({
            spacing: { before: 80, after: 80 },
            children: [new TextRun({
              text: `This report documents the investigation of Case ${caseData.caseNumber}, involving a ${(caseData.type || '').toLowerCase().replace(/_/g, ' ')} incident that occurred on ${fmtDate(caseData.incidentDate)} at ${caseData.location || 'an unspecified location'} within the ${caseData.department || 'unspecified'} department.`,
              font: FONT, size: SZ, color: C.darkText,
            })],
          }),
          new Paragraph({
            spacing: { before: 40, after: 80 },
            children: [new TextRun({
              text: `The case involves ${employees.length} involved ${employees.length === 1 ? 'party' : 'parties'} and ${docs.length} document${docs.length !== 1 ? 's' : ''} submitted for review. Current case status: ${getStatusLabel(caseData.status)}.`,
              font: FONT, size: SZ, color: C.grayText,
            })],
          }),
        ],
      })],
    })],
  }));

  if (comparison?.neutralSummary) {
    sections.push(subHeading('Key Findings'));
    sections.push(para(comparison.neutralSummary));
  }

  if (comparison?.agreementPoints?.length) {
    sections.push(subHeading('Points of Agreement'));
    comparison.agreementPoints.forEach(p => sections.push(bullet(p, C.green)));
  }

  return sections;
}

function buildCaseDetails(caseData: ConflictCase): (Paragraph | Table)[] {
  return [
    sectionHeading('Case Details', '2.'),
    kvTable([
      ['Case Number', caseData.caseNumber],
      ['Case Type', (caseData.type || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())],
      ['Status', getStatusLabel(caseData.status)],
      ['Organization', caseData.organization?.name || '—'],
      ['Facility', caseData.facility?.name || '—'],
      ['Department', caseData.department || '—'],
      ['Location', caseData.location || '—'],
      ['Shift', caseData.shift || '—'],
      ['Incident Date', fmtDate(caseData.incidentDate)],
      ['Case Created', fmtDate(caseData.createdAt)],
      ...(caseData.closedAt ? [['Date Closed', fmtDate(caseData.closedAt)] as [string, string]] : []),
      ...(caseData.closureReason ? [['Closure Reason', caseData.closureReason.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())] as [string, string]] : []),
    ]),
  ];
}

function buildInvolvedParties(caseData: ConflictCase): (Paragraph | Table)[] {
  const employees = deduplicateEmployees(caseData.involvedEmployees);
  if (!employees.length) return [];

  const sections: (Paragraph | Table)[] = [sectionHeading('Involved Parties', '3.')];
  sections.push(para(`${employees.length} individual${employees.length !== 1 ? 's' : ''} identified as involved in this case:`, { italic: true, color: C.grayText }));

  const headerRow = new TableRow({
    children: [
      headerCell('Name', 25),
      headerCell('Role', 20),
      headerCell('Department', 20),
      headerCell('File No.', 15),
      headerCell('Complainant', 20),
    ],
  });

  const dataRows = employees.map((emp, i) =>
    new TableRow({
      children: [
        dataCell(emp.name, { bold: true, shading: i % 2 === 1 ? C.lightGray : undefined }),
        dataCell(emp.role || '—', { shading: i % 2 === 1 ? C.lightGray : undefined }),
        dataCell(emp.department || '—', { shading: i % 2 === 1 ? C.lightGray : undefined }),
        dataCell(emp.employeeFileNo || '—', { shading: i % 2 === 1 ? C.lightGray : undefined }),
        dataCell(emp.isComplainant ? 'Yes' : 'No', {
          color: emp.isComplainant ? C.red : C.grayText,
          bold: emp.isComplainant,
          shading: i % 2 === 1 ? C.lightGray : undefined,
        }),
      ],
    })
  );

  sections.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    rows: [headerRow, ...dataRows],
  }));

  return sections;
}

async function buildDocumentSummaryWithImages(caseData: ConflictCase): Promise<(Paragraph | Table)[]> {
  const docs = caseData.documents || [];
  if (!docs.length) return [];

  const sections: (Paragraph | Table)[] = [sectionHeading('Document Summary & Evidence', '4.')];
  sections.push(para(`${docs.length} document${docs.length !== 1 ? 's were' : ' was'} submitted and reviewed as part of this investigation.`, { italic: true, color: C.grayText }));

  // Summary table
  const headerRow = new TableRow({
    children: [
      headerCell('#', 6),
      headerCell('Document Type', 24),
      headerCell('Pages', 10),
      headerCell('Date Submitted', 20),
      headerCell('Language', 15),
      headerCell('Format', 25),
    ],
  });

  const tableRows = docs.map((doc, i) => {
    const typeLabel = (doc.type || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    return new TableRow({
      children: [
        dataCell(`${i + 1}`, { shading: i % 2 === 1 ? C.lightGray : undefined }),
        dataCell(typeLabel, { bold: true, shading: i % 2 === 1 ? C.lightGray : undefined }),
        dataCell(`${doc.pageCount || 1}`, { shading: i % 2 === 1 ? C.lightGray : undefined }),
        dataCell(fmtDate(doc.createdAt), { shading: i % 2 === 1 ? C.lightGray : undefined }),
        dataCell(doc.detectedLanguage || 'en', { shading: i % 2 === 1 ? C.lightGray : undefined }),
        dataCell(doc.isHandwritten ? 'Handwritten' : 'Typed/Printed', { shading: i % 2 === 1 ? C.lightGray : undefined }),
      ],
    });
  });

  sections.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    rows: [headerRow, ...tableRows],
  }));

  // ─── Per-document detail: extracted text, translated text, and original images ───
  for (let i = 0; i < docs.length; i++) {
    const doc = docs[i];
    const typeLabel = (doc.type || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const hasText = doc.cleanedText || doc.originalText;
    const hasTranslation = doc.translatedText;
    let hasImgs = false;
    let imgUrls: string[] = [];
    if (doc.originalImageUrls) {
      console.log(`[Report] Doc ${i + 1} originalImageUrls type:`, typeof doc.originalImageUrls, 'length:', doc.originalImageUrls.length, 'preview:', doc.originalImageUrls.substring(0, 100));
      try {
        const parsed = JSON.parse(doc.originalImageUrls);
        if (Array.isArray(parsed)) {
          imgUrls = parsed;
        } else if (typeof parsed === 'string') {
          // Sometimes it's a double-encoded string
          imgUrls = [parsed];
        }
        hasImgs = imgUrls.length > 0;
        console.log(`[Report] Doc ${i + 1} parsed ${imgUrls.length} image(s), first preview:`, imgUrls[0]?.substring(0, 60));
      } catch (e) {
        console.error(`[Report] Doc ${i + 1} JSON.parse failed for originalImageUrls:`, e);
        // Maybe it's a raw base64 string, not JSON-encoded
        if (doc.originalImageUrls.length > 100) {
          imgUrls = [doc.originalImageUrls];
          hasImgs = true;
          console.log(`[Report] Doc ${i + 1} treating raw value as single image, length:`, doc.originalImageUrls.length);
        }
      }
    } else {
      console.log(`[Report] Doc ${i + 1} originalImageUrls is null/undefined`);
    }
    // Also check processedImageUrls as fallback
    if (!hasImgs && doc.processedImageUrls) {
      console.log(`[Report] Doc ${i + 1} trying processedImageUrls fallback`);
      try {
        const parsed = JSON.parse(doc.processedImageUrls);
        if (Array.isArray(parsed) && parsed.length > 0) {
          imgUrls = parsed;
          hasImgs = true;
        }
      } catch {
        if (doc.processedImageUrls.length > 100) {
          imgUrls = [doc.processedImageUrls];
          hasImgs = true;
        }
      }
    }

    // Always show document if it has a signature, even if nothing else
    const hasSig = !!doc.signatureImageData;
    if (!hasText && !hasTranslation && !hasImgs && !hasSig) continue;

    sections.push(spacer(200));
    // Document header bar
    sections.push(new Paragraph({
      spacing: { after: 80 },
      shading: { fill: C.navy, type: ShadingType.CLEAR, color: 'auto' },
      children: [new TextRun({ text: `  DOCUMENT ${i + 1}: ${typeLabel}`, bold: true, size: SZ, font: FONT, color: C.white })],
    }));

    // Extracted text (cleaned or original)
    if (hasText) {
      sections.push(subHeading('Extracted Text'));
      const textToShow = doc.cleanedText || doc.originalText || '';
      // Split into paragraphs for readability
      const textParagraphs = textToShow.split(/\n+/).filter(t => t.trim());
      if (textParagraphs.length > 0) {
        sections.push(new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [new TableRow({
            children: [new TableCell({
              borders: { top: { style: BorderStyle.SINGLE, size: 2, color: C.blue }, bottom: B_THIN, left: B_THIN, right: B_THIN },
              shading: { fill: C.lightGray, type: ShadingType.CLEAR, color: 'auto' },
              children: textParagraphs.map(tp => new Paragraph({
                spacing: { before: 40, after: 40 },
                children: [new TextRun({ text: `  ${tp}`, font: FONT, size: SZ, color: C.darkText })],
              })),
            })],
          })],
        }));
      }

      // If there's also an original text that differs from cleaned, show it
      if (doc.cleanedText && doc.originalText && doc.cleanedText !== doc.originalText) {
        sections.push(spacer(80));
        sections.push(new Paragraph({
          spacing: { after: 40 },
          children: [new TextRun({ text: 'Original (Unprocessed) Text:', bold: true, size: SZ_SM, font: FONT, color: C.muted, italics: true })],
        }));
        const origParagraphs = doc.originalText.split(/\n+/).filter(t => t.trim());
        origParagraphs.forEach(tp => sections.push(para(`  ${tp}`, { size: SZ_SM, color: C.muted, italic: true })));
      }
    }

    // Translated text
    if (hasTranslation) {
      sections.push(spacer(80));
      sections.push(subHeading(`Translated Text${doc.detectedLanguage ? ` (from ${doc.detectedLanguage.toUpperCase()})` : ''}`));
      sections.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [new TableRow({
          children: [new TableCell({
            borders: { top: { style: BorderStyle.SINGLE, size: 2, color: C.gold }, bottom: B_THIN, left: B_THIN, right: B_THIN },
            shading: { fill: 'FFF8E1', type: ShadingType.CLEAR, color: 'auto' },
            children: doc.translatedText!.split(/\n+/).filter(t => t.trim()).map(tp => new Paragraph({
              spacing: { before: 40, after: 40 },
              children: [new TextRun({ text: `  ${tp}`, font: FONT, size: SZ, color: C.darkText })],
            })),
          })],
        })],
      }));
    }

    // Original scanned/photographed document images
    if (hasImgs) {
      sections.push(spacer(80));
      sections.push(subHeading('Original Scanned Document'));
      sections.push(para('Scanned/photographed copy of the original complaint document:', { italic: true, color: C.grayText, size: SZ_SM }));

      console.log(`[Report] Doc ${i + 1} rendering ${imgUrls.length} image(s)`);

      for (let j = 0; j < imgUrls.length; j++) {
        try {
          console.log(`[Report] Doc ${i + 1} image ${j + 1}: type=${imgUrls[j].substring(0, 10)}... length=${imgUrls[j].length}`);
          const imgData = await fetchImageData(imgUrls[j]);
          if (imgData) {
            console.log(`[Report] Doc ${i + 1} image ${j + 1} loaded: ${imgData.width}x${imgData.height}, buffer size: ${imgData.data.byteLength}`);
            const maxW = 480;
            const maxH = 640;
            const scale = Math.min(maxW / imgData.width, maxH / imgData.height, 1);
            const imgType = imgUrls[j].startsWith('iVBOR') ? 'png' : 'jpg';
            sections.push(new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 80, after: 40 },
              children: [new ImageRun({
                data: imgData.data,
                transformation: { width: Math.round(imgData.width * scale), height: Math.round(imgData.height * scale) },
                type: imgType as 'png' | 'jpg',
              })],
            }));
            if (imgUrls.length > 1) {
              sections.push(new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { after: 60 },
                children: [new TextRun({ text: `Page ${j + 1} of ${imgUrls.length}`, size: SZ_SM, font: FONT, color: C.muted, italics: true })],
              }));
            }
          } else {
            console.error(`[Report] Doc ${i + 1} image ${j + 1}: fetchImageData returned null`);
            sections.push(para(`  [Image ${j + 1} could not be loaded]`, { italic: true, color: C.muted, size: SZ_SM }));
          }
        } catch (imgErr) {
          console.error(`[Report] Doc ${i + 1} image ${j + 1} error:`, imgErr);
          sections.push(para(`  [Image ${j + 1} could not be processed]`, { italic: true, color: C.muted, size: SZ_SM }));
        }
      }
    }

    // Signature confirming extracted text accuracy — placed right after the document content
    if (doc.signatureImageData) {
      const employee = doc.employeeId ? (caseData.involvedEmployees || []).find(e => e.id === doc.employeeId) : null;
      const signerName = employee?.name || doc.submittedBy || 'Employee';

      sections.push(spacer(100));
      sections.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            children: [new TableCell({
              borders: { top: B_THIN, left: B_THIN, right: B_THIN, bottom: B_NONE },
              shading: { fill: C.paleBlue, type: ShadingType.CLEAR, color: 'auto' },
              children: [new Paragraph({
                spacing: { before: 40, after: 40 },
                children: [
                  new TextRun({ text: '  Employee Confirmation Signature — ', bold: true, size: SZ_SM, font: FONT, color: C.navy }),
                  new TextRun({ text: signerName, bold: true, size: SZ, font: FONT, color: C.navy }),
                ],
              })],
            })],
          }),
          new TableRow({
            children: [new TableCell({
              borders: { top: B_NONE, left: B_THIN, right: B_THIN, bottom: B_THIN },
              children: await (async () => {
                try {
                  const sigImg = await fetchImageData(doc.signatureImageData!);
                  if (sigImg) {
                    const scale = Math.min(250 / sigImg.width, 80 / sigImg.height, 1);
                    return [
                      new Paragraph({
                        spacing: { before: 40, after: 10 },
                        children: [new ImageRun({
                          data: sigImg.data,
                          transformation: { width: Math.round(sigImg.width * scale), height: Math.round(sigImg.height * scale) },
                          type: 'png',
                        })],
                      }),
                      new Paragraph({
                        spacing: { after: 40 },
                        children: [
                          new TextRun({ text: `  ${signerName} confirmed the extracted text is accurate.`, size: SZ_SM, font: FONT, color: C.grayText, italics: true }),
                          new TextRun({ text: `  •  Signed: ${fmtDateTime(doc.createdAt)}`, size: SZ_SM, font: FONT, color: C.muted, italics: true }),
                        ],
                      }),
                    ];
                  }
                } catch { /* fall through */ }
                return [para(`  [Signature from ${signerName} — image unavailable]`, { italic: true, color: C.muted, size: SZ_SM })];
              })(),
            })],
          }),
        ],
      }));
    }
  }

  return sections;
}

function buildAIAnalysis(comparison: ComparisonResult | null): (Paragraph | Table)[] {
  if (!comparison) return [];
  const sections: (Paragraph | Table)[] = [sectionHeading('AI-Powered Analysis', '5.')];

  if (comparison.neutralSummary) {
    sections.push(subHeading('Neutral Summary'));
    sections.push(para(comparison.neutralSummary));
  }

  if (comparison.agreementPoints?.length) {
    sections.push(subHeading('Points of Agreement'));
    comparison.agreementPoints.forEach(p => sections.push(bullet(p, C.green)));
  }

  if (comparison.contradictions?.length) {
    sections.push(subHeading('Contradictions Identified'));
    comparison.contradictions.forEach(p => sections.push(bullet(p, C.red)));
  }

  if (comparison.timelineDifferences?.length) {
    sections.push(subHeading('Timeline Discrepancies'));
    comparison.timelineDifferences.forEach(p => sections.push(bullet(p)));
  }

  if (comparison.sideBySideComparison?.length) {
    sections.push(subHeading('Side-by-Side Comparison'));
    const hRow = new TableRow({
      children: [
        headerCell('Topic', 20),
        headerCell(comparison.partyAName || 'Party A', 30),
        headerCell(comparison.partyBName || 'Party B', 30),
        headerCell('Status', 20),
      ],
    });
    const dRows = comparison.sideBySideComparison.map((item, i) =>
      new TableRow({
        children: [
          dataCell(item.topic, { bold: true, shading: i % 2 === 1 ? C.lightGray : undefined }),
          dataCell(item.partyAVersion, { shading: i % 2 === 1 ? C.lightGray : undefined }),
          dataCell(item.partyBVersion, { shading: i % 2 === 1 ? C.lightGray : undefined }),
          dataCell(item.status, {
            color: item.status === 'agrees' ? C.green : item.status === 'contradicts' ? C.red : C.grayText,
            bold: true,
            shading: i % 2 === 1 ? C.lightGray : undefined,
          }),
        ],
      })
    );
    sections.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      layout: TableLayoutType.FIXED,
      rows: [hRow, ...dRows],
    }));
  }

  return sections;
}

function buildPolicyMatches(policyResult: PolicyMatchResult | null): (Paragraph | Table)[] {
  if (!policyResult?.matches?.length) return [];
  const sections: (Paragraph | Table)[] = [sectionHeading('Policy Matching Results', '6.')];

  if (policyResult.overallGuidance) {
    // Guidance box
    sections.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [new TableRow({
        children: [new TableCell({
          borders: { top: { style: BorderStyle.SINGLE, size: 3, color: C.gold }, bottom: B_THIN, left: B_THIN, right: B_THIN },
          shading: { fill: 'FFF8E1', type: ShadingType.CLEAR, color: 'auto' },
          children: [
            new Paragraph({ spacing: { before: 40, after: 20 }, children: [new TextRun({ text: '  OVERALL GUIDANCE', bold: true, size: SZ_SM, font: FONT, color: C.gold })] }),
            new Paragraph({ spacing: { before: 20, after: 60 }, children: [new TextRun({ text: `  ${policyResult.overallGuidance}`, size: SZ, font: FONT, color: C.darkText, italics: true })] }),
          ],
        })],
      })],
    }));
  }

  policyResult.matches.forEach((match, i) => {
    sections.push(spacer(120));
    sections.push(subHeading(`${match.sectionNumber} — ${match.sectionTitle}`));
    sections.push(para(match.relevanceExplanation));

    // Confidence bar representation
    const confidencePct = Math.round(match.matchConfidence * 100);
    const confColor = confidencePct >= 80 ? C.green : confidencePct >= 50 ? C.gold : C.red;
    sections.push(new Paragraph({
      spacing: { after: 40 },
      children: [
        new TextRun({ text: 'Match Confidence: ', bold: true, size: SZ_SM, font: FONT, color: C.navy }),
        new TextRun({ text: `${confidencePct}%`, bold: true, size: SZ_SM, font: FONT, color: confColor }),
      ],
    }));

    if (match.keyPhrases?.length) {
      sections.push(new Paragraph({
        spacing: { after: 60 },
        children: [
          new TextRun({ text: 'Key Phrases: ', bold: true, size: SZ_SM, font: FONT, color: C.navy }),
          new TextRun({ text: match.keyPhrases.join(' • '), size: SZ_SM, font: FONT, color: C.grayText, italics: true }),
        ],
      }));
    }
  });

  return sections;
}

function buildRecommendations(recResult: RecommendationResult | null): (Paragraph | Table)[] {
  if (!recResult?.recommendations?.length) return [];
  const sections: (Paragraph | Table)[] = [sectionHeading('Recommendations & Actions', '7.')];

  if (recResult.supervisorGuidance) {
    sections.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [new TableRow({
        children: [new TableCell({
          borders: { top: { style: BorderStyle.SINGLE, size: 3, color: C.blue }, bottom: B_THIN, left: B_THIN, right: B_THIN },
          shading: { fill: C.paleBlue, type: ShadingType.CLEAR, color: 'auto' },
          children: [
            new Paragraph({ spacing: { before: 40, after: 20 }, children: [new TextRun({ text: '  SUPERVISOR GUIDANCE', bold: true, size: SZ_SM, font: FONT, color: C.navy })] }),
            new Paragraph({ spacing: { before: 20, after: 60 }, children: [new TextRun({ text: `  ${recResult.supervisorGuidance}`, size: SZ, font: FONT, color: C.darkText, italics: true })] }),
          ],
        })],
      })],
    }));
  }

  recResult.recommendations.forEach((rec) => {
    sections.push(spacer(120));
    sections.push(subHeading(rec.title));

    const riskColor = rec.riskLevel === 'high' ? C.red : rec.riskLevel === 'medium' ? C.gold : C.green;
    sections.push(kvTable([
      ['Action Type', rec.type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())],
      ['Risk Level', rec.riskLevel.replace(/\b\w/g, c => c.toUpperCase())],
      ['Confidence', `${Math.round(rec.confidence * 100)}%`],
      ['Timeframe', rec.timeframe || '—'],
      ['Target Employees', rec.targetEmployeeNames?.join(', ') || '—'],
    ]));

    sections.push(spacer(60));
    sections.push(para(rec.rationale));

    if (rec.nextSteps?.length) {
      sections.push(new Paragraph({
        spacing: { before: 80, after: 40 },
        children: [new TextRun({ text: 'Recommended Next Steps:', bold: true, size: SZ, font: FONT, color: C.navy })],
      }));
      rec.nextSteps.forEach(s => sections.push(bullet(s)));
    }
  });

  return sections;
}

function buildSelectedAction(caseData: ConflictCase): (Paragraph | Table)[] {
  if (!caseData.selectedAction) return [];
  const sections: (Paragraph | Table)[] = [sectionHeading('Selected Action Plan', '8.')];

  // Action badge
  const actionLabel = caseData.selectedAction.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  sections.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [new TableRow({
      children: [new TableCell({
        borders: CELL_BORDERS,
        shading: { fill: C.navy, type: ShadingType.CLEAR, color: 'auto' },
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 60, after: 60 },
          children: [
            new TextRun({ text: 'SELECTED ACTION: ', bold: true, size: 24, font: FONT, color: C.white }),
            new TextRun({ text: actionLabel, bold: true, size: 24, font: FONT, color: C.gold }),
          ],
        })],
      })],
    })],
  }));

  if (caseData.generatedDocument) {
    try {
      const doc = JSON.parse(caseData.generatedDocument);
      if (doc.title) {
        sections.push(spacer(80));
        sections.push(para(`Document: ${doc.title}`, { bold: true }));
      }
      if (doc.content) sections.push(para(doc.content));
    } catch { /* skip */ }
  }

  if (caseData.supervisorNotes) {
    sections.push(subHeading('Supervisor Notes'));
    sections.push(para(caseData.supervisorNotes));
  }

  return sections;
}

function buildAuditTrail(auditLog: AuditEntry[]): (Paragraph | Table)[] {
  if (!auditLog?.length) return [];
  const sections: (Paragraph | Table)[] = [sectionHeading('Audit Trail', '9.')];
  sections.push(para(`Complete chronological record of ${auditLog.length} action${auditLog.length !== 1 ? 's' : ''} taken on this case:`, { italic: true, color: C.grayText }));

  const hRow = new TableRow({
    children: [
      headerCell('Date/Time', 22),
      headerCell('Action', 25),
      headerCell('User', 20),
      headerCell('Details', 33),
    ],
  });

  const dRows = auditLog.map((entry, i) => {
    let details = '';
    if (entry.details) {
      try { details = typeof entry.details === 'string' ? (JSON.parse(entry.details)?.description || entry.details) : String(entry.details); }
      catch { details = entry.details; }
    }
    const userName = entry.userName || (entry.user ? `${entry.user.firstName || ''} ${entry.user.lastName || ''}`.trim() : '—');
    return new TableRow({
      children: [
        dataCell(fmtDateTime(entry.timestamp), { size: SZ_SM, shading: i % 2 === 1 ? C.lightGray : undefined }),
        dataCell((entry.action || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), { shading: i % 2 === 1 ? C.lightGray : undefined }),
        dataCell(userName, { shading: i % 2 === 1 ? C.lightGray : undefined }),
        dataCell(details || '—', { size: SZ_SM, shading: i % 2 === 1 ? C.lightGray : undefined }),
      ],
    });
  });

  sections.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    rows: [hRow, ...dRows],
  }));

  return sections;
}

function buildSignatureBlocks(): (Paragraph | Table)[] {
  const sections: (Paragraph | Table)[] = [
    new Paragraph({ children: [new PageBreak()] }),
    sectionHeading('Signatures & Approvals', '10.'),
  ];

  // Manual signature lines for report approval
  sections.push(para('The undersigned parties acknowledge review of this report and its contents.', { italic: true, color: C.grayText }));

  const blocks = [
    { title: 'Investigating Supervisor', subtitle: 'I certify that I conducted this investigation in accordance with company policy.' },
    { title: 'HR Representative', subtitle: 'I have reviewed this case and the recommended actions.' },
    { title: 'Department Manager', subtitle: 'I acknowledge receipt of this investigation report.' },
  ];

  blocks.forEach(({ title, subtitle }) => {
    sections.push(spacer(200));
    sections.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [new TableCell({
            borders: NO_BORDERS,
            children: [
              new Paragraph({ spacing: { before: 20, after: 40 }, children: [new TextRun({ text: title, bold: true, size: SZ, font: FONT, color: C.navy })] }),
              new Paragraph({ spacing: { after: 20 }, children: [new TextRun({ text: subtitle, size: SZ_SM, font: FONT, color: C.grayText, italics: true })] }),
            ],
          })],
        }),
        new TableRow({
          children: [new TableCell({
            borders: NO_BORDERS,
            children: [new Paragraph({
              spacing: { before: 80 },
              border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: C.navy, space: 2 } },
              children: [new TextRun({ text: ' ', size: SZ })],
            })],
          })],
        }),
        new TableRow({
          children: [new TableCell({
            borders: NO_BORDERS,
            children: [new Paragraph({
              spacing: { after: 10 },
              children: [
                new TextRun({ text: 'Signature', size: SZ_SM, font: FONT, color: C.muted }),
                new TextRun({ text: '                                                   ', size: SZ_SM }),
                new TextRun({ text: 'Date', size: SZ_SM, font: FONT, color: C.muted }),
              ],
            })],
          })],
        }),
        new TableRow({
          children: [new TableCell({
            borders: NO_BORDERS,
            children: [new Paragraph({
              spacing: { before: 60 },
              border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: C.navy, space: 2 } },
              children: [new TextRun({ text: ' ', size: SZ })],
            })],
          })],
        }),
        new TableRow({
          children: [new TableCell({
            borders: NO_BORDERS,
            children: [new Paragraph({
              spacing: { after: 20 },
              children: [
                new TextRun({ text: 'Printed Name', size: SZ_SM, font: FONT, color: C.muted }),
                new TextRun({ text: '                                                ', size: SZ_SM }),
                new TextRun({ text: 'Title', size: SZ_SM, font: FONT, color: C.muted }),
              ],
            })],
          })],
        }),
      ],
    }));
  });

  return sections;
}

// ─── Main Generator ───────────────────────────────────────────────────────────

export interface ReportGenerationInput {
  caseData: ConflictCase;
  config: ReportConfig;
  comparison: ComparisonResult | null;
  policyResult: PolicyMatchResult | null;
  recommendationResult: RecommendationResult | null;
  auditLog: AuditEntry[];
}

export async function generateCaseReport(input: ReportGenerationInput): Promise<{ blob: Blob; filename: string; sectionCount: number }> {
  const { caseData, config, comparison, policyResult, recommendationResult, auditLog } = input;

  const children: (Paragraph | Table)[] = [];
  let sectionCount = 0;

  // Cover page (async for logo)
  children.push(...await buildCoverPage(caseData, config));

  // Table of Contents
  children.push(...buildTOC(config, caseData, comparison, policyResult, recommendationResult, auditLog));

  // Sections
  if (config.includeExecutiveSummary) { children.push(...buildExecutiveSummary(caseData, comparison)); sectionCount++; }
  if (config.includeCaseDetails) { children.push(...buildCaseDetails(caseData)); sectionCount++; }
  if (config.includeInvolvedParties) { children.push(...buildInvolvedParties(caseData)); sectionCount++; }
  if (config.includeDocumentSummary) { children.push(...await buildDocumentSummaryWithImages(caseData)); sectionCount++; }
  if (config.includeAIAnalysis && comparison) { children.push(...buildAIAnalysis(comparison)); sectionCount++; }
  if (config.includePolicyMatches && policyResult) { children.push(...buildPolicyMatches(policyResult)); sectionCount++; }
  if (config.includeRecommendations && recommendationResult) { children.push(...buildRecommendations(recommendationResult)); sectionCount++; }
  if (config.includeSelectedAction && caseData.selectedAction) { children.push(...buildSelectedAction(caseData)); sectionCount++; }
  if (config.includeAuditTrail && auditLog?.length) { children.push(...buildAuditTrail(auditLog)); sectionCount++; }
  if (config.includeSignatureBlocks) { children.push(...buildSignatureBlocks()); sectionCount++; }

  // Organization branding for header/footer
  const orgName = caseData.organization?.name || '';
  const facilityName = caseData.facility?.name || '';
  const brandingLine = [orgName, facilityName].filter(Boolean).join(' — ');

  // Build header with optional logo
  const headerChildren: Paragraph[] = [];
  headerChildren.push(new Paragraph({
    alignment: AlignmentType.RIGHT,
    spacing: { after: 0 },
    children: [
      new TextRun({ text: config.confidentialityLevel.replace(/_/g, ' '), bold: true, font: FONT, size: 14, color: C.red }),
      new TextRun({ text: `  |  Case #${caseData.caseNumber}`, font: FONT, size: 14, color: C.muted }),
    ],
  }));
  // Navy line under header
  headerChildren.push(new Paragraph({
    spacing: { before: 40, after: 0 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: C.navy, space: 0 } },
    children: [],
  }));

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: { top: 1200, right: 1000, bottom: 1200, left: 1000 },
        },
      },
      headers: {
        default: new Header({ children: headerChildren }),
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              spacing: { before: 0, after: 0 },
              border: { top: { style: BorderStyle.SINGLE, size: 1, color: C.gold, space: 4 } },
              children: [],
            }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 0, after: 0 },
              children: [
                new TextRun({ text: brandingLine || 'Case Investigation Report', bold: true, font: FONT, size: 14, color: C.navy }),
              ],
            }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 20, after: 0 },
              children: [
                new TextRun({ text: `Case #${caseData.caseNumber}  |  ${config.confidentialityLevel.replace(/_/g, ' ')}  |  Generated ${new Date().toLocaleDateString()}`, font: FONT, size: 12, color: C.muted }),
              ],
            }),
          ],
        }),
      },
      children,
    }],
  });

  const blob = await Packer.toBlob(doc);
  const filename = `Case_${caseData.caseNumber}_Investigation_Report.docx`;

  return { blob, filename, sectionCount };
}

export async function downloadCaseReport(input: ReportGenerationInput): Promise<{ sectionCount: number }> {
  const { blob, filename, sectionCount } = await generateCaseReport(input);
  saveAs(blob, filename);
  return { sectionCount };
}
