import { NextRequest } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock external dependencies before importing route
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

// Track all fetch calls
const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

// Set required env vars
vi.stubEnv("MANAGEMENT_API_KEY", "test-key");
vi.stubEnv("CLIPROXYAPI_MANAGEMENT_URL", "http://test:8317/v0/management");

function createQuotaRequest(): NextRequest {
  return new NextRequest("http://localhost/api/quota", {
    headers: { cookie: "session=test" },
  });
}

describe("GET /api/quota — Gemini CLI support (issue #125)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return supported: true for gemini-cli accounts", async () => {
    // Mock auth-files response with a gemini-cli account
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

    // Mock Google fetchAvailableModels response (same format as Antigravity)
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
      // First call: auth-files
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(authFilesResponse),
        body: { cancel: vi.fn() },
      })
      // Second call: api-call for gemini-cli quota
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(googleModelsResponse),
        body: { cancel: vi.fn() },
      });

    const { GET } = await import("./route");

    const response = await GET(createQuotaRequest());
    const data = await response.json();

    // Route returns { accounts: [...] } directly (no success wrapper)
    expect(data.accounts).toBeDefined();
    expect(data.accounts).toHaveLength(1);

    const account = data.accounts[0];
    expect(account.provider).toBe("gemini-cli");
    expect(account.supported).toBe(true);
    // Should have quota groups, not be unsupported
    expect(account.groups).toBeDefined();
    expect(account.groups.length).toBeGreaterThan(0);
  });

  it("should return supported: true with error for gemini-cli auth failures", async () => {
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
        ok: false,
        status: 401,
        json: () => Promise.resolve({}),
        body: { cancel: vi.fn() },
      });

    const { GET } = await import("./route");

    const response = await GET(createQuotaRequest());
    const data = await response.json();

    // Route returns { accounts: [...] } directly (no success wrapper)
    expect(data.accounts).toBeDefined();
    const account = data.accounts[0];
    expect(account.provider).toBe("gemini-cli");
    expect(account.supported).toBe(true);
    expect(account.error).toBeDefined();
  });

  it("should handle 'gemini' provider the same as 'gemini-cli'", async () => {
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
        json: () => Promise.resolve(googleModelsResponse),
        body: { cancel: vi.fn() },
      });

    const { GET } = await import("./route");

    const response = await GET(createQuotaRequest());
    const data = await response.json();

    // Route returns { accounts: [...] } directly (no success wrapper)
    expect(data.accounts).toBeDefined();
    const account = data.accounts[0];
    expect(account.supported).toBe(true);
    expect(account.groups).toBeDefined();
  });
});

// RED: These tests fail until quota/route.ts normalizes provider strings
describe("GET /api/quota — imported provider normalization (issue #provider-fix)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("copilot provider should return supported: true (RED: route checks 'github'/'github-copilot' but not 'copilot')", async () => {
    // RED: This test fails until quota/route.ts normalizes provider strings
    // Fix needed: add || account.provider === "copilot" to the github branch in route.ts

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

    // fetchCopilotQuota calls /api-call and expects ApiCallResponse shape
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
      // First call: auth-files
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(authFilesResponse),
        body: { cancel: vi.fn() },
      })
      // Second call: api-call for copilot quota
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(copilotApiCallResponse),
        body: { cancel: vi.fn() },
      });

    const { GET } = await import("./route");

    const response = await GET(createQuotaRequest());
    const data = await response.json();

    // Route returns { accounts: [...] } directly (no success wrapper)
    expect(data.accounts).toBeDefined();
    expect(data.accounts).toHaveLength(1);

    const account = data.accounts[0];
    expect(account.provider).toBe("copilot");
    // RED: currently returns supported: false because route only checks "github"/"github-copilot"
    expect(account.supported).toBe(true);
    expect(account.groups).toBeDefined();
  });

  it("CLAUDE (uppercase) provider should return supported: true (RED: route uses strict equality, no toLowerCase)", async () => {
    // RED: This test fails until quota/route.ts normalizes provider strings
    // Fix needed: normalize provider to lowercase before the if-chain, e.g.:
    //   const normalizedProvider = account.provider.toLowerCase();

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

    fetchMock
      // First call: auth-files — no second call needed, route falls through before fetching
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(authFilesResponse),
        body: { cancel: vi.fn() },
      });

    const { GET } = await import("./route");

    const response = await GET(createQuotaRequest());
    const data = await response.json();

    // Route returns { accounts: [...] } directly (no success wrapper)
    expect(data.accounts).toBeDefined();
    expect(data.accounts).toHaveLength(1);

    const account = data.accounts[0];
    expect(account.provider).toBe("CLAUDE");
    // RED: currently returns supported: false because route checks === "claude" (lowercase only)
    expect(account.supported).toBe(true);
  });

  it("unknown-xyz provider should return supported: false (regression guard — must always pass)", async () => {
    // GREEN: This test should always pass — regression guard to ensure unknown providers
    // are never accidentally marked as supported after normalization changes.

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

    fetchMock
      // First call: auth-files — no second call, route falls through
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(authFilesResponse),
        body: { cancel: vi.fn() },
      });

    const { GET } = await import("./route");

    const response = await GET(createQuotaRequest());
    const data = await response.json();

    // Route returns { accounts: [...] } directly (no success wrapper)
    expect(data.accounts).toBeDefined();
    expect(data.accounts).toHaveLength(1);

    const account = data.accounts[0];
    expect(account.provider).toBe("unknown-xyz");
    // GREEN: unknown providers must always return supported: false
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

    const response = await GET(createQuotaRequest());
    const data = await response.json();

    expect(data.accounts).toBeDefined();
    expect(data.accounts).toHaveLength(1);

    const account = data.accounts[0];
    expect(account.provider).toBe("claude");
    expect(account.supported).toBe(true);
    expect(account.email).toBe("claude-credential.json");
    expect(account.groups).toBeDefined();
    expect(account.groups.length).toBeGreaterThan(0);
  });
});
