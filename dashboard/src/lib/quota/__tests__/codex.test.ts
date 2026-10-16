import { describe, expect, it } from "vitest";

import { parseCodexQuota } from "@/lib/quota/codex";

const WEEK = 604800;

function weekly(usedPercent: number) {
  return { primary_window: { limit_window_seconds: WEEK, used_percent: usedPercent, reset_at: 1792195200 } };
}

describe("parseCodexQuota", () => {
  it("leaves the main limit unscoped and scopes additional and code review limits", () => {
    const groups = parseCodexQuota({
      rate_limit: weekly(10),
      additional_rate_limits: [
        { limit_name: "GPT-5.3-Codex-Spark", metered_feature: "codex_bengalfox", rate_limit: weekly(40) },
      ],
      code_review_rate_limit: weekly(5),
    });

    expect(groups.map(({ id, label, scope }) => ({ id, label, scope }))).toEqual([
      { id: "primary-window", label: "168h Window", scope: undefined },
      {
        id: "codex-bengalfox-primary-window",
        label: "GPT-5.3-Codex-Spark 168h Window",
        scope: { id: "codex-bengalfox", label: "GPT-5.3-Codex-Spark" },
      },
      {
        id: "code-review-primary-window",
        label: "Code Review 168h Window",
        scope: { id: "code-review", label: "Code Review" },
      },
    ]);
  });

  it("keeps the scope id stable when the display name changes", () => {
    const before = parseCodexQuota({
      additional_rate_limits: [{ limit_name: "GPT-5.3-Codex-Spark", metered_feature: "codex_bengalfox", rate_limit: weekly(1) }],
    });
    const after = parseCodexQuota({
      additional_rate_limits: [{ limit_name: "GPT-5.4-Codex-Spark", metered_feature: "codex_bengalfox", rate_limit: weekly(1) }],
    });

    expect(after.map((group) => group.id)).toEqual(before.map((group) => group.id));
    expect(after.map((group) => group.scope)).toEqual([{ id: "codex-bengalfox", label: "GPT-5.4-Codex-Spark" }]);
  });

  it("falls back to the limit name, then the position, when the metered feature is missing", () => {
    const groups = parseCodexQuota({
      additional_rate_limits: [
        { limit_name: "Spark", metered_feature: null, rate_limit: weekly(1) },
        { limit_name: " ", metered_feature: "", rate_limit: weekly(1) },
      ],
    });

    expect(groups.map(({ id, scope }) => ({ id, scope }))).toEqual([
      { id: "spark-primary-window", scope: { id: "spark", label: "Spark" } },
      { id: "additional-2-primary-window", scope: { id: "additional-2", label: "Additional Limit 2" } },
    ]);
  });

  it("disambiguates scope ids that collide with each other or with code review", () => {
    const groups = parseCodexQuota({
      additional_rate_limits: [
        { limit_name: "Spark", metered_feature: "codex_bengalfox", rate_limit: weekly(1) },
        { limit_name: "Spark Mini", metered_feature: "codex_bengalfox", rate_limit: weekly(2) },
        { limit_name: "Review", metered_feature: "code_review", rate_limit: weekly(3) },
      ],
      code_review_rate_limit: weekly(4),
    });

    const ids = groups.map((group) => group.id);
    expect(ids).toEqual([
      "codex-bengalfox-primary-window",
      "codex-bengalfox-2-primary-window",
      "code-review-3-primary-window",
      "code-review-primary-window",
    ]);
    expect(new Set(groups.map((group) => group.scope?.id)).size).toBe(4);
  });
});
