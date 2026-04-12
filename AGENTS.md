# Repository Guidelines

## Overview

CLIProxyAPI Dashboard is a Next.js 16/React 19 web control plane for CLIProxyAPIPlus, providing a modern UI to manage OAuth-based AI CLI proxies (Claude Code, Gemini CLI, Codex, etc.) without YAML editing. The monorepo contains three service boundaries:

- **`dashboard/`** — Primary Next.js application with API routes, Prisma ORM, authentication, and provider management
- **`infrastructure/`** — Production Docker Compose stack with Caddy reverse proxy, PostgreSQL, and service orchestration
- **`perplexity-sidecar/`** — Optional Python FastAPI microservice providing OpenAI-compatible access to Perplexity AI

## Architecture

### Monorepo Structure
```
cliproxyapi-dashboard/
├── dashboard/                 # Next.js app (primary codebase)
│   ├── src/
│   │   ├── app/              # App Router pages and API routes
│   │   ├── components/       # React components by feature
│   │   ├── hooks/            # Custom React hooks
│   │   ├── lib/              # Utilities, auth, database, validation
│   │   └── generated/        # Prisma client (do not edit)
│   ├── messages/             # i18n translations (en.json, de.json)
│   ├── prisma/               # Database schema and migrations
│   └── tests/                # E2E tests (Playwright)
├── infrastructure/           # Production Docker Compose stack
│   ├── docker-compose.yml    # Full production stack
│   └── config/               # Caddy, env templates
├── perplexity-sidecar/       # FastAPI OpenAI-compatible wrapper
├── docs/                     # Installation, configuration, troubleshooting
├── docker-compose.local.yml  # Local development stack
├── setup-local.sh            # Local stack bootstrap
└── install.sh                # Automated server installation
```

### Production Stack (6 containers)
| Service | Purpose |
|---------|---------|
| `caddy` | TLS termination, reverse proxy |
| `dashboard` | Next.js standalone app |
| `cliproxyapi` | Core proxy service (CLIProxyAPIPlus) |
| `postgres` | PostgreSQL database |
| `docker-proxy` | Constrained Docker socket proxy |
| `perplexity` | Optional Perplexity sidecar |

### Data Flow
1. User requests → Caddy → Dashboard (Next.js)
2. Dashboard API routes → Prisma → PostgreSQL
3. Dashboard → CLIProxyAPI Management API (provider sync, quota)
4. CLI clients → CLIProxyAPI → AI providers (Claude, Gemini, etc.)

## Key Directories

| Directory | Purpose |
|-----------|---------|
| `dashboard/src/app/` | Next.js App Router: pages (`page.tsx`) and API routes (`route.ts`) |
| `dashboard/src/app/api/` | Backend API handlers (auth, providers, quota, containers, etc.) |
| `dashboard/src/components/` | React components organized by feature (`providers/`, `settings/`, `ui/`) |
| `dashboard/src/lib/` | Core utilities: auth, database, validation, config generators |
| `dashboard/src/hooks/` | Custom hooks: `useAuth`, `useTheme`, `useHealthStatus`, `useNotifications` |
| `dashboard/src/lib/providers/` | Provider management, OAuth flows, key sync |
| `dashboard/src/lib/config-generators/` | oh-my-opencode and slim config variants |
| `dashboard/messages/` | i18n translation files (en.json is source of truth) |

## Development Commands

### Dashboard Application
```bash
cd dashboard

# Development
npm run dev              # Start dev server with hot reload
npm run dev:turbopack    # Dev server with Turbopack (faster)

# Quality
npm run typecheck        # TypeScript checking
npm run lint             # ESLint
npm run test             # Vitest unit tests
npm run test:watch       # Vitest watch mode
npm run test:e2e         # Playwright E2E tests

# Build
npm run build            # Production build
npm run start            # Start production server

# Database
npx prisma migrate dev   # Create/apply migrations (dev)
npx prisma migrate deploy # Apply migrations (prod)
npx prisma studio        # Database GUI
```

### Local Development Stack
```bash
# Full local stack (dashboard + postgres + proxy)
./setup-local.sh         # Start local stack
./setup-local.sh --down  # Stop stack
./setup-local.sh --reset # Reset database

# Dashboard with local stack
cd dashboard
./dev-local.sh           # Start containers + Next.js dev
./dev-local.sh --reset   # Reset and restart
./dev-local.sh --down    # Stop everything
```

### Production Stack
```bash
cd infrastructure
docker compose up -d     # Start production stack
docker compose down      # Stop stack
./rebuild.sh             # Update and rebuild
./rebuild.sh --dashboard-only  # Update dashboard only
```

## Code Conventions

### TypeScript
- Strict mode enabled
- Path alias: `@/*` → `./src/*`
- Target: ES2017, module resolution: bundler
- No `any` types; use proper typing or `unknown`

### React Patterns
- **Server Components** for data fetching (default in App Router)
- **Client Components** (`"use client"`) for interactivity
- **Custom Hooks** for shared state logic
- **Context Providers** for global state (toast, theme, proxy status)

### API Routes
- Located at `src/app/api/**/route.ts`
- Export named functions: `GET`, `POST`, `PUT`, `DELETE`
- Use `apiError()`/`apiSuccess()` wrappers from `@/lib/errors`
- Route strings from `API_ENDPOINTS` constant (no hardcoded URLs)
- Session validation via `verifySession()` from `@/lib/auth/session`

```typescript
// Example API route pattern
import { apiError, apiSuccess } from "@/lib/errors";
import { verifySession } from "@/lib/auth/session";

export async function GET() {
  const session = await verifySession();
  if (!session) return apiError("Unauthorized", 401);
  
  // ... logic
  return apiSuccess({ data });
}
```

