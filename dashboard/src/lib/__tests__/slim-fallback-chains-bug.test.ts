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
