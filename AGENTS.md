# PROJECT KNOWLEDGE BASE

Self-hosted AI proxy management dashboard. Next.js 16 + React 19 + TypeScript strict + Tailwind v4 + Prisma 7 + PostgreSQL. Controls CLIProxyAPI service via Docker socket.

## STRUCTURE

```
cliproxyapi_dashboard/
├── dashboard/          # Main Next.js app (ALL dev work here)
│   ├── src/app/        # App Router: pages + API routes
│   ├── src/components/ # UI primitives (ui/) + feature components
│   ├── src/lib/        # Business logic (auth, providers, config-sync, errors)
│   └── prisma/         # Schema + migrations
├── plugin/             # OpenCode sync plugin (TS, Bun)
├── infrastructure/     # Docker Compose, Caddy, systemd
├── scripts/            # Backup/restore scripts
└── install.sh          # Production installer
```

## COMMANDS

All dashboard commands run from `dashboard/`:

```bash
npm run dev                       # Dev server :3000 (Turbopack)
npm run build                     # Production build (standalone)
npm run lint                      # ESLint flat config
./dev-local.sh                    # Start Postgres + CLIProxyAPI + dev server
./dev-local.sh --reset            # Wipe dev DB, start fresh
./dev-local.sh --down             # Stop dev containers
npx prisma migrate dev --name X   # Create migration
npx prisma generate               # Regenerate client
npx prisma db push                # Push schema without migration
npx prisma studio                 # DB GUI
```

Production (from repo root): `sudo ./install.sh`, `./rebuild.sh [--no-cache]`.
Plugin (from `plugin/`): `bun install && bun build src/index.ts --outdir dist --target node`.

**No test framework.** Verify changes via `npm run build` + `npm run lint`.

## WHERE TO LOOK

| Task | Location |
|------|----------|
| New page | `src/app/dashboard/{name}/page.tsx` (Server Component default) |
| New API endpoint | `src/app/api/{name}/route.ts` (export HTTP methods) |
| UI primitives | `src/components/ui/` (Button, Modal, Toast, Input, Card, Loading) |
| Feature component | `src/components/` (kebab-case.tsx) |
| Business logic | `src/lib/` (auth, providers, config-sync, errors, logger) |
| DB schema | `prisma/schema.prisma` (then: migrate + generate + update entrypoint.sh) |
| Env vars | `src/lib/env.ts` (Zod-validated) |
| CSS / theme | `src/app/globals.css` (glassmorphic utility classes) |

## CODE STYLE

### Imports

Order: (1) external libs, (2) `@/` internal, (3) type imports. Path alias `@/*` = `src/*`.

```typescript
import { NextRequest, NextResponse } from "next/server";    // External
import { verifySession } from "@/lib/auth/session";          // Internal
import type { User } from "@/generated/prisma/client";       // Type import
```

Always use `@/` paths, never relative `../` across module boundaries.

### TypeScript

- **Strict mode** enabled (`tsconfig.json`). No exceptions.
- **NEVER** `any` -- use `unknown` + type guards or proper generics.
- **NEVER** `@ts-ignore`, `@ts-expect-error`, or `as any`.
- Const enums: `const X = {...} as const; type X = typeof X[keyof typeof X]` (see `ERROR_CODE` in `lib/errors.ts`).
- Interfaces over type aliases for object shapes. PascalCase names, no `I` prefix.
- Flat interfaces -- no inline nested object types.
- Environment variables: add to Zod schema in `src/lib/env.ts`, access via `env.VAR_NAME`.

### React 19

- Named imports: `import { useState } from "react"` (never default import).
- **NO** `useMemo`, `useCallback` -- React Compiler handles memoization.
- **NO** `forwardRef` -- `ref` is a regular prop.
- Server Components by default. Add `"use client"` only when using hooks/browser APIs.
- **NO** Server Actions -- this project uses API routes exclusively.

### Naming

- **Files**: Components `kebab-case.tsx`, utilities `kebab-case.ts` or `camelCase.ts`, routes `route.ts`
- **Exports**: Components PascalCase (`export function ConfigSubscriber`), functions camelCase
- **Constants**: `UPPER_SNAKE_CASE` (`PASSWORD_MAX_LENGTH`, `ERROR_CODE`)
- **Types/Interfaces**: PascalCase, no `I` prefix (`interface ButtonProps`, `type ErrorCode`)
- **DB**: Models PascalCase, tables snake_case via `@@map("table_name")`

### Tailwind v4

- **NEVER** `var()` or hex colors in className.
- `cn()` (from `@/lib/utils`) only for conditional classes. Static = direct `className="..."`.
- Dark glassmorphic theme via CSS classes: `glass-card`, `glass-input`, `glass-button-*`, `glass-nav-*` (in `globals.css`).
- CSS vars (`:root`) for colors -- reference in CSS only, not Tailwind classes.

### Error Handling

**API Routes** -- use `Errors.*` factories from `@/lib/errors`. Always wrap in try-catch:

