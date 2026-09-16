import { describe, expect, it } from "vitest";
import { buildSlimConfig } from "../config-generators/oh-my-opencode-slim";
import {
  migrateSlimLegacyConfig,
  validateSlimConfig,
  type OhMyOpenCodeSlimFullConfig,
} from "../config-generators/oh-my-opencode-slim-types";

function expectGeneratedConfig(config: ReturnType<typeof buildSlimConfig>): OhMyOpenCodeSlimFullConfig {
  expect(config).not.toBeNull();
  return config as OhMyOpenCodeSlimFullConfig;
}

/**
 * Legacy shapes are migrated on read. Migrations must be safe to run
 * repeatedly (idempotent) and must never silently drop user configuration.
 */
describe("slim legacy migration", () => {
  it("converts legacy fallback chains into ordered agent model arrays", () => {
    const result = validateSlimConfig({
      fallback: {
        enabled: true,
        chains: {
          orchestrator: ["model-a", "model-b"],
          oracle: ["model-c"],
        },
      },
    });

    expect(result.agents?.orchestrator?.model).toEqual(["model-a", "model-b"]);
    expect(result.agents?.oracle?.model).toEqual(["model-c"]);
    expect(result.fallback?.enabled).toBe(true);
  });

  it("does not overwrite an explicit agent model with a legacy chain", () => {
    const result = validateSlimConfig({
      agents: { orchestrator: { model: "explicit" } },
      fallback: { chains: { orchestrator: ["legacy-a", "legacy-b"] } },
    });

    expect(result.agents?.orchestrator?.model).toBe("explicit");
  });

  it("drops the removed fallback keys and keeps the supported ones", () => {
    const result = validateSlimConfig({
      fallback: {
        enabled: false,
        maxRetries: 4,
        initialRetryDelayMs: 100,
        retryDelayMs: 900,
        timeoutMs: 15000,
        retry_on_empty: true,
        runtimeOverride: true,
      } as never,
    });

    expect(result.fallback).toEqual({
      enabled: false,
      maxRetries: 4,
      initialRetryDelayMs: 100,
      retryDelayMs: 900,
    });
  });

  it("converts a legacy council master into the council agent model", () => {
    const result = validateSlimConfig({
      council: { master: { model: "opencode/opus" } },
    });

    expect(result.agents?.council?.model).toBe("opencode/opus");
    expect(result.council).toBeUndefined();
  });

  it("flattens nested legacy councillors into flat preset entries", () => {
    const result = validateSlimConfig({
      council: {
        presets: {
          default: {
            councillors: {
              alpha: { model: "openai/gpt-5-mini", variant: "high" },
              beta: { model: "google/gemini-2.5-pro" },
            },
            master: { variant: "balanced" },
          },
        },
      },
    });

    expect(result.council?.presets).toEqual({
      default: {
        alpha: { model: "openai/gpt-5-mini", variant: "high" },
        beta: { model: "google/gemini-2.5-pro" },
        council: { variant: "balanced" },
      },
    });
  });

  it("drops the removed council scalar fields", () => {
    const result = validateSlimConfig({
      council: {
        presets: { default: { alpha: { model: "m" } } },
        master_timeout: 60000,
        councillors_timeout: 60000,
        master_fallback: ["m"],
        councillor_execution_mode: "serial",
        councillor_retries: 3,
        default_preset: "default",
      } as never,
    });

    expect(result.council).toEqual({
      presets: { default: { alpha: { model: "m" } } },
      default_preset: "default",
    });
  });

  it("converts the legacy tmux block into multiplexer config", () => {
    const result = validateSlimConfig({
      tmux: { enabled: true, layout: "main-horizontal", main_pane_size: 55 },
    });

    expect(result.multiplexer).toEqual({
      type: "tmux",
      layout: "main-horizontal",
      main_pane_size: 55,
    });
    expect(result).not.toHaveProperty("tmux");
  });

  it("maps a disabled legacy tmux block to multiplexer type none", () => {
    const result = validateSlimConfig({ tmux: { enabled: false } });

    expect(result.multiplexer?.type).toBe("none");
  });

  it("drops the removed top-level sections", () => {
    const result = validateSlimConfig({
      scoringEngineVersion: "v2",
      balanceProviderUsage: true,
      manualPlan: { orchestrator: { primary: "a", fallback1: "b", fallback2: "c", fallback3: "d" } },
      todoContinuation: { maxContinuations: 5 },
      websearch: { provider: "exa" },
      background: { maxConcurrentStarts: 10 },
    } as never);

    for (const key of [
      "scoringEngineVersion",
      "balanceProviderUsage",
      "manualPlan",
      "todoContinuation",
      "websearch",
      "background",
    ]) {
      expect(result).not.toHaveProperty(key);
    }
  });

  it("preserves unknown top-level and agent-level fields", () => {
    const result = validateSlimConfig({
      futureTopLevelKey: { anything: [1, 2, 3] },
      agents: {
        orchestrator: { model: "m", futureAgentKey: "keep-me" },
      },
    });

    expect(result.futureTopLevelKey).toEqual({ anything: [1, 2, 3] });
    expect(result.agents?.orchestrator?.futureAgentKey).toBe("keep-me");
  });

  it("is idempotent", () => {
    const input = {
      fallback: { chains: { orchestrator: ["model-a"] }, timeoutMs: 1000 },
      council: { master: { model: "opencode/opus" } },
      tmux: { enabled: true, layout: "tiled" },
      unknownKey: "preserved",
    } as never;

    const once = migrateSlimLegacyConfig(input);
    const twice = migrateSlimLegacyConfig(once);

    expect(twice).toEqual(once);
    expect(validateSlimConfig(once)).toEqual(validateSlimConfig(twice));
  });

  it("keeps empty presets so preset selection round-trips", () => {
    const result = validateSlimConfig({ preset: "review", presets: { review: {} } });

    expect(result.preset).toBe("review");
    expect(result.presets).toEqual({ review: {} });
  });

  it("handles malformed input without throwing", () => {
    expect(() => validateSlimConfig(null)).not.toThrow();
    expect(() => validateSlimConfig("nope")).not.toThrow();
    expect(() => validateSlimConfig([])).not.toThrow();
    expect(validateSlimConfig({ fallback: "not-an-object" } as never).fallback).toBeUndefined();
  });
});

describe("buildSlimConfig – field preservation and fail-fast", () => {
  const available = ["claude-sonnet-4"];

  it("preserves interview settings", () => {
    const config = buildSlimConfig(available, {
      interview: { maxQuestions: 3, dashboard: true, autoOpenBrowser: false },
    });
    const generated = expectGeneratedConfig(config);

    expect(generated.interview?.dashboard).toBe(true);
    expect(generated.interview?.maxQuestions).toBe(3);
    expect(generated.interview?.autoOpenBrowser).toBe(false);
  });

  it("carries unknown top-level fields through the generator", () => {
    const config = buildSlimConfig(available, {
      futureTopLevelKey: { anything: [1, 2, 3] },
    });
    const generated = expectGeneratedConfig(config);

    expect(generated.futureTopLevelKey).toEqual({ anything: [1, 2, 3] });
  });

  it("fails fast when no models are available and no overrides exist", () => {
    expect(buildSlimConfig([])).toBeNull();
  });

  it("builds config when models are provided via overrides with empty available", () => {
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

    expect(config).not.toBeNull();
  });
});
