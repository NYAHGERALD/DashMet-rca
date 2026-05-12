DO $$
BEGIN
  CREATE TYPE "RCAFishboneSyncStatus" AS ENUM ('PENDING', 'SYNCING', 'SYNCED', 'FAILED', 'STALE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "RCAFishboneSyncEventStatus" AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "RCAFishboneBoardLink" (
  "id" TEXT NOT NULL,
  "rcaAnalysisId" TEXT NOT NULL,
  "incidentId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "boardId" TEXT NOT NULL,
  "sourceVersion" INTEGER NOT NULL DEFAULT 1,
  "syncStatus" "RCAFishboneSyncStatus" NOT NULL DEFAULT 'PENDING',
  "lastSyncedAt" TIMESTAMP(3),
  "lastSyncError" TEXT,
  "generatedElementCount" INTEGER NOT NULL DEFAULT 0,
  "annotationElementCount" INTEGER NOT NULL DEFAULT 0,
  "createdById" TEXT,
  "lastSyncedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RCAFishboneBoardLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "RCAFishboneBoardLink_rcaAnalysisId_key"
  ON "RCAFishboneBoardLink"("rcaAnalysisId");

CREATE UNIQUE INDEX IF NOT EXISTS "RCAFishboneBoardLink_boardId_key"
  ON "RCAFishboneBoardLink"("boardId");

CREATE INDEX IF NOT EXISTS "RCAFishboneBoardLink_incidentId_idx"
  ON "RCAFishboneBoardLink"("incidentId");

CREATE INDEX IF NOT EXISTS "RCAFishboneBoardLink_organizationId_idx"
  ON "RCAFishboneBoardLink"("organizationId");

CREATE INDEX IF NOT EXISTS "RCAFishboneBoardLink_syncStatus_idx"
  ON "RCAFishboneBoardLink"("syncStatus");

CREATE INDEX IF NOT EXISTS "RCAFishboneBoardLink_lastSyncedAt_idx"
  ON "RCAFishboneBoardLink"("lastSyncedAt");

CREATE TABLE IF NOT EXISTS "RCAFishboneDiagramElement" (
  "id" TEXT NOT NULL,
  "linkId" TEXT NOT NULL,
  "rcaAnalysisId" TEXT NOT NULL,
  "boardId" TEXT NOT NULL,
  "categoryId" TEXT,
  "causeId" TEXT,
  "elementId" TEXT NOT NULL,
  "elementType" TEXT NOT NULL,
  "sourceType" TEXT NOT NULL DEFAULT 'GENERATED',
  "isGenerated" BOOLEAN NOT NULL DEFAULT true,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RCAFishboneDiagramElement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "RCAFishboneDiagramElement_boardId_elementId_key"
  ON "RCAFishboneDiagramElement"("boardId", "elementId");

CREATE INDEX IF NOT EXISTS "RCAFishboneDiagramElement_linkId_idx"
  ON "RCAFishboneDiagramElement"("linkId");

CREATE INDEX IF NOT EXISTS "RCAFishboneDiagramElement_rcaAnalysisId_idx"
  ON "RCAFishboneDiagramElement"("rcaAnalysisId");

CREATE INDEX IF NOT EXISTS "RCAFishboneDiagramElement_boardId_idx"
  ON "RCAFishboneDiagramElement"("boardId");

CREATE INDEX IF NOT EXISTS "RCAFishboneDiagramElement_categoryId_idx"
  ON "RCAFishboneDiagramElement"("categoryId");

CREATE INDEX IF NOT EXISTS "RCAFishboneDiagramElement_causeId_idx"
  ON "RCAFishboneDiagramElement"("causeId");

CREATE TABLE IF NOT EXISTS "RCAFishboneSyncEvent" (
  "id" TEXT NOT NULL,
  "linkId" TEXT,
  "rcaAnalysisId" TEXT NOT NULL,
  "incidentId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "boardId" TEXT,
  "eventType" TEXT NOT NULL,
  "status" "RCAFishboneSyncEventStatus" NOT NULL DEFAULT 'QUEUED',
  "errorMessage" TEXT,
  "requestedById" TEXT,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RCAFishboneSyncEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "RCAFishboneSyncEvent_linkId_idx"
  ON "RCAFishboneSyncEvent"("linkId");

CREATE INDEX IF NOT EXISTS "RCAFishboneSyncEvent_rcaAnalysisId_idx"
  ON "RCAFishboneSyncEvent"("rcaAnalysisId");

CREATE INDEX IF NOT EXISTS "RCAFishboneSyncEvent_incidentId_idx"
  ON "RCAFishboneSyncEvent"("incidentId");

CREATE INDEX IF NOT EXISTS "RCAFishboneSyncEvent_organizationId_idx"
  ON "RCAFishboneSyncEvent"("organizationId");

CREATE INDEX IF NOT EXISTS "RCAFishboneSyncEvent_boardId_idx"
  ON "RCAFishboneSyncEvent"("boardId");

CREATE INDEX IF NOT EXISTS "RCAFishboneSyncEvent_status_idx"
  ON "RCAFishboneSyncEvent"("status");

CREATE INDEX IF NOT EXISTS "RCAFishboneSyncEvent_createdAt_idx"
  ON "RCAFishboneSyncEvent"("createdAt");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RCAFishboneBoardLink_rcaAnalysisId_fkey') THEN
    ALTER TABLE "RCAFishboneBoardLink"
      ADD CONSTRAINT "RCAFishboneBoardLink_rcaAnalysisId_fkey"
      FOREIGN KEY ("rcaAnalysisId") REFERENCES "RCAAnalysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RCAFishboneBoardLink_incidentId_fkey') THEN
    ALTER TABLE "RCAFishboneBoardLink"
      ADD CONSTRAINT "RCAFishboneBoardLink_incidentId_fkey"
      FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RCAFishboneBoardLink_organizationId_fkey') THEN
    ALTER TABLE "RCAFishboneBoardLink"
      ADD CONSTRAINT "RCAFishboneBoardLink_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RCAFishboneBoardLink_boardId_fkey') THEN
    ALTER TABLE "RCAFishboneBoardLink"
      ADD CONSTRAINT "RCAFishboneBoardLink_boardId_fkey"
      FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RCAFishboneBoardLink_createdById_fkey') THEN
    ALTER TABLE "RCAFishboneBoardLink"
      ADD CONSTRAINT "RCAFishboneBoardLink_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RCAFishboneBoardLink_lastSyncedById_fkey') THEN
    ALTER TABLE "RCAFishboneBoardLink"
      ADD CONSTRAINT "RCAFishboneBoardLink_lastSyncedById_fkey"
      FOREIGN KEY ("lastSyncedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RCAFishboneDiagramElement_linkId_fkey') THEN
    ALTER TABLE "RCAFishboneDiagramElement"
      ADD CONSTRAINT "RCAFishboneDiagramElement_linkId_fkey"
      FOREIGN KEY ("linkId") REFERENCES "RCAFishboneBoardLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RCAFishboneDiagramElement_rcaAnalysisId_fkey') THEN
    ALTER TABLE "RCAFishboneDiagramElement"
      ADD CONSTRAINT "RCAFishboneDiagramElement_rcaAnalysisId_fkey"
      FOREIGN KEY ("rcaAnalysisId") REFERENCES "RCAAnalysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RCAFishboneDiagramElement_boardId_fkey') THEN
    ALTER TABLE "RCAFishboneDiagramElement"
      ADD CONSTRAINT "RCAFishboneDiagramElement_boardId_fkey"
      FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RCAFishboneSyncEvent_linkId_fkey') THEN
    ALTER TABLE "RCAFishboneSyncEvent"
      ADD CONSTRAINT "RCAFishboneSyncEvent_linkId_fkey"
      FOREIGN KEY ("linkId") REFERENCES "RCAFishboneBoardLink"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RCAFishboneSyncEvent_rcaAnalysisId_fkey') THEN
    ALTER TABLE "RCAFishboneSyncEvent"
      ADD CONSTRAINT "RCAFishboneSyncEvent_rcaAnalysisId_fkey"
      FOREIGN KEY ("rcaAnalysisId") REFERENCES "RCAAnalysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RCAFishboneSyncEvent_incidentId_fkey') THEN
    ALTER TABLE "RCAFishboneSyncEvent"
      ADD CONSTRAINT "RCAFishboneSyncEvent_incidentId_fkey"
      FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RCAFishboneSyncEvent_organizationId_fkey') THEN
    ALTER TABLE "RCAFishboneSyncEvent"
      ADD CONSTRAINT "RCAFishboneSyncEvent_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RCAFishboneSyncEvent_boardId_fkey') THEN
    ALTER TABLE "RCAFishboneSyncEvent"
      ADD CONSTRAINT "RCAFishboneSyncEvent_boardId_fkey"
      FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RCAFishboneSyncEvent_requestedById_fkey') THEN
    ALTER TABLE "RCAFishboneSyncEvent"
      ADD CONSTRAINT "RCAFishboneSyncEvent_requestedById_fkey"
      FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
