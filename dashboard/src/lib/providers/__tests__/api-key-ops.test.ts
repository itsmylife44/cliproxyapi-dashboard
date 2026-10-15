import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  count: vi.fn(),
  create: vi.fn(),
  deleteMany: vi.fn(),
  findUnique: vi.fn(),
  delete: vi.fn(),
  fetchWithTimeout: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    providerKeyOwnership: {
      count: mocks.count,
      create: mocks.create,
      deleteMany: mocks.deleteMany,
      findUnique: mocks.findUnique,
      delete: mocks.delete,
    },
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn() },
}));

vi.mock("@/lib/cache", () => ({
  invalidateUsageCaches: vi.fn(),
  invalidateProxyModelsCache: vi.fn(),
}));

vi.mock("@/lib/providers/settings", () => ({
  getMaxProviderKeysPerUser: vi.fn().mockResolvedValue(10),
}));

vi.mock("@/lib/providers/management-api", () => ({
  providerMutex: { acquire: vi.fn().mockResolvedValue(() => {}) },
  fetchWithTimeout: mocks.fetchWithTimeout,
  MANAGEMENT_BASE_URL: "http://management.test",
  MANAGEMENT_API_KEY: "management-key",
  FETCH_TIMEOUT_MS: 10_000,
  isRecord: (value: unknown) =>
    typeof value === "object" && value !== null && !Array.isArray(value),
  isApiKeyArray: (value: unknown) =>
    Array.isArray(value) &&
    value.every(
      (entry) =>
        typeof entry === "object" &&
        entry !== null &&
        typeof (entry as Record<string, unknown>)["api-key"] === "string",
    ),
  isOpenAICompatArray: (value: unknown) => Array.isArray(value),
}));

import { contributeKey, removeKey, removeKeyByAdmin } from "../api-key-ops";
import { PROVIDER } from "../constants";
import { hashProviderKey } from "../hash";

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

describe("contributeKey", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.count.mockResolvedValue(0);
    mocks.create.mockResolvedValue({});
    mocks.deleteMany.mockResolvedValue({ count: 1 });
  });

  it("adds the official OpenAI base URL to Codex API key entries", async () => {
    const apiKey = "sk-test-codex-key";

    mocks.fetchWithTimeout
      .mockResolvedValueOnce(jsonResponse({ "codex-api-key": [] }))
      .mockResolvedValueOnce(jsonResponse({ status: "ok" }))
      .mockResolvedValueOnce(
        jsonResponse({
          "codex-api-key": [
            { "api-key": apiKey, "base-url": "https://api.openai.com/v1" },
          ],
        }),
      );

    const result = await contributeKey("user-1", PROVIDER.CODEX, apiKey);

    expect(result.ok).toBe(true);
    const putCall = mocks.fetchWithTimeout.mock.calls[1];
    if (!putCall) throw new Error("Expected a Management API PUT request");
    const putOptions = putCall[1] as RequestInit;
    expect(JSON.parse(putOptions.body as string)).toEqual([
      { "api-key": apiKey, "base-url": "https://api.openai.com/v1" },
    ]);
    expect(mocks.deleteMany).not.toHaveBeenCalled();
  });

  it("adds the official xAI base URL to xAI API key entries", async () => {
    const apiKey = "xai-test-key";

    mocks.fetchWithTimeout
      .mockResolvedValueOnce(jsonResponse({ "xai-api-key": [] }))
      .mockResolvedValueOnce(jsonResponse({ status: "ok" }))
      .mockResolvedValueOnce(
        jsonResponse({
          "xai-api-key": [
            { "api-key": apiKey, "base-url": "https://api.x.ai/v1" },
          ],
        }),
      );

    const result = await contributeKey("user-1", PROVIDER.XAI, apiKey);

    expect(result.ok).toBe(true);

    // CLIProxyAPI exposes xAI keys on their own management endpoint.
    const getCall = mocks.fetchWithTimeout.mock.calls[0];
    expect(getCall?.[0]).toBe("http://management.test/xai-api-key");

    // Entries without a base URL are dropped by the proxy, so it is required.
    const putCall = mocks.fetchWithTimeout.mock.calls[1];
    if (!putCall) throw new Error("Expected a Management API PUT request");
    const putOptions = putCall[1] as RequestInit;
    expect(JSON.parse(putOptions.body as string)).toEqual([
      { "api-key": apiKey, "base-url": "https://api.x.ai/v1" },
    ]);
    expect(mocks.deleteMany).not.toHaveBeenCalled();
  });

  it("rolls back ownership when the management API silently filters the key", async () => {
    mocks.fetchWithTimeout
      .mockResolvedValueOnce(jsonResponse({ "codex-api-key": [] }))
      .mockResolvedValueOnce(jsonResponse({ status: "ok" }))
      .mockResolvedValueOnce(jsonResponse({ "codex-api-key": [] }));

    const result = await contributeKey(
      "user-1",
      PROVIDER.CODEX,
      "sk-filtered-codex-key",
    );

    expect(result).toEqual({
      ok: false,
      error: "Management API did not persist the key",
    });
    expect(mocks.deleteMany).toHaveBeenCalledOnce();
  });
});

