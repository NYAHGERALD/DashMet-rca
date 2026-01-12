import ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as path from 'path';
import { format } from 'date-fns';
import { exec } from 'child_process';
import { promisify } from 'util';
import { v4 as uuidv4 } from 'uuid';

const execAsync = promisify(exec);

/**
 * Cell mapping for the Employee Injury Report Excel template
 * Based on the template structure:
 * - Upper section: Data appended after ":" or "?" in columns A and D (rows 4-14)
 * - Middle sections: Data placed in cells below the questions
 * - Signature section: Only employee name mapped
 */

// Upper section field mapping - appends data after the label
const UPPER_SECTION_FIELD_MAPPING: Record<string, { cell: string; label: string }> = {
  employeeName: { cell: 'B4', label: 'Employee name (First, middle and last):' },
  employeeIdNumber: { cell: 'B5', label: 'Employee ID:' },
  employeeLastSSN4: { cell: 'B6', label: 'Last 4 digits of SSN:' },
  employeeHomeAddress: { cell: 'B7', label: 'Home address:' },
  employeeEmail: { cell: 'B8', label: 'Employee email:' },
  employeePhone: { cell: 'B9', label: 'Current phone #:' },
  employeeLanguage: { cell: 'B10', label: 'Language primarily spoken (i.e. English, Spanish, etc.):' },
  needsInterpreter: { cell: 'B11', label: 'Do you need an interpreter to understand this report?' },
  employeeGender: { cell: 'B12', label: 'I identify my gender as (optional):' },
  interpreterAssisting: { cell: 'B13', label: 'Is interpreter assisting with this document?' },
  // Column D fields
  reportDate: { cell: 'D4', label: 'Report Date:' },
  facilityName: { cell: 'D5', label: 'Location/Facility:' },
  ownedJobTitle: { cell: 'D6', label: 'Owned job title and department:' },
  jobAssignmentAtInjury: { cell: 'D7', label: 'Job assignment where injury took place:' },
  departmentWhereInjury: { cell: 'D8', label: 'Department where injury took place:' },
  isOshaRecordable: { cell: 'D9', label: 'OSHA Recordable Non-Recordable:' },
  oshaCaseNumber: { cell: 'D10', label: 'OSHA Case Number:' },
  isLostTime: { cell: 'D11', label: 'Lost Time:' },
  safetyViolation: { cell: 'D12', label: 'Accident a violation of company safety rules:' },
  sopFollowed: { cell: 'D13', label: 'Proper procedure being followed:' },
  sopAvailable: { cell: 'D14', label: 'Employee instructed in safe operating procedures:' },
};

// Middle section field mapping - data goes in cell below the question
const MIDDLE_SECTION_FIELD_MAPPING: Record<string, string> = {
  // Row 17-18: Injury development question, Date of injury, Work caused/made worse
  injuryDevelopedOverTime: 'A18',        // Was your injury something that developed over time...
  dateOfInjury: 'B18',                   // Date of injury
  injuryCausedByWork: 'D18',             // Was your injury caused by work or made worse...
  
  // Row 19-20: Witnessed, Time of injury, Location
  witnessNames: 'A20',                   // Was this injury witnessed? If yes, list names
  timeOfInjury: 'B20',                   // Time of injury
  injuryLocation: 'D20',                 // Where did this injury happen?
  
  // Row 21-22: Start time, Date knew work-related, Body parts
  startTimeOnInjuryDate: 'A22',          // Start time on date of injury
  dateInjuryKnownWorkRelated: 'B22',     // Date you first knew your injury was caused/made worse
  allBodyPartsInjured: 'D22',            // List ALL body parts injured
  
  // Row 23-24: People spoke with, Detailed description
  notifiedIndividuals: 'A24',            // List names of ALL people you spoke with
  incidentDescriptionDetailed: 'B24',    // Describe clearly HOW the accident/injury occurred
  
  // Row 25-26: Medical department, Contributing acts/conditions
  medicalProvidersInvolved: 'A26',       // Have you reported to the medical department...
  contributingActsConditions: 'B26',     // Describe what acts or conditions contributed
  
  // Row 27-28: Injury type, Previous similar condition
  injuryTypeDescription: 'A28',          // Describe type of injury
  previousSimilarConditionDetails: 'B28', // In the past, have you used a leave of absence...
  
  // Row 31-32: Prior medical treatment
  priorMedicalProviders: 'A32',          // Have you treated with any medical providers prior to your injury
  lastMedicalTreatmentDate: 'D32',       // When did you last seek medical treatment prior to your injury
  
  // Row 33-34: Prior surgery
  priorSurgeryOnInjuredPart: 'A34',      // Have you had any prior surgeries performed on same body part
  priorSurgeryDetails: 'B34',            // Describe nature of prior surgery or recommended procedures
  
  // Row 37-38: Additional employment
  employedByOtherCompany: 'A38',         // Are you currently employed by any company other than Hormel Foods
  additionalEmployerNames: 'B38',        // Names and address of all additional employers
  
  // Row 39-40: Additional employment details
  additionalEmployerStartDate: 'B40',    // Start date for additional employer(s)
  additionalEmployerHoursPerWeek: 'A40', // Hours regularly worked per week for additional employer(s)
};

