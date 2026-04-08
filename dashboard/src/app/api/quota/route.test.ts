import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth/session", () => ({
  verifySession: vi.fn(() => ({ userId: "test-user" })),
}));

vi.mock("@/lib/cache", () => ({
  quotaCache: { get: vi.fn(() => null), set: vi.fn() },
  CACHE_TTL: { QUOTA: 30_000 },
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

vi.mock("@/lib/db", () => ({
  prisma: {},
}));

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

vi.stubEnv("MANAGEMENT_API_KEY", "test-key");
vi.stubEnv("CLIPROXYAPI_MANAGEMENT_URL", "http://test:8317/v0/management");

describe("GET /api/quota - Gemini CLI support (issue #125)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns supported: true for gemini-cli accounts", async () => {
    const authFilesResponse = {
      files: [
        {
          auth_index: 0,
          provider: "gemini-cli",
          email: "test@gmail.com",
          disabled: false,
          status: "active",
        },
      ],
    };

    const googleModelsResponse = {
      models: {
        "gemini-2.5-pro": {
          displayName: "Gemini 2.5 Pro",
          quotaInfo: {
            remainingFraction: 0.75,
            resetTime: "2026-03-08T00:00:00Z",
          },
        },
        "gemini-2.5-flash": {
          displayName: "Gemini 2.5 Flash",
          quotaInfo: {
            remainingFraction: 0.9,
            resetTime: "2026-03-08T00:00:00Z",
          },
        },
      },
    };

    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(authFilesResponse),
        body: { cancel: vi.fn() },
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            status_code: 200,
            body: {
              cloudaicompanionProject: "test-project",
            },
          }),
        body: { cancel: vi.fn() },
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(googleModelsResponse),
        body: { cancel: vi.fn() },
      });

    const { GET } = await import("./route");

    const request = new Request("http://localhost/api/quota", {
      headers: { cookie: "session=test" },
    });
    const response = await GET(request as any);
    const data = await response.json();

    expect(data.accounts).toHaveLength(1);

    const account = data.accounts[0];
    expect(account.provider).toBe("gemini-cli");
    expect(account.supported).toBe(true);
    expect(account.groups).toBeDefined();
    expect(account.groups.length).toBeGreaterThan(0);
  });

  it("returns supported: true with error for gemini-cli auth failures", async () => {
    const authFilesResponse = {
      files: [
        {
          auth_index: 0,
          provider: "gemini-cli",
          email: "test@gmail.com",
          disabled: false,
          status: "active",
        },
      ],
    };

    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(authFilesResponse),
        body: { cancel: vi.fn() },
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            status_code: 200,
            body: {
              cloudaicompanionProject: "test-project",
            },
          }),
        body: { cancel: vi.fn() },
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({}),
        body: { cancel: vi.fn() },
      });

    const { GET } = await import("./route");

    const request = new Request("http://localhost/api/quota", {
      headers: { cookie: "session=test" },
    });
    const response = await GET(request as any);
    const data = await response.json();

    const account = data.accounts[0];
    expect(account.provider).toBe("gemini-cli");
    expect(account.supported).toBe(true);
    expect(account.error).toBeDefined();
  });

  it("handles the gemini provider the same as gemini-cli", async () => {
    const authFilesResponse = {
      files: [
        {
          auth_index: 0,
          provider: "gemini",
          email: "test@gmail.com",
          disabled: false,
          status: "active",
        },
      ],
    };

    const googleModelsResponse = {
      models: {
        "gemini-2.5-flash": {
          displayName: "Gemini 2.5 Flash",
          quotaInfo: {
            remainingFraction: 0.5,
            resetTime: null,
          },
        },
      },
    };

    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(authFilesResponse),
        body: { cancel: vi.fn() },
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            status_code: 200,
            body: {
              cloudaicompanionProject: "test-project",
            },
          }),
        body: { cancel: vi.fn() },
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(googleModelsResponse),
        body: { cancel: vi.fn() },
      });

    const { GET } = await import("./route");

    const request = new Request("http://localhost/api/quota", {
      headers: { cookie: "session=test" },
    });
    const response = await GET(request as any);
    const data = await response.json();

    const account = data.accounts[0];
    expect(account.supported).toBe(true);
    expect(account.groups).toBeDefined();
  });

  it("falls back to the next Antigravity quota endpoint and returns model-first metadata", async () => {
    const authFilesResponse = {
      files: [
        {
          auth_index: 0,
          provider: "antigravity",
          email: "test@gmail.com",
          disabled: false,
          status: "active",
        },
      ],
    };

    const googleModelsResponse = {
      status_code: 200,
      body: {
        models: {
          "gemini-2.5-flash": {
            quotaInfo: {
              remainingFraction: 0.8,
              resetTime: "2026-03-08T05:00:00Z",
            },
          },
          "gemini-3-pro-high": {
            displayName: "Gemini 3 Pro High",
            quotaInfo: {
              remainingFraction: 0.4,
              resetTime: "2026-03-12T00:00:00Z",
            },
          },
        },
      },
    };

    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(authFilesResponse),
        body: { cancel: vi.fn() },
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            status_code: 200,
            body: {
              cloudaicompanionProject: "test-project",
            },
          }),
        body: { cancel: vi.fn() },
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            status_code: 429,
            body: {},
          }),
        body: { cancel: vi.fn() },
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(googleModelsResponse),
        body: { cancel: vi.fn() },
      });

    const { GET } = await import("./route");

    const request = new Request("http://localhost/api/quota", {
      headers: { cookie: "session=test" },
    });
    const response = await GET(request as any);
    const data = await response.json();

    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(data.accounts).toHaveLength(1);
    expect(data.generatedAt).toBeDefined();

    const account = data.accounts[0];
    expect(account.provider).toBe("antigravity");
    expect(account.monitorMode).toBe("model-first");
    expect(account.snapshotFetchedAt).toBeDefined();
    expect(account.snapshotSource).toContain("daily-cloudcode-pa.googleapis.com");
    expect(account.groups[0].monitorMode).toBe("model-first");
    expect(account.groups[0].nextWindowResetAt).toBeDefined();
    expect(account.groups[0].p50RemainingFraction).toBeDefined();
    expect(account.groups[0].models[0].displayName).toBe("Gemini 3 Pro High");
    expect(account.groups[1].models[0].displayName).toBe("gemini-2.5-flash");
  });

  it("passes project_id to fetchAvailableModels and treats missing remainingFraction as depleted", async () => {
    const authFilesResponse = {
      files: [
        {
          auth_index: 0,
          provider: "antigravity",
          email: "test@gmail.com",
          disabled: false,
          status: "active",
        },
      ],
    };

    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(authFilesResponse),
        body: { cancel: vi.fn() },
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            status_code: 200,
            body: {
              cloudaicompanionProject: "confident-arc-98xjk",
            },
          }),
        body: { cancel: vi.fn() },
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            status_code: 200,
            body: {
              models: {
                "claude-opus-4-6-thinking": {
                  displayName: "Claude Opus 4.6 (Thinking)",
                  quotaInfo: {
                    resetTime: "2026-04-07T20:18:24Z",
                  },
                },
                "gemini-3-flash": {
                  displayName: "Gemini 3 Flash",
                  quotaInfo: {
                    remainingFraction: 0.8,
                    resetTime: "2026-04-07T12:10:05Z",
                  },
                },
              },
            },
          }),
        body: { cancel: vi.fn() },
      });

    const { GET } = await import("./route");

    const request = new Request("http://localhost/api/quota", {
      headers: { cookie: "session=test" },
    });
    const response = await GET(request as any);
    const data = await response.json();

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[2]?.[1]).toMatchObject({
      method: "POST",
    });
    const fetchQuotaCallBody = JSON.parse(String(fetchMock.mock.calls[2]?.[1]?.body));
    expect(fetchQuotaCallBody.data).toBe("{\"project\":\"confident-arc-98xjk\"}");

    const account = data.accounts[0];
    const models = account.groups.flatMap((group: any) => group.models);
    const claudeModel = models.find((model: any) => model.id === "claude-opus-4-6-thinking");
    const flashModel = models.find((model: any) => model.id === "gemini-3-flash");

    expect(claudeModel?.remainingFraction).toBe(0);
    expect(flashModel?.remainingFraction).toBe(0.8);
  });
});

