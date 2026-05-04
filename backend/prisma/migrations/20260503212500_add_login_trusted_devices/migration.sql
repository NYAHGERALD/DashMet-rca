-- CreateTable
CREATE TABLE "login_trusted_devices" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userAgentHash" TEXT,
    "deviceInfo" TEXT,
    "ipAddress" TEXT,
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "login_trusted_devices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "login_trusted_devices_tokenHash_key" ON "login_trusted_devices"("tokenHash");

-- CreateIndex
CREATE INDEX "login_trusted_devices_userId_idx" ON "login_trusted_devices"("userId");

-- CreateIndex
CREATE INDEX "login_trusted_devices_expiresAt_idx" ON "login_trusted_devices"("expiresAt");

-- CreateIndex
CREATE INDEX "login_trusted_devices_revokedAt_idx" ON "login_trusted_devices"("revokedAt");

-- AddForeignKey
ALTER TABLE "login_trusted_devices" ADD CONSTRAINT "login_trusted_devices_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
