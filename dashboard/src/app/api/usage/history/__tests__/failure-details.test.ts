import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  verifySession: vi.fn(),
  userFindUnique: vi.fn(),
  ownershipFindMany: vi.fn(),
  usageRecordFindMany: vi.fn(),
  collectorStateFindUnique: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ verifySession: mocks.verifySession }));
vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));
vi.mock("@/lib/cache", () => ({
  usageCache: { get: vi.fn(() => null), set: vi.fn() },
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    user: { findUnique: mocks.userFindUnique },
    providerOAuthOwnership: { findMany: mocks.ownershipFindMany },
    usageRecord: { findMany: mocks.usageRecordFindMany },
    collectorState: { findUnique: mocks.collectorStateFindUnique },
  },
}));

import { GET } from "../route";

function makeRecord(overrides: Partial<{
  id: string;
  userId: string | null;
  failed: boolean;
  failureStatus: number | null;
  failureCode: string | null;
}>) {
  return {
    id: overrides.id ?? "rec-1",
    apiKeyId: "key-1",
    userId: overrides.userId !== undefined ? overrides.userId : "user-1",
    authIndex: "auth-1",
    model: "gpt-5",
    latencyMs: 120,
    totalTokens: 100,
    inputTokens: 80,
    outputTokens: 20,
    reasoningTokens: 0,
    cachedTokens: 0,
    failed: overrides.failed ?? false,
    failureStatus: overrides.failureStatus ?? null,
    failureCode: overrides.failureCode ?? null,
    timestamp: new Date("2026-10-14T10:00:00Z"),
    user: { username: "alice" },
    apiKey: { name: "key-1" },
  };
}

describe("GET /api/usage/history - failureBody scoping and projection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.collectorStateFindUnique.mockResolvedValue(null);
    mocks.ownershipFindMany.mockResolvedValue([]);
  });

  it("omits failureBody from the main query and scopes failureBody for non-admins", async () => {
    mocks.verifySession.mockResolvedValue({ userId: "user-1" });
    mocks.userFindUnique.mockResolvedValue({ isAdmin: false, username: "alice" });
    mocks.usageRecordFindMany
      .mockResolvedValueOnce([
        makeRecord({ id: "rec-own-fail", userId: "user-1", failed: true, failureStatus: 500, failureCode: "err" }),
        makeRecord({ id: "rec-other-fail", userId: "user-2", failed: true, failureStatus: 502, failureCode: "bad_gw" }),
        makeRecord({ id: "rec-ok", userId: "user-1", failed: false }),
      ])
      .mockResolvedValueOnce([
        { id: "rec-own-fail", failureBody: "own failure body" },
        { id: "rec-other-fail", failureBody: "context canceled" },
      ]);

    const res = await GET(new NextRequest("http://localhost/api/usage/history?from=2026-10-14&to=2026-10-14"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mocks.usageRecordFindMany).toHaveBeenCalledTimes(2);
    expect(mocks.usageRecordFindMany.mock.calls[0]?.[0]?.select).not.toHaveProperty("failureBody");
    expect(mocks.usageRecordFindMany.mock.calls[1]?.[0]).toEqual({
      where: { id: { in: ["rec-own-fail", "rec-other-fail"] } },
      select: { id: true, failureBody: true },
    });

    expect(body.data.requestEvents[0]).toMatchObject({
      id: "rec-own-fail",
      failureBody: "own failure body",
      cancelled: false,
    });
    expect(body.data.requestEvents[1]).toMatchObject({
      id: "rec-other-fail",
      failureBody: null,
      cancelled: true,
    });
    expect(body.data.requestEvents[2]).toMatchObject({
      id: "rec-ok",
      failureBody: null,
      cancelled: false,
    });
  });

  it("returns failureBody for all failed events when the user is an admin", async () => {
    mocks.verifySession.mockResolvedValue({ userId: "admin-1" });
    mocks.userFindUnique.mockResolvedValue({ isAdmin: true, username: "admin" });
    mocks.usageRecordFindMany
      .mockResolvedValueOnce([
        makeRecord({ id: "rec-other-fail", userId: "user-2", failed: true, failureStatus: 502 }),
      ])
      .mockResolvedValueOnce([
        { id: "rec-other-fail", failureBody: "upstream 502 details" },
      ]);

    const res = await GET(new NextRequest("http://localhost/api/usage/history?from=2026-10-14&to=2026-10-14"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.requestEvents[0]).toMatchObject({
      id: "rec-other-fail",
      failureBody: "upstream 502 details",
    });
  });
});
