# Upstream Alignment: Oh My OpenAgent and oh-my-opencode-slim

Audit date: **2026-09-16**
Auditor: repository maintainer
Method: primary sources only (official repositories, tags, GitHub releases, npm
registry metadata, published package tarballs, shipped JSON/TypeScript schemas,
installer and migration code). No blog posts, aggregators or third-party
summaries were used.

This document is the written version/edition matrix that the dashboard
integration is derived from. Every table row carries its source.

---

## 1. Scope

The dashboard ships a single OpenCode-family configuration generator with two
variants:

- `oh-my-openagent` (the "normal" variant, historically also published as
  `oh-my-opencode`)
- `oh-my-opencode-slim` (the "slim" variant)

This audit establishes, for both products, which version channels actually
exist, what each channel's configuration schema is, and what the dashboard must
therefore emit.

---

## 2. Version channels (verified 2026-09-16)

These four channels are **independent** and must never be conflated:

1. the GitHub default branch
2. the newest GitHub release
3. npm `latest`
4. npm `beta`

### 2.1 Oh My OpenAgent

| Channel | Value | Source |
|---|---|---|
| GitHub default branch | `dev` | `GET /repos/code-yeongyu/oh-my-openagent` (2026-09-16) |
| Default-branch HEAD | `ee17c22958080475444c675c64bb203f05fa12ba` (2026-09-16T16:22:32Z) | `GET /repos/.../branches/dev` |
| Newest GitHub release | `v5.0.0-beta.67`, target `dev`, published 2026-09-16T10:27:46Z | `GET /repos/.../releases` |
| npm `latest` | `4.19.4` | `registry.npmjs.org/oh-my-openagent` |
| npm `beta` | `5.0.0-beta.67` | `registry.npmjs.org/oh-my-openagent` |
| npm `next` | `4.5.12` | `registry.npmjs.org/oh-my-openagent` |
| License | NOASSERTION (GitHub API) | `GET /repos/code-yeongyu/oh-my-openagent` |

**Critical finding:** the repository's default branch (`dev`) carries the v5
line, and GitHub's newest release is a **beta**. There is no GitHub release for
the stable `4.19.4` line. A consumer that naively tracks "the repo" or "the
latest release" lands on an unreleased/beta configuration system, not on the
stable one.

### 2.2 oh-my-opencode-slim

| Channel | Value | Source |
|---|---|---|
| GitHub default branch | `master` | `GET /repos/alvinunreal/oh-my-opencode-slim` |
| Default-branch HEAD | `f34d7ae22af0985bec257d72d0b6213f2aed3e48` (2026-09-16T18:03:35Z) | `GET /repos/.../branches/master` |
| Newest GitHub release | `v2.2.21`, target `master`, published 2026-09-16T18:04:08Z | `GET /repos/.../releases` |
| npm `latest` | `2.2.21` | `registry.npmjs.org/oh-my-opencode-slim` |
| npm `beta` | `3.0.0-beta.13` | `registry.npmjs.org/oh-my-opencode-slim` |
| License | MIT | `GET /repos/alvinunreal/oh-my-opencode-slim` |

Note: the default-branch HEAD commit **is** the `v2.2.21` tag commit, so for
Slim the stable channel and the default branch currently coincide.

Source artifacts used for schema extraction (extracted from the published npm
tarballs):

| Channel | Package | Tag | Commit |
|---|---|---|---|
| Slim stable | `oh-my-opencode-slim@2.2.21` | `v2.2.21` | `f34d7ae22af0985bec257d72d0b6213f2aed3e48` |
| Slim beta | `oh-my-opencode-slim@3.0.0-beta.13` | `v3.0.0-beta.13` | `914784ba25c22705f88c82f1ff9aa20ee951919a` (2026-09-14T09:08:21+02:00) |
| OpenAgent stable | `oh-my-openagent@4.19.4` | — (npm only) | tarball `oh-my-openagent-4.19.4.tgz` |
| OpenAgent beta | `oh-my-openagent@5.0.0-beta.67` | `v5.0.0-beta.67` | tarball `oh-my-openagent-5.0.0-beta.67.tgz` |

---

## 3. Product / edition matrix (Oh My OpenAgent)

The published package declares several binaries, and the repository is split
into per-harness packages.

Binary declarations in `package.json` of `oh-my-openagent`:

