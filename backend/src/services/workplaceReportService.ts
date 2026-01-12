import { PDFDocument, PDFCheckBox, PDFTextField } from 'pdf-lib';
import * as fs from 'fs';
import * as path from 'path';
import { format } from 'date-fns';

// Field mapping from database fields to PDF form field names
const PDF_FIELD_MAPPING: Record<string, string> = {
  // Employee Information
  employeeName: 'Employee name First middle and last',
  employeeIdNumber: 'Employee ID',
  employeeLastSSN4: 'Last 4 digits of SSN',
  ownedJobTitle: 'Owned job title and department',
  employeeHomeAddress: 'Home address',
  employeeEmail: 'Employee email',
  employeePhone: 'Current phone',
  employeeLanguage: 'Language primarily spoken ie English Spanish etc',
  employeeGender: 'I identify my gender as optional',
  
  // Location/Facility
  facilityName: 'LocationFacility',
  jobAssignmentAtInjury: 'Job assignment where injury took place',
  departmentWhereInjury: 'Department where injury took place',
  oshaCaseNumber: 'OSHA Case Number',
  
  // Injury Details
  injuryLocation: 'Where did this injury happen Be specific on location',
  dateInjuryKnownWorkRelated: 'Date you first knew your injury was caused or made worse by your work activity at Hormel Foods',
  allBodyPartsInjured: 'List ALL body parts injured',
  notifiedIndividuals: 'List names of ALL people you spoke with following this injury including supervisor reported injury to',
  incidentDescriptionDetailed: 'Describe clearly HOW the accidentinjury occurred include equipment machinery tools chemicals operation PPE used weight and size of material Be Specific',
  medicalProvidersInvolved: 'Have you reported to the medical department for this injury Yes or  No If yes then list all medical providers with whom you have treated for this injury',
  contributingActsConditions: 'Describe what acts or conditions contributed mostly to this accidentinjury Be Specific',
  injuryTypeDescription: 'Describe type of injury  ie strain sprain etc',
  previousSimilarConditionDetails: 'In the past have you used a leave of absence or reported to the medical department for a similar condition Yes or  No If yes please explain when and for what condition',
  
  // Medical History
  treatingDoctors: 'List applicable treating doctors or medical facilities',
  priorSurgeryDescription: 'Describe nature of prior surgery or recommended procedures',
  
  // Employment
  otherEmployerNames: 'Names and address of all additional employers you are currently working for',
  additionalEmployerHours: 'Hours regularly worked per week for additional employers',
  additionalEmployerStartDate: 'Start date for additional employers',
  workedForOtherLast6Months: 'Have you worked for any other employers during the last six 6 months Yes or  No If yes what Employer',
  
  // Witness Information
  witnessNames: 'Was this injury witnessed Yes or  No If yes list names',
  
  // Dates and Times
  reportDate: 'Report Date',
  dateOfInjury: 'Date of injury',
  timeOfInjury: 'Time of injury',
};

// Checkbox field mappings (based on PDF structure - these are generic names)
// The checkboxes in the PDF use generic names like "Check Box37", "Check Box38", etc.
// Based on the PDF structure, these likely correspond to Yes/No questions and body part selections

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
  employeeLastSSN4?: string;
  ownedJobTitle?: string;
  employeeHomeAddress?: string;
  employeeEmail?: string;
  employeePhone?: string;
  employeeLanguage?: string;
  employeeGender?: string;
  
  // Location
  Facility?: { name: string };
  jobAssignmentAtInjury?: string;
  departmentWhereInjury?: string;
  oshaCaseNumber?: string;
  
  // Injury Details
  injuryLocation?: string;
  dateInjuryKnownWorkRelated?: string;
  allBodyPartsInjured?: string;
  bodyPartsAffected?: string[];
  notifiedIndividuals?: string;
  incidentDescriptionDetailed?: string;
  medicalProvidersInvolved?: string;
  contributingActsConditions?: string;
  injuryType?: string;
  injuryTypeDescription?: string;
  previousSimilarConditionDetails?: string;
  
  // Medical
  treatingDoctors?: string;
  priorSurgeryDescription?: string;
  medicalTreatmentRequired?: boolean;
  reportedToMedicalDept?: boolean;
  
  // Employment
  additionalEmployers?: string;
  otherEmployerNames?: string;
  additionalEmployerHours?: string;
  additionalEmployerStartDate?: string;
  workedForOtherLast6Months?: boolean;
  employedElsewhere?: boolean;
  
  // Witness
  witnessNames?: string;
  injuryWitnessed?: boolean;
  wasInjuryWitnessed?: boolean;
  
  // Date/Time
  dateOfInjury?: string;
  timeOfInjury?: string;
  incidentTime?: string;
  
  // Boolean fields for checkboxes
  isOshaRecordable?: boolean;
  isLostTime?: boolean;
  ppeRequired?: boolean;
  ppeWorn?: boolean;
  firstAidProvided?: boolean;
  supervisorNotified?: boolean;
  needsInterpreter?: boolean;
  interpreterAssisting?: boolean;
  priorSurgeryPerformed?: boolean;
  previousSimilarConditionReported?: boolean;
  sopAvailable?: boolean;
  sopFollowed?: boolean;
  isRoutineTask?: boolean;
  didLeaveWork?: boolean;
  didReturnToWork?: boolean;
  wasClockedIn?: boolean;
  
  [key: string]: any;
}

