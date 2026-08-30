import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  count: vi.fn(),
  create: vi.fn(),
  deleteMany: vi.fn(),
  fetchWithTimeout: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    providerKeyOwnership: {
      count: mocks.count,
      create: mocks.create,
      deleteMany: mocks.deleteMany,
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

import { contributeKey } from "../api-key-ops";
import { PROVIDER } from "../constants";

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
