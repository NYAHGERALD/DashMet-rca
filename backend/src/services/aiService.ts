// Phase 3.3: AI Service for generating incident summaries
// Uses OpenAI GPT-4 to convert raw incident descriptions into professional summaries

import OpenAI from 'openai';

// Lazy initialization of OpenAI client
function getOpenAIClient(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

interface IncidentData {
  type: 'FOOD_SAFETY' | 'MACHINE_EQUIPMENT' | 'WORKPLACE_SAFETY';
  categoryName: string;
  subcategoryName?: string;
  customTitle?: string;
  description: string;
  facilityName?: string;
  areaName?: string;
  lineName?: string;
  productName?: string;
  lotNumber?: string;
  machineId?: string;
  severity?: string;
  shiftName?: string;
  occurredAt?: string;
  evidenceFiles?: Array<{ filename: string; type: string; description?: string }>;
  // Workplace Safety specific fields
  injuryType?: 'FIRST_AID' | 'RECORDABLE' | 'NEAR_MISS' | 'LOST_TIME' | '';
  bodyPartsAffected?: string[];
  otherBodyPartDetail?: string;
  taskBeingPerformed?: string;
  isRoutineTask?: boolean | null;
  exposureDuration?: string;
  taskFrequency?: string;
  weightOrForce?: string;
  environmentalConditions?: string[];
  ppeRequired?: boolean | null;
  ppeWorn?: boolean | null;
  machineSafeguardsInPlace?: 'YES' | 'NO' | 'NA' | '';
  lotoRequired?: 'YES' | 'NO' | 'NA' | '';
  sopAvailable?: boolean | null;
  sopFollowed?: boolean | null;
  firstAidProvided?: boolean | null;
  medicalTreatmentRequired?: boolean | null;
  supervisorNotified?: boolean | null;
  areaSecured?: boolean | null;
  directCause?: string;
  contributingFactors?: { people: string[]; process: string[]; equipment: string[]; environment: string[] };
  unsafeActOrCondition?: 'UNSAFE_ACT' | 'UNSAFE_CONDITION' | 'BOTH' | '';
  previousSimilarIncidents?: boolean | null;
}

interface SummaryResult {
  summary: string;
  suggestedSeverity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  evidenceSummary?: string | null;
  keyFindings?: string[];
  investigationGuidance?: string[];
  recommendedRCAMethodology?: {
    primary: 'FIVE_WHYS' | 'FISHBONE';
    reason: string;
    confidence: number;
    alternativeMethod?: 'FIVE_WHYS' | 'FISHBONE';
    alternativeReason?: string;
  } | null;
  error?: boolean;
}

interface EnhanceTextResult {
  enhancedText: string;
  changes: string[];
  error?: boolean;
}

/**
 * Enhance incident description text using AI
 * Corrects spelling, grammar, and makes the text clearer and more professional
 */
export async function enhanceIncidentText(
  text: string, 
  incidentType: 'FOOD_SAFETY' | 'MACHINE_EQUIPMENT' | 'WORKPLACE_SAFETY',
  fieldContext?: string
): Promise<EnhanceTextResult> {
  const openai = getOpenAIClient();
  
  if (!openai) {
    console.error('AI Enhancement unavailable: No OpenAI API key configured');
    return {
      enhancedText: text,
      changes: [],
      error: true,
    };
  }

  if (!text || text.trim().length < 5) {
    return {
      enhancedText: text,
      changes: ['Text too short to enhance'],
      error: true,
    };
  }

  try {
    const completion = await openai.chat.completions.create({
      model: process.env.AI_MODEL || 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a helpful assistant that rewrites incident reports to make them clear and easy to understand. Think and write like a regular person would - not like a robot or a lawyer.

YOUR JOB:
- Fix any spelling mistakes and grammar errors
- Rewrite the text so it reads naturally, like how a person would actually say it
- Keep things simple - use short, clear sentences
- Make sure the report makes sense and tells a clear story of what happened

WRITING STYLE:
- Use simple, everyday English words (avoid fancy or technical jargon unless necessary)
- Write complete sentences that flow naturally
- Use active voice: "The belt caught his finger" not "His finger was caught by the belt"
- Be direct and get to the point
- Sound like a real person wrote this, not a computer

WHAT NOT TO DO:
- Don't make things up or add details that aren't in the original
- Don't change the facts - only change HOW it's written
- Don't use overly formal or stiff language
- Don't make it longer than it needs to be
- Don't use words like "whilst", "henceforth", "aforementioned", or "pertaining to"

GOOD EXAMPLE:
Original: "employee was doing the cleaning of machine when hand got stuck in belt"
Better: "While cleaning the machine, the employee's hand got caught in the belt."

${fieldContext ? `This text is for the "${fieldContext}" field.` : ''}

IMPORTANT: Reply with ONLY the improved text. No explanations or extra words.`,
        },
        {
          role: 'user',
          content: `Rewrite this to be clear and easy to read:\n\n"${text}"`,
        },
      ],
      temperature: 0.4,
      max_tokens: 1000,
    });

    const enhancedText = completion.choices[0]?.message?.content?.trim() || text;
    
    // Remove any quotes that GPT might add
    const cleanedText = enhancedText.replace(/^["']|["']$/g, '').trim();
    
    // Generate a brief summary of changes
    const changes: string[] = [];
    if (cleanedText !== text) {
      if (cleanedText.length !== text.length) {
        changes.push('Improved clarity and structure');
      }
      // Check for obvious fixes
      const lowerOriginal = text.toLowerCase();
      const lowerEnhanced = cleanedText.toLowerCase();
      if (lowerOriginal !== lowerEnhanced) {
        changes.push('Corrected spelling and grammar');
      }
      changes.push('Enhanced professional tone');
    } else {
      changes.push('Text was already well-written');
    }

    return {
      enhancedText: cleanedText,
      changes,
    };
  } catch (error: any) {
    console.error('AI Text Enhancement failed:', error.message);
    return {
      enhancedText: text,
      changes: [],
      error: true,
    };
  }
}

/**
 * Generate a professional AI summary for an incident
 */
export async function generateIncidentSummary(data: IncidentData): Promise<SummaryResult> {
  const openai = getOpenAIClient();
  
  // If no API key or OpenAI client, return clear error message
  if (!openai) {
    console.error('AI Summary unavailable: No OpenAI API key configured');
    return {
      summary: 'Sorry, at this time AI Summary is not available. Please check with your system administrator for help.',
      suggestedSeverity: undefined,
      error: true,
    };
  }

  try {
    const prompt = buildSummaryPrompt(data);
    
    const completion = await openai.chat.completions.create({
      model: process.env.AI_MODEL || 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a senior Quality Assurance, Environmental Health & Safety (EHS), and Compliance specialist with extensive experience in manufacturing, food processing, and industrial operations. Your role is to transform raw incident reports into professional, comprehensive, and actionable summaries suitable for official documentation, OSHA compliance, workers' compensation records, and management review.

WRITING GUIDELINES:
1. Write in professional third-person narrative style that sounds natural and human - avoid robotic or formulaic language
2. Use precise, industry-standard terminology appropriate to the incident type
3. Structure the summary as a cohesive paragraph (3-5 sentences) that tells the complete story naturally
4. Include all relevant contextual details: what happened, where, when, who was affected, and potential impact
5. Maintain objectivity - report facts without speculation or blame assignment
6. For food safety incidents: emphasize contamination pathways, affected products, consumer risk, and containment status
7. For machine/equipment incidents: emphasize operational impact, safety implications, affected production capacity, and equipment status
8. For workplace safety incidents: emphasize the nature of the injury or near-miss, body parts affected, task context, whether PPE and safety protocols were followed, immediate response actions taken, and OSHA recordability considerations
9. Never fabricate or assume information not explicitly provided
10. Use active voice and vary sentence structure to sound professional yet approachable
11. Conclude with the current status, immediate actions taken, or next steps if known

WORKPLACE SAFETY SPECIFIC GUIDANCE:
- Clearly state the injury classification (First Aid, Recordable, Near Miss, Lost Time)
- Mention body parts affected using proper anatomical terms
- Note whether the task was routine or non-routine
- Highlight any PPE compliance gaps or successes
- Reference LOTO, SOP, and machine guarding status when applicable
- Include environmental factors that may have contributed
- Mention if this type of incident has occurred before (pattern recognition)

SEVERITY ASSESSMENT CRITERIA:
- CRITICAL: Lost time injury, multiple body parts affected, OSHA recordable with days away, regulatory violation, potential permanent disability
- HIGH: OSHA recordable, medical treatment beyond first aid required, significant safety protocol failures, restricted duty likely
- MEDIUM: First aid injury, minor PPE non-compliance, near-miss with moderate potential, corrective action needed
- LOW: Minor near-miss, no injury, routine observation, documentation-only incident

OUTPUT FORMAT:
Provide your response in exactly this format:
SUMMARY: [Your professional summary paragraph here]
SEVERITY: [LOW/MEDIUM/HIGH/CRITICAL]
RATIONALE: [Brief one-sentence justification for severity level]`,
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.2, // Lower temperature for more consistent, professional output
      max_tokens: 600,
    });

    const response = completion.choices[0]?.message?.content || '';
    
    if (!response || response.trim().length === 0) {
      console.error('AI Summary failed: Empty response from OpenAI');
      return {
        summary: 'Sorry, at this time AI Summary is not available. Please check with your system administrator for help.',
        suggestedSeverity: undefined,
        error: true,
      };
    }
    
    // Parse the response for summary and severity
    const { summary, severity } = parseAIResponse(response);
    
    // Validate that we got a real summary
    if (!summary || summary.length < 50) {
      console.error('AI Summary failed: Response too short or invalid');
      return {
        summary: 'Sorry, at this time AI Summary is not available. Please check with your system administrator for help.',
        suggestedSeverity: undefined,
        error: true,
      };
    }
    
    return {
      summary,
      suggestedSeverity: severity,
    };
  } catch (error: any) {
    console.error('AI Summary generation failed:', error.message);
    
    // Return clear error message instead of fallback
    return {
      summary: 'Sorry, at this time AI Summary is not available. Please check with your system administrator for help.',
      suggestedSeverity: undefined,
      error: true,
    };
  }
}

/**
 * Build the prompt for AI summary generation
 */
function buildSummaryPrompt(data: IncidentData): string {
  const parts: string[] = [];
  
  // Header with incident classification
  parts.push('=== INCIDENT REPORT DATA ===\n');
  
  // Incident Type and Classification
  const typeLabels: Record<string, string> = {
    'FOOD_SAFETY': 'Food Safety / Quality',
    'MACHINE_EQUIPMENT': 'Machine & Equipment',
    'WORKPLACE_SAFETY': 'Workplace Safety / Employee Injury'
  };
  parts.push(`INCIDENT TYPE: ${typeLabels[data.type] || data.type}`);
  parts.push(`CATEGORY: ${data.categoryName}`);
  if (data.subcategoryName) {
    parts.push(`SUBCATEGORY: ${data.subcategoryName}`);
  }
  if (data.customTitle) {
    parts.push(`SPECIFIC ISSUE: ${data.customTitle}`);
  }
  
  // Location Information
  parts.push('\n--- LOCATION ---');
  if (data.facilityName) parts.push(`Facility/Plant: ${data.facilityName}`);
  if (data.areaName) parts.push(`Area/Department: ${data.areaName}`);
  if (data.lineName) parts.push(`Production Line: ${data.lineName}`);
  
  // Product/Equipment Information (for non-safety incidents)
  if (data.productName || data.lotNumber || data.machineId) {
    parts.push('\n--- AFFECTED ITEMS ---');
    if (data.productName) parts.push(`Product: ${data.productName}`);
    if (data.lotNumber) parts.push(`Lot/Batch Number: ${data.lotNumber}`);
    if (data.machineId) parts.push(`Machine/Equipment ID: ${data.machineId}`);
  }
  
  // Timing Information
  if (data.occurredAt || data.shiftName) {
    parts.push('\n--- TIMING ---');
    if (data.occurredAt) parts.push(`Date/Time of Incident: ${data.occurredAt}`);
    if (data.shiftName) parts.push(`Shift: ${data.shiftName}`);
  }
  
  // WORKPLACE SAFETY SPECIFIC SECTIONS
  if (data.type === 'WORKPLACE_SAFETY') {
    // Injury Classification
    if (data.injuryType || (data.bodyPartsAffected && data.bodyPartsAffected.length > 0)) {
      parts.push('\n--- INJURY DETAILS ---');
      if (data.injuryType) {
        const injuryLabels: Record<string, string> = {
          'FIRST_AID': 'First Aid Only',
          'RECORDABLE': 'OSHA Recordable',
          'NEAR_MISS': 'Near Miss (No Injury)',
          'LOST_TIME': 'Lost Time Injury'
        };
        parts.push(`Injury Classification: ${injuryLabels[data.injuryType] || data.injuryType}`);
      }
      if (data.bodyPartsAffected && data.bodyPartsAffected.length > 0) {
        parts.push(`Body Parts Affected: ${data.bodyPartsAffected.join(', ')}`);
        // Include "Other" body part specification if provided
        if (data.bodyPartsAffected.includes('OTHER') && data.otherBodyPartDetail) {
          parts.push(`Other Body Part Details: ${data.otherBodyPartDetail}`);
        }
      }
    }
    
    // Task Context
    if (data.taskBeingPerformed || data.isRoutineTask !== null) {
      parts.push('\n--- TASK CONTEXT ---');
      if (data.taskBeingPerformed) parts.push(`Task Being Performed: ${data.taskBeingPerformed}`);
      if (data.isRoutineTask !== null) parts.push(`Task Type: ${data.isRoutineTask ? 'Routine/Normal Duty' : 'Non-Routine/Special Task'}`);
    }
    
    // Exposure & Risk Factors
    const hasExposureData = data.exposureDuration || data.taskFrequency || data.weightOrForce || 
                            (data.environmentalConditions && data.environmentalConditions.length > 0);
    if (hasExposureData) {
      parts.push('\n--- EXPOSURE & RISK FACTORS ---');
      if (data.exposureDuration) parts.push(`Duration of Exposure: ${data.exposureDuration}`);
      if (data.taskFrequency) parts.push(`Task Frequency: ${data.taskFrequency}`);
      if (data.weightOrForce) parts.push(`Weight/Force Involved: ${data.weightOrForce}`);
      if (data.environmentalConditions && data.environmentalConditions.length > 0) {
        parts.push(`Environmental Conditions: ${data.environmentalConditions.join(', ')}`);
      }
    }
    
    // Controls & Compliance
    const hasComplianceData = data.ppeRequired !== null || data.ppeWorn !== null || 
                              data.machineSafeguardsInPlace || data.lotoRequired || 
                              data.sopAvailable !== null || data.sopFollowed !== null;
    if (hasComplianceData) {
      parts.push('\n--- SAFETY CONTROLS & COMPLIANCE ---');
      if (data.ppeRequired !== null) parts.push(`PPE Required: ${data.ppeRequired ? 'Yes' : 'No'}`);
      if (data.ppeWorn !== null) parts.push(`PPE Worn at Time of Incident: ${data.ppeWorn ? 'Yes' : 'No'}`);
      if (data.machineSafeguardsInPlace) {
        parts.push(`Machine Safeguards in Place: ${data.machineSafeguardsInPlace}`);
      }
      if (data.lotoRequired) {
        parts.push(`Lockout/Tagout (LOTO) Required: ${data.lotoRequired}`);
      }
      if (data.sopAvailable !== null) parts.push(`SOP Available: ${data.sopAvailable ? 'Yes' : 'No'}`);
      if (data.sopFollowed !== null) parts.push(`SOP Followed: ${data.sopFollowed ? 'Yes' : 'No'}`);
    }
    
    // Immediate Response
    const hasResponseData = data.firstAidProvided !== null || data.medicalTreatmentRequired !== null || 
                            data.supervisorNotified !== null || data.areaSecured !== null;
    if (hasResponseData) {
      parts.push('\n--- IMMEDIATE RESPONSE ---');
      if (data.firstAidProvided !== null) parts.push(`First Aid Provided: ${data.firstAidProvided ? 'Yes' : 'No'}`);
      if (data.medicalTreatmentRequired !== null) parts.push(`Medical Treatment Required: ${data.medicalTreatmentRequired ? 'Yes' : 'No'}`);
      if (data.supervisorNotified !== null) parts.push(`Supervisor Notified: ${data.supervisorNotified ? 'Yes' : 'No'}`);
      if (data.areaSecured !== null) parts.push(`Area Secured: ${data.areaSecured ? 'Yes' : 'No'}`);
    }
    
    // Contributing Factors & Root Cause Indicators
    const hasRcaData = data.directCause || data.unsafeActOrCondition || data.previousSimilarIncidents !== null ||
                       (data.contributingFactors && (
                         data.contributingFactors.people?.length > 0 ||
                         data.contributingFactors.process?.length > 0 ||
                         data.contributingFactors.equipment?.length > 0 ||
                         data.contributingFactors.environment?.length > 0
                       ));
    if (hasRcaData) {
      parts.push('\n--- RCA INDICATORS ---');
      if (data.directCause) parts.push(`Direct Cause: ${data.directCause}`);
      if (data.unsafeActOrCondition) {
        const actCondLabels: Record<string, string> = {
          'UNSAFE_ACT': 'Unsafe Act',
          'UNSAFE_CONDITION': 'Unsafe Condition',
          'BOTH': 'Both Unsafe Act and Unsafe Condition'
        };
        parts.push(`Classification: ${actCondLabels[data.unsafeActOrCondition] || data.unsafeActOrCondition}`);
      }
      if (data.contributingFactors) {
        if (data.contributingFactors.people?.length > 0) {
          parts.push(`People Factors: ${data.contributingFactors.people.join(', ')}`);
        }
        if (data.contributingFactors.process?.length > 0) {
          parts.push(`Process Factors: ${data.contributingFactors.process.join(', ')}`);
        }
        if (data.contributingFactors.equipment?.length > 0) {
          parts.push(`Equipment Factors: ${data.contributingFactors.equipment.join(', ')}`);
        }
        if (data.contributingFactors.environment?.length > 0) {
          parts.push(`Environment Factors: ${data.contributingFactors.environment.join(', ')}`);
        }
      }
      if (data.previousSimilarIncidents !== null) {
        parts.push(`Previous Similar Incidents: ${data.previousSimilarIncidents ? 'Yes - Pattern may exist' : 'No known similar incidents'}`);
      }
    }
  }
  
  // Main Description
  parts.push('\n--- INCIDENT DESCRIPTION ---');
  parts.push(data.description);
  
  // Evidence Files (if any)
  if (data.evidenceFiles && data.evidenceFiles.length > 0) {
    parts.push('\n--- ATTACHED EVIDENCE ---');
    data.evidenceFiles.forEach((file, index) => {
      let fileInfo = `${index + 1}. ${file.type.toUpperCase()}: ${file.filename}`;
      if (file.description) {
        fileInfo += ` - ${file.description}`;
      }
      parts.push(fileInfo);
    });
  }
  
  parts.push('\n=== END OF REPORT DATA ===');
  parts.push('\nPlease generate a professional incident summary based on all the information provided above. Write naturally and avoid sounding formulaic or robotic.');
  
  return parts.join('\n');
}

/**
 * Parse AI response to extract summary and severity
 */
function parseAIResponse(response: string): { summary: string; severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' } {
  // Try to extract severity from the response
  let severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | undefined;
  
  // Look for SEVERITY: pattern
  const severityMatch = response.match(/SEVERITY[:\s]*(LOW|MEDIUM|HIGH|CRITICAL)/i);
  if (severityMatch) {
    severity = severityMatch[1].toUpperCase() as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  }
  
  // Extract the summary part - look for SUMMARY: pattern first
  let summary = '';
  const summaryMatch = response.match(/SUMMARY[:\s]*(.+?)(?=\n*SEVERITY|$)/is);
  if (summaryMatch) {
    summary = summaryMatch[1].trim();
  } else {
    // Fallback: remove severity and rationale sections and use remaining text
    summary = response
      .replace(/\n*SEVERITY[:\s]*(LOW|MEDIUM|HIGH|CRITICAL).*$/is, '')
      .replace(/\n*RATIONALE[:\s]*.*$/is, '')
      .replace(/^\d+\.\s*(Professional )?[Ss]ummary[:\s]*/i, '')
      .trim();
  }
  
  // Clean up the summary
  summary = summary
    .replace(/^SUMMARY[:\s]*/i, '')
    .replace(/\n+/g, ' ')
    .trim();
  
  // If no clear summary extracted, use the first meaningful paragraph
  if (!summary || summary.length < 30) {
    const firstLine = response.split('\n').filter(line => line.trim() && !line.match(/^(SEVERITY|RATIONALE)/i))[0]?.trim();
    if (firstLine && firstLine.length >= 30) {
      summary = firstLine;
    }
  }
  
  return { summary, severity };
}

export default {
  generateIncidentSummary,
};

// ============================================================================
// RCA AI Analysis Functions
// ============================================================================

interface RCAIncidentContext {
  // Core incident details
  description: string;
  type: string;
  severity?: string | null;
  categoryName?: string;
  facilityName?: string;
  areaName?: string;
  lineName?: string;
  
  // AI-generated insights from incident detail
  aiSummary?: string | null;
  aiAnalysisData?: {
    contributingFactors?: string[];
    possibleCauses?: string[];
    immediateActions?: string[];
    preventiveMeasures?: string[];
    riskLevel?: string;
    keyInsights?: string[];
    recommendedRCAMethodology?: {
      primary: string;
      reason: string;
      confidence: number;
      alternativeMethod?: string;
      alternativeReason?: string;
    };
  } | null;
  
  // Evidence and attachments
  evidence?: Array<{
    fileName: string;
    type: string;
    transcription?: string | null;
  }>;
  
  // Workplace safety details (if applicable)
  workplaceSafety?: {
    injuryCausedByWork?: string | null;
    directCause?: string | null;
    contributingFactors?: string[] | null;
    unsafeActOrCondition?: string | null;
    injuryType?: string | null;
    bodyPartsAffected?: string[] | null;
    environmentalConditions?: string[] | null;
    equipmentInvolved?: string | null;
    taskPerformed?: string | null;
  } | null;
  
  // Quality/food safety details
  qualitySafety?: {
    productAffected?: string | null;
    batchLot?: string | null;
    quantityAffected?: string | null;
    deviationType?: string | null;
    contaminationType?: string | null;
  } | null;
  
  // Historical context
  similarIncidentsCount?: number;
  similarIncidentsMethods?: { method: string; success: boolean }[];
  isRecurring?: boolean;
  
  // Additional context
  incidentNumber?: string;
  incidentDate?: Date | string;
  shiftTime?: string | null;
  immediateActionsTaken?: string | null;
}

/**
 * AI-powered RCA method recommendation that leverages all incident context
 * to provide intelligent, industry-grade analysis
 */
export async function getAIMethodRecommendation(
  incident: RCAIncidentContext
): Promise<{
  recommendedMethod: 'FIVE_WHYS' | 'FISHBONE';
  reason: string;
  confidence: number;
  alternativeMethod?: 'FIVE_WHYS' | 'FISHBONE';
  alternativeReason?: string;
  factors: {
    complexity: 'low' | 'medium' | 'high';
    recurrence: boolean;
    severity: string | null;
    hasMultipleCauses: boolean;
    evidenceQuality: 'poor' | 'adequate' | 'comprehensive';
  };
}> {
  // PRIORITY 1: Use existing AI recommendation from incident detail section
  // This ensures consistency between the incident analysis AI and RCA section AI
  if (incident.aiAnalysisData?.recommendedRCAMethodology) {
    const rcaRec = incident.aiAnalysisData.recommendedRCAMethodology;
    console.log('Using existing AI recommendation from incident analysis:', rcaRec.primary);
    
    // Map the display name to the internal enum value
    const mapMethodName = (name: string): 'FISHBONE' | 'FIVE_WHYS' => {
      if (!name) return 'FIVE_WHYS';
      const lower = name.toLowerCase();
      if (lower.includes('fishbone') || lower.includes('ishikawa')) return 'FISHBONE';
      return 'FIVE_WHYS';
    };
    
    const primaryMethod = mapMethodName(rcaRec.primary);
    const altMethod = primaryMethod === 'FISHBONE' ? 'FIVE_WHYS' : 'FISHBONE';
    
    return {
      recommendedMethod: primaryMethod,
      reason: rcaRec.reason || `Based on AI analysis of the incident details. ${rcaRec.primary} was recommended as the optimal methodology.`,
      confidence: rcaRec.confidence || 0.85,
      alternativeMethod: altMethod,
      alternativeReason: rcaRec.alternativeReason || `Consider ${altMethod === 'FISHBONE' ? 'Fishbone Diagram' : '5 Whys'} if the primary method doesn't yield clear results.`,
      factors: {
        complexity: (incident.aiAnalysisData?.contributingFactors?.length || 0) > 3 ? 'high' : 
                    (incident.aiAnalysisData?.contributingFactors?.length || 0) > 1 ? 'medium' : 'low',
        recurrence: incident.isRecurring || false,
        severity: incident.severity || null,
        hasMultipleCauses: (incident.aiAnalysisData?.contributingFactors?.length || 0) > 2,
        evidenceQuality: incident.evidence && incident.evidence.length > 0 ? 'adequate' : 'poor',
      },
    };
  }

  // PRIORITY 2: Make new AI call if no existing recommendation exists
  const openai = getOpenAIClient();
  
  // Build comprehensive incident context
  const contextPrompt = buildMethodRecommendationPrompt(incident);
  
  // If no AI available and no existing recommendation, use basic fallback
  if (!openai) {
    console.log('No existing AI recommendation and OpenAI unavailable, using fallback');
    return {
      recommendedMethod: 'FIVE_WHYS',
      reason: 'AI analysis unavailable. 5 Whys is recommended as the default starting method for root cause analysis.',
      confidence: 0.5,
      alternativeMethod: 'FISHBONE',
      alternativeReason: 'Consider Fishbone if multiple contributing factors become apparent.',
      factors: {
        complexity: 'medium',
        recurrence: incident.isRecurring || false,
        severity: incident.severity || null,
        hasMultipleCauses: false,
        evidenceQuality: 'poor',
      },
    };
  }
  
  console.log('No existing AI recommendation, making fresh OpenAI call');

  try {
    const completion = await openai.chat.completions.create({
      model: process.env.AI_MODEL || 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a senior Root Cause Analysis expert with 25+ years of field experience in manufacturing, food safety, quality systems, and workplace safety investigations.

═══════════════════════════════════════════════════════════════════════════
STEP 1: IDENTIFY THE INCIDENT TYPE
═══════════════════════════════════════════════════════════════════════════
First, determine if this is:
- **WORKPLACE SAFETY**: Employee injury, near-miss, safety incident
- **FOOD SAFETY / QUALITY**: Contamination, quality deviation, product defect
- **MACHINE & EQUIPMENT**: Breakdown, malfunction, mechanical failure

This affects your methodology recommendation.

═══════════════════════════════════════════════════════════════════════════
METHODOLOGY SELECTION BY INCIDENT TYPE:
═══════════════════════════════════════════════════════════════════════════

FOR WORKPLACE SAFETY (Injuries/Near-Misses):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ 5 WHYS is usually BEST when:
  - Single employee involved in a specific unsafe act
  - Clear event sequence (employee did X, then Y happened)
  - LOTO violation or safeguard bypass is evident
  - Training or procedure gap seems to be the main issue
  
✓ FISHBONE is BEST when:
  - Multiple factors contributed (equipment + training + environment)
  - The AI analysis mentions several contributing factors
  - Similar injuries have happened before (recurring issue)
  - Multiple departments/systems were involved

FOR FOOD SAFETY / QUALITY:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ 5 WHYS is usually BEST when:
  - Single contamination source is suspected
  - Process deviation at one specific step
  - Equipment failure caused the quality issue
  
✓ FISHBONE is BEST when:
  - Unknown contamination source requiring investigation
  - Multiple potential entry points for the hazard
  - Quality issue could be supplier, process, OR environment
  - Allergen cross-contact (multiple touchpoints)
  - Recurring quality complaints

FOR MACHINE & EQUIPMENT:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ 5 WHYS is usually BEST when:
  - Single component failure
  - Clear mechanical failure mode
  - Maintenance schedule issue
  
✓ FISHBONE is BEST when:
  - Intermittent or unpredictable failures
  - Multiple systems interact
  - Root cause not obvious from inspection
  - Failure affects multiple production areas

═══════════════════════════════════════════════════════════════════════════
YOUR TASK:
═══════════════════════════════════════════════════════════════════════════
Analyze this incident and recommend the most effective RCA methodology. 
Your recommendation must be practical and explain WHY this method fits THIS incident.

RESPONSE GUIDELINES:
- Write in plain, everyday English
- Reference SPECIFIC details from the incident
- Start your reason with "This appears to be..." or "Based on the incident..."
- Explain WHY this method will help find the real cause for THIS type of incident
- Confidence should reflect how clear-cut the choice is

OUTPUT FORMAT (JSON only):
{
  "recommendedMethod": "FIVE_WHYS" or "FISHBONE",
  "reason": "[2-3 sentences in SIMPLE English. Mention the incident type, what happened, and WHY this method fits. Example: 'This appears to be a straightforward workplace injury where an employee placed their hand into moving equipment. The 5 Whys method will help drill down from the unsafe act to understand why safeguards failed and what training/procedure gaps allowed this to happen.']",
  "confidence": 0.0-1.0,
  "alternativeMethod": "FIVE_WHYS" or "FISHBONE",
  "alternativeReason": "[When to switch methods for this incident type]",
  "analysisFactors": {
    "complexity": "low/medium/high",
    "hasMultipleCauses": true/false,
    "evidenceQuality": "poor/adequate/comprehensive",
    "keyDecisionPoints": ["[Factor 1]", "[Factor 2]"]
  }
}`,
        },
        {
          role: 'user',
          content: contextPrompt,
        },
      ],
      temperature: 0.2, // Lower for more consistent recommendations
      max_tokens: 800,
      response_format: { type: 'json_object' },
    });

    const response = completion.choices[0]?.message?.content || '';
    const parsed = JSON.parse(response);
    
    return {
      recommendedMethod: parsed.recommendedMethod || 'FIVE_WHYS',
      reason: parsed.reason || 'Analysis complete.',
      confidence: parsed.confidence || 0.7,
      alternativeMethod: parsed.alternativeMethod,
      alternativeReason: parsed.alternativeReason,
      factors: {
        complexity: parsed.analysisFactors?.complexity || 'medium',
        recurrence: incident.isRecurring || false,
        severity: incident.severity || null,
        hasMultipleCauses: parsed.analysisFactors?.hasMultipleCauses || false,
        evidenceQuality: parsed.analysisFactors?.evidenceQuality || 'adequate',
      },
    };
  } catch (error: any) {
    console.error('AI method recommendation failed:', error.message);
    
    // Simple fallback since we already checked for existing recommendation at the top
    return {
      recommendedMethod: 'FIVE_WHYS',
      reason: 'Unable to complete AI analysis. Starting with 5 Whys is recommended for initial investigation.',
      confidence: 0.5,
      alternativeMethod: 'FISHBONE',
      alternativeReason: 'Switch to Fishbone if multiple causes emerge during analysis.',
      factors: {
        complexity: 'medium',
        recurrence: incident.isRecurring || false,
        severity: incident.severity || null,
        hasMultipleCauses: false,
        evidenceQuality: 'adequate',
      },
    };
  }
}

/**
 * Build comprehensive prompt for AI method recommendation
 */
function buildMethodRecommendationPrompt(incident: RCAIncidentContext): string {
  const parts: string[] = [];
  
  parts.push('═══════════════════════════════════════════════════════════════');
  parts.push('INCIDENT ANALYSIS FOR RCA METHOD RECOMMENDATION');
  parts.push('═══════════════════════════════════════════════════════════════\n');
  
  // Core incident information
  parts.push('▌ BASIC INFORMATION');
  parts.push('───────────────────────────────────────');
  if (incident.incidentNumber) parts.push(`Incident #: ${incident.incidentNumber}`);
  parts.push(`Type: ${incident.type === 'FOOD_SAFETY' ? 'Food Safety / Quality' : incident.type === 'WORKPLACE_SAFETY' ? 'Workplace Safety' : 'Machine & Equipment'}`);
  if (incident.severity) parts.push(`Severity: ${incident.severity}`);
  if (incident.categoryName) parts.push(`Category: ${incident.categoryName}`);
  if (incident.incidentDate) parts.push(`Date: ${incident.incidentDate}`);
  if (incident.shiftTime) parts.push(`Shift: ${incident.shiftTime}`);
  
  // Location
  if (incident.facilityName || incident.areaName || incident.lineName) {
    parts.push('\n▌ LOCATION');
    parts.push('───────────────────────────────────────');
    if (incident.facilityName) parts.push(`Facility: ${incident.facilityName}`);
    if (incident.areaName) parts.push(`Area: ${incident.areaName}`);
    if (incident.lineName) parts.push(`Line: ${incident.lineName}`);
  }
  
  // Incident description
  parts.push('\n▌ INCIDENT DESCRIPTION');
  parts.push('───────────────────────────────────────');
  parts.push(incident.description);
  
  // AI Summary (the intelligent analysis from incident detail)
  if (incident.aiSummary) {
    parts.push('\n▌ AI ANALYSIS SUMMARY');
    parts.push('───────────────────────────────────────');
    parts.push(incident.aiSummary);
  }
  
  // AI Analysis Data - Contributing Factors & Causes
  if (incident.aiAnalysisData) {
    const aiData = incident.aiAnalysisData;
    
    if (aiData.contributingFactors && aiData.contributingFactors.length > 0) {
      parts.push('\n▌ IDENTIFIED CONTRIBUTING FACTORS');
      parts.push('───────────────────────────────────────');
      aiData.contributingFactors.forEach((f, i) => parts.push(`${i + 1}. ${f}`));
    }
    
    if (aiData.possibleCauses && aiData.possibleCauses.length > 0) {
      parts.push('\n▌ POSSIBLE CAUSES IDENTIFIED');
      parts.push('───────────────────────────────────────');
      aiData.possibleCauses.forEach((c, i) => parts.push(`${i + 1}. ${c}`));
    }
    
    if (aiData.riskLevel) {
      parts.push(`\n▌ RISK LEVEL: ${aiData.riskLevel}`);
    }
    
    if (aiData.keyInsights && aiData.keyInsights.length > 0) {
      parts.push('\n▌ KEY INSIGHTS');
      parts.push('───────────────────────────────────────');
      aiData.keyInsights.forEach((k, i) => parts.push(`${i + 1}. ${k}`));
    }
    
    // Include existing RCA methodology recommendation for context
    if (aiData.recommendedRCAMethodology) {
      parts.push('\n▌ PREVIOUS AI METHODOLOGY ASSESSMENT');
      parts.push('───────────────────────────────────────');
      parts.push(`Recommended: ${aiData.recommendedRCAMethodology.primary}`);
      parts.push(`Reason: ${aiData.recommendedRCAMethodology.reason}`);
      parts.push(`Confidence: ${Math.round((aiData.recommendedRCAMethodology.confidence || 0) * 100)}%`);
      if (aiData.recommendedRCAMethodology.alternativeMethod) {
        parts.push(`Alternative: ${aiData.recommendedRCAMethodology.alternativeMethod}`);
      }
    }
  }
  
  // Workplace Safety Details
  if (incident.workplaceSafety) {
    const ws = incident.workplaceSafety;
    parts.push('\n▌ WORKPLACE SAFETY DETAILS');
    parts.push('───────────────────────────────────────');
    if (ws.directCause) parts.push(`Direct Cause: ${ws.directCause}`);
    if (ws.unsafeActOrCondition) parts.push(`Unsafe Act/Condition: ${ws.unsafeActOrCondition}`);
    if (ws.injuryType) parts.push(`Injury Type: ${ws.injuryType}`);
    if (ws.taskPerformed) parts.push(`Task Performed: ${ws.taskPerformed}`);
    if (ws.equipmentInvolved) parts.push(`Equipment Involved: ${ws.equipmentInvolved}`);
    if (ws.contributingFactors && ws.contributingFactors.length > 0) {
      parts.push(`Contributing Factors: ${ws.contributingFactors.join(', ')}`);
    }
    if (ws.environmentalConditions && ws.environmentalConditions.length > 0) {
      parts.push(`Environmental Conditions: ${ws.environmentalConditions.join(', ')}`);
    }
    if (ws.bodyPartsAffected && ws.bodyPartsAffected.length > 0) {
      parts.push(`Body Parts Affected: ${ws.bodyPartsAffected.join(', ')}`);
    }
  }
  
  // Quality/Food Safety Details
  if (incident.qualitySafety) {
    const qs = incident.qualitySafety;
    parts.push('\n▌ QUALITY/FOOD SAFETY DETAILS');
    parts.push('───────────────────────────────────────');
    if (qs.productAffected) parts.push(`Product Affected: ${qs.productAffected}`);
    if (qs.batchLot) parts.push(`Batch/Lot: ${qs.batchLot}`);
    if (qs.quantityAffected) parts.push(`Quantity: ${qs.quantityAffected}`);
    if (qs.deviationType) parts.push(`Deviation Type: ${qs.deviationType}`);
    if (qs.contaminationType) parts.push(`Contamination Type: ${qs.contaminationType}`);
  }
  
  // Evidence Analysis
  if (incident.evidence && incident.evidence.length > 0) {
    parts.push('\n▌ EVIDENCE FILES & ANALYSIS');
    parts.push('───────────────────────────────────────');
    incident.evidence.forEach((e, i) => {
      parts.push(`\nEvidence ${i + 1}: ${e.type} - ${e.fileName}`);
      if (e.transcription) {
        // Truncate if too long
        const text = e.transcription.length > 500 ? e.transcription.substring(0, 500) + '...' : e.transcription;
        parts.push(`Transcription: ${text}`);
      }
    });
  }
  
  // Immediate Actions Taken
  if (incident.immediateActionsTaken) {
    parts.push('\n▌ IMMEDIATE ACTIONS TAKEN');
    parts.push('───────────────────────────────────────');
    parts.push(incident.immediateActionsTaken);
  }
  
  // Historical Context
  if (incident.similarIncidentsCount && incident.similarIncidentsCount > 0) {
    parts.push('\n▌ HISTORICAL CONTEXT');
    parts.push('───────────────────────────────────────');
    parts.push(`Similar Incidents in Past: ${incident.similarIncidentsCount}`);
    parts.push(`Recurring Issue: ${incident.isRecurring ? 'YES - This is a recurring problem' : 'No'}`);
    if (incident.similarIncidentsMethods && incident.similarIncidentsMethods.length > 0) {
      parts.push('Previous RCA Methods Used:');
      incident.similarIncidentsMethods.forEach(m => {
        parts.push(`  - ${m.method}: ${m.success ? 'Successful' : 'Unsuccessful'}`);
      });
    }
  }
  
  parts.push('\n═══════════════════════════════════════════════════════════════');
  parts.push('Based on all the above information, recommend the most effective');
  parts.push('RCA methodology for investigating this incident.');
  parts.push('═══════════════════════════════════════════════════════════════');
  
  return parts.join('\n');
}

interface FiveWhysStep {
  stepNumber: number;
  question: string;
  answer: string;
  evidence?: string[];
  aiSuggestion?: string;
  isSymptomLevel?: boolean;
}

interface ActionPlanItem {
  id: string;
  action: string;
  owner?: string;
  dueDate?: string;
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'in-progress' | 'completed';
}

interface ActionPlans {
  immediate: ActionPlanItem[];
  shortTerm: ActionPlanItem[];
  longTerm: ActionPlanItem[];
}

interface FiveWhysAnalysisResult {
  steps: FiveWhysStep[];
  rootCause: string;
  confidence: number;
  rationale: string;
  recommendations: string[];
  actionPlans?: ActionPlans;
  error?: boolean;
}

interface FishboneCause {
  id: string;
  text: string;
  evidence?: string[];
  aiSuggested: boolean;
  likelihood: 'high' | 'medium' | 'low';
  fiveWhysAnalysis?: {
    steps: FiveWhysStep[];
    rootCause: string;
    isValidRootCause: boolean;
    confidence: number;
  };
}

interface FishboneCategory {
  id: string;
  name: string;
  causes: FishboneCause[];
}

interface FishboneAnalysisResult {
  problem: string;
  categories: FishboneCategory[];
  primaryRootCauses: string[];
  rootCauseText: string;
  confidence: number;
  rationale: string;
  recommendations: string[];
  actionPlans?: ActionPlans;
  error?: boolean;
}

interface ProblemValidationResult {
  isValid: boolean;
  needsClarification: boolean;
  clarificationQuestions?: string[];
  feedback: string;
  suggestedRevision?: string;
  canProceed: boolean;
}

interface CauseFiveWhysResult {
  causeId: string;
  causeText: string;
  fiveWhys: {
    steps: FiveWhysStep[];
    rootCause: string;
    confidence: number;
  };
  isValidRootCause?: boolean;
  rootCauseClassification?: 'true_root_cause' | 'contributing_factor' | 'systemic_issue' | 'safety_culture' | 'needs_more_analysis';
  resolvesOriginalProblem: boolean;
  validationExplanation: string;
  recommendation: 'keep' | 'eliminate' | 'needs_more_analysis' | 'reclassify_as_contributing';
  suggestedContributingFactorCategory?: string | null;
}

/**
 * Generate a complete 5 Whys analysis using AI
 */
export async function generateAIFiveWhysAnalysis(
  incident: RCAIncidentContext
): Promise<FiveWhysAnalysisResult> {
  const openai = getOpenAIClient();
  
  if (!openai) {
    console.error('AI RCA unavailable: No OpenAI API key configured');
    return {
      steps: [],
      rootCause: '',
      confidence: 0,
      rationale: 'AI analysis unavailable. Please configure OpenAI API key.',
      recommendations: [],
      error: true,
    };
  }

  try {
    const prompt = buildFiveWhysPrompt(incident);
    
    const completion = await openai.chat.completions.create({
      model: process.env.AI_MODEL || 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are an experienced Root Cause Analysis investigator working alongside manufacturing and operations teams. Your job is to help them find the real reason an incident happened—not just the obvious surface cause.

═══════════════════════════════════════════════════════════════════════════
STEP 1: IDENTIFY THE INCIDENT TYPE
═══════════════════════════════════════════════════════════════════════════
Read the incident carefully. The analysis approach differs significantly:

**WORKPLACE SAFETY** = Employee injury, near-miss, safety incident
**FOOD SAFETY / QUALITY** = Contamination, quality deviation, product defect  
**MACHINE & EQUIPMENT** = Breakdown, malfunction, mechanical failure

═══════════════════════════════════════════════════════════════════════════
FOR WORKPLACE SAFETY INCIDENTS (Injuries/Near-Misses):
═══════════════════════════════════════════════════════════════════════════

CRITICAL: The first question MUST focus on the INJURY/HARM, not background conditions.

✗ WRONG First Questions:
- "Why was dough allowed to accumulate?" (Background condition, not the incident)
- "Why was the machine running?" (Contributing factor, not the harm)
- "Why did the employee need to clear the belt?" (Task context, not the injury)

✓ RIGHT First Questions:
- "Why did the employee's finger get caught in the moving belt?"
- "Why did the employee place their hand into operating machinery?"
- "Why was the employee struck by the moving equipment?"

PROGRESSION PATH FOR SAFETY INCIDENTS:
1. Why did the INJURY happen? → Unsafe act/condition (hand in moving equipment)
2. Why that unsafe act/condition? → Safeguard failure (no LOTO, missing guard)
3. Why the safeguard failure? → Procedure gap (LOTO not required for this task)
4. Why the procedure gap? → Training/culture issue (workers not aware of hazard)
5. Why training/culture gap? → Management system failure (no JHA for this task)

KEY FOCUS AREAS:
• Unsafe acts (what the person did) AND unsafe conditions (equipment/environment)
• Lockout/Tagout (LOTO) compliance
• Machine guarding and safeguards
• PPE usage and availability
• Training and competency verification
• Job Hazard Analysis completeness

═══════════════════════════════════════════════════════════════════════════
FOR FOOD SAFETY / QUALITY INCIDENTS:
═══════════════════════════════════════════════════════════════════════════

CRITICAL: Focus on HOW the hazard entered and WHY controls failed.

✗ WRONG First Questions:
- "Why did the inspector find contamination?" (Detection, not cause)
- "Why was testing performed?" (Monitoring activity, not failure)

✓ RIGHT First Questions:
- "Why was there [specific contaminant] in the [product]?"
- "Why did the foreign material enter the production line?"
- "Why was the product out of specification?"

PROGRESSION PATH FOR FOOD SAFETY:
1. Why did contamination/defect occur? → Source identification
2. Why was source present? → Sanitation/control failure
3. Why did control fail? → Monitoring gap or procedure issue
4. Why the procedure gap? → HACCP/HARPC plan weakness
5. Why plan weakness? → Validation or management review gap

KEY FOCUS AREAS:
• Prerequisite programs (GMPs, sanitation, pest control)
• CCP monitoring and corrective actions
• Supplier controls and receiving verification
• Cross-contamination opportunities
• Environmental monitoring effectiveness
• Allergen controls

═══════════════════════════════════════════════════════════════════════════
FOR MACHINE & EQUIPMENT INCIDENTS:
═══════════════════════════════════════════════════════════════════════════

CRITICAL: Focus on the FAILURE mechanism and why it wasn't prevented.

✗ WRONG First Questions:
- "Why did the operator report the issue?" (Detection, not failure)
- "Why was the machine being used?" (Context, not cause)

✓ RIGHT First Questions:
- "Why did the [specific component] fail?"
- "Why did the motor overheat?"
- "Why did the seal leak?"

PROGRESSION PATH FOR EQUIPMENT:
1. Why did failure occur? → Technical failure mode
2. Why that failure mode? → Wear, damage, or operational issue
3. Why not caught earlier? → Maintenance/inspection gap
4. Why the maintenance gap? → Schedule or resource issue
5. Why schedule/resource issue? → Management system gap

KEY FOCUS AREAS:
• Preventive maintenance schedule adequacy
• Condition monitoring and predictive maintenance
• Operator care and daily checks
• Spare parts availability and quality
• Operating within design parameters
• Training on equipment operation

═══════════════════════════════════════════════════════════════════════════
THE 5 WHYS APPROACH (All Incident Types):
═══════════════════════════════════════════════════════════════════════════

1. Start with what ACTUALLY HAPPENED (injury, contamination, or failure)
2. Ask "Why did that happen?" - get the first-level cause
3. Then ask "Why did THAT happen?" about your answer
4. Keep going until you hit something the company can change
5. You've found it when fixing that thing would prevent recurrence

WHAT MAKES A GOOD ROOT CAUSE:
- It's about the SYSTEM, not just one person
- It's specific enough to ACT ON
- If you fixed it, similar incidents would STOP happening
- It points to procedures, training, maintenance, or management systems

IMPORTANT:
- Use plain language that a supervisor would understand
- Each step should logically lead to the next
- Use the AI analysis summary and evidence—they contain clues
- Pay attention to SOP violations, LOTO failures, safeguard gaps

OUTPUT FORMAT (JSON only):
{
  "steps": [
    {"stepNumber": 1, "question": "Why did [THE ACTUAL INCIDENT - injury/contamination/failure]?", "answer": "[Direct cause - unsafe act/condition or failure mode]", "isSymptomLevel": true},
    {"stepNumber": 2, "question": "Why did [answer 1] happen?", "answer": "[Second-level cause]", "isSymptomLevel": true},
    {"stepNumber": 3, "question": "Why did [answer 2] happen?", "answer": "[Third-level cause - process issues]", "isSymptomLevel": true},
    {"stepNumber": 4, "question": "Why did [answer 3] happen?", "answer": "[Fourth-level cause]", "isSymptomLevel": false},
    {"stepNumber": 5, "question": "Why did [answer 4] happen?", "answer": "[Root cause - system/process gap]", "isSymptomLevel": false}
  ],
  "rootCause": "[Clear statement of the root cause the organization can fix]",
  "confidence": 0.0-1.0,
  "rationale": "[2-3 sentences explaining why this is the true root cause]",
  "recommendations": ["[Specific corrective action 1]", "[Specific corrective action 2]", "[Preventive measure]"]
}`,
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    });

    const response = completion.choices[0]?.message?.content || '';
    
    if (!response) {
      throw new Error('Empty response from AI');
    }
    
    const parsed = JSON.parse(response);
    
    return {
      steps: parsed.steps || [],
      rootCause: parsed.rootCause || '',
      confidence: parsed.confidence || 0.7,
      rationale: parsed.rationale || '',
      recommendations: parsed.recommendations || [],
    };
  } catch (error: any) {
    console.error('AI 5 Whys generation failed:', error.message);
    return {
      steps: [],
      rootCause: '',
      confidence: 0,
      rationale: 'AI analysis failed. Please try again or perform manual analysis.',
      recommendations: [],
      error: true,
    };
  }
}

/**
 * Generate a complete Fishbone (Ishikawa) diagram analysis using AI
 */
export async function generateAIFishboneAnalysis(
  incident: RCAIncidentContext
): Promise<FishboneAnalysisResult> {
  const openai = getOpenAIClient();
  
  if (!openai) {
    console.error('AI RCA unavailable: No OpenAI API key configured');
    return {
      problem: incident.description,
      categories: [],
      primaryRootCauses: [],
      rootCauseText: '',
      confidence: 0,
      rationale: 'AI analysis unavailable. Please configure OpenAI API key.',
      recommendations: [],
      error: true,
    };
  }

  try {
    const prompt = buildFishbonePrompt(incident);
    
    const completion = await openai.chat.completions.create({
      model: process.env.AI_MODEL || 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are an experienced Root Cause Analysis investigator helping teams understand why an incident happened. The Fishbone (Ishikawa) diagram is perfect when there could be multiple contributing factors across different areas of the operation.

FIRST: IDENTIFY THE INCIDENT TYPE
Read the incident carefully and identify if it's:
- **WORKPLACE SAFETY** (employee injury, near-miss, safety incident)
- **FOOD SAFETY / QUALITY** (contamination, quality deviation, product defect)
- **MACHINE & EQUIPMENT** (breakdown, malfunction, mechanical failure)

Each type requires a DIFFERENT FOCUS in your analysis.

═══════════════════════════════════════════════════════════════════════════
FOR WORKPLACE SAFETY INCIDENTS (Injuries/Near-Misses):
═══════════════════════════════════════════════════════════════════════════
The PROBLEM STATEMENT must be about the INJURY or HARM, not about background conditions.
- WRONG: "Dough accumulated between belts"
- RIGHT: "Employee's finger was caught in moving belt, causing laceration"

Key areas to investigate:
• MAN: Training gaps, experience level, fatigue, communication failures, following procedures
• MACHINE: Missing guards, faulty safeguards, LOTO system issues, maintenance gaps
• METHOD: SOP violations, missing safety steps, inadequate job hazard analysis
• MATERIAL: Defective PPE, wrong tools for the job
• MEASUREMENT: Safety audits frequency, near-miss tracking, inspection gaps
• ENVIRONMENT: Housekeeping, lighting, time pressure, production demands

Look for: Unsafe acts AND unsafe conditions. Both usually contribute.

═══════════════════════════════════════════════════════════════════════════
FOR FOOD SAFETY / QUALITY INCIDENTS:
═══════════════════════════════════════════════════════════════════════════
The PROBLEM STATEMENT must be about the contamination, defect, or quality failure.
- Focus on: How did the hazard enter? Why wasn't it detected? Why did control fail?

Key areas to investigate:
• MAN: GMP compliance, hygiene practices, training on CCPs, allergen awareness
• MACHINE: Sanitation effectiveness, equipment design flaws, CIP failures
• METHOD: HACCP plan gaps, monitoring frequency, corrective action procedures
• MATERIAL: Supplier issues, raw material contamination, packaging integrity
• MEASUREMENT: Testing methods, sampling plans, verification activities
• ENVIRONMENT: Sanitation, pest control, cross-contamination risks, temperature control

Look for: Prerequisite program failures, CCP deviations, and verification gaps.

═══════════════════════════════════════════════════════════════════════════
FOR MACHINE & EQUIPMENT INCIDENTS:
═══════════════════════════════════════════════════════════════════════════
The PROBLEM STATEMENT must be about the failure, breakdown, or malfunction.
- Focus on: What failed? Why did it fail? Why wasn't failure predicted/prevented?

Key areas to investigate:
• MAN: Operator errors, maintenance skills, training on equipment
• MACHINE: Wear and tear, design limitations, age, spare parts quality
• METHOD: PM schedule adequacy, operating procedures, startup/shutdown procedures
• MATERIAL: Lubricants, consumables, replacement parts quality
• MEASUREMENT: Condition monitoring, predictive maintenance, vibration analysis
• ENVIRONMENT: Operating conditions, dust, temperature, humidity effects

Look for: Maintenance gaps, operating outside parameters, design flaws.

═══════════════════════════════════════════════════════════════════════════

THE 6M CATEGORIES (adapt emphasis based on incident type):

1. MAN (People) - Not "who made the mistake" but WHY someone could make that mistake
2. MACHINE (Equipment) - Equipment-related factors that enabled the incident
3. METHOD (Process) - Procedure and process gaps
4. MATERIAL - Inputs, raw materials, and supplies issues
5. MEASUREMENT - Detection and monitoring failures
6. ENVIRONMENT - Workplace conditions and external pressures

HOW TO IDENTIFY CAUSES:
- Use the AI analysis summary and evidence—they often point to specific categories
- Look at workplace safety details or quality context provided
- Think about what could have been different to prevent this
- Don't just list generic causes—be specific to THIS incident
- Rate likelihood based on the evidence: "high" means strong evidence, "medium" needs verification, "low" is possible but less likely

YOUR OUTPUT:
Map out potential causes across all 6 categories, then identify which 1-2 causes are most likely the PRIMARY root causes based on the evidence. Use plain language that operations teams will understand.

OUTPUT FORMAT (JSON only):
{
  "problem": "[Restate what ACTUALLY happened - the injury, contamination, or failure - in clear terms]",
  "categories": [
    {
      "id": "1",
      "name": "Man (People)",
      "causes": [
        {"id": "1-1", "text": "[Specific cause related to people/training]", "likelihood": "high/medium/low", "aiSuggested": true}
      ]
    },
    {
      "id": "2",
      "name": "Machine (Equipment)",
      "causes": [...]
    },
    {
      "id": "3",
      "name": "Method (Process)",
      "causes": [...]
    },
    {
      "id": "4",
      "name": "Material",
      "causes": [...]
    },
    {
      "id": "5",
      "name": "Measurement",
      "causes": [...]
    },
    {
      "id": "6",
      "name": "Environment",
      "causes": [...]
    }
  ],
  "primaryRootCauses": ["[The most likely root cause based on evidence]", "[Second most likely if applicable]"],
  "rootCauseText": "[A clear statement combining the primary causes - what the team should focus on fixing]",
  "confidence": 0.0-1.0,
  "rationale": "[2-3 sentences explaining your analysis and why you highlighted these as primary causes]",
  "recommendations": ["[Specific action to address primary cause 1]", "[Specific action to address primary cause 2]", "[Preventive measure for the future]"]
}`,
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3,
      max_tokens: 3000,
      response_format: { type: 'json_object' },
    });

    const response = completion.choices[0]?.message?.content || '';
    
    if (!response) {
      throw new Error('Empty response from AI');
    }
    
    const parsed = JSON.parse(response);
    
    return {
      problem: parsed.problem || incident.description,
      categories: parsed.categories || [],
      primaryRootCauses: parsed.primaryRootCauses || [],
      rootCauseText: parsed.rootCauseText || '',
      confidence: parsed.confidence || 0.7,
      rationale: parsed.rationale || '',
      recommendations: parsed.recommendations || [],
    };
  } catch (error: any) {
    console.error('AI Fishbone generation failed:', error.message);
    return {
      problem: incident.description,
      categories: [],
      primaryRootCauses: [],
      rootCauseText: '',
      confidence: 0,
      rationale: 'AI analysis failed. Please try again or perform manual analysis.',
      recommendations: [],
      error: true,
    };
  }
}

/**
 * Generate AI suggestion for the next 5 Whys step
 */
export async function generateAIFiveWhysSuggestion(
  incident: RCAIncidentContext,
  currentStep: number,
  currentAnswer: string,
  previousSteps: FiveWhysStep[]
): Promise<{
  suggestedQuestion: string;
  suggestedAnswer: string;
  depthAnalysis: string;
  isSymptomLevel: boolean;
  betterPhrasing?: string;
  error?: boolean;
}> {
  const openai = getOpenAIClient();
  
  if (!openai) {
    return {
      suggestedQuestion: `Why did ${currentAnswer.toLowerCase().replace(/\.$/, '')} happen?`,
      suggestedAnswer: '',
      depthAnalysis: 'AI unavailable. Continue digging deeper manually.',
      isSymptomLevel: currentStep < 4,
      error: true,
    };
  }

  try {
    const stepsContext = previousSteps.map(s => 
      `Why ${s.stepNumber}: ${s.question}\nAnswer: ${s.answer}`
    ).join('\n');

    // Build incident type context
    const incidentTypeContext = incident.type === 'WORKPLACE_SAFETY' 
      ? `This is a WORKPLACE SAFETY incident (employee injury). Focus on:
- Unsafe acts and unsafe conditions
- Safeguard and LOTO failures
- Training and procedure gaps
- Management system issues
The goal is to find systemic reasons why the INJURY occurred.`
      : incident.type === 'FOOD_SAFETY'
      ? `This is a FOOD SAFETY/QUALITY incident. Focus on:
- How the hazard entered the process
- Control and monitoring failures
- HACCP/prerequisite program gaps
- Supplier and environmental factors
The goal is to find systemic reasons why CONTAMINATION/DEFECT occurred.`
      : `This is a MACHINE/EQUIPMENT incident. Focus on:
- Technical failure modes
- Maintenance and inspection gaps
- Operating condition issues
- Design or specification problems
The goal is to find systemic reasons why the FAILURE occurred.`;

    const completion = await openai.chat.completions.create({
      model: process.env.AI_MODEL || 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are an RCA specialist guiding a 5 Whys analysis. Provide the next logical question and a suggested answer that digs deeper toward the root cause.

${incidentTypeContext}

PROGRESSION GUIDANCE:
- Steps 1-2: Usually address direct causes (symptoms)
- Steps 3-4: Should dig into process/procedure gaps
- Step 5: Should reach a systemic/management issue that can be fixed

Focus on systemic and process issues, not individual blame.

OUTPUT FORMAT (JSON only):
{
  "suggestedQuestion": "[Next why question - should logically follow from current answer]",
  "suggestedAnswer": "[Suggested answer focusing on process/system cause]",
  "depthAnalysis": "[Brief analysis: are we still at symptoms or getting to root causes?]",
  "isSymptomLevel": true/false,
  "betterPhrasing": "[Optional: if current answer is too vague or blaming individuals, suggest improvement]"
}`,
        },
        {
          role: 'user',
          content: `Incident Type: ${incident.type === 'WORKPLACE_SAFETY' ? 'Workplace Safety (Injury)' : incident.type === 'FOOD_SAFETY' ? 'Food Safety/Quality' : 'Machine & Equipment'}
Incident: ${incident.description}
Category: ${incident.categoryName || 'N/A'}
${incident.aiSummary ? `AI Analysis: ${incident.aiSummary.substring(0, 500)}` : ''}

Previous steps:
${stepsContext}

Current step ${currentStep} answer: ${currentAnswer}

Provide the next why question and suggested answer. Remember to focus on ${incident.type === 'WORKPLACE_SAFETY' ? 'why the injury/harm occurred' : incident.type === 'FOOD_SAFETY' ? 'why the contamination/defect occurred' : 'why the equipment failure occurred'}.`,
        },
      ],
      temperature: 0.3,
      max_tokens: 500,
      response_format: { type: 'json_object' },
    });

    const response = completion.choices[0]?.message?.content || '';
    const parsed = JSON.parse(response);
    
    return {
      suggestedQuestion: parsed.suggestedQuestion || `Why did ${currentAnswer.toLowerCase()} happen?`,
      suggestedAnswer: parsed.suggestedAnswer || '',
      depthAnalysis: parsed.depthAnalysis || '',
      isSymptomLevel: parsed.isSymptomLevel ?? (currentStep < 4),
      betterPhrasing: parsed.betterPhrasing,
    };
  } catch (error: any) {
    console.error('AI 5 Whys suggestion failed:', error.message);
    return {
      suggestedQuestion: `Why did ${currentAnswer.toLowerCase().replace(/\.$/, '')} happen?`,
      suggestedAnswer: '',
      depthAnalysis: 'AI suggestion failed. Continue with your analysis.',
      isSymptomLevel: currentStep < 4,
      error: true,
    };
  }
}

/**
 * Generate AI suggestions for a specific Fishbone category
 */
export async function generateAIFishboneCategorySuggestions(
  incident: RCAIncidentContext,
  categoryName: string,
  existingCauses: string[]
): Promise<{
  suggestedCauses: Array<{ text: string; likelihood: 'high' | 'medium' | 'low' }>;
  categoryAnalysis: string;
  error?: boolean;
}> {
  const openai = getOpenAIClient();
  
  if (!openai) {
    return {
      suggestedCauses: [],
      categoryAnalysis: 'AI unavailable. Add causes manually.',
      error: true,
    };
  }

  try {
    const completion = await openai.chat.completions.create({
      model: process.env.AI_MODEL || 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are an RCA specialist. Suggest potential causes for the "${categoryName}" category in a Fishbone diagram. Focus on specific, actionable causes relevant to the incident.

OUTPUT FORMAT (JSON only):
{
  "suggestedCauses": [
    {"text": "[Specific cause]", "likelihood": "high/medium/low"},
    ...
  ],
  "categoryAnalysis": "[Brief analysis of this category's relevance]"
}`,
        },
        {
          role: 'user',
          content: `Incident: ${incident.description}
Type: ${incident.type}
Severity: ${incident.severity || 'N/A'}
Category: ${incident.categoryName || 'N/A'}
Location: ${incident.facilityName || 'N/A'} - ${incident.areaName || 'N/A'}

Fishbone category: ${categoryName}
Existing causes: ${existingCauses.length > 0 ? existingCauses.join(', ') : 'None yet'}

Suggest 3-5 additional potential causes for this category, avoiding duplicates.`,
        },
      ],
      temperature: 0.4,
      max_tokens: 600,
      response_format: { type: 'json_object' },
    });

    const response = completion.choices[0]?.message?.content || '';
    const parsed = JSON.parse(response);
    
    return {
      suggestedCauses: parsed.suggestedCauses || [],
      categoryAnalysis: parsed.categoryAnalysis || '',
    };
  } catch (error: any) {
    console.error('AI Fishbone category suggestion failed:', error.message);
    return {
      suggestedCauses: [],
      categoryAnalysis: 'AI suggestion failed.',
      error: true,
    };
  }
}

/**
 * Validate the Problem Statement for Fishbone analysis
 * Check if it's clear, realistic, and sufficient for analysis
 */
export async function validateFishboneProblemStatement(
  problem: string,
  incidentContext?: RCAIncidentContext
): Promise<ProblemValidationResult> {
  const openai = getOpenAIClient();
  
  if (!openai) {
    return {
      isValid: true,
      needsClarification: false,
      feedback: 'AI validation unavailable. Proceeding with problem statement.',
      canProceed: true,
    };
  }

  try {
    const completion = await openai.chat.completions.create({
      model: process.env.AI_MODEL || 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a senior RCA specialist evaluating a Problem Statement (Effect) for a Fishbone diagram analysis.

EVALUATION CRITERIA:
1. CLARITY: Is the problem specific and understandable?
2. REALISM: Does it describe a real, definable problem (not a symptom or assumption)?
3. SCOPE: Is it appropriately scoped (not too broad or too narrow)?
4. ACTIONABILITY: Can we identify causes that lead to this effect?
5. COMPLETENESS: Do we have enough information to analyze it?

If the problem statement needs improvement, provide:
- Specific clarification questions to gather missing information
- Suggested revision of the problem statement if possible

OUTPUT FORMAT (JSON only):
{
  "isValid": true/false,
  "needsClarification": true/false,
  "clarificationQuestions": ["Question 1?", "Question 2?"],
  "feedback": "[Explanation of assessment]",
  "suggestedRevision": "[Improved problem statement if applicable]",
  "canProceed": true/false
}`,
        },
        {
          role: 'user',
          content: `Problem Statement: "${problem}"
${incidentContext ? `
Additional Context:
- Incident Type: ${incidentContext.type}
- Category: ${incidentContext.categoryName || 'Not specified'}
- Facility: ${incidentContext.facilityName || 'Not specified'}
- Area: ${incidentContext.areaName || 'Not specified'}
- Severity: ${incidentContext.severity || 'Not specified'}
` : ''}

Evaluate this problem statement and determine if it's suitable for a Fishbone analysis.`,
        },
      ],
      temperature: 0.3,
      max_tokens: 700,
      response_format: { type: 'json_object' },
    });

    const response = completion.choices[0]?.message?.content || '';
    const parsed = JSON.parse(response);
    
    return {
      isValid: parsed.isValid ?? true,
      needsClarification: parsed.needsClarification ?? false,
      clarificationQuestions: parsed.clarificationQuestions || [],
      feedback: parsed.feedback || 'Problem statement evaluated.',
      suggestedRevision: parsed.suggestedRevision,
      canProceed: parsed.canProceed ?? true,
    };
  } catch (error: any) {
    console.error('Problem validation failed:', error.message);
    return {
      isValid: true,
      needsClarification: false,
      feedback: 'Validation failed. Proceeding with current problem statement.',
      canProceed: true,
    };
  }
}

