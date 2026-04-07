# Fix: Preset Model Validation — Agents Visible + Missing-Model Warning

## TL;DR

> **Quick Summary**: Presets dürfen Agents nicht mehr verschwinden lassen wenn Modelle fehlen. Stattdessen: Agents bleiben sichtbar mit Warning-Indikator, User wird per Toast über fehlende Modelle informiert. Fix gilt für beide Varianten (Normal + Slim).
> 
> **Deliverables**:
> - `buildOhMyOpenCodeConfig()` und `buildSlimConfig()` überspringen keine Agents mehr
> - `getMissingPresetModels()` Utility-Funktion zur Erkennung fehlender Modelle
> - UI: Toast-Warning bei Preset-Anwendung mit fehlenden Modellen
> - UI: Unresolved-Indikator (⚠️) für Agents ohne verfügbares Modell
> - Tests für alle neuen Logik-Pfade
> 
> **Estimated Effort**: Medium
> **Parallel Execution**: YES — 3 waves
> **Critical Path**: Tests (Wave 1) → Logic-Fix + UI-State (Wave 2) → UI-Integration (Wave 3) → Verification

---

## Context

### Original Request
Wenn ein Preset gewählt wird und der User nicht genau die Modelle hat, verschwinden die Agents und man kann keine Modelle mehr einstellen. Presets sollen nicht forcen — fehlende Modelle sollen den User benachrichtigen statt die UI zu blockieren.

### Interview Summary
**Key Discussions**:
- Root Cause: `if (!resolution) continue;` in `buildOhMyOpenCodeConfig()` (Zeile 229, 285) und `if (!model) continue;` in `buildSlimConfig()` (Zeile 50)
- `applyPreset()` merged Preset-Modelle bedingungslos — keine Validation gegen availableModels
- User will BEIDE Varianten (Normal + Slim) im selben Plan fixen
- Tests sollen dabei sein (TDD-Ansatz)

**Research Findings**:
- Normal-Variant: 3 Bug-Stellen (agents Zeile 229, categories Zeile 285, UI Zeile 539-551)
- Slim-Variant: 1 Bug-Stelle (agents Zeile 50), kein eigenes Preset-System
- `resolveChain()` Contract (null bei keinem Match) ist korrekt — Fix liegt bei den Callern
- Bestehende Test-Infrastruktur: vitest, Tests für buildOhMyOpenCodeConfig und applyPreset vorhanden

### Metis Review
**Identified Gaps** (addressed):
- Slim-Variant hat gleichen Bug → in Scope genommen (User-Entscheidung)
- Generated JSON darf nur verfügbare Modelle enthalten → "unresolved" ist UI-only Konzept
- Override-Modelle im State behalten (nicht strippen) → User kann Provider später hinzufügen
- `resolveChain()` nicht ändern → Fix in Callern
- Existierendes Toast-System nutzen → kein neues Notification-System

---

## Work Objectives

### Core Objective
Preset-Anwendung graceful machen: Agents/Categories bleiben IMMER sichtbar und konfigurierbar, unabhängig von Model-Verfügbarkeit. User wird über fehlende Modelle informiert.

### Concrete Deliverables
- Geänderte Logik in `oh-my-opencode.ts` (buildOhMyOpenCodeConfig)
- Geänderte Logik in `oh-my-opencode-slim.ts` (buildSlimConfig)
- Neue Utility-Funktion `getMissingPresetModels()` in `oh-my-opencode.ts`
- UI-Update in `oh-my-opencode-config-generator.tsx` (Toast + Agent-Rendering)
- UI-Update in `tier-assignments.tsx` (Normal-Variant: Unresolved-Indikator)
- UI-Update in `oh-my-opencode-slim/tier-assignments.tsx` (Slim-Variant: Unresolved-Indikator)
- Neue Tests in `oh-my-opencode-config.test.ts`

