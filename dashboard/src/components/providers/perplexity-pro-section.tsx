"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

type ShowToast = ReturnType<typeof useToast>["showToast"];

interface PerplexityProSectionProps {
  showToast: ShowToast;
}

interface PerplexityCookie {
  id: string;
  label: string;
  isActive: boolean;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export function PerplexityProSection({ showToast }: PerplexityProSectionProps) {
  const [perplexityCookies, setPerplexityCookies] = useState<PerplexityCookie[]>([]);
  const [perplexityCookiesLoading, setPerplexityCookiesLoading] = useState(true);
  const [perplexitySessionToken, setPerplexitySessionToken] = useState("");
  const [perplexityCsrfToken, setPerplexityCsrfToken] = useState("");
  const [perplexityCookieLabel, setPerplexityCookieLabel] = useState("");
  const [perplexityCookieSaving, setPerplexityCookieSaving] = useState(false);
  const [showPerplexitySessionToken, setShowPerplexitySessionToken] = useState(false);
  const [showPerplexityCsrfToken, setShowPerplexityCsrfToken] = useState(false);
  const [perplexityModelSyncing, setPerplexityModelSyncing] = useState(false);

  const loadPerplexityCookies = useCallback(async () => {
    setPerplexityCookiesLoading(true);
    try {
      const res = await fetch("/api/providers/perplexity-cookie");
      if (!res.ok) {
        showToast("Failed to load Perplexity cookies", "error");
        setPerplexityCookiesLoading(false);
        return;
      }
      const data = await res.json();
      setPerplexityCookies(Array.isArray(data.cookies) ? data.cookies : []);
    } catch {
      showToast("Network error", "error");
    } finally {
      setPerplexityCookiesLoading(false);
    }
  }, [showToast]);

  const handlePerplexityCookieSave = async () => {
    const sessionToken = perplexitySessionToken.trim();
    if (!sessionToken) {
      showToast("Session token is required", "error");
      return;
    }
    const csrfToken = perplexityCsrfToken.trim();
    const cookieObj: Record<string, string> = { "next-auth.session-token": sessionToken };
    if (csrfToken) {
      cookieObj["next-auth.csrf-token"] = csrfToken;
    }
    const cookieData = JSON.stringify(cookieObj);
    setPerplexityCookieSaving(true);
    try {
      const res = await fetch("/api/providers/perplexity-cookie", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cookieData,
          label: perplexityCookieLabel.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error?.message ?? data.error ?? "Failed to save cookie", "error");
        return;
      }
      if (data.providerProvisioned) {
        showToast("Cookie saved & Perplexity Pro provider auto-configured", "success");
      } else {
        showToast("Perplexity cookie saved", "success");
      }
      setPerplexitySessionToken("");
      setPerplexityCsrfToken("");
      setPerplexityCookieLabel("");
      void loadPerplexityCookies();
    } catch {
      showToast("Network error", "error");
    } finally {
      setPerplexityCookieSaving(false);
    }
  };

  const handlePerplexityModelSync = async () => {
    setPerplexityModelSyncing(true);
    try {
      const res = await fetch("/api/providers/perplexity-cookie/sync-models", {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error?.message ?? data.error ?? "Failed to sync models", "error");
        return;
      }
      if (data.created) {
        showToast(`Provider created with ${data.modelCount} models`, "success");
      } else if (data.added?.length > 0 || data.removed?.length > 0) {
        const parts: string[] = [];
        if (data.added?.length > 0) parts.push(`${data.added.length} added`);
        if (data.removed?.length > 0) parts.push(`${data.removed.length} removed`);
        showToast(`Models synced: ${parts.join(", ")}`, "success");
      } else {
        showToast("Models already up to date", "success");
      }
    } catch {
      showToast("Network error", "error");
    } finally {
      setPerplexityModelSyncing(false);
    }
  };

  const handlePerplexityCookieDelete = async (id: string) => {
    try {
      const res = await fetch("/api/providers/perplexity-cookie", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) {
        const data = await res.json();
        showToast(data.error?.message ?? data.error ?? "Failed to delete cookie", "error");
        return;
      }
      showToast("Perplexity cookie removed", "success");
      void loadPerplexityCookies();
    } catch {
      showToast("Network error", "error");
    }
  };

  useEffect(() => {
    void loadPerplexityCookies();
  }, [loadPerplexityCookies]);

