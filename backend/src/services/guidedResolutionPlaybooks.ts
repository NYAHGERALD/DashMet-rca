export type GuidedResolutionAnswerType = 'text' | 'textarea' | 'select' | 'date' | 'person' | 'document' | 'yes_no';
export type GuidedResolutionStep = 'issue' | 'facts' | 'people' | 'documents' | 'risk' | 'guidance' | 'all';

export type GuidedResolutionRiskKey =
  | 'safety_complaint'
  | 'harassment_or_discrimination'
  | 'retaliation_concern'
  | 'medical_or_accommodation'
  | 'protected_concerted_activity'
  | 'wage_hour_or_leave'
  | 'none';

export type GuidedResolutionPlaybookKey =
  | 'general_intake'
  | 'conduct_professionalism'
  | 'workplace_conflict'
  | 'complaint_review'
  | 'harassment_discrimination'
  | 'retaliation'
  | 'safety_ppe_equipment'
  | 'food_safety_quality'
  | 'attendance_timekeeping'
  | 'performance_productivity_quality'
  | 'warehouse_equipment_property'
  | 'threats_violence_bullying'
  | 'substance_impairment'
  | 'theft_security_property'
  | 'wage_hour_leave'
  | 'medical_injury_accommodation'
  | 'protected_concerted_activity'
  | 'policy_training'
  | 'injury_incident_response';

export type GuidedResolutionSlotId =
  | 'initial_narrative'
  | 'date_time'
  | 'location_department_shift'
  | 'involved_people'
  | 'direct_observation_source'
  | 'timeline_sequence'
  | 'specific_behavior_or_event'
  | 'immediate_response'
  | 'policy_or_standard'
  | 'training_acknowledgment'
  | 'prior_history'
  | 'employee_response'
  | 'witness_identification'
  | 'witness_statement_need'
  | 'evidence_available'
  | 'safety_impact'
  | 'food_safety_quality_impact'
  | 'operational_impact'
  | 'consistency_comparator'
  | 'protected_risk_screen'
  | 'desired_resolution'
  | 'hr_escalation_decision'
  | 'documentation_package'
  | 'injury_medical_status'
  | 'accommodation_leave_signal'
  | 'wage_hour_details'
  | 'protected_activity_details'
  | 'food_hold_or_product_status'
  | 'allergen_foreign_material_response'
  | 'equipment_loto_status'
  | 'forklift_warehouse_safety'
  | 'substance_impairment_basis'
  | 'threat_immediate_safety'
  | 'theft_inventory_evidence'
  | 'attendance_pattern_details'
  | 'performance_expectation_gap'
  | 'quality_defect_impact'
  | 'warehouse_equipment_impact'
  | 'resolution_path';

export interface GuidedResolutionPerson {
  name?: string;
  role?: string;
  department?: string;
  employeeId?: string;
  involvement?: string;
}

export interface GuidedResolutionDocument {
  title?: string;
  type?: string;
  personName?: string;
  personInvolvement?: string;
  personRole?: string;
  personDepartment?: string;
  contentPreview?: string;
  content?: string;
  summary?: string;
  createdFrom?: string;
}

export interface GuidedResolutionReview {
  behaviorSummary?: string;
  desiredOutcome?: string;
  policyTrainingStatus?: 'yes' | 'no' | 'unknown';
  repeatedBehaviorStatus?: 'first_time' | 'repeated' | 'unknown';
  safetyImpactStatus?: 'yes' | 'no' | 'unknown';
  employeeResponseStatus?: 'received' | 'needed' | 'not_applicable';
  riskFlags?: GuidedResolutionRiskKey[] | string[];
  supervisorDecisionNotes?: string;
}

export interface GuidedResolutionInput {
  caseDetails: {
    caseNumber?: string;
    caseType?: string;
    incidentDate?: string;
    location?: string;
    department?: string;
    shift?: string;
  };
  issueType?: string;
  guidedReview: GuidedResolutionReview;
  people: GuidedResolutionPerson[];
  documents: GuidedResolutionDocument[];
  dynamicAnswers: Array<{ question: string; answer: string }>;
  policySections: Array<{ policyName?: string; sectionNumber?: string; title?: string; type?: string; content?: string }>;
}

export interface GuidedResolutionSlotDefinition {
  id: GuidedResolutionSlotId;
  label: string;
  step: GuidedResolutionStep;
  category: string;
  question: string;
  whyNeeded: string;
  answerType: GuidedResolutionAnswerType;
  required: boolean;
  options?: string[];
  documentType?: 'complaint' | 'witness_statement' | 'prior_record' | 'policy_note' | 'other';
}

export interface GuidedResolutionSlotStatus extends GuidedResolutionSlotDefinition {
  completed: boolean;
  completionEvidence: string[];
  priority: number;
}

export interface GuidedResolutionSourceBackedAnswer {
  slotId: GuidedResolutionSlotId;
  label: string;
  value: string;
  sourceTitle: string;
  sourceType: string;
  excerpt: string;
  confidence: number;
  needsReview: boolean;
}

export interface GuidedResolutionPlaybook {
  key: GuidedResolutionPlaybookKey;
  title: string;
  sectorAreas: string[];
  triggerKeywords: string[];
  issueTypes: string[];
  riskFlags: GuidedResolutionRiskKey[];
  requiredSlots: GuidedResolutionSlotId[];
  conditionalSlots: GuidedResolutionSlotId[];
  recommendedDocuments: Array<{
    title: string;
    documentType: 'complaint' | 'witness_statement' | 'prior_record' | 'policy_note' | 'other';
    whyNeeded: string;
    required: boolean;
  }>;
  resolutionPathways: string[];
  escalationSignals: string[];
}

export interface GuidedResolutionContext {
  caseClassification: {
    primaryPlaybook: GuidedResolutionPlaybookKey;
    issueType: string;
    confidence: number;
    matchedSignals: string[];
  };
  selectedPlaybooks: GuidedResolutionPlaybook[];
  resolutionPathways: string[];
  complianceRiskGates: Array<{
    key: string;
    label: string;
    triggered: boolean;
    whyItMatters: string;
    recommendedAction: string;
  }>;
  documentationPlan: Array<{
    title: string;
    documentType: string;
    whyNeeded: string;
    required: boolean;
  }>;
  sourceBackedAnswers: GuidedResolutionSourceBackedAnswer[];
  requiredInformationSlots: GuidedResolutionSlotStatus[];
  unresolvedRequiredSlots: GuidedResolutionSlotStatus[];
  completedSlotIds: GuidedResolutionSlotId[];
  nextQuestions: Array<{
    id: string;
    slotId: GuidedResolutionSlotId;
    playbookKey: GuidedResolutionPlaybookKey;
    step: GuidedResolutionStep;
    category: string;
    question: string;
    whyNeeded: string;
    answerType: GuidedResolutionAnswerType;
    options?: string[];
    required: boolean;
    policyReference?: string;
    riskArea?: string;
  }>;
}

export const GUIDED_RESOLUTION_OUTCOMES = [
  'No-action documented inquiry',
  'Coaching conversation',
  'Policy reminder',
  'Retraining',
  'Documented counseling',
  'Facilitated conversation or mediation',
  'Attendance improvement plan',
  'Performance improvement plan',
  'Safety corrective action',
  'Food-safety corrective action',
  'Quality hold or rework review',
  'Equipment, access, or task restriction pending review',
  'HR investigation',
  'HR review before action',
  'Suspension pending investigation',
  'Written warning',
  'Final warning',
  'Leave or accommodation referral',
  'Payroll or timekeeping review',
  'Security or loss-prevention review',
  'Employee support or EAP referral',
  'Termination review by HR only'
];

