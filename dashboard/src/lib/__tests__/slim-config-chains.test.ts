import { describe, expect, it } from "vitest";
import { buildSlimConfig } from "../config-generators/oh-my-opencode-slim";

describe("buildSlimConfig – fallback chains bug reproduction", () => {
  it("should not emit empty chain arrays for agents where all models are unavailable", () => {
    const available = ["model-a", "model-b"];
    const config = buildSlimConfig(available, {
      fallback: {
        enabled: true,
        chains: {
          // "model-x" is NOT in available — chain must be dropped, not []
          orchestrator: ["model-x", "model-y"],
          // "model-a" IS available — chain must be kept
          oracle: ["model-a", "model-b"],
        },
      },
    });

    expect(config).not.toBeNull();
    const fallback = (config as Record<string, unknown>).fallback as Record<string, unknown>;
    expect(fallback).toBeDefined();

    const chains = fallback.chains as Record<string, string[]> | undefined;

    // Before the fix: chains would contain { orchestrator: [], oracle: [...] }
    // After the fix:  only oracle should be present
    expect(chains).toBeDefined();
    expect(chains!.oracle).toEqual(["cliproxyapi/model-a", "cliproxyapi/model-b"]);
    // orchestrator chain should be absent entirely, not an empty array
    expect(chains!.orchestrator).toBeUndefined();
  });

  it("should omit chains entirely when all chains resolve to empty", () => {
    const available = ["model-a"];
    const config = buildSlimConfig(available, {
      fallback: {
        enabled: true,
        chains: {
          // All models unavailable
          orchestrator: ["model-x"],
          oracle: ["model-y"],
        },
      },
    });

    expect(config).not.toBeNull();
    const fallback = (config as Record<string, unknown>).fallback as Record<string, unknown>;
    expect(fallback).toBeDefined();
    // chains key should not exist at all
    expect(fallback.chains).toBeUndefined();
  });
});
