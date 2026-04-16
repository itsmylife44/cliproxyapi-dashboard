import { describe, expect, it } from "vitest";
import { buildSlimConfig } from "../config-generators/oh-my-opencode-slim";
import type { OhMyOpenCodeSlimFullConfig } from "../config-generators/oh-my-opencode-slim-types";

describe("buildSlimConfig fallback chains - external model passthrough", () => {
  const available = ["claude-sonnet-4", "gemini-2.5-pro"];

  it("passes through external models (not in available) without prefix", () => {
    const overrides: OhMyOpenCodeSlimFullConfig = {
      fallback: {
        enabled: true,
        timeoutMs: 10000,
        chains: {
          orchestrator: ["model-gone-a", "model-gone-b"],
        },
      },
    };

    const config = buildSlimConfig(available, overrides);
    expect(config).not.toBeNull();

    const fallback = config!.fallback as Record<string, unknown>;
    expect(fallback).toBeDefined();

    // External models should be passed through as-is (no cliproxyapi/ prefix)
    const chains = fallback.chains as Record<string, string[]>;
    expect(chains.orchestrator).toEqual(["model-gone-a", "model-gone-b"]);
  });

  it("mixed available/external chains — available get prefixed, external pass through", () => {
    const overrides: OhMyOpenCodeSlimFullConfig = {
      fallback: {
        enabled: true,
        chains: {
          orchestrator: ["model-gone"],
          fixer: ["claude-sonnet-4", "model-gone"],
        },
      },
    };

    const config = buildSlimConfig(available, overrides);
    expect(config).not.toBeNull();

    const fallback = config!.fallback as Record<string, unknown>;
    const chains = fallback.chains as Record<string, string[]>;

    // fixer: available model prefixed, external model passed through
    expect(chains.fixer).toEqual(["cliproxyapi/claude-sonnet-4", "model-gone"]);

    // orchestrator: external model passed through
    expect(chains.orchestrator).toEqual(["model-gone"]);
  });

  it("keeps prefixed chains when all models are available", () => {
    const overrides: OhMyOpenCodeSlimFullConfig = {
      fallback: {
        enabled: true,
        chains: {
          orchestrator: ["claude-sonnet-4", "gemini-2.5-pro"],
        },
      },
    };

    const config = buildSlimConfig(available, overrides);
    expect(config).not.toBeNull();

    const fallback = config!.fallback as Record<string, unknown>;
    const chains = fallback.chains as Record<string, string[]>;
    expect(chains.orchestrator).toEqual([
      "cliproxyapi/claude-sonnet-4",
      "cliproxyapi/gemini-2.5-pro",
    ]);
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
    expect(config).not.toBeNull();

    const interview = config!.interview as any;
    expect(interview).toBeDefined();
    expect(interview.dashboard).toBe(true);
    expect(interview.maxQuestions).toBe(3);
    expect(interview.autoOpenBrowser).toBe(false);
  });

  it("should handle retry_on_empty in fallback config", () => {
    const overrides: OhMyOpenCodeSlimFullConfig = {
      fallback: {
        enabled: true,
        retry_on_empty: true,
        timeoutMs: 5000,
      },
    };

    const config = buildSlimConfig(available, overrides);
    expect(config).not.toBeNull();

    const fallback = config!.fallback as any;
    expect(fallback.retry_on_empty).toBe(true);
    expect(fallback.enabled).toBe(true);
    expect(fallback.timeoutMs).toBe(5000);
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