export const GUIDED_SLOT_LIBRARY: Record<GuidedResolutionSlotId, GuidedResolutionSlotDefinition> = {
  initial_narrative: {
    id: 'initial_narrative',
    label: 'Initial incident description',
    step: 'issue',
    category: 'Fact gap',
    question: 'Describe what happened in your own words, including the business context and why it needs review.',
    whyNeeded: 'A neutral narrative is the first record HR needs before classifying the issue or asking targeted follow-up questions.',
    answerType: 'textarea',
    required: true
  },
  date_time: {
    id: 'date_time',
    label: 'Date and time',
    step: 'facts',
    category: 'Fact gap',
    question: 'What date and approximate time did the incident or pattern occur?',
    whyNeeded: 'Date and time anchor the review, support camera or timekeeping checks, and help determine whether prompt reporting requirements apply.',
    answerType: 'date',
    required: true
  },
  location_department_shift: {
    id: 'location_department_shift',
    label: 'Location, department, and shift',
    step: 'facts',
    category: 'Fact gap',
    question: 'Confirm the location, department, production area, and shift connected to this issue.',
    whyNeeded: 'The same behavior can have different operational, safety, and witness implications by line, department, and shift.',
    answerType: 'select',
    required: true
  },
  involved_people: {
    id: 'involved_people',
    label: 'People involved',
    step: 'people',
    category: 'People',
    question: 'Identify each person involved, including the reporting party, subject of concern, affected employee, supervisor, HR partner, employee representative, and any known witnesses.',
    whyNeeded: 'A fair review needs clear roles so HR can separate the person reporting, the person being reviewed, the person affected, witnesses, support roles, and decision makers.',
    answerType: 'person',
    required: true
  },
  direct_observation_source: {
    id: 'direct_observation_source',
    label: 'Source of information',
    step: 'facts',
    category: 'Fact gap',
    question: 'Was this directly observed, reported by someone else, found in a record, or captured by camera or system data?',
    whyNeeded: 'HR weighs direct observation, hearsay, documents, and system records differently when assessing reliability.',
    answerType: 'select',
    options: ['Directly observed', 'Reported by employee', 'Reported by supervisor', 'Camera or system record', 'Document or written complaint', 'Unknown / needs review'],
    required: true
  },
  timeline_sequence: {
    id: 'timeline_sequence',
    label: 'Timeline sequence',
    step: 'facts',
    category: 'Fact gap',
    question: 'Walk through the sequence of events from the first relevant action through the supervisor response.',
    whyNeeded: 'A timeline helps identify missing witnesses, response delays, and whether the issue is a one-time event or a pattern.',
    answerType: 'textarea',
    required: true
  },
  specific_behavior_or_event: {
    id: 'specific_behavior_or_event',
    label: 'Specific behavior or event',
    step: 'facts',
    category: 'Fact gap',
    question: 'What specific behavior, words, work result, or safety condition is being reviewed?',
    whyNeeded: 'Specific, observable facts reduce bias and help align the review with the correct policy or operating standard.',
    answerType: 'textarea',
    required: true
  },
  immediate_response: {
    id: 'immediate_response',
    label: 'Immediate response',
    step: 'facts',
    category: 'Fact gap',
    question: 'What did the supervisor, lead, HR, safety, or quality team do immediately after learning about the issue?',
    whyNeeded: 'Immediate response matters for safety, product control, consistency, mitigation, and documentation quality.',
    answerType: 'textarea',
    required: false
  },
  policy_or_standard: {
    id: 'policy_or_standard',
    label: 'Policy or standard',
    step: 'guidance',
    category: 'Policy alignment',
    question: 'Which policy, SOP, GMP, quality standard, safety rule, attendance rule, or work expectation may apply?',
    whyNeeded: 'The wizard should align the next step with the organization standard rather than unsupported personal judgment.',
    answerType: 'textarea',
    required: true
  },
  training_acknowledgment: {
    id: 'training_acknowledgment',
    label: 'Training acknowledgment',
    step: 'documents',
    category: 'Documentation',
    question: 'Has the employee been trained or previously informed on the policy, SOP, safety rule, or work expectation?',
    whyNeeded: 'Training status affects fairness, coaching options, and whether retraining or corrective action is appropriate.',
    answerType: 'yes_no',
    required: true
  },
  prior_history: {
    id: 'prior_history',
    label: 'Prior history',
    step: 'documents',
    category: 'Consistency',
    question: 'Is this a first-time issue, a repeated issue, or part of a documented pattern?',
    whyNeeded: 'Prior history helps determine whether the right pathway is coaching, retraining, progressive discipline, or HR review.',
    answerType: 'select',
    options: ['First-time issue', 'Repeated issue', 'Pattern suspected', 'Unknown / needs review'],
    required: true
  },
  employee_response: {
    id: 'employee_response',
    label: 'Employee response',
    step: 'guidance',
    category: '1-on-1 preparation',
    question: 'Has the employee response or written statement been collected? Attach it, paste it, or document that it is not available yet.',
    whyNeeded: 'Employee response is a core fairness record. If it is available, the wizard should review that record before asking the supervisor to type the same facts again.',
    answerType: 'textarea',
    required: true
  },
  witness_identification: {
    id: 'witness_identification',
    label: 'Witness identification',
    step: 'people',
    category: 'People',
    question: 'Were there any witnesses, nearby employees, leads, or supervisors who may have relevant information?',
    whyNeeded: 'Witness availability determines whether HR needs statements, interviews, or can proceed based on existing records.',
    answerType: 'person',
    required: false
  },
  witness_statement_need: {
    id: 'witness_statement_need',
    label: 'Witness statement need',
    step: 'documents',
    category: 'Documentation',
    question: 'Are witness statements needed, already collected, not available, or unnecessary for this issue?',
    whyNeeded: 'The record should explain why witness statements are or are not part of the review.',
    answerType: 'select',
    options: ['Needed', 'Already collected', 'No witnesses available', 'Not necessary', 'Unknown / needs HR review'],
    required: false
  },
  evidence_available: {
    id: 'evidence_available',
    label: 'Available evidence',
    step: 'documents',
    category: 'Documentation',
    question: 'What supporting evidence exists, such as camera footage, time records, photos, production records, quality holds, messages, or training records?',
    whyNeeded: 'Evidence helps separate confirmed facts from assumptions and supports an audit-ready decision.',
    answerType: 'textarea',
    required: true
  },
  safety_impact: {
    id: 'safety_impact',
    label: 'Safety impact',
    step: 'risk',
    category: 'Risk',
    question: 'Did this create an injury, near miss, unsafe condition, equipment risk, or safety-rule concern?',
    whyNeeded: 'Safety issues may require immediate mitigation, safety-team review, OSHA-sensitive documentation, or different escalation.',
    answerType: 'yes_no',
    required: true
  },
  food_safety_quality_impact: {
    id: 'food_safety_quality_impact',
    label: 'Food safety or quality impact',
    step: 'risk',
    category: 'Risk',
    question: 'Could this affect food safety, product quality, allergen control, sanitation, foreign material control, hold status, or customer requirements?',
    whyNeeded: 'Food manufacturing issues can require product-control decisions separate from employee-relations decisions.',
    answerType: 'yes_no',
    required: true
  },
  operational_impact: {
    id: 'operational_impact',
    label: 'Operational impact',
    step: 'facts',
    category: 'Fact gap',
    question: 'What operational impact occurred, such as downtime, missed production, rework, waste, staffing impact, or customer impact?',
    whyNeeded: 'Operational impact helps scope urgency and supports consistent resolution decisions.',
    answerType: 'textarea',
    required: false
  },
  consistency_comparator: {
    id: 'consistency_comparator',
    label: 'Consistency review',
    step: 'guidance',
    category: 'Consistency',
    question: 'Have similar issues been handled before, and is the proposed response consistent with those prior outcomes?',
    whyNeeded: 'Consistency review reduces fairness, discrimination, retaliation, and employee-relations risk.',
    answerType: 'textarea',
    required: false
  },
  protected_risk_screen: {
    id: 'protected_risk_screen',
    label: 'Protected-risk screen',
    step: 'risk',
    category: 'Risk',
    question: 'Is there any indication of harassment, discrimination, retaliation, medical or leave issue, wage/hour concern, safety complaint, or protected concerted activity?',
    whyNeeded: 'Sensitive legal or compliance risk should be routed to HR before a supervisor decides the outcome.',
    answerType: 'select',
    options: ['No sensitive risk identified', 'Harassment/discrimination concern', 'Retaliation concern', 'Medical/leave/accommodation concern', 'Wage/hour concern', 'Safety complaint concern', 'Protected concerted activity concern', 'Unknown / needs HR review'],
    required: true
  },
  desired_resolution: {
    id: 'desired_resolution',
    label: 'Desired resolution',
    step: 'guidance',
    category: '1-on-1 preparation',
    question: 'What outcome is the supervisor trying to reach: coaching, retraining, mediation, documentation, safety correction, HR review, or another resolution?',
    whyNeeded: 'The wizard can only recommend a safe next step if the intended resolution is visible and aligned to the facts.',
    answerType: 'select',
    options: GUIDED_RESOLUTION_OUTCOMES,
    required: false
  },
  hr_escalation_decision: {
    id: 'hr_escalation_decision',
    label: 'HR escalation decision',
    step: 'risk',
    category: 'Risk',
    question: 'Should HR review this before any supervisor action, and what specific risk or uncertainty drives that decision?',
    whyNeeded: 'High-risk or unclear cases should not proceed through supervisor action without HR involvement.',
    answerType: 'textarea',
    required: false
  },
  documentation_package: {
    id: 'documentation_package',
    label: 'Documentation package',
    step: 'documents',
    category: 'Documentation',
    question: 'Attach or enter the available written records for this issue, such as the complaint, witness statements, employee response, photos, messages, or prior documentation.',
    whyNeeded: 'A complete documentation package lets the wizard review source records first and prevents repeated questions when the records already answer them.',
    answerType: 'document',
    documentType: 'other',
    required: false
  },
  injury_medical_status: {
    id: 'injury_medical_status',
    label: 'Injury or medical status',
    step: 'risk',
    category: 'Risk',
    question: 'Was there an injury, medical restriction, first aid, clinic visit, recordable concern, or return-to-work limitation?',
    whyNeeded: 'Medical and injury facts may require privacy, workers compensation, safety, or accommodation handling.',
    answerType: 'yes_no',
    required: true
  },
  accommodation_leave_signal: {
    id: 'accommodation_leave_signal',
    label: 'Accommodation or leave signal',
    step: 'risk',
    category: 'Risk',
    question: 'Did the employee mention a medical condition, disability, pregnancy, religious need, protected leave, or schedule limitation?',
    whyNeeded: 'Accommodation and leave signals require HR review before attendance, performance, or conduct action proceeds.',
    answerType: 'yes_no',
    required: true
  },
  wage_hour_details: {
    id: 'wage_hour_details',
    label: 'Wage, hour, or leave details',
    step: 'risk',
    category: 'Risk',
    question: 'Does this involve pay, timekeeping, missed meal/rest period, off-the-clock work, leave use, scheduling, or payroll correction?',
    whyNeeded: 'Wage, hour, leave, and payroll issues require different documentation and often HR/payroll review.',
    answerType: 'yes_no',
    required: true
  },
  protected_activity_details: {
    id: 'protected_activity_details',
    label: 'Protected activity details',
    step: 'risk',
    category: 'Risk',
    question: 'Did employees act together, raise shared workplace concerns, discuss terms or conditions of work, or participate in union-related activity?',
    whyNeeded: 'Protected concerted activity concerns should be identified before discipline or coaching is framed.',
    answerType: 'yes_no',
    required: true
  },
  food_hold_or_product_status: {
    id: 'food_hold_or_product_status',
    label: 'Product hold or disposition',
    step: 'documents',
    category: 'Documentation',
    question: 'Was affected product placed on hold, released, reworked, disposed, or escalated to QA or food safety?',
    whyNeeded: 'Product-control status separates employee review from food safety and customer-impact decisions.',
    answerType: 'select',
    options: ['No product affected', 'Product on hold', 'Released by QA', 'Reworked', 'Disposed', 'Pending QA review', 'Unknown / needs review'],
    required: true
  },
  allergen_foreign_material_response: {
    id: 'allergen_foreign_material_response',
    label: 'Allergen or foreign material response',
    step: 'risk',
    category: 'Risk',
    question: 'Did the issue involve allergen control, foreign material, sanitation break, GMP lapse, mislabeling, or traceability?',
    whyNeeded: 'These issues require product safety controls and may need QA-led documentation regardless of employee intent.',
    answerType: 'yes_no',
    required: true
  },
  equipment_loto_status: {
    id: 'equipment_loto_status',
    label: 'Equipment or LOTO status',
    step: 'risk',
    category: 'Risk',
    question: 'Did the issue involve machinery, guards, lockout/tagout, forklift, PIT, dock plate, rack, ladder, chemical, or maintenance control?',
    whyNeeded: 'Equipment-related issues may require immediate safety controls, restricted operation, and safety-team review.',
    answerType: 'yes_no',
    required: true
  },
  forklift_warehouse_safety: {
    id: 'forklift_warehouse_safety',
    label: 'Warehouse or PIT safety',
    step: 'risk',
    category: 'Risk',
    question: 'Did the issue involve forklift or PIT operation, pedestrian interaction, dock safety, rack damage, trailer movement, or load security?',
    whyNeeded: 'Warehouse events often need equipment inspection, operator status review, and witness or camera evidence.',
    answerType: 'yes_no',
    required: true
  },
  substance_impairment_basis: {
    id: 'substance_impairment_basis',
    label: 'Impairment basis',
    step: 'risk',
    category: 'Risk',
    question: 'What objective observations support concern about impairment, fatigue, or fitness for duty?',
    whyNeeded: 'Impairment reviews should rely on objective observations and HR/safety protocol rather than assumptions.',
    answerType: 'textarea',
    required: true
  },
  threat_immediate_safety: {
    id: 'threat_immediate_safety',
    label: 'Threat or immediate safety concern',
    step: 'risk',
    category: 'Risk',
    question: 'Is there an immediate threat, intimidation, violence, weapon concern, or need to separate employees or contact security?',
    whyNeeded: 'Threat-related issues require immediate protection planning before routine fact gathering.',
    answerType: 'yes_no',
    required: true
  },
  theft_inventory_evidence: {
    id: 'theft_inventory_evidence',
    label: 'Theft, security, or inventory evidence',
    step: 'documents',
    category: 'Documentation',
    question: 'What evidence supports the security, theft, inventory, property, badge, or access concern?',
    whyNeeded: 'Security allegations require careful evidence handling and HR or loss-prevention review before action.',
    answerType: 'textarea',
    required: true
  },
  attendance_pattern_details: {
    id: 'attendance_pattern_details',
    label: 'Attendance pattern',
    step: 'facts',
    category: 'Fact gap',
    question: 'List the attendance, tardy, early-out, call-off, no-call/no-show, or schedule events being reviewed.',
    whyNeeded: 'Attendance action should be tied to verified dates, rules, notifications, and protected leave review.',
    answerType: 'textarea',
    required: true
  },
  performance_expectation_gap: {
    id: 'performance_expectation_gap',
    label: 'Performance expectation gap',
    step: 'facts',
    category: 'Fact gap',
    question: 'What measurable expectation was missed, what was the actual result, and what support or coaching has already been provided?',
    whyNeeded: 'Performance concerns need objective expectations, measured results, and support history before corrective action.',
    answerType: 'textarea',
    required: true
  },
  quality_defect_impact: {
    id: 'quality_defect_impact',
    label: 'Quality defect impact',
    step: 'risk',
    category: 'Risk',
    question: 'What defect, hold, rework, customer complaint, or quality-system impact is connected to the concern?',
    whyNeeded: 'Quality impact helps determine whether QA documentation or process correction is required.',
    answerType: 'textarea',
    required: true
  },
  warehouse_equipment_impact: {
    id: 'warehouse_equipment_impact',
    label: 'Warehouse equipment or inventory impact',
    step: 'facts',
    category: 'Fact gap',
    question: 'What equipment, inventory, dock, trailer, rack, pallet, product, or property was affected?',
    whyNeeded: 'Warehouse incidents often need asset, inventory, camera, and safety review before employee action.',
    answerType: 'textarea',
    required: true
  },
  resolution_path: {
    id: 'resolution_path',
    label: 'Resolution pathway',
    step: 'guidance',
    category: '1-on-1 preparation',
    question: 'Which resolution path best fits the verified facts right now?',
    whyNeeded: 'The final pathway should match the facts, policy, risk level, and documentation readiness.',
    answerType: 'select',
    options: GUIDED_RESOLUTION_OUTCOMES,
    required: true
  }
};

