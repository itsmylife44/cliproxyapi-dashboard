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
- **Translations** — Use `useTranslations()` / `getTranslations()` from `next-intl` for all user-facing strings

## Internationalization (i18n)

The dashboard supports multi-language UI using `next-intl`. All user-facing strings should be translatable.

### When adding features

1. **Extract all user-facing strings** into translation namespaces:
   - Navigation labels → `nav.*` namespace
   - Form labels/buttons → feature namespace (e.g., `apiKeys.*`, `providers.*`)
   - Common buttons → `common.*` namespace (`save`, `cancel`, `confirm`, etc.)
   - Error/success messages → `errors.*` or feature namespace

2. **Use the right hook** based on component type:
   - **Client components**: `import { useTranslations } from 'next-intl'` → `const t = useTranslations('namespace')`
   - **Server components**: `import { getTranslations } from 'next-intl/server'` → `const t = await getTranslations('namespace')`

3. **Replace hardcoded strings**:
   ```tsx
   // ❌ Before
   <button>Cancel</button>
   
   // ✅ After
   import { useTranslations } from 'next-intl';
   const t = useTranslations('common');
   <button>{t('cancel')}</button>
   ```

4. **Update translation files**:
   - Add new keys to `messages/en.json` (source of truth)
   - Add corresponding German translations to `messages/de.json`
   - Use ICU format for interpolated values: `t('message', { count: 5 })`

5. **Test in multiple languages**:
   - Log in to the dashboard
   - Open User Panel → select German
   - Verify your new strings display correctly

### Translation namespaces

| Namespace | Scope |
|-----------|-------|
| `common` | Reusable buttons, labels (`save`, `cancel`, `confirm`) |
| `nav` | Navigation menu, sidebar |
| `header` | Top header status/system info |
| `login` | Login page |
| `setup` | Setup/onboarding |
| `errors` | Error pages (404, 500, etc.) |
| `dashboard` | Quick start / main dashboard |
| `apiKeys` | API keys management |
| `providers` | Provider configuration |
| `settings` | Settings pages (security, updates, sync) |
| `quota` | Quota/rate limits |
| `usage` | Usage analytics |
| Feature-specific | `monitoring`, `containers`, `config`, `users`, `logs`, etc. |

See `messages/en.json` for the complete structure.

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
