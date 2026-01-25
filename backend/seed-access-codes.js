// Phase 1.1: Seed Access Codes for Admin Roles
const { PrismaClient, UserRole } = require('@prisma/client');
const prisma = new PrismaClient();

async function seedAccessCodes() {
  console.log('🔑 Seeding access codes...\n');

  const accessCodes = [
    {
      code: '123456',
      role: UserRole.ADMIN,
      description: 'Admin Access Code'
    },
    {
      code: '789012',
      role: UserRole.SYSTEM_ADMIN,
      description: 'System Admin Access Code'
    },
    {
      code: '345678',
      role: UserRole.ADMIN,
      description: 'Admin Access Code (Alternative)'
    },
    {
      code: '901234',
      role: UserRole.SYSTEM_ADMIN,
      description: 'System Admin Access Code (Alternative)'
    },
    {
      code: '567890',
      role: UserRole.SYSTEM_ADMIN,
      description: 'System Admin Access Code (Secondary)'
    },
    {
      code: '111222',
      role: UserRole.SYSTEM_ADMIN,
      description: 'System Admin Access Code (Tertiary)'
    }
  ];

  for (const accessCode of accessCodes) {
    const existing = await prisma.accessCode.findUnique({
      where: { code: accessCode.code }
    });

    if (existing) {
      console.log(`✓ Access code ${accessCode.code} already exists (${accessCode.role})`);
      continue;
    }

    await prisma.accessCode.create({
      data: {
        code: accessCode.code,
        role: accessCode.role,
      }
    });

    console.log(`✅ Created access code: ${accessCode.code} for ${accessCode.role}`);
  }

  console.log('\n✅ Access codes seeding complete!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('ADMIN codes: 123456, 345678');
  console.log('SYSTEM_ADMIN codes: 789012, 901234, 567890, 111222');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

seedAccessCodes()
  .catch((e) => {
    console.error('❌ Error seeding access codes:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
