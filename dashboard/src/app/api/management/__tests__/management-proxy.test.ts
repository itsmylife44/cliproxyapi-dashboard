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
    MANAGEMENT_API_KEY: "test-management-key-16",
  },
}));

import { DELETE, GET, PATCH, POST, PUT } from "../[...path]/route";

const PROXIED = { error: "upstream-response" };

const HANDLERS = { GET, POST, PATCH, PUT, DELETE };

function callRoute(method: keyof typeof HANDLERS, path: string[], url = "http://localhost/api/management") {
  const handler = HANDLERS[method];
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

  it.each([
    ["GET", ["plugin-store"]],
    ["POST", ["plugin-store", "gemini-cli", "install"]],
    ["PATCH", ["plugins", "gemini-cli", "enabled"]],
    ["DELETE", ["plugins", "gemini-cli"]],
    ["GET", ["plugins", "zcode", "config"]],
    ["PATCH", ["plugins", "zcode", "config"]],
  ] as const)("proxies plugin management %s %s for admins", async (method, path) => {
    const response = await callRoute(method, [...path]);

    expect(response.status).toBe(200);
    expect(String(mocks.fetchWithRetry.mock.calls[0]?.[0])).toContain(`/v0/management/${path.join("/")}`);
  });

  it("forwards the store source on plugin install", async () => {
    await callRoute("POST", ["plugin-store", "gemini-cli", "install"], "http://localhost/api/management?source=official");

    expect(String(mocks.fetchWithRetry.mock.calls[0]?.[0])).toContain("install?source=official");
  });

  it("forbids non-admins from installing plugins", async () => {
    mocks.findUnique.mockResolvedValue({ isAdmin: false });

    const response = await callRoute("POST", ["plugin-store", "gemini-cli", "install"]);

    expect(response.status).toBe(403);
    expect(mocks.fetchWithRetry).not.toHaveBeenCalled();
  });

  it("forbids non-admins from changing plugin settings", async () => {
    mocks.findUnique.mockResolvedValue({ isAdmin: false });

    const response = await callRoute("PATCH", ["plugins", "zcode", "config"]);

    expect(response.status).toBe(403);
    expect(mocks.fetchWithRetry).not.toHaveBeenCalled();
  });

  it("passes the plugin-support header through to the client", async () => {
    mocks.fetchWithRetry.mockResolvedValue(
      new Response("{}", { status: 200, headers: { "X-CPA-SUPPORT-PLUGIN": "0" } })
    );

    const response = await callRoute("GET", ["plugin-store"]);

    expect(response.headers.get("X-CPA-SUPPORT-PLUGIN")).toBe("0");
  });

  it("adds no plugin-support header when upstream sends none", async () => {
    const response = await callRoute("GET", ["plugin-store"]);

    expect(response.headers.has("X-CPA-SUPPORT-PLUGIN")).toBe(false);
  });

  it("refuses PUT on plugin settings, which would disable the plugin and drop its store record", async () => {
    const response = await callRoute("PUT", ["plugins", "zcode", "config"]);

    expect(response.status).toBe(405);
    expect(await response.json()).toEqual({
      error: { code: "VALIDATION_ERROR", message: "Use PATCH to change plugin settings" },
    });
    expect(mocks.fetchWithRetry).not.toHaveBeenCalled();
  });
});