describe("GET /api/quota - imported provider normalization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("copilot provider returns supported: true", async () => {
    const authFilesResponse = {
      files: [
        {
          auth_index: 0,
          provider: "copilot",
          email: "user@github.com",
          disabled: false,
          status: "active",
        },
      ],
    };

    const copilotApiCallResponse = {
      status_code: 200,
      body: {
        quota_snapshots: {
          premium_interactions: {
            unlimited: true,
          },
        },
        quota_reset_date_utc: "2026-04-01T00:00:00Z",
      },
    };

    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(authFilesResponse),
        body: { cancel: vi.fn() },
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(copilotApiCallResponse),
        body: { cancel: vi.fn() },
      });

    const { GET } = await import("./route");

    const request = new Request("http://localhost/api/quota", {
      headers: { cookie: "session=test" },
    });
    const response = await GET(request as any);
    const data = await response.json();

    expect(data.accounts).toHaveLength(1);

    const account = data.accounts[0];
    expect(account.provider).toBe("copilot");
    expect(account.supported).toBe(true);
    expect(account.groups).toBeDefined();
  });

  it("CLAUDE uppercase provider returns supported: true", async () => {
    const authFilesResponse = {
      files: [
        {
          auth_index: 0,
          provider: "CLAUDE",
          email: "user@anthropic.com",
          disabled: false,
          status: "active",
        },
      ],
    };

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(authFilesResponse),
      body: { cancel: vi.fn() },
    });

    const { GET } = await import("./route");

    const request = new Request("http://localhost/api/quota", {
      headers: { cookie: "session=test" },
    });
    const response = await GET(request as any);
    const data = await response.json();

    expect(data.accounts).toHaveLength(1);

    const account = data.accounts[0];
    expect(account.provider).toBe("CLAUDE");
    expect(account.supported).toBe(true);
  });

  it("unknown providers remain unsupported", async () => {
    const authFilesResponse = {
      files: [
        {
          auth_index: 0,
          provider: "unknown-xyz",
          email: "user@unknown.com",
          disabled: false,
          status: "active",
        },
      ],
    };

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(authFilesResponse),
      body: { cancel: vi.fn() },
    });

    const { GET } = await import("./route");

    const request = new Request("http://localhost/api/quota", {
      headers: { cookie: "session=test" },
    });
    const response = await GET(request as any);
    const data = await response.json();

    expect(data.accounts).toHaveLength(1);

    const account = data.accounts[0];
    expect(account.provider).toBe("unknown-xyz");
    expect(account.supported).toBe(false);
  });

  it("infers claude provider from claude-credential.json when provider is unknown", async () => {
    const authFilesResponse = {
      files: [
        {
          auth_index: 0,
          provider: "unknown",
          id: "claude-credential.json",
          name: "claude-credential.json",
          email: "unknown",
          disabled: false,
          status: "active",
        },
      ],
    };

    const claudeUsageResponse = {
      five_hour: { utilization: 0.1, resets_at: "2026-03-20T18:00:00Z" },
      seven_day: { utilization: 0.3, resets_at: "2026-03-25T18:00:00Z" },
      seven_day_sonnet: { utilization: 0.2, resets_at: "2026-03-24T18:00:00Z" },
    };

    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(authFilesResponse),
        body: { cancel: vi.fn() },
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status_code: 200, body: claudeUsageResponse }),
        body: { cancel: vi.fn() },
      });

    const { GET } = await import("./route");

    const request = new Request("http://localhost/api/quota", {
      headers: { cookie: "session=test" },
    });
    const response = await GET(request as any);
    const data = await response.json();

    expect(data.accounts).toHaveLength(1);

    const account = data.accounts[0];
    expect(account.provider).toBe("claude");
    expect(account.supported).toBe(true);
    expect(account.email).toBe("claude-credential.json");
    expect(account.groups).toBeDefined();
    expect(account.groups.length).toBeGreaterThan(0);
  });
});
