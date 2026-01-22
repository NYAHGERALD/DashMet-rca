-- CreateTable
CREATE TABLE "FMIRAuditReport" (
    "id" TEXT NOT NULL,
    "fmirId" TEXT NOT NULL,
    "reportNumber" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "canBeClosed" BOOLEAN NOT NULL,
    "auditScore" INTEGER NOT NULL,
    "overallVerdict" TEXT NOT NULL,
    "passesAudit" BOOLEAN NOT NULL,
    "congratulations" BOOLEAN NOT NULL DEFAULT false,
    "blockingReasons" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "summary" JSONB NOT NULL,
    "reportSummary" JSONB NOT NULL,
    "answerQuality" JSONB NOT NULL,
    "contentQuality" JSONB NOT NULL,
    "evidenceAnalysis" JSONB NOT NULL,
    "regulatoryReadiness" JSONB NOT NULL,
    "fieldValidation" JSONB NOT NULL,
    "improvementAreas" JSONB NOT NULL,
    "auditorNarrative" TEXT NOT NULL,
    "closingStatement" TEXT NOT NULL,
    "auditedById" TEXT NOT NULL,
    "auditDurationMs" INTEGER,
    "aiModel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FMIRAuditReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FMIRAuditReport_fmirId_idx" ON "FMIRAuditReport"("fmirId");

-- CreateIndex
CREATE INDEX "FMIRAuditReport_organizationId_idx" ON "FMIRAuditReport"("organizationId");

-- CreateIndex
CREATE INDEX "FMIRAuditReport_auditedById_idx" ON "FMIRAuditReport"("auditedById");

-- CreateIndex
CREATE INDEX "FMIRAuditReport_createdAt_idx" ON "FMIRAuditReport"("createdAt");

-- CreateIndex
CREATE INDEX "FMIRAuditReport_auditScore_idx" ON "FMIRAuditReport"("auditScore");

-- CreateIndex
CREATE INDEX "FMIRAuditReport_canBeClosed_idx" ON "FMIRAuditReport"("canBeClosed");

-- AddForeignKey
ALTER TABLE "FMIRAuditReport" ADD CONSTRAINT "FMIRAuditReport_fmirId_fkey" FOREIGN KEY ("fmirId") REFERENCES "ForeignMaterialIncident"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FMIRAuditReport" ADD CONSTRAINT "FMIRAuditReport_auditedById_fkey" FOREIGN KEY ("auditedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FMIRAuditReport" ADD CONSTRAINT "FMIRAuditReport_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
