import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  verifySession: vi.fn(),
  userFindUnique: vi.fn(),
  cookieUpdateMany: vi.fn(),
  cookieCreate: vi.fn(),
  customProviderFindUnique: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ verifySession: mocks.verifySession }));
vi.mock("@/lib/auth/origin", () => ({ validateOrigin: () => null }));
vi.mock("@/lib/auth/rate-limit", () => ({
  checkRateLimitWithPreset: () => ({ allowed: true, retryAfterSeconds: 0 }),
}));
vi.mock("@/lib/providers/perplexity", () => ({ isPerplexityEnabled: () => true }));
vi.mock("@/lib/providers/custom-provider-sync", () => ({ syncCustomProviderToProxy: vi.fn() }));
vi.mock("@/lib/logger", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    user: { findUnique: mocks.userFindUnique },
    perplexityCookie: { updateMany: mocks.cookieUpdateMany, create: mocks.cookieCreate },
    customProvider: { findUnique: mocks.customProviderFindUnique },
  },
}));

async function postCookie() {
  const { POST } = await import("./route");
  const res = await POST(
    new NextRequest("http://localhost/api/providers/perplexity-cookie", {
      method: "POST",
      body: JSON.stringify({ cookieData: JSON.stringify({ "next-auth.session-token": "tok" }) }),
    })
  );
  return res.status;
}

describe("POST /api/providers/perplexity-cookie", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.verifySession.mockResolvedValue({ userId: "user-a" });
    mocks.cookieCreate.mockResolvedValue({ id: "c1", label: "Default", isActive: true });
    // Sidecar is unreachable in tests; provider sync failure is logged, not fatal.
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
  });

  it("rejects non-admins with 403 and writes nothing", async () => {
    mocks.userFindUnique.mockResolvedValue({ isAdmin: false });

    expect(await postCookie()).toBe(403);
    expect(mocks.cookieUpdateMany).not.toHaveBeenCalled();
    expect(mocks.cookieCreate).not.toHaveBeenCalled();
  });

  it("lets an admin replace the instance cookie, deactivating every user's active row first", async () => {
    mocks.userFindUnique.mockResolvedValue({ isAdmin: true });

    expect(await postCookie()).toBe(201);
    expect(mocks.cookieUpdateMany).toHaveBeenCalledWith({
      where: { isActive: true },
      data: { isActive: false },
    });
    expect(mocks.cookieUpdateMany.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.cookieCreate.mock.invocationCallOrder[0]!
    );
  });
});
