import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { capacityQuotaGroups, isShortTermQuotaWindow } from "../quota-window-classification";

describe("isShortTermQuotaWindow", () => {
  it("keeps explicit short-term markers classified as short-term", () => {
    expect(
      isShortTermQuotaWindow({
        id: "five-hour",
        label: "5h Session",
        resetTime: "2026-04-06T06:00:00.000Z",
      })
    ).toBe(true);
  });

  it("classifies the earlier Antigravity reset cluster as short-term", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-05T20:54:00.000Z"));

    const groups = [
      {
        id: "other",
        label: "Other",
        resetTime: "2026-04-06T01:53:55.000Z",
      },
      {
        id: "gemini-2-5-flash",
        label: "Gemini 2.5 Flash",
        resetTime: "2026-04-06T01:53:55.000Z",
      },
      {
        id: "gemini-3-pro",
        label: "Gemini 3 Pro",
        resetTime: "2026-04-12T20:53:55.000Z",
      },
    ] as const;

    expect(isShortTermQuotaWindow(groups[0], groups)).toBe(true);
    expect(isShortTermQuotaWindow(groups[1], groups)).toBe(true);
    expect(isShortTermQuotaWindow(groups[2], groups)).toBe(false);

    vi.useRealTimers();
  });

  it("uses explicit Antigravity bucket windows even when both resets are imminent", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-30T10:00:00.000Z"));
    const groups = [
      { id: "gemini-weekly", label: "Gemini · Weekly", resetTime: "2026-09-30T14:00:00Z" },
      { id: "gemini-5h", label: "Gemini · 5-hour", resetTime: "2026-09-30T12:00:00Z" },
    ] as const;
    expect(isShortTermQuotaWindow(groups[0], groups)).toBe(false);
    expect(isShortTermQuotaWindow(groups[1], groups)).toBe(true);
    vi.useRealTimers();
  });

  describe("Claude weekly windows", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-09-30T23:40:00Z"));
    });
    afterEach(() => vi.useRealTimers());

    it.each([null, "2026-10-01T04:49:59Z"])(
      "keeps the weekly window long-term when the five-hour reset is %s",
      (fiveHourReset) => {
        const groups = [
          { id: "five-hour", label: "5h Session", resetTime: fiveHourReset },
          { id: "seven-day", label: "7d Weekly", resetTime: "2026-10-01T15:59:59Z" },
        ] as const;

        expect(isShortTermQuotaWindow(groups[0], groups)).toBe(true);
        expect(isShortTermQuotaWindow(groups[1], groups)).toBe(false);
      }
    );

    it.each([
      { id: "seven-day-sonnet", label: "7d Sonnet" },
      { id: "seven-day-token-optimized", label: "7d Token Optimized" },
    ])("keeps model-scoped weekly window $id long-term near reset", ({ id, label }) => {
      expect(isShortTermQuotaWindow({ id, label, resetTime: "2026-10-01T15:59:59Z" })).toBe(false);
    });
  });

  it("treats windows without markers or reset time as long-term", () => {
    expect(
      isShortTermQuotaWindow({
        id: "gemini-3-pro",
        label: "Gemini 3 Pro",
        resetTime: null,
      })
    ).toBe(false);
  });
});

describe("capacityQuotaGroups", () => {
  const groups = ["gemini-weekly", "gemini-5h", "claude-gpt-weekly", "claude-gpt-5h"].map((id) => ({ id, label: id, resetTime: null }));
  it("keeps only Gemini windows for Antigravity", () => {
    expect(capacityQuotaGroups("antigravity", groups).map(({ id }) => id)).toEqual(["gemini-weekly", "gemini-5h"]);
  });
  it("keeps every window for other providers", () => {
    expect(capacityQuotaGroups("claude", groups)).toHaveLength(4);
  });
});
