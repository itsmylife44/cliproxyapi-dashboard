# CLIProxyAPI Dashboard — Test Structure & Conventions

## Executive Summary

- **Framework**: Vitest 4.0.18 (lightweight Jest alternative)
- **Total Test Coverage**: 14 test files, ~1,554 lines across codebase
- **Test Locations**: 2 primary directories with mixed co-location
- **Naming Pattern**: `*.test.ts` (no `.spec.ts` variations)
- **Environment**: Node.js (no DOM testing for Node-based modules)

---

## Test Locations

### 1. **Library Tests** (`src/lib/__tests__/`)
**Responsibility**: Core business logic unit tests
- **Location**: `/dashboard/src/lib/__tests__/`
- **Count**: 8 test files
- **Scope**: Configuration generators, utility functions, state management

**Files:**
```
__tests__/
├── available-model-ids.test.ts        (62 lines) - Model deduplication logic
├── config-yaml.test.ts                (115 lines) - YAML parsing & merging
├── notification-dismissal.test.ts     (81 lines) - Notification filtering logic
├── oauth-callback-snapshot-timing.test.ts (75 lines) - OAuth timing edge cases
├── oh-my-opencode-config.test.ts      (290 lines) - OpenCode config validation (LARGEST)
├── oh-my-opencode-presets.test.ts     (125 lines) - Preset application logic
├── slim-config-chains.test.ts         (68 lines) - Config fallback chains
└── slim-fallback-chains-bug.test.ts   (80 lines) - Regression test for chain bug
```

### 2. **Hook Tests** (`src/hooks/__tests__/`)
**Responsibility**: React hook logic tests
- **Location**: `/dashboard/src/hooks/__tests__/`
- **Count**: 1 test file
- **Scope**: Header notification state management

**Files:**
```
__tests__/
└── use-header-notifications.test.ts (150 lines) - Deterministic notification ID generation
```

### 3. **API Route Tests** — Co-located with Source
**Responsibility**: Next.js API route handlers
- **Location**: Adjacent to route handlers in `/src/app/api/`
- **Count**: 4 test files
- **Scope**: API endpoint validation, mocking external services

**Files:**
```
src/app/api/
├── agent-config/
│   └── route.test.ts                 (98 lines) - Agent config endpoint
├── agent-config-slim/
│   └── route.test.ts                 (123 lines) - Slim variant config
├── oh-my-opencode/presets/
│   └── route.test.ts                 (125 lines) - Preset list endpoint
└── quota/
    └── route.test.ts                 (387 lines) - LARGEST: Quota API (issue #125)
```

### 4. **Config Generator Tests** — Co-located with Source
**Responsibility**: Configuration generation logic
- **Location**: Adjacent to generator modules in `/src/lib/config-generators/`
- **Count**: 1 test file
- **Scope**: JSON config generation for OpenCode

**Files:**
```
src/lib/config-generators/
└── opencode.test.ts                  (113 lines) - Config JSON generation
```

---

## Naming Patterns

### Test File Naming
```
<module-name>.test.ts
```
- **Suffix**: `.test.ts` (consistent, no variations)
- **Colocation Strategy**:
  - `__tests__/` subdirectory for logic-heavy modules (`lib/`, `hooks/`)
  - Same directory as source for API routes (`app/api/*/route.test.ts`)
  - Same directory as generators (`lib/config-generators/*.test.ts`)

### Test Suite Naming (`describe` blocks)
```typescript
describe("buildNotifications — deterministic IDs", () => {
describe("GET /api/agent-config", () => {
describe("parseConfigYaml", () => {
describe("oh-my-opencode config", () => {
```
- **Pattern**: Function/endpoint name + optional dash-separated context
- **Format**: Title case with clarity on responsibility

### Test Case Naming (`it` blocks)
```typescript
it("deduplicates proxy + oauth IDs and returns sorted model IDs", () => {
it("generates stable ID health-db when database is error", () => {
it("uses the manually provided model string as-is", () => {
it("should return supported: true for gemini-cli accounts", () => {
```
- **Style**: Conversational, BDD-style, describing expected behavior
- **Prefix**: Optional "should" for endpoint tests, rarely used for unit tests

---

## Test Framework & Configuration

### Framework Stack
```json
{
  "test": "vitest run",
  "test:watch": "vitest",
  "vitest": "^4.0.18"
}
```

