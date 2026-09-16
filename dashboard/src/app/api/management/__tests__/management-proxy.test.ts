import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  verifySession: vi.fn(),
  findUnique: vi.fn(),
  fetchWithRetry: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ verifySession: mocks.verifySession }));
vi.mock("@/lib/auth/origin", () => ({ validateOrigin: vi.fn(() => null) }));
vi.mock("@/lib/db", () => ({ prisma: { user: { findUnique: mocks.findUnique } } }));
vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));
vi.mock("@/lib/fetch-utils", () => ({ fetchWithRetry: mocks.fetchWithRetry }));
vi.mock("@/lib/env", () => ({
  env: {
    CLIPROXYAPI_MANAGEMENT_URL: "http://cliproxyapi:8317/v0/management",
    MANAGEMENT_API_KEY: "test-management-key-16",
  },
}));

import { GET, POST } from "../[...path]/route";

const PROXIED = { error: "upstream-response" };

function callRoute(method: "GET" | "POST", path: string[], url = "http://localhost/api/management") {
  const handler = method === "GET" ? GET : POST;
  const request = new NextRequest(`${url}/${path.join("/")}`, { method });
  return handler(request, { params: Promise.resolve({ path }) });
}

describe("management proxy allowlist", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.verifySession.mockResolvedValue({ userId: "user-1" });
    mocks.findUnique.mockResolvedValue({ isAdmin: true });
    mocks.fetchWithRetry.mockResolvedValue(
      new Response(JSON.stringify(PROXIED), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
  });

  it("proxies the xAI device-authorization start endpoint", async () => {
    const response = await callRoute("GET", ["xai-auth-url"], "http://localhost/api/management?is_webui=true");

    expect(response.status).toBe(200);
    expect(mocks.fetchWithRetry).toHaveBeenCalledOnce();
    const targetUrl = String(mocks.fetchWithRetry.mock.calls[0]?.[0]);
    expect(targetUrl).toContain("/v0/management/xai-auth-url");
  });

  it("proxies the xai-api-key management endpoint", async () => {
    const response = await callRoute("GET", ["xai-api-key"]);

    expect(response.status).toBe(200);
    const targetUrl = String(mocks.fetchWithRetry.mock.calls[0]?.[0]);
    expect(targetUrl).toContain("/v0/management/xai-api-key");
  });

  it("still blocks paths outside the allowlist", async () => {
    const response = await callRoute("GET", ["not-an-allowed-path"]);

    expect(response.status).toBe(400);
    expect(mocks.fetchWithRetry).not.toHaveBeenCalled();
  });

  it("allows a non-admin to start the xAI device flow", async () => {
    mocks.findUnique.mockResolvedValue({ isAdmin: false });

    const response = await callRoute("GET", ["xai-auth-url"]);

    expect(response.status).toBe(200);
    expect(mocks.fetchWithRetry).toHaveBeenCalledOnce();
  });

  it("still forbids non-admins from mutating management paths", async () => {
    mocks.findUnique.mockResolvedValue({ isAdmin: false });

    const response = await callRoute("POST", ["xai-auth-url"]);

    expect(response.status).toBe(403);
    expect(mocks.fetchWithRetry).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated callers", async () => {
    mocks.verifySession.mockResolvedValue(null);

    const response = await callRoute("GET", ["xai-auth-url"]);

    expect(response.status).toBe(401);
    expect(mocks.fetchWithRetry).not.toHaveBeenCalled();
  });
});
