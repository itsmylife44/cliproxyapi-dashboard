import { API_ENDPOINTS } from "@/lib/api-endpoints";
import { mergeConfigYaml } from "@/lib/config-yaml";

/**
 * The one read-merge-write of config.yaml through the dashboard's management proxy (client side):
 * GET the raw file, merge `changes`, PUT it back. `step` says which request `res` came from,
 * so callers can tell a failed read from a failed write.
 */
export async function writeConfigYamlChanges(
  changes: Record<string, unknown>
): Promise<{ step: "read" | "write"; res: Response }> {
  const raw = await fetch(API_ENDPOINTS.MANAGEMENT.CONFIG_YAML);
  if (!raw.ok) return { step: "read", res: raw };
  const res = await fetch(API_ENDPOINTS.MANAGEMENT.CONFIG_YAML, {
    method: "PUT",
    headers: { "Content-Type": "text/yaml" },
    body: mergeConfigYaml(await raw.text(), changes),
  });
  return { step: "write", res };
}
