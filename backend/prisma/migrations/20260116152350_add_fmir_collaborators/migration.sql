-- AlterTable
ALTER TABLE "ForeignMaterialIncident" ADD COLUMN     "collaboratorIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
