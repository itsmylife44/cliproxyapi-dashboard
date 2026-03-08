"use client";

import { Button } from "@/components/ui/button";

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

interface TelegramSettingsProps {
  syncTokens: SyncToken[];
  syncTokensLoading: boolean;
  generatingToken: boolean;
  generatedToken: string | null;
  showInstructions: boolean;
  availableApiKeys: AvailableApiKey[];
  onGenerateToken: () => void;
  onClearGeneratedToken: () => void;
  onCopyToken: (token: string) => void;
  onToggleInstructions: () => void;
  onConfirmRevokeToken: (id: string) => void;
  onUpdateTokenApiKey: (tokenId: string, apiKeyId: string) => void;
}

export function TelegramSettings({
  syncTokens,
  syncTokensLoading,
  generatingToken,
  generatedToken,
  showInstructions,
  availableApiKeys,
  onGenerateToken,
  onClearGeneratedToken,
  onCopyToken,
  onToggleInstructions,
  onConfirmRevokeToken,
  onUpdateTokenApiKey,
}: TelegramSettingsProps) {
  return (
    <section className="space-y-3 rounded-lg border border-slate-700/70 bg-slate-900/40 p-4">
      <div>
        <h2 className="text-sm font-semibold text-slate-100">Config Sync</h2>
        <p className="text-xs text-slate-400">Sync tokens for OpenCode configuration</p>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-100">Sync Tokens</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-400">
              Generate tokens to sync OpenCode configurations
            </p>
            <Button onClick={onGenerateToken} disabled={generatingToken}>
              {generatingToken ? "Generating..." : "Generate Token"}
            </Button>
          </div>

          {generatedToken && (
            <div className="space-y-3 rounded-sm border border-emerald-500/40 bg-emerald-500/10 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-emerald-300">New Token Generated</span>
                <button
                  type="button"
                  onClick={onClearGeneratedToken}
                  className="text-slate-400 hover:text-slate-200"
                >
                  ✕
                </button>
              </div>
              <div className="space-y-2">
                <div className="break-all rounded-sm border border-slate-700/70 bg-slate-900/40 p-3 font-mono text-xs text-slate-200">
                  {generatedToken}
                </div>
                <Button variant="secondary" onClick={() => onCopyToken(generatedToken)}>
                  Copy to Clipboard
                </Button>
              </div>
              <div className="rounded-sm border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                <span className="text-amber-200">
                  This token will only be shown once. Copy it now.
                </span>
              </div>
            </div>
          )}

          {syncTokensLoading ? (
            <div className="p-4 text-center text-slate-400">Loading tokens...</div>
          ) : syncTokens.length === 0 ? (
            <div className="rounded-sm border border-slate-700/70 bg-slate-900/30 p-4 text-sm text-slate-400">
              No sync tokens configured. Generate one to get started.
            </div>
          ) : (
            <div className="overflow-hidden rounded-sm border border-slate-700/70 bg-slate-900/25">
              {syncTokens.map((token) => (
                <div
                  key={token.id}
                  className="space-y-3 border-b border-slate-700/60 px-3 py-3 last:border-b-0"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-medium text-slate-100">{token.name}</div>
                        {token.isRevoked && (
                          <span className="rounded-sm border border-rose-500/40 bg-rose-500/10 px-2 py-0.5 text-xs font-medium text-rose-300">
                            Revoked
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400">
                        Created: {new Date(token.createdAt).toLocaleDateString()}
                      </div>
                      {token.lastUsedAt && (
                        <div className="text-xs text-slate-500">
                          Last used: {new Date(token.lastUsedAt).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                    {!token.isRevoked && (
                      <Button
                        variant="danger"
                        onClick={() => onConfirmRevokeToken(token.id)}
                      >
                        Revoke
                      </Button>
                    )}
                  </div>
                  {!token.isRevoked && (
                    <div className="flex flex-col gap-2 border-t border-slate-700/70 pt-2 sm:flex-row sm:items-center sm:gap-3 sm:pt-1">
                      <label htmlFor={`sync-api-key-${token.id}`} className="whitespace-nowrap text-xs font-medium text-slate-500">
                        Sync API Key
                      </label>
                      <select
                        id={`sync-api-key-${token.id}`}
                        value={token.syncApiKeyId || ""}
                        onChange={(e) => onUpdateTokenApiKey(token.id, e.target.value)}
                        className="flex-1 rounded-sm border border-slate-700/70 bg-slate-900/50 px-3 py-1.5 font-mono text-xs text-slate-200 transition-colors focus:border-blue-400/50 focus:outline-none"
                      >
                        {availableApiKeys.length > 0 ? (
                          <>
                            <option value="" className="bg-[#0f172a] text-slate-100">
                              Auto (first available)
                            </option>
                            {availableApiKeys.map((apiKey) => (
                              <option key={apiKey.id} value={apiKey.id} className="bg-[#0f172a] text-slate-100">
                                {apiKey.name}
                              </option>
                            ))}
                          </>
                        ) : (
                          <option value="" className="bg-[#0f172a] text-slate-100">
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

        <div className="border-t border-slate-700/70 pt-4">
          <button
            type="button"
            onClick={onToggleInstructions}
            className="flex items-center gap-2 text-sm font-medium text-slate-200 hover:text-slate-100"
          >
            <span>{showInstructions ? "▼" : "▶"}</span>
            Setup Instructions
          </button>
          {showInstructions && (
            <div className="mt-3 space-y-4 rounded-sm border border-slate-700/70 bg-slate-900/30 p-4 text-sm text-slate-300">
              <div>
                <div className="font-medium text-slate-100">1. Add to opencode.jsonc plugin array:</div>
                <div className="mt-2 rounded-sm border border-slate-700/70 bg-slate-900/40 p-2 font-mono text-xs">
                  {`"plugin": ["opencode-cliproxyapi-sync@latest", ...]`}
                </div>
              </div>

              <div>
                <div className="font-medium text-white mb-3">2. Create config file:</div>

                <div className="space-y-4">
                  <div className="rounded-sm border border-slate-700/70 bg-slate-900/30 p-3">
                    <div className="mb-2 text-xs font-medium text-slate-200">Standard:</div>
                    <div className="mb-2 font-mono text-xs text-slate-400">
                      ~/.config/opencode-cliproxyapi-sync/config.json
                    </div>
                    <div className="rounded-sm border border-slate-700/70 bg-slate-900/40 p-2 font-mono text-xs">
                      {`{
  "dashboardUrl": "${typeof window !== "undefined" ? window.location.origin : "https://your-dashboard-url"}",
  "syncToken": "paste-token-here",
  "lastKnownVersion": null
}`}
                    </div>
                  </div>

                  <div className="rounded-sm border border-emerald-500/30 bg-emerald-500/5 p-3">
                    <div className="mb-2 text-xs font-medium text-emerald-300">With OCX Profile:</div>
                    <div className="mb-2 font-mono text-xs text-emerald-200/70">
                      ~/.config/opencode/profiles/&lt;profilename&gt;/opencode-cliproxyapi-sync/config.json
                    </div>
                    <div className="rounded-sm border border-slate-700/70 bg-slate-900/40 p-2 font-mono text-xs">
                      {`{
  "dashboardUrl": "${typeof window !== "undefined" ? window.location.origin : "https://your-dashboard-url"}",
  "syncToken": "paste-token-here",
  "lastKnownVersion": null
}`}
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-700/70 pt-2 text-xs text-slate-500">
                The plugin will be auto-installed from npm when opencode starts.
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
