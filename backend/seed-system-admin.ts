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
 * - SYSTEM_ADMIN_EMAIL: Email address for the System Admin (must match Firebase account)
 * 
 * The System Admin is a special role that:
 * - Does NOT require an access code
 * - Has access to the Dashmet Control Portal (/dashmet-control)
 * - Cannot be created through normal registration
 * - Requires master key authentication
 */

import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as crypto from 'crypto';

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

  // Check if master key is set
  const masterKey = process.env.SYSTEM_ADMIN_MASTER_KEY;
  if (!masterKey) {
    // Generate a secure master key suggestion
    const suggestedKey = crypto.randomBytes(32).toString('hex');
    console.log('⚠️  SYSTEM_ADMIN_MASTER_KEY not set in environment');
    console.log('\n📝 Add this to your .env file:');
    console.log(`SYSTEM_ADMIN_MASTER_KEY=${suggestedKey}`);
    console.log('\n🔒 IMPORTANT: Keep this key secure and never share it!\n');
  } else {
    console.log('✅ SYSTEM_ADMIN_MASTER_KEY is configured');
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
      // Note: The firebaseUid will be set when they first log in
      console.log(`📝 Creating new System Admin: ${systemAdminEmail}`);
      
      const newAdmin = await prisma.user.create({
        data: {
          email: systemAdminEmail,
          firstName: 'System',
          lastName: 'Administrator',
          role: 'SYSTEM_ADMIN',
          isActive: true,
          // No organizationId - System Admins are platform-level
          // No firebaseUid yet - will be set on first login
        },
      });

      console.log(`✅ System Admin created!`);
      console.log(`   User ID: ${newAdmin.id}`);
      console.log(`   Email: ${newAdmin.email}`);
    }

    console.log('\n============================');
    console.log('📋 Next Steps:');
    console.log('1. Ensure SYSTEM_ADMIN_MASTER_KEY is set in .env');
    console.log(`2. Create a Firebase account with email: ${systemAdminEmail}`);
    console.log('3. Access the portal at: /dashmet-control/login');
    console.log('4. Sign in with Firebase and enter the master key');
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
