ALTER TABLE "vacation_settings"
  ADD COLUMN IF NOT EXISTS "leaveTypes" TEXT[];

UPDATE "vacation_settings"
SET "leaveTypes" = ARRAY['vacation', 'bereavement', 'sick', 'emergency', 'unpaid', 'personal']::TEXT[]
WHERE "leaveTypes" IS NULL OR array_length("leaveTypes", 1) IS NULL;

ALTER TABLE "vacation_settings"
  ALTER COLUMN "leaveTypes" SET DEFAULT ARRAY['vacation', 'bereavement', 'sick', 'emergency', 'unpaid', 'personal']::TEXT[];

ALTER TABLE "vacation_settings"
  ALTER COLUMN "leaveTypes" SET NOT NULL;