| Version | `bin` entries |
|---|---|
| `4.19.4` | `oh-my-opencode`, `oh-my-openagent`, `omo`, `lazycodex`, `lazycodex-ai` |
| `5.0.0-beta.67` | `oh-my-opencode`, `oh-my-openagent`, `omo-agent-toolkit`, `lazycodex`, `lazycodex-ai` |

**The `omo` binary was renamed to `omo-agent-toolkit` between 4.x and 5.x.**
Both are the *same* upstream project. There is an unrelated third-party npm
package literally named `omo` (version `2.0.0`, last modified 2022-06-22) that
must never be referenced by this documentation or the generated configuration.

Repository package layout (confirms the harness split):

| Source | Packages present |
|---|---|
| `5.0.0-beta.67` npm tarball | `git-bash-mcp`, `lsp-core`, `lsp-daemon`, `lsp-tools-mcp`, `omo-codex`, `prompts-core`, `shared-skills` |
| `4.19.4` npm tarball | `git-bash-mcp`, `lsp-core`, `lsp-daemon`, `lsp-tools-mcp`, `omo-codex`, `shared-skills` |
| `dev` branch source tree | `model-core`, `omo-codex`, `omo-config-core`, `omo-opencode`, `omo-senpi`, `shared-skills` |

The harness split (`omo-opencode`, `omo-codex`, `omo-senpi`) matches the
"Ultimate / Codex / Native" editions described in the issue.

### 3.1 Edition status

| Edition | Harness | Dashboard status | Decision |
|---|---|---|---|
| Ultimate / OpenCode (stable `4.19.4`) | `opencode` | **Supported today** | Keep. This is the primary integration. |
| Ultimate / OpenCode (v5 beta `5.0.0-beta.67`) | `opencode` | Not supported | **Channel-gated.** Must not be emitted for stable users. |
| Light / Codex CLI | `codex` (`omo-codex`) | Not supported | **Documented only.** Separate product path, not the same generator. |
| Native / Senpi beta | `senpi` (`omo-senpi`) | Not supported | **Documented only.** Separate product path, not the same generator. |

Per the issue, Light and Native are deliberately **not** folded into the
existing OpenCode generator. There is no tested dashboard product path for
them, and no dashboard UI to select them.

---

## 4. Configuration file matrix

### 4.1 Oh My OpenAgent

| Version | Config discovery | Evidence |
|---|---|---|
| stable `4.19.4` | `oh-my-openagent.jsonc`, `oh-my-openagent.json`, `oh-my-opencode.jsonc`, `oh-my-opencode.json` | No `omo.jsonc` token exists anywhere in `4.19.4/dist/index.js` (verified by exhaustive search) |
| v5 `5.0.0-beta.67` | same four legacy names, **plus** user `~/.omo/omo.jsonc` / `~/.omo/omo.json` and project `<project>/.omo/omo.jsonc` | `dist/config-migration/discovery-paths.d.ts`: `CONFIG_FILE_NAMES = ["oh-my-openagent.jsonc","oh-my-openagent.json","oh-my-opencode.jsonc","oh-my-opencode.json"]`; `dist/index.js` writes/reads `join(resolveUserOmoConfigDirectory(env), "omo.jsonc")` and `join(projectDir, ".omo", "omo.jsonc")` |
| v5 migration | `_migrations` array; `dist/config-migration/` + `dist/startup-migration.d.ts`; migrates legacy `oh-my-openagent.json[c]`/`oh-my-opencode.json[c]` into the new omo config | `_migrations` present as a top-level schema property only in `5.0.0-beta.67`, absent in `4.19.4` |

**Conclusion:** `oh-my-openagent.json[c]` is still the correct target for
stable `4.19.4`. Switching all users to `omo.jsonc` would silently move them
onto a configuration system their installed version does not read.

### 4.2 oh-my-opencode-slim

