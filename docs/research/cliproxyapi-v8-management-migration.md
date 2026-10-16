# CLIProxyAPI `/v0/management` → `/v8/management` migration (research)

Status: research only, no code changed. Tracks issue #254. Date 2026-10-16. Follows
`docs/research/cliproxyapi-upstream-api-drift.md` (checked at v8.0.29), and re-checks upstream at the
latest release **v8.0.31** (published 2026-10-16T04:05Z).

Sources, pinned:

- **CPA31**: `router-for-me/CLIProxyAPI@355fd10e76b82e03ba6625acc583b900286e4bf2` (= tag `v8.0.31`), base URL
  `https://github.com/router-for-me/CLIProxyAPI/blob/355fd10e76b82e03ba6625acc583b900286e4bf2/`
- **CPA30**: `v8.0.30` = `5be2cdab0869cbaa3d401891f740aebf7e15aa99`
- **CPA29**: `v8.0.29` = `5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3` (the commit the prior research used)
- **CPA800** / **CPA804** / **CPA805**: `v8.0.0` = `31f4cfab3fc17f0ebc57b491508f451b190b020f`, `v8.0.4` =
  `d33f63f8e3d98428440ebca5a5b6a981a61ff71e`, `v8.0.5` = `e5b5a1cfca354ec80d5c31242ccfb6c0f6b5fbcd`
- **CPA7**: `v7.3.20` = `ef9e71201e0ca72b03a540d9b6e0862f8c053347`
- **DASH**: this repo at `main` `22ba244cab958a25371d6964bc63304f1c623daa`. Dashboard paths below are
  relative to `dashboard/` unless they start with a top-level directory.

---

## Summary

1. **v8.0.30 / v8.0.31 changed nothing in routing.** `server_management.go`, `server_management_v8.go`,
   `server.go`, `server_routes.go` and `AGENTS.md` are byte-identical between v8.0.29 and v8.0.31. There is
   still no v8 replacement for the v0 `/quota/*` routes, no `Deprecation`/`Sunset` header, and no new
   deprecation notice. The only deprecation text is still `AGENTS.md#L63`. What did ship:
   - **v8.0.31: ETag / If-Match on the v8 config endpoints only** (`fa68946a`, closing upstream #6666, which
     had asked for it on `/v0/management/config.yaml`). This is the first concrete feature that exists on v8
     and not on v0.
   - **v8.0.30: server-side fix for the management write race** (`1631875b`, closing upstream #6631, which we
     reported). It also touched the v0 handlers, so v0 still gets bug fixes when they share code with v8.
2. **The quota blocker in #254 does not apply to this dashboard.** The dashboard never calls upstream
   `/quota/*`. Our quota page uses `POST /api-call` plus `GET /auth-files`
   (`src/app/api/quota/route.ts:320-1421`), and both have v8 equivalents served by the **same handlers**. The
   "upstream ships a v8 quota replacement" trigger in #254 can be dropped.
3. **v0 and v8 are mounted side by side on the same server.** Both are registered in one function, use the
   same middleware (same key, `Authorization: Bearer` or `X-Management-Key`), the same handler instance and
   the same mutex. One caveat: **any v8 route that saves config converts `config.yaml` to the v8 layout**. v0
   saves keep whatever layout the file already has.
4. **Older servers.** v8 routes exist from **v8.0.0** (not v8.0.5). v8.0.5 only removed
   `/v8/management/credentials/quota/*`. On v7.x a `/v8/...` path returns an empty-body 404. The dashboard
   pins `v8.0.29` by default, but the in-app updater accepts any `v*` tag, `CLIPROXYAPI_IMAGE_TAG` can be
   overridden, and `install.sh` can attach to an existing server of unknown version. So any v8 call needs
   either a declared minimum server version or a v0 fallback.
5. **Can anything move now?** 12 operational calls are path-only moves (same handler, same body and
   response, no config write; see the SAFE-NOW rows). Moving them gains nothing functionally today, and on a
   v7 server it breaks them unless they are gated. Nothing is forced to move. The first migration that pays
   off is `config.yaml` read-merge-write over `/v8/management/config.yaml` with `If-Match`, once the pin is
   v8.0.31 or later. Config readers (`GET /config`) and provider-key CRUD need real code changes.
6. **Not runtime-checked.** The Docker daemon was not running on this machine, so every v8.0.31 claim below
   comes from source at the pinned SHAs. Behavior marked "runtime-checked on v8.0.29" comes from the prior
   research.

---

## Verification

- **Upstream releases:** `gh release view v8.0.30|v8.0.31 -R router-for-me/CLIProxyAPI` (changelog bodies),
  `gh api repos/router-for-me/CLIProxyAPI/git/ref/tags/<tag>` (tag SHAs).
- **Upstream source:** fetched the tags into a scratch clone (no build scripts run). Checked
  `git diff v8.0.29 v8.0.31` (76 files) and `git log v8.0.29..v8.0.31` (16 commits). Confirmed with
  `git diff --quiet` that the routing files listed above did not change, then read every cited range at CPA31.
  Also searched all `.go` files at CPA31 for `Deprecation`/`Sunset` headers (0 hits) and the whole tree for
  v0 deprecation text (only `AGENTS.md:63`).
