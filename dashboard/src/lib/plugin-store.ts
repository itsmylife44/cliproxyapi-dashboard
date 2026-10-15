import { isRecord } from "@/lib/config-generators/shared";
import { extractApiError } from "@/lib/utils";

/** One plugin from CLIProxyAPI's GET /plugin-store, with display strings decoded. */
export interface PluginRow {
  id: string;
  sourceId: string;
  name: string;
  description: string;
  author: string;
  version: string;
  installedVersion: string;
  tags: string[];
  installed: boolean;
  /** plugins.configs.<id>.enabled */
  enabled: boolean;
  /** Loaded and serving: needs the global switch on and a library built for the host. */
  active: boolean;
  updateAvailable: boolean;
}

export interface PluginStoreView {
  pluginsEnabled: boolean;
  rows: PluginRow[];
  sourceErrors: string[];
}

const ENTITIES: Record<string, string> = { "&lt;": "<", "&gt;": ">", "&#39;": "'", "&#34;": '"', "&amp;": "&" };

/** Reverses Go's html.EscapeString, which upstream applies to every store display string. */
function decode(value: unknown): string {
  return typeof value === "string" ? value.replace(/&(lt|gt|#39|#34|amp);/g, (m) => ENTITIES[m] ?? m) : "";
}

export function parsePluginStore(data: unknown): PluginStoreView {
  if (!isRecord(data)) return { pluginsEnabled: false, rows: [], sourceErrors: [] };
  const entries = Array.isArray(data.plugins) ? data.plugins : [];
  const errors = Array.isArray(data.source_errors) ? data.source_errors : [];
  return {
    pluginsEnabled: data.plugins_enabled === true,
    rows: entries.flatMap((p) =>
      isRecord(p) && typeof p.id === "string" && p.id
        ? [{
            id: p.id,
            sourceId: decode(p.source_id),
            name: decode(p.name) || p.id,
            description: decode(p.description),
            author: decode(p.author),
            version: decode(p.version),
            installedVersion: decode(p.installed_version),
            tags: Array.isArray(p.tags) ? p.tags.map(decode).filter(Boolean) : [],
            installed: p.installed === true,
            enabled: p.enabled === true,
            active: p.effective_enabled === true && p.registered === true,
            updateAvailable: p.update_available === true,
          }]
        : []
    ),
    sourceErrors: errors.flatMap((e) =>
      isRecord(e) ? [`${decode(e.source_name) || decode(e.source_id)}: ${decode(e.message)}`] : []
    ),
  };
}

/** Upstream plugin errors are `{error: code, message}`; the message is the useful part. */
export function pluginErrorMessage(data: unknown, fallback: string): string {
  return isRecord(data) && typeof data.message === "string" && data.message ? decode(data.message) : extractApiError(data, fallback);
}