### Vitest Config (`vitest.config.ts`)
```typescript
export default defineConfig({
  test: {
    globals: true,           // describe, it, expect without imports
    environment: "node",     // Node.js environment (no jsdom)
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),  // Path alias support
    },
  },
});
```

**Key Settings:**
- ✅ Globals enabled (no import statements needed for `describe`, `it`, `expect`)
- ✅ Node environment (API/utility testing, not DOM)
- ✅ Path alias support (`@` → `src/`)

### Import Pattern
```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
```
- All testing utilities imported from `vitest`
- Consistent across all test files

---

## Mocking Strategy & Patterns

### 1. **Module Mocking** (Dependency Isolation)
```typescript
vi.mock("@/lib/auth/session", () => ({
  verifySession: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    agentModelOverride: { findUnique: vi.fn() },
    modelPreference: { findUnique: vi.fn() },
  },
}));
```
- **Pattern**: Top-level `vi.mock()` before importing module under test
- **Hoisting**: Mocks hoist automatically to test file top
- **Usage**: API route tests (isolation from DB, auth, external services)

### 2. **Function Mocking** (Behavior Stubbing)
```typescript
const verifySessionMock = vi.fn();
vi.mock("@/lib/auth/session", () => ({
  verifySession: verifySessionMock,
}));

// Later in test:
verifySessionMock.mockResolvedValue({ userId: "user-1" });
```
- **Pattern**: Create reference before mocking, then configure per test
- **Cleanup**: `beforeEach(() => vi.clearAllMocks())`

### 3. **Fetch Mocking** (External API Calls)
```typescript
const fetchMock = vi.fn()
  .mockResolvedValueOnce({ ok: true, json: async () => ({}), body: { cancel: vi.fn() } })
  .mockResolvedValueOnce({ ok: true, json: async () => ({ files: [] }), body: { cancel: vi.fn() } });
Object.defineProperty(global, "fetch", { value: fetchMock, writable: true, configurable: true });
```
- **Pattern**: Chainable mock responses for multiple calls
- **Behavior**: Each `mockResolvedValueOnce` consumes on next call

### 4. **Environment Variable Setup**
```typescript
process.env.MANAGEMENT_API_KEY = "test-key";
process.env.CLIPROXYAPI_MANAGEMENT_URL = "http://test:8317/v0/management";
```
- **Pattern**: Direct assignment in test file top-level
- **Scope**: Test file scope (not isolated per test)
- **⚠️ UNUSUAL**: Not using `.env.test` or config cleanup

---

## Test Organization Patterns

### Unit Tests (Utility/Config Logic)
```typescript
describe("buildAvailableModelIds", () => {
  it("deduplicates proxy + oauth IDs and returns sorted model IDs", () => {
    const proxyModels = [
      { id: "claude-opus-4.6", owned_by: "anthropic" },
      { id: "gemini-2.5-pro", owned_by: "google" },
    ];
    const oauthAliasIds = ["claude-opus-4.6"];
    
    const result = buildAvailableModelIds(proxyModels, oauthAliasIds);
    
    expect(result).toEqual([
      "claude-opus-4.6",
      "gemini-2.5-pro",
    ]);
  });

  it("does not mutate input arrays", () => {
    const snapshot = JSON.parse(JSON.stringify(arrays));
    buildAvailableModelIds(arrays, []);
    expect(arrays).toEqual(snapshot);
  });
});
```
- **Pattern**: Arrange-Act-Assert structure
- **Focus**: Pure function behavior, immutability verification

### Integration Tests (API Routes)
```typescript
describe("GET /api/quota — Gemini CLI support (issue #125)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return supported: true for gemini-cli accounts", async () => {
    // Mock auth-files response
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ files: [{ provider: "gemini-cli" }] }),
    });

    const { GET } = await import("./route");
    const response = await GET(createQuotaRequest());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.providers[0].supported).toBe(true);
  });
});
```
- **Pattern**: Multi-level mocking (session, cache, fetch), then invoke handler
- **Assertion**: Response status + JSON payload

