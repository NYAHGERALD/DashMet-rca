-- Safe, idempotent creation of support request tables for existing databases.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SupportRequestStatus') THEN
    CREATE TYPE "SupportRequestStatus" AS ENUM ('NEW', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SupportCategory') THEN
    CREATE TYPE "SupportCategory" AS ENUM ('TECHNICAL_ISSUE', 'ACCESS_ISSUE', 'BILLING', 'FEATURE_REQUEST', 'OTHER');
  END IF;
EXCEPTION
  WHEN duplicate_object THEN
    -- Types already exist
    NULL;
END $$;

CREATE TABLE IF NOT EXISTS "SupportRequest" (
  "id" TEXT NOT NULL,
  "submittedByUserId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "category" "SupportCategory" NOT NULL,
  "description" TEXT NOT NULL,
  "status" "SupportRequestStatus" NOT NULL DEFAULT 'NEW',
  "internalNotes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "resolvedAt" TIMESTAMP(3),
  "resolvedByUserId" TEXT,
  CONSTRAINT "SupportRequest_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX IF NOT EXISTS "SupportRequest_submittedByUserId_idx" ON "SupportRequest"("submittedByUserId");
CREATE INDEX IF NOT EXISTS "SupportRequest_organizationId_idx" ON "SupportRequest"("organizationId");
CREATE INDEX IF NOT EXISTS "SupportRequest_status_idx" ON "SupportRequest"("status");
CREATE INDEX IF NOT EXISTS "SupportRequest_category_idx" ON "SupportRequest"("category");
CREATE INDEX IF NOT EXISTS "SupportRequest_resolvedByUserId_idx" ON "SupportRequest"("resolvedByUserId");

-- Foreign keys
DO $$
BEGIN
  ALTER TABLE "SupportRequest" ADD CONSTRAINT "SupportRequest_submittedByUserId_fkey"
    FOREIGN KEY ("submittedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "SupportRequest" ADD CONSTRAINT "SupportRequest_resolvedByUserId_fkey"
    FOREIGN KEY ("resolvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "SupportRequest" ADD CONSTRAINT "SupportRequest_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
