# CLIProxyAPI Dashboard - Application Entry Points & Bootstrap Flow

## Project Overview
- **Framework**: Next.js 16 (App Router)
- **Runtime**: Node.js 20 (Alpine container)
- **Database**: PostgreSQL 16
- **Type System**: TypeScript 5.9.3
- **Build Output**: Standalone (Docker-optimized)

---

## 1. ENTRY POINTS

### 1.1 Primary Application Entry Point
**File**: `/dashboard/src/app/layout.tsx`
- **Type**: Root Layout Component
- **Purpose**: Global HTML structure, fonts (Geist), accessibility skip link
- **Key Details**:
  - Sets metadata title template: `"%s | CLIProxyAPI"`
  - Applies dark theme (`colorScheme: "dark"`)
  - Loads Geist Sans and Mono fonts

### 1.2 Homepage Route
**File**: `/dashboard/src/app/page.tsx`
- **Type**: Server Component (Redirect)
- **Behavior**: Redirects all requests to `/dashboard`
- **Line 4**: `redirect("/dashboard")`

### 1.3 Primary Dashboard Route
**File**: `/dashboard/src/app/dashboard/page.tsx`
- **Type**: Main authenticated dashboard UI
- **Route Path**: `/dashboard`
- **Protected**: Yes (JWT authentication required)

### 1.4 Authentication Routes
**Files**:
- `/dashboard/src/app/login/page.tsx` - Login form (JWT auth)
- `/dashboard/src/app/setup/page.tsx` - Initial admin account creation

---

## 2. BOOTSTRAP FLOW (NON-STANDARD)

### 2.1 Next.js Instrumentation Entry Point
**File**: `/dashboard/src/instrumentation.ts`
- **Type**: Next.js lifecycle hook (runs at server startup)
- **Trigger**: Automatically called on `npm run dev` or `npm run start`
- **Runtime Detection**:
  ```typescript
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Only import Node.js-specific code for Node.js runtime
    const { registerNodeInstrumentation } = await import("./instrumentation-node")
    registerNodeInstrumentation()
  }
  ```
- **Purpose**: Conditionally load Node.js background tasks without Edge Runtime errors

### 2.2 Node.js Instrumentation (Background Tasks)
**File**: `/dashboard/src/instrumentation-node.ts`
- **Type**: Node.js-specific background scheduler
- **Startup Sequence**:
  1. **HMR Guard** (lines 22-24): Prevents duplicate intervals during hot reload
  2. **Quota Alert Scheduler** - Delayed start (30s)
     - Fetches quota data every 5 minutes (configurable from DB)
     - Sends Telegram alerts when thresholds breached
     - Uses internal management API key for auth
  3. **Custom Provider Resync** - Delayed start (15s)
     - Syncs custom OpenAI-compatible provider configs
     - Catches and logs errors gracefully

**Key Timings**:
- Scheduler initialization: +30 seconds after server start
- Provider resync: +15 seconds after server start
- Both use recursive `setTimeout` for DB-driven intervals (allows dynamic reconfiguration)

### 2.3 Docker Container Entrypoint
**File**: `/dashboard/entrypoint.sh`
- **Purpose**: Pre-flight database setup and migration
- **Execution**: Runs BEFORE `node server.js` in Docker

**Database Bootstrap Steps**:
1. **Connection Check** (lines 5-27):
   - Validates PostgreSQL credentials
   - Detects password mismatch errors with helpful recovery tips
   
2. **Advisory Lock** (line 33):
   - `SELECT pg_advisory_lock(424242)` — prevents concurrent migrations
   
3. **Schema Creation** (lines 36-399):
   - All tables created with `CREATE TABLE IF NOT EXISTS`
   - 16 tables total:
     - `users` — admin/user accounts
     - `model_preferences` — per-user model filtering
     - `sync_tokens` — API sync tokens
     - `agent_model_overrides` — Oh-My-OpenCode config overrides
     - `user_api_keys` — per-user API keys (separate from sync tokens)
     - `config_templates` — shareable config templates
     - `config_subscriptions` — config subscription tracking
     - `provider_key_ownerships` — tracks who added API keys
     - `provider_oauth_ownerships` — tracks who connected OAuth accounts
     - `system_settings` — global key-value settings
     - `custom_providers` — user-defined OpenAI-compatible providers
     - `provider_groups` — custom provider organization
     - `custom_provider_models` — model mappings for custom providers
     - `custom_provider_excluded_models` — excluded model patterns
     - `audit_logs` — compliance/security log
     - `usage_records` — persistent usage analytics
     - `perplexity_cookies` — Perplexity Pro sidecar session data
     - `collector_state` — usage collection state tracking

