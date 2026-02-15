# API - Backend Endpoints

**Parent:** `../../../AGENTS.md`

## OVERVIEW

35+ API routes handling auth, providers, config sync, container management, quota monitoring, and custom provider management. Three auth layers: Session (users), Sync Token (CLI), Admin (privileged). Fourth layer: Collector Auth (internal key for `/usage/collect`).

## STRUCTURE

```
api/
├── auth/           # login, logout, me, change-password
├── admin/          # users, settings, migrate-api-keys
├── providers/      # keys, oauth (contribute/remove)
├── custom-providers/  # user-defined OpenAI-compatible
├── config-sync/    # tokens, bundle, version
├── config-sharing/ # publish, subscribe
├── containers/     # list, [name]/action, [name]/logs
├── management/     # [...path] proxy to CLIProxyAPI
├── quota/          # usage limits
├── usage/          # analytics
├── health/         # liveness check
├── setup/          # initial admin creation
└── restart/, update/  # service control
```

## ENDPOINT PATTERNS

| Category | Auth Required | Pattern |
|----------|---------------|---------|
| `/auth/*` | None (login) / Session | Public entry points |
| `/admin/*` | Session + isAdmin | Privileged operations |
| `/providers/*` | Session | User's own keys |
| `/config-sync/bundle` | Sync Token | CLI plugin access |
| `/containers/*` | Session + isAdmin | Docker control |
| `/management/*` | Session | Proxy to CLIProxyAPI |

## ROUTE TEMPLATE

```typescript
import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/session";
import { validateOrigin } from "@/lib/auth/origin";
import { prisma } from "@/lib/db";

export async function GET(_request: NextRequest) {
  const session = await verifySession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const data = await prisma.model.findMany({
      where: { userId: session.userId },
    });
    return NextResponse.json(data);
  } catch (error) {
    console.error("Route error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await verifySession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const originError = validateOrigin(request);
  if (originError) return originError;

  try {
    const body = await request.json();
    // Validate body...
    // Create/update...
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error("Route error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
```

## AUTH PATTERNS

### Session Auth (Dashboard Users)
```typescript
const session = await verifySession();
if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
const { userId, username } = session;
```

### Admin Auth
```typescript
const session = await verifySession();
if (!session?.user?.isAdmin) {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
```

### Sync Token Auth (CLI Plugin)
```typescript
import { validateSyncTokenFromHeader } from "@/lib/auth/sync-token";

const authResult = await validateSyncTokenFromHeader(request);
if (!authResult.ok) {
  const msg = authResult.reason === "expired" ? "Token expired" : "Unauthorized";
  return NextResponse.json({ error: msg }, { status: 401 });
}
const { userId, syncApiKey } = authResult;
```

## RESPONSE PATTERNS

```typescript
// Success
return NextResponse.json(data);
return NextResponse.json({ success: true }, { status: 201 });

// Client error
return NextResponse.json({ error: "Invalid input" }, { status: 400 });
return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
return NextResponse.json({ error: "Forbidden" }, { status: 403 });
return NextResponse.json({ error: "Not found" }, { status: 404 });

// Server error
return NextResponse.json({ error: "Internal error" }, { status: 500 });
```

## RATE LIMITING

Sliding window, in-memory Map (`@/lib/auth/rate-limit.ts`). Use `checkRateLimitWithPreset()`.

| Preset | Limit | Window |
|--------|-------|--------|
| `LOGIN` | 10 | 15 min |
| `CHANGE_PASSWORD` | 5 | 15 min |
| `API_KEYS` | 10 | 1 min |
| `CUSTOM_PROVIDERS` | 10 | 1 min |
| `CONFIG_SYNC_TOKENS` | 5 | 1 min |

## SSRF PROTECTION

Routes accepting user-provided URLs (`/custom-providers/fetch-models`) MUST validate hostnames via `isPrivateHost()`:
- Blocks: localhost, `127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.0.0/16`
- Blocks IPv4-mapped IPv6: `::ffff:` prefix (both dotted and hex forms)
- Blocks IPv6 loopback/link-local: `::1`, `fe80:`, `fc`, `fd`

## ANTI-PATTERNS

- **NEVER** skip `verifySession()` on protected routes
- **NEVER** skip `validateOrigin()` on POST/PATCH/DELETE
- **NEVER** expose internal error details → log + generic message
- **NEVER** trust client input → validate with Zod or manual checks
- **NEVER** use Server Actions → API routes only (project convention)
- **NEVER** fetch user-provided URLs without SSRF validation
- **NEVER** embed upstream provider credentials in config output

## KEY ROUTES

| Route | Method | Criticality | Purpose |
|-------|--------|-------------|---------|
| `/auth/login` | POST | HIGH | Session creation |
| `/config-sync/bundle` | GET | CRITICAL | CLI config delivery |
| `/providers/keys` | POST | HIGH | Key contribution |
| `/management/[...path]` | ALL | HIGH | CLIProxyAPI proxy |
| `/custom-providers` | POST | HIGH | Create + sync to proxy |
| `/custom-providers/fetch-models` | POST | MEDIUM | Discovery from upstream |
| `/quota` | GET | MEDIUM | OAuth quota monitoring |