/**
 * Apply 5 Whys analysis to a specific Fishbone cause and validate if it resolves the original problem
 */
export async function analyzeFishboneCauseWithFiveWhys(
  originalProblem: string,
  cause: { id: string; text: string; categoryName: string },
  incidentContext?: RCAIncidentContext
): Promise<CauseFiveWhysResult> {
  const openai = getOpenAIClient();
  
  const defaultResult: CauseFiveWhysResult = {
    causeId: cause.id,
    causeText: cause.text,
    fiveWhys: {
      steps: [],
      rootCause: '',
      confidence: 0,
    },
    resolvesOriginalProblem: false,
    validationExplanation: 'AI analysis unavailable.',
    recommendation: 'needs_more_analysis',
  };

  if (!openai) {
    return defaultResult;
  }

  try {
    const completion = await openai.chat.completions.create({
      model: process.env.AI_MODEL || 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a workplace safety and operations expert helping teams find the real reason an incident happened.

=== YOUR JOB ===
Ask "Why?" five times to dig deeper until you find the actual fixable problem. Think like someone who works on the floor, not like an academic.

=== IMPORTANT RULES ===

1. USE SIMPLE WORDS:
   - Say "worker" not "personnel"
   - Say "broken" not "malfunctioned"
   - Say "check" not "verify"
   - Say "training" not "competency development"
   - Explain things like you're talking to a supervisor, not writing a textbook

2. EACH ANSWER NEEDS TWO PARTS:
   - The Answer: What happened or what was missing
   - The Explanation: Why this matters or how it connects to what happened

3. BE SPECIFIC AND REALISTIC:
   - Don't say "lack of training" - say "worker never learned how to use the new cleaning solution safely"
   - Don't say "equipment failure" - say "the mixer's safety guard was broken and not replaced"
   - Make it about THIS incident, not general problems

4. WHAT IS A REAL ROOT CAUSE:
   Ask yourself: "If we fix this one thing, would this exact incident NOT happen again?"
   - YES = It's a root cause
   - NO = Keep asking why

   Examples of REAL root causes:
   - "The checklist didn't include a step to check temperature before starting"
   - "Nobody showed the new worker how to properly lock out the machine"
   - "The valve handle was placed where it's easy to bump accidentally"

   NOT root causes (these are symptoms or bigger issues):
   - "Company needs better communication" (too vague)
   - "Management doesn't prioritize safety" (organizational issue, not the direct cause)
   - "We need a tracking system" (tracking won't prevent the incident itself)

5. VALIDATION TEST:
   After you find your root cause, ask:
   - "Does this DIRECTLY explain why the incident happened?"
   - "Can workers or supervisors fix this?"
   - "Would fixing this stop the same thing from happening tomorrow?"
   
   If NO to any question, it's not the true root cause.

=== OUTPUT FORMAT (JSON only) ===
{
  "fiveWhys": {
    "steps": [
      {
        "stepNumber": 1,
        "question": "Why did [the cause] happen?",
        "answer": "[Simple, clear answer - one sentence]",
        "explanation": "[2-3 sentences explaining why this answer matters and how it connects to the incident]"
      },
      {"stepNumber": 2, "question": "Why did [answer 1] happen?", "answer": "[Clear answer]", "explanation": "[Why this matters]"},
      {"stepNumber": 3, "question": "Why did [answer 2] happen?", "answer": "[Clear answer]", "explanation": "[Why this matters]"},
      {"stepNumber": 4, "question": "Why did [answer 3] happen?", "answer": "[Clear answer]", "explanation": "[Why this matters]"},
      {"stepNumber": 5, "question": "Why did [answer 4] happen?", "answer": "[Root cause answer]", "explanation": "[Why fixing this prevents recurrence]"}
    ],
    "rootCause": "[Simple statement of the root cause - what needs to be fixed]",
    "confidence": 0.0-1.0
  },
  "isValidRootCause": true/false,
  "rootCauseClassification": "true_root_cause" | "contributing_factor" | "systemic_issue",
  "resolvesOriginalProblem": true/false,
  "validationExplanation": "[In simple words: Would fixing this root cause prevent THIS incident from happening again? Explain your reasoning.]",
  "recommendation": "keep" | "reclassify_as_contributing" | "eliminate" | "needs_more_analysis"
}`,
        },
        {
          role: 'user',
          content: `=== ORIGINAL PROBLEM (The specific incident to prevent) ===
"${originalProblem}"

=== FISHBONE CAUSE TO ANALYZE ===
Category: ${cause.categoryName}
Cause: "${cause.text}"
${incidentContext ? `
=== INCIDENT CONTEXT ===
Type: ${incidentContext.type}
Category: ${incidentContext.categoryName || 'N/A'}
Facility: ${incidentContext.facilityName || 'N/A'}
` : ''}

Apply 5 Whys to drill down to the TRUE root cause. Remember:
- Focus on DIRECT causation at the task/action level
- A root cause must directly explain why THIS incident happened
- Systemic issues (tracking systems, budgets, communication) are contributing factors, not root causes
- Ask at each level: "If I fixed this, would this SPECIFIC incident not recur?"`,
        },
      ],
      temperature: 0.3,
      max_tokens: 1800,
      response_format: { type: 'json_object' },
    });

    const response = completion.choices[0]?.message?.content || '';
    const parsed = JSON.parse(response);
    
    return {
      causeId: cause.id,
      causeText: cause.text,
      fiveWhys: {
        steps: parsed.fiveWhys?.steps || [],
        rootCause: parsed.fiveWhys?.rootCause || '',
        confidence: parsed.fiveWhys?.confidence || 0.5,
      },
      isValidRootCause: parsed.isValidRootCause ?? false,
      rootCauseClassification: parsed.rootCauseClassification || 'needs_more_analysis',
      resolvesOriginalProblem: parsed.resolvesOriginalProblem ?? false,
      validationExplanation: parsed.validationExplanation || 'Analysis completed.',
      recommendation: parsed.recommendation || 'needs_more_analysis',
      suggestedContributingFactorCategory: parsed.suggestedContributingFactorCategory || null,
    };
  } catch (error: any) {
    console.error('Fishbone cause 5 Whys analysis failed:', error.message);
    return defaultResult;
  }
}

/**
 * Validate user-edited 5 Whys answers
 * Check if edits make logical sense and if root cause would resolve the original problem
 */
export async function validateEditedFiveWhys(params: {
  causeText: string;
  categoryName: string;
  problem: string;
  editedSteps: Array<{ stepNumber: number; question: string; answer: string }>;
  editedRootCause: string;
  incidentDescription: string;
  incidentType: string;
}): Promise<{
  isValid: boolean;
  issues: Array<{ stepNumber: number; issue: string; suggestion: string }>;
  overallFeedback: string;
  resolvesOriginalProblem: boolean;
  suggestedRootCause?: string;
}> {
  const openai = getOpenAIClient();
  
  const defaultResult = {
    isValid: true,
    issues: [],
    overallFeedback: 'Unable to validate. Proceeding with your edits.',
    resolvesOriginalProblem: false,
  };
  
  if (!openai) {
    return defaultResult;
  }

  try {
    const stepsText = params.editedSteps
      .map(s => `Why ${s.stepNumber}: ${s.question}\nAnswer: ${s.answer}`)
      .join('\n\n');

    const completion = await openai.chat.completions.create({
      model: process.env.AI_MODEL || 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a Root Cause Analysis expert validating a user's edited 5 Whys analysis. Your job is to:

=== CRITICAL ROOT CAUSE VALIDATION TEST ===
A TRUE ROOT CAUSE must pass this test:
"If this specific item were corrected, would THIS SPECIFIC INCIDENT likely NOT happen again?"

If NO → it is a CONTRIBUTING FACTOR or SYSTEMIC ISSUE, not a root cause.

=== WHAT MAKES A TRUE ROOT CAUSE ===
1. DIRECTLY explains why the incident occurred at the task/action level
2. Is at the point of failure where the incident actually happened
3. When fixed, would DIRECTLY prevent this exact incident from recurring
4. Is specific and actionable at the operational level

=== WHAT IS NOT A ROOT CAUSE ===
- Tracking/monitoring systems (don't prevent incident at moment of occurrence)
- Cost/budget decisions (explain why controls weren't funded, not how incident occurred)
- Communication/management updates (organizational factors)
- Resource allocation (systemic, not task-level)
- General training gaps (unless specific training for THIS task was missing)

=== YOUR VALIDATION TASKS ===
1. CHECK LOGICAL FLOW: Each answer must logically answer its "Why" question
2. CHECK CAUSALITY: Each answer must lead logically to the next "Why"
3. CHECK DIRECT CAUSATION: Drill down must focus on DIRECT causes at task level
4. VALIDATE ROOT CAUSE: Apply the test - "If fixed, would THIS incident not recur?"
5. CLASSIFY: Is this a true root cause or a contributing factor?

Reject answers that are:
- Circular reasoning (effect as its own cause)
- Too vague or generic
- Systemic/organizational when incident is task-level
- Jumping past direct causes to systemic issues
- Blame-focused rather than system/process focused

OUTPUT FORMAT (JSON only):
{
  "isValid": true/false,
  "issues": [
    {
      "stepNumber": 1-5,
      "issue": "[What's wrong - especially if it drifts from direct causation to systemic]",
      "suggestion": "[Better answer focusing on direct cause chain]"
    }
  ],
  "overallFeedback": "[Summary - note if analysis went to systemic issues instead of direct causes]",
  "resolvesOriginalProblem": true/false,
  "isValidRootCause": true/false,
  "rootCauseClassification": "true_root_cause" | "contributing_factor" | "systemic_issue",
  "suggestedRootCause": "[If not a true root cause, suggest what the real root cause should be]"
}`,
        },
        {
          role: 'user',
          content: `=== VALIDATION REQUEST ===
Original Problem (THE SPECIFIC INCIDENT): ${params.problem}
Incident Type: ${params.incidentType}
Incident Description: ${params.incidentDescription}
Initial Cause (Category: ${params.categoryName}): ${params.causeText}

=== USER'S EDITED 5 WHYS ===
${stepsText}

User's Root Cause: ${params.editedRootCause}

VALIDATE: 
1. Is the logic chain valid?
2. Does it stay focused on DIRECT causation at the task level?
3. Apply the test: "If this root cause is fixed, would THIS SPECIFIC incident not happen again?"
4. If the root cause is systemic (tracking, budgets, communication), it should be reclassified as a contributing factor.`,
        },
      ],
      temperature: 0.3,
      max_tokens: 1500,
      response_format: { type: 'json_object' },
    });

    const response = completion.choices[0]?.message?.content || '';
    const parsed = JSON.parse(response);
    
    return {
      isValid: parsed.isValid ?? (parsed.issues?.length === 0),
      issues: parsed.issues || [],
      overallFeedback: parsed.overallFeedback || 'Validation complete.',
      resolvesOriginalProblem: parsed.resolvesOriginalProblem ?? false,
      suggestedRootCause: parsed.suggestedRootCause,
    };
  } catch (error: any) {
    console.error('Validate edited 5 Whys failed:', error.message);
    return defaultResult;
  }
}

