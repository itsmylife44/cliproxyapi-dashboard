export const API_ENDPOINTS = {
  AUTH: {
    ME: "/api/auth/me",
    LOGIN: "/api/auth/login",
    LOGOUT: "/api/auth/logout",
    CHANGE_PASSWORD: "/api/auth/change-password",
  },
  SETUP: {
    BASE: "/api/setup",
    STATUS: "/api/setup-status",
  },
  ADMIN: {
    DEPLOY: "/api/admin/deploy",
    USERS: "/api/admin/users",
    SETTINGS: "/api/admin/settings",
    LOGS: "/api/admin/logs",
    TELEGRAM: "/api/admin/telegram",
    REVOKE_SESSIONS: "/api/admin/revoke-sessions",
    BACKUP: "/api/admin/backup",
    BACKUP_SCHEDULE: "/api/admin/backup/schedule",
    BACKUP_STORAGE: "/api/admin/backup/storage",
    BACKUP_RESTORE: "/api/admin/backup/restore",
    BACKUP_PREVIEW: "/api/admin/backup/preview",
  },
  UPDATE: {
    BASE: "/api/update",
    CHECK: "/api/update/check",
    DASHBOARD: "/api/update/dashboard",
    DASHBOARD_CHECK: "/api/update/dashboard/check",
  },
  QUOTA: {
    BASE: "/api/quota",
    CHECK_ALERTS: "/api/quota/check-alerts",
  },
  USAGE: {
    COLLECT: "/api/usage/collect",
    COLLECTION_STATUS: "/api/usage/collection-status",
    HISTORY: "/api/usage/history",
  },
  USER: {
    API_KEYS: "/api/user/api-keys",
    CONFIG: "/api/user/config",
  },
  PROVIDERS: {
    KEYS: "/api/providers/keys",
    OAUTH: "/api/providers/oauth",
    OAUTH_IMPORT: "/api/providers/oauth/import",
    OAUTH_CLAIM: "/api/providers/oauth/claim",
    PERPLEXITY_COOKIE: "/api/providers/perplexity-cookie",
    PERPLEXITY_COOKIE_SYNC_MODELS: "/api/providers/perplexity-cookie/sync-models",
  },
  CUSTOM_PROVIDERS: {
    FETCH_MODELS: "/api/custom-providers/fetch-models",
    REORDER: "/api/custom-providers/reorder",
    RESYNC: "/api/custom-providers/resync",
  },
  PROVIDER_GROUPS: {
    BASE: "/api/provider-groups",
    REORDER: "/api/provider-groups/reorder",
  },
  MANAGEMENT: {
    CONFIG: "/api/management/config",
    CONFIG_YAML: "/api/management/config.yaml",
    LOGS: "/api/management/logs",
    LATEST_VERSION: "/api/management/latest-version",
    OAUTH_CALLBACK: "/api/management/oauth-callback",
    PLUGINS: "/api/management/plugins",
    PLUGIN_STORE: "/api/management/plugin-store",

    // Config field dedicated endpoints
    PROXY_URL: "/api/management/proxy-url",
    DEBUG: "/api/management/debug",
    LOGGING_TO_FILE: "/api/management/logging-to-file",
    LOGS_MAX_TOTAL_SIZE_MB: "/api/management/logs-max-total-size-mb",
    ERROR_LOGS_MAX_FILES: "/api/management/error-logs-max-files",
    USAGE_STATISTICS_ENABLED: "/api/management/usage-statistics-enabled",
    REQUEST_RETRY: "/api/management/request-retry",
    MAX_RETRY_INTERVAL: "/api/management/max-retry-interval",
    MAX_RETRY_CREDENTIALS: "/api/management/max-retry-credentials",
    REQUEST_LOG: "/api/management/request-log",
    WS_AUTH: "/api/management/ws-auth",
    FORCE_MODEL_PREFIX: "/api/management/force-model-prefix",

    // Quota exceeded
    QUOTA_EXCEEDED_SWITCH_PROJECT: "/api/management/quota-exceeded/switch-project",
    QUOTA_EXCEEDED_SWITCH_PREVIEW_MODEL: "/api/management/quota-exceeded/switch-preview-model",

    // Routing
    ROUTING_STRATEGY: "/api/management/routing/strategy",

    // OAuth
    OAUTH_EXCLUDED_MODELS: "/api/management/oauth-excluded-models",
    OAUTH_MODEL_ALIAS: "/api/management/oauth-model-alias",
    OAUTH_AUTH_URL: {
      CLAUDE: "/api/management/anthropic-auth-url?is_webui=true",
      GEMINI_CLI: "/api/management/gemini-cli-auth-url?project_id=ALL&is_webui=true",
      CODEX: "/api/management/codex-auth-url?is_webui=true",
      XAI: "/api/management/xai-auth-url?is_webui=true",
      ANTIGRAVITY: "/api/management/antigravity-auth-url?is_webui=true",
      KIMI: "/api/management/kimi-auth-url?is_webui=true",
      KIMI_AI: "/api/management/kimi-ai-auth-url?is_webui=true",
      DEVIN: "/api/management/devin-auth-url?is_webui=true",
      META: "/api/management/meta-auth-url?is_webui=true",
      COPILOT: "/api/management/copilot-auth-url?is_webui=true",
      KIRO: "/api/management/kiro-auth-url?is_webui=true",
      CURSOR: "/api/management/cursor-auth-url?is_webui=true",
    },

    // Auth files
    AUTH_FILES: "/api/management/auth-files",

    // Providers
    OPENAI_COMPATIBILITY: "/api/management/openai-compatibility",
    API_KEYS: "/api/management/api-keys",
  },
  PROXY: {
    STATUS: "/api/proxy/status",
  },
  CONFIG_SYNC: {
    TOKENS: "/api/config-sync/tokens",
  },
  CONFIG_SHARING: {
    PUBLISH: "/api/config-sharing/publish",
    SUBSCRIBE: "/api/config-sharing/subscribe",
  },
  MODEL_PREFERENCES: "/api/model-preferences",
  AGENT_CONFIG: "/api/agent-config",
  AGENT_CONFIG_SLIM: "/api/agent-config-slim",
  OH_MY_OPENCODE_PRESETS: "/api/oh-my-opencode/presets",
  CONTAINERS: {
    LIST: "/api/containers/list",
  },
  RESTART: "/api/restart",
  HEALTH: "/api/health",
} as const;
