import { PrismaClient, IncidentType } from '@prisma/client';

const prisma = new PrismaClient();

const MEGAMEX_ORG_ID = 'a0f1ca04-ee78-439b-94df-95c4803ffbf7';

// Operations categories focused on efficiency, waste, and production metrics
const operationsCategories = [
  {
    name: 'Waste & Yield Loss',
    description: 'Incidents related to material waste and yield issues',
    subcategories: [
      'Product Waste',
      'Raw Material Waste',
      'Packaging Waste',
      'Scrap & Rework',
      'Trim Waste',
      'Overproduction Waste',
      'Contaminated Product Disposal',
      'Expired Materials',
      'Off-Spec Product',
      'Other Waste Issue',
    ],
  },
  {
    name: 'Equipment Efficiency (OEE)',
    description: 'Overall Equipment Effectiveness and downtime issues',
    subcategories: [
      'Unplanned Downtime',
      'Planned Downtime Issues',
      'Speed Loss',
      'Minor Stoppages',
      'Changeover Delays',
      'Startup Loss',
      'Reduced Speed Running',
      'Equipment Performance Drop',
      'Quality Defects (OEE)',
      'Other OEE Issue',
    ],
  },
  {
    name: 'Production Throughput',
    description: 'Output and production rate issues',
    subcategories: [
      'Line Speed Issues',
      'Bottleneck Problems',
      'Capacity Constraints',
      'Labor Shortage Impact',
      'Material Shortage',
      'Scheduling Conflicts',
      'Shift Handoff Issues',
      'Production Target Miss',
      'Other Throughput Issue',
    ],
  },
  {
    name: 'Quality & Rework',
    description: 'Quality-related operational issues',
    subcategories: [
      'Product Quality Deviation',
      'Rework Required',
      'Out-of-Spec Material',
      'Calibration Issues',
      'Process Deviation',
      'Inspection Failure',
      'Customer Complaint Related',
      'Hold & Release Issues',
      'Other Quality Issue',
    ],
  },
  {
    name: 'Process & Procedure',
    description: 'Standard operating procedure and process issues',
    subcategories: [
      'SOP Not Followed',
      'Process Variation',
      'Recipe/Formula Error',
      'Temperature Deviation',
      'Timing Issues',
      'Measurement Error',
      'Documentation Gap',
      'Training Gap',
      'Other Process Issue',
    ],
  },
  {
    name: 'Resource Utilization',
    description: 'Labor, material, and equipment utilization issues',
    subcategories: [
      'Labor Efficiency',
      'Overtime Issues',
      'Material Usage Variance',
      'Energy Consumption',
      'Water Usage',
      'Utility Cost Issue',
      'Tool/Equipment Misuse',
      'Other Resource Issue',
    ],
  },
];

async function seedOperationsCategories() {
  console.log('🚀 Starting Operations categories seed...');

  try {
    for (const category of operationsCategories) {
      console.log(`\n📁 Processing main category: ${category.name}`);

      // Create or find the main category
      let mainCategory = await prisma.category.findFirst({
        where: {
          name: category.name,
          type: 'OPERATIONS',
          organizationId: MEGAMEX_ORG_ID,
          parentId: null,
        },
      });

      if (!mainCategory) {
        mainCategory = await prisma.category.create({
          data: {
            name: category.name,
            type: 'OPERATIONS' as IncidentType,
            organizationId: MEGAMEX_ORG_ID,
            isActive: true,
          },
        });
        console.log(`  ✅ Created main category: ${category.name}`);
      } else {
        console.log(`  ⏭️ Main category exists: ${category.name}`);
      }

      // Create subcategories
      for (const subName of category.subcategories) {
        const existingSub = await prisma.category.findFirst({
          where: {
            name: subName,
            type: 'OPERATIONS',
            organizationId: MEGAMEX_ORG_ID,
            parentId: mainCategory.id,
          },
        });

        if (!existingSub) {
          await prisma.category.create({
            data: {
              name: subName,
              type: 'OPERATIONS' as IncidentType,
              organizationId: MEGAMEX_ORG_ID,
              parentId: mainCategory.id,
              isActive: true,
              allowCustomTitle: subName.toLowerCase().includes('other'),
            },
          });
          console.log(`    ✅ Created subcategory: ${subName}`);
        } else {
          console.log(`    ⏭️ Subcategory exists: ${subName}`);
        }
      }
    }

    console.log('\n✅ Operations categories seeding completed!');
  } catch (error) {
    console.error('❌ Error seeding Operations categories:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

seedOperationsCategories();
