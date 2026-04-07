// Attachment Analysis Service
// AI-powered analysis of uploaded evidence attachments (images, documents, PDFs, etc.)
// Uses OpenAI GPT-4 Vision for image analysis and text extraction for documents

import OpenAI from 'openai';
import { sanitizeForPrompt, sanitizeForSystemPrompt, wrapUserContent } from '../utils/promptSanitizer';
import axios from 'axios';

// Lazy load pdf-parse to avoid DOMMatrix error on import
let pdfParse: any = null;
async function getPdfParser() {
  if (!pdfParse) {
    // Dynamic import to avoid loading pdfjs-dist at module load time
    pdfParse = require('pdf-parse');
  }
  return pdfParse;
}

// Lazy initialization of OpenAI client
function getOpenAIClient(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

export interface AttachmentInfo {
  filename: string;
  type: 'PHOTO' | 'VIDEO' | 'DOCUMENT' | 'VOICE_RECORDING';
  mimeType: string;
  fileUrl: string;
  transcription?: string; // For voice recordings
  description?: string;
}

export interface AttachmentAnalysisResult {
  filename: string;
  type: string;
  analysisStatus: 'success' | 'partial' | 'failed';
  findings: string[];
  extractedText?: string;
  visualElements?: string[];
  riskIndicators?: string[];
  relevanceToIncident: 'high' | 'medium' | 'low' | 'unknown';
  summary: string;
  error?: string;
}

export interface ComprehensiveAnalysisResult {
  attachmentAnalyses: AttachmentAnalysisResult[];
  consolidatedFindings: string[];
  evidenceCorrelations: string[];
  riskAssessment: {
    level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    factors: string[];
  };
  recommendedActions: string[];
  analysisConfidence: number; // 0-100
  overallSummary: string;
}

/**
 * Analyze an image attachment using GPT-4 Vision
 */
async function analyzeImage(
  imageUrl: string,
  incidentContext: string,
  incidentType: string
): Promise<{ findings: string[]; visualElements: string[]; summary: string }> {
  const openai = getOpenAIClient();
  if (!openai) {
    throw new Error('OpenAI client not available');
  }

  try {
    let base64Image: string;
    let mimeType: string;

    // Check if imageUrl is already a base64 data URL
    if (imageUrl.startsWith('data:')) {
      // Parse the data URL: data:[mimeType];base64,[data]
      const matches = imageUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (!matches) {
        throw new Error('Invalid data URL format');
      }
      mimeType = matches[1];
      base64Image = matches[2];
    } else if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
      // Fetch remote image and convert to base64
      const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
      base64Image = Buffer.from(response.data).toString('base64');
      mimeType = response.headers['content-type'] || 'image/jpeg';
    } else {
      throw new Error(`Unsupported protocol: ${imageUrl.substring(0, 30)}...`);
    }

    const typeContextMap: Record<string, string> = {
      'FOOD_SAFETY': 'food safety, contamination, sanitation, product quality, allergen control, packaging integrity, foreign material, pest evidence, temperature abuse, cross-contamination',
      'MACHINE_EQUIPMENT': 'equipment failure, mechanical damage, wear patterns, safety hazards, electrical issues, fluid leaks, structural damage, component failure, maintenance issues',
      'WORKPLACE_SAFETY': 'workplace hazards, injury evidence, unsafe conditions, PPE compliance, ergonomic issues, slip/trip/fall hazards, chemical exposure, physical hazards, safety violations'
    };

    const completion = await openai.chat.completions.create({
      model: process.env.AI_MODEL || 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are an expert forensic analyst and safety investigator specializing in ${typeContextMap[incidentType] || 'industrial incident analysis'}. 
          
Analyze the provided image as evidence for an incident investigation. Your analysis must be:
- OBJECTIVE: Report only what you can clearly observe
- TECHNICAL: Use proper industry terminology
- THOROUGH: Identify all relevant details, even subtle ones
- EVIDENCE-FOCUSED: Note anything that could support or contradict the incident report
- RISK-AWARE: Identify any safety hazards or compliance concerns visible

For each observation, note its potential relevance to the reported incident.`
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `INCIDENT CONTEXT:\n${wrapUserContent(sanitizeForPrompt(incidentContext, { maxLength: 2000, context: 'image-incident-context' }), 'incident_context')}\n\nAnalyze this image as evidence for the incident described above. Provide:\n\n1. KEY FINDINGS: List specific observations relevant to the incident (bullet points)\n2. VISUAL ELEMENTS: Describe what is depicted (equipment, areas, conditions, people/PPE if visible)\n3. RISK INDICATORS: Identify any safety hazards, compliance issues, or concerning conditions\n4. EVIDENCE VALUE: How this image supports or contradicts the incident narrative\n5. BRIEF SUMMARY: 2-3 sentence professional summary of the image evidence\n\nBe specific and factual. Do not speculate beyond what is visible.`
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${base64Image}`,
                detail: 'high'
              }
            }
          ]
        }
      ],
      max_completion_tokens: 1000,
      temperature: 0.2
    });

    const analysisText = completion.choices[0]?.message?.content || '';
    
    // Parse the structured response
    const findings: string[] = [];
    const visualElements: string[] = [];
    let summary = '';

    // Extract findings
    const findingsMatch = analysisText.match(/KEY FINDINGS:?([\s\S]*?)(?=VISUAL ELEMENTS:|RISK INDICATORS:|$)/i);
    if (findingsMatch) {
      const findingsSection = findingsMatch[1];
      const bulletPoints = findingsSection.match(/[-•*]\s*(.+)/g);
      if (bulletPoints) {
        bulletPoints.forEach(point => {
          findings.push(point.replace(/^[-•*]\s*/, '').trim());
        });
      }
    }

    // Extract visual elements
    const visualMatch = analysisText.match(/VISUAL ELEMENTS:?([\s\S]*?)(?=RISK INDICATORS:|EVIDENCE VALUE:|$)/i);
    if (visualMatch) {
      const visualSection = visualMatch[1];
      visualElements.push(visualSection.trim().replace(/\n+/g, ' '));
    }

    // Extract summary
    const summaryMatch = analysisText.match(/(?:BRIEF SUMMARY|SUMMARY):?([\s\S]*?)$/i);
    if (summaryMatch) {
      summary = summaryMatch[1].trim();
    } else {
      // Use last paragraph as summary if no explicit section
      const paragraphs = analysisText.split(/\n\n+/);
      summary = paragraphs[paragraphs.length - 1]?.trim() || analysisText.substring(0, 300);
    }

    // If no findings were parsed, treat the whole response as findings
    if (findings.length === 0) {
      findings.push(analysisText.substring(0, 500));
    }

    return { findings, visualElements, summary };
  } catch (error: any) {
    console.error('Image analysis failed:', error.message);
    throw error;
  }
}

