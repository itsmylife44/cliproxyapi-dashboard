-- First delete all previously revoked tokens to prevent resurrection
DELETE FROM "sync_tokens" WHERE "revokedAt" IS NOT NULL;

-- Then drop the column
ALTER TABLE "sync_tokens" DROP COLUMN IF EXISTS "revokedAt";
