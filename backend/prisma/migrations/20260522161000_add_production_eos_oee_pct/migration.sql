ALTER TABLE "production_eos_report_lines"
ADD COLUMN IF NOT EXISTS "oeePct" DECIMAL(10,4);