/**
 * Extract and analyze text from a PDF document
 */
async function analyzePDF(
  pdfUrl: string,
  incidentContext: string,
  incidentType: string
): Promise<{ extractedText: string; findings: string[]; summary: string }> {
  const openai = getOpenAIClient();
  if (!openai) {
    throw new Error('OpenAI client not available');
  }

  try {
    let pdfBuffer: Buffer;

    // Check if pdfUrl is already a base64 data URL
    if (pdfUrl.startsWith('data:')) {
      // Parse the data URL: data:[mimeType];base64,[data]
      const matches = pdfUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (!matches) {
        throw new Error('Invalid data URL format for PDF');
      }
      pdfBuffer = Buffer.from(matches[2], 'base64');
    } else if (pdfUrl.startsWith('http://') || pdfUrl.startsWith('https://')) {
      // Fetch remote PDF
      const response = await axios.get(pdfUrl, { responseType: 'arraybuffer' });
      pdfBuffer = Buffer.from(response.data);
    } else {
      throw new Error(`Unsupported protocol for PDF: ${pdfUrl.substring(0, 30)}...`);
    }
    
    // Extract text from PDF using lazy-loaded parser
    const parser = await getPdfParser();
    const pdfData = await parser(pdfBuffer);
    const extractedText = pdfData.text?.substring(0, 10000) || ''; // Limit to 10k chars

    if (!extractedText || extractedText.trim().length < 50) {
      return {
        extractedText: '',
        findings: ['Unable to extract meaningful text from PDF - may be image-based or encrypted'],
        summary: 'PDF content could not be extracted for analysis.'
      };
    }

    // Analyze extracted text with AI
    const completion = await openai.chat.completions.create({
      model: process.env.AI_MODEL || 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are an expert document analyst specializing in incident investigation and safety compliance. Analyze document content to extract relevant information for Root Cause Analysis.`
        },
        {
          role: 'user',
          content: `INCIDENT CONTEXT:\n${wrapUserContent(sanitizeForPrompt(incidentContext, { maxLength: 2000, context: 'pdf-incident-context' }), 'incident_context')}\n\nDOCUMENT CONTENT:\n${wrapUserContent(sanitizeForPrompt(extractedText, { maxLength: 10000, context: 'pdf-extracted-text' }), 'document_content')}\n\nAnalyze this document as evidence. Identify:\n1. KEY INFORMATION: Relevant facts, dates, names, procedures mentioned\n2. COMPLIANCE INDICATORS: Any references to standards, regulations, SOPs\n3. EVIDENCE VALUE: How this document relates to the incident\n4. RISK FACTORS: Any warnings, violations, or concerns documented\n5. BRIEF SUMMARY: 2-3 sentence summary of the document's relevance\n\nBe concise and factual.`
        }
      ],
      max_completion_tokens: 800,
      temperature: 0.2
    });

    const analysisText = completion.choices[0]?.message?.content || '';
    
    // Parse findings from the analysis
    const findings: string[] = [];
    const bulletPoints = analysisText.match(/[-•*]\s*(.+)/g);
    if (bulletPoints) {
      bulletPoints.forEach(point => {
        findings.push(point.replace(/^[-•*]\s*/, '').trim());
      });
    }
    if (findings.length === 0) {
      findings.push(analysisText.substring(0, 300));
    }

    // Extract summary
    const summaryMatch = analysisText.match(/(?:BRIEF SUMMARY|SUMMARY):?([\s\S]*?)$/i);
    const summary = summaryMatch ? summaryMatch[1].trim() : analysisText.substring(0, 200);

    return { extractedText: extractedText.substring(0, 2000), findings, summary };
  } catch (error: any) {
    console.error('PDF analysis failed:', error.message);
    throw error;
  }
}

