-- Add isShared flag so admins can mark a custom provider as visible to all users.
-- Existing rows default to private (false), preserving prior behavior.
ALTER TABLE "custom_providers"
  ADD COLUMN IF NOT EXISTS "isShared" BOOLEAN NOT NULL DEFAULT false;

-- Index supports the OR-filter used by GET /api/custom-providers and the
-- config-sync bundle generator.
CREATE INDEX IF NOT EXISTS "custom_providers_isShared_idx"
  ON "custom_providers" ("isShared");
