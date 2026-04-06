# TypeScript Domain Map — CLIProxyAPI Dashboard

**Total Files:** 285 TS/TSX | **5 Major Domains** | **Last Updated:** 2025-04-06

---

## 🗺️ Domain Overview

| Domain | Purpose | Files | Key Pattern |
|--------|---------|-------|------------|
| **app** | Next.js routing, pages, API routes | ~95 | App Router + RPC routes |
| **components** | React UI, feature modules | ~155 | Client components + sections |
| **lib** | Business logic, utilities, auth, DB | ~110 | Service layer, helpers |
| **hooks** | React client hooks | ~8 | SWR + custom state |
| **generated** | Prisma types, read-only | ~25 | Auto-generated, DO NOT EDIT |

---

## 📍 Domain 1: APP (Next.js App Router)

**Path:** `src/app/`  
**Responsibility:** Routing, layouts, pages, API endpoints (RPC-style)  
**Constraints:** Server components by default, explicit "use client" for interactivity  

### Structure:
```
src/app/
├── api/                      # API routes (65+ RPC endpoints)
│   ├── admin/               # Admin operations (deploy, logs, users)
│   ├── auth/                # Auth flow (login, logout, me)
│   ├── config-sharing/      # Config publish/subscribe
│   ├── config-sync/         # Sync token management
│   ├── containers/          # Docker container ops
│   ├── custom-providers/    # LLM provider CRUD
│   ├── management/          # CLIProxyAPI management API proxy
│   ├── providers/           # OAuth, API keys, Perplexity
│   ├── quota/               # Rate limit tracking
│   ├── usage/               # Usage analytics
│   └── update/              # Version checks, deployments
├── dashboard/               # Protected dashboard routes
│   ├── admin/              # Admin pages (users, logs)
│   ├── api-keys/           # API key management
│   ├── config/             # Config editor
│   ├── containers/         # Container management
│   ├── logs/               # Log viewer
│   ├── monitoring/         # Health + stats
│   ├── providers/          # OAuth + API keys UI
│   ├── quota/              # Quota details
│   ├── settings/           # Admin settings
│   ├── setup/              # Setup wizard
│   └── usage/              # Usage analytics
├── login/                   # Public login page
├── setup/                   # Initial setup wizard
├── layout.tsx              # Root layout + metadata
├── page.tsx                # Home (redirects to login/dashboard)
└── not-found.tsx           # 404 page
```

### Key Conventions:
- **API Routes:** Named `route.ts` in nested `[category]/[action]` folders
- **Page Layouts:** Server components by default; use `"use client"` sparingly
- **Loading States:** `loading.tsx` co-located with page components
- **Error Handling:** Global error.tsx + page-level error boundaries
- **RPC-Style:** Single `POST` endpoint per action, no REST `GET/PUT/DELETE`

### Where to Look:
| Task | Path |
|------|------|
| Add auth endpoint | `src/app/api/auth/[action]/route.ts` |
| Modify dashboard page | `src/app/dashboard/[feature]/page.tsx` |
| Add loader spinner | `src/app/dashboard/[feature]/loading.tsx` |
| Proxy management API | `src/app/api/management/[...path]/route.ts` |
| Handle OAuth callback | `src/app/api/providers/oauth/claim/route.ts` |

---

## 🎨 Domain 2: COMPONENTS (React UI Layer)

**Path:** `src/components/`  
**Responsibility:** Reusable UI components, page sections, layouts  
**Constraint:** Client components (explicit "use client"), SWR for data fetching  