/**
 * Generate a filled PDF report for a workplace safety incident
 */
export async function generateWorkplaceReportPDF(incident: IncidentData): Promise<Buffer> {
  const templatePath = path.join(__dirname, '..', '..', 'assets', 'pdfs', 'workplace', 'employee-injury-report-template.pdf');
  
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
  const setCheckBox = (fieldName: string, checked: boolean) => {
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
  
  // Helper function to format date
  const formatDate = (dateStr: string | null | undefined): string => {
    if (!dateStr) return '';
    try {
      return format(new Date(dateStr), 'MM/dd/yyyy');
    } catch {
      return dateStr;
    }
  };
  
  // Helper function to format time
  const formatTime = (timeStr: string | null | undefined): string => {
    if (!timeStr) return '';
    // If it's already in a simple format, return as-is
    if (timeStr.match(/^\d{1,2}:\d{2}/)) return timeStr;
    try {
      return format(new Date(timeStr), 'HH:mm');
    } catch {
      return timeStr;
    }
  };
  
  // ===== Fill Employee Information =====
  setTextField('Employee name First middle and last', incident.employeeName);
  setTextField('Employee ID', incident.employeeIdNumber);
  setTextField('Last 4 digits of SSN', incident.employeeLastSSN4);
  setTextField('Owned job title and department', incident.ownedJobTitle);
  setTextField('Home address', incident.employeeHomeAddress);
  setTextField('Employee email', incident.employeeEmail);
  setTextField('Current phone', incident.employeePhone);
  setTextField('Language primarily spoken ie English Spanish etc', incident.employeeLanguage);
  setTextField('I identify my gender as optional', incident.employeeGender);
  
  // ===== Fill Location/Facility =====
  setTextField('LocationFacility', incident.Facility?.name);
  setTextField('Job assignment where injury took place', incident.jobAssignmentAtInjury);
  setTextField('Department where injury took place', incident.departmentWhereInjury);
  setTextField('OSHA Case Number', incident.oshaCaseNumber);
  
  // ===== Fill Injury Details =====
  setTextField('Where did this injury happen Be specific on location', 
    incident.injuryLocation || incident.specificInjuryLocation);
  setTextField('Date you first knew your injury was caused or made worse by your work activity at Hormel Foods', 
    formatDate(incident.dateInjuryKnownWorkRelated));
  
  // Body parts - combine array if exists
  const bodyParts = incident.allBodyPartsInjured || 
    (incident.bodyPartsAffected ? incident.bodyPartsAffected.join(', ') : '');
  setTextField('List ALL body parts injured', bodyParts);
  
  setTextField('List names of ALL people you spoke with following this injury including supervisor reported injury to',
    incident.notifiedIndividuals);
  
  // Detailed description - use the most detailed available
  const detailedDescription = incident.incidentDescriptionDetailed || incident.description;
  setTextField('Describe clearly HOW the accidentinjury occurred include equipment machinery tools chemicals operation PPE used weight and size of material Be Specific',
    detailedDescription);
  
  // Medical treatment field - combine yes/no with provider list
  let medicalInfo = '';
  if (incident.reportedToMedicalDept === true || incident.medicalTreatmentRequired === true) {
    medicalInfo = 'Yes. ';
    if (incident.medicalProvidersInvolved) {
      medicalInfo += incident.medicalProvidersInvolved;
    }
  } else if (incident.reportedToMedicalDept === false) {
    medicalInfo = 'No';
  }
  setTextField('Have you reported to the medical department for this injury Yes or  No If yes then list all medical providers with whom you have treated for this injury',
    medicalInfo || incident.medicalProvidersInvolved);
  
  setTextField('Describe what acts or conditions contributed mostly to this accidentinjury Be Specific',
    incident.contributingActsConditions);
  setTextField('Describe type of injury  ie strain sprain etc',
    incident.injuryTypeDescription || incident.injuryType);
  
  // Previous condition
  let prevCondition = '';
  if (incident.previousSimilarConditionReported === true) {
    prevCondition = 'Yes. ';
    if (incident.previousSimilarConditionDetails) {
      prevCondition += incident.previousSimilarConditionDetails;
    }
  } else if (incident.previousSimilarConditionReported === false) {
    prevCondition = 'No';
  }
  setTextField('In the past have you used a leave of absence or reported to the medical department for a similar condition Yes or  No If yes please explain when and for what condition',
    prevCondition || incident.previousSimilarConditionDetails);
  
  // ===== Fill Medical History =====
  setTextField('List applicable treating doctors or medical facilities', incident.treatingDoctors);
  setTextField('Describe nature of prior surgery or recommended procedures', incident.priorSurgeryDescription);
  
  // ===== Fill Employment Information =====
  setTextField('Names and address of all additional employers you are currently working for',
    incident.otherEmployerNames || incident.additionalEmployers);
  setTextField('Hours regularly worked per week for additional employers', incident.additionalEmployerHours);
  setTextField('Start date for additional employers', formatDate(incident.additionalEmployerStartDate));
  
  // Other employers in last 6 months
  let otherEmployers = '';
  if (incident.workedForOtherLast6Months === true) {
    otherEmployers = 'Yes';
  } else if (incident.workedForOtherLast6Months === false) {
    otherEmployers = 'No';
  }
  setTextField('Have you worked for any other employers during the last six 6 months Yes or  No If yes what Employer',
    otherEmployers);
  
  // ===== Fill Witness Information =====
  let witnessInfo = '';
  if (incident.injuryWitnessed === true || incident.wasInjuryWitnessed === true) {
    witnessInfo = 'Yes. ';
    if (incident.witnessNames) {
      witnessInfo += incident.witnessNames;
    }
  } else if (incident.injuryWitnessed === false || incident.wasInjuryWitnessed === false) {
    witnessInfo = 'No';
  }
  setTextField('Was this injury witnessed Yes or  No If yes list names',
    witnessInfo || incident.witnessNames);
  
  // ===== Fill Dates and Times =====
  setTextField('Report Date', formatDate(incident.reportedAt));
  setTextField('Date of injury', formatDate(incident.dateOfInjury || incident.occurredAt));
  setTextField('Time of injury', formatTime(incident.timeOfInjury || incident.incidentTime));
  
  // ===== Signature section - just fill names =====
  // Employee name for signature section
  setTextField('Print full name of Employee', incident.employeeName);
  
  // Set interpreter if applicable
  if (incident.needsInterpreter && incident.interpreterAssisting) {
    // The interpreter name would typically come from another source
  }
  
  // ===== Fill Checkbox Fields =====
  // Note: The PDF uses generic checkbox names (Check Box37 through Check Box70)
  // Based on typical workplace injury forms, we'll map common boolean fields
  // The actual mapping may need adjustment based on the specific PDF layout
  
  // Check Box37 - typically "Clocked in at time of injury" - Yes
  if (incident.wasClockedIn === true) {
    setCheckBox('Check Box37', true);
  }
  
  // Check Box38 - typically "Clocked in at time of injury" - No  
  if (incident.wasClockedIn === false) {
    setCheckBox('Check Box38', true);
  }
  
  // Interpreter needed checkboxes (Yes/No)
  if (incident.needsInterpreter === true) {
    setCheckBox('Check Box39', true);  // Yes - interpreter needed
  } else if (incident.needsInterpreter === false) {
    setCheckBox('Check Box40', true);  // No - interpreter not needed
  }
  
  // Medical treatment / first aid provided
  if (incident.medicalTreatmentRequired === true || incident.firstAidProvided === true) {
    setCheckBox('Check Box41', true);
  }
  
  // Supervisor notified
  if (incident.supervisorNotified === true) {
    setCheckBox('Check Box42', true);
  }
  
  // Prior surgery performed
  if (incident.priorSurgeryPerformed === true) {
    setCheckBox('Check Box43', true);  // Yes
  } else if (incident.priorSurgeryPerformed === false) {
    setCheckBox('Check Box44', true);  // No
  }
  
  // PPE Required
  if (incident.ppeRequired === true) {
    setCheckBox('Check Box45', true);  // Yes
  } else if (incident.ppeRequired === false) {
    setCheckBox('Check Box46', true);  // No
  }
  
  // PPE Worn
  if (incident.ppeWorn === true) {
    setCheckBox('Check Box47', true);  // Yes
  } else if (incident.ppeWorn === false) {
    setCheckBox('Check Box48', true);  // No
  }
  
  // OSHA Recordable
  if (incident.isOshaRecordable === true) {
    setCheckBox('Check Box49', true);  // Yes
  } else if (incident.isOshaRecordable === false) {
    setCheckBox('Check Box50', true);  // No
  }
  
  // Lost time injury
  if (incident.isLostTime === true) {
    setCheckBox('Check Box51', true);  // Yes
  } else if (incident.isLostTime === false) {
    setCheckBox('Check Box52', true);  // No
  }
  
  // Injury witnessed
  if (incident.injuryWitnessed === true || incident.wasInjuryWitnessed === true) {
    setCheckBox('Check Box53', true);  // Yes
  } else if (incident.injuryWitnessed === false || incident.wasInjuryWitnessed === false) {
    setCheckBox('Check Box54', true);  // No
  }
  
  // Previous similar condition reported
  if (incident.previousSimilarConditionReported === true) {
    setCheckBox('Check Box55', true);  // Yes
  } else if (incident.previousSimilarConditionReported === false) {
    setCheckBox('Check Box56', true);  // No
  }
  
  // Employed elsewhere / additional employers
  if (incident.employedElsewhere === true || incident.workedForOtherLast6Months === true) {
    setCheckBox('Check Box57', true);  // Yes
  } else if (incident.employedElsewhere === false || incident.workedForOtherLast6Months === false) {
    setCheckBox('Check Box58', true);  // No
  }
  
  // Reported to medical department
  if (incident.reportedToMedicalDept === true) {
    setCheckBox('Check Box59', true);  // Yes
  } else if (incident.reportedToMedicalDept === false) {
    setCheckBox('Check Box60', true);  // No
  }
  
  // SOP available
  if (incident.sopAvailable === true) {
    setCheckBox('Check Box61', true);  // Yes
  } else if (incident.sopAvailable === false) {
    setCheckBox('Check Box62', true);  // No
  }
  
  // SOP followed
  if (incident.sopFollowed === true) {
    setCheckBox('Check Box63', true);  // Yes
  } else if (incident.sopFollowed === false) {
    setCheckBox('Check Box64', true);  // No
  }
  
  // Routine task
  if (incident.isRoutineTask === true) {
    setCheckBox('Check Box65', true);  // Yes
  } else if (incident.isRoutineTask === false) {
    setCheckBox('Check Box66', true);  // No
  }
  
  // Did leave work
  if (incident.didLeaveWork === true) {
    setCheckBox('Check Box67', true);  // Yes
  } else if (incident.didLeaveWork === false) {
    setCheckBox('Check Box68', true);  // No
  }
  
  // Did return to work  
  if (incident.didReturnToWork === true) {
    setCheckBox('Check Box69', true);  // Yes
  } else if (incident.didReturnToWork === false) {
    setCheckBox('Check Box70', true);  // No
  }
  
  // ===== Flatten the form (make fields non-editable) or keep editable =====
  // We'll keep it editable so users can make final adjustments before printing
  // form.flatten();
  
  // Save the PDF
  const pdfBytes = await pdfDoc.save();
  
  return Buffer.from(pdfBytes);
}

/**
 * Get available PDF templates
 */
export function getAvailableTemplates(): string[] {
  const templatesDir = path.join(__dirname, '..', '..', 'assets', 'pdfs', 'workplace');
  
  if (!fs.existsSync(templatesDir)) {
    return [];
  }
  
  return fs.readdirSync(templatesDir)
    .filter(file => file.endsWith('.pdf'));
}

/**
 * Validate that an incident has sufficient data for report generation
 */
export function validateIncidentForReport(incident: IncidentData): { valid: boolean; warnings: string[] } {
  const warnings: string[] = [];
  
  if (!incident.employeeName) {
    warnings.push('Employee name is missing');
  }
  
  if (!incident.dateOfInjury && !incident.occurredAt) {
    warnings.push('Date of injury is missing');
  }
  
  if (!incident.description && !incident.incidentDescriptionDetailed) {
    warnings.push('Incident description is missing');
  }
  
  if (!incident.Facility?.name) {
    warnings.push('Facility/Location is missing');
  }
  
  return {
    valid: true, // We allow generation even with missing fields
    warnings,
  };
}
