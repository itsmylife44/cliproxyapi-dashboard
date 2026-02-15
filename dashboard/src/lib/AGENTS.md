# LIB - Core Business Logic

**Parent:** `../../AGENTS.md`

## OVERVIEW

Server-side utilities: authentication, config generation, provider sync, API key management. Foundation layer for all API routes.

## STRUCTURE

```
lib/
├── auth/              # Identity & sessions
├── config-generators/ # JSON/YAML output builders
├── config-sync/       # Bundle orchestration
├── providers/         # AI provider dual-write
├── api-keys/          # Dashboard API keys
├── db.ts              # Prisma singleton
└── utils.ts           # cn() helper
```

## MODULE MAP

| Directory | Purpose | Key Export |
|-----------|---------|------------|
| `auth/` | JWT sessions, password hashing, CSRF | `verifySession()`, `validateOrigin()` |
| `config-generators/` | Build opencode.json configs | `buildAvailableModelsFromProxy()`, `fetchProxyModels()` |
| `config-sync/` | Merge all user data into bundle | `generateConfigBundle()` — models from proxy only, no upstream credentials |
| `providers/` | Sync keys to DB + CLIProxyAPI | `contributeKey()`, `removeKey()` |
| `api-keys/` | Dashboard access tokens | `generateApiKey()`, `syncKeysToCliProxyApi()` |

## DEPENDENCY FLOW

```
auth/ ←── (foundation, no deps)
   ↑
api-keys/ ←── depends on auth
   ↑
providers/ ←── depends on db, uses AsyncMutex
   ↑
config-generators/ ←── pure functions, types only
   ↑
config-sync/ ←── ORCHESTRATOR, depends on ALL above
```

## KEY FILES

| File | Lines | Criticality | Purpose |
|------|-------|-------------|---------|
| `auth/session.ts` | ~80 | HIGH | Cookie session management |
| `auth/sync-token.ts` | ~110 | HIGH | CLI token validation |
| `providers/dual-write.ts` | 778 | CRITICAL | DB + API sync with mutex |
| `config-sync/generate-bundle.ts` | ~400 | CRITICAL | Main config orchestrator |

## PATTERNS

### Auth Check (API Routes)
```typescript
const session = await verifySession();
if (!session) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
// For admin:
if (!session.user.isAdmin) {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
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

### Dual-Write Pattern
```typescript
// providers/dual-write.ts uses mutex to prevent races
await contributeKey(userId, provider, apiKey, keyName);
// Writes to: 1) Prisma DB  2) CLIProxyAPI Management API
```

## KEY ARCHITECTURE DECISIONS

- **Config bundle never contains upstream credentials**: Custom provider models come from CLIProxyAPI's `/v1/models` via `buildAvailableModelsFromProxy()`. The `generate-bundle.ts` must NOT embed `base-url` or `api-key-entries` from custom providers into the opencode config output.
- **Proxy models cache**: `fetchProxyModelsCached()` in `config-sync/generate-bundle.ts` caches `/v1/models` responses for 60s. Invalidated via `invalidateProxyModelsCache()` after provider sync.
- **Custom provider excluded-models**: Still extracted from management API config to feed into the model filter — this is the only remaining use of `extractCustomProviders()` in generate-bundle.

## ANTI-PATTERNS

- **NEVER** call Prisma directly in routes → use lib functions
- **NEVER** skip `validateOrigin()` on POST/PATCH/DELETE
- **NEVER** modify `config-sync/` without testing bundle output
- **NEVER** bypass the mutex in `dual-write.ts`
- **NEVER** add upstream provider URLs or API keys to generated config bundles
