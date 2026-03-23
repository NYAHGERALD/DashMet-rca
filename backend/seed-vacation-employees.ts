/**
 * Seed Vacation Employees
 *
 * Run from backend/:
 *   npx ts-node seed-vacation-employees.ts
 *
 * Reads exported bakery employees and inserts them as VacationEmployee records
 * linked to the first user/organization in the system.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Bakery employee data (exported from bakery_metrics_db)
const EMPLOYEES = [
  { firstname: 'Gerald', lastname: 'Chwoung', email: null, role: 'Bakery Lead', department: 'Bakery', shift: 'First Shift', workline: 'Die Cut Line 1', workarea: 'Raw', allocatedVacationHours: 0, annualAllocation: 80, maxAccumulatedHours: 120, vacationScheduleYears: [1,2,3], vacationScheduleHours: [40,80,120] },
  { firstname: 'Myriam', lastname: 'Miranda', email: 'myriammiranda.mm@gmail.com', role: 'Bakery Lead', department: 'Bakery', shift: 'First Shift', workline: 'Die Cut Line 2', workarea: 'Raw', allocatedVacationHours: 0, annualAllocation: 80, maxAccumulatedHours: 120, vacationScheduleYears: [1,2,7], vacationScheduleHours: [40,80,120] },
  { firstname: 'Riak', lastname: 'Chol', email: 'rikochol@yahoo.com', role: 'Bakery Lead', department: 'Bakery', shift: 'Second Shift', workline: 'Die Cut Line 2', workarea: 'Raw', allocatedVacationHours: 0, annualAllocation: 80, maxAccumulatedHours: 120, vacationScheduleYears: [1,2,7], vacationScheduleHours: [40,80,120] },
  { firstname: 'Maria', lastname: 'Castillo', email: null, role: 'Palletizer', department: 'Bakery', shift: 'First Shift', workline: 'Die Cut Line 1', workarea: 'RTE', allocatedVacationHours: 0, annualAllocation: 80, maxAccumulatedHours: 120, vacationScheduleYears: [1,2,7], vacationScheduleHours: [40,80,120] },
  { firstname: 'Maribel', lastname: 'Flores', email: 'maribelflores.mf@gmail.com', role: 'Food Handler', department: 'Bakery', shift: 'First Shift', workline: 'Die Cut Line 2', workarea: 'RTE', allocatedVacationHours: 0, annualAllocation: 80, maxAccumulatedHours: 120, vacationScheduleYears: [1,2,7], vacationScheduleHours: [40,80,120] },
  { firstname: 'Zenaida', lastname: 'Garcia', email: null, role: 'Food Handler', department: 'Bakery', shift: 'First Shift', workline: 'Die Cut Line 2', workarea: 'RAW', allocatedVacationHours: 0, annualAllocation: 80, maxAccumulatedHours: 120, vacationScheduleYears: [1,2,7], vacationScheduleHours: [40,80,120] },
  { firstname: 'Safi', lastname: 'Hasani', email: null, role: 'Food Handler', department: 'Bakery', shift: 'Second Shift', workline: 'Die Cut Line 2', workarea: 'RTE', allocatedVacationHours: 0, annualAllocation: 80, maxAccumulatedHours: 120, vacationScheduleYears: [1,2,7], vacationScheduleHours: [40,80,120] },
  { firstname: 'Wahidullah', lastname: 'Jalalzada', email: null, role: 'Food Handler', department: 'Bakery', shift: 'Second Shift', workline: 'Die Cut Line 1', workarea: 'Raw', allocatedVacationHours: 0, annualAllocation: 80, maxAccumulatedHours: 120, vacationScheduleYears: [1,2,7], vacationScheduleHours: [40,80,120] },
  { firstname: 'Richard', lastname: 'Mims', email: null, role: 'Mixer Operator', department: 'Bakery', shift: 'First Shift', workline: 'Die Cut Line 1', workarea: 'Raw', allocatedVacationHours: 0, annualAllocation: 80, maxAccumulatedHours: 120, vacationScheduleYears: [1,2,7], vacationScheduleHours: [40,80,120] },
  { firstname: 'Irma', lastname: 'Mora', email: null, role: 'Food Handler', department: 'Bakery', shift: 'First Shift', workline: 'Die Cut Line 1', workarea: 'RTE', allocatedVacationHours: 0, annualAllocation: 80, maxAccumulatedHours: 120, vacationScheduleYears: [1,2,7], vacationScheduleHours: [40,80,120] },
  { firstname: 'Carmen', lastname: 'More', email: null, role: 'Food Handler', department: 'Bakery', shift: 'First Shift', workline: 'Die Cut Line 2', workarea: 'Raw', allocatedVacationHours: 0, annualAllocation: 80, maxAccumulatedHours: 120, vacationScheduleYears: [1,2,7], vacationScheduleHours: [40,80,120] },
  { firstname: 'Carlos', lastname: 'Ordonez', email: null, role: 'Machine Operator', department: 'Bakery', shift: 'Second Shift', workline: 'Die Cut Line 2', workarea: 'RTE', allocatedVacationHours: 0, annualAllocation: 80, maxAccumulatedHours: 120, vacationScheduleYears: [1,2,7], vacationScheduleHours: [40,80,120] },
  { firstname: 'Tesfitt', lastname: 'Segid', email: null, role: 'Food Handler', department: 'Bakery', shift: 'Second Shift', workline: 'Die Cut Line 1', workarea: 'RTE', allocatedVacationHours: 0, annualAllocation: 80, maxAccumulatedHours: 120, vacationScheduleYears: [1,2,7], vacationScheduleHours: [40,80,120] },
  { firstname: 'Norma', lastname: 'Torres', email: null, role: 'Food Handler', department: 'Bakery', shift: 'First Shift', workline: 'Die Cut Line 1', workarea: 'Raw', allocatedVacationHours: 0, annualAllocation: 80, maxAccumulatedHours: 120, vacationScheduleYears: [1,2,7], vacationScheduleHours: [40,80,120] },
  { firstname: 'Jose', lastname: 'Trevino', email: null, role: 'Mixer Operator', department: 'Bakery', shift: 'Second Shift', workline: 'Die Cut Line 1', workarea: 'Raw', allocatedVacationHours: 0, annualAllocation: 80, maxAccumulatedHours: 120, vacationScheduleYears: [1,2,7], vacationScheduleHours: [40,80,120] },
  { firstname: 'Maria', lastname: 'Vanegas', email: null, role: 'Machine Operator', department: 'Bakery', shift: 'First Shift', workline: 'Die Cut Line 2', workarea: 'RTE', allocatedVacationHours: 0, annualAllocation: 80, maxAccumulatedHours: 120, vacationScheduleYears: [1,2,7], vacationScheduleHours: [40,80,120] },
  { firstname: 'Osiris', lastname: 'Barriga', email: null, role: 'Sign Out Control', department: 'Bakery', shift: 'First Shift', workline: 'Die Cut Line 1', workarea: 'RTE', allocatedVacationHours: 0, annualAllocation: 80, maxAccumulatedHours: 120, vacationScheduleYears: [1,2,7], vacationScheduleHours: [40,80,120] },
  { firstname: 'Marilyn', lastname: 'Vazquez', email: null, role: 'Sign Out Control', department: 'Bakery', shift: 'Second Shift', workline: 'Die Cut Line 2', workarea: 'Raw', allocatedVacationHours: 0, annualAllocation: 80, maxAccumulatedHours: 120, vacationScheduleYears: [1,2,7], vacationScheduleHours: [40,80,120] },
  { firstname: 'Florence', lastname: 'Arre', email: null, role: 'Food Handler', department: 'Bakery', shift: 'First Shift', workline: 'Die Cut Line 1', workarea: 'Raw', allocatedVacationHours: 0, annualAllocation: 80, maxAccumulatedHours: 120, vacationScheduleYears: [1,2,7], vacationScheduleHours: [40,80,120] },
];

async function main() {
  console.log('🔍 Finding admin user...');
  const user = await prisma.user.findFirst({
    where: { email: 'geraldnyah4@gmail.com' },
    include: { Organization: true },
  });

  if (!user) {
    console.error('❌ No user found with email geraldnyah4@gmail.com');
    process.exit(1);
  }

  console.log(`✅ Found user: ${user.firstName} ${user.lastName} (${user.id})`);
  console.log(`   Organization: ${user.Organization?.name || 'None'} (${user.organizationId})`);

  if (!user.organizationId) {
    console.error('❌ User has no organization!');
    process.exit(1);
  }

  // Check if there are already vacation employees
  const existingCount = await prisma.vacationEmployee.count({
    where: { organizationId: user.organizationId },
  });

  if (existingCount > 0) {
    console.log(`⚠️  Found ${existingCount} existing vacation employees. Skipping seed to avoid duplicates.`);
    console.log('   To re-seed, first delete: DELETE FROM vacation_employees WHERE organization_id = ...');
    return;
  }

  // Seed default vacation settings
  const existingSettings = await prisma.vacationSettings.findFirst({
    where: { organizationId: user.organizationId },
  });

  if (!existingSettings) {
    await prisma.vacationSettings.create({
      data: {
        standardAllocationDays: 25,
        minimumNoticeDays: 14,
        maxConsecutiveDays: 15,
        minTeamCoveragePercent: 60,
        maxSimultaneousAbsences: 3,
        criticalRoleCoverageRequired: true,
        organizationId: user.organizationId,
      },
    });
    console.log('📋 Created default vacation settings');
  }

  // Insert employees
  console.log(`\n📥 Seeding ${EMPLOYEES.length} vacation employees...`);

  for (const emp of EMPLOYEES) {
    // Try to match by email to a real user
    let matchedUserId: string | null = null;
    if (emp.email) {
      const matchedUser = await prisma.user.findUnique({ where: { email: emp.email } });
      if (matchedUser) {
        matchedUserId = matchedUser.id;
        console.log(`   🔗 Linked ${emp.firstname} ${emp.lastname} → User ${matchedUser.email}`);
      }
    }

    // First employee (Gerald Chwoung) links to admin
    if (emp.firstname === 'Gerald' && emp.lastname === 'Chwoung') {
      matchedUserId = user.id;
      console.log(`   🔗 Linked ${emp.firstname} ${emp.lastname} → Admin user ${user.email}`);
    }

    await prisma.vacationEmployee.create({
      data: {
        firstName: emp.firstname,
        lastName: emp.lastname,
        email: emp.email,
        role: emp.role,
        department: emp.department,
        shift: emp.shift,
        workline: emp.workline,
        workarea: emp.workarea,
        allocatedVacationHours: emp.allocatedVacationHours,
        annualAllocation: emp.annualAllocation,
        maxAccumulatedHours: emp.maxAccumulatedHours,
        vacationScheduleYears: emp.vacationScheduleYears,
        vacationScheduleHours: emp.vacationScheduleHours.map(Number),
        userId: matchedUserId,
        organizationId: user.organizationId,
      },
    });

    console.log(`   ✅ ${emp.firstname} ${emp.lastname} (${emp.role})`);
  }

  console.log(`\n🎉 Successfully seeded ${EMPLOYEES.length} vacation employees!`);
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
