# CLIProxyAPI plugin management API (research)

Status: research for #253, implemented on branch `fix/cliproxyapi-v8-followups`. Date 2026-10-15. Everything below was read in the Go source of
**v8.0.29** (`5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3`, same SHA as in
[cliproxyapi-upstream-api-drift.md](./cliproxyapi-upstream-api-drift.md)). The key claims were then runtime-checked; see [Verification](#verification-2026-10-15).

Source abbreviations (every link is pinned to that SHA):

- **CPA**: `https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/`
- **MGMT**: `CPA` + `internal/api/handlers/management/`
- **DASH**: this repo at `680a8c7ba0f1f0bdb8661f63fea3cdf43278d535`

Routes live in the `/v0/management` group, behind the normal management-key middleware
([server_management.go#L28-L46](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/server_management.go#L28-L46)).
A v8 alias set also exists: `/v8/management/plugins`, `/plugins/store`, `/plugins/store/:id/install`, and `DELETE /plugins/:id`. It has **no** enable or config routes
([server_management_v8.go#L56-L62](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/server_management_v8.go#L56-L62)).

Common rules:
- `:id` must match `^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$`. Otherwise the response is **400** `{"error":"invalid_plugin_id","message":"invalid plugin id"}` ([plugins.go#L504-L511](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/handlers/management/plugins.go#L504-L511), [pluginhost/platform.go#L17](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/pluginhost/platform.go#L17)).
- Error bodies are usually `{"error":"<code>","message":"<text>"}`. The exception is `persistLocked`/`saveConfigAndSnapshotLocked` save failures, which return only `{"error":"failed to save config: …"}` ([handler.go#L184-L190](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/handlers/management/handler.go#L184-L190), [#L416-L430](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/handlers/management/handler.go#L416-L430)).
- **All display strings are HTML-escaped on the server** (`html.EscapeString`). This includes ids, names, logos, descriptions, URLs and enum values ([htmlsanitize.go#L13-L15](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/htmlsanitize/htmlsanitize.go#L13-L15)). The test feeds `"logo": "<svg onload=alert(1)>"` and expects `&lt;svg…` back ([plugin_store_test.go#L240](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/handlers/management/plugin_store_test.go#L240), [#L271](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/handlers/management/plugin_store_test.go#L271)).
- Every management response carries the header `X-CPA-SUPPORT-PLUGIN: 1|0`. `0` means the binary was built without cgo and cannot load plugins ([handler.go#L276](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/handlers/management/handler.go#L276), [support_nocgo.go#L1-L5](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/pluginhost/support_nocgo.go#L1-L5), [loader_unsupported.go#L9-L11](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/pluginhost/loader_unsupported.go#L9-L11)). The upstream Dockerfile builds with `CGO_ENABLED=1` ([Dockerfile#L17](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/Dockerfile#L17)).

---

## 1. Routes

### GET /plugins

No body and no query params. **200** `{plugins_enabled: bool, plugins_dir: string, plugins: Entry[]}`. Entries are sorted by id ([plugins.go#L21-L65](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/handlers/management/plugins.go#L21-L65), [#L138-L160](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/handlers/management/plugins.go#L138-L160)).

| Entry field | Type | Meaning / source |
|---|---|---|
| `id`, `path` | string | `path` = file found in `plugins.dir` (empty if only configured) |
| `configured` | bool | `plugins.configs.<id>` exists |
| `registered` | bool | plugin is **loaded** by the host |
| `enabled` | bool | `plugins.configs.<id>.enabled` (false for unconfigured files) |
| `effective_enabled` | bool | `plugins_enabled && enabled && registered` ([#L146](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/handlers/management/plugins.go#L146)) |
| `supports_oauth`, `oauth_provider` | bool, string | **the provider/OAuth marker** (registered plugins only) |
| `supports_quota`, `quota_provider` | bool, string (omitempty) | quota capability |
| `logo` | string | `Metadata.Logo` |
| `config_fields` | `{default:any, name, type, enum_values:string[], description}[]` | form schema, always an array |
| `menus` | `{path, menu, description}[]` | plugin management pages |
| `metadata` | `{name, version, author, github_repository, logo, config_fields}` or **null** | null unless registered |

The capability, logo, config_fields and metadata fields are filled **only for registered (loaded) plugins** ([#L121-L136](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/handlers/management/plugins.go#L121-L136)). Errors: **500** `plugin_directory_invalid` and **500** `plugin_discovery_failed` ([#L87-L98](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/handlers/management/plugins.go#L87-L98)).

### GET /plugin-store

No body and no query params. **200** `{plugins_enabled, plugins_dir, sources: {id,name,url}[], source_errors?: {source_id,source_name,source_url,message}[], plugins: StoreEntry[]}` ([plugin_store.go#L27-L83](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/handlers/management/plugin_store.go#L27-L83)).

| StoreEntry field | Type | Notes |
|---|---|---|
| `store_id` | string | `"<source_id>/<id>"` |
| `source_id`, `source_name`, `source_url` | string | `official` = built-in registry ([registry.go#L14-L16](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/pluginstore/registry.go#L14-L16)) |
| `id`, `name`, `description`, `author`, `repository` | string | from registry.json |
| `version` | string | latest GitHub release if known, else the registry `version` ([#L173-L179](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/handlers/management/plugin_store.go#L173-L179)) |
| `install_type` | string | `github-release` (default when unset) or `direct` ([registry.go#L261-L267](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/pluginstore/registry.go#L261-L267)) |
| `auth_required`, `auth_configured` | bool | the registry needs `plugins.store-auth` |
| `platforms` | `{goos,goarch}[]` (omitempty) | **only for `direct`**, nil for `github-release` ([registry.go#L342-L361](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/pluginstore/registry.go#L342-L361)) |
| `logo`, `homepage`, `license` | string (omitempty) | |
| `tags` | string[] (omitempty) | free-form, e.g. `["provider"]` in the fixture ([plugin_store_test.go#L1275-L1290](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/handlers/management/plugin_store_test.go#L1275-L1290)) |
| `installed`, `installed_version`, `path` | bool, string, string | local file state |
| `installed_source_id`, `install_source_status` | string (omitempty) | `matched` / `different` / `unknown` / `assumed` ([#L783-L797](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/handlers/management/plugin_store.go#L783-L797)) |
| `configured`, `registered`, `enabled`, `effective_enabled` | bool | same meaning as in `/plugins` |
| `update_available` | bool | |

No store field marks an OAuth/provider plugin. Only `tags` hints at it, and the authoritative
`supports_oauth`/`oauth_provider` appear in `GET /plugins` after the plugin loads. Errors: **500**
`plugin_directory_invalid`, **500** `plugin_store_source_invalid`, **500** `plugin_discovery_failed`, and **502**
`plugin_store_registry_failed`. The 502 is returned only when *every* source failed. Partial failures go to `source_errors` and still return 200 ([#L120-L142](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/handlers/management/plugin_store.go#L120-L142)).
The listing calls GitHub `releases/latest` for installed `github-release` plugins only. Results are cached for 1 h (30 s after a failure), with at most 2 lookups in flight ([plugin_store_release.go#L13-L17](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/handlers/management/plugin_store_release.go#L13-L17), [plugin_store.go#L148-L160](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/handlers/management/plugin_store.go#L148-L160)).

### POST /plugin-store/:id/install

Request: query `?source=<source_id>` (optional; required when several sources list the id) and `?version=<v>` (optional).
The optional JSON body is `{"version":"1.2.3"}`. If both query and body set a version, they must agree, otherwise **400** `invalid_request` ([plugin_store.go#L98-L100](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/handlers/management/plugin_store.go#L98-L100), [#L446-L470](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/handlers/management/plugin_store.go#L446-L470)). Without a version, a `github-release` plugin installs the **latest release** ([install.go#L47-L66](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/pluginstore/install.go#L47-L66)).

**200** `{status:"installed", source_id, source_name, source_url, id, version, install_type, path, plugins_enabled: bool, restart_required: false}`. `restart_required` is hard-coded `false` ([#L85-L96](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/handlers/management/plugin_store.go#L85-L96), [#L307](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/handlers/management/plugin_store.go#L307), [#L351-L362](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/handlers/management/plugin_store.go#L351-L362)).

| Status | `error` | When (source) |
|---|---|---|
| 400 | `invalid_plugin_id` / `invalid_request` | bad id; bad body or version conflict ([#L226-L234](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/handlers/management/plugin_store.go#L226-L234)) |
| 404 | `plugin_store_source_not_found` / `plugin_not_found` | unknown `?source`; id missing from the registry ([#L592-L636](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/handlers/management/plugin_store.go#L592-L636)) |
| 409 | `plugin_store_source_required` (+`sources[]`) | id exists in more than one source ([#L637-L644](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/handlers/management/plugin_store.go#L637-L644)) |
| 409 | `plugin_store_installed_source_unknown` / `plugin_store_source_conflict` | reinstall from a different/unverifiable source ([#L799-L832](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/handlers/management/plugin_store.go#L799-L832)) |
| 409 | `plugin_update_requires_restart` (+`restart_required:true`) | Windows only: overwriting a loaded DLL ([#L284-L291](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/handlers/management/plugin_store.go#L284-L291), [install.go#L576-L578](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/pluginstore/install.go#L576-L578)) |
| 429 | `plugin_store_rate_limited` (+`retry_after` s, `retry_at` RFC3339, `Retry-After` header) | GitHub rate limit ([#L409-L423](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/handlers/management/plugin_store.go#L409-L423)) |
| 502 | `plugin_store_registry_failed` / `plugin_manifest_invalid` | registry fetch failed; unknown direct version or install type ([#L265-L279](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/handlers/management/plugin_store.go#L265-L279)) |
| 502 | `plugin_install_failed` | download, checksum, zip or **missing build for this OS/arch** ([#L292](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/handlers/management/plugin_store.go#L292)) |
| 500 | `plugin_directory_invalid` / `plugin_store_source_invalid` | config problems before download |
| 500 | `plugin_manifest_failed` / `config_unavailable` / `config_update_failed` / `config_save_failed` (+`path`) | **the file is already on disk** but config was not updated ([#L295-L336](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/handlers/management/plugin_store.go#L295-L336)) |

Side effects:
- Writes `<plugins.dir>/<goos>/<goarch>/<id>-v<version>.<so|dylib|dll>` atomically. A byte-identical file is skipped ([install.go#L243-L316](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/pluginstore/install.go#L243-L316), [#L371-L373](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/pluginstore/install.go#L371-L373), [#L508-L517](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/pluginstore/install.go#L508-L517)). The zip must contain `<id>.<ext>` or `<id>-v<ver>.<ext>` ([#L318-L320](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/pluginstore/install.go#L318-L320)). The default `plugins.dir` is `plugins`, relative to the CWD ([plugin_path.go#L14-L33](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/config/plugin_path.go#L14-L33)). In Docker that is `/CLIProxyAPI/plugins` ([Dockerfile#L29](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/Dockerfile#L29)).
- config.yaml: sets `plugins.configs.<id>.enabled: true` and `plugins.configs.<id>.store: <manifest>`, keeping the other keys. The manifest uses the kebab keys `id`, `version`, `release-tag`, `source-id`, `source-url`, `install`, … ([#L491-L516](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/handlers/management/plugin_store.go#L491-L516), [manifest.go#L9-L25](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/pluginstore/manifest.go#L9-L25)). Saved in the legacy layout (v0 routes pass `ConfigV8ContextKey=false`).
- **Global `plugins.enabled` is not touched, and install works while it is `false`.** The test installs with `enabled: false`, then asserts 200, `plugins_enabled:false`, the file written, per-plugin enabled `true` and global still `false` ([plugin_store_test.go#L778-L782](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/handlers/management/plugin_store_test.go#L778-L782), [#L829-L859](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/handlers/management/plugin_store_test.go#L829-L859)).
- Activation is a **hot reload**. An async `ApplyConfig` loads the plugin if global `plugins.enabled` is true, and detaches everything if it is false ([#L337-L340](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/handlers/management/plugin_store.go#L337-L340), [handler.go#L194-L240](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/handlers/management/handler.go#L194-L240), [pluginhost/host.go#L205-L236](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/pluginhost/host.go#L205-L236)). The 200 is sent before loading finishes, so poll `GET /plugins` for `registered`.

### DELETE /plugins/:id

No body. **200** `{status:"deleted", id, path, file_deleted: bool, configured_removed: bool, restart_required: false}` ([plugins.go#L404-L411](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/handlers/management/plugins.go#L404-L411)).
It removes the file **and the whole `plugins.configs.<id>` subtree**, so the user's plugin settings are lost ([#L374-L399](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/handlers/management/plugins.go#L374-L399)). A loaded plugin is unloaded first, then the response hot-reloads.
Errors: **404** `plugin_not_found` (no file and no config); **409** `plugin_delete_requires_restart` (+`restart_required:true`) when unload fails ([#L360-L372](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/handlers/management/plugins.go#L360-L372)); **500** `plugin_directory_invalid`, `plugin_discovery_failed`, `plugin_delete_failed`; **500** `config_save_failed` (+`file_deleted`, `path`).

### PATCH /plugins/:id/enabled

Body `{"enabled": true|false}` (required). Otherwise **400** `{"error":"invalid_body","message":"enabled is required"}`.
It writes only `plugins.configs.<id>.enabled` and keeps the other keys. **200** `{"status":"ok"}`, then an async hot reload ([plugins.go#L217-L251](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/handlers/management/plugins.go#L217-L251)). There is **no existence check**: any valid id creates a config entry. Other errors: **400** `invalid_config`, **500** `{"error":"failed to save config: …"}`.

### GET / PUT / PATCH /plugins/:id/config

- **GET**: **200** returns the raw `plugins.configs.<id>` YAML as a JSON object. That includes `enabled`, `priority`, the `store` manifest and plugin keys. The response is `{}` when the plugin is unconfigured but loaded or present on disk, and **404** `plugin_not_found` otherwise; **500** `plugin_config_encode_failed`/`plugin_directory_invalid`/`plugin_discovery_failed` ([plugins.go#L163-L215](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/handlers/management/plugins.go#L163-L215)). Values are *not* HTML-escaped.
- **PUT**: the body must be a JSON object. It **replaces** the subtree. Omitting `enabled` disables the plugin, because a missing value decodes to `false` ([config_types.go#L53-L61](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/config/config_types.go#L53-L61)). Omitting `store` drops the version pin and source tracking. Test example: `{"enabled":true,"priority":7,"mode":"fast"}` ([plugins.go#L253-L279](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/handlers/management/plugins.go#L253-L279), [plugins_test.go#L472-L487](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/handlers/management/plugins_test.go#L472-L487)).
- **PATCH**: shallow merge; `null` deletes a key; nested objects and arrays are replaced whole. Example `{"mode":"fast","remove":null,"count":3}` ([plugins.go#L281-L321](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/handlers/management/plugins.go#L281-L321), [plugins_test.go#L507-L522](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/handlers/management/plugins_test.go#L507-L522)).
- PUT and PATCH: **200** `{"status":"ok"}` followed by an async hot reload ([handler.go#L416-L430](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/handlers/management/handler.go#L416-L430)). **400** `invalid_body` (not an object, or unsupported value) or `invalid_config`; **500** `{"error":"failed to save config: …"}`. No existence check.

## 2. Platform / arch selection

| Install type | Asset picked | No build for host (e.g. linux/arm64) |
|---|---|---|
| `github-release` (default) | release asset named exactly `<id>_<version>_<GOOS>_<GOARCH>.zip`, plus `checksums.txt` ([github.go#L330-L358](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/pluginstore/github.go#L330-L358)) | **502** `plugin_install_failed`, message `release asset <id>_<ver>_linux_arm64.zip not found` |
| `direct` | `install.artifacts[]` entry with matching `goos`/`goarch` ([direct.go#L11-L24](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/pluginstore/direct.go#L11-L24)) | **502** `plugin_install_failed`, message `artifact not found for linux/arm64` |

GOOS/GOARCH are the server's `runtime.GOOS/GOARCH` ([plugin_store.go#L221-L223](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/handlers/management/plugin_store.go#L221-L223)). Aliases `x86_64`/`x64` map to `amd64`, `aarch64` to `arm64`, and `macos`/`osx` to `darwin` ([registry.go#L374-L392](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/pluginstore/registry.go#L374-L392)).
Nothing is written on these failures: the error comes before any file or config write. The dashboard can pre-check compatibility only for `direct` plugins (`platforms`). For `github-release` plugins the result is known only after the install attempt.

## 3. Global `plugins.enabled` switch

- **There is no dedicated v0 endpoint.** The v0 routes are exactly the ones listed above. `PATCH /plugins/:id/enabled` explicitly does not touch the global flag ([plugins.go#L217](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/handlers/management/plugins.go#L217), [config.example.yaml#L1166-L1169](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/config.example.yaml#L1166-L1169)). Default `false`, with the note "trusted in-process code" ([#L1158](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/config.example.yaml#L1158)).
- There are two ways to set it:
  1. `PUT /config.yaml` with the full edited file ([config_basic.go#L167-L180](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/handlers/management/config_basic.go#L167-L180)).
  2. `PATCH /v8/management/config/plugins/enabled` with body `true`. The v8 config paths mirror the YAML tree, and only `plugins/auth-revision` is read-only ([server_management_v8.go#L21-L28](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/server_management_v8.go#L21-L28), [config_v8.go#L145-L160](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/handlers/management/config_v8.go#L145-L160)). **But any v8 write migrates config.yaml to the v8 layout.** The test case "v8 plugin" expects `migrated: true` ([config_v8_test.go#L282-L285](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/handlers/management/config_v8_test.go#L282-L285)). That triggers drift finding #4 (legacy-key edits silently dropped).
- **Hot-reloaded, no restart needed.** `PUT /config.yaml` writes the file. The file watcher then calls `applyWatcherConfigUpdate`, and the chain ends in `pluginHost.ApplyConfig` ([service_lifecycle.go#L202](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/sdk/cliproxy/service_lifecycle.go#L202), [service_config.go#L177-L215](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/sdk/cliproxy/service_config.go#L177-L215), [service_plugins.go#L100-L138](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/sdk/cliproxy/service_plugins.go#L100-L138)). Turning it off unloads every plugin ([host.go#L226-L235](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/pluginhost/host.go#L226-L235)).
- `GET /config` serialises the whole config ([config_basic.go#L26-L32](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/api/handlers/management/config_basic.go#L26-L32)), so it **does** include `plugins: {enabled, dir, store-sources?, store-auth?, auth-revision?, configs: {<id>: {enabled?, priority?}}}`. Plugin-specific keys and `store` are `json:"-"` and are missing from it ([config.go#L41-L42](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/config/config.go#L41-L42), [config_types.go#L28-L51](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/config/config_types.go#L28-L51)). The simpler read is `plugins_enabled` from `GET /plugins` or `GET /plugin-store`.

## 4. Logo and ConfigFields metadata

Both are defined in `sdk/pluginapi` ([types.go#L23-L71](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/sdk/pluginapi/types.go#L23-L71)):

- `Logo string` is documented only as "a plugin-provided display asset reference". No format is enforced: it may be a URL or inline markup, and it arrives HTML-escaped.
- `ConfigField{Name, Type, Default any, EnumValues []string, Description}`. `Type` is one of `string`, `number`, `integer`, `boolean`, `enum` (uses `enum_values`), `array` or `object`. **There is no `secret`, `required`, `select`, label or validation attribute.** `name` is the key under `plugins.configs.<id>`. `default` is the value the plugin uses when the key is omitted.
- The schema is available only from the **loaded** plugin (`GET /plugins`). The store registry has no config schema ([registry.go#L39-L53](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/pluginstore/registry.go#L39-L53)).

## 5. Security

- Plugins are native shared libraries `dlopen`ed into the CLIProxyAPI process, so they run with full process rights. Install **downloads a binary that will execute** once enabled ([loader_unix.go#L1-L8](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/pluginhost/loader_unix.go#L1-L8), [config.example.yaml#L1158](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/config.example.yaml#L1158)).
- Integrity is checked by **SHA-256 only, with no signatures**. `github-release` installs compare against `checksums.txt` from the *same release*, so the check guards against corruption, not a compromised publisher ([install.go#L116-L135](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/pluginstore/install.go#L116-L135), [checksum.go#L34-L44](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/pluginstore/checksum.go#L34-L44)). `direct` installs check against the `sha256` in registry.json ([direct.go#L45-L55](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/pluginstore/direct.go#L45-L55), [registry.go#L303-L340](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/pluginstore/registry.go#L303-L340)). Trust therefore rests on the registry URL plus GitHub.
- Zip entries with absolute or backslash paths are rejected ([install.go#L375-L383](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/pluginstore/install.go#L375-L383)). Extra registries come from `plugins.store-sources`. The official registry is always included and fetched from `raw.githubusercontent.com` ([registry.go#L86-L111](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/internal/pluginstore/registry.go#L86-L111)).

## 6. Implications for the dashboard

Minimum safe UI:

| Feature | Call | Notes |
|---|---|---|
| Capability gate | read `X-CPA-SUPPORT-PLUGIN` | hide the whole section if `0` |
| Store list | `GET /plugin-store` | show `source_errors`; show `platforms` when present; badge `update_available` |
| Install | `POST /plugin-store/:id/install?source=<source_id>` | always pass `source`; handle 409/429/502 with the upstream `message`; then poll `GET /plugins` |
| Installed list | `GET /plugins` | show `effective_enabled` and `registered`, not just `enabled` |
| Enable/disable | `PATCH /plugins/:id/enabled {enabled}` | never PUT config for this |
| Uninstall | `DELETE /plugins/:id` | confirm dialog: the plugin's settings are deleted too |
| Global switch | edit `plugins.enabled` in YAML → `PUT /config.yaml` | avoid the v8 route (layout migration); warn that it loads native code |
| Settings form | `GET /plugins` `config_fields` + `PATCH /plugins/:id/config` | only once registered; never PUT (drops `enabled`/`store`) |

Gotchas:
1. **Plugin files are not persisted in our stack.** `/CLIProxyAPI/plugins` has no volume; only `config.yaml`, `/root/.cli-proxy-api` and logs are mounted ([DASH infrastructure/docker-compose.yml#L65-L68](https://github.com/itsmylife44/cliproxyapi-dashboard/blob/680a8c7ba0f1f0bdb8661f63fea3cdf43278d535/infrastructure/docker-compose.yml#L65-L68)). After `docker compose up` recreates the container, config still says `enabled: true` but the `.so` is gone. Mount a volume at `/CLIProxyAPI/plugins`, or set `plugins.dir: ~/.cli-proxy-api/plugins`, which lands on the existing auth volume and is what the upstream test uses.
2. Install succeeds with global `plugins.enabled: false` and reports `restart_required:false`, but nothing loads. The UI must surface `plugins_enabled`/`effective_enabled`.
3. Strings arrive **HTML-escaped**. React escapes again, so decode them (`&amp;` → `&`) before display. Render a `logo` only as an `<img src>` with a URL allowlist, never as HTML.
4. arm64 hosts: most `github-release` plugins may lack `linux_arm64` zips. The only signal is a 502 `plugin_install_failed` "release asset … not found".
5. GitHub rate limits apply and surface as 429 with `Retry-After`. A token can be supplied with `store-auth` type `github-token` ([config.example.yaml#L1193-L1197](https://github.com/router-for-me/CLIProxyAPI/blob/5fc580b1d72d87a7bcfe5cfb6f479c1aea5625b3/config.example.yaml#L1193-L1197)). The store listing itself only returns 502 when every source fails.
6. OAuth/provider plugins can be recognised only after loading (`supports_oauth`, `oauth_provider`). This feeds the drift finding #5 fix: build the provider list from `GET /plugins`.

## Verification (2026-10-15)

Runtime-checked against `eceasy/cli-proxy-api:v8.0.29` (digest `sha256:b98590c9…1eb6`) on a linux/arm64 host, legacy config layout:

| Claim | Result |
|---|---|
| `X-CPA-SUPPORT-PLUGIN` header | `1` on `GET /plugins` |
| Store | 124 entries, all `install_type: github-release`, no `platforms`; descriptions contain `&#39;`/`&#34;` entities |
| Install with `plugins.enabled: false` | 200, `.so` written to `/CLIProxyAPI/plugins/linux/arm64/`, `plugins.configs.<id>.enabled: true`, but `registered:false`, `effective_enabled:false` |
| No arm64 build | `cliproxyapi-copilot` → 502 `plugin_install_failed` "release asset cliproxyapi-copilot_0.3.3_linux_arm64.zip not found" |
| Global switch via `PUT /config.yaml` | 200; hot-reloaded in ~4 s: `gemini-cli` registered, `supports_oauth:true`, `oauth_provider:"gemini-cli"`; `zcode` exposes 2 `config_fields` |
| Container recreated, no volume | `.so` gone; plugin still listed as configured but `registered:false` |
| Container recreated, named volume on `/CLIProxyAPI/plugins` | plugin still registered |
| `PATCH /plugins/:id/enabled` | `{"enabled":false}` → 200 and unloads; `{"value":false}` → 400 `enabled is required`; an unknown id → 200 and creates a `plugins.configs.<id>` entry |
| `DELETE /plugins/:id` | 200 `{"configured_removed":true,"file_deleted":true,…}` |
