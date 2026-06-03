-- Add stored vacation duration hours and backfill existing records from business days.
ALTER TABLE "vacations" ADD COLUMN IF NOT EXISTS "durationHours" INTEGER;

UPDATE "vacations"
SET "durationHours" = COALESCE("durationDays", 1) * 8
WHERE "durationHours" IS NULL;

ALTER TABLE "vacations" ALTER COLUMN "durationHours" SET DEFAULT 8;
ALTER TABLE "vacations" ALTER COLUMN "durationHours" SET NOT NULL;
