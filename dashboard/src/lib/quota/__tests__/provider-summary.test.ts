import { describe, expect, it } from "vitest";

import type { QuotaAccount, QuotaGroup, QuotaGroupScope } from "@/lib/model-first-monitoring";
import { calcOverallTermCapacities, calcProviderSummary } from "@/lib/quota/provider-summary";

const HOUR = 60 * 60;

function codexWindow(id: string, windowSeconds: number, remainingFraction: number): QuotaGroup {
  return {
    id,
    label: windowSeconds === 5 * HOUR ? "5h Window" : "168h Window",
    windowSeconds,
    remainingFraction,
    resetTime: new Date(Date.now() + windowSeconds * 1000).toISOString(),
    models: [],
  };
}

function codexAccount(authIndex: string, groups: QuotaGroup[]): QuotaAccount {
  return { auth_index: authIndex, provider: "codex", supported: true, groups };
}

describe("calcProviderSummary", () => {
  it.each([
    ["5h account first", false],
    ["168h account first", true],
  ])("pools Codex windows by duration, not position id (%s)", (_name, reverse) => {
    const plus = codexAccount("plus", [codexWindow("primary-window", 5 * HOUR, 0.5)]);
    const pro = codexAccount("pro", [codexWindow("primary-window", 168 * HOUR, 0.25)]);
    const accounts = reverse ? [pro, plus] : [plus, pro];

    const { windowCapacities } = calcProviderSummary(accounts);

    expect(windowCapacities).toHaveLength(2);
    const longTerm = windowCapacities.filter((window) => !window.isShortTerm);
    const shortTerm = windowCapacities.filter((window) => window.isShortTerm);
    expect(longTerm).toEqual([expect.objectContaining({ label: "168h Window", capacity: 0.25 })]);
    expect(shortTerm).toEqual([expect.objectContaining({ label: "5h Window", capacity: 0.5 })]);
  });

  it("pools a Plus secondary weekly window with a Pro primary weekly window", () => {
    const plus = codexAccount("plus", [
      codexWindow("primary-window", 5 * HOUR, 0.5),
      codexWindow("secondary-window", 168 * HOUR, 0.5),
    ]);
    const pro = codexAccount("pro", [codexWindow("primary-window", 168 * HOUR, 0.5)]);

    const { windowCapacities } = calcProviderSummary([plus, pro]);

    expect(windowCapacities).toEqual([
      expect.objectContaining({ isShortTerm: false, capacity: 0.75 }),
      expect.objectContaining({ isShortTerm: true, capacity: 0.5 }),
    ]);
  });

  it("pools scoped limits by scope and duration, apart from the main weekly pool (issue #309)", () => {
    const spark = { id: "codex-bengalfox", label: "GPT-5.3-Codex-Spark" };
    const codeReview = { id: "code-review", label: "Code Review" };
    const scoped = (id: string, scope: QuotaGroupScope, remainingFraction: number): QuotaGroup => ({
      ...codexWindow(id, 168 * HOUR, remainingFraction),
      label: `${scope.label} 168h Window`,
      scope,
    });
    const plus = codexAccount("plus", [
      codexWindow("secondary-window", 168 * HOUR, 0.5),
      scoped("codex-bengalfox-secondary-window", spark, 0.2),
      scoped("code-review-primary-window", codeReview, 0.9),
    ]);
    const pro = codexAccount("pro", [
      codexWindow("primary-window", 168 * HOUR, 0.5),
      scoped("codex-bengalfox-primary-window", spark, 0.5),
    ]);

    const { windowCapacities } = calcProviderSummary([plus, pro]);

    expect(windowCapacities).toHaveLength(3);
    const byLabel = (label: string) => windowCapacities.find((window) => window.label === label);
    expect(byLabel("168h Window")).toMatchObject({ capacity: expect.closeTo(0.75, 5) });
    expect(byLabel("168h Window")?.scope).toBeUndefined();
    expect(byLabel("GPT-5.3-Codex-Spark 168h Window")).toMatchObject({ capacity: expect.closeTo(0.6, 5), scope: spark });
    expect(byLabel("Code Review 168h Window")).toMatchObject({ capacity: expect.closeTo(0.9, 5), scope: codeReview });
  });

  it("pools by the explicit scope, not by the shape of the group id", () => {
    const plus = codexAccount("plus", [
      codexWindow("custom-primary-window", 168 * HOUR, 0.5),
      { ...codexWindow("weekly", 168 * HOUR, 0.2), label: "Spark 168h Window", scope: { id: "spark", label: "Spark" } },
    ]);
    const pro = codexAccount("pro", [codexWindow("primary-window", 168 * HOUR, 0.5)]);

    const { windowCapacities } = calcProviderSummary([plus, pro]);

    expect(windowCapacities).toEqual([
      expect.objectContaining({ label: "168h Window", capacity: 0.75 }),
      expect.objectContaining({ label: "Spark 168h Window", capacity: expect.closeTo(0.2, 5) }),
    ]);
  });

  it("averages short-term capacity strictly from short-term windows without clamping by long-term", () => {
    const acc1 = codexAccount("acc-1", [
      codexWindow("primary-window", 5 * HOUR, 0.9),
      codexWindow("secondary-window", 168 * HOUR, 0.0),
    ]);
    const acc2 = codexAccount("acc-2", [
      codexWindow("primary-window", 5 * HOUR, 0.8),
      codexWindow("secondary-window", 168 * HOUR, 0.6),
    ]);

    const { windowCapacities } = calcProviderSummary([acc1, acc2]);
    const shortTerm = windowCapacities.find((w) => w.isShortTerm);
    const longTerm = windowCapacities.find((w) => !w.isShortTerm);
    expect(longTerm?.averageCapacity).toBeCloseTo(0.3, 5);
    expect(shortTerm?.averageCapacity).toBeCloseTo(0.85, 5);
  });

  it("keeps -5h short-term window average independent of matching -weekly family window", () => {
    const acc: QuotaAccount = {
      auth_index: "claude-family-1",
      provider: "claude",
      supported: true,
      groups: [
        {
          id: "sonnet-5h",
          label: "Sonnet 5h",
          remainingFraction: 0.9,
          resetTime: new Date(Date.now() + 5 * HOUR * 1000).toISOString(),
          models: [],
        },
        {
          id: "sonnet-weekly",
          label: "Sonnet Weekly",
          remainingFraction: 0.25,
          resetTime: new Date(Date.now() + 168 * HOUR * 1000).toISOString(),
          models: [],
        },
        {
          id: "opus-weekly",
          label: "Opus Weekly",
          remainingFraction: 0.1,
          resetTime: new Date(Date.now() + 168 * HOUR * 1000).toISOString(),
          models: [],
        },
      ],
    };

    const { windowCapacities } = calcProviderSummary([acc]);
    const shortTerm = windowCapacities.find((w) => w.id === "sonnet-5h");
    const longTerm = windowCapacities.find((w) => w.id === "sonnet-weekly");
    expect(longTerm?.averageCapacity).toBeCloseTo(0.25, 5);
    expect(shortTerm?.averageCapacity).toBeCloseTo(0.9, 5);
  });

  it("keeps scoped and unscoped short-term averages independent from long-term limits", () => {
    const spark = { id: "codex-bengalfox", label: "GPT-5.3-Codex-Spark" };
    const codeReview = { id: "code-review", label: "Code Review" };
    const acc = codexAccount("plus", [
      codexWindow("primary-window", 5 * HOUR, 0.9),
      codexWindow("secondary-window", 168 * HOUR, 0.8),
      {
        ...codexWindow("codex-bengalfox-primary-window", 5 * HOUR, 0.7),
        label: "Spark 5h",
        scope: spark,
      },
      {
        ...codexWindow("codex-bengalfox-secondary-window", 168 * HOUR, 0.2),
        label: "Spark 168h",
        scope: spark,
      },
      {
        ...codexWindow("code-review-secondary-window", 168 * HOUR, 0.0),
        label: "Code Review 168h",
        scope: codeReview,
      },
    ]);

    const { windowCapacities } = calcProviderSummary([acc]);
    const unscoped5h = windowCapacities.find((w) => w.isShortTerm && !w.scope);
    const spark5h = windowCapacities.find((w) => w.isShortTerm && w.scope?.id === "codex-bengalfox");
    expect(unscoped5h?.averageCapacity).toBeCloseTo(0.9, 5);
    expect(spark5h?.averageCapacity).toBeCloseTo(0.7, 5);
  });

  it("uses strict short-term score for unscoped non-5h short-term windows, ignoring extra-usage", () => {
    const claudeAccount: QuotaAccount = {
      auth_index: "claude-1",
      provider: "claude",
      supported: true,
      groups: [
        {
          id: "five-hour",
          label: "5h Window",
          remainingFraction: 0.95,
          resetTime: new Date(Date.now() + 5 * HOUR * 1000).toISOString(),
          models: [],
        },
        {
          id: "seven-day",
          label: "7d Window",
          remainingFraction: 0.4,
          resetTime: new Date(Date.now() + 168 * HOUR * 1000).toISOString(),
          models: [],
        },
        {
          id: "extra-usage",
          label: "Extra Usage",
          remainingFraction: 0.0,
          resetTime: null,
          models: [],
        },
      ],
    };

    const { windowCapacities } = calcProviderSummary([claudeAccount]);
    const shortTerm = windowCapacities.find((w) => w.id === "five-hour");
    expect(shortTerm?.averageCapacity).toBeCloseTo(0.95, 5);
  });
});

