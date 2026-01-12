import { PrismaClient, DropdownType } from '@prisma/client';

const prisma = new PrismaClient();

const MEGAMEX_ORG_ID = '75d854fd-6e46-47fa-bc8b-e50ec37a4773';
const DEMO_ORG_ID = '00000000-0000-0000-0000-000000000001';

// Default dropdown options for all organizations
const defaultDropdownOptions = {
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
  [DropdownType.RESPONSIBLE_PARTY]: [
    { value: 'QUALITY_ASSURANCE', label: 'Quality Assurance Team', description: 'Quality assurance and control team' },
    { value: 'MAINTENANCE', label: 'Maintenance Team', description: 'Facility and equipment maintenance team' },
    { value: 'PRODUCTION', label: 'Production Team', description: 'Production and manufacturing team' },
    { value: 'ENGINEERING', label: 'Engineering Team', description: 'Engineering and design team' },
    { value: 'SAFETY', label: 'Safety Team', description: 'Health and safety team' },
    { value: 'OPERATIONS', label: 'Operations Team', description: 'Operations management team' },
    { value: 'HR', label: 'Human Resources', description: 'Human resources department' },
    { value: 'LOGISTICS', label: 'Logistics Team', description: 'Logistics and supply chain team' },
    { value: 'TRAINING', label: 'Training Team', description: 'Training and development team' },
    { value: 'MANAGEMENT', label: 'Management', description: 'Management and leadership team' },
  ],
  [DropdownType.PREVENTIVE_CONTROL_TYPE]: [
    { value: 'PROCESS', label: 'Process Change', description: 'Changes to workflows, procedures, or standard operating procedures' },
    { value: 'TRAINING', label: 'Training', description: 'Training programs, competency assessments, and skill development' },
    { value: 'EQUIPMENT', label: 'Equipment', description: 'Equipment upgrades, maintenance schedules, and physical safeguards' },
    { value: 'DOCUMENTATION', label: 'Documentation', description: 'Checklists, logs, records, and written procedures' },
    { value: 'MONITORING', label: 'Monitoring', description: 'Inspections, audits, key metrics tracking, and early warning systems' },
  ],
};

async function seedDropdownOptionsForOrg(organizationId: string, orgName: string) {
  console.log(`\n=== Seeding Dropdown Options for ${orgName} (${organizationId}) ===\n`);

  // Check if options already exist for this org
  const existingCount = await prisma.dropdownOption.count({
    where: { organizationId },
  });

  if (existingCount > 0) {
    console.log(`⚠️  Found ${existingCount} existing dropdown options. Skipping to avoid duplicates.`);
    return;
  }

  let totalCreated = 0;

  for (const [optionType, options] of Object.entries(defaultDropdownOptions)) {
    for (let i = 0; i < options.length; i++) {
      const option = options[i];
      await prisma.dropdownOption.create({
        data: {
          optionType: optionType as DropdownType,
          value: option.value,
          label: option.label,
          description: option.description,
          sortOrder: i,
          isActive: true,
          isDefault: true,
          organizationId,
        },
      });
      totalCreated++;
    }
    console.log(`✅ Created ${options.length} options for ${optionType}`);
  }

  console.log(`\n✅ Successfully created ${totalCreated} dropdown options for ${orgName}`);
}

async function main() {
  try {
    // Get all organizations and seed for each
    const organizations = await prisma.organization.findMany({
      select: { id: true, name: true }
    });
    
    for (const org of organizations) {
      await seedDropdownOptionsForOrg(org.id, org.name);
    }

    // Verify
    const count = await prisma.dropdownOption.count();
    console.log(`\n📊 Total dropdown options in database: ${count}`);
  } catch (error) {
    console.error('Error seeding dropdown options:', error);
    throw error;
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
