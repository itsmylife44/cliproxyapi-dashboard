import { isRecord } from "@/lib/utils";
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
  /** `registered`: the host has the library loaded, whatever the switches say. */
  loaded: boolean;
  updateAvailable: boolean;
}

export interface PluginStoreView {
  pluginsEnabled: boolean;
  rows: PluginRow[];
  sourceErrors: string[];
}

const ENTITIES: Record<string, string> = { "&lt;": "<", "&gt;": ">", "&#39;": "'", "&#34;": '"', "&amp;": "&" };

/** Reverses Go's html.EscapeString, which upstream applies to every store display string. */
export function decode(value: unknown): string {
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
            loaded: p.registered === true,
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

/** Plugins an action should leave settled, and the global switch state it should leave behind. */
export interface PluginTarget {
  ids: string[];
  pluginsEnabled?: boolean;
}

/** Ids from the target whose load state does not yet match their switches. */
function unsettled(view: PluginStoreView, target: PluginTarget): string[] {
  if (target.pluginsEnabled !== undefined && view.pluginsEnabled !== target.pluginsEnabled) return target.ids;
  return target.ids.filter((id) => {
    const row = view.rows.find((r) => r.id === id);
    return row !== undefined && row.loaded !== (view.pluginsEnabled && row.installed && row.enabled);
  });
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Upstream answers plugin writes before its async hot reload loads or unloads the library,
 * so poll the store until every target plugin is loaded exactly when its switches say so.
 * `pending` lists the ids still unsettled when `timeoutMs` ran out (empty on success).
 */
export async function waitForPluginState(
  fetchView: () => Promise<PluginStoreView | null>,
  target: PluginTarget,
  { intervalMs = 1000, timeoutMs = 30000, sleep = defaultSleep } = {}
): Promise<{ view: PluginStoreView | null; pending: string[] }> {
  let view: PluginStoreView | null = null;
  let pending = target.ids;
  for (let waited = 0; waited < timeoutMs; waited += intervalMs) {
    await sleep(intervalMs);
    view = (await fetchView()) ?? view;
    pending = view ? unsettled(view, target) : target.ids;
    if (pending.length === 0) break;
  }
  return { view, pending };
}