export const GUIDED_RESOLUTION_PLAYBOOKS: GuidedResolutionPlaybook[] = [
  {
    key: 'general_intake',
    title: 'General workplace intake',
    sectorAreas: ['All departments', 'Food manufacturing', 'Warehouse', 'Office support'],
    triggerKeywords: ['unknown', 'unsure', 'issue', 'concern', 'incident', 'review'],
    issueTypes: ['unsure', 'other'],
    riskFlags: [],
    requiredSlots: ['initial_narrative', 'date_time', 'location_department_shift', 'involved_people', 'direct_observation_source', 'specific_behavior_or_event', 'protected_risk_screen'],
    conditionalSlots: ['timeline_sequence', 'employee_response', 'evidence_available', 'desired_resolution'],
    recommendedDocuments: [],
    resolutionPathways: GUIDED_RESOLUTION_OUTCOMES,
    escalationSignals: ['Facts are unclear after initial intake', 'Sensitive risk screen is unknown or positive']
  },
  {
    key: 'conduct_professionalism',
    title: 'Conduct and professionalism',
    sectorAreas: ['Production floor', 'Warehouse', 'Support departments'],
    triggerKeywords: ['conduct', 'behavior', 'disrespect', 'insubordination', 'argument', 'refused', 'language', 'professionalism', 'policy'],
    issueTypes: ['conduct', 'complaint'],
    riskFlags: [],
    requiredSlots: ['specific_behavior_or_event', 'timeline_sequence', 'involved_people', 'employee_response', 'policy_or_standard', 'training_acknowledgment', 'prior_history', 'consistency_comparator'],
    conditionalSlots: ['witness_identification', 'witness_statement_need', 'protected_risk_screen', 'desired_resolution'],
    recommendedDocuments: [
      { title: 'Supervisor incident note', documentType: 'other', whyNeeded: 'Documents the specific behavior, date, location, and supervisor response.', required: true },
      { title: 'Relevant policy or work-rule reference', documentType: 'policy_note', whyNeeded: 'Links the concern to the expected behavior standard.', required: true }
    ],
    resolutionPathways: ['Coaching conversation', 'Policy reminder', 'Documented counseling', 'Written warning', 'HR review before action'],
    escalationSignals: ['Protected-risk screen is positive', 'Employee denies key facts and no evidence is available', 'Termination or suspension is being considered']
  },
  {
    key: 'workplace_conflict',
    title: 'Workplace conflict and communication',
    sectorAreas: ['Production teams', 'Warehouse teams', 'Cross-functional teams'],
    triggerKeywords: ['conflict', 'disagreement', 'communication', 'tension', 'argument', 'not getting along', 'team issue', 'respect'],
    issueTypes: ['conflict'],
    riskFlags: [],
    requiredSlots: ['specific_behavior_or_event', 'involved_people', 'timeline_sequence', 'direct_observation_source', 'employee_response', 'desired_resolution'],
    conditionalSlots: ['witness_identification', 'protected_risk_screen', 'consistency_comparator'],
    recommendedDocuments: [
      { title: 'Neutral conflict summary', documentType: 'complaint', whyNeeded: 'Captures each party version and the desired working agreement.', required: true }
    ],
    resolutionPathways: ['Facilitated conversation or mediation', 'Coaching conversation', 'Policy reminder', 'HR review before action'],
    escalationSignals: ['Conflict includes threats, harassment, discrimination, retaliation, or bullying', 'Parties cannot safely work together pending review']
  },
  {
    key: 'complaint_review',
    title: 'Complaint intake and review',
    sectorAreas: ['All departments'],
    triggerKeywords: ['complaint', 'reported', 'concern', 'grievance', 'statement', 'reported by', 'anonymous'],
    issueTypes: ['complaint'],
    riskFlags: [],
    requiredSlots: ['initial_narrative', 'involved_people', 'direct_observation_source', 'evidence_available', 'witness_identification', 'protected_risk_screen', 'hr_escalation_decision'],
    conditionalSlots: ['witness_statement_need', 'employee_response', 'documentation_package'],
    recommendedDocuments: [
      { title: 'Original complaint or reporting statement', documentType: 'complaint', whyNeeded: 'Preserves the original allegation and avoids rewording it in the supervisor voice.', required: true }
    ],
    resolutionPathways: ['HR investigation', 'HR review before action', 'Coaching conversation', 'No-action documented inquiry'],
    escalationSignals: ['Anonymous complaint with serious allegation', 'Protected-risk screen positive', 'Conflicting participant accounts']
  },
  {
    key: 'harassment_discrimination',
    title: 'Harassment, discrimination, or protected-class concern',
    sectorAreas: ['All departments'],
    triggerKeywords: ['harassment', 'discrimination', 'bias', 'race', 'sex', 'gender', 'religion', 'national origin', 'age', 'disability', 'pregnancy', 'sexual', 'hostile'],
    issueTypes: ['complaint', 'conduct'],
    riskFlags: ['harassment_or_discrimination'],
    requiredSlots: ['initial_narrative', 'involved_people', 'timeline_sequence', 'witness_identification', 'evidence_available', 'protected_risk_screen', 'hr_escalation_decision'],
    conditionalSlots: ['employee_response', 'witness_statement_need', 'consistency_comparator', 'documentation_package'],
    recommendedDocuments: [
      { title: 'Complainant statement', documentType: 'complaint', whyNeeded: 'Captures allegation details in the reporting party voice.', required: true },
      { title: 'Witness statements or interview notes', documentType: 'witness_statement', whyNeeded: 'Supports a fair investigation where others may have observed relevant facts.', required: false }
    ],
    resolutionPathways: ['HR investigation', 'HR review before action', 'Suspension pending investigation', 'Employee support or EAP referral'],
    escalationSignals: ['Any protected-class harassment or discrimination allegation should be routed to HR before supervisor action']
  },
  {
    key: 'retaliation',
    title: 'Retaliation concern',
    sectorAreas: ['All departments'],
    triggerKeywords: ['retaliation', 'retaliated', 'because reported', 'after complaint', 'punished for reporting', 'safety complaint', 'complained'],
    issueTypes: ['complaint', 'conduct'],
    riskFlags: ['retaliation_concern'],
    requiredSlots: ['initial_narrative', 'timeline_sequence', 'protected_risk_screen', 'protected_activity_details', 'hr_escalation_decision', 'consistency_comparator'],
    conditionalSlots: ['involved_people', 'evidence_available', 'employee_response'],
    recommendedDocuments: [
      { title: 'Timeline of protected activity and later action', documentType: 'other', whyNeeded: 'Shows what was reported, when leadership learned of it, and what action followed.', required: true }
    ],
    resolutionPathways: ['HR investigation', 'HR review before action', 'No-action documented inquiry'],
    escalationSignals: ['Any possible retaliation timing or reporting connection requires HR review before action']
  },
  {
    key: 'safety_ppe_equipment',
    title: 'Safety, PPE, unsafe act, or equipment concern',
    sectorAreas: ['Production', 'Warehouse', 'Maintenance', 'Sanitation'],
    triggerKeywords: ['safety', 'ppe', 'hazard', 'unsafe', 'near miss', 'lockout', 'tagout', 'guard', 'forklift', 'injury', 'chemical', 'machine'],
    issueTypes: ['safety'],
    riskFlags: ['safety_complaint'],
    requiredSlots: ['safety_impact', 'equipment_loto_status', 'injury_medical_status', 'immediate_response', 'policy_or_standard', 'training_acknowledgment', 'evidence_available'],
    conditionalSlots: ['forklift_warehouse_safety', 'witness_identification', 'operational_impact', 'employee_response', 'hr_escalation_decision'],
    recommendedDocuments: [
      { title: 'Safety incident or near-miss note', documentType: 'other', whyNeeded: 'Documents the hazard, immediate control, and safety review path.', required: true },
      { title: 'Training or certification record', documentType: 'prior_record', whyNeeded: 'Confirms the employee was trained on the safety rule or equipment operation.', required: true }
    ],
    resolutionPathways: ['Safety corrective action', 'Retraining', 'Equipment, access, or task restriction pending review', 'HR review before action'],
    escalationSignals: ['Injury, near miss, unsafe equipment, LOTO issue, PIT issue, or safety complaint requires safety or HR review']
  },
  {
    key: 'food_safety_quality',
    title: 'Food safety, GMP, sanitation, allergen, or quality concern',
    sectorAreas: ['Food manufacturing', 'Quality assurance', 'Sanitation', 'Packaging'],
    triggerKeywords: ['food safety', 'gmp', 'sanitation', 'allergen', 'foreign material', 'quality', 'hold', 'rework', 'mislabel', 'traceability', 'contamination', 'qa'],
    issueTypes: ['safety', 'conduct', 'performance'],
    riskFlags: [],
    requiredSlots: ['food_safety_quality_impact', 'food_hold_or_product_status', 'allergen_foreign_material_response', 'quality_defect_impact', 'immediate_response', 'policy_or_standard', 'training_acknowledgment'],
    conditionalSlots: ['operational_impact', 'evidence_available', 'employee_response', 'hr_escalation_decision'],
    recommendedDocuments: [
      { title: 'QA or food-safety disposition record', documentType: 'other', whyNeeded: 'Shows whether product was held, released, reworked, disposed, or escalated.', required: true },
      { title: 'Relevant SOP, GMP, sanitation, allergen, or quality standard', documentType: 'policy_note', whyNeeded: 'Links the issue to the controlling food-safety or quality requirement.', required: true }
    ],
    resolutionPathways: ['Food-safety corrective action', 'Quality hold or rework review', 'Retraining', 'Documented counseling', 'HR review before action'],
    escalationSignals: ['Product safety, allergen, foreign material, contamination, or customer-risk concern needs QA/food safety review']
  },
  {
    key: 'attendance_timekeeping',
    title: 'Attendance, schedule, or timekeeping',
    sectorAreas: ['All departments'],
    triggerKeywords: ['attendance', 'tardy', 'late', 'absence', 'call off', 'no call', 'no show', 'schedule', 'timekeeping', 'clock', 'break', 'meal'],
    issueTypes: ['attendance'],
    riskFlags: ['wage_hour_or_leave'],
    requiredSlots: ['attendance_pattern_details', 'wage_hour_details', 'accommodation_leave_signal', 'policy_or_standard', 'prior_history', 'employee_response'],
    conditionalSlots: ['evidence_available', 'consistency_comparator', 'hr_escalation_decision'],
    recommendedDocuments: [
      { title: 'Attendance or timekeeping records', documentType: 'prior_record', whyNeeded: 'Verifies dates, punches, call-off notices, and schedule expectations.', required: true }
    ],
    resolutionPathways: ['Attendance improvement plan', 'Policy reminder', 'Documented counseling', 'Payroll or timekeeping review', 'Leave or accommodation referral'],
    escalationSignals: ['Protected leave, accommodation, wage/hour, or payroll concerns require HR or payroll review']
  },
  {
    key: 'performance_productivity_quality',
    title: 'Performance, productivity, or quality performance',
    sectorAreas: ['Production', 'Warehouse', 'Quality', 'Support departments'],
    triggerKeywords: ['performance', 'productivity', 'quality', 'standard', 'rate', 'mistake', 'defect', 'missed target', 'work completion', 'rework'],
    issueTypes: ['performance'],
    riskFlags: [],
    requiredSlots: ['performance_expectation_gap', 'quality_defect_impact', 'policy_or_standard', 'training_acknowledgment', 'prior_history', 'employee_response', 'operational_impact'],
    conditionalSlots: ['accommodation_leave_signal', 'evidence_available', 'consistency_comparator'],
    recommendedDocuments: [
      { title: 'Performance or production record', documentType: 'prior_record', whyNeeded: 'Supports the measured gap and separates coaching from discipline.', required: true }
    ],
    resolutionPathways: ['Performance improvement plan', 'Coaching conversation', 'Retraining', 'Documented counseling', 'Quality hold or rework review'],
    escalationSignals: ['Medical limitation, inconsistent expectations, or protected activity concerns require HR review']
  },
  {
    key: 'warehouse_equipment_property',
    title: 'Warehouse, equipment, inventory, dock, or property issue',
    sectorAreas: ['Warehouse', 'Shipping', 'Receiving', 'Maintenance'],
    triggerKeywords: ['warehouse', 'forklift', 'pit', 'dock', 'trailer', 'pallet', 'rack', 'inventory', 'property', 'equipment', 'damage', 'load'],
    issueTypes: ['safety', 'conduct', 'performance'],
    riskFlags: [],
    requiredSlots: ['warehouse_equipment_impact', 'forklift_warehouse_safety', 'safety_impact', 'evidence_available', 'policy_or_standard', 'training_acknowledgment'],
    conditionalSlots: ['theft_inventory_evidence', 'witness_identification', 'operational_impact', 'employee_response'],
    recommendedDocuments: [
      { title: 'Warehouse incident record or photos', documentType: 'other', whyNeeded: 'Documents the affected equipment, property, product, and immediate control.', required: true }
    ],
    resolutionPathways: ['Safety corrective action', 'Equipment, access, or task restriction pending review', 'Retraining', 'Security or loss-prevention review'],
    escalationSignals: ['PIT incident, rack damage, trailer movement, or inventory/security concern requires safety or operations review']
  },
  {
    key: 'threats_violence_bullying',
    title: 'Threats, violence, bullying, or intimidation',
    sectorAreas: ['All departments'],
    triggerKeywords: ['threat', 'violence', 'weapon', 'fight', 'assault', 'bully', 'intimidation', 'harass', 'fear', 'unsafe around'],
    issueTypes: ['conduct', 'complaint', 'safety'],
    riskFlags: ['safety_complaint', 'harassment_or_discrimination'],
    requiredSlots: ['threat_immediate_safety', 'initial_narrative', 'involved_people', 'witness_identification', 'evidence_available', 'hr_escalation_decision'],
    conditionalSlots: ['employee_response', 'protected_risk_screen', 'documentation_package'],
    recommendedDocuments: [
      { title: 'Security or threat assessment note', documentType: 'other', whyNeeded: 'Captures immediate risk controls and whether separation or security involvement is needed.', required: true }
    ],
    resolutionPathways: ['HR investigation', 'Suspension pending investigation', 'Security or loss-prevention review', 'Employee support or EAP referral'],
    escalationSignals: ['Any threat, violence, intimidation, weapon, or immediate safety risk requires HR and security/safety review']
  },
  {
    key: 'substance_impairment',
    title: 'Substance, impairment, or fitness-for-duty concern',
    sectorAreas: ['Production', 'Warehouse', 'Maintenance', 'Driving or PIT roles'],
    triggerKeywords: ['impaired', 'impairment', 'drug', 'alcohol', 'smell', 'slurred', 'dizzy', 'fitness for duty', 'fatigue'],
    issueTypes: ['safety', 'conduct'],
    riskFlags: ['safety_complaint', 'medical_or_accommodation'],
    requiredSlots: ['substance_impairment_basis', 'safety_impact', 'injury_medical_status', 'immediate_response', 'hr_escalation_decision'],
    conditionalSlots: ['witness_identification', 'evidence_available', 'policy_or_standard'],
    recommendedDocuments: [
      { title: 'Objective observation checklist or supervisor note', documentType: 'other', whyNeeded: 'Records objective facts without relying on assumptions or labels.', required: true }
    ],
    resolutionPathways: ['HR review before action', 'Equipment, access, or task restriction pending review', 'Employee support or EAP referral', 'Suspension pending investigation'],
    escalationSignals: ['Impairment or fitness-for-duty concerns should be escalated before testing, removal, or discipline decisions']
  },
  {
    key: 'theft_security_property',
    title: 'Theft, security, property, badge, or inventory concern',
    sectorAreas: ['Warehouse', 'Production', 'All departments'],
    triggerKeywords: ['theft', 'stolen', 'inventory', 'security', 'badge', 'property', 'camera', 'access', 'missing product', 'loss'],
    issueTypes: ['conduct', 'complaint'],
    riskFlags: [],
    requiredSlots: ['theft_inventory_evidence', 'involved_people', 'direct_observation_source', 'evidence_available', 'hr_escalation_decision', 'consistency_comparator'],
    conditionalSlots: ['witness_identification', 'employee_response', 'documentation_package'],
    recommendedDocuments: [
      { title: 'Security, inventory, or camera evidence summary', documentType: 'other', whyNeeded: 'Supports the allegation with verifiable evidence and chain of review.', required: true }
    ],
    resolutionPathways: ['Security or loss-prevention review', 'HR investigation', 'Suspension pending investigation', 'Termination review by HR only'],
    escalationSignals: ['Security or theft allegations should be reviewed by HR before accusations or discipline']
  },
  {
    key: 'wage_hour_leave',
    title: 'Wage, hour, schedule, break, or leave issue',
    sectorAreas: ['All departments'],
    triggerKeywords: ['pay', 'wage', 'hour', 'overtime', 'break', 'meal', 'off the clock', 'leave', 'pto', 'fmla', 'schedule', 'payroll'],
    issueTypes: ['attendance', 'complaint'],
    riskFlags: ['wage_hour_or_leave'],
    requiredSlots: ['wage_hour_details', 'attendance_pattern_details', 'direct_observation_source', 'evidence_available', 'hr_escalation_decision'],
    conditionalSlots: ['accommodation_leave_signal', 'employee_response', 'documentation_package'],
    recommendedDocuments: [
      { title: 'Timekeeping, schedule, payroll, or leave record', documentType: 'prior_record', whyNeeded: 'Verifies pay, punch, schedule, leave, and correction facts.', required: true }
    ],
    resolutionPathways: ['Payroll or timekeeping review', 'Leave or accommodation referral', 'HR review before action', 'No-action documented inquiry'],
    escalationSignals: ['Wage, hour, protected leave, or payroll corrections require HR/payroll review']
  },
  {
    key: 'medical_injury_accommodation',
    title: 'Medical, injury, disability, or accommodation signal',
    sectorAreas: ['All departments'],
    triggerKeywords: ['medical', 'doctor', 'restriction', 'injury', 'accommodation', 'disability', 'pregnant', 'leave', 'condition', 'workers comp'],
    issueTypes: ['safety', 'attendance', 'performance', 'conduct'],
    riskFlags: ['medical_or_accommodation'],
    requiredSlots: ['injury_medical_status', 'accommodation_leave_signal', 'protected_risk_screen', 'hr_escalation_decision'],
    conditionalSlots: ['attendance_pattern_details', 'performance_expectation_gap', 'employee_response'],
    recommendedDocuments: [
      { title: 'HR medical or accommodation referral note', documentType: 'other', whyNeeded: 'Keeps medical facts routed through HR while preserving operational facts.', required: true }
    ],
    resolutionPathways: ['Leave or accommodation referral', 'HR review before action', 'Safety corrective action', 'Employee support or EAP referral'],
    escalationSignals: ['Medical, disability, restriction, pregnancy, leave, or accommodation facts require HR review before action']
  },
  {
    key: 'protected_concerted_activity',
    title: 'Protected concerted activity or labor concern',
    sectorAreas: ['All departments'],
    triggerKeywords: ['union', 'group complaint', 'petition', 'working conditions', 'pay discussion', 'concerted', 'nlrb', 'collective', 'labor'],
    issueTypes: ['complaint', 'conduct'],
    riskFlags: ['protected_concerted_activity'],
    requiredSlots: ['protected_activity_details', 'timeline_sequence', 'protected_risk_screen', 'hr_escalation_decision', 'consistency_comparator'],
    conditionalSlots: ['involved_people', 'evidence_available', 'employee_response'],
    recommendedDocuments: [
      { title: 'Protected activity timeline and decision rationale', documentType: 'other', whyNeeded: 'Separates legitimate policy concerns from protected workplace activity.', required: true }
    ],
    resolutionPathways: ['HR review before action', 'HR investigation', 'No-action documented inquiry'],
    escalationSignals: ['Possible protected concerted activity must be reviewed before discipline or restriction']
  },
  {
    key: 'policy_training',
    title: 'Policy, SOP, or training alignment',
    sectorAreas: ['All departments'],
    triggerKeywords: ['policy', 'sop', 'training', 'acknowledgment', 'work instruction', 'standard', 'procedure'],
    issueTypes: ['conduct', 'performance', 'safety'],
    riskFlags: [],
    requiredSlots: ['policy_or_standard', 'training_acknowledgment', 'prior_history', 'employee_response', 'resolution_path'],
    conditionalSlots: ['evidence_available', 'consistency_comparator'],
    recommendedDocuments: [
      { title: 'Policy, SOP, or training record', documentType: 'policy_note', whyNeeded: 'Shows the applicable standard and confirms whether the employee knew it.', required: true }
    ],
    resolutionPathways: ['Policy reminder', 'Retraining', 'Coaching conversation', 'Documented counseling'],
    escalationSignals: ['Policy is unclear, not trained, inconsistently enforced, or conflicts with protected-risk facts']
  },
  {
    key: 'injury_incident_response',
    title: 'Injury or incident response',
    sectorAreas: ['Production', 'Warehouse', 'Maintenance', 'Sanitation'],
    triggerKeywords: ['injury', 'hurt', 'first aid', 'clinic', 'recordable', 'near miss', 'incident', 'blood', 'slip', 'fall'],
    issueTypes: ['safety'],
    riskFlags: ['safety_complaint', 'medical_or_accommodation'],
    requiredSlots: ['injury_medical_status', 'safety_impact', 'immediate_response', 'witness_identification', 'evidence_available', 'hr_escalation_decision'],
    conditionalSlots: ['equipment_loto_status', 'forklift_warehouse_safety', 'accommodation_leave_signal'],
    recommendedDocuments: [
      { title: 'Incident, first-aid, near-miss, or safety report', documentType: 'other', whyNeeded: 'Preserves injury and safety-response facts for HR and safety review.', required: true }
    ],
    resolutionPathways: ['Safety corrective action', 'Leave or accommodation referral', 'HR review before action', 'Employee support or EAP referral'],
    escalationSignals: ['Injury, medical restriction, or recordability concern requires HR/safety review']
  }
];

