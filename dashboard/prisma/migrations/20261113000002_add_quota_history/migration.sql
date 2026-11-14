ALTER TABLE "usage_records"
  ADD COLUMN IF NOT EXISTS "cacheWriteTokens" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "cacheWrite1hTokens" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "quota_snapshots" (
  "id" TEXT NOT NULL,
  "authIndex" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "groupId" TEXT NOT NULL,
  "modelId" TEXT NOT NULL DEFAULT '',
  "remaining" DOUBLE PRECISION NOT NULL,
  "resetTime" TIMESTAMP(3),
  "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "quota_snapshots_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "quota_snapshots_authIndex_capturedAt_idx" ON "quota_snapshots"("authIndex", "capturedAt");
CREATE INDEX IF NOT EXISTS "quota_snapshots_authIndex_groupId_modelId_capturedAt_idx" ON "quota_snapshots"("authIndex", "groupId", "modelId", "capturedAt");
