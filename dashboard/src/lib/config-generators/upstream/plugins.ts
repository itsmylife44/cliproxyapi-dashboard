/**
 * Pinned third-party OpenCode plugins. The vendored upstream schemas in this folder must match
 * these versions: bumping a version means updating the constant and re-vendoring its schema.
 * - oh-my-opencode.schema.json: github.com/code-yeongyu/oh-my-openagent tag v<OMO_VERSION>, assets/
 * - oh-my-opencode-slim.schema.json: npm oh-my-opencode-slim@<SLIM_VERSION>
 */
const OMO_VERSION = "5.1.33";
const SLIM_VERSION = "3.0.4";

const OMO_PACKAGE = "oh-my-openagent";
const SLIM_PACKAGE = "oh-my-opencode-slim";
const SYNC_PACKAGE = "opencode-cliproxyapi-sync";

export const OMO_PLUGIN = `${OMO_PACKAGE}@${OMO_VERSION}`;
export const SLIM_PLUGIN = `${SLIM_PACKAGE}@${SLIM_VERSION}`;
export const SYNC_PLUGIN = `${SYNC_PACKAGE}@latest`;

export const OMO_SCHEMA_URL = `https://raw.githubusercontent.com/code-yeongyu/oh-my-openagent/v${OMO_VERSION}/assets/oh-my-opencode.schema.json`;
export const SLIM_SCHEMA_URL = `https://unpkg.com/${SLIM_PACKAGE}@${SLIM_VERSION}/oh-my-opencode-slim.schema.json`;

/** "pkg@1.2.3" → "pkg", "@scope/pkg@latest" → "@scope/pkg". */
function packageName(entry: string): string {
  return entry.replace(/(?<=.)@.*$/, "");
}

export function isSlimPlugin(entry: string): boolean {
  return packageName(entry) === SLIM_PACKAGE;
}

export function isOmoPlugin(entry: string): boolean {
  return packageName(entry) === OMO_PACKAGE;
}

/** Maps any OMO/slim/sync entry (any version suffix) to its pinned entry; other plugins pass through. */
export function normalizePlugin(entry: string): string {
  if (isOmoPlugin(entry)) return OMO_PLUGIN;
  if (isSlimPlugin(entry)) return SLIM_PLUGIN;
  if (packageName(entry) === SYNC_PACKAGE) return SYNC_PLUGIN;
  return entry;
}

/** Plugin list for the sync bundle: sync plugin + exactly one of OMO/slim (slim if chosen), pinned and sorted. */
export function resolvePluginList(customPlugins: string[]): string[] {
  const plugins = new Set([SYNC_PLUGIN, ...customPlugins.map(normalizePlugin)]);
  if (plugins.has(SLIM_PLUGIN)) plugins.delete(OMO_PLUGIN);
  else plugins.add(OMO_PLUGIN);
  return Array.from(plugins).sort();
}
