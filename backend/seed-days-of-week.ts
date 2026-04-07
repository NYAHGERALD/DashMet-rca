import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEFAULT_DAYS = [
  { dayName: 'Monday', dayOrder: 1, isActive: true },
  { dayName: 'Tuesday', dayOrder: 2, isActive: true },
  { dayName: 'Wednesday', dayOrder: 3, isActive: true },
  { dayName: 'Thursday', dayOrder: 4, isActive: true },
  { dayName: 'Friday', dayOrder: 5, isActive: true },
];

async function main() {
  const organizations = await prisma.organization.findMany({ select: { id: true, name: true } });

  for (const org of organizations) {
    console.log(`\nSeeding days for organization: ${org.name}`);

    for (const day of DEFAULT_DAYS) {
      const existing = await prisma.dayOfWeek.findFirst({
        where: {
          organizationId: org.id,
          facilityId: null,
          departmentId: null,
          dayOrder: day.dayOrder,
        },
      });

      if (!existing) {
        await prisma.dayOfWeek.create({
          data: {
            dayName: day.dayName,
            dayOrder: day.dayOrder,
            isActive: day.isActive,
            organizationId: org.id,
          },
        });
      }
      console.log(`  ✓ ${day.dayName}`);
    }
  }

  console.log('\n✅ Days of week seeded successfully!');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
