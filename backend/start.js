#!/usr/bin/env node
console.log('=== START SCRIPT RUNNING ===');
console.log('Node version:', process.version);
console.log('Current dir:', process.cwd());
console.log('PORT:', process.env.PORT);
console.log('DATABASE_URL exists:', !!process.env.DATABASE_URL);

// Auto-seed System Admin on startup if configured
async function ensureSystemAdmin() {
  const systemAdminEmail = process.env.SYSTEM_ADMIN_EMAIL;
  if (!systemAdminEmail) {
    console.log('⏭️  SYSTEM_ADMIN_EMAIL not configured, skipping auto-seed');
    return;
  }

  try {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    
    // Check if System Admin exists
    const existingAdmin = await prisma.user.findFirst({
      where: { email: systemAdminEmail }
    });

    if (existingAdmin) {
      if (existingAdmin.role === 'SYSTEM_ADMIN') {
        console.log(`✅ System Admin exists: ${systemAdminEmail}`);
      } else {
        // Upgrade to SYSTEM_ADMIN
        await prisma.user.update({
          where: { id: existingAdmin.id },
          data: { role: 'SYSTEM_ADMIN', isActive: true }
        });
        console.log(`⬆️  Upgraded ${systemAdminEmail} to SYSTEM_ADMIN`);
      }
    } else {
      // Create new System Admin
      await prisma.user.create({
        data: {
          email: systemAdminEmail,
          firstName: 'System',
          lastName: 'Administrator',
          role: 'SYSTEM_ADMIN',
          isActive: true,
        }
      });
      console.log(`🔐 Created System Admin: ${systemAdminEmail}`);
    }

    await prisma.$disconnect();
  } catch (error) {
    console.error('⚠️  Failed to auto-seed System Admin:', error.message);
    // Don't crash the server if this fails
  }
}

try {
  console.log('Loading tsx...');
  require('tsx/cjs');
  
  // Run auto-seed before starting server
  ensureSystemAdmin().then(() => {
    console.log('tsx loaded, starting server...');
    require('./src/server.ts');
  });
} catch (error) {
  console.error('=== STARTUP ERROR ===');
  console.error(error);
  process.exit(1);
}