### Internationalization (i18n)
All user-facing strings must use `next-intl`:

```typescript
// Client components
import { useTranslations } from 'next-intl';
const t = useTranslations('namespace');
// Usage: t('keyName'), t('keyWithParam', { count: 5 })

// Server components
import { getTranslations } from 'next-intl/server';
const t = await getTranslations('namespace');
```

- Translation files: `dashboard/messages/{locale}.json`
- `en.json` is source of truth; `de.json` must match structure
- Namespaces: `common`, `auth`, `providers`, `settings`, `quota`, etc.
- Use ICU MessageFormat for plurals: `{count, plural, one {# item} other {# items}}`

### Database (Prisma)
- Schema: `dashboard/prisma/schema.prisma`
- Generated client: `dashboard/src/generated/prisma/` (do not edit)
- Access via DAL in `dashboard/src/lib/db/`
- Prisma generation runs automatically in predev/prebuild/pretest

### Error Handling
- Use `apiError(message, status)` for API responses
- Use `extractApiError(response, fallback)` client-side
- Validate at system boundaries with Zod schemas (`lib/validation/schemas.ts`)

### File Organization
- Max ~800 lines per file; prefer 200-400
- Colocate tests in `__tests__/` subdirectories
- Feature-based component organization (`components/providers/`, `components/settings/`)

## Important Files

### Entry Points
| File | Purpose |
|------|---------|
| `dashboard/src/app/layout.tsx` | Root layout (i18n, theme, providers) |
| `dashboard/src/app/page.tsx` | Landing/login redirect |
| `dashboard/src/app/dashboard/page.tsx` | Main dashboard view |
| `dashboard/src/app/dashboard/layout.tsx` | Dashboard shell with nav |

### Configuration
| File | Purpose |
|------|---------|
| `dashboard/next.config.ts` | Next.js config (CSP headers, i18n plugin, standalone output) |
| `dashboard/tsconfig.json` | TypeScript config (strict, path aliases) |
| `dashboard/eslint.config.mjs` | ESLint flat config |
| `dashboard/vitest.config.ts` | Vitest test config |
| `dashboard/prisma/schema.prisma` | Database schema |
| `infrastructure/docker-compose.yml` | Production stack definition |

### Key Modules
| File | Purpose |
|------|---------|
| `dashboard/src/lib/api-endpoints.ts` | Centralized API route constants |
| `dashboard/src/lib/errors.ts` | `apiError`, `apiSuccess`, `extractApiError` |
| `dashboard/src/lib/auth/session.ts` | JWT session management |
| `dashboard/src/lib/providers/management-api.ts` | CLIProxyAPI integration, `AsyncMutex` |
| `dashboard/src/lib/config-generators/` | oh-my-opencode config generation |

## Testing

### Unit Tests (Vitest)
- Config: `dashboard/vitest.config.ts`
- Location: `__tests__/` subdirectories or `*.test.ts` alongside source
- Run: `npm test` or `npm run test:watch`

```typescript
// Test pattern
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/auth/session', () => ({
  verifySession: vi.fn().mockResolvedValue({ userId: '1' })
}));

describe('MyModule', () => {
  it('should do something', () => {
    expect(result).toBe(expected);
  });
});
```

### E2E Tests (Playwright)
- Config: `dashboard/playwright.config.ts`
- Location: `dashboard/tests/e2e/`
- Run: `npm run test:e2e`
- Uses auth storage state for authenticated tests

### Test Organization
| Pattern | Location |
|---------|----------|
| Hook tests | `src/hooks/__tests__/*.test.ts` |
| Lib tests | `src/lib/__tests__/*.test.ts` |
| API route tests | `src/app/api/*/route.test.ts` |
| E2E tests | `tests/e2e/*.spec.ts` |

## Anti-Patterns

**Do NOT:**
- Treat `providerMutex` as distributed lock (single-process only)
- Use deprecated `/api/usage`; use `/api/usage/history` instead
- Hardcode API URLs (use `API_ENDPOINTS.*`)
- Hardcode secrets or environment values
- Edit generated Prisma internals (`src/generated/prisma/internal/*`)
- Enable UFW before allowing SSH in server setup
- Hardcode user-facing strings (use i18n)
- Use `any` type without justification

## Task Reference

| Task | Where to Look |
|------|---------------|
| Auth/session bugs | `lib/auth/*`, `app/api/auth/*` |
| Provider key/OAuth flows | `lib/providers/*`, `app/api/providers/*` |
| Quota/usage behavior | `app/api/quota/route.ts`, `app/api/usage/*` |
| Config generation | `lib/config-generators/*` |
| Container/update actions | `app/api/containers/*`, `app/api/update/*` |
| Local bootstrap issues | `setup-local.sh`, `dev-local.sh` |
| Perplexity integration | `perplexity-sidecar/app.py`, `app/api/providers/perplexity-cookie/*` |
| Production stack issues | `infrastructure/docker-compose.yml`, `infrastructure/config/*` |
| i18n translations | `messages/en.json`, `messages/de.json` |

## Runtime & Tooling

| Tool | Version/Notes |
|------|---------------|
| Node.js | 20+ required |
| Package manager | npm (not yarn/pnpm) |
| Next.js | 16 with App Router |
| React | 19 |
| Database | PostgreSQL 16+ via Prisma 7 |
| Styling | Tailwind CSS 4 |
| Test (unit) | Vitest |
| Test (e2e) | Playwright |
| Container | Docker with Compose v2 |
