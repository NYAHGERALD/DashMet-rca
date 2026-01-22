-- AlterTable
ALTER TABLE "ForeignMaterialIncident" ADD COLUMN     "submittedById" TEXT;

-- AddForeignKey
ALTER TABLE "ForeignMaterialIncident" ADD CONSTRAINT "ForeignMaterialIncident_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