function normalizeText(value: unknown): string {
  return String(value || '').toLowerCase();
}

function hasMeaningfulText(value: unknown, minimum = 12): boolean {
  const text = String(value || '').trim();
  if (!text) return false;
  if (/^(n\/a|na|none|unknown|not sure|no|yes)$/i.test(text)) return true;
  return text.length >= minimum;
}

function textContainsAny(text: string, terms: string[]): boolean {
  return terms.some(term => text.includes(term.toLowerCase()));
}

function answeredQuestionIncludes(input: GuidedResolutionInput, terms: string[]): boolean {
  return input.dynamicAnswers.some(item => {
    const combined = `${item.question} ${item.answer}`.toLowerCase();
    return item.answer.trim() && textContainsAny(combined, terms);
  });
}

function documentText(doc: GuidedResolutionDocument): string {
  return `${doc.title || ''} ${doc.type || ''} ${doc.personName || ''} ${doc.personInvolvement || ''} ${doc.personRole || ''} ${doc.personDepartment || ''} ${doc.summary || ''} ${doc.contentPreview || doc.content || ''}`.trim();
}

function documentIncludesAny(doc: GuidedResolutionDocument, terms: string[]): boolean {
  return textContainsAny(documentText(doc).toLowerCase(), terms);
}

function documentTitleOrTypeIncludesAny(doc: GuidedResolutionDocument, terms: string[]): boolean {
  return textContainsAny(`${doc.title || ''} ${doc.type || ''}`.toLowerCase(), terms);
}

