/**
 * Enterprise PowerPoint Generation Service for RCA Reports
 * Generates world-class, audit-ready presentations using pptxgenjs
 * 
 * Features:
 * - Grid-based pixel-aligned layouts
 * - Automatic content flow and pagination
 * - Section dividers with icons
 * - Professional visual hierarchy
 * - All mandatory sections included
 * - Never overflow slide boundaries
 */

import PptxGenJS from 'pptxgenjs';
import { prisma } from '../utils/prisma';
import OpenAI from 'openai';
import * as path from 'path';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

// Type definitions
interface ProgressCallback {
  (step: string, progress: number, message: string): void;
}

interface GenerationResult {
  success: boolean;
  filePath?: string;
  fileName?: string;
  fileSize?: number;
  error?: string;
}

interface RCAData {
  rca: any;
  incident: any;
  capaActions: any[];
  evidence: any[];
}

// ============================================================================
// ENTERPRISE COLOR SCHEME - Professional & Colorful
// ============================================================================
const COLORS = {
  // Primary brand colors
  primary: '1e3a8a',       // Deep navy blue
  primaryLight: '3b82f6',  // Bright blue
  primaryDark: '1e293b',   // Dark slate
  
  // Secondary colors
  secondary: '0ea5e9',     // Sky blue
  secondaryLight: 'e0f2fe', // Light sky
  
  // Accent colors
  accent: '10b981',        // Emerald green
  accentLight: 'd1fae5',   // Light green
  
  // Status colors
  success: '059669',       // Green
  warning: 'f59e0b',       // Amber
  warningLight: 'fef3c7',  // Light amber
  danger: 'dc2626',        // Red
  dangerLight: 'fee2e2',   // Light red
  
  // Neutral colors
  dark: '111827',          // Almost black
  text: '1f2937',          // Dark gray
  muted: '6b7280',         // Medium gray
  light: 'f3f4f6',         // Light gray
  lighter: 'f9fafb',       // Very light gray
  white: 'ffffff',         // White
  
  // Section colors (for dividers)
  incident: 'dc2626',      // Red for incidents
  rca: '2563eb',           // Blue for RCA
  corrective: '059669',    // Green for corrective
  preventive: '7c3aed',    // Purple for preventive
  evidence: 'ea580c',      // Orange for evidence
  verification: '0891b2',  // Cyan for verification
};

// ============================================================================
// LAYOUT CONSTANTS - Grid-based, pixel-perfect
// ============================================================================
const SLIDE = {
  WIDTH: 10,               // inches
  HEIGHT: 7.5,             // inches
  MARGIN: {
    LEFT: 0.5,
    RIGHT: 0.5,
    TOP: 1.3,              // Account for header
    BOTTOM: 0.5,
  },
  CONTENT_WIDTH: 9,        // WIDTH - LEFT - RIGHT margins
  CONTENT_HEIGHT: 5.7,     // HEIGHT - TOP - BOTTOM margins
  HEADER_HEIGHT: 1.2,
};

// Safe content boundaries
const SAFE_ZONE = {
  X: SLIDE.MARGIN.LEFT,
  Y: SLIDE.MARGIN.TOP,
  WIDTH: SLIDE.CONTENT_WIDTH,
  HEIGHT: SLIDE.CONTENT_HEIGHT,
  MAX_Y: SLIDE.HEIGHT - SLIDE.MARGIN.BOTTOM,
};

// Typography scale
const FONT = {
  TITLE_SLIDE: 36,
  SECTION_TITLE: 32,
  HEADER: 24,
  SUBHEADER: 18,
  BODY: 12,
  SMALL: 10,
  CAPTION: 9,
};

// Spacing constants
const SPACING = {
  SECTION: 0.4,            // Between sections
  PARAGRAPH: 0.25,         // Between paragraphs
  LINE: 0.35,              // Line height for lists
  TABLE_ROW: 0.45,         // Table row height
};

// ============================================================================
// SECTION ICONS (Unicode for compatibility)
// ============================================================================
const ICONS = {
  incident: '⚠️',
  summary: '📋',
  details: '📝',
  rca: '🔍',
  fiveWhys: '❓',
  fishbone: '🐟',
  corrective: '✅',
  preventive: '🛡️',
  evidence: '📎',
  verification: '✓',
  closure: '🏁',
  calendar: '📅',
  user: '👤',
  location: '📍',
  priority: '⚡',
  status: '📊',
  check: '✔',
  warning: '⚠',
  info: 'ℹ️',
  arrow: '→',
  bullet: '•',
};

// ============================================================================
// AI NARRATIVE GENERATION
// ============================================================================

/**
 * Get OpenAI client
 */
function getOpenAIClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('OpenAI API key not configured');
    return null;
  }
  return new OpenAI({ apiKey });
}

/**
 * Generate AI-powered narrative content for PowerPoint slides
 */
