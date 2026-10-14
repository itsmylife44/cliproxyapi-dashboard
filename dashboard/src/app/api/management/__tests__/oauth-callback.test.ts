import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => {
  process.env.CLIPROXYAPI_MANAGEMENT_URL = "http://cliproxyapi:8317/v0/management";
  process.env.MANAGEMENT_API_KEY = "test-management-key-16";
  return { create: vi.fn() };
});

vi.mock("@/lib/auth/session", () => ({ verifySession: vi.fn().mockResolvedValue({ userId: "user-1" }) }));
vi.mock("@/lib/auth/origin", () => ({ validateOrigin: vi.fn(() => null) }));
vi.mock("@/lib/auth/rate-limit", () => ({
  checkRateLimitWithPreset: vi.fn(() => ({ allowed: true })),
}));
vi.mock("@/lib/db", () => ({
  prisma: { providerOAuthOwnership: { create: mocks.create, findMany: vi.fn().mockResolvedValue([]) } },
}));
vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { POST } from "../oauth-callback/route";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function callbackRequest(body: unknown) {
  return new NextRequest("http://localhost/api/management/oauth-callback", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/management/oauth-callback", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn(async (url: string) =>
      url.endsWith("/auth-files")
        ? json({ files: [] })
        : json({ status: "error", error: "unknown or expired state" }, 404)
    );
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => vi.unstubAllGlobals());

  it("relays the pasted redirect URL to upstream's generic oauth-callback endpoint", async () => {
    const redirectUrl = "http://localhost:54545/callback?code=abc&state=st-123";
    const response = await POST(callbackRequest({ provider: "claude", callbackUrl: redirectUrl }));

    const relay = fetchMock.mock.calls.find(([url]) => String(url).endsWith("/oauth-callback"));
    expect(relay?.[0]).toBe("http://cliproxyapi:8317/v0/management/oauth-callback");
    expect(relay?.[1]?.method).toBe("POST");
    expect(relay?.[1]?.headers).toMatchObject({ Authorization: "Bearer test-management-key-16" });
    expect(JSON.parse(String(relay?.[1]?.body))).toEqual({
      provider: "claude",
      redirect_url: redirectUrl,
      code: "abc",
      state: "st-123",
    });
    // Upstream's verdict (here: unknown state) is passed through.
    expect(response.status).toBe(404);
  });

  it("rejects providers that upstream no longer supports", async () => {
    for (const provider of ["iflow", "kilo", "gitlab"]) {
      const response = await POST(
        callbackRequest({ provider, callbackUrl: "http://localhost/callback?code=a&state=b" })
      );
      expect(response.status).toBe(400);
    }
  });

  it("relays Devin's redirect URL (root /callback) like the other built-ins", async () => {
    const redirectUrl = "http://localhost:8317/callback?code=dc&state=dv-1";
    await POST(callbackRequest({ provider: "devin", callbackUrl: redirectUrl }));

    const relay = fetchMock.mock.calls.find(([url]) => String(url).endsWith("/oauth-callback"));
    expect(JSON.parse(String(relay?.[1]?.body))).toMatchObject({ provider: "devin", state: "dv-1" });
  });

  it("does not claim a Kimi.ai auth file for a Kimi device login", async () => {
    vi.useFakeTimers();
    try {
      fetchMock.mockImplementation(async () => json({ files: [{ name: "kimi-ai-123.json", provider: "kimi-ai" }] }));
      const pending = POST(callbackRequest({ provider: "kimi", state: "kmi-1" }));
      await vi.runAllTimersAsync();
      expect((await pending).status).toBe(202);
      expect(mocks.create).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
