import { API_ENDPOINTS } from "@/lib/api-endpoints";
import { isRecord } from "@/lib/utils";

type ConfigObject = Record<string, unknown>;

export type ConfigWrite =
  | { kind: "endpoint"; endpoint: string; body: unknown }
  | { kind: "yaml"; changes: ConfigObject };

const FIELD_ENDPOINTS: Record<string, string> = {
  "proxy-url": API_ENDPOINTS.MANAGEMENT.PROXY_URL,
  "debug": API_ENDPOINTS.MANAGEMENT.DEBUG,
  "logging-to-file": API_ENDPOINTS.MANAGEMENT.LOGGING_TO_FILE,
  "logs-max-total-size-mb": API_ENDPOINTS.MANAGEMENT.LOGS_MAX_TOTAL_SIZE_MB,
  "error-logs-max-files": API_ENDPOINTS.MANAGEMENT.ERROR_LOGS_MAX_FILES,
  "usage-statistics-enabled": API_ENDPOINTS.MANAGEMENT.USAGE_STATISTICS_ENABLED,
  "request-retry": API_ENDPOINTS.MANAGEMENT.REQUEST_RETRY,
  "max-retry-interval": API_ENDPOINTS.MANAGEMENT.MAX_RETRY_INTERVAL,
  "max-retry-credentials": API_ENDPOINTS.MANAGEMENT.MAX_RETRY_CREDENTIALS,
  "request-log": API_ENDPOINTS.MANAGEMENT.REQUEST_LOG,
  "ws-auth": API_ENDPOINTS.MANAGEMENT.WS_AUTH,
  "force-model-prefix": API_ENDPOINTS.MANAGEMENT.FORCE_MODEL_PREFIX,
  "oauth-model-alias": API_ENDPOINTS.MANAGEMENT.OAUTH_MODEL_ALIAS,
};

const NESTED_FIELD_ENDPOINTS: Record<string, Record<string, string>> = {
  "quota-exceeded": {
    "switch-project": API_ENDPOINTS.MANAGEMENT.QUOTA_EXCEEDED_SWITCH_PROJECT,
    "switch-preview-model": API_ENDPOINTS.MANAGEMENT.QUOTA_EXCEEDED_SWITCH_PREVIEW_MODEL,
  },
  "routing": {
    "strategy": API_ENDPOINTS.MANAGEMENT.ROUTING_STRATEGY,
  },
};

const MERGE_ONLY_FIELDS = [
  "auth-dir", "streaming", "nonstream-keepalive-interval", "commercial-mode", "disable-cooling", "passthrough-headers",
  "tls", "pprof", "claude-header-defaults", "payload",
];

const isChanged = (a: unknown, b: unknown) => JSON.stringify(a) !== JSON.stringify(b);

/**
 * At most one management write per save. Upstream reloads asynchronously after each
 * write and can revert a write that lands during that reload, so back-to-back PUTs
 * lose edits. A lone endpoint-backed change uses its endpoint (no YAML rewrite);
 * anything else goes into a single config.yaml merge.
 */
export function planConfigSave(originalConfig: object, currentConfig: object): ConfigWrite[] {
  const original = originalConfig as ConfigObject;
  const current = currentConfig as ConfigObject;
  const changes: ConfigObject = {};
  const endpointWrites: ConfigWrite[] = [];

  for (const [key, endpoint] of Object.entries(FIELD_ENDPOINTS)) {
    if (!isChanged(original[key], current[key])) continue;
    changes[key] = current[key];
    // oauth-model-alias PUT takes the raw provider map as body, not { value }.
    const body = key === "oauth-model-alias" ? current[key] ?? {} : { value: current[key] };
    endpointWrites.push({ kind: "endpoint", endpoint, body });
  }

  for (const [parentKey, subFields] of Object.entries(NESTED_FIELD_ENDPOINTS)) {
    const oldParent = original[parentKey];
    const newParent = current[parentKey];
    if (!isRecord(oldParent) || !isRecord(newParent)) continue;
    for (const [subKey, endpoint] of Object.entries(subFields)) {
      if (!isChanged(oldParent[subKey], newParent[subKey])) continue;
      const parentChanges = isRecord(changes[parentKey]) ? changes[parentKey] : {};
      changes[parentKey] = { ...parentChanges, [subKey]: newParent[subKey] };
      endpointWrites.push({ kind: "endpoint", endpoint, body: { value: newParent[subKey] } });
    }
  }

  let mergeOnlyChanged = false;
  for (const key of MERGE_ONLY_FIELDS) {
    if (!isChanged(original[key], current[key])) continue;
    changes[key] = current[key];
    mergeOnlyChanged = true;
  }

  if (endpointWrites.length === 1 && !mergeOnlyChanged) return endpointWrites;
  return Object.keys(changes).length > 0 ? [{ kind: "yaml", changes }] : [];
}
