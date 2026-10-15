import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import messages from "../../../../../messages/en.json";

const auth = vi.hoisted(() => ({ user: null as { isAdmin: boolean } | null }));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: auth.user }) }));
vi.mock("@/components/ui/toast", () => ({ useToast: () => ({ showToast: () => {} }) }));

import { SettingsPage } from "../settings-page";

// Static render = first paint: no effects run, so the auth state is whatever useAuth returns now.
function firstPaint(user: { isAdmin: boolean } | null): string {
  auth.user = user;
  return renderToStaticMarkup(
    <NextIntlClientProvider locale="en" timeZone="UTC" messages={messages}>
      <SettingsPage dashboardVersion="1.2.3" />
    </NextIntlClientProvider>
  );
}

const ADMIN_ONLY = ["Force Logout All Users", "Software Updates", "Dashboard Deployment", ">Backup</button>", "CLIProxyAPI:"];

describe("SettingsPage", () => {
  it("hides the force logout control from a non-admin", () => {
    expect(firstPaint({ isAdmin: false })).not.toContain("Force Logout All Users");
  });

  it("hides the update cards and deploy controls from a non-admin", () => {
    const html = firstPaint({ isAdmin: false });
    expect(html).not.toContain("Software Updates");
    expect(html).not.toContain("Dashboard Deployment");
  });

  it("hides the Backup tab from a non-admin", () => {
    expect(firstPaint({ isAdmin: false })).not.toContain(">Backup</button>");
  });

  it("shows a non-admin the system info and dashboard version, without the admin-only CLIProxyAPI version", () => {
    const html = firstPaint({ isAdmin: false });
    expect(html).toContain("System Information");
    expect(html).toContain(">1.2.3</span>");
    expect(html).not.toContain("CLIProxyAPI:");
  });

  it("renders no admin-only control before the auth state resolves", () => {
    const html = firstPaint(null);
    for (const text of ADMIN_ONLY) expect(html).not.toContain(text);
  });

  it("shows an admin every section", () => {
    const html = firstPaint({ isAdmin: true });
    for (const text of [...ADMIN_ONLY, ">1.2.3</span>"]) expect(html).toContain(text);
  });
});
