# Changelog

## [0.1.59](https://github.com/itsmylife44/cliproxyapi-dashboard/compare/dashboard-v0.1.58...dashboard-v0.1.59) (2026-03-27)


### Features

* **config:** add proxy-url validation and emergency recovery ([797fb6c](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/797fb6c8d033388b07b86c21522855c0b82ef375))
* **config:** restart CLIProxyAPI container after saving config ([5f5c7ac](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/5f5c7ace22a8ab408d2a5b73fd900e089537ee25))


### Bug Fixes

* **config:** preserve unmanaged fields on save via GET-then-merge ([2565aca](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/2565acac07e0f8eabb0337f179fceec2493476bf))
* **config:** retry on load failure and re-fetch after save ([5b0558d](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/5b0558dd03243f14f1c01fad11dd0dc57fb997f2))
* **config:** use deep merge to preserve nested unmanaged fields ([d8e1413](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/d8e1413e8cb1c2fc7c16a88beac427cc81dd2578))
* **db:** add slim_overrides column migration to agent_model_overrides ([4812b91](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/4812b91959de20fe8d9ab3c897049818304dcdf6))

## [0.1.58](https://github.com/itsmylife44/cliproxyapi-dashboard/compare/dashboard-v0.1.57...dashboard-v0.1.58) (2026-03-27)


### Features

