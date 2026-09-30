import { describe, expect, it } from "vitest";

import { getComparableProviderSummaries } from "./quota-chart";

const quotaWindow = { id: "weekly", label: "Weekly", capacity: 0.7, resetTime: null, isShortTerm: false };

describe("getComparableProviderSummaries", () => {
  it("excludes providers without comparable quota data", () => {
    const summaries = [
      {
        provider: "antigravity",
        monitorMode: "window-based" as const,
        totalAccounts: 1,
        healthyAccounts: 1,
        errorAccounts: 0,
        windowCapacities: [],
      },
      {
        provider: "openai",
        monitorMode: "window-based" as const,
        totalAccounts: 1,
        healthyAccounts: 1,
        errorAccounts: 0,
        windowCapacities: [quotaWindow],
      },
      {
        provider: "gemini-cli",
        monitorMode: "model-first" as const,
        totalAccounts: 1,
        healthyAccounts: 1,
        errorAccounts: 0,
        windowCapacities: [],
        modelFirstSummary: {
          totalAccounts: 1,
          readyAccounts: 1,
          staleAccounts: 0,
          minRemainingFraction: 0.8,
          p50RemainingFraction: 0.8,
          nextWindowResetAt: null,
          fullWindowResetAt: null,
          nextRecoveryAt: null,
          fullRecoveryAt: null,
          groups: [],
        },
      },
    ];

    expect(getComparableProviderSummaries(summaries).map(({ provider }) => provider)).toEqual(["openai", "gemini-cli"]);
  });
});
