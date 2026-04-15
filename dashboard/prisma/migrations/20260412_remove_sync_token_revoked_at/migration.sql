-- Remove revokedAt column if present (migration from soft-delete to hard-delete)
-- Guard against fresh installs where the column may not exist
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sync_tokens' AND column_name='revokedAt') THEN
    -- First delete all previously revoked tokens to prevent resurrection
    DELETE FROM "sync_tokens" WHERE "revokedAt" IS NOT NULL;
    -- Then drop the column
    ALTER TABLE "sync_tokens" DROP COLUMN "revokedAt";
  END IF;
END $$;
