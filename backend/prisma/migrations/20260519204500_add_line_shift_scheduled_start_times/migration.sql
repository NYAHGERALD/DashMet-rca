CREATE TABLE IF NOT EXISTS "line_scheduled_start_times" (
  "id" TEXT NOT NULL,
  "lineId" TEXT NOT NULL,
  "shiftId" TEXT NOT NULL,
  "scheduledStartTime" VARCHAR(20) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "line_scheduled_start_times_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "line_scheduled_start_times_lineId_fkey" FOREIGN KEY ("lineId") REFERENCES "Line"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "line_scheduled_start_times_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "line_scheduled_start_times_lineId_shiftId_key"
  ON "line_scheduled_start_times"("lineId", "shiftId");

CREATE INDEX IF NOT EXISTS "line_scheduled_start_times_lineId_idx"
  ON "line_scheduled_start_times"("lineId");

CREATE INDEX IF NOT EXISTS "line_scheduled_start_times_shiftId_idx"
  ON "line_scheduled_start_times"("shiftId");
