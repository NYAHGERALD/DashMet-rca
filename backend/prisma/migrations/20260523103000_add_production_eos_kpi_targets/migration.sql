-- Add admin-maintained KPI targets for Production EOS report metrics.
CREATE TABLE IF NOT EXISTS "production_eos_kpi_targets" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT,
  "metricKey" VARCHAR(80) NOT NULL,
  "metricLabel" VARCHAR(120) NOT NULL,
  "targetValue" DECIMAL(14,4) NOT NULL DEFAULT 0,
  "valueUnit" VARCHAR(20) NOT NULL DEFAULT 'PERCENT',
  "comparisonDirection" VARCHAR(20) NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdByUserId" TEXT,
  "updatedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "production_eos_kpi_targets_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "production_eos_kpi_targets"
  ADD COLUMN IF NOT EXISTS "targetValue" DECIMAL(14,4) NOT NULL DEFAULT 0;
ALTER TABLE "production_eos_kpi_targets"
  ADD COLUMN IF NOT EXISTS "valueUnit" VARCHAR(20) NOT NULL DEFAULT 'PERCENT';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'production_eos_kpi_targets'
      AND column_name = 'targetPct'
  ) THEN
    UPDATE "production_eos_kpi_targets"
    SET "targetValue" = "targetPct"
    WHERE "targetValue" = 0;

    ALTER TABLE "production_eos_kpi_targets" DROP COLUMN "targetPct";
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "production_eos_kpi_targets_organizationId_metricKey_key"
  ON "production_eos_kpi_targets"("organizationId", "metricKey");
CREATE INDEX IF NOT EXISTS "production_eos_kpi_targets_organizationId_idx"
  ON "production_eos_kpi_targets"("organizationId");
CREATE INDEX IF NOT EXISTS "production_eos_kpi_targets_metricKey_idx"
  ON "production_eos_kpi_targets"("metricKey");
CREATE INDEX IF NOT EXISTS "production_eos_kpi_targets_isActive_idx"
  ON "production_eos_kpi_targets"("isActive");
