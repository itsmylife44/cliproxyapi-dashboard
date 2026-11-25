import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    quotaSnapshot: {
      findMany: vi.fn().mockResolvedValue([]),
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import type { QuotaAccount } from "@/lib/model-first-monitoring";
import {
  PRUNE_INTERVAL_MS,
  QUOTA_SNAPSHOT_RETENTION_DAYS,
  SNAPSHOT_HEARTBEAT_MS,
  pruneOldQuotaSnapshots,
  pruneQuotaSnapshotsIfDue,
  recordQuotaSnapshots,
} from "@/lib/quota/quota-snapshots";

describe("quota-snapshots", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const baseNow = new Date("2026-11-15T12:00:00.000Z");

  it("records snapshots for healthy accounts and skips extra-usage, unsupported, and errored accounts", async () => {
    vi.mocked(prisma.quotaSnapshot.findMany).mockResolvedValueOnce([]);
    vi.mocked(prisma.quotaSnapshot.createMany).mockResolvedValueOnce({ count: 2 });

    const accounts: QuotaAccount[] = [
      {
        auth_index: "auth-1",
        provider: "claude",
        email: "a@example.com",
        supported: true,
        groups: [
          {
            id: "5h",
            label: "5h",
            remainingFraction: 0.8,
            resetTime: "2026-11-15T17:00:00.000Z",
            models: [],
          },
          {
            id: "extra-usage",
            label: "Extra Usage",
            remainingFraction: 0.5,
            resetTime: null,
            models: [],
          },
        ],
      },
      {
        auth_index: "auth-2",
        provider: "antigravity",
        email: "b@example.com",
        supported: true,
        groups: [
          {
            id: "gemini-pro",
            label: "Gemini Pro",
            remainingFraction: 0.9,
            resetTime: null,
            models: [
              {
                id: "gemini-2.5-pro",
                displayName: "Gemini 2.5 Pro",
                remainingFraction: 0.9,
                resetTime: "2026-11-16T00:00:00.000Z",
              },
            ],
          },
        ],
      },
      {
        auth_index: "auth-err",
        provider: "claude",
        email: "err@example.com",
        supported: true,
        error: "401",
        groups: [
          {
            id: "5h",
            label: "5h",
            remainingFraction: 0.5,
            resetTime: null,
            models: [],
          },
        ],
      },
      {
        auth_index: "auth-unsup",
        provider: "unknown",
        email: "u@example.com",
        supported: false,
      },
    ];

    const count = await recordQuotaSnapshots(accounts, baseNow);

    expect(count).toBe(2);
    expect(prisma.quotaSnapshot.createMany).toHaveBeenCalledWith({
      data: [
        {
          authIndex: "auth-1",
          provider: "claude",
          groupId: "5h",
          modelId: "",
          remaining: 0.8,
          resetTime: new Date("2026-11-15T17:00:00.000Z"),
          capturedAt: baseNow,
        },
        {
          authIndex: "auth-2",
          provider: "antigravity",
          groupId: "gemini-pro",
          modelId: "gemini-2.5-pro",
          remaining: 0.9,
          resetTime: new Date("2026-11-16T00:00:00.000Z"),
          capturedAt: baseNow,
        },
      ],
    });
  });

  it("deduplicates unchanged snapshots within the heartbeat window and writes on delta, reset shift, or heartbeat", async () => {
    const accounts: QuotaAccount[] = [
      {
        auth_index: "auth-1",
        provider: "claude",
        email: "a@example.com",
        supported: true,
        groups: [
          {
            id: "5h",
            label: "5h",
            remainingFraction: 0.8,
            resetTime: "2026-11-15T17:00:00.000Z",
            models: [],
          },
        ],
      },
    ];

    // Within 5m, identical remaining and resetTime -> skipped
    vi.mocked(prisma.quotaSnapshot.findMany).mockResolvedValueOnce([
      {
        authIndex: "auth-1",
        groupId: "5h",
        modelId: "",
        remaining: 0.801,
        resetTime: new Date("2026-11-15T17:00:20.000Z"),
        capturedAt: new Date(baseNow.getTime() - 5 * 60 * 1000),
      },
    ] as never);

    expect(await recordQuotaSnapshots(accounts, baseNow)).toBe(0);
    expect(prisma.quotaSnapshot.createMany).not.toHaveBeenCalled();

    // Heartbeat elapsed (>= 15m) -> written
    vi.mocked(prisma.quotaSnapshot.findMany).mockResolvedValueOnce([
      {
        authIndex: "auth-1",
        groupId: "5h",
        modelId: "",
        remaining: 0.8,
        resetTime: new Date("2026-11-15T17:00:00.000Z"),
        capturedAt: new Date(baseNow.getTime() - SNAPSHOT_HEARTBEAT_MS),
      },
    ] as never);
    vi.mocked(prisma.quotaSnapshot.createMany).mockResolvedValueOnce({ count: 1 });

    expect(await recordQuotaSnapshots(accounts, baseNow)).toBe(1);
    expect(prisma.quotaSnapshot.createMany).toHaveBeenCalledTimes(1);
  });

  it("prunes snapshots older than the retention window", async () => {
    vi.mocked(prisma.quotaSnapshot.deleteMany).mockResolvedValueOnce({ count: 42 });

    const deleted = await pruneOldQuotaSnapshots(QUOTA_SNAPSHOT_RETENTION_DAYS, baseNow);

    expect(deleted).toBe(42);
    expect(prisma.quotaSnapshot.deleteMany).toHaveBeenCalledWith({
      where: {
        capturedAt: {
          lt: new Date(baseNow.getTime() - QUOTA_SNAPSHOT_RETENTION_DAYS * 24 * 60 * 60 * 1000),
        },
      },
    });
  });

  it("deterministically prunes on schedule, logs failures, and retries on next call", async () => {
    const t0 = new Date("2026-11-15T12:00:00.000Z");

    // First call fails -> logs warning and does not advance lastPrunedAtMs
    vi.mocked(prisma.quotaSnapshot.deleteMany).mockRejectedValueOnce(new Error("db down"));
    expect(await pruneQuotaSnapshotsIfDue(t0)).toBe(0);
    expect(logger.warn).toHaveBeenCalledTimes(1);

    // Immediate retry succeeds because failed run did not mark pruned
    vi.mocked(prisma.quotaSnapshot.deleteMany).mockResolvedValueOnce({ count: 5 });
    expect(await pruneQuotaSnapshotsIfDue(new Date(t0.getTime() + 1000))).toBe(5);

    // Call within PRUNE_INTERVAL_MS is skipped
    expect(await pruneQuotaSnapshotsIfDue(new Date(t0.getTime() + 60_000))).toBe(0);
    expect(prisma.quotaSnapshot.deleteMany).toHaveBeenCalledTimes(2);

    // Call after PRUNE_INTERVAL_MS runs again
    vi.mocked(prisma.quotaSnapshot.deleteMany).mockResolvedValueOnce({ count: 3 });
    expect(await pruneQuotaSnapshotsIfDue(new Date(t0.getTime() + 1000 + PRUNE_INTERVAL_MS))).toBe(3);
    expect(prisma.quotaSnapshot.deleteMany).toHaveBeenCalledTimes(3);
  });
});
