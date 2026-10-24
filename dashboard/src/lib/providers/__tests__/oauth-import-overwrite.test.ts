import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  fetchWithTimeout: vi.fn(),
  create: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: { providerOAuthOwnership: { create: mocks.create } },
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
}));

vi.mock("@/lib/providers/oauth-import-normalization", () => ({
  normalizeImportedOAuthCredential: () => ({ ok: true, normalizedContent: "{}" }),
}));

import { importOAuthCredential } from "../oauth-ops";

const VICTIM_FILE = "claude-victim@x.com.json";

// Fake timers so the post-upload claim polling (if reached) does not sleep for real.
async function runImport(fileName: string) {
  const pending = importOAuthCredential("attacker", "claude", fileName, "{}");
  await vi.runAllTimersAsync();
  return pending;
}

function uploadCalls() {
  return mocks.fetchWithTimeout.mock.calls.filter(
    ([, init]) => (init as RequestInit | undefined)?.method === "POST",
  );
}

describe("importOAuthCredential overwrite protection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("refuses to upload over an auth file that already exists (another user's)", async () => {
    mocks.fetchWithTimeout.mockImplementation(async () =>
      new Response(JSON.stringify({ files: [{ name: VICTIM_FILE, provider: "claude" }] }), {
        status: 200,
      }),
    );

    const result = await runImport(`../${VICTIM_FILE}`);

    expect(result).toEqual({ ok: false, error: "Credential file already exists" });
    expect(uploadCalls()).toHaveLength(0);
  });

  it.each([
    ["returns an error status", () => Promise.resolve(new Response("boom", { status: 500 }))],
    ["throws", () => Promise.reject(new Error("network down"))],
  ])("refuses to upload blind when the snapshot request %s", async (_label, snapshot) => {
    mocks.fetchWithTimeout.mockImplementation(async (_url: string, init?: RequestInit) =>
      init?.method === "GET"
        ? snapshot()
        : new Response(JSON.stringify({ status: "ok" }), { status: 200 }),
    );

    const result = await runImport(VICTIM_FILE);

    expect(result.ok).toBe(false);
    expect(uploadCalls()).toHaveLength(0);
  });
});
