-- AlterTable
ALTER TABLE "ForeignMaterialIncident" ADD COLUMN     "closedAt" TIMESTAMP(3),
ADD COLUMN     "closedById" TEXT,
ADD COLUMN     "isClosed" BOOLEAN NOT NULL DEFAULT false;
