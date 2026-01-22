-- CreateEnum
CREATE TYPE "FMIRStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_INVESTIGATION', 'RESOLVED', 'CLOSED');

-- AlterTable
ALTER TABLE "Incident" ADD COLUMN     "isPublic" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ForeignMaterialIncident" (
    "id" TEXT NOT NULL,
    "reportNumber" TEXT NOT NULL,
    "status" "FMIRStatus" NOT NULL DEFAULT 'DRAFT',
    "incidentDate" TIMESTAMP(3) NOT NULL,
    "incidentTime" TEXT,
    "department" TEXT,
    "rawMaterialSource" TEXT,
    "productName" TEXT,
    "productItemNumber" TEXT,
    "productCodeBatchLot" TEXT,
    "amount" TEXT,
    "individualsInvolved" TEXT,
    "foreignMaterialDescription" TEXT NOT NULL,
    "foreignMaterialSize" TEXT,
    "foreignMaterialHardness" TEXT,
    "section2Initials" TEXT,
    "section2Date" TIMESTAMP(3),
    "isHardSharpOrLarge" BOOLEAN NOT NULL DEFAULT false,
    "unforeseeHazardFormRequired" BOOLEAN NOT NULL DEFAULT false,
    "causeIdentification" TEXT,
    "possibleSource" TEXT,
    "howWhyOccurred" TEXT,
    "section3Initials" TEXT,
    "section3Date" TIMESTAMP(3),
    "correctiveAction" TEXT,
    "section4Initials" TEXT,
    "section4Date" TIMESTAMP(3),
    "verificationActions" TEXT,
    "section5Initials" TEXT,
    "section5Date" TIMESTAMP(3),
    "maintenanceWorkCompleted" TEXT,
    "sanitationRequired" BOOLEAN NOT NULL DEFAULT false,
    "sanitationNotes" TEXT,
    "productPlacedOnHold" BOOLEAN NOT NULL DEFAULT false,
    "itemsHeld" TEXT,
    "holdDecisionDetails" TEXT,
    "contaminationWindowDetails" TEXT,
    "section6Initials" TEXT,
    "section6Date" TIMESTAMP(3),
    "screeningProcess" TEXT,
    "section7Initials" TEXT,
    "section7Date" TIMESTAMP(3),
    "finalDisposition" TEXT,
    "dispositionVolume" TEXT,
    "dispositionJustification" TEXT,
    "section8Initials" TEXT,
    "section8Date" TIMESTAMP(3),
    "dispositionDate" TIMESTAMP(3),
    "dispositionInitials" TEXT,
    "preventionMeasures" TEXT,
    "section9Initials" TEXT,
    "section9Date" TIMESTAMP(3),
    "corporateNotified" BOOLEAN NOT NULL DEFAULT false,
    "corporatePersonsNotified" TEXT,
    "preShipmentReview" TEXT,
    "preShipmentReviewDate" TIMESTAMP(3),
    "preShipmentSignatureRequired" BOOLEAN NOT NULL DEFAULT false,
    "organizationId" TEXT NOT NULL,
    "facilityId" TEXT,
    "createdById" TEXT NOT NULL,
    "rcaAnalysisId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "submittedAt" TIMESTAMP(3),

    CONSTRAINT "ForeignMaterialIncident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FMIREvidence" (
    "id" TEXT NOT NULL,
    "fmirId" TEXT NOT NULL,
    "type" "EvidenceType" NOT NULL,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "description" TEXT,
    "uploadedById" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FMIREvidence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ForeignMaterialIncident_reportNumber_key" ON "ForeignMaterialIncident"("reportNumber");

-- CreateIndex
CREATE INDEX "ForeignMaterialIncident_organizationId_idx" ON "ForeignMaterialIncident"("organizationId");

-- CreateIndex
CREATE INDEX "ForeignMaterialIncident_facilityId_idx" ON "ForeignMaterialIncident"("facilityId");

-- CreateIndex
CREATE INDEX "ForeignMaterialIncident_createdById_idx" ON "ForeignMaterialIncident"("createdById");

-- CreateIndex
CREATE INDEX "ForeignMaterialIncident_status_idx" ON "ForeignMaterialIncident"("status");

-- CreateIndex
CREATE INDEX "ForeignMaterialIncident_incidentDate_idx" ON "ForeignMaterialIncident"("incidentDate");

-- CreateIndex
CREATE INDEX "ForeignMaterialIncident_rcaAnalysisId_idx" ON "ForeignMaterialIncident"("rcaAnalysisId");

-- CreateIndex
CREATE INDEX "FMIREvidence_fmirId_idx" ON "FMIREvidence"("fmirId");

-- AddForeignKey
ALTER TABLE "ForeignMaterialIncident" ADD CONSTRAINT "ForeignMaterialIncident_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForeignMaterialIncident" ADD CONSTRAINT "ForeignMaterialIncident_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForeignMaterialIncident" ADD CONSTRAINT "ForeignMaterialIncident_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FMIREvidence" ADD CONSTRAINT "FMIREvidence_fmirId_fkey" FOREIGN KEY ("fmirId") REFERENCES "ForeignMaterialIncident"("id") ON DELETE CASCADE ON UPDATE CASCADE;
