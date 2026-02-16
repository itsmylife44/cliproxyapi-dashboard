# DASHBOARD - Next.js Application

**Parent:** `../AGENTS.md`

## OVERVIEW

Primary web application. Next.js 16 App Router with Server Components, Prisma ORM, Tailwind v4 styling. Manages CLIProxyAPI proxy via Management API + Docker socket proxy.

## STRUCTURE

```
dashboard/
├── src/
│   ├── app/           # App Router (pages + API routes, ~45 routes)
│   ├── components/    # React components (15 files)
│   ├── lib/           # Core business logic (see lib/AGENTS.md)
│   └── generated/     # Prisma client (DO NOT EDIT)
├── prisma/
│   ├── schema.prisma  # Database models
│   └── migrations/    # SQL migrations
├── entrypoint.sh      # Docker startup (raw SQL table bootstrap, ~300 lines)
└── dev-local.sh       # Local development script
```

## WHERE TO LOOK

| Task | Location |
|------|----------|
| New dashboard page | `src/app/dashboard/{name}/page.tsx` |
| New API endpoint | `src/app/api/{name}/route.ts` |
| Shared UI component | `src/components/` |
| Business logic | `src/lib/` |
| Database model | `prisma/schema.prisma` |
| Docker startup SQL | `entrypoint.sh` |

## CONVENTIONS

### File Naming
- Pages: `page.tsx` (App Router convention)
- API: `route.ts` with GET/POST/PATCH/DELETE exports
- Components: `kebab-case.tsx` (e.g., `config-subscriber.tsx`)
- Utilities: `camelCase.ts`

### Page Structure
```typescript
// Server Component (default) — only for data fetching
export default async function Page() {
  return <ClientComponent />;
}

// Client Component (when needed)
"use client";
export function ClientComponent() {
  // Fetch data via API routes, not direct Prisma
  // Use Errors.* pattern on API side
}
```

### Database Changes
1. Edit `prisma/schema.prisma`
2. `npx prisma migrate dev --name description`
3. `npx prisma generate`
4. Add table creation SQL to `entrypoint.sh` (for Docker)
5. Add migration to `dev-local.sh` resolve list

## ANTI-PATTERNS

- **NEVER** import from `src/generated/prisma` directly → use `@/lib/db`
- **NEVER** skip `entrypoint.sh` update for new tables
- **NEVER** use Server Actions → use API routes only (project convention)
- **NEVER** embed upstream provider base-urls or API keys in generated opencode config
- **NEVER** allow user-provided URLs to reach private/localhost hosts (SSRF)
- **NEVER** use `console.error` in API routes → use `Errors.internal()` from `@/lib/errors`

## KEY FILES

| File | Purpose |
|------|---------|
| `src/app/layout.tsx` | Root layout, providers, global styles |
| `src/app/dashboard/layout.tsx` | Dashboard layout, sidebar, `min-w-0` on main |
| `src/app/dashboard/page.tsx` | Main dashboard entry |
| `src/lib/db.ts` | Prisma client singleton |
| `src/lib/errors.ts` | `Errors.*` response factories (401L) |
| `entrypoint.sh` | Docker table bootstrap (raw SQL) |
| `next.config.ts` | CSP headers, standalone mode |
| `Dockerfile` | Multi-stage build (deps → builder → runner) |

## COMMANDS

```bash
npm run dev           # Dev server with Turbopack
npm run build         # Production build (standalone)
npm run lint          # ESLint flat config
./dev-local.sh        # Start local Docker env
./dev-local.sh --reset  # Reset database
./dev-local.sh --down   # Stop dev containers
```
