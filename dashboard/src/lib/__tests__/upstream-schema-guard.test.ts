import { describe, expect, it } from "vitest";

import {
  applyPreset,
  UPSTREAM_AGENT_CHAINS,
  UPSTREAM_CATEGORY_CHAINS,
} from "../config-generators/oh-my-opencode";
import { getBundledOhMyOpenCodePresets } from "../config-generators/oh-my-opencode-presets";
import { validateFullConfig } from "../config-generators/oh-my-opencode-types";
import { buildOhMyOpenCodeConfig } from "./helpers/omo-schema-guard";
import { buildSlimConfig } from "./helpers/slim-schema-guard";
import { deprecatedOmoKeys, upstreamSchemaErrors } from "./helpers/upstream-schema";

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

  it("a legacy stored config with values removed upstream validates against the vendored schema", () => {
    const stored = {
      agents: { sisyphus: { permission: { edit: "prompt", bash: { git: "prompt", test: "allow" } } } },
      disabled_commands: ["init-deep", "start-work"],
      disabled_skills: ["agent-browser", "frontend-ui-ux"],
      disabled_hooks: ["context-window-monitor", "ralph-loop"],
      browser_automation_engine: { provider: "agent-browser" },
      lsp: { typescript: { command: ["typescript-language-server", "--stdio"] } },
    };

    const config = buildOhMyOpenCodeConfig(ALL_CHAIN_MODELS, validateFullConfig(stored));

    expect(upstreamSchemaErrors("omo", config)).toEqual([]);
  });

  it("a legacy stored config with deprecated model fields validates and emits none of them", () => {
    const stored = {
      agents: {
        sisyphus: {
          model: "kimi-k3",
          variant: "max",
          temperature: 0.7,
          fallback_models: ["glm-5.2"],
          thinking: { type: "enabled", budgetTokens: 32000 },
          ultrawork: { model: "claude-opus-5-5", variant: "max", temperature: 0.5 },
        },
        oracle: { thinking: { type: "disabled" } },
      },
      categories: { deep: { model: "gpt-5.6-sol", variant: "high", temperature: 0.3, fallback_models: ["kimi-k3"] } },
    };

    const config = buildOhMyOpenCodeConfig(ALL_CHAIN_MODELS, validateFullConfig(stored));

    expect(upstreamSchemaErrors("omo", config)).toEqual([]);
    expect(deprecatedOmoKeys(config)).toEqual([]);
  });

  it.each(BUILT_IN_PRESETS.map((preset) => [preset.name, preset] as const))(
    "built-in preset %s emits no deprecated model fields",
    (_name, preset) => {
      const config = buildOhMyOpenCodeConfig(ALL_CHAIN_MODELS, applyPreset(preset));

      expect(deprecatedOmoKeys(config)).toEqual([]);
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
