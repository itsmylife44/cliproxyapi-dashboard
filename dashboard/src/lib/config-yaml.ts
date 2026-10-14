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

export function mergeConfigYaml(rawYaml: string, changes: ConfigYamlObject): string {
  const mergedConfig = { ...parseConfigYaml(rawYaml) };

  for (const [key, value] of Object.entries(changes)) {
    if (isPlainObject(value) && isPlainObject(mergedConfig[key])) {
      mergedConfig[key] = {
        ...(mergedConfig[key] as ConfigYamlObject),
        ...value,
      };
      continue;
    }

    mergedConfig[key] = value;
  }

  return yaml.dump(mergedConfig, { lineWidth: -1, noRefs: true });
}
