import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

const { verifySession, userFindUnique, getAccountQuotaHistory, getAccountsQuotaHistory } = vi.hoisted(() => ({
  verifySession: vi.fn(),
  userFindUnique: vi.fn(),
  getAccountQuotaHistory: vi.fn(),
  getAccountsQuotaHistory: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  verifySession,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findUnique: userFindUnique,
    },
  },
}));

vi.mock("@/lib/quota/quota-history", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/quota/quota-history")>();
  return {
    ...actual,
    getAccountQuotaHistory,
    getAccountsQuotaHistory,
  };
});

import { GET } from "./route";

const SAMPLE_HISTORY = {
  authIndex: "acc-1",
  hasAnySnapshots: true,
  windows: {
    "gemini-5h": {
      estimatedFullWindowUsd: 300,
      previousEstimatedFullWindowUsd: 250,
      estimatedRemainingUsd: 294,
    },
  },
  models: [
    {
      modelId: "gemini-2.5-pro",
      groupId: "gemini-5h",
      currentRemainingPct: 98,
      resetTime: "2026-11-10T15:00:00.000Z",
      estimatedFullWindowUsd: 300,
      previousEstimatedFullWindowUsd: 250,
      estimatedRemainingUsd: 294,
      observedDelta: 0.02,
      observedUsageUsd: 6,
      series: [
        {
          timestamp: "2026-11-10T10:00:00.000Z",
          remainingPct: 100,
          estimatedRemainingUsd: 300,
        },
        {
          timestamp: "2026-11-10T11:30:00.000Z",
          remainingPct: 98,
          estimatedRemainingUsd: 294,
        },
      ],
    },
  ],
};

describe("GET /api/quota/history", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    verifySession.mockResolvedValueOnce(null);
    const res = await GET(new NextRequest("http://localhost/api/quota/history?authIndex=acc-1"));
    expect(res.status).toBe(401);
  });

  it("returns full valuation for admin users", async () => {
    verifySession.mockResolvedValueOnce({ userId: "admin-1", username: "admin", sessionVersion: 0 });
    userFindUnique.mockResolvedValueOnce({ isAdmin: true });
    getAccountQuotaHistory.mockResolvedValueOnce(SAMPLE_HISTORY);

    const res = await GET(new NextRequest("http://localhost/api/quota/history?authIndex=acc-1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.windows["gemini-5h"].estimatedFullWindowUsd).toBe(300);
    expect(body.models[0].estimatedFullWindowUsd).toBe(300);
    expect(body.models[0].series[0].estimatedRemainingUsd).toBe(300);
  });

  it("redacts usage-derived USD valuations for non-admin users while keeping quota % history", async () => {
    verifySession.mockResolvedValueOnce({ userId: "user-1", username: "viewer", sessionVersion: 0 });
    userFindUnique.mockResolvedValueOnce({ isAdmin: false });
    getAccountQuotaHistory.mockResolvedValueOnce(SAMPLE_HISTORY);

    const res = await GET(new NextRequest("http://localhost/api/quota/history?authIndex=acc-1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.windows["gemini-5h"]).toEqual({
      estimatedFullWindowUsd: null,
      previousEstimatedFullWindowUsd: null,
      estimatedRemainingUsd: null,
    });
    expect(body.models[0].estimatedFullWindowUsd).toBeNull();
    expect(body.models[0].previousEstimatedFullWindowUsd).toBeNull();
    expect(body.models[0].estimatedRemainingUsd).toBeNull();
    expect(body.models[0].observedUsageUsd).toBe(0);
    expect(body.models[0].series.map((p: { remainingPct: number }) => p.remainingPct)).toEqual([100, 98]);
    expect(body.models[0].series.every((p: { estimatedRemainingUsd: number | null }) => p.estimatedRemainingUsd === null)).toBe(true);
  });

  it("redacts batch histories for non-admin users", async () => {
    verifySession.mockResolvedValueOnce({ userId: "user-1", username: "viewer", sessionVersion: 0 });
    userFindUnique.mockResolvedValueOnce({ isAdmin: false });
    getAccountsQuotaHistory.mockResolvedValueOnce({ "acc-1": SAMPLE_HISTORY });

    const res = await GET(new NextRequest("http://localhost/api/quota/history?authIndices=acc-1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.histories["acc-1"].windows["gemini-5h"].estimatedFullWindowUsd).toBeNull();
    expect(body.histories["acc-1"].models[0].estimatedFullWindowUsd).toBeNull();
  });
});
