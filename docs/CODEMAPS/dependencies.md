<!-- Generated: 2026-03-30 | Files scanned: 222 | Token estimate: ~520 -->
# Dependencies

## External Services
- **CLIProxyAPI** (:8317) — AI proxy backend, proxied via /api/management/[...path]
- **PostgreSQL** (:5432/5433) — primary data store via Prisma ORM
- **Telegram API** — quota alert notifications (lib/telegram.ts)
- **Docker Engine** — container management via /api/containers/*

## Runtime Dependencies
| Package | Version | Purpose |
|---------|---------|---------|
| next | 16.1.6 | App framework |
| react | 19.2.4 | UI library |
| @prisma/client | 7.4.2 | Database ORM |
| zod | 3.25.0 | Schema validation |
| jose | 6.2.0 | JWT tokens |
| bcrypt | 6.0.0 | Password hashing |
| pino | 10.3.1 | Structured logging |
| recharts | 3.8.0 | Charts |
| js-yaml | 4.1.1 | YAML parsing |
| clsx + tailwind-merge | 2.1/3.5 | CSS utilities |
| geist | 1.7.0 | Font family |

## Dev Dependencies
| Package | Version | Purpose |
|---------|---------|---------|
| typescript | 5.9.3 | Type checking |
| @tailwindcss/postcss | 4.x | Styling |
| eslint | 10.x | Linting |
| vitest | 4.0.18 | Testing |

## Shared Libraries (internal)
- lib/api-endpoints.ts — centralized API URL constants
- lib/errors.ts — Errors.* + apiSuccess() response envelope
- lib/cache.ts — in-memory TTL cache
- lib/db.ts — Prisma client singleton
- lib/env.ts — env var validation
