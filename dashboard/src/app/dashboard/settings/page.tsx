"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { DeployDashboard } from "@/components/deploy-dashboard";

interface UpdateInfo {
  currentVersion: string;
  currentDigest: string;
  latestVersion: string;
  latestDigest: string;
  updateAvailable: boolean;
  availableVersions: string[];
}

interface SyncToken {
  id: string;
  name: string;
  syncApiKeyId: string | null;
  syncApiKeyName: string | null;
  createdAt: string;
  lastUsedAt: string | null;
  isRevoked: boolean;
}

interface AvailableApiKey {
  id: string;
  name: string;
}

export default function SettingsPage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [cliProxyVersion, setCliProxyVersion] = useState<string | null>(null);
  const [cliProxyLoading, setCliProxyLoading] = useState(true);
  
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [updateLoading, setUpdateLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [revokingSessions, setRevokingSessions] = useState(false);
  
  const [syncTokens, setSyncTokens] = useState<SyncToken[]>([]);
  const [syncTokensLoading, setSyncTokensLoading] = useState(true);
  const [generatingToken, setGeneratingToken] = useState(false);
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [showInstructions, setShowInstructions] = useState(false);
  const [availableApiKeys, setAvailableApiKeys] = useState<AvailableApiKey[]>([]);
  
  const { showToast } = useToast();

  const fetchUpdateInfo = useCallback(async () => {
    setUpdateLoading(true);
    try {
      const res = await fetch("/api/update/check");
      if (res.ok) {
        const data = await res.json();
        setUpdateInfo(data);
      }
    } catch {
      console.error("Failed to fetch update info");
    } finally {
      setUpdateLoading(false);
    }
  }, []);

  const fetchSyncTokens = useCallback(async () => {
    setSyncTokensLoading(true);
    try {
      const res = await fetch("/api/config-sync/tokens");
      if (res.ok) {
        const data = await res.json();
        setSyncTokens(data.tokens || []);
        if (Array.isArray(data.apiKeys)) {
          setAvailableApiKeys(data.apiKeys);
        }
      }
    } catch {
      console.error("Failed to fetch sync tokens");
    } finally {
      setSyncTokensLoading(false);
    }
  }, []);

  useEffect(() => {
    const fetchVersion = async () => {
      setCliProxyLoading(true);
      try {
        const res = await fetch("/api/management/latest-version");
        if (!res.ok) {
          setCliProxyVersion(null);
          setCliProxyLoading(false);
          return;
        }

        const data = await res.json();
        const version = typeof data?.["latest-version"] === "string" ? data["latest-version"] : null;
        setCliProxyVersion(version);
        setCliProxyLoading(false);
      } catch {
        setCliProxyVersion(null);
        setCliProxyLoading(false);
      }
    };

    fetchVersion();
    fetchUpdateInfo();
    fetchSyncTokens();
  }, [fetchUpdateInfo, fetchSyncTokens]);

  const handlePasswordChange = async (e: { preventDefault: () => void }) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      showToast("New passwords do not match", "error");
      return;
    }

    if (newPassword.length < 8) {
      showToast("Password must be at least 8 characters", "error");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      if (!res.ok) {
        const data = await res.json();
        showToast(data.error?.message ?? data.error ?? "Failed to change password", "error");
        setLoading(false);
        return;
      }

      showToast("Password changed successfully", "success");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setLoading(false);
    } catch {
      showToast("Network error", "error");
      setLoading(false);
    }
  };

  const handleUpdate = async (version: string = "latest") => {
    if (!confirm(`Update CLIProxyAPI to ${version}? The service will restart.`)) {
      return;
    }

    setUpdating(true);
    try {
      const res = await fetch("/api/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version, confirm: true }),
      });

      if (res.ok) {
        showToast(`Updated to ${version}. Service is restarting...`, "success");
        setTimeout(() => {
          fetchUpdateInfo();
        }, 10000);
      } else {
        const data = await res.json();
        showToast(data.error || "Update failed", "error");
      }
    } catch {
      showToast("Network error during update", "error");
    } finally {
      setUpdating(false);
    }
  };

  const handleGenerateToken = async () => {
    setGeneratingToken(true);
    try {
      const res = await fetch("/api/config-sync/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        const data = await res.json();
        showToast(data.error || "Failed to generate token", "error");
        setGeneratingToken(false);
        return;
      }

      const data = await res.json();
      setGeneratedToken(data.token);
      showToast("Token generated successfully", "success");
      fetchSyncTokens();
      setGeneratingToken(false);
    } catch {
      showToast("Network error", "error");
      setGeneratingToken(false);
    }
  };

  const handleRevokeToken = async (id: string) => {
    if (!confirm("Are you sure you want to revoke this token?")) return;

    try {
      const res = await fetch(`/api/config-sync/tokens/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        showToast(data.error || "Failed to revoke token", "error");
        return;
      }

      showToast("Token revoked successfully", "success");
      fetchSyncTokens();
    } catch {
      showToast("Network error", "error");
    }
  };

  const handleUpdateTokenApiKey = async (tokenId: string, apiKeyId: string) => {
    try {
      const res = await fetch(`/api/config-sync/tokens/${tokenId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ syncApiKey: apiKeyId || null }),
      });

      if (res.ok) {
        showToast("API key updated for sync token", "success");
        const selectedKey = availableApiKeys.find((k) => k.id === apiKeyId);
        setSyncTokens((prev) =>
          prev.map((t) => (t.id === tokenId ? { ...t, syncApiKeyId: apiKeyId || null, syncApiKeyName: selectedKey?.name || null } : t))
        );
      } else {
        const data = await res.json();
        showToast(data.error || "Failed to update API key", "error");
      }
    } catch {
      showToast("Network error", "error");
    }
  };

  const handleCopyToken = async (token: string) => {
    try {
      await navigator.clipboard.writeText(token);
      showToast("Token copied to clipboard", "success");
    } catch {
      showToast("Failed to copy token", "error");
    }
  };

  const handleRevokeAllSessions = async () => {
    if (!confirm("Force logout all users from all devices? This action cannot be undone.")) {
      return;
    }

    setRevokingSessions(true);
    try {
      const res = await fetch("/api/admin/revoke-sessions", {
        method: "POST",
      });

      if (!res.ok) {
        const data = await res.json();
        showToast(data.error || "Failed to revoke sessions", "error");
        setRevokingSessions(false);
        return;
      }

      const data = await res.json();
      showToast(data.message || "All sessions revoked", "success");
      setRevokingSessions(false);
    } catch {
      showToast("Network error", "error");
      setRevokingSessions(false);
    }
  };

   return (
     <div className="space-y-4">
       {/* Page Title */}
       <div>
         <h1 className="text-xl font-bold tracking-tight text-white drop-shadow-lg">
           Settings
         </h1>
         <p className="mt-1 text-sm text-white/60">
           Manage your account, security, and system preferences
         </p>
       </div>

       {/* Account & Security Section */}
       <section className="space-y-4">
         <div>
           <h2 className="text-lg font-semibold text-white/90">Account & Security</h2>
           <div className="mt-1 h-px bg-gradient-to-r from-white/20 to-transparent"></div>
         </div>
         
          <Card>
            <CardHeader>
              <CardTitle>Change Password</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePasswordChange} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <label htmlFor="currentPassword" className="mb-2 block text-sm font-medium text-white/90">
                      Current Password
                    </label>
                    <Input
                      type="password"
                      name="currentPassword"
                      value={currentPassword}
                      onChange={setCurrentPassword}
                      required
                      autoComplete="current-password"
                    />
                  </div>

                  <div>
                    <label htmlFor="newPassword" className="mb-2 block text-sm font-medium text-white/90">
                      New Password
                    </label>
                    <Input
                      type="password"
                      name="newPassword"
                      value={newPassword}
                      onChange={setNewPassword}
                      required
                      autoComplete="new-password"
                      placeholder="Minimum 8 characters"
                    />
                  </div>

                  <div>
                    <label htmlFor="confirmPassword" className="mb-2 block text-sm font-medium text-white/90">
                      Confirm New Password
                    </label>
                    <Input
                      type="password"
                      name="confirmPassword"
                      value={confirmPassword}
                      onChange={setConfirmPassword}
                      required
                      autoComplete="new-password"
                    />
                  </div>
                </div>

                <Button type="submit" disabled={loading}>
                  {loading ? "Changing..." : "Change Password"}
                </Button>
              </form>
            </CardContent>
          </Card>
       </section>

       {/* Config Sync Section */}
       <section className="space-y-4">
         <div>
           <h2 className="text-lg font-semibold text-white/90">Config Sync</h2>
           <div className="mt-1 h-px bg-gradient-to-r from-white/20 to-transparent"></div>
         </div>

         <Card>
           <CardHeader>
             <CardTitle>Sync Tokens</CardTitle>
           </CardHeader>
           <CardContent className="space-y-4">
             <div className="space-y-3">
               <div className="flex items-center justify-between">
                 <p className="text-sm text-white/70">
                   Generate tokens to sync OpenCode configurations
                 </p>
                 <Button onClick={handleGenerateToken} disabled={generatingToken}>
                   {generatingToken ? "Generating..." : "Generate Token"}
                 </Button>
               </div>

               {generatedToken && (
                 <div className="space-y-3 rounded-lg border border-green-500/50 bg-green-500/10 p-4">
                   <div className="flex items-center justify-between">
                     <span className="text-sm font-medium text-green-400">New Token Generated</span>
                     <button
                       type="button"
                       onClick={() => setGeneratedToken(null)}
                       className="text-white/50 hover:text-white/80"
                     >
                       ✕
                     </button>
                   </div>
                   <div className="space-y-2">
                     <div className="break-all rounded bg-black/30 p-3 font-mono text-xs text-white">
                       {generatedToken}
                     </div>
                     <Button variant="secondary" onClick={() => handleCopyToken(generatedToken)}>
                       Copy to Clipboard
                     </Button>
                   </div>
                   <div className="border-l-4 border-yellow-400/60 bg-yellow-500/20 p-3 text-sm rounded-r-xl">
                     <span className="text-white/90">
                       This token will only be shown once. Copy it now.
                     </span>
                   </div>
                 </div>
               )}

               {syncTokensLoading ? (
                 <div className="p-4 text-center text-white/70">Loading tokens...</div>
               ) : syncTokens.length === 0 ? (
                 <div className="border-l-4 border-white/30 backdrop-blur-xl bg-white/5 p-4 text-sm text-white/80 rounded-r-xl">
                   No sync tokens configured. Generate one to get started.
                 </div>
               ) : (
                 <div className="space-y-2">
                   {syncTokens.map((token) => (
                     <div
                       key={token.id}
                       className="rounded-lg border border-white/20 bg-white/5 p-4 space-y-3"
                     >
                       <div className="flex items-center justify-between">
                         <div className="flex-1 space-y-1">
                           <div className="flex items-center gap-2">
                             <div className="text-sm font-medium text-white">{token.name}</div>
                             {token.isRevoked && (
                               <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-xs font-medium text-red-400">
                                 Revoked
                               </span>
                             )}
                           </div>
                           <div className="text-xs text-white/70">
                             Created: {new Date(token.createdAt).toLocaleDateString()}
                           </div>
                           {token.lastUsedAt && (
                             <div className="text-xs text-white/60">
                               Last used: {new Date(token.lastUsedAt).toLocaleDateString()}
                             </div>
                           )}
                         </div>
                         {!token.isRevoked && (
                           <Button
                             variant="danger"
                             onClick={() => handleRevokeToken(token.id)}
                           >
                             Revoke
                           </Button>
                         )}
                       </div>
                       {!token.isRevoked && (
                         <div className="flex items-center gap-3 pt-1 border-t border-white/10">
                           <label htmlFor={`sync-api-key-${token.id}`} className="text-xs font-medium text-white/50 whitespace-nowrap">
                             Sync API Key
                           </label>
                           <select
                             id={`sync-api-key-${token.id}`}
                             value={token.syncApiKeyId || ""}
                             onChange={(e) => handleUpdateTokenApiKey(token.id, e.target.value)}
                             className="flex-1 backdrop-blur-xl bg-white/8 border border-white/15 rounded-lg px-3 py-1.5 text-xs text-white/90 font-mono focus:border-purple-400/50 focus:bg-white/12 focus:outline-none transition-all"
                           >
                             {availableApiKeys.length > 0 ? (
                               <>
                                 <option value="" className="bg-[#1a1a2e] text-white">
                                   Auto (first available)
                                 </option>
                                 {availableApiKeys.map((apiKey) => (
                                   <option key={apiKey.id} value={apiKey.id} className="bg-[#1a1a2e] text-white">
                                     {apiKey.name}
                                   </option>
                                 ))}
                               </>
                             ) : (
                               <option value="" className="bg-[#1a1a2e] text-white">
                                 No API keys — create one first
                               </option>
                             )}
                           </select>
                         </div>
                       )}
                     </div>
                   ))}
                 </div>
               )}
             </div>

             <div className="border-t border-white/10 pt-4">
               <button
                 type="button"
                 onClick={() => setShowInstructions(!showInstructions)}
                 className="flex items-center gap-2 text-sm font-medium text-white/90 hover:text-white"
               >
                 <span>{showInstructions ? "▼" : "▶"}</span>
                 Setup Instructions
               </button>
               {showInstructions && (
                 <div className="mt-3 space-y-4 rounded-lg bg-white/5 p-4 text-sm text-white/80">
                   <div>
                     <div className="font-medium text-white">1. Add to opencode.jsonc plugin array:</div>
                     <div className="mt-2 rounded bg-black/30 p-2 font-mono text-xs">
                       {`"plugin": ["opencode-cliproxyapi-sync@latest", ...]`}
                     </div>
                   </div>
                   
                   <div>
                     <div className="font-medium text-white mb-3">2. Create config file:</div>
                     
                     <div className="space-y-4">
                       <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                         <div className="text-xs font-medium text-white/90 mb-2">Standard:</div>
                         <div className="text-xs text-white/70 font-mono mb-2">
                           ~/.config/opencode-cliproxyapi-sync/config.json
                         </div>
                         <div className="rounded bg-black/30 p-2 font-mono text-xs">
                           {`{
  "dashboardUrl": "${typeof window !== "undefined" ? window.location.origin : "https://your-dashboard-url"}",
  "syncToken": "paste-token-here",
  "lastKnownVersion": null
}`}
                         </div>
                       </div>

                       <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
                         <div className="text-xs font-medium text-emerald-400 mb-2">With OCX Profile:</div>
                         <div className="text-xs text-emerald-300/70 font-mono mb-2">
                           ~/.config/opencode/profiles/&lt;profilename&gt;/opencode-cliproxyapi-sync/config.json
                         </div>
                         <div className="rounded bg-black/30 p-2 font-mono text-xs">
                           {`{
  "dashboardUrl": "${typeof window !== "undefined" ? window.location.origin : "https://your-dashboard-url"}",
  "syncToken": "paste-token-here",
  "lastKnownVersion": null
}`}
                         </div>
                       </div>
                     </div>
                   </div>
                   
                   <div className="text-xs text-white/60 pt-2 border-t border-white/10">
                     The plugin will be auto-installed from npm when opencode starts.
                   </div>
                 </div>
               )}
             </div>
           </CardContent>
         </Card>
       </section>

       {/* System Section */}
       <section className="space-y-4">
         <div>
           <h2 className="text-lg font-semibold text-white/90">System</h2>
           <div className="mt-1 h-px bg-gradient-to-r from-white/20 to-transparent"></div>
         </div>

         <Card>
           <CardHeader>
             <CardTitle className="flex items-center gap-2">
               CLIProxyAPI Updates
               {updateInfo?.updateAvailable && (
                 <span className="rounded-full bg-green-500/20 px-2 py-0.5 text-xs font-medium text-green-400">
                   Update Available
                 </span>
               )}
             </CardTitle>
           </CardHeader>
           <CardContent className="space-y-4">
             {updateLoading ? (
               <div className="text-white/70">Checking for updates...</div>
             ) : updateInfo ? (
               <>
                 <div className="grid gap-4 md:grid-cols-2">
                   <div className="rounded-lg bg-white/5 p-4">
                     <div className="text-sm font-medium text-white/70">Current Version</div>
                     <div className="mt-1 text-lg font-semibold text-white">
                       {updateInfo.currentVersion}
                     </div>
                     <div className="mt-0.5 text-xs text-white/50 truncate">
                       Digest: {updateInfo.currentDigest}
                     </div>
                   </div>
                   <div className="rounded-lg bg-white/5 p-4">
                     <div className="text-sm font-medium text-white/70">Latest Version</div>
                     <div className="mt-1 text-lg font-semibold text-white">
                       {updateInfo.latestVersion}
                     </div>
                     <div className="mt-0.5 text-xs text-white/50 truncate">
                       Digest: {updateInfo.latestDigest}
                     </div>
                   </div>
                 </div>

                 <div className="flex flex-col sm:flex-row flex-wrap gap-2">
                   <Button
                     onClick={() => handleUpdate("latest")}
                     disabled={updating || !updateInfo.updateAvailable}
                   >
                     {updating ? "Updating..." : updateInfo.updateAvailable ? "Update to Latest" : "Up to Date"}
                   </Button>
                   <Button variant="secondary" onClick={() => fetchUpdateInfo()} disabled={updateLoading}>
                     Refresh
                   </Button>
                 </div>

                 {updateInfo.availableVersions.length > 0 && (
                   <div className="border-t border-white/10 pt-4">
                     <div className="mb-2 text-sm font-medium text-white/70">Available Versions</div>
                     <div className="flex flex-wrap gap-2">
                       {updateInfo.availableVersions.slice(0, 5).map((v) => (
                         <button
                           key={v}
                           type="button"
                           onClick={() => handleUpdate(v)}
                           disabled={updating}
                           className="rounded bg-white/10 px-2 py-1 text-xs text-white/80 transition-colors hover:bg-white/20 disabled:opacity-50"
                         >
                           {v}
                         </button>
                       ))}
                     </div>
                   </div>
                 )}
                </>
              ) : (
                <div className="text-white/70">Failed to check for updates</div>
              )}
            </CardContent>
          </Card>

          <DeployDashboard />

          <Card>
            <CardHeader>
              <CardTitle>Session Control</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-white/70">
                Immediately revoke all active user sessions across all devices.
              </p>
              <Button variant="danger" onClick={handleRevokeAllSessions} disabled={revokingSessions}>
                {revokingSessions ? "Revoking..." : "Force Logout All Users"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>System Information</CardTitle>
            </CardHeader>
           <CardContent>
             <div className="grid gap-4 md:grid-cols-3 text-sm">
               <div className="border-l-4 border-purple-400/60 p-4 backdrop-blur-xl bg-white/5 rounded-r-xl">
                 <div className="font-medium text-white/70">Environment</div>
                 <div className="mt-1 text-white">{process.env.NODE_ENV || "production"}</div>
               </div>
               <div className="border-l-4 border-blue-400/60 p-4 backdrop-blur-xl bg-white/5 rounded-r-xl">
                 <div className="font-medium text-white/70">Next.js</div>
                 <div className="mt-1 text-white">16.1.6</div>
               </div>
               <div className="border-l-4 border-teal-400/60 p-4 backdrop-blur-xl bg-white/5 rounded-r-xl">
                 <div className="font-medium text-white/70">React</div>
                 <div className="mt-1 text-white">19.2.3</div>
               </div>
             </div>
             
             <div className="mt-4 pt-4 border-t border-white/10">
               <h3 className="text-sm font-medium text-white/70 mb-3">Version Details</h3>
               <div className="space-y-2 text-sm">
                 <div className="flex items-center justify-between text-white/80">
                   <span>Dashboard Version:</span>
                   <span className="font-mono">1.0.0</span>
                 </div>
                 <div className="flex items-center justify-between text-white/80">
                   <span>CLIProxyAPI:</span>
                   <span className="font-mono">
                     {cliProxyLoading ? "Loading..." : cliProxyVersion || "Unknown"}
                   </span>
                 </div>
               </div>
             </div>
           </CardContent>
         </Card>
       </section>
     </div>
   );
}
