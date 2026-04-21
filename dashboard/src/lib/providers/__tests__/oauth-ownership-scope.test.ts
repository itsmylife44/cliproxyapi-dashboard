import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock server-only before importing modules
vi.mock("server-only", () => ({}));

// In-memory Prisma stub that emulates the composite-unique (provider, accountName)
// contract introduced by migration 20260421000000_oauth_ownership_scoped_by_provider.
const hoisted = vi.hoisted(() => {
  const ownerships: {
    id: string;
    userId: string;
    provider: string;
    accountName: string;
    accountEmail: string | null;
  }[] = [];
  const state = { counter: 0 };

  const findUnique = vi.fn(async ({ where }: {
    where: { provider_accountName?: { provider: string; accountName: string } };
  }) => {
    const key = where.provider_accountName;
    if (!key) return null;
    return ownerships.find(
      (o) => o.provider === key.provider && o.accountName === key.accountName,
    ) ?? null;
  });

  const create = vi.fn(async ({ data }: {
    data: {
      userId: string;
      provider: string;
      accountName: string;
      accountEmail: string | null;
    };
  }) => {
    const dup = ownerships.find(
      (o) => o.provider === data.provider && o.accountName === data.accountName,
    );
    if (dup) {
      const err = new Error("Unique constraint failed") as Error & {
        code: string;
        clientVersion: string;
      };
      err.code = "P2002";
      err.clientVersion = "stub";
      throw err;
    }
    const row = {
      id: `cuid-${++state.counter}`,
      ...data,
      accountEmail: data.accountEmail ?? null,
    };
    ownerships.push(row);
    return row;
  });

  return { ownerships, state, findUnique, create };
});

vi.mock("@/lib/db", () => ({
  prisma: {
    providerOAuthOwnership: {
      findUnique: hoisted.findUnique,
      create: hoisted.create,
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
  fetchWithTimeout: vi.fn(),
  MANAGEMENT_BASE_URL: "http://stub",
  MANAGEMENT_API_KEY: "stub-key",
  FETCH_TIMEOUT_MS: 5_000,
  isRecord: (v: unknown) => typeof v === "object" && v !== null && !Array.isArray(v),
}));

vi.mock("@/lib/providers/oauth-import-normalization", () => ({
  normalizeImportedOAuthCredential: vi.fn(),
}));

import { contributeOAuthAccount } from "../oauth-ops";
import { OAUTH_PROVIDER } from "../constants";

describe("contributeOAuthAccount — provider-scoped ownership", () => {
  beforeEach(() => {
    hoisted.ownerships.length = 0;
    hoisted.state.counter = 0;
    hoisted.findUnique.mockClear();
    hoisted.create.mockClear();
  });

  it("allows the same accountName across different providers", async () => {
    const first = await contributeOAuthAccount(
      "user-1",
      OAUTH_PROVIDER.CLAUDE,
      "shared@example.com",
      "shared@example.com",
    );
    expect(first.ok).toBe(true);

    const second = await contributeOAuthAccount(
      "user-1",
      OAUTH_PROVIDER.CODEX,
      "shared@example.com",
      "shared@example.com",
    );
    expect(second.ok).toBe(true);

    expect(hoisted.ownerships).toHaveLength(2);
    expect(hoisted.ownerships.map((o) => o.provider).sort()).toEqual([
      "claude",
      "codex",
    ]);
  });

  it("rejects the same (provider, accountName) from registering twice", async () => {
    const first = await contributeOAuthAccount(
      "user-1",
      OAUTH_PROVIDER.CLAUDE,
      "dup@example.com",
    );
    expect(first.ok).toBe(true);

    const second = await contributeOAuthAccount(
      "user-2",
      OAUTH_PROVIDER.CLAUDE,
      "dup@example.com",
    );
    expect(second.ok).toBe(false);
    expect(second.error).toMatch(/already registered/i);

    expect(hoisted.ownerships).toHaveLength(1);
  });

  it("queries ownership scoped by the composite key, not by accountName alone", async () => {
    await contributeOAuthAccount(
      "user-1",
      OAUTH_PROVIDER.CLAUDE,
      "lookup@example.com",
    );

    expect(hoisted.findUnique).toHaveBeenCalledWith({
      where: {
        provider_accountName: {
          provider: "claude",
          accountName: "lookup@example.com",
        },
      },
    });
  });
});
