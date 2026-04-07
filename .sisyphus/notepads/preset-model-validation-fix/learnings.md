# Learnings — preset-model-validation-fix

## Session: ses_296224370ffepX3zhIBnvec7iB (2026-04-07)

### Conventions
- TypeScript strict mode; path alias `@/* -> ./src/*`
- Next.js App Router, route handlers at `src/app/api/**/route.ts`
- Tests: vitest, `npm run test` from `dashboard/`
- Toast: use existing `showToast`/`useToast` — do NOT create new notification system

### Key Files
- `dashboard/src/lib/config-generators/oh-my-opencode.ts` — buildOhMyOpenCodeConfig, resolveChain
- `dashboard/src/lib/config-generators/oh-my-opencode-slim.ts` — buildSlimConfig
- `dashboard/src/lib/__tests__/oh-my-opencode-config.test.ts` — existing tests
- `dashboard/src/components/oh-my-opencode-config-generator.tsx` — main UI generator
- `dashboard/src/components/oh-my-opencode/tier-assignments.tsx` — normal variant
- `dashboard/src/components/oh-my-opencode-slim/tier-assignments.tsx` — slim variant

### Bug Locations
- Normal variant bug 1: `oh-my-opencode.ts` line ~229: `if (!resolution) continue;` (agents loop)
- Normal variant bug 2: `oh-my-opencode.ts` line ~285: `if (!resolution) continue;` (categories loop)
- Slim variant bug: `oh-my-opencode-slim.ts` line ~50: `if (!model) continue;`

### DO NOT Change
- `resolveChain()` function — contract (null on no match) is correct
- `applyPreset()` merge semantics
- `pickBestModel()` function

## Session: Task 1 - RED Phase Tests (2026-04-07)

### Test Coverage Created
- **Test A**: "includes agent even when no chain model is available"
  - Verifies agents are NOT skipped when override model unavailable and chain resolves to null
  - Call: `buildOhMyOpenCodeConfig(["some-unknown-model-xyz"], { agents: { sisyphus: { model: "gpt-5.4" } } })`
  - Current status: FAILS (config returns null)
  
- **Test B**: "includes all agents even when all override models have no chain match"
  - Verifies function returns non-null result with agents present when no models match
  - Call: `buildOhMyOpenCodeConfig(["some-unknown-model-xyz"], {})`
  - Current status: FAILS (config returns null)
  
- **Test C**: "includes category even when no chain model is available"
  - Verifies categories are NOT skipped when override model unavailable and chain resolves to null
  - Call: `buildOhMyOpenCodeConfig(["some-unknown-model-xyz"], { categories: { "visual-engineering": { model: "gemini-3.1-pro" } } })`
  - Current status: FAILS (config returns null)
  
- **Test D**: "uses chain-resolved model when override is unavailable but chain has match"
  - Verifies chain fallback still works when override is unavailable
  - Call: `buildOhMyOpenCodeConfig(["k2p5"], { agents: { sisyphus: { model: "gpt-5.4" } } })`
  - Expected: `agents.sisyphus.model` equals `"cliproxyapi/k2p5"`
  - Current status: PASSES (chain fallback already works correctly)

### Code Locations
- Test file: `dashboard/src/lib/__tests__/oh-my-opencode-config.test.ts` lines 291-347
- New describe block: "agent/category skipping when models unavailable"
- Bug location to fix: `oh-my-opencode.ts` lines 229 and 285 (`if (!resolution) continue;`)

### Next Task (Task 4)
Fix the `if (!resolution) continue;` statements to allow agents/categories to be included even when resolveChain returns null.

## Session: Task 4 - GREEN Phase (2026-04-07)

### Implementation Summary
Fixed `buildOhMyOpenCodeConfig()` to stop skipping agents and categories when models are unavailable.

### Changes Made
1. **oh-my-opencode.ts lines 256-268 (agents loop)**:
   - Removed `if (!resolution) continue;`
   - Added: when resolveChain returns null, still add agent with `{ model: \`cliproxyapi/${chain[0]}\` }`
   - This uses the first entry in the chain as a "desired model" placeholder

2. **oh-my-opencode.ts lines 315-327 (categories loop)**:
   - Applied identical fix to categories

3. **oh-my-opencode-config.test.ts line 166**:
   - Updated test "returns null when no models available" to expect NOT null
   - Old behavior: `expect(config).toBeNull()`
   - New behavior: `expect(config).not.toBeNull()`
   - Reason: Function always populates agents with chain[0] as placeholder, so never returns null

### Test Results
✓ All 25 tests PASS
  - 3 newly fixed from Task 1: ✓ include agents/categories even when no models available
  - 22 existing tests: ✓ all still passing
  - 1 updated test (returns null): ✓ now expects NOT null per new behavior

### Key Insight
The original test "returns null when no models available" and the new test "includes all agents when no models available" were testing opposite behaviors. The fix requires the new behavior (always include agents with chain[0] placeholder), so the old test expectation was updated to match.

### Design Note
This ensures:
- JSON output always includes agent entries (with chain[0] as model when resolveChain fails)
- UI components receive complete agent/category data
- Unresolved state is handled in UI rendering logic, not by omitting agents from the config
