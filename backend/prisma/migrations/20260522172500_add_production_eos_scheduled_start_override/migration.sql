ALTER TABLE "production_eos_report_lines"
ADD COLUMN IF NOT EXISTS "scheduledStartOverridden" BOOLEAN NOT NULL DEFAULT false;