async function generateSlideNarrative(
  rca: any,
  incident: any,
  section: string
): Promise<string> {
  const openai = getOpenAIClient();
  
  if (!openai) {
    return getDefaultNarrative(section, rca, incident);
  }

  try {
    const completion = await openai.chat.completions.create({
      model: process.env.AI_MODEL || 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a professional technical writer creating content for an enterprise RCA (Root Cause Analysis) PowerPoint presentation. 
Write clear, concise, and professional content that:
- Uses active voice and simple English
- Is suitable for executive management, QA, and regulatory audits
- Provides full explanations, not just bullet points
- Creates structured narrative that tells the complete story
- Highlights key findings and actionable insights
- Maintains a formal but accessible tone
Keep responses focused, detailed, and suitable for enterprise presentation.`,
        },
        {
          role: 'user',
          content: buildNarrativePrompt(section, rca, incident),
        },
      ],
      temperature: 0.3,
      max_completion_tokens: 800,
    });

    return completion.choices[0]?.message?.content?.trim() || getDefaultNarrative(section, rca, incident);
  } catch (error: any) {
    console.error(`AI narrative generation failed for ${section}:`, error.message);
    return getDefaultNarrative(section, rca, incident);
  }
}

/**
 * Build prompt for narrative generation
 */
function buildNarrativePrompt(section: string, rca: any, incident: any): string {
  const baseContext = `
Incident: ${incident.incidentNumber} - ${incident.customTitle || incident.description}
Type: ${incident.type}
Severity: ${incident.severity}
Category: ${incident.Category?.name || 'N/A'}
`;

  const capaCount = rca.CAPAction?.length || 0;
  const correctiveCount = rca.CAPAction?.filter((a: any) => a.actionType === 'CORRECTIVE')?.length || 0;
  const preventiveCount = rca.CAPAction?.filter((a: any) => a.actionType === 'PREVENTIVE')?.length || 0;

  const incidentDate = formatDate(incident.occurredAt || incident.reportedAt);
  
  const prompts: Record<string, string> = {
    executive_summary: `${baseContext}

Incident Date: ${incidentDate}
Root Cause: ${rca.rootCauseStatement || 'Under investigation'}
Method Used: ${rca.method === 'FIVE_WHYS' ? '5 Whys Analysis' : 'Fishbone Diagram'}
Total CAPA Actions: ${capaCount} (${correctiveCount} corrective, ${preventiveCount} preventive)

Write a comprehensive executive summary (4-5 sentences) suitable for C-level executives that captures:
1. A clear statement of what happened and the exact date (${incidentDate})
2. The impact and severity of the incident
3. The root cause finding and how it was identified
4. Key corrective and preventive actions being taken
5. Expected timeline and impact on preventing recurrence

IMPORTANT: Use the actual date "${incidentDate}" in your response, do NOT use placeholder text like "[Date]".
Make it professional, audit-ready, and suitable for regulatory review.`,

    incident_overview: `${baseContext}
Description: ${incident.description}
Location: ${incident.Facility?.name || 'N/A'} - ${incident.Area?.name || incident.areaName || 'N/A'}
Incident Date: ${incidentDate}
Reported By: ${incident.User_Incident_createdByIdToUser?.firstName || 'Unknown'} ${incident.User_Incident_createdByIdToUser?.lastName || ''}

Write a detailed incident overview (3-4 paragraphs) that explains:
1. Exactly what happened - the sequence of events
2. When it occurred (use the exact date: ${incidentDate}) and where - specific location details
3. Who was involved or affected
4. The immediate impact on operations, safety, or quality
5. Initial response actions taken

IMPORTANT: Use the actual date "${incidentDate}" in your response, do NOT use placeholder text like "[Date]".
Use clear, simple English that management, QA, and auditors can easily understand.`,

    rca_findings: `${baseContext}
Method: ${rca.method === 'FIVE_WHYS' ? '5 Whys Analysis' : 'Fishbone Diagram'}
Root Cause: ${rca.rootCauseStatement}
${rca.method === 'FIVE_WHYS' && rca.fiveWhysData?.steps ? `5 Whys Steps: ${JSON.stringify(rca.fiveWhysData.steps)}` : ''}
${rca.method === 'FISHBONE' && rca.fishboneData ? `Fishbone Categories: ${JSON.stringify(rca.fishboneData.categories?.map((c: any) => ({ name: c.name, causes: c.causes })))}` : ''}

Write a detailed explanation of the RCA findings (3-4 paragraphs) that explains:
1. Why the ${rca.method === 'FIVE_WHYS' ? '5 Whys' : 'Fishbone'} methodology was selected
2. How the investigation was conducted step by step
3. The key contributing factors identified during analysis
4. How the team arrived at the root cause conclusion
5. The evidence supporting this root cause determination

Make it thorough enough for regulatory audit review.`,

    corrective_actions: `${baseContext}
Root Cause: ${rca.rootCauseStatement}
Corrective Actions: ${JSON.stringify(rca.CAPAction?.filter((a: any) => a.actionType === 'CORRECTIVE')?.map((a: any) => ({ title: a.title, status: a.status, priority: a.priority })) || [])}

Write a narrative explanation (2-3 paragraphs) of the corrective actions that describes:
1. How these actions directly address the identified root cause
2. The priority and urgency of each major action
3. Expected timeline for completion
4. How effectiveness will be verified

Focus on explaining the logic behind each corrective action and how it prevents the immediate problem from continuing.`,

    preventive_actions: `${baseContext}
Root Cause: ${rca.rootCauseStatement}
Preventive Actions: ${JSON.stringify(rca.CAPAction?.filter((a: any) => a.actionType === 'PREVENTIVE')?.map((a: any) => ({ title: a.title, status: a.status, priority: a.priority })) || [])}

Write a narrative explanation (2-3 paragraphs) of the preventive actions that describes:
1. How these actions prevent similar incidents from occurring in the future
2. System-level or process-level changes being implemented
3. Training or awareness programs planned
4. Long-term sustainability of these preventive measures

Emphasize how these actions go beyond fixing the immediate problem to prevent recurrence.`,

    verification: `${baseContext}
Root Cause: ${rca.rootCauseStatement}
RCA Status: ${rca.status}
Is Validated: ${rca.isValidated ? 'Yes' : 'No'}
CAPA Actions: ${capaCount} total

Write a verification and closure summary (2-3 paragraphs) that explains:
1. How the effectiveness of corrective actions will be verified
2. The criteria for considering this incident fully closed
3. Monitoring period and recurrence tracking approach
4. Documentation and knowledge sharing plans

Include specific verification steps that auditors would expect to see.`,

    conclusion: `${baseContext}
Root Cause: ${rca.rootCauseStatement}
Corrective Actions: ${correctiveCount}
Preventive Actions: ${preventiveCount}
RCA Status: ${rca.status}

Write a professional conclusion (3-4 sentences) that:
1. Summarizes the key investigation outcome
2. Confirms corrective and preventive actions are in place
3. States commitment to preventing recurrence
4. Notes any lessons learned or best practices identified

Make it suitable for presentation to executives and external auditors.`,
  };

  return prompts[section] || `Generate professional, detailed content for the ${section} section of this RCA report. Include full explanations suitable for audit review.`;
}

/**
 * Get default narrative when AI is unavailable
 */
function getDefaultNarrative(section: string, rca: any, incident: any): string {
  const capaCount = rca.CAPAction?.length || 0;
  const correctiveCount = rca.CAPAction?.filter((a: any) => a.actionType === 'CORRECTIVE')?.length || 0;
  const preventiveCount = rca.CAPAction?.filter((a: any) => a.actionType === 'PREVENTIVE')?.length || 0;

  const defaults: Record<string, string> = {
    executive_summary: `This report documents the comprehensive root cause analysis conducted for incident ${incident.incidentNumber}. The investigation team utilized ${rca.method === 'FIVE_WHYS' ? 'the 5 Whys methodology' : 'Fishbone (Ishikawa) analysis'} to systematically identify the underlying cause of this ${incident.severity?.toLowerCase() || ''} severity ${formatIncidentType(incident.type).toLowerCase()} incident. ${rca.rootCauseStatement ? `The root cause was determined to be: ${rca.rootCauseStatement}` : 'The investigation is ongoing to determine the root cause.'} A total of ${capaCount} corrective and preventive actions (${correctiveCount} corrective, ${preventiveCount} preventive) have been identified and are being implemented to address the root cause and prevent recurrence.`,
    
    incident_overview: `${incident.description || 'No description available.'}\n\nThe incident occurred at ${incident.Facility?.name || 'the facility'} ${incident.Area?.name ? `in the ${incident.Area.name} area` : ''}${incident.Line?.name ? ` on ${incident.Line.name}` : ''}. The incident was reported on ${formatDate(incident.reportedAt)} and has been classified as ${incident.severity || 'N/A'} severity. Immediate containment actions were taken to address any safety concerns and prevent further impact to operations.`,
    
    rca_findings: `The ${rca.method === 'FIVE_WHYS' ? '5 Whys' : 'Fishbone'} methodology was selected for this investigation to systematically trace the chain of events back to the fundamental cause. This approach ensures a thorough examination of all contributing factors.\n\n${rca.rootCauseStatement ? `Through careful analysis, the root cause was identified as: ${rca.rootCauseStatement}` : 'The investigation is currently in progress to identify the root cause.'}`,
    
    corrective_actions: `The investigation team has identified ${correctiveCount} corrective action(s) that directly address the root cause and eliminate the conditions that led to this incident. These actions focus on immediate remediation and restoration of safe operations. Each action has been assigned to a responsible owner with specific due dates to ensure timely completion and accountability.`,
    
    preventive_actions: `To prevent recurrence of similar incidents, ${preventiveCount} preventive action(s) have been identified. These actions address systemic factors and implement safeguards to reduce the likelihood of similar events in the future. The preventive measures include process improvements, enhanced controls, and where applicable, training and awareness programs.`,
    
    verification: `The effectiveness of all corrective and preventive actions will be verified through defined success criteria and monitoring periods. Actions will not be considered complete until verification confirms they are working as intended. Any actions found to be ineffective will be revised and re-implemented until satisfactory results are achieved. Documentation of verification activities will be maintained for audit purposes.`,
    
    conclusion: `The investigation for incident ${incident.incidentNumber} has been completed with appropriate corrective and preventive actions identified and assigned. The team is committed to completing all actions by their due dates and verifying effectiveness. Lessons learned from this investigation will be shared across the organization to prevent similar incidents. This report serves as the official documentation of the root cause analysis and is available for regulatory and audit review.`,
  };
  return defaults[section] || '';
}

// ============================================================================
// HELPER FUNCTIONS - Layout & Formatting
// ============================================================================

/**
 * Truncate text safely within boundaries
 */
function truncateText(text: string, maxLength: number): string {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Wrap text into multiple lines for slide content
 */
function wrapText(text: string, maxCharsPerLine: number): string[] {
  if (!text) return [''];
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  words.forEach(word => {
    if ((currentLine + ' ' + word).trim().length <= maxCharsPerLine) {
      currentLine = (currentLine + ' ' + word).trim();
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  });
  if (currentLine) lines.push(currentLine);
  return lines;
}

/**
 * Calculate if content fits in remaining slide space
 */
function contentFitsInSlide(currentY: number, contentHeight: number): boolean {
  return (currentY + contentHeight) <= SAFE_ZONE.MAX_Y;
}

/**
 * Format incident type for display
 */
function formatIncidentType(type: string): string {
  const types: Record<string, string> = {
    FOOD_SAFETY: 'Food Safety',
    WORKPLACE_SAFETY: 'Workplace Safety',
    MACHINE_EQUIPMENT: 'Machine & Equipment',
    QUALITY: 'Quality',
    ENVIRONMENTAL: 'Environmental',
  };
  return types[type] || type?.replace(/_/g, ' ') || 'Unknown';
}

/**
 * Format date for display
 */
function formatDate(date: string | Date | null | undefined): string {
  if (!date) return 'N/A';
  try {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return 'N/A';
  }
}

/**
 * Get severity color
 */
function getSeverityColor(severity: string): string {
  const colors: Record<string, string> = {
    CRITICAL: COLORS.danger,
    HIGH: 'dc2626',
    MEDIUM: COLORS.warning,
    LOW: COLORS.accent,
  };
  return colors[severity] || COLORS.text;
}

/**
 * Get status color
 */
function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    PLANNED: COLORS.muted,
    IN_PROGRESS: COLORS.secondary,
    COMPLETED: COLORS.accent,
    VERIFIED: '7c3aed',
    INEFFECTIVE: COLORS.danger,
    CLOSED: COLORS.dark,
    OPEN: COLORS.warning,
    UNDER_INVESTIGATION: COLORS.secondary,
  };
  return colors[status] || COLORS.text;
}

/**
 * Get priority color
 */
function getPriorityColor(priority: string): string {
  const colors: Record<string, string> = {
    CRITICAL: COLORS.danger,
    HIGH: 'dc2626',
    MEDIUM: COLORS.warning,
    LOW: COLORS.accent,
  };
  return colors[priority] || COLORS.text;
}

// ============================================================================
// SLIDE COMPONENTS - Reusable Building Blocks
// ============================================================================

/**
 * Add standard slide header with title and accent
 */
function addSlideHeader(slide: any, pptx: PptxGenJS, title: string, subtitle?: string, icon?: string): void {
  // Header background
  slide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: SLIDE.WIDTH,
    h: SLIDE.HEADER_HEIGHT,
    fill: { color: COLORS.primary },
  });

  // Icon and title
  const displayTitle = icon ? `${icon}  ${title}` : title;
  slide.addText(displayTitle, {
    x: SAFE_ZONE.X,
    y: 0.3,
    w: SAFE_ZONE.WIDTH,
    h: 0.6,
    fontSize: FONT.HEADER,
    bold: true,
    color: COLORS.white,
  });

  // Subtitle if provided
  if (subtitle) {
    slide.addText(subtitle, {
      x: SAFE_ZONE.X,
      y: 0.85,
      w: SAFE_ZONE.WIDTH,
      h: 0.3,
      fontSize: FONT.SMALL,
      color: COLORS.lighter,
    });
  }

  // Accent line
  slide.addShape(pptx.ShapeType.rect, {
    x: SAFE_ZONE.X,
    y: SLIDE.HEADER_HEIGHT - 0.1,
    w: 2,
    h: 0.06,
    fill: { color: COLORS.accent },
  });
}

/**
 * Add a section divider slide
 */
function createSectionDivider(pptx: PptxGenJS, title: string, subtitle: string, icon: string, color: string): void {
  const slide = pptx.addSlide();
  
  // Full background with section color
  slide.background = { color: color };

  // Large icon
  slide.addText(icon, {
    x: 0,
    y: 2.0,
    w: SLIDE.WIDTH,
    h: 1.2,
    fontSize: 72,
    align: 'center',
  });

  // Section title
  slide.addText(title, {
    x: SAFE_ZONE.X,
    y: 3.4,
    w: SAFE_ZONE.WIDTH,
    h: 1,
    fontSize: FONT.SECTION_TITLE,
    bold: true,
    color: COLORS.white,
    align: 'center',
  });

  // Divider line
  slide.addShape(pptx.ShapeType.rect, {
    x: 4,
    y: 4.5,
    w: 2,
    h: 0.04,
    fill: { color: COLORS.white },
  });

  // Subtitle
  slide.addText(subtitle, {
    x: SAFE_ZONE.X,
    y: 4.7,
    w: SAFE_ZONE.WIDTH,
    h: 0.6,
    fontSize: FONT.SUBHEADER,
    color: COLORS.lighter,
    align: 'center',
  });

  // Footer
  slide.addText('RCA Investigation Report', {
    x: SAFE_ZONE.X,
    y: 6.8,
    w: SAFE_ZONE.WIDTH,
    h: 0.3,
    fontSize: FONT.CAPTION,
    color: COLORS.lighter,
    align: 'center',
  });
}

/**
 * Add info box with icon
 */
function addInfoBox(
  slide: any,
  pptx: PptxGenJS,
  x: number,
  y: number,
  width: number,
  height: number,
  icon: string,
  label: string,
  value: string,
  valueColor?: string
): void {
  // Box background
  slide.addShape(pptx.ShapeType.roundRect, {
    x,
    y,
    w: width,
    h: height,
    fill: { color: COLORS.light },
    line: { color: COLORS.primaryLight, width: 1 },
  });

  // Icon
  slide.addText(icon, {
    x,
    y: y + 0.1,
    w: width,
    h: 0.35,
    fontSize: 16,
    align: 'center',
  });

  // Label
  slide.addText(label, {
    x,
    y: y + 0.45,
    w: width,
    h: 0.25,
    fontSize: FONT.CAPTION,
    color: COLORS.muted,
    align: 'center',
  });

  // Value
  slide.addText(truncateText(value, 20), {
    x: x + 0.05,
    y: y + 0.7,
    w: width - 0.1,
    h: 0.35,
    fontSize: FONT.BODY,
    bold: true,
    color: valueColor || COLORS.primary,
    align: 'center',
  });
}

/**
 * Add a callout box (highlighted content)
 */
function addCalloutBox(
  slide: any,
  pptx: PptxGenJS,
  x: number,
  y: number,
  width: number,
  height: number,
  title: string,
  content: string,
  bgColor: string,
  borderColor: string,
  textColor: string
): number {
  // Ensure we don't overflow
  const maxY = SAFE_ZONE.MAX_Y - 0.1;
  if (y + height > maxY) {
    height = maxY - y;
  }

  // Background
  slide.addShape(pptx.ShapeType.roundRect, {
    x,
    y,
    w: width,
    h: height,
    fill: { color: bgColor },
    line: { color: borderColor, width: 2 },
  });

  // Title
  slide.addText(title, {
    x: x + 0.15,
    y: y + 0.1,
    w: width - 0.3,
    h: 0.35,
    fontSize: FONT.SMALL,
    bold: true,
    color: borderColor,
  });

  // Content
  slide.addText(truncateText(content, Math.floor((width - 0.3) * (height - 0.5) * 15)), {
    x: x + 0.15,
    y: y + 0.45,
    w: width - 0.3,
    h: height - 0.55,
    fontSize: FONT.BODY,
    color: textColor,
    valign: 'top',
  });

  return y + height;
}

/**
 * Add a professional table
 */
function addProfessionalTable(
  slide: any,
  x: number,
  y: number,
  width: number,
  headers: string[],
  rows: any[][],
  colWidths: number[]
): number {
  const headerRow = headers.map(h => ({
    text: h,
    options: {
      bold: true,
      fill: COLORS.primary,
      color: COLORS.white,
      fontSize: FONT.SMALL,
      align: 'center' as const,
      valign: 'middle' as const,
    },
  }));

  const dataRows = rows.map((row, rowIdx) =>
    row.map((cell, colIdx) => ({
      text: typeof cell === 'string' ? cell : cell.text || '',
      options: {
        fill: rowIdx % 2 === 0 ? COLORS.white : COLORS.lighter,
        color: cell.color || COLORS.text,
        fontSize: FONT.SMALL,
        valign: 'middle' as const,
        ...(cell.options || {}),
      },
    }))
  );

  const tableData = [headerRow, ...dataRows];
  const tableHeight = tableData.length * SPACING.TABLE_ROW;

  // Ensure table doesn't overflow
  const maxRows = Math.floor((SAFE_ZONE.MAX_Y - y) / SPACING.TABLE_ROW) - 1;
  const displayData = tableData.slice(0, maxRows + 1); // +1 for header

  slide.addTable(displayData, {
    x,
    y,
    w: width,
    colW: colWidths,
    border: { pt: 0.5, color: COLORS.light },
    fontFace: 'Arial',
  });

  return y + displayData.length * SPACING.TABLE_ROW;
}

// ============================================================================
// TITLE SLIDE
// ============================================================================

/**
 * Create title slide
 */
function createTitleSlide(pptx: PptxGenJS, incident: any, rca: any): void {
  const slide = pptx.addSlide();
  
  // Full background
  slide.background = { color: COLORS.primary };

  // Company/Facility logo placeholder area
  slide.addShape(pptx.ShapeType.roundRect, {
    x: 4,
    y: 0.8,
    w: 2,
    h: 0.8,
    fill: { color: COLORS.primaryLight },
    line: { color: COLORS.white, width: 1 },
  });

  slide.addText('RCA', {
    x: 4,
    y: 0.85,
    w: 2,
    h: 0.7,
    fontSize: 24,
    bold: true,
    color: COLORS.white,
    align: 'center',
  });
  
  // Main title
  slide.addText('ROOT CAUSE ANALYSIS', {
    x: SAFE_ZONE.X,
    y: 2.0,
    w: SAFE_ZONE.WIDTH,
    h: 0.8,
    fontSize: FONT.TITLE_SLIDE,
    bold: true,
    color: COLORS.white,
    align: 'center',
  });

  slide.addText('INVESTIGATION REPORT', {
    x: SAFE_ZONE.X,
    y: 2.7,
    w: SAFE_ZONE.WIDTH,
    h: 0.6,
    fontSize: FONT.HEADER,
    color: COLORS.lighter,
    align: 'center',
  });

  // Divider
  slide.addShape(pptx.ShapeType.rect, {
    x: 3.5,
    y: 3.5,
    w: 3,
    h: 0.04,
    fill: { color: COLORS.accent },
  });

  // Incident number
  slide.addText(incident.incidentNumber, {
    x: SAFE_ZONE.X,
    y: 3.8,
    w: SAFE_ZONE.WIDTH,
    h: 0.6,
    fontSize: 28,
    bold: true,
    color: COLORS.white,
    align: 'center',
  });

  // Incident title
  const title = truncateText(incident.customTitle || incident.description || '', 100);
  slide.addText(title, {
    x: SAFE_ZONE.X,
    y: 4.4,
    w: SAFE_ZONE.WIDTH,
    h: 0.7,
    fontSize: FONT.SUBHEADER,
    color: COLORS.light,
    align: 'center',
  });

  // Key info boxes - positioned within safe slide area
  const boxWidth = 2.0;
  const boxGap = 0.3;
  const totalBoxesWidth = (boxWidth * 4) + (boxGap * 3);
  const boxStartX = (SLIDE.WIDTH - totalBoxesWidth) / 2; // Center the boxes
  const boxY = 5.1;
  const boxes = [
    { label: 'Type', value: formatIncidentType(incident.type), icon: ICONS.incident },
    { label: 'Severity', value: incident.severity || 'N/A', icon: ICONS.warning },
    { label: 'Method', value: rca.method === 'FIVE_WHYS' ? '5 Whys' : 'Fishbone', icon: ICONS.rca },
    { label: 'Status', value: rca.status?.replace(/_/g, ' ') || 'N/A', icon: ICONS.status },
  ];

  boxes.forEach((box, idx) => {
    const x = boxStartX + idx * (boxWidth + boxGap);
    
    slide.addShape(pptx.ShapeType.roundRect, {
      x,
      y: boxY,
      w: boxWidth,
      h: 1.0,
      fill: { color: COLORS.primaryDark },
      line: { color: COLORS.primaryLight, width: 1 },
    });

    slide.addText(box.icon, {
      x,
      y: boxY + 0.1,
      w: boxWidth,
      h: 0.3,
      fontSize: 14,
      align: 'center',
    });

    slide.addText(box.label, {
      x,
      y: boxY + 0.35,
      w: boxWidth,
      h: 0.25,
      fontSize: FONT.CAPTION,
      color: COLORS.muted,
      align: 'center',
    });

    slide.addText(box.value, {
      x,
      y: boxY + 0.6,
      w: boxWidth,
      h: 0.35,
      fontSize: FONT.BODY,
      bold: true,
      color: COLORS.white,
      align: 'center',
    });
  });

  // Footer - positioned at bottom with margin
  slide.addText(`${incident.Facility?.name || 'Organization'} | Generated: ${new Date().toLocaleDateString()}`, {
    x: SAFE_ZONE.X,
    y: 6.6,
    w: SAFE_ZONE.WIDTH,
    h: 0.3,
    fontSize: FONT.CAPTION,
    color: COLORS.muted,
    align: 'center',
  });
}

// ============================================================================
// TABLE OF CONTENTS SLIDE
// ============================================================================

/**
 * Create table of contents slide
 */
function createTOCSlide(pptx: PptxGenJS, rca: any): void {
  const slide = pptx.addSlide();
  addSlideHeader(slide, pptx, 'Table of Contents', 'Complete investigation structure', ICONS.summary);

  const correctiveCount = rca.CAPAction?.filter((a: any) => a.actionType === 'CORRECTIVE')?.length || 0;
  const preventiveCount = rca.CAPAction?.filter((a: any) => a.actionType === 'PREVENTIVE')?.length || 0;

  const tocItems = [
    { num: '01', title: 'Executive Summary', icon: ICONS.summary, desc: 'High-level overview and key findings' },
    { num: '02', title: 'Incident Details', icon: ICONS.details, desc: 'What happened, when, and where' },
    { num: '03', title: 'Root Cause Analysis', icon: ICONS.rca, desc: `${rca.method === 'FIVE_WHYS' ? '5 Whys' : 'Fishbone'} methodology and findings` },
    { num: '04', title: 'Corrective Actions', icon: ICONS.corrective, desc: `${correctiveCount} action(s) to address root cause` },
    { num: '05', title: 'Preventive Actions', icon: ICONS.preventive, desc: `${preventiveCount} action(s) to prevent recurrence` },
    { num: '06', title: 'Evidence & Documentation', icon: ICONS.evidence, desc: 'Supporting documents and attachments' },
    { num: '07', title: 'Verification & Closure', icon: ICONS.verification, desc: 'Effectiveness verification and sign-off' },
  ];

  tocItems.forEach((item, index) => {
    const yPos = SAFE_ZONE.Y + index * 0.65;
    
    // Number badge circle
    slide.addShape(pptx.ShapeType.ellipse, {
      x: SAFE_ZONE.X + 0.2,
      y: yPos,
      w: 0.5,
      h: 0.5,
      fill: { color: COLORS.primary },
    });

    slide.addText(item.num, {
      x: SAFE_ZONE.X + 0.2,
      y: yPos + 0.1,
      w: 0.5,
      h: 0.32,
      fontSize: FONT.SMALL,
      bold: true,
      color: COLORS.white,
      align: 'center',
    });

    // Icon
    slide.addText(item.icon, {
      x: SAFE_ZONE.X + 0.85,
      y: yPos + 0.05,
      w: 0.45,
      h: 0.4,
      fontSize: 16,
    });
    
    // Title
    slide.addText(item.title, {
      x: SAFE_ZONE.X + 1.4,
      y: yPos + 0.02,
      w: 4,
      h: 0.3,
      fontSize: FONT.SUBHEADER - 4,
      bold: true,
      color: COLORS.text,
    });

    // Description
    slide.addText(item.desc, {
      x: SAFE_ZONE.X + 1.4,
      y: yPos + 0.32,
      w: 6,
      h: 0.25,
      fontSize: FONT.CAPTION,
      color: COLORS.muted,
    });

    // Dotted line
    if (index < tocItems.length - 1) {
      slide.addShape(pptx.ShapeType.line, {
        x: SAFE_ZONE.X + 1.4,
        y: yPos + 0.6,
        w: 6.5,
        h: 0,
        line: { color: COLORS.light, width: 1, dashType: 'sysDot' },
      });
    }
  });

  // Footer note - positioned within safe zone
  slide.addShape(pptx.ShapeType.roundRect, {
    x: SAFE_ZONE.X,
    y: 5.95,
    w: SAFE_ZONE.WIDTH,
    h: 0.4,
    fill: { color: COLORS.secondaryLight },
    line: { color: COLORS.secondary, width: 1 },
  });

  slide.addText(`${ICONS.info} This report is confidential and intended for authorized personnel only.`, {
    x: SAFE_ZONE.X + 0.2,
    y: 6.0,
    w: SAFE_ZONE.WIDTH - 0.4,
    h: 0.3,
    fontSize: FONT.CAPTION,
    color: COLORS.secondary,
    align: 'center',
  });
}

// ============================================================================
// EXECUTIVE SUMMARY SLIDE
// ============================================================================

/**
 * Create executive summary slide
 */
async function createExecutiveSummarySlide(
  pptx: PptxGenJS,
  incident: any,
  rca: any,
  progressCallback?: ProgressCallback
): Promise<void> {
  progressCallback?.('generating_narrative', 15, 'Creating executive summary...');
  
  const slide = pptx.addSlide();
  addSlideHeader(slide, pptx, 'Executive Summary', 'Key findings and recommendations', ICONS.summary);

  const narrative = await generateSlideNarrative(rca, incident, 'executive_summary');

  // Summary text box with background
  slide.addShape(pptx.ShapeType.roundRect, {
    x: SAFE_ZONE.X,
    y: SAFE_ZONE.Y,
    w: SAFE_ZONE.WIDTH,
    h: 1.8,
    fill: { color: COLORS.lighter },
    line: { color: COLORS.light, width: 1 },
  });

  slide.addText(truncateText(narrative, 600), {
    x: SAFE_ZONE.X + 0.15,
    y: SAFE_ZONE.Y + 0.1,
    w: SAFE_ZONE.WIDTH - 0.3,
    h: 1.6,
    fontSize: FONT.BODY,
    color: COLORS.text,
    valign: 'top',
  });

  // Key metrics in styled boxes
  const metricsY = SAFE_ZONE.Y + 1.9;
  const boxWidth = 2.1;
  const boxHeight = 1.0;
  const correctiveCount = rca.CAPAction?.filter((a: any) => a.actionType === 'CORRECTIVE')?.length || 0;
  const preventiveCount = rca.CAPAction?.filter((a: any) => a.actionType === 'PREVENTIVE')?.length || 0;

  const metrics = [
    { label: 'Incident Date', value: formatDate(incident.occurredAt || incident.reportedAt), icon: ICONS.calendar, color: COLORS.primary },
    { label: 'Severity', value: incident.severity || 'N/A', icon: ICONS.warning, color: getSeverityColor(incident.severity) },
    { label: 'Corrective', value: `${correctiveCount}`, icon: ICONS.corrective, color: COLORS.success },
    { label: 'Preventive', value: `${preventiveCount}`, icon: ICONS.preventive, color: COLORS.preventive },
  ];

  metrics.forEach((metric, index) => {
    const xPos = SAFE_ZONE.X + index * (boxWidth + 0.2);
    addInfoBox(slide, pptx, xPos, metricsY, boxWidth, boxHeight, metric.icon, metric.label, metric.value, metric.color);
  });

  // Root cause highlight box
  if (rca.rootCauseStatement) {
    const rootCauseY = metricsY + boxHeight + 0.2;
    addCalloutBox(
      slide, pptx,
      SAFE_ZONE.X, rootCauseY,
      SAFE_ZONE.WIDTH, 1.1,
      `${ICONS.rca} ROOT CAUSE IDENTIFIED`,
      rca.rootCauseStatement,
      COLORS.warningLight,
      COLORS.warning,
      COLORS.text
    );
  }

  // Status indicator at bottom - constrained within slide
  const statusY = 5.7;
  const statusColors: Record<string, string> = {
    DRAFT: COLORS.muted,
    IN_PROGRESS: COLORS.secondary,
    PENDING_REVIEW: COLORS.warning,
    APPROVED: COLORS.success,
    CLOSED: COLORS.primary,
  };

  slide.addShape(pptx.ShapeType.roundRect, {
    x: SAFE_ZONE.X,
    y: statusY,
    w: SAFE_ZONE.WIDTH,
    h: 0.5,
    fill: { color: COLORS.light },
    line: { color: statusColors[rca.status] || COLORS.muted, width: 2 },
  });

  slide.addText(`${ICONS.status} Investigation Status: ${rca.status?.replace(/_/g, ' ') || 'N/A'}  |  ${ICONS.user} Lead: ${rca.User?.firstName || 'Unassigned'} ${rca.User?.lastName || ''}`, {
    x: SAFE_ZONE.X + 0.2,
    y: statusY + 0.1,
    w: SAFE_ZONE.WIDTH - 0.4,
    h: 0.32,
    fontSize: FONT.SMALL,
    color: COLORS.text,
    align: 'center',
  });
}

// ============================================================================
// INCIDENT DETAILS SLIDES
// ============================================================================

/**
 * Create incident details slides (may create multiple if content is long)
 */
async function createIncidentDetailsSlide(
  pptx: PptxGenJS,
  incident: any,
  progressCallback?: ProgressCallback
): Promise<void> {
  progressCallback?.('collecting_data', 25, 'Building incident details...');
  
  // Section divider
  createSectionDivider(pptx, 'Incident Details', 'What happened, when, and where', ICONS.details, COLORS.incident);
  
  // Main details slide
  const slide = pptx.addSlide();
  addSlideHeader(slide, pptx, 'Incident Overview', incident.incidentNumber, ICONS.details);

  // Two-column layout for key information
  const leftColX = SAFE_ZONE.X;
  const rightColX = SAFE_ZONE.X + 4.7;
  const colWidth = 4.3;
  let currentY = SAFE_ZONE.Y;

  // Left column - Basic Information with styled box
  slide.addShape(pptx.ShapeType.roundRect, {
    x: leftColX,
    y: currentY,
    w: colWidth,
    h: 2.5,
    fill: { color: COLORS.lighter },
    line: { color: COLORS.primary, width: 1 },
  });

  slide.addText(`${ICONS.info} Basic Information`, {
    x: leftColX + 0.1,
    y: currentY + 0.1,
    w: colWidth - 0.2,
    h: 0.35,
    fontSize: FONT.BODY,
    bold: true,
    color: COLORS.primary,
  });

  const basicInfo = [
    { label: 'Incident Number', value: incident.incidentNumber },
    { label: 'Type', value: formatIncidentType(incident.type) },
    { label: 'Category', value: incident.Category?.name || 'N/A' },
    { label: 'Severity', value: incident.severity, color: getSeverityColor(incident.severity) },
    { label: 'Status', value: incident.status?.replace(/_/g, ' ') || 'N/A' },
  ];

  basicInfo.forEach((item, index) => {
    const yPos = currentY + 0.5 + index * 0.38;
    slide.addText(`${item.label}:`, {
      x: leftColX + 0.15,
      y: yPos,
      w: 1.6,
      h: 0.35,
      fontSize: FONT.SMALL,
      bold: true,
      color: COLORS.muted,
    });
    slide.addText(truncateText(item.value || 'N/A', 30), {
      x: leftColX + 1.8,
      y: yPos,
      w: 2.3,
      h: 0.35,
      fontSize: FONT.SMALL,
      color: item.color || COLORS.text,
    });
  });

  // Right column - Location & Timeline with styled box
  slide.addShape(pptx.ShapeType.roundRect, {
    x: rightColX,
    y: currentY,
    w: colWidth,
    h: 2.5,
    fill: { color: COLORS.lighter },
    line: { color: COLORS.secondary, width: 1 },
  });

  slide.addText(`${ICONS.location} Location & Timeline`, {
    x: rightColX + 0.1,
    y: currentY + 0.1,
    w: colWidth - 0.2,
    h: 0.35,
    fontSize: FONT.BODY,
    bold: true,
    color: COLORS.secondary,
  });

  const locationInfo = [
    { label: 'Facility', value: incident.Facility?.name || incident.facilityName },
    { label: 'Department', value: incident.Department?.name || 'N/A' },
    { label: 'Area/Line', value: `${incident.Area?.name || incident.areaName || 'N/A'} / ${incident.Line?.name || incident.lineName || 'N/A'}` },
    { label: 'Occurred', value: formatDate(incident.occurredAt) },
    { label: 'Reported', value: formatDate(incident.reportedAt) },
  ];

  locationInfo.forEach((item, index) => {
    const yPos = currentY + 0.5 + index * 0.38;
    slide.addText(`${item.label}:`, {
      x: rightColX + 0.15,
      y: yPos,
      w: 1.3,
      h: 0.35,
      fontSize: FONT.SMALL,
      bold: true,
      color: COLORS.muted,
    });
    slide.addText(truncateText(item.value || 'N/A', 30), {
      x: rightColX + 1.5,
      y: yPos,
      w: 2.6,
      h: 0.35,
      fontSize: FONT.SMALL,
      color: COLORS.text,
    });
  });

  // Incident Description section
  currentY = SAFE_ZONE.Y + 2.7;
  
  slide.addText(`${ICONS.details} Incident Description`, {
    x: SAFE_ZONE.X,
    y: currentY,
    w: SAFE_ZONE.WIDTH,
    h: 0.35,
    fontSize: FONT.BODY + 2,
    bold: true,
    color: COLORS.primary,
  });

  slide.addShape(pptx.ShapeType.roundRect, {
    x: SAFE_ZONE.X,
    y: currentY + 0.4,
    w: SAFE_ZONE.WIDTH,
    h: 2.0,
    fill: { color: COLORS.light },
    line: { color: COLORS.light, width: 1 },
  });

  const description = incident.description || 'No description provided.';
  slide.addText(truncateText(description, 600), {
    x: SAFE_ZONE.X + 0.15,
    y: currentY + 0.5,
    w: SAFE_ZONE.WIDTH - 0.3,
    h: 1.8,
    fontSize: FONT.BODY,
    color: COLORS.text,
    valign: 'top',
  });

  // Reported by info at bottom - constrained
  const reporterY = 5.7;
  slide.addShape(pptx.ShapeType.roundRect, {
    x: SAFE_ZONE.X,
    y: reporterY,
    w: SAFE_ZONE.WIDTH,
    h: 0.45,
    fill: { color: COLORS.secondaryLight },
    line: { color: COLORS.secondary, width: 1 },
  });

  const reporter = incident.User_Incident_createdByIdToUser;
  slide.addText(`${ICONS.user} Reported by: ${reporter?.firstName || 'Unknown'} ${reporter?.lastName || ''} | Shift: ${incident.Shift?.name || 'N/A'}`, {
    x: SAFE_ZONE.X + 0.2,
    y: reporterY + 0.08,
    w: SAFE_ZONE.WIDTH - 0.4,
    h: 0.3,
    fontSize: FONT.SMALL,
    color: COLORS.secondary,
  });
}

// ============================================================================
// RCA METHODOLOGY SLIDES
// ============================================================================

/**
 * Create RCA methodology slide (5 Whys or Fishbone)
 */
async function createRCAMethodologySlide(
  pptx: PptxGenJS,
  rca: any,
  incident: any,
  progressCallback?: ProgressCallback
): Promise<void> {
  progressCallback?.('processing_rca', 40, 'Processing RCA analysis...');

  // Section divider
  createSectionDivider(pptx, 'Root Cause Analysis', `${rca.method === 'FIVE_WHYS' ? '5 Whys' : 'Fishbone'} Investigation`, ICONS.rca, COLORS.rca);

  if (rca.method === 'FIVE_WHYS') {
    await createFiveWhysSlides(pptx, rca, incident);
  } else if (rca.method === 'FISHBONE') {
    await createFishboneSlides(pptx, rca, incident);
  }
}

/**
 * Create 5 Whys analysis slides
 */
async function createFiveWhysSlides(pptx: PptxGenJS, rca: any, incident: any): Promise<void> {
  const slide = pptx.addSlide();
  addSlideHeader(slide, pptx, '5 Whys Analysis', 'Systematic root cause identification', ICONS.fiveWhys);

  const steps = rca.fiveWhysData?.steps || [];

  if (steps.length === 0) {
    slide.addText('No 5 Whys analysis data has been recorded yet.', {
      x: SAFE_ZONE.X,
      y: 3,
      w: SAFE_ZONE.WIDTH,
      h: 1,
      fontSize: FONT.SUBHEADER,
      color: COLORS.muted,
      align: 'center',
    });
    
    slide.addText('Complete the 5 Whys analysis in the RCA system to populate this section.', {
      x: SAFE_ZONE.X,
      y: 3.8,
      w: SAFE_ZONE.WIDTH,
      h: 0.5,
      fontSize: FONT.BODY,
      color: COLORS.muted,
      align: 'center',
    });
    return;
  }

  // Create visual 5 Whys flow
  const startY = SAFE_ZONE.Y + 0.1;
  const stepHeight = 0.85;
  const maxStepsPerSlide = 5;

  // Display steps
  const displaySteps = steps.slice(0, maxStepsPerSlide);
  displaySteps.forEach((step: any, index: number) => {
    const yPos = startY + index * stepHeight;
    const isLast = index === displaySteps.length - 1 && displaySteps.length === steps.length;

    // Step number circle
    slide.addShape(pptx.ShapeType.ellipse, {
      x: SAFE_ZONE.X,
      y: yPos,
      w: 0.5,
      h: 0.5,
      fill: { color: isLast ? COLORS.accent : COLORS.primary },
    });

    slide.addText(`${index + 1}`, {
      x: SAFE_ZONE.X,
      y: yPos + 0.08,
      w: 0.5,
      h: 0.35,
      fontSize: FONT.BODY + 2,
      bold: true,
      color: COLORS.white,
      align: 'center',
    });

    // Why label
    slide.addText(`WHY ${index + 1}:`, {
      x: SAFE_ZONE.X + 0.65,
      y: yPos,
      w: 1,
      h: 0.35,
      fontSize: FONT.SMALL,
      bold: true,
      color: COLORS.primary,
    });

    // Question
    slide.addText(truncateText(step.question || `Why did this happen?`, 80), {
      x: SAFE_ZONE.X + 1.65,
      y: yPos,
      w: 7,
      h: 0.35,
      fontSize: FONT.BODY,
      bold: true,
      color: COLORS.text,
    });

    // Answer box
    slide.addShape(pptx.ShapeType.roundRect, {
      x: SAFE_ZONE.X + 0.65,
      y: yPos + 0.35,
      w: 8,
      h: 0.4,
      fill: { color: index % 2 === 0 ? COLORS.lighter : COLORS.light },
    });

    slide.addText(`${ICONS.arrow} ${truncateText(step.answer || 'No answer provided', 120)}`, {
      x: SAFE_ZONE.X + 0.75,
      y: yPos + 0.38,
      w: 7.8,
      h: 0.35,
      fontSize: FONT.SMALL,
      color: COLORS.muted,
    });

    // Connecting arrow (except for last)
    if (index < displaySteps.length - 1) {
      slide.addText('↓', {
        x: SAFE_ZONE.X + 0.1,
        y: yPos + 0.6,
        w: 0.3,
        h: 0.25,
        fontSize: 12,
        color: COLORS.primary,
        align: 'center',
      });
    }
  });

  // Root cause box at bottom - constrained within slide boundaries (max Y + height must be < 7.0)
  if (rca.rootCauseStatement) {
    const rootCauseY = Math.min(startY + displaySteps.length * stepHeight + 0.2, 5.9);
    
    slide.addShape(pptx.ShapeType.roundRect, {
      x: SAFE_ZONE.X,
      y: rootCauseY,
      w: SAFE_ZONE.WIDTH,
      h: 0.9,
      fill: { color: COLORS.accent },
      line: { color: COLORS.success, width: 2 },
    });

    slide.addText(`${ICONS.check} ROOT CAUSE IDENTIFIED:`, {
      x: SAFE_ZONE.X + 0.15,
      y: rootCauseY + 0.08,
      w: SAFE_ZONE.WIDTH - 0.3,
      h: 0.25,
      fontSize: FONT.SMALL,
      bold: true,
      color: COLORS.white,
    });

    slide.addText(truncateText(rca.rootCauseStatement, 180), {
      x: SAFE_ZONE.X + 0.15,
      y: rootCauseY + 0.35,
      w: SAFE_ZONE.WIDTH - 0.3,
      h: 0.5,
      fontSize: FONT.BODY,
      color: COLORS.white,
    });
  }
}

/**
 * Create Fishbone diagram slides
 */
async function createFishboneSlides(pptx: PptxGenJS, rca: any, incident: any): Promise<void> {
  const slide = pptx.addSlide();
  addSlideHeader(slide, pptx, 'Fishbone (Ishikawa) Analysis', 'Cause and effect analysis', ICONS.fishbone);

  const categories = rca.fishboneData?.categories || [];

  if (categories.length === 0) {
    slide.addText('No Fishbone analysis data has been recorded yet.', {
      x: SAFE_ZONE.X,
      y: 3,
      w: SAFE_ZONE.WIDTH,
      h: 1,
      fontSize: FONT.SUBHEADER,
      color: COLORS.muted,
      align: 'center',
    });
    
    slide.addText('Complete the Fishbone analysis in the RCA system to populate this section.', {
      x: SAFE_ZONE.X,
      y: 3.8,
      w: SAFE_ZONE.WIDTH,
      h: 0.5,
      fontSize: FONT.BODY,
      color: COLORS.muted,
      align: 'center',
    });
    return;
  }

  // Create table showing categories and causes
  const headers = ['Category', 'Potential Causes', 'Likelihood'];
  const rows: any[][] = [];

  categories.forEach((cat: any) => {
    if (cat.causes && cat.causes.length > 0) {
      cat.causes.forEach((cause: any, idx: number) => {
        rows.push([
          { text: idx === 0 ? cat.name : '', options: { bold: idx === 0 } },
          { text: truncateText(typeof cause === 'string' ? cause : cause.text || '', 60) },
          { text: typeof cause === 'object' ? cause.likelihood || 'Medium' : 'Medium' },
        ]);
      });
    } else {
      rows.push([
        { text: cat.name, options: { bold: true } },
        { text: 'No causes identified', options: { color: COLORS.muted } },
        { text: '-' },
      ]);
    }
  });

  addProfessionalTable(slide, SAFE_ZONE.X, SAFE_ZONE.Y, SAFE_ZONE.WIDTH, headers, rows.slice(0, 10), [2.5, 5, 1.5]);

  // Primary root causes section
  const primaryCauses = rca.fishboneData?.primaryRootCauses || [];
  if (primaryCauses.length > 0) {
    const causesY = Math.min(SAFE_ZONE.Y + (rows.slice(0, 10).length + 1) * SPACING.TABLE_ROW + 0.4, 5.5);
    
    slide.addShape(pptx.ShapeType.roundRect, {
      x: SAFE_ZONE.X,
      y: causesY,
      w: SAFE_ZONE.WIDTH,
      h: Math.min(0.4 + primaryCauses.length * 0.35, 1.5),
      fill: { color: COLORS.accentLight },
      line: { color: COLORS.accent, width: 2 },
    });

    slide.addText(`${ICONS.check} Primary Root Causes Identified:`, {
      x: SAFE_ZONE.X + 0.15,
      y: causesY + 0.1,
      w: SAFE_ZONE.WIDTH - 0.3,
      h: 0.3,
      fontSize: FONT.BODY,
      bold: true,
      color: COLORS.success,
    });

    primaryCauses.slice(0, 3).forEach((cause: string, idx: number) => {
      slide.addText(`${ICONS.bullet} ${truncateText(cause, 100)}`, {
        x: SAFE_ZONE.X + 0.25,
        y: causesY + 0.4 + idx * 0.35,
        w: SAFE_ZONE.WIDTH - 0.5,
        h: 0.32,
        fontSize: FONT.SMALL,
        color: COLORS.text,
      });
    });
  }

  // Root cause statement at bottom if available
  if (rca.rootCauseStatement) {
    const rootY = 6.0;
    slide.addShape(pptx.ShapeType.roundRect, {
      x: SAFE_ZONE.X,
      y: rootY,
      w: SAFE_ZONE.WIDTH,
      h: 0.8,
      fill: { color: COLORS.accent },
    });

    slide.addText(`${ICONS.rca} Final Root Cause: ${truncateText(rca.rootCauseStatement, 150)}`, {
      x: SAFE_ZONE.X + 0.15,
      y: rootY + 0.2,
      w: SAFE_ZONE.WIDTH - 0.3,
      h: 0.5,
      fontSize: FONT.BODY,
      bold: true,
      color: COLORS.white,
    });
  }
}

/**
 * Create Fishbone diagram slide
 */
async function createFishboneSlide(pptx: PptxGenJS, rca: any, incident: any): Promise<void> {
  const slide = pptx.addSlide();
  addSlideHeader(slide, pptx, 'Fishbone (Ishikawa) Analysis');

  const categories = rca.fishboneData?.categories || [];

  if (categories.length === 0) {
    slide.addText('No Fishbone data available.', {
      x: 0.5,
      y: 3,
      w: 9,
      h: 1,
      fontSize: 16,
      color: COLORS.muted,
      align: 'center',
    });
    return;
  }

  // Create table-based Fishbone representation
  const tableData: any[][] = [
    [
      { text: 'Category', options: { bold: true, fill: COLORS.primary, color: COLORS.white } },
      { text: 'Potential Causes', options: { bold: true, fill: COLORS.primary, color: COLORS.white } },
      { text: 'Likelihood', options: { bold: true, fill: COLORS.primary, color: COLORS.white } },
    ],
  ];

  categories.forEach((cat: any) => {
    if (cat.causes && cat.causes.length > 0) {
      cat.causes.forEach((cause: any, idx: number) => {
        tableData.push([
          { text: idx === 0 ? cat.name : '', options: { bold: idx === 0 } },
          { text: cause.text || cause },
          { text: cause.likelihood || 'Medium' },
        ]);
      });
    } else {
      tableData.push([
        { text: cat.name, options: { bold: true } },
        { text: 'No causes identified' },
        { text: '-' },
      ]);
    }
  });

  slide.addTable(tableData, {
    x: 0.5,
    y: 1.5,
    w: 9,
    colW: [2.5, 5, 1.5],
    fontSize: 10,
    border: { pt: 0.5, color: COLORS.light },
    fill: { color: COLORS.white },
  });

  // Primary root causes
  const primaryCauses = rca.fishboneData?.primaryRootCauses || [];
  if (primaryCauses.length > 0) {
    const startY = 1.5 + (tableData.length * 0.4) + 0.3;
    
    slide.addText('Primary Root Causes:', {
      x: 0.5,
      y: startY,
      w: 9,
      h: 0.4,
      fontSize: 12,
      bold: true,
      color: COLORS.primary,
    });

    primaryCauses.forEach((cause: string, idx: number) => {
      slide.addText(`• ${cause}`, {
        x: 0.7,
        y: startY + 0.4 + idx * 0.35,
        w: 8.6,
        h: 0.35,
        fontSize: 11,
        color: COLORS.text,
      });
    });
  }
}

/**
 * Create CAPA Actions slides
 */
async function createCAPASlides(
  pptx: PptxGenJS,
  capaActions: any[],
  actionType: 'CORRECTIVE' | 'PREVENTIVE',
  progressCallback?: ProgressCallback
): Promise<void> {
  const progress = actionType === 'CORRECTIVE' ? 55 : 65;
  const title = actionType === 'CORRECTIVE' ? 'Corrective Actions' : 'Preventive Actions';
  
  progressCallback?.('formatting_capa', progress, `Creating ${title.toLowerCase()} slides...`);

  const filteredActions = capaActions.filter(a => a.actionType === actionType);

  if (filteredActions.length === 0) {
    const slide = pptx.addSlide();
    addSlideHeader(slide, pptx, title);
    slide.addText(`No ${title.toLowerCase()} have been defined.`, {
      x: 0.5,
      y: 3,
      w: 9,
      h: 1,
      fontSize: 16,
      color: COLORS.muted,
      align: 'center',
    });
    return;
  }

  // Create table for actions
  const slide = pptx.addSlide();
  addSlideHeader(slide, pptx, title);

  const tableData: any[][] = [
    [
      { text: 'Action', options: { bold: true, fill: COLORS.primary, color: COLORS.white } },
      { text: 'Owner', options: { bold: true, fill: COLORS.primary, color: COLORS.white } },
      { text: 'Due Date', options: { bold: true, fill: COLORS.primary, color: COLORS.white } },
      { text: 'Status', options: { bold: true, fill: COLORS.primary, color: COLORS.white } },
      { text: 'Priority', options: { bold: true, fill: COLORS.primary, color: COLORS.white } },
    ],
  ];

  filteredActions.slice(0, 8).forEach((action: any) => {
    tableData.push([
      { text: action.title?.substring(0, 50) + (action.title?.length > 50 ? '...' : '') || 'Untitled' },
      { text: action.User ? `${action.User.firstName} ${action.User.lastName}` : 'Unassigned' },
      { text: formatDate(action.dueDate) },
      { text: action.status?.replace('_', ' ') || 'N/A', options: { color: getStatusColor(action.status) } },
      { text: action.priority || 'N/A' },
    ]);
  });

  slide.addTable(tableData, {
    x: 0.5,
    y: 1.5,
    w: 9,
    colW: [3.5, 1.8, 1.3, 1.3, 1.1],
    fontSize: 10,
    border: { pt: 0.5, color: COLORS.light },
    fill: { color: COLORS.white },
  });

  // Add additional slides if more than 8 actions
  if (filteredActions.length > 8) {
    let pageNum = 2;
    for (let i = 8; i < filteredActions.length; i += 8) {
      const extraSlide = pptx.addSlide();
      addSlideHeader(extraSlide, pptx, `${title} (Page ${pageNum})`);
      
      const pageTableData: any[][] = [tableData[0]]; // Header row
      filteredActions.slice(i, i + 8).forEach((action: any) => {
        pageTableData.push([
          { text: action.title?.substring(0, 50) + (action.title?.length > 50 ? '...' : '') || 'Untitled' },
          { text: action.User ? `${action.User.firstName} ${action.User.lastName}` : 'Unassigned' },
          { text: formatDate(action.dueDate) },
          { text: action.status?.replace('_', ' ') || 'N/A', options: { color: getStatusColor(action.status) } },
          { text: action.priority || 'N/A' },
        ]);
      });

      extraSlide.addTable(pageTableData, {
        x: 0.5,
        y: 1.5,
        w: 9,
        colW: [3.5, 1.8, 1.3, 1.3, 1.1],
        fontSize: 10,
        border: { pt: 0.5, color: COLORS.light },
        fill: { color: COLORS.white },
      });

      pageNum++;
    }
  }

  // Summary stats
  const yPos = 1.5 + (Math.min(filteredActions.length, 8) + 1) * 0.4 + 0.5;
  
  slide.addText(`Total ${title}: ${filteredActions.length}`, {
    x: 0.5,
    y: yPos,
    w: 3,
    h: 0.4,
    fontSize: 11,
    bold: true,
    color: COLORS.primary,
  });

  const completed = filteredActions.filter(a => ['COMPLETED', 'VERIFIED'].includes(a.status)).length;
  slide.addText(`Completed: ${completed}/${filteredActions.length}`, {
    x: 3.5,
    y: yPos,
    w: 3,
    h: 0.4,
    fontSize: 11,
    color: COLORS.accent,
  });
}

/**
 * Create evidence documentation slide
 */
async function createEvidenceSlide(
  pptx: PptxGenJS,
  evidence: any[],
  progressCallback?: ProgressCallback
): Promise<void> {
  progressCallback?.('embedding_evidence', 75, 'Processing evidence and attachments...');

  const slide = pptx.addSlide();
  addSlideHeader(slide, pptx, 'Evidence & Documentation');

  if (!evidence || evidence.length === 0) {
    slide.addText('No evidence has been attached to this investigation.', {
      x: 0.5,
      y: 3,
      w: 9,
      h: 1,
      fontSize: 16,
      color: COLORS.muted,
      align: 'center',
    });
    return;
  }

  // Evidence table
  const tableData: any[][] = [
    [
      { text: '#', options: { bold: true, fill: COLORS.primary, color: COLORS.white } },
      { text: 'File Name', options: { bold: true, fill: COLORS.primary, color: COLORS.white } },
      { text: 'Type', options: { bold: true, fill: COLORS.primary, color: COLORS.white } },
      { text: 'Description', options: { bold: true, fill: COLORS.primary, color: COLORS.white } },
      { text: 'Uploaded', options: { bold: true, fill: COLORS.primary, color: COLORS.white } },
    ],
  ];

  evidence.slice(0, 10).forEach((item: any, idx: number) => {
    tableData.push([
      { text: `${idx + 1}` },
      { text: item.fileName?.substring(0, 30) + (item.fileName?.length > 30 ? '...' : '') || 'Unknown' },
      { text: item.type || 'Document' },
      { text: item.description?.substring(0, 40) + (item.description?.length > 40 ? '...' : '') || '-' },
      { text: formatDate(item.createdAt) },
    ]);
  });

  slide.addTable(tableData, {
    x: 0.5,
    y: 1.5,
    w: 9,
    colW: [0.5, 2.5, 1.5, 3, 1.5],
    fontSize: 10,
    border: { pt: 0.5, color: COLORS.light },
    fill: { color: COLORS.white },
  });

  // Note about evidence access
  const yPos = 1.5 + (Math.min(evidence.length, 10) + 1) * 0.4 + 0.3;
  
  slide.addShape(pptx.ShapeType.roundRect, {
    x: 0.5,
    y: yPos,
    w: 9,
    h: 0.7,
    fill: { color: 'e0f2fe' }, // Light blue
    line: { color: COLORS.secondary, width: 1 },
  });

  slide.addText('📎 Full evidence files are available in the RCA system. Contact your administrator for access.', {
    x: 0.7,
    y: yPos + 0.2,
    w: 8.6,
    h: 0.4,
    fontSize: 11,
    color: COLORS.secondary,
  });
}

/**
 * Create conclusion slide
 */
async function createConclusionSlide(
  pptx: PptxGenJS,
  rca: any,
  incident: any,
  progressCallback?: ProgressCallback
): Promise<void> {
  progressCallback?.('finalizing', 90, 'Creating conclusion...');

  const slide = pptx.addSlide();
  addSlideHeader(slide, pptx, 'Conclusions & Next Steps');

  const narrative = await generateSlideNarrative(rca, incident, 'conclusion');

  // Summary section
  slide.addText('Investigation Summary', {
    x: 0.5,
    y: 1.5,
    w: 9,
    h: 0.4,
    fontSize: 14,
    bold: true,
    color: COLORS.primary,
  });

  slide.addText(narrative, {
    x: 0.5,
    y: 2.0,
    w: 9,
    h: 1.2,
    fontSize: 12,
    color: COLORS.text,
    valign: 'top',
  });

  // Key outcomes
  const outcomes = [
    { icon: '🔍', label: 'Root Cause Identified', value: rca.rootCauseStatement ? 'Yes' : 'Pending' },
    { icon: '✅', label: 'RCA Validated', value: rca.isValidated ? 'Yes' : 'No' },
    { icon: '📋', label: 'CAPA Actions', value: `${rca.CAPAction?.length || 0} defined` },
    { icon: '📊', label: 'Status', value: rca.status?.replace('_', ' ') || 'N/A' },
  ];

  outcomes.forEach((item, idx) => {
    const xPos = 0.5 + idx * 2.4;
    
    slide.addShape(pptx.ShapeType.roundRect, {
      x: xPos,
      y: 3.3,
      w: 2.2,
      h: 1.1,
      fill: { color: COLORS.light },
      line: { color: COLORS.primary, width: 1 },
    });

    slide.addText(item.icon, {
      x: xPos,
      y: 3.4,
      w: 2.2,
      h: 0.35,
      fontSize: 18,
      align: 'center',
    });

    slide.addText(item.label, {
      x: xPos,
      y: 3.75,
      w: 2.2,
      h: 0.3,
      fontSize: 8,
      color: COLORS.muted,
      align: 'center',
    });

    slide.addText(item.value, {
      x: xPos,
      y: 4.05,
      w: 2.2,
      h: 0.3,
      fontSize: 10,
      bold: true,
      color: COLORS.primary,
      align: 'center',
    });
  });

  // Next steps
  slide.addText('Next Steps', {
    x: 0.5,
    y: 4.6,
    w: 9,
    h: 0.35,
    fontSize: 13,
    bold: true,
    color: COLORS.primary,
  });

  const nextSteps = [
    'Complete all pending CAPA actions by due dates',
    'Verify effectiveness of corrective actions',
    'Monitor for recurrence',
    'Update incident closure documentation',
  ];

  nextSteps.forEach((step, idx) => {
    slide.addText(`${idx + 1}. ${step}`, {
      x: 0.7,
      y: 5.0 + idx * 0.35,
      w: 8.6,
      h: 0.32,
      fontSize: 10,
      color: COLORS.text,
    });
  });
}

/**
 * Create thank you / closing slide
 */
function createClosingSlide(pptx: PptxGenJS, incident: any): void {
  const slide = pptx.addSlide();
  slide.background = { color: COLORS.primary };

  slide.addText('Thank You', {
    x: 0.5,
    y: 2.5,
    w: 9,
    h: 1,
    fontSize: 40,
    bold: true,
    color: COLORS.white,
    align: 'center',
  });

  slide.addText('Questions & Discussion', {
    x: 0.5,
    y: 3.6,
    w: 9,
    h: 0.6,
    fontSize: 20,
    color: COLORS.light,
    align: 'center',
  });

  slide.addShape(pptx.ShapeType.rect, {
    x: 4,
    y: 4.5,
    w: 2,
    h: 0.02,
    fill: { color: COLORS.accent },
  });

  slide.addText(`${incident.incidentNumber} | RCA Report`, {
    x: 0.5,
    y: 5.2,
    w: 9,
    h: 0.4,
    fontSize: 14,
    color: COLORS.light,
    align: 'center',
  });

  slide.addText(`Generated by DashMet Operations Intelligence | ${new Date().toLocaleDateString()}`, {
    x: 0.5,
    y: 6.5,
    w: 9,
    h: 0.3,
    fontSize: 10,
    color: COLORS.muted,
    align: 'center',
  });
}

// ============================================================================
// Main Export Functions
// ============================================================================

/**
 * Get full RCA data for PowerPoint generation
 */
export async function getRCADataForPowerPoint(rcaId: string): Promise<RCAData | null> {
  try {
    const rca = await prisma.rCAAnalysis.findUnique({
      where: { id: rcaId },
      include: {
        Incident: {
          include: {
            Category: true,
            Facility: true,
            Department: true,
            Area: true,
            Line: true,
            Shift: true,
            Evidence: true,
            User_Incident_createdByIdToUser: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        User: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        Evidence: true,
        CAPAction: {
          include: {
            User: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
          orderBy: [
            { priority: 'desc' },
            { dueDate: 'asc' },
          ],
        },
      },
    });

    if (!rca) return null;

    // Combine all evidence
    const allEvidence = [
      ...(rca.Incident?.Evidence || []),
      ...(rca.Evidence || []),
    ];

    return {
      rca,
      incident: rca.Incident,
      capaActions: rca.CAPAction || [],
      evidence: allEvidence,
    };
  } catch (error: any) {
    console.error('Failed to get RCA data for PowerPoint:', error.message);
    return null;
  }
}

/**
 * Generate PowerPoint presentation for RCA
 */
export async function generateRCAPowerPoint(
  rcaId: string,
  progressCallback?: ProgressCallback
): Promise<GenerationResult> {
  try {
    progressCallback?.('initializing', 5, 'Initializing PowerPoint generation...');

    // Get RCA data
    const data = await getRCADataForPowerPoint(rcaId);
    if (!data) {
      return { success: false, error: 'RCA not found or access denied' };
    }

    const { rca, incident, capaActions, evidence } = data;

    progressCallback?.('collecting_data', 10, 'Collecting incident data...');

    // Initialize PowerPoint with 4:3 layout (10" x 7.5")
    const pptx = new PptxGenJS();
    pptx.layout = 'LAYOUT_4x3';  // Sets slide to 10" x 7.5"
    pptx.author = 'DashMet Operations Intelligence';
    pptx.title = `RCA Report - ${incident.incidentNumber}`;
    pptx.subject = `Root Cause Analysis for ${incident.customTitle || incident.description?.substring(0, 50)}`;
    pptx.company = incident.Facility?.name || 'Organization';

    // Create slides
    createTitleSlide(pptx, incident, rca);
    createTOCSlide(pptx, rca);
    await createExecutiveSummarySlide(pptx, incident, rca, progressCallback);
    await createIncidentDetailsSlide(pptx, incident, progressCallback);
    await createRCAMethodologySlide(pptx, rca, incident, progressCallback);
    await createCAPASlides(pptx, capaActions, 'CORRECTIVE', progressCallback);
    await createCAPASlides(pptx, capaActions, 'PREVENTIVE', progressCallback);
    await createEvidenceSlide(pptx, evidence, progressCallback);
    await createConclusionSlide(pptx, rca, incident, progressCallback);
    createClosingSlide(pptx, incident);

    progressCallback?.('generating_file', 95, 'Generating PowerPoint file...');

    // Generate file
    const fileName = `RCA_Report_${incident.incidentNumber}_${Date.now()}.pptx`;
    const outputDir = path.join(process.cwd(), 'uploads', 'powerpoint');
    
    // Ensure directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const filePath = path.join(outputDir, fileName);
    
    // Write file
    await pptx.writeFile({ fileName: filePath });

    // Get file size
    const stats = fs.statSync(filePath);

    progressCallback?.('complete', 100, 'PowerPoint generation complete!');

    return {
      success: true,
      filePath,
      fileName,
      fileSize: stats.size,
    };
  } catch (error: any) {
    console.error('PowerPoint generation failed:', error);
    return {
      success: false,
      error: error.message || 'Unknown error during PowerPoint generation',
    };
  }
}
