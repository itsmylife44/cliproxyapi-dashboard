"use client";

import { Button } from "@/components/ui/button";

interface DashboardUpdateInfo {
  currentVersion: string;
  latestVersion: string;
  updateAvailable: boolean;
  availableVersions: string[];
  releaseUrl: string | null;
  releaseNotes: string | null;
}

interface PasswordSettingsProps {
  cliProxyVersion: string | null;
  cliProxyLoading: boolean;
  dashboardUpdateInfo: DashboardUpdateInfo | null;
  revokingSessions: boolean;
  onConfirmRevokeSessions: () => void;
}

export function PasswordSettings({
  cliProxyVersion,
  cliProxyLoading,
  dashboardUpdateInfo,
  revokingSessions,
  onConfirmRevokeSessions,
}: PasswordSettingsProps) {
  return (
    <section className="space-y-3 rounded-lg border border-slate-700/70 bg-slate-900/40 p-4">
      <div>
        <h2 className="text-sm font-semibold text-slate-100">Security & System</h2>
        <p className="text-xs text-slate-400">Session management and system information</p>
      </div>

      <div className="space-y-3 rounded-sm border border-slate-700/70 bg-slate-900/30 p-4">
        <h3 className="text-sm font-semibold text-slate-100">Session Control</h3>
        <p className="text-sm text-slate-400">
          Immediately revoke all active user sessions across all devices.
        </p>
        <Button variant="danger" onClick={onConfirmRevokeSessions} disabled={revokingSessions}>
          {revokingSessions ? "Revoking..." : "Force Logout All Users"}
        </Button>
      </div>

      <div className="rounded-sm border border-slate-700/70 bg-slate-900/30 p-4">
        <h3 className="mb-3 text-sm font-semibold text-slate-100">System Information</h3>
        <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-sm border border-slate-700/70 bg-slate-900/30 p-3">
            <div className="font-medium text-slate-400">Environment</div>
            <div className="mt-1 text-slate-100">{process.env.NODE_ENV || "production"}</div>
          </div>
          <div className="rounded-sm border border-slate-700/70 bg-slate-900/30 p-3">
            <div className="font-medium text-slate-400">Next.js</div>
            <div className="mt-1 text-slate-100">16.1.6</div>
          </div>
          <div className="rounded-sm border border-slate-700/70 bg-slate-900/30 p-3">
            <div className="font-medium text-slate-400">React</div>
            <div className="mt-1 text-slate-100">19.2.3</div>
          </div>
        </div>

        <div className="mt-4 border-t border-slate-700/70 pt-4">
          <h3 className="mb-3 text-sm font-medium text-slate-400">Version Details</h3>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between text-slate-300">
              <span>Dashboard Version:</span>
              <span className="font-mono">{dashboardUpdateInfo?.currentVersion || "dev"}</span>
            </div>
            <div className="flex items-center justify-between text-slate-300">
              <span>CLIProxyAPI:</span>
              <span className="font-mono">
                {cliProxyLoading ? "Loading..." : cliProxyVersion || "Unknown"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