describe("key removal", () => {
  // Same key configured twice (manual config edit); upstream answers 400
  // "multiple items match api-key; base-url is required" without base-url.
  const sharedKey = "sk-ant-shared";
  const duplicateClaudeEntries = {
    "claude-api-key": [
      { "api-key": sharedKey, "base-url": "https://a.example/v1" },
      { "api-key": sharedKey, "base-url": "https://b.example/v1" },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.delete.mockResolvedValue({});
    mocks.findUnique.mockResolvedValue({
      keyHash: hashProviderKey(sharedKey),
      userId: "user-1",
      provider: PROVIDER.CLAUDE,
    });
  });

  const deleteUrl = () => mocks.fetchWithTimeout.mock.calls[1]?.[0];

  it("removeKey sends the matched entry's base-url", async () => {
    mocks.fetchWithTimeout
      .mockResolvedValueOnce(jsonResponse(duplicateClaudeEntries))
      .mockResolvedValueOnce(jsonResponse({ status: "ok" }));

    const result = await removeKey("user-1", hashProviderKey(sharedKey), false);

    expect(result).toEqual({ ok: true });
    expect(deleteUrl()).toBe(
      "http://management.test/claude-api-key?api-key=sk-ant-shared&base-url=https%3A%2F%2Fa.example%2Fv1",
    );
  });

  it("removeKeyByAdmin sends the matched entry's base-url", async () => {
    mocks.fetchWithTimeout
      .mockResolvedValueOnce(jsonResponse(duplicateClaudeEntries))
      .mockResolvedValueOnce(jsonResponse({ status: "ok" }));

    const result = await removeKeyByAdmin(hashProviderKey(sharedKey), PROVIDER.CLAUDE);

    expect(result).toEqual({ ok: true });
    expect(deleteUrl()).toBe(
      "http://management.test/claude-api-key?api-key=sk-ant-shared&base-url=https%3A%2F%2Fa.example%2Fv1",
    );
  });
});

describe("openai-compatibility key removal", () => {
  const key = "sk-compat-target";

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.delete.mockResolvedValue({});
    mocks.findUnique.mockResolvedValue({
      keyHash: hashProviderKey(key),
      userId: "user-1",
      provider: PROVIDER.OPENAI_COMPAT,
    });
  });

  it("deletes the entry by name when the key is its only one", async () => {
    mocks.fetchWithTimeout
      .mockResolvedValueOnce(
        jsonResponse({
          "openai-compatibility": [
            { name: "other", "api-key-entries": [{ "api-key": "sk-other" }] },
            { name: "mock", "api-key-entries": [{ "api-key": key }] },
          ],
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ status: "ok" }));

    const result = await removeKey("user-1", hashProviderKey(key), false);

    expect(result).toEqual({ ok: true });
    const [url, init] = mocks.fetchWithTimeout.mock.calls[1] as [string, RequestInit];
    expect(url).toBe("http://management.test/openai-compatibility?name=mock");
    expect(init.method).toBe("DELETE");
  });

  it("patches out just this key when the entry has other keys", async () => {
    mocks.fetchWithTimeout
      .mockResolvedValueOnce(
        jsonResponse({
          "openai-compatibility": [
            {
              name: "mock",
              "api-key-entries": [
                { "api-key": "sk-keep", "proxy-url": "socks5://proxy:1080" },
                { "api-key": key },
              ],
            },
          ],
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ status: "ok" }));

    const result = await removeKeyByAdmin(hashProviderKey(key), PROVIDER.OPENAI_COMPAT);

    expect(result).toEqual({ ok: true });
    const [url, init] = mocks.fetchWithTimeout.mock.calls[1] as [string, RequestInit];
    expect(url).toBe("http://management.test/openai-compatibility");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body as string)).toEqual({
      name: "mock",
      value: {
        "api-key-entries": [{ "api-key": "sk-keep", "proxy-url": "socks5://proxy:1080" }],
      },
    });
  });
});
