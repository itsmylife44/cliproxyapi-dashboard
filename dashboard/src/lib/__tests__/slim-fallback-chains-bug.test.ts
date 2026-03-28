import { describe, expect, it } from "vitest";
import { buildSlimConfig } from "../config-generators/oh-my-opencode-slim";
import type { OhMyOpenCodeSlimFullConfig } from "../config-generators/oh-my-opencode-slim-types";

describe("buildSlimConfig fallback chains bugs", () => {
  const available = ["claude-sonnet-4", "gemini-2.5-pro"];

  it("BUG: emits empty chain arrays for agents whose models are all unavailable", () => {
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

    // The chains should either be absent entirely (all models unavailable)
    // or contain only non-empty, cliproxyapi/-prefixed arrays.
    // BUG: currently chains is { orchestrator: [] } — an empty array.
    if (fallback.chains) {
      const chains = fallback.chains as Record<string, string[]>;
      for (const [agent, chain] of Object.entries(chains)) {
        expect(chain.length, `chain for ${agent} should not be empty`).toBeGreaterThan(0);
        for (const model of chain) {
          expect(model).toMatch(/^cliproxyapi\//);
        }
      }
    }
  });

  it("BUG: mixed valid/invalid chains — invalid agent gets empty array", () => {
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

    // fixer should have one valid entry
    expect(chains.fixer).toEqual(["cliproxyapi/claude-sonnet-4"]);

    // orchestrator chain should be absent (no valid models), not an empty array
    expect(chains.orchestrator).toBeUndefined();
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
