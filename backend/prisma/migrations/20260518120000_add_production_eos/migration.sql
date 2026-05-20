-- Production End of Shift report module

CREATE TABLE "production_eos_rate_references" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "sourceRowNumber" INTEGER,
    "itemNo" VARCHAR(80) NOT NULL,
    "description" TEXT NOT NULL,
    "totalAssemblyHeadcount" DECIMAL(14,3),
    "totalPackHeadcount" DECIMAL(14,3),
    "temporaryAssemblyHeadcount" DECIMAL(14,3),
    "temporaryPackHeadcount" DECIMAL(14,3),
    "weightPerCaseLb" DECIMAL(14,3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdByUserId" TEXT,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "production_eos_rate_references_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "production_eos_reports" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "reportDate" DATE NOT NULL,
    "dayOfWeek" VARCHAR(20) NOT NULL,
    "shiftId" TEXT,
    "shiftKey" VARCHAR(80) NOT NULL,
    "shiftNameSnapshot" VARCHAR(120) NOT NULL,
    "reportedByUserId" TEXT,
    "reportedByName" VARCHAR(255) NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    "safetyConcerns" TEXT,
    "qualityIssues" TEXT,
    "calculationVersion" VARCHAR(80) NOT NULL DEFAULT 'excel-2026-05-15-v2',
    "totals" JSONB NOT NULL DEFAULT '{}',
    "validationWarnings" JSONB NOT NULL DEFAULT '[]',
    "createdByUserId" TEXT,
    "updatedByUserId" TEXT,
    "submittedByUserId" TEXT,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "production_eos_reports_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "production_eos_report_lines" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "section" VARCHAR(40) NOT NULL,
    "rowKey" VARCHAR(80) NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "location" VARCHAR(120) NOT NULL,
    "lineGroup" VARCHAR(80),
    "stationType" VARCHAR(40),
    "pairedAssemblyRowKey" VARCHAR(80),
    "itemNo" VARCHAR(80),
    "itemDescriptionSnapshot" TEXT,
    "casesScheduled" DECIMAL(14,3),
    "casesProduced" DECIMAL(14,3),
    "actualStartTime" VARCHAR(20),
    "actualEndTime" VARCHAR(20),
    "downMinutes" DECIMAL(14,3),
    "downtimeComment" TEXT,
    "wasteLbs" DECIMAL(14,3),
    "actualHeadcount" DECIMAL(14,3),
    "scheduledStartTime" VARCHAR(20),
    "lbsScheduled" DECIMAL(14,3),
    "lbsProduced" DECIMAL(14,3),
    "attainmentPct" DECIMAL(10,4),
    "totalMinutes" DECIMAL(14,3),
    "lateStartMinutes" DECIMAL(14,3),
    "wastePct" DECIMAL(10,4),
    "standardHeadcount" DECIMAL(14,3),
    "headcountPct" DECIMAL(10,4),
    "calculatedValues" JSONB NOT NULL DEFAULT '{}',
    "validationWarnings" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "production_eos_report_lines_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "production_eos_report_notes" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "lineGroup" VARCHAR(80) NOT NULL,
    "notes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "production_eos_report_notes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "production_eos_rate_references_organizationId_itemNo_key" ON "production_eos_rate_references"("organizationId", "itemNo");
CREATE INDEX "production_eos_rate_references_organizationId_idx" ON "production_eos_rate_references"("organizationId");
CREATE INDEX "production_eos_rate_references_itemNo_idx" ON "production_eos_rate_references"("itemNo");
CREATE INDEX "production_eos_rate_references_isActive_idx" ON "production_eos_rate_references"("isActive");

CREATE UNIQUE INDEX "production_eos_reports_organizationId_reportDate_shiftKey_key" ON "production_eos_reports"("organizationId", "reportDate", "shiftKey");
CREATE INDEX "production_eos_reports_organizationId_idx" ON "production_eos_reports"("organizationId");
CREATE INDEX "production_eos_reports_reportDate_idx" ON "production_eos_reports"("reportDate");
CREATE INDEX "production_eos_reports_shiftId_idx" ON "production_eos_reports"("shiftId");
CREATE INDEX "production_eos_reports_status_idx" ON "production_eos_reports"("status");

CREATE UNIQUE INDEX "production_eos_report_lines_reportId_rowKey_key" ON "production_eos_report_lines"("reportId", "rowKey");
CREATE INDEX "production_eos_report_lines_reportId_idx" ON "production_eos_report_lines"("reportId");
CREATE INDEX "production_eos_report_lines_section_idx" ON "production_eos_report_lines"("section");
CREATE INDEX "production_eos_report_lines_itemNo_idx" ON "production_eos_report_lines"("itemNo");

CREATE UNIQUE INDEX "production_eos_report_notes_reportId_lineGroup_key" ON "production_eos_report_notes"("reportId", "lineGroup");
CREATE INDEX "production_eos_report_notes_reportId_idx" ON "production_eos_report_notes"("reportId");

ALTER TABLE "production_eos_report_lines"
ADD CONSTRAINT "production_eos_report_lines_reportId_fkey"
FOREIGN KEY ("reportId") REFERENCES "production_eos_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "production_eos_report_notes"
ADD CONSTRAINT "production_eos_report_notes_reportId_fkey"
FOREIGN KEY ("reportId") REFERENCES "production_eos_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;
