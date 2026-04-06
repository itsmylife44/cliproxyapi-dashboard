import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/errors", () => ({
  Errors: {
    unauthorized: () => new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 }),
    internal: () => new Response(JSON.stringify({ error: "internal" }), { status: 500 }),
  },
  apiSuccess: (data: unknown) => new Response(JSON.stringify(data), { status: 200 }),
}));

const verifySessionMock = vi.fn();
const loadOfficialOhMyOpenCodePresetsMock = vi.fn();

vi.mock("@/lib/auth/session", () => ({
  verifySession: verifySessionMock,
}));

vi.mock("@/lib/config-generators/oh-my-opencode-presets", () => ({
  loadOfficialOhMyOpenCodePresets: loadOfficialOhMyOpenCodePresetsMock,
}));

describe("GET /api/oh-my-opencode/presets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules?.();
  });

  it("returns validated presets for authenticated users", async () => {
    verifySessionMock.mockResolvedValue({ userId: "user-1" });
    loadOfficialOhMyOpenCodePresetsMock.mockResolvedValue([
      {
        name: "default",
        description: "Balanced defaults",
        config: {
          agents: {
            sisyphus: { model: "anthropic/claude-opus-4-6" },
          },
        },
      },
    ]);

    const { GET } = await import("./route");
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.presets).toHaveLength(1);
    expect(data.presets[0].name).toBe("default");
  });

  it("returns 401 for unauthenticated requests", async () => {
    verifySessionMock.mockResolvedValue(null);

    const { GET } = await import("./route");
    const response = await GET();

    expect(response.status).toBe(401);
  });

  it("returns 500 when preset loading throws", async () => {
    verifySessionMock.mockResolvedValue({ userId: "user-1" });
    loadOfficialOhMyOpenCodePresetsMock.mockRejectedValue(new Error("network failure"));

    const { GET } = await import("./route");
    const response = await GET();

    expect(response.status).toBe(500);
  });
});