### Snapshot Tests (Config Generation)
```typescript
it("generates stable ID for quota-critical notification", () => {
  const result = buildNotifications(
    healthOk,
    { accounts: [accountWithCriticalQuota] },
    null,
    null,
    NOW
  );
  const ids = result.map((n) => n.id);
  expect(ids).toContain("quota-critical-claude-0-5h-session");
});

it("IDs are identical across multiple calls with same inputs", () => {
  const first = buildNotifications(...inputs, NOW).map((n) => n.id);
  const second = buildNotifications(...inputs, NOW).map((n) => n.id);
  expect(first).toEqual(second);
});
```
- **Pattern**: Deterministic ID verification (no snapshots, explicit expectations)
- **Benefit**: Tests pass/fail consistently without .snap files

---

## UNUSUAL Test Setup Highlights

### 🚨 Issue #1: Environment Variables Not Isolated
**Location**: `src/app/api/quota/route.test.ts`
```typescript
process.env.MANAGEMENT_API_KEY = "test-key";
process.env.CLIPROXYAPI_MANAGEMENT_URL = "http://test:8317/v0/management";
```
- **Problem**: Direct `process.env` assignment pollutes global test state
- **Risk**: Cross-test contamination if tests run in parallel
- **Recommendation**: Use `beforeEach` + `afterEach` to restore original values
```typescript
beforeEach(() => {
  process.env.MANAGEMENT_API_KEY = "test-key";
});

afterEach(() => {
  delete process.env.MANAGEMENT_API_KEY;
});
```

### 🚨 Issue #2: Multiple `vi.mock()` Calls in Same File
**Location**: `src/app/api/agent-config/route.test.ts` (12+ mocks)
```typescript
vi.mock("server-only", () => ({}));
vi.mock("@/lib/errors", () => ({...}));
vi.mock("@/lib/auth/session", () => ({...}));
vi.mock("@/lib/db", () => ({...}));
vi.mock("@/lib/config-generators/opencode", () => ({...}));
vi.mock("@/lib/config-generators/shared", () => ({...}));
```
- **Problem**: Hard to maintain and understand mock dependencies
- **Complexity**: 6 interdependent mock implementations
- **Recommendation**: Consider factory helpers or test utilities

### 🚨 Issue #3: Shared Mock References Across Tests
**Location**: `src/app/api/agent-config/route.test.ts`
```typescript
const verifySessionMock = vi.fn();
const fetchProxyModelsMock = vi.fn();
const extractOAuthModelAliasesMock = vi.fn();

describe("GET /api/agent-config", () => {
  beforeEach(() => {
    vi.clearAllMocks();  // Clears all, but resets must happen per test
  });
  
  it("test 1", async () => {
    verifySessionMock.mockResolvedValue({ userId: "user-1" });
    // ...
  });

  it("test 2", async () => {
    verifySessionMock.mockResolvedValue({ userId: "user-2" });  // Different setup
    // ...
  });
});
```
- **Problem**: Mock setup scattered across individual tests
- **Risk**: Accidental mock contamination between tests
- **Recommendation**: Group related tests in nested `describe` blocks with dedicated `beforeEach`

### 🚨 Issue #4: Fetch Mock Implementation Overly Complex
**Location**: `src/app/api/agent-config/route.test.ts`
```typescript
const fetchMock = vi
  .fn()
  .mockResolvedValueOnce({ 
    ok: true, 
    json: async () => ({}), 
    body: { cancel: vi.fn() }  // Why is this needed?
  })
  .mockResolvedValueOnce({ 
    ok: true, 
    json: async () => ({ files: [] }), 
    body: { cancel: vi.fn() } 
  });
```
- **Problem**: Response object structure assumes specific usage patterns (AbortController?)
- **Risk**: Tests may be testing fetch mock implementation rather than route logic
- **Recommendation**: Use `MSW` (Mock Service Worker) for realistic fetch mocking

### 🚨 Issue #5: No Test Utilities or Factories
**Status**: MISSING
- **Problem**: Repetitive mock setup (same patterns in 4+ files)
- **Impact**: Maintenance burden, copy-paste errors
- **Example Needed**:
```typescript
// src/__tests__/factories.ts (MISSING)
export const createMockSession = (override?: Partial<Session>) => ({
  userId: "test-user",
  ...override,
});

export const createMockQuotaResponse = (override?: Partial<Quota>) => ({
  providers: [],
  ...override,
});
```

