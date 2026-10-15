import { isRecord } from "@/lib/utils";
import { decode } from "@/lib/plugin-store";

const FIELD_TYPES = ["string", "number", "integer", "boolean", "enum", "array", "object"] as const;
export type PluginConfigFieldType = (typeof FIELD_TYPES)[number];

/** One entry of a loaded plugin's `config_fields`; `name` is the key under plugins.configs.<id>. */
export interface PluginConfigField {
  name: string;
  type: PluginConfigFieldType;
  /** What the plugin uses while the key is unset. */
  default: unknown;
  enumValues: string[];
  description: string;
}

const isFieldType = (value: unknown): value is PluginConfigFieldType =>
  FIELD_TYPES.includes(value as PluginConfigFieldType);

/** Form values per field name: booleans as-is, everything else as text (arrays/objects as JSON). */
export type PluginConfigDraft = Record<string, string | boolean>;

export type PluginConfigFieldError = "invalidNumber" | "invalidInteger" | "invalidJson" | "notArray" | "notObject";

/** The value the plugin runs with: the stored key, else the field default. */
function effective(field: PluginConfigField, config: unknown): unknown {
  const stored = isRecord(config) ? config[field.name] : undefined;
  const value = stored ?? field.default;
  return field.type === "boolean" ? value === true : value;
}

export function toPluginConfigDraft(fields: PluginConfigField[], config: unknown): PluginConfigDraft {
  return Object.fromEntries(
    fields.map((field) => {
      const value = effective(field, config);
      if (typeof value === "boolean") return [field.name, value];
      if (value === undefined || value === null) return [field.name, ""];
      if (field.type === "array" || field.type === "object") return [field.name, JSON.stringify(value, null, 2)];
      return [field.name, String(value)];
    })
  );
}

/** Typed value of one form input; `undefined` = left empty, i.e. use the plugin default. */
function parseInput(field: PluginConfigField, raw: string | boolean): { value: unknown } | { error: PluginConfigFieldError } {
  if (typeof raw === "boolean") return { value: raw };
  if (raw.trim() === "") return { value: undefined };
  switch (field.type) {
    case "number":
    case "integer": {
      const n = Number(raw);
      if (!Number.isFinite(n)) return { error: "invalidNumber" };
      return field.type === "integer" && !Number.isInteger(n) ? { error: "invalidInteger" } : { value: n };
    }
    case "array":
    case "object": {
      let value: unknown;
      try {
        value = JSON.parse(raw);
      } catch {
        return { error: "invalidJson" };
      }
      if (field.type === "array" && !Array.isArray(value)) return { error: "notArray" };
      if (field.type === "object" && !isRecord(value)) return { error: "notObject" };
      return { value };
    }
    default:
      return { value: raw };
  }
}

/**
 * The PATCH /plugins/:id/config body for the fields the user changed (upstream merges it
 * shallowly; `null` deletes a key). Emptying a stored field sends `null` so the plugin falls
 * back to its default. Fields with invalid input land in `errors`; save only when it is empty.
 */
export function diffPluginConfig(
  fields: PluginConfigField[],
  config: unknown,
  draft: PluginConfigDraft
): { patch: Record<string, unknown>; errors: Record<string, PluginConfigFieldError> } {
  const patch: Record<string, unknown> = {};
  const errors: Record<string, PluginConfigFieldError> = {};
  for (const field of fields) {
    const parsed = parseInput(field, draft[field.name] ?? "");
    if ("error" in parsed) {
      errors[field.name] = parsed.error;
    } else if (parsed.value === undefined) {
      if (isRecord(config) && config[field.name] != null) patch[field.name] = null;
    } else if (JSON.stringify(parsed.value) !== JSON.stringify(effective(field, config))) {
      patch[field.name] = parsed.value;
    }
  }
  return { patch, errors };
}

/** Settings schema per plugin id from GET /plugins. Upstream fills it only for loaded plugins. */
export function parsePluginConfigFields(data: unknown): Record<string, PluginConfigField[]> {
  const result: Record<string, PluginConfigField[]> = {};
  if (!isRecord(data) || !Array.isArray(data.plugins)) return result;
  for (const p of data.plugins) {
    if (!isRecord(p) || typeof p.id !== "string" || p.registered !== true || !Array.isArray(p.config_fields)) continue;
    const fields = p.config_fields.flatMap((f): PluginConfigField[] =>
      isRecord(f) && typeof f.name === "string" && f.name && isFieldType(f.type)
        ? [{
            name: f.name,
            type: f.type,
            default: f.default ?? undefined,
            enumValues: Array.isArray(f.enum_values) ? f.enum_values.filter((v): v is string => typeof v === "string") : [],
            description: decode(f.description),
          }]
        : []
    );
    if (fields.length > 0) result[p.id] = fields;
  }
  return result;
}
