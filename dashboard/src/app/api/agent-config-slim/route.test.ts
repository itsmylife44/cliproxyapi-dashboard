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
    expect(data.overrides.presets.review.orchestrator.model).toEqual([
      "gemini-2.5-pro",
      { id: "claude-opus-4.6", variant: "high" },
    ]);
    expect(data.overrides.presets.review.observer.model).toBe("openai/gpt-4.1-mini");
    expect(data.overrides.agents.oracle.variant).toBe("high");

    // Legacy fallback chains migrate into ordered agent model arrays.
    expect(data.overrides.agents.orchestrator.model).toEqual(["gpt-5-mini"]);
    expect(data.overrides.agents.observer.model).toEqual(["openai/gpt-4.1-mini"]);
    expect(data.overrides.fallback).toEqual({ enabled: true });
    expect(data.overrides.fallback).not.toHaveProperty("retry_on_empty");
    expect(data.overrides.fallback).not.toHaveProperty("chains");

    // The legacy council master becomes the council agent, and nested
    // councillors are flattened into the preset.
    expect(data.overrides.agents.council.model).toBe("anthropic/claude-opus-4-6");
    expect(data.overrides.council.presets.default.alpha.model).toBe("openai/gpt-5-mini");
    expect(data.overrides.council.presets.default.council.variant).toBe("high");
    expect(data.overrides.council.presets.default).not.toHaveProperty("councillors");
    expect(data.overrides.council).not.toHaveProperty("master");
    expect(data.overrides.council).not.toHaveProperty("master_fallback");
    expect(data.overrides.council).not.toHaveProperty("councillor_retries");

    // Removed top-level sections are dropped, never stored.
    expect(data.overrides).not.toHaveProperty("todoContinuation");
    expect(data.overrides).not.toHaveProperty("websearch");

    expect(upsertMock).toHaveBeenCalledTimes(1);
    const upsertCall = upsertMock.mock.calls[0];
    expect(upsertCall).toBeDefined();
    const [upsertArgs] = upsertCall!;
    const saved = upsertArgs.create.slimOverrides as Record<string, unknown>;
    expect(saved.interview).toEqual({ maxQuestions: 3, dashboard: true, port: 43211 });
    expect(saved).not.toHaveProperty("websearch");
  });

  it("keeps current-schema fields and unknown fields across the boundary", async () => {
    const { PUT } = await import("./route");

    const requestBody = {
      overrides: {
        compactSidebar: false,
        stripOrchestratorModel: true,
        autoUpdate: false,
        image_routing: "auto",
        disabled_tools: ["todowrite"],
        disabled_skills: ["refactor"],
        backgroundJobs: { strategy: "checkpoint-compatible", maxSessionsPerAgent: 4 },
        webfetch: { enabled: true },
        someFutureField: { nested: [1, 2, 3] },
        agents: {
          orchestrator: {
            inheritModelFrom: "orchestrator",
            skills_add: ["codemap"],
            skills_remove: ["deepwork"],
            displayName: "Lead",
          },
        },
      },
    };

    const response = await PUT({ json: async () => requestBody } as NextRequest);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.overrides.compactSidebar).toBe(false);
    expect(data.overrides.stripOrchestratorModel).toBe(true);
    expect(data.overrides.autoUpdate).toBe(false);
    expect(data.overrides.image_routing).toBe("auto");
    expect(data.overrides.disabled_tools).toEqual(["todowrite"]);
    expect(data.overrides.disabled_skills).toEqual(["refactor"]);
    expect(data.overrides.backgroundJobs.strategy).toBe("checkpoint-compatible");
    expect(data.overrides.backgroundJobs.maxSessionsPerAgent).toBe(4);
    expect(data.overrides.webfetch.enabled).toBe(true);
    expect(data.overrides.someFutureField).toEqual({ nested: [1, 2, 3] });

    const orchestrator = data.overrides.agents.orchestrator;
    expect(orchestrator.inheritModelFrom).toBe("orchestrator");
    expect(orchestrator.skills_add).toEqual(["codemap"]);
    expect(orchestrator.skills_remove).toEqual(["deepwork"]);
    expect(orchestrator.displayName).toBe("Lead");
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