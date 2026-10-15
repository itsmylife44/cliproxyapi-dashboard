# CLIProxyAPI upstream API drift vs. dashboard (research)

Status: research only, no code changed. All findings were verified at runtime against the real
upstream binary and traced through our code (see "Verification"). Tracked in issues #243–#258. Date 2026-10-14. Upstream checked at the latest release
tag **v8.0.29**, published 2026-10-14T16:19Z. The tag points at commit
`5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3`, which is also the current `main` HEAD, so the
"release vs main" diff is empty. `dev` is 2 commits ahead (`4e8a4125ace0b5d64e9b23840c4c4b6c8a55fd06`,
see section 5). For comparison, the last v7 tag **v7.3.20** (`ef9e71201e0ca72b03a540d9b6e0862f8c053347`)
was also read. Dashboard paths are relative to the repo root at `main`
(`796e7a9e2da487253d19d457449446e72178e278`).

**Pinned version.** It is not pinned. Both stacks run `eceasy/cli-proxy-api:latest`
(`infrastructure/docker-compose.yml:38`, `docker-compose.local.yml:29`), and the in-app updater
pulls the same image (`dashboard/src/app/api/update/route.ts:15`). As of today, `latest` is
v8.0.29. The stack moved from CLIProxyAPIPlus back to mainline in `86a2663` (2026-05-05). Several
findings below are features that only the Plus fork had and that were never removed from the
dashboard.

Abbreviations used for sources:

- **CPA**: `router-for-me/CLIProxyAPI@5fc580b` (= `v8.0.29` = `main`), base URL
  `https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/`
- **CPA7**: `router-for-me/CLIProxyAPI@v7.3.20` (`ef9e712`)
- **REL**: `gh api repos/router-for-me/CLIProxyAPI/releases --paginate` (891 releases read)
- **DASH**: this repo at `796e7a9`, base URL
  `https://github.com/itsmylife44/cliproxyapi-dashboard/blob/796e7a9e2da487253d19d457449446e72178e278/`

All links point at those exact SHAs.

---

## Summary table (ranked by severity)