// Signature section - employee name at row 43
const SIGNATURE_FIELD_MAPPING: Record<string, string> = {
  employeeSignatureName: 'A43',  // Print full name of Employee
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
  specificInjuryLocation?: string;
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
  
  // Boolean fields
  injuryDevelopedOverTime?: boolean;
  injuryCausedByWork?: boolean;
  isOshaRecordable?: boolean;
  isLostTime?: boolean;
  ppeRequired?: boolean;
  ppeWorn?: boolean;
  firstAidProvided?: boolean;
  supervisorNotified?: boolean;
  needsInterpreter?: boolean;
  interpreterAssisting?: boolean;
  previousSimilarConditionReported?: boolean;
  sopAvailable?: boolean;
  sopFollowed?: boolean;
  safetyViolation?: boolean;
  
  // Date/Time
  dateOfInjury?: string;
  timeOfInjury?: string;
  incidentTime?: string;
  startTimeOnInjuryDate?: string;
  
  // Witness
  witnessNames?: string;
  injuryWitnessed?: boolean;
  wasInjuryWitnessed?: boolean;
  
  // Prior Medical Treatment
  priorMedicalProviders?: string;
  lastMedicalTreatmentDate?: string;
  treatedPriorToInjury?: boolean;
  
  // Prior Surgery
  priorSurgeryOnInjuredPart?: boolean;
  priorSurgeryDetails?: string;
  
  // Additional Employment
  employedByOtherCompany?: boolean;
  additionalEmployerNames?: string;
  additionalEmployerStartDate?: string;
  additionalEmployerHoursPerWeek?: string;
  
  [key: string]: any;
}

/**
 * Format date for Excel display
 */
const formatDate = (dateStr: string | null | undefined): string => {
  if (!dateStr) return '';
  try {
    return format(new Date(dateStr), 'MM/dd/yyyy');
  } catch {
    return dateStr;
  }
};

/**
 * Format time for Excel display
 */
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

/**
 * Format boolean value for display
 */
const formatBoolean = (value: boolean | null | undefined): string => {
  if (value === true) return 'Yes';
  if (value === false) return 'No';
  return '';
};

/**
 * Generate a filled Excel report for a workplace safety incident
 */
