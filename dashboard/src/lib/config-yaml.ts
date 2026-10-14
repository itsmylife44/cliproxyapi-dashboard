import yaml from "js-yaml";

type ConfigYamlObject = Record<string, unknown>;

function isPlainObject(value: unknown): value is ConfigYamlObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function parseConfigYaml(rawYaml: string): ConfigYamlObject {
  if (!rawYaml.trim()) {
    return {};
  }

  let parsed: unknown;
  try {
    parsed = yaml.load(rawYaml);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid current config.yaml: ${message}`);
  }

  if (!isPlainObject(parsed)) {
    throw new Error(
      "Invalid current config.yaml: root value is not a YAML mapping"
    );
  }

  return parsed;
}

/** auth-dir as stored in config.yaml (GET /config never returns it). The v8 path wins, like upstream. */
export function readAuthDir(rawYaml: string): string {
  const parsed = parseConfigYaml(rawYaml);
  const oauth = isPlainObject(parsed.oauth) ? parsed.oauth : {};
  const value = oauth["auth-dir"] ?? parsed["auth-dir"];
  return typeof value === "string" ? value : "";
}

// v8 locations of the legacy root keys the config page merges (subset of upstream
// buildV8Paths in internal/config/config_v8.go). On a v8 file the v8 path wins, so
// writing the legacy key there would be silently dropped.
const V8_PATHS: Record<string, string[]> = {
  "auth-dir": ["oauth", "auth-dir"],
  streaming: ["requests", "streaming"],
  "commercial-mode": ["server", "commercial-mode"],
  "disable-cooling": ["routing", "cooldown", "disable-cooling"],
  "passthrough-headers": ["requests", "passthrough-headers"],
  tls: ["server", "tls"],
  pprof: ["observability", "pprof"],
  "claude-header-defaults": ["upstream", "claude", "header-defaults"],
  payload: ["requests", "payload"],
  "proxy-url": ["requests", "proxy-url"],
  debug: ["observability", "logs", "debug"],
  "logging-to-file": ["observability", "logs", "logging-to-file"],
  "logs-max-total-size-mb": ["observability", "logs", "logs-max-total-size-mb"],
  "error-logs-max-files": ["observability", "logs", "error-logs-max-files"],
  "request-log": ["observability", "logs", "request-log"],
  "usage-statistics-enabled": ["observability", "usage", "usage-statistics-enabled"],
  "redis-usage-queue-retention-seconds": ["observability", "usage", "redis-usage-queue-retention-seconds"],
  "request-retry": ["routing", "retry", "request-retry"],
  "max-retry-interval": ["routing", "retry", "max-retry-interval"],
  "max-retry-credentials": ["routing", "retry", "max-retry-credentials"],
  "force-model-prefix": ["routing", "force-model-prefix"],
  "ws-auth": ["oauth", "providers", "aistudio", "ws-auth"],
  "oauth-model-alias": ["oauth", "model-alias"],
  // quota-exceeded.* and routing.strategy live on roots shared with the legacy layout.
};

function mergeValue(target: ConfigYamlObject, key: string, value: unknown): void {
  const current = target[key];
  target[key] = isPlainObject(value) && isPlainObject(current) ? { ...current, ...value } : value;
}

export function mergeConfigYaml(rawYaml: string, changes: ConfigYamlObject): string {
  const mergedConfig = parseConfigYaml(rawYaml);
  const isV8 = mergedConfig["config-version"] === 8;

  for (const [key, value] of Object.entries(changes)) {
    const v8Path = isV8 ? V8_PATHS[key] : undefined;
    if (!v8Path) {
      mergeValue(mergedConfig, key, value);
      continue;
    }

    let parent = mergedConfig;
    for (const segment of v8Path.slice(0, -1)) {
      const next = parent[segment];
      parent = parent[segment] = isPlainObject(next) ? next : {};
    }
    mergeValue(parent, v8Path[v8Path.length - 1] ?? key, value);
    delete mergedConfig[key];
  }

  return yaml.dump(mergedConfig, { lineWidth: -1, noRefs: true });
}