/**
 * Analyze a single attachment
 */
export async function analyzeAttachment(
  attachment: AttachmentInfo,
  incidentContext: string,
  incidentType: string
): Promise<AttachmentAnalysisResult> {
  const result: AttachmentAnalysisResult = {
    filename: attachment.filename,
    type: attachment.type,
    analysisStatus: 'failed',
    findings: [],
    relevanceToIncident: 'unknown',
    summary: ''
  };

  try {
    const mimeType = attachment.mimeType.toLowerCase();

    // Handle images (photos)
    if (attachment.type === 'PHOTO' || mimeType.startsWith('image/')) {
      const analysis = await analyzeImage(attachment.fileUrl, incidentContext, incidentType);
      result.findings = analysis.findings;
      result.visualElements = analysis.visualElements;
      result.summary = analysis.summary;
      result.analysisStatus = 'success';
      result.relevanceToIncident = analysis.findings.length > 2 ? 'high' : 'medium';
    }
    // Handle PDFs
    else if (mimeType === 'application/pdf') {
      const analysis = await analyzePDF(attachment.fileUrl, incidentContext, incidentType);
      result.findings = analysis.findings;
      result.extractedText = analysis.extractedText;
      result.summary = analysis.summary;
      result.analysisStatus = analysis.extractedText ? 'success' : 'partial';
      result.relevanceToIncident = analysis.findings.length > 1 ? 'medium' : 'low';
    }
    // Handle voice recordings with transcription
    else if (attachment.type === 'VOICE_RECORDING' && attachment.transcription) {
      result.extractedText = attachment.transcription;
      result.findings = [`Voice recording transcription available: "${attachment.transcription.substring(0, 200)}..."`];
      result.summary = `Audio evidence with transcription: ${attachment.transcription.substring(0, 150)}...`;
      result.analysisStatus = 'success';
      result.relevanceToIncident = 'medium';
    }
    // Handle documents (Word, PowerPoint, etc.) - provide metadata analysis
    else if (attachment.type === 'DOCUMENT') {
      result.findings = [
        `Document attachment: ${attachment.filename}`,
        `File type: ${attachment.mimeType}`,
        'Note: Full content extraction requires additional processing'
      ];
      result.summary = `Document "${attachment.filename}" attached as supporting evidence. Manual review recommended for full content analysis.`;
      result.analysisStatus = 'partial';
      result.relevanceToIncident = 'medium';
    }
    // Handle videos - metadata only
    else if (attachment.type === 'VIDEO' || mimeType.startsWith('video/')) {
      result.findings = [
        `Video attachment: ${attachment.filename}`,
        `Format: ${attachment.mimeType}`,
        'Video requires manual review for visual evidence'
      ];
      result.summary = `Video evidence "${attachment.filename}" attached. Manual review recommended to assess visual content.`;
      result.analysisStatus = 'partial';
      result.relevanceToIncident = 'medium';
    }
    else {
      result.findings = [`Attachment "${attachment.filename}" - type not supported for automated analysis`];
      result.summary = `File attached but requires manual review.`;
      result.analysisStatus = 'partial';
    }

  } catch (error: any) {
    result.error = error.message;
    result.findings = [`Analysis failed: ${error.message}`];
    result.summary = `Unable to analyze attachment: ${attachment.filename}`;
    result.analysisStatus = 'failed';
  }

  return result;
}