| Item | Value | Evidence |
|---|---|---|
| Plugin config (user) | `<configDir>/oh-my-opencode-slim.json` / `.jsonc` | `src/cli/paths.ts#getLiteConfig` / `getLiteConfigJsonc` |
| `configDir` resolution | `OPENCODE_CONFIG_DIR` → `XDG_CONFIG_HOME/opencode` → `~/.config/opencode` | `src/cli/paths.ts#getConfigDir` |
| OpenCode config | `<configDir>/opencode.json` / `.jsonc` | `src/cli/paths.ts#getOpenCodeConfigPaths` |
| TUI config | `<configDir>/tui.json` / `.jsonc` | `src/cli/paths.ts#getTuiConfig` |
| Read order | `.json` first (if it exists), else `.jsonc` | `src/cli/paths.ts#getExistingLiteConfigPath` |
| Schema URL | `https://unpkg.com/oh-my-opencode-slim@latest/oh-my-opencode-slim.schema.json` | `README.md` line ~162 |

---

## 5. Slim stable schema (`2.2.21`)

Extracted from `oh-my-opencode-slim.schema.json` shipped in
`oh-my-opencode-slim@2.2.21`, cross-checked against the Zod definitions in
`src/config/schema.ts` at commit `f34d7ae2`.

### 5.1 Top-level properties

| Property | Type | Default |
|---|---|---|
| `preset` | string | — |
| `setDefaultAgent` | boolean | — |
| `compactSidebar` | boolean | `true` |
| `stripOrchestratorModel` | boolean | — |
| `autoUpdate` | boolean | `true` |
| `presets` | object | — |
| `agents` | object | — |
| `disabled_agents` | string[] | `['observer']` |
| `image_routing` | `"auto" \| "direct"` | legacy conditional |
| `disabled_mcps` | string[] | — |
| `disabled_tools` | string[] | — |
| `disabled_skills` | string[] | — |
| `multiplexer` | object | — |
| `interview` | object | — |
| `backgroundJobs` | object | — |
| `fallback` | object | — |
| `council` | object | — |
| `companion` | object | — |
| `webfetch` | object | — |
| `acpAgents` | object | — |

### 5.2 `fallback` (complete)

| Field | Type | Default | Notes |
|---|---|---|---|
| `enabled` | boolean | `true` | |
| `maxRetries` | integer ≥0 | `3` | consecutive 429s tolerated on the same model |
| `initialRetryDelayMs` | integer ≥0 | `0` | delay before the first fallback |
| `retryDelayMs` | integer ≥0 | `500` | delay between fallback attempts |

**Removed legacy keys**, from `src/config/schema.ts#LEGACY_FALLBACK_KEYS`:

> "Fallback config fields accepted by versions before 2.3.x but no longer
> meaningful. Kept only so that existing user/project configs containing them
> still parse: the loader emits a deprecation warning and these keys are
> stripped before strict validation."

```
LEGACY_FALLBACK_KEYS = ['timeoutMs', 'retry_on_empty', 'runtimeOverride']
```

`fallback.chains` is not in that compatibility list at all: it is absent from
the schema, so it is simply invalid.

### 5.3 Council (complete)

```jsonc
"council": {
  "presets": {
    "<presetName>": {
      "<councillorName>": { "model": "…", "variant": "…" }
    }
  },
  "default_preset": "default"
}
```

- `required: ["presets"]`
- councillor names are **flat keys directly under the preset**
- there is no `council.master`, no nested `councillors` object, no
  `master_timeout`, no `councillors_timeout`, no `master_fallback`, no
  `councillor_execution_mode`, no `councillor_retries`
