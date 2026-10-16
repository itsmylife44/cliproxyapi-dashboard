import { describe, expect, it } from "vitest";

import type { QuotaAccount, QuotaGroup, QuotaGroupScope } from "@/lib/model-first-monitoring";
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
});