function answerDocumentsTopic(input: GuidedResolutionInput, terms: string[]): boolean {
  return input.documents.some(doc => {
    const combined = documentText(doc).toLowerCase();
    return textContainsAny(combined, terms);
  });
}

function hasRiskFlag(input: GuidedResolutionInput, risk: GuidedResolutionRiskKey): boolean {
  return (input.guidedReview.riskFlags || []).includes(risk);
}

function sourceExcerpt(value: string): string {
  const cleaned = String(value || '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return '';
  return cleaned.length > 240 ? `${cleaned.slice(0, 237)}...` : cleaned;
}

function addSourceBackedAnswer(
  answers: GuidedResolutionSourceBackedAnswer[],
  slotId: GuidedResolutionSlotId,
  value: string,
  doc: GuidedResolutionDocument,
  confidence = 0.72
) {
  const key = `${slotId}|${doc.title || ''}|${doc.type || ''}`;
  if (answers.some(item => `${item.slotId}|${item.sourceTitle}|${item.sourceType}` === key)) return;
  const definition = GUIDED_SLOT_LIBRARY[slotId];
  answers.push({
    slotId,
    label: definition?.label || slotId,
    value,
    sourceTitle: doc.title || 'Uploaded record',
    sourceType: doc.type || 'other',
    excerpt: sourceExcerpt(doc.summary || doc.contentPreview || doc.content || doc.title || ''),
    confidence,
    needsReview: true
  });
}

function extractSourceBackedAnswers(input: GuidedResolutionInput): GuidedResolutionSourceBackedAnswer[] {
  const answers: GuidedResolutionSourceBackedAnswer[] = [];

  input.documents.forEach(doc => {
    const hasContent = hasMeaningfulText(doc.contentPreview || doc.content || doc.summary || doc.title, 8);
    if (!hasContent) return;

    addSourceBackedAnswer(answers, 'evidence_available', 'A supporting record has been provided for review.', doc, 0.68);
    addSourceBackedAnswer(answers, 'documentation_package', 'A document was added to the case file and should be reviewed before relying on it.', doc, 0.66);

    if (documentTitleOrTypeIncludesAny(doc, ['complaint', 'grievance', 'reporting statement', 'reported concern'])) {
      addSourceBackedAnswer(answers, 'direct_observation_source', 'A complaint or reporting statement was provided as a source record.', doc, 0.76);
      addSourceBackedAnswer(answers, 'specific_behavior_or_event', 'The uploaded complaint may describe the behavior or event being reviewed.', doc, 0.58);
    }

    if (documentTitleOrTypeIncludesAny(doc, ['witness', 'statement']) || documentIncludesAny(doc, ['witness statement', 'i witnessed', 'i saw', 'i heard'])) {
      addSourceBackedAnswer(answers, 'witness_statement_need', 'A witness statement appears to have been provided.', doc, 0.78);
    }

    if (documentTitleOrTypeIncludesAny(doc, ['response', 'reply', 'rebuttal', 'subject statement']) || documentIncludesAny(doc, ['employee response', 'response to allegation', 'my response', 'i respond', 'i replied'])) {
      addSourceBackedAnswer(answers, 'employee_response', 'An employee response or statement appears to have been provided.', doc, 0.78);
    }

    if (documentTitleOrTypeIncludesAny(doc, ['prior', 'history', 'warning', 'counseling', 'corrective', 'previous']) || documentIncludesAny(doc, ['previous incident', 'prior incident', 'prior complaint', 'documented pattern', 'written warning', 'counseling'])) {
      addSourceBackedAnswer(answers, 'prior_history', 'The record may contain prior history or prior documentation.', doc, 0.72);
    }

    if (documentIncludesAny(doc, ['first', 'then', 'after', 'before', 'later', 'timeline', 'sequence', 'around', 'approximately'])) {
      addSourceBackedAnswer(answers, 'timeline_sequence', 'The record may contain timeline or sequence details.', doc, 0.6);
    }

    if (documentIncludesAny(doc, ['trained', 'training', 'acknowledged', 'policy', 'sop', 'procedure', 'work rule'])) {
      addSourceBackedAnswer(answers, 'training_acknowledgment', 'The record may contain policy, SOP, or training information.', doc, 0.62);
    }
  });

  return answers.slice(0, 14);
}

function collectEvidence(input: GuidedResolutionInput, slotId: GuidedResolutionSlotId): string[] {
  const evidence: string[] = [];
  const details = input.caseDetails || {};
  const review = input.guidedReview || {};
  const narrative = review.behaviorSummary || '';
  const supervisorNotes = review.supervisorDecisionNotes || '';
  const combined = [
    narrative,
    review.desiredOutcome || '',
    supervisorNotes,
    ...input.dynamicAnswers.map(item => `${item.question} ${item.answer}`),
    ...input.documents.map(documentText)
  ].join('\n').toLowerCase();

  const hasPeople = input.people.some(person => hasMeaningfulText(person.name, 2));
  const hasWitness = input.people.some(person => normalizeText(person.involvement).includes('witness'));
  const hasDocument = input.documents.some(doc => hasMeaningfulText(doc.title || doc.contentPreview || doc.content || doc.summary, 4));
  const hasPolicy = input.policySections.length > 0 || answerDocumentsTopic(input, ['policy', 'sop', 'procedure', 'work rule', 'training']);

  switch (slotId) {
    case 'initial_narrative':
    case 'specific_behavior_or_event':
      if (hasMeaningfulText(narrative, 30)) evidence.push('Narrative provided');
      if (slotId === 'specific_behavior_or_event' && input.documents.some(doc => hasMeaningfulText(doc.contentPreview || doc.content || doc.summary, 80) && documentTitleOrTypeIncludesAny(doc, ['complaint', 'statement', 'report']))) evidence.push('Specific behavior may be described in uploaded record');
      break;
    case 'date_time':
      if (hasMeaningfulText(details.incidentDate, 4)) evidence.push('Incident date provided');
      if (answeredQuestionIncludes(input, ['date', 'time', 'when'])) evidence.push('Date/time answered in follow-up');
      break;
    case 'location_department_shift':
      if (hasMeaningfulText(details.location, 3)) evidence.push('Location provided');
      if (hasMeaningfulText(details.department, 3)) evidence.push('Department provided');
      if (hasMeaningfulText(details.shift, 3)) evidence.push('Shift provided');
      if (answeredQuestionIncludes(input, ['location', 'department', 'shift', 'where'])) evidence.push('Location context answered');
      break;
    case 'involved_people':
      if (hasPeople) evidence.push('People added');
      if (answeredQuestionIncludes(input, ['person', 'people', 'employee involved', 'complainant', 'supervisor'])) evidence.push('People question answered');
      break;
    case 'direct_observation_source':
      if (textContainsAny(combined, ['observed', 'saw', 'witnessed', 'reported by', 'camera', 'video', 'system record', 'complaint', 'statement'])) evidence.push('Source described');
      if (answeredQuestionIncludes(input, ['source', 'observed', 'reported', 'camera', 'record'])) evidence.push('Source question answered');
      if (input.documents.some(doc => documentTitleOrTypeIncludesAny(doc, ['complaint', 'witness', 'statement', 'report']))) evidence.push('Source document attached');
      break;
    case 'timeline_sequence':
      if (textContainsAny(combined, ['then', 'after', 'before', 'next', 'first', 'later', 'timeline', 'sequence'])) evidence.push('Sequence described');
      if (hasMeaningfulText(narrative, 140)) evidence.push('Detailed narrative can support timeline review');
      break;
    case 'immediate_response':
      if (textContainsAny(combined, ['immediate', 'right away', 'removed', 'separated', 'reported to', 'notified', 'stopped', 'placed on hold', 'called hr', 'called safety'])) evidence.push('Immediate response described');
      break;
    case 'policy_or_standard':
      if (hasPolicy) evidence.push('Policy or SOP available');
      if (answeredQuestionIncludes(input, ['policy', 'sop', 'standard', 'procedure', 'rule'])) evidence.push('Policy question answered');
      break;
    case 'training_acknowledgment':
      if (review.policyTrainingStatus && review.policyTrainingStatus !== 'unknown') evidence.push('Training status selected');
      if (answeredQuestionIncludes(input, ['training', 'trained', 'acknowledged'])) evidence.push('Training question answered');
      break;
    case 'prior_history':
      if (review.repeatedBehaviorStatus && review.repeatedBehaviorStatus !== 'unknown') evidence.push('Repeat status selected');
      if (input.documents.some(doc => documentTitleOrTypeIncludesAny(doc, ['prior', 'history', 'warning', 'counseling', 'corrective', 'previous']))) evidence.push('Prior record attached');
      if (answerDocumentsTopic(input, ['previous incident', 'prior incident', 'prior complaint', 'documented pattern', 'written warning', 'counseling'])) evidence.push('Prior history found in document');
      if (answeredQuestionIncludes(input, ['prior', 'previous', 'history', 'repeated', 'first time', 'pattern'])) evidence.push('Prior history answered');
      break;
    case 'employee_response':
      if (review.employeeResponseStatus && review.employeeResponseStatus !== 'needed') evidence.push('Employee response status selected');
      if (input.documents.some(doc => documentTitleOrTypeIncludesAny(doc, ['response', 'reply', 'rebuttal', 'subject statement']))) evidence.push('Employee response document attached');
      if (answerDocumentsTopic(input, ['employee response', 'response to allegation', 'my response', 'i respond', 'i replied'])) evidence.push('Employee response found in document');
      if (answeredQuestionIncludes(input, ['employee response', 'explain', 'employee said', 'opportunity to respond'])) evidence.push('Employee response answered');
      break;
    case 'witness_identification':
      if (hasWitness) evidence.push('Witness added');
      if (answeredQuestionIncludes(input, ['witness', 'nearby employee', 'saw it', 'no witnesses'])) evidence.push('Witness question answered');
      break;
    case 'witness_statement_need':
      if (input.documents.some(doc => documentTitleOrTypeIncludesAny(doc, ['witness', 'statement']))) evidence.push('Witness statement attached');
      if (answerDocumentsTopic(input, ['witness statement', 'i witnessed', 'i saw', 'i heard'])) evidence.push('Witness statement found in document');
      if (answeredQuestionIncludes(input, ['witness statement', 'statement collected', 'no statement', 'statements needed'])) evidence.push('Witness statement need answered');
      break;
    case 'evidence_available':
    case 'documentation_package':
      if (hasDocument) evidence.push('Document or note added');
      if (answeredQuestionIncludes(input, ['evidence', 'document', 'record', 'photo', 'camera', 'time record', 'production record'])) evidence.push('Evidence question answered');
      break;
    case 'safety_impact':
      if (review.safetyImpactStatus && review.safetyImpactStatus !== 'unknown') evidence.push('Safety impact status selected');
      if (hasRiskFlag(input, 'safety_complaint')) evidence.push('Safety risk flag selected');
      if (answeredQuestionIncludes(input, ['safety', 'injury', 'near miss', 'unsafe', 'hazard'])) evidence.push('Safety impact answered');
      break;
    case 'food_safety_quality_impact':
      if (textContainsAny(combined, ['food safety', 'quality', 'gmp', 'sanitation', 'allergen', 'foreign material', 'hold', 'rework', 'qa', 'contamination'])) evidence.push('Food safety or quality issue identified');
      break;
    case 'operational_impact':
      if (textContainsAny(combined, ['downtime', 'production', 'line stopped', 'missed target', 'waste', 'rework', 'labor', 'customer', 'shipping delay', 'inventory'])) evidence.push('Operational impact described');
      break;
    case 'consistency_comparator':
      if (answeredQuestionIncludes(input, ['consistent', 'similar', 'comparator', 'same issue', 'prior outcome'])) evidence.push('Consistency question answered');
      break;
    case 'protected_risk_screen':
      if ((review.riskFlags || []).length > 0) evidence.push('Risk flags selected');
      if (answeredQuestionIncludes(input, ['protected', 'harassment', 'discrimination', 'retaliation', 'medical', 'leave', 'wage', 'safety complaint', 'concerted'])) evidence.push('Protected-risk question answered');
      break;
    case 'desired_resolution':
    case 'resolution_path':
      if (hasMeaningfulText(review.desiredOutcome, 3)) evidence.push('Desired resolution provided');
      if (answeredQuestionIncludes(input, ['resolution', 'outcome', 'coaching', 'warning', 'retraining', 'hr review'])) evidence.push('Resolution path answered');
      break;
    case 'hr_escalation_decision':
      if (hasRiskFlag(input, 'harassment_or_discrimination') || hasRiskFlag(input, 'retaliation_concern') || hasRiskFlag(input, 'medical_or_accommodation') || hasRiskFlag(input, 'protected_concerted_activity') || hasRiskFlag(input, 'wage_hour_or_leave')) evidence.push('Sensitive HR risk flag selected');
      if (answeredQuestionIncludes(input, ['hr review', 'escalate', 'human resources', 'hr partner'])) evidence.push('HR escalation answered');
      break;
    case 'injury_medical_status':
      if (textContainsAny(combined, ['injury', 'hurt', 'medical', 'clinic', 'first aid', 'restriction', 'recordable'])) evidence.push('Injury or medical facts described');
      if (answeredQuestionIncludes(input, ['injury', 'medical', 'clinic', 'first aid', 'restriction'])) evidence.push('Injury/medical question answered');
      break;
    case 'accommodation_leave_signal':
      if (hasRiskFlag(input, 'medical_or_accommodation')) evidence.push('Medical/accommodation risk flag selected');
      if (answeredQuestionIncludes(input, ['accommodation', 'leave', 'medical condition', 'disability', 'pregnancy', 'restriction'])) evidence.push('Accommodation/leave question answered');
      break;
    case 'wage_hour_details':
      if (hasRiskFlag(input, 'wage_hour_or_leave')) evidence.push('Wage/hour/leave risk flag selected');
      if (answeredQuestionIncludes(input, ['pay', 'wage', 'hour', 'overtime', 'break', 'meal', 'off the clock', 'payroll', 'timekeeping'])) evidence.push('Wage/hour question answered');
      break;
    case 'protected_activity_details':
      if (hasRiskFlag(input, 'protected_concerted_activity')) evidence.push('Protected concerted activity risk flag selected');
      if (answeredQuestionIncludes(input, ['union', 'group complaint', 'working conditions', 'protected concerted', 'terms and conditions'])) evidence.push('Protected activity question answered');
      break;
    case 'food_hold_or_product_status':
      if (textContainsAny(combined, ['hold', 'released', 'reworked', 'disposed', 'qa review', 'product affected', 'disposition'])) evidence.push('Product disposition described');
      break;
    case 'allergen_foreign_material_response':
      if (textContainsAny(combined, ['allergen', 'foreign material', 'mislabel', 'contamination', 'sanitation', 'traceability', 'gmp'])) evidence.push('Allergen/foreign material response described');
      break;
    case 'equipment_loto_status':
      if (textContainsAny(combined, ['machine', 'equipment', 'guard', 'lockout', 'tagout', 'loto', 'chemical', 'maintenance'])) evidence.push('Equipment or LOTO facts described');
      break;
    case 'forklift_warehouse_safety':
      if (textContainsAny(combined, ['forklift', 'pit', 'dock', 'trailer', 'rack', 'pallet jack', 'load', 'pedestrian'])) evidence.push('Warehouse/PIT safety facts described');
      break;
    case 'substance_impairment_basis':
      if (textContainsAny(combined, ['impaired', 'alcohol', 'drug', 'slurred', 'odor', 'unstable', 'fitness for duty', 'fatigue'])) evidence.push('Objective impairment observations described');
      break;
    case 'threat_immediate_safety':
      if (textContainsAny(combined, ['threat', 'weapon', 'violence', 'fight', 'assault', 'intimidation', 'fear', 'security'])) evidence.push('Threat or immediate safety concern described');
      break;
    case 'theft_inventory_evidence':
      if (textContainsAny(combined, ['theft', 'stolen', 'inventory', 'missing', 'camera', 'badge', 'security', 'property', 'loss'])) evidence.push('Security/inventory evidence described');
      break;
    case 'attendance_pattern_details':
      if (textContainsAny(combined, ['attendance', 'tardy', 'late', 'absence', 'call off', 'no call', 'no show', 'schedule', 'clock'])) evidence.push('Attendance pattern described');
      break;
    case 'performance_expectation_gap':
      if (textContainsAny(combined, ['performance', 'expectation', 'standard', 'productivity', 'target', 'rate', 'work completion', 'missed'])) evidence.push('Performance expectation gap described');
      break;
    case 'quality_defect_impact':
      if (textContainsAny(combined, ['quality', 'defect', 'hold', 'rework', 'customer complaint', 'scrap', 'nonconforming'])) evidence.push('Quality defect impact described');
      break;
    case 'warehouse_equipment_impact':
      if (textContainsAny(combined, ['warehouse', 'dock', 'trailer', 'rack', 'pallet', 'inventory', 'equipment', 'property', 'damage'])) evidence.push('Warehouse equipment or inventory impact described');
      break;
    default:
      break;
  }

  return evidence;
}

function scorePlaybook(input: GuidedResolutionInput, playbook: GuidedResolutionPlaybook): { score: number; signals: string[] } {
  const issueType = normalizeText(input.issueType || input.caseDetails.caseType);
  const combined = [
    input.issueType,
    input.caseDetails.caseType,
    input.guidedReview.behaviorSummary,
    input.guidedReview.desiredOutcome,
    input.guidedReview.supervisorDecisionNotes,
    ...input.dynamicAnswers.map(item => `${item.question} ${item.answer}`),
    ...input.documents.map(documentText)
  ].join('\n').toLowerCase();

  let score = 0;
  const signals: string[] = [];

  playbook.issueTypes.forEach(type => {
    if (issueType.includes(type)) {
      score += 4;
      signals.push(`issue:${type}`);
    }
  });

  playbook.riskFlags.forEach(flag => {
    if (hasRiskFlag(input, flag)) {
      score += 8;
      signals.push(`risk:${flag}`);
    }
  });

  playbook.triggerKeywords.forEach(keyword => {
    if (combined.includes(keyword)) {
      score += 2;
      signals.push(keyword);
    }
  });

  return { score, signals: Array.from(new Set(signals)).slice(0, 10) };
}

function selectPlaybooks(input: GuidedResolutionInput): { playbooks: GuidedResolutionPlaybook[]; matchedSignals: string[]; confidence: number } {
  const scored = GUIDED_RESOLUTION_PLAYBOOKS.map(playbook => ({
    playbook,
    ...scorePlaybook(input, playbook)
  })).sort((a, b) => b.score - a.score);

  const selected = scored
    .filter(item => {
      if (item.score <= 0 || item.playbook.key === 'general_intake') return false;
      const hasSpecificSignal = item.signals.some(signal => !signal.startsWith('risk:safety_complaint'));
      return hasSpecificSignal || item.playbook.key === 'safety_ppe_equipment';
    })
    .slice(0, 4);

  const playbooks = selected.length
    ? [GUIDED_RESOLUTION_PLAYBOOKS[0], ...selected.map(item => item.playbook)]
    : [GUIDED_RESOLUTION_PLAYBOOKS[0]];

  const topScore = scored[0]?.score || 0;
  const confidence = Math.min(0.95, Math.max(0.35, (topScore * 8) / 100));
  const matchedSignals = selected.flatMap(item => item.signals).slice(0, 18);

  return { playbooks, matchedSignals, confidence };
}

function getComplianceRiskGates(input: GuidedResolutionInput) {
  const combined = [
    input.guidedReview.behaviorSummary,
    input.guidedReview.supervisorDecisionNotes,
    ...input.dynamicAnswers.map(item => `${item.question} ${item.answer}`)
  ].join('\n').toLowerCase();

  return [
    {
      key: 'harassment_discrimination',
      label: 'Harassment or discrimination',
      triggered: hasRiskFlag(input, 'harassment_or_discrimination') || textContainsAny(combined, ['harassment', 'discrimination', 'protected class', 'sexual', 'race', 'religion', 'gender', 'disability']),
      whyItMatters: 'These allegations require careful intake, prompt HR review, neutral fact gathering, and anti-retaliation protection.',
      recommendedAction: 'Escalate to HR before supervisor action and preserve complaint, witness, and evidence records.'
    },
    {
      key: 'retaliation',
      label: 'Retaliation',
      triggered: hasRiskFlag(input, 'retaliation_concern') || textContainsAny(combined, ['retaliation', 'reported', 'complained', 'after complaint', 'because they raised']),
      whyItMatters: 'Timing after a complaint, safety report, wage concern, or protected activity can create retaliation risk.',
      recommendedAction: 'Build a timeline and require HR review before any adverse action.'
    },
    {
      key: 'safety_osha_sensitive',
      label: 'Safety complaint or injury',
      triggered: hasRiskFlag(input, 'safety_complaint') || textContainsAny(combined, ['safety complaint', 'injury', 'near miss', 'unsafe', 'osha', 'hazard']),
      whyItMatters: 'Safety complaints and injuries may require safety-team response, reporting discipline caution, and immediate hazard control.',
      recommendedAction: 'Document immediate controls, notify safety/HR, and avoid action that could appear tied to reporting safety concerns.'
    },
    {
      key: 'medical_leave_accommodation',
      label: 'Medical, leave, or accommodation',
      triggered: hasRiskFlag(input, 'medical_or_accommodation') || textContainsAny(combined, ['medical', 'doctor', 'restriction', 'disability', 'pregnant', 'accommodation', 'leave', 'fmla']),
      whyItMatters: 'Medical or accommodation facts should be handled through HR with privacy and interactive-process controls.',
      recommendedAction: 'Route medical details to HR and pause attendance, performance, or conduct action until HR reviews.'
    },
    {
      key: 'wage_hour_leave',
      label: 'Wage, hour, payroll, or leave',
      triggered: hasRiskFlag(input, 'wage_hour_or_leave') || textContainsAny(combined, ['pay', 'overtime', 'break', 'meal', 'off the clock', 'payroll', 'timekeeping', 'leave']),
      whyItMatters: 'Pay, timekeeping, leave, and schedule concerns can require payroll correction or HR review.',
      recommendedAction: 'Preserve schedules, punches, payroll notes, and route disputed pay or leave facts to HR/payroll.'
    },
    {
      key: 'protected_concerted_activity',
      label: 'Protected concerted activity',
      triggered: hasRiskFlag(input, 'protected_concerted_activity') || textContainsAny(combined, ['union', 'group complaint', 'working conditions', 'pay discussion', 'concerted']),
      whyItMatters: 'Employee group activity about working conditions can be protected and needs review before discipline.',
      recommendedAction: 'Ask HR to review whether the conduct is protected before coaching, discipline, or restrictions.'
    }
  ];
}

function slotPriority(slotId: GuidedResolutionSlotId, index: number): number {
  const highPriority: GuidedResolutionSlotId[] = [
    'initial_narrative',
    'specific_behavior_or_event',
    'date_time',
    'location_department_shift',
    'involved_people',
    'protected_risk_screen',
    'safety_impact',
    'food_safety_quality_impact',
    'hr_escalation_decision'
  ];
  const position = highPriority.indexOf(slotId);
  return position >= 0 ? position : highPriority.length + index;
}

const BASELINE_REQUIRED_SLOTS: GuidedResolutionSlotId[] = ['initial_narrative', 'involved_people'];
const PEOPLE_STAGE: GuidedResolutionSlotId[] = ['involved_people'];
const PRIMARY_DOCUMENT_STAGE: GuidedResolutionSlotId[] = [
  'documentation_package',
  'evidence_available',
  'witness_statement_need',
  'employee_response'
];
const SECONDARY_FACT_REVIEW_STAGE: GuidedResolutionSlotId[] = [
  'direct_observation_source',
  'prior_history',
  'training_acknowledgment',
  'policy_or_standard'
];
const RISK_AND_REVIEW_STAGE: GuidedResolutionSlotId[] = [
  'protected_risk_screen',
  'safety_impact',
  'food_safety_quality_impact',
  'injury_medical_status',
  'accommodation_leave_signal',
  'wage_hour_details',
  'protected_activity_details',
  'hr_escalation_decision'
];

function slotStageRank(slotId: GuidedResolutionSlotId): number {
  if (PEOPLE_STAGE.includes(slotId)) return PEOPLE_STAGE.indexOf(slotId);
  if (PRIMARY_DOCUMENT_STAGE.includes(slotId)) return 20 + PRIMARY_DOCUMENT_STAGE.indexOf(slotId);
  if (SECONDARY_FACT_REVIEW_STAGE.includes(slotId)) return 35 + SECONDARY_FACT_REVIEW_STAGE.indexOf(slotId);
  if (RISK_AND_REVIEW_STAGE.includes(slotId)) return 40 + RISK_AND_REVIEW_STAGE.indexOf(slotId);
  return 60;
}

function pickNextQuestionSlots(
  slotStatuses: GuidedResolutionSlotStatus[],
  requiredSlotIds: Set<GuidedResolutionSlotId>,
  documentationPlan: GuidedResolutionContext['documentationPlan'],
  sourceBackedAnswers: GuidedResolutionSourceBackedAnswer[]
): GuidedResolutionSlotStatus[] {
  const unresolvedRequired = slotStatuses.filter(slot => requiredSlotIds.has(slot.id) && !slot.completed);
  const peopleStage = slotStatuses
    .filter(slot => PEOPLE_STAGE.includes(slot.id) && !slot.completed)
    .sort((a, b) => slotStageRank(a.id) - slotStageRank(b.id));
  if (peopleStage.length) return peopleStage.slice(0, 1);

  const hasAnyDocument = sourceBackedAnswers.length > 0;
  const hasRequiredDocuments = documentationPlan.some(doc => doc.required);
  const primaryDocumentStage = slotStatuses
    .filter(slot => PRIMARY_DOCUMENT_STAGE.includes(slot.id) && !slot.completed)
    .filter(slot => requiredSlotIds.has(slot.id) || hasRequiredDocuments || !hasAnyDocument)
    .sort((a, b) => {
      const stageDelta = slotStageRank(a.id) - slotStageRank(b.id);
      if (stageDelta) return stageDelta;
      const requiredDelta = Number(requiredSlotIds.has(b.id)) - Number(requiredSlotIds.has(a.id));
      return requiredDelta;
    });
  if (primaryDocumentStage.length) return primaryDocumentStage.slice(0, 4);

  const secondaryFactStage = unresolvedRequired
    .filter(slot => SECONDARY_FACT_REVIEW_STAGE.includes(slot.id))
    .sort((a, b) => slotStageRank(a.id) - slotStageRank(b.id));
  if (secondaryFactStage.length) return secondaryFactStage.slice(0, 4);

  return unresolvedRequired
    .sort((a, b) => {
      const stageDelta = slotStageRank(a.id) - slotStageRank(b.id);
      return stageDelta || a.priority - b.priority;
    })
    .slice(0, 8);
}

export function buildGuidedResolutionContext(input: GuidedResolutionInput): GuidedResolutionContext {
  const selection = selectPlaybooks(input);
  const selectedPlaybooks = selection.playbooks;
  const primaryPlaybook = selectedPlaybooks.find(item => item.key !== 'general_intake') || selectedPlaybooks[0];
  const allSlotIds = Array.from(new Set([
    ...BASELINE_REQUIRED_SLOTS,
    ...selectedPlaybooks.flatMap(playbook => [...playbook.requiredSlots, ...playbook.conditionalSlots])
  ]));
  const requiredSlotIds = new Set<GuidedResolutionSlotId>([
    ...BASELINE_REQUIRED_SLOTS,
    ...selectedPlaybooks.flatMap(playbook => playbook.requiredSlots)
  ]);
  const slotStatuses = allSlotIds.map((slotId, index) => {
    const definition = GUIDED_SLOT_LIBRARY[slotId];
    const completionEvidence = collectEvidence(input, slotId);
    return {
      ...definition,
      required: requiredSlotIds.has(slotId),
      completed: completionEvidence.length > 0,
      completionEvidence,
      priority: slotPriority(slotId, index)
    };
  }).sort((a, b) => a.priority - b.priority);

  const sourceBackedAnswers = extractSourceBackedAnswers(input);
  const unresolvedRequiredSlots = slotStatuses.filter(slot => requiredSlotIds.has(slot.id) && !slot.completed);
  const completedSlotIds = slotStatuses.filter(slot => slot.completed).map(slot => slot.id);
  const riskGates = getComplianceRiskGates(input);
  const triggeredRiskGates = riskGates.filter(gate => gate.triggered);
  const documentationPlan = selectedPlaybooks
    .flatMap(playbook => playbook.recommendedDocuments)
    .filter((doc, index, arr) => arr.findIndex(item => item.title === doc.title) === index);
  const resolutionPathways = Array.from(new Set(selectedPlaybooks.flatMap(playbook => playbook.resolutionPathways))).slice(0, 24);

  const nextQuestionSlots = pickNextQuestionSlots(slotStatuses, requiredSlotIds, documentationPlan, sourceBackedAnswers);
  const nextQuestions = nextQuestionSlots.map((slot, index) => ({
    id: `${slot.id}_${index + 1}`,
    slotId: slot.id,
    playbookKey: primaryPlaybook.key,
    step: slot.step,
    category: slot.category,
    question: slot.question,
    whyNeeded: slot.whyNeeded,
    answerType: slot.answerType,
    options: slot.options,
    required: slot.required,
    policyReference: slot.id === 'policy_or_standard' && input.policySections[0]
      ? `${input.policySections[0].policyName || 'Policy'}${input.policySections[0].sectionNumber ? ` ${input.policySections[0].sectionNumber}` : ''}`
      : '',
    riskArea: triggeredRiskGates.find(gate => slot.category === 'Risk')?.label || ''
  }));

  return {
    caseClassification: {
      primaryPlaybook: primaryPlaybook.key,
      issueType: input.issueType || 'unsure',
      confidence: selection.confidence,
      matchedSignals: selection.matchedSignals
    },
    selectedPlaybooks,
    resolutionPathways,
    complianceRiskGates: riskGates,
    documentationPlan,
    sourceBackedAnswers,
    requiredInformationSlots: slotStatuses,
    unresolvedRequiredSlots,
    completedSlotIds,
    nextQuestions
  };
}
