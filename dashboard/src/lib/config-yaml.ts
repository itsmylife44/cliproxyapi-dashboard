import yaml from "js-yaml";

type ConfigYamlObject = Record<string, unknown>;

function isPlainObject(value: unknown): value is ConfigYamlObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function parseConfigYaml(rawYaml: string): ConfigYamlObject {
  if (!rawYaml.trim()) {
    return {};
  }

  try {
    const parsed = yaml.load(rawYaml);
    if (!isPlainObject(parsed)) {
      return {};
    }

    return parsed;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid current config.yaml: ${message}`);
  }
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
