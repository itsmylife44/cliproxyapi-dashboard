import { describe, expect, it, vi } from "vitest";

import { buildSlimConfigChecked } from "./helpers/slim-schema-guard";
import { validateSlimConfig } from "../config-generators/oh-my-opencode-slim-types";
import { SlimAgentConfigSchema } from "../validation/schemas";
import { LEGACY_SLIM_OVERRIDES } from "./helpers/legacy-slim-overrides";
import { upstreamSchemaErrors } from "./helpers/upstream-schema";

vi.mock("server-only", () => ({}));

const DEAD_TOP_LEVEL_KEYS = [
  "scoringEngineVersion",
  "balanceProviderUsage",
  "manualPlan",
  "tmux",
  "background",
  "todoContinuation",
  "websearch",
];

describe("slim dead config keys", () => {
  it("generator drops dead keys present in stored config (legacy tmux becomes multiplexer)", () => {
    const config = buildSlimConfigChecked(["model-a", "model-b"], validateSlimConfig(LEGACY_SLIM_OVERRIDES));

    expect(config).not.toBeNull();
    for (const key of DEAD_TOP_LEVEL_KEYS) expect(config).not.toHaveProperty(key);
    expect(config?.multiplexer).toEqual({ type: "tmux", layout: "main-horizontal", main_pane_size: 55 });
    expect(config?.fallback).toEqual({ enabled: true, retryDelayMs: 500 });
    expect(config?.council).toEqual({
      presets: { default: { alpha: { model: "cliproxyapi/model-b" } } },
      default_preset: "default",
    });
    expect(upstreamSchemaErrors("slim", config)).toEqual([]);
  });

  it("the API schema accepts a legacy payload containing dead keys", () => {
    expect(() => SlimAgentConfigSchema.parse({ overrides: LEGACY_SLIM_OVERRIDES })).not.toThrow();
  });
});
