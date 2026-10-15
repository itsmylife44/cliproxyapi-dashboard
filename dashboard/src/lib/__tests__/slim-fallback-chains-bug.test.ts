import { describe, expect, it } from "vitest";
import { buildSlimConfig } from "../config-generators/oh-my-opencode-slim";
import type { OhMyOpenCodeSlimFullConfig } from "../config-generators/oh-my-opencode-slim-types";

function expectGeneratedConfig(config: ReturnType<typeof buildSlimConfig>): OhMyOpenCodeSlimFullConfig {
  expect(config).not.toBeNull();
  return config as OhMyOpenCodeSlimFullConfig;
}

describe("buildSlimConfig fallback chains - folded into each agent's model array", () => {
  const available = ["claude-sonnet-4", "gemini-2.5-pro"];

  it("passes through external models (not in available) without prefix", () => {
    const overrides: OhMyOpenCodeSlimFullConfig = {
      presets: { cliproxyapi: { orchestrator: { model: "claude-sonnet-4" } } },
      fallback: {
        enabled: true,
        chains: {
          orchestrator: ["model-gone-a", "model-gone-b"],
        },
      },
    };

    const generated = expectGeneratedConfig(buildSlimConfig(available, overrides));

    expect(generated.fallback).not.toHaveProperty("chains");
    expect(generated.presets?.cliproxyapi?.orchestrator?.model).toEqual([
      "cliproxyapi/claude-sonnet-4",
      "model-gone-a",
      "model-gone-b",
    ]);
  });

  it("mixed available/external chains — available get prefixed, external pass through", () => {
    const overrides: OhMyOpenCodeSlimFullConfig = {
      presets: { cliproxyapi: { orchestrator: { model: "claude-sonnet-4" }, fixer: { model: "gemini-2.5-pro" } } },
      fallback: {
        enabled: true,
        chains: {
          orchestrator: ["model-gone"],
          fixer: ["claude-sonnet-4", "model-gone"],
        },
      },
    };

    const generated = expectGeneratedConfig(buildSlimConfig(available, overrides));

    expect(generated.presets?.cliproxyapi?.fixer?.model).toEqual([
      "cliproxyapi/gemini-2.5-pro",
      "cliproxyapi/claude-sonnet-4",
      "model-gone",
    ]);
    expect(generated.presets?.cliproxyapi?.orchestrator?.model).toEqual([
      "cliproxyapi/claude-sonnet-4",
      "model-gone",
    ]);
  });

  it("dedupes chain models already in the agent's model list, keeping order", () => {
    const overrides: OhMyOpenCodeSlimFullConfig = {
      presets: {
        cliproxyapi: {
          orchestrator: { model: ["claude-sonnet-4", { id: "gemini-2.5-pro", variant: "high" }] },
        },
      },
      fallback: {
        enabled: true,
        chains: {
          orchestrator: ["gemini-2.5-pro", "model-x", "claude-sonnet-4", "model-x"],
        },
      },
    };

    const generated = expectGeneratedConfig(buildSlimConfig(available, overrides));

    expect(generated.presets?.cliproxyapi?.orchestrator?.model).toEqual([
      "cliproxyapi/claude-sonnet-4",
      { id: "cliproxyapi/gemini-2.5-pro", variant: "high" },
      "model-x",
    ]);
  });

  it("does not fold chains when fallback is disabled", () => {
    const overrides: OhMyOpenCodeSlimFullConfig = {
      presets: { cliproxyapi: { orchestrator: { model: "claude-sonnet-4" } } },
      fallback: { enabled: false, chains: { orchestrator: ["gemini-2.5-pro"] } },
    };

    const generated = expectGeneratedConfig(buildSlimConfig(available, overrides));

    expect(generated.presets?.cliproxyapi?.orchestrator?.model).toBe("cliproxyapi/claude-sonnet-4");
    expect(generated.fallback).toEqual({ enabled: false, retryDelayMs: 500 });
  });

  it("folds chains into root agent overrides that set a model, and into legacy agents output", () => {
    const overrides: OhMyOpenCodeSlimFullConfig = {
      agents: { oracle: { model: "gemini-2.5-pro" } },
      fallback: { chains: { oracle: ["claude-sonnet-4"] } },
    };

    const presetConfig = expectGeneratedConfig(buildSlimConfig(available, overrides));
    expect(presetConfig.agents?.oracle?.model).toEqual(["cliproxyapi/gemini-2.5-pro", "cliproxyapi/claude-sonnet-4"]);

    const legacyConfig = expectGeneratedConfig(buildSlimConfig(available, overrides, { usePresets: false }));
    expect(legacyConfig.agents?.oracle?.model).toEqual(["cliproxyapi/gemini-2.5-pro", "cliproxyapi/claude-sonnet-4"]);
    expect(legacyConfig.fallback).not.toHaveProperty("chains");
  });
});

describe("buildSlimConfig - advanced field preservation", () => {
  const available = ["claude-sonnet-4"];

  it("should preserve interview.dashboard field", () => {
    const overrides: OhMyOpenCodeSlimFullConfig = {
      interview: {
        maxQuestions: 3,
        dashboard: true,
        autoOpenBrowser: false,
      },
    };

    const config = buildSlimConfig(available, overrides);
    const generated = expectGeneratedConfig(config);
    expect(generated.interview).toBeDefined();
    expect(generated.interview?.dashboard).toBe(true);
    expect(generated.interview?.maxQuestions).toBe(3);
    expect(generated.interview?.autoOpenBrowser).toBe(false);
  });

  it("drops stored retry_on_empty / timeoutMs, which slim's strict fallback block rejects", () => {
    const overrides: OhMyOpenCodeSlimFullConfig = {
      fallback: {
        enabled: true,
        retry_on_empty: true,
        timeoutMs: 5000,
        retryDelayMs: 250,
      },
    };

    const config = buildSlimConfig(available, overrides);
    const generated = expectGeneratedConfig(config);
    expect(generated.fallback).toEqual({ enabled: true, retryDelayMs: 250 });
  });

  it("should fail fast when no models available and no overrides", () => {
    // With empty availableModels and no model overrides, we cannot build valid config
    // This is the correct fail-fast behavior
    const config = buildSlimConfig([]);

    // Config should be null when we can't resolve any models
    expect(config).toBeNull();
  });

  it("should build config when models provided via overrides even with empty available", () => {
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