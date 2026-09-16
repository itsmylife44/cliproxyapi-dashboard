import { describe, expect, it } from "vitest";
import { buildSlimConfig } from "../config-generators/oh-my-opencode-slim";
import type { OhMyOpenCodeSlimFullConfig } from "../config-generators/oh-my-opencode-slim-types";

function expectGeneratedConfig(config: ReturnType<typeof buildSlimConfig>): OhMyOpenCodeSlimFullConfig {
  expect(config).not.toBeNull();
  return config as OhMyOpenCodeSlimFullConfig;
}

describe("buildSlimConfig – fallback behavior", () => {
  it("emits only the currently supported global fallback fields", () => {
    const config = buildSlimConfig(["model-a"], {
      fallback: {
        enabled: true,
        maxRetries: 5,
        initialRetryDelayMs: 250,
        retryDelayMs: 750,
      },
    });

    expect(config).not.toBeNull();
    const fallback = (config as Record<string, unknown>).fallback as Record<string, unknown>;
    expect(fallback).toEqual({
      enabled: true,
      maxRetries: 5,
      initialRetryDelayMs: 250,
      retryDelayMs: 750,
    });
  });

  it("never emits fallback chains, timeoutMs, retry_on_empty or runtimeOverride", () => {
    // Legacy shapes are migrated on read; the generator must not re-emit them.
    const config = buildSlimConfig(["model-a"], {
      fallback: {
        enabled: true,
        chains: { orchestrator: ["model-a"] },
        timeoutMs: 15000,
        retry_on_empty: true,
        runtimeOverride: true,
      } as OhMyOpenCodeSlimFullConfig["fallback"],
    });

    const fallback = (config as Record<string, unknown>).fallback as Record<string, unknown>;
    expect(fallback).not.toHaveProperty("chains");
    expect(fallback).not.toHaveProperty("timeoutMs");
    expect(fallback).not.toHaveProperty("retry_on_empty");
    expect(fallback).not.toHaveProperty("runtimeOverride");
  });

  it("expresses per-agent fallback order through the agent model array", () => {
    const config = buildSlimConfig(["model-a", "model-b"], {
      preset: "chained",
      presets: {
        chained: {
          orchestrator: { model: ["model-a", "model-b"] },
        },
      },
    });

    expect(config).not.toBeNull();
    const presets = (config as Record<string, unknown>).presets as Record<
      string,
      Record<string, { model?: unknown }>
    >;
    expect(presets.chained!.orchestrator!.model).toEqual([
      "cliproxyapi/model-a",
      "cliproxyapi/model-b",
    ]);
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
    const agents = generated.agents;
    // Root agents should override presets at runtime and be emitted separately.
    expect(agents).toBeDefined();
    const orchestrator = agents!.orchestrator;
    expect(orchestrator).toBeDefined();
    expect(orchestrator!.model).toBe("cliproxyapi/model-b");
    expect(orchestrator!.variant).toBe("root");
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
    const agents = generated.agents;
    expect(agents).toBeDefined();
    const observer = agents!.observer;
    const councillor = agents!.councillor;
    expect(observer).toBeDefined();
    expect(councillor).toBeDefined();
    expect(observer!.model).toBe("external/observer-model");
    expect(councillor!.model).toBe("cliproxyapi/model-a");
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

  it("emits council presets with flat councillor names and a default preset", () => {
    const config = buildSlimConfig(available, {
      council: {
        default_preset: "default",
        presets: {
          default: {
            alpha: { model: "model-a" },
            council: { variant: "high", prompt: "Coordinate the council." },
          },
        },
      },
    });

    const generated = expectGeneratedConfig(config);
    expect(generated.council).toEqual({
      default_preset: "default",
      presets: {
        default: {
          alpha: { model: "cliproxyapi/model-a" },
          council: { variant: "high", prompt: "Coordinate the council." },
        },
      },
    });
  });

  it("never emits council master or nested councillors structures", () => {
    const config = buildSlimConfig(available, {
      council: {
        presets: {
          default: { alpha: { model: "model-a" } },
        },
      },
    });

    const council = (config as Record<string, unknown>).council as Record<string, unknown>;
    expect(council).not.toHaveProperty("master");
    expect(council).not.toHaveProperty("master_timeout");
    expect(council).not.toHaveProperty("councillors_timeout");
    expect(council).not.toHaveProperty("master_fallback");
    expect(council).not.toHaveProperty("councillor_execution_mode");
    expect(council).not.toHaveProperty("councillor_retries");
    const defaultPreset = (council.presets as Record<string, Record<string, unknown>>).default;
    expect(defaultPreset).not.toHaveProperty("councillors");
  });

  it("should handle disabled_agents field", () => {
    const config = buildSlimConfig(available, {
      disabled_agents: ["observer", "councillor"],
    });

    const generated = expectGeneratedConfig(config);
    expect(generated.disabled_agents).toEqual(["observer", "councillor"]);
  });
});