4. **Migration Compatibility** (lines 47-56):
   - Backward compatibility migrations for existing installs:
     - `isAdmin` column on `users` (if missing)
     - `sessionVersion` column on `users` (if missing)
     - `apiKeyEncrypted` column on `custom_providers`
     - `slim_overrides` column on `agent_model_overrides`
   
5. **Lock Release** (line 408):
   - `SELECT pg_advisory_unlock(424242)` — always runs, even on failure

---

## 3. BUILD & DEV ENTRYPOINTS

### 3.1 npm Scripts (package.json)
```json
{
  "dev": "next dev"                    // Dev server with HMR
  "build": "next build"                // Production build (standalone)
  "start": "next start"                // Production server
  "predev": "npm run prisma:generate"  // Auto-run before dev
  "prebuild": "npm run prisma:generate"// Auto-run before build
  "typecheck": "npm run prisma:generate && tsc --noEmit"
  "test": "vitest run"
  "migrate:provider-ownership": "tsx src/scripts/migrate-provider-ownership.ts"
}
```

### 3.2 Local Development Entrypoint
**File**: `/dashboard/dev-local.sh`
- **Purpose**: Docker-based local dev environment
- **Startup Sequence**:
  1. Docker daemon check
  2. Start PostgreSQL + CLIProxyAPI containers
  3. Wait for PostgreSQL readiness
  4. Wait for CLIProxyAPI readiness
  5. Run Prisma migrations (`prisma db push` + `prisma migrate deploy`)
  6. Generate Prisma client
  7. Write `.env.local` (sets DOCKER_HOST for host detection)
  8. Start Next.js dev server at `http://localhost:3000`

**Special Handling**:
- Fresh DB detection: Runs `prisma db push --accept-data-loss` first
- Migration drift recovery: Marks known failed migrations as applied (line 74)
- Platform detection: DOCKER_HOST differs per OS (lines 192-215)

### 3.3 Production Local Setup
**File**: `/setup-local.sh`
- **Purpose**: One-command local deployment with Docker Compose
- **Setup Steps**:
  1. Generate `.env` with random JWT secret, management API key, Postgres password
  2. Optionally enable Perplexity Pro sidecar (COMPOSE_PROFILES=perplexity)
  3. Generate `config.local.yaml` for CLIProxyAPIPlus
  4. Start Docker Compose stack: Caddy, Dashboard, API, DB, Docker Proxy
  5. Wait for all containers to report `healthy` status
  6. Output access URLs:
     - Dashboard: http://localhost:3000
     - API: http://localhost:11451

---

## 4. CONFIGURATION FILES

### 4.1 Next.js Configuration
**File**: `/dashboard/next.config.ts`
- **Output Mode**: `standalone` (Docker-friendly)
- **Security Headers** (environment-aware):
  - **Dev**: Relaxed CSP (allows unsafe-inline, unsafe-eval for HMR)
  - **Prod**: Strict CSP with no nonce placeholders
  - X-Frame-Options: DENY
  - Referrer-Policy: strict-origin-when-cross-origin
  - HSTS: enabled in production (31536000s max-age)

### 4.2 TypeScript Configuration
**File**: `/dashboard/tsconfig.json`
- **Target**: ES2017
- **Strict Mode**: Enabled
- **Module Resolution**: Bundler
- **Path Alias**: `@/*` → `./src/*`
- **Plugins**: Next.js plugin

### 4.3 Environment Variables
**Dev/Local**:
- `.env.development` (committed, default values)
- `.env.local` (generated, overrides default)

**Production**:
- `.env` (root level, generated by setup-local.sh)
- Required: `JWT_SECRET`, `MANAGEMENT_API_KEY`, `POSTGRES_PASSWORD`

