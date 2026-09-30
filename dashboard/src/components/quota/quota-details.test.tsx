import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";

import messages from "../../../messages/en.json";
import { QuotaDetails } from "./quota-details";
import type { QuotaAccount } from "@/lib/model-first-monitoring";

const account: QuotaAccount = {
  auth_index: "1",
  provider: "antigravity",
  email: "test@example.com",
  supported: true,
  monitorMode: "window-based",
  groups: [
    { id: "gemini-weekly", label: "Gemini · Weekly", remainingFraction: 0.31, resetTime: "2026-10-07T12:00:00Z", models: [] },
    { id: "gemini-5h", label: "Gemini · 5-hour", remainingFraction: 0.82, resetTime: "2026-09-30T12:00:00Z", models: [] },
    { id: "claude-gpt-weekly", label: "Claude/GPT · Weekly", remainingFraction: 0.48, resetTime: "2026-10-07T18:00:00Z", models: [] },
    { id: "claude-gpt-5h", label: "Claude/GPT · 5-hour", remainingFraction: 0.9, resetTime: "2026-09-30T18:00:00Z", models: [] },
  ],
};

function renderAccounts(accounts: QuotaAccount[]): string {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale="en" timeZone="UTC" messages={messages}>
      <QuotaDetails
        filteredAccounts={accounts}
        hasAnyAccounts
        currentPage={1}
        totalPages={1}
        onPageChange={() => {}}
        expandedCards={Object.fromEntries(accounts.map(({ auth_index }) => [auth_index, true]))}
        onToggleCard={() => {}}
        loading={false}
        modelFirstOnlyView={false}
      />
    </NextIntlClientProvider>
  );
}

function withFirstRemaining(remainingFraction: number): QuotaAccount {
  return {
    ...account,
    groups: account.groups!.map((group, index) => index === 0 ? { ...group, remainingFraction } : group),
  };
}

describe("Antigravity quota details", () => {
  it("renders the authoritative window limits and labeled columns without per-model snapshots", () => {
    const html = renderAccounts([account]);
    expect(html).toContain("Gemini · Weekly");
    expect(html).toContain("Gemini · 5-hour");
    expect(html).toContain("Claude/GPT · Weekly");
    expect(html).toContain("Claude/GPT · 5-hour");
    expect(html).toContain("Quota Group");
    expect(html).toContain("Remaining");
    expect(html).toContain("Reset");
    expect(html).not.toContain("Per-model details");
    expect(html).not.toContain("Gemini 3 Flash");
  });

  it.each([
    [0.004, "0%"],
    [0.5, "50%"],
    [0.996, "100%"],
    [0, "0%"],
    [1, "100%"],
  ])("formats %s remaining as %s", (fraction, expected) => {
    const isolatedAccount = withFirstRemaining(Number(fraction));
    isolatedAccount.groups = isolatedAccount.groups?.slice(0, 1);
    const html = renderAccounts([isolatedAccount]);
    expect(html).toContain(`>${expected}<`);
  });

  it("summarizes the account with Gemini windows only", () => {
    const html = renderAccounts([account]);
    const accountRow = html.match(/<button[^>]*>[\s\S]*?<\/button>/)?.[0];
    expect(accountRow).toContain(">31%<");
    expect(accountRow).toContain(">82%<");
    expect(accountRow).not.toContain(">48%<");
    expect(accountRow).not.toMatch(/>-<\/span>/);
  });

  it("disambiguates duplicate masked accounts without exposing their email addresses", () => {
    const secondAccount = { ...account, auth_index: "2" };
    const html = renderAccounts([account, secondAccount]);
    expect(html).toContain("tes***@example.com · 1");
    expect(html).toContain("tes***@example.com · 2");
    expect(html).not.toContain("test@example.com");
  });
});
