import { PolicyType, PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Create organizations
  const org1 = await prisma.organization.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Demo Corporation',
      region: 'USA',
      defaultLanguage: 'ENGLISH',
    },
  });

  console.log(`✅ Created organization: ${org1.name}`);

  // Create a test system admin
  const hashedPassword = await bcrypt.hash('Admin123!@#', 12);
  
  const admin = await prisma.user.upsert({
    where: { email: 'admin@demo.com' },
    update: {},
    create: {
      email: 'admin@demo.com',
      password: hashedPassword,
      firstName: 'System',
      lastName: 'Admin',
      role: 'SYSTEM_ADMIN',
      organizationId: org1.id,
      isActive: true,
      theme: 'DARK',
      language: 'ENGLISH',
    },
  });

  console.log(`✅ Created user: ${admin.email} (${admin.role})`);

  // Create a test admin
  const adminUser = await prisma.user.upsert({
    where: { email: 'facility@demo.com' },
    update: {},
    create: {
      email: 'facility@demo.com',
      password: hashedPassword,
      firstName: 'Facility',
      lastName: 'Manager',
      role: 'ADMIN',
      organizationId: org1.id,
      isActive: true,
      theme: 'DARK',
      language: 'ENGLISH',
    },
  });

  console.log(`✅ Created user: ${adminUser.email} (${adminUser.role})`);

  // Create a test operator
  const operator = await prisma.user.upsert({
    where: { email: 'operator@demo.com' },
    update: {},
    create: {
      email: 'operator@demo.com',
      password: hashedPassword,
      firstName: 'John',
      lastName: 'Operator',
      role: 'OPERATOR',
      organizationId: org1.id,
      isActive: true,
      theme: 'DARK',
      language: 'ENGLISH',
    },
  });

  console.log(`✅ Created user: ${operator.email} (${operator.role})`);

  // Seed policy documents (global) so public policy pages have content
  console.log('');
  console.log('📄 Seeding policy documents...');

  const now = new Date();

  const defaultPolicies: Array<{ type: PolicyType; title: string; content: string }> = [
    {
      type: 'PRIVACY_POLICY',
      title: 'Privacy Policy',
      content: `# Privacy Policy

**Effective Date:** ${now.toISOString().slice(0, 10)}

This Privacy Policy explains how DASHMET RCA ("we", "us", or "our") collects, uses, discloses, and protects information when you access or use our web application and related services (the "Services").

## 1. Information We Collect

### 1.1 Information You Provide
- Account information (e.g., name, email address, role/organization details).
- Content you submit through the Services (e.g., incident reports, attachments, messages, comments).

### 1.2 Information Collected Automatically
- Usage data (e.g., pages viewed, actions taken, timestamps).
- Device and log information (e.g., IP address, browser type, operating system, approximate location derived from IP).

### 1.3 Cookies and Similar Technologies
We use cookies and similar technologies to operate the Services, remember preferences, and understand usage. See our Cookie Policy for details.

## 2. How We Use Information
We use information to:
- Provide, operate, maintain, and improve the Services.
- Authenticate users, enforce access controls, and prevent fraud or abuse.
- Communicate with you about service updates, security notices, and support.
- Comply with legal obligations and protect our rights.

## 3. How We Share Information
We may share information:
- With your organization and authorized users as part of normal Service operation.
- With service providers who process data on our behalf (e.g., hosting, analytics, email delivery) under appropriate safeguards.
- For legal, security, or compliance reasons (e.g., to respond to lawful requests).

We do not sell personal information.

## 4. Data Retention
We retain information for as long as necessary to provide the Services, meet contractual commitments, comply with legal requirements, and resolve disputes. Retention periods may vary by data type and organization configuration.

## 5. Security
We implement administrative, technical, and physical safeguards designed to protect information. No method of transmission or storage is completely secure; therefore, we cannot guarantee absolute security.

## 6. Your Choices and Rights
Depending on your location and applicable law, you may have rights to access, correct, delete, or restrict processing of certain information. Requests can be made through your organization administrator or by contacting us.

## 7. International Transfers
If information is transferred across borders, we take steps designed to ensure appropriate protections are in place consistent with applicable law.

## 8. Changes to This Policy
We may update this policy from time to time. We will update the Effective Date and, where appropriate, provide additional notice.

## 9. Contact Us
If you have questions about this Privacy Policy, contact your organization administrator or reach out to support through the application.
`,
    },
    {
      type: 'TERMS_OF_SERVICE',
      title: 'Terms of Service',
      content: `# Terms of Service

**Effective Date:** ${now.toISOString().slice(0, 10)}

These Terms of Service ("Terms") govern your access to and use of DASHMET RCA (the "Services"). By accessing or using the Services, you agree to these Terms.

## 1. Eligibility and Accounts
- You must be authorized by your organization to use the Services.
- You are responsible for maintaining the confidentiality of your credentials and for all activity under your account.

## 2. Use of the Services
You agree to:
- Use the Services only for lawful business purposes and in accordance with your organization’s policies.
- Provide accurate information and keep it up to date.

You agree not to:
- Attempt to gain unauthorized access to any system or data.
- Upload malware or disrupt the Services.
- Reverse engineer or interfere with the Services except to the extent permitted by law.

## 3. Customer Data and Content
Content submitted to the Services (including incident reports and attachments) is generally controlled by the organization that provides you access (the "Customer"). Your use of the Services is subject to the Customer’s directions and permissions.

## 4. Intellectual Property
We and our licensors retain all right, title, and interest in and to the Services, including all related intellectual property rights. These Terms do not grant you any rights to our trademarks or branding.

## 5. Availability and Changes
We may modify, suspend, or discontinue parts of the Services. We do not guarantee that the Services will be available at all times.

## 6. Third-Party Services
The Services may integrate with third-party services. We are not responsible for third-party services and your use of them may be governed by their terms.

## 7. Disclaimers
THE SERVICES ARE PROVIDED "AS IS" AND "AS AVAILABLE". TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE DISCLAIM ALL WARRANTIES, EXPRESS OR IMPLIED.

## 8. Limitation of Liability
TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE WILL NOT BE LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS OR REVENUES.

## 9. Termination
Access may be suspended or terminated if you violate these Terms or if your organization’s access ends.

## 10. Changes to These Terms
We may update these Terms from time to time. Continued use after changes become effective constitutes acceptance of the updated Terms.

## 11. Contact
Questions about these Terms should be directed to your organization administrator or support through the application.
`,
    },
    {
      type: 'COOKIE_POLICY',
      title: 'Cookie Policy',
      content: `# Cookie Policy

**Effective Date:** ${now.toISOString().slice(0, 10)}

This Cookie Policy explains how DASHMET RCA uses cookies and similar technologies.

## 1. What Are Cookies?
Cookies are small text files stored on your device when you visit a website. Similar technologies include local storage, pixels, and other identifiers.

## 2. Types of Cookies We Use
- **Strictly Necessary:** Required for the Services to function (e.g., session management, security).
- **Preferences:** Remember settings such as theme and language.
- **Analytics/Performance:** Help us understand usage and improve performance.

## 3. How We Use Cookies
We use cookies to:
- Keep you signed in and secure the Services.
- Store preferences.
- Monitor reliability and performance.

## 4. Managing Cookies
You can control cookies through your browser settings. Blocking some cookies may impact functionality and your ability to access certain features.

## 5. Changes to This Cookie Policy
We may update this policy periodically. We will update the Effective Date when changes are made.
`,
    },
    {
      type: 'SECURITY',
      title: 'Security',
      content: `# Security

**Effective Date:** ${now.toISOString().slice(0, 10)}

We take security seriously and maintain safeguards designed to protect the confidentiality, integrity, and availability of the Services.

## 1. Access Controls
- Role-based access controls restrict access to authorized users.
- Administrative controls are available to Customer administrators.

## 2. Authentication
We support secure authentication mechanisms, including token-based authentication where applicable. Users are responsible for using strong passwords and protecting their credentials.

## 3. Data Protection
We use protections designed to secure data in transit and at rest where appropriate. Security controls may include encryption, network protections, monitoring, and auditing.

## 4. Incident Response
We maintain procedures designed to detect, respond to, and recover from security incidents. If a security issue is confirmed, we take steps designed to mitigate impact.

## 5. Your Responsibilities
You and your organization are responsible for:
- Managing user access appropriately.
- Keeping devices and browsers up to date.
- Reporting suspected security issues promptly.

## 6. Reporting Security Issues
If you believe you have found a security vulnerability, please contact support through the application with details and reproduction steps.
`,
    },
  ];

  for (const policy of defaultPolicies) {
    const existing = await prisma.policyDocument.findUnique({ where: { type: policy.type } });

    const existingHasContent = Boolean(existing?.content && existing.content.trim().length > 0);
    if (existingHasContent) {
      continue;
    }

    const nextVersion = (existing?.version ?? 0) + 1;

    const saved = await prisma.policyDocument.upsert({
      where: { type: policy.type },
      update: {
        title: policy.title,
        content: policy.content,
        version: nextVersion,
        isPublished: true,
        publishedAt: existing?.publishedAt ?? now,
        updatedByUserId: admin.id,
      },
      create: {
        type: policy.type,
        title: policy.title,
        content: policy.content,
        version: 1,
        isPublished: true,
        publishedAt: now,
        updatedByUserId: admin.id,
      },
    });

    await prisma.policyRevision.create({
      data: {
        policyId: saved.id,
        version: saved.version,
        title: saved.title,
        content: saved.content,
        createdByUserId: admin.id,
      },
    });
  }

  console.log('✅ Seeded policy documents');

  // Create test facilities
  const facility1 = await prisma.facility.upsert({
    where: { id: '00000000-0000-0000-0000-000000000010' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000010',
      name: 'Main Production Plant',
      organizationId: org1.id,
      timezone: 'America/New_York',
      address: '123 Manufacturing St, Detroit, MI 48201',
    },
  });

  console.log(`✅ Created facility: ${facility1.name}`);

  const facility2 = await prisma.facility.upsert({
    where: { id: '00000000-0000-0000-0000-000000000011' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000011',
      name: 'West Coast Distribution Center',
      organizationId: org1.id,
      timezone: 'America/Los_Angeles',
      address: '456 Logistics Blvd, Los Angeles, CA 90001',
    },
  });

  console.log(`✅ Created facility: ${facility2.name}`);

  // Create test areas
  const area1 = await prisma.area.upsert({
    where: { id: '00000000-0000-0000-0000-000000000020' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000020',
      name: 'Packaging Area',
      facilityId: facility1.id,
    },
  });

  console.log(`✅ Created area: ${area1.name}`);

  const area2 = await prisma.area.upsert({
    where: { id: '00000000-0000-0000-0000-000000000021' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000021',
      name: 'Assembly Line',
      facilityId: facility1.id,
    },
  });

  console.log(`✅ Created area: ${area2.name}`);

  // Create test lines
  const line1 = await prisma.line.upsert({
    where: { id: '00000000-0000-0000-0000-000000000030' },
    update: { lineNumber: 'L1' },
    create: {
      id: '00000000-0000-0000-0000-000000000030',
      name: 'Line 1',
      lineNumber: 'L1',
      areaId: area1.id,
    },
  });

  console.log(`✅ Created line: ${line1.name}`);

  const line2 = await prisma.line.upsert({
    where: { id: '00000000-0000-0000-0000-000000000031' },
    update: { lineNumber: 'L2' },
    create: {
      id: '00000000-0000-0000-0000-000000000031',
      name: 'Line 2',
      lineNumber: 'L2',
      areaId: area1.id,
    },
  });

  console.log(`✅ Created line: ${line2.name}`);

  // Create test shifts
  const shift1 = await prisma.shift.upsert({
    where: { id: '00000000-0000-0000-0000-000000000040' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000040',
      name: 'Day Shift',
      facilityId: facility1.id,
      startTime: '06:00',
      endTime: '14:00',
    },
  });

  console.log(`✅ Created shift: ${shift1.name}`);

  const shift2 = await prisma.shift.upsert({
    where: { id: '00000000-0000-0000-0000-000000000041' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000041',
      name: 'Night Shift',
      facilityId: facility1.id,
      startTime: '22:00',
      endTime: '06:00',
    },
  });

  console.log(`✅ Created shift: ${shift2.name}`);

  // Create Food Safety Categories (Phase 2.3)
  console.log('');
  console.log('📂 Creating categories...');

  // Food Safety Main Categories
  const foreignMaterial = await prisma.category.upsert({
    where: { id: '00000000-0000-0000-0000-000000000100' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000100',
      name: 'Foreign Material',
      type: 'FOOD_SAFETY',
      organizationId: org1.id,
      sortOrder: 1,
    },
  });

  // Foreign Material Subcategories
  await prisma.category.upsert({
    where: { id: '00000000-0000-0000-0000-000000000101' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000101',
      name: 'Metal',
      type: 'FOOD_SAFETY',
      organizationId: org1.id,
      parentId: foreignMaterial.id,
      sortOrder: 1,
    },
  });

  await prisma.category.upsert({
    where: { id: '00000000-0000-0000-0000-000000000102' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000102',
      name: 'Plastic',
      type: 'FOOD_SAFETY',
      organizationId: org1.id,
      parentId: foreignMaterial.id,
      sortOrder: 2,
    },
  });

  await prisma.category.upsert({
    where: { id: '00000000-0000-0000-0000-000000000103' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000103',
      name: 'Glass',
      type: 'FOOD_SAFETY',
      organizationId: org1.id,
      parentId: foreignMaterial.id,
      sortOrder: 3,
    },
  });

  await prisma.category.upsert({
    where: { id: '00000000-0000-0000-0000-000000000104' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000104',
      name: 'Wood',
      type: 'FOOD_SAFETY',
      organizationId: org1.id,
      parentId: foreignMaterial.id,
      sortOrder: 4,
    },
  });

  await prisma.category.upsert({
    where: { id: '00000000-0000-0000-0000-000000000105' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000105',
      name: 'Other',
      type: 'FOOD_SAFETY',
      organizationId: org1.id,
      parentId: foreignMaterial.id,
      allowCustomTitle: true,
      sortOrder: 5,
    },
  });

  console.log(`✅ Created category: ${foreignMaterial.name} (with 5 subcategories)`);

  // Other Food Safety Main Categories
  const microCategory = await prisma.category.upsert({
    where: { id: '00000000-0000-0000-0000-000000000110' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000110',
      name: 'Micro',
      type: 'FOOD_SAFETY',
      organizationId: org1.id,
      sortOrder: 2,
    },
  });
  console.log(`✅ Created category: ${microCategory.name}`);

  const allergenCategory = await prisma.category.upsert({
    where: { id: '00000000-0000-0000-0000-000000000111' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000111',
      name: 'Allergen',
      type: 'FOOD_SAFETY',
      organizationId: org1.id,
      sortOrder: 3,
    },
  });
  console.log(`✅ Created category: ${allergenCategory.name}`);

  const labelingCategory = await prisma.category.upsert({
    where: { id: '00000000-0000-0000-0000-000000000112' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000112',
      name: 'Labeling',
      type: 'FOOD_SAFETY',
      organizationId: org1.id,
      sortOrder: 4,
    },
  });
  console.log(`✅ Created category: ${labelingCategory.name}`);

  const temperatureCategory = await prisma.category.upsert({
    where: { id: '00000000-0000-0000-0000-000000000113' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000113',
      name: 'Temperature',
      type: 'FOOD_SAFETY',
      organizationId: org1.id,
      sortOrder: 5,
    },
  });
  console.log(`✅ Created category: ${temperatureCategory.name}`);

  const sanitationCategory = await prisma.category.upsert({
    where: { id: '00000000-0000-0000-0000-000000000114' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000114',
      name: 'Sanitation',
      type: 'FOOD_SAFETY',
      organizationId: org1.id,
      sortOrder: 6,
    },
  });
  console.log(`✅ Created category: ${sanitationCategory.name}`);

  const supplierCategory = await prisma.category.upsert({
    where: { id: '00000000-0000-0000-0000-000000000115' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000115',
      name: 'Supplier',
      type: 'FOOD_SAFETY',
      organizationId: org1.id,
      sortOrder: 7,
    },
  });
  console.log(`✅ Created category: ${supplierCategory.name}`);

  const packagingCategory = await prisma.category.upsert({
    where: { id: '00000000-0000-0000-0000-000000000116' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000116',
      name: 'Packaging',
      type: 'FOOD_SAFETY',
      organizationId: org1.id,
      sortOrder: 8,
    },
  });
  console.log(`✅ Created category: ${packagingCategory.name}`);

  // Machine & Equipment Main Categories
  const mechanicalCategory = await prisma.category.upsert({
    where: { id: '00000000-0000-0000-0000-000000000200' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000200',
      name: 'Mechanical',
      type: 'MACHINE_EQUIPMENT',
      organizationId: org1.id,
      sortOrder: 1,
    },
  });
  console.log(`✅ Created category: ${mechanicalCategory.name} (Machine)`);

  const electricalCategory = await prisma.category.upsert({
    where: { id: '00000000-0000-0000-0000-000000000201' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000201',
      name: 'Electrical',
      type: 'MACHINE_EQUIPMENT',
      organizationId: org1.id,
      sortOrder: 2,
    },
  });
  console.log(`✅ Created category: ${electricalCategory.name} (Machine)`);

  const controlsCategory = await prisma.category.upsert({
    where: { id: '00000000-0000-0000-0000-000000000202' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000202',
      name: 'Controls',
      type: 'MACHINE_EQUIPMENT',
      organizationId: org1.id,
      sortOrder: 3,
    },
  });
  console.log(`✅ Created category: ${controlsCategory.name} (Machine)`);

  const pneumaticsCategory = await prisma.category.upsert({
    where: { id: '00000000-0000-0000-0000-000000000203' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000203',
      name: 'Pneumatics',
      type: 'MACHINE_EQUIPMENT',
      organizationId: org1.id,
      sortOrder: 4,
    },
  });
  console.log(`✅ Created category: ${pneumaticsCategory.name} (Machine)`);

  const sensorsCategory = await prisma.category.upsert({
    where: { id: '00000000-0000-0000-0000-000000000204' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000204',
      name: 'Sensors',
      type: 'MACHINE_EQUIPMENT',
      organizationId: org1.id,
      sortOrder: 5,
    },
  });
  console.log(`✅ Created category: ${sensorsCategory.name} (Machine)`);

  const lubricationCategory = await prisma.category.upsert({
    where: { id: '00000000-0000-0000-0000-000000000205' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000205',
      name: 'Lubrication',
      type: 'MACHINE_EQUIPMENT',
      organizationId: org1.id,
      sortOrder: 6,
    },
  });
  console.log(`✅ Created category: ${lubricationCategory.name} (Machine)`);

  const calibrationCategory = await prisma.category.upsert({
    where: { id: '00000000-0000-0000-0000-000000000206' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000206',
      name: 'Calibration',
      type: 'MACHINE_EQUIPMENT',
      organizationId: org1.id,
      sortOrder: 7,
    },
  });
  console.log(`✅ Created category: ${calibrationCategory.name} (Machine)`);

  const changeoverCategory = await prisma.category.upsert({
    where: { id: '00000000-0000-0000-0000-000000000207' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000207',
      name: 'Changeover',
      type: 'MACHINE_EQUIPMENT',
      organizationId: org1.id,
      sortOrder: 8,
    },
  });
  console.log(`✅ Created category: ${changeoverCategory.name} (Machine)`);

  // =====================================================
  // WORKPLACE SAFETY CATEGORIES
  // =====================================================
  console.log('');
  console.log('🦺 Creating Workplace Safety categories...');

  // 1. Physical Injury Hazards
  const physicalInjuryCategory = await prisma.category.upsert({
    where: { id: '00000000-0000-0000-0000-000000000300' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000300',
      name: 'Physical Injury Hazards',
      type: 'WORKPLACE_SAFETY',
      organizationId: org1.id,
      sortOrder: 1,
    },
  });

  const physicalInjurySubcategories = [
    { id: '00000000-0000-0000-0000-000000000301', name: 'Slips, Trips & Falls', sortOrder: 1 },
    { id: '00000000-0000-0000-0000-000000000302', name: 'Cuts, Lacerations & Abrasions', sortOrder: 2 },
    { id: '00000000-0000-0000-0000-000000000303', name: 'Punctures', sortOrder: 3 },
    { id: '00000000-0000-0000-0000-000000000304', name: 'Bruises / Contusions', sortOrder: 4 },
    { id: '00000000-0000-0000-0000-000000000305', name: 'Struck-By Objects', sortOrder: 5 },
    { id: '00000000-0000-0000-0000-000000000306', name: 'Caught-In / Caught-Between', sortOrder: 6 },
    { id: '00000000-0000-0000-0000-000000000307', name: 'Pinch Points', sortOrder: 7 },
    { id: '00000000-0000-0000-0000-000000000308', name: 'Falling Objects', sortOrder: 8 },
    { id: '00000000-0000-0000-0000-000000000309', name: 'Head Injuries', sortOrder: 9 },
    { id: '00000000-0000-0000-0000-00000000030A', name: 'Eye Injuries', sortOrder: 10 },
    { id: '00000000-0000-0000-0000-00000000030B', name: 'Hand & Finger Injuries', sortOrder: 11 },
    { id: '00000000-0000-0000-0000-00000000030C', name: 'Foot & Ankle Injuries', sortOrder: 12 },
  ];

  for (const sub of physicalInjurySubcategories) {
    await prisma.category.upsert({
      where: { id: sub.id },
      update: {},
      create: {
        id: sub.id,
        name: sub.name,
        type: 'WORKPLACE_SAFETY',
        organizationId: org1.id,
        parentId: physicalInjuryCategory.id,
        sortOrder: sub.sortOrder,
      },
    });
  }
  console.log(`✅ Created category: ${physicalInjuryCategory.name} (with ${physicalInjurySubcategories.length} subcategories)`);

  // 2. Ergonomic & Musculoskeletal Safety
  const ergonomicCategory = await prisma.category.upsert({
    where: { id: '00000000-0000-0000-0000-000000000310' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000310',
      name: 'Ergonomic & Musculoskeletal Safety',
      type: 'WORKPLACE_SAFETY',
      organizationId: org1.id,
      sortOrder: 2,
    },
  });

  const ergonomicSubcategories = [
    { id: '00000000-0000-0000-0000-000000000311', name: 'Manual Material Handling', sortOrder: 1 },
    { id: '00000000-0000-0000-0000-000000000312', name: 'Overexertion', sortOrder: 2 },
    { id: '00000000-0000-0000-0000-000000000313', name: 'Repetitive Motion', sortOrder: 3 },
    { id: '00000000-0000-0000-0000-000000000314', name: 'Awkward Postures', sortOrder: 4 },
    { id: '00000000-0000-0000-0000-000000000315', name: 'Forceful Exertions', sortOrder: 5 },
    { id: '00000000-0000-0000-0000-000000000316', name: 'Push / Pull Hazards', sortOrder: 6 },
    { id: '00000000-0000-0000-0000-000000000317', name: 'Lifting & Carrying', sortOrder: 7 },
    { id: '00000000-0000-0000-0000-000000000318', name: 'Cumulative Trauma Disorders (CTD)', sortOrder: 8 },
  ];

  for (const sub of ergonomicSubcategories) {
    await prisma.category.upsert({
      where: { id: sub.id },
      update: {},
      create: {
        id: sub.id,
        name: sub.name,
        type: 'WORKPLACE_SAFETY',
        organizationId: org1.id,
        parentId: ergonomicCategory.id,
        sortOrder: sub.sortOrder,
      },
    });
  }
  console.log(`✅ Created category: ${ergonomicCategory.name} (with ${ergonomicSubcategories.length} subcategories)`);

  // 3. Machine & Equipment Safety (Workplace Safety version)
  const machineEquipSafetyCategory = await prisma.category.upsert({
    where: { id: '00000000-0000-0000-0000-000000000320' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000320',
      name: 'Machine & Equipment Safety',
      type: 'WORKPLACE_SAFETY',
      organizationId: org1.id,
      sortOrder: 3,
    },
  });

  const machineEquipSafetySubcategories = [
    { id: '00000000-0000-0000-0000-000000000321', name: 'Machine Guarding', sortOrder: 1 },
    { id: '00000000-0000-0000-0000-000000000322', name: 'Lockout / Tagout (LOTO)', sortOrder: 2 },
    { id: '00000000-0000-0000-0000-000000000323', name: 'Mechanical Hazards', sortOrder: 3 },
    { id: '00000000-0000-0000-0000-000000000324', name: 'Electrical Hazards', sortOrder: 4 },
    { id: '00000000-0000-0000-0000-000000000325', name: 'Pneumatic / Hydraulic Hazards', sortOrder: 5 },
    { id: '00000000-0000-0000-0000-000000000326', name: 'Sensors & Interlocks', sortOrder: 6 },
    { id: '00000000-0000-0000-0000-000000000327', name: 'Emergency Stops', sortOrder: 7 },
    { id: '00000000-0000-0000-0000-000000000328', name: 'Unexpected Startup', sortOrder: 8 },
    { id: '00000000-0000-0000-0000-000000000329', name: 'Unsafe Changeovers', sortOrder: 9 },
    { id: '00000000-0000-0000-0000-00000000032A', name: 'Maintenance Safety', sortOrder: 10 },
  ];

  for (const sub of machineEquipSafetySubcategories) {
    await prisma.category.upsert({
      where: { id: sub.id },
      update: {},
      create: {
        id: sub.id,
        name: sub.name,
        type: 'WORKPLACE_SAFETY',
        organizationId: org1.id,
        parentId: machineEquipSafetyCategory.id,
        sortOrder: sub.sortOrder,
      },
    });
  }
  console.log(`✅ Created category: ${machineEquipSafetyCategory.name} (with ${machineEquipSafetySubcategories.length} subcategories)`);

  // 4. Chemical & Hazardous Materials Safety
  const chemicalSafetyCategory = await prisma.category.upsert({
    where: { id: '00000000-0000-0000-0000-000000000330' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000330',
      name: 'Chemical & Hazardous Materials Safety',
      type: 'WORKPLACE_SAFETY',
      organizationId: org1.id,
      sortOrder: 4,
    },
  });

  const chemicalSafetySubcategories = [
    { id: '00000000-0000-0000-0000-000000000331', name: 'Chemical Exposure', sortOrder: 1 },
    { id: '00000000-0000-0000-0000-000000000332', name: 'Ammonia Exposure', sortOrder: 2 },
    { id: '00000000-0000-0000-0000-000000000333', name: 'Cleaning & Sanitation Chemicals', sortOrder: 3 },
    { id: '00000000-0000-0000-0000-000000000334', name: 'SDS / GHS Labeling', sortOrder: 4 },
    { id: '00000000-0000-0000-0000-000000000335', name: 'Chemical Storage', sortOrder: 5 },
    { id: '00000000-0000-0000-0000-000000000336', name: 'Chemical Spills', sortOrder: 6 },
    { id: '00000000-0000-0000-0000-000000000337', name: 'Incompatible Chemical Mixing', sortOrder: 7 },
    { id: '00000000-0000-0000-0000-000000000338', name: 'Compressed Gases', sortOrder: 8 },
    { id: '00000000-0000-0000-0000-000000000339', name: 'Chemical PPE', sortOrder: 9 },
  ];

  for (const sub of chemicalSafetySubcategories) {
    await prisma.category.upsert({
      where: { id: sub.id },
      update: {},
      create: {
        id: sub.id,
        name: sub.name,
        type: 'WORKPLACE_SAFETY',
        organizationId: org1.id,
        parentId: chemicalSafetyCategory.id,
        sortOrder: sub.sortOrder,
      },
    });
  }
  console.log(`✅ Created category: ${chemicalSafetyCategory.name} (with ${chemicalSafetySubcategories.length} subcategories)`);

  // 5. Environmental & Exposure Hazards
  const environmentalCategory = await prisma.category.upsert({
    where: { id: '00000000-0000-0000-0000-000000000340' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000340',
      name: 'Environmental & Exposure Hazards',
      type: 'WORKPLACE_SAFETY',
      organizationId: org1.id,
      sortOrder: 5,
    },
  });

  const environmentalSubcategories = [
    { id: '00000000-0000-0000-0000-000000000341', name: 'Heat Stress', sortOrder: 1 },
    { id: '00000000-0000-0000-0000-000000000342', name: 'Cold Stress', sortOrder: 2 },
    { id: '00000000-0000-0000-0000-000000000343', name: 'Noise Exposure (Hearing Conservation)', sortOrder: 3 },
    { id: '00000000-0000-0000-0000-000000000344', name: 'Air Quality / Ventilation', sortOrder: 4 },
    { id: '00000000-0000-0000-0000-000000000345', name: 'Dust Exposure', sortOrder: 5 },
    { id: '00000000-0000-0000-0000-000000000346', name: 'Fumes & Vapors', sortOrder: 6 },
    { id: '00000000-0000-0000-0000-000000000347', name: 'Lighting Deficiencies', sortOrder: 7 },
    { id: '00000000-0000-0000-0000-000000000348', name: 'Radiation (where applicable)', sortOrder: 8 },
  ];

  for (const sub of environmentalSubcategories) {
    await prisma.category.upsert({
      where: { id: sub.id },
      update: {},
      create: {
        id: sub.id,
        name: sub.name,
        type: 'WORKPLACE_SAFETY',
        organizationId: org1.id,
        parentId: environmentalCategory.id,
        sortOrder: sub.sortOrder,
      },
    });
  }
  console.log(`✅ Created category: ${environmentalCategory.name} (with ${environmentalSubcategories.length} subcategories)`);

  // 6. Fire & Emergency Safety
  const fireEmergencyCategory = await prisma.category.upsert({
    where: { id: '00000000-0000-0000-0000-000000000350' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000350',
      name: 'Fire & Emergency Safety',
      type: 'WORKPLACE_SAFETY',
      organizationId: org1.id,
      sortOrder: 6,
    },
  });

  const fireEmergencySubcategories = [
    { id: '00000000-0000-0000-0000-000000000351', name: 'Fire Hazards', sortOrder: 1 },
    { id: '00000000-0000-0000-0000-000000000352', name: 'Flammable Materials', sortOrder: 2 },
    { id: '00000000-0000-0000-0000-000000000353', name: 'Emergency Evacuation', sortOrder: 3 },
    { id: '00000000-0000-0000-0000-000000000354', name: 'Alarm Systems', sortOrder: 4 },
    { id: '00000000-0000-0000-0000-000000000355', name: 'Emergency Exits & Egress', sortOrder: 5 },
    { id: '00000000-0000-0000-0000-000000000356', name: 'Fire Suppression Systems', sortOrder: 6 },
    { id: '00000000-0000-0000-0000-000000000357', name: 'Emergency Drills', sortOrder: 7 },
    { id: '00000000-0000-0000-0000-000000000358', name: 'First Aid & AED', sortOrder: 8 },
    { id: '00000000-0000-0000-0000-000000000359', name: 'Emergency Response Procedures', sortOrder: 9 },
  ];

  for (const sub of fireEmergencySubcategories) {
    await prisma.category.upsert({
      where: { id: sub.id },
      update: {},
      create: {
        id: sub.id,
        name: sub.name,
        type: 'WORKPLACE_SAFETY',
        organizationId: org1.id,
        parentId: fireEmergencyCategory.id,
        sortOrder: sub.sortOrder,
      },
    });
  }
  console.log(`✅ Created category: ${fireEmergencyCategory.name} (with ${fireEmergencySubcategories.length} subcategories)`);

  // 7. Material Handling & Traffic Safety
  const materialHandlingCategory = await prisma.category.upsert({
    where: { id: '00000000-0000-0000-0000-000000000360' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000360',
      name: 'Material Handling & Traffic Safety',
      type: 'WORKPLACE_SAFETY',
      organizationId: org1.id,
      sortOrder: 7,
    },
  });

  const materialHandlingSubcategories = [
    { id: '00000000-0000-0000-0000-000000000361', name: 'Forklift Safety', sortOrder: 1 },
    { id: '00000000-0000-0000-0000-000000000362', name: 'Pallet Jack Safety', sortOrder: 2 },
    { id: '00000000-0000-0000-0000-000000000363', name: 'Dock Safety', sortOrder: 3 },
    { id: '00000000-0000-0000-0000-000000000364', name: 'Trailer Safety', sortOrder: 4 },
    { id: '00000000-0000-0000-0000-000000000365', name: 'Load Securing', sortOrder: 5 },
    { id: '00000000-0000-0000-0000-000000000366', name: 'Pedestrian vs Vehicle Traffic', sortOrder: 6 },
    { id: '00000000-0000-0000-0000-000000000367', name: 'Racking & Storage Safety', sortOrder: 7 },
  ];

  for (const sub of materialHandlingSubcategories) {
    await prisma.category.upsert({
      where: { id: sub.id },
      update: {},
      create: {
        id: sub.id,
        name: sub.name,
        type: 'WORKPLACE_SAFETY',
        organizationId: org1.id,
        parentId: materialHandlingCategory.id,
        sortOrder: sub.sortOrder,
      },
    });
  }
  console.log(`✅ Created category: ${materialHandlingCategory.name} (with ${materialHandlingSubcategories.length} subcategories)`);

  // 8. Personal Protective Equipment (PPE)
  const ppeCategory = await prisma.category.upsert({
    where: { id: '00000000-0000-0000-0000-000000000370' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000370',
      name: 'Personal Protective Equipment (PPE)',
      type: 'WORKPLACE_SAFETY',
      organizationId: org1.id,
      sortOrder: 8,
    },
  });

  const ppeSubcategories = [
    { id: '00000000-0000-0000-0000-000000000371', name: 'Head Protection', sortOrder: 1 },
    { id: '00000000-0000-0000-0000-000000000372', name: 'Eye & Face Protection', sortOrder: 2 },
    { id: '00000000-0000-0000-0000-000000000373', name: 'Hand Protection', sortOrder: 3 },
    { id: '00000000-0000-0000-0000-000000000374', name: 'Foot Protection', sortOrder: 4 },
    { id: '00000000-0000-0000-0000-000000000375', name: 'Hearing Protection', sortOrder: 5 },
    { id: '00000000-0000-0000-0000-000000000376', name: 'Respiratory Protection', sortOrder: 6 },
    { id: '00000000-0000-0000-0000-000000000377', name: 'Chemical-Resistant PPE', sortOrder: 7 },
    { id: '00000000-0000-0000-0000-000000000378', name: 'High-Visibility PPE', sortOrder: 8 },
  ];

  for (const sub of ppeSubcategories) {
    await prisma.category.upsert({
      where: { id: sub.id },
      update: {},
      create: {
        id: sub.id,
        name: sub.name,
        type: 'WORKPLACE_SAFETY',
        organizationId: org1.id,
        parentId: ppeCategory.id,
        sortOrder: sub.sortOrder,
      },
    });
  }
  console.log(`✅ Created category: ${ppeCategory.name} (with ${ppeSubcategories.length} subcategories)`);

  // 9. Facility & Infrastructure Safety
  const facilityInfraCategory = await prisma.category.upsert({
    where: { id: '00000000-0000-0000-0000-000000000380' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000380',
      name: 'Facility & Infrastructure Safety',
      type: 'WORKPLACE_SAFETY',
      organizationId: org1.id,
      sortOrder: 9,
    },
  });

  const facilityInfraSubcategories = [
    { id: '00000000-0000-0000-0000-000000000381', name: 'Floors & Walkways', sortOrder: 1 },
    { id: '00000000-0000-0000-0000-000000000382', name: 'Stairs & Handrails', sortOrder: 2 },
    { id: '00000000-0000-0000-0000-000000000383', name: 'Platforms & Mezzanines', sortOrder: 3 },
    { id: '00000000-0000-0000-0000-000000000384', name: 'Doors & Dock Plates', sortOrder: 4 },
    { id: '00000000-0000-0000-0000-000000000385', name: 'Roof Leaks / Condensation (Slip Risk)', sortOrder: 5 },
    { id: '00000000-0000-0000-0000-000000000386', name: 'Housekeeping', sortOrder: 6 },
    { id: '00000000-0000-0000-0000-000000000387', name: 'Structural Integrity', sortOrder: 7 },
  ];

  for (const sub of facilityInfraSubcategories) {
    await prisma.category.upsert({
      where: { id: sub.id },
      update: {},
      create: {
        id: sub.id,
        name: sub.name,
        type: 'WORKPLACE_SAFETY',
        organizationId: org1.id,
        parentId: facilityInfraCategory.id,
        sortOrder: sub.sortOrder,
      },
    });
  }
  console.log(`✅ Created category: ${facilityInfraCategory.name} (with ${facilityInfraSubcategories.length} subcategories)`);

  // 10. Behavioral, Training & Compliance Safety
  const behavioralCategory = await prisma.category.upsert({
    where: { id: '00000000-0000-0000-0000-000000000390' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000390',
      name: 'Behavioral, Training & Compliance Safety',
      type: 'WORKPLACE_SAFETY',
      organizationId: org1.id,
      sortOrder: 10,
    },
  });

  const behavioralSubcategories = [
    { id: '00000000-0000-0000-0000-000000000391', name: 'Unsafe Acts', sortOrder: 1 },
    { id: '00000000-0000-0000-0000-000000000392', name: 'SOP Non-Compliance', sortOrder: 2 },
    { id: '00000000-0000-0000-0000-000000000393', name: 'Lack of Training', sortOrder: 3 },
    { id: '00000000-0000-0000-0000-000000000394', name: 'Failure to Use PPE', sortOrder: 4 },
    { id: '00000000-0000-0000-0000-000000000395', name: 'Near Misses', sortOrder: 5 },
    { id: '00000000-0000-0000-0000-000000000396', name: 'Incident Reporting', sortOrder: 6 },
    { id: '00000000-0000-0000-0000-000000000397', name: 'Contractor Safety', sortOrder: 7 },
    { id: '00000000-0000-0000-0000-000000000398', name: 'Visitor Safety', sortOrder: 8 },
    { id: '00000000-0000-0000-0000-000000000399', name: 'Work Rule Violations', sortOrder: 9 },
  ];

  for (const sub of behavioralSubcategories) {
    await prisma.category.upsert({
      where: { id: sub.id },
      update: {},
      create: {
        id: sub.id,
        name: sub.name,
        type: 'WORKPLACE_SAFETY',
        organizationId: org1.id,
        parentId: behavioralCategory.id,
        sortOrder: sub.sortOrder,
      },
    });
  }
  console.log(`✅ Created category: ${behavioralCategory.name} (with ${behavioralSubcategories.length} subcategories)`);

  // 11. Health & Medical Management
  const healthMedicalCategory = await prisma.category.upsert({
    where: { id: '00000000-0000-0000-0000-0000000003A0' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-0000000003A0',
      name: 'Health & Medical Management',
      type: 'WORKPLACE_SAFETY',
      organizationId: org1.id,
      sortOrder: 11,
    },
  });

  const healthMedicalSubcategories = [
    { id: '00000000-0000-0000-0000-0000000003A1', name: 'First Aid', sortOrder: 1 },
    { id: '00000000-0000-0000-0000-0000000003A2', name: 'OSHA Recordable Injuries', sortOrder: 2 },
    { id: '00000000-0000-0000-0000-0000000003A3', name: 'Restricted Duty', sortOrder: 3 },
    { id: '00000000-0000-0000-0000-0000000003A4', name: 'Lost Time Injuries', sortOrder: 4 },
    { id: '00000000-0000-0000-0000-0000000003A5', name: 'Occupational Illness', sortOrder: 5 },
    { id: '00000000-0000-0000-0000-0000000003A6', name: 'Return-to-Work', sortOrder: 6 },
    { id: '00000000-0000-0000-0000-0000000003A7', name: 'Fatigue Management', sortOrder: 7 },
  ];

  for (const sub of healthMedicalSubcategories) {
    await prisma.category.upsert({
      where: { id: sub.id },
      update: {},
      create: {
        id: sub.id,
        name: sub.name,
        type: 'WORKPLACE_SAFETY',
        organizationId: org1.id,
        parentId: healthMedicalCategory.id,
        sortOrder: sub.sortOrder,
      },
    });
  }
  console.log(`✅ Created category: ${healthMedicalCategory.name} (with ${healthMedicalSubcategories.length} subcategories)`);

  console.log('');
  console.log('🎉 Seed completed successfully!');
  console.log('');
  console.log('📋 Test Accounts:');
  console.log('==================');
  console.log('System Admin:');
  console.log('  Email: admin@demo.com');
  console.log('  Password: Admin123!@#');
  console.log('');
  console.log('Facility Admin:');
  console.log('  Email: facility@demo.com');
  console.log('  Password: Admin123!@#');
  console.log('');
  console.log('Operator:');
  console.log('  Email: operator@demo.com');
  console.log('  Password: Admin123!@#');
  console.log('');
  console.log('📂 Categories Seeded:');
  console.log('==================');
  console.log('Food Safety: Foreign Material (with Metal, Plastic, Glass, Wood, Other), Micro, Allergen, Labeling, Temperature, Sanitation, Supplier, Packaging');
  console.log('Machine: Mechanical, Electrical, Controls, Pneumatics, Sensors, Lubrication, Calibration, Changeover');
  console.log('Workplace Safety: Physical Injury Hazards (12), Ergonomic & Musculoskeletal (8), Machine & Equipment Safety (10),');
  console.log('  Chemical & Hazardous Materials (9), Environmental & Exposure Hazards (8), Fire & Emergency Safety (9),');
  console.log('  Material Handling & Traffic (7), PPE (8), Facility & Infrastructure (7), Behavioral/Training/Compliance (9), Health & Medical (7)');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
