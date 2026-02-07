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
