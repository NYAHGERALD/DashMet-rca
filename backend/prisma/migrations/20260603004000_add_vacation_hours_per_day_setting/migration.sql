ALTER TABLE "vacation_settings"
  ADD COLUMN IF NOT EXISTS "vacationHoursPerDay" INTEGER;

UPDATE "vacation_settings"
SET "vacationHoursPerDay" = 8
WHERE "vacationHoursPerDay" IS NULL OR "vacationHoursPerDay" < 1;

ALTER TABLE "vacation_settings"
  ALTER COLUMN "vacationHoursPerDay" SET DEFAULT 8;

ALTER TABLE "vacation_settings"
  ALTER COLUMN "vacationHoursPerDay" SET NOT NULL;

UPDATE "vacations"
SET "durationHours" = "durationDays" * 8
WHERE "durationHours" IS NULL OR "durationHours" < 1;
