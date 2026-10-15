import { SettingsPage } from "./settings-page";

// DASHBOARD_VERSION is set at runtime; never bake the build-time default into a static page.
export const dynamic = "force-dynamic";

// Read on the server so non-admins see the version without the admin-only update check.
export default function Page() {
  return <SettingsPage dashboardVersion={process.env.DASHBOARD_VERSION} />;
}
