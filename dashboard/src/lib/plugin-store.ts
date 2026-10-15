import { decodeHtmlEntities, extractApiError, isRecord } from "@/lib/utils";

/** CLIProxyAPI v8 sends `1|0` on every management response; `0` = built without cgo, can never load a plugin. */
export const PLUGIN_SUPPORT_HEADER = "X-CPA-SUPPORT-PLUGIN";

/** Only an explicit `0` means unsupported; older CLIProxyAPI sends no header. */
export function pluginsSupported(res: Response): boolean {
  return res.headers.get(PLUGIN_SUPPORT_HEADER) !== "0";
}

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
            sourceId: decodeHtmlEntities(p.source_id),
            name: decodeHtmlEntities(p.name) || p.id,
            description: decodeHtmlEntities(p.description),
            author: decodeHtmlEntities(p.author),
            version: decodeHtmlEntities(p.version),
            installedVersion: decodeHtmlEntities(p.installed_version),
            tags: Array.isArray(p.tags) ? p.tags.map(decodeHtmlEntities).filter(Boolean) : [],
            installed: p.installed === true,
            enabled: p.enabled === true,
            active: p.effective_enabled === true && p.registered === true,
            loaded: p.registered === true,
            updateAvailable: p.update_available === true,
          }]
        : []
    ),
    sourceErrors: errors.flatMap((e) =>
      isRecord(e) ? [`${decodeHtmlEntities(e.source_name) || decodeHtmlEntities(e.source_id)}: ${decodeHtmlEntities(e.message)}`] : []
    ),
  };
}

/** Upstream plugin errors are `{error: code, message}`; the message is the useful part. */
export function pluginErrorMessage(data: unknown, fallback: string): string {
  return isRecord(data) && typeof data.message === "string" && data.message ? decodeHtmlEntities(data.message) : extractApiError(data, fallback);
}

/** Plugins an action should leave settled, and the global switch state it should leave behind. */
export interface PluginTarget {
  ids: string[];
  pluginsEnabled?: boolean;
  /** An update is done only once the store reports this installed version. */
  installedVersion?: string;
}

/** Ids from the target whose load state (or installed version) does not yet match. */
function unsettled(view: PluginStoreView, target: PluginTarget): string[] {
  if (target.pluginsEnabled !== undefined && view.pluginsEnabled !== target.pluginsEnabled) return target.ids;
  return target.ids.filter((id) => {
    const row = view.rows.find((r) => r.id === id);
    if (row === undefined) return false;
    if (target.installedVersion !== undefined && row.installedVersion !== target.installedVersion) return true;
    return row.loaded !== (view.pluginsEnabled && row.installed && row.enabled);
  });
}

/**
 * Least time actions stay locked after any plugin config write. A write that lands while
 * upstream still reloads the previous one can roll it back (router-for-me/CLIProxyAPI#6631):
 * the reload re-reads config.yaml after a 150 ms file-watch debounce and a 1 s server-update
 * debounce. Writes 1.5 s apart survived in the issue's repro; 2 s adds margin over that.
 */
export const PLUGIN_SETTLE_MIN_MS = 2000;

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Upstream answers plugin writes before its async hot reload loads or unloads the library,
 * so poll the store until every target plugin is loaded exactly when its switches say so,
 * and for at least PLUGIN_SETTLE_MIN_MS. `pending` lists the ids still unsettled when
 * `timeoutMs` ran out (empty on success).
 */
export async function waitForPluginState(
  fetchView: () => Promise<PluginStoreView | null>,
  target: PluginTarget,
  { intervalMs = 1000, timeoutMs = 30000, sleep = defaultSleep } = {}
): Promise<{ view: PluginStoreView | null; pending: string[] }> {
  let view: PluginStoreView | null = null;
  let pending = target.ids;
  for (let waited = intervalMs; waited <= timeoutMs; waited += intervalMs) {
    await sleep(intervalMs);
    view = (await fetchView()) ?? view;
    pending = view ? unsettled(view, target) : target.ids;
    if (pending.length === 0 && waited >= PLUGIN_SETTLE_MIN_MS) break;
  }
  return { view, pending };
}
