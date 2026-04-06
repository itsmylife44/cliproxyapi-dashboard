import { beforeEach, describe, expect, it, vi } from "vitest";

import { getBundledOhMyOpenCodePresets, validatePresetList } from "../config-generators/oh-my-opencode-presets";

describe("oh-my-opencode presets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps permission and thinking fields from preset sources", () => {
    const presets = validatePresetList([
      {
        name: "custom",
        description: "Custom preset",
        config: {
          agents: {
            hephaestus: {
              model: "openai/gpt-5.4",
              permission: { edit: "allow", bash: { git: "allow", test: "allow" } },
            },
            oracle: {
              model: "openai/gpt-5.4",
              thinking: { type: "enabled", budgetTokens: 120000 },
            },
          },
        },
      },
    ]);

    expect(presets).toHaveLength(1);
    expect(presets[0].config.agents?.hephaestus?.permission).toEqual({
      edit: "allow",
      bash: { git: "allow", test: "allow" },
    });
    expect(presets[0].config.agents?.oracle?.thinking).toEqual({
      type: "enabled",
      budgetTokens: 120000,
    });
  });

  it("provides bundled fallback presets", () => {
    const presets = getBundledOhMyOpenCodePresets();

    expect(presets.length).toBeGreaterThan(0);
    expect(presets.some((preset) => preset.name === "default")).toBe(true);
  });

  it("rejects presets whose config sanitizes down to empty", () => {
    const presets = validatePresetList([
      {
        name: "empty",
        description: "Should be rejected",
        config: {
          agents: {
            sisyphus: {
              temperature: 999,
            },
          },
        },
      },
    ]);

    expect(presets).toEqual([]);
  });

  it("filters invalid preset entries while keeping valid ones", () => {
    const presets = validatePresetList([
      {
        name: "valid",
        description: "ok",
        config: {
          agents: {
            sisyphus: { model: "claude-opus-4.6" },
          },
        },
      },
      {
        name: 123,
        description: "no name",
        config: {
          agents: {
            sisyphus: { model: "claude-opus-4.6" },
          },
        },
      },
    ] as unknown[]);

    expect(presets).toHaveLength(1);
    expect(presets[0].name).toBe("valid");
  });

  it("returns bundled presets with valid structure", () => {
    const presets = getBundledOhMyOpenCodePresets();

    expect(presets.length).toBeGreaterThan(0);

    for (const preset of presets) {
      expect(typeof preset.name).toBe("string");
      expect(preset.name.length).toBeGreaterThan(0);
      expect(preset.config).toBeDefined();
      expect(typeof preset.config).toBe("object");
      expect(Array.isArray(preset.config)).toBe(false);
    }
  });

  it("strips unknown agent fields but keeps valid ones", () => {
    const presets = validatePresetList([
      {
        name: "test",
        description: "test",
        config: {
          agents: {
            sisyphus: {
              model: "claude-opus-4.6",
              unknownField: "should be stripped",
              temperature: 0.5,
            },
          },
        },
      },
    ]);

    expect(presets).toHaveLength(1);
    expect(presets[0].config.agents?.sisyphus?.temperature).toBe(0.5);
    expect("unknownField" in (presets[0].config.agents?.sisyphus ?? {})).toBe(false);
  });
});