/**
 * Analyze all attachments and correlate with incident data
 */
export async function analyzeAllAttachments(
  attachments: AttachmentInfo[],
  incidentData: {
    type: string;
    category: string;
    description: string;
    facility?: string;
    area?: string;
    severity?: string;
    additionalContext?: string;
  }
): Promise<ComprehensiveAnalysisResult> {
  const openai = getOpenAIClient();
  
  // Build incident context for analysis
  const incidentContext = `
INCIDENT TYPE: ${incidentData.type.replace('_', ' ')}
CATEGORY: ${incidentData.category}
FACILITY: ${incidentData.facility || 'Not specified'}
AREA: ${incidentData.area || 'Not specified'}
DESCRIPTION: ${incidentData.description}
${incidentData.additionalContext ? `ADDITIONAL CONTEXT: ${incidentData.additionalContext}` : ''}
`.trim();

  // Analyze each attachment
  const attachmentAnalyses: AttachmentAnalysisResult[] = [];
  
  for (const attachment of attachments) {
    try {
      const analysis = await analyzeAttachment(attachment, incidentContext, incidentData.type);
      attachmentAnalyses.push(analysis);
    } catch (error: any) {
      attachmentAnalyses.push({
        filename: attachment.filename,
        type: attachment.type,
        analysisStatus: 'failed',
        findings: [`Analysis failed: ${error.message}`],
        relevanceToIncident: 'unknown',
        summary: `Unable to analyze ${attachment.filename}`
      });
    }
  }

  // Consolidate findings across all attachments
  const allFindings = attachmentAnalyses.flatMap(a => a.findings);
  const successfulAnalyses = attachmentAnalyses.filter(a => a.analysisStatus === 'success');

  // Calculate analysis confidence
  const totalAttachments = attachments.length;
  const successCount = successfulAnalyses.length;
  const partialCount = attachmentAnalyses.filter(a => a.analysisStatus === 'partial').length;
  const analysisConfidence = totalAttachments > 0 
    ? Math.round(((successCount * 100) + (partialCount * 50)) / totalAttachments)
    : 0;

  // If we have findings, use AI to correlate and assess risk
  let evidenceCorrelations: string[] = [];
  let riskFactors: string[] = [];
  let recommendedActions: string[] = [];
  let overallSummary = '';
  let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';

  if (openai && allFindings.length > 0 && successfulAnalyses.length > 0) {
    try {
      const consolidationPrompt = `
INCIDENT CONTEXT:
${wrapUserContent(sanitizeForPrompt(incidentContext, { maxLength: 2000, context: 'consolidation-context' }), 'incident_context')}

ATTACHMENT ANALYSIS FINDINGS:
${attachmentAnalyses.map(a => `
--- ${sanitizeForPrompt(a.filename, { maxLength: 200, context: 'attachment-name' })} (${a.type}) ---
Status: ${a.analysisStatus}
Findings: ${sanitizeForPrompt(a.findings.join('; '), { maxLength: 1000, context: 'attachment-findings' })}
Summary: ${sanitizeForPrompt(a.summary, { maxLength: 500, context: 'attachment-summary' })}
`).join('\n')}

Based on the incident description and the attachment analyses above, provide:

1. EVIDENCE CORRELATIONS: How do the attachments support or contradict the incident narrative? (3-5 points)
2. RISK ASSESSMENT: Overall risk level (LOW/MEDIUM/HIGH/CRITICAL) and key risk factors
3. RECOMMENDED ACTIONS: Based on evidence, what should be investigated further? (3-5 points)
4. OVERALL SUMMARY: A comprehensive 3-4 sentence summary integrating incident data with attachment evidence

Format your response exactly as:
CORRELATIONS:
- [correlation 1]
- [correlation 2]
...

RISK_LEVEL: [LOW/MEDIUM/HIGH/CRITICAL]
RISK_FACTORS:
- [factor 1]
- [factor 2]
...

ACTIONS:
- [action 1]
- [action 2]
...

SUMMARY:
[Your comprehensive summary here]
`;

      const completion = await openai.chat.completions.create({
        model: process.env.AI_MODEL || 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are a senior incident investigator synthesizing evidence from multiple sources. Provide objective, actionable analysis.'
          },
          {
            role: 'user',
            content: consolidationPrompt
          }
        ],
        max_completion_tokens: 1000,
        temperature: 0.2
      });

      const responseText = completion.choices[0]?.message?.content || '';

      // Parse correlations
      const correlationsMatch = responseText.match(/CORRELATIONS:([\s\S]*?)(?=RISK_LEVEL:|$)/i);
      if (correlationsMatch) {
        const bullets = correlationsMatch[1].match(/[-•*]\s*(.+)/g);
        evidenceCorrelations = bullets?.map(b => b.replace(/^[-•*]\s*/, '').trim()) || [];
      }

      // Parse risk level
      const riskLevelMatch = responseText.match(/RISK_LEVEL:\s*(LOW|MEDIUM|HIGH|CRITICAL)/i);
      if (riskLevelMatch) {
        riskLevel = riskLevelMatch[1].toUpperCase() as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
      }

      // Parse risk factors
      const riskFactorsMatch = responseText.match(/RISK_FACTORS:([\s\S]*?)(?=ACTIONS:|$)/i);
      if (riskFactorsMatch) {
        const bullets = riskFactorsMatch[1].match(/[-•*]\s*(.+)/g);
        riskFactors = bullets?.map(b => b.replace(/^[-•*]\s*/, '').trim()) || [];
      }

      // Parse actions
      const actionsMatch = responseText.match(/ACTIONS:([\s\S]*?)(?=SUMMARY:|$)/i);
      if (actionsMatch) {
        const bullets = actionsMatch[1].match(/[-•*]\s*(.+)/g);
        recommendedActions = bullets?.map(b => b.replace(/^[-•*]\s*/, '').trim()) || [];
      }

      // Parse summary
      const summaryMatch = responseText.match(/SUMMARY:([\s\S]*?)$/i);
      if (summaryMatch) {
        overallSummary = summaryMatch[1].trim();
      }

    } catch (error: any) {
      console.error('Failed to consolidate attachment analyses:', error.message);
      overallSummary = `Analysis of ${attachments.length} attachment(s) completed with ${successCount} fully analyzed. Manual review recommended for complete assessment.`;
    }
  } else {
    overallSummary = attachments.length > 0 
      ? `${attachments.length} attachment(s) provided. ${successCount > 0 ? `${successCount} successfully analyzed.` : 'AI analysis unavailable - manual review required.'}`
      : 'No attachments provided for analysis.';
  }

  return {
    attachmentAnalyses,
    consolidatedFindings: allFindings.slice(0, 20), // Limit to top 20 findings
    evidenceCorrelations,
    riskAssessment: {
      level: riskLevel,
      factors: riskFactors
    },
    recommendedActions,
    analysisConfidence,
    overallSummary
  };
}

