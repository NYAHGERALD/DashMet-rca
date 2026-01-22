-- CreateTable
CREATE TABLE "FMIRComment" (
    "id" TEXT NOT NULL,
    "fmirId" TEXT NOT NULL,
    "sectionNumber" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "visibleToIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FMIRComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FMIRComment_fmirId_idx" ON "FMIRComment"("fmirId");

-- CreateIndex
CREATE INDEX "FMIRComment_sectionNumber_idx" ON "FMIRComment"("sectionNumber");

-- CreateIndex
CREATE INDEX "FMIRComment_authorId_idx" ON "FMIRComment"("authorId");

-- AddForeignKey
ALTER TABLE "FMIRComment" ADD CONSTRAINT "FMIRComment_fmirId_fkey" FOREIGN KEY ("fmirId") REFERENCES "ForeignMaterialIncident"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FMIRComment" ADD CONSTRAINT "FMIRComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
