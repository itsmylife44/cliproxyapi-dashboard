# LIB DOMAIN KNOWLEDGE BASE

**Scope:** `dashboard/src/lib/`

## OVERVIEW
Shared server/domain layer for auth, provider management, config generation, API contracts, and cross-route utility logic.

## WHERE TO LOOK
| Task | Location | Notes |
|---|---|---|
| Auth/session internals | `auth/*` | DAL, JWT, origin guard, rate limits |
| Provider ownership/ops | `providers/*` | key + oauth ops, dual-write, resync, encryption |
| Response envelopes/errors | `errors.ts` | canonical API error format |
| Route constants | `api-endpoints.ts` | central API endpoint map |
| Config generation | `config-generators/*` | opencode + oh-my-opencode normal/slim |
| Usage of Prisma | `db.ts` + callers | entry point for DB operations |

## CONVENTIONS
- Route handlers should call lib functions; avoid embedding complex business logic in routes.
- Validation uses Zod schemas (`validation/schemas.ts`) and typed parsing.
- Errors should map to explicit error codes and structured details.
- Provider operations must preserve ownership semantics and upstream sync safety.

## ANTI-PATTERNS
- Do not bypass `api-endpoints.ts` for client-visible paths.
- Do not mutate shared config objects in-place.
- Do not treat `providerMutex` as distributed synchronization.
- Do not import from `src/generated/prisma/internal/*`.

## HOTSPOTS
- `providers/management-api.ts`: mutex, upstream calls, ownership-sensitive operations.
- `providers/api-key-ops.ts`, `providers/oauth-ops.ts`: security-sensitive mutation paths.
- `config-generators/oh-my-opencode-types.ts`: dense type and validation mapping.