### Structure:
```
src/components/
├── ui/                      # Atomic design system (glass morphism)
│   ├── button.tsx          # Button variants: primary, secondary, danger, ghost
│   ├── card.tsx            # Glass card container
│   ├── input.tsx           # Input field with styling
│   ├── modal.tsx           # Modal dialog
│   ├── toast.tsx           # Toast notifications
│   ├── confirm-dialog.tsx  # Confirmation prompts
│   ├── tooltip.tsx         # Hover tooltips
│   ├── skeleton.tsx        # Loading skeletons
│   ├── breadcrumbs.tsx     # Breadcrumb navigation
│   └── chart-theme.tsx     # Victory chart styling
│
├── dashboard-*.tsx          # Dashboard layouts
│   ├── dashboard-shell.tsx      # Main container
│   ├── dashboard-header.tsx     # Top nav bar
│   ├── dashboard-nav.tsx        # Sidebar navigation
│   ├── dashboard-client-layout  # Client hydration wrapper
│   ├── dashboard-mini-charts    # Stats cards
│   ├── mobile-*.tsx             # Mobile responsive layouts
│   └── user-panel.tsx           # User menu + logout
│
├── config/                  # Config editor components
│   ├── agent-config-editor.tsx
│   ├── config-fields.tsx       # Form fields for config
│   └── config-preview.tsx      # YAML preview
│
├── providers/               # Provider management UI
│   ├── oauth-section.tsx       # OAuth credential list
│   ├── api-key-section.tsx     # API key management
│   ├── custom-provider-section.tsx  # Custom endpoint editor
│   ├── provider-row.tsx        # Single provider row
│   ├── group-list.tsx          # Provider groups
│   └── perplexity-pro-section.tsx
│
├── custom-providers/        # Custom provider form
│   ├── basic-fields.tsx     # Name, URL, auth
│   ├── model-mappings.tsx   # Model name remapping
│   ├── headers-section.tsx  # Custom headers
│   ├── excluded-models.tsx  # Model filtering
│   ├── model-discovery.tsx  # Auto-fetch models
│   └── group-select.tsx     # Group assignment
│
├── monitoring/              # Real-time monitoring
│   ├── live-logs.tsx        # Log streaming UI
│   ├── service-status.tsx   # Container/proxy health
│   └── usage-stats.tsx      # Request metrics
│
├── oh-my-opencode/          # OMO config generator (9 agents)
│   ├── sections/
│   │   ├── hooks-section.tsx
│   │   ├── browser-section.tsx
│   │   ├── tmux-section.tsx
│   │   ├── lsp-servers-section.tsx
│   │   ├── disabled-mcps-section.tsx
│   │   └── [other feature sections]
│   ├── model-badge.tsx
│   ├── tier-assignments.tsx
│   └── toggle-sections.tsx
│
├── oh-my-opencode-slim/     # OMO Slim config (6 agents, fallback chains)
│   ├── tier-assignments.tsx
│   ├── skills-section.tsx
│   └── toggle-sections.tsx
│
├── quota/                   # Quota tracking UI
│   ├── quota-chart.tsx      # Usage graphs
│   ├── quota-details.tsx    # Per-provider stats
│   └── quota-alerts.tsx     # Alert settings
│
├── settings/                # Settings pages
│   ├── password-settings.tsx    # Change password
│   ├── telegram-settings.tsx    # Quota alerts config
│   └── provider-settings.tsx    # Provider defaults
│
├── setup/                   # Setup wizard
│   ├── step-indicator.tsx   # Progress indicator
│   ├── step-contents.tsx    # Step forms
│   ├── success-banner.tsx   # Completion message
│   └── reveal-box.tsx       # Sensitive data display
│
├── usage/                   # Usage analytics
│   ├── usage-charts.tsx     # Time-series graphs
│   ├── usage-table.tsx      # Request log table
│   ├── usage-request-events.tsx  # Event details
│   └── time-filter.tsx      # Date range picker
│
├── header/                  # Header components
│   ├── notification-bell.tsx    # Alert indicator
│   └── latency-indicator.tsx    # Proxy health
│
├── config-*.tsx             # Config sharing/syncing
│   ├── config-publisher.tsx     # Publish config code
│   ├── config-subscriber.tsx    # Subscribe via code
│   ├── opencode-config-generator.tsx
│   ├── oh-my-opencode-config-generator.tsx
│   └── oh-my-opencode-slim-config-generator.tsx
│
└── *.tsx (top-level)        # Utility components
    ├── model-selector.tsx   # Shared model dropdown
    ├── custom-provider-modal.tsx  # Modal wrapper
    ├── copy-block.tsx       # Copy-to-clipboard
    ├── deploy-dashboard.tsx # Deployment UI
    ├── update-*.tsx         # Update notifications
    └── lazy-*.tsx           # Code-split lazy components
```

