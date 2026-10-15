import { describe, expect, it } from "vitest";

import {
  applyPreset,
  buildOhMyOpenCodeConfig,
  UPSTREAM_AGENT_CHAINS,
  UPSTREAM_CATEGORY_CHAINS,
} from "../config-generators/oh-my-opencode";
import { getBundledOhMyOpenCodePresets } from "../config-generators/oh-my-opencode-presets";
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
});
