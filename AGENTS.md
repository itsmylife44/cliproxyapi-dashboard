# PROJECT KNOWLEDGE BASE

**Generated:** 2026-04-06T08:46:00Z  
**Commit:** 0f582d9  
**Branch:** main

## OVERVIEW
CLIProxyAPI Dashboard monorepo: Next.js 16/React 19 control plane for CLIProxyAPIPlus, with Docker-first deployment and optional Python Perplexity sidecar.
Primary operational boundary is `dashboard/` (app/API), with separate service boundaries in `perplexity-sidecar/` and `infrastructure/`.

## STRUCTURE
```text
cliproxyapi-dashboard/
├── dashboard/           # Next.js app, API routes, Prisma, auth, provider sync
├── infrastructure/      # Production compose stack, Caddy, UFW/docs, env-driven ops
├── perplexity-sidecar/  # FastAPI OpenAI-compatible Perplexity wrapper
├── docs/                # Installation, config, security, troubleshooting, codemaps
├── docker-compose.local.yml
├── setup-local.sh
└── install.sh
```

## WHERE TO LOOK
| Task | Location | Notes |
|---|---|---|
| Auth/session bugs | `dashboard/src/lib/auth/*`, `dashboard/src/app/api/auth/*` | JWT + session DAL split |
| Provider key/OAuth flows | `dashboard/src/lib/providers/*`, `dashboard/src/app/api/providers/*` | Ownership + dual-write rules |
| Quota/usage behavior | `dashboard/src/app/api/quota/route.ts`, `dashboard/src/app/api/usage/*` | `/api/usage` is deprecated |
| Config generation | `dashboard/src/lib/config-generators/*` | oh-my-opencode + slim variants |
| Container/update actions | `dashboard/src/app/api/containers/*`, `dashboard/src/app/api/update/*` | Docker proxy constrained |
| Local bootstrap issues | `setup-local.sh`, `dashboard/dev-local.sh` | Migration bootstrap/drift recovery logic |
| Perplexity integration | `perplexity-sidecar/app.py`, `dashboard/src/app/api/providers/perplexity-cookie/*` | Sidecar↔dashboard sync |
| Production stack issues | `infrastructure/docker-compose.yml`, `infrastructure/config/*` | Caddy + internal network |

## CODE MAP
| Symbol | Type | Location | Role |
|---|---|---|---|
| `GET` | API handler | `dashboard/src/app/api/quota/route.ts` | Quota aggregation + provider-specific parsing |
| `AsyncMutex` | Class | `dashboard/src/lib/providers/management-api.ts` | In-process provider operation lock |
| `QuickStartPage` | Page function | `dashboard/src/app/dashboard/page.tsx` | Dashboard orchestration/status cards |
| `apiError` | Function | `dashboard/src/lib/errors.ts` | Canonical error envelope |
| `API_ENDPOINTS` | Const map | `dashboard/src/lib/api-endpoints.ts` | Centralized route literals |
| `discover_models` | Function | `perplexity-sidecar/app.py` | Sidecar dynamic model registry |

## CONVENTIONS
- TypeScript strict mode on; path alias `@/* -> ./src/*`.
- Next.js App Router + route handlers under `src/app/api/**/route.ts`.
- API route strings must come from `API_ENDPOINTS` (no hardcoded URL literals).
- API error responses should use `apiError`/`apiSuccess` style wrappers.
- Prisma generation is wired into predev/prebuild/pretest scripts.
- ESLint flat config (`eslint.config.mjs`); no Prettier config present.
- **i18n**: All user-facing UI strings use `next-intl`:
  - Client components: `import { useTranslations } from 'next-intl'` → `const t = useTranslations('namespace')`
  - Server components: `import { getTranslations } from 'next-intl/server'` → `const t = await getTranslations('namespace')`
  - Translation messages in `dashboard/messages/{locale}.json` (en.json is source of truth)
  - Do not hardcode strings shown in UI; all text visible to users must be translatable
  - Common labels go in `common` namespace; feature-specific in feature namespace (e.g., `apiKeys`, `providers`)
  - Toast/notification messages use t() from appropriate namespace

## ANTI-PATTERNS (THIS PROJECT)
- Do not treat `providerMutex` as distributed lock; it is single-process only.
- Do not add new consumers of deprecated `/api/usage`; use `/api/usage/history`.
- Do not hardcode API URLs or secrets.
- Do not edit Prisma generated internals (`dashboard/src/generated/prisma/internal/*`).
- Do not enable UFW before allowing SSH in server setup docs/scripts.

## UNIQUE STYLES
- Security headers/CSP configured in `dashboard/next.config.ts` with env-aware strictness.
- Release flow is manual `workflow_dispatch` with release-please + multi-arch digest merge.
- Local dev bootstrap has explicit migration drift repair for known Prisma state.

## COMMANDS
```bash
# app dev/test/build
cd dashboard
npm run dev
npm run typecheck
npm run test
npm run build

# local stack
./setup-local.sh
cd dashboard && ./dev-local.sh

# production stack
cd infrastructure
docker compose up -d
```

## NOTES
- Repo includes generated analysis artifacts (`ENTRY_POINTS.md`, `DOMAIN_MAP.md`, etc.); treat as reference, not source of truth over code.
- Sidecar is optional via compose profile `perplexity`; ensure secrets/env are present before enabling.
