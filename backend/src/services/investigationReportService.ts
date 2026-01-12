import { PDFDocument, PDFCheckBox, PDFTextField } from 'pdf-lib';
import * as fs from 'fs';
import * as path from 'path';
import { format } from 'date-fns';

// Field mapping from database fields to PDF form field names for Team Leader Investigation Report
const PDF_FIELD_MAPPING: Record<string, string> = {
  // Employee Information
  employeeName: 'EMPLOYEE NAME',
  employeeIdNumber: 'EMPLOYEE ID NUMBER',
  facilityDept: 'FACILITYDEPT',
  specificLocation: 'SPECIFIC LOCATION WHERE INJURY HAPPENED',
  positionAtIncident: 'POSITION JOB AT TIME OF INCIDENT',
  
  // Incident Details
  incidentDate: 'INCIDENT DATE',
  dateReported: 'DATE INCIDENT REPORTED',
  incidentTime: 'TIME',
  incidentDescription: 'DESCRIPTION OF INCIDENT Mechanism of injury toolmachinery used contributing factors etc',
  bodyPartsInjured: 'LIST OF ALL BODY PARTS REPORTED AS INJURED Be specific',
  witnessNames: 'NAMES OF WITNESSES PRESENT',
  
  // Site Visit / Investigation
  siteVisitConsistency: 'WAS REPORTED MECHANISM OF INJURY AND BODY PARTS INJURED CONSISTANT WITH YOUR SITE VISIT EXPLAIN',
  witnessesInterviewed: 'NAMES OF COEMPLOYEES OR WITNESSES INTERVIEWED',
  
  // Leave/Return
  dateTimeLeft: 'DATETIME LEFT',
  dateTimeReturned: 'DATETIME RETURNED',
  
  // Root Cause Analysis
  rootCause: 'INCIDENT ROOT CAUSE  In your opinion what acts or conditions contributed mostly to this incidentinjury',
  preventionActions: 'WHAT SHOULD BE DONE AND BY WHOM TO PREVENT RECURRENCE OF THIS TYPE OF INCIDENT',
  supervisorActions: 'WHAT ACTIONS ARE YOU AS THE SUPERVISOR TAKING TO SEE THAT THIS IS DONE',
  
  // Signatures - Print Names
  employeePrintName: 'Print full name of Employee',
  interpreterPrintName: 'Print full name of Interpreter',
  supervisorPrintName: 'Print full name of Supervisor',
  superintendentPrintName: 'Print full name of Superintendent',
  plantManagerPrintName: 'Print full name of Plant Manager',
  safetyManagerPrintName: 'Print full name of Safety Manager',
  
  // Signature Dates
  employeeSignDate: 'Date',
  interpreterSignDate: 'Date_2',
  supervisorSignDate: 'Date_3',
  superintendentSignDate: 'Date_4',
  plantManagerSignDate: 'Date_5',
  safetyManagerSignDate: 'Date_6',
};

