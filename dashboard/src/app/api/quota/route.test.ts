import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import type { QuotaGroup } from "@/lib/model-first-monitoring";

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
    const response = await GET(request as NextRequest);
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
    const response = await GET(request as NextRequest);
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
    const response = await GET(request as NextRequest);
    const data = await response.json();

    const account = data.accounts[0];
    expect(account.supported).toBe(true);
    expect(account.groups).toBeDefined();
  });

  it("falls back to the next summary endpoint and returns only shared quota windows", async () => {
    const authFilesResponse = {
      files: [{ auth_index: 0, provider: "antigravity", email: "test@gmail.com", disabled: false, status: "active" }],
    };
    const summary = {
      groups: [
        { displayName: "Gemini Models", buckets: [
          { bucketId: "gemini-weekly", window: "weekly", remainingFraction: 0.31, resetTime: "2026-04-14T12:00:00Z" },
          { bucketId: "gemini-5h", window: "5h", remainingFraction: 0.82, resetTime: "2026-04-07T17:00:00Z" },
        ] },
        { displayName: "Claude and GPT models", buckets: [
          { bucketId: "3p-weekly", window: "weekly", remainingFraction: 0.48, resetTime: "2026-04-14T18:00:00Z" },
          { bucketId: "3p-5h", window: "5h", remainingFraction: 0.9, resetTime: "2026-04-07T18:00:00Z" },
        ] },
      ],
    };
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(authFilesResponse) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ status_code: 200, body: { cloudaicompanionProject: "test-project" } }) })
      .mockImplementation(async (_url: string, options?: { body?: string }) => {
        const call = JSON.parse(options?.body ?? "{}");
        if (!call.url.includes("sandbox")) return { ok: true, json: async () => ({ status_code: 429, body: {} }) };
        return { ok: true, json: async () => ({ status_code: 200, body: JSON.stringify(summary) }) };
      });

    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/quota") as NextRequest);
    const account = (await response.json()).accounts[0];

    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock.mock.calls.some((call) => String(call[1]?.body).includes("fetchAvailableModels"))).toBe(false);
    const summaryRequest = JSON.parse(String(fetchMock.mock.calls.find((call) => String(call[1]?.body).includes("sandbox.googleapis.com/v1internal:retrieveUserQuotaSummary"))?.[1]?.body));
    expect(summaryRequest.url).toContain("retrieveUserQuotaSummary");
    expect(summaryRequest.data).toBe('{"project":"test-project"}');
    expect(account.monitorMode).toBe("window-based");
    expect(account.snapshotSource).toContain("sandbox.googleapis.com");
    expect(account.groups.map((group: QuotaGroup) => [group.id, group.remainingFraction, group.resetTime])).toEqual([
      ["gemini-weekly", 0.31, "2026-04-14T12:00:00Z"],
      ["gemini-5h", 0.82, "2026-04-07T17:00:00Z"],
      ["claude-gpt-weekly", 0.48, "2026-04-14T18:00:00Z"],
      ["claude-gpt-5h", 0.9, "2026-04-07T18:00:00Z"],
    ]);
  });

  it("keeps authoritative windows without requesting per-model snapshots", async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ files: [
        { auth_index: 1, provider: "antigravity", disabled: false, status: "active" },
      ] }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ status_code: 200, body: { cloudaicompanionProject: "test-project" } }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ status_code: 200, body: { groups: [
        { displayName: "Gemini Models", buckets: [
          { window: "weekly", resetTime: "2026-04-14T12:00:00Z" },
          { window: "5h", remainingFraction: 0, resetTime: "invalid" },
        ] },
      ] } }) });

    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/quota") as NextRequest);
    const account = (await response.json()).accounts[0];

    expect(account.error).toBeUndefined();
    expect(account.groups.map((group: QuotaGroup) => [group.id, group.remainingFraction, group.resetTime])).toEqual([
      ["gemini-weekly", 0, "2026-04-14T12:00:00Z"],
      ["gemini-5h", 0, null],
    ]);
    expect(fetchMock.mock.calls.some((call) => String(call[1]?.body).includes("fetchAvailableModels"))).toBe(false);
  });

  it("keeps both Antigravity accounts' four windows independent", async () => {
    fetchMock.mockImplementation(async (url: string, options?: { body?: string }) => {
      if (url.endsWith("/auth-files")) return { ok: true, json: async () => ({ files: [
        { auth_index: 1, provider: "antigravity", disabled: false, status: "active" },
        { auth_index: 2, provider: "antigravity", disabled: false, status: "active" },
      ] }) };

      const call = JSON.parse(options?.body ?? "{}");
      if (call.url.includes("loadCodeAssist")) return { ok: true, json: async () => ({ status_code: 200, body: { cloudaicompanionProject: "test-project" } }) };
      if (call.url.includes("fetchAvailableModels")) return { ok: true, json: async () => ({ status_code: 200, body: { models: {} } }) };

      const weekly = call.auth_index === "1" ? 0.2 : 0.7;
      return { ok: true, json: async () => ({ status_code: 200, body: { groups: [
        { displayName: "Gemini Models", buckets: [
          { window: "weekly", remainingFraction: weekly, resetTime: "2026-10-07T12:00:00Z" },
          { window: "5h", remainingFraction: 0.8, resetTime: "2026-09-30T12:00:00Z" },
        ] },
        { displayName: "Claude and GPT models", buckets: [
          { window: "weekly", remainingFraction: 0.5, resetTime: "2026-10-07T18:00:00Z" },
          { window: "5h", remainingFraction: 0.9, resetTime: "2026-09-30T18:00:00Z" },
        ] },
      ] } }) };
    });

    const { GET } = await import("./route");
    const accounts = (await (await GET(new Request("http://localhost/api/quota") as NextRequest)).json()).accounts;

    expect(accounts).toHaveLength(2);
    expect(accounts.map((account: { groups: QuotaGroup[] }) => account.groups.length)).toEqual([4, 4]);
    expect(accounts.map((account: { groups: QuotaGroup[] }) => account.groups[0]?.remainingFraction)).toEqual([0.2, 0.7]);
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
    const response = await GET(request as NextRequest);
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
    const response = await GET(request as NextRequest);
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
    const response = await GET(request as NextRequest);
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
    const response = await GET(request as NextRequest);
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

describe("GET /api/quota - Claude limits[] parsing (issue #230)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("surfaces a weekly_scoped model limit instead of the null flat keys", async () => {
    const authFilesResponse = {
      files: [
        {
          auth_index: 0,
          provider: "claude",
          email: "user@anthropic.com",
          disabled: false,
          status: "active",
        },
      ],
    };

    const usageResponse = {
      five_hour: { utilization: 9.0, resets_at: "2026-09-14T02:10:00Z" },
      seven_day: { utilization: 68.0, resets_at: "2026-09-19T09:00:00Z" },
      seven_day_opus: null,
      seven_day_sonnet: null,
      limits: [
        { kind: "session", group: "session", percent: 9, severity: "normal", is_active: false },
        { kind: "weekly_all", group: "weekly", percent: 68, severity: "normal", is_active: false },
        {
          kind: "weekly_scoped",
          group: "weekly",
          percent: 100,
          severity: "critical",
          is_active: true,
          resets_at: "2026-09-19T09:00:00Z",
          scope: { model: { id: null, display_name: "Fable" } },
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
        json: () => Promise.resolve({ status_code: 200, body: usageResponse }),
        body: { cancel: vi.fn() },
      });

    const { GET } = await import("./route");

    const request = new Request("http://localhost/api/quota", {
      headers: { cookie: "session=test" },
    });
    const response = await GET(request as NextRequest);
    const data = await response.json();

    const account = data.accounts[0];
    expect(account.supported).toBe(true);

    const groups: QuotaGroup[] = account.groups;
    const fable = groups.find((group) => group.id === "seven-day-fable");
    expect(fable).toBeDefined();
    expect(fable?.label).toBe("7d Fable");
    expect(fable?.remainingFraction).toBe(0);
    expect(fable?.severity).toBe("critical");
    expect(fable?.isActive).toBe(true);
    expect(fable?.resetTime).toBe("2026-09-19T09:00:00Z");

    expect(groups.find((group) => group.id === "five-hour")?.remainingFraction).toBeCloseTo(0.91, 5);
    expect(groups.find((group) => group.id === "seven-day")?.remainingFraction).toBeCloseTo(0.32, 5);
    // The flat per-model keys are null, so no per-model group is fabricated.
    expect(groups.some((group) => group.id === "seven-day-sonnet")).toBe(false);
  });

  const claudeAuthFiles = {
    files: [
      {
        auth_index: 0,
        provider: "claude",
        email: "user@anthropic.com",
        disabled: false,
        status: "active",
      },
    ],
  };

  const respondWithUsage = (usageResponse: unknown) => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(claudeAuthFiles),
        body: { cancel: vi.fn() },
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status_code: 200, body: usageResponse }),
        body: { cancel: vi.fn() },
      });
  };

  const fetchGroups = async (): Promise<QuotaGroup[]> => {
    const { GET } = await import("./route");
    const request = new Request("http://localhost/api/quota", {
      headers: { cookie: "session=test" },
    });
    const response = await GET(request as NextRequest);
    const data = await response.json();
    return data.accounts[0].groups;
  };

  it("falls back to the flat keys when limits[] is absent", async () => {
    respondWithUsage({
      five_hour: { utilization: 10, resets_at: "2026-09-14T02:10:00Z" },
      seven_day: { utilization: 40, resets_at: "2026-09-19T09:00:00Z" },
      seven_day_sonnet: { utilization: 20, resets_at: "2026-09-19T09:00:00Z" },
      seven_day_opus: { utilization: 80, resets_at: "2026-09-19T09:00:00Z" },
    });

    const groups = await fetchGroups();
    expect(groups.map((group) => group.id).sort()).toEqual([
      "five-hour",
      "seven-day",
      "seven-day-opus",
      "seven-day-sonnet",
    ]);
    expect(groups.find((group) => group.id === "seven-day-opus")?.remainingFraction).toBeCloseTo(0.2, 5);
  });

  it("fills missing shared windows from the flat keys when limits[] is partial", async () => {
    respondWithUsage({
      five_hour: { utilization: 10, resets_at: "2026-09-14T02:10:00Z" },
      seven_day: { utilization: 40, resets_at: "2026-09-19T09:00:00Z" },
      limits: [
        {
          kind: "weekly_scoped",
          percent: 100,
          severity: "critical",
          scope: { model: { display_name: "Fable" } },
        },
      ],
    });

    const groups = await fetchGroups();
    expect(groups.find((group) => group.id === "seven-day-fable")?.remainingFraction).toBe(0);
    expect(groups.find((group) => group.id === "five-hour")?.remainingFraction).toBeCloseTo(0.9, 5);
    expect(groups.find((group) => group.id === "seven-day")?.remainingFraction).toBeCloseTo(0.6, 5);
  });

  it("lets limits[] win over conflicting flat keys", async () => {
    respondWithUsage({
      five_hour: { utilization: 10 },
      limits: [
        { kind: "session", percent: 50, severity: "normal" },
        { kind: "weekly_all", percent: 20, severity: "normal" },
      ],
    });

    const groups = await fetchGroups();
    expect(groups).toHaveLength(2);
    expect(groups.find((group) => group.id === "five-hour")?.remainingFraction).toBeCloseTo(0.5, 5);
    expect(groups.find((group) => group.id === "seven-day")?.remainingFraction).toBeCloseTo(0.8, 5);
  });

  it("ignores an empty limits[] and keeps the flat keys", async () => {
    respondWithUsage({
      five_hour: { utilization: 10 },
      limits: [],
    });

    const groups = await fetchGroups();
    expect(groups.map((group) => group.id)).toEqual(["five-hour"]);
  });

  it("ignores a malformed limits value instead of failing", async () => {
    respondWithUsage({
      five_hour: { utilization: 10 },
      limits: { kind: "session", percent: 10 },
    });

    const groups = await fetchGroups();
    expect(groups.map((group) => group.id)).toEqual(["five-hour"]);
  });

  it("deduplicates repeated scoped limits and skips unusable percent values", async () => {
    respondWithUsage({
      limits: [
        { kind: "weekly_scoped", percent: 100, scope: { model: { display_name: "Fable" } } },
        { kind: "weekly_scoped", percent: 25, scope: { model: { display_name: "Fable" } } },
        { kind: "weekly_scoped", percent: "50", scope: { model: { display_name: "Stringy" } } },
      ],
    });

    const groups = await fetchGroups();
    const fableGroups = groups.filter((group) => group.id === "seven-day-fable");
    expect(fableGroups).toHaveLength(1);
    expect(fableGroups[0]?.remainingFraction).toBe(0);
    // A non-numeric percent is skipped rather than coerced.
    expect(groups.some((group) => group.id === "seven-day-stringy")).toBe(false);
  });

  it("labels an unknown scoped limit from its kind when no model is named", async () => {
    respondWithUsage({
      limits: [{ kind: "monthly_scoped", group: "monthly", percent: 30 }],
    });

    const groups = await fetchGroups();
    expect(groups[0]?.id).toBe("limit-monthly-scoped");
    expect(groups[0]?.label).toBe("Monthly Scoped");
    expect(groups[0]?.remainingFraction).toBeCloseTo(0.7, 5);
  });

  it("does not mark other models' limits as critical when only Fable is scoped", async () => {
    respondWithUsage({
      limits: [
        { kind: "session", percent: 10, severity: "normal" },
        { kind: "weekly_all", percent: 40, severity: "normal" },
        {
          kind: "weekly_scoped",
          percent: 100,
          severity: "critical",
          scope: { model: { display_name: "Fable" } },
        },
      ],
    });

    const groups = await fetchGroups();
    expect(groups.find((group) => group.id === "seven-day-fable")?.severity).toBe("critical");
    expect(groups.find((group) => group.id === "five-hour")?.severity).toBe("normal");
    expect(groups.find((group) => group.id === "seven-day")?.severity).toBe("normal");
  });

  it("surfaces the 7d_oi unified header from the messages fallback", async () => {
    const authFilesResponse = {
      files: [
        {
          auth_index: 0,
          provider: "claude",
          email: "user@anthropic.com",
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
      // OAuth usage endpoint returns a non-2xx status, forcing the messages fallback.
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status_code: 500, body: {} }),
        body: { cancel: vi.fn() },
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            status_code: 200,
            header: {
              "Anthropic-Ratelimit-Unified-5h-Utilization": ["0.1"],
              "Anthropic-Ratelimit-Unified-5h-Reset": ["1789000000"],
              "Anthropic-Ratelimit-Unified-5h-Status": ["allowed"],
              "Anthropic-Ratelimit-Unified-7d-Utilization": ["0.5"],
              "Anthropic-Ratelimit-Unified-7d-Reset": ["1789000000"],
              "Anthropic-Ratelimit-Unified-7d-Status": ["allowed"],
              "Anthropic-Ratelimit-Unified-7d_oi-Utilization": ["1.01"],
              "Anthropic-Ratelimit-Unified-7d_oi-Reset": ["1789000000"],
              "Anthropic-Ratelimit-Unified-7d_oi-Status": ["rejected"],
            },
          }),
        body: { cancel: vi.fn() },
      });

    const { GET } = await import("./route");

    const request = new Request("http://localhost/api/quota", {
      headers: { cookie: "session=test" },
    });
    const response = await GET(request as NextRequest);
    const data = await response.json();

    const account = data.accounts[0];
    expect(account.supported).toBe(true);

    const groups: QuotaGroup[] = account.groups;
    const premium = groups.find((group) => group.id === "seven-day-oi");
    expect(premium).toBeDefined();
    expect(premium?.label).toBe("7d Fable");
    expect(premium?.remainingFraction).toBe(0);
    // `-Status: rejected` marks the window as exhausted, matching the limits[] path.
    expect(premium?.severity).toBe("critical");
    expect(groups.find((group) => group.id === "five-hour")?.remainingFraction).toBeCloseTo(0.9, 5);
    expect(groups.find((group) => group.id === "seven-day")?.remainingFraction).toBeCloseTo(0.5, 5);
    expect(groups.find((group) => group.id === "seven-day")?.severity).toBeUndefined();
  });
});
