/**
 * System Admin Seed Script
 * 
 * This script creates or updates the System Administrator account.
 * IMPORTANT: Run this script only on initial setup or to reset the System Admin.
 * 
 * Usage: npx ts-node seed-system-admin.ts
 * 
 * Environment Variables Required:
 * - DATABASE_URL: PostgreSQL connection string
 * - SYSTEM_ADMIN_EMAIL: Email address for the System Admin
 *
 * Optional:
 * - SYSTEM_ADMIN_BOOTSTRAP_PASSWORD: One-time bootstrap password for the admin.
 *   If omitted, use the forgot-password flow to set/recover password securely.
 * 
 * The System Admin is a special role that:
 * - Has access to the Dashmet Control Portal (/dashmet-control)
 * - Cannot be created through normal registration
 */

import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

dotenv.config();

const prisma = new PrismaClient();

async function seedSystemAdmin() {
  console.log('🔐 System Admin Seed Script');
  console.log('============================\n');

  // Get email from environment or use default for development
  const systemAdminEmail = process.env.SYSTEM_ADMIN_EMAIL;
  
  if (!systemAdminEmail) {
    console.error('❌ SYSTEM_ADMIN_EMAIL environment variable is required');
    console.log('\nPlease set SYSTEM_ADMIN_EMAIL in your .env file');
    console.log('Example: SYSTEM_ADMIN_EMAIL=admin@dashmet.com');
    process.exit(1);
  }

  const bootstrapPassword = String(process.env.SYSTEM_ADMIN_BOOTSTRAP_PASSWORD || '').trim();
  if (bootstrapPassword) {
    console.log('✅ SYSTEM_ADMIN_BOOTSTRAP_PASSWORD provided (password will be set/rotated)');
  } else {
    console.log('ℹ️  No bootstrap password provided. You can set/recover password via forgot-password flow.');
  }

  const allowlist = String(process.env.SYSTEM_ADMIN_EMAIL_ALLOWLIST || '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  if (!allowlist.includes(systemAdminEmail.toLowerCase())) {
    console.log('ℹ️  SYSTEM_ADMIN_EMAIL_ALLOWLIST does not explicitly include SYSTEM_ADMIN_EMAIL');
    console.log('   The app still supports SYSTEM_ADMIN_EMAIL as a legacy fallback,');
    console.log('   but add this email to SYSTEM_ADMIN_EMAIL_ALLOWLIST for enterprise posture.');
  } else {
    console.log('✅ SYSTEM_ADMIN_EMAIL is present in SYSTEM_ADMIN_EMAIL_ALLOWLIST');
  }

  try {
    // Check if System Admin already exists
    const existingAdmin = await prisma.user.findFirst({
      where: {
        email: systemAdminEmail,
      },
    });

    if (existingAdmin) {
      if (existingAdmin.role === 'SYSTEM_ADMIN') {
        console.log(`✅ System Admin already exists: ${systemAdminEmail}`);
        console.log(`   User ID: ${existingAdmin.id}`);
        console.log(`   Name: ${existingAdmin.firstName} ${existingAdmin.lastName}`);
        console.log(`   Active: ${existingAdmin.isActive}`);
        
        // Ensure they have the correct role and are active
        if (!existingAdmin.isActive) {
          await prisma.user.update({
            where: { id: existingAdmin.id },
            data: { isActive: true },
          });
          console.log('   ✅ Reactivated user');
        }
      } else {
        // User exists with different role - upgrade to SYSTEM_ADMIN
        console.log(`⚠️  User ${systemAdminEmail} exists with role: ${existingAdmin.role}`);
        console.log('   Upgrading to SYSTEM_ADMIN...');
        
        await prisma.user.update({
          where: { id: existingAdmin.id },
          data: {
            role: 'SYSTEM_ADMIN',
            isActive: true,
          },
        });
        console.log('   ✅ Upgraded to SYSTEM_ADMIN');
      }
    } else {
      // Create new System Admin
      console.log(`📝 Creating new System Admin: ${systemAdminEmail}`);
      
      const newAdmin = await prisma.user.create({
        data: {
          email: systemAdminEmail,
          firstName: 'System',
          lastName: 'Administrator',
          role: 'SYSTEM_ADMIN',
          isActive: true,
          // No organizationId - System Admins are platform-level
        },
      });

      console.log(`✅ System Admin created!`);
      console.log(`   User ID: ${newAdmin.id}`);
      console.log(`   Email: ${newAdmin.email}`);
    }

    if (bootstrapPassword) {
      const hashedPassword = await bcrypt.hash(
        bootstrapPassword,
        parseInt(process.env.BCRYPT_ROUNDS || '12', 10)
      );
      await prisma.user.update({
        where: { email: systemAdminEmail },
        data: {
          password: hashedPassword,
          loginAttempts: 0,
          lockedUntil: null,
        },
      });
      console.log('✅ System Admin password has been bootstrapped/rotated');
    }

    console.log('\n============================');
    console.log('📋 Next Steps:');
    console.log('1. Ensure SYSTEM_ADMIN_EMAIL_ALLOWLIST includes your admin email');
    console.log(`2. Ensure mailbox access for: ${systemAdminEmail}`);
    console.log('3. Access the portal at: /dashmet-control/login');
    console.log('4. Sign in with email/password and complete MFA code verification');
    console.log('5. If password is unknown, use /forgot-password from the admin login page');
    console.log('============================\n');

  } catch (error) {
    console.error('❌ Error seeding System Admin:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the seed
seedSystemAdmin()
  .then(() => {
    console.log('✅ Seed script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Seed script failed:', error);
    process.exit(1);
  });
