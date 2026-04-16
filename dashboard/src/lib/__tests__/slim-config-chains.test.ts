import { describe, expect, it } from "vitest";
import { buildSlimConfig } from "../config-generators/oh-my-opencode-slim";
import type { OhMyOpenCodeSlimFullConfig } from "../config-generators/oh-my-opencode-slim-types";

function expectGeneratedConfig(config: ReturnType<typeof buildSlimConfig>): OhMyOpenCodeSlimFullConfig {
  expect(config).not.toBeNull();
  return config as OhMyOpenCodeSlimFullConfig;
}

describe("buildSlimConfig – fallback chains behavior", () => {
  it("should passthrough external models and prefix available ones", () => {
    const available = ["model-a", "model-b"];
    const config = buildSlimConfig(available, {
      fallback: {
        enabled: true,
        chains: {
          // "model-x" is NOT in available — treated as external, passed through as-is
          orchestrator: ["model-x", "model-y"],
          // "model-a" IS available — prefixed with cliproxyapi/
          oracle: ["model-a", "model-b"],
        },
      },
    });

    expect(config).not.toBeNull();
    const fallback = (config as Record<string, unknown>).fallback as Record<string, unknown>;
    expect(fallback).toBeDefined();

    const chains = fallback.chains as Record<string, string[]> | undefined;

    // Both chains should be present
    expect(chains).toBeDefined();
    // Available models get prefixed
    expect(chains!.oracle).toEqual(["cliproxyapi/model-a", "cliproxyapi/model-b"]);
    // External models are passed through as-is (not prefixed)
    expect(chains!.orchestrator).toEqual(["model-x", "model-y"]);
  });

  it("should preserve chains with all external models", () => {
    const available = ["model-a"];
    const config = buildSlimConfig(available, {
      fallback: {
        enabled: true,
        chains: {
          // All models are external (not in available)
          orchestrator: ["model-x"],
          oracle: ["model-y"],
        },
      },
    });

    expect(config).not.toBeNull();
    const fallback = (config as Record<string, unknown>).fallback as Record<string, unknown>;
    expect(fallback).toBeDefined();
    
    const chains = fallback.chains as Record<string, string[]> | undefined;
    // External models are passed through as-is
    expect(chains).toBeDefined();
    expect(chains!.orchestrator).toEqual(["model-x"]);
    expect(chains!.oracle).toEqual(["model-y"]);
  });
});

describe("buildSlimConfig – preset and global override semantics", () => {
  const available = ["model-a", "model-b"];

  it("should use overrides.preset for active preset selection", () => {
    const config = buildSlimConfig(available, {
      preset: "custom",
      presets: {
        custom: {
          orchestrator: { model: "model-a" },
        },
        cliproxyapi: {
          orchestrator: { model: "model-b" },
        },
      },
    }, { presetName: "cliproxyapi" });

    const generated = expectGeneratedConfig(config);
    expect(generated.preset).toBe("custom");
    expect(generated.presets?.custom?.orchestrator?.model).toBe("cliproxyapi/model-a");
  });

  it("should fall back to options.presetName when overrides.preset is missing", () => {
    const config = buildSlimConfig(available, {}, { presetName: "fallback" });

    const generated = expectGeneratedConfig(config);
    expect(generated.preset).toBe("fallback");
  });

  it("should prioritize root agents over preset agents (upstream semantics)", () => {
    const config = buildSlimConfig(available, {
      preset: "test",
      presets: {
        test: {
          orchestrator: { model: "model-a", variant: "preset" },
        },
      },
      agents: {
        orchestrator: { model: "model-b", variant: "root" },
      },
    });

    const generated = expectGeneratedConfig(config);
    // Root agents should override presets at runtime and be emitted separately.
    expect(generated.agents).toBeDefined();
    expect(generated.agents?.orchestrator.model).toBe("cliproxyapi/model-b");
    expect(generated.agents?.orchestrator.variant).toBe("root");
    expect(generated.presets?.test?.orchestrator?.model).toBe("cliproxyapi/model-a");
    expect(generated.presets?.test?.orchestrator?.variant).toBe("preset");
  });

  it("should preserve explicit advanced agent configs", () => {
    const config = buildSlimConfig(available, {
      agents: {
        observer: { model: "external/observer-model" },
        councillor: { model: "model-a" },
      },
    });

    const generated = expectGeneratedConfig(config);
    expect(generated.agents?.observer.model).toBe("external/observer-model");
    expect(generated.agents?.councillor.model).toBe("cliproxyapi/model-a");
  });

  it("preserves partial root overrides without inventing a new model", () => {
    const config = buildSlimConfig(available, {
      preset: "test",
      presets: {
        test: {
          oracle: { model: "model-a" },
        },
      },
      agents: {
        oracle: { variant: "high" },
      },
    });

    const generated = expectGeneratedConfig(config);
    expect(generated.presets?.test?.oracle?.model).toBe("cliproxyapi/model-a");
    expect(generated.agents?.oracle).toEqual({ variant: "high" });
  });

  it("preserves council master overrides without a model", () => {
    const config = buildSlimConfig(available, {
      council: {
        master: {
          variant: "high-precision",
          prompt: "Coordinate the council.",
        },
        presets: {
          default: {
            councillors: {
              alpha: { model: "model-a" },
            },
          },
        },
      },
    });

    const generated = expectGeneratedConfig(config);
    expect(generated.council).toBeDefined();
    expect(generated.council?.master).toEqual({
      variant: "high-precision",
      prompt: "Coordinate the council.",
    });
  });

  it("should handle disabled_agents field", () => {
    const config = buildSlimConfig(available, {
      disabled_agents: ["observer", "councillor"],
    });

    const generated = expectGeneratedConfig(config);
    expect(generated.disabled_agents).toEqual(["observer", "councillor"]);
  });
});