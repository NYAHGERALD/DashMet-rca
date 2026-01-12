import { PrismaClient, DropdownType } from '@prisma/client';

const prisma = new PrismaClient();

async function seedPreventiveControlTypes() {
  const orgs = await prisma.organization.findMany({ select: { id: true, name: true } });
  
  const preventiveControlTypes = [
    { value: 'PROCESS', label: 'Process Change', description: 'Changes to workflows, procedures, or standard operating procedures' },
    { value: 'TRAINING', label: 'Training', description: 'Training programs, competency assessments, and skill development' },
    { value: 'EQUIPMENT', label: 'Equipment', description: 'Equipment upgrades, maintenance schedules, and physical safeguards' },
    { value: 'DOCUMENTATION', label: 'Documentation', description: 'Checklists, logs, records, and written procedures' },
    { value: 'MONITORING', label: 'Monitoring', description: 'Inspections, audits, key metrics tracking, and early warning systems' },
  ];
  
  for (const org of orgs) {
    console.log(`\nSeeding PREVENTIVE_CONTROL_TYPE for ${org.name}...`);
    
    for (let i = 0; i < preventiveControlTypes.length; i++) {
      const opt = preventiveControlTypes[i];
      try {
        await prisma.dropdownOption.upsert({
          where: {
            organizationId_optionType_value: {
              organizationId: org.id,
              optionType: DropdownType.PREVENTIVE_CONTROL_TYPE,
              value: opt.value,
            }
          },
          update: { label: opt.label, description: opt.description },
          create: {
            organizationId: org.id,
            optionType: DropdownType.PREVENTIVE_CONTROL_TYPE,
            value: opt.value,
            label: opt.label,
            description: opt.description,
            sortOrder: i,
            isActive: true,
          }
        });
        console.log(`  ✅ ${opt.label}`);
      } catch (e: any) {
        console.log(`  ⚠️ Skipped ${opt.label}: ${e.message}`);
      }
    }
  }
  
  await prisma.$disconnect();
  console.log('\n✅ Done!');
}

seedPreventiveControlTypes();