describe("calcOverallTermCapacities", () => {
  it("weights window-based and verified model-first providers by healthyAccounts without pre-rounding", () => {
    const result = calcOverallTermCapacities([
      {
        provider: "claude",
        monitorMode: "window-based",
        totalAccounts: 2,
        healthyAccounts: 2,
        errorAccounts: 0,
        windowCapacities: [
          { id: "seven-day", label: "7d", capacity: 0.84, averageCapacity: 0.604, accountCount: 2, resetTime: null, isShortTerm: false },
          { id: "five-hour", label: "5h", capacity: 0.5, averageCapacity: 0.404, accountCount: 2, resetTime: null, isShortTerm: true },
        ],
      },
      {
        provider: "gemini-cli",
        monitorMode: "model-first",
        totalAccounts: 1,
        healthyAccounts: 1,
        errorAccounts: 0,
        windowCapacities: [],
        modelFirstSummary: {
          totalAccounts: 1,
          readyAccounts: 1,
          staleAccounts: 0,
          minRemainingFraction: 0.5,
          p50RemainingFraction: 0.8,
          avgRemainingFraction: 0.904,
          nextWindowResetAt: null,
          fullWindowResetAt: null,
          nextRecoveryAt: null,
          groups: [],
        },
      },
      {
        provider: "antigravity",
        monitorMode: "model-first",
        totalAccounts: 3,
        healthyAccounts: 3,
        errorAccounts: 0,
        windowCapacities: [],
        modelFirstSummary: {
          totalAccounts: 3,
          readyAccounts: 3,
          staleAccounts: 0,
          minRemainingFraction: 1,
          p50RemainingFraction: 1,
          avgRemainingFraction: 1,
          nextWindowResetAt: null,
          fullWindowResetAt: null,
          nextRecoveryAt: null,
          groups: [],
        },
      },
    ]);

    // (0.604 * 2 + 0.904 * 1) / 3 = 2.112 / 3 = 0.704
    expect(result.longTerm).toBeCloseTo(0.704, 5);
    expect(result.overall).toBeCloseTo(0.704, 5);
    expect(result.shortTerm).toBeCloseTo(0.404, 5);
  });
});