### Key Conventions:
- **"use client" required** for all interactive components
- **SWR for fetching:** `useSWR(API_ENDPOINTS.*, fetcher)` with 60s dedup
- **Tailwind + Glass morphism:** Glassmorphic cards with backdrop-blur
- **Sections pattern:** Grouped feature components in subdirectories
- **Lazy loading:** `lazy-*` prefixed for code-split routes

### Where to Look:
| Task | Path |
|------|------|
| Add UI component | `src/components/ui/[name].tsx` |
| New settings page | `src/components/settings/[feature]-settings.tsx` |
| Fix provider UI | `src/components/providers/[feature].tsx` |
| OMO config UI | `src/components/oh-my-opencode/sections/[feature]-section.tsx` |
| Add quota chart | `src/components/quota/quota-chart.tsx` |

---

## 🔧 Domain 3: LIB (Business Logic & Utilities)

**Path:** `src/lib/`  
**Responsibility:** Database access, auth, API integrations, validations, formatters  
**Pattern:** Pure functions, zero "use client", server-only modules  

### Structure:
```
src/lib/
├── auth/                    # Authentication & sessions
│   ├── jwt.ts              # JWT signing/verifying (server-only)
│   ├── dal.ts              # User queries (DB access layer)
│   ├── password.ts         # Bcrypt hashing
│   ├── session.ts          # Session creation/validation
│   ├── rate-limit.ts       # In-memory rate limiting
│   ├── sync-token.ts       # Config sync tokens
│   ├── origin.ts           # CORS/origin validation
│   └── validation.ts       # Username/password schemas
│
├── providers/               # LLM provider operations
│   ├── api-key-ops.ts      # API key CRUD
│   ├── oauth-ops.ts        # OAuth credential CRUD
│   ├── hash.ts             # Key hashing + comparison
│   ├── encrypt.ts          # Encryption for storage
│   ├── management-api.ts   # CLIProxyAPI endpoints
│   ├── custom-provider-sync.ts  # Fetch available models
│   ├── model-grouping.ts   # Provider group logic
│   ├── perplexity.ts       # Perplexity-specific ops
│   ├── cascade.ts          # Cascade delete helpers
│   ├── dual-write.ts       # Sync to proxy sidecar
│   ├── resync.ts           # Model cache refresh
│   ├── settings.ts         # Provider config defaults
│   └── constants.ts        # Provider type definitions
│
├── config-generators/       # Config file generation
│   ├── oh-my-opencode.ts       # OMO config (9 agents)
│   ├── oh-my-opencode-slim.ts  # OMO Slim (6 agents)
│   ├── opencode.ts             # Generic OpenCode config
│   ├── oh-my-opencode-types.ts # TypeScript interfaces
│   ├── oh-my-opencode-presets.ts  # Preset configurations
│   ├── oh-my-opencode-slim-types.ts
│   └── shared.ts           # Common config logic
│
├── config-sync/            # Config synchronization
│   └── generate-bundle.ts  # Bundle for sync plugin
│
├── api-keys/               # API key operations
│   ├── generate.ts         # Create new key + hash
│   └── sync.ts             # Notify proxy of changes
│
├── validation/             # Input validation schemas
│   └── schemas.ts          # Zod v4 schemas for all inputs
│
├── auth/                   # High-level auth flows
├── db.ts                   # Prisma client export
├── env.ts                  # Typed environment variables
├── errors.ts               # Custom error classes + handlers
├── logger.ts               # Structured logging
├── log-storage.ts          # Log persistence to DB
├── audit.ts                # Audit trail logging
├── cache.ts                # In-memory caching layer
├── fetch-utils.ts          # HTTP fetch with retries
├── containers.ts           # Docker container CLI
├── config-yaml.ts          # YAML parsing/formatting
├── quota-alerts.ts         # Quota checking logic
├── telegram.ts             # Telegram bot API
├── notification-dismissal.ts  # Track dismissed alerts
├── share-code.ts           # Generate/validate share codes
├── api-endpoints.ts        # Centralized API URL constants
├── utils.ts                # cn() classname merger, misc
└── scripts/                # Utility scripts (migrations)
    └── migrate-provider-ownership.ts
```