// Checkbox field mappings for Team Leader Investigation Report
// Based on the PDF structure - these are yes/no questions throughout the form
const CHECKBOX_MAPPING = {
  // Was employee clocked in? (Yes/No)
  wasClockedIn: { yes: 'Check Box37', no: 'Check Box38' },
  
  // Interpreter needed? (Yes/No)
  needsInterpreter: { yes: 'Check Box39', no: 'Check Box40' },
  
  // Was incident site viewed? (Yes/No)
  wasIncidentSiteViewed: { yes: 'Check Box35', no: 'Check Box36' },
  
  // Did site reveal cause? (Yes/No)
  didSiteRevealCause: { yes: 'Check Box43', no: 'Check Box44' },
  
  // Were photos/videos taken? (Yes/No)
  werePhotosVideosTaken: { yes: 'Check Box41', no: 'Check Box42' },
  
  // Was injury consistent with site? (Yes/No)
  wasInjuryConsistentWithSite: { yes: 'Check Box47', no: 'Check Box48' },
  
  // Were coworkers present? (Yes/No)
  wereCoworkersPresent: { yes: 'Check Box45', no: 'Check Box46' },
  
  // Were interviews documented? (Yes/No)
  wereInterviewsDocumented: { yes: 'Check Box49', no: 'Check Box50' },
  
  // Did employee leave work? (Yes/No)
  didLeaveWork: { yes: 'Check Box51', no: 'Check Box52' },
  
  // Did employee return to work? (Yes/No)
  didReturnToWork: { yes: 'Check Box54', no: 'Check Box57' },
  
  // Is this a routine task? (Yes/No)
  isRoutineTask: { yes: 'Check Box58', no: 'Check Box56' },
  
  // Was employee trained for task? (Yes/No)
  wasEmployeeTrained: { yes: 'Check Box55', no: 'Check Box60' },
  
  // SOP available? (Yes/No)
  sopAvailable: { yes: 'Check Box59', no: 'Check Box61' },
  
  // Was employee instructed in SOP? (Yes/No)
  wasEmployeeInstructedInSOP: { yes: 'Check Box62', no: 'Check Box64' },
  
  // Was proper procedure followed? (Yes/No)
  wasProperProcedureFollowed: { yes: 'Check Box63', no: 'Check Box66' },
  
  // Was there a violation of safety rules? (Yes/No)
  wasViolationOfSafetyRules: { yes: 'Check Box65', no: 'Check Box68' },
  
  // PPE required? (Yes/No)
  ppeRequired: { yes: 'Check Box67', no: 'Check Box70' },
  
  // PPE worn? (Yes/No)
  ppeWorn: { yes: 'Check Box69', no: 'Check Box71' },
  
  // Previous similar incidents? (Yes/No)
  previousSimilarIncidents: { yes: 'Check Box72', no: 'Check Box74' },
  
  // OSHA recordable? (Yes/No)
  isOshaRecordable: { yes: 'Check Box73', no: 'Check Box75' },
  
  // Lost time injury? (Yes/No)
  isLostTime: { yes: 'Check Box76', no: null }, // May only have Yes checkbox
};

interface IncidentData {
  id: string;
  incidentNumber: string;
  type: string;
  description: string;
  occurredAt: string;
  reportedAt: string;
  status: string;
  severity?: string;
  
  // Employee Info
  employeeName?: string;
  employeeIdNumber?: string;
  ownedJobTitle?: string;
  positionAtTimeOfIncident?: string;
  
  // Location/Facility
  Facility?: { name: string };
  Department?: { name: string };
  Area?: { name: string };
  injuryLocation?: string;
  specificInjuryLocation?: string;
  jobAssignmentAtInjury?: string;
  
  // Incident Details
  incidentDescriptionDetailed?: string;
  bodyPartsAffected?: string[];
  allBodyPartsInjured?: string;
  witnessNames?: string;
  witnessNamesList?: string;
  incidentTime?: string;
  
  // Investigation Details
  rootCauseDescription?: string;
  contributingActsConditions?: string;
  leaderActsConditionsOpinion?: string;
  preventiveActions?: string;
  preventionRecommendations?: string;
  correctiveActionsPlanned?: string;
  supervisorActions?: string;
  siteVisitConsistency?: string;
  inconsistencyExplanation?: string;
  siteRevealExplanation?: string;
  witnessesInterviewed?: string;
  interviewedNames?: string;
  knownRestrictions?: string;
  
  // Dates/Times
  dateTimeLeft?: string;
  dateTimeReturned?: string;
  leftWorkTime?: string;
  returnedToWorkTime?: string;
  dateTimeLeftWork?: string;
  dateTimeReturnedToWork?: string;
  siteViewDate?: string;
  siteViewTime?: string;
  
  // Personnel Names for Signatures
  supervisorName?: string;
  superintendentName?: string;
  plantManagerName?: string;
  safetyManagerName?: string;
  interpreterName?: string;
  
