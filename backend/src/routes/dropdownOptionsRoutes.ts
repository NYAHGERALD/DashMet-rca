import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireMinimumRole } from '../middleware/rbac';
import { UserRole, DropdownType } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { ValidationError } from '../middleware/errorHandler';

const router = Router();

// All routes require authentication
router.use(authenticate);

// GET /api/dropdown-options - List dropdown options for an organization
// Query params: organizationId, optionType (optional)
router.get('/', async (req, res, next) => {
  try {
    const { organizationId, optionType } = req.query;
    const user = (req as any).user;

    // Use user's organizationId if not specified
    const orgId = organizationId ? String(organizationId) : user?.organizationId;

    if (!orgId) {
      return res.status(400).json({
        success: false,
        error: 'Organization ID is required',
      });
    }

    const options = await prisma.dropdownOption.findMany({
      where: {
        organizationId: orgId,
        ...(optionType && { optionType: optionType as DropdownType }),
        isActive: true,
      },
      orderBy: [{ optionType: 'asc' }, { sortOrder: 'asc' }],
    });

    // Group options by type for easier frontend consumption
    const groupedOptions: Record<string, typeof options> = {};
    for (const option of options) {
      if (!groupedOptions[option.optionType]) {
        groupedOptions[option.optionType] = [];
      }
      groupedOptions[option.optionType].push(option);
    }

    res.json({
      success: true,
      data: optionType ? options : groupedOptions,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/dropdown-options/types - List all available dropdown types
router.get('/types', async (req, res) => {
  const types = Object.values(DropdownType);
  res.json({
    success: true,
    data: types.map(type => ({
      value: type,
      label: type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    })),
  });
});

// ============================================
// TYPE-SETTINGS ROUTES (must be before /:id)
// ============================================

// GET /api/dropdown-options/type-settings - Get type settings (required/placeholder) for all types
router.get('/type-settings', async (req, res) => {
  const { organizationId } = req.query;
  const user = (req as any).user;

  const orgId = organizationId ? String(organizationId) : user.organizationId;

  if (!orgId) {
    throw new ValidationError('Organization ID is required');
  }

  // Get first option of each type to determine settings
  const options = await prisma.dropdownOption.findMany({
    where: {
      organizationId: orgId,
      isActive: true,
    },
    distinct: ['optionType'],
    select: {
      optionType: true,
      isRequired: true,
      placeholder: true,
    },
  });

  const settings: Record<string, { isRequired: boolean; placeholder: string | null }> = {};
  for (const opt of options) {
    settings[opt.optionType] = {
      isRequired: opt.isRequired,
      placeholder: opt.placeholder,
    };
  }

  res.json({
    success: true,
    data: settings,
  });
});

// ============================================
// FIELD CONFIGURATION ROUTES (must be before /:id)
// ============================================

// GET /api/dropdown-options/field-config - Get field configurations for an organization
router.get('/field-config', async (req, res) => {
  const { organizationId, incidentType } = req.query;
  const user = (req as any).user;

  const orgId = organizationId ? String(organizationId) : user.organizationId;

  if (!orgId) {
    throw new ValidationError('Organization ID is required');
  }

  const configs = await prisma.fieldConfiguration.findMany({
    where: {
      organizationId: orgId,
      ...(incidentType && { incidentType: String(incidentType) }),
    },
    orderBy: [{ incidentType: 'asc' }, { sortOrder: 'asc' }],
  });

  // Group by incident type
  const groupedConfigs: Record<string, typeof configs> = {};
  for (const config of configs) {
    if (!groupedConfigs[config.incidentType]) {
      groupedConfigs[config.incidentType] = [];
    }
    groupedConfigs[config.incidentType].push(config);
  }

  res.json({
    success: true,
    data: incidentType ? configs : groupedConfigs,
  });
});

// GET /api/dropdown-options/:id - Get single dropdown option
// NOTE: This must come AFTER all named routes like /types, /type-settings, /field-config
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const option = await prisma.dropdownOption.findUnique({
      where: { id },
      include: {
        Organization: {
          select: { id: true, name: true },
        },
      },
    });

    if (!option) {
      return res.status(404).json({
        success: false,
        error: 'Dropdown option not found',
      });
    }

    res.json({
      success: true,
      data: option,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/dropdown-options - Create dropdown option (Admin only)
router.post('/', requireMinimumRole(UserRole.ADMIN), async (req, res) => {
  const { optionType, value, label, description, sortOrder, isActive } = req.body;
  const user = (req as any).user;

  if (!optionType || !value || !label) {
    throw new ValidationError('Option type, value, and label are required');
  }

  // Validate optionType
  if (!Object.values(DropdownType).includes(optionType)) {
    throw new ValidationError(`Invalid option type. Must be one of: ${Object.values(DropdownType).join(', ')}`);
  }

  // Check for duplicate value within same org and type
  const existing = await prisma.dropdownOption.findFirst({
    where: {
      organizationId: user.organizationId,
      optionType,
      value,
    },
  });

  if (existing) {
    throw new ValidationError('A dropdown option with this value already exists for this type');
  }

  const option = await prisma.dropdownOption.create({
    data: {
      optionType: optionType as DropdownType,
      value,
      label,
      description: description || null,
      sortOrder: sortOrder ?? 0,
      isActive: isActive ?? true,
      isDefault: false, // User-created options are not defaults
      organizationId: user.organizationId,
    },
  });

  res.status(201).json({
    success: true,
    data: option,
  });
});

// PATCH /api/dropdown-options/:id - Update dropdown option (Admin only)
router.patch('/:id', requireMinimumRole(UserRole.ADMIN), async (req, res) => {
  const { id } = req.params;
  const { value, label, description, sortOrder, isActive } = req.body;
  const user = (req as any).user;

  // Check if option exists and belongs to user's organization
  const existing = await prisma.dropdownOption.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new ValidationError('Dropdown option not found');
  }

  if (existing.organizationId !== user.organizationId && user.role !== UserRole.SYSTEM_ADMIN) {
    throw new ValidationError('You can only modify dropdown options for your organization');
  }

  // If updating value, check for duplicates
  if (value && value !== existing.value) {
    const duplicate = await prisma.dropdownOption.findFirst({
      where: {
        organizationId: existing.organizationId,
        optionType: existing.optionType,
        value,
        id: { not: id },
      },
    });

    if (duplicate) {
      throw new ValidationError('A dropdown option with this value already exists for this type');
    }
  }

  const option = await prisma.dropdownOption.update({
    where: { id },
    data: {
      ...(value !== undefined && { value }),
      ...(label !== undefined && { label }),
      ...(description !== undefined && { description }),
      ...(sortOrder !== undefined && { sortOrder }),
      ...(isActive !== undefined && { isActive }),
      ...(req.body.isRequired !== undefined && { isRequired: req.body.isRequired }),
      ...(req.body.placeholder !== undefined && { placeholder: req.body.placeholder }),
    },
  });

  res.json({
    success: true,
    data: option,
  });
});

// DELETE /api/dropdown-options/:id - Delete dropdown option (Admin only)
router.delete('/:id', requireMinimumRole(UserRole.ADMIN), async (req, res) => {
  const { id } = req.params;
  const user = (req as any).user;

  const existing = await prisma.dropdownOption.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new ValidationError('Dropdown option not found');
  }

  if (existing.organizationId !== user.organizationId && user.role !== UserRole.SYSTEM_ADMIN) {
    throw new ValidationError('You can only delete dropdown options for your organization');
  }

  // Don't actually delete, just deactivate
  const option = await prisma.dropdownOption.update({
    where: { id },
    data: { isActive: false },
  });

  res.json({
    success: true,
    data: option,
    message: 'Dropdown option deactivated',
  });
});

// POST /api/dropdown-options/bulk-update - Bulk update sort order (Admin only)
router.post('/bulk-update', requireMinimumRole(UserRole.ADMIN), async (req, res) => {
  const { updates } = req.body; // Array of { id, sortOrder }
  const user = (req as any).user;

  if (!Array.isArray(updates)) {
    throw new ValidationError('Updates must be an array');
  }

  // Update all in a transaction
  await prisma.$transaction(
    updates.map((update: { id: string; sortOrder: number }) =>
      prisma.dropdownOption.update({
        where: { id: update.id },
        data: { sortOrder: update.sortOrder },
      })
    )
  );

  res.json({
    success: true,
    message: `Updated ${updates.length} dropdown options`,
  });
});

// POST /api/dropdown-options/populate - Populate default dropdown options for an organization (Admin only)
router.post('/populate', requireMinimumRole(UserRole.ADMIN), async (req, res) => {
  const { organizationId } = req.body;
  const user = (req as any).user;

  // Use provided organizationId or user's organizationId
  const orgId = organizationId || user.organizationId;

  if (!orgId) {
    throw new ValidationError('Organization ID is required');
  }

  // Check existing dropdown options by type for this organization
  const existingOptions = await prisma.dropdownOption.findMany({
    where: { organizationId: orgId },
    select: { optionType: true, value: true },
  });

  // Create a set of existing type+value combinations for quick lookup
  const existingSet = new Set(
    existingOptions.map((opt) => `${opt.optionType}:${opt.value}`)
  );

  const existingCount = existingOptions.length;

  // Default dropdown options to seed
  const defaultDropdownOptions: Record<DropdownType, { value: string; label: string; description: string }[]> = {
    [DropdownType.INJURY_TYPE]: [
      { value: 'FIRST_AID', label: 'First Aid', description: 'Minor injuries treated on-site' },
      { value: 'RECORDABLE', label: 'OSHA Recordable', description: 'Injuries requiring medical treatment beyond first aid' },
      { value: 'NEAR_MISS', label: 'Near Miss', description: 'Incident that could have resulted in injury' },
      { value: 'LOST_TIME', label: 'Lost Time', description: 'Injuries resulting in missed work days' },
      { value: 'RESTRICTED_DUTY', label: 'Restricted Duty', description: 'Injuries requiring modified work duties' },
      { value: 'FATALITY', label: 'Fatality', description: 'Work-related death' },
    ],
    [DropdownType.TASK_FREQUENCY]: [
      { value: 'CONTINUOUS', label: 'Continuous', description: 'Task performed continuously throughout shift' },
      { value: 'HOURLY', label: 'Hourly', description: 'Task performed every hour' },
      { value: 'DAILY', label: 'Daily', description: 'Task performed once per day' },
      { value: 'WEEKLY', label: 'Weekly', description: 'Task performed once per week' },
      { value: 'MONTHLY', label: 'Monthly', description: 'Task performed once per month' },
      { value: 'RARELY', label: 'Rarely', description: 'Task performed infrequently' },
      { value: 'FIRST_TIME', label: 'First Time', description: 'First time performing this task' },
    ],
    [DropdownType.UNSAFE_ACT_CONDITION]: [
      { value: 'UNSAFE_ACT', label: 'Unsafe Act', description: 'Human behavior that caused or contributed to the incident' },
      { value: 'UNSAFE_CONDITION', label: 'Unsafe Condition', description: 'Environmental or equipment condition that caused or contributed' },
      { value: 'BOTH', label: 'Both', description: 'Combination of unsafe act and unsafe condition' },
      { value: 'UNDETERMINED', label: 'Undetermined', description: 'Unable to determine at this time' },
    ],
    [DropdownType.INJURY_DEVELOPMENT]: [
      { value: 'SPECIFIC_DATE', label: 'Occurred on Specific Date', description: 'Injury happened at a specific time' },
      { value: 'DEVELOPED_OVER_TIME', label: 'Developed Over Time', description: 'Injury developed gradually over time' },
      { value: 'AGGRAVATION', label: 'Aggravation of Pre-existing', description: 'Work aggravated a pre-existing condition' },
    ],
    [DropdownType.SEVERITY_LEVEL]: [
      { value: 'LOW', label: 'Low', description: 'Minor incident with no or minimal impact' },
      { value: 'MEDIUM', label: 'Medium', description: 'Moderate incident requiring attention' },
      { value: 'HIGH', label: 'High', description: 'Serious incident requiring immediate action' },
      { value: 'CRITICAL', label: 'Critical', description: 'Severe incident with major impact' },
    ],
    [DropdownType.BODY_PART]: [
      { value: 'HEAD', label: 'Head', description: 'Head injuries including skull' },
      { value: 'EYES', label: 'Eyes', description: 'Eye injuries' },
      { value: 'FACE', label: 'Face', description: 'Facial injuries' },
      { value: 'NECK', label: 'Neck', description: 'Neck injuries' },
      { value: 'SHOULDER', label: 'Shoulder', description: 'Shoulder injuries' },
      { value: 'ARM', label: 'Arm', description: 'Upper arm injuries' },
      { value: 'ELBOW', label: 'Elbow', description: 'Elbow injuries' },
      { value: 'FOREARM', label: 'Forearm', description: 'Forearm injuries' },
      { value: 'WRIST', label: 'Wrist', description: 'Wrist injuries' },
      { value: 'HAND', label: 'Hand', description: 'Hand injuries' },
      { value: 'FINGERS', label: 'Fingers', description: 'Finger injuries' },
      { value: 'BACK_UPPER', label: 'Upper Back', description: 'Upper back/thoracic spine injuries' },
      { value: 'BACK_LOWER', label: 'Lower Back', description: 'Lower back/lumbar spine injuries' },
      { value: 'CHEST', label: 'Chest', description: 'Chest/rib injuries' },
      { value: 'ABDOMEN', label: 'Abdomen', description: 'Abdominal injuries' },
      { value: 'HIP', label: 'Hip', description: 'Hip injuries' },
      { value: 'LEG', label: 'Leg', description: 'Upper leg/thigh injuries' },
      { value: 'KNEE', label: 'Knee', description: 'Knee injuries' },
      { value: 'ANKLE', label: 'Ankle', description: 'Ankle injuries' },
      { value: 'FOOT', label: 'Foot', description: 'Foot injuries' },
      { value: 'TOES', label: 'Toes', description: 'Toe injuries' },
      { value: 'MULTIPLE', label: 'Multiple Body Parts', description: 'Multiple body parts affected' },
    ],
    [DropdownType.ENVIRONMENTAL_CONDITION]: [
      { value: 'HEAT', label: 'Heat', description: 'High temperature conditions' },
      { value: 'COLD', label: 'Cold', description: 'Low temperature conditions' },
      { value: 'NOISE', label: 'Noise', description: 'High noise levels' },
      { value: 'POOR_LIGHTING', label: 'Poor Lighting', description: 'Inadequate lighting' },
      { value: 'WET_SLIPPERY', label: 'Wet/Slippery', description: 'Wet or slippery surfaces' },
      { value: 'CONFINED_SPACE', label: 'Confined Space', description: 'Working in confined spaces' },
      { value: 'DUST', label: 'Dust', description: 'Dusty conditions' },
      { value: 'FUMES', label: 'Fumes', description: 'Chemical fumes present' },
      { value: 'VIBRATION', label: 'Vibration', description: 'Equipment vibration exposure' },
      { value: 'HEIGHT', label: 'Height', description: 'Working at heights' },
      { value: 'ELECTRICAL', label: 'Electrical Hazard', description: 'Electrical hazards present' },
      { value: 'PRESSURE', label: 'Pressure', description: 'High pressure systems' },
      { value: 'RADIATION', label: 'Radiation', description: 'Radiation exposure' },
    ],
    [DropdownType.CASE_CLASSIFICATION]: [
      { value: 'MEDICAL_ONLY', label: 'Medical Only', description: 'Required medical treatment but no lost time or restricted duty' },
      { value: 'RESTRICTED_WORK', label: 'Restricted Work/Transfer', description: 'Unable to perform normal duties, assigned to modified work' },
      { value: 'LOST_TIME', label: 'Days Away from Work', description: 'Employee unable to work due to injury' },
      { value: 'FATALITY', label: 'Fatality', description: 'Work-related death' },
      { value: 'FIRST_AID', label: 'First Aid Only', description: 'Minor treatment not requiring recordkeeping' },
      { value: 'NO_TREATMENT', label: 'No Treatment Required', description: 'No medical treatment needed' },
    ],
    [DropdownType.INJURY_WORK_RELATION]: [
      { value: 'CAUSED_BY_WORK', label: 'Caused by Work Activity', description: 'Injury was directly caused by work activities' },
      { value: 'MADE_WORSE_BY_WORK', label: 'Made Worse by Work Activity', description: 'Pre-existing condition aggravated by work' },
      { value: 'AGGRAVATED_PREEXISTING', label: 'Aggravated Pre-existing Condition', description: 'Work significantly worsened a known condition' },
      { value: 'WORK_RELATED', label: 'Work-Related (General)', description: 'Injury occurred in the work environment' },
      { value: 'NOT_WORK_RELATED', label: 'Not Work-Related', description: 'Injury occurred outside of work activities' },
      { value: 'UNDER_INVESTIGATION', label: 'Under Investigation', description: 'Work-relatedness still being determined' },
    ],
    // Investigation-specific dropdown types
    [DropdownType.CONTRIBUTING_FACTOR_TYPE]: [
      { value: 'PEOPLE_TRAINING', label: 'People - Lack of Training', description: 'Insufficient training or knowledge' },
      { value: 'PEOPLE_FATIGUE', label: 'People - Fatigue/Distraction', description: 'Employee fatigue, distraction, or inattention' },
      { value: 'PEOPLE_UNSAFE_ACT', label: 'People - Unsafe Act', description: 'Willful violation of safety procedures' },
      { value: 'PEOPLE_COMMUNICATION', label: 'People - Communication Failure', description: 'Poor communication or misunderstanding' },
      { value: 'PEOPLE_PHYSICAL', label: 'People - Physical Limitation', description: 'Physical capability issue or pre-existing condition' },
      { value: 'PROCESS_NO_SOP', label: 'Process - Missing SOP', description: 'Standard operating procedure not available' },
      { value: 'PROCESS_INADEQUATE_SOP', label: 'Process - Inadequate SOP', description: 'SOP exists but is insufficient or unclear' },
      { value: 'PROCESS_NOT_FOLLOWED', label: 'Process - SOP Not Followed', description: 'Procedure exists but was not followed' },
      { value: 'PROCESS_SUPERVISION', label: 'Process - Lack of Supervision', description: 'Insufficient oversight or supervision' },
      { value: 'PROCESS_PLANNING', label: 'Process - Poor Planning', description: 'Inadequate job planning or task assessment' },
      { value: 'EQUIPMENT_MALFUNCTION', label: 'Equipment - Malfunction', description: 'Equipment failure or malfunction' },
      { value: 'EQUIPMENT_NO_GUARD', label: 'Equipment - Missing Guard', description: 'Safety guards or barriers not in place' },
      { value: 'EQUIPMENT_MAINTENANCE', label: 'Equipment - Poor Maintenance', description: 'Inadequate preventive maintenance' },
      { value: 'EQUIPMENT_DESIGN', label: 'Equipment - Design Flaw', description: 'Inherent design deficiency' },
      { value: 'EQUIPMENT_PPE', label: 'Equipment - PPE Issue', description: 'Missing or inadequate PPE' },
      { value: 'ENVIRONMENT_HOUSEKEEPING', label: 'Environment - Housekeeping', description: 'Poor housekeeping or cluttered area' },
      { value: 'ENVIRONMENT_LIGHTING', label: 'Environment - Lighting', description: 'Inadequate or excessive lighting' },
      { value: 'ENVIRONMENT_TEMPERATURE', label: 'Environment - Temperature', description: 'Extreme heat or cold conditions' },
      { value: 'ENVIRONMENT_NOISE', label: 'Environment - Noise', description: 'Excessive noise levels' },
      { value: 'ENVIRONMENT_FLOOR', label: 'Environment - Floor Condition', description: 'Wet, slippery, or uneven floor surfaces' },
      { value: 'ENVIRONMENT_SPACE', label: 'Environment - Workspace', description: 'Confined or cramped work area' },
    ],
    [DropdownType.POSITION_JOB_TYPE]: [
      { value: 'LINE_OPERATOR', label: 'Line Operator', description: 'Production line operator' },
      { value: 'MACHINE_OPERATOR', label: 'Machine Operator', description: 'Operates specific machinery' },
      { value: 'FORKLIFT_DRIVER', label: 'Forklift Driver', description: 'Operates forklift or powered industrial truck' },
      { value: 'MAINTENANCE_TECH', label: 'Maintenance Technician', description: 'Equipment maintenance and repair' },
      { value: 'QUALITY_TECH', label: 'Quality Technician', description: 'Quality assurance and inspection' },
      { value: 'SANITATION', label: 'Sanitation Worker', description: 'Cleaning and sanitation duties' },
      { value: 'WAREHOUSE', label: 'Warehouse Associate', description: 'Warehouse operations and logistics' },
      { value: 'MATERIAL_HANDLER', label: 'Material Handler', description: 'Moving materials and supplies' },
      { value: 'PACKER', label: 'Packer', description: 'Packaging finished products' },
      { value: 'INSPECTOR', label: 'Inspector', description: 'Product or safety inspection' },
      { value: 'SUPERVISOR', label: 'Supervisor/Lead', description: 'Team lead or supervisor role' },
      { value: 'CONTRACTOR', label: 'Contractor', description: 'External contractor or vendor' },
      { value: 'TEMP_WORKER', label: 'Temporary Worker', description: 'Temporary or seasonal employee' },
      { value: 'OTHER', label: 'Other', description: 'Other position not listed' },
    ],
    [DropdownType.INJURY_MECHANISM]: [
      { value: 'STRUCK_BY', label: 'Struck By Object', description: 'Hit by moving or falling object' },
      { value: 'STRUCK_AGAINST', label: 'Struck Against Object', description: 'Contact with stationary object' },
      { value: 'CAUGHT_IN', label: 'Caught In/Between', description: 'Caught in or compressed by equipment' },
      { value: 'FALL_SAME_LEVEL', label: 'Fall - Same Level', description: 'Slip, trip, or fall on same level' },
      { value: 'FALL_DIFFERENT_LEVEL', label: 'Fall - Different Level', description: 'Fall from height or elevation' },
      { value: 'OVEREXERTION', label: 'Overexertion', description: 'Lifting, pushing, pulling, or carrying' },
      { value: 'REPETITIVE_MOTION', label: 'Repetitive Motion', description: 'Cumulative trauma from repetition' },
      { value: 'EXPOSURE_CHEMICAL', label: 'Exposure - Chemical', description: 'Contact with harmful substance' },
      { value: 'EXPOSURE_TEMPERATURE', label: 'Exposure - Temperature', description: 'Heat or cold exposure' },
      { value: 'EXPOSURE_NOISE', label: 'Exposure - Noise', description: 'Harmful noise exposure' },
      { value: 'ELECTRICAL', label: 'Electrical Contact', description: 'Contact with electrical current' },
      { value: 'CUT_LACERATION', label: 'Cut/Laceration', description: 'Cut by sharp object or edge' },
      { value: 'PUNCTURE', label: 'Puncture', description: 'Piercing by pointed object' },
      { value: 'MOTOR_VEHICLE', label: 'Motor Vehicle', description: 'Vehicle-related incident' },
      { value: 'OTHER', label: 'Other', description: 'Other mechanism not listed' },
    ],
    [DropdownType.CORRECTIVE_ACTION_TYPE]: [
      { value: 'ENGINEERING', label: 'Engineering Control', description: 'Physical changes to equipment or workspace' },
      { value: 'ADMINISTRATIVE', label: 'Administrative Control', description: 'Changes to procedures, training, or work practices' },
      { value: 'PPE', label: 'PPE Requirement', description: 'Personal protective equipment changes' },
      { value: 'TRAINING', label: 'Training/Education', description: 'Employee training or retraining' },
      { value: 'SOP_UPDATE', label: 'SOP Update', description: 'Update or create standard operating procedure' },
      { value: 'EQUIPMENT_REPAIR', label: 'Equipment Repair', description: 'Repair or replace faulty equipment' },
      { value: 'GUARD_INSTALL', label: 'Guard Installation', description: 'Install or improve machine guarding' },
      { value: 'SIGNAGE', label: 'Signage/Warning', description: 'Add or improve safety signage' },
      { value: 'HOUSEKEEPING', label: 'Housekeeping Improvement', description: 'Improve cleanliness and organization' },
      { value: 'DISCIPLINE', label: 'Disciplinary Action', description: 'Employee disciplinary measure' },
      { value: 'PROCESS_CHANGE', label: 'Process Change', description: 'Modify work process or workflow' },
      { value: 'MONITORING', label: 'Enhanced Monitoring', description: 'Increase supervision or monitoring' },
    ],
    [DropdownType.INCIDENT_PATTERN]: [
      { value: 'ISOLATED', label: 'Isolated Incident', description: 'One-time incident with no prior similar occurrences' },
      { value: 'RECURRING', label: 'Recurring Pattern', description: 'Similar incidents have occurred before' },
      { value: 'TRENDING', label: 'Trending Upward', description: 'Frequency of similar incidents is increasing' },
      { value: 'SEASONAL', label: 'Seasonal Pattern', description: 'Incidents occur more frequently during certain times' },
      { value: 'SHIFT_RELATED', label: 'Shift-Related', description: 'Pattern associated with specific shifts' },
      { value: 'LOCATION_SPECIFIC', label: 'Location-Specific', description: 'Incidents cluster in specific areas' },
      { value: 'TASK_SPECIFIC', label: 'Task-Specific', description: 'Incidents occur during specific tasks or operations' },
      { value: 'EQUIPMENT_RELATED', label: 'Equipment-Related', description: 'Pattern tied to specific equipment or machinery' },
      { value: 'EMPLOYEE_RELATED', label: 'Employee-Related', description: 'Pattern involves specific employee group or tenure' },
      { value: 'NEW_PROCESS', label: 'New Process/Change', description: 'Incident related to recent process or equipment changes' },
    ],
    [DropdownType.TASK_ROUTINE_TYPE]: [
      { value: 'ROUTINE', label: 'Normal/Routine Task', description: 'Regular, expected work activity performed frequently' },
      { value: 'NON_ROUTINE', label: 'Non-Routine Task', description: 'Unusual or infrequent task outside normal operations' },
    ],
    [DropdownType.WEIGHT_FORCE_UNIT]: [
      { value: 'LBS', label: 'Pounds (lbs)', description: 'Weight measured in pounds' },
      { value: 'KG', label: 'Kilograms (kg)', description: 'Weight measured in kilograms' },
      { value: 'OZ', label: 'Ounces (oz)', description: 'Weight measured in ounces' },
      { value: 'NEWTONS', label: 'Newtons (N)', description: 'Force measured in Newtons' },
      { value: 'KGF', label: 'Kilogram-force (kgf)', description: 'Force measured in kilogram-force' },
      { value: 'LBF', label: 'Pound-force (lbf)', description: 'Force measured in pound-force' },
    ],
    // Employee Information dropdown types
    [DropdownType.EMPLOYEE_LANGUAGE]: [
      { value: 'ENGLISH', label: 'English', description: 'English language' },
      { value: 'SPANISH', label: 'Spanish', description: 'Spanish language' },
      { value: 'FRENCH', label: 'French', description: 'French language' },
      { value: 'CHINESE', label: 'Chinese', description: 'Chinese (Mandarin/Cantonese)' },
      { value: 'VIETNAMESE', label: 'Vietnamese', description: 'Vietnamese language' },
      { value: 'KOREAN', label: 'Korean', description: 'Korean language' },
      { value: 'TAGALOG', label: 'Tagalog', description: 'Tagalog/Filipino language' },
      { value: 'PORTUGUESE', label: 'Portuguese', description: 'Portuguese language' },
      { value: 'HINDI', label: 'Hindi', description: 'Hindi language' },
      { value: 'OTHER', label: 'Other', description: 'Other language not listed' },
    ],
    [DropdownType.EMPLOYEE_GENDER]: [
      { value: 'MALE', label: 'Male', description: 'Male gender' },
      { value: 'FEMALE', label: 'Female', description: 'Female gender' },
      { value: 'NON_BINARY', label: 'Non-Binary', description: 'Non-binary gender identity' },
      { value: 'PREFER_NOT_TO_SAY', label: 'Prefer Not to Say', description: 'Prefer not to disclose' },
      { value: 'OTHER', label: 'Other', description: 'Other gender identity' },
    ],
  };

  let totalCreated = 0;
  let totalSkipped = 0;
  const typeCounts: Record<string, number> = {};
  const typeSkipped: Record<string, number> = {};

  // Create dropdown options, skipping any that already exist
  for (const [optionType, options] of Object.entries(defaultDropdownOptions)) {
    let createdForType = 0;
    let skippedForType = 0;
    
    for (let i = 0; i < options.length; i++) {
      const option = options[i];
      const key = `${optionType}:${option.value}`;
      
      // Skip if this type+value combination already exists
      if (existingSet.has(key)) {
        skippedForType++;
        totalSkipped++;
        continue;
      }
      
      await prisma.dropdownOption.create({
        data: {
          optionType: optionType as DropdownType,
          value: option.value,
          label: option.label,
          description: option.description,
          sortOrder: i,
          isActive: true,
          isDefault: true,
          organizationId: orgId,
        },
      });
      createdForType++;
      totalCreated++;
    }
    
    if (createdForType > 0) {
      typeCounts[optionType] = createdForType;
    }
    if (skippedForType > 0) {
      typeSkipped[optionType] = skippedForType;
    }
  }

  const totalTypes = Object.keys(defaultDropdownOptions).length;
  const typesWithNewData = Object.keys(typeCounts).length;

  res.status(201).json({
    success: true,
    message: totalCreated > 0 
      ? `Successfully added ${totalCreated} new dropdown options across ${typesWithNewData} types${totalSkipped > 0 ? ` (${totalSkipped} existing options skipped)` : ''}`
      : `All ${existingCount} dropdown options already exist for this organization`,
    data: {
      totalCreated,
      totalSkipped,
      existingCount,
      typeCounts,
      typeSkipped,
      totalTypes,
    },
  });
});

// ============================================
// DROPDOWN TYPE REQUIREMENT ROUTES
// ============================================

// PATCH /api/dropdown-options/type-settings/:optionType - Update dropdown type settings (required/placeholder)
router.patch('/type-settings/:optionType', requireMinimumRole(UserRole.ADMIN), async (req, res) => {
  const { optionType } = req.params;
  const { isRequired, placeholder } = req.body;
  const user = (req as any).user;

  if (!Object.values(DropdownType).includes(optionType as DropdownType)) {
    throw new ValidationError(`Invalid option type. Must be one of: ${Object.values(DropdownType).join(', ')}`);
  }

  // Update all options of this type for the organization
  await prisma.dropdownOption.updateMany({
    where: {
      organizationId: user.organizationId,
      optionType: optionType as DropdownType,
    },
    data: {
      ...(isRequired !== undefined && { isRequired }),
      ...(placeholder !== undefined && { placeholder }),
    },
  });

  // Return updated options
  const options = await prisma.dropdownOption.findMany({
    where: {
      organizationId: user.organizationId,
      optionType: optionType as DropdownType,
    },
  });

  res.json({
    success: true,
    message: `Updated settings for ${optionType}`,
    data: options,
  });
});

// ============================================
// FIELD CONFIGURATION ROUTES (continued)
// ============================================

// POST /api/dropdown-options/field-config - Create or update field configuration
router.post('/field-config', requireMinimumRole(UserRole.ADMIN), async (req, res) => {
  const { incidentType, fieldName, fieldLabel, fieldType, isRequired, placeholder, helpText, sortOrder } = req.body;
  const user = (req as any).user;

  if (!incidentType || !fieldName || !fieldLabel || !fieldType) {
    throw new ValidationError('Incident type, field name, field label, and field type are required');
  }

  // Upsert the field configuration
  const config = await prisma.fieldConfiguration.upsert({
    where: {
      organizationId_incidentType_fieldName: {
        organizationId: user.organizationId,
        incidentType,
        fieldName,
      },
    },
    update: {
      fieldLabel,
      fieldType,
      isRequired: isRequired ?? false,
      placeholder: placeholder || null,
      helpText: helpText || null,
      sortOrder: sortOrder ?? 0,
      isActive: true,
    },
    create: {
      incidentType,
      fieldName,
      fieldLabel,
      fieldType,
      isRequired: isRequired ?? false,
      placeholder: placeholder || null,
      helpText: helpText || null,
      sortOrder: sortOrder ?? 0,
      isActive: true,
      organizationId: user.organizationId,
    },
  });

  res.json({
    success: true,
    data: config,
  });
});

// PATCH /api/dropdown-options/field-config/:id - Update field configuration
router.patch('/field-config/:id', requireMinimumRole(UserRole.ADMIN), async (req, res) => {
  const { id } = req.params;
  const { fieldLabel, isRequired, placeholder, helpText, sortOrder, isActive } = req.body;
  const user = (req as any).user;

  const existing = await prisma.fieldConfiguration.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new ValidationError('Field configuration not found');
  }

  if (existing.organizationId !== user.organizationId && user.role !== UserRole.SYSTEM_ADMIN) {
    throw new ValidationError('You can only modify field configurations for your organization');
  }

  const config = await prisma.fieldConfiguration.update({
    where: { id },
    data: {
      ...(fieldLabel !== undefined && { fieldLabel }),
      ...(isRequired !== undefined && { isRequired }),
      ...(placeholder !== undefined && { placeholder }),
      ...(helpText !== undefined && { helpText }),
      ...(sortOrder !== undefined && { sortOrder }),
      ...(isActive !== undefined && { isActive }),
    },
  });

  res.json({
    success: true,
    data: config,
  });
});

// POST /api/dropdown-options/field-config/populate - Populate default field configurations
router.post('/field-config/populate', requireMinimumRole(UserRole.ADMIN), async (req, res) => {
  const { organizationId } = req.body;
  const user = (req as any).user;

  const orgId = organizationId || user.organizationId;

  if (!orgId) {
    throw new ValidationError('Organization ID is required');
  }

  // Default field configurations for each incident type
  const defaultFieldConfigs = {
    FOOD_SAFETY: [
      { fieldName: 'title', fieldLabel: 'Incident Title', fieldType: 'text', isRequired: true, placeholder: 'Enter a brief title for this incident', sortOrder: 1 },
      { fieldName: 'description', fieldLabel: 'Description', fieldType: 'textarea', isRequired: true, placeholder: 'Describe what happened in detail...', sortOrder: 2 },
      { fieldName: 'category', fieldLabel: 'Category', fieldType: 'select', isRequired: true, placeholder: 'Select a category', sortOrder: 3 },
      { fieldName: 'subCategory', fieldLabel: 'Sub-Category', fieldType: 'select', isRequired: false, placeholder: 'Select a sub-category', sortOrder: 4 },
      { fieldName: 'severity', fieldLabel: 'Severity Level', fieldType: 'select', isRequired: true, placeholder: 'Select severity level', sortOrder: 5 },
      { fieldName: 'facility', fieldLabel: 'Facility', fieldType: 'select', isRequired: true, placeholder: 'Select facility', sortOrder: 6 },
      { fieldName: 'line', fieldLabel: 'Line', fieldType: 'select', isRequired: false, placeholder: 'Select production line', sortOrder: 7 },
      { fieldName: 'product', fieldLabel: 'Product Affected', fieldType: 'text', isRequired: false, placeholder: 'Enter product name or SKU', sortOrder: 8 },
      { fieldName: 'lotNumber', fieldLabel: 'Lot Number', fieldType: 'text', isRequired: false, placeholder: 'Enter lot/batch number', sortOrder: 9 },
      { fieldName: 'incidentDate', fieldLabel: 'Date of Incident', fieldType: 'date', isRequired: true, placeholder: '', sortOrder: 10 },
      { fieldName: 'incidentTime', fieldLabel: 'Time of Incident', fieldType: 'time', isRequired: false, placeholder: '', sortOrder: 11 },
      { fieldName: 'immediateActions', fieldLabel: 'Immediate Actions Taken', fieldType: 'textarea', isRequired: false, placeholder: 'Describe any immediate actions taken...', sortOrder: 12 },
    ],
    MACHINE_EQUIPMENT: [
      { fieldName: 'title', fieldLabel: 'Incident Title', fieldType: 'text', isRequired: true, placeholder: 'Enter a brief title for this incident', sortOrder: 1 },
      { fieldName: 'description', fieldLabel: 'Description', fieldType: 'textarea', isRequired: true, placeholder: 'Describe the equipment issue in detail...', sortOrder: 2 },
      { fieldName: 'category', fieldLabel: 'Category', fieldType: 'select', isRequired: true, placeholder: 'Select a category', sortOrder: 3 },
      { fieldName: 'subCategory', fieldLabel: 'Sub-Category', fieldType: 'select', isRequired: false, placeholder: 'Select a sub-category', sortOrder: 4 },
      { fieldName: 'severity', fieldLabel: 'Severity Level', fieldType: 'select', isRequired: true, placeholder: 'Select severity level', sortOrder: 5 },
      { fieldName: 'facility', fieldLabel: 'Facility', fieldType: 'select', isRequired: true, placeholder: 'Select facility', sortOrder: 6 },
      { fieldName: 'line', fieldLabel: 'Line', fieldType: 'select', isRequired: false, placeholder: 'Select production line', sortOrder: 7 },
      { fieldName: 'machineId', fieldLabel: 'Machine/Equipment ID', fieldType: 'text', isRequired: true, placeholder: 'Enter machine ID or name', sortOrder: 8 },
      { fieldName: 'incidentDate', fieldLabel: 'Date of Incident', fieldType: 'date', isRequired: true, placeholder: '', sortOrder: 9 },
      { fieldName: 'incidentTime', fieldLabel: 'Time of Incident', fieldType: 'time', isRequired: false, placeholder: '', sortOrder: 10 },
      { fieldName: 'downtimeMinutes', fieldLabel: 'Downtime (minutes)', fieldType: 'text', isRequired: false, placeholder: 'Enter estimated downtime', sortOrder: 11 },
      { fieldName: 'immediateActions', fieldLabel: 'Immediate Actions Taken', fieldType: 'textarea', isRequired: false, placeholder: 'Describe any immediate actions taken...', sortOrder: 12 },
    ],
    WORKPLACE_SAFETY: [
      { fieldName: 'title', fieldLabel: 'Incident Title', fieldType: 'text', isRequired: true, placeholder: 'Enter a brief title for this incident', sortOrder: 1 },
      { fieldName: 'description', fieldLabel: 'Description', fieldType: 'textarea', isRequired: true, placeholder: 'Describe the safety incident in detail...', sortOrder: 2 },
      { fieldName: 'category', fieldLabel: 'Category', fieldType: 'select', isRequired: true, placeholder: 'Select a category', sortOrder: 3 },
      { fieldName: 'subCategory', fieldLabel: 'Sub-Category', fieldType: 'select', isRequired: false, placeholder: 'Select a sub-category', sortOrder: 4 },
      { fieldName: 'injuryType', fieldLabel: 'Injury Type', fieldType: 'select', isRequired: true, placeholder: 'Select injury type', sortOrder: 5 },
      { fieldName: 'severity', fieldLabel: 'Severity Level', fieldType: 'select', isRequired: true, placeholder: 'Select severity level', sortOrder: 6 },
      { fieldName: 'bodyPart', fieldLabel: 'Body Part(s) Affected', fieldType: 'multiselect', isRequired: true, placeholder: 'Select affected body parts', sortOrder: 7 },
      { fieldName: 'facility', fieldLabel: 'Facility', fieldType: 'select', isRequired: true, placeholder: 'Select facility', sortOrder: 8 },
      { fieldName: 'line', fieldLabel: 'Line/Area', fieldType: 'select', isRequired: false, placeholder: 'Select line or area', sortOrder: 9 },
      { fieldName: 'taskBeingPerformed', fieldLabel: 'Task Being Performed', fieldType: 'text', isRequired: true, placeholder: 'What task was being performed?', sortOrder: 10 },
      { fieldName: 'taskRoutineType', fieldLabel: 'Task Routine Type', fieldType: 'select', isRequired: false, placeholder: 'Select task type', sortOrder: 11 },
      { fieldName: 'incidentDate', fieldLabel: 'Date of Incident', fieldType: 'date', isRequired: true, placeholder: '', sortOrder: 12 },
      { fieldName: 'incidentTime', fieldLabel: 'Time of Incident', fieldType: 'time', isRequired: false, placeholder: '', sortOrder: 13 },
      { fieldName: 'environmentalCondition', fieldLabel: 'Environmental Conditions', fieldType: 'multiselect', isRequired: false, placeholder: 'Select environmental conditions', sortOrder: 14 },
      { fieldName: 'ppeRequired', fieldLabel: 'PPE Required', fieldType: 'checkbox', isRequired: false, placeholder: '', sortOrder: 15 },
      { fieldName: 'ppeWorn', fieldLabel: 'PPE Worn', fieldType: 'checkbox', isRequired: false, placeholder: '', sortOrder: 16 },
      { fieldName: 'firstAidProvided', fieldLabel: 'First Aid Provided', fieldType: 'checkbox', isRequired: false, placeholder: '', sortOrder: 17 },
      { fieldName: 'medicalTreatmentRequired', fieldLabel: 'Medical Treatment Required', fieldType: 'checkbox', isRequired: false, placeholder: '', sortOrder: 18 },
      { fieldName: 'immediateActions', fieldLabel: 'Immediate Actions Taken', fieldType: 'textarea', isRequired: false, placeholder: 'Describe any immediate actions taken...', sortOrder: 19 },
    ],
  };

  let totalCreated = 0;
  const typeCounts: Record<string, number> = {};

  for (const [incidentType, fields] of Object.entries(defaultFieldConfigs)) {
    let createdForType = 0;

    for (const field of fields) {
      // Check if already exists
      const existing = await prisma.fieldConfiguration.findUnique({
        where: {
          organizationId_incidentType_fieldName: {
            organizationId: orgId,
            incidentType,
            fieldName: field.fieldName,
          },
        },
      });

      if (existing) continue;

      await prisma.fieldConfiguration.create({
        data: {
          incidentType,
          fieldName: field.fieldName,
          fieldLabel: field.fieldLabel,
          fieldType: field.fieldType,
          isRequired: field.isRequired,
          placeholder: field.placeholder || null,
          sortOrder: field.sortOrder,
          isActive: true,
          organizationId: orgId,
        },
      });

      createdForType++;
      totalCreated++;
    }

    if (createdForType > 0) {
      typeCounts[incidentType] = createdForType;
    }
  }

  res.status(201).json({
    success: true,
    message: `Created ${totalCreated} field configurations`,
    data: {
      totalCreated,
      typeCounts,
    },
  });
});

export default router;
