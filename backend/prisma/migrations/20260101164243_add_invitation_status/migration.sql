-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED');

-- AlterTable
ALTER TABLE "IncidentParticipant" ADD COLUMN     "invitationStatus" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "respondedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "IncidentParticipant_invitationStatus_idx" ON "IncidentParticipant"("invitationStatus");
