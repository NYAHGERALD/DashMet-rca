'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';

interface DropdownOption {
  id: string;
  optionType: string;
  value: string;
  label: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  isDefault: boolean;
  isRequired: boolean;
  placeholder: string | null;
  organizationId: string;
}

interface FieldConfiguration {
  id: string;
  incidentType: string;
  fieldName: string;
  fieldLabel: string;
  fieldType: string;
  isRequired: boolean;
  placeholder: string | null;
  helpText: string | null;
  sortOrder: number;
  isActive: boolean;
}

interface DropdownOptionsManagerProps {
  organizationId: string;
  initialTab?: 'dropdowns' | 'fields';
  hideTabNavigation?: boolean;
}

const DROPDOWN_TYPES = [
  // Incident Report dropdown types
  { value: 'INJURY_TYPE', label: 'Injury Type', description: 'First Aid, OSHA Recordable, Near Miss, Lost Time' },
  { value: 'TASK_FREQUENCY', label: 'Frequency of Task', description: 'Continuous, Hourly, Daily, Weekly, Monthly, Rarely' },
  { value: 'UNSAFE_ACT_CONDITION', label: 'Unsafe Act vs Unsafe Condition', description: 'Unsafe Act, Unsafe Condition, Both' },
  { value: 'INJURY_DEVELOPMENT', label: 'Injury Development Type', description: 'Developed Over Time, Occurred on Specific Date' },
  { value: 'SEVERITY_LEVEL', label: 'Severity Level', description: 'Low, Medium, High, Critical' },
  { value: 'BODY_PART', label: 'Body Parts', description: 'Head, Eyes, Back, etc.' },
  { value: 'ENVIRONMENTAL_CONDITION', label: 'Environmental Conditions', description: 'Heat, Cold, Noise, etc.' },
  { value: 'CASE_CLASSIFICATION', label: 'Case Classification', description: 'Medical Only, Restricted Work, Lost Time, Fatality' },
  { value: 'INJURY_WORK_RELATION', label: 'Injury Work Relation', description: 'Caused by work, Made worse by work, etc.' },
  // Investigation-specific dropdown types
  { value: 'CONTRIBUTING_FACTOR_TYPE', label: 'Contributing Factor Type', description: 'People, Process, Equipment, Environment factors' },
  { value: 'POSITION_JOB_TYPE', label: 'Position/Job Type', description: 'Line Operator, Forklift Driver, Maintenance Tech, etc.' },
  { value: 'INJURY_MECHANISM', label: 'Injury Mechanism', description: 'How the injury occurred: Struck by, Fall, Caught in, etc.' },
  { value: 'CORRECTIVE_ACTION_TYPE', label: 'Corrective Action Type', description: 'Engineering, Administrative, PPE, Training, etc.' },
  { value: 'INCIDENT_PATTERN', label: 'Incident Pattern', description: 'Isolated, Recurring, Seasonal, Location-specific patterns' },
  { value: 'TASK_ROUTINE_TYPE', label: 'Task Routine Type', description: 'Normal/Routine task vs Non-routine task' },
  // Employee Information dropdown types
  { value: 'EMPLOYEE_LANGUAGE', label: 'Employee Language', description: 'English, Spanish, French, Chinese, Vietnamese, Korean, Tagalog' },
  { value: 'EMPLOYEE_GENDER', label: 'Employee Gender', description: 'Male, Female, Non-Binary, Prefer Not to Say' },
  // CAPA dropdown types
  { value: 'RESPONSIBLE_PARTY', label: 'Responsible Party', description: 'Team responsible for CAPA actions: QA, Maintenance, Production, Engineering, etc.' },
  // RCA Preventive Controls dropdown types
  { value: 'PREVENTIVE_CONTROL_TYPE', label: 'Preventive Control Type', description: 'Process Change, Training, Equipment, Documentation, Monitoring' },
];

const INCIDENT_TYPES = [
  { value: 'FOOD_SAFETY', label: 'Food Safety', color: 'emerald' },
  { value: 'MACHINE_EQUIPMENT', label: 'Machine & Equipment', color: 'blue' },
  { value: 'WORKPLACE_SAFETY', label: 'Workplace Safety', color: 'amber' },
];

