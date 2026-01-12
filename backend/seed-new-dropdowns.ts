import { PrismaClient, DropdownType } from '@prisma/client';

const prisma = new PrismaClient();

const MEGAMEX_ORG_ID = '75d854fd-6e46-47fa-bc8b-e50ec37a4773';
const DEMO_ORG_ID = '00000000-0000-0000-0000-000000000001';

// New dropdown options for Incident Investigation section
const newDropdownOptions = {
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
};

async function seedNewDropdownOptionsForOrg(organizationId: string, orgName: string) {
  console.log(`\n=== Seeding NEW Dropdown Options for ${orgName} (${organizationId}) ===\n`);

  let totalCreated = 0;

  for (const [optionType, options] of Object.entries(newDropdownOptions)) {
    // Check if options already exist for this type
    const existingCount = await prisma.dropdownOption.count({
      where: { 
        organizationId,
        optionType: optionType as DropdownType,
      },
    });

    if (existingCount > 0) {
      console.log(`⚠️  Found ${existingCount} existing options for ${optionType}. Skipping.`);
      continue;
    }

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

  console.log(`\n✅ Successfully created ${totalCreated} new dropdown options for ${orgName}`);
}

async function main() {
  try {
    // Seed for both organizations
    await seedNewDropdownOptionsForOrg(MEGAMEX_ORG_ID, 'MegaMex Foods');
    await seedNewDropdownOptionsForOrg(DEMO_ORG_ID, 'Demo Corporation');

    // Verify
    const caseClassificationCount = await prisma.dropdownOption.count({
      where: { optionType: 'CASE_CLASSIFICATION' }
    });
    const injuryWorkRelationCount = await prisma.dropdownOption.count({
      where: { optionType: 'INJURY_WORK_RELATION' }
    });

    console.log(`\n📊 Total CASE_CLASSIFICATION options: ${caseClassificationCount}`);
    console.log(`📊 Total INJURY_WORK_RELATION options: ${injuryWorkRelationCount}`);
  } catch (error) {
    console.error('Error seeding new dropdown options:', error);
    throw error;
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
