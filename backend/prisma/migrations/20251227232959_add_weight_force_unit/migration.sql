/*
  Warnings:

  - A unique constraint covering the columns `[signupCode]` on the table `Organization` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "DropdownType" AS ENUM ('INJURY_TYPE', 'TASK_FREQUENCY', 'UNSAFE_ACT_CONDITION', 'INJURY_DEVELOPMENT', 'SEVERITY_LEVEL', 'BODY_PART', 'ENVIRONMENTAL_CONDITION', 'CASE_CLASSIFICATION', 'INJURY_WORK_RELATION', 'TASK_ROUTINE_TYPE', 'WEIGHT_FORCE_UNIT', 'CONTRIBUTING_FACTOR_TYPE', 'POSITION_JOB_TYPE', 'INJURY_MECHANISM', 'CORRECTIVE_ACTION_TYPE', 'INCIDENT_PATTERN');

-- AlterEnum
ALTER TYPE "IncidentType" ADD VALUE 'WORKPLACE_SAFETY';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'INCIDENT_SUBMITTED';
ALTER TYPE "NotificationType" ADD VALUE 'INCIDENT_ESCALATED';
ALTER TYPE "NotificationType" ADD VALUE 'SLA_RESPONSE_WARNING';
ALTER TYPE "NotificationType" ADD VALUE 'SLA_RESPONSE_BREACHED';
ALTER TYPE "NotificationType" ADD VALUE 'SLA_RESOLUTION_WARNING';
ALTER TYPE "NotificationType" ADD VALUE 'SLA_RESOLUTION_BREACHED';

-- AlterTable
ALTER TABLE "CAPAction" ADD COLUMN     "completedById" TEXT,
ADD COLUMN     "completionEvidence" TEXT,
ADD COLUMN     "completionNotes" TEXT,
ADD COLUMN     "implementationNotes" TEXT,
ADD COLUMN     "implementationPlan" TEXT,
ADD COLUMN     "startedAt" TIMESTAMP(3),
ADD COLUMN     "startedById" TEXT,
ADD COLUMN     "verificationNotes" TEXT,
ADD COLUMN     "verifiedAt" TIMESTAMP(3),
ADD COLUMN     "verifiedById" TEXT;

-- AlterTable
ALTER TABLE "Incident" ADD COLUMN     "additionalEmployerHours" TEXT,
ADD COLUMN     "additionalEmployerStartDate" TIMESTAMP(3),
ADD COLUMN     "additionalEmployers" TEXT,
ADD COLUMN     "allBodyPartsInjured" TEXT,
ADD COLUMN     "areaSecured" BOOLEAN,
ADD COLUMN     "assignmentRuleId" TEXT,
ADD COLUMN     "autoAssigned" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "bodyPartsAffected" TEXT[],
ADD COLUMN     "caseClassification" TEXT,
ADD COLUMN     "contributingActsConditions" TEXT,
ADD COLUMN     "contributingFactors" JSONB,
ADD COLUMN     "dateIncidentReported" TIMESTAMP(3),
ADD COLUMN     "dateInjuryKnownWorkRelated" TIMESTAMP(3),
ADD COLUMN     "dateOfInjury" TIMESTAMP(3),
ADD COLUMN     "dateTimeLeftWork" TIMESTAMP(3),
ADD COLUMN     "dateTimeReturnedToWork" TIMESTAMP(3),
ADD COLUMN     "didLeaveWork" BOOLEAN,
ADD COLUMN     "didReturnToWork" BOOLEAN,
ADD COLUMN     "didSiteRevealCause" BOOLEAN,
ADD COLUMN     "directCause" TEXT,
ADD COLUMN     "employedElsewhere" BOOLEAN,
ADD COLUMN     "employeeIdNumber" TEXT,
ADD COLUMN     "employeeName" TEXT,
ADD COLUMN     "environmentalConditions" TEXT[],
ADD COLUMN     "escalatedAt" TIMESTAMP(3),
ADD COLUMN     "escalatedToId" TEXT,
ADD COLUMN     "exposureDuration" TEXT,
ADD COLUMN     "firstAidProvided" BOOLEAN,
ADD COLUMN     "hadPhysicalRestrictions" BOOLEAN,
ADD COLUMN     "incidentDate" TIMESTAMP(3),
ADD COLUMN     "incidentDescriptionDetailed" TEXT,
ADD COLUMN     "incidentTime" TEXT,
ADD COLUMN     "inconsistencyExplanation" TEXT,
ADD COLUMN     "injuryCausedByWork" BOOLEAN,
ADD COLUMN     "injuryDescriptionDetailed" TEXT,
ADD COLUMN     "injuryDevelopedOverTime" BOOLEAN,
ADD COLUMN     "injuryDevelopmentPattern" TEXT,
ADD COLUMN     "injuryLocation" TEXT,
ADD COLUMN     "injuryType" TEXT,
ADD COLUMN     "injuryTypeDescription" TEXT,
ADD COLUMN     "injuryWitnessed" BOOLEAN,
ADD COLUMN     "injuryWorkRelation" TEXT,
ADD COLUMN     "interviewedNames" TEXT,
ADD COLUMN     "investigationBodyParts" TEXT[],
ADD COLUMN     "investigationInjuryType" TEXT,
ADD COLUMN     "investigationSubmittedAt" TIMESTAMP(3),
ADD COLUMN     "investigationSubmittedById" TEXT,
ADD COLUMN     "isAreaUnderSurveillance" BOOLEAN,
ADD COLUMN     "isOshaRecordable" BOOLEAN,
ADD COLUMN     "isPrivate" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isRoutineTask" BOOLEAN,
ADD COLUMN     "knownRestrictions" TEXT,
ADD COLUMN     "leaderActsConditionsOpinion" TEXT,
ADD COLUMN     "lotoRequired" TEXT,
ADD COLUMN     "machineSafeguardsInPlace" TEXT,
ADD COLUMN     "medicalProvidersInvolved" TEXT,
ADD COLUMN     "medicalTreatmentRequired" BOOLEAN,
ADD COLUMN     "notifiedIndividuals" TEXT,
ADD COLUMN     "otherBodyPartDetail" TEXT,
ADD COLUMN     "otherDutiesExplanation" TEXT,
ADD COLUMN     "otherEmployerNames" TEXT,
ADD COLUMN     "positionAtTimeOfIncident" TEXT,
ADD COLUMN     "ppeRequired" BOOLEAN,
ADD COLUMN     "ppeWorn" BOOLEAN,
ADD COLUMN     "preventionRecommendations" TEXT,
ADD COLUMN     "previousSimilarConditionDetails" TEXT,
ADD COLUMN     "previousSimilarConditionReported" BOOLEAN,
ADD COLUMN     "previousSimilarIncidents" BOOLEAN,
ADD COLUMN     "priorSurgeryDescription" TEXT,
ADD COLUMN     "priorSurgeryPerformed" BOOLEAN,
ADD COLUMN     "reportedToMedicalDept" BOOLEAN,
ADD COLUMN     "resolvedAt" TIMESTAMP(3),
ADD COLUMN     "respondedAt" TIMESTAMP(3),
ADD COLUMN     "siteRevealExplanation" TEXT,
ADD COLUMN     "siteViewDate" TIMESTAMP(3),
ADD COLUMN     "siteViewTime" TEXT,
ADD COLUMN     "slaResolutionBreached" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "slaResolutionDeadline" TIMESTAMP(3),
ADD COLUMN     "slaResponseBreached" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "slaResponseDeadline" TIMESTAMP(3),
ADD COLUMN     "sopAvailable" BOOLEAN,
ADD COLUMN     "sopFollowed" BOOLEAN,
ADD COLUMN     "specificInjuryLocation" TEXT,
ADD COLUMN     "supervisorActions" TEXT,
ADD COLUMN     "supervisorNotified" BOOLEAN,
ADD COLUMN     "taskBeingPerformed" TEXT,
ADD COLUMN     "taskFrequency" TEXT,
ADD COLUMN     "timeOfInjury" TEXT,
ADD COLUMN     "treatingDoctors" TEXT,
ADD COLUMN     "unsafeActOrCondition" TEXT,
ADD COLUMN     "wasClockedIn" BOOLEAN,
ADD COLUMN     "wasIncidentSiteViewed" BOOLEAN,
ADD COLUMN     "wasInjuryConsistentWithSite" BOOLEAN,
ADD COLUMN     "wasInjuryWitnessed" BOOLEAN,
ADD COLUMN     "wasPerformingOtherDuties" BOOLEAN,
ADD COLUMN     "wasSurveillanceAvailable" BOOLEAN,
ADD COLUMN     "weightOrForce" TEXT,
ADD COLUMN     "weightOrForceUnit" TEXT,
ADD COLUMN     "wereCoworkersPresent" BOOLEAN,
ADD COLUMN     "wereInterviewsDocumented" BOOLEAN,
ADD COLUMN     "werePhotosVideosTaken" BOOLEAN,
ADD COLUMN     "witnessNames" TEXT,
ADD COLUMN     "witnessNamesList" TEXT,
ADD COLUMN     "workedForOtherLast6Months" BOOLEAN;

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "isPublic" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "signupCode" TEXT;

-- CreateTable
CREATE TABLE "DropdownOption" (
    "id" TEXT NOT NULL,
    "optionType" "DropdownType" NOT NULL,
    "value" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "placeholder" TEXT,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DropdownOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FieldConfiguration" (
    "id" TEXT NOT NULL,
    "incidentType" TEXT NOT NULL,
    "fieldName" TEXT NOT NULL,
    "fieldLabel" TEXT NOT NULL,
    "fieldType" TEXT NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "placeholder" TEXT,
    "helpText" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FieldConfiguration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CAPAuditLog" (
    "id" TEXT NOT NULL,
    "capActionId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "previousStatus" TEXT,
    "newStatus" TEXT,
    "previousData" JSONB,
    "newData" JSONB,
    "notes" TEXT,
    "evidence" TEXT,
    "performedById" TEXT NOT NULL,
    "performedByName" TEXT NOT NULL,
    "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "CAPAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssignmentRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "organizationId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "incidentType" "IncidentType",
    "categoryId" TEXT,
    "facilityId" TEXT,
    "areaId" TEXT,
    "severity" "Severity",
    "assignToUserId" TEXT,
    "assignToRole" "UserRole",
    "slaResponseHours" INTEGER,
    "slaResolutionHours" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssignmentRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SLAConfiguration" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "severity" "Severity" NOT NULL,
    "responseTimeHours" INTEGER NOT NULL,
    "resolutionTimeHours" INTEGER NOT NULL,
    "escalationEnabled" BOOLEAN NOT NULL DEFAULT true,
    "escalationAfterHours" INTEGER,
    "escalationToRole" "UserRole",
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SLAConfiguration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DropdownOption_organizationId_optionType_idx" ON "DropdownOption"("organizationId", "optionType");

-- CreateIndex
CREATE INDEX "DropdownOption_optionType_idx" ON "DropdownOption"("optionType");

-- CreateIndex
CREATE UNIQUE INDEX "DropdownOption_organizationId_optionType_value_key" ON "DropdownOption"("organizationId", "optionType", "value");

-- CreateIndex
CREATE INDEX "FieldConfiguration_organizationId_incidentType_idx" ON "FieldConfiguration"("organizationId", "incidentType");

-- CreateIndex
CREATE INDEX "FieldConfiguration_incidentType_idx" ON "FieldConfiguration"("incidentType");

-- CreateIndex
CREATE UNIQUE INDEX "FieldConfiguration_organizationId_incidentType_fieldName_key" ON "FieldConfiguration"("organizationId", "incidentType", "fieldName");

-- CreateIndex
CREATE INDEX "CAPAuditLog_capActionId_idx" ON "CAPAuditLog"("capActionId");

-- CreateIndex
CREATE INDEX "CAPAuditLog_performedAt_idx" ON "CAPAuditLog"("performedAt");

-- CreateIndex
CREATE INDEX "CAPAuditLog_performedById_idx" ON "CAPAuditLog"("performedById");

-- CreateIndex
CREATE INDEX "AssignmentRule_organizationId_isActive_idx" ON "AssignmentRule"("organizationId", "isActive");

-- CreateIndex
CREATE INDEX "AssignmentRule_incidentType_idx" ON "AssignmentRule"("incidentType");

-- CreateIndex
CREATE INDEX "AssignmentRule_severity_idx" ON "AssignmentRule"("severity");

-- CreateIndex
CREATE INDEX "SLAConfiguration_organizationId_idx" ON "SLAConfiguration"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "SLAConfiguration_organizationId_severity_key" ON "SLAConfiguration"("organizationId", "severity");

-- CreateIndex
CREATE INDEX "Incident_slaResponseDeadline_idx" ON "Incident"("slaResponseDeadline");

-- CreateIndex
CREATE INDEX "Incident_slaResolutionDeadline_idx" ON "Incident"("slaResolutionDeadline");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_signupCode_key" ON "Organization"("signupCode");

-- CreateIndex
CREATE INDEX "Organization_signupCode_idx" ON "Organization"("signupCode");

-- AddForeignKey
ALTER TABLE "DropdownOption" ADD CONSTRAINT "DropdownOption_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldConfiguration" ADD CONSTRAINT "FieldConfiguration_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_investigationSubmittedById_fkey" FOREIGN KEY ("investigationSubmittedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CAPAuditLog" ADD CONSTRAINT "CAPAuditLog_capActionId_fkey" FOREIGN KEY ("capActionId") REFERENCES "CAPAction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