- **Newer than the release:** `main` is 1 commit past v8.0.31 (`e7003d2a`, README sponsor only). `dev`
  (`088e4457`) has no changes under `internal/api/`.
- **Upstream issues:** #6631 (closed by `1631875b`, v8.0.30) and #6666 (closed by `fa68946a`, v8.0.31) via
  `gh issue view`. An issue/PR search for "v0 management" and "v8 management quota" found no sunset or quota
  work.
- **Dashboard side:** at `22ba244`, every server-side fetch was re-derived from `getManagementUrl()` /
  `MANAGEMENT_BASE_URL` / `CLIPROXYAPI_MANAGEMENT_URL` usages, and every client-side fetch from
  `API_ENDPOINTS.MANAGEMENT.*` usages and literal `/api/management/...` strings. All of them were
  cross-checked against the proxy allowlist in `src/app/api/management/[...path]/route.ts`. Appendix B of
  the prior research was not reused as-is.
- **Issue #246:** closed 2026-10-15 by `e75ee8d` (dedicated endpoints for `oauth-model-alias` and
  `max-retry-credentials`, and v8 paths for merge-only fields when the file has `config-version: 8`), plus
  `a0b88cf` (one management write per save) and `297b20f` (replace `oauth-model-alias` on merge). This
  matters here because the dashboard can already read and write a v8-layout `config.yaml`
  (`src/lib/config-yaml.ts:39-64,82-97`).
- **Runtime:** **not runtime-checked.** `docker info` reported the daemon was not running. No v8.0.31 container
  was started and no release binary was run.

---

## 1. Upstream changes v8.0.29 → v8.0.31 that touch management

