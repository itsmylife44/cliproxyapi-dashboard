#!/bin/sh

echo "[dashboard] Ensuring database tables exist..."
node <<'NODE'
const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL });

client.connect()
  .then(() => client.query(`
    -- Users table with isAdmin field
    CREATE TABLE IF NOT EXISTS "users" (
      "id" TEXT NOT NULL,
      "username" TEXT NOT NULL,
      "passwordHash" TEXT NOT NULL,
      "isAdmin" BOOLEAN NOT NULL DEFAULT false,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "users_pkey" PRIMARY KEY ("id")
    );
    CREATE UNIQUE INDEX IF NOT EXISTS "users_username_key" ON "users"("username");
    -- Add isAdmin column if missing (existing installs)
    DO $$ BEGIN
      ALTER TABLE "users" ADD COLUMN "isAdmin" BOOLEAN NOT NULL DEFAULT false;
    EXCEPTION WHEN duplicate_column THEN NULL; END $$;

    -- Model preferences table
    CREATE TABLE IF NOT EXISTS "model_preferences" (
      "id" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "excludedModels" TEXT[],
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "model_preferences_pkey" PRIMARY KEY ("id")
    );
    CREATE UNIQUE INDEX IF NOT EXISTS "model_preferences_userId_key" ON "model_preferences"("userId");
    DO $$ BEGIN
      ALTER TABLE "model_preferences" ADD CONSTRAINT "model_preferences_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    -- Sync tokens table
     CREATE TABLE IF NOT EXISTS "sync_tokens" (
       "id" TEXT NOT NULL,
       "userId" TEXT NOT NULL,
       "name" TEXT NOT NULL DEFAULT 'Default',
       "tokenHash" TEXT NOT NULL,
       "syncApiKey" TEXT,
       "lastUsedAt" TIMESTAMP(3),
       "revokedAt" TIMESTAMP(3),
       "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
       CONSTRAINT "sync_tokens_pkey" PRIMARY KEY ("id")
     );
     CREATE INDEX IF NOT EXISTS "sync_tokens_userId_idx" ON "sync_tokens"("userId");
     CREATE INDEX IF NOT EXISTS "sync_tokens_tokenHash_idx" ON "sync_tokens"("tokenHash");
    DO $$ BEGIN
      ALTER TABLE "sync_tokens" ADD CONSTRAINT "sync_tokens_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    -- Add syncApiKey column if missing (existing installs)
    DO $$ BEGIN
      ALTER TABLE "sync_tokens" ADD COLUMN "syncApiKey" TEXT;
    EXCEPTION WHEN duplicate_column THEN NULL; END $$;

    -- Agent model overrides table (stores MCP servers & custom plugins in overrides JSONB)
    CREATE TABLE IF NOT EXISTS "agent_model_overrides" (
      "id" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "overrides" JSONB NOT NULL DEFAULT '{}',
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "agent_model_overrides_pkey" PRIMARY KEY ("id")
    );
    CREATE UNIQUE INDEX IF NOT EXISTS "agent_model_overrides_userId_key" ON "agent_model_overrides"("userId");
    DO $$ BEGIN
      ALTER TABLE "agent_model_overrides" ADD CONSTRAINT "agent_model_overrides_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    -- User API keys table (per-user API keys with dual storage sync)
    CREATE TABLE IF NOT EXISTS "user_api_keys" (
      "id" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "key" TEXT NOT NULL,
      "name" TEXT NOT NULL DEFAULT 'Default',
      "lastUsedAt" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "user_api_keys_pkey" PRIMARY KEY ("id")
    );
    CREATE UNIQUE INDEX IF NOT EXISTS "user_api_keys_key_key" ON "user_api_keys"("key");
    CREATE INDEX IF NOT EXISTS "user_api_keys_userId_idx" ON "user_api_keys"("userId");
    DO $$ BEGIN
      ALTER TABLE "user_api_keys" ADD CONSTRAINT "user_api_keys_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    -- Config templates table (publishers share their config via share codes)
    CREATE TABLE IF NOT EXISTS "config_templates" (
      "id" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "shareCode" TEXT NOT NULL,
      "name" TEXT NOT NULL DEFAULT 'My Config',
      "isActive" BOOLEAN NOT NULL DEFAULT true,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "config_templates_pkey" PRIMARY KEY ("id")
    );
    CREATE UNIQUE INDEX IF NOT EXISTS "config_templates_userId_key" ON "config_templates"("userId");
    CREATE UNIQUE INDEX IF NOT EXISTS "config_templates_shareCode_key" ON "config_templates"("shareCode");
    CREATE INDEX IF NOT EXISTS "config_templates_shareCode_idx" ON "config_templates"("shareCode");
    DO $$ BEGIN
      ALTER TABLE "config_templates" ADD CONSTRAINT "config_templates_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    -- Config subscriptions table (subscribers sync with a publisher's config)
    CREATE TABLE IF NOT EXISTS "config_subscriptions" (
      "id" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "templateId" TEXT NOT NULL,
      "isActive" BOOLEAN NOT NULL DEFAULT true,
      "frozenConfig" JSONB,
      "previousConfig" JSONB,
      "subscribedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "lastSyncedAt" TIMESTAMP(3),
      CONSTRAINT "config_subscriptions_pkey" PRIMARY KEY ("id")
    );
    CREATE UNIQUE INDEX IF NOT EXISTS "config_subscriptions_userId_key" ON "config_subscriptions"("userId");
    CREATE INDEX IF NOT EXISTS "config_subscriptions_templateId_idx" ON "config_subscriptions"("templateId");
    DO $$ BEGIN
      ALTER TABLE "config_subscriptions" ADD CONSTRAINT "config_subscriptions_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN
      ALTER TABLE "config_subscriptions" ADD CONSTRAINT "config_subscriptions_templateId_fkey"
        FOREIGN KEY ("templateId") REFERENCES "config_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    -- Provider key ownerships table (track who added which API keys)
    CREATE TABLE IF NOT EXISTS "provider_key_ownerships" (
      "id" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "provider" TEXT NOT NULL,
      "keyIdentifier" TEXT NOT NULL,
      "name" TEXT NOT NULL DEFAULT 'Unnamed Key',
      "keyHash" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "provider_key_ownerships_pkey" PRIMARY KEY ("id")
    );
    CREATE UNIQUE INDEX IF NOT EXISTS "provider_key_ownerships_keyHash_key" ON "provider_key_ownerships"("keyHash");
    CREATE INDEX IF NOT EXISTS "provider_key_ownerships_userId_idx" ON "provider_key_ownerships"("userId");
    CREATE INDEX IF NOT EXISTS "provider_key_ownerships_provider_idx" ON "provider_key_ownerships"("provider");
    CREATE INDEX IF NOT EXISTS "provider_key_ownerships_provider_keyHash_idx" ON "provider_key_ownerships"("provider", "keyHash");
    DO $$ BEGIN
      ALTER TABLE "provider_key_ownerships" ADD CONSTRAINT "provider_key_ownerships_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    -- Add name column to provider_key_ownerships if missing (existing installs)
    DO $$ BEGIN
      ALTER TABLE "provider_key_ownerships" ADD COLUMN "name" TEXT NOT NULL DEFAULT 'Unnamed Key';
    EXCEPTION WHEN duplicate_column THEN NULL; END $$;

    -- Provider OAuth ownerships table (track who connected which OAuth accounts)
    CREATE TABLE IF NOT EXISTS "provider_oauth_ownerships" (
      "id" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "provider" TEXT NOT NULL,
      "accountName" TEXT NOT NULL,
      "accountEmail" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "provider_oauth_ownerships_pkey" PRIMARY KEY ("id")
    );
    CREATE UNIQUE INDEX IF NOT EXISTS "provider_oauth_ownerships_accountName_key" ON "provider_oauth_ownerships"("accountName");
    CREATE INDEX IF NOT EXISTS "provider_oauth_ownerships_userId_idx" ON "provider_oauth_ownerships"("userId");
    DO $$ BEGIN
      ALTER TABLE "provider_oauth_ownerships" ADD CONSTRAINT "provider_oauth_ownerships_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    -- System settings table (key-value store for global settings)
    CREATE TABLE IF NOT EXISTS "system_settings" (
      "id" TEXT NOT NULL,
      "key" TEXT NOT NULL,
      "value" TEXT NOT NULL,
      CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
    );
    CREATE UNIQUE INDEX IF NOT EXISTS "system_settings_key_key" ON "system_settings"("key");

    -- Custom providers table (user-defined OpenAI-compatible providers)
    CREATE TABLE IF NOT EXISTS "custom_providers" (
      "id" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "providerId" TEXT NOT NULL,
      "baseUrl" TEXT NOT NULL,
      "apiKeyHash" TEXT NOT NULL,
      "prefix" TEXT,
      "proxyUrl" TEXT,
      "headers" JSONB DEFAULT '{}',
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "custom_providers_pkey" PRIMARY KEY ("id")
    );
    CREATE UNIQUE INDEX IF NOT EXISTS "custom_providers_providerId_key" ON "custom_providers"("providerId");
    CREATE INDEX IF NOT EXISTS "custom_providers_userId_idx" ON "custom_providers"("userId");
    CREATE INDEX IF NOT EXISTS "custom_providers_providerId_idx" ON "custom_providers"("providerId");
    DO $$ BEGIN
      ALTER TABLE "custom_providers" ADD CONSTRAINT "custom_providers_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    -- Custom provider models table (model mappings for custom providers)
    CREATE TABLE IF NOT EXISTS "custom_provider_models" (
      "id" TEXT NOT NULL,
      "customProviderId" TEXT NOT NULL,
      "upstreamName" TEXT NOT NULL,
      "alias" TEXT NOT NULL,
      CONSTRAINT "custom_provider_models_pkey" PRIMARY KEY ("id")
    );
    CREATE INDEX IF NOT EXISTS "custom_provider_models_customProviderId_idx" ON "custom_provider_models"("customProviderId");
    DO $$ BEGIN
      ALTER TABLE "custom_provider_models" ADD CONSTRAINT "custom_provider_models_customProviderId_fkey"
        FOREIGN KEY ("customProviderId") REFERENCES "custom_providers"("id") ON DELETE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    -- Custom provider excluded models table (excluded model patterns for custom providers)
    CREATE TABLE IF NOT EXISTS "custom_provider_excluded_models" (
      "id" TEXT NOT NULL,
      "customProviderId" TEXT NOT NULL,
      "pattern" TEXT NOT NULL,
      CONSTRAINT "custom_provider_excluded_models_pkey" PRIMARY KEY ("id")
    );
    CREATE INDEX IF NOT EXISTS "custom_provider_excluded_models_customProviderId_idx" ON "custom_provider_excluded_models"("customProviderId");
    DO $$ BEGIN
      ALTER TABLE "custom_provider_excluded_models" ADD CONSTRAINT "custom_provider_excluded_models_customProviderId_fkey"
        FOREIGN KEY ("customProviderId") REFERENCES "custom_providers"("id") ON DELETE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    -- Audit logs table (track admin actions for compliance and security)
    CREATE TABLE IF NOT EXISTS "audit_logs" (
      "id" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "action" TEXT NOT NULL,
      "target" TEXT,
      "metadata" JSONB,
      "ipAddress" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
    );
    CREATE INDEX IF NOT EXISTS "audit_logs_userId_idx" ON "audit_logs"("userId");
    CREATE INDEX IF NOT EXISTS "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");
    CREATE INDEX IF NOT EXISTS "audit_logs_action_idx" ON "audit_logs"("action");
    DO $$ BEGIN
      ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `))
  .then(() => {
    console.log('[dashboard] Tables ready');
    client.end();
  })
  .catch(e => {
    console.error('[dashboard] DB init error:', e.message);
    client.end();
  });
NODE
2>&1 || echo "[dashboard] WARNING: DB init had issues, continuing..."

echo "[dashboard] Starting server..."
exec node server.js
