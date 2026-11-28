ALTER TABLE "quota_snapshots" ADD COLUMN IF NOT EXISTS "windowSeconds" INTEGER;
ALTER TABLE "quota_snapshots" ADD COLUMN IF NOT EXISTS "usageModels" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE TABLE IF NOT EXISTS "quota_reset_events" (
  "id" TEXT NOT NULL,
  "authIndex" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "quota_reset_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "quota_reset_events_authIndex_at_idx" ON "quota_reset_events"("authIndex", "at");

-- quota_alert_channel is the only alert switch; carry over installs that only set the old flag.
INSERT INTO "system_settings" ("id", "key", "value")
SELECT gen_random_uuid()::text, 'quota_alert_channel', 'telegram'
FROM "system_settings"
WHERE "key" = 'telegram_alerts_enabled' AND "value" = 'true'
ON CONFLICT ("key") DO NOTHING;
DELETE FROM "system_settings" WHERE "key" = 'telegram_alerts_enabled';