/**
 * Generate an enhanced incident summary incorporating attachment analysis
 */
export async function generateEnhancedSummaryWithAttachments(
  incidentData: {
    type: string;
    category: string;
    subcategory?: string;
    description: string;
    facility?: string;
    area?: string;
    line?: string;
    product?: string;
    machineId?: string;
    severity?: string;
    occurredAt?: string;
    // Workplace safety specific
    injuryType?: string;
    bodyPartsAffected?: string[];
    taskBeingPerformed?: string;
    ppeWorn?: boolean;
    directCause?: string;
    additionalFields?: Record<string, any>;
  },
  attachmentAnalysis: ComprehensiveAnalysisResult
): Promise<{
  summary: string;
  suggestedSeverity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  evidenceSummary: string;
  keyFindings: string[];
  investigationGuidance: string[];
  recommendedRCAMethodology: {
    primary: 'FIVE_WHYS' | 'FISHBONE';
    reason: string;
    confidence: number;
    alternativeMethod?: 'FIVE_WHYS' | 'FISHBONE';
    alternativeReason?: string;
  };
}> {
  const openai = getOpenAIClient();
  
  if (!openai) {
    return {
      summary: 'AI summary generation unavailable. Please contact your system administrator.',
      suggestedSeverity: attachmentAnalysis.riskAssessment.level || 'MEDIUM',
      evidenceSummary: attachmentAnalysis.overallSummary,
      keyFindings: attachmentAnalysis.consolidatedFindings.slice(0, 5),
      investigationGuidance: ['Manual review of all attachments recommended'],
      recommendedRCAMethodology: {
        primary: 'FIVE_WHYS',
        reason: 'Default recommendation when AI is unavailable. 5 Whys is a good starting point for most incidents.',
        confidence: 50,
      }
    };
  }

  try {
    const typeLabels: Record<string, string> = {
      'FOOD_SAFETY': 'Food Safety / Quality',
      'MACHINE_EQUIPMENT': 'Machine & Equipment',
      'WORKPLACE_SAFETY': 'Workplace Safety / Employee Injury'
    };

    const prompt = `
=== INCIDENT REPORT DATA ===

INCIDENT TYPE: ${typeLabels[incidentData.type] || incidentData.type}
CATEGORY: ${incidentData.category}${incidentData.subcategory ? ` > ${incidentData.subcategory}` : ''}
FACILITY: ${incidentData.facility || 'Not specified'}
AREA/DEPARTMENT: ${incidentData.area || 'Not specified'}
${incidentData.line ? `PRODUCTION LINE: ${incidentData.line}` : ''}
${incidentData.product ? `PRODUCT: ${incidentData.product}` : ''}
${incidentData.machineId ? `MACHINE/EQUIPMENT ID: ${incidentData.machineId}` : ''}
${incidentData.occurredAt ? `DATE/TIME: ${incidentData.occurredAt}` : ''}
${incidentData.severity ? `CURRENT SEVERITY: ${incidentData.severity}` : ''}

--- INCIDENT DESCRIPTION ---
${incidentData.description}

${incidentData.type === 'WORKPLACE_SAFETY' ? `
--- WORKPLACE SAFETY DETAILS ---
Injury Type: ${incidentData.injuryType || 'Not specified'}
Body Parts Affected: ${incidentData.bodyPartsAffected?.join(', ') || 'Not specified'}
Task Being Performed: ${incidentData.taskBeingPerformed || 'Not specified'}
PPE Worn: ${incidentData.ppeWorn !== undefined ? (incidentData.ppeWorn ? 'Yes' : 'No') : 'Not specified'}
Direct Cause: ${incidentData.directCause || 'Not specified'}
` : ''}

=== ATTACHMENT EVIDENCE ANALYSIS ===

NUMBER OF ATTACHMENTS: ${attachmentAnalysis.attachmentAnalyses.length}
ANALYSIS CONFIDENCE: ${attachmentAnalysis.analysisConfidence}%

--- INDIVIDUAL ATTACHMENT FINDINGS ---
${attachmentAnalysis.attachmentAnalyses.map(a => `
[${a.filename}] (${a.type} - ${a.analysisStatus})
${a.summary}
Key findings: ${a.findings.slice(0, 3).join('; ')}
`).join('\n')}

--- EVIDENCE CORRELATIONS ---
${attachmentAnalysis.evidenceCorrelations.map(c => `• ${c}`).join('\n') || 'No correlations identified'}

--- ATTACHMENT-BASED RISK ASSESSMENT ---
Risk Level: ${attachmentAnalysis.riskAssessment.level}
Factors: ${attachmentAnalysis.riskAssessment.factors.join('; ') || 'None identified'}

=== YOUR TASK ===

Write a clear, helpful incident summary that a regular person can easily understand. Use simple, everyday English - avoid complex jargon. Think of yourself as explaining this incident to a colleague who needs to understand what happened and what to do next.

=== RCA METHODOLOGY GUIDANCE ===

You must recommend the best Root Cause Analysis (RCA) methodology for this incident. Choose between:

1. **5 WHYS Method**: Best for:
   - Simple, straightforward incidents with a likely single root cause
   - Clear cause-and-effect chain
   - Equipment failures or process breakdowns
   - When you need a quick, focused investigation
   - Incidents where the problem is well-defined

2. **FISHBONE (Ishikawa) Diagram**: Best for:
   - Complex incidents with multiple possible causes
   - Situations where several factors may have contributed
   - When you need to explore different categories (People, Process, Equipment, Materials, Environment, Management)
   - Quality issues or contamination events
   - Recurring problems that haven't been solved
   - Incidents involving multiple departments or systems

=== OUTPUT FORMAT ===

SUMMARY:
[Write 5-8 clear sentences that tell the story of what happened. Start with the main event, then explain what the evidence shows. Use simple words that anyone can understand. Be specific and mention the evidence by name when relevant. End with what this means for the organization.]

SEVERITY: [LOW/MEDIUM/HIGH/CRITICAL]
SEVERITY_REASON: [In 1-2 simple sentences, explain why you chose this severity level]

EVIDENCE_SUMMARY:
[In 2-3 clear sentences, explain what the photos/documents tell us about this incident. What did we learn from looking at the evidence?]

KEY_FINDINGS:
- [Finding 1 - state it clearly with evidence reference]
- [Finding 2 - state it clearly with evidence reference]
- [Finding 3 - state it clearly with evidence reference]
- [Finding 4 if relevant]
- [Finding 5 if relevant]

INVESTIGATION_GUIDANCE:
- [Step 1 - what should be checked or investigated first]
- [Step 2 - what else needs to be looked into]
- [Step 3 - additional investigation needed]
- [Step 4 if needed]

RCA_METHOD: [FIVE_WHYS or FISHBONE]
RCA_CONFIDENCE: [A number from 60 to 100 showing how confident you are in this recommendation]
RCA_REASON: [Write 2-3 sentences in SIMPLE, CLEAR English explaining why this RCA method is the best choice for THIS specific incident. Start with "This appears to be..." or "Based on the incident details...". Mention specific details from the incident (like the type of injury, the equipment involved, or the contributing factors you noticed). Avoid jargon - write like you're explaining to a supervisor on the factory floor.]
RCA_ALTERNATIVE: [The other method - FISHBONE if you chose FIVE_WHYS, or FIVE_WHYS if you chose FISHBONE]
RCA_ALTERNATIVE_REASON: [In 1-2 simple sentences, explain when the alternative method might be a better fit. For example: "Consider Fishbone if you discover multiple departments or systems were involved" or "Try 5 Whys if the cause turns out to be simpler than expected"]
`;

    const completion = await openai.chat.completions.create({
      model: process.env.AI_MODEL || 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a friendly and experienced safety investigator who is really good at explaining things in plain English. Your job is to:

1. Write incident summaries that anyone can understand - from a factory worker to a senior manager
2. Avoid complex technical language when simpler words work just as well
3. Be thorough but not overwhelming
4. Always reference the actual evidence when making observations
5. Help people understand not just WHAT happened, but WHY it matters
6. Recommend the best Root Cause Analysis method to find the true cause

Important guidelines:
- Use active voice ("The towel was frayed" instead of "Evidence of fraying was observed")
- Be specific and cite evidence by filename
- Write like you're explaining to a smart colleague, not writing a legal document
- Focus on facts, but make them easy to understand
- Your RCA recommendation will help the team choose the right analysis method`
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_completion_tokens: 1500,
      temperature: 0.3
    });

    const responseText = completion.choices[0]?.message?.content || '';

    // Parse response
    let summary = '';
    let suggestedSeverity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'MEDIUM';
    let evidenceSummary = '';
    let keyFindings: string[] = [];
    let investigationGuidance: string[] = [];
    let rcaMethod: 'FIVE_WHYS' | 'FISHBONE' = 'FIVE_WHYS';
    let rcaConfidence = 70;
    let rcaReason = '';
    let rcaAlternative: 'FIVE_WHYS' | 'FISHBONE' = 'FISHBONE';
    let rcaAlternativeReason = '';

    // Parse summary
    const summaryMatch = responseText.match(/SUMMARY:([\s\S]*?)(?=SEVERITY:|$)/i);
    if (summaryMatch) {
      summary = summaryMatch[1].trim();
    }

    // Parse severity
    const severityMatch = responseText.match(/SEVERITY:\s*(LOW|MEDIUM|HIGH|CRITICAL)/i);
    if (severityMatch) {
      suggestedSeverity = severityMatch[1].toUpperCase() as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    }

    // Parse evidence summary
    const evidenceMatch = responseText.match(/EVIDENCE_SUMMARY:([\s\S]*?)(?=KEY_FINDINGS:|$)/i);
    if (evidenceMatch) {
      evidenceSummary = evidenceMatch[1].trim();
    }

    // Parse key findings
    const findingsMatch = responseText.match(/KEY_FINDINGS:([\s\S]*?)(?=INVESTIGATION_GUIDANCE:|$)/i);
    if (findingsMatch) {
      const bullets = findingsMatch[1].match(/[-•*]\s*(.+)/g);
      keyFindings = bullets?.map(b => b.replace(/^[-•*]\s*/, '').trim()) || [];
    }

    // Parse investigation guidance
    const guidanceMatch = responseText.match(/INVESTIGATION_GUIDANCE:([\s\S]*?)(?=RCA_METHOD:|$)/i);
    if (guidanceMatch) {
      const bullets = guidanceMatch[1].match(/[-•*]\s*(.+)/g);
      investigationGuidance = bullets?.map(b => b.replace(/^[-•*]\s*/, '').trim()) || [];
    }

    // Parse RCA methodology recommendation
    const rcaMethodMatch = responseText.match(/RCA_METHOD:\s*(FIVE_WHYS|FISHBONE)/i);
    if (rcaMethodMatch) {
      rcaMethod = rcaMethodMatch[1].toUpperCase() as 'FIVE_WHYS' | 'FISHBONE';
      rcaAlternative = rcaMethod === 'FIVE_WHYS' ? 'FISHBONE' : 'FIVE_WHYS';
    }

    const rcaConfidenceMatch = responseText.match(/RCA_CONFIDENCE:\s*(\d+)/i);
    if (rcaConfidenceMatch) {
      rcaConfidence = Math.min(100, Math.max(0, parseInt(rcaConfidenceMatch[1], 10)));
    }

    const rcaReasonMatch = responseText.match(/RCA_REASON:([\s\S]*?)(?=RCA_ALTERNATIVE:|$)/i);
    if (rcaReasonMatch) {
      rcaReason = rcaReasonMatch[1].trim();
    }

    const rcaAltReasonMatch = responseText.match(/RCA_ALTERNATIVE_REASON:([\s\S]*?)$/i);
    if (rcaAltReasonMatch) {
      rcaAlternativeReason = rcaAltReasonMatch[1].trim();
    }

    return {
      summary: summary || attachmentAnalysis.overallSummary,
      suggestedSeverity,
      evidenceSummary: evidenceSummary || attachmentAnalysis.overallSummary,
      keyFindings: keyFindings.length > 0 ? keyFindings : attachmentAnalysis.consolidatedFindings.slice(0, 5),
      investigationGuidance: investigationGuidance.length > 0 ? investigationGuidance : attachmentAnalysis.recommendedActions,
      recommendedRCAMethodology: {
        primary: rcaMethod,
        reason: rcaReason || `Based on the incident analysis, ${rcaMethod === 'FIVE_WHYS' ? '5 Whys' : 'Fishbone Diagram'} is recommended.`,
        confidence: rcaConfidence,
        alternativeMethod: rcaAlternative,
        alternativeReason: rcaAlternativeReason || `Consider ${rcaAlternative === 'FIVE_WHYS' ? '5 Whys' : 'Fishbone'} if ${rcaAlternative === 'FIVE_WHYS' ? 'the cause appears simpler than expected' : 'multiple contributing factors are discovered'}.`,
      }
    };

  } catch (error: any) {
    console.error('Enhanced summary generation failed:', error.message);
    return {
      summary: 'AI summary generation failed. Please try again or contact your system administrator.',
      suggestedSeverity: attachmentAnalysis.riskAssessment.level || 'MEDIUM',
      evidenceSummary: attachmentAnalysis.overallSummary,
      keyFindings: attachmentAnalysis.consolidatedFindings.slice(0, 5),
      investigationGuidance: attachmentAnalysis.recommendedActions,
      recommendedRCAMethodology: {
        primary: 'FIVE_WHYS',
        reason: 'Default recommendation due to AI error. 5 Whys is a good starting point for most incidents.',
        confidence: 50,
      }
    };
  }
}
