import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  findMany: vi.fn(),
  fetchWithTimeout: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    providerOAuthOwnership: {
      findUnique: mocks.findUnique,
      findMany: mocks.findMany,
    },
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

vi.mock("@/lib/cache", () => ({
  invalidateUsageCaches: vi.fn(),
  invalidateProxyModelsCache: vi.fn(),
}));

vi.mock("@/lib/providers/management-api", () => ({
  fetchWithTimeout: mocks.fetchWithTimeout,
  MANAGEMENT_BASE_URL: "http://management.test",
  MANAGEMENT_API_KEY: "management-key",
  FETCH_TIMEOUT_MS: 5_000,
  isRecord: (v: unknown) => typeof v === "object" && v !== null && !Array.isArray(v),
}));

vi.mock("@/lib/providers/oauth-import-normalization", () => ({
  normalizeImportedOAuthCredential: vi.fn(),
}));

import { toggleOAuthAccountByIdOrName } from "../oauth-ops";

describe("toggleOAuthAccountByIdOrName", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findUnique.mockResolvedValue({
      id: "own-1",
      userId: "user-1",
      accountName: "claude-test@x.com.json",
    });
    mocks.fetchWithTimeout.mockResolvedValue(
      new Response(JSON.stringify({ status: "ok" }), { status: 200 }),
    );
  });

  it("sets the disabled flag via PATCH /auth-files/status instead of uploading over the token file", async () => {
    const result = await toggleOAuthAccountByIdOrName("user-1", "own-1", true, false);

    expect(result).toEqual({ ok: true, disabled: true });
    expect(mocks.fetchWithTimeout).toHaveBeenCalledTimes(1);
    const [url, init] = mocks.fetchWithTimeout.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://management.test/auth-files/status");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body as string)).toEqual({
      name: "claude-test@x.com.json",
      disabled: true,
    });
  });
});