- a deprecated `council.master` key is explicitly detected and **ignored** with
  a warning (`src/config/loader.ts` ~line 323: "Deprecated council.master
  config key found and ignored. Configure council agents via presets instead.")
- each councillor is an ordinary agent config and may therefore carry a
  multi-model `model` array

### 5.4 Agent-level fields

`agents.<name>` and `presets.<preset>.<name>` accept:

| Field | Type |
|---|---|
| `model` | `string \| Array<string \| { id: string, variant?: string }>` |
| `inheritModelFrom` | `"session" \| "orchestrator"` |
| `temperature` | number 0–2 |
| `variant` | string |
| `skills` | string[] |
| `skills_add` | string[] |
| `skills_remove` | string[] |
| `mcps` | string[] |
| `prompt` | string |
| `orchestratorPrompt` | string |
| `options` | object |
| `displayName` | string |
| `color` | `#RRGGBB` \| theme color |
| `description` | string |
| `permission` | `"ask"\|"allow"\|"deny"` or per-tool object |

`skills_add` / `skills_remove` are **agent-level**, not top-level.
`skills_remove` wins over `skills_add`; both are folded into `skills` at
resolution time (`src/cli/skills.ts#resolveEffectiveSkills`).

### 5.5 `multiplexer`

| Field | Values | Default |
|---|---|---|
| `type` | `auto`, `tmux`, `zellij`, `herdr`, `kitty`, `cmux`, `none` | `none` |
| `layout` | `main-horizontal`, `main-vertical`, `tiled`, `even-horizontal`, `even-vertical` | `main-vertical` |
| `main_pane_size` | 20–80 | `60` |
| `zellij_pane_mode` | `agent-tab`, `current-tab` | `agent-tab` |

### 5.6 Other nested objects

- `backgroundJobs`: `strategy`, `maxSessionsPerAgent` (2), `maxContextLines`
  (50000), `readContextMinLines` (10), `readContextMaxFiles` (8),
  `maxRetainedSnapshots` (20), `orchestratorWake`
  (`enabled`/`intervalMs`/`mode`), `wallClockTimeoutMs`, `abortGraceMs`,
  `concurrency`, `sameProviderPolicy`, `waitForUserGuard`
- `companion`: `enabled`, `binaryPath`, `position`, `size`, `gifPack`,
  `loopStyle`, `speed`, `debug`
- `webfetch`: `enabled` (true), `model`
- `acpAgents.<name>`: `command`, `args`, `env`, `cwd`, `description`,
  `prompt`, `orchestratorPrompt`, `wrapperModel`, `timeoutMs`, `permissionMode`
- `interview`: `maxQuestions` (2), `outputFolder` ("interview"),
  `autoOpenBrowser` (true), `port` (0), `dashboard` (false)

---

## 6. Slim agent, skill and MCP contracts (`2.2.21`)

### 6.1 Agents

Source: `src/config/constants.ts` at `f34d7ae2`.

```
SUBAGENT_NAMES = ['explorer','librarian','oracle','designer','fixer','observer','council','councillor']
ALL_AGENT_NAMES = ['orchestrator', ...SUBAGENT_NAMES]   // 9
PROTECTED_AGENTS = {'orchestrator','councillor'}         // cannot be disabled
DEFAULT_DISABLED_AGENTS = ['observer']
AGENT_ALIASES = { 'explore' -> 'explorer', 'frontend-ui-ux-engineer' -> 'designer' }
```

| Agent | Kind | Default | Notes |
|---|---|---|---|
| `orchestrator` | primary | enabled | protected |
| `explorer` | subagent | enabled | alias `explore` |
| `librarian` | subagent | enabled | |
| `oracle` | subagent | enabled | |
| `designer` | subagent | enabled | alias `frontend-ui-ux-engineer` |
| `fixer` | subagent | enabled | |
| `observer` | subagent | **disabled by default** | optional, enable via `disabled_agents: []` |
| `council` | subagent | enabled | the synthesizer |
| `councillor` | internal | enabled | protected; dynamic `councillor-*` sessions, prefix `COUNCILLOR_AGENT_PREFIX = 'councillor-'` |

`council-master` does **not** exist in `2.2.21`. It is only mentioned as a
historical note in `src/config/council-schema.ts` ("council-master was a
separate agent").

### 6.2 Skills

Source: `src/cli/custom-skills-registry.ts#CUSTOM_SKILLS` plus
`src/cli/skills.ts#PERMISSION_ONLY_SKILLS`, at `f34d7ae2`.

| # | Skill | Default agent grant |
|---|---|---|
| 1 | `simplify` | `oracle` |
| 2 | `codemap` | `orchestrator` |
| 3 | `clonedeps` | `orchestrator` |
| 4 | `deepwork` | `orchestrator` |
| 5 | `verification-planning` | `orchestrator` |
| 6 | `reflect` | `orchestrator` |
| 7 | `oh-my-opencode-slim` | `orchestrator` |
| 8 | `worktrees` | `orchestrator` |
| — | `requesting-code-review` | `oracle` (permission-only; **not installed**, only granted) |

- `cartography` does not exist. It was replaced by `codemap`; the legacy state
  file `.slim/cartography.json` is migrated to `.slim/codemap.json`
  (`src/skills/codemap/scripts/codemap.mjs`: `LEGACY_STATE_FILE = 'cartography.json'`).
- `agent-browser` does not exist anywhere in the stable tree.
- The orchestrator defaults to allow-all skills
  (`getSkillPermissionsForAgent`: `'*': agentName === 'orchestrator' ? 'allow' : 'deny'`).
- `src/skills/loop-engineering/` exists in the repository tree but is **not**
  registered in `CUSTOM_SKILLS`, so it is not part of the installed/derivable
  skill catalogue and the dashboard must not grant it.

### 6.3 MCPs

Source: `src/config/schema.ts#McpNameSchema = z.enum(['context7','gh_grep'])`
and `src/config/agent-mcps.ts#DEFAULT_AGENT_MCPS`.

| Agent | Default MCPs |
|---|---|
| `orchestrator` | `['*','!context7']` |
| `librarian` | `['context7','gh_grep']` |
| all others | `[]` |

---

## 7. Slim beta schema diff (`3.0.0-beta.13`)

Node-by-node structural comparison of the two shipped schemas. Only the
differences are listed.

| Change | Stable `2.2.21` | Beta `3.0.0-beta.13` |
|---|---|---|
| Preset layout | `presets.<preset>.<agent>` | `presets.<preset>.**agents**.<agent>` (extra `agents` wrapper) |
| Preset marketplace | absent | `presets.<preset>.marketplace.agents: string[]` |
| Agent field | absent | `baseRole: "explorer"\|"librarian"\|"oracle"\|"designer"\|"fixer"\|"observer"` |
| Agent fields | `skills_add`, `skills_remove` present | **removed** |

Everything else (top-level property set, `fallback`, `council`, `multiplexer`,
`backgroundJobs`, `companion`, `webfetch`, `acpAgents`, `interview`) is
structurally identical between the two channels.

**Consequence:** generating a stable-shaped `presets` tree for a beta install
produces config the beta loader will not read as intended, and vice versa.
Channel selection must therefore be explicit.

---

## 8. Oh My OpenAgent schema summary

Schema: `dist/oh-my-opencode.schema.json` (draft-07,
`additionalProperties: false`, `required: ["git_master"]`).

### 8.1 Agents (`agents` object, 14 keys)

`build`, `plan`, `sisyphus`, `hephaestus`, `sisyphus-junior`,
`OpenCode-Builder`, `prometheus`, `metis`, `momus`, `oracle`, `librarian`,
`explore`, `multimodal-looker`, `atlas`

`build`, `plan` and `OpenCode-Builder` are OpenCode host agents; the remaining
11 are the OMO-defined agents. The issue's provisional list matches the
OMO-defined 11 exactly.

### 8.2 Built-in categories (8)

Source: `dist/config/schema/categories.d.ts#BuiltinCategoryNameSchema` in
`5.0.0-beta.67`:

`artistry`, `deep`, `quick`, `ultrabrain`, `unspecified-high`,
`unspecified-low`, `visual-engineering`, `writing`

`CategoriesConfigSchema` is a record, so custom categories may be added.
Category config fields: `description`, `model`, `models`, `fallback_models`,
`reasoning`, `variant`, `temperature`, `top_p`, `max_tokens`, `provider_options`,
`maxTokens`, `thinking`, `reasoningEffort`, `textVerbosity`, `tools`,
`prompt_append`, `max_prompt_tokens`, `is_unstable_agent`, `disable`,
`warn_unavailable`.

This confirms `reasoning`, `provider_options` and `max_tokens` as current
fields.

### 8.3 Bundled skills

Source: `packages/shared-skills/skills/` in each tarball.

| Channel | Skills |
|---|---|
| `4.19.4` (17) | `ast-grep`, `coding-agent-sessions`, `data-scientist`, `debugging`, `frontend`, `git-master`, `init-deep`, `lsp-setup`, `programming`, `refactor`, `remove-ai-slops`, `review-work`, **`start-work`**, `ultimate-browsing`, `ulw-plan`, `ulw-research`, `visual-qa` |
| `5.0.0-beta.67` (17) | `ast-grep`, `coding-agent-sessions`, `data-scientist`, `debugging`, `frontend`, `git-master`, `init-deep`, `lsp-setup`, `programming`, `refactor`, `remove-ai-slops`, `review-work`, `ultimate-browsing`, **`ulw-execute`**, `ulw-plan`, `ulw-research`, `visual-qa` |

Delta: stable has `start-work`, beta has `ulw-execute`.

`agent-browser` is **not** a skill in either channel. It was removed and must
not be presented as a current built-in.

### 8.4 v5-only top-level additions

Present in `5.0.0-beta.67`, absent in `4.19.4`: `_migrations`,
`ulw_execute`, `default_mode`, `prompts-core`.

Present in `4.19.4`, absent in `5.0.0-beta.67`: `codegraph`.

Also note `git_master` default differs:

| Version | `git_master` default |
|---|---|
| `4.19.4` | `{"commit_footer":true,"include_co_authored_by":true,"git_env_prefix":"GIT_MASTER=1"}` |
| `5.0.0-beta.67` | `{"commit_footer":false,"include_co_authored_by":false,"git_env_prefix":"GIT_MASTER=1"}` |

---

## 9. Install commands (verified)

| Edition / channel | Command | Source |
|---|---|---|
| Slim stable | `bunx oh-my-opencode-slim@latest install` | Slim `README.md` ~line 92 |
| Slim stable (Node) | `npx oh-my-opencode-slim@latest install` | Slim `README.md` ~line 99 |
| Slim stable + companion | `bunx oh-my-opencode-slim@latest install --companion=yes` | Slim `README.md` ~line 614 |
| Slim stable + preset | `bunx oh-my-opencode-slim@latest install --preset=opencode-go` | Slim `README.md` ~line 134 |
| OpenAgent stable | `bunx oh-my-openagent@latest install` | dashboard `README.md` (unchanged, package name verified via npm `bin`) |

### 9.1 Slim installer flags

From `src/cli/types.ts`:

```
BooleanArg = 'yes' | 'no'
SkillsArg = BooleanArg | 'force'
BackgroundSubagentsArg = 'ask' | 'yes' | 'no'
CompanionArg = 'ask' | BooleanArg
```

`--background-subagents=yes` requires **two** environment variables
(`src/cli/background-subagents.ts`):

```
OPENCODE_EXPERIMENTAL_BACKGROUND_SUBAGENTS=true
OPENCODE_ENABLE_EXA=1
```

The installer writes them into the user's shell rc file between the markers
`# >>> oh-my-opencode-slim background subagents >>>` and
`# <<< oh-my-opencode-slim background subagents <<<`.

**Consistency rule:** recommending `--skills=no` while still emitting
`skills` grants in the generated config is contradictory — the dashboard must
either use an install command that installs the skills, or omit the grants.

---

## 10. Drift found in the dashboard (before this change)

| # | Drift | Location (pre-change) |
|---|---|---|
| D1 | Types declared as "Based on oh-my-opencode-slim **v0.9.14**" | `oh-my-opencode-slim-types.ts` header |
| D2 | Emitted `fallback.chains` | `oh-my-opencode-slim.ts` ~L355 |
| D3 | Emitted `fallback.timeoutMs` | `oh-my-opencode-slim.ts` ~L339 |
| D4 | Emitted `fallback.retry_on_empty` | `oh-my-opencode-slim.ts` ~L341 |
| D5 | Emitted `council.master` | `oh-my-opencode-slim.ts` ~L376 |
| D6 | Emitted `council.master_timeout` / `councillors_timeout` | `oh-my-opencode-slim.ts` ~L407-408 |
| D7 | Emitted `council.master_fallback` | `oh-my-opencode-slim.ts` ~L416 |
| D8 | Emitted `council.councillor_execution_mode` / `councillor_retries` | `oh-my-opencode-slim.ts` ~L410-411 |
| D9 | Generated nested `councillors` object | `oh-my-opencode-slim.ts` ~L385 |
| D10 | `council-master` listed as a supported agent | `oh-my-opencode-slim-types.ts` L39, L133 |
| D11 | Default skill `cartography` (does not exist) | `oh-my-opencode-slim-types.ts` L75 |
| D12 | Default skill `agent-browser` on `designer` (removed) | `oh-my-opencode-slim-types.ts` L77 |
| D13 | Default MCPs `websearch`, `grep_app` (not upstream MCPs) | `oh-my-opencode-slim-types.ts` L65 |
| D14 | Emitted non-schema top-level `scoringEngineVersion`, `balanceProviderUsage`, `manualPlan`, `todoContinuation`, `websearch`, `background` | `oh-my-opencode-slim.ts` L284-331, 437-450 |
| D15 | Agent list omitted `observer`; 7 agents hardcoded instead of derived | `oh-my-opencode-slim-types.ts` L15-23 |
| D16 | `agent-browser` granted in the OpenAgent skill list | `oh-my-opencode-types.ts` L141, L161 |
| D17 | Hardcoded agent/skill counts in README and 5 locale files ("9 agents", "6 agents", "7 primary agents", "simplify, cartography, agent-browser") | `README.md` L67, L114; `messages/*.json` |
| D18 | `council-master` shown in UI help text and JSON placeholders in all locales | `messages/*.json` |
| D19 | OpenAgent schema URL pinned to branch `main` while upstream default is `dev` | `oh-my-opencode.ts` L349 |

---

## 11. Support matrix (after this change)

| Product | Edition | Channel | Package | Config file | Dashboard support |
|---|---|---|---|---|---|
| Oh My OpenAgent | Ultimate/OpenCode | stable `4.19.4` | `oh-my-openagent@latest` | `oh-my-openagent.json[c]` | **Supported** (default) |
| Oh My OpenAgent | Ultimate/OpenCode | v5 beta `5.0.0-beta.67` | `oh-my-openagent@beta` | `~/.omo/omo.jsonc`, `.omo/omo.jsonc` | **Not generated** — visible as unsupported |
| Oh My OpenAgent | Light/Codex | any | `omo-codex` | codex harness | **Not supported** (documented only) |
| Oh My OpenAgent | Native/Senpi | beta | `omo-senpi` | senpi harness | **Not supported** (documented only) |
| oh-my-opencode-slim | — | stable `2.2.21` | `oh-my-opencode-slim@latest` | `oh-my-opencode-slim.json[c]` | **Supported** (default) |
| oh-my-opencode-slim | — | beta `3.0.0-beta.13` | `oh-my-opencode-slim@beta` | `oh-my-opencode-slim.json[c]` | **Not generated** — different preset layout |

---

## 12. Cross-repository note

The dashboard is not the only producer of these files. Any component that
writes `opencode.json[c]`, `oh-my-openagent.json[c]`, `oh-my-opencode.json[c]`,
`oh-my-opencode-slim.json[c]` or `omo.json[c]` must be kept in step:

| Repository | File | Contract | Why the dashboard change alone is insufficient |
|---|---|---|---|
| `itsmylife44/cliproxyapi-dashboard` | `dashboard/src/lib/config-generators/*` | the generated variant payloads | this change |
| external `opencode-cliproxyapi-sync` | subscriber sync client | consumes the dashboard-generated bundle and writes it to disk on the subscriber host | if the sync client still writes `fallback.chains` / `council.master`, subscribers keep producing invalid Slim config even after the dashboard is fixed |

No change is made to any other repository as part of this work. The transitional
path is: the dashboard emits only current-schema fields, and the sync client
must pass the generated object through unchanged rather than re-deriving
legacy fields.

---

## 13. Backward-compatibility decisions

1. Stable users keep the schema-correct path for their pin (`oh-my-openagent.json[c]`
   for OpenAgent `4.19.4`, `oh-my-opencode-slim.json[c]` for Slim `2.2.x`).
2. Legacy stored dashboard values are **migrated**, not dropped:
   `fallback.chains` is converted into per-agent `model` arrays, legacy
   `fallback.timeoutMs` / `retry_on_empty` / `runtimeOverride` are read for
   back-compat but never re-emitted, and legacy `council.master` /
   `council.presets.*.councillors` are folded into the flat preset layout.
3. Unknown fields not understood by the dashboard are preserved on round-trip.
4. Migrations are pure, idempotent and unit-tested.
5. No v5/beta configuration is generated unless the beta channel is explicitly
   selected.

---

## 14. Re-verification

Every value in this document was read on **2026-09-16** from the sources cited
inline. Re-check before relying on it:

- npm: `https://registry.npmjs.org/<package>` (`dist-tags`)
- releases: `https://api.github.com/repos/<owner>/<repo>/releases`
- default branch: `https://api.github.com/repos/<owner>/<repo>`
- Slim schema: `https://unpkg.com/oh-my-opencode-slim@latest/oh-my-opencode-slim.schema.json`
- OpenAgent schema: `dist/oh-my-opencode.schema.json` inside the npm tarball
