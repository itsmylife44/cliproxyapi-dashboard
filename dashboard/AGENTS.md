# DASHBOARD KNOWLEDGE BASE

**Scope:** `dashboard/` (Next.js app + API + Prisma)

## OVERVIEW
Application control plane for CLIProxyAPIPlus: React UI, App Router API handlers, auth/session, provider management, quotas, and config workflows.

## STRUCTURE
```text
dashboard/
├── src/app/                 # App Router pages + API route handlers
├── src/components/          # UI layers (dashboard, setup, providers, usage)
├── src/lib/                 # Auth, providers, errors, endpoints, generators
├── src/generated/prisma/    # Prisma generated client/types (do not edit)
├── prisma/                  # Schema + migrations
├── dev-local.sh             # Local Docker-based dev bootstrap
└── Dockerfile               # Standalone production image
```

## WHERE TO LOOK
| Task | Location | Notes |
|---|---|---|
| API route behavior | `src/app/api/**/route.ts` | Keep handlers thin; push logic into `src/lib/*` |
| Session/auth | `src/lib/auth/*`, `src/app/api/auth/*` | JWT validation + DAL + rate limit |
| Provider/OAuth logic | `src/lib/providers/*`, `src/app/api/providers/*` | Ownership + management API orchestration |
| Quota/usage | `src/app/api/quota/route.ts`, `src/app/api/usage/history/route.ts` | `/api/usage` deprecated |
| User-facing config generation | `src/lib/config-generators/*`, `src/components/*config*` | normal + slim variant |
| Error format consistency | `src/lib/errors.ts` | Prefer `apiError`/`apiSuccess` wrappers |

## CONVENTIONS
- TypeScript strict mode; import alias `@/*`.
- API URLs in UI/hooks from `src/lib/api-endpoints.ts` only.
- Prisma client generated before dev/build/test scripts.
- ESLint flat config; no repository Prettier config.
- Keep server-only logic in `src/lib/*`; avoid client imports of server internals.

## ANTI-PATTERNS
- Do not edit `src/generated/prisma/**` by hand.
- Do not introduce hardcoded `/api/...` strings in components/hooks.
- Do not add new dependencies on deprecated `/api/usage` route.
- Do not assume provider mutex is cross-instance safe.

## QUICK COMMANDS
```bash
cd dashboard
npm run dev
npm run typecheck
npm run test
npm run build
./dev-local.sh
```
