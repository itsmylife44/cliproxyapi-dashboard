import yaml from "js-yaml";
import { isRecord } from "@/lib/utils";

type ConfigYamlObject = Record<string, unknown>;

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

  if (!isRecord(parsed)) {
    throw new Error(
      "Invalid current config.yaml: root value is not a YAML mapping"
    );
  }

  return parsed;
}

/** auth-dir as stored in config.yaml (GET /config never returns it). The v8 path wins, like upstream. */
export function readAuthDir(rawYaml: string): string {
  const parsed = parseConfigYaml(rawYaml);
  const oauth = isRecord(parsed.oauth) ? parsed.oauth : {};
  const value = oauth["auth-dir"] ?? parsed["auth-dir"];
  return typeof value === "string" ? value : "";
}

// v8 locations of the legacy root keys the config page merges (subset of upstream
// buildV8Paths in internal/config/config_v8.go). On a v8 file the v8 path wins, so
// writing the legacy key there would be silently dropped.
const V8_PATHS: Record<string, string[]> = {
  "auth-dir": ["oauth", "auth-dir"],
  streaming: ["requests", "streaming"],
  "nonstream-keepalive-interval": ["requests", "nonstream-keepalive-interval"],
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

// Fields the editor owns wholesale: replace, so removed keys stay removed (upstream
// PUT /oauth-model-alias replaces too). Other objects are edited key by key and
// shallow-merged so YAML keys GET /config omits survive.
const REPLACE_FIELDS = new Set(["oauth-model-alias"]);

function setPath(target: ConfigYamlObject, path: string[], value: unknown, replace: boolean): ConfigYamlObject {
  const [head, ...rest] = path as [string, ...string[]];
  const current = target[head];
  if (rest.length > 0) {
    return { ...target, [head]: setPath(isRecord(current) ? current : {}, rest, value, replace) };
  }
  const merge = !replace && isRecord(value) && isRecord(current);
  return { ...target, [head]: merge ? { ...current, ...value } : value };
}

export function mergeConfigYaml(rawYaml: string, changes: ConfigYamlObject): string {
  let mergedConfig = parseConfigYaml(rawYaml);
  const isV8 = mergedConfig["config-version"] === 8;

  for (const [key, value] of Object.entries(changes)) {
    const v8Path = isV8 ? V8_PATHS[key] : undefined;
    mergedConfig = setPath(mergedConfig, v8Path ?? [key], value, REPLACE_FIELDS.has(key));
    if (v8Path) {
      const { [key]: _legacy, ...rest } = mergedConfig;
      void _legacy;
      mergedConfig = rest;
    }
  }

  return yaml.dump(mergedConfig, { lineWidth: -1, noRefs: true });
}
