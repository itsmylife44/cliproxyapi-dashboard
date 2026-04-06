import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/errors", () => ({
  Errors: {
    unauthorized: () => new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 }),
    internal: () => new Response(JSON.stringify({ error: "internal" }), { status: 500 }),
    zodValidation: () => new Response(JSON.stringify({ error: "validation" }), { status: 400 }),
  },
  apiSuccess: (data: unknown) => new Response(JSON.stringify(data), { status: 200 }),
}));

const verifySessionMock = vi.fn();
const fetchProxyModelsMock = vi.fn();
const extractOAuthModelAliasesMock = vi.fn();

vi.mock("@/lib/auth/session", () => ({
  verifySession: verifySessionMock,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    agentModelOverride: { findUnique: vi.fn() },
    modelPreference: { findUnique: vi.fn() },
    userApiKey: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/config-generators/opencode", () => ({
  getInternalProxyUrl: vi.fn(() => "http://proxy.internal"),
  extractOAuthModelAliases: extractOAuthModelAliasesMock,
}));

vi.mock("@/lib/config-generators/shared", () => {
  return {
    isRecord: (value: unknown): value is Record<string, unknown> =>
      typeof value === "object" && value !== null,
    buildAvailableModelIds: (proxyModels: Array<{ id: string }>, oauthAliasIds: string[]): string[] =>
      [...new Set([...proxyModels.map((m) => m.id), ...oauthAliasIds])].sort((a, b) => a.localeCompare(b)),
    fetchProxyModels: fetchProxyModelsMock,
  };
});

describe("GET /api/agent-config-slim", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deduplicates, sorts, and filters available models", async () => {
    const { prisma } = await import("@/lib/db");

    verifySessionMock.mockResolvedValue({ userId: "user-1" });
    (prisma.agentModelOverride.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (prisma.modelPreference.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      excludedModels: ["claude-opus-4.6"],
    });
    (prisma.userApiKey.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([{ key: "sk-test" }]);

    fetchProxyModelsMock.mockResolvedValue([
      { id: "claude-opus-4.6", owned_by: "anthropic" },
      { id: "gemini-2.5-pro", owned_by: "google" },
      { id: "gemini-2.5-pro", owned_by: "google" },
    ]);

    extractOAuthModelAliasesMock.mockReturnValue({
      "gemini-2.5-flash": {
        name: "Gemini 2.5 Flash",
        context: 200000,
        output: 64000,
        attachment: true,
        reasoning: true,
        modalities: { input: ["text"], output: ["text"] },
      },
      "claude-opus-4.6": {
        name: "Claude Opus 4.6",
        context: 200000,
        output: 64000,
        attachment: true,
        reasoning: true,
        modalities: { input: ["text"], output: ["text"] },
      },
    });

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({}), body: { cancel: vi.fn() } })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ files: [] }), body: { cancel: vi.fn() } });
    Object.defineProperty(global, "fetch", { value: fetchMock, writable: true, configurable: true });

    const { GET } = await import("./route");
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.availableModels).toEqual(["gemini-2.5-flash", "gemini-2.5-pro"]);
  });
});