### Definition of Done
- [ ] `npm run test` — alle Tests (alt + neu) grün
- [ ] `npm run typecheck` — keine Type-Fehler
- [ ] `npm run build` — Production-Build erfolgreich
- [ ] Preset mit fehlenden Modellen → Toast erscheint mit Modell-Liste
- [ ] Alle Agents sichtbar in TierAssignments auch bei fehlenden Modellen
- [ ] Unresolved Agents zeigen Warning-Indikator
- [ ] Generiertes JSON enthält NUR verfügbare Modelle (unresolved = UI-only)

### Must Have
- Agents/Categories verschwinden NICHT mehr bei fehlenden Modellen
- User wird per Toast über fehlende Modelle informiert
- Agents bleiben klickbar/konfigurierbar auch im unresolved-State
- Fix für BEIDE Varianten (Normal + Slim)
- Override-Modelle bleiben im State erhalten (für späteres Provider-Hinzufügen)

### Must NOT Have (Guardrails)
- NICHT `resolveChain()` ändern — Contract (null bei keinem Match) ist korrekt
- NICHT `applyPreset()` Merge-Semantik ändern — Validation ist UI-Concern
- NICHT unavailable Modelle im generierten JSON — unresolved ist UI-only
- NICHT neues Toast/Notification-System — existierendes `showToast` / `useToast` nutzen
- NICHT ModelBadge komplett redesignen — nur minimalen `isUnresolved`-State hinzufügen
- NICHT Preset-Struktur oder Preset-JSON ändern
- KEINE über-abstrahierte Utility-Layer oder Helper-Dateien

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed.

### Test Decision
- **Infrastructure exists**: YES (vitest)
- **Automated tests**: TDD (tests first)
- **Framework**: vitest (`npm run test`)
- **Approach**: RED (failing tests) → GREEN (minimal impl) → REFACTOR

### QA Policy
Every task MUST include agent-executed QA scenarios.
Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

- **Logic/Config**: Use Bash (`npm run test -- --reporter=verbose`)
- **Build**: Use Bash (`npm run typecheck && npm run build`)

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately — tests + utility, no dependencies):
├── Task 1: Write failing tests for normal-variant agent-skip fix [quick]
├── Task 2: Write getMissingPresetModels utility + tests [quick]
└── Task 3: Write failing tests for slim-variant agent-skip fix [quick]

Wave 2 (After Wave 1 — logic fixes + UI state, parallel):
├── Task 4: Fix buildOhMyOpenCodeConfig agent/category skipping (depends: 1) [quick]
├── Task 5: Fix buildSlimConfig agent skipping (depends: 3) [quick]
└── Task 6: Add unresolved visual state to TierAssignments (depends: none from W1) [visual-engineering]

Wave 3 (After Wave 2 — UI integration):
├── Task 7: Integrate preset warning toast + unresolved agents in normal-variant UI (depends: 2, 4, 6) [unspecified-high]
└── Task 8: Integrate unresolved agents in slim-variant UI (depends: 5, 6) [unspecified-high]

