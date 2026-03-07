# Contributing Guide

## Prerequisites

- **Node.js** 20+
- **Docker Desktop** (for local development with Postgres + CLIProxyAPI)
- **Git**

## Development Setup

```bash
# Clone the repository
git clone https://github.com/itsmylife44/cliproxyapi-dashboard.git
cd cliproxyapi-dashboard/dashboard

# Start dev environment (Docker containers + Next.js dev server)
# PowerShell:
.\dev-local.ps1

# Bash:
./dev-local.sh
```

This starts:
- **PostgreSQL** on `localhost:5433`
- **CLIProxyAPI** on `localhost:28317`
- **Dashboard** on `localhost:3000`

To stop: `.\dev-local.ps1 -Down` / To reset: `.\dev-local.ps1 -Reset`

<!-- AUTO-GENERATED:SCRIPTS:START -->
## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Next.js development server with hot reload |
| `npm run build` | Production build with type checking |
| `npm start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm test` | Run test suite (vitest) |
| `npm run test:watch` | Run tests in watch mode |
| `npm run migrate:provider-ownership` | Run provider ownership migration script |
<!-- AUTO-GENERATED:SCRIPTS:END -->

## Code Style

- **TypeScript** with strict mode
- **Tailwind CSS 4** for styling
- **ESLint** for linting (`npm run lint`)
- **Conventional Commits** for commit messages (`feat:`, `fix:`, `refactor:`, `chore:`)
- **Immutable patterns** — create new objects, never mutate
- **File size limit** — keep files under 800 lines, prefer 200-400
- **API responses** — use `Errors.*` and `apiSuccess()` from `lib/errors.ts`
- **Fetch URLs** — use `API_ENDPOINTS.*` from `lib/api-endpoints.ts`, no hardcoded strings
- **Validation** — Zod 3.25 schemas in `lib/validation/schemas.ts`

## Testing

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
```

- Tests use **Vitest**
- Test files: `*.test.ts` / `*.test.tsx`

## PR Checklist

- [ ] `npx tsc --noEmit` passes with no errors
- [ ] `npm run lint` passes
- [ ] `npm test` passes
- [ ] Conventional commit messages used
- [ ] No hardcoded API URLs (use `API_ENDPOINTS.*`)
- [ ] No hardcoded secrets
- [ ] New components under 400 lines
