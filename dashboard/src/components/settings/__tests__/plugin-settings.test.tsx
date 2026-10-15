import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import messages from "../../../../messages/en.json";

const auth = vi.hoisted(() => ({ user: null as { isAdmin: boolean } | null }));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: auth.user }) }));
vi.mock("@/components/ui/toast", () => ({ useToast: () => ({ showToast: () => {} }) }));

import { PluginSettings } from "../plugin-settings";

// Static render = first paint, before the store fetch can answer 403.
function firstPaint(user: { isAdmin: boolean } | null): string {
  auth.user = user;
  return renderToStaticMarkup(
    <NextIntlClientProvider locale="en" timeZone="UTC" messages={messages}>
      <PluginSettings />
    </NextIntlClientProvider>
  );
}

describe("PluginSettings", () => {
  it("never shows the section to a non-admin", () => {
    expect(firstPaint({ isAdmin: false })).toBe("");
  });

  it("shows the section to an admin", () => {
    expect(firstPaint({ isAdmin: true })).toContain("CLIProxyAPI plugins");
  });
});
