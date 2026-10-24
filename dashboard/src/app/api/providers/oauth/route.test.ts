import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  verifySession: vi.fn(),
  findUnique: vi.fn(),
  listOAuthWithOwnership: vi.fn(),
  listEnabledPluginOAuthProviders: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ verifySession: mocks.verifySession }));
vi.mock("@/lib/auth/origin", () => ({ validateOrigin: vi.fn(() => null) }));
vi.mock("@/lib/auth/rate-limit", () => ({
  checkRateLimitWithPreset: vi.fn(() => ({ allowed: true })),
}));
vi.mock("@/lib/db", () => ({ prisma: { user: { findUnique: mocks.findUnique } } }));
vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));
vi.mock("@/lib/providers/dual-write", () => ({
  listOAuthWithOwnership: mocks.listOAuthWithOwnership,
}));
vi.mock("@/lib/providers/plugins", () => ({
  listEnabledPluginOAuthProviders: mocks.listEnabledPluginOAuthProviders,
}));

import { GET } from "./route";

const account = {
  id: "acc-1",
  accountName: "claude-alice.json",
  accountEmail: "alice@example.com",
  provider: "claude",
  ownerUsername: "alice",
  ownerUserId: "user-1",
  isOwn: true,
  status: "active",
  statusMessage: null,
  unavailable: false,
};

describe("/api/providers/oauth response body", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.verifySession.mockResolvedValue({ userId: "user-1" });
    mocks.findUnique.mockResolvedValue({ isAdmin: false });
  });

  it("GET returns the accounts and plugin OAuth providers the OAuth section reads", async () => {
    mocks.listOAuthWithOwnership.mockResolvedValue({ ok: true, accounts: [account] });
    mocks.listEnabledPluginOAuthProviders.mockResolvedValue(["kiro"]);

    const res = await GET();

    expect(res.status).toBe(200);
    // Exact body: the UI reads these keys loosely, so any drift must fail here.
    expect(await res.json()).toEqual({
      success: true,
      accounts: [account],
      pluginOAuthProviders: ["kiro"],
    });
  });

  it("does not expose POST: ownership is only created by /claim and /import", async () => {
    const route = await import("./route");
    expect(route).not.toHaveProperty("POST");
  });
});
