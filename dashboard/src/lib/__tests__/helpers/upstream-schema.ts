import Ajv from "ajv";
import Ajv2020 from "ajv/dist/2020";

import omoSchema from "@/lib/config-generators/upstream/oh-my-opencode.schema.json";
import slimSchema from "@/lib/config-generators/upstream/oh-my-opencode-slim.schema.json";

// OMO ships a draft-07 schema, slim a draft 2020-12 one.
const validators = {
  omo: new Ajv({ allErrors: true, strict: false, validateFormats: false }).compile(omoSchema),
  slim: new Ajv2020({ allErrors: true, strict: false, validateFormats: false }).compile(slimSchema),
};

/** Validates a generated config against the vendored upstream schema; returns readable errors (empty = valid). */
export function upstreamSchemaErrors(kind: keyof typeof validators, config: unknown): string[] {
  const validate = validators[kind];
  if (validate(config)) return [];
  return (validate.errors ?? []).map((e) => `${e.instancePath || "/"} ${e.message} ${JSON.stringify(e.params)}`);
}

const DEPRECATED_OMO_KEYS = new Set(["variant", "fallback_models", "thinking"]);

/** Paths of keys OMO 5.x deprecates; provider options are free-form, so `providerOptions.thinking` is fine. */
export function deprecatedOmoKeys(value: unknown, path = ""): string[] {
  if (Array.isArray(value)) return value.flatMap((item, i) => deprecatedOmoKeys(item, `${path}[${i}]`));
  if (typeof value !== "object" || value === null) return [];
  return Object.entries(value).flatMap(([key, child]) => {
    const childPath = path ? `${path}.${key}` : key;
    if (DEPRECATED_OMO_KEYS.has(key)) return [childPath];
    return key === "providerOptions" ? [] : deprecatedOmoKeys(child, childPath);
  });
}