* add oh-my-opencode-slim support with variant toggle ([#143](https://github.com/itsmylife44/cliproxyapi-dashboard/issues/143)) ([152dc42](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/152dc42e682f81eca90a1016ec18c1cffa544175))


### Bug Fixes

* enable NETWORKS in docker-socket-proxy for container update flow ([054275f](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/054275f0dfec697db3678481b8bbe947c6511cb1))
* **oauth:** use snapshot-diff for ownership claim instead of state-in-filename matching ([#142](https://github.com/itsmylife44/cliproxyapi-dashboard/issues/142)) ([a788d19](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/a788d19992f3e3f27f636524305b1552a19df09f))

## [0.1.57](https://github.com/itsmylife44/cliproxyapi-dashboard/compare/dashboard-v0.1.56...dashboard-v0.1.57) (2026-03-23)


### Features

* use models.dev as source for model context/output limits instead of hardcoded heuristics ([81ffcc0](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/81ffcc0024b504b0fda98df7f14f17aa4eb92578))


### Bug Fixes

* add latencyMs column to usage_records in entrypoint migration ([c13f5d0](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/c13f5d04107d232dd79219b3f9af84272ad2bb21))

## [0.1.56](https://github.com/itsmylife44/cliproxyapi-dashboard/compare/dashboard-v0.1.55...dashboard-v0.1.56) (2026-03-21)


### Features

* add global-error boundary and metadata title template ([54657d2](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/54657d2901b3a303a97e72ceba8146ac94341e27))
* **usage:** add latency tracking to usage records and enhance dashbo… ([#138](https://github.com/itsmylife44/cliproxyapi-dashboard/issues/138)) ([c56a657](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/c56a6573413bcd860c7e072989f913a4c9c1f421))


### Bug Fixes

* **quota:** avoid unknown display labels for inferred providers ([6eacdfb](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/6eacdfbc58159a574b78bbbce1239942264418ef))

## [0.1.55](https://github.com/itsmylife44/cliproxyapi-dashboard/compare/dashboard-v0.1.54...dashboard-v0.1.55) (2026-03-18)


### Bug Fixes

* improve PostgreSQL password auth error handling and documentation ([#135](https://github.com/itsmylife44/cliproxyapi-dashboard/issues/135)) ([1dbed04](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/1dbed043fd32079bdc45fbec6b390f744cbb9b78))
* **notifications:** mark header notifications as read on click ([3541586](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/3541586c98ebf8c88d345c655b5f2faf1a0ea024))
* **notifications:** persist dismissed header notifications ([6976715](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/69767155a01064d1cfc5892b474a86c7fb61cc8b))
* **quota:** infer provider for unknown auth file entries ([e121c21](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/e121c21c4e2db3dcf3d89d553e6790ba0db93a97))
* **quota:** normalize imported provider support mapping ([0de46ca](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/0de46cadb2f3c45a2b7d80004d55a6bde835bafc))

## [0.1.54](https://github.com/itsmylife44/cliproxyapi-dashboard/compare/dashboard-v0.1.53...dashboard-v0.1.54) (2026-03-08)


### Features

* notification bell and latency indicator in header ([#130](https://github.com/itsmylife44/cliproxyapi-dashboard/issues/130)) ([56d7196](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/56d719637c94196d6225601ecbbddb664be8dbe5))


### Bug Fixes

* add Gemini CLI quota support to dashboard ([#127](https://github.com/itsmylife44/cliproxyapi-dashboard/issues/127)) ([e3f6704](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/e3f6704584c3aba512c54980bc6ae96b6899dbb9))
* Claude OAuth quota fallback — handle 429, update model, parse unified headers ([a06327e](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/a06327ee827df20797973c25549a2204475c5929))
* remove git pull from deploy script to prevent update failures ([f9501f7](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/f9501f7ead9f0cf2f3acd9210859960189109a0e))
* retry Claude OAuth usage endpoint before falling back to messages ([a43522a](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/a43522a11a0f63ebce1fbfc04d593e00edc4fd73))
* use Sonnet model for quota fallback, parse 7d_sonnet unified header ([6cfc219](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/6cfc219fc906bdbae70e62e4929463f32af0bcaa))

## [0.1.53](https://github.com/itsmylife44/cliproxyapi-dashboard/compare/dashboard-v0.1.52...dashboard-v0.1.53) (2026-03-07)


### Features

* add admin force logout all users control ([012b8ee](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/012b8ee0ac23e7aa1b00d118475d232175f0b13d))
* add auto-update popup notification for admins ([dc3ade7](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/dc3ade741233edc2a6e83bbac6205bae7c1954b7))
* add auto-update popup notification for admins ([77ac83d](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/77ac83dcb0d7fd56a21ec2b2fdb240b638036422))
* add client-side pagination to logs page ([e61b268](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/e61b268da95837d0c7dc022e8c5ba78833d8cf9b))
* add CLIProxyAPIPlus, Copilot and Kiro providers support ([6dc06a0](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/6dc06a078777de94a7f8c30c4259b168a9fdccf8))
* add Copilot quota tracking and improve model grouping by provider ([01dcb6f](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/01dcb6f5cbecd0859bbee0041377d83da383fa47))
* add dashboard deployment via webhook from admin settings ([0da0cfa](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/0da0cfa67a5b7a117b2f55094c1ca619f0db0621))
* add dashboard UX improvements and Telegram quota alerts ([#108](https://github.com/itsmylife44/cliproxyapi-dashboard/issues/108)) ([6ec4da7](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/6ec4da766e51fb8893ee55896069aaabfca1ad77))
* add fullscreen update overlay with progress animation and auto-reload ([#97](https://github.com/itsmylife44/cliproxyapi-dashboard/issues/97)) ([0248de2](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/0248de28e057a0c5d47a828ca97da92717e68ee3))
* add get-status.sh and get-log.sh helper scripts for webhook ([c7bba14](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/c7bba149c7ca862f026425f3f59d3c6c4c82382a))
* add iFlow, Kimi, and Qwen OAuth provider support ([3e83485](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/3e83485b51583ae1a83fd2b719581f2bf2da8cc8))
* add iFlow, Kimi, and Qwen OAuth provider support ([68ea9b4](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/68ea9b4b6ca76e02d2c9b5ea72d0ae250ade4aaf))
* add Kimi quota support and update provider docs ([ca3cf4d](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/ca3cf4daf51a03f1d8a0f6e246aee58b4f9c18ed))
* add local setup for macOS/Windows/Linux via Docker Desktop ([14eadcc](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/14eadcc320d9cec2480e589942d0289538ef9f3c))
* add local setup for macOS/Windows/Linux via Docker Desktop ([#36](https://github.com/itsmylife44/cliproxyapi-dashboard/issues/36)) ([27bb36a](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/27bb36acc7fb8190c28c4a6453da110d4fe4112f))
* add logs viewer from PR [#1](https://github.com/itsmylife44/cliproxyapi-dashboard/issues/1) ([b5c2bf5](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/b5c2bf50db7cdaa72ad299133f3a77b43bc643ac))
* add missing Perplexity Pro web UI models to sidecar ([b606493](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/b6064930d3b860bfb08cde95285e587294ff3554))
* add model auto-discovery for custom providers ([#32](https://github.com/itsmylife44/cliproxyapi-dashboard/issues/32)) ([ffc0a9b](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/ffc0a9b5c72b5378d8db74bddaa856ec2943e5f3))
* add multi-arch Docker build (amd64 + arm64) for Apple Silicon support ([61d455c](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/61d455c4d9918c9ff11da91fd3137de3c1897edc))
* add OAuth account enable/disable toggle ([d6ad7ef](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/d6ad7ef4c2af78ff396b807a1230e1a6a410fc4e))
* add OAuth health status badges and fix alias model override priority ([ce1084a](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/ce1084ac24c6b09359505f88c936c5c6e6da34f9))
* add optional webhook deploy service installation to install.sh ([ea73737](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/ea7373761b80f87eeee4c40e0633f578f298f5a7))
* add Perplexity Pro sidecar with dashboard cookie management ([#54](https://github.com/itsmylife44/cliproxyapi-dashboard/issues/54)) ([69fc1a5](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/69fc1a5ebf6bfe5060a76aa1e7c8f5ee8bc25d78))
* add persistent dashboard header with live status pulse and user panel ([#99](https://github.com/itsmylife44/cliproxyapi-dashboard/issues/99)) ([46c86de](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/46c86de4e806a575a023441cefdcd873bf56f421))
* add persistent usage tracking with per-user views and time filters ([5cf088e](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/5cf088ec26033d0806136887f742c4047b82e2f4))
* add provider group management and priority ordering ([#84](https://github.com/itsmylife44/cliproxyapi-dashboard/issues/84)) ([a2d540b](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/a2d540b88f276e3623917bb7559b33b2f314be2b)), closes [#78](https://github.com/itsmylife44/cliproxyapi-dashboard/issues/78)
* add provider key naming, fix OAuth ownership registration and ID anonymization ([ac5a28b](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/ac5a28b43c153fbacd78ab2c193e4f0b3bd74696))
* add qwen and iflow oauth provider support ([b3fafeb](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/b3fafeb35044228fd2cbac8af2ff51d390e1d9ce))
* add qwen code and iflow oauth provider flows ([4f5ab3c](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/4f5ab3c2b3d89b270fdca289db46194986db7701))
* add real Kimi quota tracking via /v1/usages endpoint ([26523e8](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/26523e818fdbfb58daecc253098e3c206ffcadb7))
* add real Kimi quota tracking via /v1/usages endpoint ([1905012](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/1905012c0f03a27c6d98e5ee07a6d6d7561b0a46))
* add recharts visualizations to dashboard pages ([#106](https://github.com/itsmylife44/cliproxyapi-dashboard/issues/106)) ([850b389](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/850b389c30d6c431e7e7ccd3ec33f48beb9f0d11))
* add safe external Caddy mode to installer ([26481b5](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/26481b55949e90ccb651074c9f6486b8306c8cd6))
* add separate proxy update notification component ([21627df](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/21627df6de73d90f3325271ea186bebb15fd1b81))
* add server-side session revocation with sessionVersion ([4e75221](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/4e752212a0081fa38910d815f05f443d97d1046f))
* add server-side session version revocation ([317ae1e](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/317ae1e4c8be9533c8a408c2f0adccea26d0455f))
* add setup wizard with inline forms and sequential step locking ([12e597b](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/12e597b14dc6cdef48cf63aea5e3b086bee22eea))
* add variant, temperature, prompt_append, description to agent/category configs ([54e1a5f](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/54e1a5f1f4b1ff213e1fc30dc1c425b35e57e144))
* add Windows PowerShell dev-local script for local development ([6e812bb](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/6e812bb5865b0a9a55128060b85a37384c1d7412))
* allow non-admin users to view their own usage stats ([6fc67a3](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/6fc67a3fdf6437c11c3dca510674ed8101543ea2))
* **api:** add custom provider CRUD endpoints ([1379c57](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/1379c577ab9ca4144854539357b8ee2814320907))
* **api:** add usage collector endpoint with deduplication ([82dbe87](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/82dbe87bc68f0549644dfafab21abb0bf2d84bd5))
* **api:** add usage history query endpoint with time filters and role-based access ([5e8207c](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/5e8207ca07a96a73ad794fe5e4f32908f1af034e))
* **api:** expose background sync failures to users ([aeccd5f](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/aeccd5fc6458e8c24e5e27e587d922d310b0383b))
* **api:** standardize error response format ([6b333dc](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/6b333dcb41c3827ae6175e08bb54f9451d845373))
* apply advanced Tailwind CSS layout techniques across dashboard ([72c3673](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/72c3673e75abdf32a19f85d8a91e9643629b39be))
* **config:** add environment variable validation ([b21b630](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/b21b630f6c8198ec01cd2ba08fe5c72a787d2fab))
* **config:** include custom providers in config generators ([86b9106](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/86b9106f7383ce73979f25d6fa844d5ef9f7dbf9))
* Dashboard deployment via webhook from admin settings ([579acb4](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/579acb4e9e962d1527c5e80c52d8ada9c3e9e6f1))
* **db:** add ConfigTemplate and ConfigSubscription models for config sharing ([beda365](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/beda36544e5ac430fdbb19e6b15819f2545b869f))
* **db:** add custom provider schema with model mappings ([633cf60](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/633cf603c9544365a99ee83ce4020bea7db53e2b))
* **db:** add custom provider tables to entrypoint schema ([38e6c49](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/38e6c49391ca290046f7daead7df2382bed903cd))
* **db:** add custom providers migration and update dev-local.sh ([2ce880a](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/2ce880a999e9a62da591340261d132a4fa8df4e9))
* **db:** add UsageRecord and CollectorState models for persistent usage tracking ([3a3cf37](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/3a3cf37d97d13b83a876b32c780f6e562c8be49e))
* **db:** add UserApiKey model and isAdmin field to User ([f6ebfbb](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/f6ebfbbf336af36c966d45bc883eb8fa066bf660))
* enable usage page for all users with input/output token breakdown ([d358c6a](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/d358c6a021fcddb7e2207eabc84322ecc660de76))
* expose all CLIProxyAPIPlus config fields in dashboard ([#116](https://github.com/itsmylife44/cliproxyapi-dashboard/issues/116)) ([77c3083](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/77c30837f8b42151aaca50f011a4ed0f0c55f166))
* improve quickstart generators and model selection UX ([c835a0f](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/c835a0fbb1241d2758fafe9f2374625cd699eb33))
* improve settings and usage pages UI ([34e8670](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/34e867034590ddf587a8a16e6f57951d16173fda))
* **install:** auto-generate COLLECTOR_API_KEY and install usage collector cron job ([e46dcb1](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/e46dcb136f70326477ed71e9e92894e246a765f2))
* **lib:** add share-code generation utility for config sharing ([df2b48f](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/df2b48fe13d0f6aa822bb36a65d588206eda816b))
* make Telegram check interval and cooldown configurable via settings ([f83eb1d](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/f83eb1dc85178ea310a5497c78f6550252b75c39))
* move LSP config to oh-my-opencode generator ([df229d4](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/df229d4f2abb3c351144275356fc412cc5004658))
* **observability:** implement structured logging with Pino ([22f4ef9](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/22f4ef9a7f869895f58f121605a0f94aeb581a68))
* parse Codex quota into graphical progress bars instead of raw JSON dump ([7e55a3a](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/7e55a3a896e2becafb50d5466ba54212436e0352))
* per-user API keys, MCP persistence, admin user management, and local dev environment ([1a3bc21](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/1a3bc21e110c01671233a4780ed549e11f9eb360))
* per-user provider ownership, config sharing, and MCP type fixes ([986dadd](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/986dadd727f281e6b5aadafada682135ff7c5dfa))
* **perf:** add pagination to admin APIs ([080e02a](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/080e02a6f572d0b20d6698d4de7671d33281e65d))
* **perf:** implement in-memory LRU cache for expensive operations ([f527103](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/f527103a8636ba3786be1b8df75729749afded4d))
* provider-grouped quota aggregation with weighted availability formula ([f715ab4](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/f715ab4d454b218e71e751f5ed19e207fa26d0ad))
* **quota:** replace weighted average with per-window capacity bars and long-term priority display ([db537bb](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/db537bb4676170ad3abe3d95f6d8bc083903b923))
* redesign MCP server management for complex configurations ([#79](https://github.com/itsmylife44/cliproxyapi-dashboard/issues/79)) ([0021ebb](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/0021ebb4510af79ec0f00384b476c182191bbd9f))
* refresh app branding icons and favicon behavior ([3d549f9](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/3d549f9836c79f2b1cc08be7a70eb108b899ecde))
* Release pipeline with GitHub Actions, GHCR, and Docker Socket Proxy ([#19](https://github.com/itsmylife44/cliproxyapi-dashboard/issues/19)) ([37a1ea7](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/37a1ea7629d721c93a5bdd266237dfba43d87f24))
* **reliability:** add timeout handling to AsyncMutex fetch calls ([cfe0c6c](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/cfe0c6c6164b03fa135bb720b7ef90d4c350f9e3))
* reorganize quick start flows and assignment model selection ([d7a7c8a](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/d7a7c8a62e62129a5462c6091af5155cf9fd0d7e))
* replace GitHub API with version.json for update checks and show release notes inline ([#114](https://github.com/itsmylife44/cliproxyapi-dashboard/issues/114)) ([cbb8eaa](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/cbb8eaa7b8858b4d84e6d222fdc078b92935bc7d))
* rewrite perplexity sidecar with auto model discovery and auto-update ([9c204ad](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/9c204ad910845924d49fe0684c22ac89f2cf8d65))
* **security:** add path traversal protection to management proxy ([d00f0d5](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/d00f0d587b7533a372f38ed420dea86597de7089))
* **security:** extend rate limiting to sensitive endpoints ([456bb70](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/456bb70dbe214ed0fde5a60caa1e5c2204620805))
* **settings:** add OCX profile support note to setup instructions ([94cfa2b](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/94cfa2b083bf2dcb2a62fea2ddc57db6c367dc50))
* **setup:** show API key in modal after account creation ([c6cd0f3](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/c6cd0f334e4dc5c2f36b888aa8aa616a8ca02b81))
* sk-prefixed API keys, auto-populate sync token API key, HTTP MCP support ([e172838](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/e1728380bf9ed7dfd285a5cbdf9cdf99c4096217))
* streamline external proxy setup for existing Caddy users ([fd48452](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/fd48452b3bfc5c5dccd5139289ac0d0c82467a9a))
* support importing local OAuth JSON credentials from dashboard UI ([#120](https://github.com/itsmylife44/cliproxyapi-dashboard/issues/120)) ([cfd140c](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/cfd140cca515e0f2adf0e87f9420734dd62cf475))
* switch to CLIProxyAPIPlus, add Copilot & Kiro providers, fix OAuth delete 403 ([#67](https://github.com/itsmylife44/cliproxyapi-dashboard/issues/67)) ([00438e4](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/00438e4c8ea8a06e5fc629cf9dc060e22f33ce37))
* **ui:** add custom provider management interface ([2446076](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/2446076b60254aa913f1aa20a5eecdddbca288ae))
* **ui:** rewrite usage page with persistent data, time filters, and admin/user views ([15e55f8](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/15e55f849d664d62829b95a3921ff95b83ffeffa))
* **usage:** add COLLECTOR_API_KEY for external cron-based usage collection ([0e48a9b](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/0e48a9bd8c65d96c3bb0e53ec93d24d083988924))
* **usage:** deprecate live usage endpoint in favor of persistent DB tracking ([e9c5d35](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/e9c5d350a3a233f0647cfb29bd88d2f72f689db8))
* use pre-built GHCR images instead of local Docker builds ([73b487d](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/73b487d90fad7e48129216f48984c6f5728701b8))
* use pre-built GHCR images instead of local Docker builds ([80d8807](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/80d8807eb0176125bc8927a8ce346ce4eaf7b8ff))
* **validation:** standardize input validation with Zod ([71f59e5](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/71f59e5ee95eac4a7b8483aa3b712ed0ef81efd0))


### Bug Fixes

* accept valid docker tags for proxy update versions ([4078831](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/407883189631384b0ff3253b44625d2906b2c715))
* add auth-dir default to prevent CLIProxyAPI crash on startup ([f598989](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/f598989ce812f9e9d5656a41a7ae4d267ec1bf3b))
* add build-time env placeholders for Next.js validation ([79c29bc](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/79c29bc2765e8c209c2b3d20fcf7be659a78f2ba))
* add CLIProxyAPI config.yaml generation and auth-dir for local setup ([b2c05d6](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/b2c05d6f9013e0d1e1c997a1851e79aa3619b4bb))
* add container list reliability with timeout guard and error surfacing ([e3b0526](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/e3b0526912c0c3ddba3b85c40945ba76fce6ea06))
* add LOG_LEVEL to install.sh env template ([8f6796b](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/8f6796bd46946115ccfed15e5413b75c37562c15))
* add missing migrations to bootstrap scripts ([15b387e](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/15b387ec9159a9c1581fd60f70a5837c7df68697))
* add missing tables to entrypoint.sh for existing installs ([dd5e2c9](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/dd5e2c94dc7e6dcb062419d171f96247def3faa7))
* address Cubic code review feedback ([3214c1c](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/3214c1c7376e2bd886b648cdc95274c698707695))
* address Cubic code review findings ([a48765f](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/a48765f56048832fd9a878f0bab43172c869e51d))
* address diffray code review issues ([edb15dc](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/edb15dcc690b02926dee26a08e1c6814699fa7e9))
* address oracle review findings ([075b256](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/075b2560ae6b38af6ae13b2be229a5a84a8aed7f))
* address react-doctor findings to improve score from 84 to 94 ([174ec4b](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/174ec4b3076eb2daa5bb40a84955555442db871f))
* address remaining Cubic review feedback ([5c4f66d](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/5c4f66d056ea9cd5cc1930a56140e100b6316a9e))
* address remaining diffray code review issues ([0a6a104](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/0a6a104b0236d393d82a41430ad60c0fc080f696))
* address second Cubic review round ([7322596](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/73225961fbdcb49c2ac77bd25e68ddbd0ea08378))
* allow Next.js runtime inline scripts in production CSP ([96ae857](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/96ae85722d500225405ee8eb7a83719b5d6435a6))
* allow non-admin OAuth management read endpoints ([2e1e9f7](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/2e1e9f72c12a79975a8a5d9b703e73d9627e19f2))
* apply provider filter to charts and stats on quota page ([1b99157](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/1b99157fda2a48f917699ed316efefc07625ee50))
* avoid long blocking qwen oauth callback polling ([8483c80](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/8483c804362214b92cf6a42c70847721b3359efa))
* backend hardening — rate limiting, error standardization, security ([#122](https://github.com/itsmylife44/cliproxyapi-dashboard/issues/122)) ([e2bed94](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/e2bed948ef07d3d219e0170abdb9443e0704e9f3))
* bind all ports to localhost and write BOM-less UTF-8 .env on Windows ([920e2d5](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/920e2d506962b3001bd311e85b0cd737edd36703))
* block SSRF redirect bypass in fetch-models endpoint ([#40](https://github.com/itsmylife44/cliproxyapi-dashboard/issues/40)) ([bedaa7a](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/bedaa7abd66a233d792ae08be3f321b5a37f7ecf))
* capture provider OAuth ownerships after successful callback ([268c412](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/268c41272916c06b5714881db4d16a41f3370811))
* **ci:** reliable Docker build trigger with output fallback and workflow_dispatch ([eb620c1](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/eb620c1c91bc5389e79f0f773cec1a689657a053))
* **ci:** reliable Docker build trigger with output fallback and workflow_dispatch ([035d979](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/035d979b8be7a53e0f108e6414e13cfc44411791))
* clarify uptime label as proxy uptime in dashboard header ([912cf7b](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/912cf7b175cc675b00d9d23766108c9027e51197))
* clean stale digests on self-hosted runner before export ([df10ecd](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/df10ecd23caeeade41441e10029547c6d3c10fb7))
* clear update state when auth fails or user is not admin ([ca46861](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/ca468619b6945b92c05ca22b5d59956f02015c2d))
* collapse non-admin usage to single owned key when only one key exists ([09e89f8](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/09e89f8447495d31b9f22bc2e9d61d0c34457711))
* **config-sync:** await lastSyncedAt update for subscribers ([fb5c282](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/fb5c2828310b1105842bba253a69c40d627d95f6))
* **config-sync:** use deterministic hash for stable version detection ([c303ee1](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/c303ee176b05d7d7b2ecd2aa37631c495d951d0b))
* connect logger to log-storage for UI display ([7d7636e](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/7d7636e8b8c405e749f2c5f2674f5dbb7b22a3ec))
* containers page responsive table layout ([e308ec3](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/e308ec350b15a3356c9f5b4c60d91b08ff8ebedf))
* **containers:** support dev container names via CLIPROXYAPI_CONTAINER_NAME env ([29880e2](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/29880e2c5eec88e118353a0ec60f6123d09b5f77))
* correct foreground argument parsing in deploy script ([a096a64](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/a096a646e360cd674c661040188710a4d4dac4de))
* correct model-to-provider heuristics and add missing provider mappings ([#87](https://github.com/itsmylife44/cliproxyapi-dashboard/issues/87)) ([27d2df2](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/27d2df2af5b44105eb3c0d91bc89528f5f256ecc))
* correct plugin config paths and add OCX profile setup in Config Sync instructions ([14bd5a8](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/14bd5a8f9170cf0845252ffa48a9c1ad816a8f9a))
* dashboard UI consistency - remove glassmorphism, standardize to blue/slate theme ([e3f8dfd](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/e3f8dfdc1269bcb6cf0d8906ed05bd648cba9c1c))
* deduplicate model IDs to prevent duplicate React keys in ModelSelector ([dca83b4](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/dca83b4ae09aba3cd54606663ef2a8323ab483ff))
* deduplicate proxy models, suppress chart warnings, and fix 24h time format ([e41d27c](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/e41d27c231be545418c5f435839d7323f5b28a14))
* defer API_URL check to runtime so Docker build succeeds without env vars ([4c49853](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/4c49853a5d7841df2dffbfd863873c5fca3fe0ce))
* disable quota group drilldown and lock turbopack root ([5612ba5](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/5612ba50c1c53f215d0a8a3a768e27a27ccb5033))
* eliminate Edge Runtime warnings by splitting instrumentation into Node.js-only module ([48a5bda](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/48a5bda8aee83650e206b6a46cba4a7faab703c7))
* eliminate fetch response leaks and clear dashboard lint blockers ([#65](https://github.com/itsmylife44/cliproxyapi-dashboard/issues/65)) ([ce5fc17](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/ce5fc175b153b2de4fde461808c9dd9754c339f9))
* enforce admin-only system actions and handle null provider keys ([283b599](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/283b599f783b9a31ddf8e78eb32a8aa9e46e9b59))
* ensure DEFAULT_PLUGINS used when no saved plugins exist ([f775903](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/f775903b6477b3ab7f2f48dc35ccaf83ed5616bf))
* ensure first model selection change triggers autosave ([6d350f8](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/6d350f83673d2a5ba749d8ac67f5bb1588d985f9))
* **entrypoint:** add isAdmin column and user_api_keys table to DB bootstrap ([b814a91](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/b814a91acff601cb925ba7bf6ba207f465ef5bb4))
* explicitly pass API_URL and DASHBOARD_URL to dashboard container ([3baaf53](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/3baaf5375354628370f5c73e82336bcfceadcec1))
* fallback proxy update when compose is unavailable ([84c675f](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/84c675fa714536fdc052a529f22510226f9bb8dd))
* filter usage page to only show dashboard-generated API keys, exclude OAuth auth-file indices ([d2a9ad6](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/d2a9ad6f85cfe320cee5ae343824746f6d8c03aa))
* filter usage to dashboard API keys only, add quota cache (2min TTL) and handle Claude 429 rate limits ([d329a3b](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/d329a3bacd6ef02a2bc694a6b78d041d5aef9993))
* generate URL-safe postgres password in install flow ([be8e5bc](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/be8e5bc642f31b7421b6e007e57c735870551435))
* group usage by API key instead of endpoint ([64be3a3](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/64be3a3cc14eb6593601587e7c7762e06836be6c))
* handle 'completed'/'failed' status values from deploy script ([f086739](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/f0867393d0dae3734d1900bc17b04868a78a30fa))
* handle dashboard-v prefix in semver parsing for release tags ([8dc88ce](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/8dc88ce7b068ea5db102bf6ba01c0ad3f5f0f15c))
* handle Kiro device_code OAuth flow without initial URL ([4e219cc](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/4e219cc952444bc0040a5812188cd7d81c9d4d97))
* harden collector concurrency and reduce proxy/dashboard load ([#81](https://github.com/itsmylife44/cliproxyapi-dashboard/issues/81)) ([e6c2d6a](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/e6c2d6a7259470c1efeb4305646168930cc070e6))
* harden dashboard security controls for session APIs ([938fa69](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/938fa690114b56e9baab62f0ad48c740360fff44))
* harden Docker setup with security and resource improvements ([71dae30](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/71dae30549128222add769ed0b071287af208477))
* **health:** use GET instead of HEAD for proxy healthcheck ([#63](https://github.com/itsmylife44/cliproxyapi-dashboard/issues/63)) ([ca90255](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/ca9025523157225b6de4c98c2b9a8813de4f7a0c))
* **health:** use proxy root endpoint instead of /v0/management for healthcheck ([#61](https://github.com/itsmylife44/cliproxyapi-dashboard/issues/61)) ([50ab3e3](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/50ab3e3cc97abe5791f4f5ccfbef5bdc18ec04d2))
* honor x-forwarded headers in OAuth origin validation ([12542d5](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/12542d5a5563056ce6104755d8deef91f9e4da46))
* ignore null quota fractions in capacity calculations ([87ed48a](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/87ed48a3cc408e9cfa2802c44fbb533bf648f3b6))
* improve dashboard UX with tooltips, consistent spacing, and proper navigation ([c2f056a](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/c2f056a8dff33d724fde7ad72e6129f9259b834c))
* improve resilience and UX across dashboard ([16ea6e1](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/16ea6e1a2f2d60ec81db8bd24f40c77197a2a443))
* improve stale lock detection in deploy script ([9f1d9de](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/9f1d9de6573306b71f27f191fbc8a78064b2d082))
* include docker-proxy in install script and deploy flow ([c5478bf](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/c5478bfdee63318b02da7ae75e3099febe9a1967))
* include sessionVersion schema updates in bootstrap scripts ([44d2306](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/44d2306805b1f261248cfc20e20387a7d32d40fe))
* include user source matching in non-admin usage filter ([9170de3](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/9170de304eb76a54f775de512bd648f9caa96730))
* increase CLIProxyAPI wait timeout to 60s for cold starts ([0417b74](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/0417b744caa8ee7e4847ec120ea292417b7ca124))
* increase GitHub API cache TTLs to avoid rate limiting and remove duplicate password change ([32aaa30](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/32aaa300f296677dfb25f961e6eadc003611c9bc))
* install workflow, dynamic paths, copy-to-clipboard, setup redirect ([0298b15](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/0298b15acba77c091c80aec27051b72e1ed0a7f1))
* **install:** avoid unbound CADDY_MODE when skipping Caddy auto-apply ([d2e4b47](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/d2e4b47bd7877801872c840c146c0a01c86ee4b7)), closes [#102](https://github.com/itsmylife44/cliproxyapi-dashboard/issues/102)
* **install:** use public dashboard URL for collector cron in default mode, localhost only for external-proxy ([5f35104](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/5f351041b14a43491dd61bb4a00ad231bc832115))
* keep proxy updates and dashboard deploy compose-managed ([1ea7abd](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/1ea7abd651b07ea01dd7a3f8c0af0b7c72950057))
* **lint:** remove unused params and replace unsafe management any types ([bcf7e68](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/bcf7e683d6198d68f1e59b1bac245ac28f109b08))
* logger now stores logs in both dev and prod mode ([f616587](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/f61658757e2f09ecf486e1a63d79e7502bc163ea))
* make dashboard DB init SQL quoting robust ([1d5fb60](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/1d5fb606ae1344496d0482a70bcc727aeeaae121))
* make PROXY_URL configurable via CLIPROXYAPI_PROXY_URL env var ([3f033c5](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/3f033c5835ca8ad99d297a9e400440c0c394f8a7))
* match github-copilot provider name for Copilot quota tracking ([d0e127d](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/d0e127d4c9d35d4a3fd382992d334aaabe32cdd1))
* match non-admin usage by oauth source identifiers ([73fd4a7](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/73fd4a7ff0d14758e32ecdededeb494d69d84223))
* memory leaks, unbounded queries, error disclosure, and performance improvements ([#49](https://github.com/itsmylife44/cliproxyapi-dashboard/issues/49)) ([e470db5](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/e470db5fdc2936f96a9355ebb99d46d3792de339))
* merge docker build into release workflow to fix GITHUB_TOKEN trigger limitation ([8c73584](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/8c735849249576f94da7ab70e67c6abc57918f85))
* minor code quality improvements ([3250534](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/32505347203fc13bc668890151bbf64a1ebbae2a))
* modal styling and animation - replace glassmorphism with solid dark background, add keyframe animations ([bd81737](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/bd817378e1ae3e8fc12182329a57f6ec8627bed1))
* move pino dependencies to dashboard package ([df983d2](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/df983d27a5dba10735ccb801f34813bc9f90ab46))
* normalize deploy status payload and API response shape ([9473adc](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/9473adc4123fd97a15d0dcf95102b11506ff85a3))
* normalize opencode-cliproxyapi-sync to [@latest](https://github.com/latest) when loading saved plugins ([dc92958](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/dc92958dab051b45a5213fdd614556715f26276c))
* **oauth:** use CLIPROXYAPI_MANAGEMENT_URL for callback base URL ([3cfcab6](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/3cfcab624b3fec6b7af07e7bce096d34e4b6bdc4))
* pass proxyUrl as prop from server to client components instead of reading process.env in browser ([156b990](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/156b990bf080c73de16ad6a66c644d0981e2d031))
* prevent grid row stretch when expanding quota cards (items-start) ([da1f18e](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/da1f18eccb66d3d28671eaf0086761ee0b2c7c6a))
* prevent PowerShell from treating Docker stderr progress as errors ([82843e5](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/82843e5b9264b3ca6363efebc9f1898621ec93b8))
* prevent quota crash for kimi accounts ([d665d11](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/d665d117a7c66c9ba8f92975591c975761257dab))
* prevent quota crash for missing account email ([c553444](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/c5534444bdd72e576e91a85fa49bf8a6104660ac))
* **providers:** allowlist Docker service hostnames in SSRF check ([#57](https://github.com/itsmylife44/cliproxyapi-dashboard/issues/57)) ([370c80f](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/370c80f9b5463019bd28c9a360eda1048ea2551f))
* race conditions in provider key contribution, removal, and OAuth callback ownership ([0637049](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/063704954f59504084f7f723ffd504b6c5479c34))
* rebalance quota capacity and tighten publisher settings density ([7aa67dc](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/7aa67dc739f9ee75fc9c33fdc439800ee18e68bf))
* remove custom provider credentials and redundant models from opencode config ([88845bf](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/88845bffdf19d216f8e0dbbe7c1a17613ff3e201))
* remove duplicate code block in deploy script ([b672e9b](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/b672e9b4321451e533bae0f0ef0a9c45c6d84fe6))
* remove duplicate model list from OpenCode config section ([bf7d5be](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/bf7d5be8607d7362cb1f5edddfb1a73c49dbe9a2))
* remove incompatible thinking/reasoning options from generated config ([#90](https://github.com/itsmylife44/cliproxyapi-dashboard/issues/90)) ([5cacb1b](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/5cacb1b142e844021bef4f0f57a452951a924cde))
* remove misleading version parameter from dashboard update endpoint ([e25b30c](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/e25b30cbc4e162e1b470a6488c8a015d80a153c8))
* remove throw on missing API_URL, use empty string fallback for Docker compatibility ([4c5d13e](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/4c5d13e1ebb1b13abb127cb50722b9ba325236bf))
* remove turbopack.root that broke CSS module resolution ([65d097b](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/65d097bbc4197b5eb4ce240bc56055ceb01f51f8))
* remove unbound variable in port conflict check ([091adb6](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/091adb61943ad296eb432a8fdf15c9ad337742ee))
* replace duplicate provider capacity table with enhanced chart showing long-term and short-term ([3f71127](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/3f711273a666b2f72a968e9fc3f1eefffdd14cdb))
* replace next/image with plain img for logo icon in standalone/Docker mode ([4ea400f](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/4ea400f5974d6d163eb5a26f278ae80d347d9c9e))
* resolve build errors from dual-write syntax and TS 5.9.3 type incompatibility ([225e8c8](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/225e8c84769e1578b24decfb81af00afeff9034e))
* resolve font preload warnings and missing icon/favicon 404 errors ([6dee80e](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/6dee80e3b56b30d94e11f2bdbb87a7ad716bae11))
* resolve login failure on HTTP setups and /app/logs permission denied ([e3631f4](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/e3631f4ad4c11e3f895b52b674aab0a7b07713cd))
* restore CLIProxyAPI proxy update routes alongside new dashboard update routes ([0316703](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/0316703503a6a0c48160a7a44ffffb18a03c343e))
* revert provider key naming, add name input to user API keys page ([6afb7da](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/6afb7da498f87b1904fe55a38b504c802fedf07b))
* robust origin validation with forwarded headers and normalized ports ([75a2d15](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/75a2d15ade79115ddb232163ff85c9868ef58984))
* run deploy script in background to avoid webhook timeout ([8e17543](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/8e175433062a6227b348e7fb42734b02457e48e1))
* save config via PUT config.yaml instead of non-existent PUT config JSON ([#115](https://github.com/itsmylife44/cliproxyapi-dashboard/issues/115)) ([8e9b150](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/8e9b150adf27b94baa81cb1c16d5b234ac444849))
* **security:** harden SSRF, CSRF, timing, error leakage + lint cleanup ([#94](https://github.com/itsmylife44/cliproxyapi-dashboard/issues/94)) ([5804f14](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/5804f14ab7531fa2f6fc8000847b1cfe4ed04894))
* **security:** prevent race condition in setup wizard ([3e2353e](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/3e2353ee2e5c9a3335cd9fab3d04b3e7055ccb56))
* session secure flag falls back to NODE_ENV when X-Forwarded-Proto absent, stop trimming textarea on every keystroke ([223ae08](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/223ae08c0a22b12e9ef5ad39012291e8649418db))
* **settings:** correct key name from plugins to plugin ([4a909d3](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/4a909d3044c4d57912b417f1725f1797f57bd374))
* **settings:** correct plugin setup instructions - no npx install needed ([7025cfe](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/7025cfe48bf5a02cb70d15c20beca56006243a5b))
* **settings:** use [@latest](https://github.com/latest) tag for plugin in setup instructions ([a631bdb](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/a631bdb8450dc9db0a224a7d91bc3019260cbe6c))
* **setup:** remove obsolete API key modal after account creation ([1393d0a](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/1393d0af1e9c08cb8ec51ae4878610f9a0f846e2))
* show actual version instead of 'latest' in update popup ([ba0f7eb](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/ba0f7eb755539ee7910cbe172b18857a3dbfb745))
* show days in quota reset time instead of only hours ([072e8e0](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/072e8e0743eaa2f77dfd223a017c39ae0fea27b4))
* show device authorization code for Copilot and other device-flow providers ([527de1f](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/527de1f8df061d28ca35ee40298fbc4112727df0))
* show prisma db push output instead of silencing it ([4bae2d5](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/4bae2d5a8dd5ab5ab6e93318fc7946dbceeba7f1))
* show release notes inline from version.json instead of linking to GitHub ([9551448](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/955144838b373204f2caff54a58769ead54b9cdb))
* skip lock check for forked child process to prevent self-blocking ([6d5cde7](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/6d5cde70cbc685c2bb6c1cdabb29171026153ead))
* stabilize quota account identifiers ([c3d0c6e](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/c3d0c6e4a8310bdbc9fc480b66ddf059fe69bf6d))
* stabilize recharts container sizing to avoid width -1 warnings ([9becd61](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/9becd613a6b99b4b92d4727f40b34a22469c93a2))
* support oauth deletion by account id/name and admin owner visibility ([7766069](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/7766069f349238598271034ecfb24a5afe877974))
* suppress update popups while github actions build is in progress ([#52](https://github.com/itsmylife44/cliproxyapi-dashboard/issues/52)) ([2047647](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/2047647228c1fa1cc3ec80ceef782810ae6c25c3))
* **sync:** CLIProxyAPI PUT api-keys expects plain array, not object ([d64e50a](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/d64e50a121d6dbcda86a4ebf2c507992f9abdf0e))
* tmux config defaults not persisted when enabling via dashboard ([a223281](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/a22328175a68db1404fba04ea1cf12508519c90d))
* track all repo paths in release-please, not just dashboard/ ([54fd32e](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/54fd32e47b2ac914afe00dba2cf36e4f0881e15a))
* **ui:** improve native dropdown and date/time contrast ([c452127](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/c4521276fe0fd409973ffa2efca25390dc9d8500))
* unify model grouping logic across model selector and config generators ([c6ec7a8](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/c6ec7a8cef63e26983e7e54d39ecda0828d81cfe))
* unify model grouping logic across model selector and config generators ([150fec7](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/150fec7517139f7faeb6b503950015e4b48cf7c6))
* update API key lastUsedAt on config sync and fix mobile responsive ([#44](https://github.com/itsmylife44/cliproxyapi-dashboard/issues/44)) ([be3c3f1](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/be3c3f149a47f8eb6700440fafb6118b4ead5866))
* update lastSyncedAt timestamp when subscriber fetches config bundle ([e88797b](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/e88797b5acea5d20b264e19600c29f145f430e61))
* usage aggregation, race conditions, data loss, and client cleanup ([#46](https://github.com/itsmylife44/cliproxyapi-dashboard/issues/46)) ([a48e35a](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/a48e35acf59c1abfb9190ddc950507e7373854a7))
* usage API type guards to match actual CLIProxyAPI response format ([3f8c2f5](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/3f8c2f53811a868ffc74d52d15869b3a86af6abe))
* usage page reads data.data instead of data.usage ([b6e7668](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/b6e7668bd986b2c42f2c4c73252fbd95ab0183a4))
* **usage:** group usage by apiKeyId/userId instead of authIndex to merge per-user entries ([bfc9df8](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/bfc9df84ecca6630884d9b4f84b16d476860439b))
* **usage:** resolve auth_index via /auth-files endpoint for robust user matching ([b177de7](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/b177de78c88f450d934e292f0044e97a5a38423a))
* **usage:** resolve userId via source/OAuth matching instead of broken authIndex prefix ([ce69be3](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/ce69be3b5206c8ed5514be4803e935b31069befc))
* **usage:** strict YYYY-MM-DD date validation, fix end-of-day boundary for to-date ([77ff899](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/77ff899f801dc8bf514ab7746a0c0136fee9bbf2))
* **usage:** use local dates for filters, strict date validation, fetch timeout, reset recordsStored on error ([5a47457](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/5a474571796edd41fb1ba742594d0812e7f244e4))
* use [@latest](https://github.com/latest) tag for opencode-cliproxyapi-sync in all default plugin lists ([c8e8b64](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/c8e8b64afc5e0cb9ba0de20a32e69c20608d31a6))
* use [@latest](https://github.com/latest) tag in quick-start config section ([729d666](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/729d666707041ca6698983dce1fa7ca3351a55be))
* use API_URL env variable for proxy URL instead of non-existent CLIPROXYAPI_PROXY_URL ([be13f4c](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/be13f4ca85a0d751b5a831096377c78c6f28b103))
* use base URL directly for /models instead of hardcoding /v1 prefix ([a5089f3](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/a5089f3ae28b9566aecdd59b28da1f2bcde1485b))
* use build ARG placeholders that pass env validation ([a253fcf](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/a253fcf52ec9388c57179f02a7907066f355bd42))
* use curl.exe instead of Invoke-WebRequest for API health check ([7054abe](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/7054abed148819f6754608d4426df292582066d4))
* use empty api-keys array instead of placeholder ([2bfa0ad](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/2bfa0adf47fb6e61f833614633da79bea8e9a5b8))
* use existing icon asset for apple metadata ([464eaea](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/464eaea5da747bfbdcab037712fde4976b59d36c))
* use explicit tailwindcss/index.css for Turbopack compatibility ([c1dba01](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/c1dba01e80269560c90ce535e295df3243935c4f))
* use explicit tailwindcss/index.css import path ([51a4918](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/51a4918193d26f880a4efec1566fb4ac81341fcd))
* use internal URL for server-side proxy model fetching ([e2a01db](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/e2a01db34ca2c32d1ad9e37fd3d1202601cb071c))
* use NextRequest type for validateOrigin compatibility ([f85a360](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/f85a360a791269fd4abbebb34fc1e685e379e5f6))
* use no-store cache and versioned user-agent for GitHub API calls ([e0079f5](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/e0079f5ae3fbc58c8c59058fb5c8576433c1a4c8))
* use port 5433 to avoid conflicts with local Postgres and fix -Help param ([b1383de](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/b1383de3aa87ec3580d0db8ac6956498125ce143))
* use proxy API key grouping for accurate user attribution in collector ([95bc042](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/95bc042d6b9958de81a395ce2da4a9eff77bcf63))
* use time-based stale lock detection (10 min timeout) ([2239a98](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/2239a98cc57abf70cabd193f1ebd720b0b3086fb))
* use webhook for dashboard self-update instead of docker compose ([c87f4e8](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/c87f4e82e49a199f08fbdacdfad3367ff5d5eefa))
* use webhook for dashboard self-update instead of docker compose ([074b618](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/074b618af2e8e1a1051cf8e37fb7eb5cda278da4))
* user list reads data.data instead of data.users ([2a5198b](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/2a5198b7b0e97a6f3febb3e40deeab5b8461184d))


### Performance Improvements

* **db:** add composite index for provider key lookups ([103101e](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/103101e025ea34ebf93e7b52aec72bff52135064))
* **db:** add index on SyncToken.tokenHash ([bba0ba9](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/bba0ba96f577bb14b9a228ee4f5f34032f85a911))
* **db:** optimize Prisma queries with select clauses ([f7e7ae9](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/f7e7ae9551f5119ad692e861dfc9144dba34baf1))

## [0.1.52](https://github.com/itsmylife44/cliproxyapi-dashboard/compare/dashboard-v0.1.51...dashboard-v0.1.52) (2026-03-06)


### Features

* add OAuth account enable/disable toggle ([581dcb0](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/581dcb03f095ea1f40930fe33fd24dcdcc12bab0))
* expose all CLIProxyAPIPlus config fields in dashboard ([#116](https://github.com/itsmylife44/cliproxyapi-dashboard/issues/116)) ([33b4a1a](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/33b4a1ad4015dc6456cdd6e52c4861f0740605af))
* replace GitHub API with version.json for update checks and show release notes inline ([#114](https://github.com/itsmylife44/cliproxyapi-dashboard/issues/114)) ([b1dfee4](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/b1dfee4dde1cef9a1a6a196641f26286d9d9553c))


### Bug Fixes

* deduplicate proxy models, suppress chart warnings, and fix 24h time format ([10530b8](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/10530b844230c72b6d4d6fda23fc213863f81a16))
* filter usage page to only show dashboard-generated API keys, exclude OAuth auth-file indices ([c1d3bde](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/c1d3bde03ed161d873fb4433d656a306703b6dcb))
* filter usage to dashboard API keys only, add quota cache (2min TTL) and handle Claude 429 rate limits ([dd22ab6](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/dd22ab6b63f77c0155375473726099173b104c69))
* resolve login failure on HTTP setups and /app/logs permission denied ([051f7d8](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/051f7d86ac9a1fad804ac559c2ece04979761ed9))
* save config via PUT config.yaml instead of non-existent PUT config JSON ([#115](https://github.com/itsmylife44/cliproxyapi-dashboard/issues/115)) ([9233b28](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/9233b28edaeae474261e8be7dfd4380d40152be5))
* session secure flag falls back to NODE_ENV when X-Forwarded-Proto absent, stop trimming textarea on every keystroke ([060750c](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/060750c55dcd12dc2c1f40ee6ebef2065dc74160))

## [0.1.51](https://github.com/itsmylife44/cliproxyapi-dashboard/compare/dashboard-v0.1.50...dashboard-v0.1.51) (2026-03-04)


### Features

* add OAuth health status badges and fix alias model override priority ([dcc2e9c](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/dcc2e9ca5cf22c9766706d0a157a00fa36bd2fdf))
* add setup wizard with inline forms and sequential step locking ([887a5eb](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/887a5eb4cb08db668afa07be1b8426eae61d8d08))
* add Windows PowerShell dev-local script for local development ([da6987c](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/da6987cab911eefbc91ee7135d62836c3e4e96a1))
* make Telegram check interval and cooldown configurable via settings ([b76d265](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/b76d265e04a0dfbf3e25173ab7b04db579f26049))


### Bug Fixes

* apply provider filter to charts and stats on quota page ([198aded](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/198aded17193d032941f76403d6e9251e993d7f8))
* deduplicate model IDs to prevent duplicate React keys in ModelSelector ([124761d](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/124761d02e5ce72cdc39ce8155b5b07933463f3a))
* increase CLIProxyAPI wait timeout to 60s for cold starts ([cc1ccc4](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/cc1ccc414b3f6e7d24ed8e2825d8002a441a9aeb))
* prevent PowerShell from treating Docker stderr progress as errors ([5f0fc8c](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/5f0fc8c9e788cc61cc6a6db02fcbd0c33f838f2b))
* remove duplicate model list from OpenCode config section ([9f22e53](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/9f22e53882b3eba5d1e2f8851f1413d0dcd348d7))
* replace duplicate provider capacity table with enhanced chart showing long-term and short-term ([f7831cb](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/f7831cbdb9ad88970baaeac874a7360bac3e52f0))
* show prisma db push output instead of silencing it ([34e01a7](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/34e01a78cc9cd2c508aa1124edfc365b94ed2d6c))
* use curl.exe instead of Invoke-WebRequest for API health check ([064c6b7](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/064c6b798e0698a55526ee5deaf3f44e12e2e171))
* use port 5433 to avoid conflicts with local Postgres and fix -Help param ([a01a34c](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/a01a34ced18824945584f09e00881f1927443adb))

## [0.1.50](https://github.com/itsmylife44/cliproxyapi-dashboard/compare/dashboard-v0.1.49...dashboard-v0.1.50) (2026-03-04)


### Bug Fixes

* eliminate Edge Runtime warnings by splitting instrumentation into Node.js-only module ([0bea7a7](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/0bea7a718a873756b0209ed38f49a3d4d0512323))

## [0.1.49](https://github.com/itsmylife44/cliproxyapi-dashboard/compare/dashboard-v0.1.48...dashboard-v0.1.49) (2026-03-04)


### Features

* add dashboard UX improvements and Telegram quota alerts ([#108](https://github.com/itsmylife44/cliproxyapi-dashboard/issues/108)) ([57e7e68](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/57e7e6862a4c382c13fcd21ea3844cff4118a217))

## [0.1.48](https://github.com/itsmylife44/cliproxyapi-dashboard/compare/dashboard-v0.1.47...dashboard-v0.1.48) (2026-03-03)


### Features

* add recharts visualizations to dashboard pages ([#106](https://github.com/itsmylife44/cliproxyapi-dashboard/issues/106)) ([dc05595](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/dc05595e5a10401fc94f80df0f06c7fdb7d76003))

## [0.1.47](https://github.com/itsmylife44/cliproxyapi-dashboard/compare/dashboard-v0.1.46...dashboard-v0.1.47) (2026-03-03)


### Bug Fixes

* harden Docker setup with security and resource improvements ([8bf4285](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/8bf42852c60fd811f1336fe0479311bd3dcbe8c5))
* use build ARG placeholders that pass env validation ([0de71c2](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/0de71c2f284fda86a331020890981380775025fb))

## [0.1.46](https://github.com/itsmylife44/cliproxyapi-dashboard/compare/dashboard-v0.1.45...dashboard-v0.1.46) (2026-03-03)


### Features

* apply advanced Tailwind CSS layout techniques across dashboard ([eeb190f](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/eeb190f54d0a1e03e0be6e9574f2ce5b388c083d))


### Bug Fixes

* address react-doctor findings to improve score from 84 to 94 ([6d372a2](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/6d372a21714657f0230e57afc3a1fbe86fae2e32))
* clarify uptime label as proxy uptime in dashboard header ([2ea0de0](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/2ea0de0de6369fb3511dcf1af38e2e57d25a6d87))
* **install:** avoid unbound CADDY_MODE when skipping Caddy auto-apply ([dd6f28a](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/dd6f28a97c8385de35b64bee95397b81f8a38573)), closes [#102](https://github.com/itsmylife44/cliproxyapi-dashboard/issues/102)

## [0.1.45](https://github.com/itsmylife44/cliproxyapi-dashboard/compare/dashboard-v0.1.44...dashboard-v0.1.45) (2026-03-02)


### Bug Fixes

* increase GitHub API cache TTLs to avoid rate limiting and remove duplicate password change ([226f5b7](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/226f5b76a0f1c6a089ef298df02647b1b5f5dde3))

## [0.1.44](https://github.com/itsmylife44/cliproxyapi-dashboard/compare/dashboard-v0.1.43...dashboard-v0.1.44) (2026-03-02)


### Features

* add persistent dashboard header with live status pulse and user panel ([#99](https://github.com/itsmylife44/cliproxyapi-dashboard/issues/99)) ([3cc9fef](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/3cc9fefd807148a77f5e5ba8745c0d26a5f60c85))

## [0.1.43](https://github.com/itsmylife44/cliproxyapi-dashboard/compare/dashboard-v0.1.42...dashboard-v0.1.43) (2026-03-02)


### Features

* add fullscreen update overlay with progress animation and auto-reload ([#97](https://github.com/itsmylife44/cliproxyapi-dashboard/issues/97)) ([0abb89e](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/0abb89eca0821412cc4383724b5d351bd6f024d5))

## [0.1.42](https://github.com/itsmylife44/cliproxyapi-dashboard/compare/dashboard-v0.1.41...dashboard-v0.1.42) (2026-03-02)


### Bug Fixes

* **security:** harden SSRF, CSRF, timing, error leakage + lint cleanup ([#94](https://github.com/itsmylife44/cliproxyapi-dashboard/issues/94)) ([7eceec9](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/7eceec900b457845db911dcc1e288bb19360aaeb))

## [0.1.41](https://github.com/itsmylife44/cliproxyapi-dashboard/compare/dashboard-v0.1.40...dashboard-v0.1.41) (2026-02-27)


### Bug Fixes

* remove incompatible thinking/reasoning options from generated config ([#90](https://github.com/itsmylife44/cliproxyapi-dashboard/issues/90)) ([e95e68a](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/e95e68aae440c0318f7fecdfb018974a6cd98a95))

## [0.1.40](https://github.com/itsmylife44/cliproxyapi-dashboard/compare/dashboard-v0.1.39...dashboard-v0.1.40) (2026-02-26)


### Bug Fixes

* correct model-to-provider heuristics and add missing provider mappings ([#87](https://github.com/itsmylife44/cliproxyapi-dashboard/issues/87)) ([c1856fb](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/c1856fbabc468978b1e422e73185a4f32a5f80cc))

## [0.1.39](https://github.com/itsmylife44/cliproxyapi-dashboard/compare/dashboard-v0.1.38...dashboard-v0.1.39) (2026-02-25)


### Features

* add provider group management and priority ordering ([#84](https://github.com/itsmylife44/cliproxyapi-dashboard/issues/84)) ([2ec1a7b](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/2ec1a7b657971e46080315dab89815523857e926)), closes [#78](https://github.com/itsmylife44/cliproxyapi-dashboard/issues/78)

## [0.1.38](https://github.com/itsmylife44/cliproxyapi-dashboard/compare/dashboard-v0.1.37...dashboard-v0.1.38) (2026-02-25)


### Bug Fixes

* accept valid docker tags for proxy update versions ([dee982d](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/dee982d31b50244d920be9f30b8ca22619a8325b))

## [0.1.37](https://github.com/itsmylife44/cliproxyapi-dashboard/compare/dashboard-v0.1.36...dashboard-v0.1.37) (2026-02-24)


### Bug Fixes

* harden collector concurrency and reduce proxy/dashboard load ([#81](https://github.com/itsmylife44/cliproxyapi-dashboard/issues/81)) ([8950a53](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/8950a53cb27326132c71f41e9758d4522ab5af54))

## [0.1.36](https://github.com/itsmylife44/cliproxyapi-dashboard/compare/dashboard-v0.1.35...dashboard-v0.1.36) (2026-02-24)


### Features

* redesign MCP server management for complex configurations ([#79](https://github.com/itsmylife44/cliproxyapi-dashboard/issues/79)) ([7088623](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/708862331375a2844d96d9775d42e8c4962d66d6))

## [0.1.35](https://github.com/itsmylife44/cliproxyapi-dashboard/compare/dashboard-v0.1.34...dashboard-v0.1.35) (2026-02-24)


### Bug Fixes

* improve dashboard UX with tooltips, consistent spacing, and proper navigation ([2be1484](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/2be1484c35e81bfb0937bc5e1b6fd27cb9336087))

## [0.1.34](https://github.com/itsmylife44/cliproxyapi-dashboard/compare/dashboard-v0.1.33...dashboard-v0.1.34) (2026-02-23)


### Bug Fixes

* clean stale digests on self-hosted runner before export ([48276bd](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/48276bd811dc4fed84d691073860b1472cd80e7f))

## [0.1.33](https://github.com/itsmylife44/cliproxyapi-dashboard/compare/dashboard-v0.1.32...dashboard-v0.1.33) (2026-02-23)


### Bug Fixes

* match github-copilot provider name for Copilot quota tracking ([8e6d134](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/8e6d134b4b8d7ed259b7bcb8538ec78573617b87))

## [0.1.32](https://github.com/itsmylife44/cliproxyapi-dashboard/compare/dashboard-v0.1.31...dashboard-v0.1.32) (2026-02-23)


### Features

* add Copilot quota tracking and improve model grouping by provider ([ac02861](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/ac02861c8b233a48bfe5c2c514b39e0f50c7d53e))

## [0.1.31](https://github.com/itsmylife44/cliproxyapi-dashboard/compare/dashboard-v0.1.30...dashboard-v0.1.31) (2026-02-23)


### Bug Fixes

* show device authorization code for Copilot and other device-flow providers ([f14b6e7](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/f14b6e7ee1980018bb70bd5d5847005d3cb9004c))

## [0.1.30](https://github.com/itsmylife44/cliproxyapi-dashboard/compare/dashboard-v0.1.29...dashboard-v0.1.30) (2026-02-23)


### Bug Fixes

* handle Kiro device_code OAuth flow without initial URL ([07a4f6f](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/07a4f6f6b1ac70950e5134dbbe60269e593d14bd))

## [0.1.29](https://github.com/itsmylife44/cliproxyapi-dashboard/compare/dashboard-v0.1.28...dashboard-v0.1.29) (2026-02-23)


### Features

* add CLIProxyAPIPlus, Copilot and Kiro providers support ([f3620f9](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/f3620f927d796e3a2fd20e1063791ad016b647c6))

## [0.1.28](https://github.com/itsmylife44/cliproxyapi-dashboard/compare/dashboard-v0.1.27...dashboard-v0.1.28) (2026-02-23)


### Features

* switch to CLIProxyAPIPlus, add Copilot & Kiro providers, fix OAuth delete 403 ([#67](https://github.com/itsmylife44/cliproxyapi-dashboard/issues/67)) ([6ab774f](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/6ab774ff130a96e3758e1a1ad9c53987f866c382))

## [0.1.27](https://github.com/itsmylife44/cliproxyapi-dashboard/compare/dashboard-v0.1.26...dashboard-v0.1.27) (2026-02-21)


### Bug Fixes

* eliminate fetch response leaks and clear dashboard lint blockers ([#65](https://github.com/itsmylife44/cliproxyapi-dashboard/issues/65)) ([bef630a](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/bef630abd245f200e55ac0ec223cd8a9213d2af4))

## [0.1.26](https://github.com/itsmylife44/cliproxyapi-dashboard/compare/dashboard-v0.1.25...dashboard-v0.1.26) (2026-02-21)


### Bug Fixes

* **health:** use GET instead of HEAD for proxy healthcheck ([#63](https://github.com/itsmylife44/cliproxyapi-dashboard/issues/63)) ([88fdacf](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/88fdacf11d839eab05209b3eb6ad79d8ac7abf60))

## [0.1.25](https://github.com/itsmylife44/cliproxyapi-dashboard/compare/dashboard-v0.1.24...dashboard-v0.1.25) (2026-02-21)


### Bug Fixes

* **health:** use proxy root endpoint instead of /v0/management for healthcheck ([#61](https://github.com/itsmylife44/cliproxyapi-dashboard/issues/61)) ([be41d4d](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/be41d4deef453fb2d01e93469191756fbc0dd137))

## [0.1.24](https://github.com/itsmylife44/cliproxyapi-dashboard/compare/dashboard-v0.1.23...dashboard-v0.1.24) (2026-02-21)


### Features

* rewrite perplexity sidecar with auto model discovery and auto-update ([eeaabfb](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/eeaabfbac38f9cfa17c2e99ea03f2e81aab06d44))

## [0.1.23](https://github.com/itsmylife44/cliproxyapi-dashboard/compare/dashboard-v0.1.22...dashboard-v0.1.23) (2026-02-21)


### Features

* add missing Perplexity Pro web UI models to sidecar ([4e5fa31](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/4e5fa315de7d4873ad1bbac46f9d3b28c0b8069a))

## [0.1.22](https://github.com/itsmylife44/cliproxyapi-dashboard/compare/dashboard-v0.1.21...dashboard-v0.1.22) (2026-02-21)


### Bug Fixes

* **providers:** allowlist Docker service hostnames in SSRF check ([#57](https://github.com/itsmylife44/cliproxyapi-dashboard/issues/57)) ([6364aaf](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/6364aaf9f51235b259de032730d7a7e97afe7b13))

## [0.1.21](https://github.com/itsmylife44/cliproxyapi-dashboard/compare/dashboard-v0.1.20...dashboard-v0.1.21) (2026-02-21)


### Features

* add Perplexity Pro sidecar with dashboard cookie management ([#54](https://github.com/itsmylife44/cliproxyapi-dashboard/issues/54)) ([a5cb6dc](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/a5cb6dcaffd8e210ea19b85c13f986c2f8f60ff7))

## [0.1.20](https://github.com/itsmylife44/cliproxyapi-dashboard/compare/dashboard-v0.1.19...dashboard-v0.1.20) (2026-02-19)


### Bug Fixes

* suppress update popups while github actions build is in progress ([#52](https://github.com/itsmylife44/cliproxyapi-dashboard/issues/52)) ([3d546b2](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/3d546b231a4f489b93f1fc1c0f345e36a435a33c))

## [0.1.19](https://github.com/itsmylife44/cliproxyapi-dashboard/compare/dashboard-v0.1.18...dashboard-v0.1.19) (2026-02-19)


### Features

* add client-side pagination to logs page ([a1d50b6](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/a1d50b632c8dfa4c851b96fb0c0c519608684ad5))
* add separate proxy update notification component ([9601286](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/96012864b27a387ce5f32b64da0fa426383320a2))


### Bug Fixes

* containers page responsive table layout ([da381e2](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/da381e2294bef5004e4976e83a26562ab549064d))
* dashboard UI consistency - remove glassmorphism, standardize to blue/slate theme ([df23e6b](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/df23e6b575721c0cd75af005bde3fe830b33171c))
* modal styling and animation - replace glassmorphism with solid dark background, add keyframe animations ([a7b80be](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/a7b80be0ef6beda80a536a18cdacced5aa08e5de))

## [0.1.18](https://github.com/itsmylife44/cliproxyapi-dashboard/compare/dashboard-v0.1.17...dashboard-v0.1.18) (2026-02-16)


### Bug Fixes

* memory leaks, unbounded queries, error disclosure, and performance improvements ([#49](https://github.com/itsmylife44/cliproxyapi-dashboard/issues/49)) ([d0d1970](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/d0d1970d9a3b7016f0c0bb9d4c6f91142dd803fe))

## [0.1.17](https://github.com/itsmylife44/cliproxyapi-dashboard/compare/dashboard-v0.1.16...dashboard-v0.1.17) (2026-02-16)


### Bug Fixes

* usage aggregation, race conditions, data loss, and client cleanup ([#46](https://github.com/itsmylife44/cliproxyapi-dashboard/issues/46)) ([ba74774](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/ba747742e6640e4f5a56368f4a0c7e08d91bd5d6))

## [0.1.16](https://github.com/itsmylife44/cliproxyapi-dashboard/compare/dashboard-v0.1.15...dashboard-v0.1.16) (2026-02-16)


### Bug Fixes

* update API key lastUsedAt on config sync and fix mobile responsive ([#44](https://github.com/itsmylife44/cliproxyapi-dashboard/issues/44)) ([18568e9](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/18568e944c464f22ebc0c73c42a5057cfda998c2))

## [0.1.15](https://github.com/itsmylife44/cliproxyapi-dashboard/compare/dashboard-v0.1.14...dashboard-v0.1.15) (2026-02-16)


### Bug Fixes

* improve resilience and UX across dashboard ([bb52170](https://github.com/itsmylife44/cliproxyapi-dashboard/commit/bb5217092a30a1aadcb5fefb70e355bcbb2cbe0b))

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