  // Boolean fields for checkboxes
  wasClockedIn?: boolean;
  needsInterpreter?: boolean;
  interpreterAssisting?: boolean;
  wasIncidentSiteViewed?: boolean;
  didSiteRevealCause?: boolean;
  werePhotosVideosTaken?: boolean;
  wasInjuryConsistentWithSite?: boolean;
  wereCoworkersPresent?: boolean;
  wereInterviewsDocumented?: boolean;
  didLeaveWork?: boolean;
  didReturnToWork?: boolean;
  isRoutineTask?: boolean;
  wasEmployeeTrained?: boolean;
  wasEmployeeInstructedInSOP?: boolean;
  wasProperProcedureFollowed?: boolean;
  wasViolationOfSafetyRules?: boolean;
  sopAvailable?: boolean;
  sopFollowed?: boolean;
  ppeRequired?: boolean;
  ppeWorn?: boolean;
  previousSimilarIncidents?: boolean;
  isOshaRecordable?: boolean;
  isLostTime?: boolean;
  hadPhysicalRestrictions?: boolean;
  wasPerformingOtherDuties?: boolean;
  injuryWitnessed?: boolean;
  wasInjuryWitnessed?: boolean;
  isAreaUnderSurveillance?: boolean;
  wasSurveillanceAvailable?: boolean;
  
  [key: string]: any;
}

/**
 * Generate a filled PDF report for a Team Leader Investigation Report
 */