Wave FINAL (After ALL tasks — verification):
├── Task F1: Plan compliance audit (oracle)
├── Task F2: Code quality review (unspecified-high)
├── Task F3: Real manual QA (unspecified-high)
└── Task F4: Scope fidelity check (deep)
→ Present results → Get explicit user okay
```

### Dependency Matrix

| Task | Depends On | Blocks | Wave |
|------|-----------|--------|------|
| 1 | — | 4 | 1 |
| 2 | — | 7 | 1 |
| 3 | — | 5 | 1 |
| 4 | 1 | 7 | 2 |
| 5 | 3 | 8 | 2 |
| 6 | — | 7, 8 | 2 |
| 7 | 2, 4, 6 | F1-F4 | 3 |
| 8 | 5, 6 | F1-F4 | 3 |

### Agent Dispatch Summary

- **Wave 1**: 3 tasks → T1 `quick`, T2 `quick`, T3 `quick`
- **Wave 2**: 3 tasks → T4 `quick`, T5 `quick`, T6 `visual-engineering`
- **Wave 3**: 2 tasks → T7 `unspecified-high`, T8 `unspecified-high`
- **FINAL**: 4 tasks → F1 `oracle`, F2 `unspecified-high`, F3 `unspecified-high`, F4 `deep`

---

## TODOs

- [x] 1. Write failing tests for normal-variant agent-skip fix (TDD RED)

  **What to do**:
  - Add test cases to `dashboard/src/lib/__tests__/oh-my-opencode-config.test.ts`:
    - Test: "includes agent with chain fallback when override model is unavailable" — call `buildOhMyOpenCodeConfig(["claude-haiku-4.5"], { agents: { sisyphus: { model: "gpt-5.4" } } })` → expect `agents.sisyphus` to exist with a chain-resolved model, not be omitted
    - Test: "includes all agents even when override models have no chain match" — provide overrides with unavailable models for multiple agents where chain also has no match → expect agents still present in output (with fallback or marker)
    - Test: "category included with chain fallback when override model is unavailable" — same pattern for categories
    - Test: "override model silently replaced shows chain-resolved model in JSON output" — when override unavailable but chain resolves, verify JSON has chain model
  - Run tests to confirm they FAIL (red phase)
  - Follow existing test patterns from `oh-my-opencode-config.test.ts`

  **Must NOT do**:
  - Do NOT implement the fix — only write tests that will fail
  - Do NOT change any production code
  - Do NOT modify existing tests

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 2, 3)
  - **Blocks**: Task 4
  - **Blocked By**: None

  **References**:
  - `dashboard/src/lib/__tests__/oh-my-opencode-config.test.ts` — existing test patterns, describe blocks, mock setup. Follow same structure (lines 1-167)
  - `dashboard/src/lib/config-generators/oh-my-opencode.ts:204-309` — `buildOhMyOpenCodeConfig()` function under test. Lines 228-229 are the bug (`if (!resolution) continue;`), lines 284-285 same for categories
  - `dashboard/src/lib/config-generators/oh-my-opencode.ts:23-46` — `UPSTREAM_AGENT_CHAINS` and `UPSTREAM_CATEGORY_CHAINS` — the chain definitions with actual model IDs to use in test data
  - `dashboard/src/lib/config-generators/oh-my-opencode-types.ts` — Type definitions for `OhMyOpenCodeFullConfig` needed for test data construction

  **Acceptance Criteria**:
  - [ ] New test file compiles: `npm run typecheck`
  - [ ] Tests are RED: `npm run test -- --reporter=verbose dashboard/src/lib/__tests__/oh-my-opencode-config.test.ts` → new tests FAIL, existing tests PASS

  **QA Scenarios:**
  ```
  Scenario: New tests exist and fail (TDD red phase)
    Tool: Bash
    Preconditions: No production code changes
    Steps:
      1. Run `npm run test -- --reporter=verbose dashboard/src/lib/__tests__/oh-my-opencode-config.test.ts`
      2. Count test results
    Expected Result: Existing tests pass, new tests fail with assertion errors (not compile errors)
    Evidence: .sisyphus/evidence/task-1-red-phase.txt
  ```

  **Commit**: NO (groups with Task 4)

- [x] 2. Write getMissingPresetModels utility function + tests (TDD)

  **What to do**:
  - Create a pure function `getMissingPresetModels(preset: OhMyOpenCodePreset, availableModels: string[]): { agent: string; model: string }[]` in `dashboard/src/lib/config-generators/oh-my-opencode.ts`
  - This function checks which models a preset references (in agents and categories) that are NOT in `availableModels`
  - Returns array of `{ agent: string, model: string }` for each missing assignment
  - Write tests FIRST in `oh-my-opencode-config.test.ts`:
    - Test: "returns empty array when all preset models available"
    - Test: "returns missing models for agents and categories"
    - Test: "handles preset with no agent overrides"
    - Test: "handles empty available models list"
  - Run tests → confirm FAIL → implement function → confirm PASS
  - Export the function from `oh-my-opencode.ts`

  **Must NOT do**:
  - Do NOT modify any UI components
  - Do NOT change existing functions
  - Do NOT add dependencies

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 3)
  - **Blocks**: Task 7
  - **Blocked By**: None

  **References**:
  - `dashboard/src/lib/config-generators/oh-my-opencode.ts` — add function here, near other utility functions. See `resolveChain()` (lines 53-74) for pattern of pure utility functions
  - `dashboard/src/lib/config-generators/oh-my-opencode-types.ts:OhMyOpenCodePreset` — the preset type definition, shows `.config.agents` and `.config.categories` structure
  - `dashboard/src/lib/config-generators/oh-my-opencode-presets.json` — actual preset data to understand what model references look like (e.g., `{ "model": "claude-opus-4.6" }`)
  - `dashboard/src/lib/__tests__/oh-my-opencode-config.test.ts` — add tests here, follow existing describe/it structure

  **Acceptance Criteria**:
  - [ ] Function exported from `oh-my-opencode.ts`
  - [ ] `npm run typecheck` passes
  - [ ] `npm run test -- --reporter=verbose dashboard/src/lib/__tests__/oh-my-opencode-config.test.ts` → all tests PASS (including new ones)

  **QA Scenarios:**
  ```
  Scenario: getMissingPresetModels returns correct missing models
    Tool: Bash
    Preconditions: Function implemented and exported
    Steps:
      1. Run `npm run test -- --reporter=verbose dashboard/src/lib/__tests__/oh-my-opencode-config.test.ts`
      2. Verify new describe block "getMissingPresetModels" passes
    Expected Result: All 4+ new tests pass with 0 failures
    Evidence: .sisyphus/evidence/task-2-utility-tests.txt

  Scenario: Function handles edge case with empty available models
    Tool: Bash
    Steps:
      1. Run tests that call getMissingPresetModels with `availableModels = []`
    Expected Result: Returns ALL preset models as missing
    Evidence: .sisyphus/evidence/task-2-edge-empty-models.txt
  ```

  **Commit**: NO (groups with Task 4)

- [x] 3. Write failing tests for slim-variant agent-skip fix (TDD RED)

  **What to do**:
  - Find or create test file for slim config builder
  - Add test cases:
    - Test: "includes agent even when pickBestModel returns null for its tier" — call `buildSlimConfig` with limited models → expect all 6 agents present in output
    - Test: "agent with unavailable tier still appears with marker/fallback"
  - Run tests to confirm they FAIL (red phase)
  - Follow existing test patterns

  **Must NOT do**:
  - Do NOT implement the fix — only write failing tests
  - Do NOT change production code

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 2)
  - **Blocks**: Task 5
  - **Blocked By**: None

  **References**:
  - `dashboard/src/lib/config-generators/oh-my-opencode-slim.ts:35-148` — `buildSlimConfig()` function. Line 50 is the bug: `if (!model) continue;`
  - `dashboard/src/lib/config-generators/oh-my-opencode-slim.ts:14-21` — `SLIM_AGENT_ROLES` defining the 6 agents (orchestrator, oracle, designer, explorer, librarian, fixer) with their tier mappings
  - `dashboard/src/lib/__tests__/` — look for existing slim test file, or create new one following patterns from `oh-my-opencode-config.test.ts`

  **Acceptance Criteria**:
  - [ ] Test file compiles: `npm run typecheck`
  - [ ] Tests are RED: new tests FAIL, no existing tests broken

  **QA Scenarios:**
  ```
  Scenario: New slim tests exist and fail
    Tool: Bash
    Steps:
      1. Run `npm run test -- --reporter=verbose` for the slim test file
      2. Count test results
    Expected Result: New tests fail with assertion errors, existing tests pass
    Evidence: .sisyphus/evidence/task-3-red-phase.txt
  ```

  **Commit**: NO (groups with Task 5)

- [x] 4. Fix buildOhMyOpenCodeConfig — stop skipping agents with unavailable models (TDD GREEN)

  **What to do**:
  - In `dashboard/src/lib/config-generators/oh-my-opencode.ts`, modify `buildOhMyOpenCodeConfig()`:
    - **Lines 215-229 (agents loop)**: When `overrideModel` is set but NOT in `availableModels`:
      - Still attempt `resolveChain(chain, availableModels)` (current behavior)
      - If chain resolves → use chain model (current behavior, already works)
      - If chain returns null → **DO NOT `continue`**. Instead, still add the agent to the output using the first model from the chain as a placeholder, OR skip in JSON but ensure the UI handles this (see Task 7). The key insight: the JSON can skip unresolvable agents (correct behavior), but the UI must NOT mirror this skip.
    - **Lines 271-285 (categories loop)**: Same treatment
    - **IMPORTANT**: The actual JSON output behavior may stay as-is (skip unresolvable agents in JSON). The critical fix is ensuring the UI component in Task 7 does NOT use `buildOhMyOpenCodeConfig()` to determine which agents to render. Agents should ALWAYS be rendered from `UPSTREAM_AGENT_CHAINS` directly.
  - Run tests from Task 1 → confirm they PASS (green phase)
  - Ensure ALL existing tests still pass

  **Must NOT do**:
  - Do NOT change `resolveChain()` function
  - Do NOT change `applyPreset()` merge semantics
  - Do NOT include unavailable models in the generated JSON (unresolved = UI-only)
  - Do NOT touch UI components

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 5, 6)
  - **Blocks**: Task 7
  - **Blocked By**: Task 1

  **References**:
  - `dashboard/src/lib/config-generators/oh-my-opencode.ts:204-309` — `buildOhMyOpenCodeConfig()`. Lines 228-229: `const resolution = resolveChain(chain, availableModels); if (!resolution) continue;` — THIS is the bug to fix for agents. Lines 284-285: same for categories
  - `dashboard/src/lib/config-generators/oh-my-opencode.ts:53-74` — `resolveChain()` — DO NOT modify this function
  - `dashboard/src/lib/__tests__/oh-my-opencode-config.test.ts` — tests from Task 1 that should now PASS

  **Acceptance Criteria**:
  - [ ] Tests from Task 1 now PASS (green phase)
  - [ ] ALL existing tests still PASS
  - [ ] `npm run typecheck` passes
  - [ ] `npm run test -- --reporter=verbose dashboard/src/lib/__tests__/oh-my-opencode-config.test.ts` → 0 failures

  **QA Scenarios:**
  ```
  Scenario: All tests pass after fix (TDD green phase)
    Tool: Bash
    Steps:
      1. Run `npm run test -- --reporter=verbose dashboard/src/lib/__tests__/oh-my-opencode-config.test.ts`
    Expected Result: ALL tests pass including new ones from Task 1. 0 failures.
    Evidence: .sisyphus/evidence/task-4-green-phase.txt

  Scenario: TypeScript compiles clean
    Tool: Bash
    Steps:
      1. Run `npm run typecheck`
    Expected Result: Exit code 0, no type errors
    Evidence: .sisyphus/evidence/task-4-typecheck.txt
  ```

  **Commit**: YES
  - Message: `fix: prevent agents from disappearing when preset models unavailable`
  - Files: `oh-my-opencode.ts`, `oh-my-opencode-config.test.ts`
  - Pre-commit: `npm run test && npm run typecheck`

- [x] 5. Fix buildSlimConfig — stop skipping agents with unavailable models (TDD GREEN)

  **What to do**:
  - In `dashboard/src/lib/config-generators/oh-my-opencode-slim.ts`, modify `buildSlimConfig()`:
    - **Line 50**: `if (!model) continue;` — remove the `continue`. When `pickBestModel()` returns null, still include the agent but with a marker or use the first model from the tier as a "desired" model. The UI (Task 8) will handle showing this as unresolved.
    - Same principle as Task 4: generated JSON may skip unresolvable agents, but the UI must render them
  - Run tests from Task 3 → confirm they PASS (green phase)
  - Ensure ALL existing tests still pass

  **Must NOT do**:
  - Do NOT change `pickBestModel()` function
  - Do NOT touch UI components

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 4, 6)
  - **Blocks**: Task 8
  - **Blocked By**: Task 3

  **References**:
  - `dashboard/src/lib/config-generators/oh-my-opencode-slim.ts:35-148` — `buildSlimConfig()`. Line 50: `if (!model) continue;` — THIS is the bug to fix
  - `dashboard/src/lib/config-generators/oh-my-opencode-slim.ts:14-21` — `SLIM_AGENT_ROLES` — the 6 agents with tier definitions
  - Slim test file from Task 3 — tests that should now PASS

  **Acceptance Criteria**:
  - [ ] Tests from Task 3 now PASS
  - [ ] ALL existing tests still PASS
  - [ ] `npm run typecheck` passes

  **QA Scenarios:**
  ```
  Scenario: Slim tests pass after fix
    Tool: Bash
    Steps:
      1. Run `npm run test -- --reporter=verbose` for the slim test file
    Expected Result: ALL tests pass. 0 failures.
    Evidence: .sisyphus/evidence/task-5-green-phase.txt
  ```

  **Commit**: YES
  - Message: `fix: prevent slim-variant agents from disappearing when tier models unavailable`
  - Files: `oh-my-opencode-slim.ts`, slim test file
  - Pre-commit: `npm run test && npm run typecheck`

- [x] 6. Add unresolved visual state to TierAssignments components (both variants)

  **What to do**:
  - In `dashboard/src/components/oh-my-opencode/tier-assignments.tsx` (normal variant):
    - Add optional `isUnresolved?: boolean` prop to the agent assignment item interface/type
    - When `isUnresolved` is true:
      - Render a small amber/yellow warning icon (⚠️ or SVG) next to the agent name
      - Add tooltip text: "Model not available — select a different model"
      - Show the unavailable model name in muted/amber style instead of normal blue badge
    - Keep the agent row fully interactive (user can still click to select different model)
  - In `dashboard/src/components/oh-my-opencode-slim/tier-assignments.tsx` (slim variant):
    - Same treatment: add `isUnresolved` prop and warning indicator
  - Follow existing component patterns — minimal changes, no new components

  **Must NOT do**:
  - Do NOT redesign ModelBadge entirely — add minimal `isUnresolved` state only
  - Do NOT create new component files
  - Do NOT add new dependencies

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: [`frontend-ui-ux`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 4, 5)
  - **Blocks**: Tasks 7, 8
  - **Blocked By**: None (can start immediately)

  **References**:
  - `dashboard/src/components/oh-my-opencode/tier-assignments.tsx` — normal variant tier assignments. Lines 42-102 show rendering logic with `{agentAssignments.length > 0 && (` conditional. The item interface/type needs `isUnresolved` added
  - `dashboard/src/components/oh-my-opencode-slim/tier-assignments.tsx` — slim variant equivalent
  - `dashboard/src/components/oh-my-opencode/model-badge.tsx` — the model badge component. May need `isUnresolved` variant for amber/muted styling
  - Look at existing Tailwind amber classes used elsewhere in the project for consistent warning styling

  **Acceptance Criteria**:
  - [ ] `npm run typecheck` passes
  - [ ] `npm run build` succeeds
  - [ ] Agent rows with `isUnresolved=true` show visible warning indicator
  - [ ] Agent rows remain interactive/clickable when unresolved

  **QA Scenarios:**
  ```
  Scenario: Unresolved agent shows warning indicator
    Tool: Bash
    Steps:
      1. Run `npm run typecheck`
      2. Run `npm run build`
    Expected Result: Both pass. Components accept new `isUnresolved` prop without type errors.
    Evidence: .sisyphus/evidence/task-6-build.txt
  ```

  **Commit**: NO (groups with Task 7)

- [x] 7. Integrate preset warning toast + unresolved agents in normal-variant UI

  **What to do**:
  - In `dashboard/src/components/oh-my-opencode-config-generator.tsx`:
    - **Agent rendering loop (lines ~524-553)**: Change logic so agents are ALWAYS pushed to `agentAssignments` from `UPSTREAM_AGENT_CHAINS`, regardless of model resolution:
      - If override model is available → use it (existing behavior)
      - If override model unavailable but chain resolves → use chain model + set `isUnresolved: true`
      - If neither override nor chain resolves → still push agent with `isUnresolved: true` and `model: overrideModel ?? chain[0]` (show what was intended)
    - **Category rendering loop (lines ~565-594)**: Same treatment as agents
    - **Preset onChange handler (lines ~616-624)**: After `applyPreset()`, call `getMissingPresetModels(preset, availableModelIds)`. If result is non-empty, show a toast warning:
      ```
      showToast({
        title: "Preset applied — some models missing",
        description: `Missing models: ${missingModels.map(m => m.model).join(", ")}. Agents will use fallback models where available.`,
        variant: "warning"
      })
      ```
    - Pass `isUnresolved` flag through to `TierAssignments` for each agent/category
    - Ensure agents with `isUnresolved: true` remain fully interactive (model selection dropdown works)

  **Must NOT do**:
  - Do NOT create a new toast/notification system — use existing `showToast` / `useToast`
  - Do NOT change `applyPreset()` or `resolveChain()`
  - Do NOT modify the generated JSON output
  - Do NOT add new dependencies

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3 (with Task 8)
  - **Blocks**: F1-F4
  - **Blocked By**: Tasks 2, 4, 6

  **References**:
  - `dashboard/src/components/oh-my-opencode-config-generator.tsx:524-553` — agent rendering loop. This is where agents get filtered — must change to always include all agents
  - `dashboard/src/components/oh-my-opencode-config-generator.tsx:565-594` — category rendering loop, same pattern
  - `dashboard/src/components/oh-my-opencode-config-generator.tsx:616-624` — preset onChange handler, add getMissingPresetModels call + toast here
  - `dashboard/src/lib/config-generators/oh-my-opencode.ts:getMissingPresetModels` — utility function from Task 2
  - `dashboard/src/components/oh-my-opencode/tier-assignments.tsx` — receives `isUnresolved` prop from Task 6
  - `dashboard/src/hooks/notification-utils.ts` — existing toast/notification utilities, check for `showToast` or similar
  - `dashboard/src/lib/config-generators/oh-my-opencode.ts:23-46` — `UPSTREAM_AGENT_CHAINS` / `UPSTREAM_CATEGORY_CHAINS` — iterate over these directly instead of relying on build output

  **Acceptance Criteria**:
  - [ ] `npm run typecheck` passes
  - [ ] `npm run build` succeeds
  - [ ] `npm run test` → all tests pass
  - [ ] ALL agents from `UPSTREAM_AGENT_CHAINS` always appear in `agentAssignments` regardless of model availability
  - [ ] Preset selection with missing models triggers toast warning with model names
  - [ ] Unresolved agents show warning indicator (via `isUnresolved` prop from Task 6)

  **QA Scenarios:**
  ```
  Scenario: Build succeeds with UI changes
    Tool: Bash
    Steps:
      1. Run `npm run typecheck && npm run build`
    Expected Result: Exit code 0 for both
    Evidence: .sisyphus/evidence/task-7-build.txt

  Scenario: All tests pass after integration
    Tool: Bash
    Steps:
      1. Run `npm run test`
    Expected Result: All tests pass, 0 failures
    Evidence: .sisyphus/evidence/task-7-tests.txt
  ```

  **Commit**: YES
  - Message: `feat(ui): show warning toast and unresolved indicator for missing preset models`
  - Files: `oh-my-opencode-config-generator.tsx`
  - Pre-commit: `npm run test && npm run typecheck && npm run build`

- [x] 8. Integrate unresolved agents in slim-variant UI

  **What to do**:
  - Find the slim-variant UI component that renders agent assignments (likely `dashboard/src/components/opencode-config-generator.tsx` or a section within it)
  - Apply same logic as Task 7 but for slim variant:
    - Always render ALL 6 slim agents from `SLIM_AGENT_ROLES`, regardless of model availability
    - When `pickBestModel()` returns null for an agent's tier, set `isUnresolved: true`
    - Pass `isUnresolved` through to slim `TierAssignments` (updated in Task 6)
  - No preset toast needed for slim (slim doesn't have its own preset system)

  **Must NOT do**:
  - Do NOT change `pickBestModel()` function
  - Do NOT add preset system to slim variant

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Task 7)
  - **Blocks**: F1-F4
  - **Blocked By**: Tasks 5, 6

  **References**:
  - `dashboard/src/components/opencode-config-generator.tsx` — the main config generator that handles variant switching. Find slim-specific agent rendering
  - `dashboard/src/components/oh-my-opencode-slim/tier-assignments.tsx` — slim tier assignments component (updated in Task 6)
  - `dashboard/src/lib/config-generators/oh-my-opencode-slim.ts:14-21` — `SLIM_AGENT_ROLES` — always render all 6 agents

  **Acceptance Criteria**:
  - [ ] `npm run typecheck` passes
  - [ ] `npm run build` succeeds
  - [ ] ALL 6 slim agents always visible regardless of model availability
  - [ ] Unresolved slim agents show warning indicator

  **QA Scenarios:**
  ```
  Scenario: Slim build succeeds with changes
    Tool: Bash
    Steps:
      1. Run `npm run typecheck && npm run build`
    Expected Result: Exit code 0
    Evidence: .sisyphus/evidence/task-8-build.txt
  ```

  **Commit**: YES
  - Message: `fix: prevent slim-variant agents from disappearing when tier models unavailable`
  - Files: slim UI component, `oh-my-opencode-slim/tier-assignments.tsx`
  - Pre-commit: `npm run test && npm run typecheck && npm run build`
---

## Final Verification Wave

> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.

- [ ] F1. **Plan Compliance Audit** — `oracle`
  Read the plan end-to-end. For each "Must Have": verify implementation exists (read file, run command). For each "Must NOT Have": search codebase for forbidden patterns — reject with file:line if found. Check evidence files exist in .sisyphus/evidence/. Compare deliverables against plan.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [ ] F2. **Code Quality Review** — `unspecified-high`
  Run `npm run typecheck` + `npm run test`. Review all changed files for: `as any`/`@ts-ignore`, empty catches, console.log in prod, commented-out code, unused imports. Check AI slop: excessive comments, over-abstraction, generic names.
  Output: `Build [PASS/FAIL] | Tests [N pass/N fail] | Files [N clean/N issues] | VERDICT`

- [ ] F3. **Real Manual QA** — `unspecified-high`
  Start from clean state. Execute EVERY QA scenario from EVERY task — follow exact steps, capture evidence. Test cross-task integration. Save to `.sisyphus/evidence/final-qa/`.
  Output: `Scenarios [N/N pass] | Integration [N/N] | VERDICT`

- [ ] F4. **Scope Fidelity Check** — `deep`
  For each task: read "What to do", read actual diff. Verify 1:1 — everything in spec was built, nothing beyond spec was built. Check "Must NOT do" compliance. Flag unaccounted changes.
  Output: `Tasks [N/N compliant] | Unaccounted [CLEAN/N files] | VERDICT`

---

## Commit Strategy

- **After Wave 2**: `fix: prevent agents from disappearing when preset models unavailable`
  - Files: `oh-my-opencode.ts`, `oh-my-opencode-slim.ts`, `oh-my-opencode-config.test.ts`, `tier-assignments.tsx` (both variants)
  - Pre-commit: `npm run test && npm run typecheck`

- **After Wave 3**: `feat(ui): show warning toast and unresolved indicator for missing preset models`
  - Files: `oh-my-opencode-config-generator.tsx`, slim UI component
  - Pre-commit: `npm run test && npm run typecheck && npm run build`

---

## Success Criteria

### Verification Commands
```bash
npm run test          # Expected: all tests pass (0 failures)
npm run typecheck     # Expected: no type errors
npm run build         # Expected: successful production build
```

### Final Checklist
- [ ] All "Must Have" present
- [ ] All "Must NOT Have" absent
- [ ] All tests pass (old + new)
- [ ] Preset with missing models → toast warning with model list
- [ ] All agents visible in TierAssignments regardless of model availability
- [ ] Unresolved agents show ⚠️ indicator
- [ ] Generated JSON only contains available models
- [ ] Both Normal + Slim variants fixed