/**
 * Validate manual 5 Whys analysis for accuracy, spelling, and logic
 */
export async function validateManualFiveWhys(params: {
  causeText: string;
  categoryName: string;
  problem: string;
  fiveWhysSteps: Array<{ stepNumber: number; question: string; answer: string }>;
  rootCause: string;
  incidentDescription: string;
  incidentType: string;
}): Promise<{
  isValid: boolean;
  issues: Array<{ stepNumber: number; issue: string; suggestion: string; correctedText?: string }>;
  overallFeedback: string;
  resolvesOriginalProblem: boolean;
  suggestedRootCause?: string;
  spellingCorrections?: Array<{ original: string; corrected: string; stepNumber?: number }>;
}> {
  const openai = getOpenAIClient();
  
  const defaultResult = {
    isValid: true,
    issues: [],
    overallFeedback: 'AI validation is currently unavailable. Please review your analysis manually.',
    resolvesOriginalProblem: true,
  };
  
  if (!openai) {
    return defaultResult;
  }

  try {
    const stepsText = params.fiveWhysSteps
      .map(s => `Why ${s.stepNumber}: ${s.question}\nAnswer: ${s.answer}`)
      .join('\n\n');

    const completion = await openai.chat.completions.create({
      model: process.env.AI_MODEL || 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a Root Cause Analysis expert and editor. You are validating a user's manual 5 Whys analysis. Your responsibilities:

1. CHECK SPELLING & GRAMMAR: Identify misspelled words and grammatical errors in each answer
2. CHECK LOGICAL FLOW: Verify each answer logically answers its "Why" question
3. CHECK CAUSALITY: Ensure each answer logically leads to the next "Why" question
4. CHECK ACCURACY: Identify answers that don't make sense in context
5. VALIDATE ROOT CAUSE: Determine if fixing the identified root cause would actually resolve the original problem

For spelling/grammar issues:
- Provide the corrected text
- Be specific about what was wrong

For logic/accuracy issues:
- Explain what's wrong
- Provide a suggested improvement

Be helpful and encouraging. Focus on:
- Correcting spelling and grammar errors
- Improving answer clarity
- Ensuring causal chain makes sense
- Not accepting circular reasoning or blame-focused answers

OUTPUT FORMAT (JSON only):
{
  "isValid": true/false,
  "issues": [
    {
      "stepNumber": 1-5,
      "issue": "[What's wrong - spelling error, logical issue, etc.]",
      "suggestion": "[Explanation or guidance]",
      "correctedText": "[Full corrected answer if spelling/grammar fix needed]"
    }
  ],
  "overallFeedback": "[Summary - be encouraging, acknowledge good work, be specific about issues]",
  "resolvesOriginalProblem": true/false,
  "suggestedRootCause": "[Better root cause statement if needed]",
  "spellingCorrections": [
    {
      "original": "[misspelled word]",
      "corrected": "[correct spelling]",
      "stepNumber": 1-5 or null for root cause
    }
  ]
}`,
        },
        {
          role: 'user',
          content: `=== VALIDATION REQUEST ===
Original Problem: ${params.problem}
Incident Type: ${params.incidentType}
Incident Description: ${params.incidentDescription}
Initial Cause (Category: ${params.categoryName}): ${params.causeText}

=== USER'S MANUAL 5 WHYS ANALYSIS ===
${stepsText}

User's Root Cause: ${params.rootCause}

Please validate this analysis. Check for:
1. Spelling and grammar errors
2. Logical flow between questions and answers
3. Whether each answer properly leads to the next "why"
4. Whether the root cause would actually resolve the original problem`,
        },
      ],
      temperature: 0.3,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    });

    const response = completion.choices[0]?.message?.content || '';
    const parsed = JSON.parse(response);
    
    return {
      isValid: parsed.isValid ?? (parsed.issues?.length === 0),
      issues: parsed.issues || [],
      overallFeedback: parsed.overallFeedback || 'Validation complete.',
      resolvesOriginalProblem: parsed.resolvesOriginalProblem ?? true,
      suggestedRootCause: parsed.suggestedRootCause,
      spellingCorrections: parsed.spellingCorrections || [],
    };
  } catch (error: any) {
    console.error('Validate manual 5 Whys failed:', error.message);
    return defaultResult;
  }
}

/**
 * Generate comprehensive Fishbone analysis with action plans
 */
export async function generateEnhancedFishboneAnalysis(
  incident: RCAIncidentContext
): Promise<FishboneAnalysisResult> {
  const openai = getOpenAIClient();
  
  if (!openai) {
    return {
      problem: incident.description,
      categories: [],
      primaryRootCauses: [],
      rootCauseText: '',
      confidence: 0,
      rationale: 'AI analysis unavailable. Please configure OpenAI API key.',
      recommendations: [],
      actionPlans: { immediate: [], shortTerm: [], longTerm: [] },
      error: true,
    };
  }

  // Build comprehensive context from AI insights
  const aiInsightsContext = buildAIInsightsContext(incident);
  const incidentDetailsContext = buildIncidentDetailsContext(incident);

  try {
    const completion = await openai.chat.completions.create({
      model: process.env.AI_MODEL || 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a senior Root Cause Analysis specialist with expertise in Ishikawa (Fishbone) diagram methodology. You approach incident investigation like an experienced safety investigator who looks beyond surface issues to find systemic root causes.

YOUR APPROACH:
- Think like a seasoned investigator: ask "why" before jumping to conclusions
- Consider human factors, organizational factors, and systemic issues
- Look for patterns and interconnections between different cause categories
- Provide REASONING for each cause based on the incident evidence
- Be specific to THIS incident, not generic textbook causes

ANALYSIS FRAMEWORK - 6M Categories:
1. Man (People) - Training gaps, competency issues, fatigue, communication breakdown, supervision, attention/distraction
2. Machine (Equipment) - Equipment failure, maintenance issues, design flaws, age/wear, calibration, safety guards
3. Method (Process) - Inadequate procedures, unclear instructions, missing steps, workarounds, non-compliance
4. Material (Ingredients/Supplies) - Quality defects, wrong specifications, supplier issues, storage conditions, contamination
5. Measurement - Incorrect readings, uncalibrated instruments, inadequate inspection, monitoring gaps
6. Environment - Physical conditions (temperature, lighting, noise), workspace layout, time pressure, organizational culture

CRITICAL REQUIREMENTS:
- For EACH cause, provide a "reasoning" field explaining WHY this is a potential cause based on the incident details
- The reasoning should reference specific details from the incident (location, time, equipment, actions, etc.)
- Assign likelihood (high/medium/low) based on how strongly the evidence supports this cause
- Generate 2-5 causes per category - fewer if not applicable, more if strongly indicated
- High likelihood = strong evidence or direct indication in incident details
- Medium likelihood = circumstantial evidence or common contributing factor
- Low likelihood = possible but speculative based on limited info

OUTPUT FORMAT (JSON only):
{
  "problem": "[Clear problem statement derived from incident]",
  "categories": [
    {
      "id": "1", "name": "Man (People)",
      "causes": [
        {
          "id": "1-1", 
          "text": "[Specific cause statement]", 
          "reasoning": "[Explain WHY this is a potential cause based on incident details. Reference specific facts from the incident.]",
          "likelihood": "high/medium/low", 
          "aiSuggested": true
        }
      ]
    },
    {"id": "2", "name": "Machine (Equipment)", "causes": [...]},
    {"id": "3", "name": "Method (Process)", "causes": [...]},
    {"id": "4", "name": "Material (Ingredients)", "causes": [...]},
    {"id": "5", "name": "Measurement", "causes": [...]},
    {"id": "6", "name": "Environment", "causes": [...]}
  ],
  "primaryRootCauses": ["[Most likely root cause 1]", "[Root cause 2]"],
  "rootCauseText": "[Comprehensive root cause statement synthesizing findings]",
  "confidence": 0.0-1.0,
  "rationale": "[Overall analysis explanation including methodology and key observations]",
  "recommendations": ["[Specific action 1]", "[Specific action 2]"],
  "actionPlans": {
    "immediate": [
      {"id": "imm-1", "action": "[Urgent action within 24 hours]", "priority": "high", "status": "pending"}
    ],
    "shortTerm": [
      {"id": "st-1", "action": "[Action within 1-30 days]", "priority": "medium", "status": "pending"}
    ],
    "longTerm": [
      {"id": "lt-1", "action": "[Systemic improvement 30+ days]", "priority": "medium", "status": "pending"}
    ]
  }
}`,
        },
        {
          role: 'user',
          content: `=== INCIDENT FOR FISHBONE ANALYSIS ===

${incidentDetailsContext}

${aiInsightsContext}

Based on ALL the above information, conduct a comprehensive Fishbone analysis:
1. Consider EVERY piece of evidence and detail provided
2. For EACH cause, explain your reasoning based on the incident specifics
3. Prioritize causes that directly relate to the evidence
4. Generate causes across all 6M categories where applicable
5. Produce actionable recommendations tied to the root causes identified`,
        },
      ],
      temperature: 0.3,
      max_tokens: 6000,
      response_format: { type: 'json_object' },
    });

    const response = completion.choices[0]?.message?.content || '';
    const parsed = JSON.parse(response);
    
    return {
      problem: parsed.problem || incident.description,
      categories: parsed.categories || [],
      primaryRootCauses: parsed.primaryRootCauses || [],
      rootCauseText: parsed.rootCauseText || '',
      confidence: parsed.confidence || 0.7,
      rationale: parsed.rationale || '',
      recommendations: parsed.recommendations || [],
      actionPlans: parsed.actionPlans || { immediate: [], shortTerm: [], longTerm: [] },
    };
  } catch (error: any) {
    console.error('Enhanced Fishbone analysis failed:', error.message);
    console.error('Full error:', error);
    return {
      problem: incident.description,
      categories: [],
      primaryRootCauses: [],
      rootCauseText: '',
      confidence: 0,
      rationale: `AI analysis failed: ${error.message || 'Unknown error'}. Please try again.`,
      recommendations: [],
      actionPlans: { immediate: [], shortTerm: [], longTerm: [] },
      error: true,
    };
  }
}

