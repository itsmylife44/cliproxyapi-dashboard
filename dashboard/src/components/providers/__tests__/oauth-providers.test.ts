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

import { GET } from "@/app/api/management/[...path]/route";
import { OAUTH_PROVIDERS } from "../oauth-section";

/** Extract the management path from a provider's proxied auth endpoint. */
function managementPathFor(authEndpoint: string): string | null {
  const match = /^\/api\/management\/([^?]+)/.exec(authEndpoint);
  return match?.[1] ?? null;
}

describe("OAuth provider list vs management proxy allowlist", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.verifySession.mockResolvedValue({ userId: "user-1" });
    mocks.findUnique.mockResolvedValue({ isAdmin: true });
    mocks.fetchWithRetry.mockResolvedValue(
      new Response(JSON.stringify({ status: "ok" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
  });

  const providersWithEndpoints: Array<{ id: string; path: string }> = [];
  for (const provider of OAUTH_PROVIDERS) {
    const path = provider.authEndpoint ? managementPathFor(provider.authEndpoint) : null;
    if (path) providersWithEndpoints.push({ id: provider.id, path });
  }

  it("has at least one provider to check", () => {
    expect(providersWithEndpoints.length).toBeGreaterThan(0);
  });

  it.each(providersWithEndpoints)(
    "allows starting the $id OAuth flow through the management proxy",
    async ({ path }) => {
      const request = new NextRequest(`http://localhost/api/management/${path}`);
      const response = await GET(request, {
        params: Promise.resolve({ path: path.split("/") }),
      });

      // A 400 means the path is missing from the proxy allowlist, so the
      // connect button would fail before reaching CLIProxyAPI.
      expect(response.status).toBe(200);
      expect(String(mocks.fetchWithRetry.mock.calls[0]?.[0])).toContain(`/v0/management/${path}`);
    }
  );

  it("offers xAI with a device-based flow", () => {
    const xai = OAUTH_PROVIDERS.find((provider) => provider.id === "xai");
    expect(xai).toBeDefined();
    expect(xai?.requiresCallback).toBe(false);
    expect(xai?.authEndpoint).toContain("xai-auth-url");
  });
});
