-- DropForeignKey
ALTER TABLE "Shift" DROP CONSTRAINT "Shift_lineId_fkey";

-- CreateTable
CREATE TABLE "ShiftLine" (
    "id" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "lineId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShiftLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShiftLine_shiftId_idx" ON "ShiftLine"("shiftId");

-- CreateIndex
CREATE INDEX "ShiftLine_lineId_idx" ON "ShiftLine"("lineId");

-- CreateIndex
CREATE UNIQUE INDEX "ShiftLine_shiftId_lineId_key" ON "ShiftLine"("shiftId", "lineId");

-- AddForeignKey
ALTER TABLE "ShiftLine" ADD CONSTRAINT "ShiftLine_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftLine" ADD CONSTRAINT "ShiftLine_lineId_fkey" FOREIGN KEY ("lineId") REFERENCES "Line"("id") ON DELETE CASCADE ON UPDATE CASCADE;