/**
 * Build AI insights context from incident's prior AI analysis
 */
function buildAIInsightsContext(incident: RCAIncidentContext): string {
  const sections: string[] = [];
  
  // AI Summary
  if (incident.aiSummary) {
    sections.push(`=== AI INCIDENT SUMMARY ===\n${incident.aiSummary}`);
  }
  
  // AI Analysis Data
  if (incident.aiAnalysisData) {
    const ai = incident.aiAnalysisData;
    
    if (ai.keyInsights && ai.keyInsights.length > 0) {
      sections.push(`=== KEY INSIGHTS FROM AI ANALYSIS ===\n${ai.keyInsights.map((i, idx) => `${idx + 1}. ${i}`).join('\n')}`);
    }
    
    if (ai.contributingFactors && ai.contributingFactors.length > 0) {
      sections.push(`=== CONTRIBUTING FACTORS IDENTIFIED ===\n${ai.contributingFactors.map((f, idx) => `${idx + 1}. ${f}`).join('\n')}`);
    }
    
    if (ai.possibleCauses && ai.possibleCauses.length > 0) {
      sections.push(`=== POSSIBLE CAUSES IDENTIFIED ===\n${ai.possibleCauses.map((c, idx) => `${idx + 1}. ${c}`).join('\n')}`);
    }
    
    if (ai.riskLevel) {
      sections.push(`=== RISK ASSESSMENT ===\nRisk Level: ${ai.riskLevel}`);
    }
    
    if (ai.immediateActions && ai.immediateActions.length > 0) {
      sections.push(`=== IMMEDIATE ACTIONS RECOMMENDED ===\n${ai.immediateActions.map((a, idx) => `${idx + 1}. ${a}`).join('\n')}`);
    }
    
    if (ai.preventiveMeasures && ai.preventiveMeasures.length > 0) {
      sections.push(`=== PREVENTIVE MEASURES RECOMMENDED ===\n${ai.preventiveMeasures.map((m, idx) => `${idx + 1}. ${m}`).join('\n')}`);
    }
    
    if (ai.recommendedRCAMethodology) {
      sections.push(`=== RECOMMENDED RCA APPROACH ===
Method: ${ai.recommendedRCAMethodology.primary}
Reason: ${ai.recommendedRCAMethodology.reason}
Confidence: ${Math.round(ai.recommendedRCAMethodology.confidence * 100)}%`);
    }
  }
  
  return sections.length > 0 ? sections.join('\n\n') : '';
}