// Predefined system fields for each incident type - these are the actual form fields that exist
const SYSTEM_FIELDS: Record<string, { section: string; fields: { fieldName: string; fieldLabel: string; fieldType: string; description: string; defaultRequired: boolean }[] }[]> = {
  FOOD_SAFETY: [
    {
      section: 'Basic Information',
      fields: [
        { fieldName: 'title', fieldLabel: 'Incident Title', fieldType: 'text', description: 'Brief title for the incident', defaultRequired: true },
        { fieldName: 'description', fieldLabel: 'Description', fieldType: 'textarea', description: 'Detailed description of what happened', defaultRequired: true },
        { fieldName: 'aiSummary', fieldLabel: 'AI Summary', fieldType: 'textarea', description: 'AI-generated professional summary', defaultRequired: false },
      ],
    },
    {
      section: 'Classification',
      fields: [
        { fieldName: 'category', fieldLabel: 'Category', fieldType: 'select', description: 'Main category (Foreign Material, Allergen, etc.)', defaultRequired: true },
        { fieldName: 'subCategory', fieldLabel: 'Sub-Category', fieldType: 'select', description: 'Specific sub-category', defaultRequired: false },
        { fieldName: 'customTitle', fieldLabel: 'Custom Title', fieldType: 'text', description: 'Custom title when "Other" is selected', defaultRequired: false },
        { fieldName: 'severity', fieldLabel: 'Severity Level', fieldType: 'select', description: 'Low, Medium, High, Critical', defaultRequired: true },
      ],
    },
    {
      section: 'Location & Time',
      fields: [
        { fieldName: 'facility', fieldLabel: 'Facility', fieldType: 'select', description: 'Plant/facility where incident occurred', defaultRequired: true },
        { fieldName: 'area', fieldLabel: 'Area', fieldType: 'select', description: 'Area within the facility', defaultRequired: false },
        { fieldName: 'line', fieldLabel: 'Production Line', fieldType: 'select', description: 'Specific production line', defaultRequired: false },
        { fieldName: 'shift', fieldLabel: 'Shift', fieldType: 'select', description: 'Work shift during incident', defaultRequired: false },
        { fieldName: 'occurredAt', fieldLabel: 'Date & Time', fieldType: 'datetime', description: 'When the incident occurred', defaultRequired: true },
      ],
    },
    {
      section: 'Product Information',
      fields: [
        { fieldName: 'productName', fieldLabel: 'Product Name', fieldType: 'text', description: 'Name or SKU of affected product', defaultRequired: false },
        { fieldName: 'lotNumber', fieldLabel: 'Lot/Batch Number', fieldType: 'text', description: 'Production lot or batch number', defaultRequired: false },
      ],
    },
  ],
  MACHINE_EQUIPMENT: [
    {
      section: 'Basic Information',
      fields: [
        { fieldName: 'title', fieldLabel: 'Incident Title', fieldType: 'text', description: 'Brief title for the incident', defaultRequired: true },
        { fieldName: 'description', fieldLabel: 'Description', fieldType: 'textarea', description: 'Detailed description of equipment issue', defaultRequired: true },
        { fieldName: 'aiSummary', fieldLabel: 'AI Summary', fieldType: 'textarea', description: 'AI-generated professional summary', defaultRequired: false },
      ],
    },
    {
      section: 'Classification',
      fields: [
        { fieldName: 'category', fieldLabel: 'Category', fieldType: 'select', description: 'Main category (Mechanical, Electrical, etc.)', defaultRequired: true },
        { fieldName: 'subCategory', fieldLabel: 'Sub-Category', fieldType: 'select', description: 'Specific sub-category', defaultRequired: false },
        { fieldName: 'customTitle', fieldLabel: 'Custom Title', fieldType: 'text', description: 'Custom title when "Other" is selected', defaultRequired: false },
        { fieldName: 'severity', fieldLabel: 'Severity Level', fieldType: 'select', description: 'Low, Medium, High, Critical', defaultRequired: true },
      ],
    },
    {
      section: 'Location & Time',
      fields: [
        { fieldName: 'facility', fieldLabel: 'Facility', fieldType: 'select', description: 'Plant/facility where incident occurred', defaultRequired: true },
        { fieldName: 'area', fieldLabel: 'Area', fieldType: 'select', description: 'Area within the facility', defaultRequired: false },
        { fieldName: 'line', fieldLabel: 'Production Line', fieldType: 'select', description: 'Specific production line', defaultRequired: false },
        { fieldName: 'shift', fieldLabel: 'Shift', fieldType: 'select', description: 'Work shift during incident', defaultRequired: false },
        { fieldName: 'occurredAt', fieldLabel: 'Date & Time', fieldType: 'datetime', description: 'When the incident occurred', defaultRequired: true },
      ],
    },
    {
      section: 'Equipment Details',
      fields: [
        { fieldName: 'machineId', fieldLabel: 'Machine/Equipment ID', fieldType: 'text', description: 'Machine identifier or name', defaultRequired: true },
        { fieldName: 'productName', fieldLabel: 'Product Being Run', fieldType: 'text', description: 'Product being produced at the time', defaultRequired: false },
        { fieldName: 'lotNumber', fieldLabel: 'Lot Number', fieldType: 'text', description: 'Production lot or batch number', defaultRequired: false },
      ],
    },
  ],
  WORKPLACE_SAFETY: [
    {
      section: 'Basic Information',
      fields: [
        { fieldName: 'title', fieldLabel: 'Incident Title', fieldType: 'text', description: 'Brief title for the incident', defaultRequired: true },
        { fieldName: 'description', fieldLabel: 'Description', fieldType: 'textarea', description: 'Detailed description of what happened', defaultRequired: true },
        { fieldName: 'aiSummary', fieldLabel: 'AI Summary', fieldType: 'textarea', description: 'AI-generated professional summary', defaultRequired: false },
      ],
    },
    {
      section: 'Classification',
      fields: [
        { fieldName: 'category', fieldLabel: 'Category', fieldType: 'select', description: 'Main category (Physical Injury, Ergonomic, etc.)', defaultRequired: true },
        { fieldName: 'subCategory', fieldLabel: 'Sub-Category', fieldType: 'select', description: 'Specific sub-category', defaultRequired: false },
        { fieldName: 'customTitle', fieldLabel: 'Custom Title', fieldType: 'text', description: 'Custom title when "Other" is selected', defaultRequired: false },
        { fieldName: 'severity', fieldLabel: 'Severity Level', fieldType: 'select', description: 'Low, Medium, High, Critical', defaultRequired: true },
      ],
    },
    {
      section: 'Location & Time',
      fields: [
        { fieldName: 'facility', fieldLabel: 'Facility', fieldType: 'select', description: 'Plant/facility where incident occurred', defaultRequired: true },
        { fieldName: 'area', fieldLabel: 'Area', fieldType: 'select', description: 'Area within the facility', defaultRequired: false },
        { fieldName: 'line', fieldLabel: 'Production Line', fieldType: 'select', description: 'Specific production line', defaultRequired: false },
        { fieldName: 'shift', fieldLabel: 'Shift', fieldType: 'select', description: 'Work shift during incident', defaultRequired: false },
        { fieldName: 'occurredAt', fieldLabel: 'Date & Time', fieldType: 'datetime', description: 'When the incident occurred', defaultRequired: true },
      ],
    },
    {
      section: 'Injury Details',
      fields: [
        { fieldName: 'injuryType', fieldLabel: 'Injury Type', fieldType: 'select', description: 'First Aid, OSHA Recordable, Near Miss, Lost Time', defaultRequired: true },
        { fieldName: 'bodyPartsAffected', fieldLabel: 'Body Parts Affected', fieldType: 'multiselect', description: 'Select all affected body parts', defaultRequired: true },
        { fieldName: 'taskBeingPerformed', fieldLabel: 'Task Being Performed', fieldType: 'text', description: 'What task was being performed', defaultRequired: true },
        { fieldName: 'isRoutineTask', fieldLabel: 'Routine Task', fieldType: 'checkbox', description: 'Was this a normal/routine task?', defaultRequired: false },
      ],
    },
    {
      section: 'Exposure & Risk Factors',
      fields: [
        { fieldName: 'exposureDuration', fieldLabel: 'Duration of Exposure', fieldType: 'text', description: 'How long was the exposure', defaultRequired: false },
        { fieldName: 'taskFrequency', fieldLabel: 'Task Frequency', fieldType: 'select', description: 'How often is this task performed', defaultRequired: false },
        { fieldName: 'weightOrForce', fieldLabel: 'Weight/Force Involved', fieldType: 'text', description: 'Weight or force if applicable', defaultRequired: false },
        { fieldName: 'environmentalConditions', fieldLabel: 'Environmental Conditions', fieldType: 'multiselect', description: 'Heat, Cold, Noise, Lighting, etc.', defaultRequired: false },
      ],
    },
    {
      section: 'Controls & Compliance',
      fields: [
        { fieldName: 'ppeRequired', fieldLabel: 'PPE Required', fieldType: 'checkbox', description: 'Was PPE required for this task?', defaultRequired: false },
        { fieldName: 'ppeWorn', fieldLabel: 'PPE Worn', fieldType: 'checkbox', description: 'Was PPE being worn?', defaultRequired: false },
        { fieldName: 'machineSafeguardsInPlace', fieldLabel: 'Machine Safeguards', fieldType: 'select', description: 'Were machine safeguards in place?', defaultRequired: false },
        { fieldName: 'lotoRequired', fieldLabel: 'LOTO Required', fieldType: 'select', description: 'Was Lockout/Tagout required?', defaultRequired: false },
        { fieldName: 'sopAvailable', fieldLabel: 'SOP Available', fieldType: 'checkbox', description: 'Was a standard operating procedure available?', defaultRequired: false },
        { fieldName: 'sopFollowed', fieldLabel: 'SOP Followed', fieldType: 'checkbox', description: 'Was the SOP followed?', defaultRequired: false },
      ],
    },
    {
      section: 'Immediate Actions',
      fields: [
        { fieldName: 'firstAidProvided', fieldLabel: 'First Aid Provided', fieldType: 'checkbox', description: 'Was first aid provided?', defaultRequired: false },
        { fieldName: 'medicalTreatmentRequired', fieldLabel: 'Medical Treatment Required', fieldType: 'checkbox', description: 'Was medical treatment required?', defaultRequired: false },
        { fieldName: 'supervisorNotified', fieldLabel: 'Supervisor Notified', fieldType: 'checkbox', description: 'Was a supervisor notified?', defaultRequired: false },
        { fieldName: 'areaSecured', fieldLabel: 'Area Secured', fieldType: 'checkbox', description: 'Was the area secured?', defaultRequired: false },
      ],
    },
    {
      section: 'RCA Analysis',
      fields: [
        { fieldName: 'directCause', fieldLabel: 'Direct Cause', fieldType: 'text', description: 'The immediate/direct cause', defaultRequired: false },
        { fieldName: 'contributingFactors', fieldLabel: 'Contributing Factors', fieldType: 'multiselect', description: 'People, Process, Equipment, Environment', defaultRequired: false },
        { fieldName: 'unsafeActOrCondition', fieldLabel: 'Unsafe Act or Condition', fieldType: 'select', description: 'Was it an unsafe act, condition, or both?', defaultRequired: false },
        { fieldName: 'previousSimilarIncidents', fieldLabel: 'Previous Similar Incidents', fieldType: 'checkbox', description: 'Have similar incidents occurred before?', defaultRequired: false },
      ],
    },
    {
      section: 'Employee Personal Information',
      fields: [
        { fieldName: 'employeeLastSSN4', fieldLabel: 'Last 4 SSN', fieldType: 'text', description: 'Last 4 digits of Social Security Number', defaultRequired: false },
        { fieldName: 'employeeHomeAddress', fieldLabel: 'Home Address', fieldType: 'textarea', description: 'Employee home address', defaultRequired: false },
        { fieldName: 'employeeEmail', fieldLabel: 'Email Address', fieldType: 'text', description: 'Employee personal email', defaultRequired: false },
        { fieldName: 'employeePhone', fieldLabel: 'Current Phone #', fieldType: 'text', description: 'Employee phone number (USA, Canada, Mexico formats)', defaultRequired: false },
        { fieldName: 'employeeLanguage', fieldLabel: 'Language Primarily Spoken', fieldType: 'select', description: 'Primary language spoken by employee', defaultRequired: false },
        { fieldName: 'needsInterpreter', fieldLabel: 'Needs Interpreter', fieldType: 'checkbox', description: 'Does employee need an interpreter?', defaultRequired: false },
        { fieldName: 'employeeGender', fieldLabel: 'Gender', fieldType: 'select', description: 'Employee gender', defaultRequired: false },
        { fieldName: 'interpreterAssisting', fieldLabel: 'Interpreter Assisting', fieldType: 'text', description: 'Name of interpreter if applicable', defaultRequired: false },
      ],
    },
    {
      section: 'Job Assignment & Compliance',
      fields: [
        { fieldName: 'ownedJobTitle', fieldLabel: 'Owned Job Title', fieldType: 'text', description: 'Employee job title at time of injury', defaultRequired: false },
        { fieldName: 'jobAssignmentAtInjury', fieldLabel: 'Job Assignment at Time of Injury', fieldType: 'text', description: 'Specific assignment when injury occurred', defaultRequired: false },
        { fieldName: 'departmentWhereInjury', fieldLabel: 'Department Where Injury Occurred', fieldType: 'text', description: 'Department where incident happened', defaultRequired: false },
        { fieldName: 'oshaCaseNumber', fieldLabel: 'OSHA Case Number', fieldType: 'text', description: 'OSHA case number if applicable', defaultRequired: false },
        { fieldName: 'isLostTime', fieldLabel: 'Is Lost Time', fieldType: 'checkbox', description: 'Did this result in lost time?', defaultRequired: false },
      ],
    },
    {
      section: 'Safety Compliance Assessment',
      fields: [
        { fieldName: 'wasViolationOfSafetyRules', fieldLabel: 'Violation of Safety Rules', fieldType: 'select', description: 'Was there a violation of safety rules?', defaultRequired: false },
        { fieldName: 'wasProperProcedureFollowed', fieldLabel: 'Proper Procedure Followed', fieldType: 'select', description: 'Was the proper procedure followed?', defaultRequired: false },
        { fieldName: 'wasEmployeeInstructedInSOP', fieldLabel: 'Employee Instructed in SOP', fieldType: 'select', description: 'Was employee instructed in SOP for this task?', defaultRequired: false },
      ],
    },
  ],
};