| Change | Where | Effect on us |
|---|---|---|
| Route tables unchanged | `internal/api/server_management.go`, `server_management_v8.go`, `server.go`, `server_routes.go` (identical at CPA29 and CPA31) | Appendix A of the prior research (line numbers included) is still valid at v8.0.31. |
| No v8 quota replacement | v8 still has only plugin quota routes: [server_management_v8.go#L60-L62](https://github.com/router-for-me/CLIProxyAPI/blob/355fd10e76b82e03ba6625acc583b900286e4bf2/internal/api/server_management_v8.go#L60-L62). v0 keeps `/quota/{providers,fetch,reset}`: [server_management.go#L84-L86](https://github.com/router-for-me/CLIProxyAPI/blob/355fd10e76b82e03ba6625acc583b900286e4bf2/internal/api/server_management.go#L84-L86). On v8, `GET /credentials` hides `quota_probe` and adds `quota_plugin_id`: [auth_files.go#L481-L488, L686-L699](https://github.com/router-for-me/CLIProxyAPI/blob/355fd10e76b82e03ba6625acc583b900286e4bf2/internal/api/handlers/management/auth_files.go#L481-L699) | None. The dashboard reads neither field (grep for `quota_probe`, `supports_quota`, `quota_plugin_id` and `quota/fetch` in `src` finds nothing). |
| No sunset signal | 0 `Deprecation`/`Sunset` header writes in any `.go` file at CPA31. The deprecation is still only [AGENTS.md#L63](https://github.com/router-for-me/CLIProxyAPI/blob/355fd10e76b82e03ba6625acc583b900286e4bf2/AGENTS.md#L63) ("deprecated and no longer maintained … do not modify endpoints under `/v0/management` unless necessary") | No forced timeline. |
| **v8 config ETag / If-Match** (v8.0.31, [`fa68946a`](https://github.com/router-for-me/CLIProxyAPI/commit/fa68946ad572f275b210595f63994dfeb9f0fe75), [release notes](https://github.com/router-for-me/CLIProxyAPI/releases/tag/v8.0.31)) | Reads return `ETag: "<sha256 of file bytes>"`, and non-GET requests return **412** when `If-Match` does not match. Without `If-Match` a write is still unconditional: [config_v8.go#L23-L40, L74-L75, L203-L209, L216-L261](https://github.com/router-for-me/CLIProxyAPI/blob/355fd10e76b82e03ba6625acc583b900286e4bf2/internal/api/handlers/management/config_v8.go#L23-L261). `ETag` is added to the CORS exposed headers: [server_middleware.go#L31-L33](https://github.com/router-for-me/CLIProxyAPI/blob/355fd10e76b82e03ba6625acc583b900286e4bf2/internal/api/server_middleware.go#L31-L33). v0 `GetConfigYAML` / `PutConfigYAML` ([config_basic.go#L129, L185](https://github.com/router-for-me/CLIProxyAPI/blob/355fd10e76b82e03ba6625acc583b900286e4bf2/internal/api/handlers/management/config_basic.go#L129-L185)) have none: the only ETag code in `handlers/management` is in `config_v8.go`. Upstream #6666 asked for it on v0 and got it on v8 only. | First real reason to move: three dashboard read-merge-writes of `config.yaml` could become safe compare-and-swap writes (§4). |
| Management write race fixed (v8.0.30, [`1631875b`](https://github.com/router-for-me/CLIProxyAPI/commit/1631875b9ac390fe6c57c4d320b4b40580e738cf), closes upstream #6631) | `SetConfig` ignores reloads parsed from an older file version, and v0 field/list setters now run their change and save under `h.mu` ([handler.go `SetConfig`/`updateBoolField`…](https://github.com/router-for-me/CLIProxyAPI/blob/355fd10e76b82e03ba6625acc583b900286e4bf2/internal/api/handlers/management/handler.go), `config_basic.go`, `config_lists.go` in the diff) | Our "one write per save" workaround (`a0b88cf`) stays correct, and is unneeded on v8.0.30 and later. Also shows that v0 handlers still get fixes when the code is shared. |
| Other v8.0.30 config additions | operator overrides for Claude header defaults and client request-ID modes (`9db0729f`, `4e8a4125`, `config.example.yaml` +14) | No management route change. |

## 2. v0 and v8 side by side on one server

- **Both mounted together.** `registerManagementRoutes` calls `s.registerManagementV8Routes()` and then
  registers the v0 group in the same function:
  [server_management.go#L14-L29](https://github.com/router-for-me/CLIProxyAPI/blob/355fd10e76b82e03ba6625acc583b900286e4bf2/internal/api/server_management.go#L14-L29).
  That function runs once a management secret is configured:
  [server.go#L250-L257](https://github.com/router-for-me/CLIProxyAPI/blob/355fd10e76b82e03ba6625acc583b900286e4bf2/internal/api/server.go#L250-L257).
- **Same auth.** Both groups use `s.managementAvailabilityMiddleware(), s.mgmt.Middleware()`:
  [server_management_v8.go#L17-L20](https://github.com/router-for-me/CLIProxyAPI/blob/355fd10e76b82e03ba6625acc583b900286e4bf2/internal/api/server_management_v8.go#L17-L20)
  and [server_management.go#L28-L29](https://github.com/router-for-me/CLIProxyAPI/blob/355fd10e76b82e03ba6625acc583b900286e4bf2/internal/api/server_management.go#L28-L29).
  The middleware accepts `Authorization: Bearer <key>` or `X-Management-Key`, and sets `X-CPA-VERSION`,
  `X-CPA-COMMIT` and `X-CPA-SUPPORT-PLUGIN` on every management response:
  [handler.go#L291-L315](https://github.com/router-for-me/CLIProxyAPI/blob/355fd10e76b82e03ba6625acc583b900286e4bf2/internal/api/handlers/management/handler.go#L291-L315).
  The OAuth callbacks of both versions sit outside the auth group, with availability middleware only:
  v8 [L14-L15](https://github.com/router-for-me/CLIProxyAPI/blob/355fd10e76b82e03ba6625acc583b900286e4bf2/internal/api/server_management_v8.go#L14-L15),
  v0 [L25-L26](https://github.com/router-for-me/CLIProxyAPI/blob/355fd10e76b82e03ba6625acc583b900286e4bf2/internal/api/server_management.go#L25-L26).
  So the dashboard's single `MANAGEMENT_API_KEY` works for both.
- **Same handler instance and lock.** Both versions route to `s.mgmt.*`. Most v8 operational routes call the
  very same handler functions as v0 (for example `ListAuthFiles`, `APICall`, `GetUsageQueue`, `GetLogs`):
  [server_management_v8.go#L30-L62](https://github.com/router-for-me/CLIProxyAPI/blob/355fd10e76b82e03ba6625acc583b900286e4bf2/internal/api/server_management_v8.go#L30-L62).
  Config writes from either version serialize on `h.mu`.
- **Caveat: v8 saves migrate the file layout.** The v8 group sets `ConfigV8ContextKey=true`
  ([server_management_v8.go#L18-L20](https://github.com/router-for-me/CLIProxyAPI/blob/355fd10e76b82e03ba6625acc583b900286e4bf2/internal/api/server_management_v8.go#L18-L20)).
  Every config save passes that flag as `migrateV8`:
  [handler.go#L431](https://github.com/router-for-me/CLIProxyAPI/blob/355fd10e76b82e03ba6625acc583b900286e4bf2/internal/api/handlers/management/handler.go#L429-L433),
  `saveConfigAndSnapshotLocked` [handler.go#L205](https://github.com/router-for-me/CLIProxyAPI/blob/355fd10e76b82e03ba6625acc583b900286e4bf2/internal/api/handlers/management/handler.go#L203-L209),
  plugin install [plugin_store.go#L328](https://github.com/router-for-me/CLIProxyAPI/blob/355fd10e76b82e03ba6625acc583b900286e4bf2/internal/api/handlers/management/plugin_store.go#L328).
  `/v8/management/config*` always writes the v8 layout:
  [config_v8.go#L189-L197](https://github.com/router-for-me/CLIProxyAPI/blob/355fd10e76b82e03ba6625acc583b900286e4bf2/internal/api/handlers/management/config_v8.go#L189-L197).
  A v0 save keeps the file's existing layout and only stays v8 if the file already is:
  [config_yaml.go#L12-L18, L42](https://github.com/router-for-me/CLIProxyAPI/blob/355fd10e76b82e03ba6625acc583b900286e4bf2/internal/config/config_yaml.go#L12-L42).
  The prior research runtime-checked on v8.0.29 that one v8 config write converts a legacy file.
  Since #246 the dashboard handles a v8-layout file. Still, the first v8 save on a stock (legacy) install
  rewrites `config.yaml`, and v8 migration comments out unknown or Plus-only keys (prior research, row 13).

## 3. Older servers and the version floor

- **v7.x has no v8 routes.** `server_management_v8.go` does not exist at CPA7. Unknown paths hit
  `pluginManagementNoRoute`, which returns a bare 404 for anything outside `/v0/management`:
  [CPA7 server_management.go#L253-L266](https://github.com/router-for-me/CLIProxyAPI/blob/ef9e71201e0ca72b03a540d9b6e0862f8c053347/internal/api/server_management.go#L253-L266),
  registered at [CPA7 server.go#L250](https://github.com/router-for-me/CLIProxyAPI/blob/ef9e71201e0ca72b03a540d9b6e0862f8c053347/internal/api/server.go#L250).
  The same logic applies at CPA31:
  [server_management.go#L255-L270](https://github.com/router-for-me/CLIProxyAPI/blob/355fd10e76b82e03ba6625acc583b900286e4bf2/internal/api/server_management.go#L255-L270).
- **v8 routes exist since v8.0.0, not v8.0.5.** `git diff v8.0.0 v8.0.31 -- internal/api/server_management_v8.go`
  only removes the three `/credentials/quota/*` routes
  ([CPA804 L43-L45](https://github.com/router-for-me/CLIProxyAPI/blob/d33f63f8e3d98428440ebca5a5b6a981a61ff71e/internal/api/server_management_v8.go#L43-L45)),
  which `097511b8` dropped in v8.0.5. Every route the dashboard would use exists on v8.0.0 and later.
  Behavior was not compared for v8.0.0–v8.0.4; only the route table was.
- **A 404 is ambiguous on its own.** Management being disabled or Home mode also gives an empty 404
  ([server_management.go#L213-L229](https://github.com/router-for-me/CLIProxyAPI/blob/355fd10e76b82e03ba6625acc583b900286e4bf2/internal/api/server_management.go#L213-L229)).
  A cheaper and clearer signal is `X-CPA-VERSION`, which every authenticated management response already
  carries on v7 too
  ([CPA7 handler.go#L268](https://github.com/router-for-me/CLIProxyAPI/blob/ef9e71201e0ca72b03a540d9b6e0862f8c053347/internal/api/handlers/management/handler.go#L268)).
  The dashboard already reads a sibling header the same way: `X-CPA-SUPPORT-PLUGIN` in
  `src/lib/plugin-store.ts:5-9`.
- **What the dashboard can be pointed at:**
  - Default pin `v8.0.29`: `infrastructure/docker-compose.yml:39`, `docker-compose.local.yml:29`
    (`eceasy/cli-proxy-api:${CLIPROXYAPI_IMAGE_TAG:-v8.0.29}`).
  - The in-app updater accepts any concrete tag (`src/lib/validation/schemas.ts:374-383`). The tag list keeps
    every `v*` tag (`src/app/api/update/check/route.ts:176`), so a v7 downgrade is possible.
  - `install.sh:402-408` accepts an existing external server at any `…/v0/management` URL, of unknown version.

  Conclusion: per-endpoint v8 calls need a version gate (or a 404 → v0 fallback), unless the project
  declares "CLIProxyAPI ≥ v8.0.0" (or ≥ v8.0.31 for ETag) as a supported minimum and enforces it in the
  updater and installer.

## 4. Endpoint migration map

Base for v8 paths: `getProxyBaseUrl() + "/v8/management"` (`src/lib/management-url.ts:15-17` already strips
any `/v<N>/management`). Client-side calls go through `/api/management/<v0 path>` and the allowlist in
`src/app/api/management/[...path]/route.ts:27-115`. Moving any of those means changing the allowlist or
adding a v0→v8 path map in that one proxy, not changing each UI file.

Verdicts:

- **SAFE-NOW**: the v8 route calls the same upstream handler, so request and response are identical, and the
  call saves no config (so no layout migration). Only the path changes. Still needs the §3 version gate or
  fallback for v7 servers.
- **NEEDS-CODE-CHANGE**: the shape, semantics or side effects differ.
- **MUST-STAY-V0**: no usable v8 equivalent.

v8 route lines refer to [server_management_v8.go @CPA31](https://github.com/router-for-me/CLIProxyAPI/blob/355fd10e76b82e03ba6625acc583b900286e4bf2/internal/api/server_management_v8.go).

| # | v0 call (method + path) | Dashboard call sites (`file:line` @22ba244) | v8 equivalent | Differences | Verdict |
|---|---|---|---|---|---|
| 1 | GET `/auth-files` | `src/lib/providers/oauth-ops.ts:85,148,260`; `src/app/api/providers/oauth/claim/route.ts:78`; `src/app/api/management/oauth-callback/route.ts:124`; `src/app/api/quota/route.ts:1421`; `src/app/api/usage/collect/route.ts:298`; `src/app/api/setup-status/route.ts:37`; `src/app/dashboard/page.tsx:112`; `src/app/api/agent-config/route.ts:94`; `src/app/api/agent-config-slim/route.ts:80`; `src/lib/config-sync/generate-bundle.ts:179`; `src/scripts/migrate-provider-ownership.ts:250` | GET `/credentials` (L43), same `ListAuthFiles` | v8 drops `quota_probe` and adds `quota_plugin_id` ([auth_files.go#L686-L699](https://github.com/router-for-me/CLIProxyAPI/blob/355fd10e76b82e03ba6625acc583b900286e4bf2/internal/api/handlers/management/auth_files.go#L686-L699)). The dashboard reads neither. | **SAFE-NOW** |
| 2 | POST `/auth-files` (multipart `file`) | `src/lib/providers/oauth-ops.ts:106` | POST `/credentials` (L44), same `UploadAuthFile` | none | **SAFE-NOW** |
| 3 | DELETE `/auth-files?name=` | `src/lib/providers/oauth-ops.ts:429,499` | DELETE `/credentials?name=` (L45), same `DeleteAuthFile` | none | **SAFE-NOW** |
| 4 | PATCH `/auth-files/status` `{name, disabled}` | `src/lib/providers/oauth-ops.ts:577` | PATCH `/credentials/status` (L48), same `PatchAuthFileStatus` | For **config API-key** auths the handler saves config, which via v8 migrates the layout ([auth_files_fields.go#L98-L111](https://github.com/router-for-me/CLIProxyAPI/blob/355fd10e76b82e03ba6625acc583b900286e4bf2/internal/api/handlers/management/auth_files_fields.go#L98-L111)). The dashboard only toggles file-backed OAuth accounts. | **SAFE-NOW** (file-backed OAuth only) |
| 5 | POST `/api-call` `{auth_index, method, url, header, data}` | `src/app/api/quota/route.ts:320,402,528,664,832,987,1181` | POST `/requests/api-call` (L31), same `APICall` | none ([api_tools.go#L33-L48](https://github.com/router-for-me/CLIProxyAPI/blob/355fd10e76b82e03ba6625acc583b900286e4bf2/internal/api/handlers/management/api_tools.go#L33-L48)) | **SAFE-NOW**. Covers the whole quota page. |
| 6 | GET `/usage-queue?count=` | `src/app/api/usage/collect/route.ts:28` | GET `/observability/usage/queue?count=` (L41), same `GetUsageQueue` | none | **SAFE-NOW** |
| 7 | GET `/logs[?after=]`, DELETE `/logs` | `src/app/dashboard/logs/page.tsx:57,186`; `src/app/dashboard/monitoring/page.tsx:184-185` (via proxy) | GET/DELETE `/observability/logs` (L35-L36), same `GetLogs`/`DeleteLogs` | none | **SAFE-NOW** (proxy allowlist change) |
| 8 | GET `/latest-version` | `src/app/dashboard/settings/settings-page.tsx:156` (via proxy) | GET `/server/latest-version` (L30), same `GetLatestVersion` | none | **SAFE-NOW** (proxy allowlist change) |
| 9 | GET `/plugins` | `src/lib/providers/plugins.ts:15`; `src/components/settings/plugin-settings.tsx:60` (via proxy) | GET `/plugins` (L56), same `ListPlugins` | none. `X-CPA-SUPPORT-PLUGIN` is set by the shared middleware. | **SAFE-NOW** |
| 10 | GET `/plugin-store` | `src/components/settings/plugin-settings.tsx:70` (via proxy) | GET `/plugins/store` (L58), same `ListPluginStore` | path rename only | **SAFE-NOW** (proxy allowlist change) |
| 11 | GET `/get-auth-status?state=` | `src/components/providers/oauth-section.tsx:353` (via proxy, non-admin allowlist) | GET `/oauth/status` (L53), same `GetAuthStatus` | path rename only | **SAFE-NOW** (`NON_ADMIN_OAUTH_PATHS` change) |
| 12 | POST `/oauth-callback` `{provider, redirect_url, code, state}` | `src/app/api/management/oauth-callback/route.ts:274`; `src/components/providers/oauth-section.tsx:426,589` (via proxy) | POST `/oauth/callback` (L15), same `PostOAuthCallback` | none | **SAFE-NOW** |
| 13 | POST `/plugin-store/:id/install?source=`, DELETE `/plugins/:id` | `src/components/settings/plugin-settings.tsx:171,193` (via proxy) | POST `/plugins/store/:id/install` (L59), DELETE `/plugins/:id` (L57), same handlers | Both save config with the v8 flag ([plugin_store.go#L328](https://github.com/router-for-me/CLIProxyAPI/blob/355fd10e76b82e03ba6625acc583b900286e4bf2/internal/api/handlers/management/plugin_store.go#L328), `DeletePlugin` in plugins.go), so the first call **migrates `config.yaml` to v8** | **NEEDS-CODE-CHANGE**: decide to accept the layout migration first (see §5) |
| 14 | GET `/<p>-auth-url?is_webui=true` (anthropic, codex, antigravity, kimi, kimi-ai, xai, devin, meta, plus plugin `gemini-cli`/`copilot`/`kiro`/`cursor`) | `src/lib/api-endpoints.ts:94-107` → `src/components/providers/oauth-section.tsx:498` (via proxy, non-admin allowlist) | GET `/oauth/auth-url?provider=<p>&is_webui=true` (L52), [auth_files_v8.go#L11-L36](https://github.com/router-for-me/CLIProxyAPI/blob/355fd10e76b82e03ba6625acc583b900286e4bf2/internal/api/handlers/management/auth_files_v8.go#L11-L36) | Provider is a query parameter, and **`anthropic` becomes `claude`**. Plugin providers go through `ServePluginAuthURL`, which reads `provider` from the query and points the plugin callback at `/v8/management/oauth/callback` ([auth_files_oauth_callback.go#L148-L185](https://github.com/router-for-me/CLIProxyAPI/blob/355fd10e76b82e03ba6625acc583b900286e4bf2/internal/api/handlers/management/auth_files_oauth_callback.go#L148-L185)). | **NEEDS-CODE-CHANGE**: constants, a provider-name map, `NON_ADMIN_OAUTH_PATHS`, the proxy regex (query-only route) |
| 15 | GET `/config` (legacy flat JSON) | `src/app/api/proxy/status/route.ts:45`; `src/app/api/setup-status/route.ts:33`; `src/app/api/usage/collect/route.ts:65`; `src/app/dashboard/page.tsx:110`; `src/app/api/agent-config/route.ts:93`; `src/app/api/agent-config-slim/route.ts:79`; `src/lib/config-sync/generate-bundle.ts:178`; `src/app/dashboard/config/page.tsx:154` (via proxy) | GET `/config` (L21) → `ConfigV8` | **Different shape**: v8 names and nesting (`observability.logs.debug`, `access.api-keys`, `api-keys.<family>` groups, …), ETag on v8.0.31 and later ([config_v8.go#L58-L85](https://github.com/router-for-me/CLIProxyAPI/blob/355fd10e76b82e03ba6625acc583b900286e4bf2/internal/api/handlers/management/config_v8.go#L58-L85)). v0 returns the runtime struct with legacy JSON tags ([config_basic.go#L26-L32](https://github.com/router-for-me/CLIProxyAPI/blob/355fd10e76b82e03ba6625acc583b900286e4bf2/internal/api/handlers/management/config_basic.go#L26-L32)). Readers key on legacy names, for example `PROVIDER_CONFIG_KEYS` (`src/lib/providers/constants.ts:26`, used at `src/app/dashboard/page.tsx:183` and `src/app/api/setup-status/route.ts:46`). | **NEEDS-CODE-CHANGE**: rewrite every reader, or keep v0 until last |
| 16 | GET + PUT `/config.yaml` (read-merge-write) | client: `src/lib/config-yaml-write.ts:12-14` (used by `src/app/dashboard/config/page.tsx:264`, `src/components/settings/plugin-settings.tsx:162`), `src/app/dashboard/config/page.tsx:169` (auth-dir read); server: `src/app/api/usage/collect/route.ts:77-80` | GET/PUT `/config.yaml` (L24-L25) | v8 GET always returns the **normalized v8 layout**, even for a legacy file on disk ([config_v8.go#L41, L76-L77](https://github.com/router-for-me/CLIProxyAPI/blob/355fd10e76b82e03ba6625acc583b900286e4bf2/internal/api/handlers/management/config_v8.go#L41-L77)). v8 PUT writes v8 ([L189-L197](https://github.com/router-for-me/CLIProxyAPI/blob/355fd10e76b82e03ba6625acc583b900286e4bf2/internal/api/handlers/management/config_v8.go#L189-L197)). On ≥ v8.0.31, sending `If-Match: <ETag from GET>` gives a 412 instead of a lost update. `mergeConfigYaml` already takes the v8 branch on `config-version: 8` (`src/lib/config-yaml.ts:82-97`); `readAuthDir` already prefers `oauth.auth-dir` (`:29-34`). | **NEEDS-CODE-CHANGE** (small): pass the ETag through the proxy, send `If-Match`, retry on 412; converts the file to v8 on first save. **Best first slice.** |
| 17 | PUT `/{debug,logging-to-file,logs-max-total-size-mb,error-logs-max-files,usage-statistics-enabled,request-retry,max-retry-interval,max-retry-credentials,request-log,ws-auth,force-model-prefix,proxy-url}` `{value}`; PUT `/quota-exceeded/{switch-project,switch-preview-model}`, `/routing/strategy` `{value}` | `src/lib/config-save-plan.ts:10-33` → `src/app/dashboard/config/page.tsx:250` (via proxy) | PUT/PATCH `/config/<v8 path>` (L26-L28) with the **raw JSON value** as body. Paths come from upstream `buildV8Paths` ([internal/config/config_v8.go#L71-L110](https://github.com/router-for-me/CLIProxyAPI/blob/355fd10e76b82e03ba6625acc583b900286e4bf2/internal/config/config_v8.go#L71-L110)), e.g. `debug` → `observability/logs/debug`. `quota-exceeded/*` and `routing/strategy` keep their paths (shared roots). | `{"value":…}` is rejected (422 from `ParseConfigBytes`, [config_v8.go#L180-L183](https://github.com/router-for-me/CLIProxyAPI/blob/355fd10e76b82e03ba6625acc583b900286e4bf2/internal/api/handlers/management/config_v8.go#L180-L183); runtime-checked on v8.0.29). It migrates the layout. The dashboard already has the mapping table as `V8_PATHS` (`src/lib/config-yaml.ts:39-64`). | **NEEDS-CODE-CHANGE**: map path, unwrap body |
| 18 | PUT `/oauth-model-alias` (raw provider map) | `src/lib/config-save-plan.ts:23` → `src/app/dashboard/config/page.tsx:250` | PUT `/config/oauth/model-alias` (`oauth-model-alias` → `oauth.model-alias`, config_v8.go#L86) | Body is the same raw map; PUT replaces whole (config_v8.go#L141-L147). Migrates layout. | **NEEDS-CODE-CHANGE** (path only, but migrates) |
| 19 | DELETE `/proxy-url` | `src/app/dashboard/config/page.tsx:456` (via proxy) | DELETE `/config/requests/proxy-url` | v0 sets `""` and saves ([config_basic.go#L359-L364](https://github.com/router-for-me/CLIProxyAPI/blob/355fd10e76b82e03ba6625acc583b900286e4bf2/internal/api/handlers/management/config_basic.go#L359-L364)); v8 deletes the key and 404s if it is absent ([config_v8.go#L90-L98](https://github.com/router-for-me/CLIProxyAPI/blob/355fd10e76b82e03ba6625acc583b900286e4bf2/internal/api/handlers/management/config_v8.go#L90-L98)). Migrates layout. | **NEEDS-CODE-CHANGE**: treat 404 as success |
| 20 | GET + PATCH `/logging-to-file` | `src/app/dashboard/monitoring/page.tsx:150,230,259` (via proxy) | GET/PATCH `/config/observability/logs/logging-to-file` | v0 GET returns `{"logging-to-file": bool}` ([config_basic.go#L215-L216](https://github.com/router-for-me/CLIProxyAPI/blob/355fd10e76b82e03ba6625acc583b900286e4bf2/internal/api/handlers/management/config_basic.go#L215-L216)); v8 returns a bare `bool`. The PATCH body is a raw `bool`. Migrates layout. | **NEEDS-CODE-CHANGE** |
| 21 | GET/PUT/DELETE `/{claude,gemini,codex,xai,vertex,interactions,meta}-api-key` (flat array PUT; DELETE `?api-key=&base-url=`) | `src/lib/providers/api-key-ops.ts:82,148,181,299,335,385,438,482,530`; `src/scripts/migrate-provider-ownership.ts:129` | `/config/api-keys/<family>` (`v8KeyFamilies`, [internal/config/config_v8.go#L64-L69](https://github.com/router-for-me/CLIProxyAPI/blob/355fd10e76b82e03ba6625acc583b900286e4bf2/internal/config/config_v8.go#L64-L69)) | **Different shape**: v8 stores "groups with keys" ([config.example.yaml#L1249](https://github.com/router-for-me/CLIProxyAPI/blob/355fd10e76b82e03ba6625acc583b900286e4bf2/config.example.yaml#L1249), group format from [L499](https://github.com/router-for-me/CLIProxyAPI/blob/355fd10e76b82e03ba6625acc583b900286e4bf2/config.example.yaml#L499)). v8 GET injects `auth_index` ([config_v8.go#L67](https://github.com/router-for-me/CLIProxyAPI/blob/355fd10e76b82e03ba6625acc583b900286e4bf2/internal/api/handlers/management/config_v8.go#L67)). There is **no per-key DELETE**: "Paths identify YAML keys, never array indexes. Lists are replaced whole" ([L125](https://github.com/router-for-me/CLIProxyAPI/blob/355fd10e76b82e03ba6625acc583b900286e4bf2/internal/api/handlers/management/config_v8.go#L125)). | **NEEDS-CODE-CHANGE** (largest): group mapping, whole-list replace with `If-Match` |
| 22 | GET/PUT `/openai-compatibility`, DELETE `?name=`, PATCH `{name, value}` | `src/lib/providers/custom-provider-sync.ts:75,127`; `src/app/api/custom-providers/[id]/route.ts:195,331,344`; `src/app/api/custom-providers/reorder/route.ts:112,143`; `src/lib/providers/api-key-ops.ts:264,272`; `src/scripts/migrate-provider-ownership.ts:187` | `/config/api-keys/openai-compatibility` (same `v8KeyFamilies` table) | Same as #21 (group shape, whole-list replace, no per-entry DELETE/PATCH) | **NEEDS-CODE-CHANGE** |
| 23 | GET/PUT `/api-keys` (client keys, string array) | `src/lib/api-keys/sync.ts:94`; `src/app/api/admin/migrate-api-keys/route.ts:44`; `src/lib/config-sync/generate-bundle.ts:180` | `/config/access/api-keys` (`api-keys` → `access.api-keys`, config_v8.go#L76) | Raw array body; migrates layout. Shape expected to match (not verified at runtime). | **NEEDS-CODE-CHANGE** (path only, but migrates) |
| 24 | PATCH `/plugins/:id/enabled` `{enabled}`; GET/PATCH `/plugins/:id/config` | `src/components/settings/plugin-settings.tsx:182` and `:132,148` (via proxy) | **No v8 route** (v8 has only list/delete/store/install/quota, L56-L62). Inferred equivalent: PATCH `/config/plugins/configs/<id>` with `{"enabled": …}`. v0 `PatchPluginEnabled` only edits `plugins.configs.<id>.enabled` and saves ([plugins.go#L218-L251](https://github.com/router-for-me/CLIProxyAPI/blob/355fd10e76b82e03ba6625acc583b900286e4bf2/internal/api/handlers/management/plugins.go#L218-L251)). | Unverified: whether v8 validation or the plugin host reload treats a raw config PATCH the same as the dedicated handler | **MUST-STAY-V0** until runtime-checked |

Allowlisted in the proxy but called by no dashboard code (no migration needed; drop or remap with the
allowlist): `request-error-logs`, `request-error-logs/<name>`, `request-log-by-id/<id>`,
`model-definitions/<ch>`, `auth-files/{models,download,fields}`, `oauth-excluded-models`, `vertex/import`
(`src/app/api/management/[...path]/route.ts:43-115`). Their v8 equivalents exist:
`/observability/logs/errors[/:name]`, `/observability/logs/requests/:id`,
`/routing/model-definitions/:channel`, `/credentials/{models,download,fields}`,
`/config/oauth/excluded-models`, `/oauth/import?provider=vertex`.

Not management calls (version-agnostic, no change): proxy root health checks
`src/app/dashboard/page.tsx:44`, `src/app/api/health/route.ts:34`; host extraction in
`src/lib/config-generators/opencode.ts:18-38`.

## 5. Recommendation

**Minimum-risk answer: nothing has to move, and nothing gains much by moving today.** Rows 1–12 are
path-only moves to the same upstream handlers, so they are safe on any v8.0.x server. They help only by
shrinking the v0 surface, and they break v7 servers unless gated. Upstream still fixes v0 handlers that share
code with v8 (v8.0.30), and nothing signals a removal.

Suggested order, smallest first:

1. **Gate, don't guess.** Add one capability check based on `X-CPA-VERSION`, which every authenticated
   management response already carries (v7 and v8), modeled on the existing `X-CPA-SUPPORT-PLUGIN` reader
   (`src/lib/plugin-store.ts:5-9`). The base URL stays `…/v0/management`, so `install.sh:405-408` and the
   compose defaults need no change yet. Derive the v8 base with `getProxyBaseUrl()`.
2. **Optional slice A (rows 1–12, path-only).** Do it only to retire v0 usage. Put the v0→v8 path map in one
   place: the `[...path]` proxy for client calls, plus `management-url.ts` for server calls. Fall back to v0
   when the server is older than v8.0.0.
3. **Slice B, the first one worth doing (row 16):** `config.yaml` read-merge-write over
   `/v8/management/config.yaml` with `If-Match`, retried on 412. Do it after bumping the pin to ≥ v8.0.31
   (`infrastructure/docker-compose.yml:39`, `docker-compose.local.yml:29`). It fixes lost updates between the
   config page, plugin settings and the usage collector's retention write, which upstream will not fix on v0.
   Accepted side effect: the file becomes v8 layout on first save. That is already supported since #246.
4. **Slice C:** config field writes (rows 17–20, 23) via `PATCH /config/<v8 path>`, reusing `V8_PATHS`.
5. **Slice D, last:** provider-key CRUD (rows 21–22) and the `GET /config` readers (row 15). They need new
   group-shape mapping and whole-list replace, ideally under `If-Match`.

**Trigger conditions for the full switch** (set the base URL to `/v8/management` and relax the `install.sh`
validator):

- The project declares a minimum CLIProxyAPI version (≥ v8.0.0, or ≥ v8.0.31 for ETag) and enforces it: the
  updater tag filter (`src/app/api/update/check/route.ts:176`), `UpdateProxySchema`, and an `X-CPA-VERSION`
  check for `install.sh`'s existing-server mode.
- Slices C and D are done (no remaining v0-only shapes). Row 24 (plugin enable/config) is runtime-checked on
  a v8 config path, or upstream adds a v8 route for it.
- Or upstream forces it: a `Deprecation`/`Sunset` header, a release note announcing v0 removal, or a v0 route
  breaking. None of these is present as of v8.0.31 / `main` `e7003d2a` / `dev` `088e4457`.

**Drop from #254:** the trigger "upstream ships a quota replacement in v8". The dashboard does not use
upstream `/quota/*`, and its quota calls (`api-call`, `auth-files`) are row 1 and row 5.

## Appendix: remaining hardcoded `/v0/management` (non-research files @22ba244)

The base URL default: `dashboard/src/lib/management-url.ts:3`.

Config and infrastructure:

- `install.sh:402-408` (validator), `install.sh:859`
- `infrastructure/docker-compose.yml:167`, `docker-compose.local.yml:130`
- `dashboard/Dockerfile:23`, `.github/workflows/ci.yml:30`
- `infrastructure/scripts/verify-management-auth-url.sh:13-20`
- `infrastructure/config/config.example.yaml`

Docs:

- `docs/CONFIGURATION.md`, `docs/ENV.md`, `docs/INSTALLATION.md`
- `infrastructure/docs/ufw-setup.md`, `infrastructure/docs/USAGE_COLLECTION.md`

Comments only: `dashboard/src/app/api/health/route.ts:32`, `dashboard/src/lib/routing-strategies.ts:3`.

Tests that assert v0 URLs:

- `management-proxy.test.ts`, `oauth-callback.test.ts`
- `proxy/status/route.test.ts`, `quota/route.test.ts`, `usage/collect/__tests__/route.test.ts`
- `oauth-providers.test.ts`, `management-url.test.ts`, `routing-strategies.test.ts`
- `opencode.test.ts`, `plugins.test.ts`