/**
 * Build comprehensive incident details context
 */
function buildIncidentDetailsContext(incident: RCAIncidentContext): string {
  const sections: string[] = [];
  
  // Basic incident info
  sections.push(`INCIDENT TYPE: ${incident.type === 'FOOD_SAFETY' ? 'Food Safety / Quality' : incident.type === 'WORKPLACE_SAFETY' ? 'Workplace Safety' : incident.type || 'General'}
DESCRIPTION: ${incident.description}
CATEGORY: ${incident.categoryName || 'N/A'}
SEVERITY: ${incident.severity || 'N/A'}`);

  // Location details
  sections.push(`LOCATION:
- Facility: ${incident.facilityName || 'N/A'}
- Area: ${incident.areaName || 'N/A'}
- Line: ${incident.lineName || 'N/A'}`);

  // Workplace safety specific details
  if (incident.workplaceSafety) {
    const ws = incident.workplaceSafety;
    const wsDetails: string[] = ['WORKPLACE SAFETY DETAILS:'];
    if (ws.injuryCausedByWork) wsDetails.push(`- Injury caused by work: ${ws.injuryCausedByWork}`);
    if (ws.directCause) wsDetails.push(`- Direct cause: ${ws.directCause}`);
    if (ws.unsafeActOrCondition) wsDetails.push(`- Unsafe act/condition: ${ws.unsafeActOrCondition}`);
    if (ws.injuryType) wsDetails.push(`- Injury type: ${ws.injuryType}`);
    if (ws.bodyPartsAffected && ws.bodyPartsAffected.length > 0) {
      wsDetails.push(`- Body parts affected: ${ws.bodyPartsAffected.join(', ')}`);
    }
    if (ws.environmentalConditions && ws.environmentalConditions.length > 0) {
      wsDetails.push(`- Environmental conditions: ${ws.environmentalConditions.join(', ')}`);
    }
    if (ws.equipmentInvolved) wsDetails.push(`- Equipment involved: ${ws.equipmentInvolved}`);
    if (ws.taskPerformed) wsDetails.push(`- Task being performed: ${ws.taskPerformed}`);
    if (ws.contributingFactors && ws.contributingFactors.length > 0) {
      wsDetails.push(`- Contributing factors: ${ws.contributingFactors.join(', ')}`);
    }
    if (wsDetails.length > 1) sections.push(wsDetails.join('\n'));
  }

  // Quality/food safety specific details
  if (incident.qualitySafety) {
    const qs = incident.qualitySafety;
    const qsDetails: string[] = ['QUALITY/FOOD SAFETY DETAILS:'];
    if (qs.productAffected) qsDetails.push(`- Product affected: ${qs.productAffected}`);
    if (qs.batchLot) qsDetails.push(`- Batch/Lot: ${qs.batchLot}`);
    if (qs.quantityAffected) qsDetails.push(`- Quantity affected: ${qs.quantityAffected}`);
    if (qs.deviationType) qsDetails.push(`- Deviation type: ${qs.deviationType}`);
    if (qs.contaminationType) qsDetails.push(`- Contamination type: ${qs.contaminationType}`);
    if (qsDetails.length > 1) sections.push(qsDetails.join('\n'));
  }

  // Evidence
  if (incident.evidence && incident.evidence.length > 0) {
    const evidenceDetails = incident.evidence.map(e => {
      let detail = `- ${e.type}: ${e.fileName}`;
      if (e.transcription) detail += `\n  Transcription: "${e.transcription}"`;
      return detail;
    });
    sections.push(`EVIDENCE:\n${evidenceDetails.join('\n')}`);
  }

  // Historical context
  if (incident.isRecurring || (incident.similarIncidentsCount && incident.similarIncidentsCount > 0)) {
    sections.push(`HISTORICAL CONTEXT:
- Recurring incident: ${incident.isRecurring ? 'Yes' : 'No'}
- Similar incidents: ${incident.similarIncidentsCount || 0}`);
  }

  return sections.join('\n\n');
}

/**
 * Generate a contextual first "Why" question based on incident data
 */
export async function generateContextualFirstQuestion(
  incident: RCAIncidentContext
): Promise<{
  question: string;
  context: string;
  error?: boolean;
}> {
  const openai = getOpenAIClient();
  
  if (!openai) {
    return {
      question: 'Why did this problem occur?',
      context: 'AI unavailable - using generic question.',
      error: true,
    };
  }

  try {
    const completion = await openai.chat.completions.create({
      model: process.env.AI_MODEL || 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a Root Cause Analysis specialist. Your task is to generate a specific, contextual first "Why" question for a 5 Whys analysis based on the incident data provided.

CRITICAL RULE - FOCUS ON THE ACTUAL INCIDENT/HARM:
The first question MUST focus on the ACTUAL INCIDENT that occurred (the injury, the contamination, the failure) - NOT on background circumstances that led to someone taking an action.

FOR WORKPLACE SAFETY INCIDENTS (injuries):
- Ask about WHY THE INJURY OCCURRED, not about circumstances
- WRONG: "Why was dough stuck between the belts?" (This is background, not the incident)
- WRONG: "Why did the employee try to remove the dough?" (This is context, not the harm)
- RIGHT: "Why did the employee's finger get caught in the moving belt?"
- RIGHT: "Why was the employee injured while working on the machine?"
- RIGHT: "Why did the employee place their hand into running equipment?"

The injury IS the incident. The dough accumulation is just the situation that existed. A proper RCA asks WHY THE HARM HAPPENED, which leads to questions about unsafe acts, missing safeguards, LOTO procedures, etc.

FOR FOOD SAFETY/QUALITY INCIDENTS:
- Ask about the contamination, defect, or quality failure itself
- WRONG: "Why did the inspector find the contamination?"
- RIGHT: "Why was the product contaminated with [contaminant]?"

FOR MACHINE/EQUIPMENT INCIDENTS:
- Ask about the failure itself
- WRONG: "Why was the operator checking the machine?"
- RIGHT: "Why did the [specific equipment] fail/break down?"

GUIDELINES:
1. The question should be SPECIFIC to the actual incident/harm
2. Reference what actually went wrong (injury, contamination, failure)
3. The question should lead toward understanding unsafe acts/conditions
4. Keep the question concise but descriptive (10-20 words)
5. Think like a safety investigator: "What harm occurred and why?"

EXAMPLES OF GOOD FIRST QUESTIONS:
- Workplace Safety: "Why did the employee's hand get caught in the moving conveyor?"
- Workplace Safety: "Why was the worker struck by the forklift?"
- Workplace Safety: "Why did the employee sustain a laceration while operating the slicer?"
- Food Safety: "Why was listeria found in the packaged salad?"
- Equipment: "Why did the packaging machine motor overheat and fail?"

OUTPUT FORMAT (JSON only):
{
  "question": "[Your specific first Why question - focused on the ACTUAL INCIDENT/HARM]",
  "context": "[Brief explanation of why this question targets the real incident, not just background circumstances]"
}`,
        },
        {
          role: 'user',
          content: `Generate a specific first "Why" question for this incident:

Type: ${incident.type === 'FOOD_SAFETY' ? 'Food Safety / Quality' : incident.type === 'WORKPLACE_SAFETY' ? 'Workplace Safety (Employee Injury)' : 'Machine & Equipment'}
Description: ${incident.description}
Category: ${incident.categoryName || 'N/A'}
Severity: ${incident.severity || 'N/A'}
Facility: ${incident.facilityName || 'N/A'}
Area: ${incident.areaName || 'N/A'}
Line: ${incident.lineName || 'N/A'}
${incident.workplaceSafety ? `
Workplace Safety Details:
- Injury Type: ${incident.workplaceSafety.injuryType || 'N/A'}
- Direct Cause: ${incident.workplaceSafety.directCause || 'N/A'}
- Task Being Performed: ${incident.workplaceSafety.taskPerformed || 'N/A'}
- Equipment Involved: ${incident.workplaceSafety.equipmentInvolved || 'N/A'}
- Unsafe Act or Condition: ${incident.workplaceSafety.unsafeActOrCondition || 'N/A'}
` : ''}
${incident.aiSummary ? `AI Summary: ${incident.aiSummary}` : ''}
${incident.evidence && incident.evidence.length > 0 ? `Evidence: ${incident.evidence.map(e => `${e.type}: ${e.fileName}`).join(', ')}` : ''}

Remember: For workplace safety incidents, the question MUST focus on WHY THE INJURY HAPPENED, not on background circumstances like equipment conditions or task context. The injury is the incident.`,
        },
      ],
      temperature: 0.3,
      max_tokens: 300,
      response_format: { type: 'json_object' },
    });

    const response = completion.choices[0]?.message?.content || '';
    const parsed = JSON.parse(response);
    
    return {
      question: parsed.question || 'Why did this problem occur?',
      context: parsed.context || '',
    };
  } catch (error: any) {
    console.error('AI first question generation failed:', error.message);
    return {
      question: 'Why did this problem occur?',
      context: 'AI generation failed.',
      error: true,
    };
  }
}

/**
 * Validate the user's first Why answer against incident data
 */
export async function validateFirstWhyAnswer(
  incident: RCAIncidentContext,
  firstWhyQuestion: string | undefined,
  firstWhyAnswer: string
): Promise<{
  isAligned: boolean;
  confidence: number;
  feedback: string;
  suggestedRevision?: string;
  canProceed: boolean;
}> {
  const openai = getOpenAIClient();
  
  if (!openai) {
    return {
      isAligned: true,
      confidence: 0.5,
      feedback: 'AI validation unavailable. You may proceed with your answer.',
      canProceed: true,
    };
  }

  const question = firstWhyQuestion || 'Why did this problem occur?';

  try {
    const completion = await openai.chat.completions.create({
      model: process.env.AI_MODEL || 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are an experienced Root Cause Analysis specialist reviewing the first "Why" answer in a 5 Whys analysis. Your task is to assess whether the user's answer logically connects to the incident and is a valid starting point for root cause analysis.

VALIDATION CRITERIA:
1. The answer should directly relate to the incident described
2. It should explain why the incident occurred (not what happened)
3. It should be specific enough to dig deeper
4. It should focus on process/system issues, not just blame individuals
5. It should not be too generic (e.g., "human error") without context

If the answer is misaligned or could be improved:
- Explain why it may not be the best starting point
- Suggest a better phrased or more accurate first answer based on the incident data
- Be constructive and helpful, not dismissive

OUTPUT FORMAT (JSON only):
{
  "isAligned": true/false,
  "confidence": 0.0-1.0,
  "feedback": "[Detailed feedback about the answer's validity and alignment with incident data]",
  "suggestedRevision": "[If not well aligned, provide a better answer suggestion]",
  "canProceed": true/false
}

Set canProceed to true unless the answer is completely off-topic or nonsensical.`,
        },
        {
          role: 'user',
          content: `=== INCIDENT DATA ===
Type: ${incident.type === 'FOOD_SAFETY' ? 'Food Safety / Quality' : 'Machine & Equipment'}
Description: ${incident.description}
Category: ${incident.categoryName || 'N/A'}
Severity: ${incident.severity || 'N/A'}
Facility: ${incident.facilityName || 'N/A'}
Area: ${incident.areaName || 'N/A'}
Line: ${incident.lineName || 'N/A'}
${incident.evidence && incident.evidence.length > 0 ? `Evidence: ${incident.evidence.map(e => `${e.type}: ${e.fileName}`).join(', ')}` : ''}

=== USER'S FIRST WHY ANSWER ===
Question: ${question}
User's Answer: ${firstWhyAnswer}

Please validate this answer against the incident data.`,
        },
      ],
      temperature: 0.3,
      max_tokens: 700,
      response_format: { type: 'json_object' },
    });

    const response = completion.choices[0]?.message?.content || '';
    const parsed = JSON.parse(response);
    
    return {
      isAligned: parsed.isAligned ?? true,
      confidence: parsed.confidence ?? 0.7,
      feedback: parsed.feedback || 'Your answer has been reviewed.',
      suggestedRevision: parsed.suggestedRevision,
      canProceed: parsed.canProceed ?? true,
    };
  } catch (error: any) {
    console.error('AI first Why validation failed:', error.message);
    return {
      isAligned: true,
      confidence: 0.5,
      feedback: 'AI validation failed. You may proceed with your answer.',
      canProceed: true,
    };
  }
}

/**
 * Generate complete 5 Whys analysis starting from user's first answer
 */
export async function generateCompleteFiveWhysFromFirstAnswer(
  incident: RCAIncidentContext,
  firstWhyQuestion: string | undefined,
  firstWhyAnswer: string
): Promise<FiveWhysAnalysisResult> {
  const openai = getOpenAIClient();
  
  if (!openai) {
    console.error('AI RCA unavailable: No OpenAI API key configured');
    return {
      steps: [],
      rootCause: '',
      confidence: 0,
      rationale: 'AI analysis unavailable. Please configure OpenAI API key.',
      recommendations: [],
      error: true,
    };
  }

  const question = firstWhyQuestion || 'Why did this problem occur?';

  try {
    const completion = await openai.chat.completions.create({
      model: process.env.AI_MODEL || 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a senior Root Cause Analysis specialist completing a 5 Whys analysis. The user has provided the first "Why" answer. Your task is to:

1. USE the provided first question and answer exactly as provided (as step 1)
2. Build upon that first answer to complete the remaining 4 Whys
3. Ensure each subsequent "Why" logically flows from the previous answer
4. Dig progressively deeper toward systemic/process root causes
5. The final root cause should be actionable and specific
6. Generate professional, actionable Action Plans categorized by timeframe

ANALYSIS GUIDELINES:
- Honor the user's starting point and build logically from it
- Each "Why" must drill deeper - never stay at symptom level
- Focus on PROCESS and SYSTEM failures, not individual blame
- The root cause should pass the "So What?" test - addressing it prevents recurrence
- Connect to management system gaps where applicable

ACTION PLAN GUIDELINES:
- IMMEDIATE Actions (0-24 hours): Containment, safety measures, urgent fixes
- SHORT-TERM Actions (1-30 days): Process corrections, training, interim controls
- LONG-TERM Actions (30+ days): Systemic improvements, capital projects, culture changes
- Each action should be SMART: Specific, Measurable, Achievable, Relevant, Time-bound
- Assign appropriate priority (high/medium/low) based on risk and impact

OUTPUT FORMAT (respond in valid JSON only):
{
  "steps": [
    {"stepNumber": 1, "question": "[EXACT FIRST QUESTION PROVIDED]", "answer": "[USER'S EXACT ANSWER]", "isSymptomLevel": true},
    {"stepNumber": 2, "question": "Why did [answer 1] happen?", "answer": "[Second level cause]", "isSymptomLevel": true/false},
    {"stepNumber": 3, "question": "Why did [answer 2] happen?", "answer": "[Third level cause]", "isSymptomLevel": true/false},
    {"stepNumber": 4, "question": "Why did [answer 3] happen?", "answer": "[Fourth level cause]", "isSymptomLevel": true/false},
    {"stepNumber": 5, "question": "Why did [answer 4] happen?", "answer": "[Root cause - systemic issue]", "isSymptomLevel": false}
  ],
  "rootCause": "[Clear, actionable root cause statement]",
  "confidence": 0.0-1.0,
  "rationale": "[Explanation of how the analysis built upon the user's first answer to reach this root cause]",
  "recommendations": ["[Corrective action 1]", "[Corrective action 2]", "[Preventive action]"],
  "actionPlans": {
    "immediate": [
      {"id": "imm-1", "action": "[Urgent action description]", "priority": "high", "status": "pending"},
      {"id": "imm-2", "action": "[Safety/containment action]", "priority": "high", "status": "pending"}
    ],
    "shortTerm": [
      {"id": "st-1", "action": "[Process improvement action]", "priority": "medium", "status": "pending"},
      {"id": "st-2", "action": "[Training/documentation action]", "priority": "medium", "status": "pending"}
    ],
    "longTerm": [
      {"id": "lt-1", "action": "[Systemic/cultural improvement]", "priority": "medium", "status": "pending"},
      {"id": "lt-2", "action": "[Capital/infrastructure improvement if needed]", "priority": "low", "status": "pending"}
    ]
  }
}`,
        },
        {
          role: 'user',
          content: `=== INCIDENT FOR 5 WHYS ANALYSIS ===
Type: ${incident.type === 'FOOD_SAFETY' ? 'Food Safety / Quality' : 'Machine & Equipment'}
Description: ${incident.description}
Category: ${incident.categoryName || 'N/A'}
Severity: ${incident.severity || 'N/A'}
Facility: ${incident.facilityName || 'N/A'}
Area: ${incident.areaName || 'N/A'}
Line: ${incident.lineName || 'N/A'}
${incident.evidence && incident.evidence.length > 0 ? `Evidence: ${incident.evidence.map(e => `${e.type}: ${e.fileName}`).join(', ')}` : ''}

=== USER'S FIRST WHY ANSWER ===
Question: ${question}
User's Answer: ${firstWhyAnswer}

Complete the remaining 4 Whys analysis, building logically from the user's first answer to identify the root cause.`,
        },
      ],
      temperature: 0.3,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    });

    const response = completion.choices[0]?.message?.content || '';
    
    if (!response) {
      throw new Error('Empty response from AI');
    }
    
    const parsed = JSON.parse(response);
    
    // Ensure the first step uses the user's exact question and answer
    if (parsed.steps && parsed.steps.length > 0) {
      parsed.steps[0].question = question;
      parsed.steps[0].answer = firstWhyAnswer;
    }
    
    return {
      steps: parsed.steps || [],
      rootCause: parsed.rootCause || '',
      confidence: parsed.confidence || 0.7,
      rationale: parsed.rationale || '',
      recommendations: parsed.recommendations || [],
      actionPlans: parsed.actionPlans || {
        immediate: [],
        shortTerm: [],
        longTerm: [],
      },
    };
  } catch (error: any) {
    console.error('AI 5 Whys completion failed:', error.message);
    return {
      steps: [],
      rootCause: '',
      confidence: 0,
      rationale: 'AI analysis failed. Please try again or complete manually.',
      recommendations: [],
      actionPlans: {
        immediate: [],
        shortTerm: [],
        longTerm: [],
      },
      error: true,
    };
  }
}

