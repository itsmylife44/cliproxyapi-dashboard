import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

// GHSA-6mf3-mmf8-6jxj: ownership is unique on (provider, accountName), but the
// management API deletes and toggles auth files by name only. A row for the same
// name under another provider must not authorize actions on that file.
const hoisted = vi.hoisted(() => {
  type Row = { id: string; userId: string; provider: string; accountName: string };
  const ownerships: Row[] = [];

  const findUnique = vi.fn(async ({ where }: {
    where: { id?: string; provider_accountName?: { provider: string; accountName: string } };
  }) => {
    const key = where.provider_accountName;
    return ownerships.find((o) =>
      key ? o.provider === key.provider && o.accountName === key.accountName : o.id === where.id,
    ) ?? null;
  });

  const findMany = vi.fn(async ({ where }: { where: { accountName: string } }) =>
    ownerships.filter((o) => o.accountName === where.accountName));

  const remove = vi.fn(async ({ where }: {
    where: { id?: string; provider_accountName?: { provider: string; accountName: string } };
  }) => {
    const key = where.provider_accountName;
    const index = ownerships.findIndex((o) =>
      key ? o.provider === key.provider && o.accountName === key.accountName : o.id === where.id,
    );
    return ownerships.splice(index, 1)[0];
  });

  const fetchWithTimeout = vi.fn();

  return { ownerships, findUnique, findMany, remove, fetchWithTimeout };
});

vi.mock("@/lib/db", () => ({
  prisma: {
    providerOAuthOwnership: {
      findUnique: hoisted.findUnique,
      findMany: hoisted.findMany,
      delete: hoisted.remove,
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
  fetchWithTimeout: hoisted.fetchWithTimeout,
  MANAGEMENT_BASE_URL: "http://management.test",
  MANAGEMENT_API_KEY: "management-key",
  FETCH_TIMEOUT_MS: 5_000,
}));

vi.mock("@/lib/providers/oauth-import-normalization", () => ({
  normalizeImportedOAuthCredential: vi.fn(),
}));

import {
  removeOAuthAccount,
  removeOAuthAccountByIdOrName,
  toggleOAuthAccountByIdOrName,
} from "../oauth-ops";

const FILE = "claude-bob@example.com.json";

/** Management calls that would change an auth file (anything but the list GET). */
function mutatingCalls() {
  return hoisted.fetchWithTimeout.mock.calls.filter(
    ([, init]) => (init as RequestInit | undefined)?.method !== "GET",
  );
}

describe("OAuth delete/toggle authorize on (provider, accountName)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.ownerships.length = 0;
    hoisted.ownerships.push(
      // Alice's row comes first, so a "take the first name match" lookup picks it.
      { id: "row-alice", userId: "alice", provider: "gemini", accountName: FILE },
      { id: "row-bob", userId: "bob", provider: "claude", accountName: FILE },
    );
    hoisted.fetchWithTimeout.mockImplementation(async (_url: string, init?: RequestInit) =>
      init?.method === "GET"
        ? new Response(JSON.stringify({ files: [{ id: FILE, name: FILE, provider: "claude" }] }))
        : new Response(JSON.stringify({ status: "ok" })),
    );
  });

  it("denies DELETE through a row whose provider does not match the file", async () => {
    const result = await removeOAuthAccountByIdOrName("alice", "row-alice", false);

    expect(result).toEqual({ ok: false, error: "Access denied" });
    expect(mutatingCalls()).toEqual([]);
  });

  it("denies PATCH through a row whose provider does not match the file", async () => {
    const result = await toggleOAuthAccountByIdOrName("alice", "row-alice", true, false);

    expect(result).toEqual({ ok: false, error: "Access denied" });
    expect(mutatingCalls()).toEqual([]);
  });

  it("resolves a shared file name to the row of the file's own provider", async () => {
    expect(await removeOAuthAccountByIdOrName("alice", FILE, false)).toEqual({
      ok: false,
      error: "Access denied",
    });
    expect(mutatingCalls()).toEqual([]);

    expect(await removeOAuthAccountByIdOrName("bob", FILE, false)).toEqual({ ok: true });
    expect(mutatingCalls().map(([url]) => url)).toEqual([
      `http://management.test/auth-files?name=${encodeURIComponent(FILE)}`,
    ]);
  });

  it("cascade removal of a mismatched row drops the row but leaves the file alone", async () => {
    const result = await removeOAuthAccount("alice", "gemini", FILE, true);

    expect(result).toEqual({ ok: true });
    expect(mutatingCalls()).toEqual([]);
    expect(hoisted.ownerships.map((o) => o.id)).toEqual(["row-bob"]);
  });
});
