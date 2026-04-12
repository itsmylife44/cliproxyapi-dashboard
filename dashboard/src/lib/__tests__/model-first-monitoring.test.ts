import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  enrichModelFirstGroup,
  isModelFirstAccountQuotaUnverified,
  isModelFirstProviderQuotaUnverified,
  summarizeModelFirstProvider,
  type QuotaAccount,
  type QuotaGroup,
} from "../model-first-monitoring";

describe("model-first monitoring helpers", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-06T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("enriches grouped model data with min/p50 and reset metrics", () => {
    const group: QuotaGroup = {
      id: "gemini-3-pro",
      label: "Gemini 3 Pro",
      remainingFraction: 1,
      resetTime: null,
      models: [
        {
          id: "gemini-3-pro-high",
          displayName: "Gemini 3 Pro High",
          remainingFraction: 1,
          resetTime: "2026-04-07T00:00:00Z",
        },
        {
          id: "gemini-3-pro-low",
          displayName: "Gemini 3 Pro Low",
          remainingFraction: 0.5,
          resetTime: "2026-04-06T20:00:00Z",
        },
        {
          id: "gemini-3.1-pro-high",
          displayName: "Gemini 3.1 Pro High",
          remainingFraction: 0,
          resetTime: "2026-04-08T00:00:00Z",
        },
      ],
    };

    const enriched = enrichModelFirstGroup(group);

    expect(enriched.monitorMode).toBe("model-first");
    expect(enriched.readyModelCount).toBe(2);
    expect(enriched.depletedModelCount).toBe(1);
    expect(enriched.totalModelCount).toBe(3);
    expect(enriched.minRemainingFraction).toBe(0);
    expect(enriched.p50RemainingFraction).toBe(0.5);
    expect(enriched.nextWindowResetAt).toBe("2026-04-06T20:00:00.000Z");
    expect(enriched.fullWindowResetAt).toBe("2026-04-08T00:00:00.000Z");
    expect(enriched.nextRecoveryAt).toBe("2026-04-08T00:00:00.000Z");
    expect(enriched.bottleneckModel).toBe("Gemini 3.1 Pro High");
  });

  it("summarizes provider readiness and stale snapshots from model-first accounts", () => {
    const accounts: QuotaAccount[] = [
      {
        auth_index: "1",
        provider: "antigravity",
        supported: true,
        monitorMode: "model-first",
        snapshotFetchedAt: "2026-04-06T11:59:00.000Z",
        groups: [
          enrichModelFirstGroup({
            id: "claude-gpt",
            label: "Claude/GPT",
            remainingFraction: 1,
            resetTime: null,
            models: [
              {
                id: "claude-sonnet-4-6",
                displayName: "Claude Sonnet 4.6",
                remainingFraction: 1,
                resetTime: "2026-04-07T00:00:00Z",
              },
            ],
          }),
        ],
      },
      {
        auth_index: "2",
        provider: "antigravity",
        supported: true,
        monitorMode: "model-first",
        snapshotFetchedAt: "2026-04-05T00:00:00.000Z",
        groups: [
          enrichModelFirstGroup({
            id: "gemini-2-5-flash",
            label: "Gemini 2.5 Flash",
            remainingFraction: 0,
            resetTime: null,
            models: [
              {
                id: "gemini-2.5-flash",
                displayName: "Gemini 2.5 Flash",
                remainingFraction: 0,
                resetTime: "2026-04-06T08:00:00Z",
              },
            ],
          }),
        ],
      },
    ];

    const summary = summarizeModelFirstProvider(accounts);

    expect(summary.totalAccounts).toBe(2);
    expect(summary.readyAccounts).toBe(1);
    expect(summary.staleAccounts).toBe(1);
    expect(summary.groups).toHaveLength(2);
    expect(summary.groups[0]?.label).toBe("Claude/GPT");
    expect(summary.groups[1]?.label).toBe("Gemini 2.5 Flash");
  });

  it("falls back to model id when displayName is missing", () => {
    const group: QuotaGroup = {
      id: "gemini-2-5-flash",
      label: "Gemini 2.5 Flash",
      remainingFraction: 1,
      resetTime: null,
      models: [
        {
          id: "gemini-2.5-flash",
          displayName: "",
          remainingFraction: 0,
          resetTime: "2026-04-06T18:00:00Z",
        },
      ],
    };

    const enriched = enrichModelFirstGroup(group);

    expect(enriched.bottleneckModel).toBe("gemini-2.5-flash");
  });

  it("marks fully saturated snapshot-only accounts as unverified", () => {
    const account: QuotaAccount = {
      auth_index: "1",
      provider: "antigravity",
      supported: true,
      monitorMode: "model-first",
      snapshotFetchedAt: "2026-04-06T11:59:00.000Z",
      groups: [
        enrichModelFirstGroup({
          id: "claude-gpt",
          label: "Claude/GPT",
          remainingFraction: 1,
          resetTime: null,
          models: [
            {
              id: "claude-sonnet-4-6",
              displayName: "Claude Sonnet 4.6",
              remainingFraction: 1,
              resetTime: "2026-04-07T00:00:00Z",
            },
          ],
        }),
      ],
    };

    expect(isModelFirstAccountQuotaUnverified(account)).toBe(true);
  });

  it("marks fully saturated provider summaries as unverified", () => {
    const accounts: QuotaAccount[] = [
      {
        auth_index: "1",
        provider: "antigravity",
        supported: true,
        monitorMode: "model-first",
        snapshotFetchedAt: "2026-04-06T11:59:00.000Z",
        groups: [
          enrichModelFirstGroup({
            id: "claude-gpt",
            label: "Claude/GPT",
            remainingFraction: 1,
            resetTime: null,
            models: [
              {
                id: "claude-sonnet-4-6",
                displayName: "Claude Sonnet 4.6",
                remainingFraction: 1,
                resetTime: "2026-04-07T00:00:00Z",
              },
            ],
          }),
        ],
      },
    ];

    const summary = summarizeModelFirstProvider(accounts);
    expect(isModelFirstProviderQuotaUnverified(summary)).toBe(true);
  });
});