function buildFiveWhysPrompt(incident: RCAIncidentContext): string {
  const parts: string[] = [];
  
  parts.push('═══════════════════════════════════════════════════════════════');
  parts.push('INCIDENT BRIEFING FOR 5 WHYS ROOT CAUSE ANALYSIS');
  parts.push('═══════════════════════════════════════════════════════════════\n');
  
  // Core incident information
  parts.push('▌ INCIDENT OVERVIEW');
  parts.push('───────────────────────────────────────');
  if (incident.incidentNumber) parts.push(`Reference #: ${incident.incidentNumber}`);
  parts.push(`Type: ${incident.type === 'FOOD_SAFETY' ? 'Food Safety / Quality' : incident.type === 'WORKPLACE_SAFETY' ? 'Workplace Safety' : 'Machine & Equipment'}`);
  if (incident.severity) parts.push(`Severity: ${incident.severity}`);
  if (incident.categoryName) parts.push(`Category: ${incident.categoryName}`);
  if (incident.incidentDate) parts.push(`Date: ${incident.incidentDate}`);
  if (incident.shiftTime) parts.push(`Shift: ${incident.shiftTime}`);
  
  // Location context
  if (incident.facilityName || incident.areaName || incident.lineName) {
    parts.push('\n▌ LOCATION');
    parts.push('───────────────────────────────────────');
    if (incident.facilityName) parts.push(`Facility: ${incident.facilityName}`);
    if (incident.areaName) parts.push(`Area: ${incident.areaName}`);
    if (incident.lineName) parts.push(`Line/Station: ${incident.lineName}`);
  }
  
  // Incident description
  parts.push('\n▌ WHAT HAPPENED');
  parts.push('───────────────────────────────────────');
  parts.push(incident.description);
  
  // AI Summary - this is the intelligent pre-analysis
  if (incident.aiSummary) {
    parts.push('\n▌ AI PRE-ANALYSIS SUMMARY');
    parts.push('───────────────────────────────────────');
    parts.push(incident.aiSummary);
  }
  
  // AI Analysis Data - deep insights
  if (incident.aiAnalysisData) {
    const aiData = incident.aiAnalysisData;
    
    if (aiData.contributingFactors && aiData.contributingFactors.length > 0) {
      parts.push('\n▌ CONTRIBUTING FACTORS IDENTIFIED');
      parts.push('───────────────────────────────────────');
      aiData.contributingFactors.forEach((f, i) => parts.push(`• ${f}`));
    }
    
    if (aiData.possibleCauses && aiData.possibleCauses.length > 0) {
      parts.push('\n▌ POSSIBLE ROOT CAUSES TO EXPLORE');
      parts.push('───────────────────────────────────────');
      aiData.possibleCauses.forEach((c, i) => parts.push(`• ${c}`));
    }
    
    if (aiData.keyInsights && aiData.keyInsights.length > 0) {
      parts.push('\n▌ KEY INSIGHTS');
      parts.push('───────────────────────────────────────');
      aiData.keyInsights.forEach((k) => parts.push(`• ${k}`));
    }
    
    if (aiData.riskLevel) {
      parts.push(`\nRisk Assessment: ${aiData.riskLevel}`);
    }
  }
  
  // Workplace Safety Details
  if (incident.workplaceSafety) {
    const ws = incident.workplaceSafety;
    parts.push('\n▌ WORKPLACE SAFETY CONTEXT');
    parts.push('───────────────────────────────────────');
    if (ws.directCause) parts.push(`Direct/Immediate Cause: ${ws.directCause}`);
    if (ws.unsafeActOrCondition) parts.push(`Unsafe Act or Condition: ${ws.unsafeActOrCondition}`);
    if (ws.injuryType) parts.push(`Type of Injury: ${ws.injuryType}`);
    if (ws.taskPerformed) parts.push(`Task Being Performed: ${ws.taskPerformed}`);
    if (ws.equipmentInvolved) parts.push(`Equipment Involved: ${ws.equipmentInvolved}`);
    if (ws.contributingFactors && ws.contributingFactors.length > 0) {
      parts.push(`Reported Contributing Factors: ${ws.contributingFactors.join(', ')}`);
    }
    if (ws.environmentalConditions && ws.environmentalConditions.length > 0) {
      parts.push(`Environmental Conditions: ${ws.environmentalConditions.join(', ')}`);
    }
  }
  
  // Quality/Food Safety Details
  if (incident.qualitySafety) {
    const qs = incident.qualitySafety;
    parts.push('\n▌ PRODUCT/QUALITY CONTEXT');
    parts.push('───────────────────────────────────────');
    if (qs.productAffected) parts.push(`Product: ${qs.productAffected}`);
    if (qs.batchLot) parts.push(`Batch/Lot: ${qs.batchLot}`);
    if (qs.quantityAffected) parts.push(`Quantity Affected: ${qs.quantityAffected}`);
    if (qs.deviationType) parts.push(`Type of Deviation: ${qs.deviationType}`);
    if (qs.contaminationType) parts.push(`Contamination Type: ${qs.contaminationType}`);
  }
  
  // Evidence Analysis
  if (incident.evidence && incident.evidence.length > 0) {
    parts.push('\n▌ EVIDENCE & DOCUMENTATION');
    parts.push('───────────────────────────────────────');
    incident.evidence.forEach((e, i) => {
      parts.push(`\n[${e.type}] ${e.fileName}`);
      if (e.transcription) {
        const text = e.transcription.length > 400 ? e.transcription.substring(0, 400) + '...' : e.transcription;
        parts.push(`Transcription: ${text}`);
      }
    });
  }
  
  // Immediate Actions
  if (incident.immediateActionsTaken) {
    parts.push('\n▌ IMMEDIATE ACTIONS TAKEN');
    parts.push('───────────────────────────────────────');
    parts.push(incident.immediateActionsTaken);
  }
  
  // Historical Context
  if (incident.similarIncidentsCount && incident.similarIncidentsCount > 0) {
    parts.push('\n▌ HISTORICAL PATTERN');
    parts.push('───────────────────────────────────────');
    parts.push(`Similar Past Incidents: ${incident.similarIncidentsCount}`);
    if (incident.isRecurring) {
      parts.push('⚠️ THIS IS A RECURRING ISSUE - Previous fixes may not have addressed the true root cause');
    }
  }
  
  parts.push('\n═══════════════════════════════════════════════════════════════');
  parts.push('Using all the above context, conduct a rigorous 5 Whys analysis.');
  parts.push('Focus on systemic and process issues. Dig deep to find the true root cause.');
  parts.push('═══════════════════════════════════════════════════════════════');
  
  return parts.join('\n');
}

function buildFishbonePrompt(incident: RCAIncidentContext): string {
  const parts: string[] = [];
  
  parts.push('═══════════════════════════════════════════════════════════════');
  parts.push('INCIDENT BRIEFING FOR FISHBONE (ISHIKAWA) ANALYSIS');
  parts.push('═══════════════════════════════════════════════════════════════\n');
  
  // Core incident information
  parts.push('▌ INCIDENT OVERVIEW');
  parts.push('───────────────────────────────────────');
  if (incident.incidentNumber) parts.push(`Reference #: ${incident.incidentNumber}`);
  parts.push(`Type: ${incident.type === 'FOOD_SAFETY' ? 'Food Safety / Quality' : incident.type === 'WORKPLACE_SAFETY' ? 'Workplace Safety' : 'Machine & Equipment'}`);
  if (incident.severity) parts.push(`Severity: ${incident.severity}`);
  if (incident.categoryName) parts.push(`Category: ${incident.categoryName}`);
  if (incident.incidentDate) parts.push(`Date: ${incident.incidentDate}`);
  if (incident.shiftTime) parts.push(`Shift: ${incident.shiftTime}`);
  
  // Location context
  if (incident.facilityName || incident.areaName || incident.lineName) {
    parts.push('\n▌ LOCATION');
    parts.push('───────────────────────────────────────');
    if (incident.facilityName) parts.push(`Facility: ${incident.facilityName}`);
    if (incident.areaName) parts.push(`Area: ${incident.areaName}`);
    if (incident.lineName) parts.push(`Line/Station: ${incident.lineName}`);
  }
  
  // Problem statement
  parts.push('\n▌ PROBLEM TO ANALYZE');
  parts.push('───────────────────────────────────────');
  parts.push(incident.description);
  
  // AI Summary
  if (incident.aiSummary) {
    parts.push('\n▌ AI PRE-ANALYSIS SUMMARY');
    parts.push('───────────────────────────────────────');
    parts.push(incident.aiSummary);
  }
  
  // AI Analysis Data
  if (incident.aiAnalysisData) {
    const aiData = incident.aiAnalysisData;
    
    if (aiData.contributingFactors && aiData.contributingFactors.length > 0) {
      parts.push('\n▌ CONTRIBUTING FACTORS TO MAP');
      parts.push('───────────────────────────────────────');
      parts.push('(Use these to populate the appropriate 6M categories)');
      aiData.contributingFactors.forEach((f) => parts.push(`• ${f}`));
    }
    
    if (aiData.possibleCauses && aiData.possibleCauses.length > 0) {
      parts.push('\n▌ POSSIBLE ROOT CAUSES IDENTIFIED');
      parts.push('───────────────────────────────────────');
      aiData.possibleCauses.forEach((c) => parts.push(`• ${c}`));
    }
    
    if (aiData.keyInsights && aiData.keyInsights.length > 0) {
      parts.push('\n▌ KEY INSIGHTS');
      parts.push('───────────────────────────────────────');
      aiData.keyInsights.forEach((k) => parts.push(`• ${k}`));
    }
  }
  
  // Workplace Safety Details - map to 6M categories
  if (incident.workplaceSafety) {
    const ws = incident.workplaceSafety;
    parts.push('\n▌ WORKPLACE SAFETY FACTORS');
    parts.push('───────────────────────────────────────');
    parts.push('(Consider these when populating Man, Machine, Method, Environment categories)');
    if (ws.directCause) parts.push(`Direct Cause: ${ws.directCause}`);
    if (ws.unsafeActOrCondition) parts.push(`Unsafe Act/Condition: ${ws.unsafeActOrCondition}`);
    if (ws.injuryType) parts.push(`Injury Type: ${ws.injuryType}`);
    if (ws.taskPerformed) parts.push(`Task: ${ws.taskPerformed}`);
    if (ws.equipmentInvolved) parts.push(`Equipment: ${ws.equipmentInvolved}`);
    if (ws.contributingFactors && ws.contributingFactors.length > 0) {
      parts.push(`Contributing Factors: ${ws.contributingFactors.join(', ')}`);
    }
    if (ws.environmentalConditions && ws.environmentalConditions.length > 0) {
      parts.push(`Environmental Conditions: ${ws.environmentalConditions.join(', ')}`);
    }
  }
  
  // Quality/Food Safety Details
  if (incident.qualitySafety) {
    const qs = incident.qualitySafety;
    parts.push('\n▌ PRODUCT/QUALITY FACTORS');
    parts.push('───────────────────────────────────────');
    parts.push('(Consider these when populating Material, Measurement, Method categories)');
    if (qs.productAffected) parts.push(`Product: ${qs.productAffected}`);
    if (qs.batchLot) parts.push(`Batch/Lot: ${qs.batchLot}`);
    if (qs.quantityAffected) parts.push(`Quantity: ${qs.quantityAffected}`);
    if (qs.deviationType) parts.push(`Deviation Type: ${qs.deviationType}`);
    if (qs.contaminationType) parts.push(`Contamination Type: ${qs.contaminationType}`);
  }
  
  // Evidence
  if (incident.evidence && incident.evidence.length > 0) {
    parts.push('\n▌ EVIDENCE & DOCUMENTATION');
    parts.push('───────────────────────────────────────');
    incident.evidence.forEach((e) => {
      parts.push(`\n[${e.type}] ${e.fileName}`);
      if (e.transcription) {
        const text = e.transcription.length > 400 ? e.transcription.substring(0, 400) + '...' : e.transcription;
        parts.push(`Transcription: ${text}`);
      }
    });
  }
  
  // Immediate Actions
  if (incident.immediateActionsTaken) {
    parts.push('\n▌ IMMEDIATE ACTIONS TAKEN');
    parts.push('───────────────────────────────────────');
    parts.push(incident.immediateActionsTaken);
  }
  
  // Historical Context
  if (incident.similarIncidentsCount && incident.similarIncidentsCount > 0) {
    parts.push('\n▌ HISTORICAL PATTERN');
    parts.push('───────────────────────────────────────');
    parts.push(`Similar Past Incidents: ${incident.similarIncidentsCount}`);
    if (incident.isRecurring) {
      parts.push('⚠️ RECURRING ISSUE - Map causes across ALL 6M categories to find systemic gaps');
    }
  }
  
  parts.push('\n═══════════════════════════════════════════════════════════════');
  parts.push('Using all the above context, build a comprehensive Fishbone diagram.');
  parts.push('Map causes to the 6M categories: Man, Machine, Method, Material, Measurement, Environment.');
  parts.push('Identify the PRIMARY root causes based on evidence and likelihood.');
  parts.push('═══════════════════════════════════════════════════════════════');
  
  return parts.join('\n');
}

// ============================================================================
// Corrective Actions AI Functions
// ============================================================================

interface AnalyzedCause {
  categoryName: string;
  causeText: string;
  rootCause?: string;
  fiveWhysSteps?: Array<{ stepNumber: number; question: string; answer: string }>;
}

interface ActionPlanItem {
  id: string;
  action: string;
  owner?: string;
  dueDate?: string;
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'in-progress' | 'completed';
}

interface ActionPlans {
  immediate: ActionPlanItem[];
  shortTerm: ActionPlanItem[];
  longTerm: ActionPlanItem[];
}

interface PreventiveControlItem {
  id: string;
  control: string;
  type: 'process' | 'training' | 'equipment' | 'documentation' | 'monitoring';
  description: string;
  owner?: string;
  targetDate?: string;
  status: 'pending' | 'in-progress' | 'implemented';
  frequency?: string;
}

interface GeneratedActionsResult {
  actionPlans: ActionPlans;
  preventiveControls: PreventiveControlItem[];
}

interface IncidentContext {
  description: string;
  type: string;
  severity: string;
  categoryName?: string;
  facilityName?: string;
}

/**
 * Generate AI-powered corrective actions and preventive controls based on analyzed root causes
 */
