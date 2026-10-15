import { describe, expect, it } from "vitest";
import { diffPluginConfig, parsePluginConfigFields, toPluginConfigDraft, type PluginConfigField } from "../plugin-config";

const field = (name: string, type: PluginConfigField["type"], extra: Partial<PluginConfigField> = {}): PluginConfigField => ({
  name,
  type,
  default: undefined,
  enumValues: [],
  description: "",
  ...extra,
});

const FIELDS: PluginConfigField[] = [
  field("base_url", "string", { default: "https://api.example.com" }),
  field("token", "string"),
  field("ratio", "number"),
  field("retries", "integer", { default: 3 }),
  field("debug", "boolean"),
  field("mode", "enum", { enumValues: ["fast", "slow"], default: "fast" }),
  field("models", "array"),
  field("headers", "object"),
];

// What GET /plugins/zcode/config returns: plugin keys next to host-owned keys.
const CONFIG = {
  enabled: true,
  priority: 2,
  store: { source_id: "official", version: "1.0.0" },
  token: "abc",
  ratio: 0.5,
  debug: true,
  models: ["a", "b"],
  headers: { "x-team": "core" },
};

describe("parsePluginConfigFields", () => {
  it("maps each loaded plugin to its settings schema", () => {
    const fields = parsePluginConfigFields({
      plugins_enabled: true,
      plugins: [
        {
          id: "zcode",
          registered: true,
          config_fields: [
            { name: "base_url", type: "string", default: "https://api.example.com", description: "Upstream &amp; proxy URL" },
            { name: "mode", type: "enum", enum_values: ["fast", "slow"], default: "fast" },
            { name: "retries", type: "integer" },
          ],
        },
        { id: "no-fields", registered: true, config_fields: [] },
      ],
    });

    expect(fields).toEqual({
      zcode: [
        { name: "base_url", type: "string", default: "https://api.example.com", enumValues: [], description: "Upstream & proxy URL" },
        { name: "mode", type: "enum", default: "fast", enumValues: ["fast", "slow"], description: "" },
        { name: "retries", type: "integer", default: undefined, enumValues: [], description: "" },
      ],
    });
  });

  it("decodes escaped names, enum values and defaults so the plugin gets the raw values back", () => {
    // GET /plugins html-escapes name, enum_values and default strings; PATCH stores the body as sent
    // and the plugin compares against its own unescaped enum values.
    const fields = parsePluginConfigFields({
      plugins: [
        {
          id: "router",
          registered: true,
          config_fields: [
            { name: "r&amp;d_mode", type: "enum", enum_values: ["&lt;auto&gt;", "fill-first"], default: "&lt;auto&gt;" },
            { name: "headers", type: "object", default: { "x-q": "a&amp;b" } },
          ],
        },
      ],
    });

    expect(fields.router).toEqual([
      { name: "r&d_mode", type: "enum", default: "<auto>", enumValues: ["<auto>", "fill-first"], description: "" },
      { name: "headers", type: "object", default: { "x-q": "a&b" }, enumValues: [], description: "" },
    ]);
    const routerFields = fields.router ?? [];
    const draft = { ...toPluginConfigDraft(routerFields, {}), "r&d_mode": "fill-first" };
    expect(diffPluginConfig(routerFields, {}, draft)).toEqual({ patch: { "r&d_mode": "fill-first" }, errors: {} });
    expect(diffPluginConfig(routerFields, { "r&d_mode": "fill-first" }, { ...draft, "r&d_mode": "<auto>" }).patch).toEqual({
      "r&d_mode": "<auto>",
    });
  });

  it("ignores plugins that are not loaded, malformed fields and unknown field types", () => {
    const fields = parsePluginConfigFields({
      plugins: [
        { id: "on-disk-only", registered: false, config_fields: [{ name: "token", type: "string" }] },
        { id: "odd", registered: true, config_fields: [{ type: "string" }, { name: "x", type: "secret" }, "junk"] },
      ],
    });

    expect(fields).toEqual({});
  });

  it("returns nothing for a malformed response", () => {
    expect(parsePluginConfigFields(null)).toEqual({});
    expect(parsePluginConfigFields({ plugins: "nope" })).toEqual({});
  });
});