```typescript
// Route pattern (see full template in dashboard/src/app/api/AGENTS.md)
const session = await verifySession();
if (!session) return Errors.unauthorized();
const originError = validateOrigin(request);       // CSRF -- required on POST/PATCH/DELETE
if (originError) return originError;
try {
  // ... business logic
  return NextResponse.json({ success: true }, { status: 201 });
} catch (error) {
  return Errors.internal("Context description", error);  // Logs via pino + returns 500
}
```

Available: `Errors.unauthorized()`, `.forbidden()`, `.notFound()`, `.validation()`, `.missingFields()`, `.zodValidation()`, `.conflict()`, `.rateLimited()`, `.internal()`, `.database()`.

**Client Components** -- `try/catch` + `showToast()`. Never expose raw errors.

**Logging** -- server-only Pino (`@/lib/logger`): `logger.error({ err, context }, "message")`.

### Auth (Three Layers)

1. **Session**: `verifySession()` -- most routes (JWT cookie)
2. **Admin**: `session.user.isAdmin` check -- privileged ops
3. **Sync Token**: `validateSyncTokenFromHeader(request)` -- CLI plugin routes

### Database

- Import `prisma` from `@/lib/db` only. Prisma 7 + `@prisma/adapter-pg`.
- Schema change workflow: edit `schema.prisma` -> `npx prisma migrate dev` -> `npx prisma generate` -> update `entrypoint.sh` + `dev-local.sh` resolve list.

## ANTI-PATTERNS (FORBIDDEN)

- `any`, `@ts-ignore`, `as any` -- use `unknown` + type guard
- `useMemo`/`useCallback`/`forwardRef` -- React 19 Compiler handles memoization; ref is a prop
- Server Actions -- use API routes only (project convention)
- Import from `src/generated/prisma` directly -- use `@/lib/db`
- Edit `generated/prisma/*` -- modify `schema.prisma` instead
- Commit `.env` or secrets -- use `infrastructure/.env` (chmod 600)
- `position: absolute` for dropdowns -- use `position: fixed`
- Prisma calls in route handlers -- abstract into `src/lib/` functions
- Skip `validateOrigin()` on POST/PATCH/DELETE -- always call it
- Expose internal errors to client -- log + return generic message

## GIT & CI/CD WORKFLOW

### Branching & PRs

- **NEVER push directly to `main`**. All changes go through Pull Requests.
- Create a feature branch, commit, push, open PR via `gh pr create`.
- Use **Conventional Commits** -- Release-Please parses them for changelogs and version bumps.

### Commit Message Format

```
<type>(<scope>): <description>

feat(providers): add OpenRouter custom provider support
fix(auth): handle expired JWT gracefully
chore(deps): bump prisma to 7.1.0
refactor(config-sync): simplify bundle generation
docs(readme): update installation steps
```

Types: `feat` (minor bump), `fix` (patch bump), `chore`, `refactor`, `docs`, `ci`, `style`, `perf`, `test`.

### Release-Please (Automated Releases)

This project uses [Release-Please](https://github.com/googleapis/release-please) for automated versioning and releases.

- **Config**: `release-please-config.json` (root path `.`, component `dashboard`)
- **Manifest**: `.release-please-manifest.json` (current version)
- **Workflow**: `.github/workflows/release.yml` (release-please + Docker build)
- **Flow**: Conventional commits on `main` → Release-Please opens a release PR → merge PR → GitHub Release created → Docker image built and pushed to GHCR (`ghcr.io/itsmylife44/cliproxyapi_dashboard`)
- **Tags**: Format `dashboard-vX.Y.Z` (component prefix)
- **GHCR image**: Built automatically on release, tagged with version

### Docker & Deployment

- **Docker Socket Proxy**: Dashboard uses `tcp://docker-proxy:2375` (tecnativa/docker-socket-proxy). No direct socket mount.
- **Self-Update**: Dashboard checks for updates via GitHub Releases API (`/api/update/dashboard/check`), pulls from GHCR, tags as local compose image name, recreates container.
- **Proxy Update**: CLIProxyAPI updates via Docker Hub digest comparison (`/api/update/check`).

## ARCHITECTURE

- **Dual-Write**: Provider keys in BOTH PostgreSQL + CLIProxyAPI config.yaml. `lib/providers/dual-write.ts` uses AsyncMutex. Never bypass.
- **Config Sync**: User prefs -> `generate-bundle.ts` -> JSON -> CLI plugin fetches via `/api/config-sync/bundle`.
- **Hotspots**: `oh-my-opencode-config-generator.tsx` (1344 lines), `providers/page.tsx` (1305), `dual-write.ts` (778), `generate-bundle.ts` (400).

## CHILD AGENTS.md

Subdirectory-specific conventions (don't repeat what's here):
- `dashboard/AGENTS.md` -- App Router structure, file naming, page patterns
- `dashboard/src/lib/AGENTS.md` -- Module map, dependency flow, auth/CSRF patterns
- `dashboard/src/app/api/AGENTS.md` -- Route template, auth layers, response format
