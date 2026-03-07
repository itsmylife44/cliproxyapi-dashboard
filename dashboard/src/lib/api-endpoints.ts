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
  },
  USER: {
    API_KEYS: "/api/user/api-keys",
    CONFIG: "/api/user/config",
  },
  PROVIDERS: {
    KEYS: "/api/providers/keys",
    OAUTH: "/api/providers/oauth",
    OAUTH_IMPORT: "/api/providers/oauth/import",
    PERPLEXITY_COOKIE: "/api/providers/perplexity-cookie",
    PERPLEXITY_COOKIE_SYNC_MODELS: "/api/providers/perplexity-cookie/sync-models",
  },
  CUSTOM_PROVIDERS: {
    FETCH_MODELS: "/api/custom-providers/fetch-models",
    REORDER: "/api/custom-providers/reorder",
  },
  PROVIDER_GROUPS: {
    BASE: "/api/provider-groups",
    REORDER: "/api/provider-groups/reorder",
  },
  MANAGEMENT: {
    CONFIG: "/api/management/config",
    CONFIG_YAML: "/api/management/config.yaml",
    USAGE: "/api/management/usage",
    LOGS: "/api/management/logs",
    LOGGING_TO_FILE: "/api/management/logging-to-file",
    LATEST_VERSION: "/api/management/latest-version",
    OAUTH_CALLBACK: "/api/management/oauth-callback",
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
  CONTAINERS: {
    LIST: "/api/containers/list",
  },
  RESTART: "/api/restart",
  HEALTH: "/api/health",
} as const;
