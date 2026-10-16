import { describe, expect, it, vi } from "vitest";
import { validateSlimConfig } from "../config-generators/oh-my-opencode-slim-types";
import { SlimAgentConfigSchema } from "../validation/schemas";

vi.mock("server-only", () => ({}));

describe("slim validation regressions", () => {
  it("preserves empty presets so preset selection can round-trip", () => {
    const result = validateSlimConfig({
      preset: "review",
      presets: {
        review: {},
      },
    });

    expect(result.preset).toBe("review");
    expect(result.presets).toEqual({ review: { agents: {} } });
  });

  it("preserves nested council preset councillor data and drops the removed preset master", () => {
    const result = validateSlimConfig({
      council: {
        presets: {
          default: {
            councillors: {
              alpha: { model: "openai/gpt-5-mini", variant: "high" },
            },
            master: { variant: "balanced" },
          },
        },
      },
    });

    expect(result.council?.presets).toEqual({
      default: {
        councillors: {
          alpha: { model: "openai/gpt-5-mini", variant: "high" },
        },
      },
    });
  });

  it("accepts a legacy council master at the API boundary", () => {
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