---

## 5. API ROUTES (Non-standard Bootstrap Endpoints)

**Health Check**:
- `/api/health` — Liveness probe for Docker HEALTHCHECK

**Setup/Initialization**:
- `/api/setup` — Initial admin account creation
- `/api/setup-status` — Check if setup is complete

**Internal Management**:
- `/api/quota` — Fetch provider quotas (quota alert scheduler calls this)
- `/api/restart` — Restart services
- `/api/update` — Update dashboard/API versions

**Provider/Config Management**:
- `/api/custom-providers` — CRUD custom OpenAI-compatible providers
- `/api/provider-groups` — Provider grouping/organization
- `/api/agent-config` — Oh-My-OpenCode config
- `/api/agent-config-slim` — Oh-My-OpenCode Slim config

**Data APIs**:
- `/api/usage` — Usage analytics
- `/api/model-preferences` — Per-user model exclusions

---

## 6. DOCKER MULTI-STAGE BUILD

**File**: `/dashboard/Dockerfile`

**Stages**:
1. **deps** — Install dependencies (npm ci)
2. **builder** — Build Next.js app with Prisma generation
3. **runner** — Final image with non-root user (nextjs:1001)

**Runtime Entry**:
```dockerfile
ENTRYPOINT ["/sbin/tini", "--"]     # Init system (proper PID 1 signal handling)
CMD ["./entrypoint.sh"]              # Shell script for DB migration + Next.js start
```

**Health Check**:
```dockerfile
CMD node -e "fetch('http://localhost:3000/api/health').then(...)"
```

---

## 7. ATYPICAL BOOTSTRAP PATTERNS

✅ **Non-standard features identified**:

| Pattern | Location | Reason |
|---------|----------|--------|
| **Instrumentation Hooks** | `instrumentation.ts` + `instrumentation-node.ts` | Background quota alert scheduler + provider sync |
| **Shell Pre-flight Check** | `entrypoint.sh` | Database schema bootstrap with advisory locks |
| **Platform-Aware Dev** | `dev-local.sh` | Detects Docker socket path per OS (macOS/Linux/Windows) |
| **Dual Config Management** | Oh-My-OpenCode + Oh-My-OpenCode Slim | Two OpenCode orchestration variants with model/skill overrides |
| **Config Sharing** | `config_templates` + `config_subscriptions` tables | Publishers share configs via share codes (XXXX-XXXX) |
| **Telegram Quota Alerts** | Background scheduler with cooldown tracking | Per-provider threshold notifications (1-hour cooldown) |
| **Provider Resync** | Background task runs +15s post-startup | Auto-sync custom provider configs from upstream |
| **Usage Deduplication** | Unique index on `(authIndex, model, timestamp, source, totalTokens)` | Prevent duplicate usage records from concurrent sources |
| **Collector State Machine** | `collector_state` table | Tracks last collection timestamp + status for usage collection |

---

## 8. CRITICAL STARTUP DEPENDENCIES

**Order of initialization**:
```
Docker daemon → PostgreSQL (entrypoint.sh) → Next.js server start
  ↓
instrumentation.ts (server startup)
  ↓
instrumentation-node.ts (+30s delay)
  ├─ Quota alert scheduler (5-min interval, DB-driven)
  └─ Provider resync (+15s delay)
  ↓
API ready at http://localhost:3000
```

**Failure points**:
1. **PostgreSQL connection failure** → entrypoint.sh exits with code 1
2. **Migration lock timeout** → Advisory lock prevents concurrent attempts
3. **Prisma generation failure** → Build fails (prebuild hook)
4. **Background scheduler errors** → Logged, doesn't crash server (line 80)

---

## SUMMARY

**Entry Points**: 6
- Root layout + homepage redirect + dashboard
- Login/Setup pages
- API health + setup endpoints

**Bootstrap Complexity**: High
- 3-stage Dockerfile build
- Shell pre-flight DB migration with locks
- Conditional Node.js instrumentation
- Delayed background schedulers with recursive timeouts
- Multi-table schema with backward-compat migrations

**Atypical Patterns**: 8
- Instrumentation hooks, advisory locks, config sharing, provider resync, quota alerts, usage deduplication, collector state

