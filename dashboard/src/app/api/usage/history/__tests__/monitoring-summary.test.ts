import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { UsageSummary } from "@/components/monitoring/usage-stats";

vi.mock("@/lib/auth/session", () => ({ verifySession: vi.fn(async () => ({ userId: "user-1" })) }));
vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));
vi.mock("@/lib/cache", () => ({
  usageCache: { get: vi.fn(() => null), set: vi.fn() },
}));

function record(model: string, totalTokens: number, failed: boolean) {
  return {
    apiKeyId: "key-1",
    userId: "user-1",
    authIndex: "auth-1",
    model,
    latencyMs: 100,
    totalTokens,
    inputTokens: totalTokens,
    outputTokens: 0,
    reasoningTokens: 0,
    cachedTokens: 0,
    failed,
    timestamp: new Date("2026-10-14T10:00:00Z"),
    user: { username: "admin" },
    apiKey: { name: "key-1" },
  };
}

vi.mock("@/lib/db", () => ({
  prisma: {
    user: { findUnique: vi.fn(async () => ({ isAdmin: true, username: "admin" })) },
    providerOAuthOwnership: { findMany: vi.fn(async () => []) },
    usageRecord: {
      findMany: vi.fn(async () => [record("model-a", 10, false), record("model-a", 20, true), record("model-b", 5, false)]),
    },
    collectorState: { findUnique: vi.fn(async () => null) },
  },
}));

import { GET } from "../route";

describe("GET /api/usage/history - monitoring usage panel", () => {
  it("serves the totals and per-model breakdown the monitoring panel shows", async () => {
    const res = await GET(new NextRequest("http://localhost/api/usage/history?from=2026-10-14&to=2026-10-14"));
    const body = await res.json();

    const expected: UsageSummary = {
      totals: { totalRequests: 3, totalTokens: 35, successCount: 2, failureCount: 1 },
      modelBreakdown: [
        { model: "model-a", requests: 2, tokens: 30 },
        { model: "model-b", requests: 1, tokens: 5 },
      ],
    };
    expect(body.data).toMatchObject(expected);
  });
});
