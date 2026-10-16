import { describe, expect, it } from "vitest";

import { headlineQuotaWindows } from "@/lib/quota/headline";

const spark = { id: "codex-bengalfox", label: "GPT-5.3-Codex-Spark" };

describe("headlineQuotaWindows", () => {
  it("keeps only the main (unscoped) windows when there are any", () => {
    const windows = [
      { id: "primary-window", capacity: 0.8 },
      { id: "codex-bengalfox-primary-window", capacity: 0, scope: spark },
      { id: "secondary-window", capacity: 0.6 },
    ];

    expect(headlineQuotaWindows(windows).map((window) => window.id)).toEqual(["primary-window", "secondary-window"]);
  });

  it("falls back to every window when all of them are scoped", () => {
    const windows = [
      { id: "codex-bengalfox-primary-window", capacity: 0.4, scope: spark },
      { id: "code-review-primary-window", capacity: 0.9, scope: { id: "code-review", label: "Code Review" } },
    ];

    expect(headlineQuotaWindows(windows)).toEqual(windows);
  });

  it("returns an empty list for no windows", () => {
    expect(headlineQuotaWindows([])).toEqual([]);
  });
});