export async function generateCorrectiveActions(
  problem: string,
  analyzedCauses: AnalyzedCause[],
  incidentContext: IncidentContext,
  existingActions?: ActionPlans
): Promise<GeneratedActionsResult> {
  const openai = getOpenAIClient();
  
  if (!openai) {
    console.error('AI Corrective Actions unavailable: No OpenAI API key configured');
    // Return reasonable fallback actions
    return generateFallbackCorrectiveActions(problem, analyzedCauses);
  }

  try {
    const prompt = buildCorrectiveActionsPrompt(problem, analyzedCauses, incidentContext, existingActions);
    
    const completion = await openai.chat.completions.create({
      model: process.env.AI_MODEL || 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a senior Quality Assurance and Continuous Improvement expert with 20+ years of experience in manufacturing, food safety, and industrial operations. You specialize in developing effective, practical corrective and preventive actions (CAPA) that address root causes.

YOUR EXPERTISE:
- Deep understanding of manufacturing processes and equipment
- Food safety regulations (FDA, FSMA, SQF, BRC, HACCP)
- Lean Six Sigma methodology and continuous improvement
- Change management and organizational behavior
- Risk assessment and mitigation strategies

CORRECTIVE ACTION PRINCIPLES:
1. SMART: Specific, Measurable, Achievable, Relevant, Time-bound
2. Address root causes, not just symptoms
3. Consider human factors and behavior change
4. Include verification steps to confirm effectiveness
5. Balance urgency with thoroughness
6. Account for resource constraints and practicality
7. Preventive measures should eliminate recurrence potential

ACTION TIMEFRAMES:
- IMMEDIATE (0-72 hours): Containment actions, stop the bleeding, protect safety
- SHORT-TERM (1-4 weeks): Corrective actions that fix the immediate issue
- LONG-TERM (1-6 months): Preventive actions and systemic improvements

PREVENTIVE CONTROL TYPES:
- process: Process changes, SOPs, workflow modifications
- training: Training programs, competency assessments
- equipment: Equipment upgrades, maintenance schedules, physical safeguards
- documentation: Checklists, logs, records, procedures
- monitoring: Inspections, audits, key metrics tracking

OUTPUT FORMAT (JSON):
{
  "immediate": [
    {
      "id": "imm-1",
      "action": "Specific action description",
      "priority": "high|medium|low",
      "rationale": "Why this action is needed"
    }
  ],
  "shortTerm": [...],
  "longTerm": [...],
  "preventiveControls": [
    {
      "id": "pc-1",
      "control": "Control name (short title)",
      "type": "process|training|equipment|documentation|monitoring",
      "description": "Detailed description of how this control prevents recurrence",
      "frequency": "For monitoring controls, specify frequency (e.g., Daily, Weekly)"
    }
  ]
}

Generate 2-4 actions per category and 3-5 preventive controls. Be specific and actionable.`,
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3,
      max_tokens: 3000,
    });

    const response = completion.choices[0]?.message?.content || '';
    
    // Parse JSON response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      
      // Transform to required format with IDs
      const transformActions = (actions: any[], prefix: string, defaultPriority: 'high' | 'medium' | 'low'): ActionPlanItem[] => {
        return (actions || []).map((a: any, idx: number) => ({
          id: a.id || `${prefix}-${Date.now()}-${idx}`,
          action: a.action || '',
          priority: a.priority || defaultPriority,
          status: 'pending' as const,
          owner: a.owner || '',
          dueDate: a.dueDate || '',
        }));
      };
      
      // Transform preventive controls
      const transformPreventiveControls = (controls: any[]): PreventiveControlItem[] => {
        return (controls || []).map((c: any, idx: number) => ({
          id: c.id || `pc-${Date.now()}-${idx}`,
          control: c.control || '',
          type: c.type || 'process',
          description: c.description || '',
          owner: c.owner || '',
          targetDate: c.targetDate || '',
          status: 'pending' as const,
          frequency: c.frequency || '',
        }));
      };
      
      return {
        actionPlans: {
          immediate: transformActions(parsed.immediate, 'imm', 'high'),
          shortTerm: transformActions(parsed.shortTerm, 'st', 'medium'),
          longTerm: transformActions(parsed.longTerm, 'lt', 'medium'),
        },
        preventiveControls: transformPreventiveControls(parsed.preventiveControls),
      };
    }
    
    return generateFallbackCorrectiveActions(problem, analyzedCauses);
  } catch (error: any) {
    console.error('AI Corrective Actions generation failed:', error.message);
    return generateFallbackCorrectiveActions(problem, analyzedCauses);
  }
}

function buildCorrectiveActionsPrompt(
  problem: string,
  analyzedCauses: AnalyzedCause[],
  incidentContext: IncidentContext,
  existingActions?: ActionPlans
): string {
  const parts: string[] = [];
  
  parts.push('=== PROBLEM STATEMENT ===');
  parts.push(problem);
  
  parts.push('\n=== INCIDENT CONTEXT ===');
  parts.push(`Type: ${incidentContext.type}`);
  parts.push(`Severity: ${incidentContext.severity}`);
  parts.push(`Description: ${incidentContext.description}`);
  if (incidentContext.categoryName) parts.push(`Category: ${incidentContext.categoryName}`);
  if (incidentContext.facilityName) parts.push(`Facility: ${incidentContext.facilityName}`);
  
  parts.push('\n=== ANALYZED ROOT CAUSES ===');
  analyzedCauses.forEach((cause, idx) => {
    parts.push(`\n${idx + 1}. Category: ${cause.categoryName}`);
    parts.push(`   Cause: ${cause.causeText}`);
    if (cause.rootCause) {
      parts.push(`   Root Cause (from 5 Whys): ${cause.rootCause}`);
    }
    if (cause.fiveWhysSteps && cause.fiveWhysSteps.length > 0) {
      parts.push(`   5 Whys Analysis:`);
      cause.fiveWhysSteps.forEach(step => {
        parts.push(`     Why ${step.stepNumber}: ${step.answer}`);
      });
    }
  });
  
  if (existingActions && (existingActions.immediate.length > 0 || existingActions.shortTerm.length > 0 || existingActions.longTerm.length > 0)) {
    parts.push('\n=== EXISTING ACTIONS (for context) ===');
    if (existingActions.immediate.length > 0) {
      parts.push('Immediate: ' + existingActions.immediate.map(a => a.action).join('; '));
    }
    if (existingActions.shortTerm.length > 0) {
      parts.push('Short-term: ' + existingActions.shortTerm.map(a => a.action).join('; '));
    }
    if (existingActions.longTerm.length > 0) {
      parts.push('Long-term: ' + existingActions.longTerm.map(a => a.action).join('; '));
    }
  }
  
  parts.push('\n=== TASK ===');
  parts.push('Generate comprehensive corrective actions AND preventive controls that:');
  parts.push('1. Directly address each identified root cause');
  parts.push('2. Are specific, measurable, and achievable');
  parts.push('3. Include both corrective (fix) and preventive (prevent recurrence) measures');
  parts.push('4. Are realistic and executable in a real-world manufacturing environment');
  parts.push('5. Consider human factors, training needs, and process improvements');
  parts.push('6. Include systemic preventive controls to ensure this type of incident cannot recur');
  
  return parts.join('\n');
}

function generateFallbackCorrectiveActions(problem: string, analyzedCauses: AnalyzedCause[]): GeneratedActionsResult {
  const timestamp = Date.now();
  
  // Generate basic actions based on common patterns
  const immediate: ActionPlanItem[] = [
    {
      id: `imm-${timestamp}-1`,
      action: 'Implement immediate containment measures to prevent further impact',
      priority: 'high',
      status: 'pending',
    },
    {
      id: `imm-${timestamp}-2`,
      action: 'Notify relevant personnel and stakeholders of the issue',
      priority: 'high',
      status: 'pending',
    },
  ];
  
  const shortTerm: ActionPlanItem[] = analyzedCauses.slice(0, 3).map((cause, idx) => ({
    id: `st-${timestamp}-${idx}`,
    action: `Address root cause in ${cause.categoryName}: Review and improve related procedures`,
    priority: 'medium' as const,
    status: 'pending' as const,
  }));
  
  const longTerm: ActionPlanItem[] = [
    {
      id: `lt-${timestamp}-1`,
      action: 'Develop and implement preventive measures to eliminate recurrence',
      priority: 'medium',
      status: 'pending',
    },
    {
      id: `lt-${timestamp}-2`,
      action: 'Update training materials and conduct refresher training for affected personnel',
      priority: 'medium',
      status: 'pending',
    },
  ];
  
  // Generate fallback preventive controls
  const preventiveControls: PreventiveControlItem[] = [
    {
      id: `pc-${timestamp}-1`,
      control: 'Updated Standard Operating Procedure',
      type: 'documentation',
      description: 'Review and update SOPs to address identified gaps and prevent similar incidents',
      status: 'pending',
    },
    {
      id: `pc-${timestamp}-2`,
      control: 'Training Program Enhancement',
      type: 'training',
      description: 'Develop refresher training focusing on the root causes identified in this analysis',
      status: 'pending',
    },
    {
      id: `pc-${timestamp}-3`,
      control: 'Periodic Compliance Audit',
      type: 'monitoring',
      description: 'Implement regular audits to verify adherence to updated procedures',
      frequency: 'Monthly',
      status: 'pending',
    },
  ];
  
  return { 
    actionPlans: { immediate, shortTerm, longTerm },
    preventiveControls,
  };
}

/**
 * Validate corrective actions against analyzed root causes using AI
 */
export async function validateCorrectiveActions(
  problem: string,
  analyzedCauses: AnalyzedCause[],
  actionPlans: ActionPlans,
  incidentContext: IncidentContext
): Promise<{
  isValid: boolean;
  overallAssessment: string;
  alignmentScore: number;
  effectivenessScore: number;
  feasibilityScore: number;
  issues: Array<{
    actionId: string;
    actionType: 'immediate' | 'shortTerm' | 'longTerm';
    issue: string;
    suggestion: string;
    severity: 'critical' | 'warning' | 'info';
  }>;
  recommendations: string[];
  refinedActions?: ActionPlans;
}> {
  const openai = getOpenAIClient();
  
  if (!openai) {
    console.error('AI Validation unavailable: No OpenAI API key configured');
    return {
      isValid: true,
      overallAssessment: 'AI validation is currently unavailable. Please review actions manually.',
      alignmentScore: 70,
      effectivenessScore: 70,
      feasibilityScore: 70,
      issues: [],
      recommendations: ['Manual review recommended when AI validation is available'],
    };
  }

  try {
    const prompt = buildValidationPrompt(problem, analyzedCauses, actionPlans, incidentContext);
    
    const completion = await openai.chat.completions.create({
      model: process.env.AI_MODEL || 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a senior Quality Assurance auditor and CAPA specialist with expertise in evaluating corrective and preventive actions. Your role is to critically assess whether proposed actions will effectively address root causes and prevent recurrence.

EVALUATION CRITERIA:

1. ALIGNMENT (0-100): Do the actions directly address the identified root causes?
   - Each root cause should have corresponding action(s)
   - Actions should target causes, not symptoms
   - No critical root causes should be left unaddressed

2. EFFECTIVENESS (0-100): Will these actions actually solve the problem?
   - Actions should eliminate or significantly reduce risk
   - Consider whether actions are complete or partial fixes
   - Evaluate if preventive measures will prevent recurrence

3. FEASIBILITY (0-100): Are these actions realistic and executable?
   - Consider resource requirements, time constraints
   - Are actions specific enough to implement?
   - Do they account for human factors and organizational realities?

ISSUE SEVERITY LEVELS:
- critical: Action is fundamentally flawed or missing for a key root cause
- warning: Action needs improvement or clarification
- info: Minor suggestion for enhancement

OUTPUT FORMAT (JSON):
{
  "isValid": true/false,
  "overallAssessment": "2-3 sentence overall evaluation",
  "alignmentScore": 0-100,
  "effectivenessScore": 0-100,
  "feasibilityScore": 0-100,
  "issues": [
    {
      "actionId": "action id or 'missing'",
      "actionType": "immediate|shortTerm|longTerm",
      "issue": "Description of the issue",
      "suggestion": "Specific improvement suggestion",
      "severity": "critical|warning|info"
    }
  ],
  "recommendations": ["General improvement recommendation 1", "..."],
  "refinedActions": {
    "immediate": [...improved actions...],
    "shortTerm": [...],
    "longTerm": [...]
  }
}

Include refinedActions ONLY if there are critical or warning issues that need addressing.
The refined actions should be realistic, specific, and directly tied to root causes.`,
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3,
      max_tokens: 3000,
    });

    const response = completion.choices[0]?.message?.content || '';
    
    // Parse JSON response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      
      // Transform refined actions if present
      let refinedActions: ActionPlans | undefined;
      if (parsed.refinedActions) {
        const transformActions = (actions: any[], prefix: string, defaultPriority: 'high' | 'medium' | 'low'): ActionPlanItem[] => {
          return (actions || []).map((a: any, idx: number) => ({
            id: a.id || `${prefix}-${Date.now()}-${idx}`,
            action: a.action || '',
            priority: a.priority || defaultPriority,
            status: 'pending' as const,
            owner: a.owner || '',
            dueDate: a.dueDate || '',
          }));
        };
        
        refinedActions = {
          immediate: transformActions(parsed.refinedActions.immediate, 'imm', 'high'),
          shortTerm: transformActions(parsed.refinedActions.shortTerm, 'st', 'medium'),
          longTerm: transformActions(parsed.refinedActions.longTerm, 'lt', 'medium'),
        };
      }
      
      return {
        isValid: parsed.isValid ?? true,
        overallAssessment: parsed.overallAssessment || 'Validation complete.',
        alignmentScore: parsed.alignmentScore ?? 70,
        effectivenessScore: parsed.effectivenessScore ?? 70,
        feasibilityScore: parsed.feasibilityScore ?? 70,
        issues: parsed.issues || [],
        recommendations: parsed.recommendations || [],
        refinedActions,
      };
    }
    
    return {
      isValid: true,
      overallAssessment: 'Unable to parse AI response. Please review actions manually.',
      alignmentScore: 70,
      effectivenessScore: 70,
      feasibilityScore: 70,
      issues: [],
      recommendations: [],
    };
  } catch (error: any) {
    console.error('AI Validation failed:', error.message);
    return {
      isValid: true,
      overallAssessment: 'AI validation failed. Please review actions manually.',
      alignmentScore: 70,
      effectivenessScore: 70,
      feasibilityScore: 70,
      issues: [],
      recommendations: ['Retry AI validation or perform manual review'],
    };
  }
}

function buildValidationPrompt(
  problem: string,
  analyzedCauses: AnalyzedCause[],
  actionPlans: ActionPlans,
  incidentContext: IncidentContext
): string {
  const parts: string[] = [];
  
  parts.push('=== PROBLEM STATEMENT ===');
  parts.push(problem);
  
  parts.push('\n=== INCIDENT CONTEXT ===');
  parts.push(`Type: ${incidentContext.type}`);
  parts.push(`Severity: ${incidentContext.severity}`);
  parts.push(`Description: ${incidentContext.description}`);
  
  parts.push('\n=== IDENTIFIED ROOT CAUSES ===');
  analyzedCauses.forEach((cause, idx) => {
    parts.push(`${idx + 1}. [${cause.categoryName}] ${cause.causeText}`);
    if (cause.rootCause) {
      parts.push(`   → Root Cause: ${cause.rootCause}`);
    }
  });
  
  parts.push('\n=== PROPOSED CORRECTIVE ACTIONS ===');
  
  parts.push('\nIMMMEDIATE ACTIONS (0-72 hours):');
  if (actionPlans.immediate.length === 0) {
    parts.push('  (none defined)');
  } else {
    actionPlans.immediate.forEach(a => {
      parts.push(`  [${a.id}] ${a.action} (Priority: ${a.priority})`);
    });
  }
  
  parts.push('\nSHORT-TERM ACTIONS (1-4 weeks):');
  if (actionPlans.shortTerm.length === 0) {
    parts.push('  (none defined)');
  } else {
    actionPlans.shortTerm.forEach(a => {
      parts.push(`  [${a.id}] ${a.action} (Priority: ${a.priority})`);
    });
  }
  
  parts.push('\nLONG-TERM ACTIONS (1-6 months):');
  if (actionPlans.longTerm.length === 0) {
    parts.push('  (none defined)');
  } else {
    actionPlans.longTerm.forEach(a => {
      parts.push(`  [${a.id}] ${a.action} (Priority: ${a.priority})`);
    });
  }
  
  parts.push('\n=== VALIDATION TASK ===');
  parts.push('Evaluate these corrective actions against the root causes:');
  parts.push('1. Do the actions adequately address each root cause?');
  parts.push('2. Will these actions effectively prevent recurrence?');
  parts.push('3. Are the actions specific, realistic, and executable?');
  parts.push('4. Are there any gaps or missing actions?');
  parts.push('5. If issues are found, provide refined actions that are more realistic and effective.');
  
  return parts.join('\n');
}

/**
 * AI validation for Safety Incident Form data
 * Enterprise-level validation with deep contextual analysis
 * Validates completeness, logical consistency, N/A appropriateness, and provides intelligent recommendations
 */
export interface SafetyFormValidationResult {
  isComplete: boolean;
  overallScore: number; // 0-100
  issues: Array<{
    fieldName: string;
    fieldLabel: string;
    issueType: 'missing' | 'inappropriate_na' | 'incomplete' | 'inconsistent' | 'contextual_mismatch' | 'illogical_combination';
    message: string;
    recommendation: string;
    suggestedValue?: string; // AI-recommended value based on context
    severity: 'critical' | 'warning' | 'info';
  }>;
  recommendations: string[];
  summary: string;
  contextualInsights?: {
    incidentTypeAlignment: string;
    dataConsistencyScore: number;
    suggestedImprovements: string[];
  };
}

