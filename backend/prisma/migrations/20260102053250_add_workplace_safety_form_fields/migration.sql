-- AlterTable
ALTER TABLE "Incident" ADD COLUMN     "contributingFactorTypes" TEXT[],
ADD COLUMN     "correctiveActionTypes" TEXT[],
ADD COLUMN     "incidentPattern" TEXT,
ADD COLUMN     "injuryDevelopmentType" TEXT,
ADD COLUMN     "taskRoutineType" TEXT;
