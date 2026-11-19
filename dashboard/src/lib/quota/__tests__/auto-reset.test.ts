import { describe, expect, it } from "vitest";
import type { QuotaAccount } from "@/lib/model-first-monitoring";
import {
  extractAccountWindowPercentages,
  normalizeAutoResetProvider,
  shouldTriggerAutoReset,
  type AutoResetRule,
} from "../auto-reset-rules";

describe("quota auto-reset threshold logic", () => {
  const baseRule: AutoResetRule = {
    enabled: true,
    fiveHourThresholdPct: 0,
    weeklyThresholdPct: 0,
    minWeeklyDaysLeft: 0,
    lastResetAt: null,
    lastStatus: null,
  };

  it("identifies Codex and Claude as supported providers", () => {
    expect(normalizeAutoResetProvider("codex")).toBe("codex");
    expect(normalizeAutoResetProvider("Claude")).toBe("claude");
    expect(normalizeAutoResetProvider("antigravity")).toBe("unsupported");
  });

  it("extracts short-term, weekly percentages, and days left until weekly reset", () => {
    const now = Date.UTC(2026, 10, 18, 0, 0, 0);
    const resetInFourDays = new Date(now + 4 * 86_400_000).toISOString();
    const account: QuotaAccount = {
      auth_index: "a1",
      provider: "codex",
      supported: true,
      groups: [
        { id: "five-hour", label: "5-hour", remainingFraction: 0.14, resetTime: "2026-11-18T12:00:00Z", models: [] },
        { id: "weekly", label: "Weekly", remainingFraction: 0.0, resetTime: resetInFourDays, models: [] },
      ],
    };
    expect(extractAccountWindowPercentages(account, now)).toEqual({
      fiveHourPct: 14,
      weeklyPct: 0,
      weeklyDaysLeft: 4,
    });
  });

  it("respects percentage thresholds, minimum weekly days left, and cooldown", () => {
    expect(shouldTriggerAutoReset(baseRule, { fiveHourPct: 0, weeklyPct: 0, weeklyDaysLeft: 0.5 }, 1_000_000)).toBe(true);
    expect(shouldTriggerAutoReset(baseRule, { fiveHourPct: 0, weeklyPct: 45, weeklyDaysLeft: 5 }, 1_000_000)).toBe(false);
    expect(
      shouldTriggerAutoReset({ ...baseRule, weeklyThresholdPct: 100 }, { fiveHourPct: 0, weeklyPct: 45, weeklyDaysLeft: 5 }, 1_000_000)
    ).toBe(true);

    expect(
      shouldTriggerAutoReset({ ...baseRule, minWeeklyDaysLeft: 2 }, { fiveHourPct: 0, weeklyPct: 0, weeklyDaysLeft: 1.5 }, 1_000_000)
    ).toBe(false);
    expect(
      shouldTriggerAutoReset({ ...baseRule, minWeeklyDaysLeft: 2 }, { fiveHourPct: 0, weeklyPct: 0, weeklyDaysLeft: 3 }, 1_000_000)
    ).toBe(true);

    expect(shouldTriggerAutoReset(baseRule, { fiveHourPct: null, weeklyPct: 0 }, 1_000_000)).toBe(false);
    expect(shouldTriggerAutoReset(baseRule, { fiveHourPct: 0, weeklyPct: null }, 1_000_000)).toBe(false);

    const recentReset = new Date(900_000).toISOString();
    expect(
      shouldTriggerAutoReset({ ...baseRule, lastResetAt: recentReset }, { fiveHourPct: 0, weeklyPct: 0, weeklyDaysLeft: 5 }, 1_000_000)
    ).toBe(false);
  });
});