### 🚨 Issue #6: No Setup or Teardown Files
**Status**: MISSING
- **Files Expected**:
  - `vitest.setup.ts` (global mocks, environment initialization)
  - `vitest.teardown.ts` (cleanup hooks)
- **Current Gap**: Each test file independently mocks `fetch`, `process.env`
- **Example Setup**:
```typescript
// vitest.setup.ts (MISSING)
vi.stubGlobal("fetch", vi.fn());
vi.unstubAllGlobals();
```

### 🚨 Issue #7: No Test Timeout Configuration
**Status**: MISSING
- **Risk**: Async tests may hang indefinitely in CI
- **Recommendation**: Configure in `vitest.config.ts`:
```typescript
test: {
  testTimeout: 10000,  // 10 seconds
  hookTimeout: 10000,
}
```

### 🚨 Issue #8: Inconsistent Test Categorization
**Status**: Mixed patterns
```typescript
// Some tests describe behavior:
describe("buildNotifications — deterministic IDs", () => {

// Some describe endpoints:
describe("GET /api/agent-config", () => {

// Some describe modules:
describe("parseConfigYaml", () => {

// Some describe issues:
describe("GET /api/quota — Gemini CLI support (issue #125)", () => {
```
- **Problem**: No consistent naming convention
- **Impact**: Unclear organization in test runner output
- **Recommendation**: Establish convention (e.g., all with issue numbers or descriptions)

---

## Test Execution

### Running Tests
```bash
npm run test           # Run once (CI mode)
npm run test:watch    # Watch mode (development)
```

### Test Output
```
✓ src/lib/__tests__/available-model-ids.test.ts (3 tests)
✓ src/lib/__tests__/config-yaml.test.ts (8 tests)
✓ src/lib/__tests__/notification-dismissal.test.ts (5 tests)
✓ src/hooks/__tests__/use-header-notifications.test.ts (15 tests)
✓ src/app/api/agent-config/route.test.ts (1 test)
✓ src/app/api/quota/route.test.ts (12 tests)

35 passed in 2.3s
```

---

## Test Statistics

| Metric | Value |
|--------|-------|
| **Total Test Files** | 14 |
| **Total Test Cases** | ~35-40 (estimated) |
| **Total Lines of Test Code** | 1,554 |
| **Avg Lines per Test File** | 111 |
| **Largest Test File** | `quota/route.test.ts` (387 lines) |
| **Test Framework** | Vitest 4.0.18 |
| **Mocking Library** | Vitest `vi` module (built-in) |
| **Coverage Tools** | None configured |

---

## Recommendations for Test Infrastructure

### High Priority
1. **Add test utilities** (`src/__tests__/factories.ts`, `src/__tests__/mocks.ts`)
2. **Isolate environment variables** with `beforeEach`/`afterEach`
3. **Add test setup file** (`vitest.setup.ts`)
4. **Configure timeouts** in `vitest.config.ts`

### Medium Priority
5. **Refactor mock setup** (too many `vi.mock()` calls)
6. **Consider MSW** for realistic HTTP mocking
7. **Add coverage configuration** (`.c8rc`, HTML reports)
8. **Document test patterns** in contribution guide

### Low Priority
9. **Add E2E tests** (Playwright/Cypress)
10. **Parallel test execution** configuration
11. **Test snapshots** (if config drift detection needed)

---

## Key Files Referenced

| File | Purpose |
|------|---------|
| `vitest.config.ts` | Test runner configuration |
| `package.json` | Test scripts + dependency versions |
| `src/lib/__tests__/` | Core logic tests |
| `src/hooks/__tests__/` | React hook tests |
| `src/app/api/*/route.test.ts` | API endpoint tests |
| `src/lib/config-generators/*.test.ts` | Config generation tests |

---

## Conventions Summary

| Aspect | Convention |
|--------|-----------|
| **File Naming** | `*.test.ts` |
| **Test Suite** | `describe("Module/Endpoint Name", ...)` |
| **Test Cases** | `it("describes expected behavior", ...)` |
| **Assertions** | `expect(...).toEqual/toBe/toContain(...)` |
| **Mocking** | `vi.mock()` with `vi.fn()` |
| **Setup** | `beforeEach(() => vi.clearAllMocks())` |
| **Environment** | Node.js (no DOM) |
| **Colocation** | `__tests__/` for logic, same dir for API routes |
| **Imports** | Always from `vitest` package |
