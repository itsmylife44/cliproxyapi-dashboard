-- CreateTable
CREATE TABLE "sync_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Default',
    "tokenHash" TEXT NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sync_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sync_tokens_userId_idx" ON "sync_tokens"("userId");

-- AddForeignKey
ALTER TABLE "sync_tokens" ADD CONSTRAINT "sync_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE;
