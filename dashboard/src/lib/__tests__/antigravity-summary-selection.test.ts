import { describe, expect, it } from "vitest";

import {
  ANTIGRAVITY_SUMMARY_ENDPOINTS,
  type QuotaGroup,
  selectAntigravitySummary,
} from "../model-first-monitoring";

// Captured live (CT116, 2026-10-17) via the management api-call passthrough.
// Google moved Gemini quota windows off the `daily-` endpoints: today
// daily-cloudcode-pa serves ONLY the Claude/GPT family, while plain
// cloudcode-pa serves both families.
const dailyPayloadClaudeOnly: Array<{ id: string }> = [
  { id: "claude-gpt-weekly" },
  { id: "claude-gpt-5h" },
];

const cloudcodePayloadWithGemini: Array<{ id: string }> = [
  { id: "gemini-weekly" },
  { id: "gemini-5h" },
  { id: "claude-gpt-weekly" },
  { id: "claude-gpt-5h" },
];

const hasGeminiWindows = (groups: Array<{ id: string }>) =>
  groups.some((group) => group.id.startsWith("gemini-"));

describe("selectAntigravitySummary", () => {
  it("prefers the candidate that carries Gemini windows even when an earlier endpoint parsed first", () => {
    // Endpoint order today: daily first (ANTIGRAVITY_SUMMARY_ENDPOINTS[0]),
    // plain cloudcode-pa last. First-parseable-wins picks the Gemini-less
    // daily payload and the capacity chart loses its only feeding family.
    const selected = selectAntigravitySummary(
      [dailyPayloadClaudeOnly, cloudcodePayloadWithGemini],
      hasGeminiWindows
    );
    expect(selected).toBe(cloudcodePayloadWithGemini);
  });

  it("falls back to the first parseable candidate when no candidate has Gemini windows", () => {
    const selected = selectAntigravitySummary(
      [dailyPayloadClaudeOnly, dailyPayloadClaudeOnly],
      hasGeminiWindows
    );
    expect(selected).toBe(dailyPayloadClaudeOnly);
  });

  it("returns null for an empty candidate list", () => {
    expect(selectAntigravitySummary([], hasGeminiWindows)).toBeNull();
  });

  it("keeps the daily endpoint first in the endpoint list (fallback order documented, not silently changed)", () => {
    expect(ANTIGRAVITY_SUMMARY_ENDPOINTS[0]).toContain("daily-cloudcode-pa.googleapis.com");
  });

  it("selects Gemini-bearing candidate regardless of position", () => {
    const geminiFirst = [{ id: "gemini-5h" }];
    const selected = selectAntigravitySummary(
      [geminiFirst, dailyPayloadClaudeOnly] as Array<Array<{ id: string }>>,
      hasGeminiWindows
    );
    expect(selected).toBe(geminiFirst);
  });
});

// Type-level sanity: the helper must work with the real QuotaGroup shape.
const _typeCheck: Array<QuotaGroup> | null = selectAntigravitySummary(
  [[] as QuotaGroup[]] as Array<Array<QuotaGroup>>,
  (groups: QuotaGroup[]) => groups.some((group) => group.id.startsWith("gemini-"))
);
void _typeCheck;
