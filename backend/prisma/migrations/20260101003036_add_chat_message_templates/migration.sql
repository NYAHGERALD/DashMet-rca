-- CreateTable
CREATE TABLE "ChatMessageTemplate" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'general',
    "content" TEXT NOT NULL,
    "isGlobal" BOOLEAN NOT NULL DEFAULT false,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatMessageTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChatMessageTemplate_userId_idx" ON "ChatMessageTemplate"("userId");

-- CreateIndex
CREATE INDEX "ChatMessageTemplate_isGlobal_idx" ON "ChatMessageTemplate"("isGlobal");

-- CreateIndex
CREATE INDEX "ChatMessageTemplate_category_idx" ON "ChatMessageTemplate"("category");

-- AddForeignKey
ALTER TABLE "ChatMessageTemplate" ADD CONSTRAINT "ChatMessageTemplate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