  return (
    <section id="provider-perplexity" className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">Perplexity Pro</h2>
          <p className="text-xs text-slate-400">Browser session cookies for Perplexity Pro access</p>
        </div>
        <span className="text-xs font-medium text-slate-400">{perplexityCookies.length} configured</span>
      </div>

      <div className="space-y-3">
        <div className="rounded-sm border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-200/80">
          <strong className="text-amber-100">How to get your cookies:</strong>
          <ol className="mt-1.5 list-decimal space-y-1 pl-4">
            <li>Go to <span className="font-mono text-amber-100">perplexity.ai</span> and sign in to your Pro account</li>
            <li>Open DevTools (<span className="font-mono text-amber-100">F12</span>) → Application → Cookies → <span className="font-mono text-amber-100">https://www.perplexity.ai</span></li>
            <li>Copy each cookie value and paste into the fields below</li>
          </ol>
        </div>

        <div>
          <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">Saved Cookies</h3>
        </div>
        {perplexityCookiesLoading ? (
          <div className="flex items-center justify-center rounded-md border border-slate-700/70 bg-slate-900/25 p-6">
            <div className="flex flex-col items-center gap-3">
              <div className="size-6 animate-spin rounded-full border-4 border-white/20 border-t-blue-500"></div>
              <p className="text-xs text-slate-400">Loading cookies...</p>
            </div>
          </div>
        ) : perplexityCookies.length === 0 ? (
          <div className="rounded-sm border border-slate-700/70 bg-slate-900/30 p-3 text-xs text-slate-400">
            No Perplexity cookies configured yet.
          </div>
        ) : (
          <div className="divide-y divide-slate-700/70 rounded-md border border-slate-700/70 bg-slate-900/25">
            {perplexityCookies.map((cookie) => (
              <div key={cookie.id} className="flex items-center justify-between gap-3 p-3">
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-100">{cookie.label || "Unnamed"}</span>
                    <span className={cn(
                      "inline-flex items-center rounded-sm px-2 py-0.5 text-[11px] font-medium",
                      cookie.isActive
                        ? "border border-emerald-400/50 bg-emerald-500/10 text-emerald-300"
                        : "border border-slate-600/70 bg-slate-800/60 text-slate-400"
                    )}>
                      {cookie.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Added {new Date(cookie.createdAt).toLocaleDateString()}
                    {cookie.lastUsedAt && (
                      <> · Last used {new Date(cookie.lastUsedAt).toLocaleDateString()}</>
                    )}
                  </p>
                </div>
                <Button
                  variant="danger"
                  className="shrink-0 px-2.5 py-1 text-xs"
                  onClick={() => handlePerplexityCookieDelete(cookie.id)}
                >
                  Delete
                </Button>
              </div>
            ))}
          </div>
        )}

        {perplexityCookies.length > 0 && (
          <div className="flex items-center justify-between rounded-md border border-slate-700/70 bg-slate-900/25 p-3">
            <div className="space-y-0.5">
              <p className="text-xs font-medium text-slate-300">Sync Models</p>
              <p className="text-[11px] text-slate-500">Fetch latest models from sidecar and update proxy config</p>
            </div>
            <Button
              className="shrink-0 px-3 py-1.5 text-xs"
              onClick={handlePerplexityModelSync}
              disabled={perplexityModelSyncing}
            >
              {perplexityModelSyncing ? "Syncing…" : "Sync Models"}
            </Button>
          </div>
        )}

        <div>
          <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">Add Cookie</h3>
        </div>
        <div className="space-y-3 rounded-md border border-slate-700/70 bg-slate-900/25 p-3">
          <div>
            <label htmlFor="perplexity-label" className="mb-1.5 block text-xs font-medium text-slate-300">
              Label <span className="text-slate-500">(optional)</span>
            </label>
            <input
              id="perplexity-label"
              type="text"
              value={perplexityCookieLabel}
              onChange={(e) => setPerplexityCookieLabel(e.target.value)}
              placeholder="My Perplexity Pro account"
              disabled={perplexityCookieSaving}
              className="glass-input w-full rounded-md px-3 py-1.5 text-sm placeholder:text-slate-500 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="perplexity-session-token" className="mb-1.5 block text-xs font-medium text-slate-300">
              Session Token <span className="text-red-400">*</span>
            </label>
            <p className="mb-1.5 text-[11px] text-slate-500 font-mono">next-auth.session-token</p>
            <div className="relative">
              <input
                id="perplexity-session-token"
                type={showPerplexitySessionToken ? "text" : "password"}
                value={perplexitySessionToken}
                onChange={(e) => setPerplexitySessionToken(e.target.value)}
                placeholder="Paste session token value"
                disabled={perplexityCookieSaving}
                className="glass-input w-full rounded-md px-3 py-1.5 pr-10 font-mono text-xs placeholder:text-slate-600 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPerplexitySessionToken(!showPerplexitySessionToken)}
                className="absolute inset-y-0 right-0 flex items-center px-2.5 text-slate-400 hover:text-slate-200 transition-colors"
                tabIndex={-1}
                aria-label={showPerplexitySessionToken ? "Hide session token" : "Show session token"}
              >
                {showPerplexitySessionToken ? (
                  <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                ) : (
                  <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                )}
              </button>
            </div>
          </div>
          <div>
            <label htmlFor="perplexity-csrf-token" className="mb-1.5 block text-xs font-medium text-slate-300">
              CSRF Token <span className="text-slate-500">(optional)</span>
            </label>
            <p className="mb-1.5 text-[11px] text-slate-500 font-mono">next-auth.csrf-token</p>
            <div className="relative">
              <input
                id="perplexity-csrf-token"
                type={showPerplexityCsrfToken ? "text" : "password"}
                value={perplexityCsrfToken}
                onChange={(e) => setPerplexityCsrfToken(e.target.value)}
                placeholder="Paste CSRF token value"
                disabled={perplexityCookieSaving}
                className="glass-input w-full rounded-md px-3 py-1.5 pr-10 font-mono text-xs placeholder:text-slate-600 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPerplexityCsrfToken(!showPerplexityCsrfToken)}
                className="absolute inset-y-0 right-0 flex items-center px-2.5 text-slate-400 hover:text-slate-200 transition-colors"
                tabIndex={-1}
                aria-label={showPerplexityCsrfToken ? "Hide CSRF token" : "Show CSRF token"}
              >
                {showPerplexityCsrfToken ? (
                  <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                ) : (
                  <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                )}
              </button>
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              onClick={handlePerplexityCookieSave}
              disabled={perplexityCookieSaving || !perplexitySessionToken.trim()}
            >
              {perplexityCookieSaving ? "Saving…" : "Save Cookie"}
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