export async function generateWorkplaceReportExcel(incident: IncidentData): Promise<Buffer> {
  const templatePath = path.join(__dirname, '..', '..', 'assets', 'pdfs', 'workplace', 'Employee-Injury-report-template.xlsx');
  
  // Verify template exists
  if (!fs.existsSync(templatePath)) {
    throw new Error('Excel template not found. Please contact system administrator.');
  }
  
  // Load the Excel template
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(templatePath);
  
  // Get the first worksheet
  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error('Excel template has no worksheets.');
  }
  
  // Blue color for loaded values
  const blueColor = { argb: 'FF0000FF' };
  
  // Helper function to safely set cell value with blue color
  const setCellValue = (cellAddress: string, value: string | null | undefined) => {
    if (!value) return;
    try {
      const cell = worksheet.getCell(cellAddress);
      cell.value = value;
      cell.font = { ...cell.font, color: blueColor };
    } catch (error) {
      console.warn(`Could not set cell "${cellAddress}":`, error);
    }
  };
  
  // Helper function to append value to cell with blue color for the appended value
  const appendToCellValue = (cellAddress: string, value: string | null | undefined) => {
    if (!value) return;
    try {
      const cell = worksheet.getCell(cellAddress);
      const currentValue = cell.value?.toString() || '';
      const currentFont = cell.font || {};
      
      // Use rich text to have label in black and value in blue
      cell.value = {
        richText: [
          { text: currentValue + ' ', font: { ...currentFont, color: { argb: 'FF000000' } } },
          { text: value, font: { ...currentFont, color: blueColor, bold: true } }
        ]
      };
    } catch (error) {
      console.warn(`Could not append to cell "${cellAddress}":`, error);
    }
  };
  
  // ===== Fill Upper Section (Column A - B) =====
  // Employee name (First, middle and last)
  appendToCellValue('A4', incident.employeeName);
  
  // Employee ID
  appendToCellValue('A5', incident.employeeIdNumber);
  
  // Last 4 digits of SSN
  appendToCellValue('A6', incident.employeeLastSSN4);
  
  // Home address
  appendToCellValue('A7', incident.employeeHomeAddress);
  
  // Employee email
  appendToCellValue('A8', incident.employeeEmail);
  
  // Current phone #
  appendToCellValue('A9', incident.employeePhone);
  
  // Language primarily spoken
  appendToCellValue('A10', incident.employeeLanguage);
  
  // Do you need an interpreter
  appendToCellValue('A11', formatBoolean(incident.needsInterpreter));
  
  // Gender (optional)
  appendToCellValue('A12', incident.employeeGender);
  
  // Is interpreter assisting
  appendToCellValue('A13', formatBoolean(incident.interpreterAssisting));
  
  // ===== Fill Upper Section (Column D - append data after labels) =====
  // Report Date
  appendToCellValue('D4', formatDate(incident.reportedAt));
  
  // Location/Facility
  appendToCellValue('D5', incident.Facility?.name);
  
  // Owned job title and department
  appendToCellValue('D6', incident.ownedJobTitle);
  
  // Job assignment where injury took place
  appendToCellValue('D7', incident.jobAssignmentAtInjury);
  
  // Department where injury took place
  appendToCellValue('D8', incident.departmentWhereInjury);
  
  // OSHA Recordable Non-Recordable
  appendToCellValue('D9', formatBoolean(incident.isOshaRecordable));
  
  // OSHA Case Number
  appendToCellValue('D10', incident.oshaCaseNumber);
  
  // Lost Time
  appendToCellValue('D11', formatBoolean(incident.isLostTime));
  
  // Accident a violation of company safety rules
  appendToCellValue('D12', formatBoolean(incident.safetyViolation));
  
  // Proper procedure being followed
  appendToCellValue('D13', formatBoolean(incident.sopFollowed));
  
  // Employee instructed in safe operating procedures
  appendToCellValue('D14', formatBoolean(incident.sopAvailable));
  
  // ===== Fill Middle Section (Data cells below questions) =====
  
  // Row 18: Injury development, Date of injury, Work caused
  setCellValue('A18', formatBoolean(incident.injuryDevelopedOverTime));
  setCellValue('B18', formatDate(incident.dateOfInjury || incident.occurredAt));
  setCellValue('D18', formatBoolean(incident.injuryCausedByWork));
  
  // Row 20: Witnessed, Time of injury, Location
  let witnessInfo = '';
  if (incident.injuryWitnessed === true || incident.wasInjuryWitnessed === true) {
    witnessInfo = 'Yes. ';
    if (incident.witnessNames) {
      witnessInfo += incident.witnessNames;
    }
  } else if (incident.injuryWitnessed === false || incident.wasInjuryWitnessed === false) {
    witnessInfo = 'No';
  }
  setCellValue('A20', witnessInfo || incident.witnessNames);
  setCellValue('B20', formatTime(incident.timeOfInjury || incident.incidentTime));
  setCellValue('D20', incident.injuryLocation || incident.specificInjuryLocation);
  
  // Row 22: Start time, Date knew work-related, Body parts
  setCellValue('A22', incident.startTimeOnInjuryDate);
  setCellValue('B22', formatDate(incident.dateInjuryKnownWorkRelated));
  
  // Body parts - combine array if exists
  const bodyParts = incident.allBodyPartsInjured || 
    (incident.bodyPartsAffected ? incident.bodyPartsAffected.join(', ') : '');
  setCellValue('D22', bodyParts);
  
  // Row 24: People spoke with, Detailed description
  setCellValue('A24', incident.notifiedIndividuals);
  
  // Detailed description - use the most detailed available
  const detailedDescription = incident.incidentDescriptionDetailed || incident.description;
  setCellValue('B24', detailedDescription);
  
  // Row 26: Medical department, Contributing acts/conditions
  let medicalInfo = '';
  if (incident.reportedToMedicalDept === true || incident.medicalTreatmentRequired === true) {
    medicalInfo = 'Yes. ';
    if (incident.medicalProvidersInvolved) {
      medicalInfo += incident.medicalProvidersInvolved;
    }
  } else if (incident.reportedToMedicalDept === false) {
    medicalInfo = 'No';
  }
  setCellValue('A26', medicalInfo || incident.medicalProvidersInvolved);
  setCellValue('B26', incident.contributingActsConditions);
  
  // Row 28: Injury type, Previous similar condition
  setCellValue('A28', incident.injuryTypeDescription || incident.injuryType);
  
  let prevCondition = '';
  if (incident.previousSimilarConditionReported === true) {
    prevCondition = 'Yes. ';
    if (incident.previousSimilarConditionDetails) {
      prevCondition += incident.previousSimilarConditionDetails;
    }
  } else if (incident.previousSimilarConditionReported === false) {
    prevCondition = 'No';
  }
  setCellValue('B28', prevCondition || incident.previousSimilarConditionDetails);
  
  // Row 32: Prior medical treatment
  let priorMedicalInfo = '';
  if (incident.treatedPriorToInjury === true) {
    priorMedicalInfo = 'Yes. ';
    if (incident.priorMedicalProviders) {
      priorMedicalInfo += incident.priorMedicalProviders;
    }
  } else if (incident.treatedPriorToInjury === false) {
    priorMedicalInfo = 'No';
  }
  setCellValue('A32', priorMedicalInfo || incident.priorMedicalProviders);
  setCellValue('D32', formatDate(incident.lastMedicalTreatmentDate));
  
  // Row 34: Prior surgery
  let priorSurgeryInfo = '';
  if (incident.priorSurgeryOnInjuredPart === true) {
    priorSurgeryInfo = 'Yes. ';
    if (incident.priorSurgeryDetails) {
      priorSurgeryInfo += incident.priorSurgeryDetails;
    }
  } else if (incident.priorSurgeryOnInjuredPart === false) {
    priorSurgeryInfo = 'No';
  }
  setCellValue('A34', priorSurgeryInfo);
  setCellValue('B34', incident.priorSurgeryDetails);
  
  // Row 38: Additional employment
  let additionalEmploymentInfo = '';
  if (incident.employedByOtherCompany === true) {
    additionalEmploymentInfo = 'Yes';
  } else if (incident.employedByOtherCompany === false) {
    additionalEmploymentInfo = 'No';
  }
  setCellValue('A38', additionalEmploymentInfo);
  setCellValue('B38', incident.additionalEmployerNames);
  
  // Row 40: Additional employment details
  setCellValue('B40', incident.additionalEmployerStartDate);
  setCellValue('A40', incident.additionalEmployerHoursPerWeek);
  
  // ===== Fill Signature Section - Employee Name at Row 43 =====
  setCellValue('A43', incident.employeeName);
  
  // Write workbook to buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/**
 * Generate PDF from filled Excel template using LibreOffice
 * This preserves the exact Excel structure/formatting in the PDF
 */