// Simple Toggle Switch Component (defined outside to prevent recreation)
const ToggleSwitch = ({ enabled, onClick, isLoading, label }: { enabled: boolean; onClick: () => void; isLoading?: boolean; label?: string }) => {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('Toggle clicked, enabled:', enabled, 'isLoading:', isLoading);
    if (!isLoading) {
      onClick();
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isLoading}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
        enabled ? 'bg-amber-600' : 'bg-gray-300 dark:bg-slate-600'
      }`}
    >
      <span className="sr-only">{label || 'Toggle'}</span>
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
          enabled ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
};

export default function DropdownOptionsManager({ organizationId, initialTab = 'dropdowns', hideTabNavigation = false }: DropdownOptionsManagerProps) {
  const [activeTab, setActiveTab] = useState<'dropdowns' | 'fields'>(initialTab);
  const [activeDropdownType, setActiveDropdownType] = useState<string>('INJURY_TYPE');
  const [activeIncidentType, setActiveIncidentType] = useState<string>('FOOD_SAFETY');
  const [options, setOptions] = useState<DropdownOption[]>([]);
  const [allOptions, setAllOptions] = useState<Record<string, DropdownOption[]>>({});
  const [fieldConfigs, setFieldConfigs] = useState<FieldConfiguration[]>([]);
  const [allFieldConfigs, setAllFieldConfigs] = useState<Record<string, FieldConfiguration[]>>({});
  const [typeSettings, setTypeSettings] = useState<Record<string, { isRequired: boolean; placeholder: string | null }>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isPopulating, setIsPopulating] = useState(false);
  const [populateSuccess, setPopulateSuccess] = useState<string | null>(null);
  
  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingOption, setEditingOption] = useState<DropdownOption | null>(null);
  const [formData, setFormData] = useState({
    value: '',
    label: '',
    description: '',
    sortOrder: 0,
  });

  // Field config form state
  const [showFieldForm, setShowFieldForm] = useState(false);
  const [editingField, setEditingField] = useState<FieldConfiguration | null>(null);
  const [fieldFormData, setFieldFormData] = useState({
    fieldName: '',
    fieldLabel: '',
    fieldType: 'text',
    isRequired: false,
    placeholder: '',
    helpText: '',
    sortOrder: 0,
  });

  useEffect(() => {
    loadAllOptions();
    loadTypeSettings();
    loadFieldConfigs();
  }, [organizationId]);

  useEffect(() => {
    setOptions(allOptions[activeDropdownType] || []);
  }, [activeDropdownType, allOptions]);

  useEffect(() => {
    setFieldConfigs(allFieldConfigs[activeIncidentType] || []);
  }, [activeIncidentType, allFieldConfigs]);

  const loadAllOptions = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await api.get(`/dropdown-options?organizationId=${organizationId}`);
      const data = response.data.data;
      setAllOptions(data);
      setOptions(data[activeDropdownType] || []);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load dropdown options');
      setAllOptions({});
      setOptions([]);
    } finally {
      setLoading(false);
    }
  };

  const loadTypeSettings = async () => {
    try {
      const response = await api.get(`/dropdown-options/type-settings?organizationId=${organizationId}`);
      setTypeSettings(response.data.data || {});
    } catch (err: any) {
      console.error('Failed to load type settings:', err);
    }
  };

  const loadFieldConfigs = async () => {
    try {
      const response = await api.get(`/dropdown-options/field-config?organizationId=${organizationId}`);
      const data = response.data.data || {};
      setAllFieldConfigs(data);
      setFieldConfigs(data[activeIncidentType] || []);
    } catch (err: any) {
      console.error('Failed to load field configs:', err);
    }
  };

  const loadOptions = async () => {
    await loadAllOptions();
  };

  const getTotalOptionsCount = () => {
    return Object.values(allOptions).reduce((sum, opts) => sum + opts.length, 0);
  };

  const handlePopulateData = async () => {
    const totalCount = getTotalOptionsCount();
    
    let confirmMessage: string;
    
    if (totalCount > 0) {
      confirmMessage = 
        `📊 Add Missing Dropdown Options\n\n` +
        `This organization has ${totalCount} existing dropdown options.\n\n` +
        `Clicking "OK" will add any MISSING dropdown options from the standard set without duplicating existing ones.\n\n` +
        '📋 INCIDENT REPORT OPTIONS:\n' +
        '• Injury Type (6), Task Frequency (7), Unsafe Act/Condition (4)\n' +
        '• Injury Development (3), Severity Level (4), Body Parts (22)\n' +
        '• Environmental Conditions (13), Case Classification (6)\n' +
        '• Injury Work Relation (6), Task Routine Type (2)\n\n' +
        '🔎 INVESTIGATION OPTIONS:\n' +
        '• Contributing Factor Type (21), Position/Job Type (14)\n' +
        '• Injury Mechanism (15), Corrective Action Type (12)\n' +
        '• Incident Pattern (10)\n\n' +
        'Total possible: 145 dropdown options across 16 types\n\n' +
        'Only options that don\'t already exist will be added.\n\n' +
        'Proceed?';
    } else {
      confirmMessage = 
        'This will populate the database with predefined dropdown options:\n\n' +
        '📋 INCIDENT REPORT OPTIONS:\n' +
        '• Injury Type (6 options): First Aid, OSHA Recordable, Near Miss, Lost Time, etc.\n' +
        '• Task Frequency (7 options): Continuous, Hourly, Daily, Weekly, Monthly, etc.\n' +
        '• Unsafe Act/Condition (4 options): Unsafe Act, Unsafe Condition, Both, etc.\n' +
        '• Injury Development (3 options): Specific Date, Developed Over Time, etc.\n' +
        '• Severity Level (4 options): Low, Medium, High, Critical\n' +
        '• Body Parts (22 options): Head, Eyes, Back, Hands, etc.\n' +
        '• Environmental Conditions (13 options): Heat, Cold, Noise, etc.\n' +
        '• Case Classification (6 options): Medical Only, Restricted Work, etc.\n' +
        '• Injury Work Relation (6 options): Caused by Work, Made Worse, etc.\n' +
        '• Task Routine Type (2 options): Normal/Routine, Non-Routine\n\n' +
        '🔎 INVESTIGATION OPTIONS:\n' +
        '• Contributing Factor Type (21 options): People, Process, Equipment, Environment factors\n' +
        '• Position/Job Type (14 options): Line Operator, Forklift Driver, Maintenance Tech, etc.\n' +
        '• Injury Mechanism (15 options): Struck By, Fall, Caught In, Overexertion, etc.\n' +
        '• Corrective Action Type (12 options): Engineering, Administrative, PPE, Training, etc.\n' +
        '• Incident Pattern (10 options): Isolated, Recurring, Seasonal, Location-specific, etc.\n\n' +
        'Total: 145 dropdown options across 16 types\n\n' +
        'Proceed?';
    }

    if (!confirm(confirmMessage)) return;

    setIsPopulating(true);
    setError('');
    setPopulateSuccess(null);

    try {
      const response = await api.post('/dropdown-options/populate', {
        organizationId,
      });
      
      const { totalCreated, typeCounts } = response.data.data;
      
      const successMessage = `Successfully populated ${totalCreated} dropdown options across ${Object.keys(typeCounts).length} types.`;
      
      setPopulateSuccess(successMessage);
      await loadAllOptions();
      await loadTypeSettings();
      
      setTimeout(() => {
        setPopulateSuccess(null);
      }, 5000);
    } catch (err: any) {
      if (err.response?.status === 409) {
        const existingCount = err.response?.data?.existingCount || 0;
        alert(
          `⚠️ Dropdown Options Already Exist\n\n` +
          `This organization already has ${existingCount} dropdown options populated.\n\n` +
          `Data population is only allowed for new organizations without existing dropdown options.\n\n` +
          `You can manually add, edit, or delete options using the buttons above.`
        );
        setError('');
      } else {
        setError(err.response?.data?.error || 'Failed to populate dropdown options');
      }
    } finally {
      setIsPopulating(false);
    }
  };

  const handlePopulateFieldConfigs = async () => {
    if (!confirm('This will populate default field configurations for all incident types. Existing configurations will be preserved. Continue?')) {
      return;
    }

    setIsPopulating(true);
    setError('');

    try {
      const response = await api.post('/dropdown-options/field-config/populate', {
        organizationId,
      });
      
      const { totalCreated, typeCounts } = response.data.data;
      setSuccess(`Created ${totalCreated} field configurations`);
      await loadFieldConfigs();
      
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to populate field configurations');
    } finally {
      setIsPopulating(false);
    }
  };

  const handleToggleRequired = async (optionType: string, isRequired: boolean) => {
    try {
      await api.patch(`/dropdown-options/type-settings/${optionType}`, { isRequired });
      setTypeSettings(prev => ({
        ...prev,
        [optionType]: { ...prev[optionType], isRequired }
      }));
      setSuccess(`${optionType} is now ${isRequired ? 'required' : 'optional'}`);
      setTimeout(() => setSuccess(''), 2000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update setting');
    }
  };

  const handleUpdatePlaceholder = async (optionType: string, placeholder: string) => {
    try {
      await api.patch(`/dropdown-options/type-settings/${optionType}`, { placeholder });
      setTypeSettings(prev => ({
        ...prev,
        [optionType]: { ...prev[optionType], placeholder }
      }));
      setSuccess('Placeholder updated');
      setTimeout(() => setSuccess(''), 2000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update placeholder');
    }
  };

  const handleToggleFieldRequired = async (field: FieldConfiguration) => {
    try {
      await api.patch(`/dropdown-options/field-config/${field.id}`, {
        isRequired: !field.isRequired,
      });
      setSuccess(`${field.fieldLabel} is now ${!field.isRequired ? 'required' : 'optional'}`);
      await loadFieldConfigs();
      setTimeout(() => setSuccess(''), 2000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update field');
    }
  };

  const handleUpdateFieldPlaceholder = async (fieldId: string, placeholder: string) => {
    try {
      await api.patch(`/dropdown-options/field-config/${fieldId}`, { placeholder });
      setSuccess('Placeholder updated');
      await loadFieldConfigs();
      setTimeout(() => setSuccess(''), 2000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update placeholder');
    }
  };

  const resetForm = () => {
    setFormData({
      value: '',
      label: '',
      description: '',
      sortOrder: options.length,
    });
    setEditingOption(null);
    setShowForm(false);
    setError('');
  };

  const resetFieldForm = () => {
    setFieldFormData({
      fieldName: '',
      fieldLabel: '',
      fieldType: 'text',
      isRequired: false,
      placeholder: '',
      helpText: '',
      sortOrder: fieldConfigs.length,
    });
    setEditingField(null);
    setShowFieldForm(false);
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      if (editingOption) {
        await api.patch(`/dropdown-options/${editingOption.id}`, {
          value: formData.value,
          label: formData.label,
          description: formData.description || null,
          sortOrder: formData.sortOrder,
        });
        setSuccess('Option updated successfully');
      } else {
        await api.post('/dropdown-options', {
          optionType: activeDropdownType,
          value: formData.value,
          label: formData.label,
          description: formData.description || null,
          sortOrder: formData.sortOrder,
          organizationId,
        });
        setSuccess('Option created successfully');
      }
      
      await loadOptions();
      resetForm();
      
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save option');
    }
  };

  const handleFieldSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      if (editingField && editingField.id) {
        // Update existing field configuration
        await api.patch(`/dropdown-options/field-config/${editingField.id}`, {
          fieldLabel: fieldFormData.fieldLabel,
          isRequired: fieldFormData.isRequired,
          placeholder: fieldFormData.placeholder || null,
          helpText: fieldFormData.helpText || null,
          sortOrder: fieldFormData.sortOrder,
        });
        setSuccess('Field configuration updated');
      } else {
        // Create new field configuration
        await api.post('/dropdown-options/field-config', {
          incidentType: activeIncidentType,
          fieldName: fieldFormData.fieldName,
          fieldLabel: fieldFormData.fieldLabel,
          fieldType: fieldFormData.fieldType,
          isRequired: fieldFormData.isRequired,
          placeholder: fieldFormData.placeholder || null,
          helpText: fieldFormData.helpText || null,
          sortOrder: fieldFormData.sortOrder,
        });
        setSuccess('Field configuration saved');
      }
      await loadFieldConfigs();
      resetFieldForm();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save field configuration');
    }
  };

  const handleEdit = (option: DropdownOption) => {
    setEditingOption(option);
    setFormData({
      value: option.value,
      label: option.label,
      description: option.description || '',
      sortOrder: option.sortOrder,
    });
    setShowForm(true);
  };

  const handleEditField = (field: FieldConfiguration) => {
    setEditingField(field);
    setFieldFormData({
      fieldName: field.fieldName,
      fieldLabel: field.fieldLabel,
      fieldType: field.fieldType,
      isRequired: field.isRequired,
      placeholder: field.placeholder || '',
      helpText: field.helpText || '',
      sortOrder: field.sortOrder,
    });
    setShowFieldForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this option? This may affect existing incident records.')) {
      return;
    }

    try {
      setError('');
      await api.delete(`/dropdown-options/${id}`);
      setSuccess('Option deleted successfully');
      await loadOptions();
      
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete option');
    }
  };

  const handleToggleActive = async (option: DropdownOption) => {
    try {
      await api.patch(`/dropdown-options/${option.id}`, {
        isActive: !option.isActive,
      });
      await loadOptions();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update option');
    }
  };

  const currentTypeInfo = DROPDOWN_TYPES.find(t => t.value === activeDropdownType);

  // State for tracking toggle loading states
  const [loadingToggles, setLoadingToggles] = useState<Record<string, boolean>>({});

  // Helper to handle toggle with loading state
  const handleToggle = async (key: string, action: () => Promise<void>) => {
    console.log('handleToggle called for:', key);
    setLoadingToggles(prev => ({ ...prev, [key]: true }));
    try {
      await action();
      console.log('Toggle action completed for:', key);
    } catch (err) {
      console.error('Toggle action failed:', err);
      setError('Failed to update field configuration');
    } finally {
      setLoadingToggles(prev => ({ ...prev, [key]: false }));
    }
  };

  return (
    <div className="space-y-6">
      {/* Tab Navigation - hidden when in modal mode */}
      {!hideTabNavigation && (
        <div className="flex border-b border-gray-200 dark:border-slate-700">
          <button
            onClick={() => setActiveTab('dropdowns')}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'dropdowns'
                ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            📋 Dropdown Options
          </button>
          <button
            onClick={() => setActiveTab('fields')}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'fields'
                ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            ⚙️ Field Configuration
          </button>
        </div>
      )}

      {/* Populate Data Success Message */}
      {populateSuccess && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-green-800 dark:text-green-200">{populateSuccess}</p>
          </div>
        </div>
      )}

      {/* Error/Success Messages */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}
      
      {success && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <p className="text-green-800 dark:text-green-200">{success}</p>
        </div>
      )}

      {activeTab === 'dropdowns' && (
        <>
          {/* Populate Data Button - shown when no options exist */}
          {!loading && getTotalOptionsCount() === 0 && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-6">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <svg className="w-10 h-10 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-amber-800 dark:text-amber-200 mb-2">
                    No Dropdown Options Found
                  </h3>
                  <p className="text-sm text-amber-700 dark:text-amber-300 mb-4">
                    Your organization doesn't have any dropdown options configured yet. 
                    Click the button below to populate with predefined options for incident forms.
                  </p>
                  <button
                    onClick={handlePopulateData}
                    disabled={isPopulating}
                    className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg hover:from-amber-600 hover:to-orange-600 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isPopulating ? (
                      <>
                        <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Populating...
                      </>
                    ) : (
                      <>📊 Populate Dropdown Options</>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Dropdown Type Selector with Required Toggle */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-4 sm:p-6 border border-gray-200 dark:border-slate-700">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
                Select Dropdown Type to Manage
              </h3>
              {getTotalOptionsCount() > 0 && (
                <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                  Total: {getTotalOptionsCount()} options across {Object.keys(allOptions).filter(k => allOptions[k]?.length > 0).length} types
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
              {DROPDOWN_TYPES.map((type) => {
                const typeOptionCount = allOptions[type.value]?.length || 0;
                const isRequired = typeSettings[type.value]?.isRequired || false;
                return (
                  <button
                    key={type.value}
                    onClick={() => {
                      setActiveDropdownType(type.value);
                      resetForm();
                    }}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      activeDropdownType === type.value
                        ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300'
                        : 'border-gray-200 dark:border-slate-600 hover:border-gray-300 dark:hover:border-slate-500 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-medium text-sm flex items-center gap-1">
                        {type.label}
                        {isRequired && <span className="text-red-500 font-bold">*</span>}
                      </div>
                      {typeOptionCount > 0 && (
                        <span className="text-xs bg-gray-200 dark:bg-slate-600 px-2 py-0.5 rounded-full">
                          {typeOptionCount}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">
                      {type.description}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Current Type Settings - Required Toggle & Placeholder */}
          {options.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-slate-700">
              <h4 className="text-md font-semibold text-gray-900 dark:text-white mb-4">
                Dropdown Settings: {currentTypeInfo?.label}
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Required Toggle */}
                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Required Field
                    </label>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      When enabled, this dropdown must be filled to submit a form
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {typeSettings[activeDropdownType]?.isRequired ? 'Required' : 'Optional'}
                    </span>
                    <ToggleSwitch
                      enabled={typeSettings[activeDropdownType]?.isRequired || false}
                      onClick={() => handleToggleRequired(activeDropdownType, !typeSettings[activeDropdownType]?.isRequired)}
                      label="Toggle required"
                    />
                  </div>
                </div>

                {/* Placeholder Input */}
                <div className="p-4 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Placeholder Text
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={typeSettings[activeDropdownType]?.placeholder || ''}
                      onChange={(e) => setTypeSettings(prev => ({
                        ...prev,
                        [activeDropdownType]: { ...prev[activeDropdownType], placeholder: e.target.value }
                      }))}
                      placeholder="e.g., Select an option..."
                      className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-amber-500"
                    />
                    <button
                      onClick={() => handleUpdatePlaceholder(activeDropdownType, typeSettings[activeDropdownType]?.placeholder || '')}
                      className="px-3 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 text-sm"
                    >
                      Save
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Current Type Header & Add Button */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2 flex-wrap">
                {currentTypeInfo?.label} Options
                {typeSettings[activeDropdownType]?.isRequired && (
                  <span className="text-red-500 text-xs sm:text-sm font-normal">(Required)</span>
                )}
              </h3>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                {currentTypeInfo?.description}
              </p>
            </div>
            <button
              onClick={() => {
                resetForm();
                setFormData(prev => ({ ...prev, sortOrder: options.length }));
                setShowForm(true);
              }}
              className="w-full sm:w-auto px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors flex items-center justify-center gap-2 text-sm"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Option
            </button>
          </div>

          {/* Info message for BODY_PART dropdown type */}
          {activeDropdownType === 'BODY_PART' && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <h4 className="text-sm font-medium text-blue-800 dark:text-blue-300">
                    Allow Custom Body Part Input
                  </h4>
                  <p className="text-sm text-blue-700 dark:text-blue-400 mt-1">
                    To allow users to specify body parts not listed here, add an option with the value <code className="bg-blue-100 dark:bg-blue-800 px-1.5 py-0.5 rounded font-mono text-xs">OTHER</code>. 
                    When selected, users will be prompted to enter specific details about the affected body part.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Add/Edit Form */}
          {showForm && (
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6 border border-amber-200 dark:border-amber-800">
              <h4 className="text-md font-semibold text-gray-900 dark:text-white mb-4">
                {editingOption ? 'Edit Option' : 'Add New Option'}
              </h4>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Value (stored in database) *
                    </label>
                    <input
                      type="text"
                      value={formData.value}
                      onChange={(e) => setFormData({ ...formData, value: e.target.value.toUpperCase().replace(/\s+/g, '_') })}
                      required
                      placeholder="e.g., FIRST_AID"
                      className="w-full px-3 sm:px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500 text-sm"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Uppercase, underscores for spaces
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Display Label *
                    </label>
                    <input
                      type="text"
                      value={formData.label}
                      onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                      required
                      placeholder="e.g., First Aid"
                      className="w-full px-3 sm:px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500 text-sm"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Description (optional)
                    </label>
                    <input
                      type="text"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Brief description for admins"
                      className="w-full px-3 sm:px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Sort Order
                    </label>
                    <input
                      type="number"
                      value={formData.sortOrder}
                      onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })}
                      min="0"
                      className="w-full px-3 sm:px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500 text-sm"
                    />
                  </div>
                </div>

                <div className="flex flex-col-reverse sm:flex-row justify-end gap-3">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-4 py-2 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700"
                  >
                    {editingOption ? 'Update' : 'Create'} Option
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Options List */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-gray-200 dark:border-slate-700 overflow-hidden">
            {loading ? (
              <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600 mx-auto"></div>
                <p className="text-gray-500 dark:text-gray-400 mt-2">Loading options...</p>
              </div>
            ) : options.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-gray-500 dark:text-gray-400">
                  No options found for {currentTypeInfo?.label}. Click "Add Option" to create one.
                </p>
              </div>
            ) : (
              <div className="max-h-[500px] overflow-y-auto">
                {/* Mobile Card View */}
                <div className="block sm:hidden divide-y divide-gray-200 dark:divide-slate-700">
                  {options.sort((a, b) => a.sortOrder - b.sortOrder).map((option) => (
                    <div key={option.id} className={`p-4 ${!option.isActive ? 'opacity-50' : ''}`}>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-400 dark:text-gray-500">#{option.sortOrder}</span>
                            <span className="text-sm font-medium text-gray-900 dark:text-white">
                              {option.label}
                            </span>
                          </div>
                          {option.description && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                              {option.description}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => handleToggleActive(option)}
                          className={`px-2 py-1 text-xs rounded-full flex-shrink-0 ${
                            option.isActive
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                              : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                          }`}
                        >
                          {option.isActive ? 'Active' : 'Inactive'}
                        </button>
                      </div>
                      <div className="flex items-center justify-between">
                        <code className="text-xs bg-gray-100 dark:bg-slate-700 px-2 py-1 rounded">
                          {option.value}
                        </code>
                        <div className="flex gap-3">
                          <button
                            onClick={() => handleEdit(option)}
                            className="text-amber-600 hover:text-amber-900 dark:text-amber-400 dark:hover:text-amber-300 text-sm"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(option.id)}
                            className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 text-sm"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* Desktop Table View */}
                <table className="w-full hidden sm:table">
                  <thead className="bg-gray-50 dark:bg-slate-900 sticky top-0 z-10">
                  <tr>
                    <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Order
                    </th>
                    <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Label
                    </th>
                    <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden md:table-cell">
                      Value
                    </th>
                    <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 lg:px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                  {options.sort((a, b) => a.sortOrder - b.sortOrder).map((option) => (
                    <tr key={option.id} className={!option.isActive ? 'opacity-50' : ''}>
                      <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {option.sortOrder}
                      </td>
                      <td className="px-4 lg:px-6 py-4">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {option.label}
                        </div>
                        {option.description && (
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {option.description}
                          </div>
                        )}
                        <div className="md:hidden mt-1">
                          <code className="text-xs bg-gray-100 dark:bg-slate-700 px-2 py-0.5 rounded">
                            {option.value}
                          </code>
                        </div>
                      </td>
                      <td className="px-4 lg:px-6 py-4 whitespace-nowrap hidden md:table-cell">
                        <code className="text-xs bg-gray-100 dark:bg-slate-700 px-2 py-1 rounded">
                          {option.value}
                        </code>
                      </td>
                      <td className="px-4 lg:px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => handleToggleActive(option)}
                          className={`px-2 py-1 text-xs rounded-full ${
                            option.isActive
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                              : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                          }`}
                        >
                          {option.isActive ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-right text-sm">
                        <button
                          onClick={() => handleEdit(option)}
                          className="text-amber-600 hover:text-amber-900 dark:text-amber-400 dark:hover:text-amber-300 mr-3"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(option.id)}
                          className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
          </div>
        </>
      )}

      {activeTab === 'fields' && (
        <>
          {/* Field Configuration Section - Configure predefined system fields */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-4 sm:p-6 border border-gray-200 dark:border-slate-700">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
                  Field Configuration by Incident Type
                </h3>
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Configure visibility, labels, and requirements for each form field
                </p>
              </div>
              <button
                onClick={handlePopulateFieldConfigs}
                disabled={isPopulating}
                className="w-full sm:w-auto px-3 sm:px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-lg hover:from-blue-600 hover:to-indigo-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-xs sm:text-sm"
              >
                {isPopulating ? 'Populating...' : '📊 Populate Default Fields'}
              </button>
            </div>
            
            {/* Incident Type Tabs */}
            <div className="flex flex-wrap gap-2 mb-6">
              {INCIDENT_TYPES.map((type) => {
                const configuredCount = allFieldConfigs[type.value]?.filter(f => f.isActive !== false).length || 0;
                const totalFields = SYSTEM_FIELDS[type.value]?.reduce((acc, section) => acc + section.fields.length, 0) || 0;
                const colorClasses = {
                  emerald: activeIncidentType === type.value 
                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300'
                    : 'border-gray-200 dark:border-slate-600 hover:border-emerald-300',
                  blue: activeIncidentType === type.value 
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                    : 'border-gray-200 dark:border-slate-600 hover:border-blue-300',
                  amber: activeIncidentType === type.value 
                    ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300'
                    : 'border-gray-200 dark:border-slate-600 hover:border-amber-300',
                };
                return (
                  <button
                    key={type.value}
                    onClick={() => setActiveIncidentType(type.value)}
                    className={`px-3 py-2 rounded-lg border text-xs sm:text-sm font-medium transition-all flex-1 sm:flex-none min-w-[100px] ${
                      colorClasses[type.color as keyof typeof colorClasses]
                    }`}
                  >
                    <span className="hidden xs:inline">{type.label}</span>
                    <span className="xs:hidden">{type.label.split(' ')[0]}</span>
                    <span className="ml-1 sm:ml-2 text-xs bg-gray-200 dark:bg-slate-600 px-1.5 sm:px-2 py-0.5 rounded-full">
                      {totalFields}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Field Edit Modal */}
            {showFieldForm && editingField && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Edit Field: {editingField.fieldLabel}
                  </h4>
                  <form onSubmit={handleFieldSubmit} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Display Label
                      </label>
                      <input
                        type="text"
                        value={fieldFormData.fieldLabel}
                        onChange={(e) => setFieldFormData({ ...fieldFormData, fieldLabel: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Placeholder Text
                      </label>
                      <input
                        type="text"
                        value={fieldFormData.placeholder}
                        onChange={(e) => setFieldFormData({ ...fieldFormData, placeholder: e.target.value })}
                        placeholder="e.g., Enter description..."
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Help Text
                      </label>
                      <input
                        type="text"
                        value={fieldFormData.helpText}
                        onChange={(e) => setFieldFormData({ ...fieldFormData, helpText: e.target.value })}
                        placeholder="e.g., Brief help message shown below the field"
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                      />
                    </div>

                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                        <input
                          type="checkbox"
                          checked={fieldFormData.isRequired}
                          onChange={(e) => setFieldFormData({ ...fieldFormData, isRequired: e.target.checked })}
                          className="w-4 h-4 rounded border-gray-300 dark:border-slate-600 text-amber-600 focus:ring-amber-500"
                        />
                        Required Field
                      </label>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-slate-700">
                      <button
                        type="button"
                        onClick={resetFieldForm}
                        className="px-4 py-2 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700"
                      >
                        Save Changes
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Field Configuration List - Grouped by Section */}
            <div className="space-y-6">
              {SYSTEM_FIELDS[activeIncidentType]?.map((section, sectionIndex) => {
                return (
                  <div key={sectionIndex} className="border border-gray-200 dark:border-slate-700 rounded-lg overflow-hidden">
                    {/* Section Header */}
                    <div className="bg-gray-100 dark:bg-slate-700 px-4 py-3 border-b border-gray-200 dark:border-slate-600">
                      <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                        {section.section}
                      </h4>
                    </div>
                    
                    {/* Fields in Section */}
                    <div className="divide-y divide-gray-100 dark:divide-slate-700">
                      {section.fields.map((systemField) => {
                        // Find saved config for this field
                        const savedConfig = fieldConfigs.find(f => f.fieldName === systemField.fieldName);
                        const isActive = savedConfig?.isActive !== false;
                        const isRequired = savedConfig?.isRequired ?? systemField.defaultRequired;
                        const label = savedConfig?.fieldLabel ?? systemField.fieldLabel;
                        const placeholder = savedConfig?.placeholder ?? '';
                        
                        return (
                          <div
                            key={systemField.fieldName}
                            className={`flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 sm:p-4 gap-3 ${
                              !isActive ? 'bg-gray-50 dark:bg-slate-800/50 opacity-60' : 'bg-white dark:bg-slate-800'
                            }`}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`text-sm font-medium ${!isActive ? 'text-gray-400 dark:text-gray-500 line-through' : 'text-gray-900 dark:text-white'}`}>
                                  {label}
                                </span>
                                {isRequired && isActive && (
                                  <span className="text-red-500 font-bold text-xs">*Required</span>
                                )}
                                <span className="text-xs bg-gray-200 dark:bg-slate-600 px-2 py-0.5 rounded text-gray-600 dark:text-gray-300">
                                  {systemField.fieldType}
                                </span>
                              </div>
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2 sm:truncate">
                                {systemField.description}
                                {placeholder && (
                                  <span className="ml-2 italic">• Placeholder: "{placeholder}"</span>
                                )}
                              </p>
                            </div>
                            
                            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0 flex-wrap sm:flex-nowrap justify-between sm:justify-end">
                              {/* Visible Toggle */}
                              <div className="flex items-center gap-1.5 sm:gap-2">
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                  {isActive ? 'Visible' : 'Hidden'}
                                </span>
                                <ToggleSwitch
                                  enabled={isActive}
                                  isLoading={loadingToggles[`visibility-${systemField.fieldName}`]}
                                  onClick={() => handleToggle(`visibility-${systemField.fieldName}`, async () => {
                                    if (savedConfig) {
                                      await api.patch(`/dropdown-options/field-config/${savedConfig.id}`, {
                                        isActive: !isActive,
                                      });
                                      await loadFieldConfigs();
                                    } else {
                                      // Create new config with toggled visibility
                                      await api.post('/dropdown-options/field-config', {
                                        incidentType: activeIncidentType,
                                        fieldName: systemField.fieldName,
                                        fieldLabel: systemField.fieldLabel,
                                        fieldType: systemField.fieldType,
                                        isRequired: systemField.defaultRequired,
                                        isActive: false,
                                        sortOrder: sectionIndex * 100 + section.fields.indexOf(systemField),
                                      });
                                      await loadFieldConfigs();
                                    }
                                  })}
                                  label="Toggle visibility"
                                />
                              </div>
                              
                              {/* Required Toggle (only when visible) */}
                              {isActive && (
                                <div className="flex items-center gap-1.5 sm:gap-2">
                                  <span className="text-xs text-gray-500 dark:text-gray-400">
                                    {isRequired ? 'Required' : 'Optional'}
                                  </span>
                                  <ToggleSwitch
                                    enabled={isRequired}
                                    isLoading={loadingToggles[`required-${systemField.fieldName}`]}
                                    onClick={() => handleToggle(`required-${systemField.fieldName}`, async () => {
                                      if (savedConfig) {
                                        await api.patch(`/dropdown-options/field-config/${savedConfig.id}`, {
                                          isRequired: !isRequired,
                                        });
                                        await loadFieldConfigs();
                                      } else {
                                        // Create new config
                                        await api.post('/dropdown-options/field-config', {
                                          incidentType: activeIncidentType,
                                          fieldName: systemField.fieldName,
                                          fieldLabel: systemField.fieldLabel,
                                          fieldType: systemField.fieldType,
                                          isRequired: !systemField.defaultRequired,
                                          isActive: true,
                                          sortOrder: sectionIndex * 100 + section.fields.indexOf(systemField),
                                        });
                                        await loadFieldConfigs();
                                      }
                                    })}
                                    label="Toggle required"
                                  />
                                </div>
                              )}
                              
                              {/* Edit Button */}
                              <button
                                onClick={() => {
                                  const config = savedConfig || {
                                    id: '',
                                    incidentType: activeIncidentType,
                                    fieldName: systemField.fieldName,
                                    fieldLabel: systemField.fieldLabel,
                                    fieldType: systemField.fieldType,
                                    isRequired: systemField.defaultRequired,
                                    placeholder: null,
                                    helpText: null,
                                    sortOrder: sectionIndex * 100 + section.fields.indexOf(systemField),
                                    isActive: true,
                                  };
                                  setEditingField(config);
                                  setFieldFormData({
                                    fieldName: config.fieldName,
                                    fieldLabel: config.fieldLabel,
                                    fieldType: config.fieldType,
                                    isRequired: config.isRequired,
                                    placeholder: config.placeholder || '',
                                    helpText: config.helpText || '',
                                    sortOrder: config.sortOrder,
                                  });
                                  setShowFieldForm(true);
                                }}
                                className="text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300 text-sm font-medium"
                              >
                                Edit
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