export async function validateSafetyIncidentForm(params: {
  formTab: 'incident-report' | 'investigation';
  incidentCategory: string;
  incidentDescription: string;
  formData: Record<string, any>;
}): Promise<SafetyFormValidationResult> {
  const openai = getOpenAIClient();
  
  const defaultResult: SafetyFormValidationResult = {
    isComplete: true,
    overallScore: 100,
    issues: [],
    recommendations: [],
    summary: 'Form validation unavailable. Please review your entries manually.',
    contextualInsights: {
      incidentTypeAlignment: 'Not analyzed - AI validation unavailable',
      dataConsistencyScore: 100,
      suggestedImprovements: [],
    },
  };
  
  if (!openai) {
    return defaultResult;
  }

  try {
    // Define expected fields based on form tab
    const incidentReportFields = [
      { name: 'injuryType', label: 'Injury Type', required: true, allowsNA: false },
      { name: 'taskBeingPerformed', label: 'Task Being Performed', required: true, allowsNA: true },
      { name: 'bodyPartsAffected', label: 'Body Parts Affected', required: true, allowsNA: false, isArray: true },
      { name: 'taskRoutineType', label: 'Normal vs Non-Routine Task', required: true, allowsNA: false },
      { name: 'exposureDuration', label: 'Duration of Exposure', required: true, allowsNA: true },
      { name: 'taskFrequency', label: 'Frequency of Task', required: true, allowsNA: true },
      { name: 'weightOrForce', label: 'Weight/Force', required: true, allowsNA: true },
      { name: 'environmentalConditions', label: 'Environmental Conditions', required: false, allowsNA: false, isArray: true },
      { name: 'ppeRequired', label: 'PPE Required', required: true, allowsNA: false },
      { name: 'ppeWorn', label: 'PPE Worn', required: true, allowsNA: false },
      { name: 'machineSafeguardsInPlace', label: 'Machine Safeguards in Place', required: true, allowsNA: true },
      { name: 'lotoRequired', label: 'LOTO Required', required: true, allowsNA: true },
      { name: 'sopAvailable', label: 'SOP Available', required: true, allowsNA: false },
      { name: 'sopFollowed', label: 'SOP Followed', required: true, allowsNA: false },
      { name: 'firstAidProvided', label: 'First Aid Provided', required: true, allowsNA: false },
      { name: 'medicalTreatmentRequired', label: 'Medical Treatment Required', required: true, allowsNA: false },
      { name: 'supervisorNotified', label: 'Supervisor Notified', required: true, allowsNA: false },
      { name: 'areaSecured', label: 'Area Secured', required: true, allowsNA: false },
      { name: 'directCause', label: 'Direct Cause', required: true, allowsNA: true },
      { name: 'unsafeActOrCondition', label: 'Unsafe Act vs Unsafe Condition', required: true, allowsNA: true },
      { name: 'previousSimilarIncidents', label: 'Previous Similar Incidents', required: true, allowsNA: false },
      { name: 'injuryDevelopmentType', label: 'Injury Development Type', required: true, allowsNA: false },
      { name: 'dateOfInjury', label: 'Date of Injury', required: true, allowsNA: true },
      { name: 'timeOfInjury', label: 'Time of Injury', required: true, allowsNA: true },
      { name: 'injuryLocation', label: 'Injury Location', required: true, allowsNA: false },
      { name: 'injuryCausedByWork', label: 'Injury Caused by Work', required: true, allowsNA: false },
      { name: 'injuryWitnessed', label: 'Injury Witnessed', required: true, allowsNA: false },
      // Employee Personal Information fields
      { name: 'employeeLastSSN4', label: 'Last 4 SSN', required: false, allowsNA: true },
      { name: 'employeeHomeAddress', label: 'Home Address', required: false, allowsNA: true },
      { name: 'employeeEmail', label: 'Employee Email', required: false, allowsNA: true },
      { name: 'employeePhone', label: 'Employee Phone', required: false, allowsNA: true },
      { name: 'employeeLanguage', label: 'Language Primarily Spoken', required: false, allowsNA: true },
      { name: 'needsInterpreter', label: 'Needs Interpreter', required: false, allowsNA: false },
      { name: 'employeeGender', label: 'Gender', required: false, allowsNA: true },
      { name: 'interpreterAssisting', label: 'Interpreter Assisting', required: false, allowsNA: true },
      // Job Assignment & Compliance fields
      { name: 'ownedJobTitle', label: 'Owned Job Title', required: false, allowsNA: true },
      { name: 'jobAssignmentAtInjury', label: 'Job Assignment at Time of Injury', required: false, allowsNA: true },
      { name: 'departmentWhereInjury', label: 'Department Where Injury Occurred', required: false, allowsNA: true },
      { name: 'oshaCaseNumber', label: 'OSHA Case Number', required: false, allowsNA: true },
      { name: 'isLostTime', label: 'Is Lost Time', required: false, allowsNA: false },
      // Safety Compliance Assessment fields
      { name: 'wasViolationOfSafetyRules', label: 'Was Violation of Safety Rules', required: false, allowsNA: true },
      { name: 'wasProperProcedureFollowed', label: 'Was Proper Procedure Followed', required: false, allowsNA: true },
      { name: 'wasEmployeeInstructedInSOP', label: 'Was Employee Instructed in SOP', required: false, allowsNA: true },
    ];
    
    const investigationFields = [
      { name: 'isOshaRecordable', label: 'OSHA Recordable', required: true, allowsNA: false },
      { name: 'caseClassification', label: 'Case Classification', required: true, allowsNA: true },
      { name: 'employeeName', label: 'Employee Name', required: true, allowsNA: false },
      { name: 'employeeIdNumber', label: 'Employee ID', required: true, allowsNA: true },
      { name: 'positionAtTimeOfIncident', label: 'Position at Time of Incident', required: true, allowsNA: false },
      { name: 'specificInjuryLocation', label: 'Specific Injury Location', required: true, allowsNA: false },
      { name: 'incidentDate', label: 'Incident Date', required: true, allowsNA: false },
      { name: 'incidentTime', label: 'Incident Time', required: true, allowsNA: false },
      { name: 'wasClockedIn', label: 'Was Employee Clocked In', required: true, allowsNA: false },
      { name: 'injuryDevelopmentPattern', label: 'Injury Development Pattern', required: true, allowsNA: true },
      { name: 'injuryWorkRelation', label: 'Injury Work Relation', required: true, allowsNA: false },
      { name: 'incidentDescriptionDetailed', label: 'Detailed Incident Description', required: true, allowsNA: false },
      { name: 'investigationBodyParts', label: 'Investigation Body Parts', required: true, allowsNA: false, isArray: true },
      { name: 'investigationInjuryType', label: 'Investigation Injury Type', required: true, allowsNA: false },
      { name: 'injuryMechanism', label: 'Injury Mechanism', required: true, allowsNA: false },
      { name: 'wasPerformingOtherDuties', label: 'Was Performing Other Duties', required: true, allowsNA: false },
      { name: 'wasInjuryWitnessed', label: 'Was Injury Witnessed', required: true, allowsNA: false },
      { name: 'wereCoworkersPresent', label: 'Were Coworkers Present', required: true, allowsNA: false },
      { name: 'wasIncidentSiteViewed', label: 'Was Incident Site Viewed', required: true, allowsNA: false },
      { name: 'didSiteRevealCause', label: 'Did Site Reveal Cause', required: true, allowsNA: true },
      { name: 'wasInjuryConsistentWithSite', label: 'Was Injury Consistent with Site', required: true, allowsNA: true },
    ];
    
    const fields = params.formTab === 'incident-report' ? incidentReportFields : investigationFields;
    
    // Build field status for AI context
    const fieldStatuses = fields.map(field => {
      const value = params.formData[field.name];
      let status = 'provided';
      let displayValue = value;
      
      if (field.isArray) {
        if (!value || (Array.isArray(value) && value.length === 0)) {
          status = 'empty';
          displayValue = '(not provided)';
        } else {
          displayValue = Array.isArray(value) ? value.join(', ') : value;
        }
      } else if (value === null || value === undefined || value === '') {
        status = 'empty';
        displayValue = '(not provided)';
      } else if (typeof value === 'string' && value.toUpperCase() === 'N/A') {
        status = 'na';
        displayValue = 'N/A';
      } else if (typeof value === 'string' && value.toUpperCase() === 'NA') {
        status = 'na';
        displayValue = 'N/A';
      }
      
      return {
        ...field,
        value: displayValue,
        status,
      };
    });

    const completion = await openai.chat.completions.create({
      model: process.env.AI_MODEL || 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are an enterprise-level Workplace Safety incident documentation expert and validator. Your role is to perform comprehensive, intelligent analysis of safety incident forms to ensure documentation quality meets regulatory and organizational standards.

=== ENTERPRISE VALIDATION FRAMEWORK ===

**1. COMPLETENESS ANALYSIS**
- Identify ALL fields that are blank, empty, or missing
- Detect fields with "N/A", "NA", "n/a", or similar variations (case-insensitive)
- Flag fields where the value appears incomplete or truncated

**2. CONTEXTUAL ALIGNMENT ANALYSIS**
- Evaluate if each field's value logically aligns with:
  * The Incident Type (e.g., Workplace Safety)
  * The Incident Category (e.g., Physical Injury, Ergonomic, Chemical Exposure)
  * The Incident Description narrative
- Flag values that seem inconsistent with the incident context
- Example: If incident describes a chemical burn, "Body Parts Affected: Lower Back" may need verification

**3. INTERNAL CONSISTENCY CHECK (Cross-Field Logic)**
Detect illogical or contradictory field combinations:
- PPE Required = No, but PPE Worn = Yes (inconsistent)
- PPE Required = Yes, but PPE Worn = empty/missing (critical gap)
- SOP Available = No, but SOP Followed = Yes (impossible)
- Machine Safeguards = N/A when incident involves machinery
- LOTO Required = N/A for machine-related incidents
- Injury Witnessed = No, but Witness Names provided (inconsistent)
- Employee left work = No, but Return to work date provided (inconsistent)
- First Aid Provided = No, but Medical Treatment Required = Yes (verify escalation)

**IMPORTANT: ERGONOMIC/STRAIN INJURY CONTEXT**
For ergonomic injuries (strains, sprains, repetitive motion, lifting injuries):
- Area Secured = N/A is APPROPRIATE - there is no hazardous physical area to secure for a strain/sprain
- Environmental Conditions = N/A is APPROPRIATE if the injury is purely from:
  * Repetitive motion
  * Improper lifting technique
  * Weight/force of objects
  * Prolonged awkward postures
- Environmental Conditions IS relevant if conditions contributed:
  * Slippery floors affecting stance while lifting
  * Cramped space forcing awkward posture
  * Cold temperatures stiffening muscles
  * Poor lighting affecting visibility of proper grip
- Machine Safeguards = N/A is APPROPRIATE for manual lifting injuries without machinery involvement
- LOTO Required = N/A is APPROPRIATE for manual handling injuries

**4. N/A APPROPRIATENESS DEEP ANALYSIS**
N/A is ONLY appropriate when:
- The field genuinely does not apply to this specific incident type
- There is a clear, justifiable reason why the field cannot have a value
- The incident context explicitly excludes the need for this information
- FOR ERGONOMIC INJURIES: Area Secured and Environmental Conditions are often legitimately N/A

N/A is INAPPROPRIATE when:
- The incident type typically requires this information
- The incident description suggests this field IS relevant
- Using N/A appears to be avoiding documentation effort
- The field is critical for regulatory compliance (OSHA, workers' comp)

**5. INTELLIGENT RECOMMENDATIONS**
For each issue, provide:
- Clear explanation of WHY it's an issue
- Specific recommendation for correction
- When possible, suggest the most likely appropriate value based on:
  * The Incident Category
  * The Incident Description
  * Common patterns in similar workplace safety incidents
  * Regulatory requirements

**6. SEVERITY CLASSIFICATION**
- "critical": Missing or invalid data that could impact regulatory compliance, legal liability, or worker safety
- "warning": Data quality issues, questionable N/A usage, or inconsistencies that need review
- "info": Minor improvements or best practice suggestions

=== OUTPUT FORMAT (JSON ONLY) ===
{
  "isComplete": boolean (false if ANY critical issues exist),
  "overallScore": number (0-100, deduct 15 for each critical, 8 for warning, 3 for info),
  "issues": [
    {
      "fieldName": "string (exact field name from input)",
      "fieldLabel": "string (human-readable label)",
      "issueType": "missing" | "inappropriate_na" | "incomplete" | "inconsistent" | "contextual_mismatch" | "illogical_combination",
      "message": "string (clear, professional explanation)",
      "recommendation": "string (specific, actionable guidance)",
      "suggestedValue": "string (optional - AI's best guess for appropriate value based on context)",
      "severity": "critical" | "warning" | "info"
    }
  ],
  "recommendations": ["string (general documentation improvement suggestions)"],
  "summary": "string (2-3 sentence professional assessment)",
  "contextualInsights": {
    "incidentTypeAlignment": "string (assessment of how well data matches incident type)",
    "dataConsistencyScore": number (0-100, how internally consistent the data is),
    "suggestedImprovements": ["string (prioritized list of improvements)"]
  }
}`,
        },
        {
          role: 'user',
          content: `=== ENTERPRISE WORKPLACE SAFETY FORM VALIDATION ===

**FORM CONTEXT**
- Form Section: ${params.formTab === 'incident-report' ? 'Incident Report (Initial Documentation)' : 'Incident Investigation (Leader/Supervisor Assessment)'}
- Incident Category: ${params.incidentCategory}
- Incident Description: ${params.incidentDescription}

**FIELD DATA FOR ANALYSIS**
${fieldStatuses.map(f => `• ${f.label} [${f.name}]: ${f.value}
  - Status: ${f.status}
  - Required: ${f.required ? 'YES' : 'No'}
  - N/A Allowed: ${f.allowsNA ? 'Yes (when genuinely not applicable)' : 'NO - Must provide value'}`).join('\n\n')}

**VALIDATION TASKS**
1. Identify ALL missing required fields
2. Evaluate appropriateness of EVERY N/A value against incident context
3. Check for cross-field logical inconsistencies
4. Verify data aligns with the incident category and description
5. Provide intelligent value suggestions where data is missing or inappropriate
6. Generate comprehensive, actionable recommendations

Perform deep analysis considering the incident narrative and category context.`,
        },
      ],
      temperature: 0.2,
      max_tokens: 3000,
      response_format: { type: 'json_object' },
    });

    const response = completion.choices[0]?.message?.content || '';
    const parsed = JSON.parse(response);
    
    return {
      isComplete: parsed.isComplete ?? true,
      overallScore: parsed.overallScore ?? 100,
      issues: (parsed.issues || []).map((issue: any) => ({
        fieldName: issue.fieldName,
        fieldLabel: issue.fieldLabel,
        issueType: issue.issueType,
        message: issue.message,
        recommendation: issue.recommendation,
        suggestedValue: issue.suggestedValue, // AI's intelligent suggestion based on context
        severity: issue.severity,
      })),
      recommendations: parsed.recommendations || [],
      summary: parsed.summary || 'Validation complete.',
      contextualInsights: parsed.contextualInsights || {
        incidentTypeAlignment: 'Not analyzed',
        dataConsistencyScore: 100,
        suggestedImprovements: [],
      },
    };
  } catch (error: any) {
    console.error('Safety form validation failed:', error.message);
    return defaultResult;
  }
}

// ============================================================================
// AI-Powered RCA Coach Guidance
// ============================================================================

interface RCACoachGuidanceParams {
  incidentDescription: string;
  incidentType?: string;
  categoryName?: string;
  currentStep: string;
  selectedMethod?: string;
  currentData?: {
    problemStatement?: string;
    fiveWhysData?: Array<{ why: string; answer: string }>;
    fishboneData?: {
      problem?: string;
      causes?: Record<string, string[]>;
    };
    rootCauseStatement?: string;
    correctiveActions?: string[];
  };
}

interface RCACoachGuidanceResult {
  step: string;
  tips: string[];
  questions: string[];
  examples: string[];
  nextSteps: string[];
  aiInsights?: string;
  suggestedContent?: string;
  commonPitfalls?: string[];
  industryBestPractices?: string[];
  error?: boolean;
}

/**
 * Generate AI-powered contextual guidance for RCA analysis steps
 */
export async function generateRCACoachGuidance(
  params: RCACoachGuidanceParams
): Promise<RCACoachGuidanceResult> {
  const openai = getOpenAIClient();

  // Fallback response with static content
  const fallbackGuidance = getStaticRCAGuidance(params.currentStep, params.selectedMethod);

  if (!openai) {
    console.error('AI RCA Coach unavailable: No OpenAI API key configured');
    return {
      ...fallbackGuidance,
      error: true,
    };
  }

  try {
    const stepContextMap: Record<string, string> = {
      problem_statement: 'Problem Statement Definition',
      five_whys: '5 Whys Analysis',
      fishbone: 'Fishbone (Ishikawa) Diagram',
      root_cause: 'Root Cause Identification',
      corrective_actions: 'Corrective Action Planning',
    };

    const stepContext = stepContextMap[params.currentStep] || params.currentStep;
    
    // Build context about current progress
    let progressContext = '';
    if (params.currentData) {
      if (params.currentData.problemStatement) {
        progressContext += `\nProblem Statement: "${params.currentData.problemStatement}"`;
      }
      if (params.currentData.fiveWhysData && params.currentData.fiveWhysData.length > 0) {
        progressContext += `\n5 Whys Progress:\n${params.currentData.fiveWhysData.map((item, i) => `  Why ${i + 1}: ${item.why} → ${item.answer}`).join('\n')}`;
      }
      if (params.currentData.fishboneData?.problem) {
        progressContext += `\nFishbone Problem: "${params.currentData.fishboneData.problem}"`;
      }
      if (params.currentData.fishboneData?.causes) {
        const causes = Object.entries(params.currentData.fishboneData.causes)
          .filter(([_, v]) => v && v.length > 0)
          .map(([k, v]) => `  ${k}: ${(v as string[]).join(', ')}`);
        if (causes.length > 0) {
          progressContext += `\nFishbone Causes:\n${causes.join('\n')}`;
        }
      }
      if (params.currentData.rootCauseStatement) {
        progressContext += `\nIdentified Root Cause: "${params.currentData.rootCauseStatement}"`;
      }
    }

    const completion = await openai.chat.completions.create({
      model: process.env.AI_MODEL || 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are an expert Root Cause Analysis (RCA) coach and trainer with deep expertise in quality management, Six Sigma, Lean Manufacturing, and OSHA compliance. Your role is to guide users through the RCA process with actionable, industry-relevant advice.

COACHING PRINCIPLES:
1. Be encouraging but precise - guide users toward robust analysis
2. Provide industry-specific examples relevant to their incident type
3. Challenge assumptions constructively
4. Focus on systemic causes, not blame
5. Emphasize evidence-based analysis

INCIDENT CONTEXT:
- Incident Type: ${params.incidentType || 'Not specified'}
- Category: ${params.categoryName || 'Not specified'}
- Description: ${params.incidentDescription || 'Not provided'}
- Current Step: ${stepContext}
- Selected Method: ${params.selectedMethod || 'Not specified'}
${progressContext ? `\nCURRENT PROGRESS:${progressContext}` : ''}

Provide guidance tailored to this specific incident and the user's current progress.

OUTPUT FORMAT (JSON):
{
  "tips": ["3-5 actionable tips specific to this step and incident context"],
  "questions": ["3-5 probing questions to help the user think deeper"],
  "examples": ["1-2 relevant examples based on the incident type"],
  "nextSteps": ["2-3 clear next actions after completing this step"],
  "aiInsights": "A personalized insight paragraph based on the incident description and progress (2-3 sentences)",
  "suggestedContent": "A specific suggestion for what to write/do next based on their progress (1-2 sentences, or null if not applicable)",
  "commonPitfalls": ["2-3 common mistakes to avoid at this stage"],
  "industryBestPractices": ["2-3 industry best practices relevant to this incident type"]
}`,
        },
        {
          role: 'user',
          content: `Please provide comprehensive, tailored RCA coaching guidance for the "${stepContext}" step.

Incident Description: "${params.incidentDescription}"

Make your guidance:
1. Specific to this incident (not generic)
2. Appropriate for the industry/incident type
3. Progressive based on any work already completed
4. Actionable and practical

Return valid JSON only.`,
        },
      ],
      temperature: 0.4,
      max_tokens: 1500,
      response_format: { type: 'json_object' },
    });

    const response = completion.choices[0]?.message?.content || '';
    const parsed = JSON.parse(response);

    return {
      step: params.currentStep,
      tips: parsed.tips || fallbackGuidance.tips,
      questions: parsed.questions || fallbackGuidance.questions,
      examples: parsed.examples || [],
      nextSteps: parsed.nextSteps || fallbackGuidance.nextSteps,
      aiInsights: parsed.aiInsights || undefined,
      suggestedContent: parsed.suggestedContent || undefined,
      commonPitfalls: parsed.commonPitfalls || [],
      industryBestPractices: parsed.industryBestPractices || [],
    };
  } catch (error: any) {
    console.error('AI RCA Coach guidance failed:', error.message);
    return {
      ...fallbackGuidance,
      error: true,
    };
  }
}

/**
 * Get static RCA guidance as fallback when AI is unavailable
 */
function getStaticRCAGuidance(currentStep: string, selectedMethod?: string): RCACoachGuidanceResult {
  const baseGuidance: Record<string, Partial<RCACoachGuidanceResult>> = {
    problem_statement: {
      tips: [
        'Be specific about what happened, when, and where',
        'Include measurable impacts (quantity, cost, time)',
        'Avoid assigning blame or jumping to conclusions',
        'State the problem objectively without implying a cause',
        'Include who was affected and how',
      ],
      questions: [
        'What exactly happened?',
        'When did it occur (date, time, shift)?',
        'Where specifically did it happen?',
        'What is the measurable impact?',
        'Who discovered the problem and who was affected?',
      ],
      nextSteps: [
        'Review your problem statement with stakeholders',
        'Gather initial evidence and data',
        'Proceed to root cause analysis',
      ],
    },
    five_whys: {
      tips: [
        'Ask "why" until you reach a root cause you can act on',
        'Verify each answer before moving to the next why',
        'Consider multiple branches if there are multiple causes',
        'Stop when you reach a systemic or process issue',
        'Focus on processes and systems, not individuals',
      ],
      questions: [
        'Why did this failure occur?',
        'What process allowed this to happen?',
        'What was the underlying cause?',
        'Why wasn\'t this prevented?',
        'What systemic issue enabled this?',
      ],
      nextSteps: [
        'Validate your root cause with evidence',
        'Consider if there are parallel root causes',
        'Document your findings clearly',
      ],
    },
    fishbone: {
      tips: [
        'Consider all 6 categories: Man, Machine, Method, Material, Measurement, Environment',
        'Brainstorm multiple causes per category',
        'Prioritize the most likely causes',
        'Don\'t filter ideas during brainstorming',
        'Use cross-functional input for comprehensive coverage',
      ],
      questions: [
        'Could this be a training or human error issue (Man)?',
        'Was equipment functioning properly (Machine)?',
        'Were procedures followed correctly (Method)?',
        'Were materials within specification (Material)?',
        'Were measurements accurate (Measurement)?',
        'Did environmental factors contribute (Environment)?',
      ],
      nextSteps: [
        'Prioritize top causes by likelihood and impact',
        'Apply 5 Whys to priority causes',
        'Gather evidence to validate or eliminate causes',
      ],
    },
    root_cause: {
      tips: [
        'The root cause should be actionable',
        'It should prevent recurrence if addressed',
        'Validate with evidence before finalizing',
        'Ensure it addresses the systemic issue, not just symptoms',
        'Consider if there are multiple root causes',
      ],
      questions: [
        'If we fix this, will the problem be prevented?',
        'Is this a cause we can actually address?',
        'Do we have evidence supporting this conclusion?',
        'Have we checked for contributing causes?',
      ],
      nextSteps: [
        'Document the root cause statement clearly',
        'Get validation from stakeholders',
        'Proceed to corrective action planning',
      ],
    },
    corrective_actions: {
      tips: [
        'Include both immediate containment and long-term prevention',
        'Assign clear owners and due dates',
        'Make actions SMART: Specific, Measurable, Achievable, Relevant, Time-bound',
        'Consider training, process, and system changes',
        'Plan for verification of effectiveness',
      ],
      questions: [
        'What immediate action prevents further damage?',
        'What long-term change prevents recurrence?',
        'Who is responsible for implementation?',
        'How will we verify the actions are effective?',
        'What resources are needed?',
      ],
      nextSteps: [
        'Assign owners and set deadlines',
        'Create implementation plan',
        'Schedule effectiveness verification',
      ],
    },
  };

  const guidance = baseGuidance[currentStep] || baseGuidance.problem_statement;
  
  return {
    step: currentStep,
    tips: guidance.tips || [],
    questions: guidance.questions || [],
    examples: [],
    nextSteps: guidance.nextSteps || [],
  };
}

/**
 * Generate preventive controls specifically for 5 Whys analysis
 * Uses the root cause and analysis steps to create targeted prevention measures
 */
export async function generatePreventiveControlsForFiveWhys(
  rootCause: string,
  fiveWhysSteps: Array<{ stepNumber: number; question: string; answer: string }>,
  incidentContext: IncidentContext,
  existingControls?: PreventiveControlItem[]
): Promise<{ preventiveControls: PreventiveControlItem[] }> {
  const openai = getOpenAIClient();
  
  if (!openai) {
    console.error('AI Preventive Controls unavailable: No OpenAI API key configured');
    return generateFallbackPreventiveControls(rootCause, fiveWhysSteps);
  }

  try {
    // Build context from 5 Whys
    const whysContext = fiveWhysSteps
      .filter(step => step.answer?.trim())
      .map(step => `Why ${step.stepNumber}: ${step.answer}`)
      .join('\n');

    const existingControlsContext = existingControls && existingControls.length > 0
      ? `\n\nEXISTING CONTROLS (avoid duplicating these):\n${existingControls.map(c => `- ${c.control}: ${c.description}`).join('\n')}`
      : '';

    const prompt = `=== ROOT CAUSE (from 5 Whys Analysis) ===
${rootCause}

=== 5 WHYS ANALYSIS PATH ===
${whysContext}

=== INCIDENT CONTEXT ===
Type: ${incidentContext.type}
Severity: ${incidentContext.severity}
Description: ${incidentContext.description}
${incidentContext.categoryName ? `Category: ${incidentContext.categoryName}` : ''}
${incidentContext.facilityName ? `Facility: ${incidentContext.facilityName}` : ''}
${existingControlsContext}

Based on this analysis, generate 4-6 preventive controls that will systematically prevent this issue from recurring. Focus on controls that address the root cause and key failure points identified in the 5 Whys analysis.`;

    const completion = await openai.chat.completions.create({
      model: process.env.AI_MODEL || 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a world-class Quality and Safety expert who helps organizations prevent incidents from recurring. You think like a seasoned professional who has seen countless failure modes and knows exactly what controls work in practice.

YOUR APPROACH:
- You speak in clear, simple English that anyone can understand
- You provide practical, implementable controls (not theoretical or vague)
- You focus on what actually prevents problems, not just detecting them
- You consider the human element - people make mistakes, systems should catch them
- You balance effectiveness with practicality (not overly burdensome)

PREVENTIVE CONTROL TYPES:
1. PROCESS: Changes to how work is done - new steps, different sequences, automation
2. TRAINING: Building competence and awareness - not just "more training" but specific skills
3. EQUIPMENT: Physical changes - guards, sensors, alarms, better tools, maintenance
4. DOCUMENTATION: Checklists, clear procedures, visual aids, standardized forms
5. MONITORING: Regular checks, audits, metrics tracking, early warning systems

GOLDEN RULES:
- Each control should directly address the root cause or a key failure point
- Controls should be specific enough to implement tomorrow
- Include verification methods (how do we know it's working?)
- Consider failure modes - what could cause this control to fail?
- Think about sustainability - will this control be maintained over time?

OUTPUT FORMAT (JSON):
{
  "preventiveControls": [
    {
      "id": "pc-1",
      "control": "Short, clear name (e.g., 'Pre-shift Equipment Inspection Checklist')",
      "type": "process|training|equipment|documentation|monitoring",
      "description": "Clear explanation of what this control does, how it prevents the problem, and how to implement it. Write as if explaining to a smart colleague who wasn't involved in this investigation.",
      "frequency": "For monitoring/documentation controls: Daily, Weekly, Per shift, etc.",
      "verification": "How we'll know this control is working"
    }
  ]
}

Generate controls that a safety professional would be proud to present to management. Be specific, practical, and human.`,
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.4,
      max_tokens: 2500,
    });

    const response = completion.choices[0]?.message?.content || '';
    
    // Parse JSON response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      
      // Transform preventive controls with proper IDs and defaults
      const preventiveControls: PreventiveControlItem[] = (parsed.preventiveControls || []).map((c: any, idx: number) => ({
        id: `pc-${Date.now()}-${idx}`,
        control: c.control || '',
        type: c.type || 'process',
        description: c.description || '',
        owner: c.owner || '',
        targetDate: c.targetDate || '',
        status: 'pending' as const,
        frequency: c.frequency || '',
      }));
      
      return { preventiveControls };
    }
    
    return generateFallbackPreventiveControls(rootCause, fiveWhysSteps);
  } catch (error: any) {
    console.error('AI Preventive Controls generation failed:', error.message);
    return generateFallbackPreventiveControls(rootCause, fiveWhysSteps);
  }
}

/**
 * Generate fallback preventive controls when AI is unavailable
 */
function generateFallbackPreventiveControls(
  rootCause: string,
  fiveWhysSteps: Array<{ stepNumber: number; question: string; answer: string }>
): { preventiveControls: PreventiveControlItem[] } {
  const controls: PreventiveControlItem[] = [
    {
      id: `pc-${Date.now()}-1`,
      control: 'Root Cause Training Session',
      type: 'training',
      description: `Conduct a focused training session with all relevant personnel on the identified root cause: "${rootCause.substring(0, 100)}...". Include discussion of warning signs and proper response procedures.`,
      owner: '',
      targetDate: '',
      status: 'pending',
      frequency: '',
    },
    {
      id: `pc-${Date.now()}-2`,
      control: 'Process Verification Checklist',
      type: 'documentation',
      description: 'Create a verification checklist that includes checkpoints at each stage where failures were identified in the 5 Whys analysis. Ensure all critical steps are verified before proceeding.',
      owner: '',
      targetDate: '',
      status: 'pending',
      frequency: 'Per task',
    },
    {
      id: `pc-${Date.now()}-3`,
      control: 'Weekly Compliance Audit',
      type: 'monitoring',
      description: 'Implement weekly audits to verify that new procedures are being followed and controls are effective. Track compliance metrics and address any gaps immediately.',
      owner: '',
      targetDate: '',
      status: 'pending',
      frequency: 'Weekly',
    },
    {
      id: `pc-${Date.now()}-4`,
      control: 'Standard Operating Procedure Update',
      type: 'process',
      description: 'Update relevant SOPs to incorporate lessons learned from this incident. Include clear decision points and escalation procedures to prevent similar issues.',
      owner: '',
      targetDate: '',
      status: 'pending',
      frequency: '',
    },
  ];

  return { preventiveControls: controls };
}

