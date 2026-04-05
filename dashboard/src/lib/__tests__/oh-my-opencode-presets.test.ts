import { describe, expect, it } from "vitest";

import { getBundledOhMyOpenCodePresets, validatePresetList } from "../config-generators/oh-my-opencode-presets";

describe("oh-my-opencode presets", () => {
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
});
