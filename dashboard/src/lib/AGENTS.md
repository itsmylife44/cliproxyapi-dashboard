# LIB - Core Business Logic

**Parent:** `../../AGENTS.md`

## OVERVIEW

Server-side utilities: authentication, config generation, provider sync, API key management, error handling, caching, logging. Foundation layer for all API routes.

## STRUCTURE

```
lib/
├── auth/              # Identity & sessions (session, sync-token, origin, rate-limit, password)
├── config-generators/ # JSON/YAML output builders (opencode, oh-my-opencode, shared)
├── config-sync/       # Bundle orchestration (generate-bundle)
├── providers/         # AI provider dual-write (dual-write, constants)
├── api-keys/          # Dashboard API keys
├── validation/        # Zod schemas for request validation
├── cache.ts           # LRU cache with TTL (proxy models, usage)
├── db.ts              # Prisma singleton
├── env.ts             # Zod-validated environment variables
├── errors.ts          # Errors.* response factories (401 lines)
├── fetch-utils.ts     # fetchWithRetry with backoff
├── log-storage.ts     # In-memory log ring buffer (10s cache)
├── logger.ts          # Pino logger (server-only)
└── utils.ts           # cn() helper
```

## MODULE MAP

| Module | Purpose | Key Export |
|--------|---------|------------|
| `auth/` | JWT sessions, password hashing, CSRF, rate limiting | `verifySession()`, `validateOrigin()`, `checkRateLimitWithPreset()` |
| `config-generators/` | Build opencode.json configs | `buildAvailableModelsFromProxy()`, `fetchProxyModels()` |
| `config-sync/` | Merge all user data into bundle | `generateConfigBundle()` — models from proxy only, no upstream credentials |
| `providers/` | Sync keys to DB + CLIProxyAPI | `contributeKey()`, `removeKey()` |
| `api-keys/` | Dashboard access tokens | `generateApiKey()`, `syncKeysToCliProxyApi()` |
| `validation/` | Request validation | Zod schemas for providers, config, settings |
| `errors.ts` | Error response factories | `Errors.unauthorized()`, `.internal()`, etc. |
| `cache.ts` | LRU with TTL + pattern invalidation | `proxyModelsCache`, `usageCache`, `CACHE_TTL` |
| `fetch-utils.ts` | Resilient HTTP | `fetchWithRetry()` with exponential backoff |

## DEPENDENCY FLOW

```
auth/ ←── (foundation, no deps)
   ↑
api-keys/ ←── depends on auth, db
   ↑
providers/ ←── depends on db, cache, uses AsyncMutex
   ↑
config-generators/ ←── pure functions, types only
   ↑
config-sync/ ←── ORCHESTRATOR, depends on ALL above + cache
```

Shared by all: `db.ts`, `env.ts`, `errors.ts`, `logger.ts`, `cache.ts`.

## KEY FILES

| File | Lines | Criticality | Purpose |
|------|-------|-------------|---------|
| `auth/session.ts` | ~80 | HIGH | Cookie session management |
| `auth/sync-token.ts` | ~110 | HIGH | CLI token validation |
| `providers/dual-write.ts` | 961 | CRITICAL | DB + API sync with mutex |
| `config-sync/generate-bundle.ts` | 394 | CRITICAL | Main config orchestrator |
| `errors.ts` | 401 | HIGH | All error response factories |
| `cache.ts` | 107 | MEDIUM | LRU cache with TTL + invalidation |

## PATTERNS

### Auth Check (API Routes)
```typescript
import { Errors } from "@/lib/errors";
const session = await verifySession();
if (!session) return Errors.unauthorized();
// For admin:
if (!session.user.isAdmin) return Errors.forbidden();
```

### Sync Token Check (CLI Routes)
```typescript
const authResult = await validateSyncTokenFromHeader(request);
if (!authResult.ok) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
const userId = authResult.userId;
```

### CSRF Protection
```typescript
const originError = validateOrigin(request);
if (originError) return originError;
```

### Error Handling
```typescript
import { Errors } from "@/lib/errors";
try {
  // ... business logic
} catch (error) {
  return Errors.internal("context description", error);  // Logs via Pino + 500
}
```

### Dual-Write Pattern
```typescript
// providers/dual-write.ts uses mutex to prevent races
await contributeKey(userId, provider, apiKey, keyName);
// Writes to: 1) Prisma DB  2) CLIProxyAPI Management API
// Then invalidates proxy models cache
```

## KEY ARCHITECTURE DECISIONS

- **Config bundle never contains upstream credentials**: Custom provider models come from CLIProxyAPI's `/v1/models` via `buildAvailableModelsFromProxy()`. The `generate-bundle.ts` must NOT embed `base-url` or `api-key-entries` from custom providers into the opencode config output.
- **Proxy models cache**: `fetchProxyModelsCached()` in `config-sync/generate-bundle.ts` caches `/v1/models` responses for **5 minutes** (300s). Invalidated via `invalidateProxyModelsCache()` after provider sync.
- **Usage cache**: `usageCache` with 30s TTL for usage aggregation queries.
- **Custom provider excluded-models**: Still extracted from management API config to feed into the model filter — this is the only remaining use of `extractCustomProviders()` in generate-bundle.
- **Error factories**: All API error responses go through `Errors.*` which handles logging + consistent JSON shape. Never use raw `console.error` + `NextResponse.json`.

## ANTI-PATTERNS

- **NEVER** call Prisma directly in routes → use lib functions
- **NEVER** use `console.error` in routes → use `Errors.internal()` or `logger.error()`
- **NEVER** skip `validateOrigin()` on POST/PATCH/DELETE
- **NEVER** modify `config-sync/` without testing bundle output (`npm run build`)
- **NEVER** bypass the mutex in `dual-write.ts`
- **NEVER** add upstream provider URLs or API keys to generated config bundles
