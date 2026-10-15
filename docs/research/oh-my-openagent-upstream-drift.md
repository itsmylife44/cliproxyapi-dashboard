# Oh-My-OpenAgent upstream drift vs. dashboard (research)

Status: research only, no code changed. Date 2026-10-15. Upstream was checked at the latest release
tag **v5.1.33**, published 2026-10-13. The tag points at commit
`7a752ab5a88c2d255b926aff1c687b6d91758d02`. The default branch is `dev`, not `main`. `dev` HEAD
`70b674e26d14bc0fb674a6ed34815c2efe7a7179` (2026-10-15) ships a byte-identical
`assets/oh-my-opencode.schema.json`. Dashboard paths are relative to the repo root at `main`
(`48aaca44d97da7128d336e1b2cd1e97ac0bb1967`).

**Our last alignment: upstream v3.15.3.** `ae80424` ("feat: update to OhMyOpenAgent with presets,
advanced options, and config management (#164)", 2026-04-06 07:57Z) landed four hours after v3.15.3
was published (2026-04-06 03:59Z). v3.16.0 followed on 2026-04-08. Our hard-coded
`UPSTREAM_AGENT_CHAINS` / `UPSTREAM_CATEGORY_CHAINS` (`dashboard/src/lib/config-generators/oh-my-opencode.ts:23-46`)
match v3.15.3's `src/shared/model-requirements.ts` model for model. The only difference is that we
write `claude-opus-4.6` where upstream writes `claude-opus-4-6`. Later commits that touched these
files (`7b726aa`, `7683bf8`, `d2c48db`) did not touch any upstream-facing key or model id.
**Upstream window: v3.15.3 to v5.1.33. That is 179 releases, two major versions and 82 `5.0.0-beta`
tags.**

Abbreviations used for sources:

- **OMO**: `code-yeongyu/oh-my-openagent@7a752ab` (= `v5.1.33`), base URL
  `https://github.com/code-yeongyu/oh-my-openagent/blob/7a752ab5a88c2d255b926aff1c687b6d91758d02/`
- **OMO3**: `code-yeongyu/oh-my-openagent@abda3c5` (= `v3.15.3`, our baseline), base URL
  `https://github.com/code-yeongyu/oh-my-openagent/blob/abda3c52f0f81d568a147ea540ec9050cb677a74/`
- **REL**: `gh api repos/code-yeongyu/oh-my-openagent/releases --paginate` (339 releases read). Each
  tag links to `https://github.com/code-yeongyu/oh-my-openagent/releases/tag/<tag>`.
- **SYNC**: `itsmylife44/opencode-cliproxyapi-sync@9555b2e`, which is the plugin that writes our bundle
  to disk. Base URL
  `https://github.com/itsmylife44/opencode-cliproxyapi-sync/blob/9555b2e35a593e0d6d09f0c057b49ab64d865d46/`
- **DASH**: this repo at `48aaca4`, base URL
  `https://github.com/itsmylife44/cliproxyapi-dashboard/blob/48aaca44d97da7128d336e1b2cd1e97ac0bb1967/`

All links point at those exact SHAs or tags. The slim variant (`oh-my-opencode-slim`) is a separate
upstream and is out of scope.

## 1. Summary

- **Critical: the file we generate is no longer read.** Since **v4.19.3** (2026-07-28), the OpenCode
  plugin reads only `~/.omo/omo.jsonc` (or the project file `.omo/omo.jsonc`). Its options sit inside an
  `"[opencode]"` block. `oh-my-opencode.json[c]` and `oh-my-openagent.json[c]` are read only by a
  one-time migration. Our sync plugin still writes `~/.config/opencode/oh-my-opencode.json`
  (SYNC `src/index.ts:45`).
- **Critical: the migration drops our content.** Since **v5.0.0-beta.20** (2026-08-25), that migration
  imports only `disabled_providers`, `model_fallback`, `models` and `sisyphus_agent`.
  **`agents` and `categories` are deleted**, and hooks and other plugin settings are not imported
  either. So since 2026-07-28 none of the model assignments the dashboard generates reach the plugin
  (users get `oh-my-openagent@latest`, see `opencode.ts:355`). This follows from the source. It was
  **not reproduced at runtime**.
- **High: the product direction changed.** v5.0.0 (2026-09-26) made "OmO Native" (`omo-ai`, the `omo`
  CLI) the primary product. It says the OpenCode plugin and LazyCodex "get degraded support… new
  features land in OmO Native first" and recommends removing them. The OpenCode edition is now
  documented as "(legacy)".
- **Medium: the values inside the file have drifted.** Our `$schema` URL returns 404 (there is no
  `main` branch). `browser_automation_engine.provider: "agent-browser"` and `disabled_commands`
  `init-deep` / `start-work` now **fail schema validation**. Top-level `lsp` was never a valid key and
  is no longer read. Six of our hook names and two of our skill names no longer exist. `variant`,
  `fallback_models` and `thinking` are deprecated in favour of `reasoning`, `models` and
  `providerOptions`.
- **Medium: every model chain is out of date.** Every agent and category chain head changed (for
  example `claude-opus-4-6` → `claude-opus-5-5`, `gpt-5.4` → `gpt-5.6-sol`/`gpt-6-*`, plus new
  `claude-fable-5-1` and `kimi-k3`). The `deep` category became `deep-low` (it is renamed on load), and
  `deep-high` is new. The OpenCode edition still uses the same 11 agent ids. `metis`/`momus` were
  renamed only on the Native/shared surface.

## 2. Upstream version timeline since our alignment

Only releases that matter to us are listed. "npm" is the publish time from `npm view oh-my-openagent time`.

| Version | Date | What matters for us | Source |
|---|---|---|---|
| v3.15.3 | 2026-04-06 | **Our baseline.** Config file is `~/.config/opencode/oh-my-openagent.json[c]` or legacy `oh-my-opencode.json[c]`. | [REL v3.15.3](https://github.com/code-yeongyu/oh-my-openagent/releases/tag/v3.15.3), OMO3 `src/shared/model-requirements.ts` |
| v3.17.0 | 2026-04-11 | `feat(cli): integrate legacy config migration into write-omo-config` (`87ddb9ba`). | [REL v3.17.0](https://github.com/code-yeongyu/oh-my-openagent/releases/tag/v3.17.0) |
| v4.0.0 | 2026-05-07 | Team Mode (`team_mode.enabled`, off by default). Walk-up project config discovery. "Rename transition updates across package detection, plugin/config compatibility". `reasoningEffort: "max"`. | [REL v4.0.0](https://github.com/code-yeongyu/oh-my-openagent/releases/tag/v4.0.0) |
| v4.11.0 | 2026-06-17 | Skill `frontend-ui-ux` renamed to `frontend` (`f347c8e78`, `f9e7325f3`). | [REL v4.11.0](https://github.com/code-yeongyu/oh-my-openagent/releases/tag/v4.11.0) |
| v4.16.0 | 2026-07-07 | New `omo.json` loader in `omo-config-core` (`a13f88bbd`). | [REL v4.16.0](https://github.com/code-yeongyu/oh-my-openagent/releases/tag/v4.16.0) |
| v4.19.0 | 2026-07-17 | Ralph Loop replaced by **Goal** (`/goal`, `goal` config). `ralph_loop` configs are migrated. | [REL v4.19.0](https://github.com/code-yeongyu/oh-my-openagent/releases/tag/v4.19.0) |
| **v4.19.3** | **2026-07-28** (npm 15:33Z) | **Breaking:** "`omo.jsonc` is now the only config surface". Legacy `oh-my-*.json[c]` "no longer read at runtime" (`877d1eff9a refactor(opencode): remove legacy config load paths`). | [REL v4.19.3](https://github.com/code-yeongyu/oh-my-openagent/releases/tag/v4.19.3), [configuration.md@v4.19.3 L3, L47-L50](https://github.com/code-yeongyu/oh-my-openagent/blob/614cc5358dc393153fc39acae74dc5bd9fb9fffc/docs/reference/configuration.md#L3) vs [@v4.19.2 L3](https://github.com/code-yeongyu/oh-my-openagent/blob/3f917a94c4bc425de94ec8cc6223cda95328021c/docs/reference/configuration.md#L3) |
| v4.19.4 | 2026-08-01 | Unified `reasoning` field (`37563bb7e`, PR #6455). `variant`/`reasoningEffort` become compatibility inputs. | [REL v4.19.4](https://github.com/code-yeongyu/oh-my-openagent/releases/tag/v4.19.4) |
| **v5.0.0-beta.20** | **2026-08-25** | **Breaking:** the legacy migration stops importing `agents` and `categories` (`03c04c0dbb fix(config-migration): omit legacy agent and category imports`; first tag that contains it, by `gh api compare`). | [REL v5.0.0-beta.20](https://github.com/code-yeongyu/oh-my-openagent/releases/tag/v5.0.0-beta.20) |
| v5.0.0-beta.53 | 2026-09-10 | `metis` → `plan-consultant`, `momus` → `plan-reviewer` **on the omo/senpi surface only**. "The OpenCode and Codex editions keep their own agent ids". | [REL v5.0.0-beta.53](https://github.com/code-yeongyu/oh-my-openagent/releases/tag/v5.0.0-beta.53) |
| v5.0.0-beta.63 | 2026-09-15 | `agent-browser` provider and skill removed. `browser_automation_engine.provider: "agent-browser"` "now fail[s] schema validation". | [REL v5.0.0-beta.63](https://github.com/code-yeongyu/oh-my-openagent/releases/tag/v5.0.0-beta.63) |
| v5.0.0-beta.80 | 2026-09-20 | `deep` split into `deep-low` (default) and `deep-high`. `categories.deep` is renamed on first launch. | [REL v5.0.0-beta.80](https://github.com/code-yeongyu/oh-my-openagent/releases/tag/v5.0.0-beta.80) |
| **v5.0.0** | **2026-09-26** | OmO Native (`omo-ai`) is stable. The OpenCode plugin is "degraded support", and upstream recommends removing it. | [REL v5.0.0](https://github.com/code-yeongyu/oh-my-openagent/releases/tag/v5.0.0) |
| v5.1.0 … v5.1.33 | 2026-09-28 … 2026-10-13 | 33 patch releases. The schema did not change at the top level between v5.1.33 and `dev` HEAD. | [REL v5.1.33](https://github.com/code-yeongyu/oh-my-openagent/releases/tag/v5.1.33) |

Package and repo identity (checked 2026-10-15):

- The `code-yeongyu/oh-my-opencode` repo redirects to `code-yeongyu/oh-my-openagent`
  (`gh api repos/code-yeongyu/oh-my-opencode` returns `full_name: code-yeongyu/oh-my-openagent`).
  The default branch is `dev`, and a `main` branch does not exist (`gh api .../branches/main` returns 404).
- npm `oh-my-openagent`: `latest` = 5.1.33. Its bins are `oh-my-openagent`, `oh-my-opencode`,
  `lazycodex` and others. npm `oh-my-opencode` is also at 5.1.33 and has no `deprecated` flag. The new
  package `omo-ai` is OmO Native.
- The OpenCode `plugin` entry is still `"oh-my-openagent"`
  ([installation.md L422](https://github.com/code-yeongyu/oh-my-openagent/blob/7a752ab5a88c2d255b926aff1c687b6d91758d02/docs/guide/installation.md#L422)),
  so our `"oh-my-openagent@latest"` plugin entry is still correct.

## 3. Diff table

Status values: **new / removed / renamed / default changed / type changed / deprecated**. "Ours" is
what `buildOhMyOpenCodeConfig` emits or what our UI and types offer. The legacy schema is
`assets/oh-my-opencode.schema.json`. Its 46 top-level properties are identical to `omo.schema.json`
`definitions.opencode`, which is the `"[opencode]"` block (verified by diffing both files at OMO).

### 3a. Config surface

| Item | Upstream (OMO) | Ours | Status | Source |
|---|---|---|---|---|
| Config file | `~/.omo/omo.jsonc` (falls back to `omo.json`). Project layers `.omo/omo.jsonc` walked up to `$HOME`. | Bundle key `ohMyOpencode`, written by SYNC to `<opencode config dir>/oh-my-opencode.json`. The UI download is named `oh-my-openagent.json`. | **renamed + removed** (legacy not read at runtime) | [configuration.md L3, L45-L50](https://github.com/code-yeongyu/oh-my-openagent/blob/7a752ab5a88c2d255b926aff1c687b6d91758d02/docs/reference/configuration.md#L45-L50), [loader/paths.ts L27-L40](https://github.com/code-yeongyu/oh-my-openagent/blob/7a752ab5a88c2d255b926aff1c687b6d91758d02/packages/omo-config-core/src/loader/paths.ts#L27-L40), [plugin-config/omo-config-chain.ts L30, L126-L143](https://github.com/code-yeongyu/oh-my-openagent/blob/7a752ab5a88c2d255b926aff1c687b6d91758d02/packages/omo-opencode/src/plugin-config/omo-config-chain.ts#L126-L143) |
| File shape | `{ "$schema", "[opencode]": { …plugin keys… }, "[native]", "[codex]", "profiles", "models", "_migrations", … }` (VSCode-style harness blocks) | A flat object with plugin keys at the root | **type changed** | [configuration.md L52-L61](https://github.com/code-yeongyu/oh-my-openagent/blob/7a752ab5a88c2d255b926aff1c687b6d91758d02/docs/reference/configuration.md#L52-L61) |
| Legacy import | Only `disabled_providers`, `model_fallback`, `models`, `sisyphus_agent` (from `omo_agent`). `agents`/`categories` are deleted. The source file is moved to `~/.omo/migration-backup-*`. Runs once per `_migrations` marker. | Everything we generate | **removed** (our keys are dropped) | [transform-opencode.ts L13-L31](https://github.com/code-yeongyu/oh-my-openagent/blob/7a752ab5a88c2d255b926aff1c687b6d91758d02/packages/omo-opencode/src/config-migration/transform-opencode.ts#L13-L31), [configuration.md L105-L117](https://github.com/code-yeongyu/oh-my-openagent/blob/7a752ab5a88c2d255b926aff1c687b6d91758d02/docs/reference/configuration.md#L105-L117), [discovery-paths.ts L9-L14](https://github.com/code-yeongyu/oh-my-openagent/blob/7a752ab5a88c2d255b926aff1c687b6d91758d02/packages/omo-opencode/src/config-migration/discovery-paths.ts#L9-L14) |
| Leftover legacy file | `doctor` warns: "Legacy configuration remains at … It is not part of the unified OMO config chain." | SYNC rewrites it on every startup | — | [legacy-config-leftovers.ts](https://github.com/code-yeongyu/oh-my-openagent/blob/7a752ab5a88c2d255b926aff1c687b6d91758d02/packages/omo-opencode/src/cli/doctor/checks/legacy-config-leftovers.ts) |
| `$schema` | `https://raw.githubusercontent.com/code-yeongyu/oh-my-openagent/dev/assets/omo.schema.json` (written by the migration) | `…/oh-my-openagent/main/assets/oh-my-opencode.schema.json` → **HTTP 404** (fetched 2026-10-15; `dev/…/oh-my-opencode.schema.json` returns 200) | **renamed** | [schema-url.ts L1-L2](https://github.com/code-yeongyu/oh-my-openagent/blob/7a752ab5a88c2d255b926aff1c687b6d91758d02/packages/omo-opencode/src/config-migration/schema-url.ts#L1-L2), [configuration.md L95-L101](https://github.com/code-yeongyu/oh-my-openagent/blob/7a752ab5a88c2d255b926aff1c687b6d91758d02/docs/reference/configuration.md#L95-L101) |
| Invalid values | The loader drops only the smallest invalid subtree and keeps its siblings ("bounded surgical pruning") | — | new behaviour | [prune-invalid-leaves.ts](https://github.com/code-yeongyu/oh-my-openagent/blob/7a752ab5a88c2d255b926aff1c687b6d91758d02/packages/omo-config-core/src/loader/prune-invalid-leaves.ts) |
| Upstream presets | `docs/examples/{default,coding-focused,planning-focused}.jsonc` are now `omo.jsonc` shared-base files for the Native agents (`explore`, `librarian`, `plan-consultant`, `plan-reviewer`) | `oh-my-opencode-presets.json` mirrors the v3.15.3 versions (sisyphus, hephaestus, …) | **type changed** | [default.jsonc@OMO](https://github.com/code-yeongyu/oh-my-openagent/blob/7a752ab5a88c2d255b926aff1c687b6d91758d02/docs/examples/default.jsonc) vs [@OMO3](https://github.com/code-yeongyu/oh-my-openagent/blob/abda3c52f0f81d568a147ea540ec9050cb677a74/docs/examples/default.jsonc) |

### 3b. Top-level keys (OpenCode block)

| Key | Upstream (OMO) | Ours | Status | Source |
|---|---|---|---|---|
| `lsp` | Not a key, and it was not one at OMO3 either. "The previous top-level `lsp` block … is no longer read; the migration strips it." Use `.opencode/lsp.json` / `.omo/lsp.json` for the built-in `lsp` MCP. | Emitted when set (`oh-my-opencode.ts:386-388`). Schema-**invalid** (ajv, see 3f). | **removed** | [configuration.md L975-L993](https://github.com/code-yeongyu/oh-my-openagent/blob/7a752ab5a88c2d255b926aff1c687b6d91758d02/docs/reference/configuration.md#L975-L993) |
| `agent_order`, `agent_definitions`, `disabled_providers`, `telemetry`, `goal`, `i18n`, `monitor`, `team_mode`, `keyword_detector`, `tui`, `ulw_execute`, `default_mode` | Present | Not supported | **new** (12 keys; diff of OMO3 vs OMO schema) | [oh-my-opencode.schema.json@OMO](https://github.com/code-yeongyu/oh-my-openagent/blob/7a752ab5a88c2d255b926aff1c687b6d91758d02/assets/oh-my-opencode.schema.json) |
| `team_mode` | `{enabled:false, tmux_visualization:false, max_parallel_members:4, max_members:8, …}` | — | **new** (v4.0.0) | schema above, [REL v4.0.0](https://github.com/code-yeongyu/oh-my-openagent/releases/tag/v4.0.0) |
| `auto_update` | boolean | `false` | unchanged | schema above |
| `hashline_edit` | Top-level boolean. `experimental.hashline_edit` is legacy and gets moved. | Top level | unchanged | [configuration.md L1326-L1334](https://github.com/code-yeongyu/oh-my-openagent/blob/7a752ab5a88c2d255b926aff1c687b6d91758d02/docs/reference/configuration.md#L1326-L1334) |
| `disabled_skills` | `string[]` (free). Builtins: `playwright, dev-browser, frontend, git-master, review-work, remove-ai-slops, init-deep, debugging, security-research, security-review, visual-qa, team-mode` | Offers `playwright, agent-browser, frontend-ui-ux, git-master` | **type changed** (enum → string). `agent-browser` **removed**, `frontend-ui-ux` **renamed** `frontend` | [agent-names.ts L17-L30](https://github.com/code-yeongyu/oh-my-openagent/blob/7a752ab5a88c2d255b926aff1c687b6d91758d02/packages/omo-opencode/src/config/schema/agent-names.ts#L17-L30), [oh-my-opencode-config.ts L44](https://github.com/code-yeongyu/oh-my-openagent/blob/7a752ab5a88c2d255b926aff1c687b6d91758d02/packages/omo-opencode/src/config/schema/oh-my-opencode-config.ts#L44) vs [OMO3 L34](https://github.com/code-yeongyu/oh-my-openagent/blob/abda3c52f0f81d568a147ea540ec9050cb677a74/src/config/schema/oh-my-opencode-config.ts#L34) |
| `disabled_commands` | Enum `goal, refactor, ulw-execute, stop-continuation, remove-ai-slops, hyperplan` | Offers `init-deep, start-work` | `init-deep`, `start-work`, `ralph-loop`, `ulw-loop`, `cancel-ralph` **removed**. Our two values are **schema-invalid**. | [commands.ts L3-L10](https://github.com/code-yeongyu/oh-my-openagent/blob/7a752ab5a88c2d255b926aff1c687b6d91758d02/packages/omo-opencode/src/config/schema/commands.ts#L3-L10) vs [OMO3 commands.ts](https://github.com/code-yeongyu/oh-my-openagent/blob/abda3c52f0f81d568a147ea540ec9050cb677a74/src/config/schema/commands.ts) |
| `disabled_hooks` | `string[]` (free). 59 hook names. | 32 names in `HOOK_GROUPS` | **removed**: `context-window-monitor`, `session-recovery`, `thinking-block-validator`, `ralph-loop`, `start-work` (all existed at OMO3). `grep-output-truncator` did not exist at OMO3 either. **new**, not offered: `goal`, `ulw-execute`, `team-tool-gating`, `hephaestus-agents-md-injector`, `no-sisyphus-gpt`, `no-hephaestus-non-gpt`, `runtime-fallback`, `hashline-read-enhancer`, `native-edition-nudge`, `legacy-plugin-toast`, … | [hooks.ts L3-L61](https://github.com/code-yeongyu/oh-my-openagent/blob/7a752ab5a88c2d255b926aff1c687b6d91758d02/packages/omo-opencode/src/config/schema/hooks.ts#L3-L61) vs [OMO3 hooks.ts](https://github.com/code-yeongyu/oh-my-openagent/blob/abda3c52f0f81d568a147ea540ec9050cb677a74/src/config/schema/hooks.ts) |
| `disabled_agents` | `string[]`. Builtins are unchanged (see 3c). | `AVAILABLE_AGENTS` (11) | unchanged | [agent-names.ts L3-L15](https://github.com/code-yeongyu/oh-my-openagent/blob/7a752ab5a88c2d255b926aff1c687b6d91758d02/packages/omo-opencode/src/config/schema/agent-names.ts#L3-L15) |
| `browser_automation_engine.provider` | Enum `playwright` (default), `dev-browser`, `playwright-cli`. Other values fail validation. | Offers `playwright`, `agent-browser` | `agent-browser` **removed** (beta.63). `dev-browser` and `playwright-cli` are not offered (both existed at OMO3). | [browser-automation.ts L3-L9](https://github.com/code-yeongyu/oh-my-openagent/blob/7a752ab5a88c2d255b926aff1c687b6d91758d02/packages/omo-opencode/src/config/schema/browser-automation.ts#L3-L9), [configuration.md L880-L901](https://github.com/code-yeongyu/oh-my-openagent/blob/7a752ab5a88c2d255b926aff1c687b6d91758d02/docs/reference/configuration.md#L880-L901) |
| `browser_automation_engine.playwright_mcp_args` | `string[]`, user layer only | — | **new** | [configuration.md L89-L91](https://github.com/code-yeongyu/oh-my-openagent/blob/7a752ab5a88c2d255b926aff1c687b6d91758d02/docs/reference/configuration.md#L89-L91) |
| `tmux` | `enabled, layout, main_pane_size (20–80), main_pane_min_width, agent_pane_min_width, isolation (inline/window/session)` | Same minus `isolation`. Layouts match. | `isolation` not offered (it existed at OMO3) | [configuration.md L903-L927](https://github.com/code-yeongyu/oh-my-openagent/blob/7a752ab5a88c2d255b926aff1c687b6d91758d02/docs/reference/configuration.md#L903-L927) |
| `background_task` | Adds `maxLiveDescendantsPerRoot` and `taskCleanupDelayMs`. `maxDescendants` is gone. `staleTimeoutMs` min 60000. `0` means unlimited. | `defaultConcurrency, staleTimeoutMs, providerConcurrency, modelConcurrency` | **new** / **removed** (only keys we don't use) | schema diff, [configuration.md L456-L458](https://github.com/code-yeongyu/oh-my-openagent/blob/7a752ab5a88c2d255b926aff1c687b6d91758d02/docs/reference/configuration.md#L456-L458) |
| `git_master.commit_footer` | Default `false` | We force `false` | **default changed** (now matches ours) | [configuration.md L929-L941](https://github.com/code-yeongyu/oh-my-openagent/blob/7a752ab5a88c2d255b926aff1c687b6d91758d02/docs/reference/configuration.md#L929-L941) |
| `git_master.include_co_authored_by` | "deprecated no-op kept so existing configs still validate" | We force `false`, and the UI toggle is shown | **deprecated** | same, L937 |
| `experimental` | `auto_resume` removed. `disable_live_parent_wake_routing` added. `aggressive_truncation` and `task_system` are still present (both default `false`). | `aggressive_truncation`, `task_system` | unchanged for our keys | [configuration.md L1336-L1386](https://github.com/code-yeongyu/oh-my-openagent/blob/7a752ab5a88c2d255b926aff1c687b6d91758d02/docs/reference/configuration.md#L1336-L1386) |
| `sisyphus_agent` | `disabled, tdd, default_builder_enabled, planner_enabled, replace_plan` | All except `tdd` | unchanged (`tdd` existed at OMO3) | [opencode-config.md L357-L380](https://github.com/code-yeongyu/oh-my-openagent/blob/7a752ab5a88c2d255b926aff1c687b6d91758d02/docs/reference/opencode-config.md#L357-L380) |

### 3c. Agents (OpenCode edition)

| Item | Upstream (OMO) | Ours | Status | Source |
|---|---|---|---|---|
| Builtin ids | `sisyphus, hephaestus, prometheus, oracle, librarian, explore, multimodal-looker, metis, momus, atlas, sisyphus-junior` (overridable: also `build, plan, OpenCode-Builder`) | Same 11 | unchanged | [agent-names.ts L3-L42](https://github.com/code-yeongyu/oh-my-openagent/blob/7a752ab5a88c2d255b926aff1c687b6d91758d02/packages/omo-opencode/src/config/schema/agent-names.ts#L3-L42), [opencode-config.md L9](https://github.com/code-yeongyu/oh-my-openagent/blob/7a752ab5a88c2d255b926aff1c687b6d91758d02/docs/reference/opencode-config.md#L9) |
| `metis` / `momus` | Renamed to `plan-consultant` / `plan-reviewer` **only on the shared/Native surface**. The old ids there stopped aliasing after beta.51. The OpenCode edition keeps them. | `metis`, `momus` | renamed (Native only) | [configuration.md L191-L202](https://github.com/code-yeongyu/oh-my-openagent/blob/7a752ab5a88c2d255b926aff1c687b6d91758d02/docs/reference/configuration.md#L191-L202), [REL v5.0.0-beta.53](https://github.com/code-yeongyu/oh-my-openagent/releases/tag/v5.0.0-beta.53) |
| Custom agents | `agents` accepts any key (`additionalProperties` is an object schema) | Only the 11 builtins | **new** (OMO3 had `additionalProperties: false`) | schema diff |
| `models` | Ordered model chain (strings or per-model objects) | — | **new** | [configuration.md L210-L236](https://github.com/code-yeongyu/oh-my-openagent/blob/7a752ab5a88c2d255b926aff1c687b6d91758d02/docs/reference/configuration.md#L210-L236) |
| `fallback_models` | "Deprecated compatibility fallback chain". Object entries are allowed. | `string[]` | **deprecated** | same, L214 |
| `reasoning` | Canonical: `off, minimal, low, medium, high, xhigh, max, auto` (or a harness token) | — | **new** (v4.19.4) | same, L215; [REL v4.19.4](https://github.com/code-yeongyu/oh-my-openagent/releases/tag/v4.19.4) |
| `variant`, `reasoningEffort` | "Deprecated compatibility input; use `reasoning`" | `variant` (UI + presets, 16 uses) | **deprecated** | same, L229, L232 |
| `thinking` | "Migrated legacy Anthropic form; use `reasoning` plus provider options". Example: `providerOptions.thinking`. | `thinking {type, budgetTokens}` (planning preset) | **deprecated** | same, L231, L238-L249 |
| `ultrawork` | `{model, reasoning, variant}` | `{model, variant, temperature}` | `reasoning` **new**. `temperature` is **not in the schema** (`additionalProperties: false`). | schema `agents.sisyphus.ultrawork` |
| `permission` | `ask / allow / deny`. Adds `webfetch, task, doom_loop, external_directory`, and other keys are allowed. | `allow / deny / prompt` | `prompt` was **never valid** (OMO3 already used `ask`). Pre-existing bug. | schema `agents.*.permission` at OMO and OMO3 |
| Other new fields | `displayName`. `top_p, prompt, tools, disable, mode, color, category, skills, maxTokens, textVerbosity, providerOptions, compaction` all existed at OMO3. | — | `displayName` **new** | schema diff |

### 3d. Categories

| Item | Upstream (OMO) | Ours | Status | Source |
|---|---|---|---|---|
| `deep` | Split into `deep-low` (default lane) and `deep-high` (escalation). `deep` is canonicalized to `deep-low` on load and rewritten by migration `2026-09-category-deep-split`. | `deep` (chain, role, 3 presets) | **renamed** + `deep-high` **new** | [legacy-category-names.ts L1-L8](https://github.com/code-yeongyu/oh-my-openagent/blob/7a752ab5a88c2d255b926aff1c687b6d91758d02/packages/omo-config-core/src/schema/legacy-category-names.ts#L1-L8), [REL v5.0.0-beta.80](https://github.com/code-yeongyu/oh-my-openagent/releases/tag/v5.0.0-beta.80) |
| Builtin enum | The OpenCode zod `BuiltinCategoryNameSchema` still lists `deep` (and not `deep-low`/`deep-high`), but the model-core chains use `deep-low`/`deep-high`. This is an upstream inconsistency. | — | note | [categories.ts L43-L52](https://github.com/code-yeongyu/oh-my-openagent/blob/7a752ab5a88c2d255b926aff1c687b6d91758d02/packages/omo-opencode/src/config/schema/categories.ts#L43-L52), [category-model-requirements.ts L33, L48](https://github.com/code-yeongyu/oh-my-openagent/blob/7a752ab5a88c2d255b926aff1c687b6d91758d02/packages/model-core/src/category-model-requirements.ts#L33) |
| `writing` | "Unavailable when none of its Claude models … is connected; it never falls back to another family" | Chain starts with `gemini-3-flash` | **default changed** | [configuration.md L353](https://github.com/code-yeongyu/oh-my-openagent/blob/7a752ab5a88c2d255b926aff1c687b6d91758d02/docs/reference/configuration.md#L353) |
| Entry fields | Adds `models, reasoning, max_tokens, provider_options, warn_unavailable`. `variant`, `reasoningEffort`, `maxTokens`, `thinking` are deprecated. | `model, variant, temperature, description, fallback_models` | **new** / **deprecated** | [configuration.md L357-L380](https://github.com/code-yeongyu/oh-my-openagent/blob/7a752ab5a88c2d255b926aff1c687b6d91758d02/docs/reference/configuration.md#L357-L380) |

### 3e. Model chains (head of each chain; full lists in source)

Ours = `oh-my-opencode.ts:23-46`, which equals the OMO3
[`src/shared/model-requirements.ts`](https://github.com/code-yeongyu/oh-my-openagent/blob/abda3c52f0f81d568a147ea540ec9050cb677a74/src/shared/model-requirements.ts).
Upstream = OMO [`packages/model-core/src/agent-model-requirements.ts`](https://github.com/code-yeongyu/oh-my-openagent/blob/7a752ab5a88c2d255b926aff1c687b6d91758d02/packages/model-core/src/agent-model-requirements.ts)
and [`category-model-requirements.ts`](https://github.com/code-yeongyu/oh-my-openagent/blob/7a752ab5a88c2d255b926aff1c687b6d91758d02/packages/model-core/src/category-model-requirements.ts),
cross-checked against [opencode-config.md L319-L333](https://github.com/code-yeongyu/oh-my-openagent/blob/7a752ab5a88c2d255b926aff1c687b6d91758d02/docs/reference/opencode-config.md#L319-L333)
and [configuration.md L434-L448](https://github.com/code-yeongyu/oh-my-openagent/blob/7a752ab5a88c2d255b926aff1c687b6d91758d02/docs/reference/configuration.md#L434-L448).
Every row's status is **default changed**.

| Agent / category | Ours (= v3.15.3) | Upstream v5.1.33 chain (model ids, in order) |
|---|---|---|
| sisyphus | claude-opus-4.6 → kimi-k2.5 → k2p5 → gpt-5.4 → glm-5 → big-pickle | claude-opus-5-5 → kimi-k3 → gpt-5.6-sol → glm-5.2 → big-pickle |
| hephaestus | gpt-5.4 | gpt-6-sol → gpt-5.6-sol |
| oracle | gpt-5.4 → gemini-3.1-pro → claude-opus-4.6 → glm-5 | gpt-5.6-sol → gemini-3.1-pro → claude-opus-5-5 → glm-5.2 |
| prometheus | claude-opus-4.6 → gpt-5.4 → glm-5 → gemini-3.1-pro | claude-fable-5-1 → claude-opus-5-5 → kimi-k3 |
| metis | claude-opus-4.6 → gpt-5.4 → glm-5 → k2p5 | claude-fable-5-1 → claude-opus-5-5 → kimi-k3 |
| momus | gpt-5.4 → claude-opus-4.6 → gemini-3.1-pro → glm-5 | gpt-6-astra → claude-opus-5-5 → gemini-3.1-pro → glm-5.2 |
| atlas | claude-sonnet-4.6 → kimi-k2.5 → gpt-5.4 → minimax-m2.7 | claude-sonnet-5 → kimi-k3 → gpt-5.6-sol → minimax-m3 → MiniMax-M3 → minimax-m2.7 |
| librarian | minimax-m2.7 → minimax-m2.7-highspeed → claude-haiku-4.5 → gpt-5-nano | kimi-for-coding-highspeed → gpt-6-luna-fast → claude-haiku-5-5 → deepseek-flash → qwen3.7-plus → minimax-m2.7 |
| explore | grok-code-fast-1 → minimax-m2.7-highspeed → minimax-m2.7 → claude-haiku-4.5 → gpt-5-nano | same as librarian |
| multimodal-looker | gpt-5.4 → kimi-k2.5 → glm-4.6v → gpt-5-nano | gpt-5.6-sol → kimi-k3 → glm-4.6v → gpt-5-nano |
| sisyphus-junior | claude-sonnet-4.6 → kimi-k2.5 → gpt-5.4 → minimax-m2.7 → big-pickle | claude-sonnet-5 → kimi-k3 → gpt-5.6-sol → minimax-m3 → MiniMax-M3 → minimax-m2.7 → big-pickle |
| visual-engineering | gemini-3.1-pro → glm-5 → claude-opus-4.6 → k2p5 | claude-fable-5-1 → claude-opus-5-5 → kimi-k3 |
| ultrabrain | gpt-5.4 → gemini-3.1-pro → claude-opus-4.6 → glm-5 | gpt-6-astra → gpt-5.6-sol |
| deep → **deep-low** | gpt-5.4 → claude-opus-4.6 → gemini-3.1-pro | gpt-6.1-sol → gpt-6.1-sol-fast → gpt-5.6-sol → gpt-5.6-sol-fast |
| **deep-high** (new) | — | gpt-6-astra |
| artistry | gemini-3.1-pro → claude-opus-4.6 → gpt-5.4 | claude-fable-5-1 → claude-opus-5-5 → kimi-k3 |
| quick | gpt-5.4-mini → claude-haiku-4.5 → gemini-3-flash → minimax-m2.7 → gpt-5-nano | gpt-6-luna-fast → claude-haiku-5-5 → deepseek-flash → qwen3.6-flash → minimax-m3 → minimax-m2.7 → grok-4.20-0309-non-reasoning → glm-5.3-flash → mimo-v2.6-flash |
| unspecified-low | claude-sonnet-4.6 → gpt-5.3-codex → kimi-k2.5 → gemini-3-flash → minimax-m2.7 | claude-sonnet-5-5 → mimo-v2.6-pro → grok-4.7 → gpt-6.1-sol → gpt-5.6-sol → claude-sonnet-5 → qwen3.8-max-preview → deepseek-v4-pro → mimo-v2.5-pro |
| unspecified-high | claude-opus-4.6 → gpt-5.4 → glm-5 → k2p5 → kimi-k2.5 | claude-opus-5-5 → glm-5.3 → kimi-k3 |
| writing | gemini-3-flash → kimi-k2.5 → claude-sonnet-4.6 → minimax-m2.7 | claude-opus-5-5 → claude-opus-4-6 |

Upstream chains now also carry a per-rung reasoning level (for example `claude-opus-5-5 (max)`),
which is shown in the docs tables linked above. Our `ALIAS_NORMALIZE` (`oh-my-opencode.ts:9-13`) only
maps the 4.5/4.6 Claude ids between dash and dot spelling.

### 3f. Schema validation of what we generate today (verified)

I ran a one-off script (scratchpad, not committed) with `tsx` and the repo's `ajv`. It ran
`buildOhMyOpenCodeConfig(applyPreset(p))` for all three bundled presets, with every chain model
available, plus one "UI extras" config. That config sets `disabled_commands: [init-deep, start-work]`,
`disabled_skills: [agent-browser, frontend-ui-ux]`, `browser_automation_engine.provider:
agent-browser`, `tmux.enabled` and one `lsp` entry. Both were validated against the legacy schema at
OMO:

- `default`, `coding-focused`, `planning-focused`: **valid**. Deprecated fields such as `variant` and
  `thinking` are still accepted.
- UI extras: **invalid**. The errors are `additionalProperty "lsp"`, `disabled_commands` not in the
  enum `[goal, refactor, ulw-execute, stop-continuation, remove-ai-slops, hyperplan]`, and `provider`
  not in `[playwright, dev-browser, playwright-cli]`.
- A valid legacy-schema file is still **not read** by the plugin (section 3a). So validity only matters
  once we write the `"[opencode]"` block of `omo.jsonc`, which uses the same 46-key definition.

## 4. Breaking changes (explicit)

1. **Config filename and location.** `oh-my-openagent.json[c]` and `oh-my-opencode.json[c]` in the
   OpenCode config dir are replaced by `~/.omo/omo.jsonc` (user) and `.omo/omo.jsonc` (project, walked
   up to `$HOME`). Plugin keys go under `"[opencode]"`. Effective **v4.19.3**, 2026-07-28.
   ([configuration.md@v4.19.3 L3](https://github.com/code-yeongyu/oh-my-openagent/blob/614cc5358dc393153fc39acae74dc5bd9fb9fffc/docs/reference/configuration.md#L3),
   [REL v4.19.3](https://github.com/code-yeongyu/oh-my-openagent/releases/tag/v4.19.3))
2. **The legacy migration discards `agents` and `categories`.** Hooks, disable lists and other plugin
   settings are not imported either. Effective **v5.0.0-beta.20**, 2026-08-25, commit `03c04c0dbb`.
   Between v4.19.3 and beta.20 the migration did import agents and categories and stripped `lsp`
   ([transform-opencode.ts@v4.19.3](https://github.com/code-yeongyu/oh-my-openagent/blob/614cc5358dc393153fc39acae74dc5bd9fb9fffc/packages/omo-opencode/src/config-migration/transform-opencode.ts)).
   Because migration runs once per `_migrations` marker, a file that SYNC rewrites later is ignored
   regardless ([configuration.md L114](https://github.com/code-yeongyu/oh-my-openagent/blob/7a752ab5a88c2d255b926aff1c687b6d91758d02/docs/reference/configuration.md#L114)).
3. **Schema URL.** Ours (`…/main/assets/oh-my-opencode.schema.json`) returns 404 because the repo has
   no `main` branch. The canonical URL for `omo.jsonc` is `…/dev/assets/omo.schema.json`. The legacy
   `…/dev/assets/oh-my-opencode.schema.json` still exists.
4. **Package and repo name.** No breaking rename for us. The repo `oh-my-opencode` redirects to
   `oh-my-openagent`, and the npm packages `oh-my-openagent` and `oh-my-opencode` are both at 5.1.33.
   The plugin id `"oh-my-openagent"` is unchanged. The strategic shift is to `omo-ai` (OmO Native,
   not an OpenCode plugin) ([REL v5.0.0](https://github.com/code-yeongyu/oh-my-openagent/releases/tag/v5.0.0)).
5. **Removed or invalid values we can emit.** `browser_automation_engine.provider: "agent-browser"`
   (beta.63) and `disabled_commands` `init-deep` / `start-work` fail validation. Top-level `lsp` is
   not read. `permission` value `prompt` was never valid.
6. **Removed names that become silent no-ops.** Hooks `context-window-monitor`, `session-recovery`,
   `thinking-block-validator`, `ralph-loop`, `start-work`. Skills `agent-browser` and `frontend-ui-ux`
   (now `frontend`).
7. **Renamed category.** `deep` became `deep-low`. It is auto-canonicalized, so nothing breaks, but
   `deep-high` is missing from our UI.

## 5. Impact on our files

Pointers only, no code. Line numbers are at DASH `48aaca4`.

**Out-of-repo (blocking for item 4.1/4.2):** `itsmylife44/opencode-cliproxyapi-sync`
`src/index.ts:45` writes `join(configDir, "oh-my-opencode.json")`. That is the OpenCode config dir and
a legacy filename. To have any effect it must write the `"[opencode]"` block of `~/.omo/omo.jsonc`, or
a project `.omo/omo.jsonc`. It must merge into that file rather than overwrite it, because the file also
holds `_migrations`, `legacy_migrations`, `[native]`, `[codex]`, `profiles` and `models`. The plugin
was last published 2026-03-27 (npm 1.4.0).

- `dashboard/src/lib/config-generators/oh-my-opencode.ts`
  - `:347-350`: `$schema` returns 404. Switch to `dev/assets/omo.schema.json`, plus the output shape
    `{ $schema, "[opencode]": {…} }`. The alternative is to keep emitting the flat block and let SYNC
    wrap it.
  - `:23-46`: every agent and category chain is outdated (3e). Rename `deep` to `deep-low`, add
    `deep-high`, and treat `writing` as Claude-only.
  - `:9-13`: `ALIAS_NORMALIZE` only covers 4.5/4.6 Claude ids.
  - `:104-127`, `:195-218`: role labels and tiers. Needs `deep-low`/`deep-high`.
  - `:220-230`, `:271-292`, `:331-339`: emits `variant` and `fallback_models` (deprecated) and
    `ultrawork.temperature` (not in the schema). Consider `reasoning` and `models`.
  - `:359`: `auto_update: false` is still valid.
  - `:378-384`: `git_master` default. `include_co_authored_by` is now a no-op.
  - `:386-388`: emits top-level `lsp`, which is invalid and not read.
- `dashboard/src/lib/config-generators/oh-my-opencode-types.ts`
  - `:14-20`: `TmuxConfig` lacks `isolation`.
  - `:29-31` / `:159-162`: `BROWSER_PROVIDERS` contains `agent-browser` (removed) and lacks
    `dev-browser` and `playwright-cli`.
  - `:40-43`: `include_co_authored_by` is deprecated.
  - `:45-48`, `:103`, `:561-595`: `LspEntry` and `lsp` validation are for a key upstream doesn't read.
  - `:50-53`, `:260-290`: the permission enum uses `prompt` (upstream `ask`) and lacks `webfetch`,
    `task`, `doom_loop` and `external_directory`.
  - `:55-75`, `:77-83`: entry types lack `reasoning`, `models`, `top_p`, `disable`, `providerOptions`
    and others. `thinking` and `variant` are deprecated.
  - `:84-87`: `ExperimentalConfig` is still valid.
  - `:139-144`: `AVAILABLE_SKILLS`: `agent-browser` is removed and `frontend-ui-ux` became `frontend`.
    Eight new builtins are missing.
  - `:146-149`: `AVAILABLE_COMMANDS` contains `init-deep` and `start-work`, which are invalid.
    Upstream enum: `goal, refactor, ulw-execute, stop-continuation, remove-ai-slops, hyperplan`.
  - `:168-219`: `HOOK_GROUPS` has six stale names (see 3b) and lacks the new hooks.
  - `:89-109`: `OhMyOpenCodeFullConfig` has none of the 12 new top-level keys (for example
    `team_mode`, `agent_order`, `default_mode`).
- `dashboard/src/lib/config-generators/oh-my-opencode-presets.json`
  - `:33`, `:80`, `:143`: `deep` should be `deep-low`.
  - `:113`, `:119`: `thinking` is deprecated (use `reasoning` plus `providerOptions`).
  - 16 × `variant` are deprecated.
  - Model ids throughout come from v3.15.3 (for example `claude-opus-4.6`, `gpt-5.4`, `gpt-5.3-codex`).
  - Upstream's same-named presets were rewritten for `omo.jsonc` and Native agents (3a).
- `dashboard/src/lib/config-generators/oh-my-opencode-presets.ts`
  - `:58-84`: the permission reader accepts `prompt`.
  - `:15-18`: the preset source URL (our own repo, `main`) is fine.
- `dashboard/src/lib/config-generators/shared.ts`: no upstream-facing drift. It only builds model ids
  from `/v1/models`.
- `dashboard/src/lib/config-generators/opencode.ts:353-356` and
  `dashboard/src/lib/config-sync/generate-bundle.ts:359-366`: the plugin id `oh-my-openagent@latest`
  is still correct. Note that `@latest` now resolves to 5.x, which has the new config location.
- `dashboard/src/lib/config-sync/generate-bundle.ts:421-456`: the bundle key `ohMyOpencode` carries a
  flat legacy object. Its shape or semantics must change together with SYNC.
- `dashboard/src/components/oh-my-opencode-config-generator.tsx:641`: downloads `oh-my-openagent.json`,
  a legacy filename that is no longer read. `:455-481`: LSP add/remove handlers. `:533-632`: rows come
  from the chains, so `deep` will show.
- `dashboard/src/components/oh-my-opencode/sections/browser-section.tsx:53`: offers `agent-browser`.
- `dashboard/src/components/oh-my-opencode/sections/lsp-servers-section.tsx:44-73`: the whole section
  targets the unread `lsp` key.
- `dashboard/src/components/oh-my-opencode/toggle-sections.tsx:165`, `:199`: commands and skills lists.
- `dashboard/src/components/oh-my-opencode/sections/hooks-section.tsx:54`: renders the stale
  `HOOK_GROUPS`.
- `dashboard/src/components/oh-my-opencode/sections/git-master-section.tsx:19`: toggle for the no-op
  `include_co_authored_by`.
- `dashboard/src/components/oh-my-opencode/sections/tmux-section.tsx:81-98`: no `isolation` control.
- `dashboard/src/components/oh-my-opencode/model-badge.tsx:188-190`, `:291-297`: `variant` inputs,
  which are deprecated.
- `dashboard/src/app/api/agent-config/route.ts:63-71`: iterates `AGENT_ROLES` / `CATEGORY_ROLES`, so it
  follows the generator.
- `dashboard/messages/en.json:1622` ("Download oh-my-openagent.json"), `:1648` (`includeCoAuthoredBy`),
  `:1653` (`lspDesc`), plus the matching keys in `de.json`, `es.json` and `zh-CN.json`.
- Tests: `dashboard/src/lib/__tests__/oh-my-opencode-config.test.ts` and
  `oh-my-opencode-presets.test.ts` pin the current chains and shape.
- Docs: `README.md:124` and `docs/CONFIGURATION.md:107` say the sync writes `oh-my-openagent.json`.
  SYNC actually writes `oh-my-opencode.json`, and neither file is read any more.

## 6. Open questions for the human

1. **Keep supporting the OpenCode edition at all?** Upstream calls it legacy with "degraded support"
   and recommends OmO Native (`omo-ai`), which does not run inside OpenCode. Options are: keep it,
   freeze it on a pinned 4.19.2 (the last version that reads the legacy file), or drop it in favour of
   the slim variant.
2. **Where should synced config land?** Options are the user file `~/.omo/omo.jsonc` `"[opencode]"`
   (shared with Native/Codex blocks, so SYNC must do a JSONC-preserving merge), a project
   `.omo/omo.jsonc`, or a named `profiles.<name>."[opencode]"` layer activated with `OMO_PROFILE`. Each
   has different clobbering and precedence trade-offs.
3. **Pin or float the plugin version?** `oh-my-openagent@latest` (`opencode.ts:355`) silently pulled a
   two-major-version jump. Do we pin a tested version?
4. **Model ids.** Upstream chains now reference models (`claude-opus-5-5`, `claude-fable-5-1`,
   `gpt-6-*`, `kimi-k3`, …) that may or may not exist in CLIProxyAPI's `/v1/models`. Do we mirror
   upstream's chains as before, or drop the hard-coded chains and derive them from what the proxy
   serves?
5. **Deprecated fields.** Switch the generator and UI to `reasoning` / `models` / `providerOptions` now,
   or keep emitting `variant` / `fallback_models` / `thinking` while upstream still accepts them?
6. **Presets.** Upstream's `default` / `coding-focused` / `planning-focused` now target Native agents.
   Do we keep our OpenCode-edition presets under the same names, rename them, or retire them?
7. **New features.** Should the UI expose `team_mode`, `agent_order`, `default_mode`, `deep-high`,
   `tmux.isolation`, `browser_automation_engine.playwright_mcp_args` or custom agents, or only fix what
   is broken?
8. **LSP UI.** Upstream moved LSP to `.opencode/lsp.json` / `.omo/lsp.json`, which are project files.
   Do we drop the LSP section or retarget it?
9. **Users already affected since 2026-07-28.** Should we tell them (release note or in-app notice) that
   their dashboard agent/model settings have not been applied? This impact was inferred from upstream
   source and was **not** reproduced at runtime. Should someone verify it with a real OpenCode +
   `oh-my-openagent@5.1.33` install first?
