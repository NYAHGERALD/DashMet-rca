/*
  Warnings:

  - You are about to drop the column `isPrivate` on the `Incident` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "IncidentVisibility" AS ENUM ('PRIVATE', 'TEAM', 'PUBLIC');

-- AlterTable
ALTER TABLE "Incident" DROP COLUMN "isPrivate",
ADD COLUMN     "visibility" "IncidentVisibility" NOT NULL DEFAULT 'PRIVATE';

-- CreateIndex
CREATE INDEX "Incident_visibility_idx" ON "Incident"("visibility");
