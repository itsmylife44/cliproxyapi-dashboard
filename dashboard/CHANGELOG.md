# Changelog

## [0.1.14](https://github.com/itsmylife44/cliproxyapi-dashboard/compare/dashboard-v0.1.13...dashboard-v0.1.14) (2026-02-16)


### Bug Fixes

* block SSRF redirect bypass in fetch-models endpoint ([#40](https://github.com/itsmylife44/cliproxyapi-dashboard/issues/40)) ([0e7f5ff](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/0e7f5ff73a300d444e45a89f073d1bce483a4b8e))

## [0.1.13](https://github.com/itsmylife44/cliproxyapi-dashboard/compare/dashboard-v0.1.12...dashboard-v0.1.13) (2026-02-15)


### Bug Fixes

* add CLIProxyAPI config.yaml generation and auth-dir for local setup ([9dea7a6](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/9dea7a667cc27889c9f2821a7e273765208ce002))

## [0.1.12](https://github.com/itsmylife44/cliproxyapi-dashboard/compare/dashboard-v0.1.11...dashboard-v0.1.12) (2026-02-15)


### Features

* add local setup for macOS/Windows/Linux via Docker Desktop ([#36](https://github.com/itsmylife44/cliproxyapi-dashboard/issues/36)) ([030f663](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/030f663f65c1a526d40b54ef1d28b20f83399b11))

## [0.1.11](https://github.com/itsmylife44/cliproxyapi-dashboard/compare/dashboard-v0.1.10...dashboard-v0.1.11) (2026-02-15)


### Bug Fixes

* remove custom provider credentials and redundant models from opencode config ([f736a3a](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/f736a3a41dc0dda545b2c3e68d7133ce731edc20))

## [0.1.10](https://github.com/itsmylife44/cliproxyapi-dashboard/compare/dashboard-v0.1.9...dashboard-v0.1.10) (2026-02-15)


### Bug Fixes

* use base URL directly for /models instead of hardcoding /v1 prefix ([b09349d](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/b09349d4ac4e15284c7721c3829deb9c0cad3d23))

## [0.1.9](https://github.com/itsmylife44/cliproxyapi-dashboard/compare/dashboard-v0.1.8...dashboard-v0.1.9) (2026-02-15)


### Features

* add model auto-discovery for custom providers ([#32](https://github.com/itsmylife44/cliproxyapi-dashboard/issues/32)) ([7eea262](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/7eea26210d1f43c457e65e48e93e9553a5dfdd2f))

## [0.1.8](https://github.com/itsmylife44/cliproxyapi-dashboard/compare/dashboard-v0.1.7...dashboard-v0.1.8) (2026-02-15)


### Features

* add real Kimi quota tracking via /v1/usages endpoint ([1f3dde0](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/1f3dde0e717e4a5376a04fec25ef0cc6c2f68ded))
* add real Kimi quota tracking via /v1/usages endpoint ([7ca9aaf](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/7ca9aaf19695c7a3df78bb31c2aeecf3305d877a))

## [0.1.7](https://github.com/itsmylife44/cliproxyapi-dashboard/compare/dashboard-v0.1.6...dashboard-v0.1.7) (2026-02-14)


### Bug Fixes

* use webhook for dashboard self-update instead of docker compose ([bf8333f](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/bf8333f978c0e2edea91da7896a0541557147acd))
* use webhook for dashboard self-update instead of docker compose ([0d87236](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/0d87236412ca83e5b5f0788acc884b24500ee9e4))

## [0.1.6](https://github.com/itsmylife44/cliproxyapi-dashboard/compare/dashboard-v0.1.5...dashboard-v0.1.6) (2026-02-14)


### Features

* use pre-built GHCR images instead of local Docker builds ([0ac6e70](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/0ac6e70c8dce8016cd6c799f29ea88d8933c03ef))
* use pre-built GHCR images instead of local Docker builds ([514242e](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/514242eeadee16b0c3e453d09b3bad6b4383b8ff))


### Bug Fixes

* remove misleading version parameter from dashboard update endpoint ([da32fc2](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/da32fc2fb433e9a4305eed7c8506453e984f1fa8))

## [0.1.5](https://github.com/itsmylife44/cliproxyapi-dashboard/compare/dashboard-v0.1.4...dashboard-v0.1.5) (2026-02-14)


### Bug Fixes

* **ci:** reliable Docker build trigger with output fallback and workflow_dispatch ([2e1ae2e](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/2e1ae2ef3e1559040a5f9cad363e6b903a4aa873))
* **ci:** reliable Docker build trigger with output fallback and workflow_dispatch ([e10b9c5](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/e10b9c5d8f276effd7ef806ae0a15881331fe8fe))

## [0.1.4](https://github.com/itsmylife44/cliproxyapi-dashboard/compare/dashboard-v0.1.3...dashboard-v0.1.4) (2026-02-14)


### Bug Fixes

* handle dashboard-v prefix in semver parsing for release tags ([d8e4109](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/d8e410972a542b64df4e18865bb32a4012625817))
* include docker-proxy in install script and deploy flow ([d3cdc97](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/d3cdc975466ddd25a0abba97b286cf80a16ccfe3))
* track all repo paths in release-please, not just dashboard/ ([46dbde0](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/46dbde01ad5556318c6e72f2ea92e9d491022694))

## [0.1.3](https://github.com/itsmylife44/cliproxyapi-dashboard/compare/dashboard-v0.1.2...dashboard-v0.1.3) (2026-02-14)


### Bug Fixes

* restore CLIProxyAPI proxy update routes alongside new dashboard update routes ([12b19b3](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/12b19b37e556ffaa42cb9dc5a759e2f6ebdf9597))

## [0.1.2](https://github.com/itsmylife44/cliproxyapi-dashboard/compare/dashboard-v0.1.1...dashboard-v0.1.2) (2026-02-14)


### Bug Fixes

* use no-store cache and versioned user-agent for GitHub API calls ([ac2ea02](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/ac2ea02b4c17161690e41c84d97d40f48acd11f9))

## [0.1.1](https://github.com/itsmylife44/cliproxyapi-dashboard/compare/dashboard-v0.1.0...dashboard-v0.1.1) (2026-02-14)


### Features

* add admin force logout all users control ([6a59a32](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/6a59a32c9e80623bae8e0cf8234161a181c8a7a6))
* add auto-update popup notification for admins ([1a34aea](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/1a34aeaece9a1ea682e71974f421c0a9b807cd3a))
* add auto-update popup notification for admins ([e0fe4df](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/e0fe4df0293c1a2a872c0610cac3e2e22707c359))
* add dashboard deployment via webhook from admin settings ([58ea76b](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/58ea76bc7061f6e16379aa803925dce91fd8fa9c))
* add iFlow, Kimi, and Qwen OAuth provider support ([4e3cb6e](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/4e3cb6e0c2ba37a18b656ab8712e402859d4959d))
* add iFlow, Kimi, and Qwen OAuth provider support ([765ecfe](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/765ecfef2302b17c609801b5bf33eda7610c4b27))
* add Kimi quota support and update provider docs ([56effd2](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/56effd2e0ae750d6b90cc9311a98659c3b1edec4))
* add logs viewer from PR [#1](https://github.com/itsmylife44/cliproxyapi-dashboard/issues/1) ([8cb4f18](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/8cb4f1887fd52fdeedba5f96ce0d4ea7de2864d5))
* add persistent usage tracking with per-user views and time filters ([d4e5a77](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/d4e5a773032856836d49e9379ff86ccd65027959))
* add provider key naming, fix OAuth ownership registration and ID anonymization ([1becf4c](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/1becf4c89022978bcf601eef5cb6e1d5601db93b))
* add qwen and iflow oauth provider support ([66f3bd3](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/66f3bd3b88393788d54f68d994fc3228cf743a4a))
* add qwen code and iflow oauth provider flows ([745fe7e](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/745fe7e1be67d2d4a13981d54ae11d0924df8f7b))
* add server-side session revocation with sessionVersion ([a929dc1](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/a929dc18ba74e336fa54a16024cd249ff29ee04c))
* add server-side session version revocation ([6ee5fe1](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/6ee5fe131ad02b87cc34c7344cfd4ad9f10d6f36))
* add variant, temperature, prompt_append, description to agent/category configs ([3c980a6](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/3c980a6bd3257bb79c4ce316d6de6136471732f4))
* allow non-admin users to view their own usage stats ([aeca2ee](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/aeca2eed0d5aa91c957850bc18dab29614f557b6))
* **api:** add custom provider CRUD endpoints ([fc658b1](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/fc658b1864eb76528910eb02665b91101456268e))
* **api:** add usage collector endpoint with deduplication ([786402e](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/786402e79887671686033c8752905c46563976ec))
* **api:** add usage history query endpoint with time filters and role-based access ([bd5a6fe](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/bd5a6fe17c4db145c8ca263e23c446cb067d44a0))
* **api:** expose background sync failures to users ([54f540c](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/54f540caa4a77f876908922303ef64120664367a))
* **api:** standardize error response format ([05231ab](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/05231abd756cb42ac1eedbf5a6e2d6847dd0d7b5))
* **config:** add environment variable validation ([614fba8](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/614fba8053b6eb22f81783968fd2d8cfe54a2be2))
* **config:** include custom providers in config generators ([4c54949](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/4c549496c5f28d347e31c94048af12d91a5554fa))
* Dashboard deployment via webhook from admin settings ([e4071c8](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/e4071c842c01173593199a8181ea8f0f84167960))
* **db:** add ConfigTemplate and ConfigSubscription models for config sharing ([630a10c](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/630a10c121f221fce9b1ef32fd716c6e2f9b2be7))
* **db:** add custom provider schema with model mappings ([0266152](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/02661523e74a94baef266bbf34ec4a90e3ce9ab2))
* **db:** add custom provider tables to entrypoint schema ([ac67b63](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/ac67b63a6d6960ab8bc28830ba6843b76ab011ed))
* **db:** add custom providers migration and update dev-local.sh ([be41200](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/be412002ef6edb3cd529f9c1af7e9978f6c7eeeb))
* **db:** add UsageRecord and CollectorState models for persistent usage tracking ([b4df4d0](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/b4df4d01d36d1027ae226250a82f2391cf7be5f1))
* **db:** add UserApiKey model and isAdmin field to User ([b070d56](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/b070d56aad40f0e66f093d941155e56e983254d9))
* enable usage page for all users with input/output token breakdown ([c25c3eb](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/c25c3eb43e232e2ff9ef91a67cd3f608307abdbb))
* improve quickstart generators and model selection UX ([cc00ab9](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/cc00ab922a62ce1b5948d09e16c0b1ef890f153e))
* improve settings and usage pages UI ([1a17b1b](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/1a17b1bb2162b72f6f6953dda6f2883562a28d36))
* **lib:** add share-code generation utility for config sharing ([a7f239d](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/a7f239de35a6be2e0630fbd50185f001730636be))
* move LSP config to oh-my-opencode generator ([b7fce5e](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/b7fce5ed54c36179c1da0fefe5d589c578aa350d))
* **observability:** implement structured logging with Pino ([e58271d](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/e58271dcc4d1183c68429ab7181241712f781896))
* parse Codex quota into graphical progress bars instead of raw JSON dump ([9c30ab8](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/9c30ab8583366ab77bd91fc8f59b33a801f630d4))
* per-user API keys, MCP persistence, admin user management, and local dev environment ([19bdd12](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/19bdd1286e2f9fa4fc371e84d39554720359fb83))
* per-user provider ownership, config sharing, and MCP type fixes ([d5f35c1](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/d5f35c1d7f33b62729376d51abde0917cc7f3ed6))
* **perf:** add pagination to admin APIs ([f70402b](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/f70402bdfebed58ff1039f875e54126a6f8ccef6))
* **perf:** implement in-memory LRU cache for expensive operations ([9cf9fce](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/9cf9fce64ca17142f913cccfbbd4b4d02d04bbb1))
* provider-grouped quota aggregation with weighted availability formula ([c2ec92f](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/c2ec92fc26828043953c5f9270cdddfbefa2c5e9))
* **quota:** replace weighted average with per-window capacity bars and long-term priority display ([2d30f6b](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/2d30f6b162f047225b8509777269c1225687049a))
* refresh app branding icons and favicon behavior ([875450c](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/875450c9faebf2a1977db5094f51f2574e3652f6))
* Release pipeline with GitHub Actions, GHCR, and Docker Socket Proxy ([#19](https://github.com/itsmylife44/cliproxyapi-dashboard/issues/19)) ([e1c2566](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/e1c2566d3c1bdf0cf14e3ffc9947f47807f090b4))
* **reliability:** add timeout handling to AsyncMutex fetch calls ([d190b47](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/d190b47103a16bb76e78dda0a76d03377a8d8bdf))
* reorganize quick start flows and assignment model selection ([66fc3c2](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/66fc3c2d6e4d1c635341a4f6218425cdcf763855))
* **security:** add path traversal protection to management proxy ([341904b](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/341904b2afc7ac10753c7039b8fd07157577cc8b))
* **security:** extend rate limiting to sensitive endpoints ([8e82fc7](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/8e82fc7b33528d75bb7c1b8df56fd87b7eb9a05e))
* **settings:** add OCX profile support note to setup instructions ([3dfba29](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/3dfba290cd042b9e2598ac7fcd551ef31cc91319))
* **setup:** show API key in modal after account creation ([6190960](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/6190960654c05850c1dd0fc3ab1039b95b0a0da2))
* sk-prefixed API keys, auto-populate sync token API key, HTTP MCP support ([c1fffd4](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/c1fffd42aeb0ae67b8bdc0eecd3e2df63bb56559))
* **ui:** add custom provider management interface ([ed1505f](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/ed1505f11cfccd950db5ccbbce0b3067982e6a9d))
* **ui:** rewrite usage page with persistent data, time filters, and admin/user views ([f065ade](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/f065ade0dc6dbe59146d64bf17860ec2b50316ce))
* **usage:** add COLLECTOR_API_KEY for external cron-based usage collection ([05d0dd9](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/05d0dd90d723e4a7126bd85160c42f459b2aa603))
* **usage:** deprecate live usage endpoint in favor of persistent DB tracking ([1002fa5](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/1002fa54e43a1b9f2da58417af4d591a5de96616))
* **validation:** standardize input validation with Zod ([98ce28e](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/98ce28e98ed0ac1c9e3089f3ae3d3c023d128ed2))


### Bug Fixes

* add build-time env placeholders for Next.js validation ([b7f5e29](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/b7f5e298285497e82e3b07fd22b7b59758714dd7))
* add container list reliability with timeout guard and error surfacing ([750de74](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/750de74136e6851858de4aa9b01d48aaf3817188))
* add missing migrations to bootstrap scripts ([891486c](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/891486c69bd8f77480663d52737609d46719dd60))
* add missing tables to entrypoint.sh for existing installs ([fde9f72](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/fde9f72197a6c6f96479ee3b610571567b073378))
* address Cubic code review feedback ([ece3dc0](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/ece3dc0d08d7f808186e7b7dfc9294b2e7354784))
* address Cubic code review findings ([cc6f717](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/cc6f717b89fe34888bc8f23c36312dc539bff799))
* address diffray code review issues ([8449b7f](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/8449b7f7c400f687340bb3885c8174f3039392ce))
* address oracle review findings ([f18fcd9](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/f18fcd9b2f3c596f87456c54d2869095ab9ad5c0))
* address remaining diffray code review issues ([6037f59](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/6037f5979eed3162877ad63af7664d9f8306a3b8))
* address second Cubic review round ([00ee5bc](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/00ee5bc36b0043b4464f0071cd9d2146c918e269))
* allow Next.js runtime inline scripts in production CSP ([0d350a9](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/0d350a9162bc5637ca4870f72c4971419ab068fb))
* allow non-admin OAuth management read endpoints ([101323a](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/101323aa327f0f1dbf5a215b8e6a5f9d8aa48f98))
* avoid long blocking qwen oauth callback polling ([597a8cc](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/597a8ccb260505ec02f5c50f73ce5655cdd69843))
* capture provider OAuth ownerships after successful callback ([8a63da4](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/8a63da4932f0f43a94c7f2b60b2e084515792d47))
* clear update state when auth fails or user is not admin ([4aeeb88](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/4aeeb8851278a5d0c49d76a2b75fc917342cb0a6))
* collapse non-admin usage to single owned key when only one key exists ([664a2f9](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/664a2f939e4d3408677c4981d388a3e66076cb2a))
* **config-sync:** await lastSyncedAt update for subscribers ([95fce89](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/95fce89bc356109a037015f90086e29e4b37233f))
* **config-sync:** use deterministic hash for stable version detection ([9de8edb](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/9de8edb8372a8822dd8aacf8918123083c6e6a31))
* connect logger to log-storage for UI display ([950120b](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/950120b9255c03fca1143aa050bccbd1b76ac069))
* **containers:** support dev container names via CLIPROXYAPI_CONTAINER_NAME env ([b44374e](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/b44374ed5301d353efe481840b0397b98864c62f))
* correct plugin config paths and add OCX profile setup in Config Sync instructions ([5748313](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/57483134fa49c962fdee4b24a7237777d38e3343))
* defer API_URL check to runtime so Docker build succeeds without env vars ([bfb5478](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/bfb547828e42df3ef631c19e88014c488116f45b))
* disable quota group drilldown and lock turbopack root ([398542d](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/398542d796a5b021f0f57b16c1cdd768ffd8c5c9))
* enforce admin-only system actions and handle null provider keys ([4a5b3de](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/4a5b3dee4a7a8a600554ae1e5691de894856a399))
* ensure DEFAULT_PLUGINS used when no saved plugins exist ([2ee8665](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/2ee86657c372ae95d7af0572b0f703b8dd10e821))
* ensure first model selection change triggers autosave ([cdc3f63](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/cdc3f63580a968ae8be2844551dad35ba3c34f29))
* **entrypoint:** add isAdmin column and user_api_keys table to DB bootstrap ([ed2cc98](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/ed2cc981c6062e4d2ec5cee1188afbdfd4861c02))
* fallback proxy update when compose is unavailable ([878eeba](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/878eebae37e8f7f33b93efcd20faa6c0e6384801))
* group usage by API key instead of endpoint ([2bd06df](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/2bd06df446c1abf57fc154eccdc882a101604ff6))
* handle 'completed'/'failed' status values from deploy script ([158bb16](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/158bb164160ba9c387427efbc781ae1a0ed495e1))
* harden dashboard security controls for session APIs ([1ce976c](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/1ce976c4efa0972581597b428c5c54d762d27fc7))
* honor x-forwarded headers in OAuth origin validation ([283d23a](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/283d23a0f1c43920a609b4264aae12474b4fd154))
* ignore null quota fractions in capacity calculations ([7d292d0](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/7d292d067330fbe7371af9d44aa260fa7542ae0a))
* include sessionVersion schema updates in bootstrap scripts ([5560be8](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/5560be8b2d9e5ce180147baa64b30e198d1bf7ae))
* include user source matching in non-admin usage filter ([82216de](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/82216de61e5c09280b4b316470ac455b552d4b4a))
* install workflow, dynamic paths, copy-to-clipboard, setup redirect ([e9ca497](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/e9ca49746c9bfb792bb1ff9b40b0ede35dc78a1e))
* keep proxy updates and dashboard deploy compose-managed ([aaca0ba](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/aaca0ba28098a9a2b8f40ba96179d2ce326c7153))
* **lint:** remove unused params and replace unsafe management any types ([c3f019b](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/c3f019b140109ed71ec4bcbbf0c530041cac2e7b))
* logger now stores logs in both dev and prod mode ([f171ad4](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/f171ad47e88703381ce898717ced044604d0edb5))
* make dashboard DB init SQL quoting robust ([53f055e](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/53f055eea6ccd6946ef21c1d3ac67d4ce69c37fd))
* make PROXY_URL configurable via CLIPROXYAPI_PROXY_URL env var ([c66ad4c](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/c66ad4c5640a1f724c69b8cc12ba3dd78488781e))
* match non-admin usage by oauth source identifiers ([bd8d89b](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/bd8d89b957eb8ade631340def122112471e838cb))
* minor code quality improvements ([aff2474](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/aff24743282ca1a58c5ff736560dae9c64e3de68))
* move pino dependencies to dashboard package ([07a326a](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/07a326afcc3f1fc031f93d576e37d5d5dc065f35))
* normalize deploy status payload and API response shape ([6e5b085](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/6e5b0853344b454c0004dd32b8f337f8322cae74))
* normalize opencode-cliproxyapi-sync to [@latest](https://github.com/latest) when loading saved plugins ([3a94a5b](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/3a94a5b4684ab1b5671fc18adb5404b950549ddc))
* **oauth:** use CLIPROXYAPI_MANAGEMENT_URL for callback base URL ([fee84aa](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/fee84aaa06601a36ef1a21d7e5e65d395a0fc058))
* pass proxyUrl as prop from server to client components instead of reading process.env in browser ([7a74441](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/7a74441effafce3ef3b6744a1be46db105b8e2e9))
* prevent grid row stretch when expanding quota cards (items-start) ([7084771](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/7084771494712351f3cd42d4209fd139c6133dcf))
* prevent quota crash for kimi accounts ([f02fde5](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/f02fde58b4703e5e2eafbfc2620744f88ca28ba2))
* prevent quota crash for missing account email ([b6e464f](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/b6e464fd8a01e14e95c7b7bed8db6bcfe73f4845))
* race conditions in provider key contribution, removal, and OAuth callback ownership ([85cb30f](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/85cb30f62ca2994e670fda595d0f6eda62239b78))
* rebalance quota capacity and tighten publisher settings density ([6409af7](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/6409af7d0de64249f6866eaf3f3eed2002eb130a))
* remove throw on missing API_URL, use empty string fallback for Docker compatibility ([e304378](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/e304378388bbe93d1df11fad3715ce24e475d6db))
* remove turbopack.root that broke CSS module resolution ([0527621](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/0527621216454f52e5214385ecc5f5353c985e85))
* replace next/image with plain img for logo icon in standalone/Docker mode ([726724b](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/726724bf45661098628abdf7f46ab68c3e3d7e27))
* resolve font preload warnings and missing icon/favicon 404 errors ([350bbbf](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/350bbbf47dfdc4131d30872d5e30a322247d6983))
* revert provider key naming, add name input to user API keys page ([805beff](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/805beff6153514d350e4bbc7e62d0243401532ea))
* robust origin validation with forwarded headers and normalized ports ([235e9ad](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/235e9ad78c0e39dc4a52a18382e9aed75611f28b))
* **security:** prevent race condition in setup wizard ([ee1c9e6](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/ee1c9e6b3263e08326eacd59a827bbbf5e80237e))
* **settings:** correct key name from plugins to plugin ([77b976d](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/77b976d95a6888451687e4a5ddd66f11553f7063))
* **settings:** correct plugin setup instructions - no npx install needed ([8e40958](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/8e40958961f3d18eeef54824ca40a6aa089c5c75))
* **settings:** use [@latest](https://github.com/latest) tag for plugin in setup instructions ([45d34ba](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/45d34ba31d4db40cd39d2e1edb4a91555131b129))
* **setup:** remove obsolete API key modal after account creation ([95850cd](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/95850cdd9f6e4f7e6dc38bda1b9d96f706e21ad7))
* show actual version instead of 'latest' in update popup ([40f0413](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/40f041319ddebe5d60099caa303fa7cd056c09ef))
* show days in quota reset time instead of only hours ([c740d10](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/c740d10e488ecb193cdb68780c49794461845377))
* stabilize quota account identifiers ([15b2df1](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/15b2df1c8885fd417e344e05a49d9e4dfe20c932))
* support oauth deletion by account id/name and admin owner visibility ([3e181c3](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/3e181c35cc5b0666f3a9e3554811a82eef0af004))
* **sync:** CLIProxyAPI PUT api-keys expects plain array, not object ([8c9ae4f](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/8c9ae4f7a44c2ed30272599ba073881cdc27f0d1))
* tmux config defaults not persisted when enabling via dashboard ([ed7b233](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/ed7b233beb0d0e6b3c86bc92ed269854a2c20966))
* **ui:** improve native dropdown and date/time contrast ([889692a](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/889692a8cd3a747a2508c1bf01f0f32a57f30c3a))
* unify model grouping logic across model selector and config generators ([2c43f4b](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/2c43f4ba29bbcf7a41215983f22422b5bc91911b))
* unify model grouping logic across model selector and config generators ([82ad3b1](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/82ad3b19e8b9f2b60fb3973285ecc34b269e5101))
* update lastSyncedAt timestamp when subscriber fetches config bundle ([39da9ff](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/39da9ff1e0e402f8f9f029731ee638a489a2ca20))
* usage API type guards to match actual CLIProxyAPI response format ([f9368b8](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/f9368b8fbe71f703dc6f5430c6694485069f90ae))
* usage page reads data.data instead of data.usage ([4318dd5](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/4318dd5411c921d9394aab687ac7994097f380d4))
* **usage:** group usage by apiKeyId/userId instead of authIndex to merge per-user entries ([b8a0711](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/b8a0711ea9d6540600c929719e2b59767f29753e))
* **usage:** resolve auth_index via /auth-files endpoint for robust user matching ([e7a189c](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/e7a189cf0402a29b25beb2271801c0d297ae6092))
* **usage:** resolve userId via source/OAuth matching instead of broken authIndex prefix ([464563c](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/464563c7ba7766e50089b9d5f845de550d328d56))
* **usage:** strict YYYY-MM-DD date validation, fix end-of-day boundary for to-date ([15aad00](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/15aad00567115e0680695327f45b885278151cba))
* **usage:** use local dates for filters, strict date validation, fetch timeout, reset recordsStored on error ([c55e6f4](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/c55e6f49653e268b7f34affecf8bb2fc3f06bfc4))
* use [@latest](https://github.com/latest) tag for opencode-cliproxyapi-sync in all default plugin lists ([3d9151a](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/3d9151a9d2a41d7c0273c6390e5aaf6a3f02ceb6))
* use [@latest](https://github.com/latest) tag in quick-start config section ([e938b32](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/e938b3235105159a8eb03eb989f7d16c6b57b290))
* use API_URL env variable for proxy URL instead of non-existent CLIPROXYAPI_PROXY_URL ([52f1db7](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/52f1db77c6a620650dd2881937de623d4aa9a7f4))
* use existing icon asset for apple metadata ([f85f520](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/f85f5209337b7e31b8b2d41bd19ecc45e86f42bf))
* use explicit tailwindcss/index.css for Turbopack compatibility ([1ed30d0](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/1ed30d0dd4b9353862e7cd339b5ed9919577c069))
* use explicit tailwindcss/index.css import path ([64c2881](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/64c28813fd602d6f39a4b7c0f98c617896e40113))
* use internal URL for server-side proxy model fetching ([2abd111](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/2abd1115c86f1bdbd6c37f49b0bb0d2486f9e9cd))
* use NextRequest type for validateOrigin compatibility ([12e1560](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/12e1560b4a1c67502dae14321ef4563b9534f40a))
* use proxy API key grouping for accurate user attribution in collector ([61f6811](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/61f6811e8a7162ed89e68c08e0addbcd79f52503))
* user list reads data.data instead of data.users ([d7ab516](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/d7ab5169e6da913889efce7d13f7fd2372f3cffb))


### Performance Improvements

* **db:** add composite index for provider key lookups ([03a0944](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/03a0944fb95e17e4cab63997fcb58ddfc8673ac8))
* **db:** add index on SyncToken.tokenHash ([4de8936](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/4de89364e7c3ba42e556ee781de87babf7d0cef2))
* **db:** optimize Prisma queries with select clauses ([a4638a7](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/a4638a7b9e2c8c367db50c12007c28c49db5e885))