| # | Severity | Category | Upstream (what & link) | Ours (what & path:line) | Impact / suggested action |
|---|---|---|---|---|---|
| 1 | **Bug: credential loss** | endpoint | `POST /auth-files?name=X.json` with a non-multipart body **writes the raw body as the credential file**. Disabling a credential goes through `PATCH /auth-files/status {name, disabled}`. [auth_files_crud.go#L111-L129](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/handlers/management/auth_files_crud.go#L111-L129), [#L262-L285](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/handlers/management/auth_files_crud.go#L262-L285), [auth_files_fields.go#L29-L40](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/handlers/management/auth_files_fields.go#L29-L40) | The enable/disable toggle POSTs `{"name","disabled"}` to `/auth-files?name=…`. [`dashboard/src/lib/providers/oauth-ops.ts:693-706`](https://github.com/itsmylife44/cliproxyapi-dashboard/blob/796e7a9e2da487253d19d457449446e72178e278/dashboard/src/lib/providers/oauth-ops.ts#L693-L706) | Toggling an OAuth account **overwrites its token file** with `{"name":…,"disabled":…}`. The account is lost and must be re-authenticated. This is not a v8 regression: CPA7 behaves the same. **Fix:** `PATCH /auth-files/status` with `{name, disabled}`. |
| 2 | **Bug: usage data loss** | semantics | The usage queue keeps items for `redis-usage-queue-retention-seconds`, **default 60, max 3600**, and prunes older items on every pop. [redisqueue/queue.go#L10-L11](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/redisqueue/queue.go#L10-L11), [#L199-L240](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/redisqueue/queue.go#L199-L240), [config.example.yaml#L1148-L1151](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/config.example.yaml#L1148-L1151) | The collector drains `/usage-queue` **every 5 min** from cron ([`infrastructure/docker-compose.yml:213`](https://github.com/itsmylife44/cliproxyapi-dashboard/blob/796e7a9e2da487253d19d457449446e72178e278/infrastructure/docker-compose.yml#L213), [`dashboard/src/app/api/usage/collect/route.ts:224`](https://github.com/itsmylife44/cliproxyapi-dashboard/blob/796e7a9e2da487253d19d457449446e72178e278/dashboard/src/app/api/usage/collect/route.ts#L224)). Our template never sets the retention key ([`infrastructure/config/config.yaml:84`](https://github.com/itsmylife44/cliproxyapi-dashboard/blob/796e7a9e2da487253d19d457449446e72178e278/infrastructure/config/config.yaml#L84) only sets `usage-statistics-enabled`). | Records older than 60 s are dropped before collection, so roughly 4 of every 5 minutes of usage are lost. **Fix:** set `redis-usage-queue-retention-seconds: 3600` in the template, `setup-local.sh` and `install.sh` (the legacy key is still valid), and/or collect at least once a minute. |
| 3 | **Bug: config wipe** | endpoint | `PUT /config.yaml` **replaces the whole file** with the request body (only a parse/validate step first). [config_basic.go#L129-L183](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/handlers/management/config_basic.go#L129-L183). `DELETE /proxy-url` exists. [server_management.go#L68-L71](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/server_management.go#L68-L71) | The "emergency proxy reset" sends `yaml.dump({"proxy-url": ""})` as the entire config.yaml. [`dashboard/src/app/dashboard/config/page.tsx:584-588`](https://github.com/itsmylife44/cliproxyapi-dashboard/blob/796e7a9e2da487253d19d457449446e72178e278/dashboard/src/app/dashboard/config/page.tsx#L584-L588) | Wipes client `api-keys`, every provider key, `openai-compatibility`, `oauth-model-alias`, etc. Management keeps working only because of `MANAGEMENT_PASSWORD`. **Fix:** `DELETE /proxy-url`. |
| 4 | **Bug (conditional): config edits silently lost** | config | v8 introduced a new nested YAML layout (`config-version: 8`, `server.*`, `access.api-keys`, `oauth.*`, `routing.retry.*`, `observability.*`, …). When a file mixes both layouts, **the v8 field wins and the legacy key is deleted** on write. [config_v8.go#L72-L110](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/config/config_v8.go#L72-L110), [#L334-L340](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/config/config_v8.go#L334-L340), [#L456-L539](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/config/config_v8.go#L456-L539), [config_basic.go#L101-L111](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/handlers/management/config_basic.go#L101-L111), and documented at [config.example.yaml#L1214-L1220](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/config.example.yaml#L1214-L1220) | The config editor merges **legacy root keys** (`auth-dir`, `streaming`, `disable-cooling`, `max-retry-credentials`, `tls`, `pprof`, `payload`, `claude-header-defaults`, `oauth-model-alias`, …) into the raw YAML and PUTs it back. [`dashboard/src/app/dashboard/config/page.tsx:328-391`](https://github.com/itsmylife44/cliproxyapi-dashboard/blob/796e7a9e2da487253d19d457449446e72178e278/dashboard/src/app/dashboard/config/page.tsx#L328-L391), [`dashboard/src/lib/config-yaml.ts:31-47`](https://github.com/itsmylife44/cliproxyapi-dashboard/blob/796e7a9e2da487253d19d457449446e72178e278/dashboard/src/lib/config-yaml.ts#L31-L47) | With a legacy file (what our installers write) this works. With a **v8-layout file** (fresh v8 template, or after any `/v8/management` write) the edit is dropped, yet the response is 200 and the UI shows success. **Fix:** detect `config-version: 8` and write through `PATCH /v8/management/config/<path>`, or map keys to their v8 paths. |
| 5 | Bug | endpoint/provider | Removed upstream: Gemini CLI OAuth ([v7.2.20, PR #3893](https://github.com/router-for-me/CLIProxyAPI/releases/tag/v7.2.20)), iFlow ([v6.9.28](https://github.com/router-for-me/CLIProxyAPI/commit/f5dc6483d5bfdc254938f91e824a45afb0774005)), Qwen ([v6.9.26](https://github.com/router-for-me/CLIProxyAPI/commit/8fac29631db5cbcd69f396592f4718e165464724)). GitHub/Copilot, Kiro, Cursor, Kilo and GitLab were only ever in Plus. Any other `<provider>-auth-url` is served only if an **enabled plugin** registers that provider ([auth_files_oauth_callback.go#L148-L220](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/handlers/management/auth_files_oauth_callback.go#L148-L220); `plugins.enabled: false` by default, [config.example.yaml#L1167-L1168](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/config.example.yaml#L1167-L1168)). Core no longer synthesizes `gemini-cli` auth files ([synthesizer/file.go#L161-L163](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/watcher/synthesizer/file.go#L161-L163)). Only `/anthropic`, `/codex`, `/antigravity`, `/devin` and `/callback` provider callbacks exist ([server_routes.go#L153-L227](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/server_routes.go#L153-L227)). | The UI offers gemini-cli, iflow, github, kiro, cursor, kilo and gitlab logins ([`dashboard/src/components/providers/oauth-section.tsx:40-112`](https://github.com/itsmylife44/cliproxyapi-dashboard/blob/796e7a9e2da487253d19d457449446e72178e278/dashboard/src/components/providers/oauth-section.tsx#L40-L112), [`:695`](https://github.com/itsmylife44/cliproxyapi-dashboard/blob/796e7a9e2da487253d19d457449446e72178e278/dashboard/src/components/providers/oauth-section.tsx#L695)). The callback is forwarded to `/google/callback`, `/iflow/callback` and `/gitlab/callback` ([`dashboard/src/app/api/management/oauth-callback/route.ts:53-60`](https://github.com/itsmylife44/cliproxyapi-dashboard/blob/796e7a9e2da487253d19d457449446e72178e278/dashboard/src/app/api/management/oauth-callback/route.ts#L53-L60)). Constants: [`dashboard/src/lib/providers/constants.ts:19-33`](https://github.com/itsmylife44/cliproxyapi-dashboard/blob/796e7a9e2da487253d19d457449446e72178e278/dashboard/src/lib/providers/constants.ts#L19-L33) | On a stock stack these logins return 404. **Fix:** hide providers that are neither built in nor registered by a plugin (check `GET /plugins`). Use the generic `POST /oauth-callback {provider, redirect_url, code, state}` ([oauth_callback.go#L14-L34](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/handlers/management/oauth_callback.go#L14-L34)) instead of per-provider GET callbacks. |
| 6 | Bug | endpoint | `GET /usage` (in-memory stats) was removed in [v6.10.0](https://github.com/router-for-me/CLIProxyAPI/commit/18bb9c315fced2c428f57b4a0e66b06183c46c06) and replaced by `/usage-queue` ([v6.10.8](https://github.com/router-for-me/CLIProxyAPI/commit/da6c599efd8da34d23d3668371fbb5ac70399e9d)). It is not registered in CPA or CPA7. | The monitoring page polls `/api/management/usage` every 5 s ([`dashboard/src/app/dashboard/monitoring/page.tsx:148`](https://github.com/itsmylife44/cliproxyapi-dashboard/blob/796e7a9e2da487253d19d457449446e72178e278/dashboard/src/app/dashboard/monitoring/page.tsx#L148), [`dashboard/src/lib/api-endpoints.ts:63`](https://github.com/itsmylife44/cliproxyapi-dashboard/blob/796e7a9e2da487253d19d457449446e72178e278/dashboard/src/lib/api-endpoints.ts#L63)). The deprecated `/api/usage` also calls it ([`dashboard/src/app/api/usage/route.ts:365`](https://github.com/itsmylife44/cliproxyapi-dashboard/blob/796e7a9e2da487253d19d457449446e72178e278/dashboard/src/app/api/usage/route.ts#L365)). | Monitoring usage is always empty (the 404 is swallowed), and it adds 12 404s a minute per open tab. **Fix:** read from our DB (`/api/usage/history`) and delete `/api/usage` and the `USAGE` constant. |
| 7 | Bug | endpoint | No `auth-files/quota-groups*`, `oauth-quota-groups` or `ampcode/*` routes exist (Amp was removed in [v7.2.0](https://github.com/router-for-me/CLIProxyAPI/commit/8122b9fe) "feat!: remove amp integration support"). Quota groups were Plus-only. | Quota-group listing and the manual-suspend / clear-cooldown actions ([`dashboard/src/lib/providers/oauth-ops.ts:301`](https://github.com/itsmylife44/cliproxyapi-dashboard/blob/796e7a9e2da487253d19d457449446e72178e278/dashboard/src/lib/providers/oauth-ops.ts#L301), [`:410`](https://github.com/itsmylife44/cliproxyapi-dashboard/blob/796e7a9e2da487253d19d457449446e72178e278/dashboard/src/lib/providers/oauth-ops.ts#L410), [`:449`](https://github.com/itsmylife44/cliproxyapi-dashboard/blob/796e7a9e2da487253d19d457449446e72178e278/dashboard/src/lib/providers/oauth-ops.ts#L449)). The `AMPCODE_*` and quota-group constants and allowlist entries ([`dashboard/src/lib/api-endpoints.ts:91-110`](https://github.com/itsmylife44/cliproxyapi-dashboard/blob/796e7a9e2da487253d19d457449446e72178e278/dashboard/src/lib/api-endpoints.ts#L91-L110), [`dashboard/src/app/api/management/[...path]/route.ts:76-101`](https://github.com/itsmylife44/cliproxyapi-dashboard/blob/796e7a9e2da487253d19d457449446e72178e278/dashboard/src/app/api/management/%5B...path%5D/route.ts#L76-L101)) | The listing fails silently (try/catch). Suspend/clear return "HTTP 404" to the user. **Fix:** remove them, or replace them with upstream cooldown reset (`POST /reset-quota`, `/v8/.../routing/cooldown/reset`) and the `cooldowns` field on `GET /auth-files`. |
| 8 | Bug (minor) | config | `auth-dir` is `json:"-"` and is **never** returned by `GET /config`, in CPA or CPA7. [internal/config/config.go#L45](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/config/config.go#L45) | The editor shows a fake default `~/.cli-proxy-api` ([`page.tsx:176-178`](https://github.com/itsmylife44/cliproxyapi-dashboard/blob/796e7a9e2da487253d19d457449446e72178e278/dashboard/src/app/dashboard/config/page.tsx#L176-L178)). The "auth-dir guard" is therefore true on **every** save and rewrites `auth-dir` ([`page.tsx:367-369`](https://github.com/itsmylife44/cliproxyapi-dashboard/blob/796e7a9e2da487253d19d457449446e72178e278/dashboard/src/app/dashboard/config/page.tsx#L367-L369)). Every save also re-dumps the whole YAML with js-yaml, which strips comments. | Harmless in our Docker stack, where `~` is `/root` and resolves to the same path. It breaks any install with a custom `auth-dir` (credentials "disappear"). **Fix:** only touch `auth-dir` when the raw YAML lacks it. |
| 9 | Missing (important) | provider | New built-in OAuth: `kimi-ai-auth-url`, `devin-auth-url`, `meta-auth-url` ([server_management.go#L195-L198](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/server_management.go#L195-L198); Devin [v7.3.1](https://github.com/router-for-me/CLIProxyAPI/releases/tag/v7.3.1), Meta [v7.3.4](https://github.com/router-for-me/CLIProxyAPI/releases/tag/v7.3.4)). Executors: [internal/runtime/executor](https://github.com/router-for-me/CLIProxyAPI/tree/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/runtime/executor) (`devin_executor.go`, `meta_executor.go`, `kimi_executor.go`). | Not in the UI or the `NON_ADMIN_OAUTH_PATHS` allowlist ([`[...path]/route.ts:24-38`](https://github.com/itsmylife44/cliproxyapi-dashboard/blob/796e7a9e2da487253d19d457449446e72178e278/dashboard/src/app/api/management/%5B...path%5D/route.ts#L24-L38)). | Add the three providers (`devin` also has a `/devin/callback` route). |
| 10 | Missing (important) | provider/endpoint | New key families: `interactions-api-key`, `meta-api-key`, `vertex-api-key` (plus `vertex/import`). [server_management.go#L100-L103, L150-L163, L189](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/server_management.go#L100-L189) | `PROVIDER` only covers claude/gemini/codex/xai/openai-compat ([`constants.ts:1-17`](https://github.com/itsmylife44/cliproxyapi-dashboard/blob/796e7a9e2da487253d19d457449446e72178e278/dashboard/src/lib/providers/constants.ts#L1-L17)). The proxy regex already allows `*-api-key`. | Add them as API-key providers if they are wanted. Vertex and Interactions (Gemini) are the most relevant. |
| 11 | Missing (important) | endpoint | The plugin system: `/plugins`, `/plugin-store`, `/plugins/:id/{enabled,config,quota}` ([server_management.go#L35-L46](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/server_management.go#L35-L46)). Several providers now exist only as plugins (#5). | Not supported. | Needed if we want to keep offering the plugin-only providers. At least list installed plugins so the provider list can be filtered. |
| 12 | Semantics / roadmap | endpoint | **`/v0/management` is deprecated and "no longer maintained"** ([AGENTS.md#L63](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/AGENTS.md#L63), [v8.0.5 `dace3bb9`](https://github.com/router-for-me/CLIProxyAPI/releases/tag/v8.0.5)). The new `/v8/management` API ([server_management_v8.go#L12-L62](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/server_management_v8.go#L12-L62)) dropped the credential quota endpoints ([v8.0.5 `097511b8`](https://github.com/router-for-me/CLIProxyAPI/releases/tag/v8.0.5)). | 100 % on v0 ([`dashboard/src/lib/env.ts:39`](https://github.com/itsmylife44/cliproxyapi-dashboard/blob/796e7a9e2da487253d19d457449446e72178e278/dashboard/src/lib/env.ts#L39)). | v0 routes are byte-identical between v7.3.20 and v8.0.29 (verified by diffing the route tables), so nothing has broken *yet*. New fields will only land in v8. Plan the migration, starting with config (#4). |
| 13 | Nice-to-have | config | Fields that exist only in the Plus fork are absent from upstream `Config` (`incognito-browser`, `kiro`, `kiro-preferred-endpoint`, `ampcode`). [config.go `type Config`](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/config/config.go) | The config editor exposes them ([`page.tsx:328-333`](https://github.com/itsmylife44/cliproxyapi-dashboard/blob/796e7a9e2da487253d19d457449446e72178e278/dashboard/src/app/dashboard/config/page.tsx#L328-L333)). `oauth-settings` reads `incognito-browser` ([`dashboard/src/app/api/proxy/oauth-settings/route.ts:26`](https://github.com/itsmylife44/cliproxyapi-dashboard/blob/796e7a9e2da487253d19d457449446e72178e278/dashboard/src/app/api/proxy/oauth-settings/route.ts#L26)), which is always false. | Remove them. In a v8 file, unknown sections get commented out on the next v8 migration. |
| 14 | Nice-to-have | endpoint | Unused but useful: `max-retry-credentials` (dedicated endpoint, L120-L122), `oauth-request-scoped-errors` (L175-L178), `api-key-usage` (L92), `auth-files/refresh` (L188), `reset-quota` (L82), `model-definitions/:channel` (L182), `auth-files` pagination ([auth_files.go#L103-L152](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/handlers/management/auth_files.go#L103-L152), opt-in, so no change is needed). | We write `max-retry-credentials` through the YAML merge instead of its endpoint. | Low priority. Moving `max-retry-credentials` to its endpoint removes one YAML-merge field (#4). |
| 15 | Nice-to-have | semantics | `DELETE /<p>-api-key?api-key=…` returns 400 when two entries share a key; it needs `&base-url=`. [config_lists.go#L800-L852](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/handlers/management/config_lists.go#L800-L852) | We never send `base-url` ([`dashboard/src/lib/providers/api-key-ops.ts:336-341`](https://github.com/itsmylife44/cliproxyapi-dashboard/blob/796e7a9e2da487253d19d457449446e72178e278/dashboard/src/lib/providers/api-key-ops.ts#L336-L341)). | Edge case: delete fails when the same key is configured twice. |
| 16 | Ops | infra | Releases ship almost daily (v8.0.25 to v8.0.29 in 3 days, a major on 2026-09-27). | `:latest` is unpinned ([`infrastructure/docker-compose.yml:38`](https://github.com/itsmylife44/cliproxyapi-dashboard/blob/796e7a9e2da487253d19d457449446e72178e278/infrastructure/docker-compose.yml#L38)). | Pin a tested tag (`eceasy/cli-proxy-api:v8.0.29`) and bump it on purpose. |
| 17 | Upcoming (dev only) | config | `dev` adds operator overrides for Claude header defaults and client request-ID modes (`9db0729f`, `4e8a4125`; config.example.yaml +14). | n/a | No action. Watch for new `upstream.claude.header-defaults.*` keys. |

Checked and **found compatible** (no action): `POST /api-call` body `{auth_index, method, url, header, data}`
and response `{status_code, header, body}` ([api_tools.go#L33-L48](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/handlers/management/api_tools.go#L33-L48));
`PUT /api-keys` as a string array ([config_lists.go#L146-L151](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/handlers/management/config_lists.go#L146-L151));
provider-key `PUT` as an array; routing strategies `round-robin | weighted-round-robin | fill-first`
([config_basic.go#L311-L318](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/handlers/management/config_basic.go#L311-L318));
`GET /logs?after=` still supported next to the new `cursor`; `GET /latest-version` → `{"latest-version"}`
([config_basic.go#L98](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/handlers/management/config_basic.go#L98));
`GET /usage-queue?count=` → JSON array ([usage.go#L24-L43](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/handlers/management/usage.go#L24-L43));
`DELETE /auth-files?name=`; all `{value}` toggle endpoints. **`GET /config` keeps the legacy flat JSON
shape in v8**: the runtime `Config` struct and its JSON tags are unchanged apart from added `models`
and `oauth-settings` ([config_v8.go#L14-L16](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/config/config_v8.go#L14-L16)
"Config remains the effective runtime/wire representation"). Everything that reads `/config` as
JSON (agent-config, config-sync bundle, setup-status, config editor load) is unaffected.

---

## Verification (2026-10-14)

Every row above was re-checked independently, after this report was written, in two ways:

- **Upstream at runtime.** `eceasy/cli-proxy-api:v8.0.29` (digest `sha256:b98590c9…1eb6`, identical
  to `:latest` on that date; the binary reports commit `5fc580b`) ran in a throwaway container with
  the dashboard's legacy template (`infrastructure/config/config.yaml`), mounted as a single file the
  way production mounts it. An OpenAI-compatible mock stood in for the provider. The exact requests
  the dashboard sends were replayed, and the files on disk were diffed.
- **Dashboard side.** Each call site was traced end to end at `796e7a9`: UI trigger, route, proxy
  allowlist, guards, callers and tests.

All 28 cited upstream line ranges contain the cited code. No row was refuted. Corrections and
additions are listed below, and the GitHub issues carry the corrected text.

| Row | Issue | Result |
|---|---|---|
| 1 | #243 | Confirmed, and worse: the file becomes `{"disabled":false,"name":…}`, so the account is **not** disabled and disappears from `GET /auth-files`. `PATCH /auth-files/status` keeps the tokens. |
| 2 | #244 | Confirmed: a record was present when popped after 2 s and gone after 75 s; with retention 3600 it survived. Pruning runs on push **and** pop. Added: (a) the collector pulls one batch of 500 and never loops (620 queued returned 500, then 120); (b) upstream enqueues only when `usage-statistics-enabled: true`, which `setup-local.sh`/`.ps1` omit and `config.dev.yaml.example` sets to `false`, so local stacks record nothing; (c) `install.sh:1083-1091` adds a second host-crontab collector. `install.sh` does not write config.yaml, so existing installs need a patch step. |
| 3 | #245 | Confirmed: a 302-line config became `"proxy-url": ""`. `DELETE /proxy-url` keeps every key, but upstream's save path also appends its default blocks and deletes `ampcode`. The constant, allowlist entry and proxy `DELETE` already exist. |
| 4 | #246 | Confirmed, with a nuance: an edit is lost only when the file **already contains** the v8 path for that field (`max-retry-credentials` and `passthrough-headers` were lost). Otherwise the key is migrated and kept (`streaming`). One `/v8` config PATCH converts a legacy file to v8. The v8 PATCH body is the raw JSON value; `{"value":…}` returns 422. |
| 5 | #247 | Confirmed: gemini-cli, iflow, github, kiro, cursor, kilo, gitlab and qwen auth URLs, and the `/google`, `/iflow` and `/gitlab` callbacks, all return 404. Correction: the official plugin store offers gemini-cli, github-copilot, kiro and cursor as plugins. iflow, kilo, gitlab and qwen have no upstream support at all. The UI list is at `oauth-section.tsx:27-124`. |
| 6 | #248 | Confirmed (404). History correction: the in-memory `/usage` was removed in v6.10.0, and the route was renamed to `/usage-queue` in v6.10.8. The panel shows "Loading usage statistics..." forever. The `usage/export` and `usage/import` allowlist entries are also dead. |
| 7 | #249 | All paths return 404. Correction: the "HTTP 404 shown to the user" case cannot occur, because `quotaGroups` is always empty and the buttons never render. `oauth-ops.ts:399-472` has no callers. Do not confuse these with the internal `QuotaGroup` concept (quota windows). |
| 8 | #250 | Confirmed: a custom `auth-dir` was overwritten. In the stock container `~` is `/root`, so stock stacks are unaffected. The guard runs on every save and strips all comments (217 → 0). The correct lines are `page.tsx:177-179`. |
| 9 | #251 | Confirmed (200). Devin's auth URL redirects to the root `/callback`. Four locales exist (en, de, es, zh-CN). |
| 10 | #252 | Confirmed (200). `vertex-api-key` is already counted in 3 places and `vertex/import` is already allowlisted. |
| 11 | #253 | Confirmed: `/plugins` returns `plugins_enabled:false`, and `/plugin-store` lists 120 entries even when plugins are disabled. |
| 12 | #254 | Confirmed. The deprecation is a line in upstream's AGENTS.md only; v0 responses carry no `Deprecation`/`Sunset` header. The v0 *route table* is identical (the file itself is not byte-identical). About 13 dashboard files hardcode their own v0 fallback. `install.sh` rejects non-v0 URLs. |
| 13 | #255 | Confirmed. On legacy files, any v0 per-field save **deletes** `ampcode` (upstream `removeRemovedIntegrationKeys`). v8 writes comment out all four keys. |
| 15 | #256, #258 | Confirmed: 400 `multiple items match api-key; base-url is required`. `removeKeyByAdmin` has the same bug. **New:** the `DELETE /openai-compatibility?api-key=` sent by the same two functions always fails with 400 `missing name or index`, because upstream accepts only `name` or `index`. Appendix B previously marked it OK; it is now corrected (#258). |
| 16 | #257 | Confirmed: v8.0.25 → v8.0.29 took about 54 h, with 49 releases in 30 days. Correction: the in-app updater pulls a chosen tag and retags it as `:latest`, so pinning compose needs an updater change. A plain restart does not pull. |

Rows 14 and 17 need no action. Row 14 is folded into #246 (moving `max-retry-credentials` and
`oauth-model-alias` to their dedicated endpoints).

## 1. OAuth toggle overwrites the credential file (#1)

Our call (`dashboard/src/lib/providers/oauth-ops.ts:693-706`):

```ts
const endpoint = `${MANAGEMENT_BASE_URL}/auth-files?name=${encodeURIComponent(resolved.accountName)}`;
postRes = await fetchWithTimeout(endpoint, { method: "POST", headers: { "Content-Type": "application/json", … },
  body: JSON.stringify({ name: resolved.accountName, disabled }) });
```

`resolved.accountName` is the auth-file `name` from `GET /auth-files`, for example
`claude-foo@bar.com.json` (`oauth-ops.ts:355`), so it passes the `.json` suffix check.

Upstream `UploadAuthFile` (CPA `auth_files_crud.go`):

- L59 / L213-L216: `multipartAuthFileHeaders` returns `nil, nil` for any non-multipart content type.
- L111-L119: reads `?name=`, checks it is safe and ends in `.json`.
- L120-L125: `data := io.ReadAll(body)`, then `h.writeAuthFile(ctx, name, data)`.
- `writeAuthFile` L262-L275: `buildAuthFromFileData(dst, data)`, then **`os.WriteFile(dst, data, 0o600)`**.
- `buildAuthFromFileData` L474-L534 does not reject a body without `type`. It falls back to provider
  `"unknown"`, because `SynthesizeAuthFile` returns `nil, nil` when `type` is empty
  (`synthesizer/file.go` L161-L163).

The result: the token file is replaced by `{"name":"…","disabled":true}` and the auth is re-registered
as provider `unknown`. CPA7 has identical code (`cpa-v7.3.20/internal/api/handlers/management/auth_files_crud.go:110`
onwards), so this has been broken since the move back to mainline, if not earlier.

The correct upstream call is `PATCH /v0/management/auth-files/status` with body
`{"name": "<file>.json", "disabled": true|false}` (`auth_files_fields.go` L29-L40, which also
accepts `auth_index`). `auth-files/status` is already in our proxy allowlist
(`[...path]/route.ts:80`).

## 2. Usage queue retention (#2)

`redisqueue.PopOldest` calls `popOldest`, which calls `pruneLocked(now)` (queue.go L199-L205). That
drops every item with `enqueuedAt` older than `now - retentionSeconds` (L226-L240). The default is
60 s (L10), capped at 3600 s (L11). The setting is `redis-usage-queue-retention-seconds` in legacy
layout and `observability.usage.redis-usage-queue-retention-seconds` in v8
(config_v8.go L72-L110, last prefix entry). Our collector runs from cron `*/5 * * * *` and pulls
`count=500` per batch. Any record enqueued more than 60 s before a run is gone. `infrastructure/config/config.yaml`,
`setup-local.sh` and `install.sh` never set the key (grep confirms). This is also not a v8 change:
retention was added in v6.10.1 (REL `56df3689`). It is listed here because it is a semantic default
we handle wrong.

## 3. Emergency proxy reset wipes config.yaml (#3)

`page.tsx:584-588` PUTs `yaml.dump({ "proxy-url": "" })` to `/config.yaml`. `PutConfigYAML`
(config_basic.go L129-L183) validates the body and then calls `WriteConfig(h.configFilePath, body)`
(L101-L127), which truncates the file and writes the body as is. The config that remains is a single key.
`remote-management.allow-remote` disappears too. The dashboard keeps access only because
`MANAGEMENT_PASSWORD` sets `allowRemoteOverride` (handler.go L73-L83). The safe call already
exists: `DELETE /v0/management/proxy-url` (server_management.go L71).

## 4. v8 layout vs. our YAML merge (#4)

- v8.0.0 ([release](https://github.com/router-for-me/CLIProxyAPI/releases/tag/v8.0.0), PR #6154)
  introduced the nested layout. The legacy-to-v8 path table is `buildV8Paths` (config_v8.go L72-L110),
  e.g. `auth-dir → oauth.auth-dir`, `api-keys → access.api-keys`, `request-retry → routing.retry.request-retry`,
  `debug → observability.logs.debug`, `ws-auth → oauth.providers.aistudio.ws-auth`, and
  `gemini-api-key/… → api-keys.<family>` (`v8KeyFamilies` L64-L69). In v8 the **root `api-keys` is a
  mapping of provider groups, not the client-key list**.
- Load: a legacy-only file stays legacy (config_load.go L211-L225, `NormalizeConfigLayout(…, false)`
  only removes legacy keys that conflict with a present v8 key).
- `flattenV8` copies each present v8 path over its legacy path (config_v8.go L334-L340), so the
  v8 value wins in memory.
- `PUT /config.yaml` → `WriteConfig`: if the document looks like v8 (`IsV8ConfigLayout`), it runs
  `NormalizeConfigLayout(data, true)`, which **deletes the legacy key whenever the v8 key exists**
  (L488-L506) and comments out unknown sections (L523-L530).
- v0 field endpoints (`PUT /debug`, `/proxy-url`, …) go through `persist` →
  `SaveConfigPreserveComments(…, migrateV8=false)` (handler.go L416-L418), which keeps the current layout.
  Those are safe in both layouts.

So the per-field endpoint saves in `page.tsx` work either way. The `fieldsWithoutEndpoints` YAML-merge
path silently loses its changes once the file is v8. When does a file become v8? When someone uses
the v8 template (`config.example.yaml` at CPA is v8, L10 `config-version: 8`), or after any
`/v8/management/config*` write, which persists with migrate=true. **Unverified:** whether the upstream
Management Center panel now writes through `/v8`. Our template sets `disable-control-panel: true`, so
our default stack is not exposed through that route, but users who edit the config with other tools are.

## 5. Upstream inventory notes

- **Release vs main:** `v8.0.29` == `main` == `5fc580b`, so there is no unreleased diff. `dev`
  (`4e8a412`) adds two commits (Claude header-default overrides, config only).
- **v0 route table CPA7 vs CPA:** identical, 142 method+path pairs, from `diff` of the extracted
  `mgmt.<METHOD>("…")` lines. v8 added a parallel `/v8/management` group only.
- **Built-in providers in CPA (executors):** claude, codex (+websockets), antigravity, gemini (API key),
  gemini-vertex, aistudio, kimi, xai, devin, meta, openai-compat
  ([executor dir](https://github.com/router-for-me/CLIProxyAPI/tree/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/runtime/executor)).
  Built-in OAuth URLs: anthropic, codex, antigravity, kimi, kimi-ai, xai, devin, meta
  (server_management.go L191-L198). Anything else needs a plugin.
- **Notable REL entries since v7.3.3** (our last research baseline): v7.3.4 Meta OAuth and keys,
  plugin-quota; v7.3.7 auth-file pagination; v7.3.13 priority in credential PATCH; v8.0.0 v8 config API;
  v8.0.1-v8.0.4 v8 migration hardening; v8.0.5 v0 deprecated and credential-quota endpoints removed
  from v8; v8.0.11 shared upstream provider settings; v8.0.12 auth indexes in v8 api-keys; v8.0.19
  `server.github-token`; v8.0.24 `native-tool-search` for Claude keys and `upstream.claude.tool-search`;
  v8.0.28 adds `claude-haiku-5-5` and removes legacy Gemini models; v8.0.29 moves
  `tls-handshake-timeout-seconds` to `requests.*`.

---

## Appendix A: upstream management routes (CPA `5fc580b`)

`/v0/management` (registered in `internal/api/server_management.go`; identical in CPA7):

| Path | Methods | Line |
|---|---|---|
| `/v0/management/oauth-callback` | POST,GET | [L25-L26](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/server_management.go#L25-L26) |
| `/v0/management/config` | GET | [L31](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/server_management.go#L31) |
| `/v0/management/config.yaml` | GET,PUT | [L32-L33](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/server_management.go#L32-L33) |
| `/v0/management/latest-version` | GET | [L34](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/server_management.go#L34) |
| `/v0/management/plugins` | GET | [L35](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/server_management.go#L35) |
| `/v0/management/plugin-store` | GET | [L36](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/server_management.go#L36) |
| `/v0/management/plugin-store/:id/install` | POST | [L37](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/server_management.go#L37) |
| `/v0/management/plugins/:id` | DELETE | [L38](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/server_management.go#L38) |
| `/v0/management/plugins/:id/enabled` | PATCH | [L39](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/server_management.go#L39) |
| `/v0/management/plugins/:id/config` | GET,PUT,PATCH | [L40-L42](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/server_management.go#L40-L42) |
| `/v0/management/plugins/:id/quota` | GET,POST,DELETE | [L43-L45](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/server_management.go#L43-L45) |
| `/v0/management/plugins/:id/quota/reset` | POST | [L46](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/server_management.go#L46) |
| `/v0/management/debug` | GET,PUT,PATCH | [L48-L50](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/server_management.go#L48-L50) |
| `/v0/management/logging-to-file` | GET,PUT,PATCH | [L52-L54](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/server_management.go#L52-L54) |
| `/v0/management/logs-max-total-size-mb` | GET,PUT,PATCH | [L56-L58](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/server_management.go#L56-L58) |
| `/v0/management/error-logs-max-files` | GET,PUT,PATCH | [L60-L62](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/server_management.go#L60-L62) |
| `/v0/management/usage-statistics-enabled` | GET,PUT,PATCH | [L64-L66](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/server_management.go#L64-L66) |
| `/v0/management/proxy-url` | GET,PUT,PATCH,DELETE | [L68-L71](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/server_management.go#L68-L71) |
| `/v0/management/api-call` | POST | [L73](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/server_management.go#L73) |
| `/v0/management/quota-exceeded/switch-project` | GET,PUT,PATCH | [L75-L77](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/server_management.go#L75-L77) |
| `/v0/management/quota-exceeded/switch-preview-model` | GET,PUT,PATCH | [L79-L81](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/server_management.go#L79-L81) |
| `/v0/management/reset-quota` | POST | [L82](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/server_management.go#L82) |
| `/v0/management/quota/providers` | GET | [L84](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/server_management.go#L84) |
| `/v0/management/quota/fetch` | POST | [L85](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/server_management.go#L85) |
| `/v0/management/quota/reset` | POST | [L86](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/server_management.go#L86) |
| `/v0/management/api-keys` | GET,PUT,PATCH,DELETE | [L88-L91](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/server_management.go#L88-L91) |
| `/v0/management/api-key-usage` | GET | [L92](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/server_management.go#L92) |
| `/v0/management/usage-queue` | GET | [L93](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/server_management.go#L93) |
| `/v0/management/gemini-api-key` | GET,PUT,PATCH,DELETE | [L95-L98](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/server_management.go#L95-L98) |
| `/v0/management/interactions-api-key` | GET,PUT,PATCH,DELETE | [L100-L103](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/server_management.go#L100-L103) |
| `/v0/management/logs` | GET,DELETE | [L105-L106](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/server_management.go#L105-L106) |
| `/v0/management/request-error-logs` | GET | [L107](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/server_management.go#L107) |
| `/v0/management/request-error-logs/:name` | GET | [L108](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/server_management.go#L108) |
| `/v0/management/request-log-by-id/:id` | GET | [L109](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/server_management.go#L109) |
| `/v0/management/request-log` | GET,PUT,PATCH | [L110-L112](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/server_management.go#L110-L112) |
| `/v0/management/ws-auth` | GET,PUT,PATCH | [L113-L115](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/server_management.go#L113-L115) |
| `/v0/management/request-retry` | GET,PUT,PATCH | [L117-L119](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/server_management.go#L117-L119) |
| `/v0/management/max-retry-credentials` | GET,PUT,PATCH | [L120-L122](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/server_management.go#L120-L122) |
| `/v0/management/max-retry-interval` | GET,PUT,PATCH | [L123-L125](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/server_management.go#L123-L125) |
| `/v0/management/force-model-prefix` | GET,PUT,PATCH | [L127-L129](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/server_management.go#L127-L129) |
| `/v0/management/routing/strategy` | GET,PUT,PATCH | [L131-L133](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/server_management.go#L131-L133) |
| `/v0/management/claude-api-key` | GET,PUT,PATCH,DELETE | [L135-L138](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/server_management.go#L135-L138) |
| `/v0/management/codex-api-key` | GET,PUT,PATCH,DELETE | [L140-L143](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/server_management.go#L140-L143) |
| `/v0/management/xai-api-key` | GET,PUT,PATCH,DELETE | [L145-L148](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/server_management.go#L145-L148) |
| `/v0/management/meta-api-key` | GET,PUT,PATCH,DELETE | [L150-L153](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/server_management.go#L150-L153) |
| `/v0/management/openai-compatibility` | GET,PUT,PATCH,DELETE | [L155-L158](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/server_management.go#L155-L158) |
| `/v0/management/vertex-api-key` | GET,PUT,PATCH,DELETE | [L160-L163](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/server_management.go#L160-L163) |
| `/v0/management/oauth-excluded-models` | GET,PUT,PATCH,DELETE | [L165-L168](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/server_management.go#L165-L168) |
| `/v0/management/oauth-model-alias` | GET,PUT,PATCH,DELETE | [L170-L173](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/server_management.go#L170-L173) |
| `/v0/management/oauth-request-scoped-errors` | GET,PUT,PATCH,DELETE | [L175-L178](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/server_management.go#L175-L178) |
| `/v0/management/auth-files` | GET,POST,DELETE | [L180, L184-L185](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/server_management.go#L180-L185) |
| `/v0/management/auth-files/models` | GET | [L181](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/server_management.go#L181) |
| `/v0/management/model-definitions/:channel` | GET | [L182](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/server_management.go#L182) |
| `/v0/management/auth-files/download` | GET | [L183](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/server_management.go#L183) |
| `/v0/management/auth-files/status` | PATCH | [L186](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/server_management.go#L186) |
| `/v0/management/auth-files/fields` | PATCH | [L187](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/server_management.go#L187) |
| `/v0/management/auth-files/refresh` | POST | [L188](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/server_management.go#L188) |
| `/v0/management/vertex/import` | POST | [L189](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/server_management.go#L189) |
| `/v0/management/{anthropic,codex,antigravity,kimi,kimi-ai,xai,devin,meta}-auth-url` | GET | [L191-L198](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/server_management.go#L191-L198) |
| `/v0/management/get-auth-status` | GET | [L199](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/server_management.go#L199) |
| `/v0/management/oauth-session` | DELETE | [L200](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/server_management.go#L200) |
| `/v0/management/<plugin-provider>-auth-url` and other plugin routes | any | NoRoute fallback → `ServePluginAuthURL` / plugin host ([server_management.go#L255-L291](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/server_management.go#L268-L300)) |

`/v8/management` (registered in `internal/api/server_management_v8.go`; new in v8.0.0):

| Path | Methods | Line |
|---|---|---|
| `/v8/management/oauth/callback` | GET,POST | [L14-L15](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/server_management_v8.go#L14-L15) |
| `/v8/management/config`, `/config.yaml`, `/config/*path` | GET,PUT,PATCH (+DELETE on `*path`) | [L21-L28](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/server_management_v8.go#L21-L28) |
| `/v8/management/server/latest-version` | GET | [L30](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/server_management_v8.go#L30) |
| `/v8/management/requests/api-call` | POST | [L31](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/server_management_v8.go#L31) |
| `/v8/management/routing/cooldown/reset` | POST | [L32](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/server_management_v8.go#L32) |
| `/v8/management/routing/model-definitions/:channel` | GET | [L33](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/server_management_v8.go#L33) |
| `/v8/management/observability/logs` | GET,DELETE | [L35-L36](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/server_management_v8.go#L35-L36) |
| `/v8/management/observability/logs/errors[/:name]` | GET | [L37-L38](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/server_management_v8.go#L37-L38) |
| `/v8/management/observability/logs/requests/:id` | GET | [L39](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/server_management_v8.go#L39) |
| `/v8/management/observability/usage/api-keys` | GET | [L40](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/server_management_v8.go#L40) |
| `/v8/management/observability/usage/queue` | GET | [L41](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/server_management_v8.go#L41) |
| `/v8/management/credentials` | GET,POST,DELETE | [L43-L45](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/server_management_v8.go#L43-L45) |
| `/v8/management/credentials/{models,download}` | GET | [L46-L47](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/server_management_v8.go#L46-L47) |
| `/v8/management/credentials/{status,fields}` | PATCH | [L48-L49](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/server_management_v8.go#L48-L49) |
| `/v8/management/credentials/refresh` | POST | [L50](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/server_management_v8.go#L50) |
| `/v8/management/oauth/import` | POST | [L51](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/server_management_v8.go#L51) |
| `/v8/management/oauth/auth-url?provider=` | GET | [L52](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/server_management_v8.go#L52) |
| `/v8/management/oauth/status` | GET | [L53](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/server_management_v8.go#L53) |
| `/v8/management/oauth/session` | DELETE | [L54](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/server_management_v8.go#L54) |
| `/v8/management/plugins`, `/plugins/:id`, `/plugins/store`, `/plugins/store/:id/install`, `/plugins/:id/quota` | GET / DELETE / GET / POST / GET,POST,DELETE | [L56-L62](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/server_management_v8.go#L56-L62) |

Non-management OAuth provider callbacks on the main server: `GET /anthropic/callback`,
`/codex/callback`, `/antigravity/callback`, `/callback` and `/devin/callback`
([server_routes.go#L153-L227](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/server_routes.go#L153-L227)).

v8 top-level config sections ([config.example.yaml](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/config.example.yaml)):
`config-version` (L10), `models` (L18), `server` (L24), `management` (L81), `access` (L106),
`credentials` (L115), `routing` (L149), `requests` (L221), `client` (L316), `upstream` (L330),
`api-keys` (provider groups, L485), `oauth` (L893), `multimedia` (L1109), `observability` (L1125),
`plugins` (L1167). Legacy keys are listed in the comment block from L1214.

## Appendix B: dashboard calls into CLIProxyAPI (DASH `796e7a9`)

Every path below is relative to `CLIPROXYAPI_MANAGEMENT_URL` (`…/v0/management`). Status is against CPA.

| Method + path | Where | Fields read/sent | Status |
|---|---|---|---|
| GET `/config` | `app/api/proxy/status/route.ts:45`, `app/api/proxy/oauth-settings/route.ts:16`, `app/api/setup-status/route.ts:33`, `app/api/agent-config/route.ts:94`, `app/api/agent-config-slim/route.ts:80`, `lib/config-sync/generate-bundle.ts:180`, `app/dashboard/config/page.tsx:165,352` | legacy flat JSON; `incognito-browser` | OK (legacy JSON preserved); `incognito-browser` absent (#13); `auth-dir` never returned (#8) |
| GET/PUT `/config.yaml` | `app/dashboard/config/page.tsx:374-386, 584-588` | raw YAML merge / full replace | #3, #4 |
| PUT `/{proxy-url,debug,logging-to-file,logs-max-total-size-mb,error-logs-max-files,usage-statistics-enabled,request-retry,max-retry-interval,request-log,ws-auth,force-model-prefix}` | `app/dashboard/config/page.tsx:246-258` (via proxy) | `{value}` | OK |
| PUT `/quota-exceeded/{switch-project,switch-preview-model}`, `/routing/strategy` | `app/dashboard/config/page.tsx:261-268` | `{value}` | OK |
| GET `/usage` | `app/dashboard/monitoring/page.tsx:148`, `app/api/usage/route.ts:365` | in-memory stats | **404** (#6) |
| GET `/usage-queue?count=500` | `app/api/usage/collect/route.ts:224` | JSON array | OK; retention (#2) |
| GET/DELETE `/logs`, `/logs?after=` | `app/dashboard/logs/page.tsx:57,186`, `app/dashboard/monitoring/page.tsx:199` | | OK |
| GET `/latest-version` | `app/dashboard/settings/page.tsx:143` | `latest-version` | OK |
| GET `/auth-files` | `lib/providers/oauth-ops.ts:81,257`, `app/api/providers/oauth/claim/route.ts:78`, `app/api/management/oauth-callback/route.ts:130`, `app/api/quota/route.ts:1432`, `app/api/usage/collect/route.ts:229`, `app/api/setup-status/route.ts:37` | `files[].name/provider/type/email/status/auth_index` | OK |
| POST `/auth-files` (multipart) | `lib/providers/oauth-ops.ts:106-110` | `file` | OK |
| POST `/auth-files?name=` (JSON) | `lib/providers/oauth-ops.ts:693-706` | `{name, disabled}` | **Destroys credential** (#1) |
| DELETE `/auth-files?name=` | `lib/providers/oauth-ops.ts:547,617` | | OK |
| GET `/auth-files/quota-groups`, PATCH `…/manual`, `…/auto/clear` | `lib/providers/oauth-ops.ts:301,410,449` | | **404** (#7) |
| `/ampcode/*`, `/oauth-quota-groups` | `lib/api-endpoints.ts:91,104-110` (constants and allowlist) | | **404** (#7) |
| GET/PUT/DELETE `/{claude,gemini,codex,xai}-api-key` | `lib/providers/api-key-ops.ts:78-154,259-341,391-470,516` | array PUT; `?api-key=` DELETE; `base-url` for codex/xai | OK (#15 edge case) |
| GET/PUT `/openai-compatibility` | `lib/providers/custom-provider-sync.ts:74,126`, `app/api/custom-providers/[id]/route.ts:194,330,343`, `app/api/custom-providers/reorder/route.ts:111,142` | array PUT | OK |
| DELETE `/openai-compatibility?api-key=` | `lib/providers/api-key-ops.ts:336-342,466-471` | `?api-key=` | **400 "missing name or index"** (see Verification) |
| GET/PUT `/api-keys` | `lib/api-keys/sync.ts:95`, `app/api/admin/migrate-api-keys/route.ts:45`, `lib/config-sync/generate-bundle.ts:182` | string array | OK |
| POST `/api-call` | `app/api/quota/route.ts:288,361,534,668,836,991,1192` | `{auth_index, method, url, header, data}` | OK |
| GET `/{anthropic,codex,antigravity,kimi,xai}-auth-url` | `components/providers/oauth-section.tsx:32-64,80` | `is_webui=true` | OK |
| GET `/{gemini-cli,iflow,github,kiro,cursor,kilo}-auth-url`, GET/POST `/gitlab-auth-url` | `components/providers/oauth-section.tsx:40,72,88-112,695,723` | | **404 unless plugin** (#5) |
| GET `/get-auth-status?state=` | `components/providers/oauth-section.tsx:431` | `status: wait/ok/error/device_code` | OK |
| GET `<base>/{anthropic,google,codex,antigravity,iflow,gitlab}/callback` | `app/api/management/oauth-callback/route.ts:53-60` | `code`, `state` | google/iflow/gitlab **404** (#5) |
| `oauth-excluded-models`, `oauth-model-alias`, `request-error-logs*`, `request-log-by-id/*`, `model-definitions/*`, `auth-files/{models,download,fields,status}`, `vertex/import` | allowlist only ([`[...path]/route.ts:40-115`](https://github.com/itsmylife44/cliproxyapi-dashboard/blob/796e7a9e2da487253d19d457449446e72178e278/dashboard/src/app/api/management/%5B...path%5D/route.ts#L40-L115)) | | routes exist |

Not called at all: `/plugins*`, `/plugin-store*`, `/quota/*`, `/reset-quota`, `/api-key-usage`,
`/auth-files/refresh`, `/max-retry-credentials`, `/oauth-request-scoped-errors`,
`/{interactions,meta,vertex}-api-key`, `/{kimi-ai,devin,meta}-auth-url`, `/oauth-session`, all of
`/v8/management/*`.
