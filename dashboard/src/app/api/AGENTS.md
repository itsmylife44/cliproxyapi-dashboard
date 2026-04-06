# API ROUTES KNOWLEDGE BASE

**Scope:** `dashboard/src/app/api/`

## OVERVIEW
App Router route handlers exposing dashboard control-plane APIs: auth, providers, quota/usage, config sync, admin actions, updates, and container control.

## WHERE TO LOOK
| Concern | Path | Notes |
|---|---|---|
| Auth/session endpoints | `auth/*` | login/logout/me/change-password |
| Provider/OAuth endpoints | `providers/*`, `custom-providers/*` | ownership + sync + import/claim |
| Quota logic | `quota/route.ts` | large provider-specific parser/aggregator |
| Usage history | `usage/history/route.ts` | persistent analytics route |
| Config sharing/sync | `config-sharing/*`, `config-sync/*` | publish/subscribe + tokenized bundles |
| Admin ops | `admin/*` | settings, users, logs, migration utilities |
| Docker/container control | `containers/*`, `restart/route.ts`, `update/*` | docker-proxy mediated operations |

## CONVENTIONS
- Keep each route thin; call `src/lib/*` for domain logic.
- Use structured error envelopes (from `src/lib/errors.ts`).
- Enforce auth/permission checks early in handlers.
- When adding new route strings consumed by UI, update `API_ENDPOINTS` map.

## ANTI-PATTERNS
- Do not add new consumers of deprecated `/api/usage` route.
- Do not leak secrets or raw upstream error payloads in responses.
- Do not hardcode management/API base URLs.

## TESTING PATTERN
- Route tests are colocated (`route.test.ts`) for many handlers.
- Vitest environment is Node; mock Next request/response surfaces explicitly.
