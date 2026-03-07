export interface StreamingConfig {
  "keepalive-seconds": number;
  "bootstrap-retries": number;
  "nonstream-keepalive-interval": number;
}

export interface QuotaExceededConfig {
  "switch-project": boolean;
  "switch-preview-model": boolean;
}

export interface RoutingConfig {
  strategy: string;
}

export interface TlsConfig {
  enable: boolean;
  cert: string;
  key: string;
}

export interface PprofConfig {
  enable: boolean;
  addr: string;
}

export interface ClaudeHeaderDefaults {
  "user-agent": string;
  "package-version": string;
  "runtime-version": string;
  timeout: string;
}

export interface AmpcodeConfig {
  "upstream-url": string;
  "upstream-api-key": string;
  "restrict-management-to-localhost": boolean;
  "model-mappings": unknown;
  "force-model-mappings": boolean;
}

export interface PayloadConfig {
  default: unknown;
  "default-raw": unknown;
  override: unknown;
  "override-raw": unknown;
  filter: unknown;
}

export interface OAuthModelAliasEntry {
  name: string;
  alias: string;
  fork?: boolean;
}

export interface Config {
  "proxy-url": string;
  "auth-dir": string;
  "force-model-prefix": boolean;
  streaming: StreamingConfig;
  debug: boolean;
  "commercial-mode": boolean;
  "logging-to-file": boolean;
  "logs-max-total-size-mb": number;
  "error-logs-max-files": number;
  "usage-statistics-enabled": boolean;
  "request-retry": number;
  "max-retry-interval": number;
  "quota-exceeded": QuotaExceededConfig;
  routing: RoutingConfig;
  "ws-auth": boolean;
  "disable-cooling": boolean;
  "request-log": boolean;
  "max-retry-credentials": number;
  "passthrough-headers": boolean;
  "incognito-browser": boolean;
  "kiro-preferred-endpoint": string;
  kiro: unknown;
  tls: TlsConfig;
  pprof: PprofConfig;
  "claude-header-defaults": ClaudeHeaderDefaults;
  ampcode: AmpcodeConfig;
  payload: PayloadConfig;
  "oauth-model-alias": Record<string, OAuthModelAliasEntry[]>;
}
