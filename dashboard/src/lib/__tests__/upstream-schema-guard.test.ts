import { describe, expect, it } from "vitest";

import {
  applyPreset,
  buildOhMyOpenCodeConfig,
  UPSTREAM_AGENT_CHAINS,
  UPSTREAM_CATEGORY_CHAINS,
} from "../config-generators/oh-my-opencode";
import { getBundledOhMyOpenCodePresets } from "../config-generators/oh-my-opencode-presets";
import { buildSlimConfig } from "../config-generators/oh-my-opencode-slim";
import { upstreamSchemaErrors } from "./helpers/upstream-schema";

const ALL_CHAIN_MODELS = [
  ...new Set([...Object.values(UPSTREAM_AGENT_CHAINS), ...Object.values(UPSTREAM_CATEGORY_CHAINS)].flat()),
];

const BUILT_IN_PRESETS = getBundledOhMyOpenCodePresets();

describe("upstream schema guard: OMO", () => {
  it("covers all three built-in presets", () => {
    expect(BUILT_IN_PRESETS.map((preset) => preset.name)).toEqual(["default", "coding-focused", "planning-focused"]);
  });

  it.each(BUILT_IN_PRESETS.map((preset) => [preset.name, preset] as const))(
    "built-in preset %s validates against the vendored schema",
    (_name, preset) => {
      const config = buildOhMyOpenCodeConfig(ALL_CHAIN_MODELS, applyPreset(preset));

      expect(config).not.toBeNull();
      expect(upstreamSchemaErrors("omo", config)).toEqual([]);
    },
  );

  it.each(BUILT_IN_PRESETS.map((preset) => [preset.name, preset] as const))(
    "built-in preset %s only uses 5.1.33 chain models and categories",
    (_name, preset) => {
      const { agents = {}, categories = {} } = preset.config;
      const models = [
        ...Object.values(agents).flatMap((entry) => [entry.model, entry.ultrawork?.model]),
        ...Object.values(categories).map((entry) => entry.model),
      ].filter((m): m is string => typeof m === "string");

      expect(models.filter((m) => !ALL_CHAIN_MODELS.includes(m))).toEqual([]);
      expect(Object.keys(categories).filter((c) => !(c in UPSTREAM_CATEGORY_CHAINS))).toEqual([]);
    },
  );
});

describe("upstream schema guard: slim", () => {
  it("a config with stored fallback chains validates against the vendored schema", () => {
    const config = buildSlimConfig(["model-a", "model-b"], {
      presets: { cliproxyapi: { orchestrator: { model: ["model-a", { id: "model-b", variant: "high" }] } } },
      agents: { oracle: { model: "model-b" } },
      fallback: {
        enabled: true,
        chains: { orchestrator: ["model-b", "external/model-x"], oracle: ["model-a"] },
      },
    });

    expect(config).not.toBeNull();
    expect(upstreamSchemaErrors("slim", config)).toEqual([]);
  });
});
