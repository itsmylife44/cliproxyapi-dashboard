<!-- Generated: 2026-03-07 | Files scanned: 91 | Token estimate: ~900 -->
# Backend (API Routes)

## Auth
POST /api/auth/login        → lib/auth/validation → lib/auth/password → JWT cookie
POST /api/auth/logout        → clear session cookie
GET  /api/auth/me            → lib/auth/session → user info
POST /api/auth/change-password → lib/auth/password → update hash

## Admin
GET|POST       /api/admin/users          → Prisma User CRUD
GET|PUT        /api/admin/settings       → Prisma SystemSetting
GET|DELETE     /api/admin/logs           → lib/log-storage
GET|POST       /api/admin/deploy         → lib/containers
POST           /api/admin/revoke-sessions → Prisma User.sessionVersion++
GET            /api/admin/telegram        → lib/telegram
POST           /api/admin/migrate-api-keys → migration script

## Providers
GET|POST       /api/providers/keys       → lib/providers/api-key-ops → Prisma
DELETE         /api/providers/keys/[hash] → cascade delete
GET|POST       /api/providers/oauth      → lib/providers/oauth-ops → Prisma
DELETE|PATCH   /api/providers/oauth/[id]  → ownership check → Prisma
POST           /api/providers/oauth/import → bulk import
GET|POST|DELETE /api/providers/perplexity-cookie → Prisma PerplexityCookie

## Custom Providers
GET|POST       /api/custom-providers     → Prisma CustomProvider
PATCH          /api/custom-providers/[id] → update + model sync
POST           /api/custom-providers/fetch-models → external API fetch
PUT            /api/custom-providers/reorder → reorder positions

## Provider Groups
GET|POST       /api/provider-groups      → Prisma ProviderGroup
PATCH|DELETE   /api/provider-groups/[id] → update/delete group
PUT            /api/provider-groups/reorder → reorder positions

## Config
GET|PUT        /api/model-preferences    → Prisma ModelPreference
GET            /api/agent-config         → Prisma AgentModelOverride
GET|PUT        /api/user/config          → lib/config-generators/opencode
GET|POST       /api/user/api-keys        → lib/api-keys/generate

## Config Sync
GET|POST       /api/config-sync/tokens   → Prisma SyncToken
PATCH|DELETE   /api/config-sync/tokens/[id]
GET            /api/config-sync/bundle    → lib/config-sync/generate-bundle
GET            /api/config-sync/version   → version info

## Config Sharing
GET|POST       /api/config-sharing/publish   → Prisma ConfigTemplate
GET|POST       /api/config-sharing/subscribe → Prisma ConfigSubscription

## Quota & Usage
GET            /api/quota                → management proxy + aggregation (1156 lines)
POST           /api/quota/check-alerts   → lib/quota-alerts → lib/telegram
GET            /api/usage                → Prisma UsageRecord aggregate
POST           /api/usage/collect        → fetch from proxy → Prisma UsageRecord
GET            /api/usage/history        → Prisma UsageRecord time series

## System
GET            /api/health               → health check
POST           /api/setup                → initial admin creation
GET            /api/setup-status         → Prisma User count check
POST           /api/restart              → management proxy
GET|POST       /api/update/*             → management proxy (proxy + dashboard updates)
GET            /api/proxy/status         → management proxy
GET|POST|PUT|PATCH|DELETE /api/management/[...path] → proxy passthrough to CLIProxyAPI

## Middleware Chain
middleware.ts → JWT validation → route protection → session refresh

## Shared Utilities
- lib/errors.ts: Errors.* factories + apiSuccess() envelope
- lib/db.ts: Prisma singleton
- lib/cache.ts: In-memory TTL cache
- lib/audit.ts: Audit log creation
- lib/api-endpoints.ts: Centralized URL constants
- lib/validation/schemas.ts: Zod schemas (v3.25)
