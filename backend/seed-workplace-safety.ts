import { PrismaClient, IncidentType } from '@prisma/client';

const prisma = new PrismaClient();

const MEGAMEX_ORG_ID = '75d854fd-6e46-47fa-bc8b-e50ec37a4773';

// All Workplace Safety categories and subcategories from Enhancement.md
const workplaceSafetyCategories = [
  {
    name: 'Physical Injury Hazards',
    description: 'Injuries caused by contact, movement, or applied force',
    subcategories: [
      'Slips, Trips & Falls',
      'Cuts, Lacerations & Abrasions',
      'Punctures',
      'Bruises / Contusions',
      'Struck-By Objects',
      'Caught-In / Caught-Between',
      'Pinch Points',
      'Falling Objects',
      'Head Injuries',
      'Eye Injuries',
      'Hand & Finger Injuries',
      'Foot & Ankle Injuries',
    ],
  },
  {
    name: 'Ergonomic & Musculoskeletal Safety',
    description: 'A primary source of OSHA recordable injuries',
    subcategories: [
      'Manual Material Handling',
      'Overexertion',
      'Repetitive Motion',
      'Awkward Postures',
      'Forceful Exertions',
      'Push / Pull Hazards',
      'Lifting & Carrying',
      'Cumulative Trauma Disorders (CTD)',
    ],
  },
  {
    name: 'Machine & Equipment Safety',
    description: 'Injury prevention related to equipment and machinery',
    subcategories: [
      'Machine Guarding',
      'Lockout / Tagout (LOTO)',
      'Mechanical Hazards',
      'Electrical Hazards',
      'Pneumatic / Hydraulic Hazards',
      'Sensors & Interlocks',
      'Emergency Stops',
      'Unexpected Startup',
      'Unsafe Changeovers',
      'Maintenance Safety',
    ],
  },
  {
    name: 'Chemical & Hazardous Materials Safety',
    description: 'Employee exposure and injury risk',
    subcategories: [
      'Chemical Exposure',
      'Ammonia Exposure',
      'Cleaning & Sanitation Chemicals',
      'SDS / GHS Labeling',
      'Chemical Storage',
      'Chemical Spills',
      'Incompatible Chemical Mixing',
      'Compressed Gases',
      'Chemical PPE',
    ],
  },
  {
    name: 'Environmental & Exposure Hazards',
    description: 'Workplace conditions affecting employee health',
    subcategories: [
      'Heat Stress',
      'Cold Stress',
      'Noise Exposure (Hearing Conservation)',
      'Air Quality / Ventilation',
      'Dust Exposure',
      'Fumes & Vapors',
      'Lighting Deficiencies',
      'Radiation (where applicable)',
    ],
  },
  {
    name: 'Fire & Emergency Safety',
    description: 'Emergency preparedness and response',
    subcategories: [
      'Fire Hazards',
      'Flammable Materials',
      'Emergency Evacuation',
      'Alarm Systems',
      'Emergency Exits & Egress',
      'Fire Suppression Systems',
      'Emergency Drills',
      'First Aid & AED',
      'Emergency Response Procedures',
    ],
  },
  {
    name: 'Material Handling & Traffic Safety',
    description: 'Movement of people, equipment, and loads',
    subcategories: [
      'Forklift Safety',
      'Pallet Jack Safety',
      'Dock Safety',
      'Trailer Safety',
      'Load Securing',
      'Pedestrian vs Vehicle Traffic',
      'Racking & Storage Safety',
    ],
  },
  {
    name: 'Personal Protective Equipment (PPE)',
    description: 'Required protective controls',
    subcategories: [
      'Head Protection',
      'Eye & Face Protection',
      'Hand Protection',
      'Foot Protection',
      'Hearing Protection',
      'Respiratory Protection',
      'Chemical-Resistant PPE',
      'High-Visibility PPE',
    ],
  },
  {
    name: 'Facility & Infrastructure Safety',
    description: 'Building and structural hazards',
    subcategories: [
      'Floors & Walkways',
      'Stairs & Handrails',
      'Platforms & Mezzanines',
      'Doors & Dock Plates',
      'Roof Leaks / Condensation (Slip Risk)',
      'Housekeeping',
      'Structural Integrity',
    ],
  },
  {
    name: 'Behavioral, Training & Compliance Safety',
    description: 'Human-factor and compliance risks',
    subcategories: [
      'Unsafe Acts',
      'SOP Non-Compliance',
      'Lack of Training',
      'Failure to Use PPE',
      'Near Misses',
      'Incident Reporting',
      'Contractor Safety',
      'Visitor Safety',
      'Work Rule Violations',
    ],
  },
  {
    name: 'Health & Medical Management',
    description: 'Case tracking and post-incident management',
    subcategories: [
      'First Aid',
      'OSHA Recordable Injuries',
      'Restricted Duty',
      'Lost Time Injuries',
      'Occupational Illness',
      'Return-to-Work',
      'Fatigue Management',
    ],
  },
];

async function seedWorkplaceSafetyForOrg(organizationId: string) {
  console.log(`\n=== Seeding Workplace Safety Categories for Organization ${organizationId} ===\n`);

  // Check if categories already exist for this org
  const existingCount = await prisma.category.count({
    where: {
      organizationId,
      type: 'WORKPLACE_SAFETY',
    },
  });

  if (existingCount > 0) {
    console.log(`⚠️  Found ${existingCount} existing WORKPLACE_SAFETY categories for this organization.`);
    console.log('Deleting existing categories to re-seed...');
    
    // Delete existing categories for this org
    await prisma.category.deleteMany({
      where: {
        organizationId,
        type: 'WORKPLACE_SAFETY',
      },
    });
    console.log('✅ Existing categories deleted.');
  }

  let totalCreated = 0;
  let sortOrder = 0;

  for (const category of workplaceSafetyCategories) {
    // Create parent category
    const parent = await prisma.category.create({
      data: {
        name: category.name,
        type: IncidentType.WORKPLACE_SAFETY,
        organizationId,
        sortOrder: sortOrder++,
        isActive: true,
        allowCustomTitle: false,
      },
    });
    totalCreated++;
    console.log(`✅ Created parent category: ${category.name}`);

    // Create subcategories
    for (const subName of category.subcategories) {
      await prisma.category.create({
        data: {
          name: subName,
          type: IncidentType.WORKPLACE_SAFETY,
          organizationId,
          parentId: parent.id,
          sortOrder: sortOrder++,
          isActive: true,
          allowCustomTitle: subName.toLowerCase().includes('other'),
        },
      });
      totalCreated++;
    }

    // Add "Other" subcategory for each parent
    await prisma.category.create({
      data: {
        name: 'Other',
        type: IncidentType.WORKPLACE_SAFETY,
        organizationId,
        parentId: parent.id,
        sortOrder: sortOrder++,
        isActive: true,
        allowCustomTitle: true,
      },
    });
    totalCreated++;
  }

  console.log(`\n✅ Successfully created ${totalCreated} Workplace Safety categories for organization ${organizationId}`);
}

async function main() {
  try {
    // Seed for MegaMex Foods
    await seedWorkplaceSafetyForOrg(MEGAMEX_ORG_ID);
    
    // Verify
    const count = await prisma.category.count({
      where: {
        organizationId: MEGAMEX_ORG_ID,
        type: 'WORKPLACE_SAFETY',
      },
    });
    console.log(`\n📊 Total WORKPLACE_SAFETY categories for MegaMex Foods: ${count}`);
  } catch (error) {
    console.error('Error seeding categories:', error);
    throw error;
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