export async function generateWorkplaceReportPDFFromExcel(incident: IncidentData): Promise<Buffer> {
  // First, generate the filled Excel file
  const excelBuffer = await generateWorkplaceReportExcel(incident);
  
  // Create temp directory if it doesn't exist
  const tempDir = path.join(__dirname, '..', '..', 'temp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  
  // Generate unique filename
  const uniqueId = uuidv4();
  const tempExcelPath = path.join(tempDir, `report-${uniqueId}.xlsx`);
  const tempPdfPath = path.join(tempDir, `report-${uniqueId}.pdf`);
  
  try {
    // Write the filled Excel to temp file
    fs.writeFileSync(tempExcelPath, excelBuffer);
    
    // Use LibreOffice to convert Excel to PDF
    // soffice is the LibreOffice command line tool
    const sofficeCmd = process.platform === 'darwin' 
      ? '/Applications/LibreOffice.app/Contents/MacOS/soffice'
      : 'soffice';
    
    const command = `"${sofficeCmd}" --headless --convert-to pdf --outdir "${tempDir}" "${tempExcelPath}"`;
    
    await execAsync(command);
    
    // Read the generated PDF
    if (!fs.existsSync(tempPdfPath)) {
      throw new Error('PDF generation failed - output file not created');
    }
    
    const pdfBuffer = fs.readFileSync(tempPdfPath);
    
    return pdfBuffer;
  } finally {
    // Clean up temp files
    try {
      if (fs.existsSync(tempExcelPath)) fs.unlinkSync(tempExcelPath);
      if (fs.existsSync(tempPdfPath)) fs.unlinkSync(tempPdfPath);
    } catch (cleanupError) {
      console.warn('Error cleaning up temp files:', cleanupError);
    }
  }
}

/**
 * Validate incident data for report generation
 */
export function validateIncidentForExcelReport(incident: IncidentData): {
  isValid: boolean;
  warnings: string[];
  missingFields: string[];
} {
  const warnings: string[] = [];
  const missingFields: string[] = [];
  
  // Check required fields
  if (!incident.employeeName) {
    missingFields.push('Employee Name');
  }
  if (!incident.dateOfInjury && !incident.occurredAt) {
    missingFields.push('Date of Injury');
  }
  if (!incident.description && !incident.incidentDescriptionDetailed) {
    missingFields.push('Incident Description');
  }
  
  // Check recommended fields
  if (!incident.injuryLocation && !incident.specificInjuryLocation) {
    warnings.push('Injury location is not specified');
  }
  if (!incident.bodyPartsAffected && !incident.allBodyPartsInjured) {
    warnings.push('Body parts affected is not specified');
  }
  if (!incident.Facility?.name) {
    warnings.push('Facility information is missing');
  }
  
  return {
    isValid: missingFields.length === 0,
    warnings,
    missingFields,
  };
}