export async function generateInvestigationReportPDF(incident: IncidentData): Promise<Buffer> {
  const templatePath = path.join(__dirname, '..', '..', 'assets', 'pdfs', 'investigation', 'team-leader-investigation-report-template.pdf');
  
  // Verify template exists
  if (!fs.existsSync(templatePath)) {
    throw new Error('PDF template not found. Please contact system administrator.');
  }
  
  // Load the PDF template
  const templateBytes = fs.readFileSync(templatePath);
  const pdfDoc = await PDFDocument.load(templateBytes);
  const form = pdfDoc.getForm();
  
  // Helper function to safely set text field value
  const setTextField = (fieldName: string, value: string | null | undefined) => {
    if (!value) return;
    try {
      const field = form.getTextField(fieldName);
      if (field) {
        field.setText(value);
      }
    } catch (error) {
      console.warn(`Could not set field "${fieldName}":`, error);
    }
  };
  
  // Helper function to safely set checkbox
  const setCheckBox = (fieldName: string | null, checked: boolean) => {
    if (!fieldName) return;
    try {
      const field = form.getCheckBox(fieldName);
      if (field) {
        if (checked) {
          field.check();
        } else {
          field.uncheck();
        }
      }
    } catch (error) {
      console.warn(`Could not set checkbox "${fieldName}":`, error);
    }
  };
  
  // Helper to format date
  const formatDate = (dateStr: string | null | undefined): string => {
    if (!dateStr) return '';
    try {
      return format(new Date(dateStr), 'MM/dd/yyyy');
    } catch {
      return dateStr;
    }
  };
  
  // Helper to format time
  const formatTime = (dateStr: string | null | undefined): string => {
    if (!dateStr) return '';
    try {
      return format(new Date(dateStr), 'hh:mm a');
    } catch {
      return dateStr;
    }
  };
  
  // ===== Fill Employee Information =====
  setTextField('EMPLOYEE NAME', incident.employeeName);
  setTextField('EMPLOYEE ID NUMBER', incident.employeeIdNumber);
  
  // Facility/Department
  const facilityDept = [
    incident.Facility?.name,
    incident.Department?.name
  ].filter(Boolean).join(' / ');
  setTextField('FACILITYDEPT', facilityDept);
  
  // Specific location
  setTextField('SPECIFIC LOCATION WHERE INJURY HAPPENED', 
    incident.injuryLocation || incident.Area?.name || '');
  
  // Position at time of incident
  setTextField('POSITION JOB AT TIME OF INCIDENT', 
    incident.ownedJobTitle || incident.jobAssignmentAtInjury || '');
  
  // ===== Fill Incident Details =====
  setTextField('INCIDENT DATE', formatDate(incident.occurredAt));
  setTextField('DATE INCIDENT REPORTED', formatDate(incident.reportedAt));
  setTextField('TIME', incident.incidentTime || formatTime(incident.occurredAt));
  
  // Description of incident
  setTextField('DESCRIPTION OF INCIDENT Mechanism of injury toolmachinery used contributing factors etc', 
    incident.incidentDescriptionDetailed || incident.description);
  
  // Body parts injured
  const bodyParts = incident.allBodyPartsInjured || 
    (incident.bodyPartsAffected?.join(', ')) || '';
  setTextField('LIST OF ALL BODY PARTS REPORTED AS INJURED Be specific', bodyParts);
  
  // Witnesses
  setTextField('NAMES OF WITNESSES PRESENT', incident.witnessNames);
  
  // ===== Fill Investigation Details =====
  setTextField('WAS REPORTED MECHANISM OF INJURY AND BODY PARTS INJURED CONSISTANT WITH YOUR SITE VISIT EXPLAIN', 
    incident.inconsistencyExplanation || incident.siteVisitConsistency);
  
  setTextField('NAMES OF COEMPLOYEES OR WITNESSES INTERVIEWED', 
    incident.interviewedNames || incident.witnessesInterviewed);
  
  // Leave/Return times
  setTextField('DATETIME LEFT', incident.dateTimeLeftWork ? formatDate(incident.dateTimeLeftWork) : (incident.dateTimeLeft || incident.leftWorkTime || ''));
  setTextField('DATETIME RETURNED', incident.dateTimeReturnedToWork ? formatDate(incident.dateTimeReturnedToWork) : (incident.dateTimeReturned || incident.returnedToWorkTime || ''));
  
  // ===== Fill Root Cause Analysis =====
  setTextField('INCIDENT ROOT CAUSE  In your opinion what acts or conditions contributed mostly to this incidentinjury', 
    incident.leaderActsConditionsOpinion || incident.rootCauseDescription || incident.contributingActsConditions);
  
  setTextField('WHAT SHOULD BE DONE AND BY WHOM TO PREVENT RECURRENCE OF THIS TYPE OF INCIDENT', 
    incident.preventionRecommendations || incident.preventiveActions || incident.correctiveActionsPlanned);
  
  setTextField('WHAT ACTIONS ARE YOU AS THE SUPERVISOR TAKING TO SEE THAT THIS IS DONE', 
    incident.supervisorActions);
  
  // ===== Fill Signature Section Names =====
  // Only fill employee name - leave others blank for manual entry
  setTextField('Print full name of Employee', incident.employeeName);
  // Leave interpreter, supervisor, superintendent, plant manager, safety manager names blank
  // setTextField('Print full name of Interpreter', incident.interpreterName);
  // setTextField('Print full name of Supervisor', incident.supervisorName);
  // setTextField('Print full name of Superintendent', incident.superintendentName);
  // setTextField('Print full name of Plant Manager', incident.plantManagerName);
  // setTextField('Print full name of Safety Manager', incident.safetyManagerName);
  
  // DON'T auto-fill signature dates - leave blank for manual entry when signing
  // const signatureDate = formatDate(new Date().toISOString());
  // setTextField('Date', signatureDate);
  // etc.
  
  // ===== Fill Checkboxes =====
  
  // Was employee clocked in?
  if (incident.wasClockedIn === true) {
    setCheckBox(CHECKBOX_MAPPING.wasClockedIn.yes, true);
  } else if (incident.wasClockedIn === false) {
    setCheckBox(CHECKBOX_MAPPING.wasClockedIn.no, true);
  }
  
  // Interpreter needed?
  if (incident.needsInterpreter === true || incident.interpreterAssisting === true) {
    setCheckBox(CHECKBOX_MAPPING.needsInterpreter.yes, true);
  } else if (incident.needsInterpreter === false) {
    setCheckBox(CHECKBOX_MAPPING.needsInterpreter.no, true);
  }
  
  // Was incident site viewed?
  if (incident.wasIncidentSiteViewed === true) {
    setCheckBox(CHECKBOX_MAPPING.wasIncidentSiteViewed.yes, true);
  } else if (incident.wasIncidentSiteViewed === false) {
    setCheckBox(CHECKBOX_MAPPING.wasIncidentSiteViewed.no, true);
  }
  
  // Did site reveal cause?
  if (incident.didSiteRevealCause === true) {
    setCheckBox(CHECKBOX_MAPPING.didSiteRevealCause.yes, true);
  } else if (incident.didSiteRevealCause === false) {
    setCheckBox(CHECKBOX_MAPPING.didSiteRevealCause.no, true);
  }
  
  // Were photos/videos taken?
  if (incident.werePhotosVideosTaken === true) {
    setCheckBox(CHECKBOX_MAPPING.werePhotosVideosTaken.yes, true);
  } else if (incident.werePhotosVideosTaken === false) {
    setCheckBox(CHECKBOX_MAPPING.werePhotosVideosTaken.no, true);
  }
  
  // Was injury consistent with site?
  if (incident.wasInjuryConsistentWithSite === true) {
    setCheckBox(CHECKBOX_MAPPING.wasInjuryConsistentWithSite.yes, true);
  } else if (incident.wasInjuryConsistentWithSite === false) {
    setCheckBox(CHECKBOX_MAPPING.wasInjuryConsistentWithSite.no, true);
  }
  
  // Were coworkers present?
  if (incident.wereCoworkersPresent === true) {
    setCheckBox(CHECKBOX_MAPPING.wereCoworkersPresent.yes, true);
  } else if (incident.wereCoworkersPresent === false) {
    setCheckBox(CHECKBOX_MAPPING.wereCoworkersPresent.no, true);
  }
  
  // Were interviews documented?
  if (incident.wereInterviewsDocumented === true) {
    setCheckBox(CHECKBOX_MAPPING.wereInterviewsDocumented.yes, true);
  } else if (incident.wereInterviewsDocumented === false) {
    setCheckBox(CHECKBOX_MAPPING.wereInterviewsDocumented.no, true);
  }
  
  // Did employee leave work?
  if (incident.didLeaveWork === true) {
    setCheckBox(CHECKBOX_MAPPING.didLeaveWork.yes, true);
  } else if (incident.didLeaveWork === false) {
    setCheckBox(CHECKBOX_MAPPING.didLeaveWork.no, true);
  }
  
  // Did employee return to work?
  if (incident.didReturnToWork === true) {
    setCheckBox(CHECKBOX_MAPPING.didReturnToWork.yes, true);
  } else if (incident.didReturnToWork === false) {
    setCheckBox(CHECKBOX_MAPPING.didReturnToWork.no, true);
  }
  
  // Is this a routine task?
  if (incident.isRoutineTask === true) {
    setCheckBox(CHECKBOX_MAPPING.isRoutineTask.yes, true);
  } else if (incident.isRoutineTask === false) {
    setCheckBox(CHECKBOX_MAPPING.isRoutineTask.no, true);
  }
  
  // Was employee trained?
  if (incident.wasEmployeeTrained === true) {
    setCheckBox(CHECKBOX_MAPPING.wasEmployeeTrained.yes, true);
  } else if (incident.wasEmployeeTrained === false) {
    setCheckBox(CHECKBOX_MAPPING.wasEmployeeTrained.no, true);
  }
  
  // SOP available?
  if (incident.sopAvailable === true) {
    setCheckBox(CHECKBOX_MAPPING.sopAvailable.yes, true);
  } else if (incident.sopAvailable === false) {
    setCheckBox(CHECKBOX_MAPPING.sopAvailable.no, true);
  }
  
  // Was employee instructed in SOP?
  if (incident.wasEmployeeInstructedInSOP === true) {
    setCheckBox(CHECKBOX_MAPPING.wasEmployeeInstructedInSOP.yes, true);
  } else if (incident.wasEmployeeInstructedInSOP === false) {
    setCheckBox(CHECKBOX_MAPPING.wasEmployeeInstructedInSOP.no, true);
  }
  
  // Was proper procedure followed?
  if (incident.wasProperProcedureFollowed === true) {
    setCheckBox(CHECKBOX_MAPPING.wasProperProcedureFollowed.yes, true);
  } else if (incident.wasProperProcedureFollowed === false) {
    setCheckBox(CHECKBOX_MAPPING.wasProperProcedureFollowed.no, true);
  }
  
  // Was there a violation of safety rules?
  if (incident.wasViolationOfSafetyRules === true) {
    setCheckBox(CHECKBOX_MAPPING.wasViolationOfSafetyRules.yes, true);
  } else if (incident.wasViolationOfSafetyRules === false) {
    setCheckBox(CHECKBOX_MAPPING.wasViolationOfSafetyRules.no, true);
  }
  
  // PPE required?
  if (incident.ppeRequired === true) {
    setCheckBox(CHECKBOX_MAPPING.ppeRequired.yes, true);
  } else if (incident.ppeRequired === false) {
    setCheckBox(CHECKBOX_MAPPING.ppeRequired.no, true);
  }
  
  // PPE worn?
  if (incident.ppeWorn === true) {
    setCheckBox(CHECKBOX_MAPPING.ppeWorn.yes, true);
  } else if (incident.ppeWorn === false) {
    setCheckBox(CHECKBOX_MAPPING.ppeWorn.no, true);
  }
  
  // Previous similar incidents?
  if (incident.previousSimilarIncidents === true) {
    setCheckBox(CHECKBOX_MAPPING.previousSimilarIncidents.yes, true);
  } else if (incident.previousSimilarIncidents === false) {
    setCheckBox(CHECKBOX_MAPPING.previousSimilarIncidents.no, true);
  }
  
  // OSHA recordable?
  if (incident.isOshaRecordable === true) {
    setCheckBox(CHECKBOX_MAPPING.isOshaRecordable.yes, true);
  } else if (incident.isOshaRecordable === false) {
    setCheckBox(CHECKBOX_MAPPING.isOshaRecordable.no, true);
  }
  
  // Lost time injury?
  if (incident.isLostTime === true) {
    setCheckBox(CHECKBOX_MAPPING.isLostTime.yes, true);
  }
  
  // Keep the form editable (don't flatten) so users can still fill in remaining fields
  // form.flatten();
  
  // Save and return the PDF
  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

/**
 * Validate incident data for investigation report
 */
export function validateIncidentForReport(incident: IncidentData): {
  isValid: boolean;
  warnings: string[];
  errors: string[];
} {
  const warnings: string[] = [];
  const errors: string[] = [];
  
  // Required fields
  if (!incident.employeeName) {
    warnings.push('Employee name is missing');
  }
  
  if (!incident.occurredAt) {
    errors.push('Incident date is required');
  }
  
  if (!incident.description && !incident.incidentDescriptionDetailed) {
    warnings.push('Incident description is missing');
  }
  
  // Recommended fields
  if (!incident.injuryLocation && !incident.Area?.name) {
    warnings.push('Specific incident location is not specified');
  }
  
  if (!incident.rootCauseDescription && !incident.contributingActsConditions) {
    warnings.push('Root cause analysis is not completed');
  }
  
  if (!incident.preventiveActions && !incident.correctiveActionsPlanned) {
    warnings.push('Preventive actions are not specified');
  }
  
  return {
    isValid: errors.length === 0,
    warnings,
    errors,
  };
}