### Key Conventions:
- **"server-only" pragma** at top of auth/DB modules
- **Prisma queries:** Direct `prisma.*.findUnique()`, no wrapper DAOs
- **Error handling:** Throw domain-specific Errors from `lib/errors.ts`
- **Validation:** Zod v4 schemas in `lib/validation/schemas.ts`
- **Exported from subdirs:** `export { ... } from "@/lib/auth/jwt"`

### Where to Look:
| Task | Path |
|------|------|
| Add new API key logic | `src/lib/api-keys/[function].ts` |
| Modify auth flow | `src/lib/auth/[function].ts` |
| Add provider integration | `src/lib/providers/[provider].ts` |
| Generate config YAML | `src/lib/config-generators/[variant].ts` |
| Add validation schema | `src/lib/validation/schemas.ts` |
| Custom error | `src/lib/errors.ts` |
| Logging | `src/lib/logger.ts` (log to console + DB via `log-storage.ts`) |

---

## 🪝 Domain 4: HOOKS (React Client Hooks)

**Path:** `src/hooks/`  
**Responsibility:** Shared client-side state, data fetching, effects  
**Pattern:** Always marked `"use client"`, SWR for caching  

### Structure:
```
src/hooks/
├── use-auth.ts              # Auth user state (SWR, shared cache)
├── use-health-status.ts     # Proxy health polling
├── use-header-notifications.ts  # Update/alert notifications
├── use-update-check.ts      # Check for dashboard updates
├── use-proxy-update-check.ts    # Check CLIProxyAPI updates
├── use-focus-trap.ts        # Modal focus management
├── notification-utils.ts    # Toast/alert helpers
└── __tests__/               # Hook tests
    └── use-header-notifications.test.ts
```

### Key Conventions:
- **SWR with dedup:** 60-second deduplication interval
- **Error boundaries:** Error state available as `.isError`
- **Shared across app:** All components using same hook share one cache

### Where to Look:
| Task | Path |
|------|------|
| Modify user state | `src/hooks/use-auth.ts` |
| Add new hook | `src/hooks/use-[feature].ts` |
| Test hook | `src/hooks/__tests__/use-[feature].test.ts` |

---

## 🤖 Domain 5: GENERATED (Auto-Generated Types)

**Path:** `src/generated/`  
**Responsibility:** Prisma ORM types, read-only  
**Constraint:** Regenerate with `npx prisma generate`, never edit manually  

### Structure:
```
src/generated/
└── prisma/
    ├── client.ts           # Main Prisma client type
    ├── browser.ts          # Browser-safe subset
    ├── enums.ts            # Enum types (UserRole, etc.)
    ├── models.ts           # Re-export models/
    ├── models/             # One file per table
    │   ├── User.ts
    │   ├── UserApiKey.ts
    │   ├── CustomProvider.ts
    │   ├── ProviderGroup.ts
    │   ├── UsageRecord.ts
    │   ├── AuditLog.ts
    │   ├── SystemSetting.ts
    │   ├── SyncToken.ts
    │   └── [others]
    ├── commonInputTypes.ts  # Zod input validation
    └── internal/           # Prisma internals
        ├── class.ts
        ├── prismaNamespace.ts
        └── prismaNamespaceBrowser.ts
```

