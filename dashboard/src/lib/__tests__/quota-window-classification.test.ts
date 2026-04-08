import { describe, expect, it, vi } from "vitest";

import { isShortTermQuotaWindow } from "../quota-window-classification";

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
