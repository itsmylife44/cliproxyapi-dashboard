-- CreateTable usage_records
CREATE TABLE "usage_records" (
    "id" TEXT NOT NULL,
    "authIndex" TEXT NOT NULL,
    "apiKeyId" TEXT,
    "userId" TEXT,
    "model" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "reasoningTokens" INTEGER NOT NULL DEFAULT 0,
    "cachedTokens" INTEGER NOT NULL DEFAULT 0,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "failed" BOOLEAN NOT NULL DEFAULT false,
    "collectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usage_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usage_dedup_key" ON "usage_records"("authIndex", "model", "timestamp", "source", "totalTokens");

-- CreateIndex
CREATE INDEX "usage_records_userId_idx" ON "usage_records"("userId");

-- CreateIndex
CREATE INDEX "usage_records_authIndex_idx" ON "usage_records"("authIndex");

-- CreateIndex
CREATE INDEX "usage_records_timestamp_idx" ON "usage_records"("timestamp");

-- CreateIndex
CREATE INDEX "usage_records_model_idx" ON "usage_records"("model");

-- CreateIndex
CREATE INDEX "usage_records_userId_timestamp_idx" ON "usage_records"("userId", "timestamp");

-- CreateIndex
CREATE INDEX "usage_records_authIndex_timestamp_idx" ON "usage_records"("authIndex", "timestamp");

-- CreateTable collector_state
CREATE TABLE "collector_state" (
    "id" TEXT NOT NULL,
    "lastCollectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastStatus" TEXT NOT NULL DEFAULT 'idle',
    "recordsStored" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "collector_state_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "usage_records" ADD CONSTRAINT "usage_records_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_records" ADD CONSTRAINT "usage_records_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "user_api_keys"("id") ON DELETE SET NULL ON UPDATE CASCADE;
