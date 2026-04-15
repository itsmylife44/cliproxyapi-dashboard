import { describe, expect, it } from "vitest";
import { buildSlimConfig } from "../config-generators/oh-my-opencode-slim";

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

describe("buildSlimConfig – fail-fast when no models available", () => {
  it("should return null when no models are available and no overrides", () => {
    // With empty availableModels and no model overrides, we cannot build valid config
    // This is the correct fail-fast behavior
    const config = buildSlimConfig([]);

    // Config should be null when we can't resolve any models
    expect(config).toBeNull();
  });

  it("should build config when models are provided via overrides even with empty available", () => {
    // If user provides explicit model overrides, those are passed through
    const config = buildSlimConfig([], {
      agents: {
        orchestrator: { model: "external/claude-3.5" },
        oracle: { model: "external/gpt-4" },
        designer: { model: "external/claude-3.5" },
        explorer: { model: "external/gemini" },
        librarian: { model: "external/claude-3.5" },
        fixer: { model: "external/claude-3.5" },
        council: { model: "external/claude-3.5" },
      },
    });

    // Should succeed because all agents have explicit overrides
    expect(config).not.toBeNull();
  });
});
