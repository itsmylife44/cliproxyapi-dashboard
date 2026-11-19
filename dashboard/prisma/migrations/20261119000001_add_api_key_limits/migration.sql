ALTER TABLE "user_api_keys" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "user_api_keys" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3);
ALTER TABLE "user_api_keys" ADD COLUMN IF NOT EXISTS "spendLimit" DOUBLE PRECISION;
CREATE INDEX IF NOT EXISTS "usage_records_apiKeyId_idx" ON "usage_records"("apiKeyId");
