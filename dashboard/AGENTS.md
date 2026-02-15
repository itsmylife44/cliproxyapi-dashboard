# DASHBOARD - Next.js Application

**Parent:** `../AGENTS.md`

## OVERVIEW

Primary web application. Next.js 16 App Router with Server Components, Prisma ORM, Tailwind v4 styling. Manages CLIProxyAPI proxy via Management API.

## STRUCTURE

```
dashboard/
├── src/
│   ├── app/           # App Router (pages + API routes)
│   ├── components/    # React components (13 files)
│   ├── lib/           # Core business logic (see lib/AGENTS.md)
│   └── generated/     # Prisma client (DO NOT EDIT)
├── prisma/
│   ├── schema.prisma  # Database models
│   └── migrations/    # SQL migrations
├── entrypoint.sh      # Docker startup (creates tables)
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
// Server Component (default)
export default async function Page() {
  const data = await prisma.model.findMany();
  return <ClientComponent data={data} />;
}

// Client Component (when needed)
"use client";
export function ClientComponent({ data }: Props) { ... }
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

## KEY FILES

| File | Purpose |
|------|---------|
| `src/app/layout.tsx` | Root layout, providers, global styles |
| `src/app/dashboard/page.tsx` | Main dashboard entry |
| `src/lib/db.ts` | Prisma client singleton |
| `entrypoint.sh` | Docker table bootstrap |
| `next.config.ts` | CSP headers, standalone mode |

## COMMANDS

```bash
npm run dev           # Dev server with Turbopack
npm run build         # Production build (standalone)
./dev-local.sh        # Start local Docker env
./dev-local.sh --reset  # Reset database
```
