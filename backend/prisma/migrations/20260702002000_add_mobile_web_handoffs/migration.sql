CREATE TABLE IF NOT EXISTS "mobile_web_handoffs" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "mobile_web_handoffs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "mobile_web_handoffs_codeHash_key"
  ON "mobile_web_handoffs"("codeHash");

CREATE INDEX IF NOT EXISTS "mobile_web_handoffs_userId_idx"
  ON "mobile_web_handoffs"("userId");

CREATE INDEX IF NOT EXISTS "mobile_web_handoffs_expiresAt_idx"
  ON "mobile_web_handoffs"("expiresAt");

CREATE INDEX IF NOT EXISTS "mobile_web_handoffs_usedAt_idx"
  ON "mobile_web_handoffs"("usedAt");

DO $$ BEGIN
  ALTER TABLE "mobile_web_handoffs"
    ADD CONSTRAINT "mobile_web_handoffs_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
