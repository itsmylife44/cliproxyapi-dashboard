# oh-my-opencode-slim upstream drift vs. dashboard (research)

Status: research only, no code changed. Date 2026-10-15. All findings come from reading upstream
source, schema, docs and release notes, then tracing them through our code. Nothing was run against
a live OpenCode install, so the runtime claims below are traced from source, not executed.

**Baseline (what we were aligned with).** Our slim support was last aligned with upstream on
2026-04-17 in `058d2ad` "fix(slim): align dashboard editor with upstream (#196)". The types file
says so explicitly: "Based on oh-my-opencode-slim v0.9.14"
([`oh-my-opencode-slim-types.ts:7`](https://github.com/itsmylife44/cliproxyapi-dashboard/blob/48aaca44d97da7128d336e1b2cd1e97ac0bb1967/dashboard/src/lib/config-generators/oh-my-opencode-slim-types.ts#L7)).
v0.9.14 was published to npm on 2026-04-16T09:00Z, the day before. v0.9.15 came out on 2026-04-18,
after our commit. Earlier slim commits: `3587ab4` (2026-04-15, presets system, #194), `8975381`
(2026-04-14, council agent), `7b726aa`, `a2b8438`, `152dc42` (2026-03-27, initial support, #143).

**Upstream now.** npm `latest` is **3.0.4**, published 2026-10-10T18:21Z (`beta` dist-tag is
`3.0.0-beta.13`). Tag `v3.0.4` = `ea5859f41befefe779051bcd1389b4cff1e76cb7`. Upstream `master`
HEAD is `0656d3ef` (2026-10-15), a few commits past the tag. We compare against the released tag.

**Schema provenance.** For both 0.9.14 and 3.0.4, the `oh-my-opencode-slim.schema.json` in the npm
tarball is byte-identical to the file at the git tag (sha256 `58ea2813…` for 3.0.4 and `e2822655…`
for 0.9.14, checked with `npm pack` + `shasum`). So the unpkg URLs below and the git blobs are the
same file. The schema grew from 17,236 to 69,511 bytes.

Abbreviations used for sources:

- **S3**: `alvinunreal/oh-my-opencode-slim@ea5859f` (= `v3.0.4`), base URL
  `https://github.com/alvinunreal/oh-my-opencode-slim/blob/ea5859f41befefe779051bcd1389b4cff1e76cb7/`
- **S0**: `alvinunreal/oh-my-opencode-slim@387e406` (= `v0.9.14`), base URL
  `https://github.com/alvinunreal/oh-my-opencode-slim/blob/387e4068021401f04edcbd39ea6a9d70f72838c4/`
- **SCHEMA3** / **SCHEMA0**: <https://unpkg.com/oh-my-opencode-slim@3.0.4/oh-my-opencode-slim.schema.json>
  / <https://unpkg.com/oh-my-opencode-slim@0.9.14/oh-my-opencode-slim.schema.json>
- **NPM**: `npm view oh-my-opencode-slim time versions dist-tags repository --json`
  (<https://registry.npmjs.org/oh-my-opencode-slim>). The repository field points to
  `github.com/alvinunreal/oh-my-opencode-slim`.
- **REL**: `gh release view <tag> -R alvinunreal/oh-my-opencode-slim`
- **DASH**: this repo at `48aaca4` (`main`), base URL
  `https://github.com/itsmylife44/cliproxyapi-dashboard/blob/48aaca44d97da7128d336e1b2cd1e97ac0bb1967/`

All links point at those exact SHAs. Dashboard paths below are relative to `dashboard/`.

---

## 1. Summary

- **Drift is large: three major versions.** 0.9.14 → 3.0.4 covers 76 npm releases (51 stable,
  25 pre-release) in six months. Only 10 of the 17 top-level keys in the 0.9.14 schema still exist. 7 are gone
  (`scoringEngineVersion`, `balanceProviderUsage`, `manualPlan`, `tmux`, `websearch`, `background`,
  `todoContinuation`). The UI still edits all 7, and the generator still emits 6 of them (`tmux` is
  converted to `multiplexer`). Upstream added 14
  new top-level keys. (SCHEMA0 vs SCHEMA3)
- **Critical: one UI field can make OpenCode ignore our whole config.** If a user fills in
  "Fallback chains", we emit `fallback.chains`. Upstream removed that key in v2.0.2, and `fallback` is
  now a `.strict()` object. The loader's legacy-key stripper does not cover `chains`. The result is
  that `safeParse` fails and `loadConfigFromPath` returns `null` for the file, so every
  `cliproxyapi/*` model assignment is lost and the plugin falls back to its built-in defaults.
  ([S3 schema.ts#L771-L843](https://github.com/alvinunreal/oh-my-opencode-slim/blob/ea5859f41befefe779051bcd1389b4cff1e76cb7/src/config/schema.ts#L771-L843),
  [S3 loader.ts#L567-L580](https://github.com/alvinunreal/oh-my-opencode-slim/blob/ea5859f41befefe779051bcd1389b4cff1e76cb7/src/config/loader.ts#L567-L580))
- **High: our default per-agent skills and MCPs use names that no longer exist.** We always write
  `skills: ["cartography"]` for the orchestrator. That skill was renamed `codemap` in v1.0.0, and the
  `skills` list is authoritative, so the orchestrator loses every bundled skill. Librarian gets
  `mcps: ["websearch","context7","grep_app"]`. Upstream removed the `websearch` MCP in v2.2.9 and
  renamed `grep_app` to `gh_grep` in v2.0.0, so librarian loses GitHub code search.
- **High: the council section works backwards.** We only emit `council` when the deprecated
  `council.master` is set. Upstream ignores `council.master` and logs a warning since v2.2.5. Five more
  council keys we write (`master_timeout`, `councillors_timeout`, `master_fallback`,
  `councillor_execution_mode`, `councillor_retries`) are silently dropped.
- **No rename of the package, filename or schema URL.** The package is still `oh-my-opencode-slim`.
  The config file is still `~/.config/opencode/oh-my-opencode-slim.json`, with an optional `.jsonc`
  that wins if present. The `$schema` URL we emit is the one upstream's own installer writes. One
  CLI flag we tell users to run, `--skills=no`, no longer exists, but unknown flags are ignored.

---

## 2. Upstream version timeline since our alignment

Dates are npm publish times (NPM). Schema deltas come from diffing `oh-my-opencode-slim.schema.json`
at every stable tag (`git show <tag>:oh-my-opencode-slim.schema.json`). Only releases that changed
the config surface or matter to us are listed.

| Version | npm date | Config-relevant change | Source |
|---|---|---|---|
| **0.9.14** | 2026-04-16 | **Our baseline.** | [tag](https://github.com/alvinunreal/oh-my-opencode-slim/tree/v0.9.14) |
| 0.9.15 | 2026-04-18 | + `showStartupToast` (later removed in 1.0.6) | [tag](https://github.com/alvinunreal/oh-my-opencode-slim/tree/v0.9.15) |
| **1.0.0** | 2026-04-21 | Removed `background` (background task tooling, PR #350). Skill `cartography` renamed to **`codemap`** (PR #352). **`council-master` agent removed**; council synthesizes directly (PR #362, [`e3cf058`](https://github.com/alvinunreal/oh-my-opencode-slim/commit/e3cf0589ec794b3beea2512332e13e3a9679bbb0)). `council.councillors_timeout` → `council.timeout`. Custom subagents with `prompt`/`orchestratorPrompt` (PR #365). | [REL v1.0.0](https://github.com/alvinunreal/oh-my-opencode-slim/releases/tag/v1.0.0) |
| 1.0.2 | 2026-04-23 | + `autoUpdate`, `sessionManager` | [tag](https://github.com/alvinunreal/oh-my-opencode-slim/tree/v1.0.2) |
| 1.1.0–1.1.2 | 2026-05-12 → 06-08 | + `divoom`, `subtask` (both removed again in 2.0.0) | [tag](https://github.com/alvinunreal/oh-my-opencode-slim/tree/v1.1.2) |
| **2.0.0** | 2026-06-12 | + `backgroundJobs`, `companion`. Removed `todoContinuation`, `sessionManager`, `subtask`, `divoom`. MCP `grep_app` → **`gh_grep`** ([`e76c13c`](https://github.com/alvinunreal/oh-my-opencode-slim/commit/e76c13cd4c935c4651d823a6a031dc2206747bf2)). | [REL v2.0.0](https://github.com/alvinunreal/oh-my-opencode-slim/releases/tag/v2.0.0) |
| **2.0.2** | 2026-06-14 | **Removed `fallback.chains`**, `manualPlan`, `scoringEngineVersion`, `balanceProviderUsage`, `council.master_timeout`, `council.master_fallback`. "The fallback config schema is stricter about unknown keys." | [REL v2.0.2](https://github.com/alvinunreal/oh-my-opencode-slim/releases/tag/v2.0.2), [`e7762e3`](https://github.com/alvinunreal/oh-my-opencode-slim/commit/e7762e37069e4c9b25a1b6ef4f23a36227b2396e) |
| 2.0.3 / 2.0.5 / 2.0.6 | 06-15 → 06-28 | + `acpAgents`; + `disabled_tools`, `disabled_skills`; + `compactSidebar` | tags |
| 2.1.0 / 2.1.1 | 07-04 / 07-10 | `multiplexer.type` + `herdr`; `fallback` + `maxRetries` | tags |
| 2.2.0 | 2026-07-13 | + `stripOrchestratorModel`, `image_routing`; `multiplexer.type` + `cmux` | [tag](https://github.com/alvinunreal/oh-my-opencode-slim/tree/v2.2.0) |
| 2.2.3 / 2.2.4 | 07-16 / 07-18 | `multiplexer.type` + `kitty`. Removed `council.timeout`, `councillor_execution_mode`, `councillor_retries`. | tags |
| **2.2.5** | 2026-07-21 | **Removed `tmux` and `council.master`** (deprecation warning, no effect) | [`7f7e638`](https://github.com/alvinunreal/oh-my-opencode-slim/commit/7f7e6382110d85875f70805fba247803fb29d378) |
| **2.2.9** | 2026-08-03 | **Removed `websearch` config and `websearch` MCP** in favor of OpenCode's built-in websearch. + `webfetch`. | [`68507c1`](https://github.com/alvinunreal/oh-my-opencode-slim/commit/68507c193c0f003f101970eca59edc3d18f0b66a) |
| 2.2.11 / 2.2.12 | 08-09 / 08-10 | Removed `fallback.timeoutMs`, `retry_on_empty`. They are now stripped with a warning instead of rejecting the file ([`325fee7`](https://github.com/alvinunreal/oh-my-opencode-slim/commit/325fee779941e854e54bf9e7465f007b70f3f1b9)). `interview` was removed in 2.2.11 and restored in 2.2.12. | tags |
| 2.2.19 | 2026-09-12 | `fallback` + `initialRetryDelayMs` (`retryDelayMs` re-added) | tag |
| 2.2.25 | 2026-09-25 | `multiplexer.type` `cmux` → **`cmux-tui`**; + `multiplexer.cmux_tui_binary` | tag |
| *(between)* | 2026-09-26 | Installer flag `--skills=` removed; bundled skills now register in-process ([`90dda4a5`](https://github.com/alvinunreal/oh-my-opencode-slim/commit/90dda4a5a8e23da4ca2b6d9b3b0f5ccecf41c743)) | git log |
| **3.0.0** | 2026-09-29 | v3: marketplace agents, preset `extends`/`agents` wrapper, OpenCode v2 host support, foreground-fallback rewrite | [REL v3.0.0](https://github.com/alvinunreal/oh-my-opencode-slim/releases/tag/v3.0.0) |
| 3.0.2 | 2026-10-02 | + `deepworkGuardMode`, `disabled_hooks`, `disabled_commands`; `fallback` + `continuationPolicy` | tag |
| 3.0.3 | 2026-10-06 | `multiplexer` + `viewer` | tag |
| **3.0.4** | 2026-10-10 | + `routingBlock`; `interview` + `printState`. **Current `latest`.** | [tag](https://github.com/alvinunreal/oh-my-opencode-slim/tree/v3.0.4) |

---

## 3. Diff table (upstream 3.0.4 vs. ours)

"Ours" means what `buildSlimConfig` emits and what `validateSlimConfig` and the zod schema accept.
"Effect today" means what happens when a v3.0.4 plugin loads a file we generated. Top-level keys
upstream does not know are stripped silently, because `RawPluginConfigSchema` is a plain `z.object`
without `.strict()` ([S3 schema.ts#L975](https://github.com/alvinunreal/oh-my-opencode-slim/blob/ea5859f41befefe779051bcd1389b4cff1e76cb7/src/config/schema.ts#L975)).
Nested objects marked `.strict()` reject the whole file instead.

### 3a. Top-level keys

| Key | Upstream 3.0.4 | Ours | Status | Effect today | Source |
|---|---|---|---|---|---|
| `fallback.chains` | gone; per-agent chains are now array `model` values | emitted when set in UI ([oh-my-opencode-slim.ts:346-357](https://github.com/itsmylife44/cliproxyapi-dashboard/blob/48aaca44d97da7128d336e1b2cd1e97ac0bb1967/dashboard/src/lib/config-generators/oh-my-opencode-slim.ts#L346-L357)) | **removed (2.0.2)** | **Whole file rejected** (strict `fallback`, `chains` is not in `LEGACY_FALLBACK_KEYS`) | [S3 schema.ts#L771-L843](https://github.com/alvinunreal/oh-my-opencode-slim/blob/ea5859f41befefe779051bcd1389b4cff1e76cb7/src/config/schema.ts#L771-L843), [REL v2.0.2](https://github.com/alvinunreal/oh-my-opencode-slim/releases/tag/v2.0.2) |
| `fallback.timeoutMs`, `fallback.retry_on_empty` | gone | always emitted with defaults when `fallback` is set ([oh-my-opencode-slim.ts:337-343](https://github.com/itsmylife44/cliproxyapi-dashboard/blob/48aaca44d97da7128d336e1b2cd1e97ac0bb1967/dashboard/src/lib/config-generators/oh-my-opencode-slim.ts#L337-L343)) | **removed (2.2.11)** | stripped, deprecation warning on every load | [S3 loader.ts#L527-L548](https://github.com/alvinunreal/oh-my-opencode-slim/blob/ea5859f41befefe779051bcd1389b4cff1e76cb7/src/config/loader.ts#L527-L548) |
| `fallback.enabled`, `retryDelayMs` | kept (`retryDelayMs` integer, default 500) | emitted | OK (type now integer) | OK | SCHEMA3 |
| `fallback.maxRetries`, `initialRetryDelayMs`, `continuationPolicy` | new | — | **new** | — | SCHEMA3 |
| `manualPlan` | gone | emitted ([:287-304](https://github.com/itsmylife44/cliproxyapi-dashboard/blob/48aaca44d97da7128d336e1b2cd1e97ac0bb1967/dashboard/src/lib/config-generators/oh-my-opencode-slim.ts#L287-L304)) | **removed (2.0.2)** | silently stripped | [REL v2.0.2](https://github.com/alvinunreal/oh-my-opencode-slim/releases/tag/v2.0.2), SCHEMA3 |
| `scoringEngineVersion`, `balanceProviderUsage` | gone | emitted ([:284-285](https://github.com/itsmylife44/cliproxyapi-dashboard/blob/48aaca44d97da7128d336e1b2cd1e97ac0bb1967/dashboard/src/lib/config-generators/oh-my-opencode-slim.ts#L284-L285)) | **removed (2.0.2)** | silently stripped | SCHEMA3 |
| `tmux` | gone | converted to `multiplexer`, never emitted raw ([:320-327](https://github.com/itsmylife44/cliproxyapi-dashboard/blob/48aaca44d97da7128d336e1b2cd1e97ac0bb1967/dashboard/src/lib/config-generators/oh-my-opencode-slim.ts#L320-L327)) | **removed (2.2.5)** | OK (UI section is dead weight) | [S3 loader.ts#L453-L468](https://github.com/alvinunreal/oh-my-opencode-slim/blob/ea5859f41befefe779051bcd1389b4cff1e76cb7/src/config/loader.ts#L453-L468) |
| `background.maxConcurrentStarts` | gone; replaced by `backgroundJobs.*` (16 sub-keys incl. `concurrency`) | emitted ([:330-332](https://github.com/itsmylife44/cliproxyapi-dashboard/blob/48aaca44d97da7128d336e1b2cd1e97ac0bb1967/dashboard/src/lib/config-generators/oh-my-opencode-slim.ts#L330-L332)) | **removed (1.0.0) / renamed-ish** | silently stripped | [REL v1.0.0](https://github.com/alvinunreal/oh-my-opencode-slim/releases/tag/v1.0.0), SCHEMA3 |
| `todoContinuation` | gone | emitted ([:437-445](https://github.com/itsmylife44/cliproxyapi-dashboard/blob/48aaca44d97da7128d336e1b2cd1e97ac0bb1967/dashboard/src/lib/config-generators/oh-my-opencode-slim.ts#L437-L445)) | **removed (2.0.0)** | silently stripped | SCHEMA3 |
| `websearch.provider` | gone (OpenCode built-in websearch) | emitted ([:448-450](https://github.com/itsmylife44/cliproxyapi-dashboard/blob/48aaca44d97da7128d336e1b2cd1e97ac0bb1967/dashboard/src/lib/config-generators/oh-my-opencode-slim.ts#L448-L450)) | **removed (2.2.9)** | silently stripped | [`68507c1`](https://github.com/alvinunreal/oh-my-opencode-slim/commit/68507c193c0f003f101970eca59edc3d18f0b66a) |
| `multiplexer.type` | `auto,tmux,zellij,herdr,kitty,cmux-tui,none`, default `none` | `auto,tmux,zellij,none`; we default to `"auto"` when the section is touched | **enum extended** | OK; the new types can't be selected or saved | [S3 schema.ts#L115](https://github.com/alvinunreal/oh-my-opencode-slim/blob/ea5859f41befefe779051bcd1389b4cff1e76cb7/src/config/schema.ts#L115) |
| `multiplexer.cmux_tui_binary`, `viewer` (`tui`/`mini`) | new | — | **new** | — | SCHEMA3 |
| `interview.*` | same 5 keys + `printState` | 5 keys | **new field** | OK | [S3 schema.ts#L468](https://github.com/alvinunreal/oh-my-opencode-slim/blob/ea5859f41befefe779051bcd1389b4cff1e76cb7/src/config/schema.ts#L468) |
| `preset`, `presets`, `agents`, `setDefaultAgent`, `disabled_agents`, `disabled_mcps` | kept | emitted | OK (see 3b) | OK | SCHEMA3 |
| `compactSidebar`, `stripOrchestratorModel`, `routingBlock`, `autoUpdate`, `image_routing`, `deepworkGuardMode`, `disabled_tools`, `disabled_skills`, `disabled_hooks`, `disabled_commands`, `backgroundJobs`, `companion`, `webfetch`, `acpAgents` | new | — | **new** | — | SCHEMA3, [docs/configuration.md](https://github.com/alvinunreal/oh-my-opencode-slim/blob/ea5859f41befefe779051bcd1389b4cff1e76cb7/docs/configuration.md) |

### 3b. Agents, presets and per-agent fields

| Item | Upstream 3.0.4 | Ours | Status | Source |
|---|---|---|---|---|
| Built-in agents | `orchestrator`, `explorer`, `librarian`, `oracle`, `designer`, `fixer`, `observer`, `council`, `councillor` | grid: same 7 primary agents incl. `council`; internal list adds `observer`, `councillor`, **`council-master`** ([types:36-40](https://github.com/itsmylife44/cliproxyapi-dashboard/blob/48aaca44d97da7128d336e1b2cd1e97ac0bb1967/dashboard/src/lib/config-generators/oh-my-opencode-slim-types.ts#L36-L40)) | **`council-master` removed (1.0.0)**. Unknown agent keys are now treated as custom subagents. | [S3 constants.ts#L7-L18](https://github.com/alvinunreal/oh-my-opencode-slim/blob/ea5859f41befefe779051bcd1389b4cff1e76cb7/src/config/constants.ts#L7-L18), [`e3cf058`](https://github.com/alvinunreal/oh-my-opencode-slim/commit/e3cf0589ec794b3beea2512332e13e3a9679bbb0), docs/configuration.md "Custom Agents" |
| Preset shape | Three forms (`z.xor`): flat `{<agent>: {...}}`, `{extends, agents: {...}, marketplace}`, inline `{extends, <agent>: {...}}` | flat only; the zod schema is `z.record(string, agentEntry)` ([schemas.ts:233](https://github.com/itsmylife44/cliproxyapi-dashboard/blob/48aaca44d97da7128d336e1b2cd1e97ac0bb1967/dashboard/src/lib/validation/schemas.ts#L233)) | **new forms**. Our emitted flat form is still valid. Importing an `extends`/`agents` preset fails zod or is misparsed (see 5). | [S3 schema.ts#L425-L450](https://github.com/alvinunreal/oh-my-opencode-slim/blob/ea5859f41befefe779051bcd1389b4cff1e76cb7/src/config/schema.ts#L425-L450), docs/configuration.md "Preset inheritance" |
| Agent override fields | `model`, `temperature` (0–2), `variant`, `skills`, `mcps`, `options` + **`inheritModelFrom`, `skills_add`, `skills_remove`, `skills_include_local`, `prompt`, `orchestratorPrompt`, `displayName`, `color`, `description`, `permission`**; object is `.strict()` | first 6 only ([types:107-115](https://github.com/itsmylife44/cliproxyapi-dashboard/blob/48aaca44d97da7128d336e1b2cd1e97ac0bb1967/dashboard/src/lib/config-generators/oh-my-opencode-slim-types.ts#L107-L115), [schemas.ts:159-175](https://github.com/itsmylife44/cliproxyapi-dashboard/blob/48aaca44d97da7128d336e1b2cd1e97ac0bb1967/dashboard/src/lib/validation/schemas.ts#L159-L175)) | **10 new fields**, silently dropped by our validators | [S3 schema.ts#L61-L112](https://github.com/alvinunreal/oh-my-opencode-slim/blob/ea5859f41befefe779051bcd1389b4cff1e76cb7/src/config/schema.ts#L61-L112) |
| Model fallback | array `model` per agent (`string \| {id, variant}`) is now the only chain mechanism | array `model` supported in validator; UI pushes users to `fallback.chains` | **semantics moved** | [REL v2.0.2](https://github.com/alvinunreal/oh-my-opencode-slim/releases/tag/v2.0.2), docs/configuration.md "Following the session model with a fallback chain" |
| Default MCPs | orchestrator `["*","!context7"]`, librarian `["context7","gh_grep"]` | orchestrator `["*"]`, librarian `["websearch","context7","grep_app"]`, always written ([types:63-71](https://github.com/itsmylife44/cliproxyapi-dashboard/blob/48aaca44d97da7128d336e1b2cd1e97ac0bb1967/dashboard/src/lib/config-generators/oh-my-opencode-slim-types.ts#L63-L71)) | **renamed (`grep_app`→`gh_grep`, 2.0.0), removed (`websearch`, 2.2.9), default changed (orchestrator)** | [S3 agent-mcps.ts#L6-L16](https://github.com/alvinunreal/oh-my-opencode-slim/blob/ea5859f41befefe779051bcd1389b4cff1e76cb7/src/config/agent-mcps.ts#L6-L16) vs [S0 agent-mcps.ts#L10-L14](https://github.com/alvinunreal/oh-my-opencode-slim/blob/387e4068021401f04edcbd39ea6a9d70f72838c4/src/config/agent-mcps.ts#L10-L14) |
| Default skills | installer: orchestrator `["*"]`, oracle `["simplify"]`, rest `[]`. Bundled: `simplify`, `codemap`, `clonedeps`, `deepwork`, `verification-planning`, `reflect`, `oh-my-opencode-slim`, `worktrees` | orchestrator `["cartography"]`, oracle `["simplify"]`, designer `["agent-browser"]`, always written ([types:74-82](https://github.com/itsmylife44/cliproxyapi-dashboard/blob/48aaca44d97da7128d336e1b2cd1e97ac0bb1967/dashboard/src/lib/config-generators/oh-my-opencode-slim-types.ts#L74-L82)) | **renamed (`cartography`→`codemap`, 1.0.0), removed (`agent-browser` is no longer referenced anywhere in S3 src/docs)** | [S3 providers.ts#L91-L114](https://github.com/alvinunreal/oh-my-opencode-slim/blob/ea5859f41befefe779051bcd1389b4cff1e76cb7/src/cli/providers.ts#L91-L114), [S3 custom-skills-registry.ts](https://github.com/alvinunreal/oh-my-opencode-slim/blob/ea5859f41befefe779051bcd1389b4cff1e76cb7/src/cli/custom-skills-registry.ts), [S3 docs/skills.md](https://github.com/alvinunreal/oh-my-opencode-slim/blob/ea5859f41befefe779051bcd1389b4cff1e76cb7/docs/skills.md) |
| Skills gating | "the `skills` array is authoritative for skill gating" | — | semantics: a stale name means zero skills | docs/configuration.md "Agent Permissions → Merge semantics" |

### 3c. Council

| Key | Upstream 3.0.4 | Ours | Status | Source |
|---|---|---|---|---|
| `council.master` | deprecated; warning, no effect | **required** to emit any council block ([oh-my-opencode-slim.ts:419-422](https://github.com/itsmylife44/cliproxyapi-dashboard/blob/48aaca44d97da7128d336e1b2cd1e97ac0bb1967/dashboard/src/lib/config-generators/oh-my-opencode-slim.ts#L419-L422)) | **removed (2.2.5)** | [S3 loader.ts#L471-L491](https://github.com/alvinunreal/oh-my-opencode-slim/blob/ea5859f41befefe779051bcd1389b4cff1e76cb7/src/config/loader.ts#L471-L491), [S3 docs/council.md](https://github.com/alvinunreal/oh-my-opencode-slim/blob/ea5859f41befefe779051bcd1389b4cff1e76cb7/docs/council.md) |
| Council (synthesizer) model | `presets.<name>.council.model`, like any agent | already emitted via the grid (`council` is in `SLIM_AGENTS`) | OK | docs/configuration.md "Council configuration note" |
| `council.presets.<p>.<councillor>` | flat; `model` is a string **or a fallback array**; `variant`, `prompt` | flat; `model` string only | **type widened** | [S3 council-schema.ts#L45](https://github.com/alvinunreal/oh-my-opencode-slim/blob/ea5859f41befefe779051bcd1389b4cff1e76cb7/src/config/council-schema.ts#L45) |
| `council.presets.<p>.master` | ignored silently | emitted ([:392-400](https://github.com/itsmylife44/cliproxyapi-dashboard/blob/48aaca44d97da7128d336e1b2cd1e97ac0bb1967/dashboard/src/lib/config-generators/oh-my-opencode-slim.ts#L392-L400)) | **removed** | [S3 council-schema.ts#L84](https://github.com/alvinunreal/oh-my-opencode-slim/blob/ea5859f41befefe779051bcd1389b4cff1e76cb7/src/config/council-schema.ts#L84) |
| Nested `councillors` wrapper | legacy, still accepted | our zod requires it on input ([schemas.ts:217](https://github.com/itsmylife44/cliproxyapi-dashboard/blob/48aaca44d97da7128d336e1b2cd1e97ac0bb1967/dashboard/src/lib/validation/schemas.ts#L217)); generator flattens it | legacy | [S3 council-schema.ts#L89](https://github.com/alvinunreal/oh-my-opencode-slim/blob/ea5859f41befefe779051bcd1389b4cff1e76cb7/src/config/council-schema.ts#L89) |
| `master_timeout`, `master_fallback` | gone (2.0.2) | emitted | **removed**, silently dropped (`passthrough` + transform) | [S3 council-schema.ts#L144-L160](https://github.com/alvinunreal/oh-my-opencode-slim/blob/ea5859f41befefe779051bcd1389b4cff1e76cb7/src/config/council-schema.ts#L144-L160) |
| `councillors_timeout`, `councillor_execution_mode`, `councillor_retries` | gone (1.0.0 / 2.2.4) | emitted | **removed**, silently dropped | same |
| `default_preset` | kept, default `"default"` | emitted | OK | SCHEMA3 |

---

## 4. Breaking changes

Checked explicitly. Only the last group (removed keys) affects us.

1. **Package name: unchanged.** npm `name` is still `oh-my-opencode-slim`, and the repo is still
   `alvinunreal/oh-my-opencode-slim` (NPM; [S3 package.json](https://github.com/alvinunreal/oh-my-opencode-slim/blob/ea5859f41befefe779051bcd1389b4cff1e76cb7/package.json)).
   Our plugin entry `oh-my-opencode-slim@latest` is correct
   ([`components/opencode-config-generator.tsx:51`](https://github.com/itsmylife44/cliproxyapi-dashboard/blob/48aaca44d97da7128d336e1b2cd1e97ac0bb1967/dashboard/src/components/opencode-config-generator.tsx#L51),
   [`lib/config-sync/generate-bundle.ts:360-366`](https://github.com/itsmylife44/cliproxyapi-dashboard/blob/48aaca44d97da7128d336e1b2cd1e97ac0bb1967/dashboard/src/lib/config-sync/generate-bundle.ts#L360-L366)).
   Upstream docs say `@latest` installs the newest major. Auto-update never crosses majors, and only
   pinned entries stay pinned (docs/configuration.md "Manual Update Mode").
2. **Config filename: unchanged, with one addition.** Still `~/.config/opencode/oh-my-opencode-slim.json`.
   A sibling `oh-my-opencode-slim.jsonc` **takes precedence** if both exist, and project layers
   `.opencode/oh-my-opencode-slim.json[c]` merge on top
   ([S3 cli/paths.ts#L71-L75](https://github.com/alvinunreal/oh-my-opencode-slim/blob/ea5859f41befefe779051bcd1389b4cff1e76cb7/src/cli/paths.ts#L71-L75),
   docs/configuration.md "Config Files"). Our download name `oh-my-opencode-slim.json`
   ([`oh-my-opencode-slim-config-generator.tsx:507`](https://github.com/itsmylife44/cliproxyapi-dashboard/blob/48aaca44d97da7128d336e1b2cd1e97ac0bb1967/dashboard/src/components/oh-my-opencode-slim-config-generator.tsx#L507))
   is still read, **but it is silently shadowed** if the user has a `.jsonc` from the upstream installer.
3. **Schema URL: unchanged.** Upstream's own installer writes
   `https://unpkg.com/oh-my-opencode-slim@latest/oh-my-opencode-slim.schema.json`
   ([S3 cli/providers.ts#L5-L6](https://github.com/alvinunreal/oh-my-opencode-slim/blob/ea5859f41befefe779051bcd1389b4cff1e76cb7/src/cli/providers.ts#L5-L6)),
   which is identical to ours
   ([`oh-my-opencode-slim.ts:200`](https://github.com/itsmylife44/cliproxyapi-dashboard/blob/48aaca44d97da7128d336e1b2cd1e97ac0bb1967/dashboard/src/lib/config-generators/oh-my-opencode-slim.ts#L200)).
   Because it is `@latest`, editors already validate our output against the 3.0.4 schema and flag the
   removed keys.
4. **Removed keys that reject the whole file:**
   - `fallback.chains`. Strict object, not in `LEGACY_FALLBACK_KEYS`. The loader logs
     "Invalid config at …" and returns `null` for the layer.
     ([S3 schema.ts#L771-L775](https://github.com/alvinunreal/oh-my-opencode-slim/blob/ea5859f41befefe779051bcd1389b4cff1e76cb7/src/config/schema.ts#L771-L775),
     [#L843](https://github.com/alvinunreal/oh-my-opencode-slim/blob/ea5859f41befefe779051bcd1389b4cff1e76cb7/src/config/schema.ts#L843),
     [S3 loader.ts#L567-L580](https://github.com/alvinunreal/oh-my-opencode-slim/blob/ea5859f41befefe779051bcd1389b4cff1e76cb7/src/config/loader.ts#L567-L580);
     the commit message on [`325fee7`](https://github.com/alvinunreal/oh-my-opencode-slim/commit/325fee779941e854e54bf9e7465f007b70f3f1b9)
     confirms that unknown `fallback.*` keys otherwise "reject the whole config".)
   - Any agent field not in the strict `AgentOverrideConfigSchema`. **We don't emit any today**, but
     the raw JSON editor passes `options` through untouched, and future fields need care.
5. **Removed keys that are silently stripped or ignored (with or without a warning):** `tmux` (warns),
   `council.master` (warns), `fallback.timeoutMs` / `retry_on_empty` (warns), `manualPlan`,
   `scoringEngineVersion`, `balanceProviderUsage`, `background`, `todoContinuation`, `websearch`,
   `council.master_timeout` / `master_fallback` / `councillors_timeout` / `councillor_execution_mode` /
   `councillor_retries`, `council.presets.<p>.master` (no warning). The UI still offers every one of
   them, so users configure settings that do nothing.
6. **Removed agent:** `council-master` (1.0.0).
7. **Renamed names used in our defaults:** skill `cartography` → `codemap` (1.0.0), MCP `grep_app` →
   `gh_grep` (2.0.0). Removed: MCP `websearch` (2.2.9), skill `agent-browser` (no longer bundled or recommended).
8. **Installer CLI:** `--skills=yes|no` was removed on 2026-09-26
   ([`90dda4a5`](https://github.com/alvinunreal/oh-my-opencode-slim/commit/90dda4a5a8e23da4ca2b6d9b3b0f5ccecf41c743)). `parseArgs`
   ignores unknown flags, so our quick-start command
   `bunx oh-my-opencode-slim@latest install --no-tui --skills=no` still runs, but the flag does
   nothing ([S3 cli/index.ts#L12-L60](https://github.com/alvinunreal/oh-my-opencode-slim/blob/ea5859f41befefe779051bcd1389b4cff1e76cb7/src/cli/index.ts#L12-L60)).
   The installer now also writes its own presets (`openai`, `opencode-go`) and asks about
   `--background-subagents` ([S3 docs/installation.md](https://github.com/alvinunreal/oh-my-opencode-slim/blob/ea5859f41befefe779051bcd1389b4cff1e76cb7/docs/installation.md)).

---

## 5. Impact on our files

Pointers only. Line numbers are at DASH `48aaca4`, relative to `dashboard/`.

**`src/lib/config-generators/oh-my-opencode-slim.ts`**
- `:33-41` `SLIM_AGENT_ROLES`: the agent set is still valid. The `fixer` default variant `low`
  differs from upstream's openai mapping (`high`), which is cosmetic.
- `:125-137` default skills/MCPs are written into every preset. They need the new names
  (`codemap`, `gh_grep`, no `websearch`, no `agent-browser`), or we should stop writing them so the
  upstream defaults apply (see 6).
- `:283-285` `scoringEngineVersion`, `balanceProviderUsage`: dead.
- `:287-304` `manualPlan`: dead.
- `:312-327` multiplexer: `tmux` → `multiplexer` conversion is now pointless. The default
  `type: "auto"` differs from upstream's default `none`.
- `:329-332` `background`: dead (the closest replacement is `backgroundJobs.concurrency`).
- `:334-360` fallback: **must not emit `chains`** (whole file rejected). Must also stop injecting
  `timeoutMs` / `retry_on_empty` defaults, which cause a warning on every load. New keys:
  `maxRetries`, `initialRetryDelayMs`, `continuationPolicy`.
- `:362-423` council: drop `master` (`:367-378`), the per-preset `master` (`:392-400`) and the five
  dead scalars (`:407-417`). The gate at `:419-422` must become "has presets", not "has master + presets".
- `:436-450` `todoContinuation`, `websearch`: dead.

**`src/lib/config-generators/oh-my-opencode-slim-types.ts`**
- `:7` "Based on v0.9.14" and `:233-235` "matches the schema at …@latest": both stale.
- `:25-33` `SLIM_MANUAL_PLAN_AGENTS`, `:39` `council-master`, `:46` multiplexer enum, `:56`
  scoring enum, `:60` websearch providers.
- `:63-82` default MCP and skill tables (see above).
- `:107-115` `SlimAgentConfig` is missing 10 upstream fields. `:122-136` `SlimPreset` has no
  `extends` / `agents` / `marketplace`.
- `:145-156` fallback and background types. `:175-184` council type. `:186-230` tmux, multiplexer
  (missing `cmux_tui_binary`, `viewer`), interview (missing `printState`), todo and websearch types.
- `:305-334` `validateAgentConfig` drops new fields, so they can't survive a save.
- `:353-373` presets loop: `extends: "x"` is skipped, and an `agents: {...}` wrapper is **stored as an
  agent literally named `agents`**, which then reaches the generator's non-grid passthrough
  (`oh-my-opencode-slim.ts:231-237`).
- `:380-421`, `:452-513`, `:516-607`, `:631-659`: validators for removed or changed keys.

**`src/lib/validation/schemas.ts`**
- `:159-175` `SlimAgentEntrySchema` (same missing fields; plain `z.object` strips them).
- `:177-200` manualPlan, fallback (`chains`, `timeoutMs`, `retry_on_empty`), tmux, background.
- `:202-231` council (`master`, required `councillors` wrapper, dead scalars).
- `:233` `SlimPresetSchema` rejects `extends` (string value) with a 400.
- `:235-239` multiplexer enum. `:249-258` todo and websearch. `:260-278` overrides root.

**`src/components/oh-my-opencode-slim/toggle-sections.tsx`** (797 lines)
- Sections that configure nothing in 3.x: scoring `:193-216`, background `:275-290`, fallback
  timeout / retry-on-empty / chains `:356-405`, council master and dead scalars `:454-470`,
  `:474-480`, `:494-545`, todoContinuation `:637-692`, websearch `:696-710`, tmux `:714-745`,
  manualPlan `:764-775`.
- Multiplexer select `:229-270` lacks `herdr` / `kitty` / `cmux-tui`.

**`src/components/oh-my-opencode-slim/skills-section.tsx`**
- `:8` comment about `--skills=yes`. `:12-14` toggles for `cartography` and `agent-browser`.

**`src/components/oh-my-opencode-slim-config-generator.tsx`**
- `:337-345`, `:389-399` handlers for dead sections. `:507` filename (see the `.jsonc` shadowing question).

**`src/components/quick-start-config-section.tsx`**
- `:115` `--skills=no` is a no-op flag.

**`src/lib/config-sync/generate-bundle.ts`**
- `:426-438` passes stored `slimOverrides` through `validateSlimConfig` + `buildSlimConfig`. Users who
  already saved `fallback.chains` keep receiving a rejected file through sync until the stored overrides
  are cleaned. The fix in the generator covers this path automatically.

**`src/app/api/agent-config-slim/route.ts`**
- `:100`, `:125-126` call the same validators. No route change is needed beyond the schema updates.

**`messages/en.json`** (and `de.json`, same keys)
- `:1388` "install recommended skills (simplify, cartography)".
- `:1708-1711` cartography and agent-browser labels.
- `:1742` and `:1785` mention `council-master`, and the placeholder suggests `"mcps": ["websearch"]`.
- `:1788`, `:1798`, `:1807-1812`, `:1821-1830`, `:1842-1857` labels and tooltips for dead sections.
  `:1821` says "A council block is only emitted when a master … present".
- The legacy `ohMyOpenCode.*` namespace (`:1686-1730`) belongs to the non-slim generator. Not in scope.

**Tests that encode old behavior**
- `src/lib/__tests__/slim-fallback-chains-bug.test.ts` (whole file asserts `fallback.chains` output).
- `src/lib/__tests__/slim-config-chains.test.ts`.
- `src/lib/__tests__/slim-validation-bugs.test.ts:9-50` (manualPlan, tmux).
- `src/app/api/agent-config-slim/route.test.ts:~60-120` (`websearch`, `retry_on_empty`, `chains`,
  `master_fallback`, `councillor_retries`).

**Not affected:** `shared.ts` only re-exports `ConfigData` / `OAuthAccount` types for slim, and the
slim generator does not import `oh-my-opencode-presets.*`.

---

## 6. Open questions for the human

1. **Minimum supported upstream version.** Target 3.x only, or keep emitting keys older installs need?
   Because the plugin entry is `@latest`, new installs get 3.x. Older installs never auto-cross a major.
2. **Migrating `fallback.chains`.** Should we drop stored `chains` (data loss) or fold them into each
   agent's array `model` (`[primary, ...chain]`) on read or generate? The second option keeps user
   intent and matches upstream's replacement.
3. **Default skills and MCPs.** Should we keep writing explicit per-agent `skills` / `mcps` into every
   preset, with the new names, or stop writing them so upstream defaults apply? Upstream's installer
   gives the orchestrator `["*"]`. Ours restricts it to one skill.
4. **Dead UI sections.** Delete them (scoring, manualPlan, background, todoContinuation, websearch,
   tmux, council master and dead scalars), or hide them behind a "legacy" toggle? What should happen
   to values already stored in the DB and in backups (`lib/backup/*`)?
5. **New upstream features.** Which of the 14 new top-level keys and 10 new agent fields deserve UI,
   and which belong in the raw-JSON editor only? Candidates: `backgroundJobs.concurrency`,
   `fallback.maxRetries`, `disabled_skills`, `disabled_hooks`, `autoUpdate`, preset `extends`.
6. **`.jsonc` shadowing.** The upstream installer can write `oh-my-opencode-slim.jsonc`. Should the
   quick-start text warn that a `.jsonc` file overrides our downloaded `.json`, or tell users to name
   it `.jsonc`? The same question applies to the file `opencode-cliproxyapi-sync` writes.
7. **Pin the `$schema` URL?** Keep `@latest` (editor validation follows upstream, so it flags our
   drift early), or pin to the version we target?
8. **Verification.** Do we want a test that validates `buildSlimConfig` output against a vendored
   copy of the upstream JSON schema (SCHEMA3), so the next drift fails CI instead of failing silently?
