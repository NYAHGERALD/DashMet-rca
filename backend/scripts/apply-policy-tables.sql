-- Safe, idempotent creation of policy tables for existing databases.
-- Use this if Prisma migrate cannot be used because the DB is already populated/baselined.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PolicyType') THEN
    CREATE TYPE "PolicyType" AS ENUM ('PRIVACY_POLICY', 'TERMS_OF_SERVICE', 'COOKIE_POLICY', 'SECURITY');
  END IF;
EXCEPTION
  WHEN duplicate_object THEN
    -- Type already exists
    NULL;
END $$;

CREATE TABLE IF NOT EXISTS "PolicyDocument" (
  "id" TEXT NOT NULL,
  "type" "PolicyType" NOT NULL,
  "title" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "isPublished" BOOLEAN NOT NULL DEFAULT false,
  "publishedAt" TIMESTAMP(3),
  "updatedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PolicyDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PolicyRevision" (
  "id" TEXT NOT NULL,
  "policyId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "createdByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PolicyRevision_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS "PolicyDocument_type_key" ON "PolicyDocument"("type");
CREATE INDEX IF NOT EXISTS "PolicyDocument_type_idx" ON "PolicyDocument"("type");
CREATE INDEX IF NOT EXISTS "PolicyDocument_isPublished_idx" ON "PolicyDocument"("isPublished");

CREATE UNIQUE INDEX IF NOT EXISTS "PolicyRevision_policyId_version_key" ON "PolicyRevision"("policyId", "version");
CREATE INDEX IF NOT EXISTS "PolicyRevision_policyId_idx" ON "PolicyRevision"("policyId");

-- Foreign keys (wrapped to avoid failure if already present)
DO $$
BEGIN
  ALTER TABLE "PolicyDocument" ADD CONSTRAINT "PolicyDocument_updatedByUserId_fkey"
    FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "PolicyRevision" ADD CONSTRAINT "PolicyRevision_policyId_fkey"
    FOREIGN KEY ("policyId") REFERENCES "PolicyDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "PolicyRevision" ADD CONSTRAINT "PolicyRevision_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