### Key Conventions:
- **DO NOT EDIT** — run `npx prisma generate` after schema changes
- **Import from:** `import { User } from "@/generated/prisma/models/User"`
- **Never commit uncommitted schema changes** — always regenerate first

### Where to Look:
| Task | Path |
|------|------|
| View model types | `src/generated/prisma/models/[Model].ts` |
| Regenerate after schema change | `npx prisma generate` |

---

## 🔄 Cross-Domain Patterns

### Data Flow
```
API Route (app/api) 
  → lib/[feature]/* (business logic)
  → generated/prisma/* (DB types)
  → lib/errors.ts (error handling)
  → NextResponse / apiErrorWithHeaders()

Components (components/*)
  → hooks/* (SWR fetching)
  → lib/api-endpoints.ts (URL constants)
  → lib/utils.ts (cn, formatters)
```

### Authentication Flow
```
POST /api/auth/login (route.ts)
  → lib/auth/dal.ts (findUser)
  → lib/auth/password.ts (verify)
  → lib/auth/jwt.ts (signToken)
  → lib/auth/session.ts (createSession)
  → Response with JWT cookie
```

### Provider OAuth Flow
```
Click "Connect Oauth" (component)
  → POST /api/providers/oauth/route.ts
  → Redirect to OAuth provider
  → /api/providers/oauth/claim/route.ts (callback)
  → lib/providers/oauth-ops.ts (save credential)
  → lib/providers/dual-write.ts (sync to CLIProxyAPI)
  → lib/providers/custom-provider-sync.ts (fetch models)
```

### Config Generation Flow
```
Component: oh-my-opencode-config-generator.tsx
  → POST /api/oh-my-opencode/presets/route.ts
  → lib/config-generators/oh-my-opencode.ts
  → Merges: agents, models, skills, hooks
  → Returns YAML string
  → Component downloads file
```

---

## 📊 File Distribution

```
Domain       Files   %       Key Subdirs
───────────────────────────────────────────
app          95      33%     api/, dashboard/
components   155     54%     ui/, providers/, oh-my-opencode/
lib          110     39%     auth/, providers/, config-generators/
hooks        8       3%      [flat structure]
generated    25      9%      prisma/models/
───────────────────────────────────────────
Total        285     
```

---

## 🚀 Quick Navigation Cheatsheet

| Need | Search From |
|------|------------|
| **Add new API endpoint** | `src/app/api/[category]/[action]/route.ts` |
| **Fix component UI** | `src/components/[feature]/` |
| **Implement business logic** | `src/lib/[feature]/` |
| **Add/modify auth** | `src/lib/auth/` |
| **Connect to DB** | `src/lib/[feature]/*.ts` (Prisma queries) |
| **Share client state** | `src/hooks/use-[feature].ts` |
| **Style components** | `src/components/ui/` (tailwind + cn) |
| **Fix types** | Check `src/generated/prisma/models/[Model].ts` |
| **API error handling** | `src/lib/errors.ts` + `apiErrorWithHeaders()` |
| **Config generation** | `src/lib/config-generators/[variant].ts` |

---

## 🎯 Conventions Summary

| Layer | Pattern | Example |
|-------|---------|---------|
| **App Routes** | Nested RPC `POST /api/[resource]/[action]` | `/api/providers/oauth/route.ts` |
| **Components** | `"use client"` + SWR, Tailwind + glass effect | `Button` variant system |
| **Lib** | Pure functions, `@/lib/[domain]/[function]` | `lib/auth/jwt.ts` |
| **Hooks** | `useSWR()` with 60s dedup | `useAuth()`, `useHealthStatus()` |
| **Types** | Prisma models in `generated/`, Zod schemas | `src/generated/prisma/models/User.ts` |

---

**Generated:** 2025-04-06 | **Domain Count:** 5 | **Files Analyzed:** 285
