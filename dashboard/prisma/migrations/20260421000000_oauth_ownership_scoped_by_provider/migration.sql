-- Scope OAuth account ownership by provider.
--
-- Before: `accountName` was globally unique, so the same account identifier
-- (often an email) could only be registered once across all providers. In
-- practice users frequently reuse the same email across Claude, Codex, Kimi,
-- etc., which caused spurious "OAuth account already registered" errors and,
-- worse, blocked legitimate sign-ins for later providers.
--
-- After: `(provider, accountName)` is unique, which is the true invariant.
-- Dropping the old unique is safe because the old constraint strictly implies
-- the new one — any pre-existing rows already satisfy it.
--
-- Data backfill: historic writes stored the raw management value in
-- `provider` (e.g. `anthropic`, `openai`, `gemini`, `github`) rather than the
-- canonical identifier now required by canonicalizeOAuthProvider. Normalize
-- those rows in-place before adding the composite unique so the application
-- lookups (which always canonicalize) continue to match existing ownership.

DROP INDEX IF EXISTS "provider_oauth_ownerships_accountName_key";

UPDATE "provider_oauth_ownerships" SET "provider" = lower(trim("provider"));

UPDATE "provider_oauth_ownerships" SET "provider" = CASE "provider"
  WHEN 'anthropic' THEN 'claude'
  WHEN 'openai' THEN 'codex'
  WHEN 'gemini' THEN 'gemini-cli'
  WHEN 'google' THEN 'gemini-cli'
  WHEN 'github' THEN 'copilot'
  WHEN 'github-copilot' THEN 'copilot'
  ELSE "provider"
END
WHERE "provider" IN ('anthropic', 'openai', 'gemini', 'google', 'github', 'github-copilot');

CREATE UNIQUE INDEX IF NOT EXISTS "provider_oauth_ownerships_provider_accountName_key"
ON "provider_oauth_ownerships"("provider", "accountName");
