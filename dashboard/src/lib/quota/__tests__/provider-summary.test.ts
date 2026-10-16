import { describe, expect, it } from "vitest";

import type { QuotaAccount, QuotaGroup } from "@/lib/model-first-monitoring";
import { calcProviderSummary } from "@/lib/quota/provider-summary";

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

  it("keeps additional and code review limits out of the main weekly pool (issue #309)", () => {
    const scoped = (id: string, label: string, remainingFraction: number): QuotaGroup => ({
      ...codexWindow(id, 168 * HOUR, remainingFraction),
      label,
    });
    const plus = codexAccount("plus", [
      codexWindow("secondary-window", 168 * HOUR, 0.5),
      scoped("gpt-5-3-codex-spark-secondary-window", "GPT-5.3-Codex-Spark 168h Window", 0.2),
      scoped("code-review-primary-window", "Code Review 168h Window", 0.9),
    ]);
    const pro = codexAccount("pro", [
      codexWindow("primary-window", 168 * HOUR, 0.5),
      scoped("gpt-5-3-codex-spark-primary-window", "GPT-5.3-Codex-Spark 168h Window", 0.5),
    ]);

    const { windowCapacities } = calcProviderSummary([plus, pro]);

    expect(windowCapacities).toHaveLength(3);
    expect(windowCapacities.find((window) => window.label === "168h Window")?.capacity).toBeCloseTo(0.75, 5);
    expect(
      windowCapacities.find((window) => window.label === "GPT-5.3-Codex-Spark 168h Window")?.capacity
    ).toBeCloseTo(0.6, 5);
    expect(windowCapacities.find((window) => window.label === "Code Review 168h Window")?.capacity).toBeCloseTo(0.9, 5);
  });
});