describe("plugin settings draft and diff", () => {
  it("prefills every field type and saves nothing when nothing changed", () => {
    const draft = toPluginConfigDraft(FIELDS, CONFIG);

    expect(draft).toEqual({
      base_url: "https://api.example.com",
      token: "abc",
      ratio: "0.5",
      retries: "3",
      debug: true,
      mode: "fast",
      models: '[\n  "a",\n  "b"\n]',
      headers: '{\n  "x-team": "core"\n}',
    });
    expect(diffPluginConfig(FIELDS, CONFIG, draft)).toEqual({ patch: {}, errors: {} });
  });

  it("sends only the changed fields, typed for the plugin, and never host-owned keys", () => {
    const draft = {
      ...toPluginConfigDraft(FIELDS, CONFIG),
      base_url: "https://proxy.internal",
      ratio: "1.25",
      retries: "5",
      debug: false,
      mode: "slow",
      models: '["c"]',
      headers: '{"x-team": "infra", "x-env": "prod"}',
    };

    expect(diffPluginConfig(FIELDS, CONFIG, draft)).toEqual({
      patch: {
        base_url: "https://proxy.internal",
        ratio: 1.25,
        retries: 5,
        debug: false,
        mode: "slow",
        models: ["c"],
        headers: { "x-team": "infra", "x-env": "prod" },
      },
      errors: {},
    });
  });

  it("rejects invalid input per field before anything is saved", () => {
    const draft = {
      ...toPluginConfigDraft(FIELDS, CONFIG),
      token: "changed",
      ratio: "fast",
      retries: "2.5",
      models: '["unterminated',
      headers: "[1, 2]",
    };

    expect(diffPluginConfig(FIELDS, CONFIG, draft).errors).toEqual({
      ratio: "invalidNumber",
      retries: "invalidInteger",
      models: "invalidJson",
      headers: "notObject",
    });
    expect(diffPluginConfig(FIELDS, CONFIG, { ...draft, models: '{"a": 1}' }).errors.models).toBe("notArray");
  });

  it.each(["0x10", "1e3", "0b11", "0o7", "Infinity", "1_000", "1 2", "12abc", "--1", "."])(
    "rejects the non-decimal number %j",
    (raw) => {
      const draft = { ...toPluginConfigDraft(FIELDS, CONFIG), ratio: raw, retries: raw };
      expect(diffPluginConfig(FIELDS, CONFIG, draft).errors).toEqual({ ratio: "invalidNumber", retries: "invalidNumber" });
    }
  );

  it("accepts plain decimals, signed and with surrounding spaces", () => {
    const draft = { ...toPluginConfigDraft(FIELDS, CONFIG), ratio: " -0.25 ", retries: "+7" };
    expect(diffPluginConfig(FIELDS, CONFIG, draft)).toEqual({ patch: { ratio: -0.25, retries: 7 }, errors: {} });
    expect(diffPluginConfig(FIELDS, CONFIG, { ...draft, ratio: ".75" }).patch.ratio).toBe(0.75);
  });

  it("treats a whitespace-only number as empty, never as 0", () => {
    const draft = { ...toPluginConfigDraft(FIELDS, CONFIG), ratio: " \t ", retries: "\n" };
    // ratio was stored: clear it; retries was not: nothing to send.
    expect(diffPluginConfig(FIELDS, CONFIG, draft)).toEqual({ patch: { ratio: null }, errors: {} });
  });

  it("deletes a stored key when its field is emptied, so the plugin default applies again", () => {
    const draft = { ...toPluginConfigDraft(FIELDS, CONFIG), token: "", ratio: " ", models: "", base_url: "" };

    // base_url was never stored: emptying it changes nothing.
    expect(diffPluginConfig(FIELDS, CONFIG, draft).patch).toEqual({ token: null, ratio: null, models: null });
  });

  it("prefills an unconfigured plugin from its defaults and saves nothing untouched", () => {
    const draft = toPluginConfigDraft(FIELDS, {});

    expect(draft).toMatchObject({ base_url: "https://api.example.com", token: "", retries: "3", debug: false, mode: "fast", models: "" });
    expect(diffPluginConfig(FIELDS, {}, draft).patch).toEqual({});
  });
});
