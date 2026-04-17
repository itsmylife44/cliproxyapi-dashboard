import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));

const verifySessionMock = vi.fn();
const upsertMock = vi.fn();
const validateOriginMock = vi.fn();

vi.mock("@/lib/errors", () => ({
  Errors: {
    unauthorized: () => new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 }),
    internal: () => new Response(JSON.stringify({ error: "internal" }), { status: 500 }),
    zodValidation: () => new Response(JSON.stringify({ error: "validation" }), { status: 400 }),
  },
  apiSuccess: (data: unknown) => new Response(JSON.stringify(data), { status: 200 }),
}));

vi.mock("@/lib/auth/session", () => ({
  verifySession: verifySessionMock,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    agentModelOverride: { upsert: upsertMock },
  },
}));

vi.mock("@/lib/auth/origin", () => ({
  validateOrigin: validateOriginMock,
}));

describe("PUT /api/agent-config-slim", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    verifySessionMock.mockResolvedValue({ userId: "user-1" });
    validateOriginMock.mockReturnValue(undefined);
    upsertMock.mockImplementation(async ({ create }: { create: { slimOverrides: unknown } }) => ({
      slimOverrides: create.slimOverrides,
    }));
  });

  it("accepts and stores advanced slim config shapes", async () => {
    const { PUT } = await import("./route");

    const requestBody = {
      overrides: {
        preset: "review",
        presets: {
          review: {
            orchestrator: {
              model: ["gemini-2.5-pro", { id: "claude-opus-4.6", variant: "high" }],
              options: { thinking: { type: "enabled", budget_tokens: 4096 } },
            },
            observer: { model: "openai/gpt-4.1-mini" },
          },
          fast: {
            fixer: { model: "gpt-5-mini" },
          },
        },
        agents: {
          oracle: { variant: "high" },
          "council-master": { model: "anthropic/claude-opus-4-6" },
        },
        disabled_agents: ["observer"],
        disabled_mcps: ["websearch"],
        multiplexer: { type: "zellij" },
        interview: { maxQuestions: 3, dashboard: true, port: 43211 },
        todoContinuation: { autoEnable: true, autoEnableThreshold: 6 },
        websearch: { provider: "tavily" },
        fallback: {
          enabled: true,
          retry_on_empty: true,
          chains: {
            orchestrator: ["gpt-5-mini"],
            observer: ["openai/gpt-4.1-mini"],
          },
        },
        council: {
          master: { model: "anthropic/claude-opus-4-6" },
          presets: {
            default: {
              councillors: {
                alpha: { model: "openai/gpt-5-mini" },
              },
              master: { variant: "high" },
            },
          },
          default_preset: "default",
          master_fallback: ["openai/gpt-5"],
          councillor_retries: 2,
        },
      },
    };

    const response = await PUT({ json: async () => requestBody } as NextRequest);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.overrides.preset).toBe("review");
    expect(data.overrides.interview.dashboard).toBe(true);
    expect(data.overrides.multiplexer.type).toBe("zellij");
    expect(data.overrides.disabled_agents).toEqual(["observer"]);
    expect(data.overrides.fallback.retry_on_empty).toBe(true);
    expect(data.overrides.presets.review.orchestrator.model).toEqual([
      "gemini-2.5-pro",
      { id: "claude-opus-4.6", variant: "high" },
    ]);
    expect(data.overrides.presets.review.observer.model).toBe("openai/gpt-4.1-mini");
    expect(data.overrides.agents["council-master"].model).toBe("anthropic/claude-opus-4-6");
    expect(data.overrides.council.presets.default.councillors.alpha.model).toBe("openai/gpt-5-mini");
    expect(data.overrides.council.presets.default.master.variant).toBe("high");

    expect(upsertMock).toHaveBeenCalledTimes(1);
    const saved = upsertMock.mock.calls[0][0].create.slimOverrides as Record<string, unknown>;
    expect(saved.interview).toEqual({ maxQuestions: 3, dashboard: true, port: 43211 });
    expect(saved.websearch).toEqual({ provider: "tavily" });
  });
});

describe("SlimAgentConfigSchema", () => {
  it("accepts advanced preset agent keys and interview.dashboard", async () => {
    const { SlimAgentConfigSchema } = await import("@/lib/validation/schemas");

    expect(() =>
      SlimAgentConfigSchema.parse({
        overrides: {
          presets: {
            review: {
              observer: { model: "openai/gpt-4.1-mini" },
              "council-master": { model: "anthropic/claude-opus-4-6" },
            },
          },
          interview: { dashboard: true, port: 43211 },
        },
      }),
    ).not.toThrow();
  });
} );