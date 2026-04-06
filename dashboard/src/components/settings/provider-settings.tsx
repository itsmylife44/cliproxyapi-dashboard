"use client";

import Markdown from "react-markdown";
import { Button } from "@/components/ui/button";

interface ProxyUpdateInfo {
  currentVersion: string;
  currentDigest: string;
  latestVersion: string;
  latestDigest: string;
  updateAvailable: boolean;
  availableVersions: string[];
}

interface DashboardUpdateInfo {
  currentVersion: string;
  latestVersion: string;
  updateAvailable: boolean;
  availableVersions: string[];
  releaseUrl: string | null;
  releaseNotes: string | null;
}

interface ProviderSettingsProps {
  proxyUpdateInfo: ProxyUpdateInfo | null;
  proxyUpdateLoading: boolean;
  proxyUpdating: boolean;
  dashboardUpdateInfo: DashboardUpdateInfo | null;
  dashboardUpdateLoading: boolean;
  dashboardUpdating: boolean;
  onConfirmProxyUpdate: (version?: string) => void;
  onConfirmDashboardUpdate: () => void;
  onRefreshProxyUpdate: () => void;
  onRefreshDashboardUpdate: () => void;
}

export function ProviderSettings({
  proxyUpdateInfo,
  proxyUpdateLoading,
  proxyUpdating,
  dashboardUpdateInfo,
  dashboardUpdateLoading,
  dashboardUpdating,
  onConfirmProxyUpdate,
  onConfirmDashboardUpdate,
  onRefreshProxyUpdate,
  onRefreshDashboardUpdate,
}: ProviderSettingsProps) {
  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-black">Software Updates</h2>
        <p className="text-xs text-[#777169]">Manage CLIProxyAPI and Dashboard versions</p>
      </div>

      <h3 className="flex items-center gap-2 text-sm font-semibold text-black">
        CLIProxyAPI Updates
        {proxyUpdateInfo?.updateAvailable && (
          <span className="rounded-sm border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
            Update Available
          </span>
        )}
      </h3>
      <div className="space-y-4">
        {proxyUpdateLoading ? (
          <div className="text-[#777169]">Checking for updates...</div>
        ) : proxyUpdateInfo ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-sm border border-[#e5e5e5] bg-white p-4">
                <div className="text-sm font-medium text-[#777169]">Current Version</div>
                <div className="mt-1 break-all text-lg font-semibold text-black">
                  {proxyUpdateInfo.currentVersion}
                </div>
                <div className="mt-1 break-all text-xs text-[#777169]">
                  Digest: <span className="font-mono text-black">{proxyUpdateInfo.currentDigest}</span>
                </div>
              </div>
              <div className="rounded-sm border border-[#e5e5e5] bg-white p-4">
                <div className="text-sm font-medium text-[#777169]">Latest Version</div>
                <div className="mt-1 break-all text-lg font-semibold text-black">
                  {proxyUpdateInfo.latestVersion}
                </div>
                <div className="mt-1 break-all text-xs text-[#777169]">
                  Digest: <span className="font-mono text-black">{proxyUpdateInfo.latestDigest}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row flex-wrap gap-2">
              <Button
                onClick={() => onConfirmProxyUpdate("latest")}
                disabled={proxyUpdating || !proxyUpdateInfo.updateAvailable}
              >
                {proxyUpdating ? "Updating..." : proxyUpdateInfo.updateAvailable ? "Update to Latest" : "Up to Date"}
              </Button>
              <Button variant="secondary" onClick={onRefreshProxyUpdate} disabled={proxyUpdateLoading}>
                Refresh
              </Button>
            </div>

            {proxyUpdateInfo.availableVersions.length > 0 && (
              <div className="border-t border-[#e5e5e5] pt-4">
                <div className="mb-2 text-sm font-medium text-[#777169]">Available Versions</div>
                <div className="flex flex-wrap gap-2">
                  {proxyUpdateInfo.availableVersions.slice(0, 5).map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => onConfirmProxyUpdate(v)}
                      disabled={proxyUpdating}
                      className="rounded-sm border border-[#e5e5e5] bg-[#f5f5f5] px-2 py-1 text-xs text-[#4e4e4e] transition-colors hover:bg-[#f5f5f5] disabled:opacity-50"
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-[#777169]">Failed to check for updates</div>
        )}
      </div>

      <div className="border-t border-[#e5e5e5] pt-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-black">
          Dashboard Updates
          {dashboardUpdateInfo?.updateAvailable && (
            <span className="rounded-sm border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
              Update Available
            </span>
          )}
        </h3>
        <div className="mt-3 space-y-4">
          {dashboardUpdateLoading ? (
            <div className="text-[#777169]">Checking for updates...</div>
          ) : dashboardUpdateInfo ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-sm border border-[#e5e5e5] bg-white p-4">
                  <div className="text-sm font-medium text-[#777169]">Current Version</div>
                  <div className="mt-1 break-all text-lg font-semibold text-black">
                    {dashboardUpdateInfo.currentVersion}
                  </div>
                </div>
                <div className="rounded-sm border border-[#e5e5e5] bg-white p-4">
                  <div className="text-sm font-medium text-[#777169]">Latest Version</div>
                  <div className="mt-1 break-all text-lg font-semibold text-black">
                    {dashboardUpdateInfo.latestVersion}
                  </div>
                  {dashboardUpdateInfo.releaseNotes && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs text-blue-600 hover:text-blue-600 transition-colors">
                        View release notes
                      </summary>
                      <div className="mt-2 max-h-60 overflow-auto rounded-sm border border-[#e5e5e5] bg-white p-3 text-xs text-[#4e4e4e] prose prose-xs max-w-none [&_h1]:text-sm [&_h1]:font-semibold [&_h1]:text-black [&_h2]:text-xs [&_h2]:font-semibold [&_h2]:text-black [&_h3]:text-xs [&_h3]:font-semibold [&_h3]:text-[#4e4e4e] [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_li]:my-0.5 [&_code]:bg-[#f5f5f5] [&_code]:px-1 [&_code]:rounded [&_a]:text-blue-600 [&_a]:underline [&_p]:my-1">
                        <Markdown>{dashboardUpdateInfo.releaseNotes}</Markdown>
                      </div>
                    </details>
                  )}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row flex-wrap gap-2">
                <Button
                  onClick={onConfirmDashboardUpdate}
                  disabled={dashboardUpdating || !dashboardUpdateInfo.updateAvailable}
                >
                  {dashboardUpdating ? "Updating..." : dashboardUpdateInfo.updateAvailable ? "Update to Latest" : "Up to Date"}
                </Button>
                <Button variant="secondary" onClick={onRefreshDashboardUpdate} disabled={dashboardUpdateLoading}>
                  Refresh
                </Button>
              </div>
            </>
          ) : (
            <div className="text-[#777169]">Failed to check for updates</div>
          )}
        </div>
      </div>
    </div>
  );
}
