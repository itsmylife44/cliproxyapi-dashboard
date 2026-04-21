import { describe, expect, it } from "vitest";

import {
  buildQuotaSearch,
  buildQuotaToolbarQuery,
  clearQuotaToolbarQuery,
  DEFAULT_QUOTA_QUERY_STATE,
  parseQuotaQueryState,
  type QuotaQueryState,
} from "../query-state";

describe("quota query state", () => {
  it("parses valid query params", () => {
    const result = parseQuotaQueryState(
      new URLSearchParams({
        q: "  codex  ",
        provider: " codex ",
        status: " warning ",
        page: " 3 ",
      })
    );

    expect(result).toEqual<QuotaQueryState>({
      q: "codex",
      provider: "codex",
      status: "warning",
      page: 3,
    });
  });

  it("normalizes unknown provider and status to all", () => {
    const result = parseQuotaQueryState(
      new URLSearchParams({
        provider: "mystery-provider",
        status: "offline",
      })
    );

    expect(result).toEqual({
      ...DEFAULT_QUOTA_QUERY_STATE,
      provider: "all",
      status: "all",
    });
  });

  it("normalizes invalid page values to 1", () => {
    expect(parseQuotaQueryState(new URLSearchParams({ page: "0" })).page).toBe(1);
    expect(parseQuotaQueryState(new URLSearchParams({ page: "-5" })).page).toBe(1);
    expect(parseQuotaQueryState(new URLSearchParams({ page: "1.2" })).page).toBe(1);
    expect(parseQuotaQueryState(new URLSearchParams({ page: "abc" })).page).toBe(1);
  });

  it("omits default values when building a canonical search string", () => {
    expect(buildQuotaSearch(DEFAULT_QUOTA_QUERY_STATE)).toBe("");
  });

  it("builds a canonical search string with only non-default params", () => {
    const result = buildQuotaSearch({
      q: "  claude  ",
      provider: "claude",
      status: "active",
      page: 2,
    });

    expect(result).toBe("?q=claude&provider=claude&status=active&page=2");
  });

  it("omits whitespace-only q and trims provider, status, and page inputs when building", () => {
    const result = buildQuotaSearch({
      q: "   ",
      provider: " codex " as QuotaQueryState["provider"],
      status: " warning " as QuotaQueryState["status"],
      page: " 3 " as unknown as QuotaQueryState["page"],
    });

    expect(result).toBe("?provider=codex&status=warning&page=3");
  });

  it("round-trips and canonicalizes spaced and reserved query text", () => {
    const parsed = parseQuotaQueryState(
      new URLSearchParams(
        "q= Claude%20%26%20Codex%20%2F%20Beta%20&provider=%20codex%20&status=%20warning%20&page=%2003%20"
      )
    );

    expect(parsed).toEqual<QuotaQueryState>({
      q: "Claude & Codex / Beta",
      provider: "codex",
      status: "warning",
      page: 3,
    });
    expect(buildQuotaSearch(parsed)).toBe(
      "?q=Claude+%26+Codex+%2F+Beta&provider=codex&status=warning&page=3"
    );
  });

  it("re-normalizes invalid values when building a canonical search string", () => {
    const result = buildQuotaSearch({
      q: "   ",
      provider: "invalid" as QuotaQueryState["provider"],
      status: "invalid" as QuotaQueryState["status"],
      page: -10,
    });

    expect(result).toBe("");
  });

  it("resets page to 1 when toolbar filter changes", () => {
    const previous: QuotaQueryState = { q: "codex", provider: "codex", status: "warning", page: 5 };
    expect(buildQuotaToolbarQuery(previous, { provider: "claude" })).toEqual({
      q: "codex",
      provider: "claude",
      status: "warning",
      page: 1,
    });
  });

  it("clears toolbar to defaults", () => {
    expect(clearQuotaToolbarQuery()).toEqual(DEFAULT_QUOTA_QUERY_STATE);
  });

  it("accepts copilot aliases as github-copilot", () => {
    expect(parseQuotaQueryState(new URLSearchParams({ provider: "github" })).provider).toBe("github-copilot");
    expect(parseQuotaQueryState(new URLSearchParams({ provider: "copilot" })).provider).toBe("github-copilot");
    expect(parseQuotaQueryState(new URLSearchParams({ provider: "GitHub" })).provider).toBe("github-copilot");
  });

  it("canonicalizes gemini and openai raw aliases", () => {
    expect(parseQuotaQueryState(new URLSearchParams({ provider: "gemini" })).provider).toBe("gemini-cli");
    expect(parseQuotaQueryState(new URLSearchParams({ provider: "Gemini-CLI" })).provider).toBe("gemini-cli");
    expect(parseQuotaQueryState(new URLSearchParams({ provider: "openai" })).provider).toBe("codex");
    expect(parseQuotaQueryState(new URLSearchParams({ provider: "anthropic" })).provider).toBe("claude");
  });

  it("accepts status values case-insensitively", () => {
    expect(parseQuotaQueryState(new URLSearchParams({ status: "ACTIVE" })).status).toBe("active");
    expect(parseQuotaQueryState(new URLSearchParams({ status: "Warning" })).status).toBe("warning");
  });
});
