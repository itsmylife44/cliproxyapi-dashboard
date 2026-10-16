import { describe, expect, it } from "vitest";

import { getComparableProviderSummaries, getProviderCapacityBars } from "./quota-chart";

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

describe("getProviderCapacityBars", () => {
  const spark = { id: "codex-bengalfox", label: "GPT-5.3-Codex-Spark" };

  it("takes the lowest main window per term and ignores exhausted scoped limits (issue #309)", () => {
    const bars = getProviderCapacityBars([
      { id: "604800s", label: "168h Window", capacity: 0.634, resetTime: null, isShortTerm: false },
      { id: "18000s", label: "5h Window", capacity: 0.81, resetTime: null, isShortTerm: true },
      { id: "codex-bengalfox:604800s", label: "GPT-5.3-Codex-Spark 168h Window", capacity: 0, resetTime: null, isShortTerm: false, scope: spark },
      { id: "codex-bengalfox:18000s", label: "GPT-5.3-Codex-Spark 5h Window", capacity: 0, resetTime: null, isShortTerm: true, scope: spark },
    ]);

    expect(bars).toEqual({ longTerm: 63, shortTerm: 81 });
  });

  it("uses scoped limits when a provider reports nothing else", () => {
    const bars = getProviderCapacityBars([
      { id: "codex-bengalfox:604800s", label: "GPT-5.3-Codex-Spark 168h Window", capacity: 0.4, resetTime: null, isShortTerm: false, scope: spark },
    ]);

    expect(bars).toEqual({ longTerm: 40, shortTerm: null });
  });
});
