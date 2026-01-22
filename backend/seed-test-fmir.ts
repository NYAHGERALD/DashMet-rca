import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Finding user geraldnyah4@gmail.com...');
  
  const user = await prisma.user.findUnique({
    where: { email: 'geraldnyah4@gmail.com' },
    include: { Organization: true }
  });

  if (!user) {
    console.error('❌ User not found!');
    process.exit(1);
  }

  console.log(`✅ Found user: ${user.firstName} ${user.lastName} (${user.id})`);
  console.log(`   Organization: ${user.Organization?.name || 'None'}`);

  if (!user.organizationId) {
    console.error('❌ User has no organization!');
    process.exit(1);
  }

  // Get a facility for this organization
  const facility = await prisma.facility.findFirst({
    where: { organizationId: user.organizationId }
  });

  if (!facility) {
    console.error('❌ No facility found for organization!');
    process.exit(1);
  }

  console.log(`✅ Using facility: ${facility.name}`);

  // Get area for this facility
  const area = await prisma.area.findFirst({
    where: { facilityId: facility.id }
  });

  // Get line through area
  let line = null;
  if (area) {
    line = await prisma.line.findFirst({
      where: { areaId: area.id }
    });
  }

  console.log(`   Area: ${area?.name || 'None'}, Line: ${line?.name || 'None'}`);

  // Generate report numbers
  const orgPrefix = user.Organization?.name?.substring(0, 10).toUpperCase().replace(/\s+/g, '') || 'ORG';
  const year = new Date().getFullYear();
  const timestamp1 = Date.now();
  const timestamp2 = Date.now() + 1;

  // Create 2 complete FMIR reports
  const reports = [
    {
      reportNumber: `FMIR-${orgPrefix}-${String(timestamp1).slice(-4)}-${year}`,
      status: 'SUBMITTED' as const,
      incidentDate: new Date('2026-01-15'),
      incidentTime: '09:30',
      department: 'Production',
      rawMaterialSource: 'Supplier ABC - Batch #12345',
      productName: 'Organic Wheat Flour',
      productItemNumber: 'WF-2026-001',
      productCodeBatchLot: 'LOT-2026-0115-A',
      amount: '500 lbs',
      individualsInvolved: 'John Smith, Maria Garcia',
      foreignMaterialDescription: 'Small metal fragment approximately 3mm in length discovered during routine quality inspection. Fragment appears to be stainless steel, likely from processing equipment.',
      foreignMaterialSize: '3mm x 1mm',
      foreignMaterialHardness: 'Hard - Metal',
      fmSourceCategory: 'Equipment',
      fmSourceType: 'Metal Fragment',
      isHardSharpOrLarge: true,
      unforeseeHazardFormRequired: false,
      causeIdentification: 'Metal fragment originated from worn conveyor belt scraper blade. Inspection revealed micro-fractures in the blade edge consistent with normal wear pattern.',
      possibleSource: 'Conveyor belt scraper blade #7 on Line 3',
      howWhyOccurred: 'The scraper blade had exceeded its recommended service life by approximately 2 weeks. Preventive maintenance schedule was delayed due to production demands.',
      correctiveAction: 'Immediately replaced all scraper blades on Line 3. Implemented emergency inspection of all similar blades across all production lines. Conducted metal detection sweep of all product in production.',
      verificationActions: 'Verified metal detector functionality with test samples. Confirmed all affected product lots were placed on hold. Reviewed maintenance records and identified gap in PM schedule.',
      maintenanceWorkCompleted: 'Replaced 12 scraper blades across Lines 1-4. Calibrated all metal detectors. Updated PM schedule in CMMS system.',
      sanitationRequired: true,
      sanitationNotes: 'Deep cleaned conveyor system and surrounding area. Inspected for any additional metal fragments.',
      productPlacedOnHold: true,
      itemsHeld: 'Lots WF-0114-A through WF-0115-C (approximately 2,000 lbs total)',
      holdDecisionDetails: 'All product from affected line placed on hold pending investigation and metal detection verification.',
      contaminationWindowDetails: 'Contamination window determined to be January 14, 2026 8:00 AM to January 15, 2026 9:30 AM based on last blade inspection.',
      screeningProcess: 'All held product passed through metal detector at reduced sensitivity (1.5mm Fe, 2.0mm Non-Fe). 100% of product cleared.',
      finalDisposition: 'Released for sale after verification',
      dispositionVolume: '2,000 lbs',
      dispositionJustification: 'Product passed metal detection screening. Root cause identified and corrected. No consumer risk identified.',
      preventionMeasures: 'Updated PM schedule to inspect scraper blades weekly instead of monthly. Added blade wear indicators. Implemented pre-shift visual inspection checklist for operators.',
      corporateNotified: true,
      corporatePersonsNotified: 'Regional QA Manager - Jane Doe, Corporate Food Safety - Bob Wilson',
      preShipmentReview: 'All documentation reviewed and approved. HACCP records verified.',
      organizationId: user.organizationId,
      facilityId: facility.id,
      createdById: user.id,
      area: area?.id || null,
      line: line?.id || null,
      isVisible: true,
      submittedAt: new Date(),
    },
    {
      reportNumber: `FMIR-${orgPrefix}-${String(timestamp2).slice(-4)}-${year}`,
      status: 'SUBMITTED' as const,
      incidentDate: new Date('2026-01-17'),
      incidentTime: '14:15',
      department: 'Packaging',
      rawMaterialSource: 'Internal Production - Line 2',
      productName: 'Premium Granola Bars',
      productItemNumber: 'GB-2026-042',
      productCodeBatchLot: 'LOT-2026-0117-B',
      amount: '200 units',
      individualsInvolved: 'Sarah Johnson, Mike Chen',
      foreignMaterialDescription: 'Clear plastic film piece (approximately 5mm x 8mm) found in finished product during consumer complaint investigation. Material identified as overwrap film from packaging line.',
      foreignMaterialSize: '5mm x 8mm',
      foreignMaterialHardness: 'Soft - Plastic',
      fmSourceCategory: 'Packaging',
      fmSourceType: 'Plastic Fragment',
      isHardSharpOrLarge: false,
      unforeseeHazardFormRequired: false,
      causeIdentification: 'Plastic film piece came from torn overwrap roll. Film roll had manufacturing defect causing weak spots that tore during application.',
      possibleSource: 'Overwrap station on Packaging Line 2',
      howWhyOccurred: 'Defective film roll was not identified during incoming inspection. Roll had internal defect not visible externally. Tearing occurred during high-speed packaging run.',
      correctiveAction: 'Quarantined and removed defective film roll. Inspected all film rolls from same supplier lot. Notified supplier of quality issue. Implemented incoming inspection enhancement.',
      verificationActions: 'Verified all product from affected run was identified. Confirmed supplier acknowledgment of defect report. Tested enhanced incoming inspection procedure.',
      maintenanceWorkCompleted: 'Cleaned and inspected overwrap station. No equipment issues found - confirmed issue was material-related.',
      sanitationRequired: false,
      sanitationNotes: '',
      productPlacedOnHold: true,
      itemsHeld: 'Production run GB-0117-B1 through GB-0117-B4 (800 units total)',
      holdDecisionDetails: 'All product from affected film roll placed on hold pending visual inspection.',
      contaminationWindowDetails: 'Contamination window: January 17, 2026 12:00 PM to 2:15 PM (when defective roll was in use).',
      screeningProcess: 'Visual inspection of all held units. X-ray screening of sample units. 3 additional units with visible film defects identified and destroyed.',
      finalDisposition: 'Partial release - 797 units released, 3 units destroyed',
      dispositionVolume: '797 units released, 3 units destroyed',
      dispositionJustification: 'Visual and x-ray inspection confirmed remaining product is free of foreign material. Root cause corrected.',
      preventionMeasures: 'Enhanced incoming inspection for film rolls to include unwind testing. Added mid-roll inspection checkpoint. Supplier placed on probation with increased audit frequency.',
      corporateNotified: false,
      corporatePersonsNotified: '',
      preShipmentReview: 'Documentation complete. Consumer complaint response sent.',
      organizationId: user.organizationId,
      facilityId: facility.id,
      createdById: user.id,
      area: area?.id || null,
      line: line?.id || null,
      isVisible: true,
      submittedAt: new Date(),
    }
  ];

  console.log('\n📝 Creating FMIR reports...');

  for (const reportData of reports) {
    try {
      const report = await prisma.foreignMaterialIncident.create({
        data: reportData
      });
      console.log(`   ✅ Created: ${report.reportNumber} (ID: ${report.id})`);
    } catch (error: any) {
      console.error(`   ❌ Error creating report: ${error.message}`);
    }
  }

  console.log('\n🎉 Done! Created 2 complete FMIR reports for testing.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
