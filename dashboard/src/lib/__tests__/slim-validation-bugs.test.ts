import { describe, expect, it, vi } from "vitest";
import { validateSlimConfig } from "../config-generators/oh-my-opencode-slim-types";
import { SlimAgentConfigSchema } from "../validation/schemas";

vi.mock("server-only", () => ({}));

describe("slim validation regressions", () => {
  it("preserves manualPlan entries when models repeat across fallback slots", () => {
    const result = validateSlimConfig({
      manualPlan: {
        orchestrator: {
          primary: "gpt-4o",
          fallback1: "claude-3.5-sonnet",
          fallback2: "gpt-4o",
          fallback3: "claude-3.5-sonnet",
        },
      },
    });

    expect(result.manualPlan?.orchestrator).toEqual({
      primary: "gpt-4o",
      fallback1: "claude-3.5-sonnet",
      fallback2: "gpt-4o",
      fallback3: "claude-3.5-sonnet",
    });
  });

  it("preserves empty presets so preset selection can round-trip", () => {
    const result = validateSlimConfig({
      preset: "review",
      presets: {
        review: {},
      },
    });

    expect(result.preset).toBe("review");
    expect(result.presets).toEqual({ review: {} });
  });

  it("preserves council master variant and prompt without a model", () => {
    const result = validateSlimConfig({
      council: {
        master: {
          variant: "high-precision",
          prompt: "You are a consensus coordinator.",
        },
      },
    });

    expect(result.council?.master).toEqual({
      variant: "high-precision",
      prompt: "You are a consensus coordinator.",
    });
  });

  it("allows council master variant and prompt without a model at the API boundary", () => {
    expect(() =>
      SlimAgentConfigSchema.parse({
        overrides: {
          council: {
            master: {
              variant: "high-precision",
              prompt: "You are a consensus coordinator.",
            },
          },
        },
      }),
    ).not.toThrow();
  });
});